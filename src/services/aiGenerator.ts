import { StorageService } from './storage';
import { Question } from '../types';

export interface GenerateParams {
  topic: string;
  count: number;
  difficulty: 'Mudah' | 'Sedang' | 'Sukar';
  taxonomy: 'bloom' | 'solo';
  subject: string;
  grade: string;
}

export class AiGeneratorService {
  /**
   * Helper internal untuk mem-parse JSON secara aman tanpa memicu crash
   * 'Unexpected token T, The page could not be found...' jika server/Vercel mengembalikan 404 HTML
   */
  private static async safeParseResponse(res: Response): Promise<{ isJson: boolean; data: any; rawText: string }> {
    try {
      const rawText = await res.text();
      try {
        const data = JSON.parse(rawText);
        return { isJson: true, data, rawText };
      } catch {
        return { isJson: false, data: null, rawText };
      }
    } catch (e: any) {
      return { isJson: false, data: null, rawText: e?.message || '' };
    }
  }

  /**
   * Menguji validitas Gemini API Key
   * Mendukung backend proxy serverless (Vercel/Express) maupun fallback langsung ke Google Generative Language API
   */
  static async validateApiKey(apiKey?: string): Promise<{ valid: boolean; message: string }> {
    const keyToTest = (apiKey || StorageService.getSettings().geminiApiKey).trim();

    if (!keyToTest) {
      return {
        valid: false,
        message: 'Kunci API Gemini belum dimasukkan. Masukkan API Key Anda di kolom yang tersedia.'
      };
    }

    StorageService.addLog('AI_GEMINI', 'Menguji validasi Gemini API Key...');

    // 1. Coba hubungi backend serverless / local server terlebih dahulu (/api/gemini/validate-key)
    try {
      const res = await fetch('/api/gemini/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest })
      });

      const { isJson, data } = await this.safeParseResponse(res);

      if (isJson && data) {
        if (res.ok && data.valid) {
          StorageService.addLog('AI_GEMINI', 'Validasi Gemini API Key sukses (melalui server backend)!', undefined, 'success');
          return { valid: true, message: data.message || 'Kunci Gemini valid dan aktif.' };
        } else if (!res.ok) {
          StorageService.addLog('AI_GEMINI', `Validasi ditolak server: ${data.message}`, undefined, 'warn');
          return { valid: false, message: data.message || 'Kunci API tidak valid atau kuota habis.' };
        }
      } else {
        // Server merespons non-JSON (misal 404 "The page could not be found" di static Vercel), jangan panik atau lempar error!
        console.warn('Backend route returned non-JSON, falling back to direct client-side validation.');
        StorageService.addLog('AI_GEMINI', 'Rute server tidak merespons JSON, beralih ke validasi browser langsung...');
      }
    } catch (serverErr) {
      console.warn('Backend route unreachable, falling back to direct client validation.');
    }

    // 2. Direct client-side validation ke Google Generative Language API
    // Solusi teruji untuk Vercel Static Hosting & Client Browser
    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastClientError = 'Tidak dapat terhubung ke Google AI Studio.';

