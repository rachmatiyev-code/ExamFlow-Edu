import React, { useState, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Subscript, 
  Superscript, 
  List, 
  ListOrdered, 
  Table as TableIcon, 
  Sigma, 
  Omega, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  Indent, 
  Outdent, 
  Type, 
  Palette, 
  Eye, 
  Edit3, 
  Sparkles, 
  Plus, 
  X, 
  Check,
  Code
} from 'lucide-react';
import { MathRenderer } from '../services/mathRenderer';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Ketik isi butir soal di sini...',
  rows = 5,
  label = 'Isi Butir Soal (Mendukung Teks Kaya, Tabel & Rumus Matematika)'
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [selectedFont, setSelectedFont] = useState('font-sans');
  const [selectedSize, setSelectedSize] = useState('text-sm');
  const [selectedColor, setSelectedColor] = useState('#0f172a');
  
  // State untuk dialog tabel
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableHasHeader, setTableHasHeader] = useState(true);

  // State untuk dialog rumus matematika
  const [mathFormulaInput, setMathFormulaInput] = useState('\\frac{a}{b}');
  const [mathIsBlock, setMathIsBlock] = useState(false);

  // Symbol modal active category
  const [symbolCategory, setSymbolCategory] = useState<'math' | 'greek' | 'arrow' | 'science'>('math');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper untuk menyisipkan teks atau membungkus seleksi di kursor
  const insertTextAtCursor = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value + before + defaultText + after);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;
    const replacement = before + selectedText + after;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  // Keyboard handler untuk Tab key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      // Sisipkan tab non-breaking space
      insertTextAtCursor('&emsp;&emsp;', '');
    }
  };

  // Preset rumus matematika populer
  const mathPresets = [
    { label: 'Pecahan', latex: '\\frac{a}{b}' },
    { label: 'Akar Kuadrat', latex: '\\sqrt{x}' },
    { label: 'Akar Pangkat n', latex: '\\sqrt[n]{x}' },
    { label: 'Pangkat', latex: 'x^{2}' },
    { label: 'Subskrip/Indeks', latex: 'x_{1}' },
    { label: 'Jumlah (Sigma)', latex: '\\sum_{i=1}^{n} x_i' },
    { label: 'Integral Tertentu', latex: '\\int_{a}^{b} f(x)\\,dx' },
    { label: 'Limit', latex: '\\lim_{x \\to \\infty} f(x)' },
    { label: 'Rumus ABC (Kuadrat)', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
    { label: 'Matriks 2x2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
    { label: 'Trigonometri', latex: '\\sin^2(\\theta) + \\cos^2(\\theta) = 1' },
    { label: 'Vektor Gaya', latex: '\\vec{F} = m \\cdot \\vec{a}' },
    { label: 'Kimia (Air)', latex: '\\text{H}_2\\text{O}' },
    { label: 'Kimia (CO2)', latex: '\\text{CO}_2' }
  ];

  // Simbol-simbol ber-kategori
  const symbolCategories = {
    math: {
      name: 'Matematika',
      symbols: ['±', '×', '÷', '≠', '≤', '≥', '≈', '≡', '∞', '√', '∛', '∑', '∏', '∫', '∬', '∂', '∆', '∇', '°', '∠', '⊥', '∥', '∈', '∉', '⊂', '⊃', '∪', '∩', '∅', '‰']
    },
    greek: {
      name: 'Huruf Yunani',
      symbols: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'Γ', 'Δ', 'Θ', 'Λ', 'Ξ', 'Π', 'Σ', 'Φ', 'Ψ', 'Ω']
    },
    arrow: {
      name: 'Panah & Logika',
      symbols: ['←', '↑', '→', '↓', '↔', '↕', '⇒', '⇔', '⇑', '⇓', '∧', '∨', '¬', '∀', '∃', '∴', '∵']
    },
    science: {
      name: 'Sains & Satuan',
      symbols: ['℃', '℉', 'Å', 'µm', 'nm', 'Ω', 'Hz', 'J', 'N', 'Pa', 'W', 'V', 'mol', 'atm', '✓', '✗', '©', '®', '™', '§']
    }
  };

  // Buat HTML tabel
  const handleInsertTable = () => {
    let tableHtml = '\n<table class="w-full my-3 border-collapse border border-slate-300 dark:border-slate-700 text-xs text-left">\n';
    
    if (tableHasHeader) {
      tableHtml += '  <thead>\n    <tr class="bg-slate-100 dark:bg-slate-800">\n';
      for (let c = 1; c <= tableCols; c++) {
        tableHtml += `      <th class="border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-bold">Judul Kolom ${c}</th>\n`;
      }
      tableHtml += '    </tr>\n  </thead>\n';
    }

    tableHtml += '  <tbody>\n';
    const numBodyRows = tableHasHeader ? Math.max(1, tableRows - 1) : tableRows;
    for (let r = 1; r <= numBodyRows; r++) {
      tableHtml += '    <tr>\n';
      for (let c = 1; c <= tableCols; c++) {
        tableHtml += `      <td class="border border-slate-300 dark:border-slate-700 px-3 py-1.5">Data ${r}-${c}</td>\n`;
      }
      tableHtml += '    </tr>\n';
    }
    tableHtml += '  </tbody>\n</table>\n';

    insertTextAtCursor(tableHtml);
    setIsTableModalOpen(false);
  };

  // Sisipkan rumus matematika
  const handleInsertMath = () => {
    if (!mathFormulaInput.trim()) return;
    const delimiter = mathIsBlock ? '$$' : '$';
    const textToInsert = `${delimiter}${mathFormulaInput.trim()}${delimiter}`;
    insertTextAtCursor(textToInsert);
    setIsMathModalOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Label and Mode Switcher */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
              activeTab === 'edit'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
              activeTab === 'preview'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Pratinjau Nyata</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
        {/* COMPREHENSIVE TOOLBAR */}
        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-1.5 flex flex-wrap items-center gap-1 text-slate-700 dark:text-slate-300">
          
          {/* 1. FONT FAMILY SELECTOR */}
          <div className="flex items-center gap-1 pr-1 border-r border-slate-200 dark:border-slate-800">
            <select
              value={selectedFont}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFont(val);
                insertTextAtCursor(`<span class="${val}">`, '</span>', 'teks');
              }}
              className="text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-slate-800 dark:text-slate-200"
              title="Pilih Jenis Font"
            >
              <option value="font-sans">Font: Inter (Sans)</option>
              <option value="font-serif">Font: Times (Serif)</option>
              <option value="font-mono">Font: JetBrains (Mono)</option>
              <option value="[font-family:Arial,sans-serif]">Font: Arial</option>
              <option value="[font-family:Georgia,serif]">Font: Georgia</option>
              <option value="[font-family:'Comic_Sans_MS',cursive]">Font: Comic Sans</option>
            </select>
          </div>

          {/* 2. FONT SIZE SELECTOR */}
          <div className="flex items-center gap-1 pr-1 border-r border-slate-200 dark:border-slate-800">
            <select
              value={selectedSize}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSize(val);
                insertTextAtCursor(`<span class="${val}">`, '</span>', 'teks');
              }}
              className="text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-slate-800 dark:text-slate-200"
              title="Ukuran Font"
            >
              <option value="text-xs">12px (Kecil)</option>
              <option value="text-sm">14px (Standar)</option>
              <option value="text-base">16px (Sedang)</option>
              <option value="text-lg">18px (Besar)</option>
              <option value="text-xl">20px (Sangat Besar)</option>
              <option value="text-2xl">24px (Judul)</option>
            </select>
          </div>

          {/* 3. FONT COLOR PALETTE */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-800">
            <label className="cursor-pointer p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center" title="Pilih Warna Font">
              <Palette className="w-3.5 h-3.5 mr-0.5" />
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => {
                  const color = e.target.value;
                  setSelectedColor(color);
                  insertTextAtCursor(`<span style="color: ${color}">`, '</span>', 'teks');
                }}
                className="w-3.5 h-3.5 p-0 border-0 rounded cursor-pointer"
              />
            </label>
            {[
              { color: '#0f172a', name: 'Hitam' },
              { color: '#2563eb', name: 'Biru' },
              { color: '#059669', name: 'Hijau' },
              { color: '#d97706', name: 'Kuning' },
              { color: '#e11d48', name: 'Merah' },
              { color: '#7c3aed', name: 'Ungu' }
            ].map(c => (
              <button
                key={c.color}
                type="button"
                onClick={() => insertTextAtCursor(`<span style="color: ${c.color}">`, '</span>', 'teks')}
                style={{ backgroundColor: c.color }}
                className="w-3.5 h-3.5 rounded-full border border-white dark:border-slate-900 hover:scale-125 transition-transform"
                title={`Warna: ${c.name}`}
              />
            ))}
          </div>

          {/* 4. BASIC STYLES: BOLD, ITALIC, UNDERLINE, STRIKE */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => insertTextAtCursor('<b>', '</b>', 'teks tebal')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Cetak Tebal (Bold)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('<i>', '</i>', 'teks miring')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Cetak Miring (Italic)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('<u>', '</u>', 'garis bawah')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Garis Bawah (Underline)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('<s>', '</s>', 'coret')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Coret Teks (Strikethrough)"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 5. SUBSCRIPT & SUPERSCRIPT */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => insertTextAtCursor('<sub>', '</sub>', '2')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-0.5 text-xs font-semibold"
              title="Subscript (Indeks Bawah, misal H₂O)"
            >
              <Subscript className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('<sup>', '</sup>', '2')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-0.5 text-xs font-semibold"
              title="Superscript (Pangkat Atas, misal x²)"
            >
              <Superscript className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 6. LISTS: BULLETS & NUMBERING */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => insertTextAtCursor('\n<ul class="list-disc pl-5 my-2 space-y-1">\n  <li>Poin pertama</li>\n  <li>Poin kedua</li>\n</ul>\n')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Daftar Simbol (Bullet List)"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('\n<ol class="list-decimal pl-5 my-2 space-y-1">\n  <li>Langkah kesatu</li>\n  <li>Langkah kedua</li>\n</ol>\n')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Daftar Bernomor (Numbered List)"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 7. INDENTASI & TAB */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => insertTextAtCursor('&emsp;&emsp;', '')}
              className="px-2 py-1 text-[11px] font-mono font-bold rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400"
              title="Penentuan Tab (Sisipkan Indentasi Tab 4 Spasi)"
            >
              Tab ⇥
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('\n<div class="pl-8 my-2 border-l-2 border-indigo-200 dark:border-indigo-800">\n', '\n</div>\n', 'Paragraf menjorok ke dalam...')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Tambah Indentasi Paragraf (Indent)"
            >
              <Indent className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('\n<p class="mb-3 leading-relaxed">\n', '\n</p>\n', 'Paragraf baru...')}
              className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Paragraf Baru (Multi-Paragraf)"
            >
              ¶ Paragraf
            </button>
          </div>

          {/* 8. ALIGNMENT */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => insertTextAtCursor('<div class="text-left">', '</div>', 'teks rata kiri')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Rata Kiri"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('<div class="text-center">', '</div>', 'teks tengah')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Rata Tengah"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('<div class="text-right">', '</div>', 'teks rata kanan')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Rata Kanan"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertTextAtCursor('<div class="text-justify leading-relaxed">', '</div>', 'paragraf rata kanan kiri')}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Rata Kanan Kiri (Justify)"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 9. PEMBUATAN TABEL */}
          <button
            type="button"
            onClick={() => setIsTableModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
            title="Buat Tabel Terstruktur"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Tabel</span>
          </button>

          {/* 10. INSERT SIMBOL */}
          <button
            type="button"
            onClick={() => setIsSymbolModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors"
            title="Sisipkan Simbol Khusus Matematika & Sains"
          >
            <Omega className="w-3.5 h-3.5" />
            <span>Simbol</span>
          </button>

          {/* 11. INSERT RUMUS MATEMATIKA (KATEX) */}
          <button
            type="button"
            onClick={() => setIsMathModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-2xs transition-all"
            title="Sisipkan Rumus Matematika (LaTeX / KaTeX)"
          >
            <Sigma className="w-3.5 h-3.5" />
            <span>Rumus Matematika</span>
          </button>
        </div>

        {/* CONTENT AREA: EDITOR vs LIVE PREVIEW */}
        {activeTab === 'edit' ? (
          <textarea
            ref={textareaRef}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full p-3.5 text-xs font-mono leading-relaxed bg-transparent text-slate-900 dark:text-white outline-none resize-y min-h-[120px]"
          />
        ) : (
          <div className="p-4 min-h-[120px] max-h-[350px] overflow-y-auto bg-slate-50/60 dark:bg-slate-900/60 text-xs text-slate-900 dark:text-slate-100 leading-relaxed border-t border-slate-100 dark:border-slate-800">
            {value.trim() ? (
              <div 
                className="prose dark:prose-invert max-w-none text-xs"
                dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(value) }}
              />
            ) : (
              <p className="text-slate-400 italic">
                Belum ada teks soal yang ditulis. Beralih ke tab "Editor" untuk mulai mengetik.
              </p>
            )}
          </div>
        )}

        {/* Footer info bar */}
        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span>Dukung: HTML, KaTeX ($...$ &amp; $$...$$), Tabel, Simbol</span>
          </div>
          <div>
            <span>{value.length} karakter</span>
          </div>
        </div>
      </div>

      {/* =========================================================
          MODAL 1: PEMBUATAN TABEL
         ========================================================= */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <TableIcon className="w-5 h-5" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Buat Tabel Soal</h4>
              </div>
              <button 
                type="button" 
                onClick={() => setIsTableModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Jumlah Baris
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={tableRows}
                    onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Jumlah Kolom
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={tableCols}
                    onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={tableHasHeader}
                  onChange={(e) => setTableHasHeader(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium">Jadikan baris pertama sebagai Header (Judul Kolom)</span>
              </label>

              {/* Preview Grid */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 overflow-x-auto">
                <span className="block font-bold mb-1.5 text-slate-700 dark:text-slate-300">Pratinjau Struktur Tabel ({tableRows} x {tableCols}):</span>
                <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-[10px]">
                  <tbody>
                    {Array.from({ length: Math.min(tableRows, 4) }).map((_, r) => (
                      <tr key={r}>
                        {Array.from({ length: Math.min(tableCols, 5) }).map((_, c) => (
                          <td key={c} className={`border border-slate-300 dark:border-slate-700 px-2 py-1 text-center ${r === 0 && tableHasHeader ? 'bg-indigo-50 dark:bg-indigo-950/70 font-bold' : ''}`}>
                            {r === 0 && tableHasHeader ? `H${c + 1}` : `${r + 1},${c + 1}`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleInsertTable}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Sisipkan Tabel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: INSERT SIMBOL
         ========================================================= */}
      {isSymbolModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Omega className="w-5 h-5" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Sisipkan Simbol Khusus</h4>
              </div>
              <button 
                type="button" 
                onClick={() => setIsSymbolModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {(Object.keys(symbolCategories) as Array<keyof typeof symbolCategories>).map(catKey => (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setSymbolCategory(catKey)}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    symbolCategory === catKey
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {symbolCategories[catKey].name}
                </button>
              ))}
            </div>

            {/* Symbol Grid */}
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 max-h-60 overflow-y-auto">
              {symbolCategories[symbolCategory].symbols.map((sym, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    insertTextAtCursor(sym);
                    setIsSymbolModalOpen(false);
                  }}
                  className="h-10 text-base font-medium rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-950 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-center transition-all hover:scale-110"
                  title={`Sisipkan simbol ${sym}`}
                >
                  {sym}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Klik simbol mana saja untuk langsung menyisipkan ke kursor soal.</span>
              <button
                type="button"
                onClick={() => setIsSymbolModalOpen(false)}
                className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: INSERT RUMUS MATEMATIKA (KATEX / LATEX)
         ========================================================= */}
      {isMathModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Sigma className="w-5 h-5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Editor Rumus Matematika (KaTeX)</h4>
                  <p className="text-[11px] text-slate-500">Pilih rumus cepat atau ketik sintaks LaTeX matematika</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsMathModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Presets Grid */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Pilih Rumus Cepat:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {mathPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMathFormulaInput(preset.latex)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-950 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Formula Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sintaks LaTeX Rumus:
              </label>
              <textarea
                rows={2}
                value={mathFormulaInput}
                onChange={(e) => setMathFormulaInput(e.target.value)}
                placeholder="Misal: \\frac{a}{b} atau \\sqrt{x^2 + y^2}"
                className="w-full p-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Display Mode: Inline vs Block */}
            <div className="flex items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="mathMode"
                  checked={!mathIsBlock}
                  onChange={() => setMathIsBlock(false)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Inline ($...$ dalam baris kalimat)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="mathMode"
                  checked={mathIsBlock}
                  onChange={() => setMathIsBlock(true)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Block ($$...$$ terpusat di baris sendiri)</span>
              </label>
            </div>

            {/* Live KaTeX Render Preview */}
            <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-center">
              <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                Pratinjau Hasil Rumus:
              </span>
              <div 
                className="py-2 overflow-x-auto text-sm text-slate-900 dark:text-white flex items-center justify-center min-h-[40px]"
                dangerouslySetInnerHTML={{ 
                  __html: MathRenderer.renderFormula(mathFormulaInput, mathIsBlock) 
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsMathModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleInsertMath}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Sisipkan Rumus ke Soal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
