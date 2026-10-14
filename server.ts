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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Validasi API Key Gemini
 */
app.post('/api/gemini/validate-key', async (req, res) => {
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Respond with the single word "OK" if this API key is active.',
    });

    const text = response.text || '';
    if (text.toLowerCase().includes('ok')) {
      return res.json({
        valid: true,
        message: 'Gemini API Key valid dan siap digunakan!',
        model: 'gemini-3.8-flash'
      });
    }

    return res.json({
      valid: true,
      message: 'Koneksi ke Gemini berhasil.',
      model: 'gemini-3.8-flash'
    });
  } catch (err: any) {
    console.error('Error validating Gemini key:', err);
    return res.status(400).json({
      valid: false,
      message: `Validasi gagal: ${err?.message || 'Kunci tidak valid atau kuota habis.'}`
    });
  }
});

/**
 * Endpoint Generate Soal dengan Retry Backoff untuk menghindari error 503/504
 */
app.post('/api/gemini/generate-questions', async (req, res) => {
  try {
    const { 
      topic, 
      count = 3, 
      difficulty = 'Sedang', 
      taxonomy = 'bloom', 
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

    const promptText = `
Anda adalah seorang ahli pembuat soal ujian kurikulum nasional (Kurikulum Merdeka / K13).
Tugas Anda adalah menghasilkan ${count} butir soal pilihan ganda berkualitas tinggi untuk:
- Mata Pelajaran: ${subject}
- Topik / Materi: ${topic}
- Jenjang Kelas: ${grade}
- Tingkat Kesulitan: ${difficulty}
- Kerangka Taksonomi: ${taxonomy === 'solo' ? 'SOLO (Structure of Observed Learning Outcomes: Prestructural, Unistructural, Multistructural, Relational, Extended Abstract)' : 'Bloom-Anderson (C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta)'}

Setiap butir soal HARUS berformat JSON dengan struktur persis seperti berikut:
[
  {
    "order": 1,
    "prompt": "Kalimat pertanyaan yang jelas dan kontekstual",
    "type": "multiple_choice",
    "mediaType": "none", // atau "image" jika soal memerlukan deskripsi gambar
    "suggestedMediaPrompt": "deskripsi visual singkat jika butuh gambar",
    "options": [
      { "id": "opt_a", "text": "Pilihan A" },
      { "id": "opt_b", "text": "Pilihan B" },
      { "id": "opt_c", "text": "Pilihan C" },
      { "id": "opt_d", "text": "Pilihan D" }
    ],
    "correctKey": "opt_a",
    "points": 20,
    "explanation": "Pembahasan ilmiah dan alasan mengapa opsi tersebut benar",
    "bloomLevel": "C3 - Menerapkan",
    "soloLevel": "Relational",
    "basicCompetency": "Kompetensi Dasar / Capaian Pembelajaran terkait",
    "indicator": "Indikator pencapaian kompetensi soal ini"
  }
]

Hasilkan HANYA array JSON murni tanpa markdown pembungkus tambahan.
`;

    // Retry loop untuk antisipasi 503 / 504 / 429
    let lastError: any = null;
    let questionsData = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            systemInstruction: 'Anda adalah generator soal ujian berbasis taksonomi pendidikan. Anda selalu menghasilkan JSON valid yang memenuhi skema pertanyaan ujian.'
          }
        });

        const rawText = response.text?.trim() || '';
        // Bersihkan formatting markdown jika ada
        const cleanJson = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        questionsData = JSON.parse(cleanJson);
        break; // Berhasil, keluar dari loop
      } catch (retryErr: any) {
        lastError = retryErr;
        console.warn(`Gemini API attempt ${attempt} failed:`, retryErr?.message);
        if (attempt < 3) {
          // Tunggu backoff 1.2 detik sebelum coba ulang
          await new Promise(r => setTimeout(r, 1200 * attempt));
        }
      }
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
app.post('/api/gas-proxy', async (req, res) => {
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

/**
 * Inisialisasi Vite middleware di mode development
 */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ExamFlow Edu server running at http://0.0.0.0:${port}`);
  });
}

startServer();
