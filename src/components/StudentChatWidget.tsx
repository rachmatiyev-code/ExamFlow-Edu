import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Exam } from '../types';
import { chatService } from '../services/chatService';

interface StudentChatWidgetProps {
  currentExam?: Exam | null;
  studentNo?: string;
  studentName?: string;
  classGrade?: string;
  onApplyToken?: (token: string) => void;
  onRetakeGranted?: () => void;
}

export const StudentChatWidget: React.FC<StudentChatWidgetProps> = ({
  currentExam,
  studentNo: initialStudentNo = '',
  studentName: initialStudentName = '',
  classGrade: initialClassGrade = '',
  onApplyToken,
  onRetakeGranted,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState({ teachers: 0, students: 0 });

  // Guest / Identified user state
  const [nis, setNis] = useState(initialStudentNo);
  const [name, setName] = useState(initialStudentName);
  const [grade, setGrade] = useState(initialClassGrade);
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync props if parent changes them (e.g. user typed in login modal)
  useEffect(() => {
    if (initialStudentNo) setNis(initialStudentNo);
    if (initialStudentName) setName(initialStudentName);
    if (initialClassGrade) setGrade(initialClassGrade);
  }, [initialStudentNo, initialStudentName, initialClassGrade]);

  // Initialize ChatService
  useEffect(() => {
    const studentIdentifier = nis || localStorage.getItem('guest_student_nis') || `guest_${Math.floor(1000 + Math.random() * 9000)}`;
    if (!nis) {
      localStorage.setItem('guest_student_nis', studentIdentifier);
    }

    const studentDisplayName = name || localStorage.getItem('guest_student_name') || 'Siswa (Tamu)';

    chatService.initialize({
      role: 'student',
      name: studentDisplayName,
      nis: studentIdentifier,
      classGrade: grade || currentExam?.grade || '',
    });

    // Fetch message history
    chatService.getHistory({ nis: studentIdentifier }).then((history) => {
      setMessages(history);
    });

    const unsubscribeMsg = chatService.subscribeMessages((msg) => {
      // Check if message is for this student or is a broadcast or sent by this student
      const myNis = String(nis || localStorage.getItem('guest_student_nis') || '').trim().toLowerCase();
      const myName = String(name || localStorage.getItem('guest_student_name') || '').trim().toLowerCase();
      
      const targetNis = String(msg.targetNis || '').trim().toLowerCase();
      const senderNis = String(msg.senderNis || '').trim().toLowerCase();
      const targetName = String(msg.targetName || '').trim().toLowerCase();

      const isBroadcast = !targetNis || targetNis === 'all';
      const isTargetedToMe = Boolean(myNis && targetNis === myNis) || Boolean(myName && targetName === myName);
      const isSentByMe = Boolean(myNis && senderNis === myNis);

      const isForMe = isBroadcast || isTargetedToMe || isSentByMe;

      if (isForMe) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        if (!isOpen && msg.senderRole === 'teacher') {
          setUnreadCount((c) => c + 1);
        }

        // Trigger action callbacks if teacher sent quick actions
        if (msg.quickAction?.type === 'send_token' && msg.quickAction.token && onApplyToken) {
          onApplyToken(msg.quickAction.token);
        }
        if (msg.quickAction?.type === 'grant_retake' && onRetakeGranted) {
          onRetakeGranted();
        }
      }
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
  }, [nis, name, grade, currentExam]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      scrollToBottom();
      // Mark messages as read
      const unreadIds = messages.filter((m) => !m.isRead && m.senderRole === 'teacher').map((m) => m.id);
      if (unreadIds.length > 0) {
        chatService.markAsRead(unreadIds);
      }
    }
  }, [isOpen, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (customText?: string, quickActionType?: string) => {
    const textToSend = (customText !== undefined ? customText : inputText).trim();
    if (!textToSend) return;

    const currentNis = nis || localStorage.getItem('guest_student_nis') || 'Tamu';
    const currentName = name || 'Siswa';

    // Update ChatService current user
    chatService.updateUserInfo({
      role: 'student',
      name: currentName,
      nis: currentNis,
      classGrade: grade || currentExam?.grade || '',
    });

    const msg: Partial<ChatMessage> = {
      senderRole: 'student',
      senderName: currentName,
      senderNis: currentNis,
      classGrade: grade || currentExam?.grade || '',
      examId: currentExam?.id,
      examTitle: currentExam?.title,
      text: textToSend,
    };

    if (quickActionType) {
      msg.quickAction = {
        type: quickActionType as any,
      };
    }

    if (customText === undefined) {
      setInputText('');
    }

    await chatService.sendMessage(msg);
  };

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (name) localStorage.setItem('guest_student_name', name);
    if (nis) localStorage.setItem('guest_student_nis', nis);
    chatService.updateUserInfo({
      role: 'student',
      name: name || 'Siswa',
      nis: nis || 'Tamu',
      classGrade: grade,
    });
    setIsEditingIdentity(false);
  };

  const myIdentifier = nis || localStorage.getItem('guest_student_nis');

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans print:hidden">
      {/* Floating Action Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-full shadow-2xl hover:from-emerald-700 hover:to-teal-800 transition-all transform hover:scale-105 active:scale-95 border-2 border-emerald-400/40"
          title="Bantuan & Chat Pengawas Ujian"
        >
          <div className="relative">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span
              className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                isConnected ? (presence.teachers > 0 ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-red-400'
              }`}
            />
          </div>

          <div className="text-left">
            <div className="text-xs font-bold leading-tight">Bantuan Pengawas</div>
            <div className="text-[10px] text-emerald-100 flex items-center gap-1">
              <span>{presence.teachers > 0 ? `${presence.teachers} Guru Online` : 'Kirim Pesan'}</span>
            </div>
          </div>

          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-1 bg-red-600 text-white font-extrabold text-xs px-2 py-0.5 rounded-full shadow-lg border-2 border-white animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Window Modal */}
      {isOpen && (
        <div className="w-[360px] sm:w-[400px] h-[540px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 text-white p-3.5 flex items-center justify-between shadow">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <svg className="w-5 h-5 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  Bantuan & Pengawas
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? (presence.teachers > 0 ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-red-400'
                    }`}
                    title={presence.teachers > 0 ? 'Guru sedang aktif' : 'Belum ada guru yang membuka dashboard chat'}
                  />
                </h3>
                <p className="text-[11px] text-emerald-200 leading-tight">
                  {presence.teachers > 0 ? `${presence.teachers} Guru Siaga • Respon Cepat` : 'Pesan tersambung langsung ke Guru'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsEditingIdentity(!isEditingIdentity)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 hover:text-white transition-colors"
                title="Ubah Identitas / NIS"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 hover:text-white transition-colors"
                title="Tutup Chat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Student Identity Card / Edit Form */}
          {isEditingIdentity ? (
            <form onSubmit={handleSaveIdentity} className="bg-emerald-50 border-b border-emerald-200 p-3 text-xs space-y-2">
              <div className="font-bold text-emerald-900">Atur Identitas Siswa:</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-600 block mb-0.5">Nama Siswa</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama lengkap"
                    className="w-full px-2 py-1 text-xs border border-emerald-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 block mb-0.5">NIS / No Peserta</label>
                  <input
                    type="text"
                    value={nis}
                    onChange={(e) => setNis(e.target.value)}
                    placeholder="Contoh: 1042"
                    className="w-full px-2 py-1 text-xs border border-emerald-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingIdentity(false)}
                  className="px-2.5 py-1 text-[11px] bg-slate-200 hover:bg-slate-300 text-slate-700 rounded"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm"
                >
                  Simpan Identitas
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[11px] flex items-center justify-between text-slate-600">
              <span className="truncate">
                Anda: <strong className="text-slate-800">{name || 'Siswa Tamu'}</strong>{' '}
                {nis ? <span className="text-slate-500">(NIS: {nis})</span> : <span className="text-amber-600 font-semibold">(Belum Login)</span>}
              </span>
              <button
                onClick={() => setIsEditingIdentity(true)}
                className="text-[10px] text-emerald-700 hover:underline font-semibold flex-shrink-0"
              >
                Ubah
              </button>
            </div>
          )}

          {/* Quick Request Chips (Crucial for students who haven't logged in yet!) */}
          <div className="bg-slate-100/80 px-2.5 py-2 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSendMessage('Halo Bapak/Ibu Guru, saya minta Token Ujian untuk masuk sesi.', 'request_token')}
              className="text-[10px] whitespace-nowrap bg-white hover:bg-emerald-50 text-emerald-800 hover:text-emerald-900 border border-emerald-200 font-semibold px-2.5 py-1 rounded-full shadow-xs transition-colors flex items-center gap-1"
            >
              🔑 Minta Token
            </button>
            <button
              onClick={() => handleSendMessage('Bapak/Ibu Guru, saya minta izin mengulang ujian karena sebelumnya tertutup atau ada kendala.', 'request_retake')}
              className="text-[10px] whitespace-nowrap bg-white hover:bg-teal-50 text-teal-800 hover:text-teal-900 border border-teal-200 font-semibold px-2.5 py-1 rounded-full shadow-xs transition-colors flex items-center gap-1"
            >
              🔄 Izin Mengulang
            </button>
            <button
              onClick={() => handleSendMessage('Bapak/Ibu Guru, NIS atau nama saya tidak ditemukan saat login.', 'report_issue')}
              className="text-[10px] whitespace-nowrap bg-white hover:bg-amber-50 text-amber-800 hover:text-amber-900 border border-amber-200 font-semibold px-2.5 py-1 rounded-full shadow-xs transition-colors flex items-center gap-1"
            >
              ❓ NIS Tidak Ditemukan
            </button>
            <button
              onClick={() => handleSendMessage('Ujian saya terhenti / layar blank, mohon bantuannya Bapak/Ibu.', 'report_issue')}
              className="text-[10px] whitespace-nowrap bg-white hover:bg-rose-50 text-rose-800 hover:text-rose-900 border border-rose-200 font-semibold px-2.5 py-1 rounded-full shadow-xs transition-colors flex items-center gap-1"
            >
              ⚠️ Layar Macet
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-600">Belum ada percakapan</p>
                <p className="text-[11px] mt-1 max-w-[240px]">
                  Jika mengalami kendala login, butuh token, atau ingin minta izin mengulang, tanyakan langsung di sini!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderRole === 'student' && (!myIdentifier || msg.senderNis === myIdentifier);
                const isBroadcast = (msg.senderRole === 'teacher' || msg.senderType === 'system') && (!msg.targetNis || msg.targetNis === 'all');

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[10px] text-slate-400 px-1 mb-0.5 flex items-center gap-1">
                      <span className="font-semibold text-slate-600">{isMe ? 'Saya' : msg.senderName}</span>
                      {isBroadcast && (
                        <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded font-bold">
                          Pengumuman
                        </span>
                      )}
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-xs ${
                        isMe
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : isBroadcast
                          ? 'bg-amber-50 border border-amber-300 text-slate-900 rounded-bl-none'
                          : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                      {/* Special Action Payload from Teacher: Token */}
                      {msg.quickAction?.type === 'send_token' && msg.quickAction.token && (
                        <div className="mt-2 pt-2 border-t border-slate-200/40">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Token Ujian Diberikan:
                          </div>
                          <div className="flex items-center gap-2 bg-emerald-100/80 px-2.5 py-1.5 rounded-lg border border-emerald-300 text-emerald-950">
                            <span className="font-mono font-extrabold text-sm tracking-widest">
                              {msg.quickAction.token}
                            </span>
                            {onApplyToken && (
                              <button
                                onClick={() => {
                                  onApplyToken(msg.quickAction!.token!);
                                  setIsOpen(false);
                                }}
                                className="ml-auto text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded font-bold transition-colors"
                              >
                                Gunakan Token
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Special Action Payload from Teacher: Grant Retake */}
                      {msg.quickAction?.type === 'grant_retake' && (
                        <div className="mt-2 pt-2 border-t border-slate-200/40">
                          <div className="bg-teal-50 border border-teal-300 rounded-lg p-2 text-teal-900">
                            <div className="font-bold flex items-center gap-1 text-[11px]">
                              <span>✅ Izin Mengulang Diberikan</span>
                            </div>
                            <p className="text-[10px] mt-0.5 text-teal-700">
                              Anda sekarang sudah bisa menekan tombol Mulai Ujian kembali.
                            </p>
                            {onRetakeGranted && (
                              <button
                                onClick={() => {
                                  onRetakeGranted();
                                  setIsOpen(false);
                                }}
                                className="mt-1.5 w-full text-center text-[10px] bg-teal-600 hover:bg-teal-700 text-white font-bold py-1 rounded transition-colors"
                              >
                                Mulai Kerjakan Sekarang
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Tulis pesan ke Pengawas..."
              className="flex-1 bg-slate-100 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-full px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 disabled:hover:bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
            >
              <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
