import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Exam } from '../types';
import { chatService } from '../services/chatService';
import { StorageService } from '../services/storage';

import { OnlineStudentInfo } from '../services/chatService';
import { Student } from '../types';

interface TeacherChatPanelProps {
  exams: Exam[];
  students?: Student[];
  onExamUpdated?: () => void;
}

interface ConversationItem {
  id: string; // NIS or 'broadcast'
  nis: string;
  name: string;
  classGrade?: string;
  examTitle?: string;
  examId?: string;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
  isOnline?: boolean;
}

export const TeacherChatPanel: React.FC<TeacherChatPanelProps> = ({ exams, students = [], onExamUpdated }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('broadcast');
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [presence, setPresence] = useState<{ teachers: number; students: number; onlineStudents?: OnlineStudentInfo[] }>({ teachers: 0, students: 0, onlineStudents: [] });
  const [isConnected, setIsConnected] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize teacher chat session
  useEffect(() => {
    const profile = StorageService.getProfile();
    const teacherName = profile.teacherName || 'Pengawas Ujian (Guru)';

    chatService.initialize({
      role: 'teacher',
      name: teacherName,
    });

    chatService.getHistory({ role: 'teacher' }).then((history) => {
      setMessages(history);
    });

    const unsubscribeMsg = chatService.subscribeMessages((msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    const unsubscribePresence = chatService.subscribePresence((p) => {
      setPresence(p);
    });

    const unsubscribeStatus = chatService.subscribeStatus((connected) => {
      setIsConnected(connected);
    });

    return () => {
      unsubscribeMsg();
      unsubscribePresence();
      unsubscribeStatus();
    };
  }, []);

  // Update selected exam if exams prop changes
  useEffect(() => {
    if (exams.length > 0 && !selectedExamId) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams, selectedExamId]);

  // Derive conversation list from messages
  const conversations: ConversationItem[] = React.useMemo(() => {
    const map = new Map<string, ConversationItem>();

    // Always ensure Live Feed / Broadcast is the top conversation
    map.set('broadcast', {
      id: 'broadcast',
      nis: '',
      name: '📢 Semua Percakapan & Siaran (Live Feed)',
      classGrade: 'Semua Siswa',
      lastMessage: 'Menampilkan seluruh percakapan masuk dari siswa & siaran',
      lastTimestamp: 0,
      unreadCount: 0,
    });

    // 1. Tambahkan seluruh siswa aktif terhubung dari presence
    if (presence.onlineStudents && Array.isArray(presence.onlineStudents)) {
      presence.onlineStudents.forEach(os => {
        const key = (os.nis || os.name || '').trim();
        if (!key || key.toLowerCase() === 'all') return;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            id: key,
            nis: os.nis || '',
            name: os.name || 'Siswa',
            classGrade: os.classGrade,
            examId: os.examId,
            lastMessage: '🟢 Perangkat aktif online (Siap berkonsultasi)',
            lastTimestamp: Date.now(),
            unreadCount: 0,
            isOnline: true
          });
        } else {
          existing.isOnline = true;
          if (os.name && existing.name === 'Siswa') existing.name = os.name;
          if (os.classGrade && !existing.classGrade) existing.classGrade = os.classGrade;
        }
      });
    }

    // 2. Tambahkan daftar siswa dari Master Data Siswa agar pencarian nama/NIS tidak pernah kosong
    if (Array.isArray(students) && students.length > 0) {
      students.forEach(st => {
        const key = String(st.studentNo || '').trim();
        if (!key) return;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            id: key,
            nis: key,
            name: st.fullName || 'Siswa',
            classGrade: st.classGrade || '',
            lastMessage: 'Mulai percakapan dengan siswa...',
            lastTimestamp: 0,
            unreadCount: 0,
            isOnline: false
          });
        } else {
          if (st.fullName && existing.name === 'Siswa') existing.name = st.fullName;
          if (st.classGrade && !existing.classGrade) existing.classGrade = st.classGrade;
        }
      });
    }

    // 3. Masukkan riwayat pesan dan perbarui status percakapan
    messages.forEach((msg) => {
      const cleanTarget = String(msg.targetNis || '').trim().toLowerCase();
      const isTeacherBroadcast = (msg.senderRole === 'teacher' || msg.senderType === 'system') && (!cleanTarget || cleanTarget === 'all');
      const isStudentSender = msg.senderRole === 'student' || msg.senderType === 'student';

      // Update Live Feed item timestamp and preview
      const liveFeedItem = map.get('broadcast')!;
      if (Number(msg.timestamp) >= liveFeedItem.lastTimestamp) {
        liveFeedItem.lastMessage = `${msg.senderName}: ${msg.text}`;
        liveFeedItem.lastTimestamp = Number(msg.timestamp);
      }
      if (isStudentSender && !msg.isRead) {
        liveFeedItem.unreadCount += 1;
      }

      // Student thread key: NIS or Guest ID
      const studentNis = isStudentSender ? (msg.senderNis || 'Tamu') : (msg.targetNis || '');
      if (!studentNis || studentNis === 'all') return;

      const studentName = isStudentSender ? (msg.senderName || 'Siswa') : (msg.targetName || 'Siswa');
      const existing = map.get(studentNis);

      const isUnread = !msg.isRead && isStudentSender;

      if (!existing) {
        map.set(studentNis, {
          id: studentNis,
          nis: studentNis,
          name: studentName,
          classGrade: msg.classGrade,
          examTitle: msg.examTitle,
          examId: msg.examId,
          lastMessage: msg.text,
          lastTimestamp: Number(msg.timestamp) || Date.now(),
          unreadCount: isUnread ? 1 : 0,
          isOnline: false
        });
      } else {
        const msgTs = Number(msg.timestamp) || 0;
        if (msgTs >= existing.lastTimestamp) {
          existing.lastMessage = msg.text;
          existing.lastTimestamp = msgTs;
          if (msg.examTitle) existing.examTitle = msg.examTitle;
          if (msg.examId) existing.examId = msg.examId;
          if (msg.classGrade) existing.classGrade = msg.classGrade;
          if (isStudentSender) existing.name = msg.senderName;
        }
        if (isUnread) {
          existing.unreadCount += 1;
        }
      }
    });

    // Tandai status online untuk thread yang sesuai dari presence
    if (presence.onlineStudents && Array.isArray(presence.onlineStudents)) {
      presence.onlineStudents.forEach(os => {
        const key = (os.nis || os.name || '').trim().toLowerCase();
        for (const item of map.values()) {
          if (
            (item.nis && item.nis.toLowerCase() === key) ||
            (item.name && item.name.toLowerCase() === key)
          ) {
            item.isOnline = true;
          }
        }
      });
    }

    const items = Array.from(map.values());
    // Sort: Broadcast/Live Feed first, lalu yang online/ada pesan terbaru, lalu siswa master
    return [
      items[0],
      ...items.slice(1).sort((a, b) => {
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
        if (a.isOnline !== b.isOnline) return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0);
        return b.lastTimestamp - a.lastTimestamp;
      }),
    ];
  }, [messages, presence.onlineStudents, students]);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (c.id === 'broadcast') return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.nis.toLowerCase().includes(q) ||
      (c.examTitle && c.examTitle.toLowerCase().includes(q))
    );
  });

  const activeConversation = conversations.find((c) => c.id === selectedThreadId) || conversations[0];

  // Active thread messages
  const threadMessages = messages.filter((m) => {
    const cleanTarget = String(m.targetNis || '').trim().toLowerCase();
    const cleanSender = String(m.senderNis || '').trim().toLowerCase();
    const threadId = selectedThreadId.trim().toLowerCase();

    if (threadId === 'broadcast' || threadId === 'all') {
      // In Live Feed: show ALL messages (announcements + all student questions)
      return true;
    }
    return (
      ((m.senderRole === 'student' || m.senderType === 'student') && (cleanSender === threadId || cleanSender.toLowerCase() === threadId.toLowerCase())) ||
      ((m.senderRole === 'teacher' || m.senderType === 'teacher') && (cleanTarget === threadId || cleanTarget.toLowerCase() === threadId.toLowerCase())) ||
      cleanSender === threadId || cleanTarget === threadId
    );
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Mark active conversation unread student messages as read
    if (selectedThreadId !== 'broadcast') {
      const unreadIds = threadMessages
        .filter((m) => !m.isRead && m.senderRole === 'student')
        .map((m) => m.id);
      if (unreadIds.length > 0) {
        chatService.markAsRead(unreadIds);
      }
    }
  }, [selectedThreadId, threadMessages]);

  const handleSendMessage = async (customText?: string, quickAction?: ChatMessage['quickAction']) => {
    const textToSend = (customText !== undefined ? customText : inputText).trim();
    if (!textToSend) return;

    const profile = StorageService.getProfile();
    const teacherName = profile.teacherName || 'Pengawas Ujian';

    const isBroadcast = selectedThreadId === 'broadcast';

    const newMsg: Partial<ChatMessage> = {
      senderRole: 'teacher',
      senderType: 'teacher',
      senderName: teacherName,
      text: textToSend,
      targetNis: isBroadcast ? 'all' : activeConversation.nis,
      targetName: isBroadcast ? 'Semua Siswa' : activeConversation.name,
      quickAction: quickAction,
    };

    if (customText === undefined) {
      setInputText('');
    }

    await chatService.sendMessage(newMsg);
  };

  const handleSendToken = () => {
    const exam = exams.find((e) => e.id === selectedExamId) || exams[0];
    if (!exam) return;

    const token = exam.token || 'TOKEN1';
    const text = `Berikut Token Ujian untuk "${exam.title}": ${token}. Silakan masukkan pada formulir ujian dan mulai mengerjakan.`;

    handleSendMessage(text, {
      type: 'send_token',
      token: token,
      examId: exam.id,
      examTitle: exam.title,
    });
  };

  const handleGrantRetake = () => {
    if (selectedThreadId === 'broadcast' || !activeConversation.nis) return;

    const exam = exams.find((e) => e.id === selectedExamId) || exams[0];
    const examId = exam ? exam.id : (activeConversation.examId || 'all');
    const examTitle = exam ? exam.title : (activeConversation.examTitle || 'Ujian');

    // Grant retake in local storage
    StorageService.grantExamRetake(examId, activeConversation.nis, activeConversation.name);
    if (onExamUpdated) onExamUpdated();

    const text = `Izin mengulang ujian "${examTitle}" telah diaktifkan untuk Anda (${activeConversation.name}). Silakan tekan tombol Mulai Ujian kembali.`;

    handleSendMessage(text, {
      type: 'grant_retake',
      examId: examId,
      examTitle: examTitle,
    });
  };

  const handleClearHistory = async () => {
    try {
      await fetch('/api/chat/messages', { method: 'DELETE' });
      setMessages([]);
      setShowClearConfirm(false);
    } catch (e) {
      console.error('Failed to clear chat history:', e);
    }
  };

  const totalUnreadCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[700px] max-h-[85vh]">
      {/* Top Banner / Presence Bar */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-950">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h2 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Pusat Bantuan & Komunikasi Siswa
              {totalUnreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {totalUnreadCount} Pesan Baru
                </span>
              )}
            </h2>
            <p className="text-xs text-emerald-200 flex items-center gap-2 mt-0.5">
              <span>Siswa dapat menghubungi Anda bahkan sebelum login ujian</span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-300">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-emerald-300'}`} />
                <span>Google Cloud & Firebase Firestore Real-Time</span>
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/15 text-xs flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span><strong>{presence.students}</strong> Siswa Aktif Terhubung</span>
          </div>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white px-3 py-1.5 rounded-lg border border-red-400/30 transition-colors"
            title="Hapus riwayat pesan chat"
          >
            Bersihkan Riwayat
          </button>
        </div>
      </div>

      {/* Main Split Body: Left Conversation List, Right Chat Box */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Conversations */}
        <div className="w-80 sm:w-96 border-r border-slate-200 flex flex-col bg-slate-50/70">
          {/* Search Box */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cari nama atau NIS siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500"
              />
            </div>
          </div>

          {/* List of Conversations */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedThreadId;
              const isBroadcast = conv.id === 'broadcast';

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedThreadId(conv.id)}
                  className={`w-full text-left p-3.5 transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-emerald-50/90 border-l-4 border-emerald-600'
                      : 'hover:bg-slate-100/80 bg-white'
                  }`}
                >
                  <div className="relative">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                        isBroadcast
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : isSelected
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : conv.isOnline
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isBroadcast ? '📢' : conv.name.charAt(0).toUpperCase()}
                    </div>
                    {conv.isOnline && !isBroadcast && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse" title="Perangkat sedang online aktif" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                          {conv.name}
                        </span>
                        {conv.isOnline && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded-full flex-shrink-0">
                            Aktif
                          </span>
                        )}
                      </div>
                      {conv.lastTimestamp > 0 && (
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {new Date(conv.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {!isBroadcast && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate mb-1">
                        {conv.nis ? <span className="font-mono">NIS: {conv.nis}</span> : <span className="text-amber-600 font-semibold">Tamu (Belum Login)</span>}
                        {conv.classGrade && <span>• {conv.classGrade}</span>}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500 truncate flex-1 leading-snug">
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-red-500 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Chat Panel: Active Thread */}
        <div className="flex-1 flex flex-col bg-slate-50/40">
          {/* Thread Header with Quick Action Bar */}
          <div className="bg-white p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-800">
                  {activeConversation.name}
                </h3>
                {activeConversation.id !== 'broadcast' && activeConversation.nis && (
                  <span className="bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 rounded font-mono font-medium border border-slate-200">
                    NIS: {activeConversation.nis}
                  </span>
                )}
                {activeConversation.examTitle && (
                  <span className="bg-emerald-50 text-emerald-800 text-[11px] px-2 py-0.5 rounded font-medium border border-emerald-200">
                    {activeConversation.examTitle}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {activeConversation.id === 'broadcast'
                  ? 'Kirim pesan instan atau pengumuman serentak ke semua siswa'
                  : 'Percakapan langsung 1-on-1 dengan siswa'}
              </p>
            </div>

            {/* Quick Action Tools for Teacher */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Select Exam for Actions */}
              {exams.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[160px] truncate"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} (Token: {ex.token || 'TOKEN1'})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleSendToken}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                    title="Kirimkan kode token ujian yang dipilih ke siswa"
                  >
                    🔑 Kirim Token
                  </button>
                </div>
              )}

              {activeConversation.id !== 'broadcast' && (
                <button
                  onClick={handleGrantRetake}
                  className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                  title="Izinkan siswa ini untuk mengulang ujian yang tertutup/bermasalah"
                >
                  🔄 Izinkan Mengulang
                </button>
              )}
            </div>
          </div>

          {/* Quick Response Templates */}
          <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">
              Template:
            </span>
            <button
              onClick={() => handleSendMessage('Silakan muat ulang (refresh) halaman ujian di perangkat Anda.')}
              className="text-[11px] whitespace-nowrap bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 px-2.5 py-1 rounded-full transition-colors"
            >
              🔄 "Silakan Refresh Halaman"
            </button>
            <button
              onClick={() => handleSendMessage('Pastikan nomor NIS diisi dengan benar sesuai kartu peserta / presensi kelas.')}
              className="text-[11px] whitespace-nowrap bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 px-2.5 py-1 rounded-full transition-colors"
            >
              📝 "Cek NIS Anda"
            </button>
            <button
              onClick={() => handleSendMessage('Waktu pengerjaan masih tersisa, mohon periksa kembali jawaban sebelum selesai.')}
              className="text-[11px] whitespace-nowrap bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 px-2.5 py-1 rounded-full transition-colors"
            >
              ⏳ "Periksa Waktu"
            </button>
            <button
              onClick={() => handleSendMessage('Ujian sudah diaktifkan kembali. Silakan klik Mulai Ujian.')}
              className="text-[11px] whitespace-nowrap bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 px-2.5 py-1 rounded-full transition-colors"
            >
              ✅ "Ujian Sudah Diizinkan"
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {threadMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-600">Belum ada pesan pada percakapan ini</p>
                <p className="text-[11px] text-slate-400 max-w-sm mt-1">
                  Ketik pesan atau gunakan tombol "Kirim Token" dan "Izinkan Mengulang" untuk merespon kendala siswa.
                </p>
              </div>
            ) : (
              threadMessages.map((msg) => {
                const isTeacher = msg.senderRole === 'teacher';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isTeacher ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[10px] text-slate-400 px-1 mb-0.5 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">
                        {isTeacher ? 'Anda (Guru/Pengawas)' : msg.senderName}
                      </span>
                      {!isTeacher && msg.senderNis && (
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                          NIS: {msg.senderNis}
                        </span>
                      )}
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                        isTeacher
                          ? 'bg-emerald-700 text-white rounded-br-none'
                          : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                      {msg.quickAction?.type === 'send_token' && msg.quickAction.token && (
                        <div className="mt-2 pt-2 border-t border-emerald-600/60 text-[11px]">
                          <span className="bg-emerald-900/40 px-2 py-0.5 rounded font-mono font-bold tracking-wider">
                            TOKEN: {msg.quickAction.token}
                          </span>
                        </div>
                      )}

                      {msg.quickAction?.type === 'grant_retake' && (
                        <div className="mt-2 pt-2 border-t border-emerald-600/60 text-[11px] font-semibold text-emerald-100 flex items-center gap-1">
                          <span>✅ Status Ulang Diaktifkan</span>
                        </div>
                      )}

                      {!isTeacher && selectedThreadId === 'broadcast' && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400">
                            {msg.classGrade ? `Kelas: ${msg.classGrade}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = msg.senderNis || msg.senderName;
                              setSelectedThreadId(targetId);
                            }}
                            className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            💬 Balas Pribadi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                selectedThreadId === 'broadcast'
                  ? 'Ketik pengumuman yang akan dikirim ke SEMUA siswa...'
                  : `Balas ke ${activeConversation.name}...`
              }
              className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 disabled:hover:bg-emerald-600 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <span>Kirim</span>
              <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Confirmation Modal: Clear Chat */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h4 className="font-bold text-base text-slate-900">Bersihkan Riwayat Chat?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Semua pesan obrolan antara pengawas dan siswa akan dihapus dari server. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleClearHistory}
                className="px-3.5 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
              >
                Ya, Bersihkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
