import { 
  SchoolProfile, 
  Exam, 
  Question, 
  Student, 
  Submission, 
  UserAccount, 
  AppLog, 
  AppSettings 
} from '../types';

const STORAGE_KEYS = {
  PROFILE: 'examflow_profile_v1',
  EXAMS: 'examflow_exams_v1',
  QUESTIONS: 'examflow_questions_v1',
  STUDENTS: 'examflow_students_v1',
  SUBMISSIONS: 'examflow_submissions_v1',
  USERS: 'examflow_users_v1',
  LOGS: 'examflow_logs_v1',
  SETTINGS: 'examflow_settings_v1',
  CURRENT_USER: 'examflow_current_user_v1',
  PENDING_SYNC: 'examflow_pending_sync_v1',
  INITIALIZED: 'examflow_initialized_v1'
};

const DEFAULT_PROFILE: SchoolProfile = {
  name: 'SMA Negeri 1 Prestasi Nusantara',
  npsn: '20108922',
  address: 'Jl. Merdeka Ilmu No. 12, Senayan, Jakarta Pusat',
  logoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=160&auto=format&fit=crop&q=80',
  academicYear: '2026/2027',
  semester: 'Ganjil',
  principalName: 'Drs. H. Mulyadi, M.Pd.',
  principalNip: '19710315 199702 1 003',
  teacherName: 'Siti Rahmawati, S.Pd.',
  teacherNip: '19820514 200801 2 009',
  teacherSubject: 'Biologi & Sains Terapan',
  teacherEmail: 'siti.rahmawati@sekolah.sch.id',
  teacherTitle: 'Koordinator Kurikulum & Guru Mata Pelajaran'
};

const DEFAULT_SETTINGS: AppSettings = {
  gasWebAppUrl: '',
  geminiApiKey: '',
  geminiModel: 'gemini-3.8-flash',
  autoSyncIntervalMinutes: 5,
  offlineMode: false,
  theme: 'light',
  enableAudioChime: true
};

const getTodayDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DEFAULT_EXAMS: Exam[] = [
  {
    id: 'EXAM-2026-001',
    title: 'Penilaian Sumatif Akhir Semester: Biologi & Sains Lingkungan',
    subject: 'Biologi',
    grade: 'X MIPA',
    durationMinutes: 45,
    passingScore: 75,
    isStrict: true,
    allowReview: true,
    startsAt: `${getTodayDateStr()} 07:00`,
    endsAt: `${getTodayDateStr()} 23:59`,
    status: 'active',
    totalQuestions: 5,
    token: 'BIO2026',
    instructions: '1. Berdoalah sebelum mengerjakan soal.\n2. Baca setiap instruksi dengan saksama.\n3. Periksa audio, gambar, atau video yang disisipkan.\n4. Sistem dilengkapi deteksi perpindahan tab browser.',
    createdAt: new Date().toISOString(),
    redeployCount: 1
  },
  {
    id: 'EXAM-2026-002',
    title: 'Ujian Harian: Fisika Terapan & Gelombang Elektromagnetik',
    subject: 'Fisika',
    grade: 'XI MIPA',
    durationMinutes: 60,
    passingScore: 70,
    isStrict: false,
    allowReview: true,
    startsAt: `${getTodayDateStr()} 08:30`,
    endsAt: `${getTodayDateStr()} 18:00`,
    status: 'active',
    totalQuestions: 3,
    token: 'FIS11',
    instructions: 'Gunakan kalkulator dasar jika diperlukan. Kerjakan dengan teliti dan jujur.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    redeployCount: 0
  },
  {
    id: 'EXAM-2026-003',
    title: 'Simulasi Mandiri: Bahasa Indonesia & Literasi Teks Eksplanasi',
    subject: 'Bahasa Indonesia',
    grade: 'X Umum',
    durationMinutes: 30,
    passingScore: 75,
    isStrict: false,
    allowReview: true,
    startsAt: `${getTodayDateStr()} 00:00`,
    endsAt: `${getTodayDateStr()} 23:59`,
    status: 'active',
    totalQuestions: 2,
    token: '',
    instructions: 'Pahami teks dan audio percakapan dengan cermat sebelum memilih jawaban.',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    redeployCount: 0
  }
];

const DEFAULT_QUESTIONS: Question[] = [];

