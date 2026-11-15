import { ChatMessage } from '../types';
import { GasClient } from './gasClient';
import { FirebaseChatService } from './firebaseChatService';

type MessageListener = (message: ChatMessage) => void;
type ReadChangeListener = () => void;
type ClearListener = () => void;

export interface OnlineStudentInfo {
  nis: string;
  name: string;
  classGrade?: string;
  examId?: string;
}

type PresenceListener = (onlineUsers: { teachers: number; students: number; onlineStudents?: OnlineStudentInfo[] }) => void;
type StatusListener = (connected: boolean) => void;

const READ_IDS_STORAGE_KEY = 'examflow_chat_read_ids_v1';

class ChatService {
  private ws: WebSocket | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private presenceListeners: Set<PresenceListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private readChangeListeners: Set<ReadChangeListener> = new Set();
  private clearListeners: Set<ClearListener> = new Set();

  private isConnected = false;
  private reconnectTimeout: any = null;
  private pollInterval: any = null;
  private knownMessageIds: Set<string> = new Set();
  private messagesById: Map<string, ChatMessage> = new Map();
  private readIds: Set<string> = new Set();
  private channel: BroadcastChannel | null = null;
  private firebaseUnsubscribe: (() => void) | null = null;

  private lastSheetsFetchAt = 0;
  private sheetsFetchPromise: Promise<ChatMessage[]> | null = null;
  private hasInitialSyncCompleted = false;

  private currentUser: {
    role: 'teacher' | 'student';
    name: string;
    nis?: string;
    classGrade?: string;
  } | null = null;

  constructor() {
    this.loadReadIds();
    this.setupBroadcastChannel();
    this.setupGasEventBridge();
    this.startBackgroundSync();
  }

