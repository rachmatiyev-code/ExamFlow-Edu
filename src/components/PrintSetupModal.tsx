import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  Sliders, 
  FileText, 
  Maximize2, 
  RotateCw, 
  Layers, 
  CheckCircle2, 
  Settings2,
  HardDrive,
  Cpu,
  Palette
} from 'lucide-react';

interface PrintSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
  defaultOrientation?: 'portrait' | 'landscape';
  onPrint?: () => void;
}

export type PaperSize = 'A4' | 'F4' | 'Legal' | 'Letter' | 'Custom';
export type MarginPreset = 'normal' | 'narrow' | 'minimum' | 'custom';
export type PrinterDevice = 'default' | 'pdf' | 'epson_l' | 'canon_pixma' | 'hp_laser' | 'brother';
export type PrintQuality = 'draft' | 'standard' | 'high';
export type ColorMode = 'color' | 'grayscale' | 'monochrome';
export type DuplexMode = 'simplex' | 'duplex_long' | 'duplex_short';

export const PrintSetupModal: React.FC<PrintSetupModalProps> = ({
  isOpen,
  onClose,
  documentTitle = 'Dokumen Resmi Ujian',
  defaultOrientation = 'portrait',
  onPrint
}) => {
  // Load saved preferences or defaults
  const [paperSize, setPaperSize] = useState<PaperSize>(() => {
    return (localStorage.getItem('examflow_print_paper_size') as PaperSize) || 'A4';
  });
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(defaultOrientation);
  const [marginPreset, setMarginPreset] = useState<MarginPreset>('normal');
  const [customMargins, setCustomMargins] = useState({ top: 15, right: 15, bottom: 15, left: 15 });
  const [customPaper, setCustomPaper] = useState({ width: 215, height: 330 });
  
  // Printer Device & Properties
  const [printerDevice, setPrinterDevice] = useState<PrinterDevice>(() => {
    return (localStorage.getItem('examflow_print_device') as PrinterDevice) || 'default';
  });
  const [printQuality, setPrintQuality] = useState<PrintQuality>('standard');
  const [colorMode, setColorMode] = useState<ColorMode>('color');
  const [duplexMode, setDuplexMode] = useState<DuplexMode>('simplex');
  const [scalePercent, setScalePercent] = useState<number>(100);
  const [mediaType, setMediaType] = useState<string>('plain_70_80');

  useEffect(() => {
    setOrientation(defaultOrientation);
  }, [defaultOrientation]);

  if (!isOpen) return null;

  // Margin values calculation
  let margins = { top: 15, right: 15, bottom: 15, left: 15 };
  if (marginPreset === 'narrow') {
    margins = { top: 10, right: 10, bottom: 10, left: 10 };
  } else if (marginPreset === 'minimum') {
    margins = { top: 5, right: 5, bottom: 5, left: 5 };
  } else if (marginPreset === 'custom') {
    margins = customMargins;
  }

  // Paper dimension description
  const getPaperDimensions = () => {
    switch (paperSize) {
      case 'A4':
        return orientation === 'portrait' ? '210 x 297 mm' : '297 x 210 mm';
      case 'F4':
        return orientation === 'portrait' ? '215 x 330 mm (Folio)' : '330 x 215 mm (Folio)';
      case 'Legal':
        return orientation === 'portrait' ? '216 x 356 mm' : '356 x 216 mm';
      case 'Letter':
        return orientation === 'portrait' ? '216 x 279 mm' : '279 x 216 mm';
      case 'Custom':
        return `${customPaper.width} x ${customPaper.height} mm`;
    }
  };

  const handleApplyAndPrint = () => {
    // Save preferences
    localStorage.setItem('examflow_print_paper_size', paperSize);
    localStorage.setItem('examflow_print_device', printerDevice);

    // Build CSS @page size string
    let sizeRule = 'A4';
    if (paperSize === 'F4') {
      sizeRule = '215mm 330mm';
    } else if (paperSize === 'Legal') {
      sizeRule = '216mm 356mm';
    } else if (paperSize === 'Letter') {
      sizeRule = 'letter';
    } else if (paperSize === 'Custom') {
      sizeRule = `${customPaper.width}mm ${customPaper.height}mm`;
    }

    const orientationRule = orientation;

    // Build filter for grayscale / mono if needed
    let colorFilterRule = '';
    if (colorMode === 'grayscale') {
      colorFilterRule = 'filter: grayscale(100%) !important;';
    } else if (colorMode === 'monochrome') {
      colorFilterRule = 'filter: grayscale(100%) contrast(1.8) !important;';
    }

    // Inject dynamic print style
    const styleId = 'examflow-dynamic-print-setup';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    styleTag.innerHTML = `
      @media print {
        @page {
          size: ${sizeRule} ${orientationRule};
          margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
        }
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          ${colorFilterRule}
        }
        .print-area {
          max-width: none !important;
          width: 100% !important;
          box-shadow: none !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
          transform: scale(${scalePercent / 100});
          transform-origin: top center;
        }
      }
    `;

    onClose();

    // Small delay to ensure style is applied before print dialog opens
    setTimeout(() => {
      if (onPrint) {
        onPrint();
      } else {
        window.print();
      }
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Setup Halaman & Properti Cetak</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
                  Standard Cetak Sekolah
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atur kertas (F4/A4), margin, orientasi, serta konfigurasi printer hardware.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          
          {/* Section 1: Kertas & Layout */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>1. Ukuran Kertas & Tata Letak (Layout)</span>
              </h4>
              <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded">
                Dimensi: {getPaperDimensions()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Ukuran Kertas */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ukuran Kertas:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'A4', label: 'A4', sub: '210 x 297 mm' },
                    { id: 'F4', label: 'F4 / Folio', sub: '215 x 330 mm' },
                    { id: 'Legal', label: 'Legal', sub: '216 x 356 mm' },
                    { id: 'Letter', label: 'Letter', sub: '216 x 279 mm' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaperSize(p.id as PaperSize)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        paperSize === p.id
                          ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs">{p.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{p.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout / Orientasi */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Orientasi Halaman (Layout):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                      orientation === 'portrait'
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="w-5 h-7 border-2 border-current rounded-xs shrink-0 flex items-center justify-center text-[8px]">
                      P
                    </div>
                    <div>
                      <div className="font-bold text-xs">Portrait</div>
                      <div className="text-[10px] text-slate-500">Tegak (Naskah)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                      orientation === 'landscape'
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="w-7 h-5 border-2 border-current rounded-xs shrink-0 flex items-center justify-center text-[8px]">
                      L
                    </div>
                    <div>
                      <div className="font-bold text-xs">Landscape</div>
                      <div className="text-[10px] text-slate-500">Mendatar (Tabel)</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Batas Kertas (Margins) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <Maximize2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>2. Batas Kertas (Margin)</span>
              </h4>
              <span className="text-[11px] font-mono text-slate-500">
                Atas: {margins.top}mm, Kanan: {margins.right}mm, Bawah: {margins.bottom}mm, Kiri: {margins.left}mm
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'normal', label: 'Standar Normal', val: '15 mm' },
                { id: 'narrow', label: 'Margin Sempit', val: '10 mm' },
                { id: 'minimum', label: 'Minimum', val: '5 mm' },
                { id: 'custom', label: 'Kustom mm', val: 'Manual' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMarginPreset(m.id as MarginPreset)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    marginPreset === m.id
                      ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs">{m.label}</div>
                  <div className="text-[10px] font-mono text-slate-500">{m.val}</div>
                </button>
              ))}
            </div>

            {marginPreset === 'custom' && (
              <div className="grid grid-cols-4 gap-2 pt-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Atas (mm):</span>
                  <input
                    type="number"
                    value={customMargins.top}
                    onChange={(e) => setCustomMargins({ ...customMargins, top: Number(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Kanan (mm):</span>
                  <input
                    type="number"
                    value={customMargins.right}
                    onChange={(e) => setCustomMargins({ ...customMargins, right: Number(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Bawah (mm):</span>
                  <input
                    type="number"
                    value={customMargins.bottom}
                    onChange={(e) => setCustomMargins({ ...customMargins, bottom: Number(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Kiri (mm):</span>
                  <input
                    type="number"
                    value={customMargins.left}
                    onChange={(e) => setCustomMargins({ ...customMargins, left: Number(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Device Printer & Properti Cetak */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>3. Pemilihan Perangkat Printer & Print Properties</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Destination Device */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Device Printer / Tujuan:
                </label>
                <select
                  value={printerDevice}
                  onChange={(e) => setPrinterDevice(e.target.value as PrinterDevice)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="default">🖨️ Printer Default Sistem (Dialog Browser)</option>
                  <option value="pdf">📄 Simpan sebagai PDF (Microsoft Print to PDF)</option>
                  <option value="epson_l">🖨️ Epson L-Series / EcoTank (Inkjet Office)</option>
                  <option value="canon_pixma">🖨️ Canon PIXMA G/TS Series (Deskjet)</option>
                  <option value="hp_laser">🖨️ HP LaserJet Pro / MFP Series</option>
                  <option value="brother">🖨️ Brother High-Yield Duplex Series</option>
                </select>
              </div>

              {/* Mode Warna */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mode Warna / Tinta:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setColorMode('color')}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                      colorMode === 'color'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🎨 Warna Asli
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorMode('grayscale')}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                      colorMode === 'grayscale'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    ⚪ Grayscale
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorMode('monochrome')}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                      colorMode === 'monochrome'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    ⬛ Hitam Pekat
                  </button>
                </div>
              </div>

              {/* Kualitas Cetak (DPI) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kualitas Cetak (DPI Resolution):
                </label>
                <select
                  value={printQuality}
                  onChange={(e) => setPrintQuality(e.target.value as PrintQuality)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs"
                >
                  <option value="draft">Draft / Cepat (300 DPI - Hemat Tinta)</option>
                  <option value="standard">Standar / Normal (600 DPI - Rekomendasi)</option>
                  <option value="high">Kualitas Tinggi / Fine (1200 DPI - Tajam Maksimal)</option>
                </select>
              </div>

              {/* Skala Cetak */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Skala Dokumen: {scalePercent}%
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="80"
                    max="110"
                    step="5"
                    value={scalePercent}
                    onChange={(e) => setScalePercent(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <span className="font-mono text-xs font-bold w-12 text-right">{scalePercent}%</span>
                </div>
              </div>
            </div>

            {/* Duplex Printing & Media Info */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Cetak Bolak-Balik (Duplex):</span>
                <select
                  value={duplexMode}
                  onChange={(e) => setDuplexMode(e.target.value as DuplexMode)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-xs"
                >
                  <option value="simplex">1 Sisi (Simplex)</option>
                  <option value="duplex_long">Bolak-balik Sisi Panjang (Buku / Vertikal)</option>
                  <option value="duplex_short">Bolak-balik Sisi Pendek (Kalender / Horizontal)</option>
                </select>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                *Pengaturan diterapkan langsung ke dialog native browser (Ctrl+P).
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Siap mencetak dokumen "{documentTitle}"</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyAndPrint}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Terapkan & Buka Dialog Cetak</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
