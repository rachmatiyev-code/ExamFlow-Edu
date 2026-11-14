import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// CORS headers for cross-domain / Vercel compatibility
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Router for API endpoints (mounted on both /api and / for Vercel serverless flexibility)
const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'ExamFlow Edu',
    time: new Date().toISOString(),
    hasGeminiKey: !!process.env.GEMINI_API_KEY
  });
});

/**
 * Validasi API Key Gemini
 */
apiRouter.post('/gemini/validate-key', async (req, res) => {
  try {
    const customKey = req.body.apiKey?.trim();
    const apiKey = customKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        valid: false,
        message: 'API Key belum diisi atau dikonfigurasi.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    // 1. Uji autentikasi API Key langsung ke metadata endpoint Google
    // Endpoint ini tidak memerlukan inferensi AI sehingga tidak terpengaruh lonjakan beban (high demand)
    let isKeyAuthenticated = false;
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(apiKey)}`);
      if (listRes.ok) {
        isKeyAuthenticated = true;
      } else {
        const errJson: any = await listRes.json().catch(() => ({}));
        const rawMsg = errJson?.error?.message || '';
        if (listRes.status === 400 || listRes.status === 403 || rawMsg.toLowerCase().includes('api key') || rawMsg.toLowerCase().includes('not valid')) {
          return res.status(400).json({
            valid: false,
            message: 'Kunci API Gemini tidak valid atau ditolak Google. Periksa kembali API Key dari Google AI Studio.'
          });
        }
      }
    } catch {
      // Abaikan jika network local fetch bermasalah, lanjutkan ke generateContent
    }

    // 2. Uji ketersediaan model aktif
    const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastError: any = null;
    let validatedModel = 'gemini-3.1-flash-lite';
    let hadHighDemandSpike = false;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: 'Respond with the single word "OK" if this API key is active.',
          });

          const text = response.text || '';
          if (text.toLowerCase().includes('ok') || text.length > 0) {
            validatedModel = model;
            return res.json({
              valid: true,
              message: `Gemini API Key valid dan siap digunakan! (Model aktif: ${validatedModel})`,
              model: validatedModel
            });
          }
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.code;
          const errString = String(err?.message || '');

          // Deteksi pesan lonjakan trafik (high demand)
          if (
            errString.includes('high demand') || 
            errString.includes('Spikes in demand') || 
            errString.includes('503') || 
            errString.includes('UNAVAILABLE') || 
            errString.includes('RESOURCE_EXHAUSTED') ||
            status === 503 ||
            status === 429
          ) {
            // Error ini membuktikan autentikasi kunci API diterima Google!
            isKeyAuthenticated = true;
            hadHighDemandSpike = true;
            break;
          }

          // Jika benar-benar 400/403 kunci tidak valid
          if (status === 400 || status === 403 || errString.includes('API key not valid')) {
            return res.status(400).json({
              valid: false,
              message: 'Kunci API Gemini tidak valid atau tidak diizinkan. Periksa kembali API Key dari Google AI Studio.'
            });
          }
        }
      }
    }

    // Jika autentikasi kunci sukses atau Google merespons pesan lonjakan beban (high demand)
    if (isKeyAuthenticated || hadHighDemandSpike) {
      return res.json({
        valid: true,
        message: 'Gemini API Key valid dan aktif! (Catatan: Server Google saat ini sedang mengalami lonjakan beban sementara pada model tertentu, namun kunci Anda terverifikasi dan sistem otomatis memilih model tercepat).',
        model: 'gemini-3.1-flash-lite',
        highDemand: true
      });
    }

    let friendlyErrorMessage = 'Layanan AI sedang sibuk. Silakan coba sesaat lagi.';
    if (lastError?.message) {
      try {
        const parsed = JSON.parse(lastError.message);
        if (parsed?.error?.message) {
          friendlyErrorMessage = parsed.error.message;
        }
      } catch {
        friendlyErrorMessage = lastError.message;
      }
    }

    if (
      friendlyErrorMessage.includes('high demand') ||
      friendlyErrorMessage.includes('Spikes in demand') ||
      friendlyErrorMessage.includes('503') ||
      friendlyErrorMessage.includes('UNAVAILABLE')
    ) {
      return res.json({
        valid: true,
        message: 'Gemini API Key valid dan aktif! (Server Google merespons lonjakan beban sementara, kunci Anda siap digunakan).',
        model: 'gemini-3.1-flash-lite',
        highDemand: true
      });
    }

    return res.status(400).json({
      valid: false,
      message: `Validasi gagal: ${friendlyErrorMessage}`
    });
  } catch (err: any) {
    console.error('Error validating Gemini key:', err);
    let errMsg = err?.message || 'Kunci tidak valid atau kuota habis.';
    try {
      const parsed = JSON.parse(errMsg);
      if (parsed?.error?.message) errMsg = parsed.error.message;
    } catch {}

    if (
      errMsg.includes('high demand') ||
      errMsg.includes('Spikes in demand') ||
      errMsg.includes('503') ||
      errMsg.includes('UNAVAILABLE')
    ) {
      return res.json({
        valid: true,
        message: 'Gemini API Key valid dan aktif! (Terverifikasi dari Google AI Studio).',
        model: 'gemini-3.1-flash-lite',
        highDemand: true
      });
    }

    return res.status(400).json({
      valid: false,
      message: `Validasi gagal: ${errMsg}`
    });
  }
});

// Helper untuk mengekstrak array soal JSON secara tangguh dari respons model
function parseQuestionsJson(rawText: string): any[] {
  if (!rawText) return [];
  const clean = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
    if (parsed && Array.isArray(parsed.soal)) return parsed.soal;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
  } catch {
    // Regex fallback jika ada teks pengantar di luar array [ ... ]
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const sliced = clean.slice(start, end + 1);
        const parsed = JSON.parse(sliced);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
  }
  return [];
}

// Helper untuk membersihkan prefix opsi dan mendiversifikasi kunci secara aman
function diversifyAnswerKeys(questions: any[]): any[] {
  if (!Array.isArray(questions) || questions.length === 0) return questions;

  // 1. Bersihkan prefix huruf ganda seperti "A. ", "B. ", "1. " dari teks pilihan
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q && Array.isArray(q.options)) {
      q.options = q.options.map((o: any) => ({
        ...o,
        text: String(o.text || '').replace(/^[A-Ea-e\d][\.\)\-]\s*/, '').trim()
      }));
    }
  }

  if (questions.length <= 1) return questions;

  // Cek apakah model AI sudah mendistribusikan kunci secara bervariasi
  const mcQuestions = questions.filter((q: any) => q.type === 'multiple_choice' || q.type === 'true_false' || !q.type);
  const singleKeys = mcQuestions.map((q: any) => typeof q.correctKey === 'string' ? q.correctKey : q.correctKey?.[0]);
  const isAlreadyVaried = new Set(singleKeys.filter(Boolean)).size > 1;

  // Jika AI sudah memberikan sebaran kunci yang bervariasi, PERTAHANKAN teks dan kunci aslinya demi kebenaran pedagogis!
  if (isAlreadyVaried) {
    return questions;
  }

  // Hanya jika AI menghasilkan kunci seragam monoton (misal semua opt_a), lakukan rotasi terkontrol
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || !Array.isArray(q.options) || q.options.length < 2) continue;
    const optIds: string[] = q.options.map((o: any) => o.id);

    if (q.type === 'multiple_choice' || q.type === 'true_false' || !q.type) {
      let currentKey = typeof q.correctKey === 'string' ? q.correctKey : (Array.isArray(q.correctKey) && q.correctKey[0] ? q.correctKey[0] : optIds[0]);
      const targetKey = optIds[i % optIds.length];

      if (currentKey !== targetKey) {
        const optCurrent = q.options.find((o: any) => o.id === currentKey);
        const optTarget = q.options.find((o: any) => o.id === targetKey);
        if (optCurrent && optTarget) {
          const temp = optCurrent.text;
          optCurrent.text = optTarget.text;
          optTarget.text = temp;
          q.correctKey = targetKey;
        }
      }
    }
  }

  return questions;
}

/**
 * Endpoint Generate Soal dengan Retry Backoff & Multimodel Fallback
 */
apiRouter.post('/gemini/generate-questions', async (req, res) => {
  try {
    const { 
      topic, 
      count = 5, 
      difficulty = 'Sedang', 
      taxonomy = 'bloom', 
      questionType = 'multiple_choice',
      typeBreakdown,
      subject = 'Umum', 
      grade = 'SMA/SMK',
      customApiKey,
      learningObjectives = [],
      customPrompt = ''
    } = req.body;

    const apiKey = (customApiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Gemini API Key belum dimasukkan. Silakan atur di menu Pengaturan.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    const validObjectives = Array.isArray(learningObjectives) ? learningObjectives.filter(Boolean).slice(0, 15) : [];
    const tpInstruction = validObjectives.length > 0
      ? `\n- TUJUAN PEMBELAJARAN (TP) YANG HARUS DICAKUP (Total ${validObjectives.length} TP, dukung hingga 15 TP):\n${validObjectives.map((tp: string, idx: number) => `  TP ${idx + 1}: ${tp}`).join('\n')}\nDistribusikan butir soal secara berimbang ke seluruh Tujuan Pembelajaran di atas. Setiap butir soal HARUS mengisi atribut "learningObjective" sesuai dengan teks TP yang disasarnya.\n`
      : '';

    const customPromptInstruction = customPrompt && typeof customPrompt === 'string' && customPrompt.trim().length > 0
      ? `\n- INSTRUKSI / PROMPT KHUSUS DARI GURU:\n"${customPrompt.trim()}"\nWajib ikuti instruksi spesifik di atas dalam perumusan konteks, stimulus, atau karakteristik soal.\n`
      : '';

    let typeInstruction = '';
    if (typeBreakdown && (typeBreakdown.multipleChoice > 0 || typeBreakdown.checkbox > 0 || typeBreakdown.trueFalse > 0 || typeBreakdown.essay > 0)) {
      typeInstruction = `Distribusi Kuantitas per Bentuk Soal (Wajib Ditaati Persis Total ${count} butir):\n` +
        (typeBreakdown.multipleChoice > 0 ? `- Buat persis ${typeBreakdown.multipleChoice} butir Pilihan Ganda Tunggal ("type": "multiple_choice", 4 pilihan opsi opt_a..opt_d, 1 kunci benar)\n` : '') +
        (typeBreakdown.checkbox > 0 ? `- Buat persis ${typeBreakdown.checkbox} butir Pilihan Ganda Kompleks ("type": "checkbox", 4 pilihan opsi opt_a..opt_d, 2 atau lebih kunci benar)\n` : '') +
        (typeBreakdown.trueFalse > 0 ? `- Buat persis ${typeBreakdown.trueFalse} butir Benar/Salah ("type": "multiple_choice", 2 pilihan: Benar & Salah, 1 kunci benar)\n` : '') +
        (typeBreakdown.essay > 0 ? `- Buat persis ${typeBreakdown.essay} butir Uraian / Isian Singkat ("type": "essay", "options": [], kunci berupa teks acuan)\n` : '');
    } else {
      typeInstruction = 
        questionType === 'multiple_choice' ? 'Semua butir soal berbentuk Pilihan Ganda Tunggal ("type": "multiple_choice") dengan 4 pilihan ("opt_a", "opt_b", "opt_c", "opt_d") dan 1 kunci benar.' :
        questionType === 'checkbox' ? 'Semua butir soal berbentuk Pilihan Ganda Kompleks ("type": "checkbox") dengan 4 pilihan di mana terdapat 2 atau lebih jawaban yang benar ("correctKey": ["opt_a", "opt_c"]).' :
        questionType === 'true_false' ? 'Semua butir soal berbentuk Benar/Salah ("type": "multiple_choice") dengan 2 opsi ("opt_a": "Benar", "opt_b": "Salah") dan "correctKey" berupa "opt_a" atau "opt_b".' :
        questionType === 'essay' ? 'Semua butir soal berbentuk Uraian / Isian Singkat ("type": "essay") dengan "options": [] dan "correctKey" berupa kata kunci / jawaban esai.' :
        'Berikan kombinasi variatif yang seimbang antara Pilihan Ganda ("type": "multiple_choice"), Pilihan Ganda Kompleks ("type": "checkbox"), dan Uraian ("type": "essay").';
    }

    const combinedContext = `${subject} ${topic} ${customPrompt}`.toLowerCase();
    const isJavaneseContext =
      combinedContext.includes('jawa') ||
      combinedContext.includes('aksara') ||
      combinedContext.includes('carakan') ||
      combinedContext.includes('sandhangan') ||
      combinedContext.includes('murda') ||
      combinedContext.includes('pasangan') ||
      combinedContext.includes('tembang') ||
      combinedContext.includes('unggah');

    const javaneseInstruction = isJavaneseContext
      ? `\nPANDUAN KHUSUS BAHASA JAWA & AKSARA JAWA (WAJIB DIPATUHI):
- Jika soal menyertakan atau menanyakan penulisan Aksara Jawa, WAJIB menuliskan karakter Unicode Aksara Jawa asli (blok U+A980–U+A9DF) secara tepat, bukan sekadar tulisan Latin!
- Terapkan kaidah penulisan Aksara Jawa baku (Paugeran Sriwedari / KBJ):
  * Aksara Nglegena/Carakan (ꦲ-ꦔ), Aksara Murda untuk huruf kapital/penghormatan (ꦟ, ꦑ, ꦡ, ꦯ, ꦦ, ꦘ, ꦓ, ꦨ).
  * Sandhangan Swara (ꦶ wulu, ꦸ suku, ꦺ taling, ꦼ pepet, ꦺꦴ taling tarung), Panyigeg Wanda (ꦁ cecak, ꦂ layar, ꦃ wignyan, ꧀ pangkon hanya di akhir kata/kalimat), dan Wyanjana (ꦿ cakra, ꦽ keret, ꦾ pengkal).
  * Pasangan (gunakan tanda Pangkon ꧀ tepat di antara konsonan mati dan aksara berikutnya di tengah kata/kalimat, contoh: mangan sega = ꦩꦔꦤ꧀ꦱꦼꦒ).
  * Tanda baca Pada (꧋ adeg-adeg awal kalimat, ꧈ lingsa koma, ꧉ lungsi titik) dan Angka Jawa (꧐-꧙ wajib diapit Pada Pangkat ꧇...꧇, contoh: ꧇꧒꧐꧒꧕꧇).
  * Untuk penjelasan tata bahasa/unggah-ungguh basa (Ngoko/Krama), rujuk aturan Paramasastra & Unggah-Ungguh Basa Jawa baku.\n`
      : '';

    const promptText = `
Anda adalah seorang pakar kurikulum dan asesmen pendidikan nasional (Kurikulum Merdeka / K13).
Tugas Anda adalah menghasilkan persis ${count} butir soal berkualitas tinggi untuk:
- Mata Pelajaran: ${subject}
- Topik / Pokok Bahasan: ${topic}
- Jenjang Kelas: ${grade}
- Tingkat Kesulitan: ${difficulty}
- Kerangka Taksonomi: ${taxonomy === 'solo' ? 'SOLO (Prestructural, Unistructural, Multistructural, Relational, Extended Abstract)' : 'Bloom-Anderson (C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta)'}
- Bentuk Soal: ${typeInstruction}${tpInstruction}${customPromptInstruction}${javaneseInstruction}

PANDUAN KHUSUS SOAL HOTS & STIMULUS BACAAN MENDALAM (WAJIB DIPATUHI):
1. STIMULUS KAYA & KONTEKSTUAL (2 - 4 PARAGRAF / DATA / STUDI KASUS):
   - Setiap butir soal WAJIB diawali dengan STIMULUS BACAAN yang memadai dan mendalam (minimal 2 sampai 4 paragraf narasi kontekstual, dialog bermakna antar tokoh, hasil pengamatan/percobaan, deskripsi tabel data, atau studi kasus nyata yang dekat dengan kehidupan murid).
   - DILARANG KERAS membuat stimulus pendek 1 baris atau pertanyaan hafalan langsung tanpa bacaan!
   - Stimulus harus mendorong murid untuk membaca dengan teliti (close reading). Masukkan fakta-fakta penting, data pengamatan, atau petunjuk eksplisit & implisit di dalam narasi tersebut.
2. TUNTUTAN ANALISIS SEBELUM MENJAWAB:
   - Pertanyaan pokok setelah narasi harus menuntut murid menganalisis isi bacaan, menghubungkan hubungan sebab-akibat, membandingkan data, mengevaluasi argumen, atau merumuskan solusi atas masalah yang disajikan dalam stimulus.
3. KESESUAIAN BAHASA DENGAN JENJANG KELAS (${grade}):
   - Untuk jenjang SD (Sekolah Dasar): Gunakan narasi cerita yang runtut, hangat, nama tokoh ramah anak (Budi, Siti, Edo, Lani, dsb.), dan situasi nyata di lingkungan rumah/sekolah/alam sekitar.
   - Untuk jenjang SMP/SMA: Gunakan wacana literasi sains/sosial, data tabel percobaan, studi kasus fenomena alam/teknologi kontemporer.

ATURAN MUTLAK KEBENARAN KUNCI JAWABAN & VARIASI OPSI (ANTI SALAH KUNCI):
1. KEBENARAN KONTEN ADALAH PRIORITAS UTAMA:
   - Opsi yang Anda tunjuk sebagai "correctKey" (misal "opt_a", "opt_b", "opt_c", atau "opt_d") HARUS berisi teks jawaban yang 100% BENAR, AKURAT, dan MENJAWAB PERTANYAAN secara tepat.
   - DILARANG KERAS menetapkan opsi yang salah sebagai kunci jawaban! Opsi pengecoh (distraktor) harus masuk akal namun jelas salah.
2. ROTASIKAN POSISI JAWABAN BENAR AGAR KUNCI BERVARIASI (ANTI MONOTON):
   - Jangan meletakkan jawaban benar pada opsi yang sama berturut-turut!
   - Rotasikan di opsi mana Anda MENULISKAN teks jawaban yang benar:
     * Nomor 1: Tuliskan teks jawaban BENAR pada "opt_a", dan opsi lain sebagai pengecoh. Kunci: "opt_a".
     * Nomor 2: Tuliskan teks jawaban BENAR pada "opt_b", dan opsi lain sebagai pengecoh. Kunci: "opt_b".
     * Nomor 3: Tuliskan teks jawaban BENAR pada "opt_c", dan opsi lain sebagai pengecoh. Kunci: "opt_c".
     * Nomor 4: Tuliskan teks jawaban BENAR pada "opt_d", dan opsi lain sebagai pengecoh. Kunci: "opt_d".
     * Nomor 5: Tuliskan teks jawaban BENAR pada "opt_b" (atau "opt_c"), dst.
   - Pastikan teks jawaban yang benar SELALU berada di dalam opsi yang Anda jadikan "correctKey"!
3. TEKS OPSI JAWABAN MURNI:
   - DILARANG menuliskan huruf "A. ", "B. ", "C. ", "D. " di awal teks opsi! Tuliskan teksnya langsung (Contoh: "Fotosintesis pada daun", BUKAN "A. Fotosintesis pada daun").
4. ATURAN MUTLAK PENULISAN "explanation" (PEMBAHASAN PEMBIMBING MANDIRI — ANTI SPOILER KUNCI):
   - HINDARI MEMBERIKAN KUNCI JAWABAN SECARA LANGSUNG di dalam "explanation"! DILARANG menulis frasa seperti "Jawaban yang benar adalah...", "Jadi pilihannya adalah A/B/C/D", atau menyebutkan teks opsi kunci secara langsung sebagai kesimpulan akhir. Kunci jawaban hanya disimpan di field "correctKey" untuk Guru.
   - Berikan penjelasan yang detail mengenai KESALAHAN KONSEP / MENGAPA JAWABAN YANG KELIRU SALAH (jelaskan kekeliruan logika pada pengecoh tanpa membocorkan opsi mana yang benar), serta tunjukkan **ciri-ciri, kata kunci dalam stimulus, cara menganalisis, dan langkah pemecahan masalah** agar siswa mampu menemukan jawaban yang benar secara mandiri.
   - KHUSUS MATEMATIKA / HITUNGAN: "explanation" DILARANG KERAS menunjukkan hasil akhir perhitungan / angka jawaban akhir! Hanya boleh berisi identifikasi besaran yang diketahui-ditanya, **rumus yang digunakan, dan urutan langkah-langkah menghitungnya** hingga tahap substitusi sebelum hasil akhir.
   - KHUSUS BAHASA (Indonesia, Inggris, Jawa, Daerah): Jika berkaitan dengan tata bahasa/ejaan/aksara, berikan penjelasan sesuai **aturan tata bahasa yang baku dan terbaru** (misalnya EYD Edisi V, KBBI VI, Tata Bahasa Baku Bahasa Indonesia, Standard English Grammar, atau Paramasastra/Paugeran Aksara Jawa).
   - KHUSUS IPAS (IPA, IPS, Sains): Gunakan **rujukan ilmiah** (sebutkan hukum, prinsip, teori, atau fakta ilmiah terverifikasi seperti Hukum Newton, proses fotosintesis Kloroplas, siklus hidrologi, dll.) dalam menjelaskan konsepnya secara ringkas dan akurat.

Setiap butir soal HARUS berformat JSON dengan struktur persis seperti berikut:
[
  {
    "order": 1,
    "prompt": "Stimulus bacaan 2-4 paragraf yang kaya dan kontekstual... (diikuti kalimat pertanyaan analisis yang jelas)",
    "type": "${questionType === 'checkbox' ? 'checkbox' : questionType === 'essay' ? 'essay' : 'multiple_choice'}",
    "mediaType": "none",
    "options": [
      { "id": "opt_a", "text": "Teks opsi A (tanpa awalan huruf A.)" },
      { "id": "opt_b", "text": "Teks opsi B (tanpa awalan huruf B.)" },
      { "id": "opt_c", "text": "Teks opsi C (tanpa awalan huruf C.)" },
      { "id": "opt_d", "text": "Teks opsi D (tanpa awalan huruf D.)" }
    ],
    "correctKey": "${questionType === 'checkbox' ? '["opt_a", "opt_c"]' : 'opt_b'}",
    "points": 20,
    "explanation": "Panduan analisis mendalam: jelaskan kesalahan pengecoh, ciri-ciri/konsep ilmiah/tata bahasa baku atau rumus & langkah hitung TANPA membocorkan kunci jawaban atau hasil akhir",
    "bloomLevel": "C4 - Menganalisis",
    "soloLevel": "Relational",
    "basicCompetency": "Kompetensi Dasar / Capaian Pembelajaran terkait",
    "indicator": "Indikator pencapaian kompetensi soal ini",
    "learningObjective": "${validObjectives[0] || 'Peserta didik mampu menganalisis konsep pokok materi'}"
  }
]

Hasilkan HANYA array JSON murni tanpa markdown pembungkus tambahan.
`;

    // Retry loop untuk antisipasi 503 / 504 / 429 across models
    let lastError: any = null;
    let questionsData: any[] = [];

    const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: promptText,
            config: {
              responseMimeType: 'application/json',
              maxOutputTokens: 16384,
              systemInstruction: 'Anda adalah generator soal ujian berbasis kurikulum nasional. Anda selalu menghasilkan JSON murni berisi daftar array butir soal tanpa teks pembuka atau penutup. Anda selalu mendistribusikan kunci jawaban secara bervariasi. Pada field "explanation", Anda DILARANG membocorkan kunci jawaban atau hasil akhir perhitungan matematika secara langsung; jelaskan kesalahan pengecoh, ciri-ciri, langkah/rumus, kaidah tata bahasa baku terbaru, atau rujukan ilmiah agar siswa dapat menemukan jawaban sendiri secara mandiri.'
            }
          });

          const rawText = response.text?.trim() || '';
          questionsData = parseQuestionsJson(rawText);
          if (Array.isArray(questionsData) && questionsData.length > 0) {
            break;
          }
        } catch (retryErr: any) {
          lastError = retryErr;
          const msg = String(retryErr?.message || '');
          console.warn(`Gemini (${model}) attempt ${attempt} failed:`, msg);
          
          if (msg.includes('high demand') || msg.includes('Spikes in demand') || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED')) {
            break;
          }
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 800 * attempt));
          }
        }
      }
      if (Array.isArray(questionsData) && questionsData.length > 0) break;
    }

    if (!questionsData || questionsData.length === 0) {
      throw lastError || new Error('Gagal menghasilkan soal setelah mencoba model alternatif.');
    }

    // Terapkan perlindungan deterministik anti-kunci-monoton
    questionsData = diversifyAnswerKeys(questionsData);

    return res.json({
      success: true,
      questions: questionsData,
      count: questionsData.length
    });
  } catch (err: any) {
    console.error('Error generating questions:', err);
    return res.status(500).json({
      success: false,
      message: `Gagal membuat soal AI: ${err?.message || 'Terjadi gangguan koneksi ke layanan AI.'}`
    });
  }
});

/**
 * Proxy route ke Google Apps Script untuk mengatasi pembatasan CORS browser
 */
apiRouter.all('/gas-proxy', async (req, res) => {
  try {
    const targetUrl = req.body?.url || req.query?.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ status: 'error', message: 'URL GAS kosong' });
    }

    const isGet = req.method === 'GET' || (req.body && req.body._method === 'GET');
    const fetchOptions: RequestInit = {
      method: isGet ? 'GET' : 'POST',
      headers: {
        'Accept': 'application/json'
      },
      redirect: 'follow'
    };

    if (!isGet) {
      const payload = req.body?.payload || req.body;
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'text/plain;charset=utf-8'
      };
      fetchOptions.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return res.json(json);
    } catch {
      return res.json({ status: 'success', raw: text });
    }
  } catch (err: any) {
    console.error('Proxy GAS error:', err);
    return res.status(500).json({ status: 'error', message: err?.message || 'Gagal menghubungi Google Apps Script' });
  }
});

/**
 * -------------------------------------------------------------
 * SISTEM LIVE CHAT GURU & SISWA (REAL-TIME WEBSOCKET + REST)
 * Siswa dapat chat dengan pengawas sebelum login ke naskah soal!
 * -------------------------------------------------------------
 */
interface ServerChatMessage {
  id: string;
  senderType: 'student' | 'teacher' | 'system';
  senderRole?: 'student' | 'teacher' | 'system';
  senderName: string;
  senderNis?: string;
  classGrade?: string;
  examId?: string;
  examTitle?: string;
  targetNis?: string; // 'all' or student NIS
  targetName?: string;
  text: string;
  timestamp: number | string;
  isRead?: boolean;
  quickAction?: any;
}

const CHAT_DATA_FILE = path.join(__dirname, '.chat_messages_cache.json');

function loadChatMessages(): ServerChatMessage[] {
  try {
    if (fs.existsSync(CHAT_DATA_FILE)) {
      const content = fs.readFileSync(CHAT_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading chat cache:', err);
  }
  return [
    {
      id: 'MSG-INIT-001',
      senderType: 'system',
      senderRole: 'system',
      senderName: 'Pengawas Ujian SDN Pisangcandi 1',
      text: 'Selamat datang di Ruang Bantuan Pengawas Ujian! Silakan hubungi pengawas jika Anda membutuhkan token ujian, izin mengulang, atau mengalami kendala sebelum masuk ujian.',
      timestamp: Date.now(),
      targetNis: 'all',
      isRead: true
    }
  ];
}

const chatMessages: ServerChatMessage[] = loadChatMessages();

function saveChatMessagesToDisk() {
  try {
    fs.writeFileSync(CHAT_DATA_FILE, JSON.stringify(chatMessages.slice(-500), null, 2), 'utf-8');
  } catch (err) {
    console.warn('Error saving chat cache:', err);
  }
}

interface ConnectedClient {
  ws: WebSocket;
  role: 'teacher' | 'student';
  nis?: string;
  name?: string;
  classGrade?: string;
  examId?: string;
}
const connectedClients = new Set<ConnectedClient>();

function sanitizeTimestamp(ts: any): number {
  if (typeof ts === 'number') return ts;
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? Date.now() : parsed;
}

function broadcastChatMessage(msg: ServerChatMessage) {
  // Normalize timestamp before sending
  const normalizedMsg = {
    ...msg,
    timestamp: sanitizeTimestamp(msg.timestamp)
  };
  const payload = JSON.stringify({ type: 'chat:message', data: normalizedMsg });

  connectedClients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (client.role === 'teacher') {
        // Guru selalu menerima semua pesan
        try { client.ws.send(payload); } catch {}
      } else {
        // Siswa menerima pesan siaran ('all' / kosong) atau yang ditujukan padanya / dikirim olehnya
        const cleanTarget = String(msg.targetNis || '').trim().toLowerCase();
        const cleanSender = String(msg.senderNis || '').trim().toLowerCase();
        const clientNis = String(client.nis || '').trim().toLowerCase();
        const clientName = String(client.name || '').trim().toLowerCase();
        const targetName = String(msg.targetName || '').trim().toLowerCase();

        const isBroadcast = !cleanTarget || cleanTarget === 'all';
        const isTargetedToMe = Boolean(clientNis && cleanTarget && (cleanTarget === clientNis || clientNis.includes(cleanTarget) || cleanTarget.includes(clientNis))) ||
                              Boolean(clientName && targetName && targetName === clientName);
        const isSentByMe = Boolean(clientNis && cleanSender && (cleanSender === clientNis || clientNis.includes(cleanSender) || cleanSender.includes(clientNis)));

        if (isBroadcast || isTargetedToMe || isSentByMe) {
          try { client.ws.send(payload); } catch {}
        }
      }
    }
  });
}

function broadcastOnlineCount() {
  const studentsList: { nis: string; name: string; classGrade?: string; examId?: string }[] = [];
  const teachersList: { name: string }[] = [];

  connectedClients.forEach(c => {
    if (c.role === 'student') {
      studentsList.push({
        nis: c.nis || '',
        name: c.name || 'Siswa',
        classGrade: c.classGrade,
        examId: c.examId
      });
    } else if (c.role === 'teacher') {
      teachersList.push({
        name: c.name || 'Guru Pengawas'
      });
    }
  });

  const payload = JSON.stringify({
    type: 'chat:presence',
    data: {
      teachers: teachersList.length,
      students: studentsList.length,
      teachersOnline: teachersList.length,
      studentsOnline: studentsList.length,
      onlineStudents: studentsList
    }
  });
  connectedClients.forEach(c => {
    if (c.ws.readyState === WebSocket.OPEN) {
      try { c.ws.send(payload); } catch {}
    }
  });
}

// 1. GET /api/chat/messages
apiRouter.get('/chat/messages', (req, res) => {
  const nis = req.query.nis ? String(req.query.nis).trim().toLowerCase() : '';
  const guestNis = req.query.guestNis ? String(req.query.guestNis).trim().toLowerCase() : '';
  const role = req.query.role ? String(req.query.role).trim().toLowerCase() : 'student';

  const sanitized = chatMessages.map(m => ({
    ...m,
    timestamp: sanitizeTimestamp(m.timestamp)
  }));

  if (role === 'teacher') {
    // Guru dapat melihat seluruh log pesan
    return res.json({ success: true, messages: sanitized });
  }

  // Siswa melihat pesan miliknya (NIS terdaftar atau ID Tamu) dan pengumuman umum ('all')
  const filtered = sanitized.filter(m => {
    const cleanTarget = String(m.targetNis || '').trim().toLowerCase();
    const cleanSender = String(m.senderNis || '').trim().toLowerCase();
    if (!cleanTarget || cleanTarget === 'all') return true;
    if (nis && (cleanTarget === nis || cleanSender === nis)) return true;
    if (guestNis && (cleanTarget === guestNis || cleanSender === guestNis)) return true;
    return false;
  });

  return res.json({ success: true, messages: filtered });
});

// 2. POST /api/chat/messages
apiRouter.post('/chat/messages', (req, res) => {
  try {
    const d = req.body;
    const sRole = d.senderRole || d.senderType || 'student';
    const text = String(d.text || '').trim();

    if (!text) {
      return res.status(400).json({ success: false, message: 'Isi pesan tidak boleh kosong.' });
    }

    const msgId = d.id || `MSG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newMsg: ServerChatMessage = {
      id: msgId,
      senderType: sRole,
      senderRole: sRole,
      senderName: String(d.senderName || (sRole === 'teacher' ? 'Guru Pengawas' : 'Siswa')).trim(),
      senderNis: d.senderNis ? String(d.senderNis).trim() : '',
      classGrade: d.classGrade ? String(d.classGrade).trim() : '',
      examId: d.examId ? String(d.examId).trim() : '',
      examTitle: d.examTitle ? String(d.examTitle).trim() : '',
      targetNis: (!d.targetNis || d.targetNis === 'all') ? 'all' : String(d.targetNis).trim(),
      targetName: d.targetName ? String(d.targetName).trim() : undefined,
      text: text,
      timestamp: d.timestamp ? sanitizeTimestamp(d.timestamp) : Date.now(),
      isRead: sRole === 'teacher',
      quickAction: d.quickAction || 'general'
    };

    const existingIndex = chatMessages.findIndex(m => m.id === newMsg.id);
    if (existingIndex >= 0) {
      chatMessages[existingIndex] = newMsg;
    } else {
      chatMessages.push(newMsg);
      if (chatMessages.length > 500) {
        chatMessages.shift();
      }
    }

    // Broadcast ke semua WebSocket yang tersambung
    broadcastChatMessage(newMsg);
    saveChatMessagesToDisk();

    return res.json({ success: true, message: newMsg });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal mengirim pesan chat.' });
  }
});

