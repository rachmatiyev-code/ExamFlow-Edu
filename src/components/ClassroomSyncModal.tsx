import React, { useState, useEffect } from 'react';
import { 
  X, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Users, 
  ArrowRight, 
  Send, 
  Copy, 
  Check, 
  HelpCircle, 
  BookOpen, 
  FileSpreadsheet,
  LogOut,
  Sparkles
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { Exam, Submission, Student } from '../types';
import { 
  googleSignIn, 
  googleLogout, 
  getAccessToken, 
  initAuth 
} from '../services/googleAuth';
import { 
  ClassroomService, 
  ClassroomCourse, 
  ClassroomCourseWork, 
  ClassroomStudent, 
  StudentMatchResult 
} from '../services/classroomService';
import { GasClient } from '../services/gasClient';
import { GAS_BACKEND_SCRIPT } from '../services/gasBackendCode';

interface ClassroomSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: Exam[];
  submissions: Submission[];
  students: Student[];
  initialExamId?: string;
}

export const ClassroomSyncModal: React.FC<ClassroomSyncModalProps> = ({
  isOpen,
  onClose,
  exams,
  submissions,
  students,
  initialExamId
}) => {
  // Auth state
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Workflow state
  const [syncPathway, setSyncPathway] = useState<'client' | 'gas'>('client');
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || (exams[0]?.id || ''));
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // Coursework option: 'new' or 'existing'
  const [courseWorkMode, setCourseWorkMode] = useState<'new' | 'existing'>('new');
  const [existingCourseWorks, setExistingCourseWorks] = useState<ClassroomCourseWork[]>([]);
  const [isLoadingCourseWorks, setIsLoadingCourseWorks] = useState(false);
  const [selectedCourseWorkId, setSelectedCourseWorkId] = useState<string>('');
  
  // New assignment form
  const [newTitle, setNewTitle] = useState<string>('');
  const [newMaxPoints, setNewMaxPoints] = useState<number>(100);
  const [returnToStudent, setReturnToStudent] = useState<boolean>(true);

  // Student match results
  const [matchResults, setMatchResults] = useState<StudentMatchResult[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [activeCourseObj, setActiveCourseObj] = useState<ClassroomCourse | null>(null);

  // Confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Sync execution state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; studentName: string }>({ current: 0, total: 0, studentName: '' });
  const [syncSummary, setSyncSummary] = useState<{
    successCount: number;
    unmatchedCount: number;
    errorCount: number;
    courseLink?: string;
  } | null>(null);

  // GAS Guide tab
  const [showGasGuide, setShowGasGuide] = useState(false);
  const [copiedGas, setCopiedGas] = useState(false);

  // Initialize auth listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, cachedToken) => {
        setGoogleUser(user);
        setToken(cachedToken);
      },
      () => {
        setGoogleUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Update selected exam default title
  useEffect(() => {
    const exam = exams.find(e => e.id === selectedExamId);
    if (exam) {
      setNewTitle(`Penilaian Harian: ${exam.title || exam.subject}`);
    }
  }, [selectedExamId, exams]);

  // Load courses when token is available or when switching pathway
  useEffect(() => {
    if (isOpen) {
      if (syncPathway === 'client' && token) {
        loadCoursesViaClient(token);
      } else if (syncPathway === 'gas') {
        loadCoursesViaGas();
      }
    }
  }, [isOpen, token, syncPathway]);

  const loadCoursesViaClient = async (accessToken: string) => {
    setIsLoadingCourses(true);
    setAuthError(null);
    try {
      const list = await ClassroomService.listCourses(accessToken);
      setCourses(list);
      if (list.length > 0 && !selectedCourseId) {
        setSelectedCourseId(list[0].id);
      }
    } catch (err: any) {
      console.error('Gagal mengambil kelas:', err);
      setAuthError(err?.message || 'Gagal mengambil kelas dari Google Classroom.');
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const loadCoursesViaGas = async () => {
    setIsLoadingCourses(true);
    setAuthError(null);
    try {
      const res = await GasClient.listClassroomCoursesViaGas();
      if (res.success && res.courses) {
        setCourses(res.courses);
        if (res.courses.length > 0 && !selectedCourseId) {
          setSelectedCourseId(res.courses[0].id);
        }
      } else {
        setAuthError(res.message || 'Layanan Google Classroom belum aktif di Apps Script.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Gagal memuat kelas via Google Apps Script.');
    } finally {
      setIsLoadingCourses(false);
    }
  };

  // When course changes, load coursework and student roster
  useEffect(() => {
    if (!selectedCourseId) {
      setActiveCourseObj(null);
      return;
    }
    const course = courses.find(c => c.id === selectedCourseId) || null;
    setActiveCourseObj(course);

    if (syncPathway === 'client' && token) {
      loadCourseWorkAndRoster(selectedCourseId, token);
    }
  }, [selectedCourseId, courses, token, syncPathway]);

  const loadCourseWorkAndRoster = async (courseId: string, accessToken: string) => {
    setIsLoadingCourseWorks(true);
    setIsLoadingRoster(true);
    try {
      const works = await ClassroomService.listCourseWork(courseId, accessToken);
      setExistingCourseWorks(works);
      if (works.length > 0) {
        setSelectedCourseWorkId(works[0].id);
      }

      // Load students to prepare match
      const cStudents = await ClassroomService.listStudents(courseId, accessToken);
      updateStudentMatches(cStudents, []);
    } catch (err) {
      console.warn('Kendala memuat data kelas:', err);
    } finally {
      setIsLoadingCourseWorks(false);
      setIsLoadingRoster(false);
    }
  };

  // Recalculate student matches when exam changes or roster is loaded
  const updateStudentMatches = (
    cStudents: ClassroomStudent[], 
    cSubmissions: any[]
  ) => {
    // Ambil submission untuk ujian yang dipilih
    const examSubs = submissions.filter(s => s.examId === selectedExamId);
    
    // Siapkan list siswa
    const appStudentItems = examSubs.map(sub => {
      const stu = students.find(s => s.studentNo === sub.studentNo);
      return {
        studentNo: sub.studentNo,
        fullName: sub.studentName || stu?.fullName || 'Siswa',
        classGrade: sub.classGrade || stu?.classGrade || 'Umum',
        score: sub.score,
        maxScore: sub.maxScore || 100
      };
    });

    const matches = ClassroomService.matchStudents(appStudentItems, cStudents, cSubmissions, newMaxPoints);
    setMatchResults(matches);
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setToken(res.accessToken);
        await loadCoursesViaClient(res.accessToken);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setAuthError(err?.message || 'Login Google Classroom dibatalkan atau gagal.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleLogout();
    setGoogleUser(null);
    setToken(null);
    setCourses([]);
    setMatchResults([]);
  };

  // Step to initiate sync: opens confirmation dialog first (Mandatory user confirmation)
  const handleInitiateSync = () => {
    if (!selectedCourseId) {
      alert('Pilih kelas Google Classroom terlebih dahulu.');
      return;
    }
    if (matchResults.length === 0) {
      alert('Belum ada data nilai siswa pada paket ujian ini untuk dikirimkan.');
      return;
    }
    setShowConfirmDialog(true);
  };

  // Execute the grade sync after user confirmed
  const handleConfirmExecuteSync = async () => {
    setShowConfirmDialog(false);
    setIsSyncing(true);
    setSyncSummary(null);

    const targetCourse = courses.find(c => c.id === selectedCourseId);

    if (syncPathway === 'client' && token) {
      try {
        let targetCourseWorkId = selectedCourseWorkId;

        // 1. Buat tugas baru jika mode 'new'
        if (courseWorkMode === 'new') {
          const createdWork = await ClassroomService.createCourseWork(
            selectedCourseId,
            {
              title: newTitle || 'Penilaian Ujian ExamFlow',
              description: `Nilai resmi disinkronkan otomatis dari aplikasi ExamFlow Pro untuk paket ujian: ${exams.find(e => e.id === selectedExamId)?.title || ''}.`,
              maxPoints: newMaxPoints
            },
            token
          );
          targetCourseWorkId = createdWork.id;
        }

        // 2. Ambil ulang data siswa & submission di Google Classroom
        const [cStudents, cSubmissions] = await Promise.all([
          ClassroomService.listStudents(selectedCourseId, token),
          ClassroomService.listStudentSubmissions(selectedCourseId, targetCourseWorkId, token)
        ]);

        // 3. Cocokkan ulang
        const matchedList = ClassroomService.matchStudents(
          matchResults.map(m => ({
            studentNo: m.studentNo,
            fullName: m.studentName,
            classGrade: m.classGrade,
            score: m.examScore,
            maxScore: m.maxScore
          })),
          cStudents,
          cSubmissions,
          newMaxPoints
        );

        let successCount = 0;
        let unmatchedCount = 0;
        let errorCount = 0;

        // 4. Kirim nilai satu per satu dengan update progress bar
        for (let i = 0; i < matchedList.length; i++) {
          const item = matchedList[i];
          setSyncProgress({
            current: i + 1,
            total: matchedList.length,
            studentName: item.studentName
          });

          if (item.submissionId) {
            try {
              await ClassroomService.patchStudentGrade(
                selectedCourseId,
                targetCourseWorkId,
                item.submissionId,
                item.scaledGrade,
                returnToStudent,
                token
              );
              item.syncStatus = 'success';
              successCount++;
            } catch (err: any) {
              item.syncStatus = 'failed';
              item.errorMessage = err?.message || 'Gagal menyimpan nilai';
              errorCount++;
            }
          } else {
            item.syncStatus = 'unmatched';
            unmatchedCount++;
          }
        }

        setMatchResults([...matchedList]);
        setSyncSummary({
          successCount,
          unmatchedCount,
          errorCount,
          courseLink: targetCourse?.alternateLink
        });
      } catch (err: any) {
        alert(`Terjadi kendala saat menyinkronkan: ${err?.message || err}`);
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Pathway Google Apps Script
      try {
        const payloadGrades = matchResults.map(m => ({
          studentNo: m.studentNo,
          studentName: m.studentName,
          score: m.examScore,
          maxScore: m.maxScore
        }));

        const res = await GasClient.syncGradesToClassroomViaGas({
          courseId: selectedCourseId,
          examId: selectedExamId,
          assignmentTitle: newTitle || 'Penilaian Ujian ExamFlow',
          maxScore: newMaxPoints,
          grades: payloadGrades,
          returnToStudent: returnToStudent,
          courseWorkId: courseWorkMode === 'existing' ? selectedCourseWorkId : undefined
        });

        if (res.success) {
          setSyncSummary({
            successCount: res.syncedCount || 0,
            unmatchedCount: (res.total || payloadGrades.length) - (res.syncedCount || 0),
            errorCount: 0,
            courseLink: targetCourse?.alternateLink
          });
        } else {
          alert(`Gagal: ${res.message}`);
        }
      } catch (err: any) {
        alert(`Gagal sync via GAS: ${err?.message || err}`);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GAS_BACKEND_SCRIPT);
    setCopiedGas(true);
    setTimeout(() => setCopiedGas(false), 2500);
  };

  if (!isOpen) return null;

  const currentExam = exams.find(e => e.id === selectedExamId);
  const examSubmissions = submissions.filter(s => s.examId === selectedExamId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight">Kirim Nilai ke Google Classroom</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/20 rounded-full text-white">Resmi & Terintegrasi</span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Cantumkan nilai ujian siswa otomatis ke daftar tugas dan buku nilai Google Classroom
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Toggle Tab: Integrasi Langsung vs Panduan Skrip GAS */}
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setShowGasGuide(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                !showGasGuide 
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Kirim Nilai Langsung (OAuth API)
            </button>
            <button
              onClick={() => setShowGasGuide(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                showGasGuide 
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Panduan Google Apps Script (GAS) & Sheets
            </button>
          </div>

          {!showGasGuide ? (
            <>
              {/* Status Login Akun Google Guru */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {googleUser ? (
                    <>
                      <img 
                        src={googleUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'} 
                        alt={googleUser.displayName || 'Guru'} 
                        className="w-10 h-10 rounded-full border-2 border-emerald-500 shadow-sm"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{googleUser.displayName || 'Akun Guru'}</span>
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 rounded">Terhubung</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">{googleUser.email}</p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Sambungkan Akun Google Classroom Anda</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Aplikasi memerlukan izin untuk melihat daftar kelas yang Anda ampu dan mencantumkan nilai tugas siswa.
                      </p>
                    </div>
                  )}
                </div>

                {googleUser ? (
                  <button
                    onClick={handleGoogleLogout}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Ganti Akun
                  </button>
                ) : (
                  <div>
                    {/* Official Google Sign-In Button */}
                    <button 
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="inline-flex items-center justify-center gap-2.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-300 shadow-sm transition-all hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500 disabled:opacity-50"
                    >
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                      <span>{isLoggingIn ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
                    </button>
                  </div>
                )}
              </div>

              {authError && (
                <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Kendala Otentikasi:</p>
                    <p className="mt-0.5">{authError}</p>
                  </div>
                </div>
              )}

              {/* Grid Form Pemilihan Ujian dan Kelas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Pilih Paket Ujian */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    1. Pilih Paket Ujian yang Hendak Disinkronkan
                  </label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                  >
                    {exams.map(e => {
                      const count = submissions.filter(s => s.examId === e.id).length;
                      return (
                        <option key={e.id} value={e.id}>
                          {e.title} ({e.subject} - {e.grade}) — {count} nilai terkumpul
                        </option>
                      );
                    })}
                  </select>

                  {currentExam && (
                    <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span>Total Jawaban Masuk: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{examSubmissions.length} siswa</strong></span>
                      <span>KKM: <strong className="font-mono">{currentExam.passingScore || 75}</strong></span>
                    </div>
                  )}
                </div>

                {/* 2. Pilih Kelas Google Classroom */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      2. Pilih Kelas Google Classroom Tujuan
                    </label>
                    {token && (
                      <button
                        onClick={() => loadCoursesViaClient(token)}
                        disabled={isLoadingCourses}
                        className="text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingCourses ? 'animate-spin' : ''}`} />
                        Segarkan
                      </button>
                    )}
                  </div>

                  {isLoadingCourses ? (
                    <div className="p-4 text-center text-xs text-slate-400">Memuat daftar kelas dari Google Classroom...</div>
                  ) : courses.length > 0 ? (
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                    >
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.section ? `(${c.section})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                      {googleUser ? 'Belum ada kelas aktif yang ditemukan di akun Google Classroom ini.' : 'Silakan masuk dengan akun Google Classroom di atas terlebih dahulu.'}
                    </div>
                  )}

                  {activeCourseObj && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>ID Kelas: <code className="font-mono">{activeCourseObj.id}</code></span>
                      {activeCourseObj.alternateLink && (
                        <a 
                          href={activeCourseObj.alternateLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          Buka di Classroom <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Pengaturan Tugas di Google Classroom */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    3. Pengaturan Tugas & Penilaian di Google Classroom
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCourseWorkMode('new')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                        courseWorkMode === 'new' 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Buat Tugas Baru Otomatis
                    </button>
                    <button
                      onClick={() => setCourseWorkMode('existing')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                        courseWorkMode === 'existing' 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Pilih Tugas yang Ada
                    </button>
                  </div>
                </div>

                {courseWorkMode === 'new' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Judul Tugas Baru
                      </label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Contoh: Penilaian Harian Bab 1"
                        className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Poin Maksimal
                      </label>
                      <input
                        type="number"
                        value={newMaxPoints}
                        onChange={(e) => setNewMaxPoints(Number(e.target.value) || 100)}
                        className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Pilih Tugas dari Kelas
                    </label>
                    {isLoadingCourseWorks ? (
                      <div className="text-xs text-slate-400 py-2">Memuat tugas kelas...</div>
                    ) : existingCourseWorks.length > 0 ? (
                      <select
                        value={selectedCourseWorkId}
                        onChange={(e) => setSelectedCourseWorkId(e.target.value)}
                        className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium"
                      >
                        {existingCourseWorks.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.title} (Maks: {w.maxPoints || 100} poin)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-slate-400 py-2">Tidak ditemukan tugas yang sudah dipublikasikan di kelas ini. Pilih 'Buat Tugas Baru Otomatis'.</div>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="returnToStudent"
                    checked={returnToStudent}
                    onChange={(e) => setReturnToStudent(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor="returnToStudent" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <strong>Publikasikan nilai langsung ke siswa (Return Submission)</strong> — Siswa dapat langsung melihat nilai ujian mereka di Google Classroom.
                  </label>
                </div>
              </div>

              {/* 4. Tabel Pemetaan Siswa & Estimasi Nilai */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      4. Pratinjau Nilai Siswa yang Akan Dikirim ({matchResults.length} Siswa)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Tersambung ke Google Classroom: <strong className="text-emerald-600 font-mono">{matchResults.filter(m => m.matchedClassroomUser).length}</strong> / {matchResults.length}
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">NIS</th>
                        <th className="p-2.5">Nama Siswa (Aplikasi)</th>
                        <th className="p-2.5 text-center">Nilai Ujian</th>
                        <th className="p-2.5 text-center">Skor Classroom</th>
                        <th className="p-2.5">Pencocokan Akun Classroom</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {matchResults.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 font-mono text-slate-500">{m.studentNo}</td>
                          <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{m.studentName}</td>
                          <td className="p-2.5 text-center font-mono font-bold">{m.examScore} / {m.maxScore}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {m.scaledGrade}
                          </td>
                          <td className="p-2.5">
                            {m.matchedClassroomUser ? (
                              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[180px] font-medium" title={m.matchedClassroomUser.profile.name.fullName}>
                                  {m.matchedClassroomUser.profile.name.fullName}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-500">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-[11px]">Belum terdaftar di kelas</span>
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {m.syncStatus === 'success' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 rounded">Terkirim</span>
                            )}
                            {m.syncStatus === 'failed' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 rounded">Gagal</span>
                            )}
                            {m.syncStatus === 'pending' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded">Siap Kirim</span>
                            )}
                            {m.syncStatus === 'unmatched' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 rounded">Lewati</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Progress Bar Sync */}
              {isSyncing && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Mencantumkan nilai ke Google Classroom...
                    </span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400">
                      {syncProgress.current} dari {syncProgress.total} siswa
                    </span>
                  </div>
                  <div className="w-full bg-emerald-200 dark:bg-emerald-900 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-2 transition-all duration-300"
                      style={{ width: `${(syncProgress.current / (syncProgress.total || 1)) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 italic">
                    Memproses: {syncProgress.studentName}
                  </p>
                </div>
              )}

              {/* Summary Selesai */}
              {syncSummary && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Sinkronisasi Nilai ke Google Classroom Selesai!
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200">
                      <div className="text-lg font-bold text-emerald-600">{syncSummary.successCount}</div>
                      <div className="text-[10px] text-slate-500">Nilai Berhasil Tercantum</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-amber-200">
                      <div className="text-lg font-bold text-amber-500">{syncSummary.unmatchedCount}</div>
                      <div className="text-[10px] text-slate-500">Siswa Belum Ada di Kelas</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-rose-200">
                      <div className="text-lg font-bold text-rose-500">{syncSummary.errorCount}</div>
                      <div className="text-[10px] text-slate-500">Gagal Dikirim</div>
                    </div>
                  </div>
                  {syncSummary.courseLink && (
                    <div className="pt-2 text-center">
                      <a 
                        href={syncSummary.courseLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition-colors"
                      >
                        Buka Kelas di Google Classroom <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Tab Panduan Google Apps Script (GAS) */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Cara Mengaktifkan Google Classroom API di Google Apps Script:
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-xs">
                  <li>Buka spreadsheet Google Sheets Anda yang terhubung dengan ExamFlow.</li>
                  <li>Klik menu <strong>Ekstensi (Extensions)</strong> &rarr; <strong>Apps Script</strong>.</li>
                  <li>Di panel navigasi kiri editor Apps Script, cari bagian <strong>Layanan (Services)</strong> lalu klik tanda tambah (<strong>+</strong>).</li>
                  <li>Pilih <strong>Google Classroom API</strong> (versi v1), lalu klik <strong>Tambahkan (Add)</strong>.</li>
                  <li>Paste kode Apps Script terbaru di bawah ini ke file <code className="font-mono bg-white px-1 rounded">Code.gs</code> lalu Simpan (Ctrl+S).</li>
                  <li>Sekarang menu baru <strong>🎓 ExamFlow Pro &rarr; 🏫 Sinkronkan Nilai ke Google Classroom</strong> akan muncul langsung di atas lembar Google Sheets Anda!</li>
                </ol>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Kode Lengkap Google Apps Script (Code.gs):</span>
                  <button
                    onClick={handleCopyGasCode}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors"
                  >
                    {copiedGas ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedGas ? 'Tersalin!' : 'Salin Kode Script'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={GAS_BACKEND_SCRIPT}
                  rows={14}
                  className="w-full p-3 font-mono text-[11px] bg-slate-900 text-slate-100 rounded-xl border border-slate-700 select-all"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            {matchResults.filter(m => m.matchedClassroomUser).length} siswa siap dicantumkan nilainya ke Google Classroom.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Tutup
            </button>

            {!showGasGuide && (
              <button
                onClick={handleInitiateSync}
                disabled={isSyncing || !selectedCourseId || matchResults.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow transition-colors disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Mengirim Nilai...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Kirim Nilai ke Google Classroom
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Mandatory User Confirmation Dialog for Mutating Data */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 rounded-xl">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Konfirmasi Pengiriman Nilai
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Anda akan mencantumkan nilai untuk <strong>{matchResults.filter(m => m.matchedClassroomUser).length} siswa</strong> ke dalam tugas 
              <span className="font-semibold text-emerald-600"> "{newTitle || 'Penilaian Ujian'}"</span> pada kelas Google Classroom 
              <strong> "{activeCourseObj?.name || 'Kelas Terpilih'}"</strong>.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
              ⚠️ Tindakan ini akan memperbarui buku nilai siswa di Google Classroom secara resmi {returnToStudent ? 'dan langsung mempublikasikannya ke siswa' : 'sebagai draf nilai'}.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmExecuteSync}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow transition-colors"
              >
                Lanjutkan & Kirim Nilai
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
