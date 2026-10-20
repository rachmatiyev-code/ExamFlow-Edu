import React, { useState, useRef } from 'react';
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
  HelpCircle 
} from 'lucide-react';
import { MediaType, processLocalFile, formatFileSize } from '../services/mediaHelper';
import { QuestionMedia } from './QuestionMedia';

interface MediaUploaderInputProps {
  mediaType: MediaType;
  mediaUrl: string;
  onChange: (mediaType: MediaType, mediaUrl: string) => void;
  onZoomImage?: (url: string) => void;
}

export const MediaUploaderInput: React.FC<MediaUploaderInputProps> = ({
  mediaType = 'none',
  mediaUrl = '',
  onChange,
  onZoomImage
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>(
    mediaUrl && !mediaUrl.startsWith('data:') ? 'url' : 'upload'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{ name: string; sizeFormatted: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTypeChange = (newType: MediaType) => {
    if (newType === 'none') {
      onChange('none', '');
      setFileDetails(null);
      setUploadError(null);
    } else {
      onChange(newType, mediaUrl);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadError(null);

    try {
      // Check file size warning for videos (over 25MB)
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

      // Update parent state with auto-detected or current type and Base64 data URL
      const targetType = mediaType === 'none' ? result.mediaType : mediaType;
      onChange(targetType, result.dataUrl);
    } catch (err) {
      console.error('Gagal memproses berkas:', err);
      setUploadError('Gagal membaca berkas dari komputer Anda. Coba pilih format lain.');
    } finally {
      setIsProcessing(false);
      // Reset input value so same file can be re-selected if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMedia = () => {
    onChange('none', '');
    setFileDetails(null);
    setUploadError(null);
  };

  const isDataUrl = mediaUrl.startsWith('data:');

  // Accept attribute based on current mediaType
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

        <div className="flex items-center gap-3 text-xs">
          {(['none', 'image', 'audio', 'video'] as const).map(m => (
            <label
              key={m}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                mediaType === m 
                  ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/40'
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
                  <span>Foto/Gambar</span>
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
        </div>
      </div>

      {/* 2. Media Source Tabs (Upload PC vs URL Link) */}
      {mediaType !== 'none' && (
        <div className="space-y-3 pt-1 border-t border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <div className="inline-flex p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === 'upload'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah dari PC (Komputer)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === 'url'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Tautan URL / Drive / YouTube</span>
              </button>
            </div>

            {mediaUrl && (
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors p-1"
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

              {/* Uploaded File Info Pill */}
              {isDataUrl && fileDetails && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold truncate">{fileDetails.name}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      ({fileDetails.sizeFormatted})
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 px-1.5 py-0.5 rounded font-semibold shrink-0">
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

              {/* Helper Badges */}
              <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <div className="flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Tips Tautan URL yang Didukung Sistem:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">Google Drive:</strong> Pastikan setelan akses diubah ke <em>&quot;Siapa saja yang memiliki link&quot;</em>. Sistem otomatis mengonversi ke tautan tayang langsung.
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">YouTube:</strong> Mendukung link standar (<code>watch?v=...</code>), link singkat (<code>youtu.be/...</code>), maupun YouTube Shorts.
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">Dropbox:</strong> Link publik Dropbox otomatis dikonversi ke stream langsung (<code>raw=1</code>).
                  </li>
                </ul>
              </div>
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
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Pratinjau Media yang Disematkan:</span>
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