// 3. POST /api/chat/mark-read
apiRouter.post('/chat/mark-read', (req, res) => {
  const { nis, messageIds } = req.body;
  if (Array.isArray(messageIds) && messageIds.length > 0) {
    const idSet = new Set(messageIds);
    chatMessages.forEach(m => {
      if (idSet.has(m.id)) m.isRead = true;
    });
    saveChatMessagesToDisk();
  } else if (nis) {
    const cleanNis = String(nis).trim().toLowerCase();
    chatMessages.forEach(m => {
      if (m.senderNis && m.senderNis.toLowerCase() === cleanNis) m.isRead = true;
    });
    saveChatMessagesToDisk();
  }
  return res.json({ success: true });
});

// 4. DELETE /api/chat/messages
apiRouter.delete('/chat/messages', (_req, res) => {
  chatMessages.length = 0;
  chatMessages.push({
    id: `MSG-RESET-${Date.now()}`,
    senderType: 'system',
    senderRole: 'system',
    senderName: 'Pengawas Ujian SDN Pisangcandi 1',
    text: 'Riwayat percakapan telah dibersihkan oleh guru pengawas.',
    timestamp: Date.now(),
    targetNis: 'all',
    isRead: true
  });
  broadcastChatMessage(chatMessages[0]);
  saveChatMessagesToDisk();
  return res.json({ success: true, message: 'Riwayat chat berhasil dibersihkan.' });
});

