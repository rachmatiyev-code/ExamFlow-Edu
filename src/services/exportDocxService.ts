import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  PageOrientation,
  VerticalAlign,
  ShadingType
} from 'docx';
import { Exam, Question, SchoolProfile, Submission, Student } from '../types';

/**
 * Helper to download Blob as file in browser
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'D0D0D0' },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'D0D0D0' }
};

/**
 * 1. Export Naskah Soal Ujian ke .docx dengan Kop Surat & Layout Lengkap
 */
export async function exportExamToDocx(
  exam: Exam,
  questions: Question[],
  profile: SchoolProfile,
  includeAnswers: boolean = false
) {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 1000, right: 1000 }
          }
        },
        children: [
          // Kop Surat
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: profile.regionalGovName || 'PEMERINTAH KOTA MALANG',
                bold: true,
                size: 22,
                font: 'Times New Roman'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
                bold: true,
                size: 22,
                font: 'Times New Roman'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: profile.name || 'SDN PISANGCANDI 1',
                bold: true,
                size: 26,
                font: 'Times New Roman'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${profile.address || 'Jl. Raya Pisang Candi, Kec. Sukun, Kota Malang'} | NPSN: ${profile.npsn || '20533857'}`,
                size: 18,
                font: 'Times New Roman'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Tahun Ajaran: ${profile.academicYear} | Semester: ${profile.semester}`,
                size: 18,
                italics: true,
                font: 'Times New Roman'
              })
            ]
          }),
          // Garis pemisah kop
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.DOUBLE, size: 12, color: '000000', space: 2 }
            },
            spacing: { after: 180 },
            children: []
          }),

          // Judul Ujian
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 160 },
            children: [
              new TextRun({
                text: 'NASKAH SOAL ASESMEN SUMATIF / PENILAIAN AKHIR',
                bold: true,
                underline: {},
                size: 24,
                font: 'Arial'
              })
            ]
          }),

          // Metadata & Kotak Nilai (Tabel 2 kolom)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: `Mata Pelajaran   : `, bold: true, size: 20 }), new TextRun({ text: exam.subject, size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: `Kelas / Jenjang  : `, bold: true, size: 20 }), new TextRun({ text: exam.grade, size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: `Paket Ujian      : `, bold: true, size: 20 }), new TextRun({ text: exam.title, size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: `Alokasi Waktu    : `, bold: true, size: 20 }), new TextRun({ text: `${exam.durationMinutes} Menit`, size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: `Jumlah Soal      : `, bold: true, size: 20 }), new TextRun({ text: `${questions.length} Butir Soal`, size: 20 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.TOP,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'KOTAK PENILAIAN', bold: true, size: 18 })]
                      }),
                      new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: tableBorders,
                        rows: [
                          new TableRow({
                            children: [
                              new TableCell({
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nilai Siswa', bold: true, size: 18 })] })]
                              }),
                              new TableCell({
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Paraf Guru', bold: true, size: 18 })] })]
                              })
                            ]
                          }),
                          new TableRow({
                            height: { value: 600, rule: 'atleast' as any },
                            children: [
                              new TableCell({ children: [new Paragraph({ children: [] })] }),
                              new TableCell({ children: [new Paragraph({ children: [] })] })
                            ]
                          })
                        ]
                      }),
                      new Paragraph({
                        spacing: { before: 80 },
                        children: [
                          new TextRun({ text: 'Nama : ..............................................', size: 18 })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'NIS   : ..............................................', size: 18 })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          // Petunjuk Pengerjaan
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [
              new TextRun({ text: 'PETUNJUK UMUM:', bold: true, size: 20 })
            ]
          }),
          new Paragraph({
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: '1. Tuliskan identitas Anda dengan lengkap dan jelas.\n2. Bacalah setiap butir soal dengan teliti sebelum menjawab.\n3. Dahulukan soal-soal yang Anda anggap mudah.\n4. Periksa kembali pekerjaan Anda sebelum diserahkan.',
                size: 19
              })
            ]
          }),

          // Daftar Butir Soal
          ...questions.flatMap((q, idx) => {
            const paragraphs = [
              new Paragraph({
                spacing: { before: 120, after: 60 },
                children: [
                  new TextRun({ text: `${idx + 1}. `, bold: true, size: 21 }),
                  new TextRun({ text: q.prompt.replace(/<[^>]*>/g, ''), size: 21 })
                ]
              })
            ];

            // Pilihan Opsi A, B, C, D
            if (q.options && q.options.length > 0) {
              q.options.forEach((opt, optIdx) => {
                const label = String.fromCharCode(65 + optIdx);
                const isCorrect = Array.isArray(q.correctKey)
                  ? q.correctKey.includes(opt.id)
                  : q.correctKey === opt.id;

                paragraphs.push(
                  new Paragraph({
                    indent: { left: 400 },
                    spacing: { after: 30 },
                    children: [
                      new TextRun({ text: `${label}. `, bold: true, size: 20 }),
                      new TextRun({ text: opt.text.replace(/<[^>]*>/g, ''), size: 20 }),
                      ...(includeAnswers && isCorrect
                        ? [new TextRun({ text: '  [KUNCI JAWABAN]', bold: true, color: '008000', size: 18 })]
                        : [])
                    ]
                  })
                );
              });
            }

            return paragraphs;
          }),

          // Tanda Tangan Pengesahan
          new Paragraph({
            spacing: { before: 300, after: 100 },
            children: [
              new TextRun({
                text: `Kota Malang, ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}`,
                size: 20
              })
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Mengetahui,\nKepala Sekolah', size: 20 })] }),
                      new Paragraph({ spacing: { before: 700 }, children: [new TextRun({ text: profile.principalName || 'Dr. H. Sulaiman, M.Pd.', bold: true, underline: {}, size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: `NIP. ${profile.principalNip || '19750812 200003 1 002'}`, size: 18 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Guru Pengampu / Wali Kelas,', size: 20 })] }),
                      new Paragraph({ spacing: { before: 700 }, children: [new TextRun({ text: profile.teacherName || 'Siti Rahmawati, S.Pd.', bold: true, underline: {}, size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: profile.teacherNip ? `NIP. ${profile.teacherNip}` : 'NIP. -', size: 18 })] })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const cleanTitle = (exam.title || 'Naskah_Soal').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadBlob(blob, `Naskah_Soal_${cleanTitle}.docx`);
}

/**
 * 2. Export Rekap Nilai per Kelas & Mapel ke .docx
 */
export async function exportGradeRecapToDocx(
  exam: Exam,
  submissions: Submission[],
  profile: SchoolProfile,
  classGrade?: string
) {
  const kkm = exam.passingScore || 75;
  const validSubs = submissions.filter(s => s.statusNote !== 'Mengulang Ujian');
  const scores = validSubs.map(s => Number(s.percentage) || 0);
  const total = scores.length;
  const avg = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
  const passed = validSubs.filter(s => (Number(s.percentage) || 0) >= kkm).length;
  const remedial = total - passed;
  const passPct = total > 0 ? Math.round((passed / total) * 100) : 0;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 900, right: 900 }
          }
        },
        children: [
          // Kop Surat
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: profile.regionalGovName || 'PEMERINTAH KOTA MALANG', bold: true, size: 22, font: 'Times New Roman' }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN', bold: true, size: 22, font: 'Times New Roman' }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: profile.name || 'SDN PISANGCANDI 1', bold: true, size: 26, font: 'Times New Roman' }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${profile.address} | NPSN: ${profile.npsn}`, size: 18, font: 'Times New Roman' }),
            ]
          }),
          new Paragraph({
            border: { bottom: { style: BorderStyle.DOUBLE, size: 12, color: '000000', space: 2 } },
            spacing: { after: 160 },
            children: []
          }),

          // Judul Laporan
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({ text: 'REKAPITULASI HASIL ASESMEN KELAS', bold: true, size: 24, underline: {} })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [
              new TextRun({ text: `Mata Pelajaran: ${exam.subject}  |  Kelas: ${classGrade || exam.grade}  |  Semester: ${profile.semester}  |  T.A: ${profile.academicYear}`, size: 20, bold: true })
            ]
          }),

          // Tabel Statistik Singkat
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Peserta', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${total} Siswa`, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Rata-rata Kelas', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${avg}`, bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ketuntasan Klasikal', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${passPct}% (${passed} Tuntas / ${remedial} Remidi)`, bold: true, size: 18 })] })] })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { before: 140, after: 60 }, children: [] }),

          // Tabel Daftar Nilai Kolektif
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { fill: 'E2E8F0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NO', bold: true, size: 18 })] })] }),
                  new TableCell({ shading: { fill: 'E2E8F0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NIS', bold: true, size: 18 })] })] }),
                  new TableCell({ shading: { fill: 'E2E8F0', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'NAMA SISWA', bold: true, size: 18 })] })] }),
                  new TableCell({ shading: { fill: 'E2E8F0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NILAI', bold: true, size: 18 })] })] }),
                  new TableCell({ shading: { fill: 'E2E8F0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'STATUS', bold: true, size: 18 })] })] }),
                  new TableCell({ shading: { fill: 'E2E8F0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PINDAH TAB', bold: true, size: 18 })] })] })
                ]
              }),
              ...validSubs.map((sub, i) => {
                const isPass = (Number(sub.percentage) || 0) >= kkm;
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${i + 1}`, size: 18 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sub.studentNo || '-', size: 18 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sub.studentName || 'Siswa', size: 18 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${sub.percentage}`, bold: true, size: 18 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: isPass ? 'Tuntas' : 'Remedial', color: isPass ? '008000' : 'CC0000', bold: true, size: 18 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${sub.tabSwitchCount || 0}x`, size: 18 })] })] })
                  ]
                });
              })
            ]
          }),

          // Signatures
          new Paragraph({
            spacing: { before: 260, after: 80 },
            children: [
              new TextRun({ text: `Malang, ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}`, size: 20 })
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Mengetahui,\nKepala Sekolah', size: 20 })] }),
                      new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: profile.principalName || 'Dr. H. Sulaiman, M.Pd.', bold: true, underline: {}, size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: `NIP. ${profile.principalNip || '-'}`, size: 18 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Guru Pengampu / Wali Kelas,', size: 20 })] }),
                      new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: profile.teacherName || 'Siti Rahmawati, S.Pd.', bold: true, underline: {}, size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: profile.teacherNip ? `NIP. ${profile.teacherNip}` : 'NIP. -', size: 18 })] })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const cleanTitle = (exam.subject || 'Mapel').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadBlob(blob, `Rekap_Nilai_${cleanTitle}_${classGrade || exam.grade}.docx`);
}

/**
 * 3. Export Analisis Butir Soal ke .docx (Landscape Table persis PDF SDN Pisangcandi 1)
 */
export async function exportItemAnalysisToDocx(
  exam: Exam,
  questions: Question[],
  students: Student[],
  submissions: Submission[],
  profile: SchoolProfile,
  classGrade?: string
) {
  // Sort questions by order
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
  const qCount = sortedQuestions.length;

  // Build rows data
  const rowsData = submissions
    .filter(s => s.statusNote !== 'Mengulang Ujian')
    .map(sub => {
      // Find matching student
      const st = students.find(s => s.studentNo === sub.studentNo || s.fullName.toLowerCase() === sub.studentName.toLowerCase());
      const nis = st?.nis || sub.studentNo || '';
      const nisn = st?.nisn || '';

      const scoresPerQ = sortedQuestions.map(q => {
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

      const totalScore = scoresPerQ.reduce((a, b) => a + b, 0);

      return {
        nis,
        nisn,
        name: sub.studentName,
        scoresPerQ,
        totalScore
      };
    });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 500, bottom: 500, left: 600, right: 600 }
          }
        },
        children: [
          // Header Judul Persis PDF Lampiran
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: `ANALISIS HASIL PENILAIAN AKHIR SEMESTER ${profile.semester.toUpperCase()} TAHUN PELAJARAN ${profile.academicYear}`,
                bold: true,
                size: 22,
                font: 'Arial'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: `KELAS ${classGrade || exam.grade}`,
                bold: true,
                size: 20,
                font: 'Arial'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: exam.subject.toUpperCase(),
                bold: true,
                size: 20,
                font: 'Arial'
              })
            ]
          }),

          // Tabel Analisis Butir Soal Landscape
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
              // Header Row
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NO', bold: true, size: 16 })] })] }),
                  new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NIS', bold: true, size: 16 })] })] }),
                  new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NISN', bold: true, size: 16 })] })] }),
                  new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'NAMA', bold: true, size: 16 })] })] }),
                  ...sortedQuestions.map((q, idx) =>
                    new TableCell({
                      shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${idx + 1}`, bold: true, size: 16 })] })]
                    })
                  ),
                  new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SKOR', bold: true, size: 16 })] })] })
                ]
              }),

              // Data Rows per Student
              ...rowsData.map((row, i) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${i + 1}`, size: 15 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.nis || '-', size: 15 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.nisn || '-', size: 15 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.name, size: 15 })] })] }),
                    ...row.scoresPerQ.map(sc =>
                      new TableCell({
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${sc}`, size: 15 })] })]
                      })
                    ),
                    new TableCell({
                      shading: { fill: 'FEF3C7', type: ShadingType.CLEAR },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${row.totalScore}`, bold: true, size: 15 })] })]
                    })
                  ]
                })
              )
            ]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = (exam.subject || 'Mapel').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadBlob(blob, `ANALISIS_PAS_${cleanSubject}_KELAS_${classGrade || exam.grade}.docx`);
}