    for (const modelName of modelsToTry) {
      try {
        const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(keyToTest)}`;
        const directRes = await fetch(directUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Balas dengan satu kata: OK' }] }]
          })
        });

        const { isJson, data } = await this.safeParseResponse(directRes);

        if (isJson && data) {
          if (directRes.ok && data.candidates && data.candidates.length > 0) {
            StorageService.addLog('AI_GEMINI', `Validasi Gemini API Key sukses langsung ke Google AI Studio (${modelName})!`, undefined, 'success');
            return {
              valid: true,
              message: `Gemini API Key valid dan siap digunakan! (Model: ${modelName})`
            };
          } else if (data.error) {
            lastClientError = data.error.message || 'Kunci API ditolak Google.';
            // Jika error adalah permission/key invalid (bukan model 404), langsung hentikan loop
            if (data.error.code === 400 || data.error.code === 403) {
              break;
            }
          }
        }
      } catch (err: any) {
        lastClientError = err?.message || String(err);
      }
    }

    StorageService.addLog('AI_GEMINI', `Validasi Gemini gagal: ${lastClientError}`, undefined, 'error');
    return {
      valid: false,
      message: `Validasi gagal: ${lastClientError}`
    };
  }

  /**
   * Menghasilkan soal ujian secara otomatis melalui AI Gemini
   * Dilengkapi fallback otomatis ke Google API langsung jika backend Vercel/Serverless tidak aktif
   */
  static async generateQuestions(examId: string, params: GenerateParams): Promise<{ success: boolean; questions?: Question[]; message: string }> {
    const settings = StorageService.getSettings();
    const customApiKey = settings.geminiApiKey.trim();

    if (!customApiKey) {
      return {
        success: false,
        message: 'Kunci API Gemini belum diatur. Buka menu Pengaturan untuk memasukkan Gemini API Key Anda.'
      };
    }

    StorageService.addLog('AI_GEMINI', `Memulai pembuatan ${params.count} butir soal: "${params.topic}" (${params.subject} - ${params.grade})`);

    const promptText = `
Anda adalah seorang ahli pembuat soal ujian kurikulum nasional (Kurikulum Merdeka / K13).
Tugas Anda adalah menghasilkan persis ${params.count} butir soal pilihan ganda berkualitas tinggi untuk:
- Mata Pelajaran: ${params.subject}
- Topik / Materi: ${params.topic}
- Jenjang Kelas: ${params.grade}
- Tingkat Kesulitan: ${params.difficulty}
- Kerangka Taksonomi: ${params.taxonomy === 'solo' ? 'SOLO (Structure of Observed Learning Outcomes: Prestructural, Unistructural, Multistructural, Relational, Extended Abstract)' : 'Bloom-Anderson (C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta)'}

Setiap butir soal HARUS berformat JSON dengan struktur persis seperti berikut:
[
  {
    "order": 1,
    "prompt": "Kalimat pertanyaan yang jelas dan kontekstual",
    "type": "multiple_choice",
    "mediaType": "none",
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
    "soloLevel": "Multistructural",
    "basicCompetency": "Kompetensi Dasar / Capaian Pembelajaran terkait",
    "indicator": "Indikator pencapaian kompetensi soal ini"
  }
]

Hasilkan HANYA array JSON murni tanpa markdown pembungkus tambahan.
`;

    // 1. Coba lewat backend server terlebih dahulu
    try {
      const res = await fetch('/api/gemini/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: params.topic,
          count: params.count,
          difficulty: params.difficulty,
          taxonomy: params.taxonomy,
          subject: params.subject,
          grade: params.grade,
          customApiKey
        })
      });

      const { isJson, data } = await this.safeParseResponse(res);
      if (isJson && data) {
        if (res.ok && data.success && Array.isArray(data.questions)) {
          return this.formatGeneratedQuestions(examId, data.questions, params);
        } else if (!res.ok && data.message) {
          return { success: false, message: data.message };
        }
      }
    } catch (serverErr) {
      console.warn('Backend route unavailable, switching to direct client generation.');
    }

    // 2. Direct client-side generation (Vercel / Static fallback)
    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastErrorMsg = 'Gagal membuat soal.';

    for (const modelName of modelsToTry) {
      try {
        const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(customApiKey)}`;
        
        let rawJsonText = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const directRes = await fetch(directUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                  temperature: 0.7,
                  responseMimeType: 'application/json'
                }
              })
            });

            const { isJson, data } = await this.safeParseResponse(directRes);
            if (!directRes.ok || !isJson) {
              const errMsg = data?.error?.message || `HTTP ${directRes.status}`;
              throw new Error(errMsg);
            }

            const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (candidateText) {
              rawJsonText = candidateText.trim();
              break;
            }
          } catch (retryErr: any) {
            if (attempt === 3) throw retryErr;
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }

        if (rawJsonText) {
          const cleanJson = rawJsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          const parsedList = JSON.parse(cleanJson);

          if (Array.isArray(parsedList) && parsedList.length > 0) {
            return this.formatGeneratedQuestions(examId, parsedList, params);
          }
        }
      } catch (err: any) {
        lastErrorMsg = err?.message || String(err);
      }
    }

    StorageService.addLog('AI_GEMINI', `Gagal membuat soal AI: ${lastErrorMsg}`, undefined, 'error');
    return {
      success: false,
      message: `Gagal membuat soal AI: ${lastErrorMsg}`
    };
  }

  private static formatGeneratedQuestions(examId: string, list: any[], params: GenerateParams) {
    const formatted: Question[] = list.map((item: any, idx: number) => {
      const id = `Q-AI-${Date.now()}-${idx + 1}`;
      return {
        id,
        examId,
        order: idx + 1,
        prompt: item.prompt || 'Soal ujian',
        type: 'multiple_choice',
        mediaType: item.mediaType === 'image' ? 'image' : 'none',
        mediaUrl: item.mediaType === 'image' ? (item.mediaUrl || 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80') : undefined,
        options: Array.isArray(item.options) && item.options.length > 0 ? item.options : [
          { id: 'opt_a', text: 'Pilihan A' },
          { id: 'opt_b', text: 'Pilihan B' },
          { id: 'opt_c', text: 'Pilihan C' },
          { id: 'opt_d', text: 'Pilihan D' }
        ],
        correctKey: item.correctKey || 'opt_a',
        points: Number(item.points) || 20,
        explanation: item.explanation || '',
        bloomLevel: item.bloomLevel || 'C3 - Menerapkan',
        soloLevel: item.soloLevel || 'Multistructural',
        basicCompetency: item.basicCompetency || `Materi: ${params.topic}`,
        indicator: item.indicator || `Siswa dapat menyelesaikan permasalahan terkait ${params.topic}`
      };
    });

    StorageService.addLog(
      'AI_GEMINI',
      `Berhasil membuat ${formatted.length} butir soal dengan taksonomi ${params.taxonomy.toUpperCase()}!`,
      undefined,
      'success'
    );

    return {
      success: true,
      questions: formatted,
      message: `Berhasil membuat ${formatted.length} butir soal AI!`
    };
  }
}
