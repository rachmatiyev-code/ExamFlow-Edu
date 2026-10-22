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
import { OfficialExamPrintView } from './components/OfficialExamPrintView';
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
  const [currentTab, setCurrentTab] = useState<'student' | 'teacher' | 'kisi-kisi' | 'naskah-soal' | 'logs'>('student');
  const [printTargetExamId, setPrintTargetExamId] = useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessBanner, setSyncSuccessBanner] = useState<string | null>(null);

  // Direct student link parameters (?mode=student&exam=...&token=...&gas=...)
  const [directExamId, setDirectExamId] = useState<string | null>(null);
  const [directToken, setDirectToken] = useState<string | null>(null);

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

  // Check URL query parameters on load for direct student link & auto-GAS connection
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      const gasParam = params.get('gas');
      const examParam = params.get('exam');
      const tokenParam = params.get('token');

      if (modeParam === 'student' || examParam) {
        setCurrentTab('student');
      } else if (modeParam === 'teacher') {
        setCurrentTab('teacher');
      }

      if (examParam) {
        setDirectExamId(examParam);
      }
      if (tokenParam) {
        setDirectToken(tokenParam);
      }

      // Automatically configure GAS Web App URL from shared link without manual student setup
      if (gasParam) {
        const current = StorageService.getSettings();
        if (current.gasWebAppUrl !== gasParam) {
          const updated = { ...current, gasWebAppUrl: gasParam };
          StorageService.saveSettings(updated);
          setSettings(updated);
          StorageService.addLog('SYNC', 'URL Google Apps Script berhasil dikonfigurasi otomatis dari Tautan Ujian Siswa.', undefined, 'info');
        }

        // Always sync exam questions and student roster in background when student opens link
        GasClient.fetchAllFromSheets().then((res) => {
          if (res.success) {
            refreshAllData();
            setSyncSuccessBanner('Terhubung ke database ujian! Soal & jadwal ujian berhasil disinkronkan.');
            setTimeout(() => setSyncSuccessBanner(null), 4000);
          }
        });
      } else {
        // Penting: Jika URL GAS sudah tersimpan di Pengaturan aplikasi, selalu otomatis muat data terbaru dari Google Sheets saat aplikasi dibuka
        const savedSettings = StorageService.getSettings();
        if (savedSettings.gasWebAppUrl && savedSettings.gasWebAppUrl.trim().startsWith('http')) {
          GasClient.fetchAllFromSheets().then((res) => {
            if (res.success) {
              refreshAllData();
              StorageService.addLog('SYNC', 'Data pengguna, ujian, dan soal berhasil dimuat otomatis dari Google Sheets saat aplikasi dibuka.', undefined, 'success');
            }
          }).catch((err) => {
            console.warn('Gagal sinkronisasi otomatis saat buka app:', err);
          });
        }
      }
    } catch (err) {
      console.warn('Gagal membaca parameter URL:', err);
    }
  }, [refreshAllData]);

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

    // 2. Push all exams & their questions to Google Sheets so spreadsheet is always in sync!
    const allExams = StorageService.getExams();
    for (const ex of allExams) {
      const exQs = StorageService.getQuestionsByExamId(ex.id);
      if (exQs.length > 0) {
        await GasClient.pushExam(ex, exQs);
      }
    }

    // 3. Push current local students to Google Sheets first so user data is saved
    const localStudents = StorageService.getStudents();
    if (localStudents.length > 0) {
      await GasClient.pushStudents(localStudents);
    }

    // 3b. Push current local custom users to Google Sheets
    const localUsers = StorageService.getUsers().filter(u => !StorageService.isDummyUser(u.id) && !StorageService.isDummyUser(u.username));
    if (localUsers.length > 0) {
      await GasClient.pushUsers(localUsers);
    }

    // 3c. Push current local curriculum (CP, Elemen & TP) to Google Sheets
    const localCurriculum = StorageService.getCurriculum();
    if (localCurriculum.length > 0) {
      await GasClient.pushCurriculum(localCurriculum);
    }

    // 4. Pull latest data from sheets
    const pullResult = await GasClient.fetchAllFromSheets();

    setIsSyncing(false);
    refreshAllData();

    if (pullResult.success) {
      const bannerText = syncedCount > 0
        ? `Sinkronisasi berhasil! ${syncedCount} jawaban terkirim dan data siswa/ujian terupdate.`
        : 'Sinkronisasi sukses! Data siswa dan ujian tersimpan di Google Sheets.';

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
      setSyncSuccessBanner(`Sinkronisasi terkendala: ${pullResult.message}`);
      setTimeout(() => setSyncSuccessBanner(null), 5000);
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
            initialExamId={directExamId}
            initialToken={directToken}
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
              StorageService.saveProfile(p);
              setProfile(p);
              refreshAllData();
            }}
            onRefreshData={refreshAllData}
            onSelectTab={(tab, examId) => {
              if (examId) setPrintTargetExamId(examId);
              setCurrentTab(tab);
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {currentTab === 'kisi-kisi' && (
          <KisiKisiMatrix
            profile={profile}
            exams={exams}
          />
        )}

        {currentTab === 'naskah-soal' && (
          <OfficialExamPrintView
            profile={profile}
            exams={exams}
            initialExamId={printTargetExamId}
            onBack={() => setCurrentTab('teacher')}
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
