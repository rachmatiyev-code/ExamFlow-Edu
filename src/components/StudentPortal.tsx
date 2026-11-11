import React, { useState, useEffect, useRef } from 'react';
import { Exam, Question, SchoolProfile, Student, Submission, normalizeQuestionOptions } from '../types';
import { StorageService } from '../services/storage';
import { AnalysisService } from '../services/analysisService';
import { GasClient } from '../services/gasClient';
import { MediaViewer } from './MediaViewer';
import { QuestionMedia, QuestionPromptRenderer } from './QuestionMedia';
import { StudentChatWidget } from './StudentChatWidget';
import { MathRenderer } from '../services/mathRenderer';
import confetti from 'canvas-confetti';
import { sanitizeLogoUrl, PEMKOT_MALANG_LOGO_SVG, SDN_PISANGCANDI_1_LOGO_SVG } from '../services/logoAssets';
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
  StopCircle,
  X,
  Wifi,
  WifiOff,
  CheckCircle2,
  Save,
  ChevronDown,
  ChevronUp,
  FileText,
  Check,
  Award,
  Lock,
  Unlock,
  Edit3,
  Info
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
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [restoredProgressNotice, setRestoredProgressNotice] = useState<string | null>(null);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<number>(Date.now());

  // Listen to network connection status (online / offline)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Result State
  const [completedSubmission, setCompletedSubmission] = useState<Submission | null>(null);
  const [showDetailedReview, setShowDetailedReview] = useState<boolean>(true);

  // Per-Question Instant Explanation (pembahasan soal muncul saat siswa sudah menekan tombol selanjutnya)
  const [showCurrentExplanation, setShowCurrentExplanation] = useState<boolean>(false);
  const [unlockedExplanationIds, setUnlockedExplanationIds] = useState<string[]>([]);
  
  // Revision Control: Dapat mengubah jawaban setelah semua soal dijawab, maksimal 5 soal
  const [initialLockedAnswers, setInitialLockedAnswers] = useState<Record<string, string | string[]> | null>(null);
  const [revisionAlertMessage, setRevisionAlertMessage] = useState<string | null>(null);
  const MAX_REVISION_QUESTIONS = 5;

  // Helper untuk mengecek apakah suatu butir soal telah dijawab
  const isQuestionAnswered = (qId: string, answers: Record<string, string | string[]>) => {
    const a = answers[qId];
    if (a === undefined || a === null) return false;
    if (typeof a === 'string') {
      const trimmed = a.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          const values = Object.values(parsed).filter(v => typeof v === 'string' && (v as string).trim() !== '');
          return values.length > 0;
        } catch {
          return true;
        }
      }
      return trimmed.length > 0;
    }
    if (Array.isArray(a)) return a.length > 0;
    return false;
  };

  // Helper pembanding jawaban
  const areAnswersEqual = (a: string | string[] | undefined, b: string | string[] | undefined): boolean => {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((val, idx) => val === sortedB[idx]);
    }
    if (typeof a === 'string' && typeof b === 'string') {
      const trimA = a.trim();
      const trimB = b.trim();
      if (trimA.startsWith('{') && trimB.startsWith('{')) {
        try {
          const objA = JSON.parse(trimA);
          const objB = JSON.parse(trimB);
          const keysA = Object.keys(objA).sort();
          const keysB = Object.keys(objB).sort();
          if (keysA.length !== keysB.length) return false;
          return keysA.every((k, idx) => k === keysB[idx] && objA[k] === objB[k]);
        } catch {
          // fallback to string equality
        }
      }
      return trimA === trimB;
    }
    return String(a).trim() === String(b).trim();
  };

  // Status kelengkapan pengerjaan seluruh butir soal
  const answeredQuestionsCount = examQuestions.filter(q => isQuestionAnswered(q.id, userAnswers)).length;
  const isAllQuestionsAnswered = examQuestions.length > 0 && answeredQuestionsCount === examQuestions.length;

  // Kunci snapshot jawaban awal saat seluruh soal pertama kali selesai dijawab (untuk batas maksimal 5 perubahan jawaban)
  useEffect(() => {
    if (isExamActive && examQuestions.length > 0 && isAllQuestionsAnswered && !initialLockedAnswers) {
      setInitialLockedAnswers({ ...userAnswers });
    }
  }, [isExamActive, examQuestions.length, isAllQuestionsAnswered, initialLockedAnswers, userAnswers]);

  // Daftar nomor soal yang telah direvisi/diubah dari snapshot awal
  const changedQuestionIds = React.useMemo(() => {
    if (!initialLockedAnswers) return [];
    const changed: string[] = [];
    examQuestions.forEach(q => {
      const qId = q.id;
      if (initialLockedAnswers[qId] !== undefined) {
        if (!areAnswersEqual(userAnswers[qId], initialLockedAnswers[qId])) {
          changed.push(qId);
        }
      }
    });
    return changed;
  }, [examQuestions, initialLockedAnswers, userAnswers]);

  // Validasi apakah siswa diperbolehkan memilih atau mengubah jawaban pada butir soal ini
  const canModifyQuestion = (questionId: string): { allowed: boolean; reason?: string } => {
    const isUnlocked = unlockedExplanationIds.includes(questionId);

    // Jika pembahasan butir soal ini belum pernah dibuka (belum pernah menekan Selanjutnya):
    // Siswa masih bebas memilih jawaban saat pertama kali mengerjakan butir ini
    if (!isUnlocked) {
      return { allowed: true };
    }

    // Jika pembahasan sudah dibuka:
    // Aturan 1: Siswa baru dapat mengubah jawaban setelah SEMUA soal dijawab
    if (!isAllQuestionsAnswered) {
      return {
        allowed: false,
        reason: `Jawaban pada soal ini terkunci sementara karena pembahasan telah dibuka.\n\nSesuai aturan ujian, Anda baru dapat mengubah jawaban setelah SELURUH soal (${answeredQuestionsCount}/${examQuestions.length}) selesai Anda jawab.`
      };
    }

    // Aturan 2: Setelah semua soal dijawab, siswa hanya dapat mengubah jawaban dari maksimal 5 soal
    if (initialLockedAnswers) {
      const isAlreadyChanged = changedQuestionIds.includes(questionId);
      if (!isAlreadyChanged && changedQuestionIds.length >= MAX_REVISION_QUESTIONS) {
        return {
          allowed: false,
          reason: `Batas Maksimal Revisi Tercapai!\n\nAnda hanya dapat mengubah jawaban dari maksimal ${MAX_REVISION_QUESTIONS} butir soal.\nKuota 5 soal Anda telah terpakai untuk soal lain.\n\nUntuk merevisi soal ini, Anda dapat mengembalikan salah satu jawaban soal yang telah diubah ke pilihan semula.`
        };
      }
    }

    return { allowed: true };
  };

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
    if (initialExamId && !isExamActive) {
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

        // Jika soal di lokal masih belum lengkap dibanding target ujian (misal hanya 15 dari 25 soal), unduh sisanya dari Sheets!
        if (target.totalQuestions && qs.length < target.totalQuestions) {
          setIsDownloadingQuestions(true);
          GasClient.fetchAllFromSheets().then(() => {
            setIsDownloadingQuestions(false);
            const updated = StorageService.getQuestionsByExamId(target.id);
            if (updated.length > 0) setExamQuestions(updated);
          }).catch(() => {
            setIsDownloadingQuestions(false);
          });
        }
      } else {
        // Ujian belum ada di memori lokal, unduh langsung dari Sheets
        setIsDownloadingQuestions(true);
        GasClient.fetchAllFromSheets().then(() => {
          setIsDownloadingQuestions(false);
          const freshExams = StorageService.getExams();
          const found = freshExams.find(e => String(e.id).trim().toLowerCase() === cleanTarget);
          if (found) {
            setSelectedExam(found);
            const qs = StorageService.getQuestionsByExamId(found.id);
            setExamQuestions(qs);
            if (initialToken) {
              setExamToken(initialToken);
            } else if (found.token) {
              setExamToken(found.token);
            }
            setIsLoginModalOpen(true);
          }
        }).catch(() => {
          setIsDownloadingQuestions(false);
        });
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
      // Cek apakah guru menghentikan sesi ujian secara langsung
      if (selectedExam) {
        const latestExam = StorageService.getExamById(selectedExam.id);
        if (latestExam && (latestExam.status === 'stopped' || latestExam.sessionStatus === 'stopped')) {
          clearInterval(timer);
          setIsExamActive(false);
          alert('Pemberitahuan Pengawas: Sesi ujian ini telah DIHENTIKAN PERMANEN oleh guru pengawas. Pengerjaan telah ditutup.');
          return;
        }
      }

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
  }, [isExamActive, timeRemainingSeconds, selectedExam]);

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

  const getExamProgressKey = (examId: string, sNo: string, sName: string) => {
    const cleanId = (sNo || sName || 'student').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `examflow_progress_${examId}_${cleanId}`;
  };

  const startExamSession = (qs: Question[]) => {
    setExamQuestions(qs);
    setIsLoginModalOpen(false);
    setTabSwitchCount(0);
    setTabSwitchWarning(false);
    setCompletedSubmission(null);

    // Cek apakah ada progress jawaban siswa yang tersimpan di perangkat lokal
    const progressKey = selectedExam ? getExamProgressKey(selectedExam.id, studentNo, studentName) : '';
    let restoredAnswers: Record<string, string | string[]> = {};
    let restoredFlagged: Record<string, boolean> = {};
    let restoredIndex = 0;
    let restoredUnlockedExps: string[] = [];
    let restoredInitialSnapshot: Record<string, string | string[]> | null = null;
    let hasRestored = false;

    if (progressKey) {
      try {
        const raw = localStorage.getItem(progressKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.answers === 'object' && Object.keys(parsed.answers).length > 0) {
            restoredAnswers = parsed.answers;
            hasRestored = true;
          }
          if (parsed && typeof parsed.flagged === 'object') {
            restoredFlagged = parsed.flagged;
          }
          if (typeof parsed.currentIndex === 'number' && parsed.currentIndex >= 0 && parsed.currentIndex < qs.length) {
            restoredIndex = parsed.currentIndex;
          }
          if (typeof parsed.timeRemaining === 'number' && parsed.timeRemaining > 0) {
            setTimeRemainingSeconds(parsed.timeRemaining);
          }
          if (Array.isArray(parsed.unlockedExplanationIds)) {
            restoredUnlockedExps = parsed.unlockedExplanationIds;
          }
          if (parsed.initialLockedAnswers && typeof parsed.initialLockedAnswers === 'object') {
            restoredInitialSnapshot = parsed.initialLockedAnswers;
          }
        }
      } catch (err) {
        console.warn('Gagal membaca progress tersimpan:', err);
      }
    }

    setUserAnswers(restoredAnswers);
    setFlaggedQuestions(restoredFlagged);
    setCurrentQuestionIndex(restoredIndex);
    setUnlockedExplanationIds(restoredUnlockedExps);
    setInitialLockedAnswers(restoredInitialSnapshot);
    setShowCurrentExplanation(false);

    if (!hasRestored) {
      setTimeRemainingSeconds(selectedExam ? selectedExam.durationMinutes * 60 : 3600);
    }
    setIsExamActive(true);

    if (hasRestored) {
      const count = Object.keys(restoredAnswers).length;
      setRestoredProgressNotice(`Jawaban Anda (${count} butir soal) berhasil dipulihkan dari perangkat ini. Jawaban tersimpan otomatis, Anda dapat langsung melanjutkan pengerjaan!`);
      setTimeout(() => setRestoredProgressNotice(null), 8000);
    }

    StorageService.addLog('EXAM', `Siswa ${studentName} (${studentNo}) memulai ujian "${selectedExam?.title}" (${qs.length} butir soal, ${hasRestored ? 'melanjutkan sesi tersimpan' : 'sesi baru'})`);
  };

  // Auto-save jawaban siswa ke penyimpanan lokal perangkat (Offline-Resilient Device Persistence)
  useEffect(() => {
    if (isExamActive && selectedExam) {
      const progressKey = getExamProgressKey(selectedExam.id, studentNo, studentName);
      try {
        localStorage.setItem(progressKey, JSON.stringify({
          examId: selectedExam.id,
          studentNo: studentNo.trim(),
          studentName: studentName.trim(),
          classGrade: studentClass.trim(),
          answers: userAnswers,
          flagged: flaggedQuestions,
          currentIndex: currentQuestionIndex,
          timeRemaining: timeRemainingSeconds,
          unlockedExplanationIds,
          initialLockedAnswers,
          updatedAt: Date.now()
        }));
        setLastAutoSavedTime(Date.now());
      } catch (e) {
        console.warn('Gagal menyimpan draft jawaban ke perangkat:', e);
      }
    }
  }, [isExamActive, selectedExam, userAnswers, flaggedQuestions, currentQuestionIndex, timeRemainingSeconds, studentNo, studentName, studentClass, unlockedExplanationIds, initialLockedAnswers]);

  const handleConfirmLogin = async (e: React.FormEvent) => {
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

    const freshExam = StorageService.getExamById(selectedExam.id) || selectedExam;

    // 1. Verifikasi Status Sesi Ujian (Hentikan Ujian)
    if (freshExam.sessionStatus === 'stopped' || freshExam.status === 'stopped') {
      setLoginError('Sesi ujian ini telah DIHENTIKAN PERMANEN oleh guru pengawas. Akses pengerjaan telah ditutup hingga sesi dibuka kembali oleh guru dengan tombol "Lanjutkan".');
      return;
    }

    // 1b. Cek apakah ujian dijadwalkan di masa depan (startsAt)
    // Jika guru sedang mengaktifkan sesi secara langsung (sessionStatus === 'active'),
    // guru telah secara sadar membuka sesi ujian sekarang, jadi abaikan jadwal startsAt masa depan jika ada.
    if (freshExam.sessionStatus !== 'active' && freshExam.startsAt) {
      const startTime = new Date(freshExam.startsAt.replace(' ', 'T')).getTime();
      const now = Date.now();
      if (!isNaN(startTime) && now < startTime) {
        const formattedStart = new Date(freshExam.startsAt.replace(' ', 'T')).toLocaleString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        setLoginError(`Ujian ini TERJADWAL dan belum dibuka. Sesi ujian akan dimulai pada: ${formattedStart}. Silakan tunggu instruksi pengawas.`);
        return;
      }
    }

    // 1c. Cek waktu berakhir dan status selesai
    const isSessionActive = freshExam.sessionStatus === 'active';
    const isLateAllowed = Boolean(freshExam.allowLateSubmission) || (Number(freshExam.lateExtensionMinutes) || 0) > 0;

    // Jika guru secara manual menutup sesi ujian (sessionStatus === 'ended')
    if (freshExam.sessionStatus === 'ended') {
      setLoginError('Sesi ujian ini telah ditutup oleh pengawas ruangan.');
      return;
    }

    // KUNCI: Jika sesi sedang AKTIF (guru telah menekan 'Mulai Sesi Ujian' atau 'Lanjutkan'),
    // atau toleransi keterlambatan aktif, siswa langsung diizinkan mengerjakan!
    // Pengecekan batas waktu endsAt HANYA memblokir jika sesi TIDAK sedang aktif secara eksplisit.
    if (!isSessionActive && !isLateAllowed) {
      if (freshExam.endsAt) {
        const endTime = new Date(freshExam.endsAt.replace(' ', 'T')).getTime();
        if (!isNaN(endTime) && Date.now() > endTime) {
          setLoginError('Batas waktu pelaksanaan ujian ini telah berakhir. Hubungi pengawas ujian untuk membuka kembali sesi pengerjaan.');
          return;
        }
      }
    }

    // 2. Verifikasi Mode Pengerjaan ("Sekali" vs "Berulang")
    const isSingleAttempt = (freshExam.attemptMode || 'single') === 'single';
    if (!isSingleAttempt) {
      // Mode "Berulang" (Bisa Mengulang): Siswa dapat mengerjakan ujian berkali-kali!
      // Bersihkan jawaban dan izin lama agar mulai dengan lembar baru
      setUserAnswers({});
      setFlaggedQuestions({});
      setLoginError(null);
    } else {
      // Mode "Sekali Pengerjaan": Cek apakah siswa berhak mengulang ujian
      const hasDirectPermission = StorageService.hasRetakePermission(freshExam.id, studentNo, studentName);

      let allSubmissions = StorageService.getSubmissions();
      let studentPastSubs = allSubmissions.filter(sub =>
        String(sub.examId).trim().toLowerCase() === String(freshExam.id).trim().toLowerCase() &&
        (
          (studentNo.trim() && sub.studentNo?.trim().toLowerCase() === studentNo.trim().toLowerCase()) ||
          (studentName.trim() && sub.studentName?.trim().toLowerCase() === studentName.trim().toLowerCase())
        )
      );

      // Cek apakah rekaman lokal telah memiliki status 'Mengulang Ujian'
      const hasLocalRepeatFlag = studentPastSubs.some(sub => {
        const rawNote = String(sub.statusNote || '').toLowerCase();
        return sub.allowRepeat === true ||
               String(sub.allowRepeat).toLowerCase() === 'true' ||
               String(sub.allowRepeat) === '1' ||
               rawNote.includes('ulang') ||
               rawNote.includes('reset') ||
               (Number(sub.score) === 0 && Number(sub.percentage) === 0);
      });

      if (hasDirectPermission || hasLocalRepeatFlag) {
        // GURU TELAH MENGIZINKAN SISWA MENGULANG UJIAN!
        studentPastSubs.forEach(s => {
          StorageService.deleteSubmission(s.id);
        });
        StorageService.consumeRetakePermission(freshExam.id, studentNo, studentName);
        setUserAnswers({});
        setFlaggedQuestions({});
        setLoginError(null);
      } else if (studentPastSubs.length > 0) {
        // Ada submission lama yang selesai. Lakukan verifikasi real-time ke Google Sheets server
        const gasUrl = StorageService.getSettings().gasWebAppUrl;
        if (gasUrl && gasUrl.trim().startsWith('http')) {
          setLoginError('Menghubungkan ke server Google Sheets untuk verifikasi status izin ujian...');
          try {
            await GasClient.fetchAllFromSheets();
            allSubmissions = StorageService.getSubmissions();
            const serverPastSubs = allSubmissions.filter(sub =>
              String(sub.examId).trim().toLowerCase() === String(freshExam.id).trim().toLowerCase() &&
              (
                (studentNo.trim() && sub.studentNo?.trim().toLowerCase() === studentNo.trim().toLowerCase()) ||
                (studentName.trim() && sub.studentName?.trim().toLowerCase() === studentName.trim().toLowerCase())
              )
            );

            // A. Jika di Google Sheets nilai siswa SUDAH DIHAPUS oleh guru:
            if (serverPastSubs.length === 0) {
              // Guru telah menghapus nilai di dasbor / Google Sheets -> izinkan siswa mengerjakan!
              studentPastSubs.forEach(s => StorageService.deleteSubmission(s.id));
              setUserAnswers({});
              setFlaggedQuestions({});
              setLoginError(null);
            } else {
              // B. Jika di server masih ada submission, cek apakah statusnya 'Mengulang Ujian':
              const serverAllowsRepeat = serverPastSubs.some(sub => {
                const rawNote = String(sub.statusNote || '').toLowerCase();
                return sub.allowRepeat === true ||
                       String(sub.allowRepeat).toLowerCase() === 'true' ||
                       String(sub.allowRepeat) === '1' ||
                       rawNote.includes('ulang') ||
                       rawNote.includes('reset') ||
                       (Number(sub.score) === 0 && Number(sub.percentage) === 0);
              });

              if (serverAllowsRepeat) {
                // Guru telah mereset nilai dengan status Mengulang Ujian!
                serverPastSubs.forEach(s => StorageService.deleteSubmission(s.id));
                studentPastSubs.forEach(s => StorageService.deleteSubmission(s.id));
                StorageService.consumeRetakePermission(freshExam.id, studentNo, studentName);
                setUserAnswers({});
                setFlaggedQuestions({});
                setLoginError(null);
              } else {
                setLoginError(
                  `Ujian ini diatur dalam mode "Sekali Pengerjaan" dan siswa atas nama "${studentName}" (${studentNo}) telah tercatat menyelesaikan sesi ujian sebelumnya. Akses telah ditutup oleh server. Jika ingin mengulang pengerjaan, silakan hubungi guru pengawas untuk mereset status nilai Anda di dasbor dengan keterangan "Mengulang Ujian" atau menghapus nilai sebelumnya.`
                );
                return;
              }
            }
          } catch {
            setLoginError(
              `Ujian ini diatur dalam mode "Sekali Pengerjaan" dan siswa atas nama "${studentName}" (${studentNo}) telah tercatat menyelesaikan sesi ujian sebelumnya. Akses telah ditutup oleh server. Jika ingin mengulang pengerjaan, silakan hubungi guru pengawas untuk mereset status nilai Anda di dasbor dengan keterangan "Mengulang Ujian" atau menghapus nilai sebelumnya.`
            );
            return;
          }
        } else {
          setLoginError(
            `Ujian ini diatur dalam mode "Sekali Pengerjaan" dan siswa atas nama "${studentName}" (${studentNo}) telah tercatat menyelesaikan sesi ujian sebelumnya. Akses telah ditutup oleh server. Jika ingin mengulang pengerjaan, silakan hubungi guru pengawas untuk mereset status nilai Anda di dasbor dengan keterangan "Mengulang Ujian" atau menghapus nilai sebelumnya.`
          );
          return;
        }
      }
    }

    // Pastikan seluruh butir soal ujian telah termuat sebelum memulai
    let qs = StorageService.getQuestionsByExamId(selectedExam.id);
    if (qs.length === 0) {
      const allQs = StorageService.getQuestions();
      qs = allQs.filter(q => String(q.examId).trim().toLowerCase() === String(selectedExam.id).trim().toLowerCase());
    }

    const expectedCount = selectedExam.totalQuestions || 0;
    const isUnderloaded = expectedCount > 0 && qs.length < expectedCount;

    if (qs.length === 0 || isUnderloaded) {
      setLoginError(`Mengunduh seluruh butir soal (${expectedCount > 0 ? expectedCount : 'lengkap'} butir soal) dari server Google Sheets...`);
      setIsDownloadingQuestions(true);
      try {
        await GasClient.fetchAllFromSheets();
        setIsDownloadingQuestions(false);
        const downloaded = StorageService.getQuestionsByExamId(selectedExam.id);
        if (downloaded.length > 0) {
          setExamQuestions(downloaded);
          setLoginError(null);
          startExamSession(downloaded);
        } else {
          setLoginError('Soal belum ditemukan untuk ujian ini di server Google Sheets. Pastikan guru telah menekan tombol "Sinkronkan Sekarang" pada menu guru.');
        }
      } catch {
        setIsDownloadingQuestions(false);
        if (qs.length > 0) {
          // Lanjutkan dengan soal lokal yang ada jika offline
          setExamQuestions(qs);
          setLoginError(null);
          startExamSession(qs);
        } else {
          setLoginError('Gagal mengunduh soal dari Google Sheets. Periksa koneksi internet Anda.');
        }
      }
      return;
    }

    startExamSession(qs);
  };

  const handleSelectOption = (questionId: string, optionId: string, isCheckbox = false) => {
    const check = canModifyQuestion(questionId);
    if (!check.allowed) {
      setRevisionAlertMessage(check.reason || 'Jawaban tidak dapat diubah.');
      setTimeout(() => setRevisionAlertMessage(null), 7000);
      return;
    }

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
    const check = canModifyQuestion(questionId);
    if (!check.allowed) {
      setRevisionAlertMessage(check.reason || 'Jawaban esai tidak dapat diubah.');
      setTimeout(() => setRevisionAlertMessage(null), 7000);
      return;
    }

    setUserAnswers(prev => ({
      ...prev,
      [questionId]: text
    }));
  };

  const handleMatchingChange = (questionId: string, pairId: string, selectedMatch: string) => {
    const check = canModifyQuestion(questionId);
    if (!check.allowed) {
      setRevisionAlertMessage(check.reason || 'Jawaban menjodohkan tidak dapat diubah.');
      setTimeout(() => setRevisionAlertMessage(null), 7000);
      return;
    }

    const currentRaw = userAnswers[questionId];
    let map: Record<string, string> = {};
    if (typeof currentRaw === 'string') {
      try {
        map = JSON.parse(currentRaw) || {};
      } catch {
        map = {};
      }
    }
    map[pairId] = selectedMatch;
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: JSON.stringify(map)
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

    if (!reason) {
      if (!isAllQuestionsAnswered) {
        const remaining = examQuestions.length - answeredQuestionsCount;
        const confirmMsg = `⚠️ Peringatan Pengumpulan Ujian:\n\n` +
          `• Masih ada ${remaining} butir soal yang BELUM Anda jawab!\n` +
          `• Sesuai aturan, Anda baru dapat merevisi jawaban setelah seluruh butir soal selesai dijawab.\n` +
          `• Kuota revisi yang telah terpakai: ${changedQuestionIds.length}/${MAX_REVISION_QUESTIONS} butir soal.\n\n` +
          `Apakah Anda yakin tetap ingin mengumpulkan dan mengakhiri ujian sekarang?`;
        if (!confirm(confirmMsg)) return;
      } else {
        const confirmMsg = `Konfirmasi Pengiriman Ujian:\n\n` +
          `• Seluruh butir soal (${examQuestions.length}/${examQuestions.length}) telah selesai Anda jawab.\n` +
          `• Kuota revisi jawaban yang terpakai: ${changedQuestionIds.length}/${MAX_REVISION_QUESTIONS} butir soal.\n\n` +
          `Apakah Anda yakin ingin mengirimkan lembar ujian sekarang?`;
        if (!confirm(confirmMsg)) return;
      }
    }

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
      } else if (q.type === 'matching') {
        if (AnalysisService.isAnswerCorrect(q, ans)) {
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

    // Bersihkan entri "Mengulang Ujian" sebelumnya jika ada agar data tidak duplikat
    const allSubs = StorageService.getSubmissions();
    const oldRepeatSub = allSubs.find(s =>
      String(s.examId).trim().toLowerCase() === String(selectedExam.id).trim().toLowerCase() &&
      (
        (studentNo.trim() && s.studentNo?.trim().toLowerCase() === studentNo.trim().toLowerCase()) ||
        (studentName.trim() && s.studentName?.trim().toLowerCase() === studentName.trim().toLowerCase())
      ) && (s.allowRepeat === true || s.statusNote === 'Mengulang Ujian')
    );
    if (oldRepeatSub) {
      StorageService.deleteSubmission(oldRepeatSub.id);
    }

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
      statusNote: 'Selesai',
      allowRepeat: false,
      submittedAt: new Date().toISOString(),
      tabSwitchCount,
      timeSpentSeconds: timeSpent,
      syncStatus: 'pending',
      feedback: passed ? 'Selamat, Anda telah melampaui kriteria ketuntasan!' : 'Belum mencapai batas kelulusan. Pelajari kembali materi ini.'
    };

    // Send to Google Apps Script / Local storage
    await GasClient.submitAnswer(submission);
    onSubmissionComplete(submission);

    // Bersihkan draft progress di perangkat lokal setelah jawaban berhasil diserahkan
    try {
      const progressKey = getExamProgressKey(selectedExam.id, studentNo, studentName);
      localStorage.removeItem(progressKey);
    } catch {}

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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => setShowDetailedReview(prev => !prev)}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>{showDetailedReview ? 'Sembunyikan Pembahasan Soal' : 'Lihat Review & Pembahasan Lengkap'}</span>
              {showDetailedReview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setCompletedSubmission(null);
                setSelectedExam(null);
              }}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Kembali ke Jadwal Ujian
            </button>
          </div>

          {/* Review Jawaban & Pembahasan Lengkap di Akhir Ujian */}
          {showDetailedReview && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-left space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Review Lembar Jawaban & Pembahasan Soal
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pelajari kembali butir soal, kunci jawaban yang benar, serta pembahasan materi berikut ini.
                  </p>
                </div>
                <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-full border border-indigo-200 dark:border-indigo-800 shrink-0">
                  Total {examQuestions.length} Butir Soal
                </span>
              </div>

              <div className="space-y-4">
                {examQuestions.map((q, idx) => {
                  const studentAns = completedSubmission.answers ? completedSubmission.answers[q.id] : undefined;
                  const safeOpts = normalizeQuestionOptions(q.options);
                  
                  let isCorrect = false;
                  let correctText = '';
                  let studentAnswerText = '-';

                  if (q.type === 'multiple_choice') {
                    isCorrect = studentAns === q.correctKey;
                    const cOpt = safeOpts.find(o => o.id === q.correctKey);
                    correctText = cOpt ? cOpt.text : String(q.correctKey || '');
                    const sOpt = safeOpts.find(o => o.id === studentAns);
                    studentAnswerText = sOpt ? sOpt.text : (studentAns ? String(studentAns) : 'Tidak dijawab');
                  } else if (q.type === 'checkbox') {
                    const cKeys = Array.isArray(q.correctKey) ? q.correctKey : [q.correctKey];
                    const sList = Array.isArray(studentAns) ? studentAns : [];
                    isCorrect = cKeys.length === sList.length && cKeys.every(k => sList.includes(k));
                    correctText = safeOpts.filter(o => cKeys.includes(o.id)).map(o => o.text).join(', ');
                    studentAnswerText = sList.length > 0 
                      ? safeOpts.filter(o => sList.includes(o.id)).map(o => o.text).join(', ')
                      : 'Tidak dijawab';
                  } else if (q.type === 'matching') {
                    isCorrect = AnalysisService.isAnswerCorrect(q, studentAns);
                    const pairs = q.matchingPairs || [];
                    correctText = pairs.map(p => `${p.premise} ➔ ${p.match}`).join('<br/>');
                    let sMap: Record<string, string> = {};
                    if (typeof studentAns === 'string') {
                      try { sMap = JSON.parse(studentAns); } catch {}
                    }
                    if (Object.keys(sMap).length > 0) {
                      studentAnswerText = pairs.map(p => {
                        const m = sMap[p.id] || '<em>(Belum dipilih)</em>';
                        return `${p.premise} ➔ ${m}`;
                      }).join('<br/>');
                    } else {
                      studentAnswerText = 'Tidak dijawab';
                    }
                  } else if (q.type === 'essay') {
                    studentAnswerText = typeof studentAns === 'string' && studentAns.trim() ? studentAns : 'Tidak dijawab';
                    isCorrect = Boolean(studentAns && String(studentAns).trim().length > 5);
                  }

                  return (
                    <div 
                      key={q.id}
                      className={`p-5 rounded-2xl border transition-all text-xs ${
                        q.type === 'essay'
                          ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                          : isCorrect
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                      }`}
                    >
                      {/* Nomor & Badge Status */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {q.type === 'multiple_choice' ? 'Pilihan Ganda' : q.type === 'checkbox' ? 'Pilihan Ganda Kompleks' : q.type === 'matching' ? 'Menjodohkan / Mencocokkan' : 'Uraian / Esai'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({q.points || 10} Poin)
                          </span>
                        </div>

                        {q.type !== 'essay' ? (
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                            isCorrect 
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700' 
                              : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
                          }`}>
                            {isCorrect ? '✓ Benar' : '✗ Belum Benar'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            Evaluasi Guru
                          </span>
                        )}
                      </div>

                      {/* Media Lampiran jika ada */}
                      {Boolean(q.mediaUrl && q.mediaUrl.trim() !== '') && (
                        <div className="mb-3">
                          <QuestionMedia
                            mediaUrl={q.mediaUrl}
                            mediaType={q.mediaType}
                            title={`Lampiran Soal No. ${idx + 1}`}
                            onZoomImage={(url) => setZoomImageUrl(url)}
                          />
                        </div>
                      )}

                      {/* Pertanyaan */}
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3 leading-relaxed">
                        <QuestionPromptRenderer
                          prompt={q.prompt}
                          onZoomImage={(url) => setZoomImageUrl(url)}
                        />
                      </div>

                      {/* Perbandingan Jawaban */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-3">
                        <div>
                          <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">
                            Jawaban Anda:
                          </span>
                          <div 
                            className={`font-semibold ${
                              q.type === 'essay'
                                ? 'text-slate-800 dark:text-slate-200'
                                : isCorrect
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                            dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(studentAnswerText) }}
                          />
                        </div>

                        {q.type !== 'essay' && (
                          <div>
                            <span className="text-[11px] text-slate-400 block font-semibold mb-0.5">
                              Kunci Jawaban yang Benar:
                            </span>
                            <div 
                              className="font-bold text-emerald-700 dark:text-emerald-400"
                              dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(correctText) }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Kotak Pembahasan & Penjelasan Materi */}
                      <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/60 text-slate-800 dark:text-slate-200 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-300">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Pembahasan Soal:</span>
                        </div>
                        <div 
                          className="leading-relaxed text-slate-700 dark:text-slate-300 pl-3 border-l-2 border-indigo-400 dark:border-indigo-600 text-xs"
                          dangerouslySetInnerHTML={{ 
                            __html: q.explanation 
                              ? MathRenderer.renderMixedText(q.explanation) 
                              : '<em>Belum ada pembahasan tambahan untuk butir soal ini.</em>' 
                          }}
                        />
                        {(q.learningObjective || q.indicator) && (
                          <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-800/40 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Tujuan Pembelajaran: </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{q.learningObjective || q.indicator}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
        {/* Floating Notification for Revision Quota & Locked Answers */}
        {revisionAlertMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] p-4 bg-rose-600 text-white rounded-2xl shadow-2xl flex items-start gap-3 animate-fadeIn border border-white/20">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-200" />
            <div className="flex-1 text-xs">
              <div className="font-bold text-amber-100 mb-0.5">Pemberitahuan Ujian:</div>
              <div className="whitespace-pre-line leading-relaxed">{revisionAlertMessage}</div>
            </div>
            <button 
              onClick={() => setRevisionAlertMessage(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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

            {/* Status & Countdown Timer */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Device Auto-Save Status Badge */}
              <div 
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shadow-2xs transition-all ${
                  isOnline
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 animate-pulse'
                }`}
                title={isOnline ? 'Jawaban otomatis tersimpan aman di perangkat siswa' : 'Koneksi terputus: jawaban tetap tersimpan offline di perangkat Anda'}
              >
                {isOnline ? (
                  <>
                    <Save className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Tersimpan di Perangkat</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Offline (Jawaban Aman)</span>
                  </>
                )}
              </div>

              {/* Countdown Timer with Visual Tone */}
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

        {/* Offline Notification Banner */}
        {!isOnline && (
          <div className="max-w-5xl mx-auto px-4 mt-3">
            <div className="bg-amber-50 dark:bg-amber-950/90 border border-amber-300 dark:border-amber-700 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900 dark:text-amber-100 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Koneksi internet terputus:</strong> Jawaban Anda tersimpan otomatis di perangkat ini. Anda dapat terus melanjutkan mengerjakan soal berikutnya tanpa khawatir kehilangan jawaban.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Restored Progress Notification Banner */}
        {restoredProgressNotice && (
          <div className="max-w-5xl mx-auto px-4 mt-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-700 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-100 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{restoredProgressNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setRestoredProgressNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 p-0.5 ml-2"
                title="Tutup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {answeredCount}/{examQuestions.length} Terjawab
                  </span>
                  {isAllQuestionsAnswered && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      Revisi: {changedQuestionIds.length}/{MAX_REVISION_QUESTIONS}
                    </span>
                  )}
                </div>
              </div>

              {/* Grid of Question Numbers */}
              <div className="grid grid-cols-5 gap-2">
                {examQuestions.map((q, idx) => {
                  const isCurrent = idx === currentQuestionIndex;
                  const hasAnswer = isQuestionAnswered(q.id, userAnswers);
                  const isFlagged = flaggedQuestions[q.id];
                  const isRevised = changedQuestionIds.includes(q.id);

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`h-9 rounded-lg text-xs font-bold transition-all relative flex items-center justify-center ${
                        isCurrent
                          ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 bg-indigo-600 text-white shadow-sm'
                          : isFlagged
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          : isRevised
                          ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 ring-1 ring-purple-400'
                          : hasAnswer
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {idx + 1}
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
                      )}
                      {isRevised && !isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full" title="Jawaban telah direvisi" />
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
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-purple-500 shrink-0" />
                  <span>Direvisi ({changedQuestionIds.length}/{MAX_REVISION_QUESTIONS})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-600 shrink-0" />
                  <span>Soal Aktif</span>
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

                {/* Multimedia Attachment Container (Audio, Image, Video, Local File, Drive, YouTube) */}
                {Boolean(currentQ.mediaUrl && currentQ.mediaUrl.trim() !== '') && (
                  <div className="mb-6">
                    <QuestionMedia
                      mediaUrl={currentQ.mediaUrl}
                      mediaType={currentQ.mediaType}
                      title={`Lampiran Soal No. ${currentQuestionIndex + 1}`}
                      onZoomImage={(url) => setZoomImageUrl(url)}
                    />
                  </div>
                )}

                {/* Question Prompt with support for markdown images & rich text */}
                <div className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 mb-6 leading-relaxed">
                  <QuestionPromptRenderer
                    prompt={currentQ.prompt}
                    onZoomImage={(url) => setZoomImageUrl(url)}
                  />
                </div>

                {/* Status Keterangan Soal & Revisi Jawaban */}
                {(() => {
                  const isUnlocked = unlockedExplanationIds.includes(currentQ.id);
                  const isRevised = changedQuestionIds.includes(currentQ.id);

                  if (isUnlocked && !isAllQuestionsAnswered) {
                    return (
                      <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5 animate-fadeIn">
                        <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>
                          <strong>Jawaban Terkunci Sementara:</strong> Pembahasan butir soal ini telah dibuka. Sesuai aturan ujian, Anda baru dapat mengubah kembali jawaban setelah <strong>seluruh soal ({answeredCount}/{examQuestions.length})</strong> selesai dijawab.
                        </span>
                      </div>
                    );
                  }

                  if (isAllQuestionsAnswered) {
                    if (isRevised) {
                      return (
                        <div className="mb-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2 animate-fadeIn">
                          <div className="flex items-center gap-2">
                            <Edit3 className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                            <span>
                              <strong>Jawaban Butir Soal Ini Telah Direvisi</strong> (dari jawaban semula).
                            </span>
                          </div>
                          <span className="font-bold text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 shrink-0">
                            Kuota: {changedQuestionIds.length}/{MAX_REVISION_QUESTIONS}
                          </span>
                        </div>
                      );
                    } else if (changedQuestionIds.length >= MAX_REVISION_QUESTIONS) {
                      return (
                        <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2.5 animate-fadeIn">
                          <Lock className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                          <span>
                            <strong>Batas Kuota Revisi Penuh ({MAX_REVISION_QUESTIONS}/{MAX_REVISION_QUESTIONS}):</strong> Anda telah merevisi 5 butir soal lain. Anda tidak dapat mengubah butir soal ini lagi.
                          </span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 animate-fadeIn">
                          <div className="flex items-center gap-2">
                            <Unlock className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              <strong>Mode Revisi Terbuka:</strong> Seluruh soal telah terjawab. Anda dapat mengubah pilihan jawaban jika diperlukan.
                            </span>
                          </div>
                          <span className="font-bold text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 shrink-0">
                            Sisa Kuota: {MAX_REVISION_QUESTIONS - changedQuestionIds.length} Soal
                          </span>
                        </div>
                      );
                    }
                  }

                  return null;
                })()}

                {/* Option Choices */}
                {currentQ.type === 'multiple_choice' && (() => {
                  const safeOpts = normalizeQuestionOptions(currentQ.options);
                  const canModify = canModifyQuestion(currentQ.id);

                  return (
                    <div className="space-y-3">
                      {safeOpts.map((opt, optIdx) => {
                        const isSelected = userAnswers[currentQ.id] === opt.id;
                        const optionLetters = ['A', 'B', 'C', 'D', 'E'];
                        const letter = optionLetters[optIdx] || String(optIdx + 1);

                        return (
                          <label
                            key={opt.id}
                            className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all ${
                              !canModify.allowed ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                            } ${
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
                              <span dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(opt.text) }} />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  );
                })()}

                {currentQ.type === 'checkbox' && (() => {
                  const safeOpts = normalizeQuestionOptions(currentQ.options);
                  const canModify = canModifyQuestion(currentQ.id);

                  return (
                    <div className="space-y-3">
                      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        * Pilih satu atau lebih jawaban yang menurut Anda benar.
                      </div>
                      {safeOpts.map((opt, optIdx) => {
                        const selectedList = (userAnswers[currentQ.id] as string[]) || [];
                        const isSelected = selectedList.includes(opt.id);
                        const optionLetters = ['A', 'B', 'C', 'D', 'E'];
                        const letter = optionLetters[optIdx] || String(optIdx + 1);

                        return (
                          <label
                            key={opt.id}
                            className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all ${
                              !canModify.allowed ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                            } ${
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
                              <span dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(opt.text) }} />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  );
                })()}

                {currentQ.type === 'essay' && (() => {
                  const canModify = canModifyQuestion(currentQ.id);
                  return (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                        Tuliskan jawaban uraian Anda pada kotak di bawah ini:
                      </label>
                      <textarea
                        rows={6}
                        readOnly={!canModify.allowed}
                        value={(userAnswers[currentQ.id] as string) || ''}
                        onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                        placeholder={canModify.allowed ? "Ketik jawaban lengkap di sini..." : "Jawaban terkunci sesuai aturan ujian."}
                        className={`w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${
                          !canModify.allowed ? 'opacity-80 cursor-not-allowed' : ''
                        }`}
                      />
                      <div className="text-[11px] text-slate-400 text-right">
                        {((userAnswers[currentQ.id] as string) || '').length} karakter
                      </div>
                    </div>
                  );
                })()}

                {currentQ.type === 'matching' && (() => {
                  const pairs = currentQ.matchingPairs || [];
                  const canModify = canModifyQuestion(currentQ.id);
                  let currentMap: Record<string, string> = {};
                  const rawAns = userAnswers[currentQ.id];
                  if (typeof rawAns === 'string') {
                    try {
                      currentMap = JSON.parse(rawAns) || {};
                    } catch {
                      currentMap = {};
                    }
                  }

                  // Kumpulkan semua pilihan respon yang unik untuk dropdown
                  const availableMatches = Array.from(new Set(pairs.map(p => p.match).filter(Boolean)));

                  return (
                    <div className="space-y-3.5">
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        * Pasangkan setiap pernyataan / premis di kolom kiri dengan respon pasangan yang tepat di kolom kanan.
                      </div>
                      <div className="space-y-3">
                        {pairs.map((pair, pIdx) => {
                          const selectedVal = currentMap[pair.id] || '';
                          return (
                            <div
                              key={pair.id || pIdx}
                              className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex-1 text-sm text-slate-800 dark:text-slate-200 flex items-start gap-2.5">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 shrink-0 mt-0.5">
                                  {pIdx + 1}
                                </span>
                                <span dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(pair.premise) }} />
                              </div>

                              <div className="sm:w-64 shrink-0">
                                <select
                                  disabled={!canModify.allowed}
                                  value={selectedVal}
                                  onChange={(e) => handleMatchingChange(currentQ.id, pair.id, e.target.value)}
                                  className={`w-full px-3 py-2 rounded-lg text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${
                                    !canModify.allowed ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                                  }`}
                                >
                                  <option value="">-- Pilih Pasangan --</option>
                                  {availableMatches.map((mVal, mIdx) => (
                                    <option key={mIdx} value={mVal}>
                                      {mVal}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Fitur Pembahasan Soal: HANYA muncul saat siswa sudah menekan tombol Selanjutnya */}
                {(() => {
                  const currentAns = userAnswers[currentQ.id];
                  const isExplanationUnlocked = unlockedExplanationIds.includes(currentQ.id);

                  // Penjelasan TIDAK muncul saat memilih/mengisi jawaban, hanya setelah menekan Selanjutnya
                  if (!isExplanationUnlocked) return null;

                  let isCorrect = false;

                  if (currentQ.type === 'multiple_choice') {
                    isCorrect = currentAns === currentQ.correctKey;
                  } else if (currentQ.type === 'checkbox') {
                    const corrKeys = Array.isArray(currentQ.correctKey) ? currentQ.correctKey : [currentQ.correctKey];
                    const selectedList = Array.isArray(currentAns) ? currentAns : [];
                    isCorrect = corrKeys.length === selectedList.length && corrKeys.every(k => selectedList.includes(k));
                  } else if (currentQ.type === 'matching') {
                    isCorrect = AnalysisService.isAnswerCorrect(currentQ, currentAns);
                  }

                  return (
                    <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 animate-fadeIn">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => setShowCurrentExplanation(prev => !prev)}
                          className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>
                            {showCurrentExplanation ? 'Tutup Pembahasan Soal' : 'Lihat Pembahasan & Konsep Soal Ini'}
                          </span>
                          {showCurrentExplanation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {currentQ.type !== 'essay' && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCorrect 
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}>
                            {isCorrect ? '✓ Jawaban Anda Benar' : '✗ Jawaban Belum Tepat'}
                          </span>
                        )}
                      </div>

                      {showCurrentExplanation && (
                        <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/80 text-xs text-slate-800 dark:text-slate-200 space-y-2.5">
                          <div>
                            <span className="font-bold text-indigo-900 dark:text-indigo-300 block mb-1">
                              💡 Penjelasan & Pembahasan Konsep:
                            </span>
                            <div 
                              className="leading-relaxed text-slate-700 dark:text-slate-300 pl-3 border-l-2 border-indigo-400 dark:border-indigo-600"
                              dangerouslySetInnerHTML={{ 
                                __html: currentQ.explanation 
                                  ? MathRenderer.renderMixedText(currentQ.explanation) 
                                  : '<em>Guru belum menyematkan pembahasan terperinci pada butir soal ini. Pahami kembali konsep materi terkait.</em>' 
                              }} 
                            />
                          </div>

                          {(currentQ.learningObjective || currentQ.indicator) && (
                            <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/60 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>Tujuan Pembelajaran: </span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{currentQ.learningObjective || currentQ.indicator}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Warning Banner Khusus di Nomor Terakhir Sebelum Mengirimkan Ujian */}
                {isLast && (
                  <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-2 border-amber-300 dark:border-amber-700/80 shadow-xs space-y-3 animate-fadeIn">
                    <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Peringatan Nomor Terakhir Sebelum Mengirimkan Ujian</span>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                      {/* Status Kelengkapan Soal */}
                      <div className="flex items-start gap-2.5">
                        {isAllQuestionsAnswered ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Status Kelengkapan Soal: {answeredCount} dari {examQuestions.length} butir soal telah dijawab.
                          </span>
                          {!isAllQuestionsAnswered ? (
                            <p className="text-rose-700 dark:text-rose-400 text-[11px] mt-0.5 font-medium">
                              ⚠️ Perhatian: Masih ada {examQuestions.length - answeredCount} butir soal yang belum dijawab. Anda baru dapat mengubah jawaban setelah SELURUH soal terjawab lengkap.
                            </p>
                          ) : (
                            <p className="text-emerald-700 dark:text-emerald-400 text-[11px] mt-0.5 font-medium">
                              ✓ Seluruh soal telah selesai dijawab. Fitur revisi jawaban telah aktif.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Aturan Batas Revisi 5 Soal */}
                      <div className="flex items-start gap-2.5 pt-2 border-t border-amber-200/80 dark:border-amber-800/60">
                        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Aturan Perubahan Jawaban: Siswa dapat mengubah jawaban setelah semua soal dijawab, dan hanya dapat mengubah jawaban dari maksimal 5 butir soal.
                          </span>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              changedQuestionIds.length >= MAX_REVISION_QUESTIONS
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            }`}>
                              Kuota Revisi Terpakai: {changedQuestionIds.length} / {MAX_REVISION_QUESTIONS} Butir Soal
                            </span>
                            {changedQuestionIds.length > 0 && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                (Nomor yang telah diubah: {examQuestions.map((q, idx) => changedQuestionIds.includes(q.id) ? `No. ${idx + 1}` : null).filter(Boolean).join(', ')})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Konfirmasi Akhir */}
                      <div className="pt-2 border-t border-amber-200/80 dark:border-amber-800/60 text-[11px] text-slate-600 dark:text-slate-400">
                        * Periksa kembali seluruh lembar jawaban Anda. Setelah tombol <strong>"Kirim Jawaban"</strong> ditekan, sesi ujian akan langsung diakhiri dan nilai tercatat secara permanen.
                      </div>
                    </div>
                  </div>
                )}

                {/* Question Navigation Footer */}
                {(() => {
                  const hasAnsweredCurrent = isQuestionAnswered(currentQ.id, userAnswers);
                  const isExplanationUnlocked = unlockedExplanationIds.includes(currentQ.id);

                  const handleNextQuestion = () => {
                    // Jika butir soal ini sudah dijawab dan penjelasan belum pernah dibuka:
                    // Buka penjelasan terlebih dahulu saat tombol selanjutnya ditekan
                    if (hasAnsweredCurrent && !isExplanationUnlocked) {
                      setUnlockedExplanationIds(prev => (prev.includes(currentQ.id) ? prev : [...prev, currentQ.id]));
                      setShowCurrentExplanation(true);
                      return;
                    }

                    // Jika penjelasan sudah dibuka atau belum dijawab, langsung berpindah nomor
                    setShowCurrentExplanation(false);
                    setCurrentQuestionIndex(i => Math.min(i + 1, examQuestions.length - 1));
                  };

                  return (
                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      {/* Hint Banner when Explanation Was Just Unlocked */}
                      {hasAnsweredCurrent && isExplanationUnlocked && !isLast && showCurrentExplanation && (
                        <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 animate-fadeIn">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>💡 Pembahasan soal nomor ini telah terbuka di atas. Pelajari konsepnya, lalu tekan <strong>Lanjut ke Soal No. {currentQuestionIndex + 2}</strong>.</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => {
                            setShowCurrentExplanation(false);
                            setCurrentQuestionIndex(i => Math.max(i - 1, 0));
                          }}
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

                        <div className="text-xs text-slate-400 font-medium hidden sm:block">
                          Tersimpan otomatis di perangkat
                        </div>

                        {isLast ? (
                          <div className="flex items-center gap-2">
                            {hasAnsweredCurrent && !isExplanationUnlocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  setUnlockedExplanationIds(prev => (prev.includes(currentQ.id) ? prev : [...prev, currentQ.id]));
                                  setShowCurrentExplanation(true);
                                }}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Buka Pembahasan Soal Ini</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleSubmitExam()}
                              disabled={isSubmitting}
                              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                            >
                              <span>Kirim Jawaban</span>
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleNextQuestion}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                          >
                            <span>
                              {hasAnsweredCurrent && isExplanationUnlocked
                                ? `Lanjut ke Soal No. ${currentQuestionIndex + 2}`
                                : 'Selanjutnya'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-5 text-center sm:text-left">
          {/* Logo Pemda (Kiri) */}
          <img
            src={sanitizeLogoUrl(profile.regionalGovLogoUrl, PEMKOT_MALANG_LOGO_SVG)}
            alt="Logo Pemda"
            referrerPolicy="no-referrer"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain bg-white p-1.5 border-2 border-white/20 shadow-md shrink-0"
          />

          <div className="flex-1 space-y-1">
            <div className="text-[11px] sm:text-xs uppercase font-bold tracking-widest text-indigo-200">
              {profile.regionalGovName || 'PEMERINTAH KOTA MALANG'} · {profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {profile.name || 'SDN PISANGCANDI 1'}
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl">
              {profile.address} · NPSN: {profile.npsn} · TP: {profile.academicYear} ({profile.semester})
            </p>
          </div>

          {/* Logo Sekolah (Kanan) */}
          <img
            src={sanitizeLogoUrl(profile.logoUrl, SDN_PISANGCANDI_1_LOGO_SVG)}
            alt={profile.name}
            referrerPolicy="no-referrer"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain bg-white p-1.5 border-2 border-white/20 shadow-md shrink-0"
          />
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
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                        {exam.subject}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Kelas {exam.grade}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        exam.attemptMode === 'unlimited'
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      }`}>
                        {exam.attemptMode === 'unlimited' ? 'Mode: Berulang' : 'Mode: Sekali (1x)'}
                      </span>

                      {(() => {
                        const isLate = Boolean(exam.allowLateSubmission) || (Number(exam.lateExtensionMinutes) || 0) > 0;
                        const isFuture = exam.startsAt && !isNaN(new Date(exam.startsAt).getTime()) && new Date(exam.startsAt).getTime() > Date.now();

                        if (exam.sessionStatus === 'stopped' || exam.status === 'stopped') {
                          return (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                              <StopCircle className="w-3 h-3 text-rose-500" />
                              <span>Sesi Dihentikan Permanen</span>
                            </span>
                          );
                        }

                        if (isLate) {
                          return (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Toleransi Terlambat (+{exam.lateExtensionMinutes || 30}m)</span>
                            </span>
                          );
                        }

                        if (isFuture) {
                          return (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-blue-600" />
                              <span>Terjadwal: {new Date(exam.startsAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                          );
                        }

                        if (exam.sessionStatus === 'ended') {
                          return (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                              <StopCircle className="w-3 h-3 text-slate-500" />
                              <span>Sesi Ditutup</span>
                            </span>
                          );
                        }

                        return (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            <span>Sesi Aktif</span>
                          </span>
                        );
                      })()}
                    </div>
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
                    {exam.startsAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Jadwal Pelaksanaan:</span>
                        <span className="font-semibold font-mono text-indigo-600 dark:text-indigo-400">
                          {new Date(exam.startsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(exam.startsAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {exam.endsAt ? ` - ${new Date(exam.endsAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                      </div>
                    )}
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
                {(() => {
                  const isLate = Boolean(exam.allowLateSubmission) || (Number(exam.lateExtensionMinutes) || 0) > 0;
                  const isFuture = exam.startsAt && !isNaN(new Date(exam.startsAt).getTime()) && new Date(exam.startsAt).getTime() > Date.now();

                  if (exam.sessionStatus === 'stopped' || exam.status === 'stopped') {
                    return (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 px-4 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-xs rounded-xl shadow-xs cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <StopCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Sesi Ujian Dihentikan oleh Pengawas</span>
                      </button>
                    );
                  }

                  if (isLate) {
                    return (
                      <button
                        type="button"
                        onClick={() => handleStartExamClick(exam)}
                        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        title="Toleransi keterlambatan aktif oleh guru pengawas"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Lanjutkan (Siswa Terlambat)</span>
                      </button>
                    );
                  }

                  if (isFuture) {
                    const startFormatted = new Date(exam.startsAt).toLocaleString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <button
                        type="button"
                        onClick={() => alert(`Ujian "${exam.title}" dijadwalkan pada ${startFormatted}. Ruang ujian akan dibuka secara otomatis pada waktu tersebut.`)}
                        className="w-full py-2.5 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2"
                      >
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span>Terjadwal: {startFormatted}</span>
                      </button>
                    );
                  }

                  if (exam.sessionStatus === 'ended') {
                    return (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 px-4 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-xs rounded-xl shadow-xs cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        <span>Sesi Ujian Telah Ditutup</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      type="button"
                      onClick={() => handleStartExamClick(exam)}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Mulai Kerjakan Ujian</span>
                    </button>
                  );
                })()}
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
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold text-xs">
                  {selectedExam.totalQuestions || examQuestions.length} Butir Soal · {selectedExam.durationMinutes} Menit
                </span>
                <button
                  type="button"
                  disabled={isDownloadingQuestions}
                  onClick={async () => {
                    setIsDownloadingQuestions(true);
                    try {
                      await GasClient.fetchAllFromSheets();
                      const fresh = StorageService.getQuestionsByExamId(selectedExam.id);
                      setExamQuestions(fresh);
                    } finally {
                      setIsDownloadingQuestions(false);
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors"
                  title="Muat ulang soal terbaru dari Google Sheets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDownloadingQuestions ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                <p className="leading-relaxed">{loginError}</p>
                {loginError.includes('ditutup oleh server') && (
                  <button
                    type="button"
                    onClick={async () => {
                      setLoginError('Menghubungkan ke server Google Sheets untuk sinkronisasi izin...');
                      try {
                        await GasClient.fetchAllFromSheets();
                        setLoginError('Data server telah diperbarui. Silakan klik tombol "Mulai Ujian Sekarang" kembali.');
                      } catch {
                        setLoginError('Gagal menyinkronkan dengan server. Pastikan koneksi internet aktif.');
                      }
                    }}
                    className="mt-2.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Cek Ulang Izin dari Server (Jika Guru Baru Saja Mereset)</span>
                  </button>
                )}
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setStudentNo(val);
                      const found = students.find(s => String(s.studentNo).trim().toLowerCase() === val.trim().toLowerCase());
                      if (found) {
                        setStudentName(found.fullName);
                        if (found.classGrade) setStudentClass(found.classGrade);
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Ketik 1001 atau 1002 untuk contoh siswa terdaftar (nama akan terisi otomatis).
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

      {/* Live Help & Chat with Teacher/Supervisor (Available even before login) */}
      <StudentChatWidget
        currentExam={selectedExam}
        studentNo={studentNo}
        studentName={studentName}
        classGrade={studentClass}
        onApplyToken={(token) => {
          setExamToken(token);
        }}
        onRetakeGranted={() => {
          setLoginError(null);
        }}
      />
    </div>
  );
};
