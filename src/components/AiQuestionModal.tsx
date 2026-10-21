import React, { useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Target, 
  Download, 
  Plus, 
  AlertCircle, 
  Save, 
  RefreshCw,
  BookOpen,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { Exam, CurriculumItem } from '../types';
import { StorageService } from '../services/storage';

interface AiQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: Exam[];
  selectedExamId: string;
  onSelectExamId: (id: string) => void;
  curriculumList: CurriculumItem[];
  aiTopic: string;
  setAiTopic: (topic: string) => void;
  aiLearningObjectives: string[];
  setAiLearningObjectives: React.Dispatch<React.SetStateAction<string[]>>;
  newAiTpInput: string;
  setNewAiTpInput: (input: string) => void;
  aiQuestionType: 'multiple_choice' | 'checkbox' | 'true_false' | 'essay' | 'mixed';
  setAiQuestionType: (type: 'multiple_choice' | 'checkbox' | 'true_false' | 'essay' | 'mixed') => void;
  aiCount: number;
  setAiCount: (count: number) => void;
  aiDifficulty: 'Mudah' | 'Sedang' | 'Sukar';
  setAiDifficulty: (difficulty: 'Mudah' | 'Sedang' | 'Sukar') => void;
  aiTaxonomy: 'bloom' | 'solo';
  setAiTaxonomy: (taxonomy: 'bloom' | 'solo') => void;
  isGeneratingAi: boolean;
  aiMessage: string | null;
  onGenerate: () => Promise<void>;
  onOpenSettings?: () => void;
}

