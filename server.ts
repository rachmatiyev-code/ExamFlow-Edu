import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

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
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-4-argon'];
    let lastError: any = null;
    let validatedModel = 'gemini-3.8-flash';
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
            // Karena error ini berasal dari Google AI inference, ini membuktikan kunci API valid!
            isKeyAuthenticated = true;
            hadHighDemandSpike = true;
            console.warn(`Model ${model} sedang high demand, mencoba model alternatif...`);
            break; // Langsung coba model berikutnya
          }

          // Jika benar-benar 400/403 kunci tidak valid
          if (status === 400 || status === 403 || errString.includes('API key not valid')) {
            return res.status(400).json({
              valid: false,
              message: 'Kunci API Gemini tidak valid atau tidak diizinkan.'
            });
          }
        }
      }
    }

    // Jika autentikasi kunci sukses atau Google merespons pesan lonjakan beban (high demand)
    if (isKeyAuthenticated || hadHighDemandSpike) {
      return res.json({
        valid: true,
        message: 'Gemini API Key valid dan aktif! (Catatan: Server Google saat ini sedang mengalami lonjakan beban/high demand sementara, namun kunci Anda terverifikasi dan sistem otomatis memilih model terbaik saat pembuatan soal).',
        model: 'gemini-flash-latest',
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
    return res.status(400).json({
      valid: false,
      message: `Validasi gagal: ${errMsg}`
    });
  }
});

/**
 * Endpoint Generate Soal dengan Retry Backoff untuk menghindari error 503/504
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
      customApiKey 
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

    const typeInstruction = 
      questionType === 'multiple_choice' ? 'Semua butir soal berbentuk Pilihan Ganda Tunggal ("type": "multiple_choice") dengan 4 atau 5 pilihan ("options") dan 1 kunci benar ("correctKey": "opt_a").' :
      questionType === 'checkbox' ? 'Semua butir soal berbentuk Pilihan Ganda Kompleks ("type": "checkbox") dengan 4 atau 5 pilihan di mana terdapat 2 atau lebih jawaban yang benar ("correctKey": ["opt_a", "opt_c"]).' :
      questionType === 'true_false' ? 'Semua butir soal berbentuk Benar/Salah ("type": "multiple_choice") dengan 2 opsi ("opt_a": "Benar", "opt_b": "Salah") dan "correctKey" berupa "opt_a" atau "opt_b".' :
      questionType === 'essay' ? 'Semua butir soal berbentuk Uraian / Isian Singkat ("type": "essay") dengan "options": [] dan "correctKey" berupa kata kunci / jawaban esai.' :
      'Berikan kombinasi variatif yang seimbang antara Pilihan Ganda ("type": "multiple_choice"), Pilihan Ganda Kompleks ("type": "checkbox"), dan Uraian ("type": "essay").';

    const promptText = `
Anda adalah seorang ahli pembuat asesmen pendidikan kurikulum nasional (Kurikulum Merdeka / K13).
Tugas Anda adalah menghasilkan persis ${count} butir soal berkualitas tinggi untuk:
- Mata Pelajaran: ${subject}
- Topik / Materi: ${topic}
- Jenjang Kelas: ${grade}
- Tingkat Kesulitan: ${difficulty}
- Kerangka Taksonomi: ${taxonomy === 'solo' ? 'SOLO (Prestructural, Unistructural, Multistructural, Relational, Extended Abstract)' : 'Bloom-Anderson (C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta)'}
- Bentuk Soal: ${typeInstruction}

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
    "correctKey": "${questionType === 'checkbox' ? '["opt_a", "opt_b"]' : 'opt_a'}",
    "points": 20,
    "explanation": "Pembahasan ilmiah dan alasan mengapa opsi tersebut benar",
    "bloomLevel": "C3 - Menerapkan",
    "soloLevel": "Multistructural",
    "basicCompetency": "Kompetensi Dasar / Capaian Pembelajaran terkait",
    "indicator": "Indikator pencapaian kompetensi soal ini"
  }
]

Hasilkan HANYA array JSON murni tanpa markdown pembungkus tambahan.
`;

    // Retry loop untuk antisipasi 503 / 504 / 429
    let lastError: any = null;
    let questionsData = null;

    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-4-argon'];
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
              systemInstruction: 'Anda adalah generator soal ujian berbasis taksonomi pendidikan. Anda selalu menghasilkan JSON valid yang memenuhi skema pertanyaan ujian.'
            }
          });

          const rawText = response.text?.trim() || '';
          const cleanJson = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          questionsData = JSON.parse(cleanJson);
          if (Array.isArray(questionsData) && questionsData.length > 0) {
            break;
          }
        } catch (retryErr: any) {
          lastError = retryErr;
          const msg = String(retryErr?.message || '');
          console.warn(`Gemini (${model}) attempt ${attempt} failed:`, msg);
          
          // Jika model sedang lonjakan beban (high demand / 503 / 429), langsung beralih ke model berikutnya
          if (msg.includes('high demand') || msg.includes('Spikes in demand') || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED')) {
            break;
          }
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }
      if (questionsData) break;
    }

    if (!questionsData) {
      throw lastError || new Error('Gagal menghasilkan soal setelah 3 kali percobaan.');
    }

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
apiRouter.post('/gas-proxy', async (req, res) => {
  try {
    const { url, payload, action } = req.body;
    if (!url) {
      return res.status(400).json({ status: 'error', message: 'URL GAS kosong' });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || { action })
    });

    const data = await response.json().catch(() => ({ status: 'success' }));
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message });
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
