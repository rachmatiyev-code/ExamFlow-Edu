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
  USERS: 'Users',
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
      'SMA Negeri 1 Nusantara',
      '20104050',
      'Jl. Pendidikan No. 45, Jakarta Pusat',
      'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=200&auto=format&fit=crop&q=80',
      '2026/2027',
      'Ganjil',
      'Dr. H. Sulaiman, M.Pd.',
      '19750812 200003 1 002',
      'Siti Rahmawati, S.Pd.',
      '19820514 200801 2 009',
      'Biologi & Sains Terapan',
      'siti.rahmawati@sekolah.sch.id',
      'Koordinator Kurikulum & Guru Mata Pelajaran',
      new Date().toISOString()
    ]);
    formatHeaderRow(shProfile);
  }

  // 2. Exams
  let shExams = ss.getSheetByName(SHEETS.EXAMS);
  if (!shExams) {
    shExams = ss.insertSheet(SHEETS.EXAMS);
    shExams.appendRow(['id', 'title', 'subject', 'grade', 'durationMinutes', 'passingScore', 'isStrict', 'allowReview', 'startsAt', 'endsAt', 'status', 'totalQuestions', 'token', 'instructions', 'createdAt', 'redeployCount']);
    formatHeaderRow(shExams);
  }

  // 3. Questions
  let shQuestions = ss.getSheetByName(SHEETS.QUESTIONS);
  if (!shQuestions) {
    shQuestions = ss.insertSheet(SHEETS.QUESTIONS);
    shQuestions.appendRow(['id', 'examId', 'order', 'prompt', 'type', 'mediaType', 'mediaUrl', 'optionsJson', 'correctKeyJson', 'points', 'explanation', 'bloomLevel', 'soloLevel', 'basicCompetency', 'indicator']);
    formatHeaderRow(shQuestions);
  }

  // 4. Students
  let shStudents = ss.getSheetByName(SHEETS.STUDENTS);
  if (!shStudents) {
    shStudents = ss.insertSheet(SHEETS.STUDENTS);
    shStudents.appendRow(['id', 'studentNo', 'fullName', 'classGrade', 'email', 'phone', 'status']);
    formatHeaderRow(shStudents);
  }

  // 5. Submissions
  let shSubmissions = ss.getSheetByName(SHEETS.SUBMISSIONS);
  if (!shSubmissions) {
    shSubmissions = ss.insertSheet(SHEETS.SUBMISSIONS);
    shSubmissions.appendRow(['id', 'examId', 'studentNo', 'studentName', 'classGrade', 'answersJson', 'score', 'maxScore', 'percentage', 'passed', 'submittedAt', 'tabSwitchCount', 'timeSpentSeconds', 'feedback']);
    formatHeaderRow(shSubmissions);
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
        users: getSheetDataAsObjects(ss.getSheetByName(SHEETS.USERS))
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

    const action = payload.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'init') {
      initDatabase();
      return jsonResponse({ status: 'success', message: 'Inisialisasi database berhasil' });
    }

    if (action === 'saveSubmission') {
      const sub = payload.submission;
      const sh = ss.getSheetByName(SHEETS.SUBMISSIONS);
      if (!sh) initDatabase();
      
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
        sub.feedback || ''
      ]);
      
      logAction('SYNC', 'Jawaban ujian disimpan: ' + sub.studentName + ' (Nilai: ' + sub.percentage + '%)');
      return jsonResponse({ status: 'success', message: 'Jawaban tersimpan di Google Sheets', submissionId: sub.id });
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
        exam.createdAt || new Date().toISOString(),
        exam.redeployCount || 0
      ]);

      // Hapus soal lama dari ujian ini lalu masukkan ulang
      deleteRowsByColumnValue(shQu, 'examId', exam.id);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        shQu.appendRow([
          q.id,
          exam.id,
          i + 1,
          q.prompt,
          q.type,
          q.mediaType || 'none',
          q.mediaUrl || '',
          JSON.stringify(q.options || []),
          JSON.stringify(q.correctKey || ''),
          q.points || 10,
          q.explanation || '',
          q.bloomLevel || '',
          q.soloLevel || '',
          q.basicCompetency || '',
          q.indicator || ''
        ]);
      }

      logAction('EXAM', 'Ujian disimpan: ' + exam.title + ' (' + questions.length + ' soal)');
      return jsonResponse({ status: 'success', message: 'Ujian dan soal berhasil diperbarui' });
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
  
  // Hapus dari baris terbawah ke atas
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][colIndex] === keyValue) {
      sheet.deleteRow(i + 1);
    }
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
