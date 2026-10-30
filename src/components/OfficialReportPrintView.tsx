import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  ArrowLeft, 
  FileText, 
  Sliders, 
  CheckCircle2, 
  Award, 
  AlertCircle, 
  User, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  Check, 
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { Exam, Submission, Question, SchoolProfile, Student } from '../types';
import { StorageService } from '../services/storage';

interface OfficialReportPrintViewProps {
  profile: SchoolProfile;
  exams: Exam[];
  submissions: Submission[];
  students: Student[];
  initialExamId?: string;
  initialReportMode?: 'klasikal' | 'individu';
  initialStudentNis?: string;
  onBack: () => void;
  onAllowRetake?: (submissionId: string) => void;
}

export const OfficialReportPrintView: React.FC<OfficialReportPrintViewProps> = ({
  profile,
  exams,
  submissions,
  students,
  initialExamId,
  initialReportMode = 'klasikal',
  initialStudentNis,
  onBack,
  onAllowRetake
}) => {
  // Mode selection: Klasikal (Rekap Kelas) vs Individu (Raport Siswa)
  const [reportMode, setReportMode] = useState<'klasikal' | 'individu'>(initialReportMode);
  
  // Selected Exam Filter
  const [selectedExamId, setSelectedExamId] = useState<string>(
    initialExamId || exams[0]?.id || ''
  );

  // Selected Student for Individu Report
  const [selectedStudentNis, setSelectedStudentNis] = useState<string>(() => {
    if (initialStudentNis) return initialStudentNis;
    const firstSub = submissions.find(s => !selectedExamId || s.examId === selectedExamId);
    return firstSub?.studentNo || students[0]?.studentNo || '';
  });

  // Display customization
  const [fontSizeMode, setFontSizeMode] = useState<'sm' | 'base'>('base');
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showTpBreakdown, setShowTpBreakdown] = useState<boolean>(true);

  // Current Exam Data
  const currentExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || exams[0];
  }, [exams, selectedExamId]);

  // Questions for this exam
  const examQuestions = useMemo(() => {
    if (!currentExam) return [];
    return StorageService.getQuestionsByExamId(currentExam.id);
  }, [currentExam]);

  // Submissions filtered for current exam
  const examSubmissions = useMemo(() => {
    if (!currentExam) return [];
    return (submissions || []).filter(
      s => String(s.examId).trim().toLowerCase() === String(currentExam.id).trim().toLowerCase()
    );
  }, [submissions, currentExam]);

  // Student options who participated or are in roster
  const availableStudents = useMemo(() => {
    const map = new Map<string, { nis: string; name: string; classGrade: string; hasSubmitted: boolean }>();
    
    // First from submissions
    examSubmissions.forEach(sub => {
      if (sub.studentNo) {
        map.set(sub.studentNo, {
          nis: sub.studentNo,
          name: sub.studentName,
          classGrade: sub.classGrade || currentExam?.grade || '',
          hasSubmitted: true
        });
      }
    });

    // Then from student roster matching class
    students.forEach(st => {
      if (!map.has(st.studentNo)) {
        map.set(st.studentNo, {
          nis: st.studentNo,
          name: st.fullName,
          classGrade: st.classGrade,
          hasSubmitted: false
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [examSubmissions, students, currentExam]);

  // Selected student's submission (if any)
  const currentSubmission = useMemo(() => {
    return examSubmissions.find(
      s => s.studentNo?.toLowerCase() === selectedStudentNis?.toLowerCase()
    );
  }, [examSubmissions, selectedStudentNis]);

  // Selected student's profile info
  const currentStudentInfo = useMemo(() => {
    return availableStudents.find(
      s => s.nis.toLowerCase() === selectedStudentNis?.toLowerCase()
    );
  }, [availableStudents, selectedStudentNis]);

  // Statistics calculation for Klasikal
  const stats = useMemo(() => {
    const validSubs = examSubmissions.filter(s => s.statusNote !== 'Mengulang Ujian');
    const total = validSubs.length;
    if (total === 0) {
      return {
        total: 0,
        average: 0,
        passedCount: 0,
        remedialCount: 0,
        passPercentage: 0,
        highest: 0,
        lowest: 0,
        tabSwitchCount: 0
      };
    }
    const scores = validSubs.map(s => Number(s.percentage) || 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / total);
    const kkm = currentExam?.passingScore || 75;
    const passed = validSubs.filter(s => (Number(s.percentage) || 0) >= kkm).length;
    const remedial = total - passed;
    const tabSwitches = validSubs.reduce((acc, s) => acc + (s.tabSwitchCount || 0), 0);

    return {
      total,
      average: avg,
      passedCount: passed,
      remedialCount: remedial,
      passPercentage: Math.round((passed / total) * 100),
      highest: Math.max(...scores),
      lowest: Math.min(...scores),
      tabSwitchCount: tabSwitches
    };
  }, [examSubmissions, currentExam]);

  // Print execution
  const handlePrint = () => {
    window.print();
  };

  // Predicate Helper
  const getPredicate = (percentage: number, kkm: number) => {
    if (percentage >= 90) return { label: 'A (Sangat Baik)', code: 'A', bg: 'bg-emerald-50 text-emerald-700' };
    if (percentage >= kkm) return { label: 'B (Baik)', code: 'B', bg: 'bg-blue-50 text-blue-700' };
    if (percentage >= kkm - 15) return { label: 'C (Cukup / Remidi)', code: 'C', bg: 'bg-amber-50 text-amber-700' };
    return { label: 'D (Kurang / Remidi)', code: 'D', bg: 'bg-rose-50 text-rose-700' };
  };

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 pb-20">
      {/* -----------------------------------------------------------------
          TOP CONTROL BAR (Hidden during @media print)
         ----------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs no-print">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Kembali ke Dasbor Nilai"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Format Laporan Resmi Cetak (SDN Pisangcandi 1)
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  A4 Standar
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dokumen resmi berstandar sekolah, dicetak langsung dari data aplikasi tanpa screenshot.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Report Mode Selector */}
            <div className="flex items-center rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setReportMode('klasikal')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  reportMode === 'klasikal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                }`}
              >
                Opsi A: Rekap Klasikal
              </button>
              <button
                type="button"
                onClick={() => setReportMode('individu')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  reportMode === 'individu'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                }`}
              >
                Opsi B: Rapor Individu
              </button>
            </div>

            {/* Print Trigger Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Dokumen Sekarang (PDF)</span>
            </button>
          </div>
        </div>

        {/* Second row: Exam & Student Selector (no-print) */}
        <div className="max-w-6xl mx-auto px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Exam Selector */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Paket Ujian:</span>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
              >
                {exams.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.subject} - {e.title} ({e.grade})
                  </option>
                ))}
              </select>
            </div>

            {/* Student Selector (for Individu mode) */}
            {reportMode === 'individu' && (
              <div id="containerPilihSiswa" className="flex items-center gap-2">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-bold">Pilih Siswa:</span>
                <select
                  id="selectSiswa"
                  value={selectedStudentNis}
                  onChange={(e) => setSelectedStudentNis(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-indigo-400 bg-indigo-50/70 dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                >
                  <option value="">-- Cari / Pilih Nama Siswa --</option>
                  {availableStudents.map(st => (
                    <option key={st.nis} value={st.nis}>
                      {st.nis} - {st.name} ({st.classGrade}) {st.hasSubmitted ? '✓ Selesai' : '(Belum Kirim)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-500">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span>Tampilkan Kolom Tanda Tangan</span>
            </label>

            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-3">
              <span>Ukuran Teks:</span>
              <button
                onClick={() => setFontSizeMode('sm')}
                className={`px-2 py-0.5 rounded ${fontSizeMode === 'sm' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-200 dark:bg-slate-800'}`}
              >
                Padat
              </button>
              <button
                onClick={() => setFontSizeMode('base')}
                className={`px-2 py-0.5 rounded ${fontSizeMode === 'base' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-200 dark:bg-slate-800'}`}
              >
                Normal
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* -----------------------------------------------------------------
          A4 PAPER CONTAINER FOR REAL PRINTING
         ----------------------------------------------------------------- */}
      <main className="print-area max-w-[210mm] mx-auto mt-6 bg-white text-black shadow-lg border border-slate-200 p-8 sm:p-12 print:m-0 print:p-0 print:border-none print:shadow-none print:w-full print:max-w-none">
        
        {/* ==============================================================
            KOP SURAT RESMI SEKOLAH STANDAR TATA NASKAH DINAS
           ============================================================== */}
        <div className="kop-surat relative border-b-2 border-black pb-3 mb-6 print-break-inside-avoid">
          <div className="flex items-center justify-between gap-4">
            {/* Logo Pemerintah Daerah (SEBELAH KIRI KOP SURAT) */}
            <div className="w-20 h-20 flex items-center justify-center shrink-0">
              {profile.regionalGovLogoUrl ? (
                <img
                  src={profile.regionalGovLogoUrl}
                  alt="Logo Pemda Kiri"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 object-contain shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded border border-black flex flex-col items-center justify-center text-[10px] font-bold text-center shrink-0 leading-tight">
                  <span>PEMDA</span>
                  <span className="text-[8px] font-normal">KIRI</span>
                </div>
              )}
            </div>

            {/* Hirarki Teks Kedinasan: Pemda -> OPD -> Nama Sekolah -> Alamat */}
            <div className="flex-1 text-center font-serif leading-tight">
              <h4 className="text-xs uppercase tracking-widest font-bold text-black">
                {profile.regionalGovName || 'PEMERINTAH KOTA MALANG'}
              </h4>
              <h4 className="text-xs uppercase tracking-wider font-bold text-black mt-0.5">
                {profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}
              </h4>
              <h2 className="text-base sm:text-lg uppercase font-extrabold tracking-wide text-black mt-1">
                {profile.name || 'SD NEGERI PISANGCANDI 1 MALANG'}
              </h2>
              <p className="text-[11px] text-black mt-0.5 font-sans">
                {profile.address || 'Jl. Raya Pisang Candi No. 1, Kec. Sukun, Kota Malang, Jawa Timur 65146'}
              </p>
              <p className="text-[10px] text-black font-mono mt-0.5">
                NPSN: {profile.npsn || '20533857'} · Tahun Ajaran: {profile.academicYear || '2026/2027'} · Semester: {profile.semester || 'Genap'}
              </p>
            </div>

            {/* Logo Satuan Pendidikan / Sekolah (SEBELAH KANAN KOP SURAT) */}
            <div className="w-20 h-20 flex items-center justify-center shrink-0">
              {profile.logoUrl ? (
                <img
                  src={profile.logoUrl}
                  alt="Logo Sekolah Kanan"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 object-contain shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded border border-black flex flex-col items-center justify-center text-[10px] font-bold text-center shrink-0 leading-tight">
                  <span>SEKOLAH</span>
                  <span className="text-[8px] font-normal">KANAN</span>
                </div>
              )}
            </div>
          </div>
          {/* Double underline standard Kop Surat Resmi */}
          <div className="border-b-4 border-black mt-1.5"></div>
        </div>

        {/* ==============================================================
            OPSI A: LAPORAN REKAPITULASI KLASIKAL (REKAP KELAS)
           ============================================================== */}
        {reportMode === 'klasikal' && (
          <div className="space-y-6">
            {/* Header Judul Laporan */}
            <div className="text-center space-y-1">
              <h1 className="text-base sm:text-lg font-bold uppercase tracking-wider underline font-serif">
                LAPORAN REKAPITULASI HASIL ASESMEN KLASIKAL
              </h1>
              <p className="text-xs text-slate-700">
                Tahun Ajaran {profile.academicYear || '2026/2027'} — Semester {profile.semester || 'Ganjil'}
              </p>
            </div>

            {/* Identitas Mata Pelajaran & Kelas */}
            <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 rounded-lg p-3 bg-slate-50/50">
              <div className="space-y-1">
                <div className="flex">
                  <span className="w-32 font-semibold text-slate-600">Mata Pelajaran</span>
                  <span className="font-bold">: {currentExam?.subject || 'Semua Mata Pelajaran'}</span>
                </div>
                <div className="flex">
                  <span className="w-32 font-semibold text-slate-600">Judul Asesmen</span>
                  <span className="font-bold">: {currentExam?.title || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-32 font-semibold text-slate-600">Sasaran Kelas</span>
                  <span>: {currentExam?.grade || 'Semua Kelas'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex">
                  <span className="w-32 font-semibold text-slate-600">Batas Kelulusan (KKM)</span>
                  <span className="font-bold">: {currentExam?.passingScore || 75} Poin</span>
                </div>
                <div className="flex">
                  <span className="w-32 font-semibold text-slate-600">Jumlah Soal / Durasi</span>
                  <span>: {examQuestions.length || currentExam?.totalQuestions || 0} Butir Soal · {currentExam?.durationMinutes || 60} Menit</span>
                </div>
                <div className="flex">
                  <span className="w-32 font-semibold text-slate-600">Guru Pengampu</span>
                  <span>: {profile.teacherName || 'Siti Rahmawati, S.Pd.'}</span>
                </div>
              </div>
            </div>

            {/* TABEL STATISTIK RINGKASAN KELAS (Mirip Tab 2 Laporan_Klasikal) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Ringkasan Statistik Pencapaian Kelas</span>
              </h3>
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="border border-slate-300 p-2 text-center">Total Peserta</th>
                    <th className="border border-slate-300 p-2 text-center">Rata-Rata Kelas</th>
                    <th className="border border-slate-300 p-2 text-center">Tuntas KKM</th>
                    <th className="border border-slate-300 p-2 text-center">Belum Tuntas (Remidial)</th>
                    <th className="border border-slate-300 p-2 text-center">% Ketuntasan</th>
                    <th className="border border-slate-300 p-2 text-center">Nilai Tertinggi / Terendah</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-center font-semibold">
                    <td className="border border-slate-300 p-2 font-mono font-bold">{stats.total} Siswa</td>
                    <td className="border border-slate-300 p-2 font-mono text-indigo-700 font-bold">{stats.average}%</td>
                    <td className="border border-slate-300 p-2 font-mono text-emerald-700">{stats.passedCount} Siswa</td>
                    <td className="border border-slate-300 p-2 font-mono text-rose-700">{stats.remedialCount} Siswa</td>
                    <td className="border border-slate-300 p-2 font-mono font-bold">
                      <span className={`px-2 py-0.5 rounded ${stats.passPercentage >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {stats.passPercentage}%
                      </span>
                    </td>
                    <td className="border border-slate-300 p-2 font-mono text-[11px]">
                      Maks: {stats.highest}% · Min: {stats.lowest}%
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                <span>* Rumus sinkronisasi Google Sheets: <code>=AVERAGE(Data_Mentah!E2:E30)</code> & <code>=COUNTIF(Data_Mentah!F2:F, "Lulus")</code></span>
                <span>Catatan Pelanggaran Tab Browser: {stats.tabSwitchCount} kali tercatat</span>
              </div>
            </div>

            {/* TABEL REKAPITULASI DAFTAR NILAI KOLEKTIF */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
                <span>Daftar Perolehan Nilai Kolektif Peserta Didik</span>
                <span className="text-[10px] font-normal text-slate-500">Total {examSubmissions.length} Data Rekaman</span>
              </h3>
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="border border-slate-300 p-2 w-10 text-center">No.</th>
                    <th className="border border-slate-300 p-2 w-20 text-center font-mono">NIS</th>
                    <th className="border border-slate-300 p-2 text-left">Nama Lengkap Siswa</th>
                    <th className="border border-slate-300 p-2 w-20 text-center">Kelas</th>
                    <th className="border border-slate-300 p-2 w-16 text-center font-mono">Nilai</th>
                    <th className="border border-slate-300 p-2 w-20 text-center">Predikat</th>
                    <th className="border border-slate-300 p-2 w-24 text-center">Status</th>
                    <th className="border border-slate-300 p-2 w-24 text-center">Durasi</th>
                    <th className="border border-slate-300 p-2 w-20 text-center">Pindah Tab</th>
                  </tr>
                </thead>
                <tbody>
                  {examSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="border border-slate-300 p-6 text-center text-slate-400">
                        Belum ada rekaman nilai untuk paket ujian ini.
                      </td>
                    </tr>
                  ) : (
                    examSubmissions.map((sub, idx) => {
                      const kkm = currentExam?.passingScore || 75;
                      const scoreNum = Number(sub.percentage) || 0;
                      const isMengulang = sub.statusNote === 'Mengulang Ujian';
                      const pred = getPredicate(scoreNum, kkm);

                      return (
                        <tr key={sub.id || idx} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                          <td className="border border-slate-300 p-2 text-center font-mono font-medium">{sub.studentNo}</td>
                          <td className="border border-slate-300 p-2 font-medium">
                            <span>{sub.studentName}</span>
                            {isMengulang && (
                              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                Mengulang Ujian
                              </span>
                            )}
                          </td>
                          <td className="border border-slate-300 p-2 text-center">{sub.classGrade || currentExam?.grade || '-'}</td>
                          <td className="border border-slate-300 p-2 text-center font-mono font-bold text-sm">
                            {isMengulang ? '-' : `${scoreNum}%`}
                          </td>
                          <td className="border border-slate-300 p-2 text-center">
                            {isMengulang ? '-' : (
                              <span className="font-bold">{pred.code}</span>
                            )}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-semibold">
                            {isMengulang ? (
                              <span className="text-amber-700 text-[11px]">Mengulang</span>
                            ) : sub.passed ? (
                              <span className="text-emerald-700">Tuntas</span>
                            ) : (
                              <span className="text-rose-700">Remedial</span>
                            )}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-mono text-[11px]">
                            {sub.timeSpentSeconds ? `${Math.floor(sub.timeSpentSeconds / 60)}m ${sub.timeSpentSeconds % 60}s` : '-'}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-mono text-[11px]">
                            {(sub.tabSwitchCount || 0) > 0 ? (
                              <span className="text-amber-700 font-bold">{sub.tabSwitchCount}x</span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Catatan Tindak Lanjut Guru */}
            <div className="border border-slate-300 rounded-lg p-3 text-xs bg-slate-50/40 space-y-1">
              <span className="font-bold text-slate-800 block uppercase tracking-wide">
                Catatan Evaluasi & Rencana Tindak Lanjut:
              </span>
              <p className="text-slate-700 leading-relaxed">
                {stats.passPercentage >= 75
                  ? `Pencapaian kelas telah melampaui ambang ketuntasan (${stats.passPercentage}% tuntas). Peserta didik yang belum tuntas (${stats.remedialCount} siswa) akan mengikuti bimbingan remidi terfokus, sedangkan peserta tuntas diberikan penugasan pengayaan.`
                  : `Tingkat ketuntasan kelas masih di bawah target (${stats.passPercentage}%). Disarankan melakukan ulasan konsep dasar secara klasikal serta asesmen ulang (remedial teaching) pada indikator butir soal yang memiliki tingkat kesukaran tinggi.`}
              </p>
            </div>
          </div>
        )}

        {/* ==============================================================
            OPSI B: LAPORAN HASIL ASESMEN INDIVIDU (RAPORT SISWA)
           ============================================================== */}
        {reportMode === 'individu' && (
          <div className="space-y-6">
            {/* Header Judul Laporan */}
            <div className="text-center space-y-1">
              <h1 className="text-base sm:text-lg font-bold uppercase tracking-wider underline font-serif">
                LEMBAR RAPOR HASIL BELAJAR PESERTA DIDIK
              </h1>
              <p className="text-xs text-slate-700">
                Laporan Hasil Asesmen Mandiri Berbasis Komputer · Tahun Ajaran {profile.academicYear || '2026/2027'}
              </p>
            </div>

            {/* Identitas Siswa & Mata Pelajaran */}
            <div className="border border-slate-300 rounded-lg p-4 bg-slate-50/60 text-xs">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600">Nama Peserta Didik</span>
                  <span className="font-bold text-slate-900">: {currentStudentInfo?.name || currentSubmission?.studentName || 'Belum Dipilih'}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600">Mata Pelajaran</span>
                  <span className="font-bold">: {currentExam?.subject || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600">Nomor Induk Siswa (NIS)</span>
                  <span className="font-mono font-bold">: {currentStudentInfo?.nis || currentSubmission?.studentNo || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600">Paket Ujian</span>
                  <span>: {currentExam?.title || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600">Kelas / Rombel</span>
                  <span>: {currentStudentInfo?.classGrade || currentSubmission?.classGrade || currentExam?.grade || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600">Waktu Pengerjaan</span>
                  <span>: {currentSubmission?.submittedAt ? new Date(currentSubmission.submittedAt).toLocaleString('id-ID') : 'Belum mengirimkan jawaban'}</span>
                </div>
              </div>
            </div>

            {/* BOX CAPAIAN NILAI & STATUS KELULUSAN */}
            {currentSubmission ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="border border-slate-300 rounded-lg p-3 bg-white">
                  <span className="text-[11px] text-slate-500 uppercase font-bold block mb-1">Nilai Akhir Siswa</span>
                  <div className="text-3xl font-extrabold font-mono text-indigo-700">
                    {currentSubmission.statusNote === 'Mengulang Ujian' ? '-' : `${Number(currentSubmission.percentage) || 0}%`}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Skor: {currentSubmission.score || 0} dari {currentSubmission.maxScore || 100}
                  </span>
                </div>

                <div className="border border-slate-300 rounded-lg p-3 bg-white">
                  <span className="text-[11px] text-slate-500 uppercase font-bold block mb-1">Kriteria Ketuntasan (KKM)</span>
                  <div className="text-3xl font-extrabold font-mono text-slate-800">
                    {currentExam?.passingScore || 75}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Batas Minimum Kelulusan
                  </span>
                </div>

                <div className="border border-slate-300 rounded-lg p-3 bg-white">
                  <span className="text-[11px] text-slate-500 uppercase font-bold block mb-1">Status Kelulusan</span>
                  <div className="text-2xl font-extrabold mt-1">
                    {currentSubmission.statusNote === 'Mengulang Ujian' ? (
                      <span className="text-amber-600">MENGULANG</span>
                    ) : currentSubmission.passed ? (
                      <span className="text-emerald-700">TUNTAS KKM</span>
                    ) : (
                      <span className="text-rose-700">REMEDIAL</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Predikat: {getPredicate(Number(currentSubmission.percentage) || 0, currentExam?.passingScore || 75).label}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs text-center">
                Siswa atas nama ini belum memiliki catatan pengerjaan ujian. Nilai akan otomatis ditampilkan setelah siswa mengirimkan jawaban.
              </div>
            )}

            {/* TABEL CAPAIAN TUJUAN PEMBELAJARAN (TP) */}
            {currentExam?.learningObjectives && currentExam.learningObjectives.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ketercapaian Tujuan Pembelajaran (TP) Kurikulum Merdeka</span>
                </h3>
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="border border-slate-300 p-2 w-10 text-center">No.</th>
                      <th className="border border-slate-300 p-2 text-left">Deskripsi Tujuan Pembelajaran (TP)</th>
                      <th className="border border-slate-300 p-2 w-28 text-center">Status Capaian</th>
                      <th className="border border-slate-300 p-2 w-44 text-left">Keterangan Evaluatif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentExam.learningObjectives.map((tp, idx) => {
                      const isPassed = currentSubmission?.passed ?? true;
                      return (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="border border-slate-300 p-2 text-center font-mono font-bold">TP {idx + 1}</td>
                          <td className="border border-slate-300 p-2 leading-relaxed">{tp}</td>
                          <td className="border border-slate-300 p-2 text-center font-bold">
                            {isPassed ? (
                              <span className="text-emerald-700">Tercapai</span>
                            ) : (
                              <span className="text-rose-700">Perlu Bimbingan</span>
                            )}
                          </td>
                          <td className="border border-slate-300 p-2 text-[11px] text-slate-600">
                            {isPassed
                              ? 'Menunjukkan penguasaan kompetensi yang baik.'
                              : 'Perlu latihan tambahan dan pemahaman ulang materi.'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* CATATAN INTEGRITAS & EVALUASI GURU KELAS */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50 space-y-1">
                <span className="font-bold text-slate-800 block uppercase tracking-wide flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Integritas Pengerjaan Ujian</span>
                </span>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  {currentSubmission?.tabSwitchCount && currentSubmission.tabSwitchCount > 0
                    ? `Perhatian: Tercatat ${currentSubmission.tabSwitchCount} kali berpindah tab/jendela browser selama sesi ujian berlangsung.`
                    : 'Disiplin dan tertib. Tidak tercatat adanya perpindahan jendela/tab browser selama asesmen.'}
                </p>
                <div className="text-[10px] text-slate-500 pt-1">
                  Durasi pengerjaan: {currentSubmission?.timeSpentSeconds ? `${Math.floor(currentSubmission.timeSpentSeconds / 60)} menit` : '-'}
                </div>
              </div>

              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50 space-y-1">
                <span className="font-bold text-slate-800 block uppercase tracking-wide">
                  Saran Remidi / Pengayaan Guru:
                </span>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  {currentSubmission?.passed
                    ? 'Pertahankan prestasi belajar dan kembangkan wawasan melalui materi pengayaan serta literasi mandiri.'
                    : 'Diharapkan mempelajari kembali materi terkait dan berkoordinasi dengan guru pengampu untuk pelaksanaan remedial.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            KOLOM TANDA TANGAN FORMAL (GURU, KEPALA SEKOLAH, ORANG TUA)
           ============================================================== */}
        {showSignatures && (
          <div className="mt-10 pt-6 border-t border-slate-300 text-xs print-break-inside-avoid">
            <div className="text-right text-xs mb-4 text-slate-700">
              Kota Malang, {todayStr}
            </div>

            {reportMode === 'klasikal' ? (
              /* Tanda tangan 2 kolom untuk Klasikal */
              <div className="grid grid-cols-2 gap-8 text-center">
                <div>
                  <span className="block text-slate-600 mb-1">Mengetahui,</span>
                  <span className="block font-bold text-slate-900">Kepala SD Negeri Pisangcandi 1</span>
                  <div className="h-20 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-xs">[Tanda Tangan & Cap Sekolah]</span>
                  </div>
                  <span className="block font-bold underline text-slate-900 mt-2">
                    {profile.principalName || 'Dr. H. Sulaiman, M.Pd.'}
                  </span>
                  <span className="block font-mono text-[11px] text-slate-600">
                    NIP. {profile.principalNip || '19750812 200003 1 002'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-600 mb-1">Pendidik / Guru Kelas</span>
                  <span className="block font-bold text-slate-900">
                    {currentExam?.subject || 'Guru Pengampu Asesmen'}
                  </span>
                  <div className="h-20 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-xs">[Tanda Tangan Guru]</span>
                  </div>
                  <span className="block font-bold underline text-slate-900 mt-2">
                    {profile.teacherName || 'Siti Rahmawati, S.Pd.'}
                  </span>
                  <span className="block font-mono text-[11px] text-slate-600">
                    NIP. {profile.teacherNip || '19820514 200801 2 009'}
                  </span>
                </div>
              </div>
            ) : (
              /* Tanda tangan 3 kolom untuk Individu (Orang Tua, Guru, Kepala Sekolah) */
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <span className="block text-slate-600 mb-1">Orang Tua / Wali Murid</span>
                  <div className="h-20 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-[11px]">[Tanda Tangan Wali]</span>
                  </div>
                  <div className="border-b border-black w-36 mx-auto mt-2"></div>
                  <span className="block text-[11px] text-slate-500 mt-0.5">( ......................................... )</span>
                </div>

                <div>
                  <span className="block text-slate-600 mb-1">Guru Kelas / Pengampu</span>
                  <div className="h-20 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-[11px]">[Tanda Tangan Guru]</span>
                  </div>
                  <span className="block font-bold underline text-slate-900 mt-2">
                    {profile.teacherName || 'Siti Rahmawati, S.Pd.'}
                  </span>
                  <span className="block font-mono text-[10px] text-slate-600">
                    NIP. {profile.teacherNip || '19820514 200801 2 009'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-600 mb-1">Mengetahui,</span>
                  <span className="block font-bold text-slate-900 text-[11px]">Kepala SDN Pisangcandi 1</span>
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-[11px]">[Cap & Tanda Tangan]</span>
                  </div>
                  <span className="block font-bold underline text-slate-900 mt-2">
                    {profile.principalName || 'Dr. H. Sulaiman, M.Pd.'}
                  </span>
                  <span className="block font-mono text-[10px] text-slate-600">
                    NIP. {profile.principalNip || '19750812 200003 1 002'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
