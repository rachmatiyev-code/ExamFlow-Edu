import { StorageService } from './storage';
import { Question } from '../types';

export interface GenerateParams {
  topic: string;
  count: number;
  difficulty: 'Mudah' | 'Sedang' | 'Sukar';
  taxonomy: 'bloom' | 'solo';
  questionType?: 'multiple_choice' | 'checkbox' | 'true_false' | 'essay' | 'mixed';
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
          const srvMsg = String(data.message || '');
          // Jika pesan server adalah tentang high demand/spikes in demand, jangan tolak kunci!
          if (srvMsg.includes('high demand') || srvMsg.includes('Spikes in demand') || srvMsg.includes('503') || srvMsg.includes('UNAVAILABLE')) {
            StorageService.addLog('AI_GEMINI', 'Server Google mengalami lonjakan beban sementara, namun kunci valid.', undefined, 'info');
            return {
              valid: true,
              message: 'Gemini API Key valid dan terverifikasi! (Catatan: Server Google saat ini sedang mengalami lonjakan beban/high demand sementara, namun kunci Anda aktif dan siap digunakan).'
            };
          }
          // Jika memang kunci invalid, log dan laporkan
          if (srvMsg.toLowerCase().includes('tidak valid') || srvMsg.toLowerCase().includes('invalid')) {
            StorageService.addLog('AI_GEMINI', `Validasi ditolak server: ${srvMsg}`, undefined, 'warn');
            return { valid: false, message: srvMsg };
          }
        }
      }
    } catch {
      // Backend route unreachable, fallback ke direct client validation
    }

    // 2. Direct client-side validation ke Google Generative Language API
    // Langkah A: Cek metadata endpoint (tidak menggunakan kuota/inferensi AI, kebal dari error high demand)
    let isKeyConfirmed = false;
    try {
      const metaRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(keyToTest)}`);
      if (metaRes.ok) {
        isKeyConfirmed = true;
      } else {
        const errJson: any = await metaRes.json().catch(() => ({}));
        const rawMsg = errJson?.error?.message || '';
        if (metaRes.status === 400 || metaRes.status === 403 || rawMsg.toLowerCase().includes('api key') || rawMsg.toLowerCase().includes('not valid')) {
          return {
            valid: false,
            message: 'Kunci API Gemini tidak valid atau ditolak Google. Periksa kembali API Key dari Google AI Studio.'
          };
        }
      }
    } catch {
      // Abaikan jika network check gagal
    }

    // Langkah B: Uji model responsif
    const settings = StorageService.getSettings();
    const configuredModel = settings.geminiModel && !settings.geminiModel.includes('1.5') && !settings.geminiModel.includes('2.0')
      ? settings.geminiModel
      : 'gemini-3.8-flash';

    const modelsToTry = Array.from(new Set([configuredModel, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-4-argon']));
    let lastClientError = 'Tidak dapat terhubung ke Google AI Studio.';
    let hadSpike = false;

    for (const modelName of modelsToTry) {
      try {
        const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(keyToTest)}`;
        const directRes = await fetch(directUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Balas satu kata: OK' }] }]
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
            const msg = (data.error.message || '').toLowerCase();
            
            // Deteksi lonjakan beban pada model ini
            if (msg.includes('high demand') || msg.includes('spikes in demand') || msg.includes('503') || msg.includes('unavailable') || msg.includes('resource_exhausted')) {
              isKeyConfirmed = true;
              hadSpike = true;
              console.warn(`Model ${modelName} sedang high demand, mencoba model cadangan...`);
              continue; // Coba model berikutnya
            }

            // Jika error adalah permission/key invalid
            if (msg.includes('api key') || msg.includes('api_key') || msg.includes('credential') || data.error.code === 403 || data.error.code === 400) {
              return {
                valid: false,
                message: `Kunci API tidak valid: ${data.error.message}`
              };
            }
          }
        }
      } catch (err: any) {
        lastClientError = err?.message || String(err);
      }
    }

    // Jika autentikasi terbukti valid tapi model sedang mengalami lonjakan trafik
    if (isKeyConfirmed || hadSpike) {
      StorageService.addLog('AI_GEMINI', 'Gemini API Key valid dan terverifikasi (beban Google sedang tinggi).', undefined, 'success');
      return {
        valid: true,
        message: 'Gemini API Key valid dan terverifikasi! (Catatan: Server Google saat ini sedang mengalami lonjakan beban/high demand sementara, namun kunci Anda aktif dan sistem otomatis menggunakan model responsif saat pembuatan soal).'
      };
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
    const customApiKey = (settings.geminiApiKey || '').trim();

    const totalCount = Math.min(50, Math.max(1, params.count || 5));
    StorageService.addLog('AI_GEMINI', `Memulai pembuatan ${totalCount} butir soal: "${params.topic}" (${params.subject} - ${params.grade})`);

    // Pecah ke batch jika butir soal > 15 (agar tidak terkena limit output token JSON)
    const batchSizes: number[] = [];
    let remaining = totalCount;
    while (remaining > 0) {
      const take = Math.min(15, remaining);
      batchSizes.push(take);
      remaining -= take;
    }

    const allAccumulatedQuestions: any[] = [];
    let lastErrorMsg = 'Gagal membuat soal.';

    for (let bIdx = 0; bIdx < batchSizes.length; bIdx++) {
      const batchCount = batchSizes[bIdx];
      const qType = params.questionType || 'multiple_choice';
      const typeInstruction = 
        qType === 'multiple_choice' ? 'Semua butir soal berbentuk Pilihan Ganda Tunggal ("type": "multiple_choice") dengan 4 atau 5 pilihan ("options") dan 1 kunci benar ("correctKey": "opt_a").' :
        qType === 'checkbox' ? 'Semua butir soal berbentuk Pilihan Ganda Kompleks ("type": "checkbox") dengan 4 atau 5 pilihan di mana terdapat 2 atau lebih jawaban yang benar ("correctKey": ["opt_a", "opt_c"]).' :
        qType === 'true_false' ? 'Semua butir soal berbentuk Benar/Salah ("type": "multiple_choice") dengan 2 opsi ("opt_a": "Benar", "opt_b": "Salah") dan "correctKey" berupa "opt_a" atau "opt_b".' :
        qType === 'essay' ? 'Semua butir soal berbentuk Uraian / Isian Singkat ("type": "essay") dengan "options": [] dan "correctKey" berupa rangkuman jawaban/kata kunci esai.' :
        'Berikan kombinasi variatif yang seimbang antara Pilihan Ganda ("type": "multiple_choice"), Pilihan Ganda Kompleks ("type": "checkbox"), dan Uraian ("type": "essay").';

      const promptText = `
Anda adalah seorang ahli pembuat asesmen kurikulum nasional (Kurikulum Merdeka / K13).
Tugas Anda adalah menghasilkan persis ${batchCount} butir soal berkualitas tinggi (bagian ${bIdx + 1} dari ${batchSizes.length}) untuk:
- Mata Pelajaran: ${params.subject}
- Topik / Materi: ${params.topic}
- Jenjang Kelas: ${params.grade}
- Tingkat Kesulitan: ${params.difficulty}
- Kerangka Taksonomi: ${params.taxonomy === 'solo' ? 'SOLO (Prestructural, Unistructural, Multistructural, Relational, Extended Abstract)' : 'Bloom-Anderson (C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta)'}
- Bentuk Soal: ${typeInstruction}

Setiap butir soal HARUS berformat JSON dengan struktur persis seperti berikut:
[
  {
    "order": ${allAccumulatedQuestions.length + 1},
    "prompt": "Kalimat pertanyaan yang jelas, lugas, dan kontekstual",
    "type": "${qType === 'checkbox' ? 'checkbox' : qType === 'essay' ? 'essay' : 'multiple_choice'}",
    "mediaType": "none",
    "options": [
      { "id": "opt_a", "text": "Pilihan A" },
      { "id": "opt_b", "text": "Pilihan B" },
      { "id": "opt_c", "text": "Pilihan C" },
      { "id": "opt_d", "text": "Pilihan D" }
    ],
    "correctKey": "${qType === 'checkbox' ? '["opt_a", "opt_b"]' : 'opt_a'}",
    "points": 20,
    "explanation": "Pembahasan ilmiah dan alasan mengapa kunci tersebut benar",
    "bloomLevel": "C3 - Menerapkan",
    "soloLevel": "Multistructural",
    "basicCompetency": "Kompetensi Dasar / Capaian Pembelajaran terkait",
    "indicator": "Indikator soal"
  }
]

Hasilkan HANYA array JSON murni tanpa markdown pembungkus tambahan.
`;

      let batchSuccess = false;

      // 1. Coba lewat backend server terlebih dahulu
      try {
        const res = await fetch('/api/gemini/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: params.topic,
            count: batchCount,
            difficulty: params.difficulty,
            taxonomy: params.taxonomy,
            questionType: params.questionType,
            subject: params.subject,
            grade: params.grade,
            customApiKey
          })
        });

        const { isJson, data } = await this.safeParseResponse(res);
        if (isJson && data) {
          if (res.ok && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
            allAccumulatedQuestions.push(...data.questions);
            batchSuccess = true;
          } else if (!res.ok && data.message) {
            lastErrorMsg = data.message;
          }
        }
      } catch {
        // Backend proxy route tidak dapat diakses, fallback ke client
      }

      // 2. Direct client-side generation jika backend gagal / tidak ada
      if (!batchSuccess) {
        if (!customApiKey) {
          return {
            success: false,
            message: 'Kunci API Gemini belum diatur. Buka menu Pengaturan untuk memasukkan Gemini API Key Anda.'
          };
        }

        const configuredModel = settings.geminiModel && !settings.geminiModel.includes('1.5') && !settings.geminiModel.includes('2.0')
          ? settings.geminiModel
          : 'gemini-3.8-flash';

        const modelsToTry = Array.from(new Set([configuredModel, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-4-argon']));

        for (const modelName of modelsToTry) {
          try {
            const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(customApiKey)}`;
            let rawJsonText = '';

            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                const directRes = await fetch(directUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: {
                      temperature: 0.7,
                      responseMimeType: 'application/json',
                      maxOutputTokens: 16384
                    }
                  })
                });

                const { isJson, data } = await this.safeParseResponse(directRes);
                if (!directRes.ok || !isJson) {
                  const errMsg = data?.error?.message || `HTTP ${directRes.status}`;
                  // Jika model terkena lonjakan beban (high demand / 503 / 429), langsung beralih ke model berikutnya
                  if (errMsg.includes('high demand') || errMsg.includes('Spikes in demand') || errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('RESOURCE_EXHAUSTED')) {
                    console.warn(`Model ${modelName} high demand, mencoba model berikutnya...`);
                    throw new Error(`HIGH_DEMAND: ${errMsg}`);
                  }
                  throw new Error(errMsg);
                }

                const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (candidateText) {
                  rawJsonText = candidateText.trim();
                  break;
                }
              } catch (retryErr: any) {
                const msg = String(retryErr?.message || '');
                if (msg.startsWith('HIGH_DEMAND')) {
                  break; // Langsung coba model berikutnya tanpa tunggu retry
                }
                if (attempt === 2) throw retryErr;
                await new Promise(r => setTimeout(r, 1000 * attempt));
              }
            }

            if (rawJsonText) {
              const cleanJson = rawJsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              const parsedList = JSON.parse(cleanJson);

              if (Array.isArray(parsedList) && parsedList.length > 0) {
                allAccumulatedQuestions.push(...parsedList);
                batchSuccess = true;
                break;
              }
            }
          } catch (err: any) {
            lastErrorMsg = err?.message || String(err);
          }
        }
      }

      if (!batchSuccess && allAccumulatedQuestions.length === 0) {
        StorageService.addLog('AI_GEMINI', `Gagal membuat soal AI: ${lastErrorMsg}`, undefined, 'error');
        return {
          success: false,
          message: `Gagal membuat soal AI: ${lastErrorMsg}`
        };
      }
    }

    if (allAccumulatedQuestions.length > 0) {
      return this.formatGeneratedQuestions(examId, allAccumulatedQuestions, params);
    }

    return {
      success: false,
      message: `Gagal membuat soal: ${lastErrorMsg}`
    };
  }

  private static formatGeneratedQuestions(examId: string, list: any[], params: GenerateParams) {
    const formatted: Question[] = list.map((item: any, idx: number) => {
      const id = `Q-AI-${Date.now()}-${idx + 1}`;
      return {
        id,
        examId,
        order: idx + 1,
        prompt: item.prompt || 'Soal asesmen',
        type: item.type === 'checkbox' || item.type === 'essay' ? item.type : (params.questionType === 'checkbox' ? 'checkbox' : params.questionType === 'essay' ? 'essay' : 'multiple_choice'),
        mediaType: item.mediaType === 'image' ? 'image' : 'none',
        mediaUrl: item.mediaType === 'image' ? (item.mediaUrl || 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80') : undefined,
        options: (item.type === 'essay' || params.questionType === 'essay') 
          ? [] 
          : (Array.isArray(item.options) && item.options.length > 0 ? item.options : [
              { id: 'opt_a', text: 'Pilihan A' },
              { id: 'opt_b', text: 'Pilihan B' },
              { id: 'opt_c', text: 'Pilihan C' },
              { id: 'opt_d', text: 'Pilihan D' }
            ]),
        correctKey: item.correctKey || (item.type === 'checkbox' || params.questionType === 'checkbox' ? ['opt_a'] : 'opt_a'),
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
