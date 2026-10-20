import React, { useState } from 'react';
import { 
  Target, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  BookOpen, 
  Layers, 
  Sparkles, 
  FileCheck, 
  Filter, 
  Search, 
  RotateCcw,
  Check,
  ChevronRight,
  GraduationCap
} from 'lucide-react';
import { CurriculumItem, Exam } from '../types';

interface CurriculumManagementProps {
  curriculumList: CurriculumItem[];
  onSaveCurriculum: (item: CurriculumItem) => Promise<void>;
  onDeleteCurriculum: (id: string) => Promise<void>;
  onSyncGas: () => Promise<void>;
  onResetDefaultTemplate?: () => void;
  onUseForQuestion?: (item: CurriculumItem, objective?: string) => void;
  exams?: Exam[];
}

const COMMON_SUBJECTS = [
  'Biologi',
  'Fisika',
  'Kimia',
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Informatika',
  'Sejarah',
  'Geografi',
  'Ekonomi',
  'Sosiologi',
  'Pendidikan Pancasila',
  'Pendidikan Agama & Budi Pekerti',
  'PJOK',
  'Seni Budaya',
  'Prakarya & Kewirausahaan'
];

const COMMON_GRADES = [
  'Fase E (Kelas X)',
  'Fase F (Kelas XI)',
  'Fase F (Kelas XII)',
  'Fase D (Kelas VII - IX)',
  'Fase C (Kelas V - VI)',
  'Fase A - B (Kelas I - IV)'
];

