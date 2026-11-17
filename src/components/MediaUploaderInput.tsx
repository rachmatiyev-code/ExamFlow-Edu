import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Link as LinkIcon, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Image as ImageIcon, 
  Volume2, 
  Video as VideoIcon, 
  Eye, 
  HelpCircle,
  Sparkles,
  BarChart3,
  CloudUpload
} from 'lucide-react';
import { MediaType, processLocalFile } from '../services/mediaHelper';
import { QuestionMedia } from './QuestionMedia';
import { GoogleDriveService, APP_DATA_BACKUP_FOLDER_NAME, QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME } from '../services/googleDriveService';
import { StorageService } from '../services/storage';

interface MediaUploaderInputProps {
  mediaType: MediaType;
  mediaUrl: string;
  onChange: (mediaType: MediaType, mediaUrl: string) => void;
  onZoomImage?: (url: string) => void;
  questionPrompt?: string;
  questionSubject?: string;
  questionGrade?: string;
}

export const MediaUploaderInput: React.FC<MediaUploaderInputProps> = ({
  mediaType = 'none',
  mediaUrl = '',
  onChange,
  onZoomImage,
  questionPrompt = '',
  questionSubject = 'Umum',
  questionGrade = 'Umum'
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'ai_image'>(
    mediaUrl && !mediaUrl.startsWith('data:') ? 'url' : 'upload'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{ name: string; sizeFormatted: string } | null>(null);

  // State untuk Generate Gambar / Grafik AI -> Google Drive
  const [aiVisualType, setAiVisualType] = useState<'auto' | 'illustration' | 'chart'>('auto');
  const [aiVisualPrompt, setAiVisualPrompt] = useState('');
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [driveStatusMsg, setDriveStatusMsg] = useState<string | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    GoogleDriveService.isOAuthConnected().then(setIsDriveConnected).catch(() => setIsDriveConnected(false));
  }, [activeTab]);

  const handleTypeChange = (newType: MediaType) => {
    if (newType === 'none') {
      onChange('none', '');
      setFileDetails(null);
      setUploadError(null);
      setDriveStatusMsg(null);
    } else {
      if (newType !== 'image' && activeTab === 'ai_image') {
        setActiveTab('upload');
      }
      onChange(newType, mediaUrl);
    }
  };

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    setUploadError(null);
    try {
      await GoogleDriveService.connectGoogleDrive();
      setIsDriveConnected(true);
      setDriveStatusMsg(`Google Drive terhubung! Siap menyimpan otomatis ke subfolder "${APP_DATA_BACKUP_FOLDER_NAME} / ${QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME}".`);
    } catch (err: any) {
      setUploadError(err?.message || 'Gagal menghubungkan akun Google Drive.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleGenerateAiVisual = async () => {
    const cleanPrompt = aiVisualPrompt.trim() || questionPrompt.replace(/<[^>]+>/g, ' ').trim();
    if (!cleanPrompt) {
      setUploadError('Tuliskan deskripsi gambar/grafik atau isi teks pertanyaan terlebih dahulu.');
      return;
    }

    setIsGeneratingVisual(true);
    setUploadError(null);
    setDriveStatusMsg('AI sedang menggambar ilustrasi/grafik & menyimpannya ke subfolder Google Drive...');

    try {
      const result = await GoogleDriveService.generateAndSaveIllustration({
        prompt: aiVisualPrompt.trim() || cleanPrompt,
        questionPrompt: questionPrompt.replace(/<[^>]+>/g, ' ').trim(),
        subject: questionSubject,
        grade: questionGrade,
        visualType: aiVisualType,
        fileNamePrefix: `manual_${(questionSubject || 'soal').replace(/\s+/g, '_').toLowerCase()}`
      });

      onChange('image', result.driveResult.mediaUrl);
      setDriveStatusMsg(
        result.driveResult.storageMode === 'local_png'
          ? `${result.title} berhasil dibuat! (${result.driveResult.message})`
          : `✓ ${result.title} berhasil disimpan ke Google Drive (${result.driveResult.folderPath}) dan tautan GDrive disematkan ke soal.`
      );
      if (result.driveResult.storageMode === 'gdrive_oauth' || result.driveResult.storageMode === 'gdrive_gas') {
        setActiveTab('url');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Gagal menghasilkan gambar/grafik AI.');
      setDriveStatusMsg(null);
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  const handleUploadExistingDataUrlToDrive = async () => {
    if (!mediaUrl.startsWith('data:')) return;
    setIsProcessing(true);
    setUploadError(null);
    try {
      const res = await GoogleDriveService.uploadExistingDataUrlToDrive(mediaUrl, 'ilustrasi_soal');
      onChange('image', res.mediaUrl);
      setDriveStatusMsg(`✓ Gambar berhasil dipindahkan ke Google Drive (${res.folderPath}).`);
      if (res.storageMode !== 'local_png') {
        setActiveTab('url');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Gagal mengunggah ke Google Drive.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadError(null);

    try {
      if (file.size > 25 * 1024 * 1024) {
        setUploadError('Ukuran berkas melebihi 25MB. Untuk video durasi panjang, disarankan menggunakan link Google Drive atau YouTube agar penyimpanan tetap ringan.');
        setIsProcessing(false);
        return;
      }

      const result = await processLocalFile(file);

      setFileDetails({
        name: result.fileName,
        sizeFormatted: result.fileSizeFormatted
      });

      const targetType = mediaType === 'none' ? result.mediaType : mediaType;
      onChange(targetType, result.dataUrl);
    } catch (err) {
      console.error('Gagal memproses berkas:', err);
      setUploadError('Gagal membaca berkas dari komputer Anda. Coba pilih format lain.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMedia = () => {
    onChange('none', '');
    setFileDetails(null);
    setUploadError(null);
    setDriveStatusMsg(null);
  };

  const isDataUrl = mediaUrl.startsWith('data:');
  const hasGasUrl = Boolean(StorageService.getSettings().gasWebAppUrl?.trim());

  const getAcceptAttribute = () => {
    if (mediaType === 'image') return 'image/*,.png,.jpg,.jpeg,.webp,.gif,.svg';
    if (mediaType === 'audio') return 'audio/*,.mp3,.wav,.ogg,.m4a,.aac';
    if (mediaType === 'video') return 'video/*,.mp4,.webm,.mov,.mkv';
    return 'image/*,audio/*,video/*';
  };

  return (
    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3.5">
      {/* 1. Media Type Selector Radios */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <span>Sisipkan Media Soal:</span>
        </span>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(['none', 'image', 'audio', 'video'] as const).map(m => (
            <label
              key={m}
              className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg cursor-pointer transition-colors border ${
                mediaType === m 
                  ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="mediaTypeSelector"
                value={m}
                checked={mediaType === m}
                onChange={() => handleTypeChange(m)}
                className="text-indigo-600 sr-only"
              />
              {m === 'none' && <span>Tanpa Media</span>}
              {m === 'image' && (
                <>
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Foto/Gambar/Grafik</span>
                </>
              )}
              {m === 'audio' && (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Audio/Suara</span>
                </>
              )}
              {m === 'video' && (
                <>
                  <VideoIcon className="w-3.5 h-3.5" />
                  <span>Video</span>
                </>
              )}
            </label>
          ))}

          {mediaType === 'none' && (
            <button
              type="button"
              onClick={() => {
                onChange('image', '');
                setActiveTab('ai_image');
              }}
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Gambar AI</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Media Source Tabs (Upload PC vs URL Link vs AI Generate Gambar/Grafik) */}
      {mediaType !== 'none' && (
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex flex-wrap p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg text-xs font-medium gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`h-7 inline-flex items-center gap-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah PC</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`h-7 inline-flex items-center gap-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                  activeTab === 'url'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Tautan URL / GDrive</span>
              </button>

              {mediaType === 'image' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ai_image')}
                  className={`h-7 inline-flex items-center gap-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                    activeTab === 'ai_image'
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'text-indigo-700 dark:text-indigo-300 hover:bg-white/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Gambar / Grafik AI</span>
                </button>
              )}
            </div>

            {mediaUrl && (
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="h-7 inline-flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Hapus media dari soal"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Media</span>
              </button>
            )}
          </div>

          {/* TAB 1: UPLOAD FROM LOCAL PC */}
          {activeTab === 'upload' && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={getAcceptAttribute()}
                onChange={handleFileSelect}
                className="hidden"
                id="pc-media-file-input"
              />

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-white/50 dark:bg-slate-900/50 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 text-center"
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-medium">Memproses & mengoptimalkan berkas...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Klik untuk memilih berkas {mediaType === 'image' ? 'foto / gambar' : mediaType === 'audio' ? 'audio / suara' : 'video'} dari PC Anda
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {mediaType === 'image' && 'Mendukung JPG, PNG, WEBP, GIF, SVG (Kompresi otomatis resolusi HD)'}
                        {mediaType === 'audio' && 'Mendukung MP3, WAV, OGG, M4A, AAC'}
                        {mediaType === 'video' && 'Mendukung MP4, WEBM, MOV (Maksimal 25MB)'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {isDataUrl && fileDetails && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold truncate">{fileDetails.name}</span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                      ({fileDetails.sizeFormatted})
                    </span>
                  </div>
                  <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100 px-2 py-0.5 rounded font-semibold shrink-0">
                    Siap Disimpan
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: URL LINK / GOOGLE DRIVE / YOUTUBE */}
          {activeTab === 'url' && (
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tempel URL Media (Google Drive, YouTube, Vimeo, Dropbox, atau Direct Link):
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder={
                      mediaType === 'image' 
                        ? 'https://drive.google.com/file/d/... atau https://images.unsplash.com/...' 
                        : mediaType === 'audio' 
                        ? 'https://drive.google.com/file/d/... atau https://domain.com/audio.mp3' 
                        : 'https://youtu.be/... atau https://drive.google.com/file/d/.../view'
                    }
                    value={mediaUrl.startsWith('data:') ? '' : mediaUrl}
                    onChange={(e) => onChange(mediaType, e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <div className="flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Tips Tautan URL yang Didukung Sistem:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">Google Drive:</strong> Gambar hasil generate AI tersimpan otomatis ke folder <code>{APP_DATA_BACKUP_FOLDER_NAME} / {QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME}</code> dan menghasilkan link GDrive siap pakai.
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">YouTube:</strong> Mendukung link standar (<code>watch?v=...</code>), link singkat (<code>youtu.be/...</code>), maupun YouTube Shorts.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: GENERATE GAMBAR / GRAFIK AI -> SIMPAN SUBFOLDER GDRIVE */}
          {activeTab === 'ai_image' && mediaType === 'image' && (
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Generator Ilustrasi & Grafik Soal AI</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Hasil gambar disimpan ke subfolder <strong className="text-indigo-600 dark:text-indigo-400">{APP_DATA_BACKUP_FOLDER_NAME} / {QUESTION_ILLUSTRATIONS_SUBFOLDER_NAME}</strong> di Google Drive dan disematkan otomatis sebagai tautan GDrive.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isDriveConnected || hasGasUrl ? (
                    <span className="h-7 px-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isDriveConnected ? 'GDrive Terhubung' : 'Via GDrive GAS'}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isConnectingDrive}
                      onClick={handleConnectDrive}
                      className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      {isConnectingDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                      <span>Hubungkan Google Drive</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Pilihan Jenis Visual */}
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAiVisualType('auto')}
                  className={`h-8 px-2.5 rounded-lg border font-medium transition-all cursor-pointer ${
                    aiVisualType === 'auto'
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Otomatis Sesuai Soal
                </button>
                <button
                  type="button"
                  onClick={() => setAiVisualType('illustration')}
                  className={`h-8 px-2.5 rounded-lg border font-medium inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    aiVisualType === 'illustration'
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Ilustrasi / Diagram</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiVisualType('chart')}
                  className={`h-8 px-2.5 rounded-lg border font-medium inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    aiVisualType === 'chart'
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Grafik / Bagan Data</span>
                </button>
              </div>

              {/* Deskripsi Visual */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Deskripsi Gambar atau Data Grafik:
                  </label>
                  {questionPrompt && (
                    <button
                      type="button"
                      onClick={() => setAiVisualPrompt(questionPrompt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400))}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Salin dari Teks Soal
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={aiVisualPrompt}
                  onChange={(e) => setAiVisualPrompt(e.target.value)}
                  placeholder="Contoh: Grafik batang jumlah panen padi Desa Sukamaju tahun 2021 (40 ton), 2022 (55 ton), 2023 (50 ton), 2024 (70 ton)..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  Tip: Jika dikosongkan, AI membaca teks pertanyaan soal di atas secara otomatis.
                </span>
                <button
                  type="button"
                  disabled={isGeneratingVisual}
                  onClick={handleGenerateAiVisual}
                  className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {isGeneratingVisual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{isGeneratingVisual ? 'Membuat & Menyimpan ke GDrive...' : 'Generate Gambar & Simpan ke GDrive'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Message / Simpan ke Drive untuk gambar data URL */}
          {driveStatusMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
              <span>{driveStatusMsg}</span>
              {isDataUrl && (isDriveConnected || hasGasUrl) && (
                <button
                  type="button"
                  onClick={handleUploadExistingDataUrlToDrive}
                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                >
                  Simpan ke GDrive Sekarang
                </button>
              )}
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* 3. LIVE PREVIEW SECTION */}
          {mediaUrl && (
            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Pratinjau Media yang Disematkan:</span>
                </div>
                {mediaUrl.includes('drive.google.com') && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Link Google Drive Aktif
                  </span>
                )}
              </div>
              <QuestionMedia
                mediaUrl={mediaUrl}
                mediaType={mediaType}
                title="Pratinjau Media Soal"
                compact={false}
                onZoomImage={onZoomImage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

