import React, { useState, useEffect } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { chatService } from '../services/chatService';

interface FloatingChatButtonProps {
  currentTab: string;
  onOpenTeacherChat: () => void;
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  currentTab,
  onOpenTeacherChat,
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [lastIncomingMessage, setLastIncomingMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastTimeout, setToastTimeout] = useState<any>(null);

  useEffect(() => {
    const unsub = chatService.subscribeMessages((msg) => {
      // Notifikasi bila pesan berasal dari siswa (untuk guru/pengawas)
      if (msg.senderRole === 'student') {
        setUnreadCount((c) => c + 1);
        const preview = `${msg.senderName}: "${msg.text.length > 40 ? msg.text.slice(0, 40) + '...' : msg.text}"`;
        setLastIncomingMessage(preview);
        setShowToast(true);

        if (toastTimeout) clearTimeout(toastTimeout);
        const t = setTimeout(() => {
          setShowToast(false);
        }, 6000);
        setToastTimeout(t);
      }
    });

    return () => {
      unsub();
      if (toastTimeout) clearTimeout(toastTimeout);
    };
  }, [toastTimeout]);

  // Sembunyikan floating button jika pengguna sedang aktif di portal siswa (karena sudah ada StudentChatWidget)
  // atau saat berada di dalam tab 'chat' guru
  if (currentTab === 'student') {
    return null;
  }

  const handleClick = () => {
    setUnreadCount(0);
    setShowToast(false);
    onOpenTeacherChat();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 no-print font-sans">
      {/* Toast Notifikasi Pesan Masuk Melayang */}
      {showToast && lastIncomingMessage && (
        <div 
          onClick={handleClick}
          className="max-w-xs bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-emerald-500/40 text-xs animate-in slide-in-from-bottom-3 duration-200 cursor-pointer hover:bg-slate-800 transition-all"
        >
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pesan Masuk dari Siswa</span>
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
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping" />
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
