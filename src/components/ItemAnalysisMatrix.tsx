import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  ArrowLeft, 
  FileSpreadsheet, 
  FileText, 
  Sliders, 
  Download, 
  Filter, 
  CheckCircle2,
  Table as TableIcon
} from 'lucide-react';
import { Exam, Question, SchoolProfile, Submission, Student } from '../types';
import { StorageService } from '../services/storage';
import { exportItemAnalysisToExcel } from '../services/exportExcelService';
import { exportItemAnalysisToDocx } from '../services/exportDocxService';
import { PrintSetupModal } from './PrintSetupModal';

interface ItemAnalysisMatrixProps {
  profile: SchoolProfile;
  exams: Exam[];
  submissions: Submission[];
  students: Student[];
  initialExamId?: string;
  onBack: () => void;
}

export const ItemAnalysisMatrix: React.FC<ItemAnalysisMatrixProps> = ({
  profile,
  exams,
  submissions,
  students,
  initialExamId,
  onBack
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(
    initialExamId || exams[0]?.id || ''
  );
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [isPrintSetupOpen, setIsPrintSetupOpen] = useState<boolean>(false);

  const currentExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || exams[0];
  }, [exams, selectedExamId]);

  const questions: Question[] = useMemo(() => {
    if (!currentExam) return [];
    return StorageService.getQuestionsByExamId(currentExam.id).sort((a, b) => a.order - b.order);
  }, [currentExam]);

  // List of unique classes
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    if (currentExam?.grade) set.add(currentExam.grade);
    submissions.forEach(s => {
      if (s.classGrade) set.add(s.classGrade);
    });
    students.forEach(st => {
      if (st.classGrade) set.add(st.classGrade);
    });
    return Array.from(set).sort();
  }, [currentExam, submissions, students]);

  // Submissions for this exam
  const examSubmissions = useMemo(() => {
    if (!currentExam) return [];
    return submissions.filter(s => {
      const matchExam = String(s.examId).trim().toLowerCase() === String(currentExam.id).trim().toLowerCase();
      if (!matchExam) return false;
      if (s.statusNote === 'Mengulang Ujian') return false; // Exclude retakes in progress
      if (selectedClass !== 'all') {
        const studentClass = s.classGrade || currentExam.grade;
        if (studentClass !== selectedClass) return false;
      }
      return true;
    });
  }, [submissions, currentExam, selectedClass]);

  // Calculate per-question scores for each student
  const studentRows = useMemo(() => {
    return examSubmissions.map((sub, index) => {
      const matchedStudent = students.find(
        st => st.studentNo === sub.studentNo || st.fullName.toLowerCase() === sub.studentName.toLowerCase()
      );
      const nis = matchedStudent?.nis || sub.studentNo || '-';
      const nisn = matchedStudent?.nisn || '-';

      const questionScores = questions.map(q => {
        const studentAns = sub.answers ? sub.answers[q.id] : undefined;
        let score = 0;
        if (q.type === 'multiple_choice') {
          score = studentAns === q.correctKey ? (q.points || 1) : 0;
        } else if (q.type === 'checkbox') {
          const correctKeys = Array.isArray(q.correctKey) ? q.correctKey : [q.correctKey];
          const studentKeys = Array.isArray(studentAns) ? studentAns : [];
          const matchCount = correctKeys.filter(k => studentKeys.includes(k)).length;
          score = matchCount > 0 ? Math.round((matchCount / correctKeys.length) * (q.points || 1)) : 0;
        } else {
          // essay
          score = (studentAns && typeof studentAns === 'string' && studentAns.trim().length > 5) ? (q.points || 1) : 0;
        }
        return score;
      });

      const totalScore = questionScores.reduce((a, b) => a + b, 0);

      return {
        no: index + 1,
        nis,
        nisn,
        name: sub.studentName,
        questionScores,
        totalScore
      };
    });
  }, [examSubmissions, students, questions]);

  // Bottom row calculations: Total correct score, average, and percentage per question
  const columnSummaries = useMemo(() => {
    if (studentRows.length === 0 || questions.length === 0) return [];
    return questions.map((q, qIdx) => {
      const sum = studentRows.reduce((acc, row) => acc + (row.questionScores[qIdx] || 0), 0);
      const avg = sum / studentRows.length;
      const maxPossible = (q.points || 1) * studentRows.length;
      const percentage = maxPossible > 0 ? Math.round((sum / maxPossible) * 100) : 0;
      return { sum, avg: avg.toFixed(1), percentage };
    });
  }, [studentRows, questions]);

  const grandTotalScore = useMemo(() => {
    return studentRows.reduce((acc, r) => acc + r.totalScore, 0);
  }, [studentRows]);

  const grandAvgScore = useMemo(() => {
    return studentRows.length > 0 ? (grandTotalScore / studentRows.length).toFixed(1) : '0';
  }, [studentRows, grandTotalScore]);

  const handleExportExcel = () => {
    if (!currentExam) return;
    exportItemAnalysisToExcel(
      currentExam,
      questions,
      students,
      examSubmissions,
      profile,
      selectedClass !== 'all' ? selectedClass : currentExam.grade
    );
  };

  const handleExportDocx = () => {
    if (!currentExam) return;
    exportItemAnalysisToDocx(
      currentExam,
      questions,
      students,
      examSubmissions,
      profile,
      selectedClass !== 'all' ? selectedClass : currentExam.grade
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 pb-20">
      {/* -----------------------------------------------------------------
          TOP CONTROL BAR (Hidden during @media print)
         ----------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Kembali ke Dasbor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                  <TableIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Analisis Butir Soal Asesmen (Format Resmi Lampiran)</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono">
                  Landscape A4/F4
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Menampilkan nomor urut, NIS, NISN, nama siswa, skor per butir soal (1..N), dan total skor akhir.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Paket Ujian */}
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            >
              {exams.map(e => (
                <option key={e.id} value={e.id}>
                  {e.subject} - {e.title} ({e.grade})
                </option>
              ))}
            </select>

            {/* Filter Kelas */}
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">Semua Kelas</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>Kelas {c}</option>
              ))}
            </select>

            {/* Tombol Setup Cetak */}
            <button
              onClick={() => setIsPrintSetupOpen(true)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Atur margin, ukuran kertas F4/A4, dan properti printer"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Setup Cetak</span>
            </button>

            {/* Tombol Simpan Excel */}
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Download format Excel (.xlsx) persis tabel lampiran"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export .xlsx</span>
            </button>

            {/* Tombol Simpan Word */}
            <button
              onClick={handleExportDocx}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Download format Word (.docx) tabel landscape"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export .docx</span>
            </button>

            {/* Tombol Cetak / PDF */}
            <button
              onClick={() => {
                setIsPrintSetupOpen(true);
              }}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Landscape</span>
            </button>
          </div>
        </div>
      </header>

      {/* -----------------------------------------------------------------
          AREA DOKUMEN ANALISIS PERSIS FORMAT LAMPIRAN PDF
         ----------------------------------------------------------------- */}
      <main className="max-w-[340mm] mx-auto p-4 sm:p-8">
        <div className="print-area bg-white text-black shadow-xl print:shadow-none p-6 sm:p-10 border border-slate-200 print:border-none rounded-xl print:rounded-none">
          
          {/* Judul Dokumen Terpusat (Persis Lampiran PDF) */}
          <div className="text-center font-bold tracking-tight mb-6">
            <h2 className="text-base sm:text-lg uppercase">
              ANALISIS HASIL PENILAIAN AKHIR SEMESTER {profile.semester.toUpperCase()} TAHUN PELAJARAN {profile.academicYear}
            </h2>
            <h3 className="text-sm sm:text-base uppercase mt-0.5">
              KELAS {selectedClass !== 'all' ? selectedClass : (currentExam?.grade || '5B')}
            </h3>
            <h3 className="text-sm sm:text-base uppercase mt-0.5">
              {currentExam?.subject?.toUpperCase() || 'BAHASA JAWA'}
            </h3>
          </div>

          {/* Tabel Matriks Analisis Butir Soal */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-black text-[11px] leading-tight font-sans">
              <thead>
                <tr className="bg-slate-100 text-center font-bold">
                  <th className="border border-black px-1.5 py-1.5 w-8">NO</th>
                  <th className="border border-black px-2 py-1.5 w-16">NIS</th>
                  <th className="border border-black px-2 py-1.5 w-24">NISN</th>
                  <th className="border border-black px-3 py-1.5 text-left min-w-[180px]">NAMA</th>
                  {questions.map((q, idx) => (
                    <th 
                      key={q.id} 
                      className="border border-black px-1 py-1.5 min-w-[20px] text-center font-mono"
                      title={`Soal No. ${idx + 1} (${q.type === 'multiple_choice' ? 'PG' : q.type === 'checkbox' ? 'Kompleks' : 'Uraian'} - ${q.points || 1} Poin)`}
                    >
                      {idx + 1}
                    </th>
                  ))}
                  <th className="border border-black px-2.5 py-1.5 w-14 bg-amber-100 font-bold">SKOR</th>
                </tr>
              </thead>

              <tbody>
                {studentRows.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={questions.length + 5} 
                      className="border border-black p-8 text-center text-slate-500 italic"
                    >
                      Belum ada rekaman jawaban siswa untuk ujian ini. Siswa yang telah mengumpulkan jawaban akan otomatis tampil dalam matriks skor ini.
                    </td>
                  </tr>
                ) : (
                  studentRows.map((row) => (
                    <tr key={row.no} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-black px-1.5 py-1 text-center font-mono">{row.no}</td>
                      <td className="border border-black px-2 py-1 text-center font-mono">{row.nis}</td>
                      <td className="border border-black px-2 py-1 text-center font-mono">{row.nisn}</td>
                      <td className="border border-black px-3 py-1 font-medium whitespace-nowrap uppercase">{row.name}</td>
                      {row.questionScores.map((score, qIdx) => (
                        <td 
                          key={qIdx} 
                          className={`border border-black px-1 py-1 text-center font-mono ${
                            score === 0 ? 'text-slate-400' : 'font-bold text-slate-900'
                          }`}
                        >
                          {score}
                        </td>
                      ))}
                      <td className="border border-black px-2.5 py-1 text-center font-mono font-bold bg-amber-50">
                        {row.totalScore}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Baris Total & Statistik Bawah */}
              {studentRows.length > 0 && (
                <tfoot>
                  {/* Baris 1: Jumlah Skor */}
                  <tr className="bg-slate-50 font-bold text-center border-t-2 border-black">
                    <td colSpan={4} className="border border-black px-3 py-1.5 text-right uppercase">
                      JUMLAH SKOR BENAR
                    </td>
                    {columnSummaries.map((col, idx) => (
                      <td key={idx} className="border border-black px-1 py-1.5 font-mono text-[10px]">
                        {col.sum}
                      </td>
                    ))}
                    <td className="border border-black px-2 py-1.5 font-mono bg-amber-100">
                      {grandTotalScore}
                    </td>
                  </tr>

                  {/* Baris 2: Rata-Rata */}
                  <tr className="bg-slate-50 font-bold text-center">
                    <td colSpan={4} className="border border-black px-3 py-1 text-right uppercase text-[10px]">
                      RATA-RATA SKOR BUTIR
                    </td>
                    {columnSummaries.map((col, idx) => (
                      <td key={idx} className="border border-black px-1 py-1 font-mono text-[10px]">
                        {col.avg}
                      </td>
                    ))}
                    <td className="border border-black px-2 py-1 font-mono bg-amber-100 text-[10px]">
                      {grandAvgScore}
                    </td>
                  </tr>

                  {/* Baris 3: % Ketercapaian */}
                  <tr className="bg-slate-50 font-bold text-center">
                    <td colSpan={4} className="border border-black px-3 py-1 text-right uppercase text-[10px]">
                      % KETERCAPAIAN BUTIR
                    </td>
                    {columnSummaries.map((col, idx) => (
                      <td key={idx} className="border border-black px-1 py-1 font-mono text-[10px] text-indigo-700">
                        {col.percentage}%
                      </td>
                    ))}
                    <td className="border border-black px-2 py-1 font-mono bg-amber-100 text-[10px]">
                      -
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Lembar Tanda Tangan Pengesahan (Bawah Dokumen) */}
          <div className="mt-8 pt-4 flex items-start justify-between text-xs font-serif leading-snug print-break-inside-avoid">
            <div className="text-center w-64">
              <p>Mengetahui,</p>
              <p>Kepala Sekolah {profile.name || 'SDN Pisangcandi 1'}</p>
              <div className="h-16"></div>
              <p className="font-bold underline uppercase">{profile.principalName || 'Dr. H. Sulaiman, M.Pd.'}</p>
              <p className="font-sans text-[11px]">NIP. {profile.principalNip || '19750812 200003 1 002'}</p>
            </div>

            <div className="text-center w-64">
              <p>Kota Malang, {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}</p>
              <p>Guru Pengampu / Wali Kelas,</p>
              <div className="h-16"></div>
              <p className="font-bold underline uppercase">{profile.teacherName || 'Siti Rahmawati, S.Pd.'}</p>
              <p className="font-sans text-[11px]">{profile.teacherNip ? `NIP. ${profile.teacherNip}` : 'NIP. -'}</p>
            </div>
          </div>

        </div>
      </main>

      {/* Modal Setup Print */}
      <PrintSetupModal
        isOpen={isPrintSetupOpen}
        onClose={() => setIsPrintSetupOpen(false)}
        documentTitle={`Analisis Butir Soal - ${currentExam?.subject} (${selectedClass !== 'all' ? selectedClass : currentExam?.grade})`}
        defaultOrientation="landscape"
      />
    </div>
  );
};
