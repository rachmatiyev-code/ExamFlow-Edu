import React, { useState, useEffect } from 'react';
import { 
  Exam, 
  Question, 
  SchoolProfile, 
  Student, 
  Submission, 
  UserAccount, 
  BloomLevel, 
  SoloLevel 
} from '../types';
import { StorageService } from '../services/storage';
import { GasClient } from '../services/gasClient';
import { AiGeneratorService } from '../services/aiGenerator';
import { GAS_BACKEND_SCRIPT } from '../services/gasBackendCode';
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
  QrCode
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
  const [activeTab, setActiveTab] = useState<'exams' | 'questions' | 'analytics' | 'profile' | 'users' | 'gas'>('exams');

  // Exam Management State
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Partial<Exam> | null>(null);

  // Question Management State
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [manualTaxonomyMode, setManualTaxonomyMode] = useState<'bloom' | 'solo' | 'both'>('both');

  // AI Generator Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('Sistem Ekskresi & Metabolisme');
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<'Mudah' | 'Sedang' | 'Sukar'>('Sedang');
  const [aiTaxonomy, setAiTaxonomy] = useState<'bloom' | 'solo'>('bloom');
  const [aiQuestionType, setAiQuestionType] = useState<'multiple_choice' | 'checkbox' | 'true_false' | 'essay' | 'mixed'>('multiple_choice');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // School Profile Edit State
  const [profileForm, setProfileForm] = useState<SchoolProfile>(profile);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setProfileForm(profile);
  }, [profile]);

  // Student & User Management State
  const [studentForm, setStudentForm] = useState({ studentNo: '', fullName: '', classGrade: '' });
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isBulkStudentModalOpen, setIsBulkStudentModalOpen] = useState(false);
  const [bulkStudentText, setBulkStudentText] = useState('');
  const [bulkStudentResult, setBulkStudentResult] = useState<string | null>(null);
  const [isSavingStudentsToSheets, setIsSavingStudentsToSheets] = useState(false);
  const [studentSyncMsg, setStudentSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [studentDeleteConfirm, setStudentDeleteConfirm] = useState<{ id: string; name: string } | 'bulk' | null>(null);

  const [userForm, setUserForm] = useState({ username: '', fullName: '', password: '', role: 'teacher' as 'admin' | 'teacher' });

  // Copy notification
  const [hasCopiedGas, setHasCopiedGas] = useState(false);

  // Submission detail modal
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);

  // Share Exam Modal State
  const [sharingExam, setSharingExam] = useState<Exam | null>(null);
  const [hasCopiedShareLink, setHasCopiedShareLink] = useState(false);
  const [hasCopiedShareMsg, setHasCopiedShareMsg] = useState(false);

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
      redeployCount: editingExam.redeployCount || 0
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
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId || !editingQuestion?.prompt) return;

    const currentQs = StorageService.getQuestionsByExamId(selectedExamId);
    const isNew = !editingQuestion.id;
    const qId = editingQuestion.id || `Q-${Date.now()}`;

    const newQuestion: Question = {
      id: qId,
      examId: selectedExamId,
      order: editingQuestion.order || currentQs.length + 1,
      prompt: editingQuestion.prompt,
      type: editingQuestion.type || 'multiple_choice',
      mediaType: editingQuestion.mediaType || 'none',
      mediaUrl: editingQuestion.mediaUrl || '',
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
      indicator: editingQuestion.indicator || ''
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

    setIsQuestionModalOpen(false);
    setEditingQuestion(null);
    onRefreshData();
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

    try {
      const res = await AiGeneratorService.generateQuestions(currentExam.id, {
        topic: topicToUse,
        count: aiCount,
        difficulty: aiDifficulty,
        taxonomy: aiTaxonomy,
        questionType: aiQuestionType,
        subject: currentExam.subject,
        grade: currentExam.grade
      });

      setIsGeneratingAi(false);
      if (res.success && res.questions) {
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
    const headers = ['ID Submission', 'NIS', 'Nama Siswa', 'Kelas', 'Nilai (%)', 'Status', 'Pindah Tab', 'Waktu Pengerjaan (Detik)', 'Tanggal Kirim'];
    const rows = submissions.map(s => [
      s.id,
      s.studentNo,
      `"${s.studentName}"`,
      s.classGrade,
      s.percentage,
      s.passed ? 'Lulus' : 'Remedial',
      s.tabSwitchCount,
      s.timeSpentSeconds,
      s.submittedAt
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nilai_ujian_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Filter submissions for current exam
  const examSubmissions = submissions.filter(s => s.examId === currentExam?.id);
  const avgScore = examSubmissions.length > 0
    ? Math.round(examSubmissions.reduce((acc, s) => acc + s.percentage, 0) / examSubmissions.length)
    : 0;
  const passCount = examSubmissions.filter(s => s.passed).length;
  const passRate = examSubmissions.length > 0 ? Math.round((passCount / examSubmissions.length) * 100) : 0;

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
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Data Siswa ({students.length})</span>
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

      {/* ---------------------------------------------------------
          SUB-TAB 1: EXAM MANAGEMENT & HISTORY
         --------------------------------------------------------- */}
      {activeTab === 'exams' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Daftar Ujian & Riwayat Soal
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

                {/* Prompt */}
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3 whitespace-pre-line">
                  {q.prompt}
                </p>

                {/* Media Preview if attached */}
                {q.mediaType !== 'none' && q.mediaUrl && (
                  <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/60 max-w-sm">
                    {q.mediaType === 'image' && (
                      <img src={q.mediaUrl} alt="Pratinjau" referrerPolicy="no-referrer" className="max-h-36 rounded object-contain" />
                    )}
                    {q.mediaType === 'audio' && (
                      <audio controls src={q.mediaUrl} className="w-full h-8" />
                    )}
                    {q.mediaType === 'video' && (
                      <span className="text-xs text-indigo-500 font-mono truncate block">Video: {q.mediaUrl}</span>
                    )}
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
          SUB-TAB 3: ANALYTICS & STUDENT SCORES
         --------------------------------------------------------- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* KPI Statistics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Peserta Masuk</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {examSubmissions.length}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Rata-Rata Nilai</span>
              <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                {avgScore}%
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Tuntas KKM ({currentExam?.passingScore || 75})</span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {passRate}%
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs text-slate-400 block mb-1">Pelanggaran Tab</span>
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {examSubmissions.reduce((a, b) => a + (b.tabSwitchCount || 0), 0)}
              </span>
            </div>
          </div>

          {/* Submissions Table with Export */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Rekapitulasi Hasil Jawaban Siswa
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tersinkronisasi dengan spreadsheet Google Sheets.
                </p>
              </div>

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3">NIS</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3 text-center">Nilai (%)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center font-mono">Pindah Tab</th>
                    <th className="p-3 text-center font-mono">Durasi</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {examSubmissions.map(sub => (
                    <tr key={sub.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-medium">{sub.studentNo}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">{sub.studentName}</td>
                      <td className="p-3 text-slate-500">{sub.classGrade}</td>
                      <td className="p-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                        {sub.percentage}%
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
                        {sub.tabSwitchCount > 0 ? (
                          <span className="text-amber-600 font-bold">{sub.tabSwitchCount}x</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">
                        {Math.floor(sub.timeSpentSeconds / 60)}m {sub.timeSpentSeconds % 60}s
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setViewingSubmission(sub)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                        >
                          Rincian
                        </button>
                      </td>
                    </tr>
                  ))}

                  {examSubmissions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Belum ada siswa yang mengumpulkan ujian ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
          SUB-TAB 5: STUDENT ROSTER (Daftar Siswa Terdaftar)
         --------------------------------------------------------- */}
      {activeTab === 'users' && (
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
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isGeneratingAi && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isGeneratingAi ? 'Menghasilkan Soal...' : `Mulai Buat ${aiCount} Soal AI`}</span>
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

              {/* Multimedia Attachment Selector */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span>Sisipkan Media:</span>
                  {(['none', 'image', 'audio', 'video'] as const).map(m => (
                    <label key={m} className="flex items-center gap-1.5 cursor-pointer capitalize">
                      <input
                        type="radio"
                        name="mediaType"
                        value={m}
                        checked={editingQuestion.mediaType === m}
                        onChange={() => setEditingQuestion({ ...editingQuestion, mediaType: m })}
                        className="text-indigo-600"
                      />
                      <span>{m === 'none' ? 'Tanpa Media' : m}</span>
                    </label>
                  ))}
                </div>

                {editingQuestion.mediaType !== 'none' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      URL Media ({editingQuestion.mediaType === 'audio' ? 'Link MP3' : editingQuestion.mediaType === 'image' ? 'Link Gambar / Unsplash' : 'Link Video MP4 atau YouTube'}):
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={editingQuestion.mediaUrl || ''}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, mediaUrl: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                )}
              </div>

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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Kompetensi Dasar / Capaian Pembelajaran (KD/CP)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 3.2 Menjelaskan proses metabolisme..."
                      value={editingQuestion.basicCompetency || ''}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, basicCompetency: e.target.value })}
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

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm"
                >
                  Simpan Soal
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
              {Object.entries(viewingSubmission.answers).map(([qId, ans], i) => (
                <div key={qId} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                  <div className="text-slate-500 font-semibold mb-1">Soal #{i + 1}</div>
                  <div className="text-slate-900 dark:text-white font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded">
                    {Array.isArray(ans) ? ans.join(', ') : String(ans)}
                  </div>
                </div>
              ))}
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
              const waBroadcastText = `📢 *UJIAN ONLINE: ${sharingExam.subject.toUpperCase()}*\n🏫 *${profile.name}*\n📚 Mata Pelajaran: ${sharingExam.subject}\n👥 Kelas / Tingkat: Kelas ${sharingExam.grade}\n📝 Ujian: ${sharingExam.title}\n⏱️ Durasi: ${sharingExam.durationMinutes} Menit\n🔑 Token Ujian: ${sharingExam.token || 'Tanpa Token'}\n\n🔗 *Klik Link Ujian untuk Mulai Mengerjakan:*\n${directLink}\n\n⚠️ *Petunjuk Siswa:*\n1. Buka tautan di atas melalui browser Chrome/Safari di HP atau laptop Anda.\n2. Masukkan NIS / Nomor Induk Siswa Anda.\n3. Perangkat siswa tidak perlu memasang URL GAS & langsung terhubung ke ujian!`;

              return (
                <div className="mt-5 space-y-5">
                  {/* Reassuring Banner for User Questions */}
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Perangkat Siswa Otomatis Terhubung Langsung</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        Siswa <strong>TIDAK PERLU</strong> memasang URL Google Apps Script dan <strong>TIDAK AKAN</strong> melihat status offline. Tautan ini otomatis menyematkan izin dan koneksi ke ujian secara mandiri.
                      </p>
                    </div>
                  </div>

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
    </div>
  );
};
