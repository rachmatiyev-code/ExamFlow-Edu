import { Exam, Question, Submission, QuestionAnalysis, ObjectiveAnalysis, StudentRemedialRecommendation } from '../types';

export class AnalysisService {
  /**
   * Mengecek apakah jawaban siswa pada butir soal tertentu benar
   */
  static isAnswerCorrect(question: Question, studentAnswer: any): boolean {
    if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
      return false;
    }

    if (question.type === 'checkbox') {
      const correctKeys: string[] = Array.isArray(question.correctKey)
        ? question.correctKey.map(k => String(k).trim())
        : [String(question.correctKey).trim()];
      const studentKeys: string[] = Array.isArray(studentAnswer)
        ? studentAnswer.map(k => String(k).trim())
        : [String(studentAnswer).trim()];

      if (correctKeys.length === 0) return false;
      if (correctKeys.length !== studentKeys.length) return false;
      return correctKeys.every(k => studentKeys.includes(k));
    }

    if (question.type === 'essay') {
      const correctKeyStr = String(question.correctKey || '').trim().toLowerCase();
      const studentStr = String(studentAnswer || '').trim().toLowerCase();
      if (!correctKeyStr) return true;
      // Cocok persis atau mengandung kata kunci utama
      return studentStr === correctKeyStr || studentStr.includes(correctKeyStr) || correctKeyStr.includes(studentStr);
    }