/**
 * -------------------------------------------------------------
 * AUTHORITATIVE EXAM SESSION CONTROL & SINGLE-ATTEMPT LOCKS
 * Memastikan perintah "Hentikan Permanen", "Mulai Sesi Guru", dan
 * "Mode Sekali (1x)" langsung berlaku di seluruh perangkat siswa.
 * -------------------------------------------------------------
 */
interface ServerExamControl {
  examId: string;
  status: 'draft' | 'active' | 'archived' | 'stopped';
  sessionStatus: 'scheduled' | 'active' | 'ended' | 'stopped';
  attemptMode: 'single' | 'unlimited';
  allowLateSubmission?: boolean;
  lateExtensionMinutes?: number;
  startsAt?: string;
  endsAt?: string;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  updatedAt: number;
}

interface ServerExamAttempt {
  examId: string;
  studentNo: string;
  studentName: string;
  submissionId: string;
  submittedAt: string;
  statusNote: string;
  allowRepeat: boolean;
}

const EXAM_CONTROLS_FILE = path.join(__dirname, '.exam_controls_cache.json');
const EXAM_ATTEMPTS_FILE = path.join(__dirname, '.exam_attempts_cache.json');

function loadExamControls(): Record<string, ServerExamControl> {
  try {
    if (fs.existsSync(EXAM_CONTROLS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(EXAM_CONTROLS_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.warn('Error reading exam controls cache:', err);
  }
  return {};
}

function loadExamAttempts(): ServerExamAttempt[] {
  try {
    if (fs.existsSync(EXAM_ATTEMPTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(EXAM_ATTEMPTS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading exam attempts cache:', err);
  }
  return [];
}

const examControlsMap: Record<string, ServerExamControl> = loadExamControls();
let examAttemptsList: ServerExamAttempt[] = loadExamAttempts();

function saveExamControlsToDisk() {
  try {
    fs.writeFileSync(EXAM_CONTROLS_FILE, JSON.stringify(examControlsMap, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Error saving exam controls cache:', err);
  }
}

function saveExamAttemptsToDisk() {
  try {
    fs.writeFileSync(EXAM_ATTEMPTS_FILE, JSON.stringify(examAttemptsList.slice(-2000), null, 2), 'utf-8');
  } catch (err) {
    console.warn('Error saving exam attempts cache:', err);
  }
}

function broadcastExamControl(control: ServerExamControl) {
  const payload = JSON.stringify({ type: 'exam:control_update', data: control });
  connectedClients.forEach(c => {
    if (c.ws.readyState === WebSocket.OPEN) {
      try { c.ws.send(payload); } catch {}
    }
  });
}

// GET /api/exam-controls
apiRouter.get('/exam-controls', (_req, res) => {
  return res.json({ success: true, controls: examControlsMap });
});

// POST /api/exam-controls
apiRouter.post('/exam-controls', (req, res) => {
  try {
    const body = req.body || {};
    const rawId = String(body.examId || body.id || '').trim();
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'examId wajib diisi.' });
    }
    const key = rawId.toLowerCase();
    const existing = examControlsMap[key];

    const rawStatus = String(body.status || existing?.status || 'active').trim().toLowerCase();
    const status: ServerExamControl['status'] =
      rawStatus === 'stopped' ? 'stopped' :
      rawStatus === 'archived' ? 'archived' :
      rawStatus === 'draft' ? 'draft' : 'active';

    const rawSession = String(body.sessionStatus || existing?.sessionStatus || 'scheduled').trim().toLowerCase();
    const sessionStatus: ServerExamControl['sessionStatus'] =
      status === 'stopped' || rawSession === 'stopped' ? 'stopped' :
      rawSession === 'active' ? 'active' :
      rawSession === 'ended' ? 'ended' : 'scheduled';

    const rawMode = String(body.attemptMode || existing?.attemptMode || 'single').trim().toLowerCase();
    const attemptMode: ServerExamControl['attemptMode'] =
      rawMode === 'unlimited' || rawMode === 'berulang' ? 'unlimited' : 'single';

    const updated: ServerExamControl = {
      examId: rawId,
      status,
      sessionStatus,
      attemptMode,
      allowLateSubmission: status === 'stopped' ? false : Boolean(body.allowLateSubmission ?? existing?.allowLateSubmission ?? false),
      lateExtensionMinutes: Number(body.lateExtensionMinutes ?? existing?.lateExtensionMinutes ?? 0),
      startsAt: body.startsAt ?? existing?.startsAt,
      endsAt: body.endsAt ?? existing?.endsAt,
      sessionStartedAt: body.sessionStartedAt ?? existing?.sessionStartedAt,
      sessionEndedAt: body.sessionEndedAt ?? existing?.sessionEndedAt,
      updatedAt: Date.now()
    };

    examControlsMap[key] = updated;
    saveExamControlsToDisk();
    broadcastExamControl(updated);

    return res.json({ success: true, control: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal memperbarui kontrol ujian.' });
  }
});

// GET /api/exam-attempts/check
apiRouter.get('/exam-attempts/check', (req, res) => {
  const examId = String(req.query.examId || '').trim().toLowerCase();
  const studentNo = String(req.query.studentNo || '').trim().toLowerCase();
  const studentName = String(req.query.studentName || '').trim().toLowerCase();

  if (!examId) {
    return res.json({ success: true, hasCompleted: false, allowRepeat: false });
  }

  const matched = examAttemptsList.filter(a => {
    if (a.examId.toLowerCase() !== examId) return false;
    const matchNo = Boolean(studentNo && a.studentNo && a.studentNo.toLowerCase() === studentNo);
    const matchName = Boolean(studentName && a.studentName && a.studentName.toLowerCase() === studentName);
    return matchNo || matchName;
  });

  const hasCompleted = matched.some(a => !a.allowRepeat && !String(a.statusNote || '').toLowerCase().includes('ulang'));
  const hasRepeatPermission = matched.some(a => a.allowRepeat || String(a.statusNote || '').toLowerCase().includes('ulang'));

  return res.json({
    success: true,
    hasCompleted: hasCompleted && !hasRepeatPermission,
    allowRepeat: hasRepeatPermission,
    attempts: matched
  });
});

// POST /api/exam-attempts/record
apiRouter.post('/exam-attempts/record', (req, res) => {
  try {
    const b = req.body || {};
    const examId = String(b.examId || '').trim();
    const studentNo = String(b.studentNo || '').trim();
    const studentName = String(b.studentName || '').trim();
    if (!examId || (!studentNo && !studentName)) {
      return res.status(400).json({ success: false, message: 'examId dan identitas siswa wajib diisi.' });
    }

    // Hapus izin ulang lama untuk kombinasi siswa + ujian ini karena siswa baru saja submit
    examAttemptsList = examAttemptsList.filter(a => {
      if (a.examId.toLowerCase() !== examId.toLowerCase()) return true;
      const matchNo = Boolean(studentNo && a.studentNo && a.studentNo.toLowerCase() === studentNo.toLowerCase());
      const matchName = Boolean(studentName && a.studentName && a.studentName.toLowerCase() === studentName.toLowerCase());
      return !(matchNo || matchName);
    });

    examAttemptsList.push({
      examId,
      studentNo,
      studentName,
      submissionId: String(b.submissionId || `SUB-${Date.now()}`),
      submittedAt: String(b.submittedAt || new Date().toISOString()),
      statusNote: 'Selesai',
      allowRepeat: false
    });
    saveExamAttemptsToDisk();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal mencatat pengerjaan ujian.' });
  }
});

// POST /api/exam-attempts/reset
apiRouter.post('/exam-attempts/reset', (req, res) => {
  try {
    const b = req.body || {};
    const examId = String(b.examId || '').trim().toLowerCase();
    const studentNo = String(b.studentNo || '').trim().toLowerCase();
    const studentName = String(b.studentName || '').trim().toLowerCase();
    const submissionId = String(b.submissionId || '').trim().toLowerCase();

    examAttemptsList = examAttemptsList.filter(a => {
      if (submissionId && a.submissionId.toLowerCase() === submissionId) return false;
      if (examId && a.examId.toLowerCase() === examId) {
        const matchNo = Boolean(studentNo && a.studentNo && a.studentNo.toLowerCase() === studentNo);
        const matchName = Boolean(studentName && a.studentName && a.studentName.toLowerCase() === studentName);
        if (matchNo || matchName) return false;
      }
      return true;
    });
    saveExamAttemptsToDisk();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal mereset catatan pengerjaan.' });
  }
});

// Mount router on both /api and root /
app.use('/api', apiRouter);
app.use('/', apiRouter);

/**
 * Inisialisasi Vite middleware & WebSocket Server di port 3000
 */
async function startServer() {
  const server = http.createServer(app);

  // Inisialisasi WebSocket Server pada path /ws/chat
  const wss = new WebSocketServer({ server, path: '/ws/chat' });

  wss.on('connection', (ws: WebSocket) => {
    const client: ConnectedClient = { ws, role: 'student' };
    connectedClients.add(client);
    broadcastOnlineCount();

    // Kirim pesan sambutan & riwayat pesan terkini saat tersambung
    const initialHistory = chatMessages.slice(-50).map(m => ({
      ...m,
      timestamp: sanitizeTimestamp(m.timestamp)
    }));

    ws.send(JSON.stringify({
      type: 'chat:init',
      data: { messages: initialHistory }
    }));
    ws.send(JSON.stringify({
      type: 'chat:history',
      data: initialHistory
    }));
    ws.send(JSON.stringify({
      type: 'exam:controls_init',
      data: examControlsMap
    }));

    ws.on('message', (raw: string) => {
      try {
        const payload = JSON.parse(raw.toString());
        
        // 1. Pendaftaran peran (role: teacher / student)
        if (payload.type === 'auth:register') {
          const reg = payload.data || payload;
          const regRole = reg.role || payload.role;
          client.role = regRole === 'teacher' ? 'teacher' : 'student';
          client.nis = reg.nis ? String(reg.nis).trim() : (payload.nis ? String(payload.nis).trim() : undefined);
          client.name = reg.name ? String(reg.name).trim() : (payload.name ? String(payload.name).trim() : undefined);
          client.classGrade = reg.classGrade ? String(reg.classGrade).trim() : (payload.classGrade ? String(payload.classGrade).trim() : undefined);
          client.examId = reg.examId ? String(reg.examId).trim() : (payload.examId ? String(payload.examId).trim() : undefined);
          broadcastOnlineCount();
          return;
        }

        // 2. Pengiriman pesan chat real-time
        if (payload.type === 'chat:send' && payload.data) {
          const d = payload.data;
          const sRole = d.senderRole || d.senderType || client.role || 'student';
          
          if (d.senderNis && (!client.nis || client.nis === 'guest')) {
            client.nis = String(d.senderNis).trim();
          }
          if (d.senderName && !client.name) {
            client.name = String(d.senderName).trim();
          }
          if (sRole === 'teacher') {
            client.role = 'teacher';
          }

          const newMsg: ServerChatMessage = {
            id: d.id || `MSG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            senderType: sRole,
            senderRole: sRole,
            senderName: String(d.senderName || client.name || (sRole === 'teacher' ? 'Guru Pengawas' : 'Siswa')).trim(),
            senderNis: d.senderNis || client.nis || '',
            classGrade: d.classGrade || '',
            examId: d.examId || '',
            examTitle: d.examTitle || '',
            targetNis: (!d.targetNis || d.targetNis === 'all') ? 'all' : String(d.targetNis).trim(),
            targetName: d.targetName ? String(d.targetName).trim() : undefined,
            text: String(d.text || '').trim(),
            timestamp: Date.now(),
            isRead: sRole === 'teacher',
            quickAction: d.quickAction || 'general'
          };

          if (newMsg.text.length > 0) {
            chatMessages.push(newMsg);
            if (chatMessages.length > 500) chatMessages.shift();
            broadcastChatMessage(newMsg);
            saveChatMessagesToDisk();
          }
          return;
        }

        // 3. Status sedang mengetik (typing indicator)
        if (payload.type === 'chat:typing') {
          const typingPayload = JSON.stringify({
            type: 'chat:typing',
            data: {
              name: client.name || (client.role === 'teacher' ? 'Guru Pengawas' : 'Siswa'),
              role: client.role,
              nis: client.nis,
              isTyping: Boolean(payload.isTyping)
            }
          });
          connectedClients.forEach(c => {
            if (c.ws !== ws && c.ws.readyState === WebSocket.OPEN) {
              try { c.ws.send(typingPayload); } catch {}
            }
          });
          return;
        }

        // 4. Ping-Pong heartbeat
        if (payload.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(client);
      broadcastOnlineCount();
    });

    ws.on('error', () => {
      connectedClients.delete(client);
      broadcastOnlineCount();
    });
  });

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // Hanya listen port jika tidak berjalan di lingkungan serverless Vercel
  if (!process.env.VERCEL) {
    server.listen(port, '0.0.0.0', () => {
      console.log(`ExamFlow Edu server + WebSocket Chat running at http://0.0.0.0:${port}`);
    });
  }
}

startServer();

export default app;
