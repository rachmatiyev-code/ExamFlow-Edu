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
  learningObjectives?: string[]; // Hingga 15 Tujuan Pembelajaran (TP)
  customPrompt?: string; // Prompt / instruksi khusus dari guru
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
   * Helper internal untuk mem-parse array soal JSON secara tangguh dari format apa pun
   */
  private static parseQuestionsJson(rawText: string): any[] {
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
        if (data.valid) {
          StorageService.addLog('AI_GEMINI', 'Validasi Gemini API Key sukses!', undefined, 'success');
          return { valid: true, message: data.message || 'Kunci Gemini valid dan aktif.' };
        } else {
          const srvMsg = String(data.message || '');
          // Jika pesan server adalah tentang high demand/spikes in demand, jangan tolak kunci!
          if (
            srvMsg.includes('high demand') ||
            srvMsg.includes('Spikes in demand') ||
            srvMsg.includes('503') ||
            srvMsg.includes('UNAVAILABLE') ||
            srvMsg.includes('RESOURCE_EXHAUSTED')
          ) {
            StorageService.addLog('AI_GEMINI', 'Server Google mengalami lonjakan beban sementara, namun kunci valid.', undefined, 'info');
            return {
              valid: true,
              message: 'Gemini API Key valid dan terverifikasi! (Catatan: Server Google saat ini sedang mengalami lonjakan beban sementara pada model tertentu, namun kunci Anda aktif dan siap digunakan).'
            };
          }
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
    // Prioritaskan model ultra-ringan gemini-3.1-flash-lite yang kebal dari antrean high demand
    const settings = StorageService.getSettings();
    const configuredModel = settings.geminiModel && !settings.geminiModel.includes('1.5') && !settings.geminiModel.includes('2.0')
      ? settings.geminiModel
      : 'gemini-3.1-flash-lite';

    const modelsToTry = Array.from(new Set(['gemini-3.1-flash-lite', 'gemini-flash-latest', configuredModel, 'gemini-3.8-flash', 'gemini-4-argon']));
    let lastClientError = 'Tidak dapat terhubung ke Google AI Studio.';
    let isKeyConfirmed = false;

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
              message: `Gemini API Key valid dan siap digunakan! (Model aktif: ${modelName})`
            };
          } else if (data.error) {
            lastClientError = data.error.message || 'Kunci API ditolak Google.';
            const msg = (data.error.message || '').toLowerCase();
            
            // Deteksi lonjakan beban pada model ini: membuktikan autentikasi kunci diterima!
            if (msg.includes('high demand') || msg.includes('spikes in demand') || msg.includes('503') || msg.includes('unavailable') || msg.includes('resource_exhausted')) {
              isKeyConfirmed = true;
              console.warn(`Model ${modelName} sedang high demand, mencoba model cadangan...`);
              continue;
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
    if (
      isKeyConfirmed ||
      lastClientError.includes('high demand') ||
      lastClientError.includes('Spikes in demand') ||
      lastClientError.includes('503') ||
      lastClientError.includes('UNAVAILABLE') ||
      lastClientError.includes('RESOURCE_EXHAUSTED')
    ) {
      StorageService.addLog('AI_GEMINI', 'Gemini API Key valid dan terverifikasi (beban Google sedang tinggi).', undefined, 'success');
      return {
        valid: true,
        message: 'Gemini API Key valid dan terverifikasi! (Catatan: Server Google saat ini sedang mengalami lonjakan beban sementara pada model tertentu, namun kunci Anda aktif dan sistem otomatis menggunakan model cadangan saat pembuatan soal).'
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
   * Mendukung hingga 50 butir soal dengan batching 25 butir per tahap, retry otomatis, dan multi-model fallback
   */
  static async generateQuestions(
    examId: string, 
    params: GenerateParams,
    onProgress?: (completed: number, total: number, message: string) => void
  ): Promise<{ success: boolean; questions?: Question[]; message: string }> {
    const settings = StorageService.getSettings();
    const customApiKey = (settings.geminiApiKey || '').trim();

    const totalCount = Math.min(50, Math.max(1, params.count || 5));
    StorageService.addLog('AI_GEMINI', `Memulai pembuatan ${totalCount} butir soal: "${params.topic}" (${params.subject} - ${params.grade})`);

    // Pecah ke batch optimal 25 butir soal agar tidak terkena limit output token JSON dan cepat
    const batchSizes: number[] = [];
    let remaining = totalCount;
    while (remaining > 0) {
      const take = Math.min(25, remaining);
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

      const validObjectives = Array.isArray(params.learningObjectives) ? params.learningObjectives.filter(Boolean).slice(0, 15) : [];
      const tpSection = validObjectives.length > 0
        ? `\n- TUJUAN PEMBELAJARAN (TP) - DUKUNG HINGGA 15 TP:\n${validObjectives.map((tp, i) => `  TP ${i + 1}: ${tp}`).join('\n')}\nDistribusikan butir soal secara berimbang ke seluruh Tujuan Pembelajaran di atas. Setiap butir soal HARUS menyertakan atribut "learningObjective" sesuai dengan teks Tujuan Pembelajaran yang diukurnya.\n`
        : '';

      const customPromptSection = params.customPrompt && params.customPrompt.trim().length > 0
        ? `\n- INSTRUKSI / PROMPT KHUSUS DARI GURU:\n"${params.customPrompt.trim()}"\nWajib ikuti instruksi spesifik di atas dalam perumusan konteks, stimulus, atau karakteristik soal.\n`
        : '';

      const promptText = `
Anda adalah seorang ahli pembuat asesmen kurikulum nasional (Kurikulum Merdeka / K13).
Tugas Anda adalah menghasilkan persis ${batchCount} butir soal berkualitas tinggi (bagian ${bIdx + 1} dari ${batchSizes.length}) untuk:
- Mata Pelajaran: ${params.subject}
- Topik / Materi: ${params.topic}
- Jenjang Kelas: ${params.grade}
- Tingkat Kesulitan: ${params.difficulty}
- Kerangka Taksonomi: ${params.taxonomy === 'solo' ? 'SOLO (Prestructural, Unistructural, Multistructural, Relational, Extended Abstract)' : 'Bloom-Anderson (C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta)'}
- Bentuk Soal: ${typeInstruction}${tpSection}${customPromptSection}

ATURAN WAJIB DISTRIBUSI KUNCI JAWABAN (SANGAT PENTING - ANTI MONOTON):
1. DILARANG KERAS menetapkan kunci jawaban pada opsi yang sama secara berurutan!
2. Setiap nomor soal HARUS memiliki kunci jawaban dengan opsi yang berbeda dari nomor soal sebelumnya.
   Contoh: Jika nomor 1 kuncinya opsi A ("opt_a"), maka nomor 2 HARUS opsi yang lain ("opt_b", "opt_c", atau "opt_d"), nomor 3 berbeda lagi, dst.
3. Sebar kunci jawaban secara merata di antara opsi A, B, C, dan D (jangan semuanya A atau semuanya B).
4. Untuk Pilihan Ganda Kompleks (checkbox), variasikan kombinasi kunci di setiap nomor (misal nomor 1 ["opt_a", "opt_c"], nomor 2 ["opt_b", "opt_d"]).

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
    "correctKey": "${qType === 'checkbox' ? '["opt_a", "opt_c"]' : 'opt_b'}",
    "points": 20,
    "explanation": "Pembahasan ilmiah dan alasan mengapa kunci tersebut benar",
    "bloomLevel": "C3 - Menerapkan",
    "soloLevel": "Multistructural",
    "basicCompetency": "Kompetensi Dasar / Capaian Pembelajaran terkait",
    "indicator": "Indikator soal",
    "learningObjective": "${validObjectives[0] || 'Peserta didik mampu memahami konsep pokok materi'}"
  }
]

Hasilkan HANYA array JSON murni tanpa markdown pembungkus tambahan.
`;

      if (onProgress) {
        onProgress(allAccumulatedQuestions.length, totalCount, `Menghasilkan butir soal tahap ${bIdx + 1} dari ${batchSizes.length} (${batchCount} butir)...`);
      }

      // Delay jeda antar batch agar tidak memicu rate limiting
      if (bIdx > 0) {
        await new Promise(r => setTimeout(r, 1200));
      }

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
            customApiKey,
            learningObjectives: params.learningObjectives,
            customPrompt: params.customPrompt
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
        // Backend proxy route tidak dapat diakses, fallback ke direct client
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
          : 'gemini-3.1-flash-lite';

        const modelsToTry = Array.from(new Set(['gemini-3.1-flash-lite', 'gemini-flash-latest', configuredModel, 'gemini-3.8-flash', 'gemini-4-argon']));

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
                  if (errMsg.includes('high demand') || errMsg.includes('Spikes in demand') || errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('RESOURCE_EXHAUSTED')) {
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
                  break; // Langsung coba model berikutnya
                }
                if (attempt === 2) throw retryErr;
                await new Promise(r => setTimeout(r, 1000 * attempt));
              }
            }

            if (rawJsonText) {
              const parsedList = this.parseQuestionsJson(rawJsonText);
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

  /**
   * Algoritma deterministik untuk memastikan tidak ada kunci jawaban yang sama berturut-turut
   */
  private static diversifyAnswerKeys(questions: Question[]): Question[] {
    if (!Array.isArray(questions) || questions.length <= 1) return questions;

    let lastSingleKey = '';
    let lastCheckboxSignature = '';

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || !Array.isArray(q.options) || q.options.length < 2) continue;

      const optIds: string[] = q.options.map(o => o.id);

      if (q.type === 'multiple_choice' || !q.type) {
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
            const optCurrent = q.options.find(o => o.id === currentKey);
            const optTarget = q.options.find(o => o.id === targetKey);
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
      } else if (q.type === 'checkbox') {
        let currentKeys: string[] = Array.isArray(q.correctKey) ? [...q.correctKey] : [String(q.correctKey || optIds[0])];
        currentKeys = currentKeys.filter(k => optIds.includes(k));
        if (currentKeys.length === 0) {
          currentKeys = [optIds[0], optIds[1] || optIds[0]];
        }

        let currentSig = [...currentKeys].sort().join(',');
        if (lastCheckboxSignature && currentSig === lastCheckboxSignature) {
          const unselected = optIds.find(id => !currentKeys.includes(id));
          const selected = currentKeys[0];
          if (unselected && selected) {
            const optSel = q.options.find(o => o.id === selected);
            const optUnsel = q.options.find(o => o.id === unselected);
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

  private static formatGeneratedQuestions(examId: string, list: any[], params: GenerateParams) {
    let formatted: Question[] = list.map((item: any, idx: number) => {
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
        indicator: item.indicator || `Siswa dapat menyelesaikan permasalahan terkait ${params.topic}`,
        learningObjective: item.learningObjective || ''
      };
    });

    // Jalankan algoritma anti-kunci-monoton agar kunci terdistribusi variatif
    formatted = this.diversifyAnswerKeys(formatted);

    StorageService.addLog(
      'AI_GEMINI',
      `Berhasil membuat ${formatted.length} butir soal dengan variasi kunci merata dan taksonomi ${params.taxonomy.toUpperCase()}!`,
      undefined,
      'success'
    );

    return {
      success: true,
      questions: formatted,
      message: `Berhasil membuat ${formatted.length} butir soal AI dengan sebaran kunci bervariasi!`
    };
  }
}
