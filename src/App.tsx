/**
 * ExamFlow Edu — Online Exam Platform with Google Sheets & Apps Script Backend
 * @license Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  SchoolProfile, 
  Exam, 
  Student, 
  Submission, 
  AppSettings, 
  AppLog 
} from './types';
import { StorageService } from './services/storage';
import { GasClient } from './services/gasClient';
import { Navbar } from './components/Navbar';
import { StudentPortal } from './components/StudentPortal';
import { TeacherDashboard } from './components/TeacherDashboard';
import { KisiKisiMatrix } from './components/KisiKisiMatrix';
import { LogsView } from './components/LogsView';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  // Global State from StorageService
  const [profile, setProfile] = useState<SchoolProfile>(() => StorageService.getProfile());
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.getSettings());
  const [exams, setExams] = useState<Exam[]>(() => StorageService.getExams());
  const [students, setStudents] = useState<Student[]>(() => StorageService.getStudents());
  const [submissions, setSubmissions] = useState<Submission[]>(() => StorageService.getSubmissions());
  const [logs, setLogs] = useState<AppLog[]>(() => StorageService.getLogs());

  // UI Navigation State
  const [currentTab, setCurrentTab] = useState<'student' | 'teacher' | 'kisi-kisi' | 'logs'>('student');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessBanner, setSyncSuccessBanner] = useState<string | null>(null);

  // Sync theme with DOM class
  useEffect(() => {
    const isDark = settings.theme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [settings.theme]);

  // Refresh local data state helper
  const refreshAllData = useCallback(() => {
    setProfile(StorageService.getProfile());
    setSettings(StorageService.getSettings());
    setExams(StorageService.getExams());
    setStudents(StorageService.getStudents());
    setSubmissions(StorageService.getSubmissions());
    setLogs(StorageService.getLogs());
  }, []);

  // Perform Server Sync (Bidirectional Push & Pull with Google Sheets)
  const handleManualSync = async () => {
    if (!settings.gasWebAppUrl) {
      setIsSettingsOpen(true);
      return;
    }

    setIsSyncing(true);
    setSyncSuccessBanner(null);

    // 1. Flush any pending offline submissions
    const { syncedCount } = await GasClient.flushPendingSubmissions();

    // 2. Pull latest data from sheets
    const pullResult = await GasClient.fetchAllFromSheets();

    setIsSyncing(false);
    refreshAllData();

    if (pullResult.success) {
      const bannerText = syncedCount > 0
        ? `Sinkronisasi berhasil! ${syncedCount} jawaban terkirim dan data Google Sheets terupdate.`
        : 'Sinkronisasi sukses! Data terhubung secara real-time dengan Google Sheets.';

      setSyncSuccessBanner(bannerText);

      // Play audio chime if enabled
      if (settings.enableAudioChime) {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}
      }

      setTimeout(() => setSyncSuccessBanner(null), 4000);
    } else {
      alert(`Sinkronisasi terkendala: ${pullResult.message}\nCek tab "Log Koneksi" untuk informasi lengkap.`);
    }
  };

  // Auto-sync timer in background
  useEffect(() => {
    if (!settings.gasWebAppUrl || settings.autoSyncIntervalMinutes <= 0) return;

    const intervalMs = settings.autoSyncIntervalMinutes * 60 * 1000;
    const interval = setInterval(() => {
      GasClient.flushPendingSubmissions().then(() => refreshAllData());
    }, intervalMs);

    return () => clearInterval(interval);
  }, [settings.gasWebAppUrl, settings.autoSyncIntervalMinutes, refreshAllData]);

  // Toggle Dark/Light Theme
  const handleToggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: nextTheme as 'light' | 'dark' };
    setSettings(updated);
    StorageService.saveSettings(updated);
  };

  // Reset to default seed
  const handleResetData = () => {
    localStorage.clear();
    refreshAllData();
    setSyncSuccessBanner('Data awal berhasil dipulihkan!');
    setTimeout(() => setSyncSuccessBanner(null), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Top Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        profile={profile}
        settings={settings}
        onToggleTheme={handleToggleTheme}
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
        syncSuccessBanner={syncSuccessBanner}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentTab === 'student' && (
          <StudentPortal
            profile={profile}
            exams={exams}
            students={students}
            onSubmissionComplete={(newSub) => {
              refreshAllData();
            }}
          />
        )}

        {currentTab === 'teacher' && (
          <TeacherDashboard
            profile={profile}
            exams={exams}
            students={students}
            submissions={submissions}
            onUpdateProfile={(p) => {
              setProfile(p);
              refreshAllData();
            }}
            onRefreshData={refreshAllData}
            onSelectTab={setCurrentTab}
          />
        )}

        {currentTab === 'kisi-kisi' && (
          <KisiKisiMatrix
            profile={profile}
            exams={exams}
          />
        )}

        {currentTab === 'logs' && (
          <LogsView
            logs={logs}
            onRefresh={refreshAllData}
          />
        )}
      </main>

      {/* Global Settings & API Configuration Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          refreshAllData();
        }}
        settings={settings}
        onUpdateSettings={(newSettings) => {
          setSettings(newSettings);
          refreshAllData();
        }}
        onResetData={handleResetData}
      />

      {/* Simple Clean Footer (Quiet & Functional) */}
      <footer className="no-print py-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong>{profile.name}</strong> · Ujian Berbasis Komputer & Google Sheets
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Kurikulum Merdeka</span>
            <span aria-hidden="true">·</span>
            <span>Versi 1.2</span>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setCurrentTab('logs')}
              className="hover:underline text-indigo-600 dark:text-indigo-400"
            >
              Status Log
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
