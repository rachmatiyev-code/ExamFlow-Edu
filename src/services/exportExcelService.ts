import * as XLSX from 'xlsx';
import { Exam, Question, SchoolProfile, Submission, Student } from '../types';

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
        q.type === 'multiple_choice' ? 'Pilihan Ganda' : q.type === 'checkbox' ? 'PG Kompleks' : 'Uraian',
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
    const pct = Number(sub.percentage) || 0;
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
      } else {
        score = (studentAns && typeof studentAns === 'string' && studentAns.trim().length > 5) ? (q.points || 1) : 0;
      }

      totalStudentScore += score;
      questionSums[qIdx] += score;
      rowItem.push(score);
    });

    rowItem.push(totalStudentScore);
    rows.push(rowItem);
  });

  // Baris Total Bawah (Jumlah Skor per Soal)
  if (validSubs.length > 0) {
    const totalRow: any[] = ['', '', '', 'JUMLAH SKOR BENAR'];
    questionSums.forEach(sum => totalRow.push(sum));
    const grandTotal = questionSums.reduce((a, b) => a + b, 0);
    totalRow.push(grandTotal);
    rows.push(totalRow);

    const avgRow: any[] = ['', '', '', 'RATA-RATA SKOR BUTIR'];
    questionSums.forEach(sum => {
      const avg = (sum / validSubs.length).toFixed(2);
      avgRow.push(avg);
    });
    const grandAvg = (grandTotal / validSubs.length).toFixed(1);
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
