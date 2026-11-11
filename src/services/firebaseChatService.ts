/**
 * Firebase Firestore Chat Service
 * Khusus untuk fitur Chat Bantuan real-time antara Guru dan Siswa
 * Menggunakan Google Cloud Console & Firebase Project: gen-lang-client-0499050899
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs,
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import { ChatMessage } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Inisialisasi Firebase App
let firestoreDb: Firestore | null = null;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  firestoreDb = getFirestore(app);
} catch (err) {
  console.warn('[FirebaseChat] Inisialisasi Firestore gagal:', err);
}

export class FirebaseChatService {
  private static COLLECTION_NAME = 'examflow_chat_messages';

  /**
   * Mengirim pesan chat bantuan ke Firebase Firestore (Google Cloud)
   */
  static async sendMessage(msg: ChatMessage): Promise<boolean> {
    if (!firestoreDb) return false;
    try {
      const colRef = collection(firestoreDb, this.COLLECTION_NAME);
      await addDoc(colRef, {
        id: msg.id,
        senderRole: msg.senderRole,
        senderType: msg.senderType || msg.senderRole,
        senderName: msg.senderName,
        senderNis: msg.senderNis || '',
        classGrade: msg.classGrade || '',
        examId: msg.examId || '',
        examTitle: msg.examTitle || '',
        targetNis: msg.targetNis || 'all',
        targetName: msg.targetName || '',
        text: msg.text,
        timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
        createdAt: serverTimestamp(),
        quickAction: msg.quickAction || null,
        isRead: Boolean(msg.isRead)
      });
      return true;
    } catch (err) {
      console.warn('[FirebaseChat] Gagal mengirim pesan ke Firestore:', err);
      return false;
    }
  }

  /**
   * Berlangganan (subscribe) pesan masuk secara real-time dari Firestore
   */
  static subscribeMessages(onNewMessage: (msg: ChatMessage) => void): () => void {
    if (!firestoreDb) return () => {};

    try {
      const colRef = collection(firestoreDb, this.COLLECTION_NAME);
      const q = query(colRef, orderBy('timestamp', 'asc'), limit(150));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const message: ChatMessage = {
              id: data.id || change.doc.id,
              senderRole: data.senderRole || 'student',
              senderType: data.senderType || data.senderRole || 'student',
              senderName: data.senderName || 'Siswa',
              senderNis: data.senderNis || '',
              classGrade: data.classGrade || '',
              examId: data.examId || '',
              examTitle: data.examTitle || '',
              targetNis: data.targetNis || 'all',
              targetName: data.targetName || '',
              text: data.text || '',
              timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
              quickAction: data.quickAction || undefined,
              isRead: Boolean(data.isRead)
            };
            onNewMessage(message);
          }
        });
      }, (error) => {
        console.warn('[FirebaseChat] Snapshot listener error (akan fallback ke WebSocket/GAS):', error);
      });

      return unsubscribe;
    } catch (err) {
      console.warn('[FirebaseChat] Subscribe error:', err);
      return () => {};
    }
  }

  /**
   * Mengambil riwayat pesan terkini dari Firebase Firestore
   */
  static async getRecentMessages(): Promise<ChatMessage[]> {
    if (!firestoreDb) return [];
    try {
      const colRef = collection(firestoreDb, this.COLLECTION_NAME);
      const q = query(colRef, orderBy('timestamp', 'asc'), limit(150));
      const snapshot = await getDocs(q);
      const msgs: ChatMessage[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        msgs.push({
          id: data.id || doc.id,
          senderRole: data.senderRole || 'student',
          senderType: data.senderType || data.senderRole || 'student',
          senderName: data.senderName || 'Siswa',
          senderNis: data.senderNis || '',
          classGrade: data.classGrade || '',
          examId: data.examId || '',
          examTitle: data.examTitle || '',
          targetNis: data.targetNis || 'all',
          targetName: data.targetName || '',
          text: data.text || '',
          timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
          quickAction: data.quickAction || undefined,
          isRead: Boolean(data.isRead)
        });
      });
      return msgs;
    } catch (e) {
      console.warn('[FirebaseChat] Failed to get recent messages from Firestore:', e);
      return [];
    }
  }

  /**
   * Cek apakah Firebase Firestore siap digunakan
   */
  static isAvailable(): boolean {
    return firestoreDb !== null;
  }
}
