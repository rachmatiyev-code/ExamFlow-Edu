import React, { useState, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Subscript, 
  Superscript, 
  Sigma, 
  Omega, 
  Eye, 
  EyeOff, 
  Trash2, 
  Check, 
  X, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { QuestionOption } from '../types';
import { MathRenderer } from '../services/mathRenderer';

interface OptionRichTextEditorProps {
  option: QuestionOption;
  index: number;
  isCorrect: boolean;
  type: 'multiple_choice' | 'checkbox';
  onToggleCorrect: () => void;
  onChangeText: (newText: string) => void;
  onDelete?: () => void;
  totalOptions: number;
}

export const OptionRichTextEditor: React.FC<OptionRichTextEditorProps> = ({
  option,
  index,
  isCorrect,
  type,
  onToggleCorrect,
  onChangeText,
  onDelete,
  totalOptions
}) => {
  const [showMathModal, setShowMathModal] = useState(false);
  const [showSymbolModal, setShowSymbolModal] = useState(false);
  const [mathInput, setMathInput] = useState('\\frac{1}{2}');
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [symbolCategory, setSymbolCategory] = useState<'math' | 'greek' | 'science'>('math');
  const inputRef = useRef<HTMLInputElement>(null);

  const letter = String.fromCharCode(65 + index);

  // Deteksi apakah teks opsi mengandung rumus atau HTML format
  const hasFormattingOrMath = Boolean(
    option.text && (
      option.text.includes('$') || 
      option.text.includes('<') || 
      option.text.includes('\\') || 
      option.text.includes('^') || 
      option.text.includes('_{')
    )
  );

  const insertAtCursor = (before: string, after: string = '', defaultText: string = '') => {
    const input = inputRef.current;
    if (!input) {
      onChangeText((option.text || '') + before + defaultText + after);
      return;
    }

    const start = input.selectionStart ?? option.text.length;
    const end = input.selectionEnd ?? option.text.length;
    const currentVal = option.text || '';
    const selected = currentVal.substring(start, end) || defaultText;
    const replacement = before + selected + after;
    const nextVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    onChangeText(nextVal);

    setTimeout(() => {
      input.focus();
      const nextPos = start + before.length + selected.length;
      input.setSelectionRange(nextPos, nextPos);
    }, 15);
  };

  const mathPresets = [
    { label: 'Pecahan', latex: '\\frac{1}{2}' },
    { label: 'Akar', latex: '\\sqrt{x}' },
    { label: 'Kuadrat', latex: 'x^2' },
    { label: 'Subskrip', latex: 'x_1' },
    { label: 'Persen', latex: '25\\%' },
    { label: 'Derajat', latex: '90^\\circ' },
    { label: 'Perkalian', latex: 'a \\times b' },
    { label: 'Pembagian', latex: 'a \\div b' },
    { label: 'Kurang Lebih', latex: '\\pm 5' },
    { label: 'Tidak Sama', latex: 'a \\neq b' },
    { label: 'Kurang Dari / Sama', latex: 'x \\le 10' },
    { label: 'Lebih Dari / Sama', latex: 'x \\ge 0' },
    { label: 'Air (H2O)', latex: '\\text{H}_2\\text{O}' },
    { label: 'CO2', latex: '\\text{CO}_2' },
    { label: 'Phi r kuadrat', latex: '\\pi r^2' }
  ];

  const symbolsMap = {
    math: ['±', '×', '÷', '≠', '≤', '≥', '≈', '√', 'π', '°', '‰', '½', '¼', '¾', '∞', '∑', '∫'],
    greek: ['α', 'β', 'γ', 'δ', 'θ', 'λ', 'μ', 'π', 'ρ', 'σ', 'ω', 'Δ', 'Ω'],
    science: ['℃', '℉', 'Å', 'µm', 'Ω', 'Hz', 'J', 'N', 'W', 'V', 'mol', '✓', '✗']
  };

  return (
    <div className={`p-2.5 rounded-xl border transition-all ${
      isCorrect 
        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-2xs' 
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
    }`}>
      {/* Baris Utama: Selector Benar, Badge Huruf, Input Teks & Toolbar */}
      <div className="flex items-center gap-2">
        {/* Tombol Radio / Checkbox Kunci Benar */}
        <button
          type="button"
          onClick={onToggleCorrect}
          className={`shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
            type === 'checkbox'
              ? `w-5 h-5 rounded-md border ${
                  isCorrect
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-transparent hover:border-emerald-500'
                }`
              : `w-5 h-5 rounded-full border-2 ${
                  isCorrect
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-transparent hover:border-emerald-500'
                }`
          }`}
          title={isCorrect ? 'Kunci Benar (Klik untuk batal)' : 'Klik untuk jadikan kunci jawaban benar'}
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </button>

        {/* Badge Huruf (A, B, C, D, E) */}
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs font-mono shrink-0 select-none ${
          isCorrect
            ? 'bg-emerald-600 text-white shadow-2xs'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
        }`}>
          {letter}
        </span>

        {/* Input Teks Opsi */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={option.text || ''}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder={`Ketik teks opsi ${letter} (gunakan tombol rumus & format di samping)...`}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
          />
        </div>

        {/* Quick Toolbar (Bold, Italic, Sub, Super, Math, Symbol, Preview, Delete) */}
        <div className="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => insertAtCursor('<strong>', '</strong>', 'teks tebal')}
            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Tebal (Bold)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor('<em>', '</em>', 'teks miring')}
            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Miring (Italic)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor('<u>', '</u>', 'teks garis bawah')}
            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Garis Bawah (Underline)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor('<sub>', '</sub>', '2')}
            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Subskrip (misal: H₂O)"
          >
            <Subscript className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor('<sup>', '</sup>', '2')}
            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Superskrip (misal: cm²)"
          >
            <Superscript className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700 my-auto" />

          {/* Tombol Sisipkan Rumus Matematika KaTeX */}
          <button
            type="button"
            onClick={() => setShowMathModal(!showMathModal)}
            className={`p-1 rounded transition-colors flex items-center gap-0.5 ${
              showMathModal 
                ? 'bg-indigo-600 text-white' 
                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
            }`}
            title="Sisipkan Rumus Matematika / KaTeX"
          >
            <Sigma className="w-3.5 h-3.5" />
          </button>

          {/* Tombol Sisipkan Simbol Khusus */}
          <button
            type="button"
            onClick={() => setShowSymbolModal(!showSymbolModal)}
            className={`p-1 rounded transition-colors ${
              showSymbolModal 
                ? 'bg-indigo-600 text-white' 
                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
            }`}
            title="Sisipkan Simbol Khusus (±, ×, ÷, °, π, dll)"
          >
            <Omega className="w-3.5 h-3.5" />
          </button>

          {/* Tombol Pratinjau Nyata */}
          <button
            type="button"
            onClick={() => setShowLivePreview(!showLivePreview)}
            className={`p-1 rounded transition-colors ${
              showLivePreview || hasFormattingOrMath
                ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
            }`}
            title={showLivePreview ? 'Sembunyikan Pratinjau' : 'Lihat Pratinjau Tampilan Rumus'}
          >
            {showLivePreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          {/* Tombol Hapus Opsi (hanya jika opsi > 2) */}
          {totalOptions > 2 && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
              title="Hapus Opsi Ini"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Popover / Panel Mini Sisipkan Rumus Matematika */}
      {showMathModal && (
        <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2 animate-fadeIn text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
              <Sigma className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Pilih atau Ketik Rumus Matematika (KaTeX) untuk Opsi {letter}:</span>
            </span>
            <button
              type="button"
              onClick={() => setShowMathModal(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1">
            {mathPresets.map((p, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => {
                  insertAtCursor(`$${p.latex}$`, '');
                  setShowMathModal(false);
                  setShowLivePreview(true);
                }}
                className="px-2 py-0.5 bg-white dark:bg-slate-900 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
                title={`Sisipkan ${p.label}: $${p.latex}$`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom LaTeX input */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="font-mono text-slate-500 text-[11px]">$</span>
            <input
              type="text"
              value={mathInput}
              onChange={(e) => setMathInput(e.target.value)}
              placeholder="Ketik LaTeX, misal: \frac{a}{b} atau \sqrt{16}"
              className="flex-1 px-2.5 py-1 text-xs rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 font-mono"
            />
            <span className="font-mono text-slate-500 text-[11px]">$</span>
            <button
              type="button"
              onClick={() => {
                if (mathInput.trim()) {
                  insertAtCursor(`$${mathInput.trim()}$`, '');
                  setShowMathModal(false);
                  setShowLivePreview(true);
                }
              }}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded text-xs transition-colors"
            >
              Sisipkan
            </button>
          </div>
        </div>
      )}

      {/* Popover / Panel Mini Sisipkan Simbol Khusus */}
      {showSymbolModal && (
        <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2 animate-fadeIn text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-indigo-900 dark:text-indigo-200">
                Pilih Simbol:
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSymbolCategory('math')}
                  className={`px-1.5 py-0.5 rounded ${symbolCategory === 'math' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  Matematika
                </button>
                <button
                  type="button"
                  onClick={() => setSymbolCategory('greek')}
                  className={`px-1.5 py-0.5 rounded ${symbolCategory === 'greek' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  Yunani
                </button>
                <button
                  type="button"
                  onClick={() => setSymbolCategory('science')}
                  className={`px-1.5 py-0.5 rounded ${symbolCategory === 'science' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  Sains
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSymbolModal(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {symbolsMap[symbolCategory].map((sym, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onClick={() => {
                  insertAtCursor(sym, '');
                }}
                className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-900 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded font-bold text-xs transition-colors shadow-2xs"
                title={`Sisipkan simbol ${sym}`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pratinjau Tampilan Nyata (KaTeX & HTML Rendered) */}
      {(showLivePreview || hasFormattingOrMath) && Boolean(option.text && option.text.trim()) && (
        <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-xs flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded shrink-0">
            Tampilan Opsi {letter}:
          </span>
          <div 
            className="flex-1 text-slate-800 dark:text-slate-200 leading-normal break-words font-medium overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(option.text) }}
          />
          {isCorrect && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              <span>Kunci Benar</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
