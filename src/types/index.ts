export interface SchoolProfile {
  name: string;
  npsn: string;
  address: string;
  logoUrl: string; // Logo Sekolah (kanan kop)
  regionalGovLogoUrl?: string; // Logo Pemerintah Daerah / Kota (kiri kop)
  regionalGovName?: string; // Nama Pemerintah Daerah (misal: PEMERINTAH KOTA MALANG)
  regionalGovDepartment?: string; // Nama Organisasi Perangkat Daerah / Dinas (misal: DINAS PENDIDIKAN DAN KEBUDAYAAN)
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  principalName: string;
  principalNip: string;
  teacherName: string;
  teacherNip?: string;
  teacherSubject?: string;
  teacherEmail?: string;
  teacherTitle?: string;
  updatedAt?: string;
}

export type TaxonomyType = 'bloom' | 'solo';

export type BloomLevel = 
  | 'C1 - Mengingat'
  | 'C2 - Memahami'
  | 'C3 - Menerapkan'
  | 'C4 - Menganalisis'
  | 'C5 - Mengevaluasi'
  | 'C6 - Mencipta';

export type SoloLevel = 
  | 'Prestructural'
  | 'Unistructural'
  | 'Multistructural'
  | 'Relational'
  | 'Extended Abstract';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  examId: string;
  order: number;
  prompt: string;
  type: 'multiple_choice' | 'checkbox' | 'essay';
  mediaType: 'none' | 'image' | 'audio' | 'video';
  mediaUrl?: string;
  options: QuestionOption[];
  correctKey: string | string[]; // Option ID or list of IDs or sample answer
  points: number;
  explanation?: string;
  bloomLevel?: BloomLevel;
  soloLevel?: SoloLevel;
  basicCompetency?: string;
  indicator?: string;
  element?: string; // Elemen materi (Kurikulum Merdeka)
  learningOutcome?: string; // Capaian Pembelajaran (CP)
  learningObjective?: string; // Tujuan Pembelajaran (TP)
  isDraft?: boolean;
  status?: 'draft' | 'published';
}

export interface CurriculumItem {
  id: string;
  subject: string; // Mata Pelajaran
  grade?: string; // Jenjang / Kelas / Fase (misal: Kelas X / Fase E)
  element: string; // Elemen materi
  learningOutcome: string; // Capaian Pembelajaran (CP)
  learningObjectives: string[]; // Daftar Tujuan Pembelajaran (TP)
  updatedAt?: string;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  grade: string;
  durationMinutes: number;
  passingScore: number;
  isStrict: boolean; // Anti-cheat & auto-submit on blur
  allowReview: boolean;
  startsAt: string; // ISO date string or YYYY-MM-DD HH:mm
  endsAt: string;
  status: 'draft' | 'active' | 'archived' | 'stopped';
  sessionStatus?: 'scheduled' | 'active' | 'ended' | 'stopped'; // Kontrol sesi langsung: dijadwalkan, aktif, dihentikan, atau ditutup
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  attemptMode?: 'unlimited' | 'single'; // 'unlimited' (berulang) atau 'single' (sekali saja)
  allowLateSubmission?: boolean; // Izinkan siswa terlambat melanjutkan sesi
  lateExtensionMinutes?: number; // Menit perpanjangan sesi untuk siswa terlambat
  totalQuestions: number;
  token?: string; // Optional exam access token/PIN
  instructions?: string;
  learningObjectives?: string[]; // Hingga 15 Tujuan Pembelajaran (TP)
  createdAt: string;
  redeployCount?: number;
}

export interface Student {
  id: string;
  studentNo: string; // NIS / NISN
  fullName: string;
  classGrade: string;
  nis?: string; // Nomor Induk Siswa (NIS)
  nisn?: string; // Nomor Induk Siswa Nasional (NISN)
  email?: string;
  phone?: string;
  status: 'active' | 'inactive';
}

export interface Submission {
  id: string;
  examId: string;
  studentNo: string;
  studentName: string;
  classGrade: string;
  answers: Record<string, string | string[]>;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
  tabSwitchCount: number;
  timeSpentSeconds: number;
  syncStatus: 'synced' | 'pending' | 'failed';
  feedback?: string;
  statusNote?: string; // 'Selesai' | 'Mengulang Ujian'
  allowRepeat?: boolean; // Izin mengulang dari guru
}

export interface UserAccount {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: 'admin' | 'teacher';
  email: string;
  active: boolean;
}

export interface AppLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  category: 'SYNC' | 'NETWORK' | 'AI_GEMINI' | 'EXAM' | 'AUTH';
  message: string;
  details?: string;
}

export interface AppSettings {
  gasWebAppUrl: string;
  geminiApiKey: string;
  geminiModel: string;
  autoSyncIntervalMinutes: number;
  offlineMode: boolean;
  theme: 'light' | 'dark' | 'system';
  enableAudioChime: boolean;
}

export interface QuestionAnalysis {
  questionId: string;
  order: number;
  prompt: string;
  type: string;
  learningObjective: string;
  bloomLevel?: string;
  totalAttempts: number;
  correctCount: number;
  correctRate: number; // 0 - 100%
  difficultyIndex: number; // P-value (0.0 - 1.0)
  difficultyLevel: 'Sangat Mudah' | 'Mudah' | 'Sedang' | 'Sukar' | 'Sangat Sukar';
  discriminationIndex: number; // D-index (-1.0 to 1.0)
  discriminationStatus: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Jelek (Revisi)' | 'Sangat Jelek (Buang)';
}

export interface ObjectiveAnalysis {
  objective: string;
  questionCount: number;
  questionOrders: number[];
  averageMastery: number; // 0 - 100%
  masteredStudentCount: number;
  unmasteredStudentCount: number;
  status: 'Tuntas' | 'Perlu Perbaikan' | 'Kritis';
}

export interface StudentRemedialRecommendation {
  studentNo: string;
  studentName: string;
  classGrade: string;
  score: number;
  percentage: number;
  passed: boolean;
  unmasteredObjectives: string[];
  masteredObjectives: string[];
  remedialPlan: string[];
  enrichmentPlan: string[];
}

export interface ChatMessage {
  id: string;
  senderType?: 'student' | 'teacher' | 'system';
  senderRole: 'student' | 'teacher' | 'system';
  senderName: string;
  senderNis?: string;
  classGrade?: string;
  examId?: string;
  examTitle?: string;
  targetNis?: string; // empty or undefined for broadcast, or specific student NIS
  targetName?: string;
  text: string;
  timestamp: number;
  isRead?: boolean;
  quickAction?: {
    type: 'request_token' | 'request_retake' | 'unregistered_student' | 'technical_issue' | 'send_token' | 'grant_retake' | 'general';
    token?: string;
    examId?: string;
    examTitle?: string;
  };
}

export interface ChatConversation {
  studentNis: string;
  studentName: string;
  classGrade?: string;
  lastMessage: ChatMessage;
  unreadCount: number;
  updatedAt: string;
}