export const AiQuestionModal: React.FC<AiQuestionModalProps> = ({
  isOpen,
  onClose,
  exams,
  selectedExamId,
  onSelectExamId,
  curriculumList,
  aiTopic,
  setAiTopic,
  aiLearningObjectives,
  setAiLearningObjectives,
  newAiTpInput,
  setNewAiTpInput,
  aiQuestionType,
  setAiQuestionType,
  aiCount,
  setAiCount,
  aiDifficulty,
  setAiDifficulty,
  aiTaxonomy,
  setAiTaxonomy,
  isGeneratingAi,
  aiMessage,
  onGenerate,
  onOpenSettings
}) => {
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Tutup menu dengan tombol "Esc" (dukung keydown capture phase agar selalu tertangkap)
  useEffect(() => {
    if (!isOpen) return;

    // Auto focus container saat modal terbuka
    modalContainerRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const targetExamObj = exams.find(e => e.id === (selectedExamId || exams[0]?.id)) || exams[0];
  const currentCount = targetExamObj ? StorageService.getQuestionsByExamId(targetExamObj.id).length : 0;
  const hasGeminiKey = Boolean(StorageService.getSettings().geminiApiKey?.trim());

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGeneratingAi) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn"
    >
      <div 
        ref={modalContainerRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="outline-none bg-white dark:bg-slate-900 rounded-2xl w-[96vw] max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header (Sticky, Wide) */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Generator Soal Otomatis (Gemini AI)
                </h3>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                  Kurikulum Merdeka & HOTS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tampilan melebar berbasis multi-kolom responsif untuk penyusunan soal berstandar tinggi
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-2.5 py-1 rounded-lg font-mono">
              <kbd className="font-bold">Esc</kbd>
              <span>untuk menutup</span>
            </span>
            <button 
              type="button"
              disabled={isGeneratingAi}
              onClick={onClose} 
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Tutup Menu (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body (Wide Multi-Column Grid) */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4">
          {aiMessage && (
            <div className="p-3 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 animate-pulse" />
              <span>{aiMessage}</span>
            </div>
          )}

          {/* Grid Layout: 3 Columns on XL (1280px+), 2 Columns on MD/LG, 1 Column on Mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
            
            {/* =========================================================
                KOLOM 1: Identitas Mapel, Topik & CP/Elemen
               ========================================================= */}
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 pb-1 border-b border-slate-200 dark:border-slate-800">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>1. Mata Pelajaran & Kurikulum</span>
              </div>

              {/* Mata Pelajaran & Kelas Tujuan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mata Pelajaran & Kelas Tujuan
                </label>
                <select
                  value={selectedExamId || exams[0]?.id || ''}
                  onChange={(e) => onSelectExamId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-indigo-500"
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.subject} — Kelas {e.grade} ({e.title})
                    </option>
                  ))}
                </select>

                {/* Info Card Mata Pelajaran & Kelas */}
                {targetExamObj && (
                  <div className="mt-2 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-1.5 truncate">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{targetExamObj.subject}</span>
                      <span>·</span>
                      <span className="font-semibold">Kelas {targetExamObj.grade}</span>
                      <span>·</span>
                      <span className="text-slate-500 truncate max-w-[130px]">{targetExamObj.title}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0 font-bold">
                      {currentCount} Soal Ada
                    </span>
                  </div>
                )}
              </div>

              {/* Topic / Materi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Topik / Pokok Bahasan Materi
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Contoh: Hukum Archimedes & Tekanan Zat Cair"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Dropdown Capaian Pembelajaran & Elemen (Kurikulum Merdeka) */}
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Capaian Pembelajaran (CP) & Elemen</span>
                  </label>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
                    {curriculumList.length} CP Tersedia
                  </span>
                </div>

                <select
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (!selectedId) return;
                    const cur = curriculumList.find(c => c.id === selectedId);
                    if (cur) {
                      setAiTopic(`${cur.subject}: ${cur.element}`);
                      if (cur.learningObjectives && cur.learningObjectives.length > 0) {
                        setAiLearningObjectives(cur.learningObjectives.slice(0, 15));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                >
                  <option value="">-- Pilih Capaian Pembelajaran / Elemen --</option>
                  {curriculumList.map((cur) => (
                    <option key={cur.id} value={cur.id}>
                      [{cur.subject}] {cur.element} — {cur.learningOutcome.length > 50 ? cur.learningOutcome.slice(0, 50) + '...' : cur.learningOutcome}
                    </option>
                  ))}
                </select>

                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                  Memilih CP otomatis mengisi topik dan menyalin butir Tujuan Pembelajaran yang sesuai.
                </p>
              </div>
            </div>

            {/* =========================================================
                KOLOM 2: Tujuan Pembelajaran (TP) — Hingga 15 TP
               ========================================================= */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>2. Tujuan Pembelajaran (TP)</span>
                </div>
                <div className="flex items-center gap-2">
                  {targetExamObj?.learningObjectives && targetExamObj.learningObjectives.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAiLearningObjectives(targetExamObj.learningObjectives!.slice(0, 15));
                      }}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      title="Ambil daftar TP dari konfigurasi data ujian ini"
                    >
                      <Download className="w-3 h-3" />
                      <span>Dari Ujian</span>
                    </button>
                  )}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                    {aiLearningObjectives.length}/15 TP
                  </span>
                </div>
              </div>

              {/* Quick Select TP from Curriculum */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Ambil Cepat TP dari Bank Kurikulum:
                </label>
                <select
                  onChange={(e) => {
                    const tpVal = e.target.value;
                    if (tpVal && !aiLearningObjectives.includes(tpVal) && aiLearningObjectives.length < 15) {
                      setAiLearningObjectives(prev => [...prev, tpVal]);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">-- Pilih TP dari Kurikulum untuk Ditambahkan --</option>
                  {curriculumList.flatMap(c => c.learningObjectives.map((tp, idx) => ({ key: `${c.id}-${idx}`, label: `[${c.subject}] ${tp}`, text: tp }))).map(item => (
                    <option key={item.key} value={item.text} disabled={aiLearningObjectives.includes(item.text)}>
                      {item.label.length > 55 ? item.label.slice(0, 55) + '...' : item.label} {aiLearningObjectives.includes(item.text) ? '(Sudah Ada)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input Manual TP */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Atau Tambah TP Baru Secara Manual:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAiTpInput}
                    onChange={(e) => setNewAiTpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newAiTpInput.trim() && aiLearningObjectives.length < 15) {
                          setAiLearningObjectives(prev => [...prev, newAiTpInput.trim()]);
                          setNewAiTpInput('');
                        }
                      }
                    }}
                    placeholder="Ketik rumusan TP..."
                    disabled={aiLearningObjectives.length >= 15}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newAiTpInput.trim() && aiLearningObjectives.length < 15) {
                        setAiLearningObjectives(prev => [...prev, newAiTpInput.trim()]);
                        setNewAiTpInput('');
                      }
                    }}
                    disabled={aiLearningObjectives.length >= 15 || !newAiTpInput.trim()}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>

              {/* TP List Chips (Scrollable with max height) */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 max-h-56 overflow-y-auto">
                {aiLearningObjectives.map((tp, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                    <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded shrink-0">
                      TP {idx + 1}
                    </span>
                    <span className="flex-1 text-[11px] text-slate-800 dark:text-slate-200 leading-tight">
                      {tp}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAiLearningObjectives(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-slate-400 hover:text-rose-500 p-0.5 transition-colors"
                      title="Hapus TP ini"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {aiLearningObjectives.length === 0 && (
                  <div className="py-4 text-center">
                    <p className="text-[11px] text-slate-400 italic">
                      Belum ada Tujuan Pembelajaran yang dipilih.
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Tambahkan minimal 1 TP agar sebaran butir soal lebih terarah.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* =========================================================
                KOLOM 3: Parameter Soal & Mutu
               ========================================================= */}
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 pb-1 border-b border-slate-200 dark:border-slate-800">
                <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>3. Format Soal & Taksonomi</span>
              </div>

              {/* Bentuk Soal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bentuk Soal
                </label>
                <select
                  value={aiQuestionType}
                  onChange={(e: any) => setAiQuestionType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="multiple_choice">Pilihan Ganda Biasa (1 Jawaban Benar)</option>
                  <option value="checkbox">Pilihan Ganda Kompleks (Multi Jawaban Benar)</option>
                  <option value="true_false">Benar / Salah (2 Opsi)</option>
                  <option value="essay">Uraian / Isian Singkat</option>
                  <option value="mixed">Campuran / Variatif (PG, PG Kompleks & Uraian)</option>
                </select>
              </div>

              {/* Jumlah Soal */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Jumlah Soal
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {aiCount} Butir Soal
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={aiCount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAiCount(Math.min(50, Math.max(1, isNaN(val) ? 1 : val)));
                    }}
                    className="w-20 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-1 flex-1">
                    {[5, 10, 15, 20, 25, 30, 40, 50].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setAiCount(cnt)}
                        className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors ${
                          aiCount === cnt
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tingkat Kesulitan & Kerangka Taksonomi */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tingkat Kesulitan
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e: any) => setAiDifficulty(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="Mudah">Mudah</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Sukar">Sukar (HOTS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Taksonomi
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setAiTaxonomy('bloom')}
                      className={`py-1.5 text-[11px] font-semibold rounded-lg border text-center transition-all ${
                        aiTaxonomy === 'bloom'
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-600 text-indigo-700 dark:text-indigo-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Bloom
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiTaxonomy('solo')}
                      className={`py-1.5 text-[11px] font-semibold rounded-lg border text-center transition-all ${
                        aiTaxonomy === 'solo'
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-600 text-indigo-700 dark:text-indigo-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      SOLO
                    </button>
                  </div>
                </div>
              </div>

              {/* Standar Mutu AI */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Kaidah Penulisan Soal:</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">
                  Dilengkapi kunci jawaban terverifikasi, rubrik pembahasan, serta langsung tersimpan ke bank soal dan tersinkronisasi.
                </p>
              </div>

              {/* Warning if API key is missing */}
              {!hasGeminiKey && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-[11px]">Kunci API Gemini belum diatur.</p>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenSettings();
                        }}
                        className="mt-1.5 px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                      >
                        Buka Menu Pengaturan
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer (Sticky) */}
        <div className="px-5 sm:px-7 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Tekan</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 shadow-2xs font-semibold">
              Esc
            </kbd>
            <span>atau tombol Batal untuk menutup</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={isGeneratingAi}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
            >
              Batal (Esc)
            </button>
            <button
              type="button"
              disabled={isGeneratingAi}
              onClick={onGenerate}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {isGeneratingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isGeneratingAi ? 'Menghasilkan & Menyimpan Soal...' : `Generate & Simpan (${aiCount} Soal AI)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
