import React, { useState } from 'react';
import { Exam, Question, SchoolProfile, TaxonomyType, BloomLevel, SoloLevel } from '../types';
import { StorageService } from '../services/storage';
import { Printer, Download, ArrowLeft, Layers, Sparkles, BookOpen } from 'lucide-react';

interface KisiKisiMatrixProps {
  profile: SchoolProfile;
  exams: Exam[];
}

export const KisiKisiMatrix: React.FC<KisiKisiMatrixProps> = ({ profile, exams }) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [taxonomyMode, setTaxonomyMode] = useState<TaxonomyType>('bloom');
  const [isEditing, setIsEditing] = useState(false);

  const selectedExam = exams.find(e => e.id === selectedExamId) || exams[0];
  const [questions, setQuestions] = useState<Question[]>(() => {
    return selectedExam ? StorageService.getQuestionsByExamId(selectedExam.id) : [];
  });

  // When exam selection changes
  const handleExamChange = (examId: string) => {
    setSelectedExamId(examId);
    const qs = StorageService.getQuestionsByExamId(examId);
    setQuestions(qs);
  };

  const handleUpdateQuestion = (qId: string, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, [field]: value } : q));
  };

  const handleSaveToStorage = () => {
    if (selectedExam) {
      StorageService.saveQuestionsForExam(selectedExam.id, questions);
      setIsEditing(false);
      alert('Kisi-kisi soal berhasil disimpan!');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Convert Bloom to SOLO or vice-versa fallback
  const getCognitiveLevel = (q: Question) => {
    if (taxonomyMode === 'bloom') {
      return q.bloomLevel || 'C3 - Menerapkan';
    } else {
      if (q.soloLevel) return q.soloLevel;
      // Map from bloom to solo
      if (q.bloomLevel?.startsWith('C1')) return 'Unistructural';
      if (q.bloomLevel?.startsWith('C2') || q.bloomLevel?.startsWith('C3')) return 'Multistructural';
      if (q.bloomLevel?.startsWith('C4')) return 'Relational';
      if (q.bloomLevel?.startsWith('C5') || q.bloomLevel?.startsWith('C6')) return 'Extended Abstract';
      return 'Multistructural';
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Control Bar (Hidden on Print) */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Format Cetak Kisi-Kisi Soal Ujian</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dokumen spesifikasi butir soal standar kurikulum nasional dengan pilihan taksonomi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Exam Selector */}
          <select
            value={selectedExamId}
            onChange={(e) => handleExamChange(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>
                {e.subject} - {e.title.substring(0, 35)}...
              </option>
            ))}
          </select>

          {/* Taxonomy Mode Switcher (Clean Segmented Tab) */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setTaxonomyMode('bloom')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                taxonomyMode === 'bloom'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Bloom-Anderson (C1–C6)
            </button>
            <button
              onClick={() => setTaxonomyMode('solo')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                taxonomyMode === 'solo'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Taksonomi SOLO
            </button>
          </div>

          {/* Edit / Save Toggle */}
          {isEditing ? (
            <button
              onClick={handleSaveToStorage}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs"
            >
              Simpan Perubahan
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
            >
              Edit Teks Kisi-Kisi
            </button>
          )}

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE SHEET CONTAINER (Styled for A4 print and screen preview) */}
      <div className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-8 sm:p-12 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md print:shadow-none print:border-none print:p-0 print:bg-white print:text-black">
        {/* Kop Surat Sekolah Standar Nasional */}
        <div className="border-b-4 border-double border-slate-900 dark:border-slate-100 pb-4 mb-6 flex items-center justify-between gap-6 print:border-black">
          {profile.logoUrl && (
            <img
              src={profile.logoUrl}
              alt="Logo Sekolah"
              referrerPolicy="no-referrer"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain shrink-0"
            />
          )}

          <div className="text-center flex-1">
            <h4 className="text-xs uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 print:text-black">
              PEMERINTAH DAERAH PROVINSI / KEMENTERIAN PENDIDIKAN
            </h4>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white print:text-black">
              {profile.name}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 print:text-black mt-0.5">
              {profile.address} · NPSN: {profile.npsn}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-black">
              Website / Portal Ujian Online: ExamFlow Edu
            </p>
          </div>

          <div className="w-20 shrink-0 hidden sm:block" />
        </div>

        {/* Title of Document */}
        <div className="text-center mb-6">
          <h2 className="text-base sm:text-lg font-extrabold uppercase underline tracking-wide print:text-black">
            KISI-KISI PENULISAN SOAL PENILAIAN SUMATIF
          </h2>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 print:text-black mt-1">
            Model Taksonomi: {taxonomyMode === 'bloom' ? 'Bloom-Anderson (Revisi 2001)' : 'SOLO (Structure of Observed Learning Outcomes)'}
          </p>
        </div>

        {/* Metadata Table */}
        {selectedExam && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-slate-700 dark:text-slate-300 print:text-black mb-6 bg-slate-50 dark:bg-slate-800/40 print:bg-transparent p-4 rounded-xl border border-slate-200 dark:border-slate-800 print:border-none print:p-0">
            <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800 print:border-none">
              <span className="font-semibold">Satuan Pendidikan:</span>
              <span>{profile.name}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800 print:border-none">
              <span className="font-semibold">Alokasi Waktu:</span>
              <span className="font-mono">{selectedExam.durationMinutes} Menit</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800 print:border-none">
              <span className="font-semibold">Mata Pelajaran:</span>
              <span className="font-bold">{selectedExam.subject}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800 print:border-none">
              <span className="font-semibold">Jumlah Soal:</span>
              <span className="font-mono">{questions.length} Butir</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800 print:border-none">
              <span className="font-semibold">Kelas / Semester:</span>
              <span>{selectedExam.grade} / {profile.semester}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800 print:border-none">
              <span className="font-semibold">Bentuk Soal:</span>
              <span>Pilihan Ganda & Uraian</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-semibold">Tahun Pelajaran:</span>
              <span>{profile.academicYear}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-semibold">Penyusun / Guru:</span>
              <span>{profile.teacherName || 'Guru Mata Pelajaran'}</span>
            </div>
          </div>
        )}

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse border border-slate-300 dark:border-slate-700 print:border-black">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 print:bg-slate-200 text-slate-800 dark:text-slate-200 print:text-black font-bold">
                <th className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 text-center w-12">
                  No.
                </th>
                <th className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 min-w-[180px]">
                  Kompetensi Dasar / Capaian Pembelajaran
                </th>
                <th className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 min-w-[140px]">
                  Materi Pokok
                </th>
                <th className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 min-w-[220px]">
                  Indikator Soal
                </th>
                <th className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 text-center min-w-[130px]">
                  Level Kognitif ({taxonomyMode === 'bloom' ? 'Bloom' : 'SOLO'})
                </th>
                <th className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 text-center w-24">
                  Bentuk Soal
                </th>
                <th className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 text-center w-14 font-mono">
                  No. Soal
                </th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, idx) => {
                const cogLevel = getCognitiveLevel(q);
                const bentukStr = q.type === 'multiple_choice' ? 'PG' : q.type === 'checkbox' ? 'PG Kompleks' : 'Uraian';

                return (
                  <tr key={q.id} className="print-break-inside-avoid hover:bg-slate-50 dark:hover:bg-slate-800/30 print:hover:bg-transparent">
                    <td className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 text-center font-mono font-semibold">
                      {idx + 1}
                    </td>

                    {/* KD / CP */}
                    <td className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 leading-relaxed">
                      {isEditing ? (
                        <textarea
                          rows={2}
                          value={q.basicCompetency || ''}
                          onChange={(e) => handleUpdateQuestion(q.id, 'basicCompetency', e.target.value)}
                          className="w-full p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                        />
                      ) : (
                        q.basicCompetency || 'Menganalisis prinsip dan konsep pokok materi'
                      )}
                    </td>

                    {/* Materi */}
                    <td className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 font-medium">
                      {selectedExam?.subject}
                    </td>

                    {/* Indikator Soal */}
                    <td className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 leading-relaxed">
                      {isEditing ? (
                        <textarea
                          rows={3}
                          value={q.indicator || ''}
                          onChange={(e) => handleUpdateQuestion(q.id, 'indicator', e.target.value)}
                          className="w-full p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                        />
                      ) : (
                        q.indicator || q.prompt.substring(0, 100) + '...'
                      )}
                    </td>

                    {/* Level Kognitif */}
                    <td className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 text-center font-semibold">
                      {isEditing ? (
                        taxonomyMode === 'bloom' ? (
                          <select
                            value={q.bloomLevel || 'C3 - Menerapkan'}
                            onChange={(e) => handleUpdateQuestion(q.id, 'bloomLevel', e.target.value as BloomLevel)}
                            className="w-full p-1 text-xs border rounded bg-white dark:bg-slate-900"
                          >
                            <option value="C1 - Mengingat">C1 - Mengingat</option>
                            <option value="C2 - Memahami">C2 - Memahami</option>
                            <option value="C3 - Menerapkan">C3 - Menerapkan</option>
                            <option value="C4 - Menganalisis">C4 - Menganalisis</option>
                            <option value="C5 - Mengevaluasi">C5 - Mengevaluasi</option>
                            <option value="C6 - Mencipta">C6 - Mencipta</option>
                          </select>
                        ) : (
                          <select
                            value={q.soloLevel || 'Multistructural'}
                            onChange={(e) => handleUpdateQuestion(q.id, 'soloLevel', e.target.value as SoloLevel)}
                            className="w-full p-1 text-xs border rounded bg-white dark:bg-slate-900"
                          >
                            <option value="Prestructural">Prestructural</option>
                            <option value="Unistructural">Unistructural</option>
                            <option value="Multistructural">Multistructural</option>
                            <option value="Relational">Relational</option>
                            <option value="Extended Abstract">Extended Abstract</option>
                          </select>
                        )
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold">
                          {cogLevel}
                        </span>
                      )}
                    </td>

                    {/* Bentuk Soal */}
                    <td className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 text-center font-semibold">
                      {bentukStr}
                    </td>

                    {/* Nomor Soal */}
                    <td className="border border-slate-300 dark:border-slate-700 print:border-black p-2.5 text-center font-mono font-bold">
                      {idx + 1}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Signature Footer block */}
        <div className="mt-12 pt-6 grid grid-cols-2 gap-8 text-xs text-slate-800 dark:text-slate-200 print:text-black print-break-inside-avoid">
          <div>
            <p>Mengetahui,</p>
            <p className="font-semibold">Kepala {profile.name}</p>
            <div className="h-20" />
            <p className="font-bold underline uppercase">{profile.principalName}</p>
            <p className="font-mono">NIP. {profile.principalNip || '19750812 200003 1 002'}</p>
          </div>

          <div className="text-right">
            <p>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-semibold">Guru Pengampu {profile.teacherSubject || selectedExam?.subject || 'Mata Pelajaran'}</p>
            <div className="h-20" />
            <p className="font-bold underline uppercase">{profile.teacherName || 'Siti Rahmawati, S.Pd.'}</p>
            <p className="font-mono">NIP. {profile.teacherNip || '19820514 200801 2 009'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
