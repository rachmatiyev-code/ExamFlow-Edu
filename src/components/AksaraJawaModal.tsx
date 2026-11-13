import React, { useState, useRef } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  Copy,
  Check,
  Delete,
  Trash2,
  ArrowRight,
  Info,
  HelpCircle
} from 'lucide-react';
import {
  AKSARA_NGLEGENA,
  AKSARA_KHUSUS_SWARA_REKAN,
  AKSARA_MURDA,
  SANDHANGAN_SWARA,
  SANDHANGAN_PANYIGEG_WYANJANA,
  PASANGAN_CARAKAN,
  PASANGAN_MURDA,
  TANDA_BACA_JAWA,
  ANGKA_JAWA,
  PANDUAN_AKSARA_JAWA,
  latinToAksaraJawa,
  AksaraItem
} from '../services/javaneseHelper';

type AksaraTab =
  | 'carakan'
  | 'murda'
  | 'sandhangan'
  | 'pasangan'
  | 'tandabaca'
  | 'angka'
  | 'panduan';

interface AksaraJawaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert?: (javaneseText: string) => void;
  initialTab?: AksaraTab;
  title?: string;
}

export const AksaraJawaModal: React.FC<AksaraJawaModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  initialTab = 'carakan',
  title = 'Editor & Panduan Aksara Jawa'
}) => {
  const [activeTab, setActiveTab] = useState<AksaraTab>(initialTab);
  const [composedText, setComposedText] = useState('');
  const [latinInput, setLatinInput] = useState('');
  const [useAdegAdeg, setUseAdegAdeg] = useState(false);
  const [wrapDigitsPangkat, setWrapDigitsPangkat] = useState(true);
  const [copied, setCopied] = useState(false);

  const composerRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  const insertCharAtComposer = (charStr: string) => {
    const el = composerRef.current;
    if (!el) {
      setComposedText(prev => prev + charStr);
      return;
    }
    const start = el.selectionStart ?? composedText.length;
    const end = el.selectionEnd ?? composedText.length;
    const next = composedText.slice(0, start) + charStr + composedText.slice(end);
    setComposedText(next);
    setTimeout(() => {
      el.focus();
      const pos = start + charStr.length;
      el.setSelectionRange(pos, pos);
    }, 10);
  };

  const handleBackspace = () => {
    const el = composerRef.current;
    if (!el) {
      setComposedText(prev => prev.slice(0, -1));
      return;
    }
    const start = el.selectionStart ?? composedText.length;
    const end = el.selectionEnd ?? composedText.length;
    if (start !== end) {
      const next = composedText.slice(0, start) + composedText.slice(end);
      setComposedText(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start, start);
      }, 10);
    } else if (start > 0) {
      const next = composedText.slice(0, start - 1) + composedText.slice(start);
      setComposedText(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start - 1, start - 1);
      }, 10);
    }
  };

  const handleConvertLatin = () => {
    if (!latinInput.trim()) return;
    const converted = latinToAksaraJawa(latinInput, {
      useAdegAdeg,
      wrapDigitsWithPangkat: wrapDigitsPangkat
    });
    if (converted) {
      insertCharAtComposer(composedText && !composedText.endsWith(' ') && !composedText.endsWith('\n') ? ` ${converted}` : converted);
    }
  };

  const handleCopy = async () => {
    if (!composedText) return;
    try {
      await navigator.clipboard.writeText(composedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const renderKeyGrid = (items: AksaraItem[], columnsClass = 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6') => (
    <div className={`grid ${columnsClass} gap-2`}>
      {items.map((item, idx) => (
        <button
          key={`${item.name}-${idx}`}
          type="button"
          onClick={() => insertCharAtComposer(item.char)}
          title={item.note || `${item.name} (${item.latin})`}
          className="group p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:border-amber-400 dark:hover:border-amber-600 transition-all flex flex-col items-center justify-center text-center shadow-2xs cursor-pointer"
        >
          <span className="font-javanese text-2xl leading-[1.8] text-slate-900 dark:text-amber-100 group-hover:scale-110 transition-transform select-none">
            {item.preview || item.char}
          </span>
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight mt-0.5 truncate max-w-full">
            {item.latin}
          </span>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight truncate max-w-full">
            {item.name}
          </span>
        </button>
      ))}
    </div>
  );

  const tabs: Array<{ id: AksaraTab; label: string }> = [
    { id: 'carakan', label: 'Aksara Jawa' },
    { id: 'murda', label: 'Aksara Murda' },
    { id: 'sandhangan', label: 'Sandhangan' },
    { id: 'pasangan', label: 'Pasangan' },
    { id: 'tandabaca', label: 'Tanda Baca' },
    { id: 'angka', label: 'Angka Jawa' },
    { id: 'panduan', label: '📖 Panduan Edit' }
  ];

  const examplePresets = [
    { label: 'Sugeng Enjang', latin: 'sugeng énjjang', jv: '꧋ꦱꦸꦒꦼꦁꦲꦺꦚ꧀ꦗꦁ꧉' },
    { label: 'Mangan Sega', latin: 'mangan sega', jv: 'ꦩꦔꦤ꧀ꦱꦼꦒ' },
    { label: 'Tahun 2025', latin: 'taun 2025', jv: 'ꦠꦲꦸꦤ꧀꧇꧒꧐꧒꧕꧇' },
    { label: 'Bapak Tindak (Murda)', latin: 'Bapak tindak', jv: '꧋ꦨꦥꦏ꧀ꦠꦶꦤ꧀ꦢꦏ꧀꧉' },
    { label: 'Pancasila', latin: 'Pancasila', jv: 'ꦦꦚ꧀ꦕꦱꦶꦭ' }
  ];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-70 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-javanese text-xl font-bold shadow-xs">
              ꦲ
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Carakan, Aksara Murda, Sandhangan, Pasangan, Pada (Tanda Baca), Angka Jawa & Konverter Latin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-white/70 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* 1. Area Susun Teks Aksara Jawa + Transliterasi Cepat */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Kotak Hasil / Editor Aksara Jawa */}
            <div className="lg:col-span-7 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Papan Susun Aksara Jawa (Klik huruf di bawah atau ketik):
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="px-2 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                    title="Hapus 1 karakter terakhir"
                  >
                    <Delete className="w-3 h-3" />
                    <span>Hapus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposedText('')}
                    className="px-2 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1 cursor-pointer"
                    title="Kosongkan papan susun"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Bersihkan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!composedText}
                    className="px-2 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              <textarea
                ref={composerRef}
                rows={2}
                value={composedText}
                onChange={(e) => setComposedText(e.target.value)}
                placeholder="Klik aksara/sandhangan/pasangan di bawah atau konversi dari teks Latin..."
                className="w-full p-3 rounded-lg border border-amber-300/80 dark:border-amber-800/70 bg-white dark:bg-slate-900 text-slate-900 dark:text-amber-50 font-javanese text-2xl leading-[2.1] focus:ring-2 focus:ring-amber-500 outline-none resize-y"
              />
            </div>

            {/* Konverter Cepat Latin -> Aksara Jawa */}
            <div className="lg:col-span-5 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Konverter Cepat Latin ➔ Aksara Jawa</span>
                </span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={latinInput}
                  onChange={(e) => setLatinInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConvertLatin();
                    }
                  }}
                  placeholder="Ketik: mangan sega, 2025..."
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleConvertLatin}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>Konversi</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-slate-600 dark:text-slate-400">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAdegAdeg}
                    onChange={(e) => setUseAdegAdeg(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Awali Pada Adeg-adeg (꧋)</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wrapDigitsPangkat}
                    onChange={(e) => setWrapDigitsPangkat(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Apit Angka (꧇...꧇)</span>
                </label>
              </div>
              <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 leading-tight">
                Tips: Gunakan huruf <strong>é / è</strong> untuk bunyi taling (seperti <em>lélé</em>) dan <strong>e / ê</strong> untuk bunyi pepet (seperti <em>sega</em>). Anda dapat menyempurnakan Aksara Murda secara manual lewat tab <strong>Aksara Murda</strong>.
              </p>
            </div>
          </div>

          {/* 2. Tabs Kategori Karakter */}
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === t.id
                    ? t.id === 'panduan'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 3. Konten per Tab */}
          <div className="p-3 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 max-h-[340px] overflow-y-auto space-y-4">
            {activeTab === 'carakan' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Aksara Nglegena / Carakan (20 Huruf Dasar — Ha Na Ca Ra Ka)
                  </h4>
                  {renderKeyGrid(AKSARA_NGLEGENA, 'grid-cols-4 sm:grid-cols-5')}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Aksara Khusus (Pa Cerek, Nga Lelet), Aksara Swara & Aksara Rekan
                  </h4>
                  {renderKeyGrid(AKSARA_KHUSUS_SWARA_REKAN, 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6')}
                </div>
              </div>
            )}

            {activeTab === 'murda' && (
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aksara Murda</strong> berfungsi sebagai huruf kapital / penghormatan untuk menuliskan nama orang, gelar kehormatan, nama wilayah/kota, atau lembaga.
                  </span>
                </div>
                {renderKeyGrid(AKSARA_MURDA, 'grid-cols-3 sm:grid-cols-5')}
              </div>
            )}

            {activeTab === 'sandhangan' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Sandhangan Swara (Pengubah Bunyi Vokal — Klik tepat setelah Aksara Dasar)
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Contoh pratinjau ditampilkan dengan aksara dasar <strong>ꦲ (ha)</strong>; saat diklik hanya menyisipkan tanda sandhangannya.
                  </p>
                  {renderKeyGrid(SANDHANGAN_SWARA, 'grid-cols-3 sm:grid-cols-5')}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Sandhangan Panyigeg Wanda (Penutup Suku Kata) & Wyanjana (Gugus Konsonan)
                  </h4>
                  {renderKeyGrid(SANDHANGAN_PANYIGEG_WYANJANA, 'grid-cols-3 sm:grid-cols-4')}
                </div>
              </div>
            )}

            {activeTab === 'pasangan' && (
              <div className="space-y-4">
                <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Cara Memakai Pasangan:</strong> Ketik aksara yang ingin dimatikan vokalnya terlebih dahulu (misal <strong>ꦤ</strong>), lalu klik tombol <strong>Pasangan</strong> huruf berikutnya (misal <strong>Pasangan Sa</strong> = <strong>꧀ꦱ</strong>). Sistem otomatis menyambungkan tanda Pangkon + Aksara (ꦤ꧀ꦱ) menjadi bentuk pasangan bertumpuk!
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Pasangan Carakan (20 Aksara)
                  </h4>
                  {renderKeyGrid(PASANGAN_CARAKAN, 'grid-cols-4 sm:grid-cols-5')}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Pasangan Aksara Murda
                  </h4>
                  {renderKeyGrid(PASANGAN_MURDA, 'grid-cols-4 sm:grid-cols-4')}
                </div>
              </div>
            )}

            {activeTab === 'tandabaca' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Pada / Tanda Baca Aksara Jawa
                </h4>
                {renderKeyGrid(TANDA_BACA_JAWA, 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5')}
              </div>
            )}

            {activeTab === 'angka' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Wilangan / Angka dalam Aksara Jawa (0 – 9)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ingat: Penulisan angka Jawa dalam kalimat wajib diapit tanda Pada Pangkat (꧇...꧇).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => insertCharAtComposer('꧇꧇')}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-200 transition-colors cursor-pointer"
                  >
                    + Sisipkan Pengapit Angka (꧇...꧇)
                  </button>
                </div>
                {renderKeyGrid(ANGKA_JAWA, 'grid-cols-5')}
              </div>
            )}

            {activeTab === 'panduan' && (
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold">
                  <BookOpen className="w-4 h-4" />
                  <span>Panduan Lengkap Penulisan & Pengeditan Aksara Jawa di ExamFlow</span>
                </div>

                <div className="space-y-2.5">
                  {PANDUAN_AKSARA_JAWA.map((sec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1"
                    >
                      <h5 className="font-bold text-slate-900 dark:text-white">{sec.title}</h5>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px] font-javanese">
                        {sec.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-2">
                  <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Klik Contoh di Bawah untuk Mencoba di Papan Susun:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {examplePresets.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => insertCharAtComposer((composedText ? ' ' : '') + ex.jv)}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-left transition-colors cursor-pointer"
                      >
                        <div className="font-javanese text-base text-slate-900 dark:text-amber-100 leading-relaxed">
                          {ex.jv}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {ex.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Menghasilkan karakter Unicode Aksara Jawa standar (Noto Sans Javanese).
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Tutup
            </button>
            {onInsert && (
              <button
                type="button"
                disabled={!composedText}
                onClick={() => {
                  if (composedText) {
                    onInsert(composedText);
                    setComposedText('');
                    onClose();
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Sisipkan ke Soal / Opsi</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
