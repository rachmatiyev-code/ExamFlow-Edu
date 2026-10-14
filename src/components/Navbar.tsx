import React from 'react';
import { SchoolProfile, AppSettings } from '../types';
import { Sun, Moon, RefreshCw, CheckCircle2, AlertCircle, CloudOff } from 'lucide-react';

interface NavbarProps {
  currentTab: 'student' | 'teacher' | 'kisi-kisi' | 'logs';
  onSelectTab: (tab: 'student' | 'teacher' | 'kisi-kisi' | 'logs') => void;
  onOpenSettings: () => void;
  profile: SchoolProfile;
  settings: AppSettings;
  onToggleTheme: () => void;
  onManualSync: () => void;
  isSyncing: boolean;
  syncSuccessBanner: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenSettings,
  profile,
  settings,
  onToggleTheme,
  onManualSync,
  isSyncing,
  syncSuccessBanner
}) => {
  const isOnline = navigator.onLine;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark with School Logo */}
        <div className="flex items-center gap-3 shrink-0">
          {profile.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
              onError={(e) => {
                // Fallback to initial
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              {profile.name.charAt(0) || 'E'}
            </div>
          )}
          <button 
            onClick={() => onSelectTab('student')}
            className="text-left group cursor-pointer focus:outline-none"
          >
            <div className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              ExamFlow <span className="text-indigo-600 dark:text-indigo-400">Edu</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[190px] sm:max-w-[320px]">
              {profile.name} {profile.teacherName ? `· ${profile.teacherName}` : ''}
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Single-Line Typography) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => onSelectTab('student')}
            className={`whitespace-nowrap transition-colors pb-0.5 ${
              currentTab === 'student'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Jadwal Ujian Siswa
          </button>

          <button
            onClick={() => onSelectTab('teacher')}
            className={`whitespace-nowrap transition-colors pb-0.5 ${
              currentTab === 'teacher'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Portal Guru & Kelola
          </button>

          <button
            onClick={() => onSelectTab('kisi-kisi')}
            className={`whitespace-nowrap transition-colors pb-0.5 ${
              currentTab === 'kisi-kisi'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cetak Kisi-Kisi
          </button>

          <button
            onClick={() => onSelectTab('logs')}
            className={`whitespace-nowrap transition-colors pb-0.5 ${
              currentTab === 'logs'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Log Koneksi
          </button>
        </nav>

        {/* Zone 3: Actions & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Manual Google Sheets Sync Button */}
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
              isSyncing
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 animate-pulse'
                : settings.gasWebAppUrl
                ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
            title={settings.gasWebAppUrl ? 'Sinkronkan dengan Google Sheets' : 'Atur URL Google Apps Script di Pengaturan'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isSyncing ? 'Sinkronisasi...' : settings.gasWebAppUrl ? 'Sync Sheets' : 'Offline Mode'}
            </span>
          </button>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700"
            title="Pengaturan Aplikasi & API"
          >
            Pengaturan
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Ganti Mode Gelap / Terang"
            aria-label="Toggle theme"
          >
            {settings.theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>

      {/* Real-time Sync Success Banner if triggered */}
      {syncSuccessBanner && (
        <div className="bg-emerald-600 text-white text-xs font-medium py-1.5 px-4 text-center flex items-center justify-center gap-2 animate-fadeIn transition-all">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{syncSuccessBanner}</span>
        </div>
      )}
    </header>
  );
};
