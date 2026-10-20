import React, { useState } from 'react';
import { 
  Volume2, 
  Maximize2, 
  ExternalLink, 
  AlertCircle, 
  Play, 
  FileText,
  RefreshCw,
  Image as ImageIcon,
  Video as VideoIcon
} from 'lucide-react';
import { 
  MediaType, 
  processMediaUrl, 
  ProcessedMedia, 
  parsePromptSegments 
} from '../services/mediaHelper';

interface QuestionMediaProps {
  mediaUrl?: string;
  mediaType?: MediaType;
  title?: string;
  compact?: boolean;
  onZoomImage?: (url: string) => void;
  className?: string;
}

export const QuestionMedia: React.FC<QuestionMediaProps> = ({
  mediaUrl,
  mediaType = 'none',
  title = 'Lampiran Soal',
  compact = false,
  onZoomImage,
  className = ''
}) => {
  const [imageError, setImageError] = useState(false);
  const [fallbackAttempt, setFallbackAttempt] = useState(0);

  if (!mediaUrl || mediaUrl.trim() === '') {
    return null;
  }

  const processed: ProcessedMedia = processMediaUrl(mediaUrl, mediaType);

  // If mediaType was set to 'none' but URL is provided, we auto-detected it in processed.type!
  const effectiveType = processed.type !== 'none' ? processed.type : 'image';

  // Handle fallback URL for Google Drive images
  const currentImageUrl = 
    fallbackAttempt === 0 
      ? processed.directUrl 
      : (processed.thumbnailUrl || processed.directUrl);

  const handleImageError = () => {
    if (fallbackAttempt === 0 && processed.thumbnailUrl && processed.thumbnailUrl !== processed.directUrl) {
      setFallbackAttempt(1);
    } else {
      setImageError(true);
    }
  };

  const handleRetry = () => {
    setImageError(false);
    setFallbackAttempt(0);
  };

  return (
    <div className={`rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 sm:p-4 ${className}`}>
      {/* Header Info Badge */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5 font-semibold capitalize">
          {effectiveType === 'image' && <ImageIcon className="w-3.5 h-3.5 text-blue-500" />}
          {effectiveType === 'audio' && <Volume2 className="w-3.5 h-3.5 text-emerald-500" />}
          {effectiveType === 'video' && <VideoIcon className="w-3.5 h-3.5 text-rose-500" />}
          <span>
            {effectiveType === 'image' ? 'Lampiran Gambar / Foto' : effectiveType === 'audio' ? 'Lampiran Rekaman Audio' : 'Lampiran Video'}
          </span>
          {processed.provider !== 'direct' && (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {processed.provider}
            </span>
          )}
        </span>

        {!processed.originalUrl.startsWith('data:') && (
          <a
            href={processed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            title="Buka sumber media di tab baru"
          >
            <span>Buka Sumber</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* 1. AUDIO PLAYER */}
      {effectiveType === 'audio' && (
        <div className="space-y-2">
          {processed.isIframe || (processed.provider === 'drive' && !processed.directUrl.startsWith('data:')) ? (
            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <iframe
                src={processed.embedUrl || processed.directUrl}
                title={title}
                className="w-full h-16 sm:h-20 border-0"
                allow="autoplay"
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Volume2 className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 w-full space-y-1">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Dengarkan berkas audio dengan saksama:
                </div>
                <audio
                  controls
                  src={processed.directUrl}
                  className="w-full h-9"
                  preload="metadata"
                >
                  Peramban Anda tidak mendukung pemutar audio langsung.
                </audio>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. IMAGE VIEWER */}
      {effectiveType === 'image' && (
        <div className="space-y-2">
          {imageError ? (
            <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs flex flex-col items-center justify-center gap-2 text-center">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <div>
                <p className="font-semibold">Gambar gagal dimuat secara langsung.</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                  Tautan gambar mungkin memerlukan izin akses publik (Google Drive: &quot;Siapa saja yang memiliki link&quot;).
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Coba Lagi</span>
                </button>
                <a
                  href={processed.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka Link Langsung</span>
                </a>
              </div>
            </div>
          ) : (
            <div className={`relative group overflow-hidden rounded-lg bg-slate-950 flex items-center justify-center ${compact ? 'max-h-48' : 'max-h-96'}`}>
              <img
                src={currentImageUrl}
                alt={title}
                referrerPolicy="no-referrer"
                onError={handleImageError}
                onClick={() => onZoomImage && onZoomImage(currentImageUrl)}
                className={`w-auto object-contain transition-opacity cursor-pointer hover:opacity-95 ${
                  compact ? 'max-h-48' : 'max-h-96'
                }`}
              />

              {onZoomImage && (
                <button
                  type="button"
                  onClick={() => onZoomImage(currentImageUrl)}
                  className="absolute bottom-2.5 right-2.5 px-2.5 py-1.5 bg-black/75 hover:bg-black text-white text-xs rounded-lg flex items-center gap-1.5 backdrop-blur-xs transition-colors shadow-sm"
                  title="Klik untuk memperbesar gambar"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Perbesar Gambar</span>
                </button>
              )}
            </div>
          )}

          {!compact && !imageError && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              Klik gambar atau tombol perbesar untuk memeriksa rincian diagram dalam resolusi tinggi.
            </p>
          )}
        </div>
      )}

      {/* 3. VIDEO PLAYER */}
      {effectiveType === 'video' && (
        <div className="space-y-2">
          <div className={`w-full rounded-lg overflow-hidden bg-black ${compact ? 'aspect-video max-h-56' : 'aspect-video'}`}>
            {processed.isIframe ? (
              <iframe
                src={processed.embedUrl || processed.directUrl}
                title={title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video
                controls
                playsInline
                preload="metadata"
                src={processed.directUrl}
                className="w-full h-full object-contain"
              >
                Peramban Anda tidak mendukung pemutar video HTML5.
              </video>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface QuestionPromptRendererProps {
  prompt: string;
  onZoomImage?: (url: string) => void;
  className?: string;
}

export const QuestionPromptRenderer: React.FC<QuestionPromptRendererProps> = ({
  prompt,
  onZoomImage,
  className = ''
}) => {
  if (!prompt) return null;

  const segments = parsePromptSegments(prompt);

  // If no embedded segments were found (pure plain text), render with whitespace-pre-line
  const hasEmbeddedMedia = segments.some(s => s.type !== 'text');

  if (!hasEmbeddedMedia) {
    return (
      <div className={`whitespace-pre-line leading-relaxed ${className}`}>
        {prompt}
      </div>
    );
  }

  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          if (!seg.content) return <div key={idx} className="h-2" />;
          return (
            <div key={idx} className="whitespace-pre-line">
              {seg.content}
            </div>
          );
        }

        if (seg.type === 'image') {
          return (
            <div key={idx} className="my-3">
              <QuestionMedia
                mediaUrl={seg.content}
                mediaType="image"
                title={seg.alt || 'Gambar pada Soal'}
                onZoomImage={onZoomImage}
                compact={false}
              />
            </div>
          );
        }

        if (seg.type === 'audio' || seg.type === 'video') {
          return (
            <div key={idx} className="my-3">
              <QuestionMedia
                mediaUrl={seg.content}
                mediaType={seg.type}
                title={seg.alt || 'Media pada Soal'}
                onZoomImage={onZoomImage}
                compact={false}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
