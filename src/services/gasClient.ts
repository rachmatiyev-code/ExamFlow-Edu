import { StorageService } from './storage';
import { Exam, Question, SchoolProfile, Submission, Student, UserAccount, CurriculumItem } from '../types';
import { detectMediaType } from './mediaHelper';

export interface PingResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  spreadsheetName?: string;
  error?: string;
}

export class GasClient {
  private static getWebAppUrl(): string {
    return StorageService.getSettings().gasWebAppUrl.trim();
  }

  /**
   * Helper internal untuk mem-parse respons dari Google Apps Script secara aman.
   * Mengantisipasi kasus Google Login redirect, Sheets link biasa, 404 Vercel, dsb.
   */
  private static async safeParseGasResponse(res: Response): Promise<{ isJson: boolean; data: any; errorMessage?: string }> {
    try {
      const rawText = await res.text();
      try {
        const data = JSON.parse(rawText);
        return { isJson: true, data };
      } catch {
        // Analisis konten non-JSON untuk memberikan diagnosis yang ramah pengguna
        if (rawText.includes('accounts.google.com') || rawText.includes('Sign in') || rawText.includes('ServiceLogin')) {
          return {
            isJson: false,
            data: null,
            errorMessage: 'Google Apps Script meminta otentikasi login. Pastikan saat Deploy memilih "Who has access: Anyone" (Siapa saja, termasuk anonim).'
          };
        }
        if (rawText.includes('docs.google.com/spreadsheets') || rawText.includes('Spreadsheet')) {
          return {
            isJson: false,
            data: null,
            errorMessage: 'URL yang dimasukkan adalah link Spreadsheet Google biasa, bukan URL Web App. Deploy script melalui Ekstensi > Apps Script > Deploy > New Deployment > Web App, lalu salin URL /exec.'
          };
        }
        if (res.status === 404 || rawText.includes('The page could not be found') || rawText.includes('Not Found')) {
          return {
            isJson: false,
            data: null,
            errorMessage: 'URL Web App tidak ditemukan (HTTP 404). Pastikan URL berakhiran /exec dan tidak ada karakter yang terpotong.'
          };
        }
        return {
          isJson: false,
          data: null,
          errorMessage: `Respons dari server bukan JSON yang valid (HTTP ${res.status}). Pastikan script telah dideploy sebagai Web App.`
        };
      }
    } catch (e: any) {
      return {
        isJson: false,
        data: null,
        errorMessage: `Koneksi gagal: ${e?.message || 'Tidak dapat menghubungi server'}`
      };
    }
  }

