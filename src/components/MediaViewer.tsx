import React from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { processMediaUrl } from '../services/mediaHelper';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  title?: string;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ isOpen, onClose, imageUrl, title }) => {
  const [scale, setScale] = React.useState(1);

  if (!isOpen || !imageUrl) return null;

  const processed = processMediaUrl(imageUrl, 'image');
  const displayUrl = processed.directUrl || imageUrl;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-4xl w-full bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
          <h4 className="text-sm font-medium text-slate-200 truncate">{title || 'Tampilan Gambar Soal'}</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale(s => Math.min(s + 0.25, 2.5))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Perbesar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Perkecil"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale(1)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[75vh] flex items-center justify-center p-4 bg-slate-950">
          <img
            src={displayUrl}
            alt={title || 'Gambar Soal'}
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (processed.thumbnailUrl && e.currentTarget.src !== processed.thumbnailUrl) {
                e.currentTarget.src = processed.thumbnailUrl;
              }
            }}
            style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease' }}
            className="max-w-full max-h-[70vh] object-contain rounded-md"
          />
        </div>

        <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center">
          <span>Gunakan tombol zoom untuk memeriksa detail gambar.</span>
          <span>Perbesaran: {Math.round(scale * 100)}%</span>
        </div>
      </div>
    </div>
  );
};
