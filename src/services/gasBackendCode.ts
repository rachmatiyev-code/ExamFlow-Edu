/**
 * ExamFlow Edu — Google Apps Script Backend Code (Code.gs)
 * 
 * Petunjuk Pemasangan di Google Sheets:
 * 1. Buka spreadsheet Google Sheets baru Anda.
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus semua kode default di Code.gs, lalu paste seluruh kode di bawah ini.
 * 4. Klik tombol "Simpan" (ikon disket / Ctrl+S).
 * 5. Jalankan fungsi "initDatabase" sekali untuk membuat semua sheet secara otomatis.
 * 6. Klik tombol "Terapkan" (Deploy) -> "Penerapan baru" (New deployment).
 * 7. Pilih jenis: "Aplikasi Web" (Web App).
 * 8. Konfigurasi:
 *    - Deskripsi: "ExamFlow Edu API v1.0"
 *    - Jalankan sebagai: "Saya" (Me / akun Google Anda)
 *    - Yang memiliki akses: "Siapa saja" (Anyone) -> SANGAT PENTING agar siswa dapat kirim jawaban!
 * 9. Klik "Terapkan" (Deploy), berikan izin akses Google jika diminta.
 * 10. Salin "URL Aplikasi Web" (Web App URL) dan paste ke menu Pengaturan di aplikasi ExamFlow Edu.
 */

