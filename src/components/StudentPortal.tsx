import React, { useState, useEffect, useRef } from 'react';
import { Exam, Question, SchoolProfile, Student, Submission } from '../types';
import { StorageService } from '../services/storage';
import { GasClient } from '../services/gasClient';
import { MediaViewer } from './MediaViewer';
import confetti from 'canvas-confetti';
import { 
  Clock, 
  Calendar, 
  BookOpen, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Play, 
  Pause, 
  Volume2, 
  Maximize2, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  User, 
  Key, 
  GraduationCap,
  Sparkles,
  HelpCircle,
  RotateCcw,
  RefreshCw,
  Download,
  BarChart3,
  Search,
  X
} from 'lucide-react';

interface StudentPortalProps {
  profile: SchoolProfile;
  exams: Exam[];
  students: Student[];
  onSubmissionComplete: (sub: Submission) => void;
  initialExamId?: string | null;
  initialToken?: string | null;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  profile,
  exams,
  students,
  onSubmissionComplete,
  initialExamId,
  initialToken
}) => {
  // State
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Student Login State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [studentNo, setStudentNo] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [examToken, setExamToken] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isDownloadingQuestions, setIsDownloadingQuestions] = useState(false);

  // Exam Active State
  const [isExamActive, setIsExamActive] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | string[]>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Result State
  const [completedSubmission, setCompletedSubmission] = useState<Submission | null>(null);

  // Media Zoom Modal State
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  // Audio Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Student Score Lookup State
  const [isScoreLookupOpen, setIsScoreLookupOpen] = useState(false);
  const [scoreLookupNis, setScoreLookupNis] = useState('');
  const [studentLookupResults, setStudentLookupResults] = useState<Submission[] | null>(null);

  // Filter exams available today
  const todayStr = new Date().toISOString().split('T')[0];
  const activeExams = exams.filter(e => e.status !== 'archived');

  // Auto-select exam if directed via shared student link
  useEffect(() => {
    if (initialExamId && exams.length > 0 && !isExamActive) {
      const cleanTarget = String(initialExamId).trim().toLowerCase();
      const target = exams.find(e => String(e.id).trim().toLowerCase() === cleanTarget);
      if (target) {
        setSelectedExam(target);
        // Penting: Segera muat soal untuk ujian ini dari penyimpanan lokal
        const qs = StorageService.getQuestionsByExamId(target.id);
        setExamQuestions(qs);
        if (initialToken) {
          setExamToken(initialToken);
        } else if (target.token) {
          setExamToken(target.token);
        }
        setIsLoginModalOpen(true);
      }
    }
  }, [initialExamId, initialToken, exams, isExamActive]);

  // Handle student roster auto-fill
  useEffect(() => {
    if (studentNo.trim()) {
      const found = students.find(s => s.studentNo.toLowerCase() === studentNo.trim().toLowerCase());
      if (found) {
        setStudentName(found.fullName);
        setStudentClass(found.classGrade);
      }
    }
  }, [studentNo, students]);

  // Exam Countdown Timer
  useEffect(() => {
    if (!isExamActive || timeRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit('Waktu ujian telah habis.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamActive, timeRemainingSeconds]);

  // Anti-Cheat Tab-Switch Detection
  useEffect(() => {
    if (!isExamActive || !selectedExam?.isStrict) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(c => {
          const next = c + 1;
          StorageService.addLog('EXAM', `Peringatan: Siswa ${studentName} berpindah jendela/tab browser (${next} kali)`, undefined, 'warn');
          return next;
        });
        setTabSwitchWarning(true);
      }
    };

    const handleWindowBlur = () => {
      if (!tabSwitchWarning) {
        setTabSwitchCount(c => c + 1);
        setTabSwitchWarning(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isExamActive, selectedExam, studentName, tabSwitchWarning]);

  // Format time remaining
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStartExamClick = (exam: Exam) => {
    setSelectedExam(exam);
    const qs = StorageService.getQuestionsByExamId(exam.id);
    setExamQuestions(qs);
    setLoginError(null);
    setIsLoginModalOpen(true);
  };

  const startExamSession = (qs: Question[]) => {
    setExamQuestions(qs);
    setIsLoginModalOpen(false);
    setUserAnswers({});
    setFlaggedQuestions({});
    setTabSwitchCount(0);
    setTabSwitchWarning(false);
    setCurrentQuestionIndex(0);
    setTimeRemainingSeconds(selectedExam ? selectedExam.durationMinutes * 60 : 3600);
    setIsExamActive(true);
    setCompletedSubmission(null);

    StorageService.addLog('EXAM', `Siswa ${studentName} (${studentNo}) memulai ujian "${selectedExam?.title}" (${qs.length} butir soal)`);
  };

  const handleConfirmLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNo.trim()) {
      setLoginError('Nomor Induk Siswa (NIS) wajib diisi.');
      return;
    }
    if (!studentName.trim()) {
      setLoginError('Nama lengkap siswa wajib diisi.');
      return;
    }
    if (selectedExam?.token && selectedExam.token.trim() !== '') {
      if (examToken.trim().toUpperCase() !== selectedExam.token.trim().toUpperCase()) {
        setLoginError('Token ujian salah! Tanyakan token kepada pengawas ujian.');
        return;
      }
    }

    if (!selectedExam) return;

    // Pastikan butir soal ujian telah termuat sebelum memulai
    let qs = StorageService.getQuestionsByExamId(selectedExam.id);
    if (qs.length === 0) {
      const allQs = StorageService.getQuestions();
      qs = allQs.filter(q => String(q.examId).trim().toLowerCase() === String(selectedExam.id).trim().toLowerCase());
    }

    if (qs.length === 0) {
      setLoginError('Sedang mengunduh butir soal dari database server...');
      setIsDownloadingQuestions(true);
      GasClient.fetchAllFromSheets().then(() => {
        setIsDownloadingQuestions(false);
        const downloaded = StorageService.getQuestionsByExamId(selectedExam.id);
        if (downloaded.length > 0) {
          setExamQuestions(downloaded);
          setLoginError(null);
          startExamSession(downloaded);
        } else {
          setLoginError('Soal belum ditemukan untuk ujian ini di server Google Sheets. Pastikan guru telah menekan tombol "Sinkronkan Sekarang" pada menu guru.');
        }
      }).catch(() => {
        setIsDownloadingQuestions(false);
        setLoginError('Gagal mengunduh soal dari Google Sheets. Periksa koneksi internet Anda.');
      });
      return;
    }

    startExamSession(qs);
  };

  const handleSelectOption = (questionId: string, optionId: string, isCheckbox = false) => {
    if (isCheckbox) {
      const current = (userAnswers[questionId] as string[]) || [];
      if (current.includes(optionId)) {
        setUserAnswers(prev => ({
          ...prev,
          [questionId]: current.filter(id => id !== optionId)
        }));
      } else {
        setUserAnswers(prev => ({
          ...prev,
          [questionId]: [...current, optionId]
        }));
      }
    } else {
      setUserAnswers(prev => ({
        ...prev,
        [questionId]: optionId
      }));
    }
  };

  const handleEssayChange = (questionId: string, text: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: text
    }));
  };

  const toggleFlagQuestion = (questionId: string) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  // Submit Logic
  const handleSubmitExam = async (reason?: string) => {
    if (!selectedExam) return;
    setIsSubmitting(true);

    // Hitung Skor Otomatis
    let totalScore = 0;
    let maxScore = 0;

    examQuestions.forEach(q => {
      const points = q.points || 10;
      maxScore += points;
      const ans = userAnswers[q.id];

      if (q.type === 'multiple_choice') {
        if (ans === q.correctKey) {
          totalScore += points;
        }
      } else if (q.type === 'checkbox') {
        const correctKeys = Array.isArray(q.correctKey) ? q.correctKey : [q.correctKey];
        const studentKeys = Array.isArray(ans) ? ans : [];
        const isMatch = correctKeys.length === studentKeys.length && correctKeys.every(k => studentKeys.includes(k));
        if (isMatch) {
          totalScore += points;
        }
      } else if (q.type === 'essay') {
        // Essay defaults to 70% or teacher review
        if (ans && typeof ans === 'string' && ans.trim().length > 10) {
          totalScore += Math.round(points * 0.8);
        }
      }
    });

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = percentage >= selectedExam.passingScore;
    const timeSpent = (selectedExam.durationMinutes * 60) - timeRemainingSeconds;

    const submission: Submission = {
      id: `SUB-${Date.now()}`,
      examId: selectedExam.id,
      studentNo: studentNo.trim(),
      studentName: studentName.trim(),
      classGrade: studentClass.trim() || 'Umum',
      answers: userAnswers,
      score: totalScore,
      maxScore,
      percentage,
      passed,
      submittedAt: new Date().toISOString(),
      tabSwitchCount,
      timeSpentSeconds: timeSpent,
      syncStatus: 'pending',
      feedback: passed ? 'Selamat, Anda telah melampaui kriteria ketuntasan!' : 'Belum mencapai batas kelulusan. Pelajari kembali materi ini.'
    };

    // Send to Google Apps Script / Local storage
    await GasClient.submitAnswer(submission);
    onSubmissionComplete(submission);

    setIsExamActive(false);
    setIsSubmitting(false);
    setCompletedSubmission(submission);

    // Fire celebratory confetti if passed!
    if (passed) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    }
  };

  const handleAutoSubmit = (reason: string) => {
    StorageService.addLog('EXAM', `Auto-submit ujian: ${reason}`);
    handleSubmitExam(reason);
  };

  // -------------------------------------------------------------
  // VIEW 1: RESULTS VIEW (After Exam Submission)
  // -------------------------------------------------------------
  if (completedSubmission && selectedExam) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center animate-fadeIn">
          {/* School Header */}
          <div className="flex flex-col items-center justify-center gap-2 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            {profile.logoUrl && (
              <img
                src={profile.logoUrl}
                alt={profile.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover shadow-sm mb-1"
              />
            )}
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {profile.name}
            </h3>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Bukti Pengumpulan Ujian
            </h2>
          </div>

          {/* Celebration / Status Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-10 h-10" />
          </div>

          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Jawaban Berhasil Dikirim!
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
            Terima kasih <span className="font-semibold text-slate-900 dark:text-white">{completedSubmission.studentName}</span> ({completedSubmission.studentNo}). Jawaban Anda telah tersimpan dengan aman di database ujian.
          </p>

          {/* Score & Summary Card */}
          {selectedExam.allowReview ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 mb-6 text-left">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Nilai Perolehan</span>
                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  {completedSubmission.percentage}%
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Status Hasil</span>
                <span className={`text-sm font-bold inline-block mt-1 ${completedSubmission.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {completedSubmission.passed ? 'LULUS (Tuntas)' : 'REMEDIAL'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Lama Pengerjaan</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 font-mono mt-1 block">
                  {Math.floor(completedSubmission.timeSpentSeconds / 60)}m {completedSubmission.timeSpentSeconds % 60}s
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Sinkronisasi</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  ● Google Sheets OK
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 mb-6 text-sm text-slate-600 dark:text-slate-300">
              Pengumuman nilai akhir akan disampaikan oleh guru pengampu setelah proses koreksi menyeluruh selesai.
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                setCompletedSubmission(null);
                setSelectedExam(null);
              }}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm transition-colors"
            >
              Kembali ke Jadwal Ujian
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: ACTIVE EXAM ROOM (Google Forms Style Question Runner)
  // -------------------------------------------------------------
  if (isExamActive && selectedExam) {
    const currentQ = examQuestions[currentQuestionIndex];
    const isLast = currentQuestionIndex === examQuestions.length - 1;
    const isFirst = currentQuestionIndex === 0;
    const answeredCount = Object.keys(userAnswers).filter(k => {
      const val = userAnswers[k];
      return Array.isArray(val) ? val.length > 0 : Boolean(val);
    }).length;

    return (
      <div className="min-h-screen pb-16 bg-slate-100 dark:bg-slate-950 transition-colors">
        {/* Sticky Header with Timer and Progress */}
        <header className="sticky top-16 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 shadow-xs">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            {/* Student Info & Title */}
            <div className="truncate">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {selectedExam.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{studentName} ({studentNo})</span>
                <span aria-hidden="true">·</span>
                <span>{selectedExam.subject}</span>
              </div>
            </div>

            {/* Countdown Timer with Visual Tone */}
            <div className="flex items-center gap-3 shrink-0">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-bold text-sm tabular-nums shadow-xs transition-colors ${
                  timeRemainingSeconds <= 300
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800 animate-pulse'
                    : timeRemainingSeconds <= 600
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>{formatTimer(timeRemainingSeconds)}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Switch Warning Modal / Bar */}
        {tabSwitchWarning && (
          <div className="max-w-5xl mx-auto px-4 mt-4">
            <div className="bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold">Peringatan Integritas Ujian!</p>
                <p className="text-xs mt-0.5">
                  Anda terdeteksi berpindah tab atau keluar dari halaman ujian ({tabSwitchCount} kali). Tindakan ini tercatat di riwayat pengawas. Harap fokus pada lembar soal.
                </p>
              </div>
              <button
                onClick={() => setTabSwitchWarning(false)}
                className="text-xs px-2.5 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700 font-medium shrink-0"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        )}

        {/* Main Exam Runner Body */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Navigation Drawer (Desktop Sidebar / Mobile Accordion) */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs sticky top-36">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Daftar Nomor Soal
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {answeredCount}/{examQuestions.length} Terjawab
                </span>
              </div>

              {/* Grid of Question Numbers */}
              <div className="grid grid-cols-5 gap-2">
                {examQuestions.map((q, idx) => {
                  const isCurrent = idx === currentQuestionIndex;
                  const hasAnswer = userAnswers[q.id] !== undefined && userAnswers[q.id] !== '' && (Array.isArray(userAnswers[q.id]) ? (userAnswers[q.id] as string[]).length > 0 : true);
                  const isFlagged = flaggedQuestions[q.id];

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`h-9 rounded-lg text-xs font-bold transition-all relative flex items-center justify-center ${
                        isCurrent
                          ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 bg-indigo-600 text-white shadow-sm'
                          : isFlagged
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          : hasAnswer
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {idx + 1}
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0" />
                  <span>Sudah Dijawab</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0" />
                  <span>Ragu-Ragu</span>
                </div>
              </div>

              {/* Submit Final Button */}
              <button
                onClick={() => {
                  if (confirm('Apakah Anda yakin ingin menyelesaikan dan mengumpulkan seluruh jawaban ujian?')) {
                    handleSubmitExam();
                  }
                }}
                disabled={isSubmitting}
                className="mt-5 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kumpulkan Ujian</span>
              </button>
            </div>
          </div>

          {/* Active Question Box (Google Forms Style) */}
          <div className="lg:col-span-3 order-1 lg:order-2 space-y-4">
            {currentQ ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative">
                {/* Question Header & Order */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                      Soal No. {currentQuestionIndex + 1} dari {examQuestions.length}
                    </span>
                    <span className="text-xs text-slate-400">
                      Bobot: {currentQ.points || 10} Poin
                    </span>
                  </div>

                  {/* Flag / Ragu-Ragu Toggle */}
                  <button
                    onClick={() => toggleFlagQuestion(currentQ.id)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      flaggedQuestions[currentQ.id]
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{flaggedQuestions[currentQ.id] ? 'Ditandai Ragu' : 'Tandai Ragu'}</span>
                  </button>
                </div>

                {/* Multimedia Attachment Container (Audio, Image, Video) */}
                {currentQ.mediaType !== 'none' && currentQ.mediaUrl && (
                  <div className="mb-6 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4">
                    {/* Audio Player */}
                    {currentQ.mediaType === 'audio' && (
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Volume2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1 w-full">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Lampiran Audio Soal (Dengarkan baik-baik):
                          </div>
                          <audio
                            controls
                            src={currentQ.mediaUrl}
                            className="w-full h-8"
                          >
                            Peramban Anda tidak mendukung pemutar audio.
                          </audio>
                        </div>
                      </div>
                    )}

                    {/* Image with Zoom */}
                    {currentQ.mediaType === 'image' && (
                      <div className="space-y-2">
                        <div className="relative group max-h-96 overflow-hidden rounded-lg bg-slate-950 flex items-center justify-center">
                          <img
                            src={currentQ.mediaUrl}
                            alt="Lampiran Soal"
                            referrerPolicy="no-referrer"
                            className="max-h-96 w-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => setZoomImageUrl(currentQ.mediaUrl || null)}
                          />
                          <button
                            onClick={() => setZoomImageUrl(currentQ.mediaUrl || null)}
                            className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 hover:bg-black text-white text-xs rounded-lg flex items-center gap-1.5 backdrop-blur-xs transition-colors"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Perbesar Gambar</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 text-center">
                          Klik gambar atau tombol perbesar untuk memeriksa rincian diagram.
                        </p>
                      </div>
                    )}

                    {/* Video Embed */}
                    {currentQ.mediaType === 'video' && (
                      <div className="space-y-2">
                        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                          {currentQ.mediaUrl.includes('youtube.com') || currentQ.mediaUrl.includes('youtu.be') ? (
                            <iframe
                              src={currentQ.mediaUrl.replace('watch?v=', 'embed/')}
                              title="Video Soal"
                              className="w-full h-full border-0"
                              allowFullScreen
                            />
                          ) : (
                            <video
                              controls
                              src={currentQ.mediaUrl}
                              className="w-full h-full object-contain"
                            >
                              Peramban Anda tidak mendukung pemutar video.
                            </video>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Question Prompt */}
                <div className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 mb-6 leading-relaxed whitespace-pre-line">
                  {currentQ.prompt}
                </div>

                {/* Option Choices */}
                {currentQ.type === 'multiple_choice' && (
                  <div className="space-y-3">
                    {currentQ.options.map((opt, optIdx) => {
                      const isSelected = userAnswers[currentQ.id] === opt.id;
                      const optionLetters = ['A', 'B', 'C', 'D', 'E'];
                      const letter = optionLetters[optIdx] || String(optIdx + 1);

                      return (
                        <label
                          key={opt.id}
                          className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-500 shadow-xs'
                              : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q_${currentQ.id}`}
                            value={opt.id}
                            checked={isSelected}
                            onChange={() => handleSelectOption(currentQ.id, opt.id, false)}
                            className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <div className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                            <span className="font-bold text-slate-900 dark:text-white mr-2">
                              {letter}.
                            </span>
                            {opt.text}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === 'checkbox' && (
                  <div className="space-y-3">
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      * Pilih satu atau lebih jawaban yang menurut Anda benar.
                    </div>
                    {currentQ.options.map((opt, optIdx) => {
                      const selectedList = (userAnswers[currentQ.id] as string[]) || [];
                      const isSelected = selectedList.includes(opt.id);
                      const optionLetters = ['A', 'B', 'C', 'D', 'E'];
                      const letter = optionLetters[optIdx] || String(optIdx + 1);

                      return (
                        <label
                          key={opt.id}
                          className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-500 shadow-xs'
                              : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={opt.id}
                            checked={isSelected}
                            onChange={() => handleSelectOption(currentQ.id, opt.id, true)}
                            className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <div className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                            <span className="font-bold text-slate-900 dark:text-white mr-2">
                              {letter}.
                            </span>
                            {opt.text}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === 'essay' && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                      Tuliskan jawaban uraian Anda pada kotak di bawah ini:
                    </label>
                    <textarea
                      rows={6}
                      value={(userAnswers[currentQ.id] as string) || ''}
                      onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                      placeholder="Ketik jawaban lengkap di sini..."
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                    <div className="text-[11px] text-slate-400 text-right">
                      {((userAnswers[currentQ.id] as string) || '').length} karakter
                    </div>
                  </div>
                )}

                {/* Question Navigation Footer */}
                <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setCurrentQuestionIndex(i => Math.max(i - 1, 0))}
                    disabled={isFirst}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      isFirst
                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>

                  <div className="text-xs text-slate-400 font-medium">
                    Tersimpan otomatis di perangkat
                  </div>

                  {isLast ? (
                    <button
                      onClick={() => {
                        if (confirm('Anda berada di nomor terakhir. Kumpulkan jawaban sekarang?')) {
                          handleSubmitExam();
                        }
                      }}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      <span>Kirim Jawaban</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentQuestionIndex(i => Math.min(i + 1, examQuestions.length - 1))}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      <span>Selanjutnya</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 sm:p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Paket Soal Belum Terbaca di Perangkat
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                    Ujian <strong className="text-slate-700 dark:text-slate-300">"{selectedExam?.title}"</strong> memerlukan sinkronisasi soal dari database ujian Google Sheets.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isDownloadingQuestions}
                    onClick={async () => {
                      setIsDownloadingQuestions(true);
                      try {
                        await GasClient.fetchAllFromSheets();
                        if (selectedExam) {
                          const qs = StorageService.getQuestionsByExamId(selectedExam.id);
                          if (qs.length > 0) {
                            setExamQuestions(qs);
                            setCurrentQuestionIndex(0);
                          } else {
                            alert('Soal belum ditemukan di Google Sheets. Hubungi pengawas ujian untuk memastikan ujian sudah disinkronkan.');
                          }
                        }
                      } finally {
                        setIsDownloadingQuestions(false);
                      }
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isDownloadingQuestions ? 'animate-spin' : ''}`} />
                    <span>{isDownloadingQuestions ? 'Mengunduh Soal...' : 'Unduh Ulang Soal dari Google Sheets'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExamActive(false);
                      setSelectedExam(null);
                    }}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Kembali ke Jadwal Ujian
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Media Zoom Modal */}
        <MediaViewer
          isOpen={Boolean(zoomImageUrl)}
          imageUrl={zoomImageUrl || ''}
          title="Pratinjau Gambar Soal"
          onClose={() => setZoomImageUrl(null)}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: TODAY'S EXAM SCHEDULE LANDING (Default Student View)
  // -------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-fadeIn">
      {/* School Kop & Branding Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          {profile.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-white p-1 border-2 border-white/20 shadow-md shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-black">
              {profile.name.charAt(0)}
            </div>
          )}

          <div className="flex-1 space-y-1">
            <div className="text-xs uppercase font-bold tracking-widest text-indigo-200">
              Portal Ujian Berbasis Komputer & Google Sheets
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {profile.name}
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl">
              {profile.address} · NPSN: {profile.npsn} · Tahun Pelajaran: {profile.academicYear} ({profile.semester})
            </p>
          </div>
        </div>
      </div>

      {/* Today's Schedule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Jadwal Ujian Tersedia Hari Ini</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pilih mata pelajaran yang sedang diujikan sesuai instruksi pengawas ruangan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setIsScoreLookupOpen(true);
              setStudentLookupResults(null);
              setScoreLookupNis('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Cek Nilai Saya</span>
          </button>

          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono">
            Tanggal: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Exam Cards Grid */}
      {activeExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeExams.map(exam => {
            return (
              <div
                key={exam.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Subject & Grade unboxed metadata */}
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                      {exam.subject}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Kelas {exam.grade}</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 line-clamp-2">
                    {exam.title}
                  </h3>

                  {/* Info Metadata */}
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Durasi Pengerjaan:</span>
                      <span className="font-semibold font-mono">{exam.durationMinutes} Menit</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Jumlah Soal:</span>
                      <span className="font-semibold font-mono">{exam.totalQuestions} Butir</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Nilai Ketuntasan (KKM):</span>
                      <span className="font-semibold font-mono">{exam.passingScore}</span>
                    </div>
                    {profile.teacherName && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Pengampu:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[170px]">{profile.teacherName}</span>
                      </div>
                    )}
                    {exam.token ? (
                      <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium pt-1 border-t border-slate-200 dark:border-slate-700">
                        <Key className="w-3.5 h-3.5 shrink-0" />
                        <span>Memerlukan Token Ujian Pengawas</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium pt-1 border-t border-slate-200 dark:border-slate-700">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Masuk Langsung (Tanpa Token)</span>
                      </div>
                    )}
                    {exam.isStrict && (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium pt-1 border-t border-slate-200 dark:border-slate-700">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>Mode Ketat: Deteksi Pindah Tab Aktif</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => handleStartExamClick(exam)}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Mulai Kerjakan Ujian</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40 text-indigo-500" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Belum Ada Ujian Terjadwal Hari Ini
          </h3>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            Silakan hubungi guru mata pelajaran atau buka tab Portal Guru untuk membuat dan mengaktifkan ujian baru.
          </p>
        </div>
      )}

      {/* STUDENT LOGIN / VERIFICATION MODAL */}
      {isLoginModalOpen && selectedExam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
            {/* School Logo & Title */}
            <div className="text-center pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              {profile.logoUrl && (
                <img
                  src={profile.logoUrl}
                  alt={profile.name}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-xl object-cover mx-auto mb-2 shadow-sm"
                />
              )}
              <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {profile.name}
              </h4>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                Verifikasi Peserta Ujian
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {selectedExam.title} ({selectedExam.subject})
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                {loginError}
              </div>
            )}

            <form onSubmit={handleConfirmLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Induk Siswa (NIS / NISN)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 1001"
                    value={studentNo}
                    onChange={(e) => setStudentNo(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Ketik 1001 atau 1002 untuk contoh siswa terdaftar.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama lengkap Anda"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kelas / Rombel
                </label>
                <input
                  type="text"
                  placeholder="Contoh: X MIPA 1"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {selectedExam.token && selectedExam.token.trim() !== '' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Token Ujian
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder={`Token pengawas: ${selectedExam.token}`}
                      value={examToken}
                      onChange={(e) => setExamToken(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  Mulai Ujian Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: STUDENT SELF SCORE LOOKUP (Cek Nilai Siswa)
         --------------------------------------------------------- */}
      {isScoreLookupOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Cek Hasil Nilai Ujian Siswa
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Masukkan Nomor Induk Siswa (NIS) untuk melihat riwayat nilai
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScoreLookupOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const query = scoreLookupNis.trim().toLowerCase();
                if (!query) return;
                const allSubs = StorageService.getSubmissions();
                const matched = allSubs.filter(s => {
                  return String(s.studentNo || '').trim().toLowerCase() === query ||
                         String(s.studentName || '').toLowerCase().includes(query);
                });
                setStudentLookupResults(matched);
              }}
              className="space-y-4 mb-5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Induk Siswa (NIS) / Nama
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={scoreLookupNis}
                    onChange={(e) => setScoreLookupNis(e.target.value)}
                    placeholder="Contoh: 1001 atau Ahmad"
                    className="flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Cari Nilai</span>
                  </button>
                </div>
              </div>
            </form>

            {studentLookupResults !== null && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span>Hasil Pencarian ({studentLookupResults.length} Ujian Ditemukan)</span>
                </div>

                {studentLookupResults.length > 0 ? (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {studentLookupResults.map(sub => {
                      const examObj = exams.find(e => String(e.id).trim().toLowerCase() === String(sub.examId || '').trim().toLowerCase());
                      return (
                        <div key={sub.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white text-sm block">
                                {examObj?.title || examObj?.subject || sub.examId}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                {sub.studentName} ({sub.studentNo}) · {sub.classGrade}
                              </span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                              sub.passed
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            }`}>
                              {sub.percentage}% ({sub.passed ? 'Lulus' : 'Remedial'})
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            <span>Durasi: {Math.floor((Number(sub.timeSpentSeconds) || 0) / 60)}m {(Number(sub.timeSpentSeconds) || 0) % 60}s</span>
                            <span>·</span>
                            <span>Pindah Tab: {sub.tabSwitchCount || 0}x</span>
                            <span>·</span>
                            <span>Kirim: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('id-ID') : '-'}</span>
                          </div>

                          {sub.feedback && (
                            <div className="p-2 rounded bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-[11px] mt-1">
                              <strong>Catatan Guru:</strong> {sub.feedback}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    Tidak ditemukan rekaman ujian untuk NIS/Nama "{scoreLookupNis}". Pastikan NIS yang Anda masukkan sudah benar atau ujian sudah berhasil dikirim.
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsScoreLookupOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
