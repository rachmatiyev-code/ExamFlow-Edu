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
  REKAP: 'Rekap_Nilai',
  DATA_MENTAH: 'Data_Mentah',
  LAPORAN_KLASIKAL: 'Laporan_Klasikal',
  LAPORAN_INDIVIDU: 'Laporan_Individu',
  USERS: 'Users',
  CURRICULUM: 'Curriculum',
  CHAT: 'Chat_Bantuan',
  LOGS: 'Logs'
};

const CANONICAL_REKAP_HEADERS = [
  'id', 'studentNo', 'studentName', 'classGrade', 'subject', 'examTitle', 'examId', 
  'score', 'maxScore', 'percentage', 'passingScore', 'passed', 'statusNote', 
  'timeSpentSeconds', 'submittedAt', 'updatedAt'
];

// Canonical Headers untuk integritas & auto-healing kolom antar versi
const CANONICAL_PROFILE_HEADERS = [
  'name', 'npsn', 'address', 'logoUrl', 'regionalGovLogoUrl', 'regionalGovName', 
  'regionalGovDepartment', 'academicYear', 'semester', 'principalName', 'principalNip', 
  'teacherName', 'teacherNip', 'teacherSubject', 'teacherEmail', 'teacherTitle', 'updatedAt'
];

const CANONICAL_QU_HEADERS = [
  'id', 'examId', 'order', 'prompt', 'type', 'mediaType', 'mediaUrl', 
  'optionsJson', 'correctKeyJson', 'points', 'explanation', 'bloomLevel', 
  'soloLevel', 'basicCompetency', 'indicator', 'learningObjective'
];

const CANONICAL_EX_HEADERS = [
  'id', 'title', 'subject', 'grade', 'durationMinutes', 'passingScore', 
  'isStrict', 'allowReview', 'startsAt', 'endsAt', 'status', 'totalQuestions', 
  'token', 'instructions', 'sessionStatus', 'sessionStartedAt', 'sessionEndedAt', 
  'allowLateSubmission', 'lateExtensionMinutes', 'learningObjectives', 'attemptMode', 
  'createdAt', 'redeployCount'
];

const CANONICAL_SUBMISSION_HEADERS = [
  'id', 'examId', 'examTitle', 'studentNo', 'studentName', 'classGrade', 'answersJson', 
  'score', 'maxScore', 'percentage', 'passed', 'submittedAt', 'tabSwitchCount', 
  'timeSpentSeconds', 'feedback', 'statusNote', 'allowRepeat'
];

const CANONICAL_CHAT_HEADERS = [
  'id', 'senderNis', 'senderName', 'senderRole', 'targetNis', 'message', 'timestamp', 'examId', 'status'
];

/**
 * Mencari sheet Curriculum secara fleksibel (mendukung ragam nama tab: Curriculum, Kurikulum, CP_TP, dsb.)
 */
function getCurriculumSheet(ss) {
  if (!ss) return null;
  return ss.getSheetByName(SHEETS.CURRICULUM) ||
         ss.getSheetByName('Kurikulum') ||
         ss.getSheetByName('CP_TP') ||
         ss.getSheetByName('CP-TP') ||
         ss.getSheetByName('Capaian Pembelajaran') ||
         ss.getSheetByName('Capaian_Pembelajaran') ||
         ss.getSheetByName('CP & TP') ||
         null;
}

/**
 * Memastikan sheet memiliki jumlah kolom fisik yang mencukupi tanpa memicu exception batas kolom
 */
function ensureMinColumns(sheet, minCols) {
  if (!sheet) return;
  const currentMax = sheet.getMaxColumns();
  if (currentMax < minCols) {
    sheet.insertColumnsAfter(currentMax, minCols - currentMax);
  }
}

/**
 * Menormalkan array baris 2D agar semua baris memiliki panjang kolom seragam (targetCols)
 */