const DEFAULT_STUDENTS: Student[] = [
  { id: 'STD-1001', studentNo: '1001', fullName: 'Ahmad Fauzi Rahman', classGrade: 'X MIPA 1', email: 'ahmad@sekolah.sch.id', status: 'active' },
  { id: 'STD-1002', studentNo: '1002', fullName: 'Bunga Citra Lestari', classGrade: 'X MIPA 1', email: 'bunga@sekolah.sch.id', status: 'active' },
  { id: 'STD-1003', studentNo: '1003', fullName: 'Cantika Dewi Putri', classGrade: 'X MIPA 2', email: 'cantika@sekolah.sch.id', status: 'active' },
  { id: 'STD-1004', studentNo: '1004', fullName: 'Dimas Satria Wibowo', classGrade: 'XI MIPA 1', email: 'dimas@sekolah.sch.id', status: 'active' },
  { id: 'STD-1005', studentNo: '1005', fullName: 'Eka Nur Halizah', classGrade: 'XI MIPA 1', email: 'eka@sekolah.sch.id', status: 'active' },
  { id: 'STD-1006', studentNo: '1006', fullName: 'Farhan Maulana', classGrade: 'X MIPA 1', email: 'farhan@sekolah.sch.id', status: 'active' }
];

const DEFAULT_SUBMISSIONS: Submission[] = [];

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'USR-ADMIN',
    username: 'admin',
    password: 'password123',
    fullName: 'Administrator Sistem Ujian',
    role: 'admin',
    email: 'admin@sekolah.sch.id',
    active: true
  },
  {
    id: 'USR-GURU',
    username: 'guru',
    password: 'password123',
    fullName: 'Siti Rahmawati, S.Pd.',
    role: 'teacher',
    email: 'siti.rahmawati@sekolah.sch.id',
    active: true
  }
];

export class StorageService {
  private static getItem<T>(key: string, defaultValue: T): T {
    try {
      const val = localStorage.getItem(key);
      if (!val) return defaultValue;
      return JSON.parse(val) as T;
    } catch (e) {
      console.warn(`Error reading key ${key} from localStorage:`, e);
      return defaultValue;
    }
  }