export const GAS_BACKEND_SCRIPT = `/**
 * ========================================================
 * EXAMFLOW EDU - BACKEND GOOGLE APPS SCRIPT
 * Database Engine & RESTful API for Google Sheets
 * ========================================================
 */

// Nama-nama Sheet Database
const SHEETS = {
  PROFILE: 'SchoolProfile',
  EXAMS: 'Exams',
  QUESTIONS: 'Questions',
  STUDENTS: 'Students',
  SUBMISSIONS: 'Submissions',
  DATA_MENTAH: 'Data_Mentah',
  LAPORAN_KLASIKAL: 'Laporan_Klasikal',
  LAPORAN_INDIVIDU: 'Laporan_Individu',
  USERS: 'Users',
  CURRICULUM: 'Curriculum',
  LOGS: 'Logs'
};

/**
 * Inisialisasi struktur sheet dan header kolom otomatis
 * Jalankan fungsi ini sekali setelah menempelkan script.
 */
function initDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. SchoolProfile
  let shProfile = ss.getSheetByName(SHEETS.PROFILE);
  if (!shProfile) {
    shProfile = ss.insertSheet(SHEETS.PROFILE);
    shProfile.appendRow(['name', 'npsn', 'address', 'logoUrl', 'academicYear', 'semester', 'principalName', 'principalNip', 'teacherName', 'teacherNip', 'teacherSubject', 'teacherEmail', 'teacherTitle', 'updatedAt']);
    shProfile.appendRow([
      'SD NEGERI PISANGCANDI 1 MALANG',
      '20533857',
      'Jl. Raya Pisang Candi No. 1, Kec. Sukun, Kota Malang, Jawa Timur 65146',
      'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=200&auto=format&fit=crop&q=80',
      '2026/2027',
      'Ganjil',
      'Dr. H. Sulaiman, M.Pd.',
      '19750812 200003 1 002',
      'Siti Rahmawati, S.Pd.',
      '19820514 200801 2 009',
      'Pendidikan Pancasila & Tematik',
      'siti.rahmawati@sdnpisangcandi1.sch.id',
      'Guru Kelas & Koordinator Asesmen',
      new Date().toISOString()
    ]);
    formatHeaderRow(shProfile);
  }

  // 2. Exams (Didukung attemptMode: 'single' | 'unlimited')
  let shExams = ss.getSheetByName(SHEETS.EXAMS);
  if (!shExams) {
    shExams = ss.insertSheet(SHEETS.EXAMS);
    shExams.appendRow(['id', 'title', 'subject', 'grade', 'durationMinutes', 'passingScore', 'isStrict', 'allowReview', 'startsAt', 'endsAt', 'status', 'totalQuestions', 'token', 'instructions', 'sessionStatus', 'sessionStartedAt', 'sessionEndedAt', 'allowLateSubmission', 'lateExtensionMinutes', 'learningObjectives', 'attemptMode', 'createdAt', 'redeployCount']);
    formatHeaderRow(shExams);
  }

  // 3. Questions
  let shQuestions = ss.getSheetByName(SHEETS.QUESTIONS);
  if (!shQuestions) {
    shQuestions = ss.insertSheet(SHEETS.QUESTIONS);
    shQuestions.appendRow(['id', 'examId', 'order', 'prompt', 'type', 'mediaType', 'mediaUrl', 'optionsJson', 'correctKeyJson', 'points', 'explanation', 'bloomLevel', 'soloLevel', 'basicCompetency', 'indicator', 'learningObjective']);
    formatHeaderRow(shQuestions);
  }

  // 4. Students
  let shStudents = ss.getSheetByName(SHEETS.STUDENTS);
  if (!shStudents) {
    shStudents = ss.insertSheet(SHEETS.STUDENTS);
    shStudents.appendRow(['id', 'studentNo', 'fullName', 'classGrade', 'email', 'phone', 'status']);
    formatHeaderRow(shStudents);
  }

  // 5. Submissions (Mendukung statusNote & allowRepeat untuk Mengulang Ujian)
  let shSubmissions = ss.getSheetByName(SHEETS.SUBMISSIONS);
  if (!shSubmissions) {
    shSubmissions = ss.insertSheet(SHEETS.SUBMISSIONS);
    shSubmissions.appendRow(['id', 'examId', 'studentNo', 'studentName', 'classGrade', 'answersJson', 'score', 'maxScore', 'percentage', 'passed', 'submittedAt', 'tabSwitchCount', 'timeSpentSeconds', 'feedback', 'statusNote', 'allowRepeat']);
    formatHeaderRow(shSubmissions);
  }

  // 5A. Tab 1: Data_Mentah (Sumber Data Sinkronisasi & Rumus Rekapitulasi)
  let shDataMentah = ss.getSheetByName(SHEETS.DATA_MENTAH);
  if (!shDataMentah) {
    shDataMentah = ss.insertSheet(SHEETS.DATA_MENTAH);
    shDataMentah.appendRow(['NIS', 'Nama Siswa', 'Kelas', 'Paket Ujian', 'Nilai (%)', 'Status', 'Pindah Tab', 'Durasi (Detik)', 'Status Note', 'Waktu Kirim']);
    formatHeaderRow(shDataMentah);
  }

  // 5B. Tab 2: Laporan_Klasikal (Rekapitulasi Kelas dengan Formula Google Sheets)
  let shLaporanKlasikal = ss.getSheetByName(SHEETS.LAPORAN_KLASIKAL);
  if (!shLaporanKlasikal) {
    shLaporanKlasikal = ss.insertSheet(SHEETS.LAPORAN_KLASIKAL);
    shLaporanKlasikal.appendRow(['PEMERINTAH KOTA MALANG - SD NEGERI PISANGCANDI 1 MALANG']);
    shLaporanKlasikal.appendRow(['REKAPITULASI HASIL ASESMEN KLASIKAL KELAS - TA 2026/2027']);
    shLaporanKlasikal.appendRow([]);
    shLaporanKlasikal.appendRow(['Ringkasan Statistik Kelas:', 'Nilai Formula']);
    shLaporanKlasikal.appendRow(['Total Peserta Ujian', '=COUNTA(Data_Mentah!A2:A)']);
    shLaporanKlasikal.appendRow(['Rata-rata Nilai Kelas', '=IFERROR(AVERAGE(Data_Mentah!E2:E), 0)']);
    shLaporanKlasikal.appendRow(['Persentase Ketuntasan KKM', '=IFERROR(COUNTIF(Data_Mentah!F2:F, "Lulus") / COUNTA(Data_Mentah!A2:A), 0)']);
    shLaporanKlasikal.appendRow(['Catatan Pelanggaran Pindah Tab', '=IFERROR(SUM(Data_Mentah!G2:G), 0)']);
    shLaporanKlasikal.appendRow([]);
    shLaporanKlasikal.appendRow(['No.', 'NIS', 'Nama Siswa', 'Nilai Akhir (%)', 'Predikat', 'Status Kelulusan', 'Keterangan']);
  }

  // 5C. Tab 3: Laporan_Individu (Raport / Lembar Hasil Siswa dengan VLOOKUP Dinamis)
  let shLaporanIndividu = ss.getSheetByName(SHEETS.LAPORAN_INDIVIDU);
  if (!shLaporanIndividu) {
    shLaporanIndividu = ss.insertSheet(SHEETS.LAPORAN_INDIVIDU);
    shLaporanIndividu.appendRow(['SD NEGERI PISANGCANDI 1 MALANG - LEMBAR RAPOR HASIL BELAJAR PESERTA DIDIK']);
    shLaporanIndividu.appendRow([]);
    shLaporanIndividu.appendRow(['Pilih NIS Siswa (Sel B3):', '1001']);
    shLaporanIndividu.appendRow(['Nama Siswa:', '=IFERROR(VLOOKUP(B3, Data_Mentah!A2:J, 2, FALSE), "-")']);
    shLaporanIndividu.appendRow(['Kelas / Rombel:', '=IFERROR(VLOOKUP(B3, Data_Mentah!A2:J, 3, FALSE), "-")']);
    shLaporanIndividu.appendRow(['Paket Ujian:', '=IFERROR(VLOOKUP(B3, Data_Mentah!A2:J, 4, FALSE), "-")']);
    shLaporanIndividu.appendRow(['Perolehan Nilai (%):', '=IFERROR(VLOOKUP(B3, Data_Mentah!A2:J, 5, FALSE), 0)']);
    shLaporanIndividu.appendRow(['Status Ketuntasan:', '=IFERROR(VLOOKUP(B3, Data_Mentah!A2:J, 6, FALSE), "-")']);
    shLaporanIndividu.appendRow(['Catatan Integritas (Pindah Tab):', '=IFERROR(VLOOKUP(B3, Data_Mentah!A2:J, 7, FALSE), 0)']);
    shLaporanIndividu.appendRow(['Durasi Pengerjaan (Detik):', '=IFERROR(VLOOKUP(B3, Data_Mentah!A2:J, 8, FALSE), 0)']);
    shLaporanIndividu.appendRow([]);
    shLaporanIndividu.appendRow(['Tanda Tangan Guru Pengampu', '', 'Tanda Tangan Orang Tua / Wali']);
  }

  // 6. Users
  let shUsers = ss.getSheetByName(SHEETS.USERS);
  if (!shUsers) {
    shUsers = ss.insertSheet(SHEETS.USERS);
    shUsers.appendRow(['id', 'username', 'password', 'fullName', 'role', 'email', 'active']);
    shUsers.appendRow(['USR-001', 'admin', 'admin123', 'Administrator Sekolah', 'admin', 'admin@sekolah.sch.id', true]);
    shUsers.appendRow(['USR-002', 'guru', 'guru123', 'Guru Pengampu', 'teacher', 'guru@sekolah.sch.id', true]);
    formatHeaderRow(shUsers);
  }

  // 7. Logs
  let shLogs = ss.getSheetByName(SHEETS.LOGS);
  if (!shLogs) {
    shLogs = ss.insertSheet(SHEETS.LOGS);
    shLogs.appendRow(['id', 'timestamp', 'level', 'category', 'message', 'details']);
    formatHeaderRow(shLogs);
  }

  // 8. Curriculum (Capaian Pembelajaran, Elemen & Tujuan Pembelajaran Kurikulum Merdeka)
  let shCurriculum = ss.getSheetByName(SHEETS.CURRICULUM);
  if (!shCurriculum) {
    shCurriculum = ss.insertSheet(SHEETS.CURRICULUM);
    shCurriculum.appendRow(['id', 'subject', 'grade', 'element', 'learningOutcome', 'learningObjectivesJson', 'updatedAt']);
    shCurriculum.appendRow([
      'CUR-BIO-001',
      'Biologi',
      'Fase E (Kelas X)',
      'Pemahaman Sains',
      'Peserta didik memiliki kemampuan memahami keanekaragaman hayati, virus dan peranannya, inovasi bioteknologi, komponen ekosistem dan interaksi antar komponen serta perubahan lingkungan.',
      JSON.stringify([
        'Mengidentifikasi tingkatan keanekaragaman hayati gen, jenis, dan ekosistem di Indonesia',
        'Menganalisis peranan virus dalam kehidupan sehari-hari dan cara penularannya',
        'Menjelaskan prinsip bioteknologi konvensional dan modern beserta produknya',
        'Menganalisis interaksi antar komponen biotik dan abiotik dalam suatu ekosistem',
        'Mengevaluasi dampak aktivitas manusia terhadap perubahan lingkungan dan upaya pelestariannya'
      ]),
      new Date().toISOString()
    ]);
    formatHeaderRow(shCurriculum);
  }

  return 'Database initialized successfully!';
}

function formatHeaderRow(sheet) {
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 10);
  range.setBackground('#4338CA');
  range.setFontColor('#FFFFFF');
  range.setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * GET Handler (Menerima parameter action)
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'ping';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') {
      return jsonResponse({
        status: 'success',
        message: 'Koneksi ke Google Sheets berhasil!',
        timestamp: new Date().toISOString(),
        spreadsheetName: ss.getName()
      });
    }

    if (action === 'getAllData') {
      const data = {
        profile: getSheetDataAsObjects(ss.getSheetByName(SHEETS.PROFILE))[0] || null,
        exams: getSheetDataAsObjects(ss.getSheetByName(SHEETS.EXAMS)),
        questions: getSheetDataAsObjects(ss.getSheetByName(SHEETS.QUESTIONS)),
        students: getSheetDataAsObjects(ss.getSheetByName(SHEETS.STUDENTS)),
        submissions: getSheetDataAsObjects(ss.getSheetByName(SHEETS.SUBMISSIONS)),
        users: getSheetDataAsObjects(ss.getSheetByName(SHEETS.USERS)),
        curriculum: getSheetDataAsObjects(ss.getSheetByName(SHEETS.CURRICULUM))
      };
      return jsonResponse({ status: 'success', data: data });
    }

    if (action === 'getExams') {
      return jsonResponse({ status: 'success', data: getSheetDataAsObjects(ss.getSheetByName(SHEETS.EXAMS)) });
    }

    if (action === 'getQuestions') {
      const examId = e.parameter.examId;
      let questions = getSheetDataAsObjects(ss.getSheetByName(SHEETS.QUESTIONS));
      if (examId) {
        questions = questions.filter(function(q) { return q.examId === examId; });
      }
      return jsonResponse({ status: 'success', data: questions });
    }

    if (action === 'getSubmissions') {
      return jsonResponse({ status: 'success', data: getSheetDataAsObjects(ss.getSheetByName(SHEETS.SUBMISSIONS)) });
    }

    if (action === 'getStudents') {
      return jsonResponse({ status: 'success', data: getSheetDataAsObjects(ss.getSheetByName(SHEETS.STUDENTS)) });
    }

    if (action === 'getCurriculum') {
      return jsonResponse({ status: 'success', data: getSheetDataAsObjects(ss.getSheetByName(SHEETS.CURRICULUM)) });
    }

    return jsonResponse({ status: 'error', message: 'Action tidak dikenal: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * POST Handler (Menerima data dari aplikasi)
 */
function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.payload) {
      payload = JSON.parse(e.parameter.payload);
    }
    const action = payload.action || (e && e.parameter && e.parameter.action);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'getAllData' || action === 'fetchAll') {
      const data = {
        profile: getSheetDataAsObjects(ss.getSheetByName(SHEETS.PROFILE))[0] || null,
        exams: getSheetDataAsObjects(ss.getSheetByName(SHEETS.EXAMS)),
        questions: getSheetDataAsObjects(ss.getSheetByName(SHEETS.QUESTIONS)),
        students: getSheetDataAsObjects(ss.getSheetByName(SHEETS.STUDENTS)),
        submissions: getSheetDataAsObjects(ss.getSheetByName(SHEETS.SUBMISSIONS)),
        users: getSheetDataAsObjects(ss.getSheetByName(SHEETS.USERS)),
        curriculum: getSheetDataAsObjects(ss.getSheetByName(SHEETS.CURRICULUM))
      };
      return jsonResponse({ status: 'success', data: data });
    }

    if (action === 'init') {
      initDatabase();
      return jsonResponse({ status: 'success', message: 'Inisialisasi database berhasil' });
    }

    if (action === 'saveSubmission') {
      const sub = payload.submission;
      let sh = ss.getSheetByName(SHEETS.SUBMISSIONS);
      if (!sh) {
        initDatabase();
        sh = ss.getSheetByName(SHEETS.SUBMISSIONS);
      }
      
      sh.appendRow([
        sub.id,
        sub.examId,
        sub.studentNo,
        sub.studentName,
        sub.classGrade || '',
        JSON.stringify(sub.answers || {}),
        sub.score,
        sub.maxScore,
        sub.percentage,
        sub.passed,
        sub.submittedAt || new Date().toISOString(),
        sub.tabSwitchCount || 0,
        sub.timeSpentSeconds || 0,
        sub.feedback || '',
        sub.statusNote || 'Selesai',
        sub.allowRepeat ? true : false
      ]);

      // Mirror ke Tab 1: Data_Mentah (Sumber Data Sinkronisasi & Rumus Rekapitulasi)
      let shDataMentah = ss.getSheetByName(SHEETS.DATA_MENTAH);
      if (shDataMentah) {
        shDataMentah.appendRow([
          sub.studentNo,
          sub.studentName,
          sub.classGrade || '',
          sub.examId || '',
          sub.percentage,
          sub.passed ? 'Lulus' : 'Remedial',
          sub.tabSwitchCount || 0,
          sub.timeSpentSeconds || 0,
          sub.statusNote || 'Selesai',
          sub.submittedAt || new Date().toISOString()
        ]);
      }
      
      logAction('SYNC', 'Jawaban ujian disimpan: ' + sub.studentName + ' (Nilai: ' + sub.percentage + '%, Status: ' + (sub.statusNote || 'Selesai') + ')');
      return jsonResponse({ status: 'success', message: 'Jawaban tersimpan di Google Sheets (Submissions & Data_Mentah)', submissionId: sub.id });
    }

    if (action === 'saveStudents' || action === 'saveStudentList' || action === 'syncStudents') {
      const students = payload.students || [];
      let shSt = ss.getSheetByName(SHEETS.STUDENTS);
      if (!shSt) {
        initDatabase();
        shSt = ss.getSheetByName(SHEETS.STUDENTS);
      }
      
      const lastRow = shSt.getLastRow();
      const lastCol = Math.max(7, shSt.getLastColumn());
      if (lastRow > 1) {
        shSt.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }
      
      if (students.length > 0) {
        const rows = students.map(function(s) {
          return [
            String(s.id || ('STD-' + Utilities.getUuid().slice(0, 8))),
            String(s.studentNo || ''),
            String(s.fullName || ''),
            String(s.classGrade || ''),
            String(s.email || ''),
            String(s.phone || ''),
            String(s.status || 'active')
          ];
        });
        shSt.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
      
      logAction('SYNC', 'Data ' + students.length + ' siswa berhasil disimpan ke Google Sheets');
      return jsonResponse({ status: 'success', message: 'Data ' + students.length + ' siswa berhasil disimpan ke Google Sheets', count: students.length });
    }

    if (action === 'saveUsers' || action === 'syncUsers') {
      const users = payload.users || [];
      let shUs = ss.getSheetByName(SHEETS.USERS);
      if (!shUs) {
        initDatabase();
        shUs = ss.getSheetByName(SHEETS.USERS);
      }
      
      const lastRow = shUs.getLastRow();
      const lastCol = Math.max(7, shUs.getLastColumn());
      if (lastRow > 1) {
        shUs.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }
      
      if (users.length > 0) {
        const rows = users.map(function(u) {
          return [
            String(u.id || ('USR-' + Utilities.getUuid().slice(0, 8))),
            String(u.username || ''),
            String(u.password || ''),
            String(u.fullName || ''),
            String(u.role || 'teacher'),
            String(u.email || ''),
            u.active !== false
          ];
        });
        shUs.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
      
      logAction('USER', 'Data ' + users.length + ' akun guru/admin berhasil disimpan ke Google Sheets');
      return jsonResponse({ status: 'success', message: 'Data ' + users.length + ' akun berhasil disimpan ke Google Sheets', count: users.length });
    }

    if (action === 'saveExam') {
      const exam = payload.exam;
      const questions = payload.questions || [];
      const shEx = ss.getSheetByName(SHEETS.EXAMS);
      const shQu = ss.getSheetByName(SHEETS.QUESTIONS);
      
      upsertRow(shEx, 'id', exam.id, [
        exam.id,
        exam.title,
        exam.subject,
        exam.grade,
        exam.durationMinutes,
        exam.passingScore,
        exam.isStrict,
        exam.allowReview,
        exam.startsAt,
        exam.endsAt,
        exam.status,
        questions.length,
        exam.token || '',
        exam.instructions || '',
        exam.sessionStatus || 'scheduled',
        exam.sessionStartedAt || '',
        exam.sessionEndedAt || '',
        exam.allowLateSubmission || false,
        exam.lateExtensionMinutes || 0,
        typeof exam.learningObjectives === 'string' ? exam.learningObjectives : JSON.stringify(exam.learningObjectives || []),
        exam.createdAt || new Date().toISOString(),
        exam.redeployCount || 0
      ]);

      // Simpan butir soal secara atomik (tanpa resiko row hilang atau salah indeks)
      const targetExamId = String(exam.id || '').trim().toLowerCase();
      const existingQuData = shQu.getDataRange().getValues();
      const quHeaders = existingQuData[0] || ['id', 'examId', 'order', 'prompt', 'type', 'mediaType', 'mediaUrl', 'optionsJson', 'correctKeyJson', 'points', 'explanation', 'bloomLevel', 'soloLevel', 'basicCompetency', 'indicator', 'learningObjective'];
      const examIdColIdx = quHeaders.indexOf('examId') !== -1 ? quHeaders.indexOf('examId') : 1;
      
      const retainedQuRows = [];
      for (let i = 1; i < existingQuData.length; i++) {
        const rowExamId = String(existingQuData[i][examIdColIdx] || '').trim().toLowerCase();
        if (rowExamId !== targetExamId) {
          retainedQuRows.push(existingQuData[i]);
        }
      }

      const qRows = questions.map(function(q, i) {
        return [
          String(q.id || ('Q-' + exam.id + '-' + (i + 1))),
          String(exam.id),
          i + 1,
          String(q.prompt || ''),
          String(q.type || 'multiple_choice'),
          String(q.mediaType || 'none'),
          String(q.mediaUrl || ''),
          typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
          typeof q.correctKey === 'string' ? q.correctKey : JSON.stringify(q.correctKey || ''),
          Number(q.points || 10),
          String(q.explanation || ''),
          String(q.bloomLevel || ''),
          String(q.soloLevel || ''),
          String(q.basicCompetency || ''),
          String(q.indicator || ''),
          String(q.learningObjective || '')
        ];
      });

      const finalQuRows = [quHeaders].concat(retainedQuRows).concat(qRows);
      shQu.clearContents();
      SpreadsheetApp.flush();
      shQu.getRange(1, 1, finalQuRows.length, quHeaders.length).setValues(finalQuRows);
      SpreadsheetApp.flush();

      logAction('EXAM', 'Ujian disimpan: ' + exam.title + ' (' + questions.length + ' soal)');
      return jsonResponse({ status: 'success', message: 'Ujian dan ' + questions.length + ' soal berhasil diperbarui' });
    }

    if (action === 'saveQuestions' || action === 'syncQuestions') {
      const examId = String(payload.examId || '').trim();
      const questions = payload.questions || [];
      const shQu = ss.getSheetByName(SHEETS.QUESTIONS);
      const shEx = ss.getSheetByName(SHEETS.EXAMS);
      
      const targetExamId = examId.toLowerCase();
      const existingQuData = shQu.getDataRange().getValues();
      const quHeaders = existingQuData[0] || ['id', 'examId', 'order', 'prompt', 'type', 'mediaType', 'mediaUrl', 'optionsJson', 'correctKeyJson', 'points', 'explanation', 'bloomLevel', 'soloLevel', 'basicCompetency', 'indicator', 'learningObjective'];
      const examIdColIdx = quHeaders.indexOf('examId') !== -1 ? quHeaders.indexOf('examId') : 1;
      
      const retainedQuRows = [];
      for (let i = 1; i < existingQuData.length; i++) {
        const rowExamId = String(existingQuData[i][examIdColIdx] || '').trim().toLowerCase();
        if (rowExamId !== targetExamId) {
          retainedQuRows.push(existingQuData[i]);
        }
      }

      const qRows = questions.map(function(q, i) {
        return [
          String(q.id || ('Q-' + examId + '-' + (i + 1))),
          String(examId),
          i + 1,
          String(q.prompt || ''),
          String(q.type || 'multiple_choice'),
          String(q.mediaType || 'none'),
          String(q.mediaUrl || ''),
          typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
          typeof q.correctKey === 'string' ? q.correctKey : JSON.stringify(q.correctKey || ''),
          Number(q.points || 10),
          String(q.explanation || ''),
          String(q.bloomLevel || ''),
          String(q.soloLevel || ''),
          String(q.basicCompetency || ''),
          String(q.indicator || ''),
          String(q.learningObjective || '')
        ];
      });

      const finalQuRows = [quHeaders].concat(retainedQuRows).concat(qRows);
      shQu.clearContents();
      SpreadsheetApp.flush();
      shQu.getRange(1, 1, finalQuRows.length, quHeaders.length).setValues(finalQuRows);
      SpreadsheetApp.flush();

      // Perbarui totalQuestions pada sheet EXAMS jika ada
      if (shEx) {
        const exData = shEx.getDataRange().getValues();
        const exHeaders = exData[0];
        const idCol = exHeaders.indexOf('id');
        const totalQCol = exHeaders.indexOf('totalQuestions');
        if (idCol !== -1 && totalQCol !== -1) {
          for (let e = 1; e < exData.length; e++) {
            if (String(exData[e][idCol] || '').trim().toLowerCase() === targetExamId) {
              shEx.getRange(e + 1, totalQCol + 1).setValue(questions.length);
              break;
            }
          }
        }
      }

      logAction('EXAM', 'Soal diperbarui untuk ujian ' + examId + ' (' + questions.length + ' butir soal)');
      return jsonResponse({ status: 'success', message: questions.length + ' butir soal berhasil disimpan ke Google Sheets!', count: questions.length });
    }

    if (action === 'deleteExam') {
      const examId = payload.examId;
      const shEx = ss.getSheetByName(SHEETS.EXAMS);
      const shQu = ss.getSheetByName(SHEETS.QUESTIONS);
      deleteRowsByColumnValue(shEx, 'id', examId);
      deleteRowsByColumnValue(shQu, 'examId', examId);
      logAction('EXAM', 'Ujian dihapus: ' + examId);
      return jsonResponse({ status: 'success', message: 'Ujian berhasil dihapus' });
    }

    if (action === 'saveSchoolProfile') {
      const p = payload.profile;
      const sh = ss.getSheetByName(SHEETS.PROFILE);
      clearAndSetSingleRow(sh, [
        p.name,
        p.npsn,
        p.address,
        p.logoUrl,
        p.academicYear,
        p.semester,
        p.principalName,
        p.principalNip,
        p.teacherName,
        p.teacherNip || '',
        p.teacherSubject || '',
        p.teacherEmail || '',
        p.teacherTitle || '',
        new Date().toISOString()
      ]);
      logAction('SYNC', 'Profil sekolah diperbarui: ' + p.name);
      return jsonResponse({ status: 'success', message: 'Profil sekolah berhasil disimpan' });
    }

    if (action === 'saveCurriculum' || action === 'syncCurriculum') {
      const items = payload.curriculum || payload.items || [];
      let shCur = ss.getSheetByName(SHEETS.CURRICULUM);
      if (!shCur) {
        initDatabase();
        shCur = ss.getSheetByName(SHEETS.CURRICULUM);
      }
      
      const lastRow = shCur.getLastRow();
      const lastCol = Math.max(7, shCur.getLastColumn());
      if (lastRow > 1) {
        shCur.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }
      
      if (items.length > 0) {
        const rows = items.map(function(c) {
          return [
            String(c.id || ('CUR-' + Utilities.getUuid().slice(0, 8))),
            String(c.subject || ''),
            String(c.grade || ''),
            String(c.element || ''),
            String(c.learningOutcome || ''),
            typeof c.learningObjectives === 'string' ? c.learningObjectives : JSON.stringify(c.learningObjectives || []),
            String(c.updatedAt || new Date().toISOString())
          ];
        });
        shCur.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
      
      logAction('CURRICULUM', 'Data CP, Elemen, dan TP untuk ' + items.length + ' kurikulum disimpan ke Google Sheets');
      return jsonResponse({ status: 'success', message: 'Data ' + items.length + ' kurikulum (CP/Elemen/TP) berhasil disimpan ke Google Sheets', count: items.length });
    }

    if (action === 'syncAll') {
      // Menyinkronkan paket data lengkap dari aplikasi
      if (payload.profile) {
        clearAndSetSingleRow(ss.getSheetByName(SHEETS.PROFILE), [
          payload.profile.name,
          payload.profile.npsn,
          payload.profile.address,
          payload.profile.logoUrl,
          payload.profile.academicYear,
          payload.profile.semester,
          payload.profile.principalName,
          payload.profile.principalNip,
          payload.profile.teacherName,
          payload.profile.teacherNip || '',
          payload.profile.teacherSubject || '',
          payload.profile.teacherEmail || '',
          payload.profile.teacherTitle || '',
          new Date().toISOString()
        ]);
      }
      if (Array.isArray(payload.students)) {
        let shSt = ss.getSheetByName(SHEETS.STUDENTS);
        if (!shSt) { initDatabase(); shSt = ss.getSheetByName(SHEETS.STUDENTS); }
        const lastRow = shSt.getLastRow();
        if (lastRow > 1) {
          shSt.getRange(2, 1, lastRow - 1, shSt.getLastColumn()).clearContent();
        }
        if (payload.students.length > 0) {
          const rows = payload.students.map(function(s) {
            return [
              String(s.id || ('STD-' + Utilities.getUuid().slice(0, 8))),
              String(s.studentNo || ''),
              String(s.fullName || ''),
              String(s.classGrade || ''),
              String(s.email || ''),
              String(s.phone || ''),
              String(s.status || 'active')
            ];
          });
          shSt.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        }
      }
      return jsonResponse({ status: 'success', message: 'Sinkronisasi menyeluruh berhasil!' });
    }

    return jsonResponse({ status: 'error', message: 'Action POST tidak dikenal: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Utilitas Response JSON untuk menghindari kendala CORS
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetDataAsObjects(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const headers = rows[0];
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    for (let h = 0; h < headers.length; h++) {
      let val = row[h];
      const header = headers[h];
      if (header.endsWith('Json') || header === 'answersJson' || header === 'optionsJson' || header === 'correctKeyJson') {
        try {
          val = JSON.parse(val);
        } catch(e) {}
      }
      obj[header] = val;
    }
    results.push(obj);
  }
  return results;
}

function upsertRow(sheet, keyColumn, keyValue, rowValues) {
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    sheet.appendRow(rowValues);
    return;
  }
  const headers = data[0];
  const colIndex = headers.indexOf(keyColumn);
  if (colIndex === -1) {
    sheet.appendRow(rowValues);
    return;
  }
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] === keyValue) {
      sheet.getRange(i + 1, 1, 1, rowValues.length).setValues([rowValues]);
      return;
    }
  }
  sheet.appendRow(rowValues);
}

function deleteRowsByColumnValue(sheet, keyColumn, keyValue) {
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;
  const headers = data[0];
  const colIndex = headers.indexOf(keyColumn);
  if (colIndex === -1) return;
  
  const cleanTarget = String(keyValue || '').trim().toLowerCase();
  const retained = [headers];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex] || '').trim().toLowerCase() !== cleanTarget) {
      retained.push(data[i]);
    }
  }

  // Bersihkan data lama dan tulis ulang secara instan (Batch I/O tanpa timeout)
  sheet.clearContents();
  if (retained.length > 0) {
    sheet.getRange(1, 1, retained.length, retained[0].length).setValues(retained);
  }
}

function clearAndSetSingleRow(sheet, values) {
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  sheet.appendRow(values);
}

function logAction(category, message) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEETS.LOGS);
    if (sh) {
      sh.appendRow(['LOG-' + Date.now(), new Date().toISOString(), 'INFO', category, message, '']);
    }
  } catch(e) {}
}
`;