function normalize2DArray(rows, targetCols) {
  return rows.map(function(row) {
    const r = Array.isArray(row) ? row.slice(0, targetCols) : [];
    while (r.length < targetCols) {
      r.push('');
    }
    return r;
  });
}

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
    shProfile.appendRow(CANONICAL_PROFILE_HEADERS);
    shProfile.appendRow([
      'SD NEGERI PISANGCANDI 1 MALANG',
      '20533857',
      'Jl. Raya Pisang Candi No. 1, Kec. Sukun, Kota Malang, Jawa Timur 65146',
      'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=200&auto=format&fit=crop&q=80',
      '', // regionalGovLogoUrl
      'PEMERINTAH KOTA MALANG',
      'DINAS PENDIDIKAN DAN KEBUDAYAAN',
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
  } else {
    ensureMinColumns(shProfile, CANONICAL_PROFILE_HEADERS.length);
    // Auto-heal row 1 headers agar kolom logo pemkot, nama pemda, dan nama OPD selalu muncul di sheet
    shProfile.getRange(1, 1, 1, CANONICAL_PROFILE_HEADERS.length).setValues([CANONICAL_PROFILE_HEADERS]);
    formatHeaderRow(shProfile);
  }

  // 2. Exams (Didukung attemptMode: 'single' | 'unlimited')
  let shExams = ss.getSheetByName(SHEETS.EXAMS);
  if (!shExams) {
    shExams = ss.insertSheet(SHEETS.EXAMS);
    shExams.appendRow(CANONICAL_EX_HEADERS);
    formatHeaderRow(shExams);
  } else {
    ensureMinColumns(shExams, CANONICAL_EX_HEADERS.length);
    const exHeaderRange = shExams.getRange(1, 1, 1, CANONICAL_EX_HEADERS.length);
    exHeaderRange.setValues([CANONICAL_EX_HEADERS]);
    formatHeaderRow(shExams);
  }

  // 3. Questions (Auto-healing 16 kolom untuk Tujuan Pembelajaran)
  let shQuestions = ss.getSheetByName(SHEETS.QUESTIONS);
  if (!shQuestions) {
    shQuestions = ss.insertSheet(SHEETS.QUESTIONS);
    shQuestions.appendRow(CANONICAL_QU_HEADERS);
    formatHeaderRow(shQuestions);
  } else {
    ensureMinColumns(shQuestions, CANONICAL_QU_HEADERS.length);
    const quHeaderRange = shQuestions.getRange(1, 1, 1, CANONICAL_QU_HEADERS.length);
    quHeaderRange.setValues([CANONICAL_QU_HEADERS]);
    formatHeaderRow(shQuestions);
  }

  // 4. Students
  let shStudents = ss.getSheetByName(SHEETS.STUDENTS);
  if (!shStudents) {
    shStudents = ss.insertSheet(SHEETS.STUDENTS);
    shStudents.appendRow(['id', 'studentNo', 'fullName', 'classGrade', 'email', 'phone', 'status']);
    formatHeaderRow(shStudents);
  }

  // 5. Submissions (Kolom ke-3: examTitle "Nama Paket Ujian", statusNote & allowRepeat)
  let shSubmissions = ss.getSheetByName(SHEETS.SUBMISSIONS);
  if (!shSubmissions) {
    shSubmissions = ss.insertSheet(SHEETS.SUBMISSIONS);
    shSubmissions.appendRow(CANONICAL_SUBMISSION_HEADERS);
    formatHeaderRow(shSubmissions);
  } else {
    ensureMinColumns(shSubmissions, CANONICAL_SUBMISSION_HEADERS.length);
    const subData = shSubmissions.getDataRange().getValues();
    if (subData.length > 0) {
      const headers = subData[0].map(String);
      const exTitleIdx = headers.indexOf('examTitle');
      if (exTitleIdx === -1) {
        // Auto-healing: sisipkan kolom 'examTitle' di posisi ke-3 (setelah examId)
        shSubmissions.insertColumnAfter(2);
        shSubmissions.getRange(1, 3).setValue('examTitle');
      }
    }
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

  // 5D. Tab Rekap_Nilai (Rekapitulasi Nilai Asesmen per Mata Pelajaran & Kelas)
  let shRekap = ss.getSheetByName(SHEETS.REKAP);
  if (!shRekap) {
    shRekap = ss.insertSheet(SHEETS.REKAP);
    shRekap.appendRow(CANONICAL_REKAP_HEADERS);
    formatHeaderRow(shRekap);
  } else {
    ensureMinColumns(shRekap, CANONICAL_REKAP_HEADERS.length);
    const rekapHeaderRange = shRekap.getRange(1, 1, 1, CANONICAL_REKAP_HEADERS.length);
    rekapHeaderRange.setValues([CANONICAL_REKAP_HEADERS]);
    formatHeaderRow(shRekap);
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

  // 9. Chat_Bantuan (Pesan Bantuan / Live Chat antara Guru dan Siswa)
  let shChat = ss.getSheetByName(SHEETS.CHAT);
  if (!shChat) {
    shChat = ss.insertSheet(SHEETS.CHAT);
    shChat.appendRow(CANONICAL_CHAT_HEADERS);
    formatHeaderRow(shChat);
  } else {
    ensureMinColumns(shChat, CANONICAL_CHAT_HEADERS.length);
    formatHeaderRow(shChat);
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
        curriculum: getSheetDataAsObjects(getCurriculumSheet(ss)),
        chat: getSheetDataAsObjects(ss.getSheetByName(SHEETS.CHAT))
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
      return jsonResponse({ status: 'success', data: getSheetDataAsObjects(getCurriculumSheet(ss)) });
    }

    if (action === 'getChatMessages' || action === 'getChat') {
      return jsonResponse({ status: 'success', data: getSheetDataAsObjects(ss.getSheetByName(SHEETS.CHAT)) });
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
        curriculum: getSheetDataAsObjects(getCurriculumSheet(ss)),
        chat: getSheetDataAsObjects(ss.getSheetByName(SHEETS.CHAT))
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
      
      ensureMinColumns(sh, CANONICAL_SUBMISSION_HEADERS.length);
      const subHeaderVals = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
      if (subHeaderVals.indexOf('examTitle') === -1) {
        sh.insertColumnAfter(2);
        sh.getRange(1, 3).setValue('examTitle');
        formatHeaderRow(sh);
      }
      
      sh.appendRow([
        String(sub.id || ('SUB-' + Utilities.getUuid().slice(0, 8))),
        String(sub.examId || ''),
        String(sub.examTitle || ''),
        String(sub.studentNo || ''),
        String(sub.studentName || ''),
        String(sub.classGrade || ''),
        typeof sub.answers === 'string' ? sub.answers : JSON.stringify(sub.answers || {}),
        Number(sub.score || 0),
        Number(sub.maxScore || 100),
        Number(sub.percentage || 0),
        Boolean(sub.passed),
        String(sub.submittedAt || new Date().toISOString()),
        Number(sub.tabSwitchCount || 0),
        Number(sub.timeSpentSeconds || 0),
        String(sub.feedback || ''),
        String(sub.statusNote || 'Selesai'),
        sub.allowRepeat ? true : false
      ]);

      // Mirror ke Tab 1: Data_Mentah (Sumber Data Sinkronisasi & Rumus Rekapitulasi)
      let shDataMentah = ss.getSheetByName(SHEETS.DATA_MENTAH);
      if (shDataMentah) {
        shDataMentah.appendRow([
          String(sub.studentNo || ''),
          String(sub.studentName || ''),
          String(sub.classGrade || ''),
          String(sub.examTitle || sub.examId || ''),
          Number(sub.percentage || 0),
          sub.passed ? 'Lulus' : 'Remedial',
          Number(sub.tabSwitchCount || 0),
          Number(sub.timeSpentSeconds || 0),
          String(sub.statusNote || 'Selesai'),
          String(sub.submittedAt || new Date().toISOString())
        ]);
      }
      
      logAction('SYNC', 'Jawaban ujian disimpan: ' + sub.studentName + ' - Paket: ' + (sub.examTitle || sub.examId) + ' (Nilai: ' + sub.percentage + '%, Status: ' + (sub.statusNote || 'Selesai') + ')');
      return jsonResponse({ status: 'success', message: 'Jawaban tersimpan di Google Sheets (Submissions & Data_Mentah)', submissionId: sub.id });
    }

    if (action === 'syncSubmissions' || action === 'saveSubmissions') {
      const subs = payload.submissions || [];
      let shSub = ss.getSheetByName(SHEETS.SUBMISSIONS);
      if (!shSub) {
        initDatabase();
        shSub = ss.getSheetByName(SHEETS.SUBMISSIONS);
      }
      
      ensureMinColumns(shSub, CANONICAL_SUBMISSION_HEADERS.length);
      const subHeaderVals = shSub.getRange(1, 1, 1, Math.max(1, shSub.getLastColumn())).getValues()[0].map(String);
      if (subHeaderVals.indexOf('examTitle') === -1) {
        shSub.insertColumnAfter(2);
        shSub.getRange(1, 3).setValue('examTitle');
        formatHeaderRow(shSub);
      }

      const lastRow = shSub.getLastRow();
      const lastCol = Math.max(CANONICAL_SUBMISSION_HEADERS.length, shSub.getLastColumn());
      if (lastRow > 1) {
        shSub.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }
      
      if (subs.length > 0) {
        const rows = subs.map(function(s) {
          return [
            String(s.id || ('SUB-' + Utilities.getUuid().slice(0, 8))),
            String(s.examId || ''),
            String(s.examTitle || ''),
            String(s.studentNo || ''),
            String(s.studentName || ''),
            String(s.classGrade || ''),
            typeof s.answers === 'string' ? s.answers : JSON.stringify(s.answers || {}),
            Number(s.score || 0),
            Number(s.maxScore || 100),
            Number(s.percentage || 0),
            Boolean(s.passed),
            String(s.submittedAt || new Date().toISOString()),
            Number(s.tabSwitchCount || 0),
            Number(s.timeSpentSeconds || 0),
            String(s.feedback || ''),
            String(s.statusNote || 'Selesai'),
            Boolean(s.allowRepeat || s.statusNote === 'Mengulang Ujian')
          ];
        });
        shSub.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }

      // Sinkronkan juga ke Data_Mentah
      let shDataMentah = ss.getSheetByName(SHEETS.DATA_MENTAH);
      if (shDataMentah) {
        const dmLastRow = shDataMentah.getLastRow();
        const dmLastCol = Math.max(10, shDataMentah.getLastColumn());
        if (dmLastRow > 1) {
          shDataMentah.getRange(2, 1, dmLastRow - 1, dmLastCol).clearContent();
        }
        if (subs.length > 0) {
          const dmRows = subs.map(function(s) {
            return [
              String(s.studentNo || ''),
              String(s.studentName || ''),
              String(s.classGrade || ''),
              String(s.examId || ''),
              Number(s.percentage || 0),
              s.passed ? 'Lulus' : 'Remedial',
              Number(s.tabSwitchCount || 0),
              Number(s.timeSpentSeconds || 0),
              String(s.statusNote || 'Selesai'),
              String(s.submittedAt || new Date().toISOString())
            ];
          });
          shDataMentah.getRange(2, 1, dmRows.length, dmRows[0].length).setValues(dmRows);
        }
      }

      logAction('SYNC', 'Data ' + subs.length + ' submission disinkronkan ke Google Sheets');
      return jsonResponse({ status: 'success', message: 'Data ' + subs.length + ' rekaman nilai berhasil disinkronkan ke Google Sheets', count: subs.length });
    }

    if (action === 'saveGradeRecap' || action === 'syncGradeRecap') {
      const recaps = payload.recaps || payload.data || [];
      const filterSubject = payload.subject || 'Semua Mapel';
      const filterGrade = payload.classGrade || payload.grade || 'Semua Kelas';

      let shRekap = ss.getSheetByName(SHEETS.REKAP);
      if (!shRekap) {
        initDatabase();
        shRekap = ss.getSheetByName(SHEETS.REKAP);
      }
      ensureMinColumns(shRekap, CANONICAL_REKAP_HEADERS.length);

      const rekapRows = recaps.map(function(r, idx) {
        return [
          String(r.id || ('REKAP-' + (idx + 1))),
          String(r.studentNo || ''),
          String(r.studentName || ''),
          String(r.classGrade || ''),
          String(r.subject || ''),
          String(r.examTitle || ''),
          String(r.examId || ''),
          Number(r.score || 0),
          Number(r.maxScore || 100),
          Number(r.percentage || 0),
          Number(r.passingScore || 75),
          r.passed ? 'Tuntas' : 'Belum Tuntas',
          String(r.statusNote || 'Selesai'),
          Number(r.timeSpentSeconds || 0),
          String(r.submittedAt || new Date().toISOString()),
          new Date().toISOString()
        ];
      });

      const finalRows = [CANONICAL_REKAP_HEADERS].concat(rekapRows);
      shRekap.clearContents();
      SpreadsheetApp.flush();
      shRekap.getRange(1, 1, finalRows.length, CANONICAL_REKAP_HEADERS.length).setValues(finalRows);
      formatHeaderRow(shRekap);
      SpreadsheetApp.flush();

      logAction('SYNC', 'Rekap nilai ' + recaps.length + ' siswa (' + filterSubject + ' - ' + filterGrade + ') berhasil disimpan ke Google Sheets');
      return jsonResponse({
        status: 'success',
        message: 'Rekap nilai ' + recaps.length + ' siswa (' + filterSubject + ' - ' + filterGrade + ') berhasil disimpan ke sheet "' + SHEETS.REKAP + '" Google Sheets!',
        count: recaps.length
      });
    }

    if (action === 'deleteSubmission') {
      const subId = String(payload.submissionId || payload.id || '').trim();
      const studentNo = String(payload.studentNo || '').trim().toLowerCase();
      const examId = String(payload.examId || '').trim().toLowerCase();

      let shSub = ss.getSheetByName(SHEETS.SUBMISSIONS);
      if (shSub) {
        if (subId) {
          deleteRowsByColumnValue(shSub, 'id', subId);
        }
        if (studentNo) {
          const subData = shSub.getDataRange().getValues();
          if (subData.length > 1) {
            const headers = subData[0];
            const stNoCol = headers.indexOf('studentNo');
            const exIdCol = headers.indexOf('examId');
            if (stNoCol !== -1) {
              const retained = [subData[0]];
              for (let i = 1; i < subData.length; i++) {
                const rowNis = String(subData[i][stNoCol] || '').trim().toLowerCase();
                const rowExam = exIdCol !== -1 ? String(subData[i][exIdCol] || '').trim().toLowerCase() : '';
                const isMatch = (examId ? (rowNis === studentNo && rowExam === examId) : (rowNis === studentNo));
                if (!isMatch) {
                  retained.push(subData[i]);
                }
              }
              shSub.clearContents();
              if (retained.length > 0) {
                shSub.getRange(1, 1, retained.length, retained[0].length).setValues(retained);
              }
            }
          }
        }
        SpreadsheetApp.flush();
      }

      let shDataMentah = ss.getSheetByName(SHEETS.DATA_MENTAH);
      if (shDataMentah && (studentNo || subId)) {
        const dmData = shDataMentah.getDataRange().getValues();
        if (dmData.length > 1) {
          const retainedDm = [dmData[0]];
          for (let i = 1; i < dmData.length; i++) {
            const rowNis = String(dmData[i][0] || '').trim().toLowerCase();
            const rowExam = String(dmData[i][3] || '').trim().toLowerCase();
            const isMatch = (studentNo && examId && rowNis === studentNo && rowExam === examId) ||
                            (studentNo && !examId && rowNis === studentNo);
            if (!isMatch) {
              retainedDm.push(dmData[i]);
            }
          }
          shDataMentah.clearContents();
          if (retainedDm.length > 0) {
            shDataMentah.getRange(1, 1, retainedDm.length, retainedDm[0].length).setValues(retainedDm);
          }
        }
        SpreadsheetApp.flush();
      }

      logAction('SYNC', 'Submission dihapus dari Google Sheets: ' + (subId || studentNo));
      return jsonResponse({ status: 'success', message: 'Submission berhasil dihapus dari Google Sheets' });
    }

    if (action === 'allowRetakeSubmission' || action === 'resetSubmission') {
      const subId = String(payload.submissionId || payload.id || '').trim();
      const studentNo = String(payload.studentNo || '').trim().toLowerCase();
      const examId = String(payload.examId || '').trim().toLowerCase();

      let shSub = ss.getSheetByName(SHEETS.SUBMISSIONS);
      if (shSub) {
        const subData = shSub.getDataRange().getValues();
        if (subData.length > 1) {
          const headers = subData[0];
          let idCol = headers.indexOf('id');
          let stNoCol = headers.indexOf('studentNo');
          let exIdCol = headers.indexOf('examId');
          let scoreCol = headers.indexOf('score');
          let pctCol = headers.indexOf('percentage');
          let passedCol = headers.indexOf('passed');
          let noteCol = headers.indexOf('statusNote');
          let repeatCol = headers.indexOf('allowRepeat');
          let feedbackCol = headers.indexOf('feedback');

          // Auto-healing header jika belum ada kolom statusNote atau allowRepeat
          if (noteCol === -1 || repeatCol === -1) {
            const currentHeaders = headers.slice();
            if (noteCol === -1) {
              currentHeaders.push('statusNote');
              noteCol = currentHeaders.length - 1;
            }
            if (repeatCol === -1) {
              currentHeaders.push('allowRepeat');
              repeatCol = currentHeaders.length - 1;
            }
            ensureMinColumns(shSub, currentHeaders.length);
            shSub.getRange(1, 1, 1, currentHeaders.length).setValues([currentHeaders]);
          }

          for (let i = 1; i < subData.length; i++) {
            const rowId = idCol !== -1 ? String(subData[i][idCol] || '').trim() : '';
            const rowNis = stNoCol !== -1 ? String(subData[i][stNoCol] || '').trim().toLowerCase() : '';
            const rowExam = exIdCol !== -1 ? String(subData[i][exIdCol] || '').trim().toLowerCase() : '';

            const isTarget = (subId && rowId.toLowerCase() === subId.toLowerCase()) || 
                             (studentNo && rowNis === studentNo && (rowExam === examId || !examId));
            if (isTarget) {
              if (scoreCol !== -1) shSub.getRange(i + 1, scoreCol + 1).setValue(0);
              if (pctCol !== -1) shSub.getRange(i + 1, pctCol + 1).setValue(0);
              if (passedCol !== -1) shSub.getRange(i + 1, passedCol + 1).setValue(false);
              if (noteCol !== -1) shSub.getRange(i + 1, noteCol + 1).setValue('Mengulang Ujian');
              if (repeatCol !== -1) shSub.getRange(i + 1, repeatCol + 1).setValue(true);
              if (feedbackCol !== -1) shSub.getRange(i + 1, feedbackCol + 1).setValue('Diizinkan Mengulang Ujian');
            }
          }
          SpreadsheetApp.flush();
        }
      }

      // Update di Data_Mentah
      let shDataMentah = ss.getSheetByName(SHEETS.DATA_MENTAH);
      if (shDataMentah && (studentNo || subId)) {
        const dmData = shDataMentah.getDataRange().getValues();
        for (let i = 1; i < dmData.length; i++) {
          const rowNis = String(dmData[i][0] || '').trim().toLowerCase();
          const rowExam = String(dmData[i][3] || '').trim().toLowerCase();
          if ((studentNo && examId && rowNis === studentNo && rowExam === examId) || (studentNo && rowNis === studentNo)) {
            shDataMentah.getRange(i + 1, 5).setValue(0);
            shDataMentah.getRange(i + 1, 6).setValue('Remedial');
            shDataMentah.getRange(i + 1, 9).setValue('Mengulang Ujian');
          }
        }
        SpreadsheetApp.flush();
      }

      logAction('SYNC', 'Status siswa direset untuk mengulang ujian: ' + (studentNo || subId));
      return jsonResponse({ status: 'success', message: 'Status siswa berhasil direset ke "Mengulang Ujian"' });
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
      let shEx = ss.getSheetByName(SHEETS.EXAMS);
      let shQu = ss.getSheetByName(SHEETS.QUESTIONS);
      if (!shEx || !shQu) {
        initDatabase();
        shEx = ss.getSheetByName(SHEETS.EXAMS);
        shQu = ss.getSheetByName(SHEETS.QUESTIONS);
      }
      
      ensureMinColumns(shEx, CANONICAL_EX_HEADERS.length);
      shEx.getRange(1, 1, 1, CANONICAL_EX_HEADERS.length).setValues([CANONICAL_EX_HEADERS]);
      const isStoppedExam = String(exam.status || '').toLowerCase() === 'stopped' || String(exam.sessionStatus || '').toLowerCase() === 'stopped';
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
        isStoppedExam ? 'stopped' : (exam.status || 'active'),
        questions.length,
        exam.token || '',
        exam.instructions || '',
        isStoppedExam ? 'stopped' : (exam.sessionStatus || 'scheduled'),
        exam.sessionStartedAt || '',
        exam.sessionEndedAt || '',
        isStoppedExam ? false : Boolean(exam.allowLateSubmission),
        exam.lateExtensionMinutes || 0,
        typeof exam.learningObjectives === 'string' ? exam.learningObjectives : JSON.stringify(exam.learningObjectives || []),
        exam.attemptMode || 'single',
        exam.createdAt || new Date().toISOString(),
        exam.redeployCount || 0
      ]);

      // Simpan butir soal secara atomik (tanpa resiko mismatch kolom)
      ensureMinColumns(shQu, CANONICAL_QU_HEADERS.length);
      const targetExamId = String(exam.id || '').trim().toLowerCase();
      const existingQuData = shQu.getDataRange().getValues();
      const examIdColIdx = (existingQuData.length > 0 && existingQuData[0].indexOf('examId') !== -1) ? existingQuData[0].indexOf('examId') : 1;
      
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

      const rawCombinedRows = [CANONICAL_QU_HEADERS].concat(retainedQuRows).concat(qRows);
      const finalQuRows = normalize2DArray(rawCombinedRows, CANONICAL_QU_HEADERS.length);

      shQu.clearContents();
      SpreadsheetApp.flush();
      shQu.getRange(1, 1, finalQuRows.length, CANONICAL_QU_HEADERS.length).setValues(finalQuRows);
      formatHeaderRow(shQu);
      SpreadsheetApp.flush();

      logAction('EXAM', 'Ujian disimpan: ' + exam.title + ' (' + questions.length + ' soal)');
      return jsonResponse({ status: 'success', message: 'Ujian dan ' + questions.length + ' soal berhasil diperbarui' });
    }

    if (action === 'stopExamSession') {
      const examId = String(payload.examId || '').trim();
      let shEx = ss.getSheetByName(SHEETS.EXAMS);
      if (shEx && examId) {
        ensureMinColumns(shEx, CANONICAL_EX_HEADERS.length);
        const exData = shEx.getDataRange().getValues();
        if (exData.length > 0) {
          const lowerHeaders = exData[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
          if (lowerHeaders.indexOf('sessionstatus') === -1 || lowerHeaders.indexOf('status') === -1) {
            shEx.getRange(1, 1, 1, CANONICAL_EX_HEADERS.length).setValues([CANONICAL_EX_HEADERS]);
            formatHeaderRow(shEx);
          }
          const refreshedData = shEx.getDataRange().getValues();
          const hdrs = refreshedData[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
          const idCol = hdrs.indexOf('id');
          const statusCol = hdrs.indexOf('status');
          const sessionStatusCol = hdrs.indexOf('sessionstatus');
          const endedAtCol = hdrs.indexOf('sessionendedat');
          const allowLateCol = hdrs.indexOf('allowlatesubmission');
          for (let i = 1; i < refreshedData.length; i++) {
            if (idCol !== -1 && String(refreshedData[i][idCol] || '').trim().toLowerCase() === examId.toLowerCase()) {
              if (statusCol !== -1) shEx.getRange(i + 1, statusCol + 1).setValue('stopped');
              if (sessionStatusCol !== -1) shEx.getRange(i + 1, sessionStatusCol + 1).setValue('stopped');
              if (endedAtCol !== -1) shEx.getRange(i + 1, endedAtCol + 1).setValue(new Date().toISOString());
              if (allowLateCol !== -1) shEx.getRange(i + 1, allowLateCol + 1).setValue(false);
              SpreadsheetApp.flush();
              break;
            }
          }
        }
      }
      logAction('EXAM', 'Sesi ujian DIHENTIKAN PERMANEN: ' + examId);
      return jsonResponse({ status: 'success', message: 'Sesi ujian ' + examId + ' berhasil dihentikan secara permanen.' });
    }

    if (action === 'resumeExamSession') {
      const examId = String(payload.examId || '').trim();
      let shEx = ss.getSheetByName(SHEETS.EXAMS);
      if (shEx && examId) {
        ensureMinColumns(shEx, CANONICAL_EX_HEADERS.length);
        const exData = shEx.getDataRange().getValues();
        if (exData.length > 0) {
          const lowerHeaders = exData[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
          if (lowerHeaders.indexOf('sessionstatus') === -1 || lowerHeaders.indexOf('status') === -1) {
            shEx.getRange(1, 1, 1, CANONICAL_EX_HEADERS.length).setValues([CANONICAL_EX_HEADERS]);
            formatHeaderRow(shEx);
          }
          const refreshedData = shEx.getDataRange().getValues();
          const hdrs = refreshedData[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
          const idCol = hdrs.indexOf('id');
          const statusCol = hdrs.indexOf('status');
          const sessionStatusCol = hdrs.indexOf('sessionstatus');
          for (let i = 1; i < refreshedData.length; i++) {
            if (idCol !== -1 && String(refreshedData[i][idCol] || '').trim().toLowerCase() === examId.toLowerCase()) {
              if (statusCol !== -1) shEx.getRange(i + 1, statusCol + 1).setValue('active');
              if (sessionStatusCol !== -1) shEx.getRange(i + 1, sessionStatusCol + 1).setValue('active');
              SpreadsheetApp.flush();
              break;
            }
          }
        }
      }
      logAction('EXAM', 'Sesi ujian DILANJUTKAN kembali: ' + examId);
      return jsonResponse({ status: 'success', message: 'Sesi ujian ' + examId + ' berhasil dilanjutkan.' });
    }

    if (action === 'saveQuestions' || action === 'syncQuestions') {
      const examId = String(payload.examId || '').trim();
      const questions = payload.questions || [];
      let shQu = ss.getSheetByName(SHEETS.QUESTIONS);
      let shEx = ss.getSheetByName(SHEETS.EXAMS);
      if (!shQu) {
        initDatabase();
        shQu = ss.getSheetByName(SHEETS.QUESTIONS);
      }
      
      ensureMinColumns(shQu, CANONICAL_QU_HEADERS.length);
      const targetExamId = examId.toLowerCase();
      const existingQuData = shQu.getDataRange().getValues();
      const examIdColIdx = (existingQuData.length > 0 && existingQuData[0].indexOf('examId') !== -1) ? existingQuData[0].indexOf('examId') : 1;
      
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
          typeof q.options === 'string' ? q.options : JSON.stringify((q.matchingPairs && q.matchingPairs.length > 0) ? q.matchingPairs : (q.options || [])),
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

      const rawCombinedRows = [CANONICAL_QU_HEADERS].concat(retainedQuRows).concat(qRows);
      const finalQuRows = normalize2DArray(rawCombinedRows, CANONICAL_QU_HEADERS.length);

      shQu.clearContents();
      SpreadsheetApp.flush();
      shQu.getRange(1, 1, finalQuRows.length, CANONICAL_QU_HEADERS.length).setValues(finalQuRows);
      formatHeaderRow(shQu);
      SpreadsheetApp.flush();

      // Perbarui totalQuestions pada sheet EXAMS jika ada
      if (shEx) {
        const exData = shEx.getDataRange().getValues();
        if (exData.length > 0) {
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
      let sh = ss.getSheetByName(SHEETS.PROFILE);
      if (!sh) {
        initDatabase();
        sh = ss.getSheetByName(SHEETS.PROFILE);
      }
      ensureMinColumns(sh, CANONICAL_PROFILE_HEADERS.length);
      // Selalu perbarui row 1 header agar kolom regionalGovLogoUrl, regionalGovName, regionalGovDepartment tertera jelas di sheet
      sh.getRange(1, 1, 1, CANONICAL_PROFILE_HEADERS.length).setValues([CANONICAL_PROFILE_HEADERS]);
      formatHeaderRow(sh);
      clearAndSetSingleRow(sh, [
        p.name || '',
        p.npsn || '',
        p.address || '',
        p.logoUrl || '',
        p.regionalGovLogoUrl || p.pemkotLogoUrl || '',
        p.regionalGovName || p.pemdaName || '',
        p.regionalGovDepartment || p.opdName || '',
        p.academicYear || '',
        p.semester || 'Ganjil',
        p.principalName || '',
        p.principalNip || '',
        p.teacherName || '',
        p.teacherNip || '',
        p.teacherSubject || '',
        p.teacherEmail || '',
        p.teacherTitle || '',
        new Date().toISOString()
      ]);
      logAction('SYNC', 'Profil sekolah diperbarui: ' + (p.name || ''));
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

    if (action === 'saveChatMessage') {
      const msg = payload.message || payload;
      let shChat = ss.getSheetByName(SHEETS.CHAT);
      if (!shChat) {
        initDatabase();
        shChat = ss.getSheetByName(SHEETS.CHAT);
      }
      ensureMinColumns(shChat, CANONICAL_CHAT_HEADERS.length);
      shChat.appendRow([
        String(msg.id || ('MSG-' + Date.now())),
        String(msg.senderNis || ''),
        String(msg.senderName || ''),
        String(msg.senderRole || 'student'),
        String(msg.targetNis || 'all'),
        String(msg.message || msg.text || ''),
        String(msg.timestamp || new Date().toISOString()),
        String(msg.examId || ''),
        String(msg.status || 'success')
      ]);
      return jsonResponse({ status: 'success', message: 'Pesan chat disimpan di Google Sheets dengan status success' });
    }

    if (action === 'getChatMessages') {
      let shChat = ss.getSheetByName(SHEETS.CHAT);
      if (!shChat) {
        initDatabase();
        shChat = ss.getSheetByName(SHEETS.CHAT);
      }
      const messages = getSheetDataAsObjects(shChat);
      return jsonResponse({ status: 'success', data: messages });
    }

    if (action === 'syncChatMessages') {
      const msgs = payload.messages || [];
      let shChat = ss.getSheetByName(SHEETS.CHAT);
      if (!shChat) {
        initDatabase();
        shChat = ss.getSheetByName(SHEETS.CHAT);
      }
      if (msgs.length > 0) {
        ensureMinColumns(shChat, CANONICAL_CHAT_HEADERS.length);
        const rows = msgs.map(function(m) {
          return [
            String(m.id || ('MSG-' + Utilities.getUuid().slice(0, 8))),
            String(m.senderNis || ''),
            String(m.senderName || ''),
            String(m.senderRole || 'student'),
            String(m.targetNis || 'all'),
            String(m.message || m.text || ''),
            String(m.timestamp || new Date().toISOString()),
            String(m.examId || ''),
            String(m.status || 'success')
          ];
        });
        const lastRow = shChat.getLastRow();
        if (lastRow > 1) {
          shChat.getRange(2, 1, lastRow - 1, CANONICAL_CHAT_HEADERS.length).clearContent();
        }
        shChat.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
      return jsonResponse({ status: 'success', message: msgs.length + ' pesan chat disinkronkan ke Google Sheets' });
    }

    if (action === 'clearChatMessages') {
      let shChat = ss.getSheetByName(SHEETS.CHAT);
      if (shChat) {
        const lastRow = shChat.getLastRow();
        if (lastRow > 1) {
          shChat.getRange(2, 1, lastRow - 1, shChat.getLastColumn()).clearContent();
        }
      }
      return jsonResponse({ status: 'success', message: 'Riwayat chat dibersihkan' });
    }

    if (action === 'syncAll') {
      // Menyinkronkan paket data lengkap dari aplikasi
      if (payload.profile) {
        let shProf = ss.getSheetByName(SHEETS.PROFILE);
        if (!shProf) { initDatabase(); shProf = ss.getSheetByName(SHEETS.PROFILE); }
        ensureMinColumns(shProf, CANONICAL_PROFILE_HEADERS.length);
        shProf.getRange(1, 1, 1, CANONICAL_PROFILE_HEADERS.length).setValues([CANONICAL_PROFILE_HEADERS]);
        formatHeaderRow(shProf);
        clearAndSetSingleRow(shProf, [
          payload.profile.name || '',
          payload.profile.npsn || '',
          payload.profile.address || '',
          payload.profile.logoUrl || '',
          payload.profile.regionalGovLogoUrl || payload.profile.pemkotLogoUrl || '',
          payload.profile.regionalGovName || payload.profile.pemdaName || '',
          payload.profile.regionalGovDepartment || payload.profile.opdName || '',
          payload.profile.academicYear || '',
          payload.profile.semester || 'Ganjil',
          payload.profile.principalName || '',
          payload.profile.principalNip || '',
          payload.profile.teacherName || '',
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

    if (action === 'listClassroomCourses') {
      try {
        if (typeof Classroom === 'undefined') {
          return jsonResponse({ 
            status: 'error', 
            message: 'Layanan Google Classroom belum diaktifkan di Google Apps Script. Buka editor script -> klik tanda (+) di sebelah "Services/Layanan" -> pilih "Google Classroom API" -> simpan.' 
          });
        }
        const resp = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] });
        return jsonResponse({ status: 'success', data: resp.courses || [] });
      } catch (err) {
        return jsonResponse({ status: 'error', message: err.toString() });
      }
    }

    if (action === 'syncToClassroom') {
      try {
        if (typeof Classroom === 'undefined') {
          return jsonResponse({ 
            status: 'error', 
            message: 'Layanan Google Classroom belum diaktifkan di Google Apps Script. Buka editor script -> klik tanda (+) di samping "Services/Layanan" -> pilih "Google Classroom API" -> simpan.' 
          });
        }
        const courseId = payload.courseId;
        const examId = payload.examId;
        const title = payload.assignmentTitle || 'Penilaian Ujian';
        const maxScore = Number(payload.maxScore) || 100;
        const studentGrades = payload.grades || [];

        let courseWorkId = payload.courseWorkId;
        if (!courseWorkId) {
          const newWork = Classroom.Courses.CourseWork.create({
            title: title,
            description: 'Nilai ujian resmi disinkronkan otomatis dari aplikasi ExamFlow Pro.',
            maxPoints: maxScore,
            workType: 'ASSIGNMENT',
            state: 'PUBLISHED'
          }, courseId);
          courseWorkId = newWork.id;
        }

        const studentsResp = Classroom.Courses.Students.list(courseId, { pageSize: 100 });
        const cStudents = studentsResp.students || [];

        const subResp = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, courseWorkId, { pageSize: 100 });
        const cSubmissions = subResp.studentSubmissions || [];

        const subByUserId = {};
        cSubmissions.forEach(function(s) { subByUserId[s.userId] = s; });

        let syncedCount = 0;
        const results = [];

        studentGrades.forEach(function(sg) {
          const normName = String(sg.studentName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const normNo = String(sg.studentNo || '').toLowerCase().trim();

          let matched = null;
          for (let i = 0; i < cStudents.length; i++) {
            const cs = cStudents[i];
            const email = (cs.profile.emailAddress || '').toLowerCase();
            const fullName = String(cs.profile.name.fullName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if ((email && normNo && email.includes(normNo)) || fullName === normName || (normName.length > 3 && fullName.includes(normName))) {
              matched = cs;
              break;
            }
          }

          if (matched && subByUserId[matched.userId]) {
            const sub = subByUserId[matched.userId];
            const scaled = Math.round(((Number(sg.score) || 0) / (Number(sg.maxScore) || 100)) * maxScore * 10) / 10;
            try {
              Classroom.Courses.CourseWork.StudentSubmissions.patch({
                assignedGrade: scaled,
                draftGrade: scaled
              }, courseId, courseWorkId, sub.id, { updateMask: 'assignedGrade,draftGrade' });
              
              if (payload.returnToStudent) {
                try {
                  Classroom.Courses.CourseWork.StudentSubmissions.return({}, courseId, courseWorkId, sub.id);
                } catch(e) {}
              }
              syncedCount++;
              results.push({ studentName: sg.studentName, status: 'synced', grade: scaled });
            } catch (pErr) {
              results.push({ studentName: sg.studentName, status: 'error', error: pErr.toString() });
            }
          } else {
            results.push({ studentName: sg.studentName, status: 'unmatched' });
          }
        });

        return jsonResponse({
          status: 'success',
          syncedCount: syncedCount,
          total: studentGrades.length,
          courseWorkId: courseWorkId,
          details: results
        });
      } catch (err) {
        return jsonResponse({ status: 'error', message: err.toString() });
      }
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

function normalizeGasHeader(h) {
  const raw = String(h || '').trim();
  const clean = raw.toLowerCase().replace(/[\\s_\\-]+/g, '');
  if (['matapelajaran', 'mapel', 'subject'].includes(clean)) return 'subject';
  if (['kelas', 'jenjang', 'fase', 'tingkat', 'grade', 'classgrade'].includes(clean)) return 'grade';
  if (['elemen', 'element', 'materi', 'pokokbahasan'].includes(clean)) return 'element';
  if (['capaianpembelajaran', 'cp', 'learningoutcome', 'kompetensidasar', 'kd'].includes(clean)) return 'learningOutcome';
  if (['tujuanpembelajaran', 'tp', 'learningobjectives', 'learningobjectivesjson', 'daftartp'].includes(clean)) return 'learningObjectivesJson';
  if (['namasiswa', 'studentname', 'nama', 'namalengkap'].includes(clean)) return 'studentName';
  if (['nis', 'nisn', 'nomorinduk', 'studentno'].includes(clean)) return 'studentNo';
  if (['namapaketujian', 'paketujian', 'judulujian', 'examtitle', 'title'].includes(clean)) return 'examTitle';
  if (['namapemerintahdaerah', 'pemda', 'pemkot', 'regionalgovname', 'namapemda', 'namapemkot', 'pemerintahdaerah', 'kotapemerintah', 'pemerintah'].includes(clean)) return 'regionalGovName';
  if (['namadinas', 'opd', 'dinas', 'organisasiperangkatdaerah', 'regionalgovdepartment', 'namaopd', 'perangkatdaerah', 'dinasdanopd'].includes(clean)) return 'regionalGovDepartment';
  if (['logopemda', 'logopemkot', 'regionalgovlogourl', 'urllogopemkot', 'urllogopemda', 'logopemerintahdaerah', 'urllogopemerintahdaerah', 'pemkotlogourl', 'pemdalogourl'].includes(clean)) return 'regionalGovLogoUrl';
  return raw;
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
      const origHeader = String(headers[h] || '').trim();
      const normHeader = normalizeGasHeader(origHeader);
      
      if (
        origHeader.endsWith('Json') || 
        origHeader === 'answersJson' || 
        origHeader === 'optionsJson' || 
        origHeader === 'correctKeyJson' ||
        normHeader === 'learningObjectivesJson'
      ) {
        if (typeof val === 'string' && val.trim().length > 0) {
          try {
            val = JSON.parse(val);
          } catch(e) {
            // Jika bukan JSON valid, parse pemisah baris baru atau titik koma
            if (normHeader === 'learningObjectivesJson') {
              val = val.split(/[\\r\\n;]+/)
                .map(function(s) { return s.replace(/^[\\s\\d\\.\\-\\*•]+/, '').trim(); })
                .filter(Boolean);
            }
          }
        }
      }
      obj[origHeader] = val;
      if (normHeader !== origHeader) {
        obj[normHeader] = val;
      }
    }
    results.push(obj);
  }
  return results;
}

function upsertRow(sheet, keyColumn, keyValue, rowValues) {
  if (!sheet) return;
  ensureMinColumns(sheet, rowValues.length);
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
    if (String(data[i][colIndex] || '').trim() === String(keyValue || '').trim()) {
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

/**
 * Menu Kustom di Google Sheets
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🎓 ExamFlow Pro')
      .addItem('📊 Inisialisasi / Perbaiki Database', 'initDatabase')
      .addSeparator()
      .addItem('🏫 Sinkronkan Nilai ke Google Classroom', 'menuSyncToGoogleClassroom')
      .addItem('📚 Panduan Google Classroom API', 'showClassroomHelpDialog')
      .addToUi();
  } catch(e) {}
}

/**
 * Dialog Interaktif Sinkronisasi Nilai dari Google Sheets ke Google Classroom
 */
function menuSyncToGoogleClassroom() {
  const ui = SpreadsheetApp.getUi();
  if (typeof Classroom === 'undefined') {
    ui.alert(
      '⚠️ Layanan Google Classroom Belum Aktif',
      'Untuk menyinkronkan nilai ujian langsung ke Google Classroom dari spreadsheet:\\n\\n' +
      '1. Di editor Apps Script, lihat panel kiri "Layanan" (Services).\\n' +
      '2. Klik tombol (+) di sebelah Layanan.\\n' +
      '3. Cari dan pilih "Google Classroom API" (versi v1).\\n' +
      '4. Klik tombol "Tambahkan" (Add).\\n' +
      '5. Jalankan kembali menu ini!',
      ui.ButtonSet.OK
    );
    return;
  }

  try {
    const coursesResp = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] });
    const courses = coursesResp.courses || [];
    if (courses.length === 0) {
      ui.alert('Info', 'Tidak ditemukan kelas aktif di akun Google Classroom Anda.', ui.ButtonSet.OK);
      return;
    }

    const courseListText = courses.map(function(c, idx) { return (idx + 1) + '. ' + c.name + ' (ID: ' + c.id + ')'; }).join('\\n');
    const resp = ui.prompt('Pilih Kelas Google Classroom', 'Masukkan nomor kelas tujuan:\\n' + courseListText, ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;

    const choiceIdx = parseInt(resp.getResponseText().trim()) - 1;
    if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= courses.length) {
      ui.alert('Pilihan nomor kelas tidak valid.');
      return;
    }

    const selectedCourse = courses[choiceIdx];
    const taskPrompt = ui.prompt('Judul Tugas di Google Classroom', 'Masukkan judul tugas yang akan dibuat di kelas "' + selectedCourse.name + '":', ui.ButtonSet.OK_CANCEL);
    if (taskPrompt.getSelectedButton() !== ui.Button.OK) return;
    const taskTitle = taskPrompt.getResponseText().trim() || 'Nilai Ujian ExamFlow';

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shRekap = ss.getSheetByName(SHEETS.REKAP) || ss.getSheetByName(SHEETS.SUBMISSIONS);
    if (!shRekap) {
      ui.alert('Sheet Rekap_Nilai tidak ditemukan.');
      return;
    }

    const rekapData = getSheetDataAsObjects(shRekap);
    if (rekapData.length === 0) {
      ui.alert('Belum ada data nilai di sheet Rekap_Nilai.');
      return;
    }

    // Buat CourseWork baru di kelas tujuan
    const newWork = Classroom.Courses.CourseWork.create({
      title: taskTitle,
      description: 'Nilai ujian resmi disinkronkan langsung dari ExamFlow Pro.',
      maxPoints: 100,
      workType: 'ASSIGNMENT',
      state: 'PUBLISHED'
    }, selectedCourse.id);

    const students = Classroom.Courses.Students.list(selectedCourse.id, { pageSize: 100 }).students || [];
    const submissions = Classroom.Courses.CourseWork.StudentSubmissions.list(selectedCourse.id, newWork.id, { pageSize: 100 }).studentSubmissions || [];
    const subMap = {};
    submissions.forEach(function(s) { subMap[s.userId] = s; });

    let count = 0;
    rekapData.forEach(function(r) {
      const sName = String(r.studentName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sScore = Number(r.percentage || r.score || 0);

      let matchedStu = null;
      for (let i = 0; i < students.length; i++) {
        const cName = String(students[i].profile.name.fullName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cName === sName || (sName.length > 3 && cName.includes(sName))) {
          matchedStu = students[i];
          break;
        }
      }

      if (matchedStu && subMap[matchedStu.userId]) {
        try {
          Classroom.Courses.CourseWork.StudentSubmissions.patch({
            assignedGrade: sScore,
            draftGrade: sScore
          }, selectedCourse.id, newWork.id, subMap[matchedStu.userId].id, { updateMask: 'assignedGrade,draftGrade' });
          count++;
        } catch(e) {}
      }
    });

    ui.alert('✅ Berhasil!', 'Berhasil mencantumkan ' + count + ' nilai siswa ke tugas "' + taskTitle + '" di Google Classroom kelas "' + selectedCourse.name + '".', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Error', 'Gagal menyinkronkan ke Google Classroom: ' + err.toString(), ui.ButtonSet.OK);
  }
}

function showClassroomHelpDialog() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📖 Panduan Integrasi Google Classroom',
    'Untuk menghubungkan nilai ujian dengan Google Classroom:\\n\\n' +
    'A. Melalui Aplikasi ExamFlow:\\n' +
    '1. Buka menu Rekap Nilai atau Hasil & Analisis di aplikasi.\\n' +
    '2. Klik tombol "Kirim Nilai ke Google Classroom".\\n' +
    '3. Masuk dengan Akun Google guru Anda.\\n' +
    '4. Pilih kelas dan buat tugas nilai otomatis.\\n\\n' +
    'B. Melalui Google Apps Script:\\n' +
    '1. Buka editor script (Ekstensi -> Apps Script).\\n' +
    '2. Di panel kiri, klik tombol (+) di sebelah "Services/Layanan".\\n' +
    '3. Pilih "Google Classroom API" (versi v1) -> Tambahkan.\\n' +
    '4. Menu "🎓 ExamFlow Pro -> 🏫 Sinkronkan Nilai ke Google Classroom" siap digunakan langsung di Google Sheets!',
    ui.ButtonSet.OK
  );
}
`;