  private loadReadIds() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(READ_IDS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => {
            if (typeof id === 'string' && id) this.readIds.add(id);
          });
        }
      }
    } catch {}
  }

  private saveReadIds() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const list = Array.from(this.readIds).slice(-600);
      window.localStorage.setItem(READ_IDS_STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  private setupGasEventBridge() {
    if (typeof window === 'undefined') return;
    window.addEventListener('examflow:gas-chat-synced', (e: any) => {
      const msgs = e?.detail;
      if (Array.isArray(msgs) && msgs.length > 0) {
        this.ingestExternalMessages(msgs, this.hasInitialSyncCompleted);
      }
    });
  }

  private setupBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('examflow_live_chat_channel');
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'chat:message' && event.data.data) {
            this.notifyMessage(event.data.data, false, true);
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
              this.notifyMessage(parsed.data, false, true);
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
    const roleChanged = this.currentUser?.role !== user.role;
    const identityChanged =
      roleChanged ||
      this.currentUser?.nis !== user.nis ||
      this.currentUser?.name !== user.name;

    this.currentUser = user;

    if (roleChanged) {
      this.knownMessageIds.clear();
      this.hasInitialSyncCompleted = false;
    }

    this.connect();

    if (identityChanged && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendWsRegister();
    }

    // Berlangganan real-time Firebase Firestore sekali saja (singleton)
    if (!this.firebaseUnsubscribe) {
      try {
        this.firebaseUnsubscribe = FirebaseChatService.subscribeMessages((msg) => {
          this.notifyMessage(msg, false, this.hasInitialSyncCompleted);
        });
      } catch (e) {
        console.warn('[ChatService] Firebase subscription error:', e);
      }
    }

    const guestNis = typeof window !== 'undefined' ? localStorage.getItem('guest_student_nis') || undefined : undefined;
    // Muat riwayat gabungan (REST + Firestore + Google Sheets Chat_Bantuan)
    this.getHistory({ nis: user.nis, role: user.role, guestNis, forceSheets: true }).then((msgs) => {
      msgs.forEach((m) => this.notifyMessage(m, false, false));
      this.hasInitialSyncCompleted = true;
    });
  }

  public updateUserInfo(user: {
    role: 'teacher' | 'student';
    name: string;
    nis?: string;
    classGrade?: string;
  }) {
    const prev = this.currentUser;
    this.currentUser = { ...this.currentUser, ...user };
    const changed =
      !prev ||
      prev.role !== this.currentUser.role ||
      prev.nis !== this.currentUser.nis ||
      prev.name !== this.currentUser.name ||
      prev.classGrade !== this.currentUser.classGrade;

    if (changed) {
      this.sendWsRegister();
    }
  }

  private sendWsRegister() {
    if (!this.currentUser || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
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
    } catch {}
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
        this.sendWsRegister();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'chat:message' && payload.data) {
            this.notifyMessage(payload.data, true, true);
          } else if ((payload.type === 'chat:history' || payload.type === 'chat:init') && payload.data) {
            const list = Array.isArray(payload.data) ? payload.data : (payload.data.messages || []);
            list.forEach((msg: ChatMessage) => this.notifyMessage(msg, false, false));
          } else if (payload.type === 'chat:presence' && payload.data) {
            const d = payload.data;
            this.notifyPresence({
              teachers: d.teachers ?? d.teachersOnline ?? 0,
              students: d.students ?? d.studentsOnline ?? 0,
              onlineStudents: Array.isArray(d.onlineStudents) ? d.onlineStudents : [],
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
    // Poll setiap 2.5 detik (REST lokal cepat; Google Sheets di-throttle setiap ~4 detik)
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
          msgs.forEach((m) => this.notifyMessage(m, false, this.hasInitialSyncCompleted));
        }
        this.hasInitialSyncCompleted = true;
      } catch {
        // Abaikan error sementara pada polling latar belakang
      }
    }, 2500);
  }

  public isMessageRead(msg: ChatMessage, viewerRole?: 'teacher' | 'student'): boolean {
    if (!msg) return true;
    if (msg.id === 'MSG-INIT-001' || msg.id.startsWith('MSG-RESET-')) return true;
    const role = viewerRole || this.currentUser?.role;
    if (role && msg.senderRole === role) return true;
    if (this.readIds.has(msg.id)) return true;
    // Untuk pesan lama sebelum patch isRead, hanya hormati msg.isRead jika dilihat oleh guru untuk pesan siswa
    if (role === 'teacher' && msg.senderRole === 'student' && msg.isRead) return true;
    return false;
  }

  private normalizeMessage(raw: any): ChatMessage | null {
    if (!raw || typeof raw !== 'object') return null;
    const text = String(raw.text ?? raw.message ?? '').trim();
    if (!text) return null;

    const rawRole = String(raw.senderRole || raw.senderType || 'student').trim().toLowerCase();
    const senderRole: 'student' | 'teacher' | 'system' =
      rawRole === 'teacher' || rawRole === 'guru' || rawRole === 'admin'
        ? 'teacher'
        : rawRole === 'system' || rawRole === 'sistem'
        ? 'system'
        : 'student';

    const rawTs = raw.timestamp;
    const timestamp =
      typeof rawTs === 'number' && !Number.isNaN(rawTs)
        ? rawTs
        : (Date.parse(String(rawTs || '')) || Date.now());

    const rawTarget = String(raw.targetNis ?? '').trim();
    const targetNis = !rawTarget || rawTarget.toLowerCase() === 'all' ? 'all' : rawTarget;

    const quickAction =
      raw.quickAction && typeof raw.quickAction === 'object' && raw.quickAction.type
        ? raw.quickAction
        : undefined;

    const id = String(raw.id || `MSG-${timestamp}-${raw.senderNis || 'anon'}`).trim();

    return {
      id,
      senderRole,
      senderType: senderRole,
      senderName: String(raw.senderName || (senderRole === 'teacher' ? 'Guru Pengawas' : 'Siswa')).trim(),
      senderNis: raw.senderNis ? String(raw.senderNis).trim() : '',
      classGrade: raw.classGrade ? String(raw.classGrade).trim() : '',
      examId: raw.examId ? String(raw.examId).trim() : '',
      examTitle: raw.examTitle ? String(raw.examTitle).trim() : '',
      targetNis,
      targetName: raw.targetName ? String(raw.targetName).trim() : undefined,
      text,
      timestamp,
      quickAction,
      isRead: this.readIds.has(id) || Boolean(raw.isRead && !(senderRole === 'teacher' && this.currentUser?.role === 'student')),
    };
  }

  private matchesStudentFilter(msg: ChatMessage, nis?: string, guestNis?: string): boolean {
    const cleanTarget = String(msg.targetNis || '').trim().toLowerCase();
    const cleanSender = String(msg.senderNis || '').trim().toLowerCase();
    const myNis = String(nis || '').trim().toLowerCase();
    const myGuest = String(guestNis || '').trim().toLowerCase();

    if (!cleanTarget || cleanTarget === 'all') return true;
    if (myNis && (cleanTarget === myNis || cleanSender === myNis)) return true;
    if (myGuest && (cleanTarget === myGuest || cleanSender === myGuest)) return true;
    return false;
  }

  private async fetchSheetsChatThrottled(force?: boolean): Promise<ChatMessage[]> {
    const now = Date.now();
    if (!force && now - this.lastSheetsFetchAt < 4000) {
      return [];
    }
    if (this.sheetsFetchPromise) {
      return this.sheetsFetchPromise;
    }

    this.lastSheetsFetchAt = now;
    this.sheetsFetchPromise = GasClient.getChatMessages()
      .catch(() => [])
      .finally(() => {
        this.sheetsFetchPromise = null;
      });

    return this.sheetsFetchPromise;
  }

  public ingestExternalMessages(rawMsgs: any[], playSoundForNew = false) {
    if (!Array.isArray(rawMsgs)) return;
    rawMsgs.forEach((raw) => {
      const normalized = this.normalizeMessage(raw);
      if (normalized) {
        this.messagesById.set(normalized.id, normalized);
        this.notifyMessage(normalized, false, playSoundForNew);
      }
    });
  }

  public async getHistory(params?: {
    nis?: string;
    role?: string;
    guestNis?: string;
    forceSheets?: boolean;
  }): Promise<ChatMessage[]> {
    const isTeacher = (params?.role || this.currentUser?.role) === 'teacher';
    const queryNis = params?.nis ?? this.currentUser?.nis;
    const queryGuestNis =
      params?.guestNis ??
      (typeof window !== 'undefined' ? localStorage.getItem('guest_student_nis') || undefined : undefined);

    // Jalankan fetch paralel dari Server REST, Firebase Firestore, dan Google Sheets (Chat_Bantuan)
    const restPromise = (async (): Promise<ChatMessage[]> => {
      try {
        const query = new URLSearchParams();
        if (queryNis) query.append('nis', queryNis);
        if (queryGuestNis) query.append('guestNis', queryGuestNis);
        if (isTeacher) query.append('role', 'teacher');
        query.append('_t', String(Date.now()));

        const res = await fetch(`/api/chat/messages?${query.toString()}`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.messages) ? data.messages : [];
      } catch {
        return [];
      }
    })();

    const firestorePromise = FirebaseChatService.getRecentMessages().catch(() => []);
    const sheetsPromise = this.fetchSheetsChatThrottled(params?.forceSheets);

    const [restMsgs, fbMsgs, sheetMsgs] = await Promise.all([
      restPromise,
      firestorePromise,
      sheetsPromise,
    ]);

    const mergeIntoCache = (list: any[]) => {
      list.forEach((item) => {
        const norm = this.normalizeMessage(item);
        if (!norm) return;
        const existing = this.messagesById.get(norm.id);
        if (!existing) {
          this.messagesById.set(norm.id, norm);
        } else {
          // Gabungkan metadata tambahan (misal quickAction atau targetName dari WS/Firestore jika di Sheets tidak ada)
          this.messagesById.set(norm.id, {
            ...norm,
            targetName: existing.targetName || norm.targetName,
            classGrade: existing.classGrade || norm.classGrade,
            examTitle: existing.examTitle || norm.examTitle,
            quickAction: existing.quickAction || norm.quickAction,
            isRead: this.readIds.has(norm.id) || existing.isRead || norm.isRead,
          });
        }
      });
    };

    mergeIntoCache(restMsgs);
    mergeIntoCache(fbMsgs);
    mergeIntoCache(sheetMsgs);

    const roleForRead = isTeacher ? 'teacher' : 'student';
    const combined = Array.from(this.messagesById.values())
      .filter((m) => isTeacher || this.matchesStudentFilter(m, queryNis, queryGuestNis))
      .map((m) => ({
        ...m,
        isRead: this.isMessageRead(m, roleForRead),
      }));

    combined.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    return combined;
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
      targetNis: messageData.targetNis || 'all',
      targetName: messageData.targetName,
      text: String(messageData.text || '').trim(),
      timestamp: messageData.timestamp ? Number(messageData.timestamp) : Date.now(),
      quickAction: messageData.quickAction,
      isRead: false, // Pesan baru selalu belum dibaca oleh penerima
    };

    if (!fullMessage.text) return null;

    // Tandai sudah dibaca oleh pengirim di browser pengirim agar pengirim tidak mendapat badge unread sendiri
    this.readIds.add(fullMessage.id);
    this.saveReadIds();
    this.messagesById.set(fullMessage.id, { ...fullMessage, isRead: true });

    // 1. Optimistically notify local listeners & tab browser lain
    this.notifyMessage({ ...fullMessage, isRead: true }, true, false);

    // 2. WebSocket (low latency)
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

    // 3. Server REST persistence
    try {
      fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullMessage),
      }).catch((e) => {
        console.warn('[ChatService] REST send backup failed:', e);
      });
    } catch {}

    // 4. Firebase Firestore
    try {
      FirebaseChatService.sendMessage(fullMessage).catch((e) => {
        console.warn('[ChatService] Firestore send backup error:', e);
      });
    } catch {}

    // 5. Google Sheets (Chat_Bantuan)
    GasClient.pushChatMessage({
      id: fullMessage.id,
      senderNis: fullMessage.senderNis || '',
      senderName: fullMessage.senderName,
      senderRole: fullMessage.senderRole,
      targetNis: fullMessage.targetNis || 'all',
      targetName: fullMessage.targetName || '',
      classGrade: fullMessage.classGrade || '',
      examTitle: fullMessage.examTitle || '',
      quickAction: fullMessage.quickAction,
      message: fullMessage.text,
      timestamp: new Date(fullMessage.timestamp).toISOString(),
      examId: fullMessage.examId || ''
    }).catch(() => {});

    return fullMessage;
  }

  public async markAsRead(messageIds: string[]) {
    if (!Array.isArray(messageIds) || messageIds.length === 0) return;

    let changed = false;
    messageIds.forEach((id) => {
      if (id && !this.readIds.has(id)) {
        this.readIds.add(id);
        changed = true;
      }
      const cached = this.messagesById.get(id);
      if (cached && !cached.isRead) {
        this.messagesById.set(id, { ...cached, isRead: true });
        changed = true;
      }
    });

    if (changed) {
      this.saveReadIds();
      this.notifyReadChange();
    }

    try {
      await fetch('/api/chat/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds }),
      });
    } catch (e) {
      console.warn('[ChatService] Failed to mark messages as read:', e);
    }
  }

  public async clearAllHistory(): Promise<void> {
    this.messagesById.clear();
    this.knownMessageIds.clear();
    try {
      await fetch('/api/chat/messages', { method: 'DELETE' });
    } catch {}
    await GasClient.clearChatMessages();
    this.clearListeners.forEach((fn) => {
      try { fn(); } catch {}
    });
    this.notifyReadChange();
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

  public subscribeReadChange(listener: ReadChangeListener) {
    this.readChangeListeners.add(listener);
    return () => {
      this.readChangeListeners.delete(listener);
    };
  }

  public subscribeClear(listener: ClearListener) {
    this.clearListeners.add(listener);
    return () => {
      this.clearListeners.delete(listener);
    };
  }

  private notifyReadChange() {
    this.readChangeListeners.forEach((fn) => {
      try { fn(); } catch {}
    });
  }

  private notifyMessage(
    msg: ChatMessage,
    broadcastToLocal: boolean = true,
    allowNotificationSound: boolean = false
  ) {
    const normalized = this.normalizeMessage(msg);
    if (!normalized) return;

    // Pastikan pesan untuk siswa di sisi client siswa tetap terfilter jika datang dari Firestore/BroadcastChannel
    if (this.currentUser?.role === 'student') {
      const guestNis = typeof window !== 'undefined' ? localStorage.getItem('guest_student_nis') || undefined : undefined;
      if (!this.matchesStudentFilter(normalized, this.currentUser.nis, guestNis)) {
        return;
      }
    }

    this.messagesById.set(normalized.id, normalized);

    if (this.knownMessageIds.has(normalized.id)) {
      return;
    }
    this.knownMessageIds.add(normalized.id);

    // Putar suara notifikasi jika pesan masuk baru berasal dari peran lawan dan belum dibaca
    const myRole = this.currentUser?.role;
    const isIncomingFromOtherRole =
      myRole === 'teacher'
        ? normalized.senderRole === 'student'
        : normalized.senderRole === 'teacher' || (normalized.senderRole === 'system' && normalized.id !== 'MSG-INIT-001');

    if (allowNotificationSound && isIncomingFromOtherRole && !this.isMessageRead(normalized)) {
      this.playNotificationSound();
    }

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

  private notifyPresence(data: { teachers: number; students: number; onlineStudents?: OnlineStudentInfo[] }) {
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