  /**
   * Menguji konektivitas ke Google Apps Script Web App
   */
  static async ping(customUrl?: string): Promise<PingResult> {
    const url = (customUrl || this.getWebAppUrl()).trim();
    if (!url) {
      return {
        success: false,
        message: 'URL Google Apps Script belum diisi.',
        error: 'EMPTY_URL'
      };
    }

    const startTime = performance.now();
    try {
      const pingUrl = `${url}${url.includes('?') ? '&' : '?'}action=ping&_t=${Date.now()}`;
      StorageService.addLog('NETWORK', `Mencoba ping ke Google Apps Script: ${url.substring(0, 45)}...`);

      const response = await fetch(pingUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const { isJson, data, errorMessage } = await this.safeParseGasResponse(response);

      if (!isJson || !data) {
        throw new Error(errorMessage || `Respons server tidak valid (HTTP ${response.status})`);
      }

      if (data.status === 'success') {
        StorageService.addLog(
          'SYNC',
          `Ping berhasil! Terhubung ke spreadsheet "${data.spreadsheetName || 'Aktif'}" (${latencyMs}ms)`,
          JSON.stringify(data),
          'success'
        );
        return {
          success: true,
          message: data.message || 'Koneksi aktif dan responsif.',
          latencyMs,
          spreadsheetName: data.spreadsheetName
        };
      } else {
        throw new Error(data.message || 'Respons GAS berstatus error');
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errMsg = err?.message || String(err);
      StorageService.addLog(
        'NETWORK',
        `Koneksi ke Google Apps Script gagal (${latencyMs}ms): ${errMsg}`,
        'Tips: Pastikan Web App dideploy dengan opsi "Who has access: Anyone" (Siapa saja, termasuk anonim).',
        'error'
      );
      return {
        success: false,
        message: `Gagal menghubungi Google Apps Script: ${errMsg}`,
        latencyMs,
        error: errMsg
      };
    }
  }

  /**
   * Mengambil seluruh data dari Google Sheets (Pull Sync)
   */
  static async fetchAllFromSheets(): Promise<{ success: boolean; message: string; count?: number }> {
    const url = this.getWebAppUrl();
    if (!url) {
      return { success: false, message: 'URL Google Apps Script belum disetel di Pengaturan.' };
    }

    try {
      StorageService.addLog('SYNC', 'Memulai sinkronisasi data dari Google Sheets...');
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=getAllData&_t=${Date.now()}`;
      
      let data: any = null;

      // 1. Coba lewat proxy serverless backend (bebas dari batasan CORS browser dan redirect Google 302)
      try {
        const proxyRes = await fetch('/api/gas-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: fetchUrl, payload: { action: 'getAllData' } })
        });
        if (proxyRes.ok) {
          const proxyJson = await proxyRes.json();
          if (proxyJson && (proxyJson.status === 'success' || proxyJson.data)) {
            data = proxyJson;
          }
        }
      } catch {
        // Fallback ke direct browser fetch jika proxy tidak tersedia
      }

      // 2. Direct browser fetch jika proxy tidak mengembalikan data
      if (!data) {
        const res = await fetch(fetchUrl);
        const parsed = await this.safeParseGasResponse(res);
        if (!parsed.isJson || !parsed.data) {
          throw new Error(parsed.errorMessage || `Respons dari Google Sheets tidak valid (HTTP ${res.status})`);
        }
        data = parsed.data;
      }

      if (data.status !== 'success' || !data.data) {
        throw new Error(data.message || 'Data tidak ditemukan dalam respons Google Sheets');
      }

      const { profile, exams, questions, students, submissions, users, curriculum } = data.data;
      let count = 0;

      if (profile && profile.name) {
        StorageService.saveProfile(profile);
      }
      if (Array.isArray(exams) && exams.length > 0) {
        StorageService.saveExams(exams);
        count += exams.length;
      }
      if (Array.isArray(questions) && questions.length > 0) {
        const normalizedQuestions: Question[] = questions.map((q: any, idx: number) => {
          let opts: any = q.options;
          if ((!opts || !Array.isArray(opts) || opts.length === 0) && q.optionsJson) {
            try {
              opts = typeof q.optionsJson === 'string' ? JSON.parse(q.optionsJson) : q.optionsJson;
            } catch {
              opts = [];
            }
          }
          let corrKey: any = q.correctKey;
          if (!corrKey && q.correctKeyJson) {
            try {
              corrKey = typeof q.correctKeyJson === 'string' ? JSON.parse(q.correctKeyJson) : q.correctKeyJson;
            } catch {
              corrKey = q.correctKeyJson;
            }
          }
          return {
            id: String(q.id || `Q-${Date.now()}-${idx + 1}`),
            examId: String(q.examId || ''),
            order: Number(q.order || idx + 1),
            prompt: String(q.prompt || ''),
            type: q.type || 'multiple_choice',
            mediaType: (q.mediaUrl && (!q.mediaType || q.mediaType === 'none')) 
              ? detectMediaType(q.mediaUrl, 'image') 
              : (q.mediaType || 'none'),
            mediaUrl: q.mediaUrl || '',
            options: Array.isArray(opts) ? opts : [],
            correctKey: corrKey || 'opt_a',
            points: Number(q.points || 10),
            explanation: q.explanation || '',
            bloomLevel: q.bloomLevel,
            soloLevel: q.soloLevel,
            basicCompetency: q.basicCompetency || '',
            indicator: q.indicator || '',
            learningObjective: q.learningObjective || ''
          };
        });
        // Gabungkan soal dari server dengan soal lokal secara cerdas (tanpa soal dummy)
        const cleanNormalized = normalizedQuestions.filter(q => !StorageService.isDummyQuestion(q.id));
        const existingQs = StorageService.getQuestions().filter(q => !StorageService.isDummyQuestion(q.id));
        const qMap = new Map<string, Question>();
        existingQs.forEach(q => qMap.set(q.id, q));
        cleanNormalized.forEach(q => qMap.set(q.id, q));
        StorageService.saveQuestions(Array.from(qMap.values()));
      }
      if (Array.isArray(students)) {
        // Cek secara cerdas agar data siswa guru tidak pernah tertimpa dummy
        const localStudents = StorageService.getStudents();
        const dummyNisList = ['1001', '1002', '1003', '1004', '1005', '1006'];
        const isRemotePurelyDummy = students.length > 0 && students.every(s => dummyNisList.includes(String(s.studentNo).trim()));
        const isLocalCustom = localStudents.some(s => !dummyNisList.includes(String(s.studentNo).trim()));

        if (isRemotePurelyDummy && isLocalCustom) {
          // Sheets masih berisi data dummy awal, sedangkan aplikasi memiliki data siswa asli dari guru.
          // Pertahankan data siswa lokal dan otomatis push ke Sheets agar spreadsheet terisi data sebenarnya!
          StorageService.addLog('SYNC', 'Data siswa aktual lokal diprioritaskan & otomatis disimpan ke Google Sheets.');
          await this.pushStudents(localStudents);
        } else if (students.length > 0) {
          const sanitized = students.map(s => ({
            ...s,
            studentNo: String(s.studentNo || '').trim(),
            fullName: String(s.fullName || '').trim(),
            classGrade: String(s.classGrade || '').trim() || 'X Umum',
            status: s.status || 'active'
          }));
          StorageService.saveStudents(sanitized);
        } else if (localStudents.length > 0 && isLocalCustom) {
          await this.pushStudents(localStudents);
        }
      }
      if (Array.isArray(submissions) && submissions.length > 0) {
        const normalizedSubmissions: Submission[] = submissions.map((s: any) => {
          let ans: any = s.answers;
          if (!ans && s.answersJson) {
            try {
              ans = typeof s.answersJson === 'string' ? JSON.parse(s.answersJson) : s.answersJson;
            } catch {
              ans = {};
            }
          }
          if (typeof ans === 'string') {
            try { ans = JSON.parse(ans); } catch { ans = {}; }
          }
          return {
            id: String(s.id || `SUB-${Date.now()}`),
            examId: String(s.examId || ''),
            studentNo: String(s.studentNo || ''),
            studentName: String(s.studentName || ''),
            classGrade: String(s.classGrade || ''),
            answers: typeof ans === 'object' && ans !== null ? ans : {},
            score: Number(s.score) || 0,
            maxScore: Number(s.maxScore) || 100,
            percentage: Number(s.percentage) || 0,
            passed: s.passed === true || s.passed === 'true' || s.passed === 'TRUE' || (Number(s.percentage) >= 75),
            submittedAt: String(s.submittedAt || new Date().toISOString()),
            tabSwitchCount: Number(s.tabSwitchCount) || 0,
            timeSpentSeconds: Number(s.timeSpentSeconds) || 0,
            syncStatus: 'synced',
            feedback: String(s.feedback || '')
          };
        });
        // Selalu bersihkan submission dummy dari hasil sync
        const cleanRemoteSubs = normalizedSubmissions.filter(s => !StorageService.isDummySubmission(s.id));
        const existingSubs = StorageService.getSubmissions().filter(s => !StorageService.isDummySubmission(s.id));
        const subMap = new Map<string, Submission>();
        existingSubs.forEach(sub => subMap.set(sub.id, sub));
        cleanRemoteSubs.forEach(sub => subMap.set(sub.id, sub));
        StorageService.saveSubmissions(Array.from(subMap.values()));
      }
      if (Array.isArray(users)) {
        // Cek cerdas agar data akun pengguna asli guru tidak tertimpa atau tercampur akun dummy
        const localUsers = StorageService.getUsers().filter(u => !StorageService.isDummyUser(u.id) && !StorageService.isDummyUser(u.username));
        const remoteCleanUsers = users.filter((u: any) => !StorageService.isDummyUser(u.id) && !StorageService.isDummyUser(u.username));

        if (remoteCleanUsers.length > 0) {
          const uMap = new Map<string, UserAccount>();
          localUsers.forEach(u => uMap.set(u.username.toLowerCase(), u));
          remoteCleanUsers.forEach((u: any) => {
            const username = String(u.username || '').trim();
            if (username) {
              uMap.set(username.toLowerCase(), {
                id: String(u.id || `USR-${Date.now()}`),
                username,
                password: String(u.password || 'password123'),
                fullName: String(u.fullName || username),
                role: (u.role === 'admin' ? 'admin' : 'teacher'),
                email: String(u.email || ''),
                active: u.active !== false && u.active !== 'false'
              });
            }
          });
          StorageService.saveUsers(Array.from(uMap.values()));
        } else if (localUsers.length > 0) {
          // Sheets masih kosong atau hanya punya dummy, push akun lokal asli ke Sheets
          await this.pushUsers(localUsers);
        }
      }

      if (Array.isArray(curriculum) && curriculum.length > 0) {
        const parsedCurriculum: CurriculumItem[] = curriculum.map((c: any) => {
          let tps = c.learningObjectives;
          if ((!tps || !Array.isArray(tps)) && c.learningObjectivesJson) {
            try {
              tps = typeof c.learningObjectivesJson === 'string' ? JSON.parse(c.learningObjectivesJson) : c.learningObjectivesJson;
            } catch {
              tps = [];
            }
          }
          return {
            id: String(c.id || `CUR-${Date.now()}`),
            subject: String(c.subject || ''),
            grade: String(c.grade || ''),
            element: String(c.element || ''),
            learningOutcome: String(c.learningOutcome || ''),
            learningObjectives: Array.isArray(tps) ? tps : [],
            updatedAt: String(c.updatedAt || new Date().toISOString())
          };
        });
        StorageService.saveCurriculum(parsedCurriculum);
      }

      StorageService.addLog('SYNC', `Sinkronisasi sukses! Data berhasil dimuat dari Google Sheets.`, undefined, 'success');
      return {
        success: true,
        message: 'Data berhasil disinkronkan dari Google Sheets!',
        count
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      StorageService.addLog('SYNC', `Gagal memuat data dari Google Sheets: ${errMsg}`, undefined, 'error');
      return {
        success: false,
        message: `Gagal sinkronisasi: ${errMsg}`
      };
    }
  }

  /**
   * Helper pengiriman POST ke Google Apps Script dengan proxy backend fallback
   */
  static async postToGas(payload: any): Promise<{ success: boolean; data?: any; message: string }> {
    const url = this.getWebAppUrl();
    if (!url) {
      return { success: false, message: 'URL Google Apps Script belum disetel di Pengaturan.' };
    }

    // 1. Coba lewat backend proxy /api/gas-proxy terlebih dahulu untuk mengatasi pembatasan CORS browser
    try {
      const proxyRes = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, payload })
      });
      if (proxyRes.ok) {
        const json = await proxyRes.json();
        if (json && (json.status === 'success' || json.success)) {
          return { success: true, data: json, message: json.message || 'Sukses dikirim ke Google Sheets' };
        }
      }
    } catch {
      // Backend proxy route belum aktif / offline, lanjutkan ke direct client fetch
    }

    // 2. Direct browser fetch ke URL Web App GAS
    try {
      const directRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const { isJson, data, errorMessage } = await this.safeParseGasResponse(directRes);
      if (isJson && data && data.status === 'success') {
        return { success: true, data, message: data.message || 'Sukses dikirim ke Google Sheets' };
      }
      return { 
        success: false, 
        message: data?.message || errorMessage || `Gagal kirim ke Google Sheets (HTTP ${directRes.status})` 
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menghubungi Google Apps Script' };
    }
  }

  /**
   * Mengirim jawaban ujian siswa ke Google Sheets
   */
  static async submitAnswer(submission: Submission): Promise<{ success: boolean; message: string }> {
    const url = this.getWebAppUrl();
    
    // Simpan ke storage lokal terlebih dahulu
    StorageService.addSubmission(submission);

    if (!url) {
      StorageService.addLog('SYNC', `Disimpan secara offline. Jawaban ${submission.studentName} akan dikirim saat Web App terhubung.`, undefined, 'warn');
      return {
        success: true,
        message: 'Jawaban tersimpan offline di perangkat. Akan otomatis disinkronkan saat terhubung.'
      };
    }

    try {
      const res = await this.postToGas({
        action: 'saveSubmission',
        submission: {
          ...submission,
          syncStatus: 'synced'
        }
      });

      if (!res.success) {
        throw new Error(res.message);
      }

      StorageService.markSubmissionSynced(submission.id);
      StorageService.addLog('SYNC', `Jawaban siswa ${submission.studentName} berhasil dikirim ke Google Sheets!`, undefined, 'success');

      return {
        success: true,
        message: 'Jawaban berhasil dikirim dan tersimpan di Google Sheets!'
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      StorageService.addLog('SYNC', `Koneksi Google Sheets terputus saat kirim jawaban: ${errMsg}. Jawaban tetap aman di antrean offline.`, undefined, 'warn');
      return {
        success: true,
        message: 'Tersimpan di memori offline perangkat. Akan disinkronkan otomatis begitu jaringan stabil.'
      };
    }
  }

  /**
   * Menyimpan atau memperbarui ujian & soal ke Google Sheets
   */
  static async pushExam(exam: Exam, questions: Question[]): Promise<{ success: boolean; message: string }> {
    // Simpan ke lokal dulu dengan jumlah soal aktual
    const updatedExam: Exam = {
      ...exam,
      totalQuestions: questions.length
    };
    StorageService.upsertExam(updatedExam);
    StorageService.saveQuestionsForExam(updatedExam.id, questions);

    const url = this.getWebAppUrl();
    if (!url) {
      return {
        success: true,
        message: 'Ujian berhasil disimpan secara lokal (Web App URL belum disetel).'
      };
    }

    try {
      const res = await this.postToGas({
        action: 'saveExam',
        exam: updatedExam,
        questions
      });

      if (!res.success) throw new Error(res.message);
      StorageService.addLog('SYNC', `Ujian "${updatedExam.title}" (${questions.length} butir soal) berhasil disinkronkan ke Google Sheets!`, undefined, 'success');
      return { success: true, message: `Ujian dan ${questions.length} butir soal berhasil disinkronkan ke Google Sheets!` };
    } catch (err: any) {
      StorageService.addLog('SYNC', `Gagal push ujian ke Google Sheets: ${err?.message}. Data tetap aman di lokal.`, undefined, 'warn');
      return { success: true, message: 'Ujian tersimpan di lokal. Sinkronkan ke Google Sheets nanti setelah koneksi siap.' };
    }
  }

  /**
   * Menghapus ujian dari Google Sheets & lokal
   */
  static async deleteExam(examId: string): Promise<{ success: boolean; message: string }> {
    StorageService.deleteExam(examId);

    const url = this.getWebAppUrl();
    if (!url) return { success: true, message: 'Ujian dihapus dari penyimpanan lokal.' };

    try {
      await this.postToGas({ action: 'deleteExam', examId });
      StorageService.addLog('SYNC', `Ujian ${examId} dihapus dari Google Sheets`, undefined, 'info');
      return { success: true, message: 'Ujian berhasil dihapus dari Google Sheets.' };
    } catch {
      return { success: true, message: 'Ujian dihapus dari lokal (Google Sheets offline).' };
    }
  }

  /**
   * Menyimpan Profil Sekolah ke Google Sheets
   */
  static async pushSchoolProfile(profile: SchoolProfile): Promise<{ success: boolean; message: string }> {
    StorageService.saveProfile(profile);
    const url = this.getWebAppUrl();
    if (!url) return { success: true, message: 'Profil disimpan di lokal.' };

    try {
      const res = await this.postToGas({ action: 'saveSchoolProfile', profile });
      if (!res.success) throw new Error(res.message);
      StorageService.addLog('SYNC', `Profil sekolah berhasil diperbarui di Google Sheets!`, undefined, 'success');
      return { success: true, message: 'Profil sekolah tersimpan di Google Sheets!' };
    } catch (err: any) {
      StorageService.addLog('SYNC', `Gagal simpan profil ke Google Sheets: ${err?.message}`, undefined, 'warn');
      return { success: true, message: 'Profil tersimpan di lokal (Sheets belum terhubung).' };
    }
  }

  /**
   * Menyimpan dan menyinkronkan seluruh daftar siswa ke Google Sheets
   */
  static async pushStudents(students: Student[]): Promise<{ success: boolean; message: string; count?: number }> {
    StorageService.saveStudents(students);
    const url = this.getWebAppUrl();
    if (!url) {
      return { 
        success: true, 
        message: 'Data siswa tersimpan di lokal (atur URL Google Apps Script di Pengaturan untuk sync otomatis).', 
        count: students.length 
      };
    }

    try {
      StorageService.addLog('SYNC', `Mengirim ${students.length} data siswa ke Google Sheets...`);
      
      // 1. Coba action standar 'saveStudents'
      let res = await this.postToGas({ action: 'saveStudents', students });
      
      // 2. Jika Google Apps Script di spreadsheet masih deployment versi lama yang belum mengenal 'saveStudents',
      // fallback coba panggil action 'syncAll'
      if (!res.success && res.message && (res.message.includes('tidak dikenal') || res.message.includes('saveStudents'))) {
        StorageService.addLog('SYNC', 'Mencoba fallback action syncAll untuk data siswa...');
        res = await this.postToGas({ action: 'syncAll', students });
      }

      if (!res.success) {
        if (res.message && res.message.includes('tidak dikenal')) {
          const detail = 'Kode Google Apps Script di Spreadsheet Anda perlu diperbarui ke versi terbaru. Buka menu Pengaturan > "Salin Kode Backend Apps Script", lalu di script.google.com klik Deploy > Manage Deployments > Edit (ikon pensil) > Version: New version > Deploy.';
          StorageService.addLog('SYNC', detail, undefined, 'error');
          throw new Error(detail);
        }
        throw new Error(res.message || 'Gagal menyimpan siswa ke Google Sheets.');
      }

      StorageService.addLog('SYNC', `Berhasil menyimpan ${students.length} data siswa ke Google Sheets!`, undefined, 'success');
      return {
        success: true,
        message: res.message || `Berhasil menyimpan ${students.length} siswa ke Google Sheets!`,
        count: students.length
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      StorageService.addLog('SYNC', `Gagal mengirim data siswa ke Google Sheets: ${errMsg}`, undefined, 'warn');
      return { success: false, message: errMsg };
    }
  }

  /**
   * Menyimpan dan menyinkronkan daftar akun pengguna / guru / admin ke Google Sheets
   */
  static async pushUsers(users: UserAccount[]): Promise<{ success: boolean; message: string; count?: number }> {
    // Filter akun dummy agar tidak pernah terkirim ke spreadsheet
    const cleanUsers = users.filter(u => !StorageService.isDummyUser(u.id) && !StorageService.isDummyUser(u.username));
    StorageService.saveUsers(cleanUsers.length > 0 ? cleanUsers : users);

    const url = this.getWebAppUrl();
    if (!url) {
      return { 
        success: true, 
        message: 'Data akun pengguna tersimpan di lokal (atur URL Google Apps Script di Pengaturan untuk sync otomatis).', 
        count: cleanUsers.length 
      };
    }

    try {
      StorageService.addLog('SYNC', `Mengirim ${cleanUsers.length} data akun pengguna ke Google Sheets...`);
      let res = await this.postToGas({ action: 'saveUsers', users: cleanUsers });
      if (!res.success && res.message && res.message.includes('tidak dikenal')) {
        res = await this.postToGas({ action: 'syncUsers', users: cleanUsers });
      }

      if (!res.success) {
        if (res.message && res.message.includes('tidak dikenal')) {
          const guidance = 'Akun berhasil disimpan di lokal browser. Namun Google Apps Script di Spreadsheet Anda belum diperbarui ke versi terbaru. Silakan buka tab Pengaturan > Salin Kode Apps Script > Deploy Versi Baru (New Deployment) di Google Sheets.';
          StorageService.addLog('SYNC', guidance, undefined, 'warn');
          return {
            success: false,
            message: guidance
          };
        }
        throw new Error(res.message || 'Gagal menyimpan akun ke Google Sheets.');
      }

      StorageService.addLog('SYNC', `Berhasil menyimpan ${cleanUsers.length} akun pengguna ke Google Sheets!`, undefined, 'success');
      return {
        success: true,
        message: res.message || `Berhasil menyimpan ${cleanUsers.length} akun pengguna ke Google Sheets!`,
        count: cleanUsers.length
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      StorageService.addLog('SYNC', `Penyimpanan akun: ${errMsg}`, undefined, 'warn');
      return { success: false, message: errMsg };
    }
  }

  /**
   * Menyimpan dan menyinkronkan daftar Capaian Pembelajaran, Elemen & Tujuan Pembelajaran ke Google Sheets
   */
  static async pushCurriculum(items: CurriculumItem[]): Promise<{ success: boolean; message: string; count?: number }> {
    StorageService.saveCurriculum(items);
    const url = this.getWebAppUrl();
    if (!url) {
      return {
        success: true,
        message: 'Data kurikulum (CP/Elemen/TP) tersimpan di lokal (atur URL Google Apps Script di Pengaturan untuk sync otomatis).',
        count: items.length
      };
    }

    try {
      StorageService.addLog('SYNC', `Mengirim ${items.length} elemen CP & TP kurikulum ke Google Sheets...`);
      let res = await this.postToGas({ action: 'saveCurriculum', curriculum: items });
      if (!res.success && res.message && res.message.includes('tidak dikenal')) {
        res = await this.postToGas({ action: 'syncCurriculum', curriculum: items });
      }

      if (!res.success) {
        throw new Error(res.message || 'Gagal menyimpan kurikulum ke Google Sheets.');
      }

      StorageService.addLog('SYNC', `Berhasil menyimpan ${items.length} kurikulum (CP/Elemen/TP) ke Google Sheets!`, undefined, 'success');
      return {
        success: true,
        message: res.message || `Berhasil menyimpan ${items.length} data CP/TP ke Google Sheets!`,
        count: items.length
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      StorageService.addLog('SYNC', `Penyimpanan kurikulum: ${errMsg}. Data tetap aman di memori lokal.`, undefined, 'warn');
      return { success: false, message: errMsg };
    }
  }

  /**
   * Flush semua antrean jawaban offline yang belum tersinkronkan
   */
  static async flushPendingSubmissions(): Promise<{ syncedCount: number; errors: number }> {
    const pending = StorageService.getPendingSync();
    if (pending.length === 0) return { syncedCount: 0, errors: 0 };

    const url = this.getWebAppUrl();
    if (!url) return { syncedCount: 0, errors: pending.length };

    let synced = 0;
    let errors = 0;

    for (const sub of pending) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveSubmission', submission: { ...sub, syncStatus: 'synced' } })
        });
        if (res.ok) {
          StorageService.markSubmissionSynced(sub.id);
          synced++;
        } else {
          errors++;
        }
      } catch (e) {
        errors++;
      }
    }

    if (synced > 0) {
      StorageService.addLog('SYNC', `${synced} jawaban dari antrean offline berhasil disinkronkan ke Google Sheets!`, undefined, 'success');
    }

    return { syncedCount: synced, errors };
  }
}
