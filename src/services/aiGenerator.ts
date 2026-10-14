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
   * Menguji validitas Gemini API Key
   */
  static async validateApiKey(apiKey?: string): Promise<{ valid: boolean; message: string }> {
    const keyToTest = (apiKey || StorageService.getSettings().geminiApiKey).trim();

    try {
      StorageService.addLog('AI_GEMINI', 'Menguji validasi Gemini API Key...');
      const res = await fetch('/api/gemini/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest })
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        StorageService.addLog('AI_GEMINI', 'Validasi Gemini API Key sukses!', undefined, 'success');
        return { valid: true, message: data.message };
      } else {
        StorageService.addLog('AI_GEMINI', `Validasi gagal: ${data.message}`, undefined, 'warn');
        return { valid: false, message: data.message || 'Kunci API tidak valid.' };
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      StorageService.addLog('AI_GEMINI', `Error pengujian API: ${errMsg}`, undefined, 'error');
      return { valid: false, message: `Gagal terhubung ke server validasi: ${errMsg}` };
    }
  }

  /**
   * Menghasilkan soal ujian secara otomatis melalui AI Gemini
   */
  static async generateQuestions(examId: string, params: GenerateParams): Promise<{ success: boolean; questions?: Question[]; message: string }> {
    const settings = StorageService.getSettings();
    const customApiKey = settings.geminiApiKey.trim();

    StorageService.addLog('AI_GEMINI', `Memulai pembuatan ${params.count} soal AI: "${params.topic}" (${params.subject} - ${params.grade})`);

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

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menghasilkan soal dari server');
      }

      const generatedList = data.questions;
      if (!Array.isArray(generatedList) || generatedList.length === 0) {
        throw new Error('Format soal yang diterima dari model tidak valid.');
      }

      // Format dan beri ID unik ke setiap soal
      const formattedQuestions: Question[] = generatedList.map((item: any, idx: number) => {
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
        `Berhasil membuat ${formattedQuestions.length} butir soal dengan taksonomi ${params.taxonomy.toUpperCase()}!`,
        undefined,
        'success'
      );

      return {
        success: true,
        questions: formattedQuestions,
        message: `Berhasil membuat ${formattedQuestions.length} soal AI!`
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      StorageService.addLog('AI_GEMINI', `Gagal membuat soal AI: ${errMsg}`, undefined, 'error');
      return {
        success: false,
        message: errMsg
      };
    }
  }
}
