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
  PENDING_SYNC: 'examflow_pending_sync_v1'
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

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'Q-001',
    examId: 'EXAM-2026-001',
    order: 1,
    prompt: 'Dengarkan rekaman audio penjelasan mekanisme respirasi seluler berikut. Organel sel manakah yang menjadi tempat berlangsungnya siklus Krebs dan fosforilasi oksidatif?',
    type: 'multiple_choice',
    mediaType: 'audio',
    // Public sample sound clip
    mediaUrl: 'https://cdn.freesound.org/previews/612/612095_11861866-lq.mp3',
    options: [
      { id: 'opt_a', text: 'Mitokondria (khususnya matriks dan krista)' },
      { id: 'opt_b', text: 'Retikulum Endoplasma Kasar' },
      { id: 'opt_c', text: 'Aparatus Golgi' },
      { id: 'opt_d', text: 'Ribosom sitoplasma' }
    ],
    correctKey: 'opt_a',
    points: 20,
    explanation: 'Siklus Krebs berlangsung di dalam matriks mitokondria, sedangkan rantai transpor elektron dan fosforilasi oksidatif terjadi pada membran dalam (krista) mitokondria.',
    bloomLevel: 'C2 - Memahami',
    soloLevel: 'Multistructural',
    basicCompetency: '3.2 Menjelaskan proses metabolisme sebagai reaksi enzimatis dalam makhluk hidup',
    indicator: 'Peserta didik dapat mengidentifikasi organel respirasi seluler berdasarkan informasi audio'
  },
  {
    id: 'Q-002',
    examId: 'EXAM-2026-001',
    order: 2,
    prompt: 'Perhatikan diagram struktur sel tumbuhan berikut. Bagian yang ditunjukkan oleh huruf bernomor 3 berfungsi sebagai apa?',
    type: 'multiple_choice',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&auto=format&fit=crop&q=80',
    options: [
      { id: 'opt_a', text: 'Fotosintesis dan sintesis glukosa (Kloroplas)' },
      { id: 'opt_b', text: 'Menjaga turgiditas sel dan menyimpan cadangan makanan (Vakuola besar)' },
      { id: 'opt_c', text: 'Pengendali seluruh aktivitas pembelahan sel (Nukleus)' },
      { id: 'opt_d', text: 'Perlindungan mekanik dan dinding sel' }
    ],
    correctKey: 'opt_b',
    points: 20,
    explanation: 'Vakuola besar pada sel tumbuhan dewasa berperan menimbun air, menjaga tekanan turgor sel, serta menyimpan senyawa metabolit sekunder.',
    bloomLevel: 'C4 - Menganalisis',
    soloLevel: 'Relational',
    basicCompetency: '3.1 Memahami komponen kimiawi penyusun sel, ciri hidup pada sel yang ditunjukkan oleh struktur, fungsi dan proses yang berlangsung di dalam sel',
    indicator: 'Disajikan gambar struktur sel, siswa mampu menganalisis fungsi organel spesifik'
  },
  {
    id: 'Q-003',
    examId: 'EXAM-2026-001',
    order: 3,
    prompt: 'Amati cuplikan video simulasi pembelahan sel (Mitosis) di bawah ini. Pada fase manakah kromatid saudara ditarik menuju kutub sel yang berlawanan oleh benang spindel?',
    type: 'multiple_choice',
    mediaType: 'video',
    mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    options: [
      { id: 'opt_a', text: 'Profase' },
      { id: 'opt_b', text: 'Metafase' },
      { id: 'opt_c', text: 'Anafase' },
      { id: 'opt_d', text: 'Telofase' }
    ],
    correctKey: 'opt_c',
    points: 20,
    explanation: 'Pada tahap anafase, sentromer membelah dan kromatid ditarik ke masing-masing kutub yang berlawanan oleh pemendekan mikrotubulus spindel.',
    bloomLevel: 'C3 - Menerapkan',
    soloLevel: 'Multistructural',
    basicCompetency: '3.4 Menganalisis proses pembelahan sel sebagai dasar penurunan sifat dari induk kepada keturunannya',
    indicator: 'Siswa dapat menentukan tahapan mitosis dari demonstrasi visual gerak kromosom'
  },
  {
    id: 'Q-004',
    examId: 'EXAM-2026-001',
    order: 4,
    prompt: 'Manakah faktor-faktor lingkungan di bawah ini yang memengaruhi laju transpirasi pada daun tumbuhan secara langsung? (Pilih semua yang benar)',
    type: 'checkbox',
    mediaType: 'none',
    options: [
      { id: 'opt_a', text: 'Intensitas cahaya matahari' },
      { id: 'opt_b', text: 'Kelembaban udara sekitar' },
      { id: 'opt_c', text: 'Kecepatan angin' },
      { id: 'opt_d', text: 'Kadar gas nitrogen bebas' }
    ],
    correctKey: ['opt_a', 'opt_b', 'opt_c'],
    points: 20,
    explanation: 'Intensitas cahaya, kelembapan, suhu, dan pergerakan angin memengaruhi laju pembukaan stomata dan penguapan air daun. Gas N2 bebas tidak memengaruhi transpirasi secara langsung.',
    bloomLevel: 'C4 - Menganalisis',
    soloLevel: 'Relational',
    basicCompetency: '3.3 Menganalisis keterkaitan antara struktur sel pada jaringan tumbuhan dengan fungsi organ pada tumbuhan',
    indicator: 'Siswa dapat menganalisis multi-faktor yang memengaruhi fisiologi transportasi tumbuhan'
  },
  {
    id: 'Q-005',
    examId: 'EXAM-2026-001',
    order: 5,
    prompt: 'Jelaskan mengapa pemanasan global dapat mengganggu rantai makanan pada ekosistem terumbu karang melalui fenomena pemutihan karang (coral bleaching)!',
    type: 'essay',
    mediaType: 'none',
    options: [],
    correctKey: 'Kenaikan suhu air laut menyebabkan karang mengeluarkan alga simbiotik Zooxanthellae yang menyediakan nutrisi melalui fotosintesis, sehingga karang memutih dan mati, memicu runtuhnya produsen bagi ikan herbivora.',
    points: 20,
    explanation: 'Penjelasan harus mencakup pelepasan alga simbiotik zooxanthellae akibat stres termal, hilangnya sumber makanan utama, dan dampak berantai pada herbivora serta predator karang.',
    bloomLevel: 'C5 - Mengevaluasi',
    soloLevel: 'Extended Abstract',
    basicCompetency: '3.10 Menganalisis komponen-komponen ekosistem dan interaksi antar komponen tersebut',
    indicator: 'Siswa dapat mengevaluasi dampak kenaikan suhu global terhadap stabilitas trofik ekosistem karang'
  },
  // Questions for Exam 2
  {
    id: 'Q-006',
    examId: 'EXAM-2026-002',
    order: 1,
    prompt: 'Sebuah gelombang elektromagnetik memiliki frekuensi 6 x 10^14 Hz di ruang hampa. Berapakah panjang gelombangnya jika kecepatan cahaya c = 3 x 10^8 m/s?',
    type: 'multiple_choice',
    mediaType: 'none',
    options: [
      { id: 'opt_a', text: '500 nm (Cahaya tampak)' },
      { id: 'opt_b', text: '200 nm (Ultraviolet)' },
      { id: 'opt_c', text: '750 nm (Inframerah)' },
      { id: 'opt_d', text: '1200 nm (Gelombang mikro)' }
    ],
    correctKey: 'opt_a',
    points: 30,
    explanation: 'λ = c / f = (3 x 10^8) / (6 x 10^14) = 0.5 x 10^-6 m = 500 nm.',
    bloomLevel: 'C3 - Menerapkan',
    soloLevel: 'Multistructural',
    basicCompetency: '3.6 Menganalisis fenomena radiasi elektromagnetik, pemanfaatannya, dan dampaknya',
    indicator: 'Siswa dapat menghitung panjang gelombang elektromagnetik dari frekuensi yang diketahui'
  },
  {
    id: 'Q-007',
    examId: 'EXAM-2026-002',
    order: 2,
    prompt: 'Manakah spektrum gelombang elektromagnetik yang memiliki energi foton tertinggi?',
    type: 'multiple_choice',
    mediaType: 'none',
    options: [
      { id: 'opt_a', text: 'Sinar Gamma' },
      { id: 'opt_b', text: 'Sinar-X' },
      { id: 'opt_c', text: 'Sinar Ultraviolet' },
      { id: 'opt_d', text: 'Gelombang Radio' }
    ],
    correctKey: 'opt_a',
    points: 35,
    explanation: 'Energi foton sebanding dengan frekuensi (E = h.f). Sinar gamma memiliki frekuensi tertinggi dalam spektrum gelombang elektromagnetik.',
    bloomLevel: 'C2 - Memahami',
    soloLevel: 'Unistructural',
    basicCompetency: '3.6 Menganalisis fenomena radiasi elektromagnetik',
    indicator: 'Siswa dapat menentukan urutan energi spektrum gelombang elektromagnetik'
  },
  {
    id: 'Q-008',
    examId: 'EXAM-2026-002',
    order: 3,
    prompt: 'Jelaskan prinsip kerja transmisi data nirkabel menggunakan gelombang mikro pada jaringan seluler modern!',
    type: 'essay',
    mediaType: 'none',
    options: [],
    correctKey: 'Gelombang mikro mentransmisikan sinyal data melalui modulasi frekuensi tinggi secara point-to-point dengan bandwidth besar.',
    points: 35,
    explanation: 'Prinsip garis lurus (line-of-sight), modulasi data, stasiun pemancar BTS, dan konversi sinyal analog-digital.',
    bloomLevel: 'C4 - Menganalisis',
    soloLevel: 'Relational',
    basicCompetency: '4.6 Mempresentasikan manfaat dan dampak radiasi elektromagnetik',
    indicator: 'Siswa dapat menguraikan penerapan teknologi gelombang mikro pada komunikasi digital'
  }
];

