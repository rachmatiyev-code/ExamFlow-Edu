import React, { useState } from 'react';
import { 
  Printer, 
  ArrowLeft, 
  FileText, 
  Sliders, 
  CheckCircle2, 
  BookOpen, 
  Layers, 
  Calendar, 
  Clock, 
  User, 
  School
} from 'lucide-react';
import { Exam, Question, SchoolProfile } from '../types';
import { StorageService } from '../services/storage';
import { MathRenderer } from '../services/mathRenderer';

interface OfficialExamPrintViewProps {
  profile: SchoolProfile;
  exams: Exam[];
  initialExamId?: string;
  onBack: () => void;
}

export const OfficialExamPrintView: React.FC<OfficialExamPrintViewProps> = ({
  profile,
  exams,
  initialExamId,
  onBack
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(
    initialExamId || exams[0]?.id || ''
  );
  const [includeAnswerKey, setIncludeAnswerKey] = useState<boolean>(false);
  const [showScoreBox, setShowScoreBox] = useState<boolean>(true);
  const [fontSizeMode, setFontSizeMode] = useState<'sm' | 'base' | 'lg'>('base');

  const selectedExam = exams.find(e => e.id === selectedExamId) || exams[0];
  const questions: Question[] = selectedExam
    ? StorageService.getQuestionsByExamId(selectedExam.id)
    : [];

  const handlePrint = () => {
    window.print();
  };

  const getLetterBadge = (idx: number) => {
    return String.fromCharCode(65 + idx); // A, B, C, D, E
  };

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const fontSizeClass = 
    fontSizeMode === 'sm' ? 'text-[11.5px] leading-relaxed' :
    fontSizeMode === 'lg' ? 'text-[14px] leading-relaxed' :
    'text-[12.5px] leading-relaxed';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-6 sm:py-8 px-2 sm:px-6">
      {/* ==============================================================
          BAR KONTROL ATAS (HANYA MUNCUL DI LAYAR, OTOMATIS HILANG DI CETAK)
         ============================================================== */}
      <div className="no-print max-w-5xl mx-auto mb-6 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Kembali ke Dasbor"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Naskah Ujian Resmi Siap Cetak (A4 Standard)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Format dokumen resmi sekolah dengan Kop Surat, data identitas, rumus KaTeX, dan lembar pengesahan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pilih Ujian */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>
                [{e.subject}] {e.title} ({StorageService.getQuestionsByExamId(e.id).length} Soal)
              </option>
            ))}
          </select>

          {/* Opsi Ukuran Font */}
          <select
            value={fontSizeMode}
            onChange={(e: any) => setFontSizeMode(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            title="Ukuran Font Dokumen"
          >
            <option value="sm">Font: Kompak (11.5pt)</option>
            <option value="base">Font: Normal (12.5pt)</option>
            <option value="lg">Font: Besar (14pt)</option>
          </select>

          {/* Toggle Kunci Jawaban */}
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAnswerKey}
              onChange={(e) => setIncludeAnswerKey(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            <span>Sertakan Kunci</span>
          </label>

          {/* Tombol Cetak / PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* ==============================================================
          LEMBAR DOKUMEN CETAK RESMI (A4 FORMAL STANDAR SEKOLAH)
         ============================================================== */}
      <div className="print-area max-w-[210mm] mx-auto bg-white text-black shadow-xl print:shadow-none print:max-w-none print:w-full print:m-0 p-8 sm:p-12 border border-slate-200 print:border-none rounded-xl print:rounded-none">
        
        {/* 1. KOP SURAT RESMI SEKOLAH */}
        <div className="kop-surat relative pb-3 mb-4 print-break-inside-avoid">
          <div className="flex items-center gap-5">
            {profile.logoUrl && (
              <img
                src={profile.logoUrl}
                alt={profile.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain shrink-0"
              />
            )}
            <div className="flex-1 text-center font-serif text-black">
              <h4 className="text-xs sm:text-sm font-semibold tracking-wider uppercase">
                PEMERINTAH PROVINSI / DINAS PENDIDIKAN & KEBUDAYAAN
              </h4>
              <h2 className="text-base sm:text-xl font-bold uppercase tracking-tight mt-0.5">
                {profile.name}
              </h2>
              {profile.npsn && (
                <p className="text-xs font-medium">NPSN: {profile.npsn}</p>
              )}
              <p className="text-[11px] sm:text-xs leading-tight mt-0.5">
                {profile.address || 'Alamat Lengkap Satuan Pendidikan'}
              </p>
              <div className="flex items-center justify-center gap-3 text-[10.5px] mt-0.5 font-sans text-slate-700">
                <span>Tahun Ajaran: {profile.academicYear || '2024/2025'}</span>
                <span>Semester: {profile.semester || 'Ganjil'}</span>
              </div>
            </div>
          </div>

          {/* Garis Ganda Standar Tata Naskah Dinas Sekolah (Tebal & Tipis) */}
          <div className="mt-3 pt-1 border-t-2 border-black">
            <div className="border-t border-black -mt-[1px]"></div>
          </div>
        </div>

        {/* 2. JUDUL DOKUMEN ASESMEN */}
        <div className="text-center my-3 font-serif">
          <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide underline underline-offset-4">
            NASKAH SOAL ASESMEN SUMATIF / PENILAIAN AKHIR
          </h3>
          <p className="text-xs font-semibold uppercase mt-1">
            TAHUN AJARAN {new Date().getFullYear()} / {new Date().getFullYear() + 1}
          </p>
        </div>

        {/* 3. TABEL IDENTITAS UJIAN & KOTAK NILAI SISWA */}
        <div className="my-3 border border-black rounded-xs p-3 text-xs font-sans grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8 grid grid-cols-12 gap-y-1">
            <div className="col-span-4 font-semibold">Mata Pelajaran</div>
            <div className="col-span-8">: <span className="font-bold">{selectedExam?.subject || '-'}</span></div>

            <div className="col-span-4 font-semibold">Kelas / Jenjang</div>
            <div className="col-span-8">: {selectedExam?.grade || '-'}</div>

            <div className="col-span-4 font-semibold">Paket Ujian</div>
            <div className="col-span-8">: {selectedExam?.title || '-'}</div>

            <div className="col-span-4 font-semibold">Hari / Tanggal</div>
            <div className="col-span-8">: {todayStr}</div>

            <div className="col-span-4 font-semibold">Alokasi Waktu</div>
            <div className="col-span-8">: {selectedExam?.durationMinutes || 45} Menit</div>

            <div className="col-span-4 font-semibold">Jumlah Butir Soal</div>
            <div className="col-span-8">: {questions.length} Butir Soal</div>
          </div>

          {/* Kotak Nilai & Tanda Tangan Guru Penguji (Hadir di Kanan Atas) */}
          {showScoreBox && (
            <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-black pt-2 md:pt-0 md:pl-3 flex flex-col justify-between">
              <div className="grid grid-cols-2 border border-black text-center">
                <div className="border-r border-b border-black py-1 font-bold text-[10.5px] bg-slate-100 print:bg-transparent">
                  NILAI SISWA
                </div>
                <div className="border-b border-black py-1 font-bold text-[10.5px] bg-slate-100 print:bg-transparent">
                  PARAF GURU
                </div>
                <div className="h-10 border-r border-black flex items-center justify-center font-bold text-base">
                  &nbsp;
                </div>
                <div className="h-10 flex items-center justify-center">
                  &nbsp;
                </div>
              </div>
              <div className="mt-1 text-[10.5px]">
                <div className="flex justify-between">
                  <span>Nama Siswa:</span>
                  <span className="border-b border-dotted border-black flex-1 ml-1">&nbsp;</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>No. Peserta:</span>
                  <span className="border-b border-dotted border-black flex-1 ml-1">&nbsp;</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. PETUNJUK UMUM PENGERJAAN */}
        <div className="my-3 p-2.5 border border-slate-400 text-[11px] leading-relaxed bg-slate-50 print:bg-transparent font-sans">
          <div className="font-bold uppercase tracking-wider mb-0.5 text-[10.5px]">
            PETUNJUK UMUM PENGERJAAN:
          </div>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Tuliskan identitas Anda secara lengkap dan jelas pada lembar jawaban yang telah disediakan.</li>
            <li>Periksa dan bacalah setiap butir soal dengan teliti dan seksama sebelum Anda menjawabnya.</li>
            <li>Laporkan kepada pengawas ujian jika terdapat tulisan yang tidak jelas, rusak, atau butir soal yang tidak lengkap.</li>
            <li>Dahulukan menjawab butir-butir soal yang Anda anggap lebih mudah.</li>
            <li>Tidak diperkenankan menggunakan kalkulator, gawai elektronik, atau buku catatan kecuali ada petunjuk khusus.</li>
            <li>Periksalah kembali seluruh lembar pekerjaan Anda sebelum diserahkan kepada pengawas ujian.</li>
          </ol>
        </div>

        {/* 5. DAFTAR BUTIR NASKAH SOAL */}
        <div className={`mt-5 space-y-5 ${fontSizeClass} font-sans`}>
          {questions.map((q, qIndex) => {
            return (
              <div 
                key={q.id || qIndex} 
                className="print-break-inside-avoid relative pl-7"
              >
                {/* Nomor Soal */}
                <span className="absolute left-0 top-0 font-bold text-sm">
                  {qIndex + 1}.
                </span>

                {/* Stimulus Gambar jika ada */}
                {q.mediaType === 'image' && q.mediaUrl && (
                  <div className="my-2 max-w-sm">
                    <img 
                      src={q.mediaUrl} 
                      alt={`Gambar Soal ${qIndex + 1}`}
                      referrerPolicy="no-referrer"
                      className="max-h-48 border border-slate-300 rounded p-1 object-contain bg-white" 
                    />
                  </div>
                )}

                {/* Teks Soal (Mendukung KaTeX, Tabel, Indentasi & Format Kaya) */}
                <div 
                  className="leading-relaxed text-black font-normal break-words [&>p]:mb-1.5 [&>table]:border-collapse [&>table]:border [&>table]:border-black [&>table]:my-2 [&>table_td]:border [&>table_td]:border-black [&>table_td]:p-1.5 [&>table_th]:border [&>table_th]:border-black [&>table_th]:p-1.5 [&>table_th]:bg-slate-100 print:[&>table_th]:bg-transparent"
                  dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(q.prompt) }}
                />

                {/* Opsi Jawaban (Jika Pilihan Ganda / Checkbox / Benar-Salah) */}
                {q.type !== 'essay' && Array.isArray(q.options) && q.options.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 pl-1">
                    {q.options.map((opt, optIndex) => {
                      const letter = getLetterBadge(optIndex);
                      return (
                        <div key={opt.id || optIndex} className="flex items-start gap-2">
                          <span className="font-bold shrink-0">{letter}.</span>
                          <div 
                            className="flex-1 leading-normal text-black font-normal break-words"
                            dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(opt.text) }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Ruang Isian / Garis Jawaban (Jika Soal Uraian / Essay) */}
                {q.type === 'essay' && (
                  <div className="mt-3 pl-1">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">
                      Lembar / Ruang Jawaban Uraian:
                    </div>
                    <div className="space-y-3.5 border-l-2 border-slate-300 pl-3">
                      <div className="border-b border-dotted border-slate-400 h-2"></div>
                      <div className="border-b border-dotted border-slate-400 h-2"></div>
                      <div className="border-b border-dotted border-slate-400 h-2"></div>
                      <div className="border-b border-dotted border-slate-400 h-2"></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {questions.length === 0 && (
            <div className="py-12 text-center text-slate-400 italic">
              Belum ada butir soal dalam paket ujian ini.
            </div>
          )}
        </div>

        {/* 6. KOLOM TANDA TANGAN PENGESAHAN DOKUMEN RESMI */}
        {questions.length > 0 && (
          <div className="mt-12 pt-6 border-t border-slate-300 print-break-inside-avoid font-sans text-xs">
            <div className="text-right mb-6">
              <span>{profile.address ? profile.address.split(',').pop()?.trim() || 'Tempat' : 'Tempat'}, </span>
              <span>{todayStr}</span>
            </div>

            <div className="grid grid-cols-2 text-center gap-8">
              <div>
                <p className="font-semibold">Mengetahui,</p>
                <p className="font-semibold">Kepala {profile.name}</p>
                <div className="h-16 sm:h-20 flex items-center justify-center">
                  {/* Space for formal seal & signature */}
                </div>
                <p className="font-bold underline uppercase">{profile.principalName || '...........................................'}</p>
                <p className="text-[11px] text-slate-600">NIP. {profile.principalNip || '...........................................'}</p>
              </div>

              <div>
                <p className="font-semibold">Penyusun / Guru Pengampu,</p>
                <p className="font-semibold">Mata Pelajaran {selectedExam?.subject || ''}</p>
                <div className="h-16 sm:h-20 flex items-center justify-center">
                  {/* Space for formal signature */}
                </div>
                <p className="font-bold underline uppercase">{profile.teacherName || '...........................................'}</p>
                <p className="text-[11px] text-slate-600">NIP. {profile.teacherNip || '...........................................'}</p>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            7. LAMPIRAN KUNCI JAWABAN & PEMBAHASAN (HALAMAN TERPISAH)
           ============================================================== */}
        {includeAnswerKey && questions.length > 0 && (
          <div className="print-page-break-after mt-14 pt-8 border-t-2 border-dashed border-slate-400 font-sans">
            <div className="text-center mb-5 font-serif">
              <span className="inline-block px-3 py-1 bg-rose-100 print:bg-transparent border border-rose-500 text-rose-800 text-[10px] font-bold uppercase tracking-widest rounded mb-1">
                DOKUMEN RAHASIA · KHUSUS PENDIDIK
              </span>
              <h3 className="text-base font-bold uppercase underline">
                KUNCI JAWABAN & RUBRIK PEMBAHASAN SOAL
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {selectedExam?.title} ({selectedExam?.subject} - Kelas {selectedExam?.grade})
              </p>
            </div>

            <table className="w-full border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-slate-100 print:bg-transparent">
                  <th className="border border-black p-1.5 w-12 text-center">No.</th>
                  <th className="border border-black p-1.5 w-24 text-center">Tipe</th>
                  <th className="border border-black p-1.5 w-28 text-center">Kunci Benar</th>
                  <th className="border border-black p-1.5 w-24 text-center">Taksonomi</th>
                  <th className="border border-black p-1.5 text-left">Pembahasan & Rubrik Ilmiah</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, idx) => {
                  let keyLabel = '-';
                  if (q.type === 'multiple_choice' || !q.type) {
                    const k = typeof q.correctKey === 'string' ? q.correctKey : q.correctKey?.[0] || 'opt_a';
                    const optIdx = q.options?.findIndex(o => o.id === k) ?? -1;
                    keyLabel = optIdx >= 0 ? getLetterBadge(optIdx) : k.replace('opt_', '').toUpperCase();
                  } else if (q.type === 'checkbox') {
                    const keys = Array.isArray(q.correctKey) ? q.correctKey : [q.correctKey];
                    keyLabel = keys.map(k => {
                      const optIdx = q.options?.findIndex(o => o.id === k) ?? -1;
                      return optIdx >= 0 ? getLetterBadge(optIdx) : k.replace('opt_', '').toUpperCase();
                    }).join(', ');
                  } else if (q.type === 'essay') {
                    keyLabel = typeof q.correctKey === 'string' ? q.correctKey : 'Rubrik Esai';
                  }

                  return (
                    <tr key={q.id || idx} className="print-break-inside-avoid">
                      <td className="border border-black p-1.5 text-center font-bold">
                        {idx + 1}
                      </td>
                      <td className="border border-black p-1.5 text-center text-[11px]">
                        {q.type === 'checkbox' ? 'PG Kompleks' : q.type === 'essay' ? 'Uraian' : 'PG Biasa'}
                      </td>
                      <td className="border border-black p-1.5 text-center font-bold text-indigo-700 print:text-black">
                        {keyLabel}
                      </td>
                      <td className="border border-black p-1.5 text-center text-[10.5px]">
                        {q.bloomLevel || q.soloLevel || 'C3'}
                      </td>
                      <td className="border border-black p-1.5 leading-relaxed text-[11.5px]">
                        {q.explanation ? (
                          <div dangerouslySetInnerHTML={{ __html: MathRenderer.renderMixedText(q.explanation) }} />
                        ) : (
                          <span className="text-slate-400 italic">Tidak ada pembahasan khusus.</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
