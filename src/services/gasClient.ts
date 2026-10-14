import { StorageService } from './storage';
import { Exam, Question, SchoolProfile, Submission } from '../types';

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
      
      const res = await fetch(fetchUrl);
      const { isJson, data, errorMessage } = await this.safeParseGasResponse(res);

      if (!isJson || !data) {
        throw new Error(errorMessage || `Respons dari Google Sheets tidak valid (HTTP ${res.status})`);
      }

      if (data.status !== 'success' || !data.data) {
        throw new Error(data.message || 'Data tidak ditemukan dalam respons Google Sheets');
      }

      const { profile, exams, questions, students, submissions, users } = data.data;
      let count = 0;

      if (profile && profile.name) {
        StorageService.saveProfile(profile);
      }
      if (Array.isArray(exams) && exams.length > 0) {
        StorageService.saveExams(exams);
        count += exams.length;
      }
      if (Array.isArray(questions) && questions.length > 0) {
        StorageService.saveQuestions(questions);
      }
      if (Array.isArray(students) && students.length > 0) {
        StorageService.saveStudents(students);
      }
      if (Array.isArray(submissions) && submissions.length > 0) {
        StorageService.saveSubmissions(submissions);
      }
      if (Array.isArray(users) && users.length > 0) {
        StorageService.saveUsers(users);
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
      const payload = {
        action: 'saveSubmission',
        submission: {
          ...submission,
          syncStatus: 'synced'
        }
      };

      // POST langsung dengan text/plain untuk bypass preflight CORS
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
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
    // Simpan ke lokal dulu
    StorageService.upsertExam(exam);
    StorageService.saveQuestionsForExam(exam.id, questions);

    const url = this.getWebAppUrl();
    if (!url) {
      return {
        success: true,
        message: 'Ujian berhasil disimpan secara lokal (Web App URL belum disetel).'
      };
    }

    try {
      const payload = {
        action: 'saveExam',
        exam,
        questions
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      StorageService.addLog('SYNC', `Ujian "${exam.title}" berhasil disinkronkan ke Google Sheets!`, undefined, 'success');
      return { success: true, message: 'Ujian dan soal berhasil disinkronkan ke Google Sheets!' };
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
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteExam', examId })
      });
      StorageService.addLog('SYNC', `Ujian ${examId} dihapus dari Google Sheets`, undefined, 'info');
      return { success: true, message: 'Ujian berhasil dihapus dari Google Sheets.' };
    } catch (e) {
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
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveSchoolProfile', profile })
      });
      StorageService.addLog('SYNC', `Profil sekolah berhasil diperbarui di Google Sheets!`, undefined, 'success');
      return { success: true, message: 'Profil sekolah tersimpan di Google Sheets!' };
    } catch (err: any) {
      StorageService.addLog('SYNC', `Gagal simpan profil ke Google Sheets: ${err?.message}`, undefined, 'warn');
      return { success: true, message: 'Profil tersimpan di lokal (Sheets belum terhubung).' };
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