const DEFAULT_STUDENTS: Student[] = [
  { id: 'STD-1001', studentNo: '1001', fullName: 'Ahmad Fauzi Rahman', classGrade: 'X MIPA 1', email: 'ahmad@sekolah.sch.id', status: 'active' },
  { id: 'STD-1002', studentNo: '1002', fullName: 'Bunga Citra Lestari', classGrade: 'X MIPA 1', email: 'bunga@sekolah.sch.id', status: 'active' },
  { id: 'STD-1003', studentNo: '1003', fullName: 'Cantika Dewi Putri', classGrade: 'X MIPA 2', email: 'cantika@sekolah.sch.id', status: 'active' },
  { id: 'STD-1004', studentNo: '1004', fullName: 'Dimas Satria Wibowo', classGrade: 'XI MIPA 1', email: 'dimas@sekolah.sch.id', status: 'active' },
  { id: 'STD-1005', studentNo: '1005', fullName: 'Eka Nur Halizah', classGrade: 'XI MIPA 1', email: 'eka@sekolah.sch.id', status: 'active' },
  { id: 'STD-1006', studentNo: '1006', fullName: 'Farhan Maulana', classGrade: 'X MIPA 1', email: 'farhan@sekolah.sch.id', status: 'active' }
];

const DEFAULT_SUBMISSIONS: Submission[] = [
  {
    id: 'SUB-9001',
    examId: 'EXAM-2026-001',
    studentNo: '1001',
    studentName: 'Ahmad Fauzi Rahman',
    classGrade: 'X MIPA 1',
    answers: { 'Q-001': 'opt_a', 'Q-002': 'opt_b', 'Q-003': 'opt_c', 'Q-004': ['opt_a', 'opt_b', 'opt_c'], 'Q-005': 'Pemutihan karang terjadi akibat pengeluaran alga simbiotik karena panas.' },
    score: 100,
    maxScore: 100,
    percentage: 100,
    passed: true,
    submittedAt: new Date(Date.now() - 3600000).toISOString(),
    tabSwitchCount: 0,
    timeSpentSeconds: 1540,
    syncStatus: 'synced',
    feedback: 'Hasil istimewa! Pemahaman konsep respirasi dan sel sangat mendalam.'
  },
  {
    id: 'SUB-9002',
    examId: 'EXAM-2026-001',
    studentNo: '1002',
    studentName: 'Bunga Citra Lestari',
    classGrade: 'X MIPA 1',
    answers: { 'Q-001': 'opt_a', 'Q-002': 'opt_a', 'Q-003': 'opt_c', 'Q-004': ['opt_a', 'opt_b'], 'Q-005': 'Suhu laut naik menyebabkan karang mati.' },
    score: 75,
    maxScore: 100,
    percentage: 75,
    passed: true,
    submittedAt: new Date(Date.now() - 7200000).toISOString(),
    tabSwitchCount: 1,
    timeSpentSeconds: 1820,
    syncStatus: 'synced',
    feedback: 'Bagus, perlu ketelitian pada struktur organel vakuola dan kloroplas.'
  },
  {
    id: 'SUB-9003',
    examId: 'EXAM-2026-001',
    studentNo: '1006',
    studentName: 'Farhan Maulana',
    classGrade: 'X MIPA 1',
    answers: { 'Q-001': 'opt_b', 'Q-002': 'opt_c', 'Q-003': 'opt_c', 'Q-004': ['opt_a'], 'Q-005': 'Karang memutih karena tidak ada cahaya.' },
    score: 45,
    maxScore: 100,
    percentage: 45,
    passed: false,
    submittedAt: new Date(Date.now() - 10800000).toISOString(),
    tabSwitchCount: 3,
    timeSpentSeconds: 1980,
    syncStatus: 'synced',
    feedback: 'Perlu remedial materi organel sel dan ekosistem.'
  }
];

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
    this.setItem(STORAGE_KEYS.PROFILE, { ...profile, updatedAt: new Date().toISOString() });
    this.addLog('SYNC', 'Profil sekolah diperbarui secara lokal');
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
    return this.getItem<Question[]>(STORAGE_KEYS.QUESTIONS, DEFAULT_QUESTIONS);
  }

  static saveQuestions(questions: Question[]): void {
    this.setItem(STORAGE_KEYS.QUESTIONS, questions);
  }

  static getQuestionsByExamId(examId: string): Question[] {
    return this.getQuestions()
      .filter(q => q.examId === examId)
      .sort((a, b) => a.order - b.order);
  }

  static saveQuestionsForExam(examId: string, questions: Question[]): void {
    const all = this.getQuestions().filter(q => q.examId !== examId);
    this.saveQuestions([...all, ...questions]);
    // Perbarui totalQuestions pada exam
    const exams = this.getExams();
    const target = exams.find(e => e.id === examId);
    if (target) {
      target.totalQuestions = questions.length;
      this.saveExams(exams);
    }
    this.addLog('EXAM', `${questions.length} soal disimpan untuk ujian ${examId}`);
  }

  // Students
  static getStudents(): Student[] {
    return this.getItem<Student[]>(STORAGE_KEYS.STUDENTS, DEFAULT_STUDENTS);
  }

  static saveStudents(students: Student[]): void {
    this.setItem(STORAGE_KEYS.STUDENTS, students);
  }

  static upsertStudent(student: Student): void {
    const list = this.getStudents();
    const idx = list.findIndex(s => s.studentNo === student.studentNo || s.id === student.id);
    if (idx >= 0) {
      list[idx] = student;
    } else {
      list.push(student);
    }
    this.saveStudents(list);
  }

  static deleteStudent(id: string): void {
    const list = this.getStudents().filter(s => s.id !== id && s.studentNo !== id);
    this.saveStudents(list);
  }

  // Submissions
  static getSubmissions(): Submission[] {
    return this.getItem<Submission[]>(STORAGE_KEYS.SUBMISSIONS, DEFAULT_SUBMISSIONS);
  }

  static saveSubmissions(submissions: Submission[]): void {
    this.setItem(STORAGE_KEYS.SUBMISSIONS, submissions);
  }

  static addSubmission(submission: Submission): void {
    const list = this.getSubmissions();
    list.unshift(submission);
    this.saveSubmissions(list);
    this.addPendingSync(submission);
    this.addLog('EXAM', `Jawaban siswa ${submission.studentName} (${submission.studentNo}) tersimpan`);
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
    return this.getItem<UserAccount[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
  }

  static saveUsers(users: UserAccount[]): void {
    this.setItem(STORAGE_KEYS.USERS, users);
  }

  static upsertUser(user: UserAccount): void {
    const list = this.getUsers();
    const idx = list.findIndex(u => u.username === user.username || u.id === user.id);
    if (idx >= 0) {
      list[idx] = user;
    } else {
      list.push(user);
    }
    this.saveUsers(list);
  }

  static deleteUser(id: string): void {
    const list = this.getUsers().filter(u => u.id !== id);
    this.saveUsers(list);
  }

  static getCurrentUser(): UserAccount | null {
    return this.getItem<UserAccount | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  static setCurrentUser(user: UserAccount | null): void {
    this.setItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  // Settings
  static getSettings(): AppSettings {
    return this.getItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
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
