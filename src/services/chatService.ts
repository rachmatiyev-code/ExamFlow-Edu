import { ChatMessage } from '../types';

type MessageListener = (message: ChatMessage) => void;
type PresenceListener = (onlineUsers: { teachers: number; students: number }) => void;
type StatusListener = (connected: boolean) => void;

class ChatService {
  private ws: WebSocket | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private presenceListeners: Set<PresenceListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private isConnected = false;
  private reconnectTimeout: any = null;
  private currentUser: {
    role: 'teacher' | 'student';
    name: string;
    nis?: string;
    classGrade?: string;
  } | null = null;

  constructor() {
    // Initial connection attempt will be triggered by initialize()
  }

  public initialize(user: {
    role: 'teacher' | 'student';
    name: string;
    nis?: string;
    classGrade?: string;
  }) {
    this.currentUser = user;
    this.connect();
  }

  public updateUserInfo(user: {
    role: 'teacher' | 'student';
    name: string;
    nis?: string;
    classGrade?: string;
  }) {
    this.currentUser = { ...this.currentUser, ...user };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'auth:register',
          data: this.currentUser,
        })
      );
    }
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
        if (this.currentUser) {
          this.ws?.send(
            JSON.stringify({
              type: 'auth:register',
              data: this.currentUser,
            })
          );
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'chat:message' && payload.data) {
            this.playNotificationSound();
            this.notifyMessage(payload.data);
          } else if (payload.type === 'chat:history' && Array.isArray(payload.data)) {
            payload.data.forEach((msg: ChatMessage) => this.notifyMessage(msg));
          } else if (payload.type === 'chat:presence' && payload.data) {
            this.notifyPresence(payload.data);
          }
        } catch (e) {
          console.error('[ChatService] Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[ChatService] WebSocket error, fallback to REST available', err);
        this.isConnected = false;
        this.notifyStatus(false);
      };
    } catch (e) {
      console.warn('[ChatService] Failed to establish WebSocket connection:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 4000);
  }

  public async getHistory(params?: { nis?: string; role?: string }): Promise<ChatMessage[]> {
    try {
      const query = new URLSearchParams();
      if (params?.nis) query.append('nis', params.nis);
      if (params?.role) query.append('role', params.role);

      const res = await fetch(`/api/chat/messages?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data.messages || [];
      }
    } catch (e) {
      console.warn('[ChatService] Failed to fetch chat history via REST:', e);
    }
    return [];
  }

  public async sendMessage(messageData: Partial<ChatMessage>): Promise<ChatMessage | null> {
    const fullMessage: Partial<ChatMessage> = {
      ...messageData,
      senderRole: this.currentUser?.role || messageData.senderRole || 'student',
      senderName: messageData.senderName || this.currentUser?.name || 'Siswa',
      senderNis: messageData.senderNis || this.currentUser?.nis || '',
      classGrade: messageData.classGrade || this.currentUser?.classGrade || '',
      timestamp: Date.now(),
    };

    // Try sending via WebSocket if open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'chat:send',
          data: fullMessage,
        })
      );
      // We will receive our own message back from the broadcast
      return null;
    }

    // Fallback to REST API
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullMessage),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.message) {
          this.notifyMessage(result.message);
          return result.message;
        }
      }
    } catch (e) {
      console.error('[ChatService] Failed to send message via REST fallback:', e);
    }
    return null;
  }

  public async markAsRead(messageIds: string[]) {
    if (messageIds.length === 0) return;
    try {
      await fetch('/api/chat/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds }),
      });
    } catch (e) {
      console.warn('[ChatService] Failed to mark messages as read:', e);
    }
  }

  public subscribeMessages(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public subscribePresence(listener: PresenceListener) {
    this.presenceListeners.add(listener);
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyMessage(msg: ChatMessage) {
    this.messageListeners.forEach((fn) => fn(msg));
  }

  private notifyPresence(data: { teachers: number; students: number }) {
    this.presenceListeners.forEach((fn) => fn(data));
  }

  private notifyStatus(status: boolean) {
    this.statusListeners.forEach((fn) => fn(status));
  }

  private playNotificationSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch {
      // Audio autoplay policy may block before user interaction
    }
  }
}

export const chatService = new ChatService();
