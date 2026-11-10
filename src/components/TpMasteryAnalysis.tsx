import React, { useState, useMemo } from 'react';
import { 
  Target, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  User, 
  ArrowLeft, 
  ArrowRight, 
  Search, 
  Filter, 
  RotateCcw, 
  Printer, 
  FileSpreadsheet, 
  BookOpen, 
  Award, 
  Sparkles, 
  Info,
  ChevronRight,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import { Exam, Question, SchoolProfile, Submission, Student } from '../types';
import { StorageService } from '../services/storage';
import { AnalysisService } from '../services/analysisService';
import * as XLSX from 'xlsx';

interface TpMasteryAnalysisProps {
  profile: SchoolProfile;
  exams: Exam[];
  submissions: Submission[];
  students: Student[];
  initialExamId?: string;
  initialStudentNis?: string;
  onNavigateToRekap?: () => void;
}

/**
 * Komponen Grafik Donat (Pure SVG Donut Chart)
 * Menampilkan proporsi TP yang sudah dikuasai vs belum dikuasai secara presisi dan responsif
 */
export const DonutChart: React.FC<{
  masteredCount: number;
  unmasteredCount: number;
  size?: number;
  strokeWidth?: number;
  centerTitle?: string;
  centerSubtitle?: string;
}> = ({
  masteredCount,
  unmasteredCount,
  size = 180,
  strokeWidth = 24,
  centerTitle,
  centerSubtitle = 'Dikuasai'
}) => {
  const total = masteredCount + unmasteredCount;
  const masteredPct = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
  const unmasteredPct = total > 0 ? 100 - masteredPct : 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const masteredStroke = (masteredPct / 100) * circumference;
  const unmasteredStroke = (unmasteredPct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-slate-800"
          />

          {total === 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#cbd5e1"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
            />
          ) : (
            <>
              {/* Mastered Segment (Green / Emerald) */}
              {masteredCount > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${masteredStroke} ${circumference}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              )}

              {/* Unmastered Segment (Rose / Red) */}
              {unmasteredCount > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#f43f5e"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${unmasteredStroke} ${circumference}`}
                  strokeDashoffset={-masteredStroke}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              )}
            </>
          )}
        </svg>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {centerTitle || `${masteredPct}%`}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wider">
            {centerSubtitle}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Sudah Dikuasai: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{masteredCount} TP ({masteredPct}%)</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Belum Dikuasai: <strong className="text-rose-600 dark:text-rose-400 font-bold">{unmasteredCount} TP ({unmasteredPct}%)</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export const TpMasteryAnalysis: React.FC<TpMasteryAnalysisProps> = ({
  profile,
  exams,
  submissions,
  students,
  initialExamId,
  initialStudentNis,
  onNavigateToRekap
}) => {
  // Mode Tampilan: Klasikal (Seluruh Siswa) vs Per Siswa (Individu)
  const [viewMode, setViewMode] = useState<'klasikal' | 'siswa'>('klasikal');

  // Filter States
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || 'all');
  const [searchStudentQuery, setSearchStudentQuery] = useState<string>('');

  // Selected Student for Per Siswa view
  const [activeStudentId, setActiveStudentId] = useState<string>(initialStudentNis || '');

  // Distinct subjects & grades from exams
  const distinctSubjects = useMemo(() => {
    const set = new Set<string>();
    exams.forEach(e => {
      if (e.subject) set.add(e.subject.trim());
    });
    return Array.from(set).sort();
  }, [exams]);

  const distinctGrades = useMemo(() => {
    const set = new Set<string>();
    exams.forEach(e => {
      if (e.grade) set.add(e.grade.trim());
    });
    students.forEach(st => {
      if (st.classGrade) set.add(st.classGrade.trim());
    });
    return Array.from(set).sort();
  }, [exams, students]);

  // Available Exams matching subject and grade filter
  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      const matchSubj = selectedSubject === 'all' || (e.subject || '').toLowerCase() === selectedSubject.toLowerCase();
      const matchGrd = selectedGrade === 'all' || (e.grade || '').toLowerCase() === selectedGrade.toLowerCase();
      return matchSubj && matchGrd;
    });
  }, [exams, selectedSubject, selectedGrade]);

  // Target Exams in scope for analysis
  const targetExams = useMemo(() => {
    if (selectedExamId !== 'all') {
      const found = exams.find(e => e.id === selectedExamId);
      return found ? [found] : filteredExams;
    }
    return filteredExams.length > 0 ? filteredExams : exams;
  }, [selectedExamId, exams, filteredExams]);

  // All questions belonging to the target exams
  const allTargetQuestions = useMemo(() => {
    const list: Question[] = [];
    targetExams.forEach(ex => {
      const qs = StorageService.getQuestionsByExamId(ex.id);
      list.push(...qs);
    });
    return list;
  }, [targetExams]);

  // Filtered submissions for target exams & class grade
  const targetSubmissions = useMemo(() => {
    const targetExamIds = new Set(targetExams.map(e => e.id));
    return submissions.filter(s => {
      if (!targetExamIds.has(s.examId)) return false;
      if (s.statusNote === 'Mengulang Ujian') return false;
      if (selectedGrade !== 'all') {
        const studentClass = s.classGrade || '';
        if (studentClass.toLowerCase() !== selectedGrade.toLowerCase()) return false;
      }
      return true;
    });
  }, [submissions, targetExams, selectedGrade]);

  // Unique students available in target submissions
  const availableStudents = useMemo(() => {
    const map = new Map<string, { studentNo: string; studentName: string; classGrade: string }>();

    targetSubmissions.forEach(sub => {
      const key = (sub.studentNo || sub.studentName).trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          studentNo: sub.studentNo || '-',
          studentName: sub.studentName,
          classGrade: sub.classGrade || '-'
        });
      }
    });

    // Also include students from roster if matching grade
    if (selectedGrade !== 'all') {
      students.forEach(st => {
        if ((st.classGrade || '').toLowerCase() === selectedGrade.toLowerCase()) {
          const key = (st.studentNo || st.nis || st.fullName).trim().toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              studentNo: st.studentNo || st.nis || '-',
              studentName: st.fullName,
              classGrade: st.classGrade
            });
          }
        }
      });
    }

    const list = Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
    return list;
  }, [targetSubmissions, students, selectedGrade]);

  // Ensure activeStudentId is valid
  const currentStudent = useMemo(() => {
    if (availableStudents.length === 0) return null;
    if (!activeStudentId) return availableStudents[0];
    const found = availableStudents.find(
      st => st.studentNo.toLowerCase() === activeStudentId.toLowerCase() ||
            st.studentName.toLowerCase() === activeStudentId.toLowerCase()
    );
    return found || availableStudents[0];
  }, [availableStudents, activeStudentId]);

  // ==========================================
  // 1. ANALISIS KLASIKAL (Seluruh Siswa)
  // ==========================================
  const classicalAnalysis = useMemo(() => {
    if (allTargetQuestions.length === 0 || targetSubmissions.length === 0) {
      return {
        objectives: [],
        masteredList: [],
        unmasteredList: [],
        totalTp: 0,
        masteredTpCount: 0,
        unmasteredTpCount: 0,
        averageMasteryPct: 0
      };
    }

    const analyzed = AnalysisService.analyzeObjectives(allTargetQuestions, targetSubmissions);

    const masteredList = analyzed.filter(item => item.averageMastery >= 75);
    const unmasteredList = analyzed.filter(item => item.averageMastery < 75);

    const totalTp = analyzed.length;
    const masteredTpCount = masteredList.length;
    const unmasteredTpCount = unmasteredList.length;
    const avgSum = analyzed.reduce((sum, item) => sum + item.averageMastery, 0);
    const averageMasteryPct = totalTp > 0 ? Math.round(avgSum / totalTp) : 0;

    return {
      objectives: analyzed,
      masteredList,
      unmasteredList,
      totalTp,
      masteredTpCount,
      unmasteredTpCount,
      averageMasteryPct
    };
  }, [allTargetQuestions, targetSubmissions]);

  // ==========================================
  // 2. ANALISIS PER SISWA (Individual)
  // ==========================================
  const studentAnalysis = useMemo(() => {
    if (!currentStudent || allTargetQuestions.length === 0) {
      return {
        masteredObjectives: [],
        unmasteredObjectives: [],
        totalTp: 0,
        masteredCount: 0,
        unmasteredCount: 0,
        masteryPct: 0,
        studentSubmissions: [],
        overallScore: 0
      };
    }

    // Get submissions for this specific student
    const sSubs = targetSubmissions.filter(s => {
      const matchNo = (s.studentNo || '').trim().toLowerCase() === currentStudent.studentNo.trim().toLowerCase();
      const matchName = (s.studentName || '').trim().toLowerCase() === currentStudent.studentName.trim().toLowerCase();
      return matchNo || matchName;
    });

    // Group questions by TP
    const tpMap: Record<string, { questions: Question[]; correctCount: number; totalCount: number; pointsEarned: number; maxPoints: number }> = {};

    allTargetQuestions.forEach(q => {
      const tp = q.learningObjective?.trim() || q.indicator?.trim() || `Tujuan Pembelajaran Butir Soal #${q.order}`;
      if (!tpMap[tp]) {
        tpMap[tp] = { questions: [], correctCount: 0, totalCount: 0, pointsEarned: 0, maxPoints: 0 };
      }
      tpMap[tp].questions.push(q);
      tpMap[tp].totalCount++;
      tpMap[tp].maxPoints += (q.points || 10);

      // Check if student answered this question correctly across their submissions
      const relevantSub = sSubs.find(sub => sub.examId === q.examId);
      if (relevantSub && relevantSub.answers) {
        const studentAns = relevantSub.answers[q.id];
        const isCorrect = AnalysisService.isAnswerCorrect(q, studentAns);
        if (isCorrect) {
          tpMap[tp].correctCount++;
          tpMap[tp].pointsEarned += (q.points || 10);
        }
      }
    });

    const masteredObjectives: Array<{
      objective: string;
      correctCount: number;
      totalCount: number;
      percentage: number;
      questionOrders: number[];
    }> = [];

    const unmasteredObjectives: Array<{
      objective: string;
      correctCount: number;
      totalCount: number;
      percentage: number;
      questionOrders: number[];
      missedQuestionOrders: number[];
    }> = [];

    Object.entries(tpMap).forEach(([tp, data]) => {
      const percentage = data.totalCount > 0 ? Math.round((data.correctCount / data.totalCount) * 100) : 0;
      const questionOrders = data.questions.map(q => q.order).sort((a, b) => a - b);
      
      const missedQuestionOrders: number[] = [];
      data.questions.forEach(q => {
        const relevantSub = sSubs.find(sub => sub.examId === q.examId);
        const ans = relevantSub?.answers ? relevantSub.answers[q.id] : undefined;
        if (!AnalysisService.isAnswerCorrect(q, ans)) {
          missedQuestionOrders.push(q.order);
        }
      });

      if (percentage >= 75) {
        masteredObjectives.push({
          objective: tp,
          correctCount: data.correctCount,
          totalCount: data.totalCount,
          percentage,
          questionOrders
        });
      } else {
        unmasteredObjectives.push({
          objective: tp,
          correctCount: data.correctCount,
          totalCount: data.totalCount,
          percentage,
          questionOrders,
          missedQuestionOrders
        });
      }
    });

    const totalTp = Object.keys(tpMap).length;
    const masteredCount = masteredObjectives.length;
    const unmasteredCount = unmasteredObjectives.length;
    const masteryPct = totalTp > 0 ? Math.round((masteredCount / totalTp) * 100) : 0;

    const avgScore = sSubs.length > 0
      ? Math.round(sSubs.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0) / sSubs.length)
      : 0;

    return {
      masteredObjectives,
      unmasteredObjectives,
      totalTp,
      masteredCount,
      unmasteredCount,
      masteryPct,
      studentSubmissions: sSubs,
      overallScore: avgScore
    };
  }, [currentStudent, allTargetQuestions, targetSubmissions]);

  // Export Capaian TP ke Excel (.xlsx)
  const handleExportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Tab 1: Capaian Klasikal
    const classicalRows = [
      ['ANALISIS KETERCAPAIAN TUJUAN PEMBELAJARAN (TP) - DATA KLASIKAL'],
      [profile.name || 'SD NEGERI PISANGCANDI 1 MALANG'],
      [`Mata Pelajaran: ${selectedSubject !== 'all' ? selectedSubject : 'Semua Mapel'} | Kelas: ${selectedGrade !== 'all' ? selectedGrade : 'Semua Kelas'}`],
      [`Tahun Ajaran: ${profile.academicYear} | Semester: ${profile.semester}`],
      [''],
      ['NO', 'TUJUAN PEMBELAJARAN (TP)', 'JUMLAH SOAL', 'NO SOAL', 'SISWA TUNTAS', 'SISWA BELUM TUNTAS', 'RATA-RATA PENGUASAAN (%)', 'STATUS KELAS'],
      ...classicalAnalysis.objectives.map((item, idx) => [
        idx + 1,
        item.objective,
        item.questionCount,
        item.questionOrders.join(', '),
        item.masteredStudentCount,
        item.unmasteredStudentCount,
        `${item.averageMastery}%`,
        item.averageMastery >= 75 ? 'SUDAH DIKUASAI' : 'BELUM DIKUASAI'
      ]),
      [''],
      ['RINGKASAN GRAFIK DONAT KLASIKAL:'],
      ['Total TP Dianalisis', classicalAnalysis.totalTp],
      ['TP Sudah Dikuasai (Klasikal)', classicalAnalysis.masteredTpCount],
      ['TP Belum Dikuasai (Klasikal)', classicalAnalysis.unmasteredTpCount],
      ['Rata-rata Penguasaan Kelas', `${classicalAnalysis.averageMasteryPct}%`]
    ];

    const wsClassical = XLSX.utils.aoa_to_sheet(classicalRows);
    wsClassical['!cols'] = [
      { wch: 6 },
      { wch: 45 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 24 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsClassical, 'Capaian_TP_Klasikal');

    // Tab 2: Capaian Siswa Terpilih
    if (currentStudent) {
      const studentRows = [
        ['ANALISIS KETERCAPAIAN TUJUAN PEMBELAJARAN (TP) - DATA PER SISWA'],
        [`Nama Siswa: ${currentStudent.studentName} | NIS: ${currentStudent.studentNo} | Kelas: ${currentStudent.classGrade}`],
        [`Nilai Rata-rata: ${studentAnalysis.overallScore} | Ketuntasan TP: ${studentAnalysis.masteryPct}%`],
        [''],
        ['1. TUJUAN PEMBELAJARAN YANG SUDAH DIKUASAI:'],
        ['NO', 'TUJUAN PEMBELAJARAN', 'SOAL BENAR', 'TOTAL SOAL', 'PERSENTASE (%)', 'STATUS'],
        ...studentAnalysis.masteredObjectives.map((m, idx) => [
          idx + 1,
          m.objective,
          m.correctCount,
          m.totalCount,
          `${m.percentage}%`,
          'SUDAH DIKUASAI'
        ]),
        [''],
        ['2. TUJUAN PEMBELAJARAN YANG BELUM DIKUASAI:'],
        ['NO', 'TUJUAN PEMBELAJARAN', 'SOAL BENAR', 'TOTAL SOAL', 'PERSENTASE (%)', 'NO SOAL SALAH', 'STATUS'],
        ...studentAnalysis.unmasteredObjectives.map((um, idx) => [
          idx + 1,
          um.objective,
          um.correctCount,
          um.totalCount,
          `${um.percentage}%`,
          um.missedQuestionOrders.join(', ') || '-',
          'BELUM DIKUASAI (REMEDIAL)'
        ])
      ];

      const wsStudent = XLSX.utils.aoa_to_sheet(studentRows);
      wsStudent['!cols'] = [
        { wch: 6 },
        { wch: 45 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 24 }
      ];
      XLSX.utils.book_append_sheet(wb, wsStudent, 'Capaian_TP_Siswa');
    }

    XLSX.writeFile(wb, `Analisis_Capaian_TP_${selectedSubject}_${selectedGrade}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Analisis Capaian Tujuan Pembelajaran (TP)
              </h3>
              <span className="text-[10px] font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                Kurikulum Merdeka
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Pemetaan akurat butir <strong>Tujuan Pembelajaran yang Sudah Dikuasai</strong> dan <strong>Belum Dikuasai</strong> dilengkapi grafik donat interaktif (data klasikal & per siswa).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToRekap && (
            <button
              type="button"
              onClick={onNavigateToRekap}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Matriks Rekap Nilai</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportToExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Analisis TP</span>
          </button>
        </div>
      </div>

      {/* Filter and Mode Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        {/* Mode Switcher Tabs: Data Klasikal vs Data Per Siswa */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setViewMode('klasikal')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'klasikal'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>1. Data Klasikal (Seluruh Siswa)</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('siswa')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'siswa'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>2. Data Per Siswa (Individual)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            <span>Saring Data Analisis:</span>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Mata Pelajaran */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Mata Pelajaran
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedExamId('all');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">Semua Mata Pelajaran ({distinctSubjects.length})</option>
              {distinctSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Kelas */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Kelas / Rombel
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedExamId('all');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">Semua Kelas ({distinctGrades.length})</option>
              {distinctGrades.map(grd => (
                <option key={grd} value={grd}>{grd}</option>
              ))}
            </select>
          </div>

          {/* Paket Asesmen */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Paket Asesmen
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">Gabungan Semua Paket ({filteredExams.length} Paket)</option>
              {filteredExams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.title} ({ex.subject} - {ex.grade})</option>
              ))}
            </select>
          </div>

          {/* Selector Siswa (Hanya Aktif di Mode Per Siswa) */}
          {viewMode === 'siswa' ? (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Pilih Nama Siswa ({availableStudents.length} Siswa)
              </label>
              <select
                value={currentStudent?.studentNo || ''}
                onChange={(e) => setActiveStudentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/40 text-slate-900 dark:text-white font-bold"
              >
                {availableStudents.map(st => (
                  <option key={st.studentNo} value={st.studentNo}>
                    {st.studentName} ({st.studentNo}) - {st.classGrade}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject('all');
                  setSelectedGrade('all');
                  setSelectedExamId('all');
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: DATA KLASIKAL (SELURUH SISWA)                     */}
      {/* ========================================================= */}
      {viewMode === 'klasikal' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Row: Grafik Donat Klasikal + KPI Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Donut Chart Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                <BarChart2 className="w-4 h-4 text-indigo-500" />
                <span>Grafik Donat Capaian TP Klasikal</span>
              </div>

              <DonutChart
                masteredCount={classicalAnalysis.masteredTpCount}
                unmasteredCount={classicalAnalysis.unmasteredTpCount}
                size={190}
                strokeWidth={26}
                centerTitle={`${classicalAnalysis.averageMasteryPct}%`}
                centerSubtitle="Rata-Rata"
              />

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 max-w-xs">
                Proporsi Tujuan Pembelajaran yang tuntas vs belum tuntas secara klasikal (standar KKM: 75%).
              </p>
            </div>

            {/* Classical KPI Summary Cards */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total TP Dianalisis</span>
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                  {classicalAnalysis.totalTp}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Dari {allTargetQuestions.length} butir soal teruji
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rata-rata Penguasaan</span>
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <div className="mt-2 text-3xl font-black text-blue-600 dark:text-blue-400">
                  {classicalAnalysis.averageMasteryPct}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Skor penguasaan rata-rata kelas
                </div>
              </div>

              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">TP Sudah Dikuasai</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {classicalAnalysis.masteredTpCount}
                  <span className="text-sm font-semibold text-emerald-700 ml-1">TP</span>
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                  Rata-rata kelas mencapai ≥ 75%
                </div>
              </div>

              <div className="bg-rose-50/60 dark:bg-rose-950/30 p-5 rounded-2xl border border-rose-200 dark:border-rose-800/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-300">TP Belum Dikuasai</span>
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-400">
                  {classicalAnalysis.unmasteredTpCount}
                  <span className="text-sm font-semibold text-rose-700 ml-1">TP</span>
                </div>
                <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 font-medium">
                  Rata-rata kelas &lt; 75% (Perlu Remedial)
                </div>
              </div>
            </div>
          </div>

          {/* Two Distinct Sections: TP Dikuasai vs TP Belum Dikuasai */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. KARTU TP YANG SUDAH DIKUASAI (KLASIKAL) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      Tujuan Pembelajaran yang Sudah Dikuasai
                    </h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Capaian tuntas secara klasikal (Rata-rata ≥ 75%)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                  {classicalAnalysis.masteredList.length} TP
                </span>
              </div>

              <div className="p-5 flex-1 space-y-4">
                {classicalAnalysis.masteredList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Belum ada Tujuan Pembelajaran yang mencapai ketuntasan klasikal (≥ 75%).
                  </div>
                ) : (
                  classicalAnalysis.masteredList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">
                            {item.objective}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-600 text-white shrink-0">
                          {item.averageMastery}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.averageMastery}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-emerald-100/60 dark:border-emerald-900/40">
                        <span>
                          Siswa Tuntas: <strong className="text-emerald-600 dark:text-emerald-400">{item.masteredStudentCount}</strong> dari {item.masteredStudentCount + item.unmasteredStudentCount} siswa
                        </span>
                        <span>
                          Teruji pada Soal No: <strong className="text-slate-700 dark:text-slate-300">{item.questionOrders.join(', ')}</strong> ({item.questionCount} butir)
                        </span>
                      </div>

                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 italic bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg">
                        💡 <strong>Rekomendasi Tindak Lanjut:</strong> Pemahaman materi tuntas. Siswa dapat diberikan materi pengayaan atau asesmen lanjutan.
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. KARTU TP YANG BELUM DIKUASAI (KLASIKAL) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 bg-rose-50/90 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold">
                    !
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-rose-950 dark:text-rose-200">
                      Tujuan Pembelajaran yang Belum Dikuasai
                    </h4>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400">
                      Perlu Remedial Klasikal (Rata-rata &lt; 75%)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                  {classicalAnalysis.unmasteredList.length} TP
                </span>
              </div>

              <div className="p-5 flex-1 space-y-4">
                {classicalAnalysis.unmasteredList.length === 0 ? (
                  <div className="py-8 text-center text-emerald-600 text-xs font-bold">
                    🎉 Luar biasa! Seluruh Tujuan Pembelajaran telah berhasil dikuasai secara klasikal (≥ 75%).
                  </div>
                ) : (
                  classicalAnalysis.unmasteredList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-rose-100 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">
                            {item.objective}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-600 text-white shrink-0">
                          {item.averageMastery}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.averageMastery}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-rose-100/60 dark:border-rose-900/40">
                        <span>
                          Siswa Butuh Remidi: <strong className="text-rose-600 dark:text-rose-400">{item.unmasteredStudentCount}</strong> dari {item.masteredStudentCount + item.unmasteredStudentCount} siswa
                        </span>
                        <span>
                          Teruji pada Soal No: <strong className="text-slate-700 dark:text-slate-300">{item.questionOrders.join(', ')}</strong> ({item.questionCount} butir)
                        </span>
                      </div>

                      <div className="text-[11px] text-rose-800 dark:text-rose-300 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg space-y-1">
                        <div>
                          ⚠️ <strong>Rencana Remedial Klasikal:</strong> Guru disarankan mengulang konsep materi ini dengan metode kontekstual dan latihan soal terbimbing sebelum ujian sumatif.
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: DATA PER SISWA (INDIVIDUAL)                       */}
      {/* ========================================================= */}
      {viewMode === 'siswa' && currentStudent && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Row: Donut Chart Siswa + Profil Singkat Siswa */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Donut Chart Siswa Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                <BarChart2 className="w-4 h-4 text-purple-500" />
                <span>Grafik Donat Capaian TP Siswa</span>
              </div>

              <DonutChart
                masteredCount={studentAnalysis.masteredCount}
                unmasteredCount={studentAnalysis.unmasteredCount}
                size={190}
                strokeWidth={26}
                centerTitle={`${studentAnalysis.masteryPct}%`}
                centerSubtitle="TP Dikuasai"
              />

              <div className="mt-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                {currentStudent.studentName} ({currentStudent.classGrade})
              </div>
              <div className="text-[11px] text-slate-400">
                NIS: {currentStudent.studentNo}
              </div>
            </div>

            {/* Student Score & Mastery Overview Cards */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nilai Rata-rata Siswa</span>
                  <Award className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="mt-2 text-3xl font-black text-indigo-600 dark:text-indigo-400">
                  {studentAnalysis.overallScore}
                  <span className="text-xs font-normal text-slate-500 ml-1">/ 100</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Status: <strong className={studentAnalysis.overallScore >= 75 ? 'text-emerald-600' : 'text-amber-600'}>
                    {studentAnalysis.overallScore >= 75 ? 'TUNTAS ASESMEN' : 'PERLU REMEDIAL'}
                  </strong>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ketuntasan Tujuan Pembelajaran</span>
                  <Target className="w-4 h-4 text-purple-500" />
                </div>
                <div className="mt-2 text-3xl font-black text-purple-600 dark:text-purple-400">
                  {studentAnalysis.masteredCount} / {studentAnalysis.totalTp}
                  <span className="text-xs font-semibold text-slate-500 ml-1.5">TP</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {studentAnalysis.masteryPct}% Tujuan Pembelajaran telah dikuasai
                </div>
              </div>

              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">TP Sudah Dikuasai</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {studentAnalysis.masteredCount}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                  Siap untuk materi pengayaan
                </div>
              </div>

              <div className="bg-rose-50/60 dark:bg-rose-950/30 p-5 rounded-2xl border border-rose-200 dark:border-rose-800/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-300">TP Belum Dikuasai</span>
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-400">
                  {studentAnalysis.unmasteredCount}
                </div>
                <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 font-medium">
                  Memerlukan bimbingan / remedial
                </div>
              </div>
            </div>
          </div>

          {/* Two Distinct Sections per Siswa */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. TP YANG SUDAH DIKUASAI OLEH SISWA */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      Tujuan Pembelajaran yang Sudah Dikuasai oleh {currentStudent.studentName}
                    </h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Siswa mencapai ketuntasan (Skor ≥ 75%)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                  {studentAnalysis.masteredObjectives.length} TP
                </span>
              </div>

              <div className="p-5 flex-1 space-y-4">
                {studentAnalysis.masteredObjectives.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Siswa belum mencapai ketuntasan pada tujuan pembelajaran yang diuji.
                  </div>
                ) : (
                  studentAnalysis.masteredObjectives.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">
                            {item.objective}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-600 text-white shrink-0">
                          {item.percentage}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        <span>Menjawab benar: <strong>{item.correctCount}</strong> dari {item.totalCount} butir</span>
                        <span>Butir Soal No: {item.questionOrders.join(', ')}</span>
                      </div>

                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 italic bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg">
                        ✨ <strong>Apresiasi:</strong> Siswa menunjukkan penguasaan materi yang baik pada TP ini. Dapat direkomendasikan untuk pendalaman materi/tutor sebaya.
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. TP YANG BELUM DIKUASAI OLEH SISWA */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 bg-rose-50/90 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold">
                    !
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-rose-950 dark:text-rose-200">
                      Tujuan Pembelajaran yang Belum Dikuasai oleh {currentStudent.studentName}
                    </h4>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400">
                      Memerlukan Pendampingan / Bimbingan Remedial (Skor &lt; 75%)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                  {studentAnalysis.unmasteredObjectives.length} TP
                </span>
              </div>

              <div className="p-5 flex-1 space-y-4">
                {studentAnalysis.unmasteredObjectives.length === 0 ? (
                  <div className="py-8 text-center text-emerald-600 text-xs font-bold">
                    🎉 Selamat! {currentStudent.studentName} telah menguasai seluruh Tujuan Pembelajaran yang diuji.
                  </div>
                ) : (
                  studentAnalysis.unmasteredObjectives.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-rose-100 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">
                            {item.objective}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-600 text-white shrink-0">
                          {item.percentage}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        <span>Menjawab benar: <strong>{item.correctCount}</strong> dari {item.totalCount} butir</span>
                        {item.missedQuestionOrders.length > 0 && (
                          <span className="text-rose-600 font-semibold">
                            Butir yang Salah: No. {item.missedQuestionOrders.join(', ')}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-rose-800 dark:text-rose-300 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg">
                        📝 <strong>Program Remedial:</strong> Siswa disarankan mempelajari kembali ringkasan materi dan mengerjakan latihan terarah pada butir soal No. {item.missedQuestionOrders.join(', ') || '-'}.
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
