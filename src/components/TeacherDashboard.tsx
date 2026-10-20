import React, { useState, useEffect } from 'react';
import { 
  Exam, 
  Question, 
  SchoolProfile, 
  Student, 
  Submission, 
  UserAccount, 
  BloomLevel, 
  SoloLevel,
  CurriculumItem
} from '../types';
import { StorageService } from '../services/storage';
import { GasClient } from '../services/gasClient';
import { AiGeneratorService } from '../services/aiGenerator';
import { AnalysisService } from '../services/analysisService';
import { GAS_BACKEND_SCRIPT } from '../services/gasBackendCode';
import { MediaViewer } from './MediaViewer';
import { QuestionMedia, QuestionPromptRenderer } from './QuestionMedia';
import { MediaUploaderInput } from './MediaUploaderInput';
import { CurriculumManagement } from './CurriculumManagement';
import { detectMediaType } from '../services/mediaHelper';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Layers, 
  BarChart3, 
  Users, 
  Building2, 
  Code, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Upload, 
  Eye, 
  Lock, 
  LogOut, 
  Download, 
  Clock, 
  Send, 
  FileText, 
  RefreshCw,
  Calendar,
  ShieldCheck,
  HelpCircle,
  Key,
  Dices,
  Mail,
  BookOpen,
  UserCheck,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Save,
  UserPlus,
  Settings,
  Share2,
  ExternalLink,
  QrCode,
  Search,
  Filter,
  Printer,
  X,
  Bookmark,
  UserCog,
  User,
  Check,
  Target,
  Award,
  TrendingUp,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Play,
  StopCircle,
  FastForward
} from 'lucide-react';