  private static setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error saving key ${key} to localStorage:`, e);
    }
  }

  // School Profile
  static getProfile(): SchoolProfile {
    return this.getItem<SchoolProfile>(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
  }

  static saveProfile(profile: SchoolProfile): void {
    const updated = { ...profile, updatedAt: new Date().toISOString() };
    this.setItem(STORAGE_KEYS.PROFILE, updated);
    
    // Automatically keep current user name in sync if logged in
    const currentUser = this.getCurrentUser();
    if (currentUser && profile.teacherName) {
      const updatedUser = { ...currentUser, fullName: profile.teacherName };
      this.setCurrentUser(updatedUser);
    }
    this.addLog('SYNC', `Profil sekolah & guru (${profile.teacherName}) diperbarui secara lokal`);
  }

  // Exams
  static getExams(): Exam[] {
    return this.getItem<Exam[]>(STORAGE_KEYS.EXAMS, DEFAULT_EXAMS);
  }

  static saveExams(exams: Exam[]): void {
    this.setItem(STORAGE_KEYS.EXAMS, exams);
  }

  static getExamById(id: string): Exam | undefined {
    return this.getExams().find(e => e.id === id);
  }

  static upsertExam(exam: Exam): void {
    const list = this.getExams();
    const idx = list.findIndex(e => e.id === exam.id);
    if (idx >= 0) {
      list[idx] = exam;
    } else {
      list.unshift(exam);
    }
    this.saveExams(list);
    this.addLog('EXAM', `Ujian "${exam.title}" berhasil disimpan secara lokal`);
  }

  static deleteExam(id: string): void {
    const list = this.getExams().filter(e => e.id !== id);
    this.saveExams(list);
    // Hapus juga soal-soalnya
    const questions = this.getQuestions().filter(q => q.examId !== id);
    this.saveQuestions(questions);
    this.addLog('EXAM', `Ujian ID ${id} dihapus dari penyimpanan lokal`);
  }

  // Questions
  static getQuestions(): Question[] {
    const raw = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Bersihkan soal dummy agar tidak membebani dan mengaburkan ujian nyata
          return parsed.filter(q => !this.isDummyQuestion(q.id));
        }
      } catch {}
    }
    return [];
  }

  static saveQuestions(questions: Question[]): void {
    const cleanList = questions.filter(q => !this.isDummyQuestion(q.id));
    this.setItem(STORAGE_KEYS.QUESTIONS, cleanList);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }

  static isDummyQuestion(id: string): boolean {
    const clean = String(id || '').trim().toUpperCase();
    return ['Q-001', 'Q-002', 'Q-003', 'Q-004', 'Q-005', 'Q-006', 'Q-007', 'Q-008'].includes(clean) || clean.startsWith('Q-DUMMY-');
  }

  static clearDummyQuestions(): void {
    const list = this.getQuestions().filter(q => !this.isDummyQuestion(q.id));
    this.saveQuestions(list);
  }

  static getQuestionsByExamId(examId: string): Question[] {
    const cleanId = String(examId || '').trim().toLowerCase();
    return this.getQuestions()
      .filter(q => String(q.examId || '').trim().toLowerCase() === cleanId)
      .sort((a, b) => a.order - b.order);
  }

  static saveQuestionsForExam(examId: string, questions: Question[]): void {
    const cleanId = String(examId || '').trim().toLowerCase();
    const all = this.getQuestions().filter(q => String(q.examId || '').trim().toLowerCase() !== cleanId);
    this.saveQuestions([...all, ...questions]);
    // Perbarui totalQuestions pada exam
    const exams = this.getExams();
    const target = exams.find(e => String(e.id || '').trim().toLowerCase() === cleanId);
    if (target) {
      target.totalQuestions = questions.length;
      this.saveExams(exams);
    }
    this.addLog('EXAM', `${questions.length} soal disimpan untuk ujian ${examId}`);
  }

  static saveDraftQuestion(examId: string, question: Partial<Question>): Question {
    const cleanId = String(examId || '').trim().toLowerCase();
    const currentQs = this.getQuestionsByExamId(cleanId);
    const qId = question.id || `DRAFT-${Date.now()}`;
    const draftQ: Question = {
      id: qId,
      examId,
      order: question.order || currentQs.length + 1,
      prompt: question.prompt || '(Draft Soal Tanpa Judul)',
      type: question.type || 'multiple_choice',
      mediaType: question.mediaType || 'none',
      mediaUrl: question.mediaUrl || '',
      options: question.options || [
        { id: 'opt_a', text: 'Pilihan A' },
        { id: 'opt_b', text: 'Pilihan B' },
        { id: 'opt_c', text: 'Pilihan C' },
        { id: 'opt_d', text: 'Pilihan D' }
      ],
      correctKey: question.correctKey || 'opt_a',
      points: Number(question.points) || 10,
      explanation: question.explanation || '',
      bloomLevel: question.bloomLevel || 'C3 - Menerapkan',
      soloLevel: question.soloLevel || 'Multistructural',
      basicCompetency: question.basicCompetency || '',
      indicator: question.indicator || '',
      isDraft: true,
      status: 'draft'
    };

    let updatedList: Question[];
    const existingIdx = currentQs.findIndex(q => q.id === qId);
    if (existingIdx >= 0) {
      updatedList = currentQs.map(q => q.id === qId ? draftQ : q);
    } else {
      updatedList = [...currentQs, draftQ];
    }
    this.saveQuestionsForExam(examId, updatedList);
    this.addLog('EXAM', `Draft butir soal disimpan: "${draftQ.prompt.slice(0, 30)}..."`, undefined, 'info');
    return draftQ;
  }

  // Students
  static getStudents(): Student[] {
    const list = this.getItem<Student[]>(STORAGE_KEYS.STUDENTS, DEFAULT_STUDENTS);
    return list.map(s => ({
      ...s,
      studentNo: String(s.studentNo || '').trim(),
      fullName: String(s.fullName || '').trim(),
      classGrade: String(s.classGrade || '').trim() || 'X Umum',
      status: s.status || 'active'
    }));
  }

  static saveStudents(students: Student[]): void {
    const sanitized = students.map(s => ({
      ...s,
      studentNo: String(s.studentNo || '').trim(),
      fullName: String(s.fullName || '').trim(),
      classGrade: String(s.classGrade || '').trim() || 'X Umum',
      status: s.status || 'active'
    }));
    this.setItem(STORAGE_KEYS.STUDENTS, sanitized);
  }

  static upsertStudent(student: Student): void {
    const list = this.getStudents();
    const cleanNo = String(student.studentNo || '').trim();
    const sanitized: Student = {
      ...student,
      studentNo: cleanNo,
      fullName: String(student.fullName || '').trim(),
      classGrade: String(student.classGrade || '').trim() || 'X Umum',
      status: student.status || 'active'
    };

    const idx = list.findIndex(s => s.studentNo === cleanNo || (student.id && s.id === student.id));
    if (idx >= 0) {
      list[idx] = sanitized;
    } else {
      list.push(sanitized);
    }
    this.saveStudents(list);
  }

  static deleteStudent(id: string): void {
    const cleanId = String(id).trim();
    const list = this.getStudents().filter(s => s.id !== cleanId && s.studentNo !== cleanId);
    this.saveStudents(list);
  }

  // Submissions
  static getSubmissions(): Submission[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Selalu bersihkan data dummy agar dasbor nilai selalu nyata dan bersih
          return parsed.filter(s => !this.isDummySubmission(s.id, s.studentNo, s.studentName));
        }
      } catch {}
    }
    // Jangan pernah memuat data dummy nilai saat membuka aplikasi
    return [];
  }

  static saveSubmissions(submissions: Submission[]): void {
    // Pastikan data yang disimpan bersih dari dummy
    const cleanList = submissions.filter(s => !this.isDummySubmission(s.id, s.studentNo, s.studentName));
    this.setItem(STORAGE_KEYS.SUBMISSIONS, cleanList);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }

  static isDummySubmission(id: string, studentNo?: string, studentName?: string): boolean {
    const sId = String(id || '').trim().toUpperCase();
    if (['SUB-9001', 'SUB-9002', 'SUB-9003'].includes(sId) || sId.startsWith('SUB-900') || sId.startsWith('SUB-DUMMY')) return true;
    const name = String(studentName || '').toLowerCase().trim();
    if (name === 'ahmad fauzi rahman' || name === 'bunga citra lestari') return true;
    return false;
  }

  static clearDummySubmissions(): void {
    const list = this.getSubmissions().filter(s => !this.isDummySubmission(s.id, s.studentNo, s.studentName));
    this.saveSubmissions(list);
  }

  static addSubmission(submission: Submission): void {
    const list = this.getSubmissions();
    const cleanList = list.filter(s => s.id !== submission.id);
    cleanList.unshift(submission);
    this.saveSubmissions(cleanList);
    this.addPendingSync(submission);
    this.addLog('EXAM', `Jawaban siswa ${submission.studentName} (${submission.studentNo}) tersimpan`);
  }

  static updateSubmission(id: string, updatedFields: Partial<Submission>): void {
    const list = this.getSubmissions();
    const idx = list.findIndex(s => s.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updatedFields };
      this.saveSubmissions(list);
      this.addLog('EXAM', `Data nilai siswa ${list[idx].studentName} (${list[idx].studentNo}) berhasil diperbarui`, undefined, 'info');
    }
  }

  static deleteSubmission(id: string): void {
    const list = this.getSubmissions().filter(s => s.id !== id);
    this.saveSubmissions(list);
    this.removePendingSync(id);
    this.addLog('EXAM', `Data rekaman nilai ID ${id} dihapus dari penyimpanan`, undefined, 'warn');
  }

  static deleteSubmissionsBulk(ids: string[]): void {
    const idSet = new Set(ids);
    const list = this.getSubmissions().filter(s => !idSet.has(s.id));
    this.saveSubmissions(list);
    ids.forEach(id => this.removePendingSync(id));
    this.addLog('EXAM', `${ids.length} data nilai siswa dihapus sekaligus`, undefined, 'warn');
  }

  static markSubmissionSynced(submissionId: string): void {
    const list = this.getSubmissions();
    const sub = list.find(s => s.id === submissionId);
    if (sub) {
      sub.syncStatus = 'synced';
      this.saveSubmissions(list);
    }
    this.removePendingSync(submissionId);
  }

  // Pending Sync Queue (Offline Resilient)
  static getPendingSync(): Submission[] {
    return this.getItem<Submission[]>(STORAGE_KEYS.PENDING_SYNC, []);
  }

  static addPendingSync(sub: Submission): void {
    const pending = this.getPendingSync();
    if (!pending.some(p => p.id === sub.id)) {
      pending.push(sub);
      this.setItem(STORAGE_KEYS.PENDING_SYNC, pending);
    }
  }

  static removePendingSync(subId: string): void {
    const pending = this.getPendingSync().filter(p => p.id !== subId);
    this.setItem(STORAGE_KEYS.PENDING_SYNC, pending);
  }

  // Users & Auth
  static getUsers(): UserAccount[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Jika ada akun kustom asli dari guru/admin, buang akun dummy agar tidak tercampur
          const customUsers = parsed.filter(u => !this.isDummyUser(u.id) && !this.isDummyUser(u.username));
          if (customUsers.length > 0) return customUsers;
          return parsed;
        }
      } catch {}
    }
    const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (isInit) return [];
    return DEFAULT_USERS;
  }

  static saveUsers(users: UserAccount[]): void {
    this.setItem(STORAGE_KEYS.USERS, users);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }

  static isDummyUser(idOrUsername: string): boolean {
    const clean = String(idOrUsername || '').toLowerCase().trim();
    return ['usr-admin', 'usr-guru', 'usr-001', 'usr-002', 'admin', 'guru'].includes(clean);
  }

  static clearDummyUsers(): void {
    const list = this.getUsers().filter(u => !this.isDummyUser(u.id) && !this.isDummyUser(u.username));
    this.saveUsers(list);
  }

  static addUser(user: UserAccount): void {
    const list = this.getUsers();
    const cleanUsername = user.username.trim().toLowerCase();
    if (list.some(u => u.username.toLowerCase() === cleanUsername)) {
      throw new Error(`Username "${user.username}" sudah digunakan.`);
    }
    const sanitized: UserAccount = {
      ...user,
      id: user.id || `USR-${Date.now()}`,
      username: user.username.trim(),
      fullName: user.fullName.trim(),
      role: user.role || 'teacher',
      email: (user.email || '').trim(),
      active: user.active !== false
    };
    list.push(sanitized);
    this.saveUsers(list);
    this.addLog('AUTH', `Akun pengguna baru dibuat: ${user.fullName} (${user.username})`, undefined, 'success');
  }

  static updateUser(id: string, updatedFields: Partial<UserAccount>): void {
    const list = this.getUsers();
    const idx = list.findIndex(u => u.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updatedFields };
      this.saveUsers(list);
      this.addLog('AUTH', `Akun pengguna diperbarui: ${list[idx].username}`, undefined, 'info');
      const curr = this.getCurrentUser();
      if (curr && curr.id === id) {
        this.setCurrentUser(list[idx]);
      }
    }
  }

  static upsertUser(user: UserAccount): void {
    const list = this.getUsers();
    const idx = list.findIndex(u => u.username.toLowerCase() === user.username.toLowerCase() || (user.id && u.id === user.id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...user };
    } else {
      list.push(user);
    }
    this.saveUsers(list);
  }

  static deleteUser(id: string): void {
    const list = this.getUsers().filter(u => u.id !== id);
    this.saveUsers(list);
    this.addLog('AUTH', `Akun pengguna ID ${id} dihapus`, undefined, 'warn');
  }

  static getCurrentUser(): UserAccount | null {
    return this.getItem<UserAccount | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  static setCurrentUser(user: UserAccount | null): void {
    this.setItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  // Settings
  static getSettings(): AppSettings {
    const settings = this.getItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    if (!settings.geminiModel || settings.geminiModel.includes('1.5') || settings.geminiModel.includes('2.0') || settings.geminiModel === 'gemini-pro') {
      settings.geminiModel = 'gemini-3.8-flash';
    }
    return settings;
  }

  static saveSettings(settings: AppSettings): void {
    this.setItem(STORAGE_KEYS.SETTINGS, settings);
  }

  // Logs
  static getLogs(): AppLog[] {
    return this.getItem<AppLog[]>(STORAGE_KEYS.LOGS, []);
  }

  static addLog(category: AppLog['category'], message: string, details?: string, level: AppLog['level'] = 'info'): void {
    const logs = this.getLogs();
    const newLog: AppLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
      level,
      category,
      message,
      details
    };
    logs.unshift(newLog);
    // Keep max 200 logs
    if (logs.length > 200) logs.pop();
    this.setItem(STORAGE_KEYS.LOGS, logs);
  }

  static clearLogs(): void {
    this.setItem(STORAGE_KEYS.LOGS, []);
  }
}