export const CurriculumManagement: React.FC<CurriculumManagementProps> = ({
  curriculumList,
  onSaveCurriculum,
  onDeleteCurriculum,
  onSyncGas,
  onResetDefaultTemplate,
  onUseForQuestion,
  exams = []
}) => {
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>(exams[0]?.subject || 'Biologi');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [grade, setGrade] = useState<string>('Fase E (Kelas X)');
  const [element, setElement] = useState<string>('');
  const [learningOutcome, setLearningOutcome] = useState<string>('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [tpInput, setTpInput] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddTp = () => {
    const trimmed = tpInput.trim();
    if (!trimmed) return;
    if (objectives.includes(trimmed)) {
      showToast('Tujuan Pembelajaran ini sudah ditambahkan.');
      return;
    }
    setObjectives([...objectives, trimmed]);
    setTpInput('');
  };

  const handleRemoveTp = (index: number) => {
    setObjectives(objectives.filter((_, idx) => idx !== index));
  };

  const handleResetForm = () => {
    setEditingId(null);
    setSubject(exams[0]?.subject || 'Biologi');
    setCustomSubject('');
    setGrade('Fase E (Kelas X)');
    setElement('');
    setLearningOutcome('');
    setObjectives([]);
    setTpInput('');
  };

  const handleEditItem = (item: CurriculumItem) => {
    setEditingId(item.id);
    if (COMMON_SUBJECTS.includes(item.subject)) {
      setSubject(item.subject);
      setCustomSubject('');
    } else {
      setSubject('Lainnya');
      setCustomSubject(item.subject);
    }
    setGrade(item.grade || 'Fase E (Kelas X)');
    setElement(item.element);
    setLearningOutcome(item.learningOutcome);
    setObjectives([...(item.learningObjectives || [])]);
    setTpInput('');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubject = subject === 'Lainnya' ? customSubject.trim() : subject.trim();

    if (!finalSubject) {
      alert('Mata pelajaran harus diisi.');
      return;
    }
    if (!element.trim()) {
      alert('Elemen materi harus diisi.');
      return;
    }
    if (!learningOutcome.trim()) {
      alert('Capaian Pembelajaran (CP) harus diisi.');
      return;
    }
    if (objectives.length === 0) {
      alert('Tambahkan minimal 1 butir Tujuan Pembelajaran (TP).');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemToSave: CurriculumItem = {
        id: editingId || `CUR-${Date.now()}`,
        subject: finalSubject,
        grade: grade.trim(),
        element: element.trim(),
        learningOutcome: learningOutcome.trim(),
        learningObjectives: objectives,
        updatedAt: new Date().toISOString()
      };

      await onSaveCurriculum(itemToSave);
      showToast(
        editingId 
          ? `Perubahan Capaian & TP ${finalSubject} berhasil disimpan!` 
          : `Capaian & TP baru untuk ${finalSubject} berhasil ditambahkan!`
      );
      handleResetForm();
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerSyncGas = async () => {
    setIsSyncing(true);
    try {
      await onSyncGas();
      showToast('Seluruh data Capaian & TP berhasil disinkronkan ke Google Sheets!');
    } catch (err: any) {
      showToast(`Gagal sinkronisasi: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Distinct list of subjects for filter
  const existingSubjects = Array.from(new Set(curriculumList.map(c => c.subject))).filter(Boolean);

  // Filtered curriculum list
  const filteredList = curriculumList.filter(item => {
    const matchSubject = filterSubject === 'all' || item.subject.toLowerCase() === filterSubject.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchQuery = 
      !query ||
      item.subject.toLowerCase().includes(query) ||
      item.element.toLowerCase().includes(query) ||
      item.learningOutcome.toLowerCase().includes(query) ||
      (item.learningObjectives || []).some(tp => tp.toLowerCase().includes(query));
    return matchSubject && matchQuery;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 rounded-2xl text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-700/80 text-indigo-200 text-xs font-semibold backdrop-blur-xs">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Standar Kurikulum Merdeka</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Capaian Pembelajaran (CP), Elemen, & TP
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed">
            Kelola rumusan Capaian Pembelajaran, Elemen Materi, dan butir-butir Tujuan Pembelajaran per mata pelajaran. Data ini otomatis tersedia pada dropdown pembuat soal manual dan generator AI.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerSyncGas}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            title="Sinkronkan data ke Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sinkronisasi...' : 'Sinkronkan ke Google Sheets'}</span>
          </button>

          {onResetDefaultTemplate && (
            <button
              type="button"
              onClick={onResetDefaultTemplate}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-700/80 hover:bg-indigo-600 text-indigo-100 text-xs font-semibold rounded-xl border border-indigo-500/50 transition-colors"
              title="Muat ulang template default Kurikulum Merdeka (Biologi, Fisika, Matematika, B. Indonesia)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Muat Template Standar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Form Input / Edit Capaian & TP */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              {editingId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Capaian & Tujuan Pembelajaran' : 'Tambah Capaian & Tujuan Pembelajaran Baru'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {editingId ? `ID: ${editingId} · Tekan Batal untuk mengulang` : 'Data akan tersimpan secara otomatis di bank kurikulum dan dapat digunakan untuk pembuatan soal'}
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Row 1: Mata Pelajaran, Fase/Kelas, Elemen Materi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                {COMMON_SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="Lainnya">+ Tambah Mapel Lainnya...</option>
              </select>

              {subject === 'Lainnya' && (
                <input
                  type="text"
                  required
                  placeholder="Ketik nama mata pelajaran..."
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/40"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fase / Jenjang / Kelas <span className="text-rose-500">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                {COMMON_GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Elemen Materi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Pemahaman Sains, Aljabar, Ekosistem..."
                value={element}
                onChange={(e) => setElement(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Row 2: Capaian Pembelajaran (CP) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Rumusan Capaian Pembelajaran (CP) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="Tuliskan rumusan lengkap Capaian Pembelajaran (CP) Kemendikbudristek untuk fase dan elemen ini..."
              value={learningOutcome}
              onChange={(e) => setLearningOutcome(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          </div>

          {/* Row 3: Daftar Tujuan Pembelajaran (TP) Builder */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Daftar Tujuan Pembelajaran (TP) ({objectives.length} Butir Ditambahkan)</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Ketik satu per satu lalu tekan Tambah atau Enter
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Contoh: Peserta didik dapat mengidentifikasi tingkatan keanekaragaman hayati..."
                value={tpInput}
                onChange={(e) => setTpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTp();
                  }
                }}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddTp}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shrink-0 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah TP</span>
              </button>
            </div>

            {/* List of Added TPs */}
            {objectives.length > 0 ? (
              <div className="space-y-2 pt-2">
                {objectives.map((tp, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs"
                  >
                    <div className="flex items-start gap-2.5 flex-1">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] shrink-0 font-mono">
                        TP {idx + 1}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                        {tp}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTp(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors shrink-0"
                      title="Hapus butir TP ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
                Belum ada Tujuan Pembelajaran (TP) yang ditambahkan. Masukkan butir TP di atas.
              </p>
            )}
          </div>

          {/* Form Submit Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Batal
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Capaian & TP'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            type="button"
            onClick={() => setFilterSubject('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
              filterSubject === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Semua ({curriculumList.length})
          </button>

          {existingSubjects.map(sub => (
            <button
              key={sub}
              type="button"
              onClick={() => setFilterSubject(sub)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
                filterSubject === sub
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {sub} ({curriculumList.filter(c => c.subject === sub).length})
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari CP, elemen, atau TP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* 4. Curriculum Items Cards Grid */}
      {filteredList.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all space-y-4"
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                    {item.subject}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                    {item.grade || 'Fase E (Kelas X)'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-medium border border-amber-200 dark:border-amber-900/50">
                    Elemen: {item.element}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleEditItem(item)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit Capaian & TP"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteCurriculum(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Hapus Capaian & TP"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Capaian Pembelajaran Box */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Capaian Pembelajaran (CP):
                </span>
                <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50/80 dark:bg-slate-950/50 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  {item.learningOutcome}
                </p>
              </div>

              {/* Tujuan Pembelajaran (TP) List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Tujuan Pembelajaran ({item.learningObjectives?.length || 0} Butir):
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {(item.learningObjectives || []).map((tp, tpIdx) => (
                    <div
                      key={tpIdx}
                      className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 text-xs hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-2 flex-1">
                        <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 font-mono">
                          {tpIdx + 1}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                          {tp}
                        </span>
                      </div>

                      {onUseForQuestion && (
                        <button
                          type="button"
                          onClick={() => onUseForQuestion(item, tp)}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0 flex items-center gap-1 transition-colors"
                          title="Gunakan butir TP ini untuk pembuatan soal baru"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Buat Soal</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-mono">
                  ID: {item.id} {item.updatedAt && `· Diperbarui: ${new Date(item.updatedAt).toLocaleDateString('id-ID')}`}
                </span>

                {onUseForQuestion && (
                  <button
                    type="button"
                    onClick={() => onUseForQuestion(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Buat Soal dari Seluruh CP Ini</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Tidak ada Capaian Pembelajaran yang cocok
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Gunakan formulir di atas untuk menambahkan Capaian dan Tujuan Pembelajaran baru, atau muat template bawaan Kurikulum Merdeka.
            </p>
          </div>
          {onResetDefaultTemplate && (
            <button
              type="button"
              onClick={onResetDefaultTemplate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Muat Ulang Template Standar</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-medium border border-slate-700 animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