interface TeacherDashboardProps {
  profile: SchoolProfile;
  exams: Exam[];
  students: Student[];
  submissions: Submission[];
  onUpdateProfile: (p: SchoolProfile) => void;
  onRefreshData: () => void;
  onSelectTab: (tab: any) => void;
  onOpenSettings?: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  profile,
  exams,
  students,
  submissions,
  onUpdateProfile,
  onRefreshData,
  onSelectTab,
  onOpenSettings
}) => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => StorageService.getCurrentUser());
  const [usernameInput, setUsernameInput] = useState('guru');
  const [passwordInput, setPasswordInput] = useState('password123');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sub-tabs
  const [activeTab, setActiveTab] = useState<'exams' | 'questions' | 'curriculum' | 'analytics' | 'students' | 'users' | 'profile' | 'gas'>('exams');

  // Curriculum State (Capaian Pembelajaran, Elemen & Tujuan Pembelajaran Kurikulum Merdeka)
  const [curriculumList, setCurriculumList] = useState<CurriculumItem[]>(() => StorageService.getCurriculum());
  const [curriculumForm, setCurriculumForm] = useState<Partial<CurriculumItem>>({
    subject: exams[0]?.subject || 'Biologi',
    grade: 'Fase E (Kelas X)',
    element: '',
    learningOutcome: '',
    learningObjectives: []
  });
  const [curriculumTpInput, setCurriculumTpInput] = useState('');
  const [isSavingCurriculum, setIsSavingCurriculum] = useState(false);
  const [curriculumToast, setCurriculumToast] = useState<string | null>(null);
  const [curriculumFilterSubject, setCurriculumFilterSubject] = useState<string>('all');
  const [editingCurriculumId, setEditingCurriculumId] = useState<string | null>(null);

  // Exam Session Control State (Mulai, Akhiri, dan Lanjutkan Sesi untuk Siswa Terlambat)
  const [lateExtensionExam, setLateExtensionExam] = useState<Exam | null>(null);
  const [lateExtensionMinutes, setLateExtensionMinutes] = useState<number>(30);
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  // Exam Management State
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Partial<Exam> | null>(null);

  // Question Management State
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [manualTaxonomyMode, setManualTaxonomyMode] = useState<'bloom' | 'solo' | 'both'>('both');
  const [draftToast, setDraftToast] = useState<string | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  // AI Generator Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('Sistem Ekskresi & Metabolisme');
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<'Mudah' | 'Sedang' | 'Sukar'>('Sedang');
  const [aiTaxonomy, setAiTaxonomy] = useState<'bloom' | 'solo'>('bloom');
  const [aiQuestionType, setAiQuestionType] = useState<'multiple_choice' | 'checkbox' | 'true_false' | 'essay' | 'mixed'>('multiple_choice');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Tujuan Pembelajaran (TP) State (Dukung hingga 15 TP)
  const [aiLearningObjectives, setAiLearningObjectives] = useState<string[]>([
    'Memahami konsep dan prinsip dasar materi pembelajaran',
    'Menganalisis keterkaitan antar variabel atau komponen konsep',
    'Menerapkan rumus atau kaidah dalam pemecahan masalah kontekstual'
  ]);
  const [newAiTpInput, setNewAiTpInput] = useState('');
  const [newExamTpInput, setNewExamTpInput] = useState('');

  // Analytics Sub-tab View State ('rekap' | 'item_analysis' | 'remedial')
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'rekap' | 'item_analysis' | 'remedial'>('rekap');

  // School Profile Edit State
  const [profileForm, setProfileForm] = useState<SchoolProfile>(profile);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setProfileForm(profile);
  }, [profile]);

  // Student Management State
  const [studentForm, setStudentForm] = useState({ studentNo: '', fullName: '', classGrade: '' });
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isBulkStudentModalOpen, setIsBulkStudentModalOpen] = useState(false);
  const [bulkStudentText, setBulkStudentText] = useState('');
  const [bulkStudentResult, setBulkStudentResult] = useState<string | null>(null);
  const [isSavingStudentsToSheets, setIsSavingStudentsToSheets] = useState(false);
  const [studentSyncMsg, setStudentSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [studentDeleteConfirm, setStudentDeleteConfirm] = useState<{ id: string; name: string } | 'bulk' | null>(null);

  // User Accounts Management State (Admin & Guru)
  const [systemUsers, setSystemUsers] = useState<UserAccount[]>(() => StorageService.getUsers());
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userAccountForm, setUserAccountForm] = useState({
    id: '',
    username: '',
    password: '',
    fullName: '',
    role: 'teacher' as 'admin' | 'teacher',
    email: '',
    active: true
  });
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [isSavingUsersToSheets, setIsSavingUsersToSheets] = useState(false);
  const [userSyncMsg, setUserSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userDeleteConfirm, setUserDeleteConfirm] = useState<{ id: string; username: string; fullName: string } | null>(null);

  // Submission Detail, Selection & Editing States
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [isEditingSubmissionModalOpen, setIsEditingSubmissionModalOpen] = useState(false);

  // Analytics Filters & Search State
  const [analyticsExamFilter, setAnalyticsExamFilter] = useState<string>('all');
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState<string>('');
  const [analyticsStatusFilter, setAnalyticsStatusFilter] = useState<'all' | 'passed' | 'remedial' | 'tab-switch'>('all');
  const [analyticsClassFilter, setAnalyticsClassFilter] = useState<string>('all');

  // Share Exam Modal State
  const [sharingExam, setSharingExam] = useState<Exam | null>(null);
  const [hasCopiedShareLink, setHasCopiedShareLink] = useState(false);
  const [hasCopiedShareMsg, setHasCopiedShareMsg] = useState(false);

  // Copy GAS Code
  // Copy GAS Code
  const [hasCopiedGas, setHasCopiedGas] = useState(false);

  // Selalu perbarui daftar akun pengguna saat tab Users dibuka atau saat data aplikasi diperbarui
  useEffect(() => {
    setSystemUsers(StorageService.getUsers());
  }, [activeTab, exams, students, submissions]);

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const users = StorageService.getUsers();
    const user = users.find(u => u.username === usernameInput.trim() && u.password === passwordInput.trim());

    if (user) {
      setCurrentUser(user);
      StorageService.setCurrentUser(user);
      setLoginError(null);
      StorageService.addLog('AUTH', `Guru ${user.fullName} (${user.username}) berhasil login.`);
    } else {
      setLoginError('Nama pengguna atau kata sandi salah. Gunakan guru / password123.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    StorageService.setCurrentUser(null);
    StorageService.addLog('AUTH', 'Pengguna telah keluar.');
  };

  const generateRandomToken = (subject?: string) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const prefix = subject ? subject.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') : 'EXM';
    return `${prefix || 'EXM'}${code}`;
  };

  const handleRandomizeExamToken = async (exam: Exam) => {
    const newToken = generateRandomToken(exam.subject);
    const updated: Exam = { ...exam, token: newToken };
    const qs = StorageService.getQuestionsByExamId(exam.id);
    await GasClient.pushExam(updated, qs);
    onRefreshData();
    alert(`Token ujian "${exam.title}" berhasil diacak menjadi: ${newToken}`);
  };

  const handleRemoveExamToken = async (exam: Exam) => {
    if (confirm(`Hapus token ujian "${exam.title}" agar siswa dapat masuk tanpa token?`)) {
      const updated: Exam = { ...exam, token: '' };
      const qs = StorageService.getQuestionsByExamId(exam.id);
      await GasClient.pushExam(updated, qs);
      onRefreshData();
    }
  };

  // Exam Save / Delete / Redeploy
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam?.title || !editingExam?.subject) return;

    const isNew = !editingExam.id;
    const examToSave: Exam = {
      id: editingExam.id || `EXAM-${Date.now()}`,
      title: editingExam.title,
      subject: editingExam.subject,
      grade: editingExam.grade || 'X Umum',
      durationMinutes: Number(editingExam.durationMinutes) || 60,
      passingScore: Number(editingExam.passingScore) || 75,
      isStrict: Boolean(editingExam.isStrict),
      allowReview: Boolean(editingExam.allowReview),
      startsAt: editingExam.startsAt || new Date().toISOString().split('T')[0] + ' 07:00',
      endsAt: editingExam.endsAt || new Date().toISOString().split('T')[0] + ' 23:59',
      status: editingExam.status || 'active',
      totalQuestions: editingExam.totalQuestions || 0,
      token: editingExam.token || '',
      instructions: editingExam.instructions || 'Kerjakan dengan teliti dan jujur.',
      createdAt: editingExam.createdAt || new Date().toISOString(),
      redeployCount: editingExam.redeployCount || 0,
      learningObjectives: Array.isArray(editingExam.learningObjectives) ? editingExam.learningObjectives.filter(Boolean).slice(0, 15) : []
    };

    const qs = isNew ? [] : StorageService.getQuestionsByExamId(examToSave.id);
    await GasClient.pushExam(examToSave, qs);

    setIsExamModalOpen(false);
    setEditingExam(null);
    setSelectedExamId(examToSave.id);
    onRefreshData();
  };

  const handleDeleteExam = async (id: string) => {
    if (confirm('Yakin ingin menghapus ujian ini beserta seluruh butir soalnya?')) {
      await GasClient.deleteExam(id);
      onRefreshData();
    }
  };

  const handleRedeployExam = async (exam: Exam) => {
    const updated: Exam = {
      ...exam,
      status: 'active',
      redeployCount: (exam.redeployCount || 0) + 1,
      startsAt: new Date().toISOString().split('T')[0] + ' 07:00',
      endsAt: new Date().toISOString().split('T')[0] + ' 23:59'
    };
    const qs = StorageService.getQuestionsByExamId(exam.id);
    await GasClient.pushExam(updated, qs);
    alert(`Ujian "${exam.title}" telah dideploy ulang untuk hari ini!`);
    onRefreshData();
  };

  // Question Save / Delete
  const handleSaveQuestion = async (e?: React.FormEvent, shouldClose = true) => {
    if (e) e.preventDefault();
    if (!selectedExamId || !editingQuestion?.prompt) return;

    const currentQs = StorageService.getQuestionsByExamId(selectedExamId);
    const isNew = !editingQuestion.id;
    const qId = editingQuestion.id || `Q-${Date.now()}`;

    const rawMediaUrl = (editingQuestion.mediaUrl || '').trim();
    const resolvedMediaType = (rawMediaUrl && (!editingQuestion.mediaType || editingQuestion.mediaType === 'none'))
      ? detectMediaType(rawMediaUrl, 'image')
      : (editingQuestion.mediaType || 'none');

    const newQuestion: Question = {
      id: qId,
      examId: selectedExamId,
      order: editingQuestion.order || currentQs.length + 1,
      prompt: editingQuestion.prompt,
      type: editingQuestion.type || 'multiple_choice',
      mediaType: resolvedMediaType,
      mediaUrl: rawMediaUrl,
      options: editingQuestion.options || [
        { id: 'opt_a', text: 'Pilihan A' },
        { id: 'opt_b', text: 'Pilihan B' },
        { id: 'opt_c', text: 'Pilihan C' },
        { id: 'opt_d', text: 'Pilihan D' }
      ],
      correctKey: editingQuestion.correctKey || 'opt_a',
      points: Number(editingQuestion.points) || 20,
      explanation: editingQuestion.explanation || '',
      bloomLevel: editingQuestion.bloomLevel || 'C3 - Menerapkan',
      soloLevel: editingQuestion.soloLevel || 'Multistructural',
      basicCompetency: editingQuestion.basicCompetency || '',
      indicator: editingQuestion.indicator || '',
      element: editingQuestion.element || '',
      learningOutcome: editingQuestion.learningOutcome || '',
      learningObjective: editingQuestion.learningObjective || ''
    };

    let updatedList: Question[];
    if (isNew) {
      updatedList = [...currentQs, newQuestion];
    } else {
      updatedList = currentQs.map(q => q.id === qId ? newQuestion : q);
    }

    StorageService.saveQuestionsForExam(selectedExamId, updatedList);
    const exam = StorageService.getExamById(selectedExamId);
    if (exam) {
      await GasClient.pushExam(exam, updatedList);
    }

    if (shouldClose) {
      setIsQuestionModalOpen(false);
      setEditingQuestion(null);
      setDraftToast(`Butir soal No. ${newQuestion.order} berhasil disimpan & ditutup.`);
    } else {
      // Siapkan form butir soal berikutnya
      const nextOrder = updatedList.length + 1;
      setEditingQuestion({
        order: nextOrder,
        prompt: '',
        type: newQuestion.type,
        mediaType: 'none',
        mediaUrl: '',
        options: [
          { id: 'opt_a', text: 'Pilihan A' },
          { id: 'opt_b', text: 'Pilihan B' },
          { id: 'opt_c', text: 'Pilihan C' },
          { id: 'opt_d', text: 'Pilihan D' }
        ],
        correctKey: 'opt_a',
        points: 20,
        explanation: '',
        bloomLevel: newQuestion.bloomLevel,
        soloLevel: newQuestion.soloLevel,
        basicCompetency: newQuestion.basicCompetency,
        indicator: '',
        element: newQuestion.element,
        learningOutcome: newQuestion.learningOutcome,
        learningObjective: newQuestion.learningObjective
      });
      setDraftToast(`Soal No. ${newQuestion.order} tersimpan. Siap memasukkan Soal No. ${nextOrder}.`);
    }

    onRefreshData();
    setTimeout(() => setDraftToast(null), 3000);
  };

  // -------------------------------------------------------------
  // KURIKULUM MERDEKA: CAPAIAN PEMBELAJARAN & TUJUAN PEMBELAJARAN
  // -------------------------------------------------------------
  const handleSaveCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curriculumForm.subject?.trim() || !curriculumForm.element?.trim() || !curriculumForm.learningOutcome?.trim()) {
      alert('Mata pelajaran, elemen materi, dan capaian pembelajaran (CP) wajib diisi.');
      return;
    }

    setIsSavingCurriculum(true);
    try {
      const itemToSave: CurriculumItem = {
        id: editingCurriculumId || curriculumForm.id || `CUR-${Date.now()}`,
        subject: curriculumForm.subject.trim(),
        grade: (curriculumForm.grade || 'Fase E (Kelas X)').trim(),
        element: curriculumForm.element.trim(),
        learningOutcome: curriculumForm.learningOutcome.trim(),
        learningObjectives: curriculumForm.learningObjectives || [],
        updatedAt: new Date().toISOString()
      };

      if (editingCurriculumId) {
        StorageService.updateCurriculumItem(editingCurriculumId, itemToSave);
      } else {
        StorageService.addCurriculumItem(itemToSave);
      }

      const updated = StorageService.getCurriculum();
      setCurriculumList(updated);

      // Sinkronkan ke Google Sheets
      const res = await GasClient.pushCurriculum(updated);
      setCurriculumToast(res.success ? 'Capaian & Tujuan Pembelajaran berhasil disimpan ke database & Google Sheets!' : 'Tersimpan di database lokal.');

      // Reset form
      setCurriculumForm({
        subject: itemToSave.subject,
        grade: itemToSave.grade,
        element: '',
        learningOutcome: '',
        learningObjectives: []
      });
      setEditingCurriculumId(null);
      setCurriculumTpInput('');
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setIsSavingCurriculum(false);
      setTimeout(() => setCurriculumToast(null), 4000);
    }
  };

  const handleDeleteCurriculum = async (id: string) => {
    if (confirm('Hapus data Capaian & Tujuan Pembelajaran ini?')) {
      StorageService.deleteCurriculumItem(id);
      const updated = StorageService.getCurriculum();
      setCurriculumList(updated);
      await GasClient.pushCurriculum(updated);
      setCurriculumToast('Capaian pembelajaran berhasil dihapus.');
      setTimeout(() => setCurriculumToast(null), 3000);
    }
  };

  const handleEditCurriculum = (item: CurriculumItem) => {
    setEditingCurriculumId(item.id);
    setCurriculumForm({ ...item });
    setCurriculumTpInput('');
    window.scrollTo({ top: 250, behavior: 'smooth' });
  };

  // -------------------------------------------------------------
  // KONTROL SESI UJIAN (MULAI, AKHIRI, DAN LANJUTKAN SESI TERLAMBAT)
  // -------------------------------------------------------------
  const handleStartExamSession = async (exam: Exam) => {
    const updated: Exam = {
      ...exam,
      sessionStatus: 'active',
      sessionStartedAt: new Date().toISOString(),
      status: 'active'
    };
    StorageService.upsertExam(updated);
    const qs = StorageService.getQuestionsByExamId(exam.id);
    await GasClient.pushExam(updated, qs);
    setSessionToast(`Sesi ujian "${exam.title}" telah DIMULAI! Siswa dapat segera login dan mengerjakan.`);
    StorageService.addLog('EXAM', `Sesi ujian "${exam.title}" resmi DIMULAI oleh pengawas`, undefined, 'success');
    onRefreshData();
    setTimeout(() => setSessionToast(null), 4000);
  };

  const handleEndExamSession = async (exam: Exam) => {
    if (!confirm(`Akhiri sesi ujian "${exam.title}" sekarang?\n\nSiswa yang belum mengumpulkan tidak akan dapat login lagi kecuali Anda membuka sesi lanjutan (toleransi keterlambatan).`)) {
      return;
    }
    const updated: Exam = {
      ...exam,
      sessionStatus: 'ended',
      sessionEndedAt: new Date().toISOString()
    };
    StorageService.upsertExam(updated);
    const qs = StorageService.getQuestionsByExamId(exam.id);
    await GasClient.pushExam(updated, qs);
    setSessionToast(`Sesi ujian "${exam.title}" telah resmi DIAKHIRI.`);
    StorageService.addLog('EXAM', `Sesi ujian "${exam.title}" resmi DIAKHIRI oleh pengawas`, undefined, 'warn');
    onRefreshData();
    setTimeout(() => setSessionToast(null), 4000);
  };

  const handleOpenLateExtension = (exam: Exam) => {
    setLateExtensionExam(exam);
    setLateExtensionMinutes(exam.lateExtensionMinutes || 30);
  };

  const handleApplyLateExtension = async () => {
    if (!lateExtensionExam) return;
    const now = new Date();
    const extendedDate = new Date(now.getTime() + (lateExtensionMinutes * 60 * 1000));
    const year = extendedDate.getFullYear();
    const month = String(extendedDate.getMonth() + 1).padStart(2, '0');
    const day = String(extendedDate.getDate()).padStart(2, '0');
    const hours = String(extendedDate.getHours()).padStart(2, '0');
    const mins = String(extendedDate.getMinutes()).padStart(2, '0');
    const newEndsAt = `${year}-${month}-${day} ${hours}:${mins}`;

    const updated: Exam = {
      ...lateExtensionExam,
      sessionStatus: 'active',
      allowLateSubmission: true,
      lateExtensionMinutes: lateExtensionMinutes,
      endsAt: newEndsAt,
      status: 'active'
    };

    StorageService.upsertExam(updated);
    const qs = StorageService.getQuestionsByExamId(lateExtensionExam.id);
    await GasClient.pushExam(updated, qs);

    setSessionToast(`Sesi ujian "${lateExtensionExam.title}" DILANJUTKAN untuk siswa terlambat (+${lateExtensionMinutes} menit s.d. ${hours}:${mins})!`);
    StorageService.addLog('EXAM', `Sesi ujian "${lateExtensionExam.title}" DILANJUTKAN untuk siswa terlambat (+${lateExtensionMinutes} menit)`, undefined, 'info');
    setLateExtensionExam(null);
    onRefreshData();
    setTimeout(() => setSessionToast(null), 5000);
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (confirm('Hapus butir soal ini?')) {
      const currentQs = StorageService.getQuestionsByExamId(selectedExamId).filter(q => q.id !== qId);
      StorageService.saveQuestionsForExam(selectedExamId, currentQs);
      const exam = StorageService.getExamById(selectedExamId);
      if (exam) {
        await GasClient.pushExam(exam, currentQs);
      }
      onRefreshData();
    }
  };

  // AI Question Generation Handler
  const handleGenerateAiQuestions = async () => {
    let examId = selectedExamId;
    if (!examId && exams.length > 0) {
      examId = exams[0].id;
      setSelectedExamId(examId);
    }
    if (!examId) {
      setAiMessage('Belum ada ujian. Silakan buat data ujian terlebih dahulu.');
      return;
    }
    const currentExam = exams.find(e => e.id === examId) || exams[0];
    if (!currentExam) {
      setAiMessage('Target data ujian tidak ditemukan.');
      return;
    }

    const topicToUse = aiTopic.trim() || currentExam.title || currentExam.subject || 'Asesmen Pembelajaran Terpadu';

    setIsGeneratingAi(true);
    setAiMessage(null);

    const cleanObjectives = aiLearningObjectives.filter(Boolean).slice(0, 15);

    try {
      const res = await AiGeneratorService.generateQuestions(
        currentExam.id, 
        {
          topic: topicToUse,
          count: aiCount,
          difficulty: aiDifficulty,
          taxonomy: aiTaxonomy,
          questionType: aiQuestionType,
          subject: currentExam.subject,
          grade: currentExam.grade,
          learningObjectives: cleanObjectives
        },
        (_completed, _total, message) => {
          setAiMessage(message);
        }
      );

      setIsGeneratingAi(false);
      if (res.success && res.questions) {
        if (cleanObjectives.length > 0 && (!currentExam.learningObjectives || currentExam.learningObjectives.length === 0)) {
          currentExam.learningObjectives = cleanObjectives;
          StorageService.updateExam(currentExam.id, { learningObjectives: cleanObjectives });
        }
        const existing = StorageService.getQuestionsByExamId(currentExam.id);
        const merged = [...existing, ...res.questions];
        // Renumber orders
        merged.forEach((q, idx) => { q.order = idx + 1; });
        StorageService.saveQuestionsForExam(currentExam.id, merged);
        await GasClient.pushExam(currentExam, merged);
        
        const typeLabel = 
          aiQuestionType === 'multiple_choice' ? 'PG Biasa' :
          aiQuestionType === 'checkbox' ? 'PG Kompleks' :
          aiQuestionType === 'true_false' ? 'Benar/Salah' :
          aiQuestionType === 'essay' ? 'Uraian' : 'Campuran';

        setAiMessage(`Sukses! ${res.questions.length} butir soal ${typeLabel} (${aiTaxonomy.toUpperCase()}) berhasil ditambahkan ke ujian "${currentExam.title}".`);
        onRefreshData();
        setTimeout(() => {
          setIsAiModalOpen(false);
          setAiMessage(null);
        }, 1800);
      } else {
        setAiMessage(`Gagal: ${res.message || 'Layanan AI belum dapat merespons. Periksa kunci API Anda di Pengaturan.'}`);
      }
    } catch (err: any) {
      setIsGeneratingAi(false);
      setAiMessage(`Terjadi kendala pembuatan soal: ${err?.message || 'Layanan AI tidak dapat dihubungi.'}`);
    }
  };

  // School Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    // 1. Simpan ke local storage
    StorageService.saveProfile(profileForm);
    // 2. Simpan ke Google Sheets
    await GasClient.pushSchoolProfile(profileForm);
    // 3. Notifikasi parent component agar state seluruh aplikasi terupdate seketika
    onUpdateProfile(profileForm);
    if (currentUser && profileForm.teacherName) {
      const updatedUser = { ...currentUser, fullName: profileForm.teacherName };
      setCurrentUser(updatedUser);
      StorageService.setCurrentUser(updatedUser);
    }
    setProfileSuccessMsg('Profil sekolah & data guru pengampu berhasil disimpan!');
    setTimeout(() => setProfileSuccessMsg(null), 3000);
  };

  // Logo file upload -> base64
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setProfileForm(prev => ({ ...prev, logoUrl: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Student Add
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.studentNo || !studentForm.fullName) return;
    const newStudent: Student = {
      id: `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      studentNo: studentForm.studentNo.trim(),
      fullName: studentForm.fullName.trim(),
      classGrade: studentForm.classGrade.trim() || 'X Umum',
      status: 'active'
    };
    StorageService.upsertStudent(newStudent);
    setStudentForm({ studentNo: '', fullName: '', classGrade: '' });
    onRefreshData();

    // Auto-push to sheets if connected
    const currentList = StorageService.getStudents();
    await GasClient.pushStudents(currentList);
    setStudentSyncMsg({ type: 'success', text: `Siswa "${newStudent.fullName}" berhasil ditambahkan & disimpan!` });
    setTimeout(() => setStudentSyncMsg(null), 3500);
  };

  // Student Edit Save
  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    StorageService.upsertStudent(editingStudent);
    setEditingStudent(null);
    onRefreshData();

    const currentList = StorageService.getStudents();
    await GasClient.pushStudents(currentList);
    setStudentSyncMsg({ type: 'success', text: `Data siswa "${editingStudent.fullName}" berhasil diperbarui!` });
    setTimeout(() => setStudentSyncMsg(null), 3500);
  };

  // Single Student Delete
  const handleDeleteStudent = async (studentId: string) => {
    StorageService.deleteStudent(studentId);
    setSelectedStudentIds(prev => prev.filter(id => id !== studentId));
    setStudentDeleteConfirm(null);
    onRefreshData();

    const currentList = StorageService.getStudents();
    await GasClient.pushStudents(currentList);
    setStudentSyncMsg({ type: 'success', text: 'Data siswa berhasil dihapus.' });
    setTimeout(() => setStudentSyncMsg(null), 3500);
  };

  // Bulk Student Delete
  const handleBulkDeleteStudents = async () => {
    if (selectedStudentIds.length === 0) return;
    selectedStudentIds.forEach(id => StorageService.deleteStudent(id));
    const count = selectedStudentIds.length;
    setSelectedStudentIds([]);
    setStudentDeleteConfirm(null);
    onRefreshData();

    const currentList = StorageService.getStudents();
    await GasClient.pushStudents(currentList);
    setStudentSyncMsg({ type: 'success', text: `${count} siswa terpilih berhasil dihapus!` });
    setTimeout(() => setStudentSyncMsg(null), 3500);
  };

  // Bulk Import Students (from CSV / Excel / Tab-separated)
  const handleBulkImportStudents = async () => {
    if (!bulkStudentText.trim()) return;
    const lines = bulkStudentText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedStudents: Student[] = [];

    for (const line of lines) {
      const parts = line.includes('\t') 
        ? line.split('\t') 
        : line.includes(';') 
        ? line.split(';') 
        : line.split(',');

      const nis = (parts[0] || '').trim();
      const name = (parts[1] || '').trim();
      const grade = (parts[2] || '').trim() || 'X Umum';

      if (nis && name) {
        parsedStudents.push({
          id: `STD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          studentNo: nis,
          fullName: name,
          classGrade: grade,
          status: 'active'
        });
      }
    }

    if (parsedStudents.length === 0) {
      setBulkStudentResult('Format data tidak valid. Pastikan setiap baris berisi: NIS, Nama Lengkap, Kelas.');
      return;
    }

    for (const s of parsedStudents) {
      StorageService.upsertStudent(s);
    }

    onRefreshData();
    const allStudents = StorageService.getStudents();
    await GasClient.pushStudents(allStudents);

    setBulkStudentResult(null);
    setIsBulkStudentModalOpen(false);
    setBulkStudentText('');
    setStudentSyncMsg({ type: 'success', text: `Berhasil mengimpor ${parsedStudents.length} siswa baru ke dalam sistem & Google Sheets!` });
    setTimeout(() => setStudentSyncMsg(null), 4000);
  };

  // Manual Push All Students to Sheets
  const handleSaveStudentsToSheets = async () => {
    setIsSavingStudentsToSheets(true);
    setStudentSyncMsg(null);
    const res = await GasClient.pushStudents(students);
    setIsSavingStudentsToSheets(false);
    if (res.success) {
      setStudentSyncMsg({ type: 'success', text: `Berhasil menyimpan & menyinkronkan ${students.length} data siswa ke Google Sheets!` });
    } else {
      setStudentSyncMsg({ type: 'error', text: res.message || 'Gagal menyimpan siswa ke Google Sheets.' });
    }
    setTimeout(() => setStudentSyncMsg(null), 5000);
  };

  // Copy GAS Code
  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GAS_BACKEND_SCRIPT);
    setHasCopiedGas(true);
    setTimeout(() => setHasCopiedGas(false), 2500);
  };

  // Export Submissions to CSV
  const handleExportCsv = () => {
    const safeList = (submissions || []).filter((s): s is Submission => Boolean(s && s.id));
    const targetData = analyticsExamFilter === 'all'
      ? safeList
      : safeList.filter(s => String(s.examId || '').trim().toLowerCase() === String(analyticsExamFilter).trim().toLowerCase());

    const headers = ['ID Submission', 'NIS', 'Nama Siswa', 'Kelas', 'ID Ujian', 'Mata Pelajaran', 'Nilai (%)', 'Status', 'Pindah Tab', 'Waktu Pengerjaan (Detik)', 'Tanggal Kirim'];
    const rows = targetData.map(s => {
      const examObj = exams.find(e => String(e.id).trim().toLowerCase() === String(s.examId || '').trim().toLowerCase());
      return [
        s.id,
        s.studentNo,
        `"${(s.studentName || '').replace(/"/g, '""')}"`,
        s.classGrade || '',
        s.examId || '',
        `"${(examObj?.title || examObj?.subject || s.examId || '').replace(/"/g, '""')}"`,
        Number(s.percentage) || 0,
        s.passed ? 'Lulus' : 'Remedial',
        Number(s.tabSwitchCount) || 0,
        Number(s.timeSpentSeconds) || 0,
        s.submittedAt || ''
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_nilai_${analyticsExamFilter !== 'all' ? analyticsExamFilter : 'semua'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete individual submission (e.g. test dummy data)
  const handleDeleteSubmission = (subId: string) => {
    if (!window.confirm('Hapus rekaman nilai submission ini?')) return;
    StorageService.deleteSubmission(subId);
    setSelectedSubmissionIds(prev => prev.filter(id => id !== subId));
    onRefreshData();
  };

  // Bulk delete selected submissions
  const handleBulkDeleteSubmissions = () => {
    if (selectedSubmissionIds.length === 0) return;
    if (!window.confirm(`Hapus ${selectedSubmissionIds.length} data rekaman nilai yang dipilih?`)) return;
    StorageService.deleteSubmissionsBulk(selectedSubmissionIds);
    setSelectedSubmissionIds([]);
    onRefreshData();
  };

  // Clear dummy submissions
  const handleClearDummySubmissions = () => {
    if (!window.confirm('Bersihkan seluruh rekaman nilai dummy bawaan sistem?')) return;
    StorageService.clearDummySubmissions();
    setSelectedSubmissionIds([]);
    onRefreshData();
  };

  // Open Edit Submission Modal
  const handleOpenEditSubmission = (sub: Submission) => {
    setEditingSubmission({ ...sub });
    setIsEditingSubmissionModalOpen(true);
  };

  // Save Edited Submission
  const handleSaveEditedSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubmission) return;
    StorageService.updateSubmission(editingSubmission.id, editingSubmission);
    setIsEditingSubmissionModalOpen(false);
    setEditingSubmission(null);
    onRefreshData();
  };

  // Save Question as Draft
  const handleSaveDraftQuestion = () => {
    if (!selectedExamId) {
      alert('Pilih paket ujian terlebih dahulu.');
      return;
    }
    const draft = StorageService.saveDraftQuestion(selectedExamId, {
      ...editingQuestion,
      isDraft: true,
      status: 'draft'
    });
    setDraftToast(`Draft butir soal "${draft.prompt.slice(0, 30)}..." berhasil disimpan!`);
    setTimeout(() => setDraftToast(null), 3500);
    setIsQuestionModalOpen(false);
    setEditingQuestion(null);
    onRefreshData();
  };

  // User Accounts Management Handlers
  const handleOpenAddUser = () => {
    setUserAccountForm({
      id: '',
      username: '',
      password: '',
      fullName: '',
      role: 'teacher',
      email: '',
      active: true
    });
    setUserModalError(null);
    setEditingUser(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: UserAccount) => {
    setUserAccountForm({
      id: u.id,
      username: u.username,
      password: '', // Blank by default so existing password stays if untouched
      fullName: u.fullName,
      role: u.role,
      email: u.email || '',
      active: u.active !== false
    });
    setUserModalError(null);
    setEditingUser(u);
    setIsUserModalOpen(true);
  };

  const handleSaveUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);

    const cleanUsername = userAccountForm.username.trim();
    const cleanFullName = userAccountForm.fullName.trim();
    if (!cleanUsername) {
      setUserModalError('Username wajib diisi.');
      return;
    }
    if (!cleanFullName) {
      setUserModalError('Nama lengkap pengguna wajib diisi.');
      return;
    }

    try {
      if (editingUser) {
        // Update user
        const updatePayload: Partial<UserAccount> = {
          username: cleanUsername,
          fullName: cleanFullName,
          role: userAccountForm.role,
          email: userAccountForm.email.trim(),
          active: userAccountForm.active
        };
        if (userAccountForm.password && userAccountForm.password.trim()) {
          updatePayload.password = userAccountForm.password.trim();
        }
        StorageService.updateUser(editingUser.id, updatePayload);
      } else {
        // Add new user
        if (!userAccountForm.password || !userAccountForm.password.trim()) {
          setUserModalError('Password wajib diisi untuk akun baru.');
          return;
        }
        StorageService.addUser({
          id: `USR-${Date.now()}`,
          username: cleanUsername,
          password: userAccountForm.password.trim(),
          fullName: cleanFullName,
          role: userAccountForm.role,
          email: userAccountForm.email.trim(),
          active: userAccountForm.active
        });
      }

      const updatedUsers = StorageService.getUsers();
      setSystemUsers(updatedUsers);
      setIsUserModalOpen(false);
      setEditingUser(null);

      // Otomatis sinkronkan data akun ke Google Sheets jika URL GAS aktif
      if (StorageService.getSettings().gasWebAppUrl) {
        GasClient.pushUsers(updatedUsers).catch(() => {});
      }
    } catch (err: any) {
      setUserModalError(err?.message || 'Gagal menyimpan akun.');
    }
  };

  const handleDeleteUserAccount = (id: string) => {
    StorageService.deleteUser(id);
    const updated = StorageService.getUsers();
    setSystemUsers(updated);
    setUserDeleteConfirm(null);
    if (StorageService.getSettings().gasWebAppUrl) {
      GasClient.pushUsers(updated).catch(() => {});
    }
  };

  const handleClearDummyUsers = () => {
    if (!window.confirm('Bersihkan seluruh akun pengguna dummy bawaan sistem (admin & guru demo)? Akun kustom Anda akan tetap aman.')) return;
    StorageService.clearDummyUsers();
    const updated = StorageService.getUsers();
    setSystemUsers(updated);
    if (StorageService.getSettings().gasWebAppUrl) {
      GasClient.pushUsers(updated).catch(() => {});
    }
  };

  const handleSaveUsersToSheets = async () => {
    setIsSavingUsersToSheets(true);
    setUserSyncMsg(null);
    try {
      const res = await GasClient.pushUsers(systemUsers);
      if (res.success) {
        setUserSyncMsg({ type: 'success', text: res.message || 'Akun pengguna berhasil disimpan ke Google Sheets!' });
      } else {
        setUserSyncMsg({ type: 'error', text: res.message || 'Gagal menyimpan akun ke Google Sheets.' });
      }
    } catch (err: any) {
      setUserSyncMsg({ type: 'error', text: err?.message || 'Gagal simpan akun.' });
    } finally {
      setIsSavingUsersToSheets(false);
      setTimeout(() => setUserSyncMsg(null), 5000);
    }
  };

  // -------------------------------------------------------------
  // LOGIN SCREEN (If teacher is not authenticated)
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="text-center pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            {profile.logoUrl && (
              <img
                src={profile.logoUrl}
                alt={profile.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-xl object-cover mx-auto mb-2 shadow-sm"
              />
            )}
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              {profile.name}
            </h3>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              Masuk Portal Pengajar
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola jadwal ujian, butir soal, analitik nilai, dan profil sekolah.
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Pengguna (Username)
              </label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kata Sandi (Password)
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Akun demo bawaan: <span className="font-mono font-bold">guru</span> / <span className="font-mono font-bold">password123</span>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
            >
              Masuk ke Portal Guru
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED TEACHER DASHBOARD
  // -------------------------------------------------------------
  const currentExam = exams.find(e => e.id === selectedExamId) || exams[0];
  const currentQuestions = currentExam ? StorageService.getQuestionsByExamId(currentExam.id) : [];

  // Safe sanitized submissions
  const safeSubmissions: Submission[] = (submissions || []).filter((s): s is Submission => Boolean(s && s.id));

  // Available classes across all submissions for filter dropdown
  const submissionClasses = Array.from(new Set(safeSubmissions.map(s => s.classGrade).filter(Boolean))).sort();

  // Filtered submissions for Analytics Tab
  const filteredAnalyticsSubmissions = safeSubmissions.filter(sub => {
    // 1. Exam filter
    if (analyticsExamFilter !== 'all') {
      const cleanFilter = String(analyticsExamFilter).trim().toLowerCase();
      const cleanExamId = String(sub.examId || '').trim().toLowerCase();
      if (cleanExamId !== cleanFilter) return false;
    }

    // 2. Status filter
    if (analyticsStatusFilter === 'passed' && !sub.passed) return false;
    if (analyticsStatusFilter === 'remedial' && sub.passed) return false;
    if (analyticsStatusFilter === 'tab-switch' && (Number(sub.tabSwitchCount) || 0) <= 0) return false;

    // 3. Class filter
    if (analyticsClassFilter !== 'all') {
      const cleanClassFilter = String(analyticsClassFilter).trim().toLowerCase();
      const cleanClass = String(sub.classGrade || '').trim().toLowerCase();
      if (cleanClass !== cleanClassFilter) return false;
    }

    // 4. Search query
    if (analyticsSearchQuery.trim()) {
      const q = analyticsSearchQuery.trim().toLowerCase();
      const matchName = String(sub.studentName || '').toLowerCase().includes(q);
      const matchNo = String(sub.studentNo || '').toLowerCase().includes(q);
      const matchClass = String(sub.classGrade || '').toLowerCase().includes(q);
      if (!matchName && !matchNo && !matchClass) return false;
    }

    return true;
  });

  const analyticsTotalCount = filteredAnalyticsSubmissions.length;
  const analyticsAvgScore = analyticsTotalCount > 0
    ? Math.round(filteredAnalyticsSubmissions.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0) / analyticsTotalCount)
    : 0;
  const analyticsPassCount = filteredAnalyticsSubmissions.filter(s => s.passed).length;
  const analyticsPassRate = analyticsTotalCount > 0
    ? Math.round((analyticsPassCount / analyticsTotalCount) * 100)
    : 0;
  const analyticsTotalTabSwitch = filteredAnalyticsSubmissions.reduce((acc, s) => acc + (Number(s.tabSwitchCount) || 0), 0);
  const analyticsHighestScore = analyticsTotalCount > 0
    ? Math.max(...filteredAnalyticsSubmissions.map(s => Number(s.percentage) || 0))
    : 0;
  const analyticsLowestScore = analyticsTotalCount > 0
    ? Math.min(...filteredAnalyticsSubmissions.map(s => Number(s.percentage) || 0))
    : 0;

  // Filter submissions for current exam (for quick stats on exams tab)
  const examSubmissions = safeSubmissions.filter(s => {
    return String(s.examId || '').trim().toLowerCase() === String(currentExam?.id || '').trim().toLowerCase();
  });
  const avgScore = examSubmissions.length > 0
    ? Math.round(examSubmissions.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0) / examSubmissions.length)
    : 0;
  const passCount = examSubmissions.filter(s => s.passed).length;
  const passRate = examSubmissions.length > 0 ? Math.round((passCount / examSubmissions.length) * 100) : 0;

  // Analisis Butir Soal, Ketercapaian TP & Rekomendasi Remidi/Pengayaan
  const activeAnalysisExamId = analyticsExamFilter !== 'all' ? analyticsExamFilter : (selectedExamId || exams[0]?.id || '');
  const targetAnalysisExam = exams.find(e => String(e.id).trim().toLowerCase() === String(activeAnalysisExamId).trim().toLowerCase()) || exams[0];
  const targetAnalysisQuestions = targetAnalysisExam ? StorageService.getQuestionsByExamId(targetAnalysisExam.id) : [];
  const targetAnalysisSubmissions = safeSubmissions.filter(s => String(s.examId || '').trim().toLowerCase() === String(targetAnalysisExam?.id || '').trim().toLowerCase());

  // 1. Analisis Butir Soal (Item Analysis)
  const questionAnalysisList = (targetAnalysisExam && targetAnalysisQuestions.length > 0)
    ? AnalysisService.analyzeQuestions(targetAnalysisExam.id, targetAnalysisQuestions, targetAnalysisSubmissions)
    : [];

  // 2. Analisis Ketuntasan per Tujuan Pembelajaran (TP)
  const objectiveAnalysisList = (targetAnalysisQuestions.length > 0)
    ? AnalysisService.analyzeObjectives(targetAnalysisQuestions, targetAnalysisSubmissions)
    : [];

  // 3. Saran Remidi dan Pengayaan Siswa
  const studentRecommendations = (targetAnalysisExam && targetAnalysisQuestions.length > 0)
    ? AnalysisService.generateStudentRecommendations(targetAnalysisExam, targetAnalysisQuestions, targetAnalysisSubmissions)
    : [];

  const filteredStudentRecommendations = studentRecommendations.filter(rec => {
    if (analyticsClassFilter !== 'all') {
      const cleanClassFilter = String(analyticsClassFilter).trim().toLowerCase();
      const cleanClass = String(rec.classGrade || '').trim().toLowerCase();
      if (cleanClass !== cleanClassFilter) return false;
    }
    if (analyticsStatusFilter === 'passed' && !rec.passed) return false;
    if (analyticsStatusFilter === 'remedial' && rec.passed) return false;
    if (analyticsSearchQuery.trim()) {
      const q = analyticsSearchQuery.trim().toLowerCase();
      const matchName = String(rec.studentName || '').toLowerCase().includes(q);
      const matchNo = String(rec.studentNo || '').toLowerCase().includes(q);
      const matchClass = String(rec.classGrade || '').toLowerCase().includes(q);
      if (!matchName && !matchNo && !matchClass) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Teacher Top Info & User Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
            {(profile.teacherName || currentUser.fullName).charAt(0)}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{profile.teacherName || currentUser.fullName}</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {profile.teacherTitle || (currentUser.role === 'admin' ? 'Administrator' : 'Guru Pengampu')}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {profile.name} · Tahun Ajaran {profile.academicYear} {profile.teacherNip ? `· NIP: ${profile.teacherNip}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation (Clean Segmented Design) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('exams')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === 'exams'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Riwayat & Manajemen Ujian ({exams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === 'questions'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Editor Soal & AI ({currentQuestions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('curriculum')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === 'curriculum'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Capaian & TP (CP/TP) ({curriculumList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Dasbor Nilai Siswa ({submissions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === 'students'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Data Siswa ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <UserCog className="w-3.5 h-3.5" />
          <span>Kelola Pengguna ({systemUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Profil Sekolah & Logo</span>
        </button>

        <button
          onClick={() => setActiveTab('gas')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === 'gas'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>Kode Google Apps Script</span>
        </button>
      </div>

      {/* Toast Notification Banner (e.g. Draft saved) */}
      {draftToast && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{draftToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setDraftToast(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------
          SUB-TAB 1: EXAM MANAGEMENT & HISTORY
         --------------------------------------------------------- */}
      {activeTab === 'exams' && (
        <div className="space-y-6 animate-fadeIn">
          {sessionToast && (
            <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center justify-between shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{sessionToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setSessionToast(null)}
                className="text-indigo-400 hover:text-indigo-600 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Daftar Ujian & Kontrol Sesi Ujian
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kelola jadwal ujian, edit butir soal, aktifkan kembali (redeploy), atau cetak spesifikasi kisi-kisi.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingExam({
                  title: '',
                  subject: '',
                  grade: 'X MIPA',
                  durationMinutes: 45,
                  passingScore: 75,
                  isStrict: true,
                  allowReview: true,
                  token: '',
                  status: 'active'
                });
                setIsExamModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Ujian Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {exams.map(exam => {
              const qCount = StorageService.getQuestionsByExamId(exam.id).length;
              const subCount = submissions.filter(s => s.examId === exam.id).length;

              return (
                <div
                  key={exam.id}
                  className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {exam.subject} · Kelas {exam.grade}
                      </span>
                      <span className="font-mono">{qCount} Butir Soal</span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
                      {exam.title}
                    </h4>

                    <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg font-mono">
                      <div className="flex justify-between">
                        <span>Durasi:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{exam.durationMinutes} Menit</span>
                      </div>
                      <div className="flex justify-between">
                        <span>KKM:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{exam.passingScore}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jawaban Siswa Masuk:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{subCount} Siswa</span>
                      </div>
                      {exam.redeployCount && exam.redeployCount > 0 ? (
                        <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                          <span>Dideploy Ulang:</span>
                          <span>{exam.redeployCount}x</span>
                        </div>
                      ) : null}

                      {/* Token Row with Quick Randomizer & Copy */}
                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-200 dark:border-slate-700/80">
                        <div className="flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-sans text-slate-400">Token:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {exam.token || 'Tanpa Token'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRandomizeExamToken(exam)}
                            className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                            title="Acak token baru"
                          >
                            <Dices className="w-3 h-3" />
                            <span>Acak</span>
                          </button>
                          {exam.token && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(exam.token || '');
                                alert(`Token "${exam.token}" disalin!`);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Salin token"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Live Exam Session Control Section */}
                      <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/80">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-sans text-slate-400 font-semibold">Sesi:</span>
                            {exam.sessionStatus === 'active' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Sesi Berlangsung
                              </span>
                            ) : exam.sessionStatus === 'ended' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                <StopCircle className="w-3 h-3 text-slate-500" />
                                Sesi Ditutup
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                                <Clock className="w-3 h-3 text-blue-500" />
                                Dijadwalkan
                              </span>
                            )}
                          </div>

                          {exam.allowLateSubmission && (
                            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700" title="Toleransi perpanjangan sesi untuk siswa terlambat">
                              +{exam.lateExtensionMinutes || 30}m Terlambat
                            </span>
                          )}
                        </div>

                        {/* Session Control Buttons */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {exam.sessionStatus !== 'active' ? (
                            <button
                              type="button"
                              onClick={() => handleStartExamSession(exam)}
                              className="col-span-1 px-2 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs"
                              title="Mulai sesi ujian sekarang (Siswa dapat langsung login)"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Mulai Sesi</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEndExamSession(exam)}
                              className="col-span-1 px-2 py-1.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs"
                              title="Tutup & akhiri sesi ujian ini"
                            >
                              <StopCircle className="w-3 h-3" />
                              <span>Akhiri Sesi</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenLateExtension(exam)}
                            className="col-span-1 px-2 py-1.5 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs"
                            title="Lanjutkan sesi atau beri perpanjangan waktu untuk siswa terlambat"
                          >
                            <FastForward className="w-3 h-3 text-amber-600" />
                            <span>Lanjutkan (Terlambat)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSharingExam(exam);
                        setHasCopiedShareLink(false);
                        setHasCopiedShareMsg(false);
                        // Otomatis pastikan paket ujian dan butir soal tersinkronisasi ke Google Sheets
                        const qs = StorageService.getQuestionsByExamId(exam.id);
                        if (qs.length > 0) {
                          GasClient.pushExam(exam, qs);
                        }
                      }}
                      className="col-span-2 px-3 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs"
                      title="Dapatkan Link Langsung Siswa & QR Code ujian ini"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Bagikan ke Siswa (Link Langsung & QR Code)</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedExamId(exam.id);
                        setActiveTab('questions');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Kelola Soal</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedExamId(exam.id);
                        onSelectTab('kisi-kisi');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Cetak Kisi-Kisi</span>
                    </button>

                    <button
                      onClick={() => handleRedeployExam(exam)}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg transition-colors flex items-center justify-center gap-1"
                      title="Perbarui jadwal aktif ujian untuk hari ini"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Deploy Ulang</span>
                    </button>

                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          SUB-TAB 2: QUESTION EDITOR & AI GENERATOR
         --------------------------------------------------------- */}
      {activeTab === 'questions' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Exam Selector & Actions Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Mata Pelajaran & Kelas:
              </label>
              <select
                value={selectedExamId || exams[0]?.id || ''}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                {exams.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.subject} — Kelas {e.grade} ({e.title})
                  </option>
                ))}
              </select>
              {currentExam && (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {currentExam.subject} · Kelas {currentExam.grade}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!selectedExamId && exams.length > 0) {
                    setSelectedExamId(exams[0].id);
                  }
                  setIsAiModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Buat Soal Otomatis (Gemini AI)</span>
              </button>

              <button
                onClick={() => {
                  setEditingQuestion({
                    prompt: '',
                    type: 'multiple_choice',
                    mediaType: 'none',
                    mediaUrl: '',
                    points: 20,
                    bloomLevel: 'C3 - Menerapkan',
                    soloLevel: 'Multistructural',
                    options: [
                      { id: 'opt_a', text: '' },
                      { id: 'opt_b', text: '' },
                      { id: 'opt_c', text: '' },
                      { id: 'opt_d', text: '' }
                    ],
                    correctKey: 'opt_a'
                  });
                  setIsQuestionModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Soal Manual</span>
              </button>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {currentQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <div className="flex items-start justify-between gap-4 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      No. {idx + 1}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {q.type === 'multiple_choice' ? 'Pilihan Ganda' : q.type === 'checkbox' ? 'PG Kompleks' : 'Uraian'}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 font-mono">Bobot: {q.points || 10} Poin</span>
                    {q.mediaType !== 'none' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        {q.mediaType}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingQuestion(q);
                        setIsQuestionModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Soal"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Hapus Soal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Prompt with rich formatting & embedded media support */}
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">
                  <QuestionPromptRenderer prompt={q.prompt} onZoomImage={setZoomImageUrl} />
                </div>

                {/* Media Preview if attached */}
                {Boolean(q.mediaUrl && q.mediaUrl.trim() !== '') && (
                  <div className="mb-3 max-w-md">
                    <QuestionMedia
                      mediaUrl={q.mediaUrl}
                      mediaType={q.mediaType}
                      title={`Lampiran Soal No. ${q.order}`}
                      compact={true}
                      onZoomImage={setZoomImageUrl}
                    />
                  </div>
                )}

                {/* Options preview for multiple_choice and checkbox */}
                {(q.type === 'multiple_choice' || q.type === 'checkbox') && q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                    {q.options.map(opt => {
                      const isCorrect = Array.isArray(q.correctKey)
                        ? q.correctKey.includes(opt.id)
                        : opt.id === q.correctKey;

                      return (
                        <div
                          key={opt.id}
                          className={`p-2 rounded-lg border flex items-center gap-2 ${
                            isCorrect
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-semibold'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <span className="w-4 text-center font-bold">{isCorrect ? '✓' : '•'}</span>
                          <span className="truncate">{opt.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Essay Answer Key preview */}
                {q.type === 'essay' && q.correctKey && (
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Kunci / Panduan Jawaban: </span>
                    <span className="text-slate-600 dark:text-slate-400">{typeof q.correctKey === 'string' ? q.correctKey : JSON.stringify(q.correctKey)}</span>
                  </div>
                )}

                {/* Taxonomy Info footer */}
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <span>Bloom: <strong className="text-slate-600 dark:text-slate-300">{q.bloomLevel || 'C3'}</strong></span>
                  <span>·</span>
                  <span>SOLO: <strong className="text-slate-600 dark:text-slate-300">{q.soloLevel || 'Multistructural'}</strong></span>
                  {q.basicCompetency && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-md">KD: {q.basicCompetency}</span>
                    </>
                  )}
                </div>
              </div>
            ))}

            {currentQuestions.length === 0 && (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                Belum ada butir soal pada ujian ini. Klik "Buat Soal Otomatis (Gemini AI)" atau "Tambah Soal Manual" di atas.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          SUB-TAB: CURRICULUM (CAPAIAN PEMBELAJARAN, ELEMEN & TP)
         --------------------------------------------------------- */}
      {activeTab === 'curriculum' && (
        <CurriculumManagement
          curriculumList={curriculumList}
          onSaveCurriculum={async (item) => {
            if (curriculumList.some(c => c.id === item.id)) {
              StorageService.updateCurriculumItem(item.id, item);
            } else {
              StorageService.addCurriculumItem(item);
            }
            const updated = StorageService.getCurriculum();
            setCurriculumList(updated);
            await GasClient.pushCurriculum(updated);
          }}
          onDeleteCurriculum={handleDeleteCurriculum}
          onSyncGas={async () => {
            const list = StorageService.getCurriculum();
            await GasClient.pushCurriculum(list);
          }}
          onResetDefaultTemplate={() => {
            StorageService.saveCurriculum([]);
            const reloaded = StorageService.getCurriculum();
            setCurriculumList(reloaded);
            GasClient.pushCurriculum(reloaded);
          }}
          onUseForQuestion={(item, tp) => {
            setActiveTab('questions');
            const targetExam = exams.find(e => e.subject.toLowerCase() === item.subject.toLowerCase()) || exams[0];
            if (targetExam) {
              setSelectedExamId(targetExam.id);
            }
            const currentQs = targetExam ? StorageService.getQuestionsByExamId(targetExam.id) : [];
            setEditingQuestion({
              order: currentQs.length + 1,
              prompt: tp ? `Berdasarkan tujuan pembelajaran '${tp}', jelaskan atau selesaikan pertanyaan berikut:` : '',
              type: 'multiple_choice',
              mediaType: 'none',
              mediaUrl: '',
              options: [
                { id: 'opt_a', text: 'Pilihan A' },
                { id: 'opt_b', text: 'Pilihan B' },
                { id: 'opt_c', text: 'Pilihan C' },
                { id: 'opt_d', text: 'Pilihan D' }
              ],
              correctKey: 'opt_a',
              points: 20,
              explanation: '',
              bloomLevel: 'C3 - Menerapkan',
              soloLevel: 'Multistructural',
              basicCompetency: `${item.subject} - ${item.element}`,
              indicator: tp || `Siswa mampu memahami ${item.element}`,
              element: item.element,
              learningOutcome: item.learningOutcome,
              learningObjective: tp || (item.learningObjectives && item.learningObjectives[0]) || ''
            });
            setIsQuestionModalOpen(true);
          }}
          exams={exams}
        />
      )}

      {/* ---------------------------------------------------------
          SUB-TAB 3: ANALYTICS & STUDENT SCORES
         --------------------------------------------------------- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Main Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Dasbor & Rekapitulasi Nilai Siswa</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Menampilkan {analyticsTotalCount} dari {safeSubmissions.length} rekaman hasil ujian siswa · Tersinkronisasi dengan Google Sheets
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleClearDummySubmissions}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg transition-colors no-print"
                title="Hapus data nilai dummy bawaan sistem"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan Nilai Dummy</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors no-print"
                title="Cetak lembar rekap nilai siswa"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Rekap</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg transition-colors no-print"
                title="Unduh seluruh rekaman nilai dalam format CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh CSV</span>
              </button>
            </div>
          </div>

          {/* Sub-tab Switcher: Rekapitulasi Nilai | Analisis Butir Soal & TP | Saran Remidi & Pengayaan */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 no-print overflow-x-auto">
            <button
              type="button"
              onClick={() => setAnalyticsViewMode('rekap')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                analyticsViewMode === 'rekap'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Rekapitulasi Nilai Siswa</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${analyticsViewMode === 'rekap' ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {safeSubmissions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAnalyticsViewMode('item_analysis')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                analyticsViewMode === 'item_analysis'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analisis Butir Soal & Tujuan Pembelajaran</span>
              {objectiveAnalysisList.length > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${analyticsViewMode === 'item_analysis' ? 'bg-indigo-700 text-white' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600'}`}>
                  {objectiveAnalysisList.length} TP
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAnalyticsViewMode('remedial')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 ${
                analyticsViewMode === 'remedial'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Saran Remidi & Pengayaan Siswa</span>
              {studentRecommendations.length > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${analyticsViewMode === 'remedial' ? 'bg-indigo-700 text-white' : 'bg-amber-50 dark:bg-amber-950 text-amber-600'}`}>
                  {studentRecommendations.filter(r => !r.passed).length} Remidi
                </span>
              )}
            </button>
          </div>

          {/* Sub-tab 1: Rekapitulasi Nilai Siswa */}
          {analyticsViewMode === 'rekap' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Interactive Filter & Search Controls */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 no-print">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Exam Selector Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Pilih Paket Ujian:
                </label>
                <select
                  value={analyticsExamFilter}
                  onChange={(e) => setAnalyticsExamFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="all">Semua Paket Ujian ({safeSubmissions.length} Nilai)</option>
                  {exams.map(e => {
                    const count = safeSubmissions.filter(s => String(s.examId || '').trim().toLowerCase() === String(e.id || '').trim().toLowerCase()).length;
                    return (
                      <option key={e.id} value={e.id}>
                        {e.subject} - {e.title} ({count} Nilai)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Class Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Filter Kelas:
                </label>
                <select
                  value={analyticsClassFilter}
                  onChange={(e) => setAnalyticsClassFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="all">Semua Kelas</option>
                  {submissionClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Status Kelulusan:
                </label>
                <select
                  value={analyticsStatusFilter}
                  onChange={(e) => setAnalyticsStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="all">Semua Status</option>
                  <option value="passed">Lulus (Tuntas KKM)</option>
                  <option value="remedial">Remedial</option>
                  <option value="tab-switch">Pernah Pindah Tab (Curang)</option>
                </select>
              </div>

              {/* Search Box */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Cari Siswa:
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={analyticsSearchQuery}
                    onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                    placeholder="Nama siswa, NIS, kelas..."
                    className="w-full pl-8 pr-7 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
                  />
                  {analyticsSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAnalyticsSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Filter tags & quick reset */}
            {(analyticsExamFilter !== 'all' || analyticsClassFilter !== 'all' || analyticsStatusFilter !== 'all' || analyticsSearchQuery.trim()) && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Filter aktif:</span>
                {analyticsExamFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] flex items-center gap-1">
                    Ujian: {exams.find(e => e.id === analyticsExamFilter)?.subject || analyticsExamFilter}
                    <button onClick={() => setAnalyticsExamFilter('all')} className="hover:text-indigo-900">×</button>
                  </span>
                )}
                {analyticsClassFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] flex items-center gap-1">
                    Kelas: {analyticsClassFilter}
                    <button onClick={() => setAnalyticsClassFilter('all')} className="hover:text-indigo-900">×</button>
                  </span>
                )}
                {analyticsStatusFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] flex items-center gap-1">
                    Status: {analyticsStatusFilter}
                    <button onClick={() => setAnalyticsStatusFilter('all')} className="hover:text-indigo-900">×</button>
                  </span>
                )}
                {analyticsSearchQuery && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] flex items-center gap-1">
                    Pencarian: "{analyticsSearchQuery}"
                    <button onClick={() => setAnalyticsSearchQuery('')} className="hover:text-indigo-900">×</button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAnalyticsExamFilter('all');
                    setAnalyticsClassFilter('all');
                    setAnalyticsStatusFilter('all');
                    setAnalyticsSearchQuery('');
                  }}
                  className="text-xs text-rose-600 hover:underline font-semibold ml-auto"
                >
                  Reset Semua Filter
                </button>
              </div>
            )}
          </div>

          {/* KPI Statistics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Peserta Masuk</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {analyticsTotalCount}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                dari total {safeSubmissions.length} nilai
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Rata-Rata Nilai</span>
              <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                {analyticsAvgScore}%
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {analyticsAvgScore >= 75 ? 'Memenuhi Standar' : 'Perlu Pengayaan'}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Tuntas KKM</span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {analyticsPassRate}%
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {analyticsPassCount} dari {analyticsTotalCount} siswa
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Tertinggi / Terendah</span>
              <div className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                <span className="text-emerald-600">{analyticsHighestScore}%</span>
                <span className="text-slate-300 dark:text-slate-700 mx-1">/</span>
                <span className="text-rose-500">{analyticsLowestScore}%</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Rentang nilai siswa
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-400 block mb-1">Pelanggaran Tab</span>
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {analyticsTotalTabSwitch}x
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Total kejadian curang
              </span>
            </div>
          </div>

          {/* Bulk Selection Bar for Submissions */}
          {selectedSubmissionIds.length > 0 && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between text-xs animate-fadeIn no-print">
              <span className="font-bold text-indigo-900 dark:text-indigo-200">
                {selectedSubmissionIds.length} data rekaman nilai dipilih dari {filteredAnalyticsSubmissions.length} nilai
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSubmissionIds([])}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                  Batal Pilih
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteSubmissions}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Terpilih ({selectedSubmissionIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Submissions Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Daftar Perolehan Nilai & Hasil Ujian
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Centang untuk memilih nilai, klik "Edit" untuk mengubah skor/status, atau "Rincian" untuk memeriksa lembar jawaban siswa.
                </p>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Total Data: <strong className="text-slate-900 dark:text-white">{filteredAnalyticsSubmissions.length}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 w-10 text-center no-print">
                      <input
                        type="checkbox"
                        checked={filteredAnalyticsSubmissions.length > 0 && selectedSubmissionIds.length === filteredAnalyticsSubmissions.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubmissionIds(filteredAnalyticsSubmissions.map(s => s.id));
                          } else {
                            setSelectedSubmissionIds([]);
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Pilih Semua Nilai"
                      />
                    </th>
                    <th className="p-3">NIS</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3">Paket Ujian</th>
                    <th className="p-3 text-center">Nilai (%)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center font-mono">Pindah Tab</th>
                    <th className="p-3 text-center font-mono">Durasi</th>
                    <th className="p-3 font-mono text-slate-400">Waktu Kirim</th>
                    <th className="p-3 text-right no-print">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyticsSubmissions.map(sub => {
                    const examObj = exams.find(e => String(e.id || '').trim().toLowerCase() === String(sub.examId || '').trim().toLowerCase());
                    const durationM = Math.floor((Number(sub.timeSpentSeconds) || 0) / 60);
                    const durationS = (Number(sub.timeSpentSeconds) || 0) % 60;
                    const dateFormatted = sub.submittedAt
                      ? new Date(sub.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : '-';
                    const isSelected = selectedSubmissionIds.includes(sub.id);

                    return (
                      <tr 
                        key={sub.id} 
                        className={`border-b border-slate-100 dark:border-slate-800/60 transition-colors ${
                          isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="p-3 text-center no-print">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSubmissionIds(prev => [...prev, sub.id]);
                              } else {
                                setSelectedSubmissionIds(prev => prev.filter(id => id !== sub.id));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-medium">{sub.studentNo}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">{sub.studentName}</td>
                        <td className="p-3 text-slate-500">{sub.classGrade}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={examObj?.title || sub.examId}>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400 mr-1">
                            {examObj?.subject || 'Ujian'}:
                          </span>
                          {examObj?.title || sub.examId}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                          {Number(sub.percentage) || 0}%
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            sub.passed
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}>
                            {sub.passed ? 'LULUS' : 'REMEDIAL'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">
                          {(Number(sub.tabSwitchCount) || 0) > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold">
                              {sub.tabSwitchCount}x
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500">
                          {durationM}m {durationS}s
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[11px]">
                          {dateFormatted}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap no-print">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingSubmission(sub)}
                              className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-colors"
                              title="Lihat rincian lembar jawaban siswa"
                            >
                              Rincian
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditSubmission(sub)}
                              className="px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center gap-1 font-medium"
                              title="Edit nilai dan status siswa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Hapus rekaman nilai ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAnalyticsSubmissions.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-10 text-center">
                        {safeSubmissions.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Tidak ada nilai siswa yang cocok dengan filter atau kata kunci saat ini.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setAnalyticsExamFilter('all');
                                setAnalyticsClassFilter('all');
                                setAnalyticsStatusFilter('all');
                                setAnalyticsSearchQuery('');
                              }}
                              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-xs font-semibold rounded-lg transition-colors"
                            >
                              Reset Filter & Tampilkan Semua Nilai
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4 max-w-md mx-auto">
                            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                              <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                              <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                Belum Ada Nilai Siswa yang Masuk
                              </h5>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Nilai akan otomatis muncul di sini setelah siswa menyelesaikan ujian. Anda juga dapat menekan tombol <strong>Sync Sheets</strong> untuk mengambil data terbaru yang tersimpan di Google Sheets.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setActiveTab('exams')}
                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Bagikan Link Ujian ke Siswa</span>
                              </button>
                              <button
                                type="button"
                                onClick={onRefreshData}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Perbarui Data</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Analisis Butir Soal & Tujuan Pembelajaran */}
      {analyticsViewMode === 'item_analysis' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Exam Selector & Analysis Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Analisis Butir Soal & Ketercapaian Tujuan Pembelajaran (TP)</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Evaluasi psikometrik validitas empirik butir soal (Tingkat Kesukaran & Daya Pembeda) dan ketuntasan TP kurikulum.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Paket Ujian:
                </label>
                <select
                  value={targetAnalysisExam?.id || ''}
                  onChange={(e) => {
                    setSelectedExamId(e.target.value);
                    setAnalyticsExamFilter(e.target.value);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.subject} - {e.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors no-print"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Analisis</span>
              </button>
            </div>
          </div>

          {/* KPI Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Butir Soal & Peserta</span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {targetAnalysisQuestions.length} <span className="text-xs font-normal text-slate-400">Soal / {targetAnalysisSubmissions.length} Siswa</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {targetAnalysisExam?.subject || 'Mata Pelajaran'}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Ketuntasan TP Kelas</span>
              <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                {objectiveAnalysisList.length > 0 
                  ? Math.round((objectiveAnalysisList.filter(o => o.status === 'Tuntas').length / objectiveAnalysisList.length) * 100) 
                  : 0}%
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {objectiveAnalysisList.filter(o => o.status === 'Tuntas').length} dari {objectiveAnalysisList.length} TP Tuntas
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Rata-rata Tingkat Kesukaran (P)</span>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {questionAnalysisList.length > 0 
                  ? (questionAnalysisList.reduce((acc, q) => acc + q.difficultyIndex, 0) / questionAnalysisList.length).toFixed(2)
                  : '0.00'}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Ideal: 0.30 - 0.70 (Sedang)
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Rata-rata Daya Pembeda (D)</span>
              <div className="text-2xl font-extrabold text-violet-600 dark:text-violet-400 font-mono">
                {questionAnalysisList.length > 0 
                  ? (questionAnalysisList.reduce((acc, q) => acc + q.discriminationIndex, 0) / questionAnalysisList.length).toFixed(2)
                  : '0.00'}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Ideal: &ge; 0.30 (Baik/Sangat Baik)
              </span>
            </div>
          </div>

          {/* Tabel 1: Analisis Ketercapaian per Tujuan Pembelajaran (TP) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>1. Analisis Ketercapaian per Tujuan Pembelajaran (TP)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribusi ketuntasan materi pembelajaran berdasarkan perolehan skor butir soal terkait.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {objectiveAnalysisList.length} Tujuan Pembelajaran
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 w-12 text-center">No.</th>
                    <th className="p-3 min-w-[280px]">Tujuan Pembelajaran (TP)</th>
                    <th className="p-3 text-center min-w-[120px]">Butir Terkait</th>
                    <th className="p-3 text-center min-w-[140px]">Rata-Rata Penguasaan</th>
                    <th className="p-3 text-center min-w-[140px]">Siswa Tuntas / Belum</th>
                    <th className="p-3 text-center min-w-[120px]">Status TP</th>
                    <th className="p-3 min-w-[200px]">Rekomendasi Tindak Lanjut</th>
                  </tr>
                </thead>
                <tbody>
                  {objectiveAnalysisList.map((obj, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 text-center font-mono font-bold">{idx + 1}</td>
                      <td className="p-3 font-medium text-slate-900 dark:text-white leading-relaxed">
                        {obj.objective}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {obj.questionOrders.map(ord => (
                            <span key={ord} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              #{ord}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                            {obj.averageMastery}%
                          </span>
                          <div className="w-20 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${obj.averageMastery >= 75 ? 'bg-emerald-500' : obj.averageMastery >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${obj.averageMastery}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono text-xs">
                        <span className="text-emerald-600 font-bold">{obj.masteredStudentCount} Tuntas</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-rose-500 font-bold">{obj.unmasteredStudentCount} Belum</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-bold ${
                          obj.status === 'Tuntas'
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : obj.status === 'Perlu Perbaikan'
                            ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                          {obj.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                        {obj.status === 'Tuntas' 
                          ? 'Pertahankan pemahaman dan berikan materi pengayaan kontekstual.' 
                          : obj.status === 'Perlu Perbaikan' 
                          ? 'Bimbingan terfokus pada indikator butir soal terkait dan latihan terstruktur.' 
                          : 'Remedial intensif klasikal, pembedahan miskonsepsi, dan asesmen ulang.'}
                      </td>
                    </tr>
                  ))}

                  {objectiveAnalysisList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Belum ada butir soal atau nilai ujian yang dapat dianalisis untuk paket ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel 2: Analisis Butir Soal Lengkap */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>2. Analisis Butir Soal Empirik (Tingkat Kesukaran & Daya Pembeda)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klasifikasi psikometrik standar Kemendikbudristek untuk mengevaluasi mutu dan daya diskriminasi setiap butir soal.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {questionAnalysisList.length} Butir Soal
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 w-10 text-center font-mono">No.</th>
                    <th className="p-3 min-w-[240px]">Pertanyaan Soal & Tipe</th>
                    <th className="p-3 min-w-[120px]">Taksonomi</th>
                    <th className="p-3 min-w-[200px]">Tujuan Pembelajaran (TP)</th>
                    <th className="p-3 text-center min-w-[100px]">Benar (%)</th>
                    <th className="p-3 text-center min-w-[130px]">Tingkat Kesukaran (P)</th>
                    <th className="p-3 text-center min-w-[140px]">Daya Pembeda (D)</th>
                    <th className="p-3 min-w-[140px]">Rekomendasi Butir</th>
                  </tr>
                </thead>
                <tbody>
                  {questionAnalysisList.map((qa) => {
                    const bentukStr = qa.type === 'multiple_choice' ? 'PG' : qa.type === 'checkbox' ? 'PG Kompleks' : 'Uraian';
                    return (
                      <tr key={qa.questionId} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-center font-mono font-bold">{qa.order}</td>
                        <td className="p-3">
                          <p className="font-medium text-slate-900 dark:text-white line-clamp-2 leading-relaxed">
                            {qa.prompt}
                          </p>
                          <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {bentukStr}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          {qa.bloomLevel || 'C3'}
                        </td>
                        <td className="p-3 text-[11px] text-slate-700 dark:text-slate-300 leading-tight">
                          {qa.learningObjective}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {qa.correctRate}%
                          <span className="block text-[10px] font-normal text-slate-400">
                            ({qa.correctCount}/{qa.totalAttempts})
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-mono font-bold text-xs block">
                            P = {qa.difficultyIndex}
                          </span>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            qa.difficultyLevel === 'Sedang'
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : qa.difficultyLevel === 'Mudah' || qa.difficultyLevel === 'Sukar'
                              ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}>
                            {qa.difficultyLevel}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-mono font-bold text-xs block">
                            D = {qa.discriminationIndex}
                          </span>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            qa.discriminationStatus === 'Sangat Baik' || qa.discriminationStatus === 'Baik'
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : qa.discriminationStatus === 'Cukup'
                              ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}>
                            {qa.discriminationStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold ${
                            qa.discriminationIndex >= 0.30
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : qa.discriminationIndex >= 0.20
                              ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}>
                            {qa.discriminationIndex >= 0.30
                              ? 'Diterima (Mutu Baik)'
                              : qa.discriminationIndex >= 0.20
                              ? 'Revisi Pengecoh'
                              : 'Revisi Total / Buang'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {questionAnalysisList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Belum ada data butir soal yang dianalisis.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 3: Saran Remidi & Pengayaan Siswa */}
      {analyticsViewMode === 'remedial' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Program & Rekomendasi Remidi / Pengayaan per Siswa</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Rekomendasi tindak lanjut individual yang otomatis disesuaikan dengan Tujuan Pembelajaran yang belum vs sudah dikuasai siswa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Lembar Remidi & Pengayaan</span>
              </button>
            </div>
          </div>

          {/* Status KPI Summary for Remedial */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Total Siswa Peserta</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {studentRecommendations.length} Siswa
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Tuntas KKM (Pengayaan)</span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {studentRecommendations.filter(r => r.passed).length}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {studentRecommendations.length > 0 ? Math.round((studentRecommendations.filter(r => r.passed).length / studentRecommendations.length) * 100) : 0}% dari peserta
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Perlu Remedial</span>
              <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                {studentRecommendations.filter(r => !r.passed).length}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {studentRecommendations.length > 0 ? Math.round((studentRecommendations.filter(r => !r.passed).length / studentRecommendations.length) * 100) : 0}% dari peserta
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Batas Kelulusan (KKM)</span>
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {targetAnalysisExam?.passingScore || 75}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Skor minimum kelulusan
              </span>
            </div>
          </div>

          {/* Student Cards List */}
          <div className="space-y-4">
            {filteredStudentRecommendations.map((rec) => (
              <div 
                key={rec.studentNo}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-shadow shadow-xs ${
                  !rec.passed
                    ? 'border-amber-200 dark:border-amber-900/60'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Header info per student */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      rec.passed 
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    }`}>
                      {rec.studentName.charAt(0)}
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{rec.studentName}</span>
                        <span className="text-xs font-normal text-slate-400 font-mono">({rec.studentNo})</span>
                      </h5>
                      <span className="text-xs text-slate-500">
                        Kelas {rec.classGrade} · Ujian: {targetAnalysisExam?.subject} ({targetAnalysisExam?.title})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Nilai Ujian</span>
                      <span className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                        {rec.percentage}%
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                      rec.passed
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {rec.passed ? 'Lulus / Tuntas KKM' : 'Perlu Remedial'}
                    </span>
                  </div>
                </div>

                {/* Breakdown TP & Plans */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                  {/* Left: Program Remedial (Tujuan Pembelajaran Belum Tuntas) */}
                  <div className="p-4 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h6 className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Tujuan Pembelajaran Belum Dikuasai ({rec.unmasteredObjectives.length})</span>
                      </h6>
                      <span className="text-[10px] font-semibold text-rose-600 uppercase font-mono">
                        Program Remidi
                      </span>
                    </div>

                    {rec.unmasteredObjectives.length > 0 ? (
                      <div className="space-y-1.5">
                        {rec.unmasteredObjectives.map((tp, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/50 text-xs">
                            <span className="font-mono text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded shrink-0">
                              TP
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 text-[11px] leading-tight">
                              {tp}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium py-1">
                        Siswa telah menjawab benar seluruh indikator butir soal!
                      </p>
                    )}

                    {/* Rencana Tindak Lanjut Remidi */}
                    <div className="pt-2 border-t border-rose-200/60 dark:border-rose-900/40">
                      <span className="text-[11px] font-bold text-rose-900 dark:text-rose-200 block mb-1">
                        Saran Langkah Intervensi Remedial:
                      </span>
                      <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300 list-disc list-inside">
                        {rec.remedialPlan.map((plan, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {plan}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right: Program Pengayaan (Tujuan Pembelajaran Sudah Dikuasai) */}
                  <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h6 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Tujuan Pembelajaran Dikuasai ({rec.masteredObjectives.length})</span>
                      </h6>
                      <span className="text-[10px] font-semibold text-emerald-600 uppercase font-mono">
                        Program Pengayaan
                      </span>
                    </div>

                    {rec.masteredObjectives.length > 0 ? (
                      <div className="space-y-1.5">
                        {rec.masteredObjectives.map((tp, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/50 text-xs">
                            <span className="font-mono text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded shrink-0">
                              TP
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 text-[11px] leading-tight">
                              {tp}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-1">
                        Belum ada TP yang tuntas penuh. Prioritaskan program perbaikan remedial.
                      </p>
                    )}

                    {/* Rencana Tindak Lanjut Pengayaan */}
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                      <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 block mb-1">
                        Saran Langkah Pengembangan Pengayaan:
                      </span>
                      <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300 list-disc list-inside">
                        {rec.enrichmentPlan.map((plan, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {plan}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredStudentRecommendations.length === 0 && (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                Belum ada rekaman nilai siswa untuk dianalisis pada paket ujian ini.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )}

      {/* ---------------------------------------------------------
          SUB-TAB 4: SCHOOL PROFILE & LOGO EDITOR
         --------------------------------------------------------- */}
      {activeTab === 'profile' && (
        <div className="max-w-3xl space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Edit Profil Sekolah & Logo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Logo dan identitas sekolah akan otomatis terpasang pada halaman login siswa, lembar ujian, dan kop kisi-kisi soal.
            </p>
          </div>

          {profileSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            {/* Logo Section */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Logo Sekolah
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {profileForm.logoUrl ? (
                  <img
                    src={profileForm.logoUrl}
                    alt="Logo Sekolah"
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-xl object-contain bg-white border border-slate-300 dark:border-slate-700 shadow-xs p-1"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold">
                    Tanpa Logo
                  </div>
                )}

                <div className="flex-1 space-y-2 w-full">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      URL Gambar Logo (atau upload file di bawah):
                    </label>
                    <input
                      type="url"
                      placeholder="https://domain.sch.id/logo.png"
                      value={profileForm.logoUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, logoUrl: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah Logo dari Perangkat (Base64)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* General Profile Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Resmi Sekolah / Lembaga
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  NPSN
                </label>
                <input
                  type="text"
                  value={profileForm.npsn}
                  onChange={(e) => setProfileForm({ ...profileForm, npsn: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tahun Ajaran
                </label>
                <input
                  type="text"
                  value={profileForm.academicYear}
                  onChange={(e) => setProfileForm({ ...profileForm, academicYear: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alamat Lengkap Sekolah
                </label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={profileForm.principalName}
                  onChange={(e) => setProfileForm({ ...profileForm, principalName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  NIP Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={profileForm.principalNip}
                  onChange={(e) => setProfileForm({ ...profileForm, principalNip: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Dedicated Teacher Profile Section */}
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  Data Guru Pengampu / Koordinator Ujian
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Lengkap Guru Pengampu
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.teacherName || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, teacherName: e.target.value })}
                    placeholder="Contoh: Siti Rahmawati, S.Pd."
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    NIP Guru Pengampu
                  </label>
                  <input
                    type="text"
                    value={profileForm.teacherNip || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, teacherNip: e.target.value })}
                    placeholder="Contoh: 19820514 200801 2 009"
                    className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mata Pelajaran yang Diampu
                  </label>
                  <input
                    type="text"
                    value={profileForm.teacherSubject || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, teacherSubject: e.target.value })}
                    placeholder="Contoh: Biologi & Sains Lingkungan"
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Kontak Guru
                  </label>
                  <input
                    type="email"
                    value={profileForm.teacherEmail || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, teacherEmail: e.target.value })}
                    placeholder="Contoh: guru@sekolah.sch.id"
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gelar / Jabatan / Tugas Tambahan
                  </label>
                  <input
                    type="text"
                    value={profileForm.teacherTitle || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, teacherTitle: e.target.value })}
                    placeholder="Contoh: Koordinator Kurikulum & Tim Penilaian Sekolah"
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              Simpan Profil Sekolah & Guru
            </button>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------------
          SUB-TAB 4: STUDENT ROSTER (Daftar Siswa Terdaftar)
         --------------------------------------------------------- */}
      {activeTab === 'students' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Main Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Daftar Siswa Terdaftar</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                  {students.length} Siswa
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kelola data siswa, impor dari spreadsheet secara massal, dan simpan langsung ke Google Sheets.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkStudentResult(null);
                  setBulkStudentText('');
                  setIsBulkStudentModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Input Massal (Bulk)</span>
              </button>

              <button
                type="button"
                onClick={handleSaveStudentsToSheets}
                disabled={isSavingStudentsToSheets}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {isSavingStudentsToSheets ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSavingStudentsToSheets ? 'Menyimpan ke Sheets...' : 'Simpan Data Siswa ke Sheets'}</span>
              </button>
            </div>
          </div>

          {/* Sync / Notification Banner */}
          {studentSyncMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border animate-fadeIn ${
                studentSyncMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              {studentSyncMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <div className="flex-1">{studentSyncMsg.text}</div>
            </div>
          )}

          {/* Add Single Student Form */}
          <form onSubmit={handleAddStudent} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="NIS / NISN (contoh: 1007)"
              value={studentForm.studentNo}
              onChange={(e) => setStudentForm({ ...studentForm, studentNo: e.target.value })}
              className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              required
              placeholder="Nama Lengkap Siswa"
              value={studentForm.fullName}
              onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Kelas (contoh: X MIPA 1)"
              value={studentForm.classGrade}
              onChange={(e) => setStudentForm({ ...studentForm, classGrade: e.target.value })}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors shrink-0 flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Tambah Siswa</span>
            </button>
          </form>

          {/* Bulk Selection Actions Bar */}
          {selectedStudentIds.length > 0 && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs animate-fadeIn">
              <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                {selectedStudentIds.length} siswa terpilih dari {students.length} total siswa
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Batal Pilih
                </button>
                <button
                  type="button"
                  onClick={() => setStudentDeleteConfirm('bulk')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Terpilih ({selectedStudentIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Student List Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={students.length > 0 && selectedStudentIds.length === students.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentIds(students.map(s => s.id));
                          } else {
                            setSelectedStudentIds([]);
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Pilih Semua Siswa"
                      />
                    </th>
                    <th className="p-3">NIS</th>
                    <th className="p-3">Nama Lengkap</th>
                    <th className="p-3">Kelas / Rombel</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Belum ada siswa terdaftar. Tambahkan siswa secara manual atau gunakan tombol "Input Massal (Bulk)".
                      </td>
                    </tr>
                  ) : (
                    students.map(s => {
                      const isSelected = selectedStudentIds.includes(s.id);
                      return (
                        <tr 
                          key={s.id} 
                          className={`border-b border-slate-100 dark:border-slate-800/60 transition-colors ${
                            isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIds(prev => [...prev, s.id]);
                                } else {
                                  setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-mono font-medium text-slate-700 dark:text-slate-300">{s.studentNo}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">{s.fullName}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{s.classGrade}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                              Aktif
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingStudent({ ...s })}
                                className="px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
                                title="Edit Siswa"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentDeleteConfirm({ id: s.id, name: s.fullName })}
                                className="px-2 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors flex items-center gap-1"
                                title="Hapus Siswa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          SUB-TAB 5: USER ACCOUNTS MANAGEMENT (Admin & Guru)
         --------------------------------------------------------- */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Main Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCog className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Manajemen Akun Pengguna & Guru</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                  {systemUsers.length} Akun
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kelola hak akses sistem, tambah akun guru baru, edit informasi login, dan simpan langsung ke Google Sheets.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleClearDummyUsers}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold text-xs rounded-xl transition-colors border border-rose-200 dark:border-rose-900/60"
                title="Hapus akun demo dummy bawaan sistem"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan Akun Dummy</span>
              </button>

              <button
                type="button"
                onClick={handleSaveUsersToSheets}
                disabled={isSavingUsersToSheets}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {isSavingUsersToSheets ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSavingUsersToSheets ? 'Menyimpan ke Sheets...' : 'Simpan Akun ke Sheets'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddUser}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Tambah Pengguna Baru</span>
              </button>
            </div>
          </div>

          {/* Sync / Notification Banner */}
          {userSyncMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border animate-fadeIn ${
                userSyncMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              {userSyncMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <div className="flex-1">{userSyncMsg.text}</div>
            </div>
          )}

          {/* User Accounts Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3">Username</th>
                    <th className="p-3">Nama Lengkap</th>
                    <th className="p-3">Peran / Hak Akses</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {systemUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Belum ada akun pengguna terdaftar. Klik tombol "Tambah Pengguna Baru" untuk membuat akun guru atau admin.
                      </td>
                    </tr>
                  ) : (
                    systemUsers.map(u => (
                      <tr 
                        key={u.id}
                        className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{u.username}</span>
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{u.fullName}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                            u.role === 'admin'
                              ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          }`}>
                            {u.role === 'admin' ? 'Administrator' : 'Guru Pengampu'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {u.email || '-'}
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.active !== false
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                          }`}>
                            {u.active !== false ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              className="px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 font-medium"
                              title="Edit Akun Pengguna"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setUserDeleteConfirm({ id: u.id, username: u.username, fullName: u.fullName })}
                              className="px-2.5 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-1 font-medium"
                              title="Hapus Akun Pengguna"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          SUB-TAB 6: GOOGLE APPS SCRIPT BACKEND CODE
         --------------------------------------------------------- */}
      {activeTab === 'gas' && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Pemasangan Backend Google Apps Script (GAS)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Salin kode di bawah ini ke editor Apps Script Google Spreadsheet Anda untuk mengaktifkan database dan sinkronisasi real-time.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                Code.gs (Apps Script Engine)
              </span>

              <button
                onClick={handleCopyGasCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{hasCopiedGas ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Kode'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                {GAS_BACKEND_SCRIPT}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 space-y-2">
              <h5 className="font-bold">Langkah Cepat Deployment:</h5>
              <ol className="list-decimal list-inside space-y-1">
                <li>Buka Spreadsheet Google Anda baru $\to$ klik <strong>Ekstensi</strong> $\to$ <strong>Apps Script</strong>.</li>
                <li>Tempelkan kode di atas $\to$ jalankan fungsi <code className="bg-indigo-200 dark:bg-indigo-900 px-1 py-0.5 rounded">initDatabase</code> untuk membuat 7 tab sheet otomatis.</li>
                <li>Klik tombol <strong>Deploy (Terapkan)</strong> $\to$ <strong>New Deployment (Penerapan baru)</strong> $\to$ pilih jenis <strong>Web App</strong>.</li>
                <li>Atur "Who has access (Yang memiliki akses)" ke <strong>Anyone (Siapa saja)</strong> agar siswa dapat mengirim jawaban tanpa login akun Google.</li>
                <li>Salin Web App URL dan tempelkan ke menu <strong>Pengaturan</strong> aplikasi ini!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: AI QUESTION GENERATOR
         --------------------------------------------------------- */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Generator Soal Otomatis (Gemini AI)
                </h3>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {aiMessage && (
              <div className="mb-4 p-3 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                {aiMessage}
              </div>
            )}

            <div className="space-y-4">
              {/* Mata Pelajaran & Kelas Tujuan (Menggantikan label Target Ujian) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mata Pelajaran & Kelas Tujuan
                </label>
                <select
                  value={selectedExamId || exams[0]?.id || ''}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold"
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.subject} — Kelas {e.grade} (Ujian: {e.title})
                    </option>
                  ))}
                </select>

                {/* Info Card Mata Pelajaran & Kelas */}
                {(() => {
                  const targetExamObj = exams.find(e => e.id === (selectedExamId || exams[0]?.id)) || exams[0];
                  if (!targetExamObj) return null;
                  const currentCount = StorageService.getQuestionsByExamId(targetExamObj.id).length;
                  return (
                    <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{targetExamObj.subject}</span>
                        <span>·</span>
                        <span className="font-semibold">Kelas {targetExamObj.grade}</span>
                        <span>·</span>
                        <span className="text-slate-500 truncate max-w-[150px]">{targetExamObj.title}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        {currentCount} Soal Ada
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Topic / Materi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Topik / Materi Soal
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Contoh: Hukum Archimedes & Tekanan Zat Cair"
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              {/* Dropdown Capaian Pembelajaran, Elemen & TP (Kurikulum Merdeka) */}
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Pilih Capaian Pembelajaran & Elemen (Kurikulum Merdeka)</span>
                  </label>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    {curriculumList.length} CP Tersimpan
                  </span>
                </div>

                <select
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (!selectedId) return;
                    const cur = curriculumList.find(c => c.id === selectedId);
                    if (cur) {
                      setAiTopic(`${cur.subject}: ${cur.element}`);
                      if (cur.learningObjectives && cur.learningObjectives.length > 0) {
                        setAiLearningObjectives(cur.learningObjectives.slice(0, 15));
                      }
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                >
                  <option value="">-- Pilih Capaian Pembelajaran / Elemen Kurikulum --</option>
                  {curriculumList.map((cur) => (
                    <option key={cur.id} value={cur.id}>
                      [{cur.subject}] {cur.element} — {cur.learningOutcome.length > 60 ? cur.learningOutcome.slice(0, 60) + '...' : cur.learningOutcome}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => {
                      const tpVal = e.target.value;
                      if (tpVal && !aiLearningObjectives.includes(tpVal) && aiLearningObjectives.length < 15) {
                        setAiLearningObjectives(prev => [...prev, tpVal]);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Tambah Tujuan Pembelajaran (TP) Spesifik ke Daftar --</option>
                    {curriculumList.flatMap(c => c.learningObjectives.map((tp, idx) => ({ key: `${c.id}-${idx}`, label: `[${c.subject}] ${tp}`, text: tp }))).map(item => (
                      <option key={item.key} value={item.text} disabled={aiLearningObjectives.includes(item.text)}>
                        {item.label.length > 80 ? item.label.slice(0, 80) + '...' : item.label} {aiLearningObjectives.includes(item.text) ? '(Sudah Ada)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tujuan Pembelajaran (TP) — Mendukung hingga 15 TP */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Tujuan Pembelajaran (TP) — Dukung Hingga 15 TP</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const targetExamObj = exams.find(e => e.id === (selectedExamId || exams[0]?.id)) || exams[0];
                      if (targetExamObj?.learningObjectives && targetExamObj.learningObjectives.length > 0) {
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setAiLearningObjectives(targetExamObj.learningObjectives!.slice(0, 15));
                            }}
                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            title="Ambil daftar TP dari konfigurasi data ujian ini"
                          >
                            <Download className="w-3 h-3" />
                            <span>Muat dari Ujian</span>
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                      {aiLearningObjectives.length}/15 TP
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAiTpInput}
                    onChange={(e) => setNewAiTpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newAiTpInput.trim() && aiLearningObjectives.length < 15) {
                          setAiLearningObjectives(prev => [...prev, newAiTpInput.trim()]);
                          setNewAiTpInput('');
                        }
                      }
                    }}
                    placeholder="Ketik Tujuan Pembelajaran lalu tekan Enter atau Tambah"
                    disabled={aiLearningObjectives.length >= 15}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newAiTpInput.trim() && aiLearningObjectives.length < 15) {
                        setAiLearningObjectives(prev => [...prev, newAiTpInput.trim()]);
                        setNewAiTpInput('');
                      }
                    }}
                    disabled={aiLearningObjectives.length >= 15 || !newAiTpInput.trim()}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah TP</span>
                  </button>
                </div>

                {/* TP list chips */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {aiLearningObjectives.map((tp, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-2xs">
                      <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded shrink-0">
                        TP {idx + 1}
                      </span>
                      <span className="flex-1 text-[11px] text-slate-800 dark:text-slate-200 leading-tight">
                        {tp}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAiLearningObjectives(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-slate-400 hover:text-rose-500 p-0.5 transition-colors"
                        title="Hapus TP ini"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {aiLearningObjectives.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">
                      Belum ada Tujuan Pembelajaran. Tambahkan minimal 1 TP agar butir soal yang digenerate AI lebih presisi dan sesuai kurikulum.
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  AI akan mendistribusikan pembuatan soal secara akurat dan merata ke seluruh Tujuan Pembelajaran yang Anda cantumkan di atas.
                </p>
              </div>

              {/* Bentuk Soal Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bentuk Soal
                </label>
                <select
                  value={aiQuestionType}
                  onChange={(e: any) => setAiQuestionType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                >
                  <option value="multiple_choice">Pilihan Ganda Biasa (1 Jawaban Benar)</option>
                  <option value="checkbox">Pilihan Ganda Kompleks (Multi Jawaban Benar)</option>
                  <option value="true_false">Benar / Salah (2 Opsi)</option>
                  <option value="essay">Uraian / Isian Singkat</option>
                  <option value="mixed">Campuran / Variatif (PG, PG Kompleks & Uraian)</option>
                </select>
              </div>

              {/* Jumlah Soal (Up to 50 Butir Soal) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Jumlah Soal (Mendukung hingga 50 Butir)
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {aiCount} Butir
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={aiCount}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setAiCount(Math.min(50, Math.max(1, isNaN(val) ? 1 : val)));
                      }}
                      className="w-24 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                    <span className="text-xs text-slate-400">Pilih cepat:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[5, 10, 15, 20, 25, 30, 40, 50].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setAiCount(cnt)}
                        className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors ${
                          aiCount === cnt
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {cnt} Soal
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tingkat Kesulitan & Kerangka Taksonomi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tingkat Kesulitan
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e: any) => setAiDifficulty(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="Mudah">Mudah</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Sukar">Sukar (HOTS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kerangka Taksonomi
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAiTaxonomy('bloom')}
                      className={`p-2 text-[11px] font-semibold rounded-lg border text-center transition-all ${
                        aiTaxonomy === 'bloom'
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-600 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Bloom-Anderson
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiTaxonomy('solo')}
                      className={`p-2 text-[11px] font-semibold rounded-lg border text-center transition-all ${
                        aiTaxonomy === 'solo'
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-600 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Taksonomi SOLO
                    </button>
                  </div>
                </div>
              </div>

              {/* Warning if API key is missing */}
              {!StorageService.getSettings().geminiApiKey?.trim() && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Kunci API Gemini belum diatur.</p>
                    <p className="text-[11px] mt-0.5 opacity-90">Masukkan kunci API Gemini Anda di menu Pengaturan agar AI dapat memproses pembuatan soal.</p>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAiModalOpen(false);
                          onOpenSettings();
                        }}
                        className="mt-2 px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                      >
                        Buka Menu Pengaturan
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isGeneratingAi}
                  onClick={handleGenerateAiQuestions}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isGeneratingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isGeneratingAi ? 'Menghasilkan & Menyimpan Soal...' : `Generate, Simpan & Tutup (${aiCount} Soal AI)`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: CREATE / EDIT EXAM
         --------------------------------------------------------- */}
      {isExamModalOpen && editingExam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingExam.id ? 'Edit Data Ujian' : 'Buat Ujian Baru'}
            </h3>

            <form onSubmit={handleSaveExam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Ujian
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Penilaian Harian: Listrik Dinamis"
                  value={editingExam.title || ''}
                  onChange={(e) => setEditingExam({ ...editingExam, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Fisika"
                    value={editingExam.subject || ''}
                    onChange={(e) => setEditingExam({ ...editingExam, subject: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tingkat Kelas
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: XI MIPA"
                    value={editingExam.grade || ''}
                    onChange={(e) => setEditingExam({ ...editingExam, grade: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={editingExam.durationMinutes || 60}
                    onChange={(e) => setEditingExam({ ...editingExam, durationMinutes: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Batas Kelulusan (KKM)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editingExam.passingScore || 75}
                    onChange={(e) => setEditingExam({ ...editingExam, passingScore: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Token Akses Masuk (Opsional)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const token = generateRandomToken(editingExam.subject);
                        setEditingExam({ ...editingExam, token });
                      }}
                      className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1 transition-colors"
                      title="Acak kode token baru"
                    >
                      <Dices className="w-3 h-3" />
                      <span>Acak Token</span>
                    </button>
                    {editingExam.token && (
                      <button
                        type="button"
                        onClick={() => setEditingExam({ ...editingExam, token: '' })}
                        className="px-2 py-0.5 text-[11px] rounded text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        Hapus Token
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Kosongkan jika tanpa token (siswa boleh masuk langsung)"
                  value={editingExam.token || ''}
                  onChange={(e) => setEditingExam({ ...editingExam, token: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              {/* Tujuan Pembelajaran (TP) — Hingga 15 TP */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Tujuan Pembelajaran (TP) Ujian (Maks. 15 TP)</span>
                  </label>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold">
                    {(editingExam.learningObjectives || []).length}/15 TP
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Tambah TP baru (misal: Menganalisis cara kerja transformator)"
                    value={newExamTpInput}
                    onChange={(e) => setNewExamTpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newExamTpInput.trim()) {
                          const currentList = editingExam.learningObjectives || [];
                          if (currentList.length < 15) {
                            setEditingExam({ ...editingExam, learningObjectives: [...currentList, newExamTpInput.trim()] });
                            setNewExamTpInput('');
                          }
                        }
                      }
                    }}
                    disabled={(editingExam.learningObjectives || []).length >= 15}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newExamTpInput.trim()) {
                        const currentList = editingExam.learningObjectives || [];
                        if (currentList.length < 15) {
                          setEditingExam({ ...editingExam, learningObjectives: [...currentList, newExamTpInput.trim()] });
                          setNewExamTpInput('');
                        }
                      }
                    }}
                    disabled={(editingExam.learningObjectives || []).length >= 15 || !newExamTpInput.trim()}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>

                {/* List of TP */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {(editingExam.learningObjectives || []).map((tp, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0 font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded">
                        TP {idx + 1}
                      </span>
                      <span className="flex-1 text-slate-800 dark:text-slate-200 text-[11px] leading-tight">
                        {tp}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (editingExam.learningObjectives || []).filter((_, i) => i !== idx);
                          setEditingExam({ ...editingExam, learningObjectives: updated });
                        }}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-0.5"
                        title="Hapus TP ini"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(!editingExam.learningObjectives || editingExam.learningObjectives.length === 0) && (
                    <p className="text-[11px] text-slate-400 italic py-1">
                      Belum ada TP spesifik. TP dapat ditambahkan sekarang atau otomatis tersinkron saat men-generate soal AI.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingExam.isStrict)}
                    onChange={(e) => setEditingExam({ ...editingExam, isStrict: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Aktifkan Mode Ketat (Deteksi Pindah Tab & Pengawas Anti-Curang)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingExam.allowReview)}
                    onChange={(e) => setEditingExam({ ...editingExam, allowReview: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-slate-600 dark:text-slate-300">
                    Tampilkan Nilai & Pembahasan Langsung ke Siswa Setelah Selesai
                  </span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExamModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm"
                >
                  Simpan Ujian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: CREATE / EDIT QUESTION (Manual with Media)
         --------------------------------------------------------- */}
      {isQuestionModalOpen && editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingQuestion.id ? 'Edit Butir Soal' : 'Tambah Butir Soal Baru'}
            </h3>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              {/* Bentuk Soal Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bentuk Soal
                </label>
                <select
                  value={editingQuestion.type === 'multiple_choice' && editingQuestion.options?.length === 2 && editingQuestion.options[0]?.text === 'Benar' ? 'true_false' : editingQuestion.type || 'multiple_choice'}
                  onChange={(e) => {
                    const newType = e.target.value;
                    if (newType === 'essay') {
                      setEditingQuestion({
                        ...editingQuestion,
                        type: 'essay',
                        options: [],
                        correctKey: typeof editingQuestion.correctKey === 'string' ? editingQuestion.correctKey : ''
                      });
                    } else if (newType === 'checkbox') {
                      setEditingQuestion({
                        ...editingQuestion,
                        type: 'checkbox',
                        options: (editingQuestion.options && editingQuestion.options.length > 0 && editingQuestion.options[0]?.text !== 'Benar') ? editingQuestion.options : [
                          { id: 'opt_a', text: 'Pilihan A' },
                          { id: 'opt_b', text: 'Pilihan B' },
                          { id: 'opt_c', text: 'Pilihan C' },
                          { id: 'opt_d', text: 'Pilihan D' }
                        ],
                        correctKey: Array.isArray(editingQuestion.correctKey) ? editingQuestion.correctKey : ['opt_a']
                      });
                    } else if (newType === 'true_false') {
                      setEditingQuestion({
                        ...editingQuestion,
                        type: 'multiple_choice',
                        options: [
                          { id: 'opt_a', text: 'Benar' },
                          { id: 'opt_b', text: 'Salah' }
                        ],
                        correctKey: 'opt_a'
                      });
                    } else {
                      setEditingQuestion({
                        ...editingQuestion,
                        type: 'multiple_choice',
                        options: (editingQuestion.options && editingQuestion.options.length > 0 && editingQuestion.options[0]?.text !== 'Benar') ? editingQuestion.options : [
                          { id: 'opt_a', text: 'Pilihan A' },
                          { id: 'opt_b', text: 'Pilihan B' },
                          { id: 'opt_c', text: 'Pilihan C' },
                          { id: 'opt_d', text: 'Pilihan D' }
                        ],
                        correctKey: typeof editingQuestion.correctKey === 'string' ? editingQuestion.correctKey : 'opt_a'
                      });
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold"
                >
                  <option value="multiple_choice">Pilihan Ganda Biasa (1 Jawaban Benar)</option>
                  <option value="checkbox">Pilihan Ganda Kompleks (Multi Jawaban Benar)</option>
                  <option value="true_false">Benar / Salah (2 Opsi: Benar atau Salah)</option>
                  <option value="essay">Uraian / Isian Singkat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teks Pertanyaan Soal
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Ketik pertanyaan lengkap di sini..."
                  value={editingQuestion.prompt || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, prompt: e.target.value })}
                  className="w-full p-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white leading-relaxed"
                />
              </div>

              {/* Multimedia Attachment Selector with PC Upload & Drive / YouTube */}
              <MediaUploaderInput
                mediaType={editingQuestion.mediaType || 'none'}
                mediaUrl={editingQuestion.mediaUrl || ''}
                onChange={(mType, mUrl) => setEditingQuestion({ ...editingQuestion, mediaType: mType, mediaUrl: mUrl })}
                onZoomImage={(url) => setZoomImageUrl(url)}
              />

              {/* Multiple Choice Options (Single Correct) */}
              {editingQuestion.type === 'multiple_choice' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Pilihan Jawaban (Klik radio untuk menandai kunci benar):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const currentOpts = editingQuestion.options || [];
                        const nextLetter = String.fromCharCode(65 + currentOpts.length);
                        const nextId = `opt_${nextLetter.toLowerCase()}`;
                        setEditingQuestion({
                          ...editingQuestion,
                          options: [...currentOpts, { id: nextId, text: '' }]
                        });
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold"
                    >
                      + Tambah Opsi
                    </button>
                  </div>
                  {(editingQuestion.options || []).map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctAnswerKey"
                        checked={editingQuestion.correctKey === opt.id}
                        onChange={() => setEditingQuestion({ ...editingQuestion, correctKey: opt.id })}
                        className="text-indigo-600 w-4 h-4"
                        title="Tandai sebagai kunci benar"
                      />
                      <span className="w-5 text-xs font-bold text-slate-400 font-mono">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const newOpts = [...(editingQuestion.options || [])];
                          newOpts[i] = { ...newOpts[i], text: e.target.value };
                          setEditingQuestion({ ...editingQuestion, options: newOpts });
                        }}
                        placeholder={`Teks Opsi ${String.fromCharCode(65 + i)}`}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Checkbox Options (Multi Correct) */}
              {editingQuestion.type === 'checkbox' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Pilihan Jawaban Kompleks (Centang satu atau lebih opsi sebagai kunci benar):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const currentOpts = editingQuestion.options || [];
                        const nextLetter = String.fromCharCode(65 + currentOpts.length);
                        const nextId = `opt_${nextLetter.toLowerCase()}`;
                        setEditingQuestion({
                          ...editingQuestion,
                          options: [...currentOpts, { id: nextId, text: '' }]
                        });
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold"
                    >
                      + Tambah Opsi
                    </button>
                  </div>
                  {(editingQuestion.options || []).map((opt, i) => {
                    const currentKeys = Array.isArray(editingQuestion.correctKey) ? editingQuestion.correctKey : [editingQuestion.correctKey || 'opt_a'];
                    const isChecked = currentKeys.includes(opt.id);

                    return (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let nextKeys: string[];
                            if (e.target.checked) {
                              nextKeys = [...currentKeys, opt.id];
                            } else {
                              nextKeys = currentKeys.filter(k => k !== opt.id);
                            }
                            setEditingQuestion({ ...editingQuestion, correctKey: nextKeys });
                          }}
                          className="text-indigo-600 w-4 h-4 rounded"
                          title="Tandai sebagai salah satu kunci benar"
                        />
                        <span className="w-5 text-xs font-bold text-slate-400 font-mono">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => {
                            const newOpts = [...(editingQuestion.options || [])];
                            newOpts[i] = { ...newOpts[i], text: e.target.value };
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                          placeholder={`Teks Opsi ${String.fromCharCode(65 + i)}`}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Essay Sample Key */}
              {editingQuestion.type === 'essay' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kunci / Rangkuman Jawaban Benar (Esai / Uraian)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tuliskan kata kunci atau contoh jawaban benar..."
                    value={typeof editingQuestion.correctKey === 'string' ? editingQuestion.correctKey : ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, correctKey: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              {/* Points */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bobot Poin Soal
                </label>
                <input
                  type="number"
                  min={1}
                  value={editingQuestion.points || 20}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, points: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              {/* Taxonomy Section: Bloom-Anderson & SOLO Taxonomy */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Kerangka Taksonomi Asesmen (Bloom / SOLO)
                    </span>
                    <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setManualTaxonomyMode('bloom')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                          manualTaxonomyMode === 'bloom'
                            ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Bloom-Anderson
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualTaxonomyMode('solo')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                          manualTaxonomyMode === 'solo'
                            ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Taksonomi SOLO
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualTaxonomyMode('both')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                          manualTaxonomyMode === 'both'
                            ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Keduanya
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {manualTaxonomyMode === 'solo' 
                      ? 'Taksonomi SOLO mengukur kedalaman struktur hasil belajar (Prestructural s.d. Extended Abstract).' 
                      : manualTaxonomyMode === 'bloom' 
                      ? 'Taksonomi Bloom-Anderson mengukur level proses kognitif C1 (Mengingat) s.d. C6 (Mencipta).' 
                      : 'Mengintegrasikan level kognitif Bloom-Anderson dan tingkat pemahaman SOLO sekaligus untuk kisi-kisi komprehensif.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(manualTaxonomyMode === 'bloom' || manualTaxonomyMode === 'both') && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Level Bloom-Anderson
                      </label>
                      <select
                        value={editingQuestion.bloomLevel || 'C3 - Menerapkan'}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, bloomLevel: e.target.value as BloomLevel })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="C1 - Mengingat">C1 - Mengingat</option>
                        <option value="C2 - Memahami">C2 - Memahami</option>
                        <option value="C3 - Menerapkan">C3 - Menerapkan</option>
                        <option value="C4 - Menganalisis">C4 - Menganalisis</option>
                        <option value="C5 - Mengevaluasi">C5 - Mengevaluasi</option>
                        <option value="C6 - Mencipta">C6 - Mencipta</option>
                      </select>
                    </div>
                  )}

                  {(manualTaxonomyMode === 'solo' || manualTaxonomyMode === 'both') && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Level Taksonomi SOLO
                      </label>
                      <select
                        value={editingQuestion.soloLevel || 'Multistructural'}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, soloLevel: e.target.value as SoloLevel })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="Prestructural">1. Prestructural (Belum paham konsep)</option>
                        <option value="Unistructural">2. Unistructural (1 aspek tunggal)</option>
                        <option value="Multistructural">3. Multistructural (Banyak aspek terpisah)</option>
                        <option value="Relational">4. Relational (Menghubungkan keterkaitan)</option>
                        <option value="Extended Abstract">5. Extended Abstract (Generalisasi / Hipotesis)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Kurikulum Merdeka Dropdown: Capaian Pembelajaran, Elemen & TP */}
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Pilih dari Capaian Pembelajaran (CP) & Elemen Tersimpan:</span>
                    </span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                      {curriculumList.length} CP Tersedia
                    </span>
                  </div>

                  <select
                    onChange={(e) => {
                      const curId = e.target.value;
                      if (!curId) return;
                      const cur = curriculumList.find(c => c.id === curId);
                      if (cur) {
                        setEditingQuestion({
                          ...editingQuestion,
                          basicCompetency: cur.learningOutcome,
                          element: cur.element,
                          learningOutcome: cur.learningOutcome,
                          learningObjective: cur.learningObjectives?.[0] || editingQuestion.learningObjective || ''
                        });
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">-- Pilih Elemen & Capaian Pembelajaran (CP) --</option>
                    {curriculumList.map((cur) => (
                      <option key={cur.id} value={cur.id}>
                        [{cur.subject}] {cur.element} - {cur.learningOutcome.length > 65 ? cur.learningOutcome.slice(0, 65) + '...' : cur.learningOutcome}
                      </option>
                    ))}
                  </select>

                  {/* Dropdown specific TP */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                      Pilih Tujuan Pembelajaran (TP) Spesifik:
                    </label>
                    <select
                      value={editingQuestion.learningObjective || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setEditingQuestion({
                            ...editingQuestion,
                            learningObjective: e.target.value
                          });
                        }
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="">-- Pilih Tujuan Pembelajaran (TP) dari Database --</option>
                      {curriculumList.flatMap(c => c.learningObjectives.map((tp, idx) => ({ key: `${c.id}-${idx}`, label: `[${c.subject} - ${c.element}] ${tp}`, text: tp }))).map(item => (
                        <option key={item.key} value={item.text}>
                          {item.label.length > 85 ? item.label.slice(0, 85) + '...' : item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Kompetensi Dasar / Capaian Pembelajaran (KD/CP)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Peserta didik mampu menganalisis keanekaragaman hayati..."
                      value={editingQuestion.basicCompetency || ''}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, basicCompetency: e.target.value, learningOutcome: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Indikator Soal
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Siswa dapat mengidentifikasi struktur organel..."
                      value={editingQuestion.indicator || ''}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, indicator: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Tujuan Pembelajaran (TP) */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Tujuan Pembelajaran (TP) Terkait Butir Soal
                    </label>
                    {(() => {
                      const examObj = exams.find(e => e.id === selectedExamId);
                      if (examObj?.learningObjectives && examObj.learningObjectives.length > 0) {
                        return (
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                            Tersedia {examObj.learningObjectives.length} TP Ujian
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {(() => {
                    const examObj = exams.find(e => e.id === selectedExamId);
                    const examTps = examObj?.learningObjectives || [];
                    return (
                      <div className="space-y-1.5">
                        {examTps.length > 0 && (
                          <select
                            value={examTps.includes(editingQuestion.learningObjective || '') ? editingQuestion.learningObjective : '__custom__'}
                            onChange={(e) => {
                              if (e.target.value !== '__custom__') {
                                setEditingQuestion({ ...editingQuestion, learningObjective: e.target.value });
                              }
                            }}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 text-slate-900 dark:text-white"
                          >
                            <option value="__custom__">-- Pilih dari TP Ujian atau Ketik Bebas di Bawah --</option>
                            {examTps.map((tp, idx) => (
                              <option key={idx} value={tp}>
                                TP {idx + 1}: {tp.length > 70 ? tp.slice(0, 70) + '...' : tp}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          placeholder="Ketik Tujuan Pembelajaran butir soal ini (misal: Siswa mampu menghitung nilai hambatan pengganti)"
                          value={editingQuestion.learningObjective || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, learningObjective: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pembahasan Kunci Jawaban
                </label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan mengapa jawaban tersebut benar..."
                  value={editingQuestion.explanation || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraftQuestion}
                  className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                  title="Simpan butir soal ini sebagai draft sementara tanpa validasi ketat"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Simpan Draft</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveQuestion(e, false)}
                  className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  title="Simpan soal ini dan langsung buka form kosong untuk butir soal berikutnya"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Simpan & Tambah Baru</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveQuestion(e, true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  title="Simpan soal ke bank soal dan langsung tutup menu pembuatan soal"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan dan Tutup</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: EDIT STUDENT
         --------------------------------------------------------- */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Edit Data Siswa
            </h3>

            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  NIS / NISN
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.studentNo}
                  onChange={(e) => setEditingStudent({ ...editingStudent, studentNo: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.fullName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kelas / Rombel
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.classGrade}
                  onChange={(e) => setEditingStudent({ ...editingStudent, classGrade: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs"
                >
                  Perbarui Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: BULK IMPORT STUDENTS
         --------------------------------------------------------- */}
      {isBulkStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Input Data Siswa Secara Massal (Bulk)
                </h3>
              </div>
              <button onClick={() => setIsBulkStudentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Format per baris (Pisahkan dengan koma, titik-koma, atau tab Excel):
                </p>
                <p className="font-mono text-indigo-600 dark:text-indigo-400">
                  NIS, Nama Lengkap Siswa, Kelas / Rombel
                </p>
                <p className="text-[11px] text-slate-400">
                  Anda bisa menyalin (copy) langsung beberapa kolom dari Microsoft Excel atau Google Sheets lalu menempelkannya (paste) di bawah.
                </p>
              </div>

              {bulkStudentResult && (
                <div className="p-3 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200">
                  {bulkStudentResult}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tempelkan (Paste) Data Siswa:
                </label>
                <textarea
                  rows={8}
                  value={bulkStudentText}
                  onChange={(e) => setBulkStudentText(e.target.value)}
                  placeholder={`1001, Ahmad Fauzi Rahman, X MIPA 1\n1002, Bunga Citra Lestari, X MIPA 1\n1003, Cantika Dewi Putri, X MIPA 2`}
                  className="w-full p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white leading-relaxed"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  {bulkStudentText.trim() ? bulkStudentText.split('\n').filter(l => l.trim().length > 0).length : 0} baris data terdeteksi.
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkStudentModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBulkImportStudents}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Impor & Sinkronkan Siswa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: CONFIRM DELETE STUDENT (Single or Bulk)
         --------------------------------------------------------- */}
      {studentDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Konfirmasi Hapus Data Siswa
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              {studentDeleteConfirm === 'bulk'
                ? `Apakah Anda yakin ingin menghapus ${selectedStudentIds.length} data siswa terpilih? Tindakan ini akan diperbarui ke Google Sheets.`
                : `Apakah Anda yakin ingin menghapus siswa "${studentDeleteConfirm.name}"?`}
            </p>

            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setStudentDeleteConfirm(null)}
                className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (studentDeleteConfirm === 'bulk') {
                    handleBulkDeleteStudents();
                  } else {
                    handleDeleteStudent(studentDeleteConfirm.id);
                  }
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-xs"
              >
                Ya, Hapus Siswa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: SUBMISSION DETAILS VIEW
         --------------------------------------------------------- */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Rincian Jawaban: {viewingSubmission.studentName}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  NIS: {viewingSubmission.studentNo} · Kelas: {viewingSubmission.classGrade}
                </span>
              </div>
              <button onClick={() => setViewingSubmission(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-slate-400 block">Nilai Akhir:</span>
                <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  {viewingSubmission.percentage}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Status:</span>
                <span className={`font-bold mt-1 inline-block ${viewingSubmission.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {viewingSubmission.passed ? 'Lulus' : 'Remedial'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Deteksi Curang:</span>
                <span className="font-mono mt-1 inline-block text-amber-600 font-bold">
                  {viewingSubmission.tabSwitchCount}x Pindah Tab
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Jawaban Butir Soal:
              </h5>
              {Object.entries(viewingSubmission.answers || {}).map(([qId, ans], i) => {
                const questionObj = StorageService.getQuestions().find(q => q.id === qId);
                return (
                  <div key={qId} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-500 font-semibold">
                      <span>Soal #{i + 1} {questionObj ? `(${questionObj.points} Poin)` : ''}</span>
                      <span className="font-mono text-[11px] text-slate-400">ID: {qId}</span>
                    </div>
                    {questionObj?.prompt && (
                      <p className="text-slate-800 dark:text-slate-200 font-medium text-xs leading-relaxed">
                        {questionObj.prompt}
                      </p>
                    )}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Jawaban Siswa:</span>
                      {Array.isArray(ans) ? ans.join(', ') : String(ans || '-')}
                    </div>
                    {questionObj?.correctKey && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Kunci Jawaban:</span>
                        <span className="font-mono">{Array.isArray(questionObj.correctKey) ? questionObj.correctKey.join(', ') : String(questionObj.correctKey)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {Object.keys(viewingSubmission.answers || {}).length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  Tidak ada rincian jawaban tersimpan untuk submission ini.
                </div>
              )}
            </div>

            <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingSubmission(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: BAGIKAN LINK & QR CODE UJIAN SISWA
         --------------------------------------------------------- */}
      {sharingExam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Bagikan Ujian ke Siswa
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {sharingExam.subject} · Kelas {sharingExam.grade} · {sharingExam.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSharingExam(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {(() => {
              const gasUrl = StorageService.getSettings().gasWebAppUrl;
              const directLink = `${window.location.origin}/?mode=student&exam=${sharingExam.id}${gasUrl ? `&gas=${encodeURIComponent(gasUrl)}` : ''}${sharingExam.token ? `&token=${encodeURIComponent(sharingExam.token)}` : ''}`;
              const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(directLink)}`;
              const examQs = StorageService.getQuestionsByExamId(sharingExam.id);
              const waBroadcastText = `📢 *UJIAN ONLINE: ${sharingExam.subject.toUpperCase()}*\n🏫 *${profile.name}*\n📚 Mata Pelajaran: ${sharingExam.subject}\n👥 Kelas / Tingkat: Kelas ${sharingExam.grade}\n📝 Ujian: ${sharingExam.title}\n📊 Jumlah Soal: ${examQs.length} Butir Soal\n⏱️ Durasi: ${sharingExam.durationMinutes} Menit\n🔑 Token Ujian: ${sharingExam.token || 'Tanpa Token'}\n\n🔗 *Klik Link Ujian untuk Mulai Mengerjakan:*\n${directLink}\n\n⚠️ *Petunjuk Siswa:*\n1. Buka tautan di atas melalui browser Chrome/Safari di HP atau laptop Anda.\n2. Masukkan NIS / Nomor Induk Siswa Anda.\n3. Perangkat siswa tidak perlu memasang URL GAS & langsung terhubung ke ujian!`;

              return (
                <div className="mt-5 space-y-5">
                  {/* Readiness & Sync Verification */}
                  {examQs.length > 0 ? (
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Paket Soal Terverifikasi: {examQs.length} Butir Soal Siap</p>
                        <p className="text-[11px] opacity-90 mt-0.5">
                          Ujian & seluruh butir soal telah tersimpan di sistem dan disinkronkan ke Google Sheets. Siswa yang membuka link langsung dapat mengerjakan tanpa kendala "soal tidak ditemukan".
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Perhatian: Belum Ada Soal pada Ujian Ini</p>
                        <p className="text-[11px] opacity-90 mt-0.5">
                          Ujian ini saat ini memiliki 0 butir soal. Harap tambahkan butir soal terlebih dahulu melalui <strong>Bank Soal</strong> atau <strong>AI Generator Soal</strong> sebelum membagikan link ke siswa.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* QR Code & Direct Scan */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-2">
                      <img
                        src={qrImageUrl}
                        alt="QR Code Ujian Siswa"
                        className="w-44 h-44 object-contain"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback if qrserver is blocked
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1 mt-1">
                      <QrCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Siswa dapat scan langsung dengan kamera HP</span>
                    </span>
                  </div>

                  {/* Direct Link Box */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Tautan Langsung Ujian Siswa:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={directLink}
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(directLink);
                          setHasCopiedShareLink(true);
                          setTimeout(() => setHasCopiedShareLink(false), 2500);
                        }}
                        className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
                          hasCopiedShareLink
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {hasCopiedShareLink ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{hasCopiedShareLink ? 'Tersalin!' : 'Salin Link'}</span>
                      </button>
                    </div>
                  </div>

                  {/* WhatsApp Broadcast Format */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Format Siaran Pesan WhatsApp / Grup Kelas:
                    </label>
                    <div className="relative">
                      <pre className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 font-sans whitespace-pre-wrap border border-slate-200 dark:border-slate-700 max-h-36 overflow-y-auto leading-relaxed">
                        {waBroadcastText}
                      </pre>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(waBroadcastText);
                          setHasCopiedShareMsg(true);
                          setTimeout(() => setHasCopiedShareMsg(false), 2500);
                        }}
                        className="mt-2 w-full py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {hasCopiedShareMsg ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{hasCopiedShareMsg ? 'Format Pesan Berhasil Disalin!' : 'Salin Teks untuk Grup WhatsApp'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSharingExam(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ---------------------------------------------------------
          MODAL: EDIT REKAMAN NILAI SISWA
         --------------------------------------------------------- */}
      {isEditingSubmissionModalOpen && editingSubmission && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Edit Rekaman Nilai Siswa</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditingSubmissionModalOpen(false);
                  setEditingSubmission(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedSubmission} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    NIS / NISN
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSubmission.studentNo}
                    onChange={(e) => setEditingSubmission({ ...editingSubmission, studentNo: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kelas
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSubmission.classGrade || ''}
                    onChange={(e) => setEditingSubmission({ ...editingSubmission, classGrade: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  required
                  value={editingSubmission.studentName}
                  onChange={(e) => setEditingSubmission({ ...editingSubmission, studentName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Skor Diperoleh
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingSubmission.score}
                    onChange={(e) => {
                      const score = Number(e.target.value) || 0;
                      const maxScore = editingSubmission.maxScore || 100;
                      const percentage = Math.round((score / maxScore) * 100);
                      setEditingSubmission({
                        ...editingSubmission,
                        score,
                        percentage,
                        passed: percentage >= 75
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Skor Maksimal
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingSubmission.maxScore}
                    onChange={(e) => {
                      const maxScore = Number(e.target.value) || 100;
                      const score = editingSubmission.score || 0;
                      const percentage = Math.round((score / maxScore) * 100);
                      setEditingSubmission({
                        ...editingSubmission,
                        maxScore,
                        percentage,
                        passed: percentage >= 75
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Persentase (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editingSubmission.percentage}
                    onChange={(e) => {
                      const percentage = Number(e.target.value) || 0;
                      setEditingSubmission({
                        ...editingSubmission,
                        percentage,
                        passed: percentage >= 75
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status Kelulusan
                  </label>
                  <select
                    value={editingSubmission.passed ? 'true' : 'false'}
                    onChange={(e) => setEditingSubmission({ ...editingSubmission, passed: e.target.value === 'true' })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="true">Lulus (Tuntas KKM)</option>
                    <option value="false">Remedial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pelanggaran Tab
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingSubmission.tabSwitchCount || 0}
                    onChange={(e) => setEditingSubmission({ ...editingSubmission, tabSwitchCount: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Guru / Feedback
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan motivasi atau rekomendasi materi..."
                  value={editingSubmission.feedback || ''}
                  onChange={(e) => setEditingSubmission({ ...editingSubmission, feedback: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingSubmissionModalOpen(false);
                    setEditingSubmission(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          MODAL: TAMBAH / EDIT USER ACCOUNT
         --------------------------------------------------------- */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCog className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{editingUser ? 'Edit Akun Pengguna' : 'Tambah Akun Pengguna Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsUserModalOpen(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {userModalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{userModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUserAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: guru_biologi, pak_ahmad"
                  value={userAccountForm.username}
                  onChange={(e) => setUserAccountForm({ ...userAccountForm, username: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password {editingUser ? '(Kosongkan jika tidak diubah)' : <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="password"
                  placeholder={editingUser ? '•••••••• (Tetap sama)' : 'Masukkan password baru'}
                  required={!editingUser}
                  value={userAccountForm.password}
                  onChange={(e) => setUserAccountForm({ ...userAccountForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap & Gelar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ahmad Subardjo, S.Pd."
                  value={userAccountForm.fullName}
                  onChange={(e) => setUserAccountForm({ ...userAccountForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Peran / Hak Akses
                  </label>
                  <select
                    value={userAccountForm.role}
                    onChange={(e) => setUserAccountForm({ ...userAccountForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="teacher">Guru Pengampu</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status Akun
                  </label>
                  <select
                    value={userAccountForm.active ? 'active' : 'inactive'}
                    onChange={(e) => setUserAccountForm({ ...userAccountForm, active: e.target.value === 'active' })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  placeholder="email@sekolah.sch.id"
                  value={userAccountForm.email}
                  onChange={(e) => setUserAccountForm({ ...userAccountForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs"
                >
                  {editingUser ? 'Perbarui Akun' : 'Tambah Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          DIALOG: KONFIRMASI HAPUS PENGGUNA
         --------------------------------------------------------- */}
      {userDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Hapus Akun Pengguna?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Anda yakin ingin menghapus akun <strong>"{userDeleteConfirm.username}"</strong> ({userDeleteConfirm.fullName})? Pengguna ini tidak akan bisa login lagi ke sistem ujian.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserDeleteConfirm(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUserAccount(userDeleteConfirm.id)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Draft Toast */}
      {draftToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium border border-slate-700 animate-slideUp">
          <Bookmark className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{draftToast}</span>
        </div>
      )}

      {/* Media Zoom Modal */}
      <MediaViewer
        isOpen={Boolean(zoomImageUrl)}
        imageUrl={zoomImageUrl || ''}
        title="Pratinjau Gambar / Media Soal"
        onClose={() => setZoomImageUrl(null)}
      />
    </div>
  );
};
