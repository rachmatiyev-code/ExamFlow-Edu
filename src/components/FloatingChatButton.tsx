import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Sparkles, X } from 'lucide-react';
import { chatService } from '../services/chatService';
import { StorageService } from '../services/storage';
import { ChatMessage } from '../types';

interface FloatingChatButtonProps {
  currentTab: string;
  onOpenTeacherChat: () => void;
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  currentTab,
  onOpenTeacherChat,
}) => {
  const [unreadMessages, setUnreadMessages] = useState<ChatMessage[]>([]);
  const [lastIncomingMessage, setLastIncomingMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef<any>(null);
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;

  const triggerToast = (msg: ChatMessage) => {
    const preview = `${msg.senderName}${msg.senderNis ? ` (${msg.senderNis})` : ''}: "${
      msg.text.length > 55 ? msg.text.slice(0, 55) + '...' : msg.text
    }"`;
    setLastIncomingMessage(preview);
    setShowToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 7000);
  };

  useEffect(() => {
    if (currentTab === 'student') return;

    const profile = StorageService.getProfile();
    chatService.initialize({
      role: 'teacher',
      name: profile.teacherName || 'Pengawas Ujian (Guru)',
    });

    const syncUnreadFromHistory = async () => {
      const history = await chatService.getHistory({ role: 'teacher' });
      const unread = history.filter(
        (m) => m.senderRole === 'student' && !chatService.isMessageRead(m, 'teacher')
      );
      setUnreadMessages(unread);
      if (unread.length > 0) {
        const latest = unread[unread.length - 1];
        setLastIncomingMessage(
          `${latest.senderName}${latest.senderNis ? ` (${latest.senderNis})` : ''}: "${
            latest.text.length > 55 ? latest.text.slice(0, 55) + '...' : latest.text
          }"`
        );
        setShowToast(true);
      }
    };

    syncUnreadFromHistory();

    const unsubMsg = chatService.subscribeMessages((msg) => {
      if (currentTabRef.current === 'student') return;
      if (msg.senderRole === 'student' && !chatService.isMessageRead(msg, 'teacher')) {
        setUnreadMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        triggerToast(msg);
      }
    });

    const unsubRead = chatService.subscribeReadChange(() => {
      setUnreadMessages((prev) =>
        prev.filter((m) => !chatService.isMessageRead(m, 'teacher'))
      );
    });

    const unsubClear = chatService.subscribeClear(() => {
      setUnreadMessages([]);
      setShowToast(false);
      setLastIncomingMessage(null);
    });

    return () => {
      unsubMsg();
      unsubRead();
      unsubClear();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [currentTab]);

  // Sembunyikan floating button jika pengguna sedang aktif di portal siswa (karena sudah ada StudentChatWidget)
  if (currentTab === 'student') {
    return null;
  }

  const unreadCount = unreadMessages.length;

  const handleClick = () => {
    setShowToast(false);
    onOpenTeacherChat();
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2 no-print font-sans">
      {/* Toast Notifikasi Pesan Masuk Melayang */}
      {showToast && lastIncomingMessage && (
        <div
          onClick={handleClick}
          className="max-w-xs bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-emerald-500/40 text-xs animate-in slide-in-from-bottom-3 duration-200 cursor-pointer hover:bg-slate-800 transition-all"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pesan Masuk dari Siswa</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowToast(false);
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-200 line-clamp-2 leading-relaxed text-[11px]">
            {lastIncomingMessage}
          </p>
          <span className="text-[10px] text-emerald-300 font-semibold mt-1 inline-block">
            Klik untuk membuka Live Chat &rarr;
          </span>
        </div>
      )}

      {/* Tombol Floating Action Chat */}
      <button
        onClick={handleClick}
        className="relative group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 border-2 border-emerald-400/40 cursor-pointer"
        title="Buka Ruang Chat Bantuan & Pesan Siswa"
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5 text-white" />
          <span
            className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
              unreadCount > 0 ? 'bg-red-400 animate-ping' : 'bg-emerald-300 animate-pulse'
            }`}
          />
        </div>

        <div className="text-left hidden sm:block">
          <div className="text-xs font-bold leading-tight flex items-center gap-1">
            <span>Chat Bantuan</span>
          </div>
          <div className="text-[10px] text-emerald-100 font-medium leading-tight">
            {unreadCount > 0 ? `${unreadCount} pesan baru` : 'Ruang Pengawas'}
          </div>
        </div>

        {/* Badge Hitungan Pesan Masuk Belum Dibaca */}
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-1.5 bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded-full shadow-lg border-2 border-white animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