    // Default: Pilihan Ganda Tunggal / True-False
    return String(studentAnswer).trim().toLowerCase() === String(question.correctKey || '').trim().toLowerCase();
  }

  /**
   * Melakukan Analisis Butir Soal (Item Analysis)
   * Mengukur Tingkat Kesukaran (P-value) dan Daya Pembeda (D-index)
   */
  static analyzeQuestions(
    examId: string,
    questions: Question[],
    submissions: Submission[]
  ): QuestionAnalysis[] {
    const examSubs = submissions.filter(s => String(s.examId || '').trim().toLowerCase() === String(examId).trim().toLowerCase());
    const totalParticipants = examSubs.length;

    // Urutkan siswa dari skor tertinggi ke terendah untuk perhitungan Daya Pembeda
    const sortedSubs = [...examSubs].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Kelompok Atas dan Kelompok Bawah (27% rule, minimal 1 jika ada peserta)
    const groupSize = totalParticipants >= 4 ? Math.max(1, Math.round(totalParticipants * 0.27)) : Math.max(1, Math.floor(totalParticipants / 2));
    const upperGroup = sortedSubs.slice(0, groupSize);
    const lowerGroup = totalParticipants > 1 ? sortedSubs.slice(sortedSubs.length - groupSize) : [];

    return questions.map((q) => {
      let correctCount = 0;

      examSubs.forEach(sub => {
        const ans = sub.answers ? sub.answers[q.id] : undefined;
        if (this.isAnswerCorrect(q, ans)) {
          correctCount++;
        }
      });

      const correctRate = totalParticipants > 0 ? Math.round((correctCount / totalParticipants) * 100) : 0;
      const difficultyIndex = totalParticipants > 0 ? Number((correctCount / totalParticipants).toFixed(2)) : 0;

      // Tingkat Kesukaran (P-Value baku Kemendikbud)
      let difficultyLevel: 'Sangat Mudah' | 'Mudah' | 'Sedang' | 'Sukar' | 'Sangat Sukar';
      if (difficultyIndex > 0.80) {
        difficultyLevel = 'Sangat Mudah';
      } else if (difficultyIndex > 0.70) {
        difficultyLevel = 'Mudah';
      } else if (difficultyIndex >= 0.30) {
        difficultyLevel = 'Sedang';
      } else if (difficultyIndex >= 0.15) {
        difficultyLevel = 'Sukar';
      } else {
        difficultyLevel = 'Sangat Sukar';
      }

      // Daya Pembeda (D-Index)
      let upperCorrect = 0;
      upperGroup.forEach(sub => {
        const ans = sub.answers ? sub.answers[q.id] : undefined;
        if (this.isAnswerCorrect(q, ans)) upperCorrect++;
      });

      let lowerCorrect = 0;
      lowerGroup.forEach(sub => {
        const ans = sub.answers ? sub.answers[q.id] : undefined;
        if (this.isAnswerCorrect(q, ans)) lowerCorrect++;
      });

      let discriminationIndex = 0;
      if (upperGroup.length > 0 && lowerGroup.length > 0) {
        const pUpper = upperCorrect / upperGroup.length;
        const pLower = lowerCorrect / lowerGroup.length;
        discriminationIndex = Number((pUpper - pLower).toFixed(2));
      }

      let discriminationStatus: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Jelek (Revisi)' | 'Sangat Jelek (Buang)';
      if (discriminationIndex >= 0.40) {
        discriminationStatus = 'Sangat Baik';
      } else if (discriminationIndex >= 0.30) {
        discriminationStatus = 'Baik';
      } else if (discriminationIndex >= 0.20) {
        discriminationStatus = 'Cukup';
      } else if (discriminationIndex >= 0.00) {
        discriminationStatus = 'Jelek (Revisi)';
      } else {
        discriminationStatus = 'Sangat Jelek (Buang)';
      }

      const tpText = q.learningObjective?.trim() || q.indicator?.trim() || 'Pemahaman Konsep Materi Pokok';

      return {
        questionId: q.id,
        order: q.order,
        prompt: q.prompt,
        type: q.type,
        learningObjective: tpText,
        bloomLevel: q.bloomLevel,
        totalAttempts: totalParticipants,
        correctCount,
        correctRate,
        difficultyIndex,
        difficultyLevel,
        discriminationIndex,
        discriminationStatus
      };
    });
  }

  /**
   * Menganalisis Ketercapaian per Tujuan Pembelajaran (TP)
   */
  static analyzeObjectives(
    questions: Question[],
    submissions: Submission[]
  ): ObjectiveAnalysis[] {
    const objectiveMap: Record<string, { questions: Question[]; orders: number[] }> = {};

    questions.forEach(q => {
      const tp = q.learningObjective?.trim() || q.indicator?.trim() || 'Pemahaman Pokok Materi';
      if (!objectiveMap[tp]) {
        objectiveMap[tp] = { questions: [], orders: [] };
      }
      objectiveMap[tp].questions.push(q);
      objectiveMap[tp].orders.push(q.order);
    });

    const results: ObjectiveAnalysis[] = [];
    const totalSubs = submissions.length;

    Object.entries(objectiveMap).forEach(([tp, group]) => {
      const qIds = group.questions.map(q => q.id);
      let totalMasteryPercentSum = 0;
      let masteredStudentCount = 0;
      let unmasteredStudentCount = 0;

      submissions.forEach(sub => {
        let correctInTp = 0;
        group.questions.forEach(q => {
          const ans = sub.answers ? sub.answers[q.id] : undefined;
          if (this.isAnswerCorrect(q, ans)) {
            correctInTp++;
          }
        });

        const studentTpScore = qIds.length > 0 ? (correctInTp / qIds.length) * 100 : 0;
        totalMasteryPercentSum += studentTpScore;

        if (studentTpScore >= 75) {
          masteredStudentCount++;
        } else {
          unmasteredStudentCount++;
        }
      });

      const avgMastery = totalSubs > 0 ? Math.round(totalMasteryPercentSum / totalSubs) : 0;
      let status: 'Tuntas' | 'Perlu Perbaikan' | 'Kritis';
      if (avgMastery >= 75) {
        status = 'Tuntas';
      } else if (avgMastery >= 50) {
        status = 'Perlu Perbaikan';
      } else {
        status = 'Kritis';
      }

      results.push({
        objective: tp,
        questionCount: group.questions.length,
        questionOrders: group.orders.sort((a, b) => a - b),
        averageMastery: avgMastery,
        masteredStudentCount,
        unmasteredStudentCount,
        status
      });
    });

    return results;
  }

  /**
   * Menghasilkan Saran Remidi dan Pengayaan per Siswa
   * Disesuaikan dengan Tujuan Pembelajaran yang belum vs sudah dikuasai
   */
  static generateStudentRecommendations(
    exam: Exam,
    questions: Question[],
    submissions: Submission[]
  ): StudentRemedialRecommendation[] {
    const examSubs = submissions.filter(s => String(s.examId || '').trim().toLowerCase() === String(exam.id).trim().toLowerCase());

    return examSubs.map(sub => {
      const unmasteredObjSet = new Set<string>();
      const masteredObjSet = new Set<string>();
      const missedQuestionOrders: number[] = [];

      questions.forEach(q => {
        const tp = q.learningObjective?.trim() || q.indicator?.trim() || `Butir Soal #${q.order}`;
        const ans = sub.answers ? sub.answers[q.id] : undefined;
        const correct = this.isAnswerCorrect(q, ans);

        if (correct) {
          masteredObjSet.add(tp);
        } else {
          unmasteredObjSet.add(tp);
          missedQuestionOrders.push(q.order);
        }
      });

      // Filter out TP that are fully unmastered
      const unmasteredObjectives = Array.from(unmasteredObjSet);
      // Mastered objectives are those in masteredObjSet and NOT in unmasteredObjSet (or achieved majority)
      const masteredObjectives = Array.from(masteredObjSet).filter(tp => !unmasteredObjectives.includes(tp));

      const remedialPlan: string[] = [];
      const enrichmentPlan: string[] = [];

      const passThreshold = exam.passingScore || 75;
      const isPassed = sub.percentage >= passThreshold;

      if (!isPassed || unmasteredObjectives.length > 0) {
        // Remedial recommendations
        if (unmasteredObjectives.length > 0) {
          remedialPlan.push(
            `Kaji ulang konsep materi: ${unmasteredObjectives.slice(0, 3).join(', ')}.`
          );
        }
        if (missedQuestionOrders.length > 0) {
          remedialPlan.push(
            `Pembahasan khusus butir soal nomor ${missedQuestionOrders.slice(0, 8).join(', ')}${missedQuestionOrders.length > 8 ? ' dan seterusnya' : ''}.`
          );
        }
        remedialPlan.push('Bimbingan intensif / tutor sebaya terfokus pada indikator soal yang belum dicapai.');
        remedialPlan.push('Tes diagnostik ulang atau resume materi untuk mengevaluasi pemahaman konsep.');
      } else {
        remedialPlan.push('Siswa telah mencapai ketuntasan minimum pada seluruh butir Tujuan Pembelajaran.');
      }

      if (isPassed || sub.percentage >= 70) {
        // Enrichment recommendations
        if (masteredObjectives.length > 0) {
          enrichmentPlan.push(
            `Pendalaman materi HOTS (Analisis & Evaluasi) pada topik: ${masteredObjectives.slice(0, 3).join(', ')}.`
          );
        }
        enrichmentPlan.push('Diberikan penugasan studi kasus kontekstual atau mini riset aplikatif.');
        enrichmentPlan.push('Direkomendasikan sebagai tutor sebaya dalam kelompok belajar remedial.');
      } else {
        enrichmentPlan.push('Fokus terlebih dahulu pada ketuntasan remedial sebelum melangkah ke program pengayaan.');
      }

      return {
        studentNo: sub.studentNo,
        studentName: sub.studentName,
        classGrade: sub.classGrade || exam.grade,
        score: sub.score,
        percentage: sub.percentage,
        passed: isPassed,
        unmasteredObjectives,
        masteredObjectives,
        remedialPlan,
        enrichmentPlan
      };
    });
  }
}
