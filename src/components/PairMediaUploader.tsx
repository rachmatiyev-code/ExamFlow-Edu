import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Link as LinkIcon, 
  Trash2, 
  Image as ImageIcon, 
  Volume2, 
  Video as VideoIcon, 
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  X
} from 'lucide-react';
import { MediaType, processLocalFile, detectMediaType } from '../services/mediaHelper';
import { QuestionMedia } from './QuestionMedia';

interface PairMediaUploaderProps {
  mediaType?: MediaType;
  mediaUrl?: string;
  onChange: (mediaType: MediaType, mediaUrl: string) => void;
  onZoomImage?: (url: string) => void;
  label?: string;
}

export const PairMediaUploader: React.FC<PairMediaUploaderProps> = ({
  mediaType = 'none',
  mediaUrl = '',
  onChange,
  onZoomImage,
  label = 'Media Pendukung (Gambar / Foto / Audio / Video)'
}) => {
  const hasMedia = Boolean(mediaUrl && mediaUrl.trim() !== '');
  const [isOpen, setIsOpen] = useState(hasMedia);
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>(
    mediaUrl && !mediaUrl.startsWith('data:') ? 'url' : 'upload'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveType: MediaType = mediaType !== 'none' ? mediaType : 'image';

  const handleSelectType = (newType: MediaType) => {
    onChange(newType, mediaUrl);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      if (file.size > 20 * 1024 * 1024) {
        setErrorMsg('Ukuran berkas melebihi 20MB. Gunakan link Google Drive atau YouTube untuk video durasi panjang.');
        setIsProcessing(false);
        return;
      }

      const result = await processLocalFile(file);
      const targetType = mediaType === 'none' ? result.mediaType : mediaType;
      onChange(targetType, result.dataUrl);
    } catch (err: any) {
      console.error('Gagal membaca berkas media:', err);
      setErrorMsg('Gagal memproses berkas. Pastikan format berkas didukung.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUrlChange = (url: string) => {
    setErrorMsg(null);
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      onChange('none', '');
      return;
    }
    const detected = detectMediaType(cleanUrl, effectiveType !== 'none' ? effectiveType : 'image');
    onChange(detected, cleanUrl);
  };

  const handleRemove = () => {
    onChange('none', '');
    setErrorMsg(null);
    setIsOpen(false);
  };

  if (!isOpen && !hasMedia) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
        title="Sisipkan gambar, foto, rekaman audio, atau video pada butir premis ini"
      >
        <Plus className="w-3 h-3" />
        <span>+ Media (Foto / Audio / Video)</span>
      </button>
    );
  }

  return (
    <div className="mt-2 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/30 dark:bg-indigo-950/20 text-xs space-y-2 animate-fadeIn">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
          <span>{label}</span>
        </span>
        <button
          type="button"
          onClick={handleRemove}
          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] flex items-center gap-1 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50"
          title="Tutup & Hapus Media"
        >
          <X className="w-3.5 h-3.5" />
          <span>Hapus</span>
        </button>
      </div>

      {/* Pilihan Jenis Media */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => handleSelectType('image')}
          className={`flex-1 py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
            effectiveType === 'image'
              ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ImageIcon className="w-3 h-3 text-blue-500" />
          <span>Gambar / Foto</span>
        </button>
        <button
          type="button"
          onClick={() => handleSelectType('audio')}
          className={`flex-1 py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
            effectiveType === 'audio'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Volume2 className="w-3 h-3 text-emerald-500" />
          <span>Suara / Audio</span>
        </button>
        <button
          type="button"
          onClick={() => handleSelectType('video')}
          className={`flex-1 py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
            effectiveType === 'video'
              ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <VideoIcon className="w-3 h-3 text-rose-500" />
          <span>Video</span>
        </button>
      </div>

      {/* Input Method Tabs */}
      <div className="flex items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600'
          }`}
        >
          Unggah Berkas (PC)
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
            activeTab === 'url'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600'
          }`}
        >
          Link URL (Drive / YouTube / Web)
        </button>
      </div>

      {/* Input Field: Upload PC */}
      {activeTab === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept={
              effectiveType === 'image'
                ? 'image/*,.png,.jpg,.jpeg,.webp,.gif,.svg'
                : effectiveType === 'audio'
                ? 'audio/*,.mp3,.wav,.ogg,.m4a'
                : 'video/*,.mp4,.webm,.mov'
            }
            className="hidden"
            id={`file-input-${label.replace(/[^a-zA-Z0-9]/g, '_')}`}
          />
          <label
            htmlFor={`file-input-${label.replace(/[^a-zA-Z0-9]/g, '_')}`}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors text-slate-700 dark:text-slate-300"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            )}
            <span className="text-[11px] font-medium">
              {isProcessing
                ? 'Memproses berkas media...'
                : hasMedia
                ? 'Pilih berkas baru untuk mengganti media'
                : `Klik untuk pilih berkas ${effectiveType === 'image' ? 'foto/gambar' : effectiveType === 'audio' ? 'rekaman audio' : 'video'}`}
            </span>
          </label>
        </div>
      )}

      {/* Input Field: Link URL */}
      {activeTab === 'url' && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={mediaUrl.startsWith('data:') ? '' : mediaUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={
              effectiveType === 'image'
                ? 'Tempel link gambar (Google Drive, Imgur, direct URL)...'
                : effectiveType === 'audio'
                ? 'Tempel link audio Google Drive atau direct mp3...'
                : 'Tempel link YouTube, Google Drive, atau video mp4...'
            }
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Pratinjau Media */}
      {hasMedia && (
        <div className="pt-1">
          <QuestionMedia
            mediaUrl={mediaUrl}
            mediaType={effectiveType}
            title="Pratinjau Media Premis"
            compact={true}
            onZoomImage={onZoomImage}
          />
        </div>
      )}
    </div>
  );
};
