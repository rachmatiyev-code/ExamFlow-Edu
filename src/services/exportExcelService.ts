import * as XLSX from 'xlsx';
import { Exam, Question, SchoolProfile, Submission, Student } from '../types';
import { AnalysisService } from './analysisService';

/**
 * 1. Export Naskah Soal & Butir Soal ke .xlsx
 */
export function exportExamToExcel(
  exam: Exam,
  questions: Question[],
  profile: SchoolProfile
) {
  const wb = XLSX.utils.book_new();

  // Tab 1: Ringkasan Ujian
  const examInfo = [
    ['PEMERINTAH KOTA MALANG', ''],
    ['DINAS PENDIDIKAN DAN KEBUDAYAAN', ''],
    [profile.name || 'SDN PISANGCANDI 1', ''],
    [`NPSN: ${profile.npsn || '20533857'}`, ''],
    ['', ''],
    ['INFORMASI DOKUMEN ASESMEN', ''],
    ['Mata Pelajaran', exam.subject],
    ['Kelas / Jenjang', exam.grade],
    ['Paket / Judul Ujian', exam.title],
    ['Durasi', `${exam.durationMinutes} Menit`],
    ['Batas KKM', exam.passingScore],
    ['Jumlah Butir Soal', questions.length],
    ['Tahun Ajaran', profile.academicYear],
    ['Semester', profile.semester],
    ['Kepala Sekolah', profile.principalName],
    ['Guru Pengampu', profile.teacherName]
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(examInfo);
  wsInfo['!cols'] = [{ wch: 25 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Informasi_Ujian');

  // Tab 2: Bank Butir Soal & Kunci Jawaban
  const questionRows = [
    [
      'NO',
      'TIPE SOAL',
      'BUTIR PERTANYAAN',
      'OPSI A',
      'OPSI B',
      'OPSI C',
      'OPSI D',
      'KUNCI JAWABAN',
      'BOBOT POIN',
      'LEVEL KOGNITIF',
      'TUJUAN PEMBELAJARAN (TP)'
    ],
    ...questions.map((q, idx) => {
      const optA = q.options?.[0]?.text?.replace(/<[^>]*>/g, '') || '';
      const optB = q.options?.[1]?.text?.replace(/<[^>]*>/g, '') || '';
      const optC = q.options?.[2]?.text?.replace(/<[^>]*>/g, '') || '';
      const optD = q.options?.[3]?.text?.replace(/<[^>]*>/g, '') || '';
      
      let keyLabel = '';
      if (Array.isArray(q.correctKey)) {
        keyLabel = q.correctKey.join(', ');
      } else if (typeof q.correctKey === 'string') {
        const foundIdx = q.options?.findIndex(o => o.id === q.correctKey);
        keyLabel = foundIdx !== -1 && foundIdx !== undefined ? String.fromCharCode(65 + foundIdx) : q.correctKey;
      }

      return [
        idx + 1,
        q.type === 'multiple_choice' ? 'Pilihan Ganda' : q.type === 'checkbox' ? 'PG Kompleks' : q.type === 'short_answer' ? 'Isian Pendek' : q.type === 'matching' ? 'Menjodohkan' : 'Uraian',
        q.prompt.replace(/<[^>]*>/g, ''),
        optA,
        optB,
        optC,
        optD,
        keyLabel,
        q.points || 10,
        q.bloomLevel || 'C3',
        q.learningObjective || ''
      ];
    })
  ];

  const wsQuestions = XLSX.utils.aoa_to_sheet(questionRows);
  wsQuestions['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 50 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Naskah_Soal');

  const cleanTitle = (exam.title || 'Ujian').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Naskah_Soal_${cleanTitle}.xlsx`);
}

/**
 * 2. Export Rekapitulasi Nilai Kelas & Mapel ke .xlsx
 */
export function exportGradeRecapToExcel(
  exam: Exam,
  submissions: Submission[],
  profile: SchoolProfile,
  classGrade?: string
) {
  const wb = XLSX.utils.book_new();
  const kkm = exam.passingScore || 75;
  const validSubs = submissions.filter(s => s.statusNote !== 'Mengulang Ujian');

  const rows: any[][] = [
    [profile.regionalGovName || 'PEMERINTAH KOTA MALANG'],
    [profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'],
    [profile.name || 'SDN PISANGCANDI 1'],
    ['REKAPITULASI HASIL ASESMEN PESERTA DIDIK'],
    [''],
    [`Mata Pelajaran: ${exam.subject}`, `Kelas: ${classGrade || exam.grade}`, `Tahun Ajaran: ${profile.academicYear}`, `Semester: ${profile.semester}`],
    [`Paket Ujian: ${exam.title}`, `Batas KKM: ${kkm}`, `Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}`],
    [''],
    ['NO', 'NIS', 'NAMA SISWA', 'KELAS', 'NILAI (%)', 'PREDIKAT', 'STATUS KELULUSAN', 'PINDAH TAB', 'DURASI (DETIK)', 'WAKTU KIRIM']
  ];

  validSubs.forEach((sub, i) => {
    const pct = Math.round(Number(sub.percentage) || 0);
    const isPass = pct >= kkm;
    const pred = pct >= 90 ? 'A (Sangat Baik)' : pct >= kkm ? 'B (Baik)' : pct >= kkm - 15 ? 'C (Cukup)' : 'D (Kurang)';
    
    rows.push([
      i + 1,
      sub.studentNo || '-',
      sub.studentName,
      sub.classGrade || classGrade || exam.grade,
      pct,
      pred,
      isPass ? 'TUNTAS' : 'REMEDIAL',
      sub.tabSwitchCount || 0,
      sub.timeSpentSeconds || 0,
      sub.submittedAt || ''
    ]);
  });

  // Statistik Ringkasan di Bawah Tabel
  const scores = validSubs.map(s => Number(s.percentage) || 0);
  const total = scores.length;
  const avg = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
  const passedCount = validSubs.filter(s => (Number(s.percentage) || 0) >= kkm).length;
  const passPct = total > 0 ? Math.round((passedCount / total) * 100) : 0;

  rows.push(['']);
  rows.push(['RINGKASAN STATISTIK KELAS:']);
  rows.push(['Total Peserta Ujian', total]);
  rows.push(['Rata-rata Nilai Kelas', avg]);
  rows.push(['Jumlah Siswa Tuntas', passedCount]);
  rows.push(['Jumlah Siswa Remedial', total - passedCount]);
  rows.push(['Persentase Ketuntasan', `${passPct}%`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 32 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 16 },
    { wch: 24 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Nilai');
  const cleanSubject = (exam.subject || 'Mapel').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Rekap_Nilai_${cleanSubject}_${classGrade || exam.grade}.xlsx`);
}

/**
 * 3. Export Analisis Butir Soal ke .xlsx (Persis Format Lampiran PDF SDN Pisangcandi 1)
 * Header:
 * ANALISIS HASIL PENILAIAN AKHIR SEMESTER GASAL TAHUN PELAJARAN 2021-2022
 * KELAS 5B
 * BAHASA JAWA
 * Kolom: NO, NIS, NISN, NAMA, 1, 2, 3, ... N, SKOR
 */
export function exportItemAnalysisToExcel(
  exam: Exam,
  questions: Question[],
  students: Student[],
  submissions: Submission[],
  profile: SchoolProfile,
  classGrade?: string
) {
  const wb = XLSX.utils.book_new();
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);

  const headerTitle = `ANALISIS HASIL PENILAIAN AKHIR SEMESTER ${profile.semester.toUpperCase()} TAHUN PELAJARAN ${profile.academicYear}`;
  const headerClass = `KELAS ${classGrade || exam.grade}`;
  const headerSubject = exam.subject.toUpperCase();

  const rows: any[][] = [
    [headerTitle],
    [headerClass],
    [headerSubject],
    [''] // blank row
  ];

  // Baris Header Kolom Tabel: NO, NIS, NISN, NAMA, 1, 2, ... N, SKOR
  const tableHeaders = ['NO', 'NIS', 'NISN', 'NAMA'];
  sortedQuestions.forEach((_, idx) => {
    tableHeaders.push(String(idx + 1));
  });
  tableHeaders.push('SKOR');
  rows.push(tableHeaders);

  // Data baris tiap siswa
  const validSubs = submissions.filter(s => s.statusNote !== 'Mengulang Ujian');
  const questionSums: number[] = new Array(sortedQuestions.length).fill(0);

  validSubs.forEach((sub, i) => {
    const st = students.find(s => s.studentNo === sub.studentNo || s.fullName.toLowerCase() === sub.studentName.toLowerCase());
    const nis = st?.nis || sub.studentNo || '';
    const nisn = st?.nisn || '';

    const rowItem: any[] = [
      i + 1,
      nis,
      nisn,
      sub.studentName
    ];

    let totalStudentScore = 0;

    sortedQuestions.forEach((q, qIdx) => {
      const studentAns = sub.answers ? sub.answers[q.id] : undefined;
      let score = 0;
      if (q.type === 'multiple_choice') {
        score = studentAns === q.correctKey ? (q.points || 1) : 0;
      } else if (q.type === 'checkbox') {
        const correctKeys = Array.isArray(q.correctKey) ? q.correctKey : [q.correctKey];
        const studentKeys = Array.isArray(studentAns) ? studentAns : [];
        const matchCount = correctKeys.filter(k => studentKeys.includes(k)).length;
        score = matchCount > 0 ? Math.round((matchCount / correctKeys.length) * (q.points || 1)) : 0;
      } else if (q.type === 'matching' || q.type === 'short_answer') {
        score = AnalysisService.isAnswerCorrect(q, studentAns) ? (q.points || 1) : 0;
      } else {
        score = (studentAns && typeof studentAns === 'string' && studentAns.trim().length > 5) ? (q.points || 1) : 0;
      }

      const roundedScore = Math.round(score);
      totalStudentScore += roundedScore;
      questionSums[qIdx] += roundedScore;
      rowItem.push(roundedScore);
    });

    rowItem.push(Math.round(totalStudentScore));
    rows.push(rowItem);
  });

  // Baris Total Bawah (Jumlah Skor per Soal)
  if (validSubs.length > 0) {
    const totalRow: any[] = ['', '', '', 'JUMLAH SKOR BENAR'];
    questionSums.forEach(sum => totalRow.push(Math.round(sum)));
    const grandTotal = Math.round(questionSums.reduce((a, b) => a + b, 0));
    totalRow.push(grandTotal);
    rows.push(totalRow);

    const avgRow: any[] = ['', '', '', 'RATA-RATA SKOR BUTIR'];
    questionSums.forEach(sum => {
      const avg = Math.round(sum / validSubs.length);
      avgRow.push(avg);
    });
    const grandAvg = Math.round(grandTotal / validSubs.length);
    avgRow.push(grandAvg);
    rows.push(avgRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  const colWidths: { wch: number }[] = [
    { wch: 6 },  // NO
    { wch: 10 }, // NIS
    { wch: 14 }, // NISN
    { wch: 34 }  // NAMA
  ];
  sortedQuestions.forEach(() => {
    colWidths.push({ wch: 5 }); // Question columns 1..N
  });
  colWidths.push({ wch: 8 }); // SKOR
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Analisis_Butir_Soal');
  const cleanSubject = (exam.subject || 'Mapel').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `ANALISIS_PAS_${cleanSubject}_KELAS_${classGrade || exam.grade}.xlsx`);
}

import type { StudentRaporSubjectRow } from './exportDocxService';

/**
 * 4. Export Rapor Hasil Ujian Siswa (1 atau Semua Bidang Studi) ke .xlsx
 */
export function exportStudentReportToExcel(
  student: { nis: string; nisn?: string; name: string; classGrade: string },
  rows: StudentRaporSubjectRow[],
  profile: SchoolProfile,
  options: {
    subjectFilterLabel: string;
    classFilterLabel: string;
    teacherNote?: string;
  }
) {
  const wb = XLSX.utils.book_new();

  const completedRows = rows.filter(r => r.hasSubmitted && r.statusText !== 'Mengulang Ujian');
  const avgScore = completedRows.length > 0
    ? Math.round(completedRows.reduce((acc, r) => acc + r.percentage, 0) / completedRows.length)
    : 0;
  const passedCount = completedRows.filter(r => r.passed).length;

  const sheet1Rows: any[][] = [
    [profile.regionalGovName || 'PEMERINTAH KOTA MALANG'],
    [profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'],
    [profile.name || 'SD NEGERI PISANGCANDI 1 MALANG'],
    [`NPSN: ${profile.npsn || '-'} | ${profile.address || ''}`],
    [''],
    ['RAPOR HASIL EVALUASI ASESMEN PESERTA DIDIK'],
    [`Tahun Ajaran: ${profile.academicYear || '2026/2027'}`, `Semester: ${profile.semester || 'Ganjil'}`],
    [''],
    ['Nama Peserta Didik', student.name || '-', '', 'Kelas / Rombel', student.classGrade || options.classFilterLabel || '-'],
    ['Nomor Induk (NIS)', student.nis || '-', '', 'Bidang Studi', options.subjectFilterLabel],
    ['NISN', student.nisn || '-', '', 'Guru Pengampu', profile.teacherName || '-'],
    [''],
    ['NO', 'BIDANG STUDI', 'PAKET / JUDUL ASESMEN', 'KKM', 'SKOR', 'SKOR MAKS', 'NILAI (%)', 'PREDIKAT', 'STATUS', 'PINDAH TAB', 'WAKTU KIRIM']
  ];

  rows.forEach((row, idx) => {
    const isVal = row.hasSubmitted && row.statusText !== 'Mengulang Ujian';
    sheet1Rows.push([
      idx + 1,
      row.subject,
      row.examTitle,
      row.passingScore,
      isVal ? row.score : '-',
      isVal ? row.maxScore : '-',
      isVal ? row.percentage : '-',
      isVal ? row.predicate : '-',
      row.statusText,
      isVal ? (row.tabSwitchCount || 0) : '-',
      row.submittedAt ? new Date(row.submittedAt).toLocaleString('id-ID') : '-'
    ]);
  });

  sheet1Rows.push(['']);
  sheet1Rows.push(['RINGKASAN HASIL RAPOR']);
  sheet1Rows.push(['Total Bidang Studi / Paket Ditampilkan', rows.length]);
  sheet1Rows.push(['Jumlah Ujian Selesai', completedRows.length]);
  sheet1Rows.push(['Jumlah Tuntas KKM', passedCount]);
  sheet1Rows.push(['Rata-Rata Nilai Keseluruhan', completedRows.length > 0 ? avgScore : '-']);
  if (options.teacherNote) {
    sheet1Rows.push(['Catatan Evaluasi Guru', options.teacherNote]);
  }
  sheet1Rows.push(['']);
  sheet1Rows.push(['', '', '', '', 'Mengetahui,', '', '', '', '']);
  sheet1Rows.push(['', 'Orang Tua / Wali Murid', '', '', 'Kepala Sekolah', '', '', '', 'Guru Kelas / Pengampu']);
  sheet1Rows.push(['']);
  sheet1Rows.push(['']);
  sheet1Rows.push(['', '( ...................................... )', '', '', profile.principalName || 'Dr. H. Sulaiman, M.Pd.', '', '', '', profile.teacherName || 'Siti Rahmawati, S.Pd.']);
  sheet1Rows.push(['', '', '', '', `NIP. ${profile.principalNip || '-'}`, '', '', '', `NIP. ${profile.teacherNip || '-'}`]);

  const wsRapor = XLSX.utils.aoa_to_sheet(sheet1Rows);
  wsRapor['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 36 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(wb, wsRapor, 'Rapor_Siswa');

  // Sheet 2: Capaian Tujuan Pembelajaran (TP)
  const tpRowsData: any[][] = [
    [`KETERCAPAIAN TUJUAN PEMBELAJARAN (TP) - ${student.name || ''}`],
    [`Kelas: ${student.classGrade || '-'} | Bidang Studi: ${options.subjectFilterLabel}`],
    [''],
    ['NO', 'BIDANG STUDI', 'DESKRIPSI TUJUAN PEMBELAJARAN (TP)', 'PERSENTASE CAPAIAN (%)', 'STATUS']
  ];

  let tpIdx = 1;
  rows.forEach(r => {
    r.tpDetails.forEach(tp => {
      tpRowsData.push([tpIdx++, r.subject, tp.objective, tp.masteryRate, tp.status]);
    });
  });

  if (tpRowsData.length > 4) {
    const wsTp = XLSX.utils.aoa_to_sheet(tpRowsData);
    wsTp['!cols'] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 56 },
      { wch: 22 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsTp, 'Capaian_TP');
  }

  const safeName = (student.name || 'Siswa').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeSubj = (options.subjectFilterLabel || 'Semua_Mapel').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Rapor_${safeName}_${safeSubj}.xlsx`);
}

/**
 * 5. Export Rekap Leger Klasikal (1 atau Semua Bidang Studi per Kelas) ke .xlsx
 */
export function exportClassicalAllSubjectsToExcel(
  studentsList: Array<{ nis: string; name: string; classGrade: string }>,
  subjects: string[],
  scoreMatrix: Record<string, Record<string, { percentage: number; passed: boolean; statusText: string }>>,
  profile: SchoolProfile,
  options: { classFilterLabel: string; subjectFilterLabel: string }
) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [
    [profile.regionalGovName || 'PEMERINTAH KOTA MALANG'],
    [profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'],
    [profile.name || 'SD NEGERI PISANGCANDI 1 MALANG'],
    ['LEGER & REKAPITULASI NILAI HASIL ASESMEN KELAS'],
    [`Kelas: ${options.classFilterLabel}`, `Bidang Studi: ${options.subjectFilterLabel}`, `T.A: ${profile.academicYear}`, `Semester: ${profile.semester}`],
    [''],
    ['NO', 'NIS', 'NAMA SISWA', 'KELAS', ...subjects.map(s => s.toUpperCase()), 'RATA-RATA']
  ];

  studentsList.forEach((st, idx) => {
    const rowScores = scoreMatrix[st.nis.toLowerCase()] || {};
    const numericVals = subjects
      .map(subj => rowScores[subj])
      .filter(v => v && v.statusText !== 'Belum Mengerjakan' && v.statusText !== 'Mengulang Ujian')
      .map(v => v.percentage);
    const avg = numericVals.length > 0 ? Math.round(numericVals.reduce((a, b) => a + b, 0) / numericVals.length) : '-';

    rows.push([
      idx + 1,
      st.nis,
      st.name,
      st.classGrade,
      ...subjects.map(subj => {
        const cell = rowScores[subj];
        return cell && cell.statusText !== 'Belum Mengerjakan' && cell.statusText !== 'Mengulang Ujian' ? cell.percentage : '-';
      }),
      avg
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 30 },
    { wch: 14 },
    ...subjects.map(() => ({ wch: 16 })),
    { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Leger_Klasikal');
  const safeClass = (options.classFilterLabel || 'Semua_Kelas').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeSubj = (options.subjectFilterLabel || 'Semua_Mapel').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Leger_Klasikal_${safeClass}_${safeSubj}.xlsx`);
}

export interface SubjectTpGradeExportRow {
  no: number;
  nis: string;
  studentName: string;
  classGrade: string;
  subject: string;
  kkm: number;
  tpScores: Array<number | null>;
  average: number | null;
  tpAtKkm: number;
  tpAboveKkm: number;
  tpBelowKkm: number;
}

export interface SubjectTpReferenceExport {
  subject: string;
  kkm: number;
  objectives: Array<{
    code: string;
    description: string;
    questionCount: number;
    questionOrders: string;
  }>;
}

/**
 * 6. Export Daftar Nilai per Mata Pelajaran & per Tujuan Pembelajaran (TP) ke .xlsx
 * Kolom: Nomor, NIS, Nama Siswa, Mata Pelajaran, Tujuan Pembelajaran 1..N, Rerata, TP pada KKM, TP di atas KKM, TP di bawah KKM
 */
export function exportSubjectTpGradesToExcel(
  rowsData: SubjectTpGradeExportRow[],
  maxTpCount: number,
  references: SubjectTpReferenceExport[],
  profile: SchoolProfile,
  options: {
    mode: 'klasikal' | 'individu';
    subjectFilterLabel: string;
    classFilterLabel: string;
    studentName?: string;
    studentNis?: string;
  }
) {
  const wb = XLSX.utils.book_new();
  const safeTpCols = Math.max(1, maxTpCount);

  const tpHeaders = Array.from({ length: safeTpCols }, (_, idx) => `Tujuan Pembelajaran ${idx + 1}`);
  const tableHeaders = [
    'Nomor',
    'NIS',
    'Nama Siswa',
    'Mata Pelajaran',
    ...tpHeaders,
    'Rerata',
    'TP pada KKM',
    'TP di atas KKM',
    'TP di bawah KKM'
  ];

  const modeLabel = options.mode === 'klasikal' ? 'KLASIKAL (SELURUH SISWA)' : 'INDIVIDU SISWA';

  const sheetRows: any[][] = [
    [profile.regionalGovName || 'PEMERINTAH KOTA MALANG'],
    [profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'],
    [profile.name || 'SD NEGERI PISANGCANDI 1 MALANG'],
    [`DAFTAR NILAI PER MATA PELAJARAN DAN TUJUAN PEMBELAJARAN (${modeLabel})`],
    [
      `Mata Pelajaran: ${options.subjectFilterLabel}`,
      `Kelas: ${options.classFilterLabel}`,
      `Tahun Ajaran: ${profile.academicYear || '-'}`,
      `Semester: ${profile.semester || '-'}`
    ]
  ];

  if (options.mode === 'individu' && (options.studentName || options.studentNis)) {
    sheetRows.push([
      `Nama Siswa: ${options.studentName || '-'}`,
      `NIS: ${options.studentNis || '-'}`,
      `Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}`
    ]);
  } else {
    sheetRows.push([`Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}`]);
  }

  sheetRows.push(['']);
  sheetRows.push(tableHeaders);

  rowsData.forEach((row) => {
    const paddedTpCells = Array.from({ length: safeTpCols }, (_, idx) => {
      const val = row.tpScores[idx];
      return val === null || val === undefined ? '-' : val;
    });

    sheetRows.push([
      row.no,
      row.nis,
      row.studentName,
      row.subject,
      ...paddedTpCells,
      row.average === null ? '-' : row.average,
      row.tpAtKkm,
      row.tpAboveKkm,
      row.tpBelowKkm
    ]);
  });

  // Tambahkan baris rata-rata klasikal jika mode klasikal & ada nilai numerik
  if (options.mode === 'klasikal' && rowsData.length > 0) {
    const tpAverages = Array.from({ length: safeTpCols }, (_, idx) => {
      const vals = rowsData
        .map(r => r.tpScores[idx])
        .filter((v): v is number => typeof v === 'number');
      return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : '-';
    });
    const avgVals = rowsData
      .map(r => r.average)
      .filter((v): v is number => typeof v === 'number');
    const overallAvg = avgVals.length > 0
      ? Math.round(avgVals.reduce((a, b) => a + b, 0) / avgVals.length)
      : '-';

    const totalAtKkm = rowsData.reduce((acc, r) => acc + r.tpAtKkm, 0);
    const totalAboveKkm = rowsData.reduce((acc, r) => acc + r.tpAboveKkm, 0);
    const totalBelowKkm = rowsData.reduce((acc, r) => acc + r.tpBelowKkm, 0);

    sheetRows.push([
      '',
      '',
      'RATA-RATA / TOTAL KLASIKAL',
      options.subjectFilterLabel,
      ...tpAverages,
      overallAvg,
      totalAtKkm,
      totalAboveKkm,
      totalBelowKkm
    ]);
  }

  const wsMain = XLSX.utils.aoa_to_sheet(sheetRows);
  wsMain['!cols'] = [
    { wch: 8 },  // Nomor
    { wch: 14 }, // NIS
    { wch: 28 }, // Nama Siswa
    { wch: 24 }, // Mata Pelajaran
    ...Array.from({ length: safeTpCols }, () => ({ wch: 22 })),
    { wch: 12 }, // Rerata
    { wch: 14 }, // TP pada KKM
    { wch: 16 }, // TP di atas KKM
    { wch: 16 }  // TP di bawah KKM
  ];
  XLSX.utils.book_append_sheet(wb, wsMain, 'Daftar_Nilai_Mapel_TP');

  // Sheet 2: Referensi Deskripsi Tujuan Pembelajaran per Mata Pelajaran
  const refRows: any[][] = [
    ['REFERENSI KODE & DESKRIPSI TUJUAN PEMBELAJARAN (TP)'],
    [profile.name || 'SD NEGERI PISANGCANDI 1 MALANG'],
    [''],
    ['NO', 'MATA PELAJARAN', 'KKM', 'KODE KOLOM', 'DESKRIPSI TUJUAN PEMBELAJARAN', 'JUMLAH SOAL', 'NOMOR SOAL']
  ];
  let refNo = 1;
  references.forEach(ref => {
    ref.objectives.forEach(obj => {
      refRows.push([
        refNo++,
        ref.subject,
        ref.kkm,
        obj.code,
        obj.description,
        obj.questionCount,
        obj.questionOrders || '-'
      ]);
    });
  });

  if (refRows.length > 4) {
    const wsRef = XLSX.utils.aoa_to_sheet(refRows);
    wsRef['!cols'] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 8 },
      { wch: 24 },
      { wch: 56 },
      { wch: 14 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi_TP');
  }

  const cleanSubj = (options.subjectFilterLabel || 'Semua_Mapel').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanClass = (options.classFilterLabel || 'Semua_Kelas').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanStudent = (options.studentName || 'Siswa').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];

  const fileName = options.mode === 'individu'
    ? `Daftar_Nilai_TP_Individu_${cleanStudent}_${cleanSubj}_${dateStr}.xlsx`
    : `Daftar_Nilai_TP_Klasikal_${cleanSubj}_${cleanClass}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

