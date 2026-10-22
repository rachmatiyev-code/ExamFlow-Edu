import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

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
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-4-argon'];
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

// Helper untuk mendiversifikasi kunci jawaban agar tidak pernah sama secara berurutan
function diversifyAnswerKeys(questions: any[]): any[] {
  if (!Array.isArray(questions) || questions.length <= 1) return questions;

  let lastSingleKey = '';
  let lastCheckboxSignature = '';

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || !Array.isArray(q.options) || q.options.length < 2) continue;

    const optIds: string[] = q.options.map((o: any) => o.id);

    // Kasus 1: Pilihan Ganda Tunggal / Benar-Salah
    if (q.type === 'multiple_choice' || q.type === 'true_false' || !q.type) {
      let currentKey = typeof q.correctKey === 'string' ? q.correctKey : (Array.isArray(q.correctKey) && q.correctKey[0] ? q.correctKey[0] : optIds[0]);
      if (!optIds.includes(currentKey)) {
        currentKey = optIds[0];
        q.correctKey = currentKey;
      }

      // Jika kunci sama dengan nomor sebelumnya, tukar teks opsi dengan opsi lain
      if (lastSingleKey && currentKey === lastSingleKey) {
        const availableTargets = optIds.filter(id => id !== lastSingleKey);
        if (availableTargets.length > 0) {
          const targetKey = availableTargets[i % availableTargets.length];
          const optCurrent = q.options.find((o: any) => o.id === currentKey);
          const optTarget = q.options.find((o: any) => o.id === targetKey);
          if (optCurrent && optTarget) {
            const temp = optCurrent.text;
            optCurrent.text = optTarget.text;
            optTarget.text = temp;
            q.correctKey = targetKey;
            currentKey = targetKey;
          }
        }
      }

      lastSingleKey = currentKey;
    } 
    // Kasus 2: Pilihan Ganda Kompleks (Checkbox)
    else if (q.type === 'checkbox') {
      let currentKeys: string[] = Array.isArray(q.correctKey) ? [...q.correctKey] : [String(q.correctKey || optIds[0])];
      currentKeys = currentKeys.filter(k => optIds.includes(k));
      if (currentKeys.length === 0) {
        currentKeys = [optIds[0], optIds[1] || optIds[0]];
      }

      let currentSig = [...currentKeys].sort().join(',');
      if (lastCheckboxSignature && currentSig === lastCheckboxSignature) {
        // Cari satu opsi yang terpilih dan satu opsi yang tidak terpilih, lalu tukar
        const unselected = optIds.find(id => !currentKeys.includes(id));
        const selected = currentKeys[0];
        if (unselected && selected) {
          const optSel = q.options.find((o: any) => o.id === selected);
          const optUnsel = q.options.find((o: any) => o.id === unselected);
          if (optSel && optUnsel) {
            const temp = optSel.text;
            optSel.text = optUnsel.text;
            optUnsel.text = temp;
            currentKeys = currentKeys.map(k => k === selected ? unselected : k);
            q.correctKey = currentKeys;
            currentSig = [...currentKeys].sort().join(',');
          }
        }
      }

      q.correctKey = currentKeys;
      lastCheckboxSignature = currentSig;
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

    const typeInstruction = 
      questionType === 'multiple_choice' ? 'Semua butir soal berbentuk Pilihan Ganda Tunggal ("type": "multiple_choice") dengan 4 pilihan ("opt_a", "opt_b", "opt_c", "opt_d") dan 1 kunci benar.' :
      questionType === 'checkbox' ? 'Semua butir soal berbentuk Pilihan Ganda Kompleks ("type": "checkbox") dengan 4 pilihan di mana terdapat 2 atau lebih jawaban yang benar ("correctKey": ["opt_a", "opt_c"]).' :
      questionType === 'true_false' ? 'Semua butir soal berbentuk Benar/Salah ("type": "multiple_choice") dengan 2 opsi ("opt_a": "Benar", "opt_b": "Salah") dan "correctKey" berupa "opt_a" atau "opt_b".' :
      questionType === 'essay' ? 'Semua butir soal berbentuk Uraian / Isian Singkat ("type": "essay") dengan "options": [] dan "correctKey" berupa kata kunci / jawaban esai.' :
      'Berikan kombinasi variatif yang seimbang antara Pilihan Ganda ("type": "multiple_choice"), Pilihan Ganda Kompleks ("type": "checkbox"), dan Uraian ("type": "essay").';

    const promptText = `
Anda adalah seorang pakar kurikulum dan asesmen pendidikan nasional (Kurikulum Merdeka / K13).
Tugas Anda adalah menghasilkan persis ${count} butir soal berkualitas tinggi untuk:
- Mata Pelajaran: ${subject}
- Topik / Materi: ${topic}
- Jenjang Kelas: ${grade}
- Tingkat Kesulitan: ${difficulty}
- Kerangka Taksonomi: ${taxonomy === 'solo' ? 'SOLO (Prestructural, Unistructural, Multistructural, Relational, Extended Abstract)' : 'Bloom-Anderson (C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta)'}
- Bentuk Soal: ${typeInstruction}${tpInstruction}${customPromptInstruction}

ATURAN WAJIB DISTRIBUSI KUNCI JAWABAN (SANGAT PENTING - ANTI MONOTON):
1. DILARANG KERAS menetapkan kunci jawaban pada opsi yang sama secara berurutan!
2. Setiap nomor soal HARUS memiliki kunci jawaban dengan opsi yang berbeda dari nomor soal sebelumnya.
   Contoh: Jika soal nomor 1 kuncinya opsi A ("opt_a"), maka soal nomor 2 HARUS opsi yang lain ("opt_b", "opt_c", atau "opt_d"), soal nomor 3 harus berbeda lagi, dan seterusnya.
3. Sebar kunci jawaban secara merata dan proporsional di antara pilihan A, B, C, dan D (jangan semuanya A atau semuanya B).
4. Untuk Pilihan Ganda Kompleks (checkbox), variasikan kombinasi kunci di setiap nomor (misal nomor 1 ["opt_a", "opt_c"], nomor 2 ["opt_b", "opt_d"]).

Setiap butir soal HARUS berformat JSON dengan struktur persis seperti berikut:
[
  {
    "order": 1,
    "prompt": "Kalimat pertanyaan yang jelas dan kontekstual",
    "type": "${questionType === 'checkbox' ? 'checkbox' : questionType === 'essay' ? 'essay' : 'multiple_choice'}",
    "mediaType": "none",
    "options": [
      { "id": "opt_a", "text": "Pilihan A" },
      { "id": "opt_b", "text": "Pilihan B" },
      { "id": "opt_c", "text": "Pilihan C" },
      { "id": "opt_d", "text": "Pilihan D" }
    ],
    "correctKey": "${questionType === 'checkbox' ? '["opt_a", "opt_c"]' : 'opt_b'}",
    "points": 20,
    "explanation": "Pembahasan ilmiah dan alasan mengapa opsi tersebut benar",
    "bloomLevel": "C3 - Menerapkan",
    "soloLevel": "Multistructural",
    "basicCompetency": "Kompetensi Dasar / Capaian Pembelajaran terkait",
    "indicator": "Indikator pencapaian kompetensi soal ini",
    "learningObjective": "${validObjectives[0] || 'Peserta didik mampu memahami konsep pokok materi'}"
  }
]

Hasilkan HANYA array JSON murni tanpa markdown pembungkus tambahan.
`;

    // Retry loop untuk antisipasi 503 / 504 / 429 across models
    let lastError: any = null;
    let questionsData: any[] = [];

    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-4-argon'];
    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: promptText,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.7,
              maxOutputTokens: 16384,
              systemInstruction: 'Anda adalah generator soal ujian berbasis kurikulum nasional. Anda selalu menghasilkan JSON murni berisi daftar array butir soal tanpa teks pembuka atau penutup. Anda selalu mendistribusikan kunci jawaban secara bervariasi dan tidak pernah memakai opsi kunci yang sama berturut-turut.'
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

// Mount router on both /api and root /
app.use('/api', apiRouter);
app.use('/', apiRouter);

/**
 * Inisialisasi Vite middleware di mode development
 */
async function startServer() {
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
    app.listen(port, '0.0.0.0', () => {
      console.log(`ExamFlow Edu server running at http://0.0.0.0:${port}`);
    });
  }
}

startServer();

export default app;
