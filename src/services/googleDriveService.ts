import { getAccessToken, googleSignIn, setCachedAccessToken } from './googleAuth';
import { GasClient } from './gasClient';
import { StorageService } from './storage';
import { svgToPng, dataUrlToBlob } from './illustrationRenderer';

export const APP_DATA_BACKUP_FOLDER_NAME = 'ExamFlow Edu - Data & Backup';
export const QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME = 'Ilustrasi_Soal_AI';

export interface DriveUploadResult {
  success: boolean;
  mediaUrl: string;
  fileId?: string;
  folderPath: string;
  storageMode: 'gdrive_oauth' | 'gdrive_gas' | 'local_png';
  message: string;
}

export class GoogleDriveService {
  private static readonly DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
  private static readonly DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

  private static async safeParseResponse(res: Response): Promise<{ isJson: boolean; data: any; rawText: string }> {
    try {
      const rawText = await res.text();
      try {
        const data = JSON.parse(rawText);
        return { isJson: true, data, rawText };
      } catch {
        return { isJson: false, data: null, rawText };
      }
    } catch (e: any) {
      return { isJson: false, data: null, rawText: e?.message || '' };
    }
  }

  static async isOAuthConnected(): Promise<boolean> {
    const token = await getAccessToken();
    return Boolean(token);
  }

  static async connectGoogleDrive(): Promise<string> {
    const existing = await getAccessToken();
    if (existing) return existing;
    const res = await googleSignIn();
    if (!res?.accessToken) {
      throw new Error('Gagal menghubungkan akun Google Drive.');
    }
    return res.accessToken;
  }

  private static async findFolder(
    token: string,
    folderName: string,
    parentId?: string
  ): Promise<string | null> {
    const escapedName = folderName.replace(/'/g, "\\'");
    const parentFilter = parentId ? ` and '${parentId}' in parents` : '';
    const q = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentFilter}`;
    const url = `${this.DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      setCachedAccessToken(null);
      throw new Error('Sesi Google Drive berakhir. Silakan hubungkan ulang akun Google.');
    }

    const parsed = await this.safeParseResponse(res);
    if (!res.ok) {
      const errMsg = parsed.data?.error?.message || parsed.rawText.slice(0, 200);
      throw new Error(`Gagal memeriksa folder Google Drive (HTTP ${res.status}): ${errMsg}`);
    }
    if (!parsed.isJson || !parsed.data) {
      throw new Error('Respons pemeriksaan folder Google Drive bukan JSON yang valid.');
    }
    const first = Array.isArray(parsed.data.files) && parsed.data.files.length > 0 ? parsed.data.files[0] : null;
    return first?.id || null;
  }

  private static async createFolder(
    token: string,
    folderName: string,
    parentId?: string
  ): Promise<string> {
    const metadata: Record<string, any> = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) {
      metadata.parents = [parentId];
    }

    const res = await fetch(`${this.DRIVE_API_BASE}/files?fields=id,name`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    const parsed = await this.safeParseResponse(res);
    if (!res.ok) {
      const errMsg = parsed.data?.error?.message || parsed.rawText.slice(0, 200);
      throw new Error(`Gagal membuat folder "${folderName}" di Google Drive: ${errMsg}`);
    }
    if (!parsed.isJson || !parsed.data?.id) {
      throw new Error(`Respons pembuatan folder "${folderName}" di Google Drive tidak valid.`);
    }

    return parsed.data.id;
  }

  /**
   * Memastikan folder utama data & backup dan subfolder ilustrasi soal tersedia di Google Drive.
   */
  static async ensureIllustrationSubfolder(token: string): Promise<{
    rootFolderId: string;
    subfolderId: string;
    folderPath: string;
  }> {
    let rootFolderId = await this.findFolder(token, APP_DATA_BACKUP_FOLDER_NAME);
    if (!rootFolderId) {
      rootFolderId = await this.createFolder(token, APP_DATA_BACKUP_FOLDER_NAME);
    }

    let subfolderId = await this.findFolder(
      token,
      QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME,
      rootFolderId
    );
    if (!subfolderId) {
      subfolderId = await this.createFolder(
        token,
        QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME,
        rootFolderId
      );
    }

    return {
      rootFolderId,
      subfolderId,
      folderPath: `${APP_DATA_BACKUP_FOLDER_NAME} / ${QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME}`
    };
  }

