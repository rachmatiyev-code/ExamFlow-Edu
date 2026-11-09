import { ChatMessage } from '../types';
import { GasClient } from './gasClient';
import { FirebaseChatService } from './firebaseChatService';

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
  private pollInterval: any = null;
  private knownMessageIds: Set<string> = new Set();
  private channel: BroadcastChannel | null = null;
  private currentUser: {
    role: 'teacher' | 'student';
    name: string;
    nis?: string;
    classGrade?: string;
  } | null = null;

  constructor() {
    this.setupBroadcastChannel();
    this.startBackgroundSync();
  }

  private setupBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('examflow_live_chat_channel');
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'chat:message' && event.data.data) {
            this.notifyMessage(event.data.data, false);
          }
        };
      } catch (err) {
        console.warn('[ChatService] BroadcastChannel not supported:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'examflow_chat_event_v1' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed && parsed.data) {
              this.notifyMessage(parsed.data, false);
            }
          } catch {}
        }
      });
    }
  }

  private broadcastLocal(msg: ChatMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'chat:message', data: msg });
      } catch {}
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('examflow_chat_event_v1', JSON.stringify({ data: msg, ts: Date.now() }));
      } catch {}
    }
  }

  public initialize(user: {
    role: 'teacher' | 'student';
    name: string;
    nis?: string;
    classGrade?: string;
  }) {
    this.currentUser = user;
    this.connect();

    // Berlangganan real-time Google Cloud & Firebase Firestore untuk Fitur Chat Bantuan
    try {
      FirebaseChatService.subscribeMessages((msg) => {
        this.notifyMessage(msg, false);
      });
    } catch (e) {
      console.warn('[ChatService] Firebase subscription error:', e);
    }

    const guestNis = typeof window !== 'undefined' ? localStorage.getItem('guest_student_nis') || undefined : undefined;
    // Trigger immediate history fetch
    this.getHistory({ nis: user.nis, role: user.role, guestNis }).then((msgs) => {
      msgs.forEach((m) => this.notifyMessage(m, false));
    });
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
          role: this.currentUser.role,
          name: this.currentUser.name,
          nis: this.currentUser.nis,
          classGrade: this.currentUser.classGrade,
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
              role: this.currentUser.role,
              name: this.currentUser.name,
              nis: this.currentUser.nis,
              classGrade: this.currentUser.classGrade,
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
            this.notifyMessage(payload.data, true);
          } else if ((payload.type === 'chat:history' || payload.type === 'chat:init') && payload.data) {
            const list = Array.isArray(payload.data) ? payload.data : (payload.data.messages || []);
            list.forEach((msg: ChatMessage) => this.notifyMessage(msg, false));
          } else if (payload.type === 'chat:presence' && payload.data) {
            const d = payload.data;
            this.notifyPresence({
              teachers: d.teachers ?? d.teachersOnline ?? 0,
              students: d.students ?? d.studentsOnline ?? 0,
            });
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

      this.ws.onerror = () => {
        this.isConnected = false;
        this.notifyStatus(false);
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 3500);
  }

  private startBackgroundSync() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    // Poll every 2 seconds to guarantee 100% sync reliability across all devices
    this.pollInterval = setInterval(async () => {
      if (!this.currentUser) return;
      try {
        const guestNis = typeof window !== 'undefined' ? localStorage.getItem('guest_student_nis') || undefined : undefined;
        const msgs = await this.getHistory({
          nis: this.currentUser.nis,
          role: this.currentUser.role,
          guestNis
        });
        if (Array.isArray(msgs) && msgs.length > 0) {
          msgs.forEach((m) => this.notifyMessage(m, false));
        }
      } catch {
        // Silently ignore background poll errors
      }
    }, 2000);
  }

  public async getHistory(params?: { nis?: string; role?: string; guestNis?: string }): Promise<ChatMessage[]> {
    try {
      const query = new URLSearchParams();
      if (params?.nis) query.append('nis', params.nis);
      if (params?.guestNis) query.append('guestNis', params.guestNis);
      if (params?.role) query.append('role', params.role);

      const res = await fetch(`/api/chat/messages?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const rawMsgs = data.messages || [];
        return rawMsgs.map((m: any) => ({
          ...m,
          timestamp: typeof m.timestamp === 'number' ? m.timestamp : (Date.parse(m.timestamp) || Date.now()),
        }));
      }
    } catch (e) {
      console.warn('[ChatService] Failed to fetch chat history via REST:', e);
    }
    return [];
  }

  public async sendMessage(messageData: Partial<ChatMessage>): Promise<ChatMessage | null> {
    const id = messageData.id || `MSG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const senderRole = (messageData.senderRole || this.currentUser?.role || 'student') as 'student' | 'teacher';
    const senderName = messageData.senderName || this.currentUser?.name || (senderRole === 'teacher' ? 'Guru Pengawas' : 'Siswa');
    const senderNis = messageData.senderNis || this.currentUser?.nis || '';

    const fullMessage: ChatMessage = {
      id,
      senderRole,
      senderType: senderRole,
      senderName,
      senderNis,
      classGrade: messageData.classGrade || this.currentUser?.classGrade || '',
      examId: messageData.examId,
      examTitle: messageData.examTitle,
      targetNis: messageData.targetNis || (senderRole === 'student' ? 'all' : undefined),
      targetName: messageData.targetName,
      text: String(messageData.text || '').trim(),
      timestamp: messageData.timestamp ? Number(messageData.timestamp) : Date.now(),
      quickAction: messageData.quickAction,
      isRead: senderRole === 'teacher',
    };

    // 1. Optimistically notify local listeners and cross-tab BroadcastChannel immediately
    this.notifyMessage(fullMessage, true);

    // 2. Try sending via WebSocket (low latency)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'chat:send',
            data: fullMessage,
          })
        );
      } catch (err) {
        console.warn('[ChatService] WS send error:', err);
      }
    }

    // 3. ALWAYS backup / persist with REST API to guarantee delivery even if WebSocket is blocked or disconnected
    try {
      fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullMessage),
      }).catch((e) => {
        console.warn('[ChatService] REST send backup failed:', e);
      });
    } catch {}

    // 4. Kirim ke Google Cloud / Firebase Firestore khusus fitur Chat Bantuan
    try {
      FirebaseChatService.sendMessage(fullMessage).catch((e) => {
        console.warn('[ChatService] Firestore send backup error:', e);
      });
    } catch {}

    // 5. Mirror to Google Sheets (Chat_Bantuan sheet) in background
    GasClient.pushChatMessage({
      id: fullMessage.id,
      senderNis: fullMessage.senderNis || '',
      senderName: fullMessage.senderName,
      senderRole: fullMessage.senderRole,
      targetNis: fullMessage.targetNis || 'all',
      message: fullMessage.text,
      timestamp: new Date(fullMessage.timestamp).toISOString(),
      examId: fullMessage.examId || ''
    }).catch(() => {});

    return fullMessage;
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

  private notifyMessage(msg: ChatMessage, broadcastToLocal: boolean = true) {
    const normalized: ChatMessage = {
      ...msg,
      timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : (Date.parse(String(msg.timestamp)) || Date.now()),
    };

    if (this.knownMessageIds.has(normalized.id)) {
      return;
    }
    this.knownMessageIds.add(normalized.id);

    if (broadcastToLocal) {
      this.broadcastLocal(normalized);
    }

    this.messageListeners.forEach((fn) => {
      try {
        fn(normalized);
      } catch (e) {
        console.error('[ChatService] Error in message listener:', e);
      }
    });
  }

  private notifyPresence(data: { teachers: number; students: number }) {
    this.presenceListeners.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error('[ChatService] Error in presence listener:', e);
      }
    });
  }

  private notifyStatus(status: boolean) {
    this.statusListeners.forEach((fn) => {
      try {
        fn(status);
      } catch (e) {
        console.error('[ChatService] Error in status listener:', e);
      }
    });
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
