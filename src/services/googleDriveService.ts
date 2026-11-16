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

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gagal memeriksa folder Google Drive (HTTP ${res.status}): ${errText}`);
    }

    const data = await res.json();
    const first = Array.isArray(data.files) && data.files.length > 0 ? data.files[0] : null;
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

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gagal membuat folder "${folderName}" di Google Drive: ${errText}`);
    }

    const data = await res.json();
    return data.id;
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

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Gagal mengunggah gambar ke Google Drive: ${errText}`);
    }

    const uploaded = await uploadRes.json();
    const fileId = uploaded.id;

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
    const res = await fetch('/api/gemini/generate-illustration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        questionPrompt: params.questionPrompt || '',
        subject: params.subject || 'Umum',
        grade: params.grade || 'Umum',
        visualType: params.visualType || 'auto',
        customApiKey: settings.geminiApiKey?.trim() || undefined
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success || !data.svg) {
      throw new Error(data.message || 'Gagal menghasilkan ilustrasi/grafik dari AI.');
    }

    const rendered = await svgToPng(data.svg, 1200, 750);
    const prefix = params.fileNamePrefix || data.visualKind || 'ilustrasi_soal';
    const driveResult = await this.saveIllustrationPngWithDrive(
      rendered.pngBlob,
      rendered.pngDataUrl,
      prefix
    );

    return {
      driveResult,
      title: data.title || 'Ilustrasi Soal',
      visualKind: data.visualKind === 'chart' ? 'chart' : 'illustration',
      caption: data.caption || '',
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