  /**
   * Mengunggah gambar PNG Blob langsung ke subfolder Ilustrasi_Soal_AI via Google Drive REST API v3,
   * membuka izin baca publik (Siapa saja yang memiliki link), dan mengembalikan tautan Google Drive standar.
   */
  static async uploadBlobToDriveOAuth(
    blob: Blob,
    fileName: string,
    token?: string
  ): Promise<DriveUploadResult> {
    const activeToken = token || (await getAccessToken());
    if (!activeToken) {
      throw new Error('Akun Google Drive belum terhubung.');
    }

    const { subfolderId, folderPath } = await this.ensureIllustrationSubfolder(activeToken);

    const metadata = {
      name: fileName,
      parents: [subfolderId],
      mimeType: blob.type || 'image/png',
      description: 'Ilustrasi / Grafik soal ujian yang dihasilkan dan disimpan otomatis oleh ExamFlow Edu'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob, fileName);

    const uploadRes = await fetch(
      `${this.DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`
        },
        body: form
      }
    );

    if (uploadRes.status === 401) {
      setCachedAccessToken(null);
      throw new Error('Token akses Google Drive kedaluwarsa. Klik hubungkan Google Drive kembali.');
    }

    const parsedUpload = await this.safeParseResponse(uploadRes);
    if (!uploadRes.ok) {
      const errMsg = parsedUpload.data?.error?.message || parsedUpload.rawText.slice(0, 200);
      throw new Error(`Gagal mengunggah gambar ke Google Drive: ${errMsg}`);
    }
    if (!parsedUpload.isJson || !parsedUpload.data?.id) {
      throw new Error('Respons unggah Google Drive tidak mengandung ID berkas.');
    }

    const fileId = parsedUpload.data.id;

    // Set permission agar siapa saja dengan tautan (guru & siswa) dapat melihat gambar di soal
    try {
      await fetch(`${this.DRIVE_API_BASE}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (permErr) {
      console.warn('Peringatan pengaturan izin publik Google Drive:', permErr);
    }

    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
    StorageService.addLog(
      'SYNC',
      `Gambar ilustrasi soal tersimpan di Google Drive (${folderPath}): ${fileName}`,
      driveUrl,
      'success'
    );

    return {
      success: true,
      mediaUrl: driveUrl,
      fileId,
      folderPath,
      storageMode: 'gdrive_oauth',
      message: `Tersimpan di Google Drive (${folderPath})`
    };
  }

  /**
   * Mengunggah gambar (Data URL atau SVG) dengan strategi berurutan:
   * 1) Google Drive OAuth (jika user sudah login Google dengan izin Drive)
   * 2) Google Apps Script DriveApp backend (jika Web App GAS terhubung)
   * 3) Fallback PNG Data URL terkompresi agar gambar tetap langsung muncul di soal
   */
  static async saveIllustrationPngWithDrive(
    pngBlob: Blob,
    pngDataUrl: string,
    baseFileName: string
  ): Promise<DriveUploadResult> {
    const safeFileName = `${baseFileName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.png`;

    // 1. Coba Google Drive REST API OAuth (jika sudah masuk)
    const token = await getAccessToken();
    if (token) {
      try {
        return await this.uploadBlobToDriveOAuth(pngBlob, safeFileName, token);
      } catch (err) {
        console.warn('Upload OAuth Google Drive gagal, mencoba jalur GAS Drive:', err);
      }
    }

    // 2. Coba Google Apps Script DriveApp (otomatis di folder Spreadsheet / Data & Backup)
    const gasUrl = StorageService.getSettings().gasWebAppUrl?.trim();
    if (gasUrl) {
      try {
        const gasRes = await GasClient.uploadQuestionImageToDrive(pngDataUrl, safeFileName);
        if (gasRes.success && gasRes.driveUrl) {
          return {
            success: true,
            mediaUrl: gasRes.driveUrl,
            fileId: gasRes.fileId,
            folderPath: gasRes.folderPath || `${APP_DATA_BACKUP_FOLDER_NAME} / ${QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME}`,
            storageMode: 'gdrive_gas',
            message: `Tersimpan di Google Drive (${gasRes.folderPath || QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME})`
          };
        }
      } catch (gasErr) {
        console.warn('Upload GAS Drive gagal, menggunakan fallback PNG lokal:', gasErr);
      }
    }

    // 3. Fallback aman agar gambar langsung muncul meskipun Drive & GAS belum terhubung
    return {
      success: true,
      mediaUrl: pngDataUrl,
      folderPath: 'Penyimpanan Soal Lokal (Hubungkan Google Drive / GAS untuk simpan otomatis ke Drive)',
      storageMode: 'local_png',
      message: 'Gambar siap di soal (untuk simpan langsung ke subfolder Google Drive, hubungkan akun Google atau URL GAS).'
    };
  }

  /**
   * Menghasilkan ilustrasi/grafik via server Gemini, mengonversi ke PNG tajam, dan menyimpannya ke subfolder Google Drive.
   */
  static async generateAndSaveIllustration(params: {
    prompt: string;
    questionPrompt?: string;
    subject?: string;
    grade?: string;
    visualType?: 'auto' | 'illustration' | 'chart';
    fileNamePrefix?: string;
  }): Promise<{
    driveResult: DriveUploadResult;
    title: string;
    visualKind: 'illustration' | 'chart';
    caption: string;
    pngDataUrl: string;
  }> {
    const settings = StorageService.getSettings();
    const customApiKey = settings.geminiApiKey?.trim() || '';
    let illustrationData: {
      title?: string;
      visualKind?: 'illustration' | 'chart';
      caption?: string;
      svg?: string;
    } | null = null;
    let lastServerError = '';

    // 1. Coba melalui endpoint backend terlebih dahulu dengan safe text-then-JSON parser
    try {
      const res = await fetch('/api/gemini/generate-illustration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          questionPrompt: params.questionPrompt || '',
          subject: params.subject || 'Umum',
          grade: params.grade || 'Umum',
          visualType: params.visualType || 'auto',
          customApiKey: customApiKey || undefined
        })
      });

      const { isJson, data, rawText } = await this.safeParseResponse(res);
      if (res.ok && isJson && data?.success && data?.svg) {
        illustrationData = data;
      } else if (isJson && data?.message) {
        lastServerError = String(data.message);
      } else {
        const preview = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        lastServerError = preview
          ? `Server mengembalikan respons non-JSON (HTTP ${res.status}): "${preview}"`
          : `Server gagal merespons (HTTP ${res.status})`;
      }
    } catch (fetchErr: any) {
      lastServerError = fetchErr?.message || 'Koneksi ke endpoint ilustrasi gagal.';
    }

    // 2. Fallback langsung ke Google Generative Language API dari browser jika backend timeout / non-JSON
    if (!illustrationData?.svg && customApiKey) {
      const visualPrompt = `Buat satu visual edukatif SVG murni untuk soal sekolah:
- Mata Pelajaran: ${params.subject || 'Umum'}
- Jenjang: ${params.grade || 'Umum'}
- Jenis: ${params.visualType === 'chart' ? 'GRAFIK / BAGAN DATA' : params.visualType === 'illustration' ? 'ILUSTRASI / DIAGRAM' : 'OTOMATIS (Grafik Data atau Diagram Edukatif)'}
- Deskripsi: ${params.prompt}
${params.questionPrompt ? `- Konteks Soal: ${params.questionPrompt.slice(0, 900)}` : ''}

Aturan SVG wajib:
- Gunakan kanvas viewBox="0 0 960 600" dengan background <rect x="0" y="0" width="960" height="600" fill="#ffffff" rx="16" />.
- Elemen SVG vektor murni (rect, circle, path, line, polygon, text, g) dengan font Arial, Helvetica, sans-serif ukuran 14px-22px.
- DILARANG membocorkan jawaban yang ditanyakan pada label gambar (gunakan tanda "?" jika nilai/bagian itu yang ditanyakan).
- Kembalikan HANYA JSON valid: {"title":"...","visualKind":"chart"|"illustration","caption":"...","svg":"<svg viewBox=\\"0 0 960 600\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"}`;

      const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-4-hydrogen'];
      for (const modelName of modelsToTry) {
        try {
          const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(customApiKey)}`;
          const directRes = await fetch(directUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: visualPrompt }] }],
              generationConfig: {
                temperature: 0.4,
                responseMimeType: 'application/json',
                maxOutputTokens: 8192
              }
            })
          });

          const parsedDirect = await this.safeParseResponse(directRes);
          if (!directRes.ok || !parsedDirect.isJson) {
            lastServerError = parsedDirect.data?.error?.message || `HTTP ${directRes.status}`;
            continue;
          }

          const rawCandidate = parsedDirect.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleaned = rawCandidate.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
          let obj: any = null;
          try {
            obj = JSON.parse(cleaned);
          } catch {
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) {
              try { obj = JSON.parse(match[0]); } catch {}
            }
          }
          if (obj && typeof obj.svg === 'string' && obj.svg.includes('<svg')) {
            illustrationData = obj;
            break;
          }
        } catch (directErr: any) {
          lastServerError = directErr?.message || String(directErr);
        }
      }
    }

    if (!illustrationData?.svg) {
      throw new Error(
        lastServerError
          ? `Gagal menghasilkan ilustrasi/grafik AI (${lastServerError}). Pastikan Gemini API Key valid atau coba deskripsi yang lebih ringkas.`
          : 'Gagal menghasilkan ilustrasi/grafik dari AI.'
      );
    }

    const rendered = await svgToPng(illustrationData.svg, 1200, 750);
    const prefix = params.fileNamePrefix || illustrationData.visualKind || 'ilustrasi_soal';
    const driveResult = await this.saveIllustrationPngWithDrive(
      rendered.pngBlob,
      rendered.pngDataUrl,
      prefix
    );

    return {
      driveResult,
      title: illustrationData.title || 'Ilustrasi Soal',
      visualKind: illustrationData.visualKind === 'chart' ? 'chart' : 'illustration',
      caption: illustrationData.caption || '',
      pngDataUrl: rendered.pngDataUrl
    };
  }

  /**
   * Mengunggah ulang gambar data URL yang sudah ada ke subfolder Google Drive.
   */
  static async uploadExistingDataUrlToDrive(
    dataUrl: string,
    baseFileName = 'ilustrasi_soal'
  ): Promise<DriveUploadResult> {
    const blob = dataUrlToBlob(dataUrl);
    return this.saveIllustrationPngWithDrive(blob, dataUrl, baseFileName);
  }
}
