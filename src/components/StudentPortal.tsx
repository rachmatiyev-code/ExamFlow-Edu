import React, { useState, useEffect, useRef } from 'react';
import { Exam, Question, SchoolProfile, Student, Submission, UiPreset, normalizeQuestionOptions } from '../types';
import { StorageService } from '../services/storage';
import { AnalysisService } from '../services/analysisService';
import { GasClient } from '../services/gasClient';
import { MediaViewer } from './MediaViewer';
import { QuestionMedia, QuestionPromptRenderer } from './QuestionMedia';
import { StudentChatWidget } from './StudentChatWidget';
import { MathRenderer } from '../services/mathRenderer';
import { getLocalDateInputValue, toLocalIsoString } from '../services/dateTimeHelper';
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
  uiPreset?: UiPreset;
  onSubmissionComplete: (sub: Submission) => void;
  onRefreshData?: () => void;
  initialExamId?: string | null;
  initialToken?: string | null;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  profile,
  exams,
  students,
  uiPreset = 'classic_clean',
  onSubmissionComplete,
  onRefreshData,
  initialExamId,
  initialToken
}) => {
  // State
  const [liveExams, setLiveExams] = useState<Exam[]>(() =>
    (exams || []).map(e => StorageService.normalizeExamRecord(e))
  );
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [serverStoppedNotice, setServerStoppedNotice] = useState<string | null>(null);
  
  // Student Login State (pulihkan identitas siswa terakhir di perangkat agar status pengerjaan tetap terbaca)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [studentNo, setStudentNo] = useState(() => {
    try {
      const saved = localStorage.getItem('examflow_student_identity');
      if (saved) return JSON.parse(saved).studentNo || '';
    } catch {}
    return '';
  });
  const [studentName, setStudentName] = useState(() => {
    try {
      const saved = localStorage.getItem('examflow_student_identity');
      if (saved) return JSON.parse(saved).studentName || '';
    } catch {}
    return '';
  });
  const [studentClass, setStudentClass] = useState(() => {
    try {
      const saved = localStorage.getItem('examflow_student_identity');
      if (saved) return JSON.parse(saved).classGrade || '';
    } catch {}
    return '';
  });
  const [examToken, setExamToken] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [portalLoginError, setPortalLoginError] = useState<string | null>(null);
  const [isPortalLoggingIn, setIsPortalLoggingIn] = useState(false);
  const [isPortalLoggedIn, setIsPortalLoggedIn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('examflow_student_identity');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(String(parsed?.studentNo || '').trim() && String(parsed?.studentName || '').trim());
      }
    } catch {}
    return false;
  });
  const [isDownloadingQuestions, setIsDownloadingQuestions] = useState(false);
  const [serverStudentAttempts, setServerStudentAttempts] = useState<Submission[]>([]);
  const [submissionVersion, setSubmissionVersion] = useState(0);
  const [portalFilter, setPortalFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [collapsedSubjectClusters, setCollapsedSubjectClusters] = useState<Record<string, boolean>>({});
  const [isRefreshingSchedule, setIsRefreshingSchedule] = useState(false);

  // Persist student identity locally whenever studentNo or studentName is set
  const persistStudentIdentity = React.useCallback((sNo: string, sName: string, sClass: string) => {
    try {
      if (sNo.trim() || sName.trim()) {
        localStorage.setItem('examflow_student_identity', JSON.stringify({
          studentNo: sNo.trim(),
          studentName: sName.trim(),
          classGrade: sClass.trim()
        }));
      }
    } catch {}
  }, []);

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

  // Sync liveExams whenever prop changes
  useEffect(() => {
    setLiveExams((exams || []).map(e => StorageService.normalizeExamRecord(e)));
  }, [exams]);

  // Helper normalisasi identitas & pencocokan ujian
  const normalizeNumericStr = (val?: string) => {
    const clean = String(val || '').trim().toLowerCase();
    if (!clean) return '';
    return /^\d+$/.test(clean) ? (clean.replace(/^0+/, '') || '0') : clean;
  };

  const isResetSubmissionEntry = (s: Submission) => {
    const rawNote = String(s.statusNote || '').toLowerCase();
    return (
      s.allowRepeat === true ||
      String(s.allowRepeat).toLowerCase() === 'true' ||
      String(s.allowRepeat) === '1' ||
      rawNote.includes('ulang') ||
      rawNote.includes('reset') ||
      rawNote.includes('retake')
    );
  };

  const mergeSubmissionsSources = (localSubs: Submission[], serverSubs: Submission[]): Submission[] => {
    const map = new Map<string, Submission>();
    const addSub = (sub: Submission) => {
      const exKey = String(sub.examId || '').trim().toLowerCase();
      const sKey = normalizeNumericStr(sub.studentNo) || String(sub.studentName || '').trim().toLowerCase();
      const key = `${exKey}::${sKey}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, sub);
        return;
      }
      const existingIsReset = isResetSubmissionEntry(existing);
      const newIsReset = isResetSubmissionEntry(sub);
      // Prioritaskan submisi yang benar-benar selesai di atas placeholder reset
      if (existingIsReset && !newIsReset) {
        map.set(key, sub);
        return;
      }
      if (!existingIsReset && newIsReset) {
        return;
      }
      // Jika sama-sama selesai, ambil yang memiliki jawaban lebih lengkap atau submittedAt terbaru
      const existingAnsCount = existing.answers ? Object.keys(existing.answers).length : 0;
      const newAnsCount = sub.answers ? Object.keys(sub.answers).length : 0;
      const existingTime = new Date(existing.submittedAt).getTime() || 0;
      const newTime = new Date(sub.submittedAt).getTime() || 0;
      if (newTime > existingTime || (newTime === existingTime && newAnsCount > existingAnsCount)) {
        map.set(key, {
          ...sub,
          answers: newAnsCount > 0 ? sub.answers : existing.answers
        });
      }
    };
    localSubs.forEach(addSub);
    serverSubs.forEach(addSub);
    return Array.from(map.values());
  };

  const matchSubToExam = (sub: Submission, exam: Exam): boolean => {
    const sExId = String(sub.examId || '').trim().toLowerCase();
    const exId = String(exam.id || '').trim().toLowerCase();
    if (sExId && exId && sExId === exId) return true;
    const sTitle = String(sub.examTitle || '').trim().toLowerCase();
    const exTitle = String(exam.title || '').trim().toLowerCase();
    return Boolean(!sExId && sTitle && exTitle && sTitle === exTitle);
  };

  const isStaleAutoZeroForOpenExam = (sub: Submission, examsList: Exam[]): boolean => {
    if (!StorageService.isAutoZeroSubmission(sub)) return false;
    const matchedEx = examsList.find(ex => matchSubToExam(sub, ex));
    if (!matchedEx) return false;
    return !StorageService.isExamStopped(matchedEx) && matchedEx.status === 'active' && matchedEx.sessionStatus !== 'ended';
  };

  const getLatestStudentsList = React.useCallback((): Student[] => {
    const stored = StorageService.getStudents();
    const map = new Map<string, Student>();
    (students || []).forEach(s => {
      const k = String(s.studentNo || s.id || '').trim().toLowerCase();
      if (k) map.set(k, s);
    });
    stored.forEach(s => {
      const k = String(s.studentNo || s.id || '').trim().toLowerCase();
      if (k) map.set(k, s);
    });
    return Array.from(map.values());
  }, [students]);

  // Sinkronkan riwayat pengerjaan siswa aktif dari server Express saat identitas terisi
  useEffect(() => {
    const cleanNo = studentNo.trim();
    const cleanName = studentName.trim();
    if (!cleanNo && !cleanName) {
      setServerStudentAttempts([]);
      return;
    }
    let active = true;
    GasClient.fetchStudentAttemptsFromServer(cleanNo, cleanName).then(list => {
      if (active && Array.isArray(list)) {
        setServerStudentAttempts(list);
      }
    });
    return () => { active = false; };
  }, [studentNo, studentName, submissionVersion]);

  // Refs for real-time listeners without re-subscribing
  const activeExamRef = useRef<{ active: boolean; examId?: string; isLoginOpen: boolean }>({
    active: false,
    examId: undefined,
    isLoginOpen: false
  });
  useEffect(() => {
    activeExamRef.current = {
      active: isExamActive,
      examId: selectedExam?.id,
      isLoginOpen: isLoginModalOpen
    };
  }, [isExamActive, selectedExam?.id, isLoginModalOpen]);

  const applyServerControls = React.useCallback((controlsMap: Record<string, any>) => {
    if (!controlsMap || typeof controlsMap !== 'object') return;
    const stored = StorageService.getExams();
    let changed = false;
    const updatedList = stored.map(ex => {
      const ctrl = controlsMap[String(ex.id || '').trim().toLowerCase()];
      if (!ctrl) return ex;
      const ctrlStatus = String(ctrl.status || ex.status).toLowerCase();
      const ctrlSession = String(ctrl.sessionStatus || ex.sessionStatus).toLowerCase();
      const isStopped = ctrlStatus === 'stopped' || ctrlSession === 'stopped';
      const merged = StorageService.normalizeExamRecord({
        ...ex,
        status: ctrl.status || ex.status,
        sessionStatus: isStopped ? 'stopped' : (ctrl.sessionStatus || ex.sessionStatus),
        attemptMode: ctrl.attemptMode || ex.attemptMode,
        allowLateSubmission: isStopped ? false : (ctrl.allowLateSubmission ?? ex.allowLateSubmission),
        lateExtensionMinutes: ctrl.lateExtensionMinutes ?? ex.lateExtensionMinutes,
        startsAt: ctrl.startsAt ?? ex.startsAt,
        endsAt: ctrl.endsAt ?? ex.endsAt,
        sessionStartedAt: ctrl.sessionStartedAt ?? ex.sessionStartedAt,
        sessionEndedAt: ctrl.sessionEndedAt ?? ex.sessionEndedAt
      });
      if (
        merged.status !== ex.status ||
        merged.sessionStatus !== ex.sessionStatus ||
        merged.attemptMode !== ex.attemptMode ||
        merged.allowLateSubmission !== ex.allowLateSubmission ||
        merged.endsAt !== ex.endsAt ||
        merged.lateExtensionMinutes !== ex.lateExtensionMinutes
      ) {
        changed = true;
      }
      return merged;
    });

    const reopenedExams = updatedList.filter(
      u => StorageService.isExamSessionOpen(u) || (!StorageService.isExamStopped(u) && u.status === 'active' && u.sessionStatus !== 'ended')
    );
    if (reopenedExams.length > 0) {
      let clearedAny = false;
      reopenedExams.forEach(u => {
        if (StorageService.clearAutoZeroSubmissionsForExam(u.id) > 0) {
          clearedAny = true;
        }
      });
      setServerStudentAttempts(prev =>
        prev.filter(s => {
          if (!StorageService.isAutoZeroSubmission(s)) return true;
          const sExId = String(s.examId || '').trim().toLowerCase();
          return !reopenedExams.some(u => String(u.id || '').trim().toLowerCase() === sExId);
        })
      );
      if (clearedAny) {
        setSubmissionVersion(v => v + 1);
      }
    }

    if (changed) {
      StorageService.saveExams(updatedList);
      setLiveExams(updatedList);
      setSubmissionVersion(v => v + 1);
      setTimeout(() => setSubmissionVersion(v => v + 1), 1000);
    } else {
      // Ensure liveExams still reflects latest controls even on first load
      setLiveExams(prev => {
        const mergedPrev = prev.map(ex => {
          const found = updatedList.find(u => u.id === ex.id);
          return found || ex;
        });
        return mergedPrev;
      });
    }

    const activeState = activeExamRef.current;
    if (activeState.examId) {
      const currentTarget = updatedList.find(
        u => String(u.id).trim().toLowerCase() === String(activeState.examId).trim().toLowerCase()
      );
      if (currentTarget) {
        setSelectedExam(prev => (prev && prev.id === currentTarget.id ? currentTarget : prev));
        if (StorageService.isExamStopped(currentTarget)) {
          if (activeState.active) {
            setIsExamActive(false);
            setIsLoginModalOpen(false);
            setServerStoppedNotice(
              `Sesi ujian "${currentTarget.title}" telah DIHENTIKAN SECARA PERMANEN oleh guru pengawas. Akses soal dan pengerjaan telah ditutup oleh server.`
            );
          } else if (activeState.isLoginOpen) {
            setLoginError(
              'Sesi ujian ini telah DIHENTIKAN PERMANEN oleh guru pengawas. Akses pengerjaan telah ditutup oleh server.'
            );
          }
        } else if (currentTarget.sessionStatus === 'ended' && activeState.active) {
          setIsExamActive(false);
          setIsLoginModalOpen(false);
          setServerStoppedNotice(
            `Sesi ujian "${currentTarget.title}" telah ditutup oleh guru pengawas ruangan.`
          );
        }
      }
    }
  }, []);

  // Sinkronisasi menyeluruh katalog ujian, kontrol pengawas, Google Sheets, dan riwayat attempt siswa
  const performFullStudentSync = React.useCallback(async () => {
    try {
      await GasClient.pullSharedStateFromServer();
      const controls = await GasClient.fetchExamControlsFromServer();
      if (controls && Object.keys(controls).length > 0) {
        applyServerControls(controls);
      }
      const gasUrl = StorageService.getSettings().gasWebAppUrl;
      if (gasUrl && gasUrl.trim().startsWith('http')) {
        await GasClient.fetchAllFromSheets();
        const latestControls = await GasClient.fetchExamControlsFromServer();
        if (latestControls && Object.keys(latestControls).length > 0) {
          applyServerControls(latestControls);
        }
      }
      const cleanNo = studentNo.trim();
      const cleanName = studentName.trim();
      if (cleanNo || cleanName) {
        const attempts = await GasClient.fetchStudentAttemptsFromServer(cleanNo, cleanName);
        if (Array.isArray(attempts)) {
          setServerStudentAttempts(prev => mergeSubmissionsSources(prev, attempts));
        }
      }
      setLiveExams(StorageService.getExams());
      setSubmissionVersion(v => v + 1);
      onRefreshData?.();
    } catch {}
  }, [applyServerControls, studentNo, studentName, onRefreshData]);

  // Lakukan sinkronisasi awal saat portal siswa dibuka agar daftar ujian & konfigurasi langsung sinkron lintas perangkat
  const initialStudentSyncDoneRef = useRef(false);
  useEffect(() => {
    if (initialStudentSyncDoneRef.current) return;
    initialStudentSyncDoneRef.current = true;
    performFullStudentSync();
  }, [performFullStudentSync]);

  // Poll /api/exam-controls & listen via WebSocket so stop/start/attemptMode/catalog propagate in real-time across tabs/devices
  useEffect(() => {
    let isMounted = true;
    const syncControls = async () => {
      const controls = await GasClient.fetchExamControlsFromServer();
      if (isMounted && controls && Object.keys(controls).length > 0) {
        const knownIds = new Set(StorageService.getExams().map(e => String(e.id || '').trim().toLowerCase()));
        const hasUnknownControl = Object.keys(controls).some(id => !knownIds.has(id.toLowerCase()));
        if (hasUnknownControl) {
          await GasClient.pullSharedStateFromServer();
          setLiveExams(StorageService.getExams());
          onRefreshData?.();
        }
        applyServerControls(controls);
      }
    };

    syncControls();
    const intervalMs = isExamActive || isLoginModalOpen ? 4000 : 8000;
    const pollTimer = setInterval(syncControls, intervalMs);

    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
      ws.onopen = () => {
        try {
          ws?.send(JSON.stringify({
            type: 'auth:register',
            role: 'student',
            nis: studentNo || undefined,
            name: studentName || undefined,
            examId: selectedExam?.id || undefined
          }));
        } catch {}
      };
      ws.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed?.type === 'exam:controls_init' && parsed.data) {
            applyServerControls(parsed.data);
          } else if (parsed?.type === 'exam:control_update' && parsed.data?.examId) {
            const targetId = String(parsed.data.examId).toLowerCase();
            const isKnown = StorageService.getExams().some(e => String(e.id || '').trim().toLowerCase() === targetId);
            if (!isKnown) {
              performFullStudentSync();
            } else {
              applyServerControls({ [targetId]: parsed.data });
            }
          } else if (parsed?.type === 'exam:catalog_update') {
            performFullStudentSync();
          }
        } catch {}
      };
    } catch {}

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
      try { ws?.close(); } catch {}
    };
  }, [applyServerControls, performFullStudentSync, onRefreshData, isExamActive, isLoginModalOpen, selectedExam?.id, studentNo, studentName]);

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
  const [scoreLookupTab, setScoreLookupTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [scoreLookupMatchedStudent, setScoreLookupMatchedStudent] = useState<Student | null>(null);
  const [isSyncingLookup, setIsSyncingLookup] = useState(false);

  // Trigger fungsi cek nilai & ujian belum dikerjakan secara programatik
  const triggerLookup = React.useCallback(async (
    initialQuery: string,
    targetTab: 'all' | 'pending' | 'completed' = 'all'
  ) => {
    setIsScoreLookupOpen(true);
    setScoreLookupTab(targetTab);
    const cleanQuery = initialQuery.trim();
    setScoreLookupNis(cleanQuery);

    const resolveStudentMatch = (queryStr: string, roster: Student[]): Student | null => {
      const qLower = queryStr.trim().toLowerCase();
      const qNum = normalizeNumericStr(queryStr);
      if (!qLower && !qNum) return null;
      return (
        roster.find(s => {
          const sNo = normalizeNumericStr(s.studentNo);
          const sNis = normalizeNumericStr(s.nis);
          const sNisn = normalizeNumericStr(s.nisn);
          return Boolean(qNum && ((sNo && sNo === qNum) || (sNis && sNis === qNum) || (sNisn && sNisn === qNum)));
        }) ||
        roster.find(s => String(s.fullName || '').trim().toLowerCase() === qLower) ||
        (qLower.length >= 3
          ? roster.find(s => String(s.fullName || '').trim().toLowerCase().includes(qLower))
          : undefined) ||
        null
      );
    };

    const filterMatchedForQuery = (
      subsList: Submission[],
      examsRef: Exam[],
      queryStr: string,
      matchedStu: Student | null
    ) => {
      const qLower = queryStr.trim().toLowerCase();
      const qNum = normalizeNumericStr(queryStr);
      const isPureDigits = /^\d+$/.test(queryStr.trim());

      const matched = subsList.filter(s => {
        const sNoNorm = normalizeNumericStr(s.studentNo);
        const sName = String(s.studentName || '').trim().toLowerCase();

        if (matchedStu) {
          const tNo = normalizeNumericStr(matchedStu.studentNo);
          const tNis = normalizeNumericStr(matchedStu.nis);
          const tNisn = normalizeNumericStr(matchedStu.nisn);
          const tName = String(matchedStu.fullName || '').trim().toLowerCase();
          return (
            (Boolean(tNo) && sNoNorm === tNo) ||
            (Boolean(tNis) && sNoNorm === tNis) ||
            (Boolean(tNisn) && sNoNorm === tNisn) ||
            (Boolean(tName) && sName === tName)
          );
        }

        if (isPureDigits) {
          return Boolean(qNum && sNoNorm === qNum);
        }
        if (qLower.length >= 3) {
          return sName === qLower || sName.includes(qLower);
        }
        return Boolean(qLower && sName === qLower);
      });

      const deduped = mergeSubmissionsSources(matched, []);
      return deduped.filter(s => !isResetSubmissionEntry(s) && !isStaleAutoZeroForOpenExam(s, examsRef));
    };

    if (!cleanQuery) {
      setStudentLookupResults(null);
      setScoreLookupMatchedStudent(null);
      setIsSyncingLookup(true);
      try {
        await performFullStudentSync();
      } finally {
        setIsSyncingLookup(false);
      }
      return;
    }

    const immediateRoster = getLatestStudentsList();
    const immediateStudent = resolveStudentMatch(cleanQuery, immediateRoster);
    setScoreLookupMatchedStudent(immediateStudent);

    const combinedImmediate = mergeSubmissionsSources(StorageService.getSubmissions(), serverStudentAttempts);
    setStudentLookupResults(filterMatchedForQuery(combinedImmediate, StorageService.getExams(), cleanQuery, immediateStudent));

    // Sinkronkan katalog ujian, data siswa, attempt server, & Google Sheets di latar belakang
    setIsSyncingLookup(true);
    try {
      await performFullStudentSync();

      const refreshedRoster = getLatestStudentsList();
      const refreshedStudent = resolveStudentMatch(cleanQuery, refreshedRoster);
      setScoreLookupMatchedStudent(refreshedStudent);

      const serverList = await GasClient.fetchStudentAttemptsFromServer(
        refreshedStudent?.studentNo || cleanQuery,
        refreshedStudent?.fullName || cleanQuery
      );
      if (serverList.length > 0) {
        setServerStudentAttempts(prev => mergeSubmissionsSources(prev, serverList));
      }

      const freshExams = StorageService.getExams();
      setLiveExams(freshExams);

      const latestCombined = mergeSubmissionsSources(
        StorageService.getSubmissions(),
        mergeSubmissionsSources(serverStudentAttempts, serverList)
      );
      setStudentLookupResults(filterMatchedForQuery(latestCombined, freshExams, cleanQuery, refreshedStudent));
    } finally {
      setIsSyncingLookup(false);
    }
  }, [getLatestStudentsList, performFullStudentSync, serverStudentAttempts]);

  // Filter exams available today
  const todayStr = getLocalDateInputValue();
  const activeExams = liveExams.filter(e => e.status !== 'archived' && e.status !== 'draft');

  // Auto-select exam if directed via shared student link
  const initialHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialExamId && !isExamActive && initialHandledRef.current !== initialExamId) {
      initialHandledRef.current = initialExamId;
      const cleanTarget = String(initialExamId).trim().toLowerCase();

      const openTargetIfAllowed = (candidate: Exam) => {
        const normalized = StorageService.normalizeExamRecord(candidate);
        setSelectedExam(normalized);
        const qs = StorageService.getQuestionsByExamId(normalized.id);
        setExamQuestions(qs);
        if (initialToken) {
          setExamToken(initialToken);
        } else if (normalized.token) {
          setExamToken(normalized.token);
        }

        if (StorageService.isExamStopped(normalized)) {
          setServerStoppedNotice(`Sesi ujian "${normalized.title}" telah DIHENTIKAN PERMANEN oleh guru pengawas.`);
          return;
        }
        if (!StorageService.isExamSessionOpen(normalized)) {
          setServerStoppedNotice(`Ujian "${normalized.title}" belum dimulai oleh guru pengawas. Tunggu hingga guru menekan tombol "Mulai Sesi Ujian".`);
          return;
        }
        setIsLoginModalOpen(true);

        if (normalized.totalQuestions && qs.length < normalized.totalQuestions) {
          setIsDownloadingQuestions(true);
          GasClient.fetchAllFromSheets().then(() => {
            setIsDownloadingQuestions(false);
            const updated = StorageService.getQuestionsByExamId(normalized.id);
            if (updated.length > 0) setExamQuestions(updated);
          }).catch(() => {
            setIsDownloadingQuestions(false);
          });
        }
      };

      const target = liveExams.find(e => String(e.id).trim().toLowerCase() === cleanTarget);
      if (target) {
        GasClient.fetchExamControlsFromServer().then((controls) => {
          if (controls && Object.keys(controls).length > 0) {
            applyServerControls(controls);
          }
          const latest = StorageService.getExamById(target.id) || target;
          openTargetIfAllowed(latest);
        }).catch(() => {
          openTargetIfAllowed(target);
        });
      } else {
        setIsDownloadingQuestions(true);
        GasClient.fetchAllFromSheets().then(() => {
          setIsDownloadingQuestions(false);
          const freshExams = StorageService.getExams();
          setLiveExams(freshExams);
          const found = freshExams.find(e => String(e.id).trim().toLowerCase() === cleanTarget);
          if (found) {
            openTargetIfAllowed(found);
          }
        }).catch(() => {
          setIsDownloadingQuestions(false);
        });
      }
    }
  }, [initialExamId, initialToken, liveExams, isExamActive, applyServerControls]);

  // Handle student roster auto-fill
  useEffect(() => {
    if (studentNo.trim()) {
      const roster = getLatestStudentsList();
      const qNum = normalizeNumericStr(studentNo);
      const found = roster.find(s => {
        const sNo = normalizeNumericStr(s.studentNo);
        const sNis = normalizeNumericStr(s.nis);
        const sNisn = normalizeNumericStr(s.nisn);
        return Boolean(qNum && ((sNo && sNo === qNum) || (sNis && sNis === qNum) || (sNisn && sNisn === qNum)));
      });
      if (found) {
        setStudentName(found.fullName);
        setStudentClass(found.classGrade);
      }
    }
  }, [studentNo, getLatestStudentsList]);

  // Exam Countdown Timer
  useEffect(() => {
    if (!isExamActive || timeRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      // Cek apakah guru menghentikan sesi ujian secara langsung
      if (selectedExam) {
        const latestExam = StorageService.getExamById(selectedExam.id);
        if (latestExam && StorageService.isExamStopped(latestExam)) {
          clearInterval(timer);
          setIsExamActive(false);
          setServerStoppedNotice(`Pemberitahuan Pengawas: Sesi ujian "${latestExam.title}" telah DIHENTIKAN PERMANEN oleh guru pengawas. Pengerjaan telah ditutup oleh server.`);
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

  const handleStartExamClick = async (exam: Exam) => {
    // Sinkronkan status kontrol sesi terbaru dari server sebelum membuka modal verifikasi
    const controls = await GasClient.fetchExamControlsFromServer();
    if (controls && Object.keys(controls).length > 0) {
      applyServerControls(controls);
    }

    const freshExam = StorageService.normalizeExamRecord(StorageService.getExamById(exam.id) || exam);

    if (StorageService.isExamStopped(freshExam)) {
      setServerStoppedNotice(`Sesi ujian "${freshExam.title}" telah DIHENTIKAN SECARA PERMANEN oleh guru pengawas. Akses soal ditutup hingga guru menekan tombol "Lanjutkan".`);
      return;
    }

    if (freshExam.sessionStatus === 'ended') {
      setServerStoppedNotice(`Sesi ujian "${freshExam.title}" telah ditutup oleh guru pengawas.`);
      return;
    }

    if (!StorageService.isExamSessionOpen(freshExam)) {
      setServerStoppedNotice(`Ujian "${freshExam.title}" belum dimulai oleh guru pengawas. Silakan tunggu hingga guru menekan tombol "Mulai Sesi Ujian".`);
      return;
    }

    setSelectedExam(freshExam);
    const qs = StorageService.getQuestionsByExamId(freshExam.id);
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

  const handlePortalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPortalLoginError(null);
    const cleanNo = studentNo.trim();
    const cleanName = studentName.trim();
    const cleanClass = studentClass.trim();

    if (!cleanNo) {
      setPortalLoginError('Nomor Induk Siswa (NIS / NISN) wajib diisi.');
      return;
    }
    if (!cleanName) {
      setPortalLoginError('Nama lengkap siswa wajib diisi.');
      return;
    }

    setIsPortalLoggingIn(true);
    try {
      await performFullStudentSync();

      const roster = getLatestStudentsList();
      const qNum = normalizeNumericStr(cleanNo);
      const matchedRoster = roster.find(s => {
        const sNo = normalizeNumericStr(s.studentNo);
        const sNis = normalizeNumericStr(s.nis);
        const sNisn = normalizeNumericStr(s.nisn);
        return Boolean(qNum && ((sNo && sNo === qNum) || (sNis && sNis === qNum) || (sNisn && sNisn === qNum)));
      });

      const finalNo = cleanNo;
      const finalName = matchedRoster?.fullName ? matchedRoster.fullName : cleanName;
      const finalClass = cleanClass || matchedRoster?.classGrade || '';

      setStudentNo(finalNo);
      setStudentName(finalName);
      if (finalClass) setStudentClass(finalClass);

      persistStudentIdentity(finalNo, finalName, finalClass);

      const attempts = await GasClient.fetchStudentAttemptsFromServer(finalNo, finalName);
      if (Array.isArray(attempts)) {
        setServerStudentAttempts(prev => mergeSubmissionsSources(prev, attempts));
      }

      setSubmissionVersion(v => v + 1);
      setIsPortalLoggedIn(true);
    } catch {
      persistStudentIdentity(cleanNo, cleanName, cleanClass);
      setIsPortalLoggedIn(true);
    } finally {
      setIsPortalLoggingIn(false);
    }
  };

  const handlePortalLogout = () => {
    setIsPortalLoggedIn(false);
    setStudentNo('');
    setStudentName('');
    setStudentClass('');
    setPortalLoginError(null);
    setServerStudentAttempts([]);
    setPortalFilter('all');
    setSelectedSubjectFilter('all');
    setCollapsedSubjectClusters({});
    try {
      localStorage.removeItem('examflow_student_identity');
    } catch {}
  };

  const handleConfirmLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNo = studentNo.trim();
    const cleanName = studentName.trim();

    if (!cleanNo) {
      setLoginError('Nomor Induk Siswa (NIS) wajib diisi.');
      return;
    }
    if (!cleanName) {
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

    persistStudentIdentity(cleanNo, cleanName, studentClass);
    setIsPortalLoggedIn(true);

    // Tarik status kontrol sesi terbaru dari server lokal (dan Sheets jika terhubung)
    const controls = await GasClient.fetchExamControlsFromServer();
    if (controls && Object.keys(controls).length > 0) {
      applyServerControls(controls);
    }

    const freshExam = StorageService.normalizeExamRecord(StorageService.getExamById(selectedExam.id) || selectedExam);
    setSelectedExam(freshExam);

    // 1. Verifikasi Status Henti Permanen (Hentikan Ujian)
    if (StorageService.isExamStopped(freshExam)) {
      setLoginError('Sesi ujian ini telah DIHENTIKAN PERMANEN oleh guru pengawas. Akses pengerjaan telah ditutup hingga sesi dibuka kembali oleh guru dengan tombol "Lanjutkan".');
      return;
    }

    // 1b. Cek apakah guru telah menutup sesi ujian secara manual
    if (freshExam.sessionStatus === 'ended') {
      setLoginError('Sesi ujian ini telah ditutup oleh pengawas ruangan.');
      return;
    }

    // 1c. WAJIB DIMULAI OLEH GURU: Siswa tidak boleh memulai jika guru belum menekan "Mulai Sesi Ujian"
    // (Kecuali guru secara eksplisit mengaktifkan toleransi terlambat / late submission)
    if (!StorageService.isExamSessionOpen(freshExam)) {
      const formattedStart = freshExam.startsAt
        ? ` (Jadwal: ${freshExam.startsAt})`
        : '';
      setLoginError(`Ujian ini BELUM DIMULAI oleh guru pengawas${formattedStart}. Mohon tunggu hingga guru menekan tombol "Mulai Sesi Ujian" di Portal Guru.`);
      return;
    }

    // 1d. Cek jadwal mulai di masa depan jika tidak sedang dalam mode toleransi terlambat & tidak dimulai manual
    const isLateAllowed = Boolean(freshExam.allowLateSubmission) || (Number(freshExam.lateExtensionMinutes) || 0) > 0;
    if (freshExam.sessionStatus !== 'active' && !isLateAllowed && freshExam.startsAt) {
      const startTime = new Date(freshExam.startsAt.replace(' ', 'T')).getTime();
      if (!isNaN(startTime) && Date.now() < startTime) {
        setLoginError(`Ujian ini TERJADWAL dan belum dibuka. Silakan tunggu instruksi pengawas.`);
        return;
      }
    }

    // 2. Verifikasi Mode Pengerjaan ("Sekali (1x)" vs "Berulang")
    const isSingleAttempt = freshExam.attemptMode !== 'unlimited';
    if (!isSingleAttempt) {
      // Mode "Berulang" (Bisa Mengulang): Siswa dapat mengerjakan ujian berkali-kali
      setUserAnswers({});
      setFlaggedQuestions({});
      setLoginError(null);
    } else {
      // Mode "Sekali Pengerjaan (1x)": Verifikasi ketat lokal + server + Google Sheets
      const singleBlockedMessage =
        `Ujian ini diatur dalam mode "Sekali (1x Pengerjaan)" dan siswa atas nama "${cleanName}" (${cleanNo}) telah tercatat menyelesaikan sesi ujian sebelumnya. Akses telah ditutup oleh server. Hubungi guru pengawas untuk mereset nilai dengan status "Mengulang Ujian" atau menghapus nilai lama jika perlu mengulang.`;

      const isExplicitRepeatSubmission = (sub: Submission) => {
        const rawNote = String(sub.statusNote || '').toLowerCase();
        return (
          sub.allowRepeat === true ||
          String(sub.allowRepeat).toLowerCase() === 'true' ||
          String(sub.allowRepeat) === '1' ||
          rawNote.includes('ulang') ||
          rawNote.includes('reset') ||
          rawNote.includes('retake')
        );
      };

      const matchesIdentity = (sub: Submission) => {
        const subNo = String(sub.studentNo || '').trim().toLowerCase();
        const subName = String(sub.studentName || '').trim().toLowerCase();
        return (
          (cleanNo && subNo === cleanNo.toLowerCase()) ||
          (cleanName && subName === cleanName.toLowerCase())
        );
      };

      const hasDirectPermission = StorageService.hasRetakePermission(freshExam.id, cleanNo, cleanName);
      const isFreshExamOpen = StorageService.isExamSessionOpen(freshExam);
      if (isFreshExamOpen) {
        StorageService.clearAutoZeroSubmissionsForExam(freshExam.id);
      }

      // Cek rekaman attempt pada server Express (/api/exam-attempts/check)
      const serverAttempt = await GasClient.checkAttemptOnServer(freshExam.id, cleanNo, cleanName);
      if (serverAttempt.success && serverAttempt.hasCompleted && !serverAttempt.allowRepeat && !hasDirectPermission) {
        setLoginError(singleBlockedMessage);
        return;
      }

      // Selalu sinkronkan dengan Google Sheets jika GAS Web App aktif (agar cross-browser / device baru tetap terdeteksi!)
      const gasUrl = StorageService.getSettings().gasWebAppUrl;
      if (gasUrl && gasUrl.trim().startsWith('http')) {
        try {
          await GasClient.fetchAllFromSheets();
        } catch {}
      }

      const allSubmissions = StorageService.getSubmissions();
      const studentPastSubs = allSubmissions.filter(
        sub =>
          String(sub.examId).trim().toLowerCase() === String(freshExam.id).trim().toLowerCase() &&
          matchesIdentity(sub) &&
          !(isFreshExamOpen && StorageService.isAutoZeroSubmission(sub))
      );

      const hasRepeatFlag = studentPastSubs.some(isExplicitRepeatSubmission);
      const hasCompletedLocally = studentPastSubs.some(sub => !isExplicitRepeatSubmission(sub));

      if (hasDirectPermission || hasRepeatFlag) {
        // Guru secara eksplisit memberi izin mengulang ujian -> bersihkan placeholder lama dan izinkan masuk 1x lagi
        studentPastSubs.forEach(s => {
          StorageService.deleteSubmission(s.id);
        });
        StorageService.consumeRetakePermission(freshExam.id, cleanNo, cleanName);
        await GasClient.resetAttemptOnServer({
          examId: freshExam.id,
          studentNo: cleanNo,
          studentName: cleanName
        });
        setUserAnswers({});
        setFlaggedQuestions({});
        setLoginError(null);
      } else if (hasCompletedLocally || (serverAttempt.success && serverAttempt.hasCompleted)) {
        setLoginError(singleBlockedMessage);
        return;
      }
    }

    // Pastikan seluruh butir soal ujian telah termuat sebelum memulai
    let qs = StorageService.getQuestionsByExamId(freshExam.id);
    if (qs.length === 0) {
      const allQs = StorageService.getQuestions();
      qs = allQs.filter(q => String(q.examId).trim().toLowerCase() === String(freshExam.id).trim().toLowerCase());
    }

    const expectedCount = freshExam.totalQuestions || 0;
    const isUnderloaded = expectedCount > 0 && qs.length < expectedCount;

    if (qs.length === 0 || isUnderloaded) {
      setLoginError(`Mengunduh seluruh butir soal (${expectedCount > 0 ? expectedCount : 'lengkap'} butir soal) dari server Google Sheets...`);
      setIsDownloadingQuestions(true);
      try {
        await GasClient.fetchAllFromSheets();
        setIsDownloadingQuestions(false);
        const downloaded = StorageService.getQuestionsByExamId(freshExam.id);
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
      } else if (q.type === 'matching' || q.type === 'short_answer') {
        if (AnalysisService.isAnswerCorrect(q, ans)) {
          totalScore += points;
        }
      } else if (q.type === 'essay') {
        // Essay defaults to 80% if meaningful answer or teacher review
        if (ans && typeof ans === 'string' && ans.trim().length > 10) {
          totalScore += Math.round(points * 0.8);
        }
      }
    });

    totalScore = Math.round(totalScore);
    maxScore = Math.max(1, Math.round(maxScore));
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
      subject: selectedExam.subject || '',
      examTitle: selectedExam.title,
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
      submittedAt: toLocalIsoString(),
      tabSwitchCount,
      timeSpentSeconds: timeSpent,
      syncStatus: 'pending',
      feedback: passed ? 'Selamat, Anda telah melampaui kriteria ketuntasan!' : 'Belum mencapai batas kelulusan. Pelajari kembali materi ini.'
    };

    persistStudentIdentity(studentNo, studentName, studentClass);

    // Send to Google Apps Script / Local storage & Server Attempt Lock
    await GasClient.submitAnswer(submission);
    setServerStudentAttempts(prev => mergeSubmissionsSources(prev, [submission]));
    setSubmissionVersion(v => v + 1);
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
      <div key="student-view-results" className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
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
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Review Lembar Jawaban & Pembahasan Soal
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pelajari kembali butir soal, analisis jawaban Anda, serta panduan pembahasan materi berikut ini.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-full border border-emerald-200 dark:border-emerald-800">
                    {examQuestions.filter(q => isQuestionAnswered(q.id, completedSubmission.answers || {})).length}/{examQuestions.length} Terjawab
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {examQuestions.map((q, idx) => {
                  const studentAns = completedSubmission.answers ? completedSubmission.answers[q.id] : undefined;
                  const safeOpts = normalizeQuestionOptions(q.options);
                  
                  let isCorrect = false;
                  let studentAnswerText = '-';

                  if (q.type === 'multiple_choice') {
                    isCorrect = studentAns === q.correctKey;
                    const sOpt = safeOpts.find(o => o.id === studentAns);
                    studentAnswerText = sOpt ? sOpt.text : (studentAns ? String(studentAns) : 'Tidak dijawab');
                  } else if (q.type === 'checkbox') {
                    const cKeys = Array.isArray(q.correctKey) ? q.correctKey : [q.correctKey];
                    const sList = Array.isArray(studentAns) ? studentAns : [];
                    isCorrect = cKeys.length === sList.length && cKeys.every(k => sList.includes(k));
                    studentAnswerText = sList.length > 0 
                      ? safeOpts.filter(o => sList.includes(o.id)).map(o => o.text).join(', ')
                      : 'Tidak dijawab';
                  } else if (q.type === 'matching') {
                    isCorrect = AnalysisService.isAnswerCorrect(q, studentAns);
                    const pairs = q.matchingPairs || [];
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
                  } else if (q.type === 'short_answer') {
                    studentAnswerText = typeof studentAns === 'string' && studentAns.trim() ? studentAns : 'Tidak dijawab';
                    isCorrect = AnalysisService.isAnswerCorrect(q, studentAns);
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
                            {q.type === 'multiple_choice' ? 'Pilihan Ganda' : q.type === 'checkbox' ? 'Pilihan Ganda Kompleks' : q.type === 'matching' ? 'Menjodohkan / Mencocokkan' : q.type === 'short_answer' ? 'Isian Pendek / Singkat' : 'Uraian / Esai'}
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

                      {/* Jawaban Siswa & Panduan Mandiri (Kunci jawaban hanya terlihat oleh Guru) */}
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
                              Evaluasi & Panduan Belajar Mandiri:
                            </span>
                            <div className={`text-[11.5px] leading-relaxed font-medium ${
                              isCorrect
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-300'
                            }`}>
                              {isCorrect
                                ? '✓ Jawaban Anda sudah tepat. Pelajari kembali penjelasan konsep di bawah untuk memperkuat pemahaman.'
                                : '✗ Jawaban Anda belum tepat. Ikuti langkah analisis, ciri-ciri, atau rumus pada pembahasan di bawah untuk menemukan jawaban yang benar secara mandiri.'}
                            </div>
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
    const answeredCount = answeredQuestionsCount;

    return (
      <div key="student-view-active-exam" className="min-h-screen pb-16 bg-slate-100 dark:bg-slate-950 transition-colors">
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

                {currentQ.type === 'short_answer' && (() => {
                  const canModify = canModifyQuestion(currentQ.id);
                  return (
                    <div className="space-y-2 p-4 rounded-xl bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-200/80 dark:border-cyan-900/50">
                      <label className="text-xs font-semibold text-cyan-900 dark:text-cyan-200 block">
                        Ketik Jawaban Singkat Anda (1 kata, istilah, atau angka hasil akhir):
                      </label>
                      <input
                        type="text"
                        readOnly={!canModify.allowed}
                        value={(userAnswers[currentQ.id] as string) || ''}
                        onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                        placeholder={canModify.allowed ? "Tulis jawaban singkat Anda di sini..." : "Jawaban terkunci sesuai aturan ujian."}
                        className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${
                          !canModify.allowed ? 'opacity-80 cursor-not-allowed' : ''
                        }`}
                      />
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Bentuk soal Isian Pendek (koreksi otomatis tidak peka huruf besar/kecil).</span>
                        <span className="font-mono">{((userAnswers[currentQ.id] as string) || '').length} karakter</span>
                      </div>
                    </div>
                  );
                })()}

                {currentQ.type === 'essay' && (() => {
                  const canModify = canModifyQuestion(currentQ.id);
                  return (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                        Tuliskan jawaban uraian lengkap Anda pada kotak di bawah ini:
                      </label>
                      <textarea
                        rows={6}
                        readOnly={!canModify.allowed}
                        value={(userAnswers[currentQ.id] as string) || ''}
                        onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                        placeholder={canModify.allowed ? "Ketik penjelasan atau uraian lengkap di sini..." : "Jawaban terkunci sesuai aturan ujian."}
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
                  } else if (currentQ.type === 'matching' || currentQ.type === 'short_answer') {
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
                          {currentQ.type !== 'essay' && !isCorrect && (
                            <div className="p-2.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-[11px] text-rose-800 dark:text-rose-200 leading-relaxed">
                              <strong>Mengapa jawaban Anda belum tepat?</strong> Pelajari analisis ciri-ciri, konsep, dan langkah penyelesaian berikut untuk meninjau ulang jawaban Anda secara mandiri (kunci jawaban tidak ditampilkan langsung):
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-indigo-900 dark:text-indigo-300 block mb-1">
                              💡 Penjelasan & Panduan Analisis Konsep:
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
                            setServerStoppedNotice('Soal belum ditemukan di Google Sheets. Hubungi pengawas ujian untuk memastikan ujian sudah disinkronkan.');
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
    <div key="student-view-landing" className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-fadeIn">
      {/* Notice Banner / Modal untuk Status Henti Permanen atau Belum Dimulai */}
      {serverStoppedNotice && (
        <div className="bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3 shadow-md animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
              <StopCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                Pemberitahuan Kontrol Pengawas Ujian
              </h3>
              <p className="text-xs text-rose-800 dark:text-rose-200 mt-1 leading-relaxed">
                {serverStoppedNotice}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setServerStoppedNotice(null)}
            className="p-1.5 text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shrink-0 cursor-pointer"
            title="Tutup pemberitahuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isPortalLoggedIn ? (
        /* STUDENT PORTAL LOGIN SCREEN (Before Today's Schedule) */
        <div key="portal-login-gate" className="max-w-md mx-auto py-4 sm:py-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
            <div className="text-center pb-5 mb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-center gap-3 mb-3">
                <img
                  src={sanitizeLogoUrl(profile.regionalGovLogoUrl, PEMKOT_MALANG_LOGO_SVG)}
                  alt="Logo Pemda"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700"
                />
                <img
                  src={sanitizeLogoUrl(profile.logoUrl, SDN_PISANGCANDI_1_LOGO_SVG)}
                  alt={profile.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {profile.name || 'SDN PISANGCANDI 1'}
              </h4>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                Login Peserta Ujian
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Masuk terlebih dahulu untuk melihat Jadwal Ujian Tersedia Hari Ini sesuai status pengerjaan dan nilai ujian Anda.
              </p>
            </div>

            {portalLoginError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                {portalLoginError}
              </div>
            )}

            <form onSubmit={handlePortalLogin} className="space-y-4">
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
                      setPortalLoginError(null);
                      const roster = getLatestStudentsList();
                      const qNum = normalizeNumericStr(val);
                      const found = roster.find(s => {
                        const sNo = normalizeNumericStr(s.studentNo);
                        const sNis = normalizeNumericStr(s.nis);
                        const sNisn = normalizeNumericStr(s.nisn);
                        return Boolean(qNum && ((sNo && sNo === qNum) || (sNis && sNis === qNum) || (sNisn && sNisn === qNum)));
                      });
                      if (found) {
                        setStudentName(found.fullName);
                        if (found.classGrade) setStudentClass(found.classGrade);
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Masukkan NIS / NISN terdaftar agar nama & kelas terisi otomatis.
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
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    setPortalLoginError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kelas / Rombel
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kelas 4A"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  disabled={isPortalLoggingIn}
                  className="w-full py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isPortalLoggingIn ? (
                    <span key="login-busy" className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyinkronkan Jadwal & Nilai...</span>
                    </span>
                  ) : (
                    <span key="login-idle" className="inline-flex items-center gap-2">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Masuk & Lihat Jadwal Ujian</span>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isRefreshingSchedule}
                  onClick={async () => {
                    setIsRefreshingSchedule(true);
                    try {
                      await performFullStudentSync();
                    } finally {
                      setIsRefreshingSchedule(false);
                    }
                  }}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSchedule ? 'animate-spin' : ''}`} />
                  {isRefreshingSchedule ? (
                    <span key="sync-busy">Menyegarkan Data...</span>
                  ) : (
                    <span key="sync-idle">Sinkronkan Data Siswa & Ujian Terbaru</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
      <div key="portal-schedule-view" className="space-y-8">
      {/* School Kop & Branding Banner */}
      {uiPreset === 'academic_compact' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl px-5 py-4 border border-stone-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={sanitizeLogoUrl(profile.regionalGovLogoUrl, PEMKOT_MALANG_LOGO_SVG)}
              alt="Logo Pemda"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-lg object-contain bg-slate-50 dark:bg-slate-800 p-1 border border-stone-200 dark:border-slate-700 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 truncate">
                {profile.regionalGovName || 'PEMERINTAH KOTA MALANG'} · {profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}
              </div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                {profile.name || 'SDN PISANGCANDI 1'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {profile.address} · NPSN: {profile.npsn} · TP {profile.academicYear} ({profile.semester})
              </p>
            </div>
          </div>
          <img
            src={sanitizeLogoUrl(profile.logoUrl, SDN_PISANGCANDI_1_LOGO_SVG)}
            alt={profile.name}
            referrerPolicy="no-referrer"
            className="hidden sm:block w-11 h-11 rounded-lg object-contain bg-slate-50 dark:bg-slate-800 p-1 border border-stone-200 dark:border-slate-700 shrink-0"
          />
        </div>
      ) : (
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 rounded-2xl p-6 sm:p-7 text-white shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-5 text-center sm:text-left">
            {/* Logo Pemda (Kiri) */}
            <img
              src={sanitizeLogoUrl(profile.regionalGovLogoUrl, PEMKOT_MALANG_LOGO_SVG)}
              alt="Logo Pemda"
              referrerPolicy="no-referrer"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain bg-white p-1.5 border border-white/20 shadow-sm shrink-0"
            />

            <div className="flex-1 space-y-1">
              <div className="text-[11px] uppercase font-bold tracking-widest text-indigo-200">
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
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain bg-white p-1.5 border border-white/20 shadow-sm shrink-0"
            />
          </div>
        </div>
      )}

      {/* Today's Schedule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Jadwal Ujian Tersedia Hari Ini</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar ujian dan nilai ditampilkan sesuai hasil pengerjaan <strong>{studentName || 'Siswa'}</strong> ({studentNo || '-'}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {(studentNo.trim() || studentName.trim()) && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {studentName || 'Siswa'} ({studentNo || '-'}){studentClass ? ` · ${studentClass}` : ''}
              </span>
              <button
                type="button"
                onClick={handlePortalLogout}
                className="ml-1 px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 text-[11px] font-bold border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                title="Keluar dan ganti peserta ujian"
              >
                Ganti Siswa
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={isRefreshingSchedule}
            onClick={async () => {
              setIsRefreshingSchedule(true);
              try {
                await performFullStudentSync();
              } finally {
                setIsRefreshingSchedule(false);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer disabled:opacity-60"
            title="Periksa ulang status ujian dan katalog ujian terbaru dari guru pengawas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSchedule ? 'animate-spin' : ''}`} />
            {isRefreshingSchedule ? (
              <span key="hdr-sync-busy">Menyegarkan...</span>
            ) : (
              <span key="hdr-sync-idle">Segarkan Jadwal</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              const autoQuery = studentNo.trim() || studentName.trim();
              triggerLookup(autoQuery, 'all');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Cek Nilai Saya</span>
          </button>

          <div className="h-8 inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 rounded-lg border border-slate-200 dark:border-slate-700">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Exam Cards Grid */}
      {activeExams.length > 0 ? (() => {
        const cleanCurrentNo = normalizeNumericStr(studentNo);
        const cleanCurrentName = studentName.trim().toLowerCase().replace(/\s+/g, ' ');
        const matchedRosterStudent = getLatestStudentsList().find(s => {
          const sNo = normalizeNumericStr(s.studentNo);
          const sNis = normalizeNumericStr(s.nis);
          const sNisn = normalizeNumericStr(s.nisn);
          const sName = String(s.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
          return (
            (Boolean(cleanCurrentNo) && ((sNo && sNo === cleanCurrentNo) || (sNis && sNis === cleanCurrentNo) || (sNisn && sNisn === cleanCurrentNo))) ||
            (Boolean(cleanCurrentName) && sName === cleanCurrentName)
          );
        });
        const rosterNo = normalizeNumericStr(matchedRosterStudent?.studentNo);
        const rosterNis = normalizeNumericStr(matchedRosterStudent?.nis);
        const rosterNisn = normalizeNumericStr(matchedRosterStudent?.nisn);
        const rosterName = String(matchedRosterStudent?.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');

        const combinedDeviceSubs = mergeSubmissionsSources(StorageService.getSubmissions(), serverStudentAttempts);
        const currentStudentSubs = (cleanCurrentNo || cleanCurrentName)
          ? combinedDeviceSubs.filter(s => {
              const sNo = normalizeNumericStr(s.studentNo);
              const sName = String(s.studentName || '').trim().toLowerCase().replace(/\s+/g, ' ');
              return (
                (Boolean(cleanCurrentNo) && sNo === cleanCurrentNo) ||
                (Boolean(cleanCurrentName) && sName === cleanCurrentName) ||
                (Boolean(rosterNo) && sNo === rosterNo) ||
                (Boolean(rosterNis) && sNo === rosterNis) ||
                (Boolean(rosterNisn) && sNo === rosterNisn) ||
                (Boolean(rosterName) && sName === rosterName)
              );
            })
          : [];

        const examCardsData = activeExams
          .map(exam => {
            const validStudentSubs = currentStudentSubs.filter(s => !isStaleAutoZeroForOpenExam(s, [exam]));
            const matchedSub = validStudentSubs.find(s => matchSubToExam(s, exam));
            const isStudentCompleted = Boolean(matchedSub && !isResetSubmissionEntry(matchedSub));
            const isStudentNeedsRetake = Boolean(matchedSub && isResetSubmissionEntry(matchedSub));
            const isOpenNow = StorageService.isExamSessionOpen(exam);
            return { exam, matchedSub, isStudentCompleted, isStudentNeedsRetake, isOpenNow };
          })
          .sort((a, b) => {
            // Prioritaskan ujian terbuka & belum dikerjakan di urutan paling atas
            const scoreA = (a.isOpenNow ? 2 : 0) + (!a.isStudentCompleted ? 1 : 0);
            const scoreB = (b.isOpenNow ? 2 : 0) + (!b.isStudentCompleted ? 1 : 0);
            return scoreB - scoreA;
          });

        const availableSubjects = Array.from(
          new Set(examCardsData.map(item => String(item.exam.subject || 'Umum').trim() || 'Umum'))
        ).sort((a, b) => a.localeCompare(b, 'id'));
        const effectiveSubjectFilter =
          selectedSubjectFilter !== 'all' && availableSubjects.some(s => s.toLowerCase() === selectedSubjectFilter.toLowerCase())
            ? selectedSubjectFilter
            : 'all';

        const pendingCardsCount = examCardsData.filter(item => !item.isStudentCompleted).length;
        const completedCardsCount = examCardsData.filter(item => item.isStudentCompleted).length;
        const visibleExamCards = examCardsData.filter(item => {
          if (portalFilter === 'pending' && item.isStudentCompleted) return false;
          if (portalFilter === 'completed' && !item.isStudentCompleted) return false;
          if (effectiveSubjectFilter !== 'all') {
            const subj = (String(item.exam.subject || 'Umum').trim() || 'Umum').toLowerCase();
            if (subj !== effectiveSubjectFilter.toLowerCase()) return false;
          }
          return true;
        });

        const clusterMap = new Map<string, { key: string; subject: string; items: typeof visibleExamCards }>();
        visibleExamCards.forEach(item => {
          const rawSubj = String(item.exam.subject || 'Umum').trim() || 'Umum';
          const subjKey = rawSubj.toLowerCase();
          const existing = clusterMap.get(subjKey);
          if (existing) {
            existing.items.push(item);
          } else {
            clusterMap.set(subjKey, { key: subjKey, subject: rawSubj, items: [item] });
          }
        });
        const subjectClusters = Array.from(clusterMap.values()).sort((a, b) => {
          const aHasOpenPending = a.items.some(i => i.isOpenNow && !i.isStudentCompleted) ? 1 : 0;
          const bHasOpenPending = b.items.some(i => i.isOpenNow && !i.isStudentCompleted) ? 1 : 0;
          if (aHasOpenPending !== bHasOpenPending) return bHasOpenPending - aHasOpenPending;
          const aHasPending = a.items.some(i => !i.isStudentCompleted) ? 1 : 0;
          const bHasPending = b.items.some(i => !i.isStudentCompleted) ? 1 : 0;
          if (aHasPending !== bHasPending) return bHasPending - aHasPending;
          return a.subject.localeCompare(b.subject, 'id');
        });

        const renderExamItem = ({
          exam,
          matchedSub,
          isStudentCompleted,
          isStudentNeedsRetake
        }: (typeof visibleExamCards)[number]) => {
          const isStopped = StorageService.isExamStopped(exam);
          const isLate = Boolean(exam.allowLateSubmission) || (Number(exam.lateExtensionMinutes) || 0) > 0;
          const isSessionActive = exam.sessionStatus === 'active';
          const isAutoZero = Boolean(
            matchedSub &&
            (String(matchedSub.id || '').startsWith('SUB-STOP0-') ||
              String(matchedSub.statusNote || '').toLowerCase().includes('dihentikan'))
          );

          const renderSessionPill = () => {
            if (isStopped) {
              return (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                  <StopCircle className="w-3 h-3 text-rose-500" />
                  <span>Dihentikan Permanen</span>
                </span>
              );
            }
            if (exam.sessionStatus === 'ended') {
              return (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1">
                  <StopCircle className="w-3 h-3 text-slate-500" />
                  <span>Sesi Ditutup</span>
                </span>
              );
            }
            if (isLate) {
              return (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Toleransi (+{exam.lateExtensionMinutes || 30}m)</span>
                </span>
              );
            }
            if (!isSessionActive) {
              return (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>Menunggu Dimulai</span>
                </span>
              );
            }
            return (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Sesi Aktif</span>
              </span>
            );
          };

          const renderActionBtn = (compactWidth = false) => {
            const widthClass = compactWidth ? 'w-full sm:w-auto sm:min-w-[210px]' : 'w-full';
            if (isStudentCompleted && exam.attemptMode !== 'unlimited') {
              const roundedPct = Math.round(Number(matchedSub?.percentage) || 0);
              return (
                <button
                  type="button"
                  onClick={() => {
                    const query = studentNo.trim() || studentName.trim();
                    triggerLookup(query, 'all');
                  }}
                  className={`${widthClass} py-2.5 px-4 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    isAutoZero
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isAutoZero ? <StopCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>
                    {isAutoZero
                      ? `Dihentikan (Nilai: ${roundedPct}%) · Lihat Rincian`
                      : `Sudah Dikerjakan${matchedSub ? ` (Nilai: ${roundedPct}%)` : ''} · Lihat Hasil`}
                  </span>
                </button>
              );
            }

            if (isStopped) {
              return (
                <button
                  type="button"
                  disabled
                  className={`${widthClass} py-2.5 px-4 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  <StopCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Sesi Dihentikan Pengawas</span>
                </button>
              );
            }

            if (exam.sessionStatus === 'ended') {
              return (
                <button
                  type="button"
                  disabled
                  className={`${widthClass} py-2.5 px-4 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>Sesi Ujian Telah Ditutup</span>
                </button>
              );
            }

            if (isLate) {
              return (
                <button
                  type="button"
                  onClick={() => handleStartExamClick(exam)}
                  className={`${widthClass} py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer`}
                  title="Toleransi keterlambatan aktif oleh guru pengawas"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Lanjutkan (Siswa Terlambat)</span>
                </button>
              );
            }

            if (!isSessionActive) {
              return (
                <button
                  type="button"
                  disabled
                  className={`${widthClass} py-2.5 px-4 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-2`}
                  title="Guru pengawas belum menekan tombol Mulai Sesi Ujian"
                >
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Menunggu Guru Memulai</span>
                </button>
              );
            }

            return (
              <button
                type="button"
                onClick={() => handleStartExamClick(exam)}
                className={`${widthClass} py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer`}
              >
                {isStudentCompleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isStudentCompleted ? 'Kerjakan Ulang Ujian' : 'Mulai Kerjakan Ujian'}</span>
              </button>
            );
          };

          // =========================================================================
          // ALTERNATIF 3: AKADEMIK KOMPAK (Horizontal Split-Row Schedule Item)
          // =========================================================================
          if (uiPreset === 'academic_compact') {
            const roundedPct = Math.round(Number(matchedSub?.percentage) || 0);
            return (
              <div
                key={exam.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-stone-200 dark:border-slate-800 p-4 sm:px-5 hover:border-stone-300 dark:hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      Kelas {exam.grade}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {exam.attemptMode === 'unlimited' ? 'Berulang' : '1x Kesempatan'}
                    </span>
                    {renderSessionPill()}
                    {isStudentCompleted && matchedSub ? (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 ${
                        isAutoZero
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {isAutoZero ? <StopCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span>Sudah Dikerjakan · Nilai: {roundedPct}%</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                        <span>Belum Dikerjakan</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {exam.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{exam.durationMinutes} Menit</span>
                    <span aria-hidden="true">·</span>
                    <span>{exam.totalQuestions} Soal</span>
                    <span aria-hidden="true">·</span>
                    <span>KKM {exam.passingScore}</span>
                    {exam.startsAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                          {new Date(exam.startsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}{' '}
                          {new Date(exam.startsAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {exam.endsAt ? ` - ${new Date(exam.endsAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className={exam.token ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                      {exam.token ? 'Pakai Token' : 'Tanpa Token'}
                    </span>
                    {exam.isStrict && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Mode Ketat</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                  {isStudentNeedsRetake && (
                    <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <RotateCcw className="w-3 h-3" />
                      <span>Diizinkan Mengulang</span>
                    </div>
                  )}
                  {renderActionBtn(true)}
                </div>
              </div>
            );
          }

          // =========================================================================
          // ALTERNATIF 1 & 2: MINIMALIS RAPI / SIDEBAR WORKSPACE (Clean Unboxed Card)
          // =========================================================================
          return (
            <div
              key={exam.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Grade & Session Status */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      Kelas {exam.grade}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{exam.attemptMode === 'unlimited' ? 'Berulang' : '1x Kesempatan'}</span>
                  </div>

                  {renderSessionPill()}
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                    {exam.title}
                  </h3>
                  {profile.teacherName && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">{profile.teacherName}</span>
                    </div>
                  )}
                </div>

                {/* Badge Status Pengerjaan & Nilai Siswa yang Login */}
                {(() => {
                  if (isStudentCompleted && matchedSub) {
                    const roundedPct = Math.round(Number(matchedSub.percentage) || 0);
                    if (isAutoZero) {
                      return (
                        <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                            <StopCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span>Nilai 0 (Dihentikan)</span>
                          </span>
                          <span className="font-mono font-extrabold text-rose-800 dark:text-rose-200">
                            Nilai: {roundedPct}%
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Sudah Dikerjakan</span>
                        </span>
                        <span className="font-mono font-extrabold text-emerald-800 dark:text-emerald-200">
                          Nilai: {roundedPct}%
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="px-3 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/70 flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Belum Dikerjakan</span>
                      </span>
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        {isStudentNeedsRetake ? 'Perlu Ulang' : 'Belum Ada Nilai'}
                      </span>
                    </div>
                  );
                })()}
                {isStudentNeedsRetake && (
                  <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>Diizinkan Mengulang Ujian</span>
                  </div>
                )}

                {/* Unboxed Metadata Line */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 tabular-nums">
                    <span><strong className="text-slate-800 dark:text-slate-200">{exam.durationMinutes}</strong> Menit</span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span><strong className="text-slate-800 dark:text-slate-200">{exam.totalQuestions}</strong> Soal</span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span>KKM <strong className="text-slate-800 dark:text-slate-200">{exam.passingScore}</strong></span>
                  </div>

                  {exam.startsAt && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {new Date(exam.startsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(exam.startsAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        {exam.endsAt ? ` - ${new Date(exam.endsAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] pt-0.5">
                    {exam.token ? (
                      <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                        <Key className="w-3.5 h-3.5 shrink-0" />
                        <span>Memerlukan Token</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Tanpa Token</span>
                      </span>
                    )}
                    {exam.isStrict && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>Deteksi Tab Aktif</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action button */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                {renderActionBtn(false)}
              </div>
            </div>
          );
        };

        return (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setPortalFilter('all')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  portalFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semua Ujian ({examCardsData.length})
              </button>
              <button
                type="button"
                onClick={() => setPortalFilter('pending')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  portalFilter === 'pending'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Belum Dikerjakan ({pendingCardsCount})
              </button>
              <button
                type="button"
                onClick={() => setPortalFilter('completed')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  portalFilter === 'completed'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sudah Dikerjakan ({completedCardsCount})
              </button>
            </div>

            {availableSubjects.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Mata Pelajaran:
                </span>
                <select
                  value={effectiveSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Semua Mapel ({availableSubjects.length})</option>
                  {availableSubjects.map(subj => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {subjectClusters.length > 0 ? (
            <div className="space-y-5">
              {subjectClusters.map(cluster => {
                const isCollapsed = Boolean(collapsedSubjectClusters[cluster.key]);
                const clusterPending = cluster.items.filter(i => !i.isStudentCompleted).length;
                const clusterCompleted = cluster.items.filter(i => i.isStudentCompleted).length;

                return (
                  <section
                    key={`subject-cluster-${cluster.key}`}
                    className={`rounded-2xl border p-4 sm:p-5 space-y-4 transition-colors ${
                      uiPreset === 'academic_compact'
                        ? 'bg-stone-50/70 dark:bg-slate-900/40 border-stone-200 dark:border-slate-800'
                        : 'bg-white/70 dark:bg-slate-900/40 border-slate-200/90 dark:border-slate-800'
                    }`}
                  >
                    {/* Cluster Header per Mata Pelajaran */}
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedSubjectClusters(prev => ({
                          ...prev,
                          [cluster.key]: !prev[cluster.key]
                        }))
                      }
                      className="w-full flex flex-wrap items-center justify-between gap-3 text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {cluster.subject}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {cluster.items.length} Paket Ujian
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                          {clusterPending > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {clusterPending} Belum Dikerjakan
                            </span>
                          )}
                          {clusterCompleted > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {clusterCompleted} Selesai
                            </span>
                          )}
                        </div>
                        <span className="p-1.5 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors">
                          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </span>
                      </div>
                    </button>

                    {!isCollapsed && (
                      <div
                        key={`subject-cluster-body-${cluster.key}`}
                        className={
                          uiPreset === 'academic_compact'
                            ? 'space-y-3 pt-1'
                            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1'
                        }
                      >
                        {cluster.items.map(item => renderExamItem(item))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Tidak ada ujian pada filter ini.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPortalFilter('all');
                  setSelectedSubjectFilter('all');
                }}
                className="mt-3 px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Tampilkan Semua Ujian
              </button>
            </div>
          )}
        </div>
        );
      })() : (
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
                      const roster = getLatestStudentsList();
                      const qNum = normalizeNumericStr(val);
                      const found = roster.find(s => {
                        const sNo = normalizeNumericStr(s.studentNo);
                        const sNis = normalizeNumericStr(s.nis);
                        const sNisn = normalizeNumericStr(s.nisn);
                        return Boolean(qNum && ((sNo && sNo === qNum) || (sNis && sNis === qNum) || (sNisn && sNisn === qNum)));
                      });
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Cek Nilai & Status Ujian Siswa
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Masukkan NIS atau Nama untuk melihat nilai dan ujian yang belum dikerjakan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScoreLookupOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                triggerLookup(scoreLookupNis, scoreLookupTab);
              }}
              className="space-y-4 mb-5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Induk Siswa (NIS) / Nama Lengkap
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
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {isSyncingLookup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>{isSyncingLookup ? 'Menyinkronkan...' : 'Cek Status'}</span>
                  </button>
                </div>
              </div>
            </form>

            {(() => {
              const hasSearched = studentLookupResults !== null;
              const resultsList = studentLookupResults || [];
              const query = scoreLookupNis.trim().toLowerCase();
              const queryNum = normalizeNumericStr(scoreLookupNis);
              const isPureDigits = /^\d+$/.test(scoreLookupNis.trim());
              const allSubs = mergeSubmissionsSources(StorageService.getSubmissions(), serverStudentAttempts);

              const completedExamIds = new Set<string>();
              const completedExamTitlesWithoutId = new Set<string>();
              resultsList.forEach(s => {
                const exId = String(s.examId || '').trim().toLowerCase();
                if (exId) {
                  completedExamIds.add(exId);
                } else {
                  const sTitle = String(s.examTitle || '').trim().toLowerCase();
                  if (sTitle) completedExamTitlesWithoutId.add(sTitle);
                }
              });

              const isExamCompletedByStudent = (exam: Exam) => {
                const exId = String(exam.id || '').trim().toLowerCase();
                if (exId && completedExamIds.has(exId)) return true;
                const exTitle = String(exam.title || '').trim().toLowerCase();
                return Boolean(exTitle && completedExamTitlesWithoutId.has(exTitle));
              };

              const resetExamIds = hasSearched
                ? new Set(
                    allSubs
                      .filter(s => {
                        if (!isResetSubmissionEntry(s)) return false;
                        const sNo = normalizeNumericStr(s.studentNo);
                        const sName = String(s.studentName || '').trim().toLowerCase();
                        if (scoreLookupMatchedStudent) {
                          const tNo = normalizeNumericStr(scoreLookupMatchedStudent.studentNo);
                          const tNis = normalizeNumericStr(scoreLookupMatchedStudent.nis);
                          const tNisn = normalizeNumericStr(scoreLookupMatchedStudent.nisn);
                          const tName = String(scoreLookupMatchedStudent.fullName || '').trim().toLowerCase();
                          return (
                            (Boolean(tNo) && sNo === tNo) ||
                            (Boolean(tNis) && sNo === tNis) ||
                            (Boolean(tNisn) && sNo === tNisn) ||
                            (Boolean(tName) && sName === tName)
                          );
                        }
                        if (isPureDigits) return Boolean(queryNum && sNo === queryNum);
                        return Boolean(query && (sName === query || (query.length >= 3 && sName.includes(query))));
                      })
                      .map(s => String(s.examId || '').trim().toLowerCase())
                      .filter(exId => !completedExamIds.has(exId))
                  )
                : new Set<string>();

              const pendingExams = activeExams
                .filter(exam => !isExamCompletedByStudent(exam))
                .sort((a, b) => {
                  const aOpen = StorageService.isExamSessionOpen(a) ? 1 : 0;
                  const bOpen = StorageService.isExamSessionOpen(b) ? 1 : 0;
                  return bOpen - aOpen;
                });

              const handleStartFromLookup = (exam: Exam) => {
                if (scoreLookupMatchedStudent) {
                  setStudentNo(scoreLookupMatchedStudent.studentNo);
                  setStudentName(scoreLookupMatchedStudent.fullName);
                  setStudentClass(scoreLookupMatchedStudent.classGrade);
                } else if (resultsList.length > 0) {
                  const ref = resultsList[0];
                  if (ref.studentNo) setStudentNo(ref.studentNo);
                  if (ref.studentName) setStudentName(ref.studentName);
                  if (ref.classGrade) setStudentClass(ref.classGrade);
                } else if (scoreLookupNis.trim()) {
                  setStudentNo(scoreLookupNis.trim());
                }
                setIsScoreLookupOpen(false);
                handleStartExamClick(exam);
              };

              const displayIdentity = !hasSearched
                ? 'Menampilkan daftar ujian aktif. Masukkan NIS / Nama di atas lalu klik "Cek Status" untuk memeriksa nilai pribadi Anda.'
                : scoreLookupMatchedStudent
                  ? `${scoreLookupMatchedStudent.fullName} (NIS: ${scoreLookupMatchedStudent.studentNo}${scoreLookupMatchedStudent.classGrade ? ` · Kelas ${scoreLookupMatchedStudent.classGrade}` : ''})`
                  : resultsList.length > 0
                    ? `${resultsList[0].studentName} (NIS: ${resultsList[0].studentNo}${resultsList[0].classGrade ? ` · ${resultsList[0].classGrade}` : ''})`
                    : `Pencarian: "${scoreLookupNis.trim()}"`;

              return (
                <div className="space-y-4">
                  {/* Identitas & Ringkasan */}
                  <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>{displayIdentity}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold">
                      {hasSearched && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          {resultsList.length} Selesai
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        {pendingExams.length} Belum Dikerjakan
                      </span>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <button
                      type="button"
                      onClick={() => setScoreLookupTab('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        scoreLookupTab === 'all'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Semua ({pendingExams.length + resultsList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScoreLookupTab('pending')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        scoreLookupTab === 'pending'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>Belum Dikerjakan ({pendingExams.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScoreLookupTab('completed')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        scoreLookupTab === 'completed'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Sudah Dikerjakan ({resultsList.length})
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                    {/* BAGIAN 1: UJIAN YANG BELUM DIKERJAKAN */}
                    {(scoreLookupTab === 'all' || scoreLookupTab === 'pending') && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
                          <span>Ujian Belum Dikerjakan ({pendingExams.length})</span>
                        </div>

                        {pendingExams.length > 0 ? (
                          <div className="space-y-2.5">
                            {pendingExams.map(exam => {
                              const isLate = Boolean(exam.allowLateSubmission) || (Number(exam.lateExtensionMinutes) || 0) > 0;
                              const isStopped = StorageService.isExamStopped(exam);
                              const isEnded = exam.sessionStatus === 'ended';
                              const isSessionActive = exam.sessionStatus === 'active';
                              const needsRetake = resetExamIds.has(String(exam.id).trim().toLowerCase());

                              return (
                                <div
                                  key={exam.id}
                                  className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/15 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                >
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                                        {exam.subject} · Kelas {exam.grade}
                                      </span>
                                      {needsRetake ? (
                                        <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[11px] font-semibold border border-orange-200 dark:border-orange-800">
                                          Perlu Mengulang Ujian
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                                          Belum Dikerjakan
                                        </span>
                                      )}
                                      {isStopped ? (
                                        <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[11px] font-semibold">
                                          Dihentikan
                                        </span>
                                      ) : isEnded ? (
                                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                                          Sesi Ditutup
                                        </span>
                                      ) : isLate ? (
                                        <span className="px-2 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-[11px] font-semibold">
                                          Toleransi Terlambat
                                        </span>
                                      ) : !isSessionActive ? (
                                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                                          Menunggu Guru
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
                                          Sesi Aktif
                                        </span>
                                      )}
                                    </div>

                                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                                      {exam.title}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                      {exam.totalQuestions} Soal · {exam.durationMinutes} Menit · KKM {exam.passingScore}
                                    </div>
                                  </div>

                                  <div className="shrink-0">
                                    {isStopped ? (
                                      <button
                                        type="button"
                                        disabled
                                        className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-xs cursor-not-allowed flex items-center justify-center gap-1.5"
                                      >
                                        <StopCircle className="w-3.5 h-3.5" />
                                        <span>Dihentikan</span>
                                      </button>
                                    ) : isEnded ? (
                                      <button
                                        type="button"
                                        disabled
                                        className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-xs cursor-not-allowed flex items-center justify-center gap-1.5"
                                      >
                                        <StopCircle className="w-3.5 h-3.5" />
                                        <span>Sesi Ditutup</span>
                                      </button>
                                    ) : !isSessionActive && !isLate ? (
                                      <button
                                        type="button"
                                        disabled
                                        className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs cursor-not-allowed flex items-center justify-center gap-1.5"
                                        title="Menunggu guru pengawas menekan tombol Mulai Sesi Ujian"
                                      >
                                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                                        <span>Menunggu Guru</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleStartFromLookup(exam)}
                                        className={`w-full sm:w-auto px-4 py-2 rounded-lg text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                                          isLate
                                            ? 'bg-amber-600 hover:bg-amber-700'
                                            : 'bg-indigo-600 hover:bg-indigo-700'
                                        }`}
                                      >
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                        <span>{needsRetake ? 'Kerjakan Ulang' : 'Kerjakan Ujian'}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl font-medium">
                            {hasSearched
                              ? 'Semua ujian aktif telah Anda kerjakan!'
                              : 'Belum ada ujian aktif yang terjadwal saat ini.'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* BAGIAN 2: NILAI UJIAN SUDAH DIKERJAKAN */}
                    {(scoreLookupTab === 'all' || scoreLookupTab === 'completed') && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>Riwayat Nilai Sudah Dikerjakan ({resultsList.length})</span>
                        </div>

                        {!hasSearched ? (
                          <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                            Masukkan NIS atau Nama Lengkap di kolom pencarian di atas untuk melihat riwayat nilai ujian yang sudah dikerjakan.
                          </div>
                        ) : resultsList.length > 0 ? (
                          <div className="space-y-2.5">
                            {resultsList.map(sub => {
                              const examObj =
                                liveExams.find(e => String(e.id).trim().toLowerCase() === String(sub.examId || '').trim().toLowerCase()) ||
                                exams.find(e => String(e.id).trim().toLowerCase() === String(sub.examId || '').trim().toLowerCase());
                              return (
                                <div key={sub.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <span className="font-bold text-slate-900 dark:text-white text-sm block">
                                        {examObj?.title || examObj?.subject || sub.examTitle || sub.examId}
                                      </span>
                                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                        {sub.studentName} ({sub.studentNo}) · {sub.classGrade}
                                      </span>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono shrink-0 ${
                                      sub.passed
                                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                    }`}>
                                      {Math.round(Number(sub.percentage) || 0)}% ({sub.passed ? 'Lulus' : 'Remedial'})
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span>Durasi: {Math.floor((Number(sub.timeSpentSeconds) || 0) / 60)}m {(Number(sub.timeSpentSeconds) || 0) % 60}s</span>
                                      <span>·</span>
                                      <span>Pindah Tab: {sub.tabSwitchCount || 0}x</span>
                                      <span>·</span>
                                      <span>Kirim: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('id-ID') : '-'}</span>
                                    </div>

                                    {examObj && examObj.attemptMode === 'unlimited' && examObj.sessionStatus !== 'stopped' && examObj.status !== 'stopped' && examObj.sessionStatus !== 'ended' && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartFromLookup(examObj)}
                                        className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-sans font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Kerjakan Ulang</span>
                                      </button>
                                    )}
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
                          <div className="p-5 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                            Belum ada nilai ujian yang tercatat untuk "{scoreLookupNis}". Silakan kerjakan ujian yang tersedia pada daftar di atas.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsScoreLookupOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
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
