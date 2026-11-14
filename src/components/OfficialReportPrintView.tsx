import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  Sliders,
  Award,
  ShieldAlert,
  Check,
  BookOpen,
  Users,
  GraduationCap,
  Filter
} from 'lucide-react';
import { Exam, Submission, SchoolProfile, Student } from '../types';
import { StorageService } from '../services/storage';
import { AnalysisService } from '../services/analysisService';
import {
  exportGradeRecapToDocx,
  exportStudentReportToDocx,
  exportClassicalAllSubjectsToDocx,
  StudentRaporSubjectRow
} from '../services/exportDocxService';
import {
  exportGradeRecapToExcel,
  exportStudentReportToExcel,
  exportClassicalAllSubjectsToExcel
} from '../services/exportExcelService';
import { PrintSetupModal } from './PrintSetupModal';
import { sanitizeLogoUrl, PEMKOT_MALANG_LOGO_SVG, SDN_PISANGCANDI_1_LOGO_SVG } from '../services/logoAssets';

interface OfficialReportPrintViewProps {
  profile: SchoolProfile;
  exams: Exam[];
  submissions: Submission[];
  students: Student[];
  initialExamId?: string;
  initialReportMode?: 'klasikal' | 'individu';
  initialStudentNis?: string;
  onBack: () => void;
  onAllowRetake?: (submissionId: string) => void;
}

export const OfficialReportPrintView: React.FC<OfficialReportPrintViewProps> = ({
  profile,
  exams,
  submissions,
  students,
  initialExamId,
  initialReportMode = 'individu',
  initialStudentNis,
  onBack
}) => {
  // Mode selection: Individu (Rapor Siswa) vs Klasikal (Rekap Kelas)
  const [reportMode, setReportMode] = useState<'klasikal' | 'individu'>(initialReportMode);

  useEffect(() => {
    setReportMode(initialReportMode);
  }, [initialReportMode]);

  // Clean non-retake-placeholder submissions
  const validAllSubmissions = useMemo(() => {
    return (submissions || []).filter(s => {
      const note = String(s.statusNote || '').toLowerCase();
      return !(s.allowRepeat === true || note.includes('mengulang'));
    });
  }, [submissions]);

  // Distinct classes from student roster & submissions & exams
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const c = String(s.classGrade || '').trim();
      if (c) set.add(c);
    });
    validAllSubmissions.forEach(s => {
      const c = String(s.classGrade || '').trim();
      if (c) set.add(c);
    });
    exams.forEach(e => {
      const g = String(e.grade || '').trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [students, validAllSubmissions, exams]);

  // Distinct subjects (Bidang Studi)
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    exams.forEach(e => {
      const subj = String(e.subject || '').trim();
      if (subj) set.add(subj);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [exams]);

  // Cascading Filter States
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || 'all');
  const [includeUnsubmittedInRapor, setIncludeUnsubmittedInRapor] = useState<boolean>(true);

  useEffect(() => {
    if (initialExamId) {
      setSelectedExamId(initialExamId);
      const foundEx = exams.find(e => e.id === initialExamId);
      if (foundEx?.subject) setSelectedSubject(foundEx.subject);
    }
  }, [initialExamId, exams]);

  // Unified Student Directory filtered by selectedClass
  const allStudentsMerged = useMemo(() => {
    const map = new Map<string, { nis: string; nisn?: string; name: string; classGrade: string; completedCount: number }>();

    students.forEach(st => {
      const nis = String(st.studentNo || '').trim();
      if (!nis) return;
      map.set(nis.toLowerCase(), {
        nis,
        nisn: st.nisn,
        name: st.fullName,
        classGrade: String(st.classGrade || '').trim() || 'Umum',
        completedCount: 0
      });
    });

    validAllSubmissions.forEach(sub => {
      const nis = String(sub.studentNo || '').trim();
      if (!nis) return;
      const key = nis.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.completedCount += 1;
        if (!existing.classGrade && sub.classGrade) existing.classGrade = sub.classGrade;
      } else {
        map.set(key, {
          nis,
          name: sub.studentName || nis,
          classGrade: String(sub.classGrade || '').trim() || 'Umum',
          completedCount: 1
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [students, validAllSubmissions]);

  const filteredStudents = useMemo(() => {
    if (selectedClass === 'all') return allStudentsMerged;
    const targetCls = selectedClass.trim().toLowerCase();
    return allStudentsMerged.filter(st => {
      const c = st.classGrade.trim().toLowerCase();
      return c === targetCls || c.startsWith(targetCls) || targetCls.startsWith(c);
    });
  }, [allStudentsMerged, selectedClass]);

  const [selectedStudentNis, setSelectedStudentNis] = useState<string>(() => {
    if (initialStudentNis) return initialStudentNis;
    const firstWithSub = allStudentsMerged.find(s => s.completedCount > 0);
    return firstWithSub?.nis || allStudentsMerged[0]?.nis || '';
  });

  useEffect(() => {
    if (initialStudentNis) {
      setSelectedStudentNis(initialStudentNis);
    }
  }, [initialStudentNis]);

  // Auto-keep selectedStudentNis valid when selectedClass changes
  useEffect(() => {
    if (filteredStudents.length === 0) return;
    const stillExists = filteredStudents.some(
      s => s.nis.toLowerCase() === selectedStudentNis.trim().toLowerCase()
    );
    if (!stillExists) {
      const preferred = filteredStudents.find(s => s.completedCount > 0) || filteredStudents[0];
      setSelectedStudentNis(preferred.nis);
    }
  }, [filteredStudents, selectedStudentNis]);

  // Reset selectedExamId to 'all' if chosen subject doesn't match the specific exam
  const examsMatchingSubject = useMemo(() => {
    if (selectedSubject === 'all') return exams;
    return exams.filter(e => String(e.subject || '').trim().toLowerCase() === selectedSubject.trim().toLowerCase());
  }, [exams, selectedSubject]);

  useEffect(() => {
    if (selectedExamId !== 'all') {
      const stillMatches = examsMatchingSubject.some(e => e.id === selectedExamId);
      if (!stillMatches) {
        setSelectedExamId('all');
      }
    }
  }, [examsMatchingSubject, selectedExamId]);

  // Display customization & Teacher Note
  const [fontSizeMode, setFontSizeMode] = useState<'sm' | 'base'>('base');
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showTpSection, setShowTpSection] = useState<boolean>(true);
  const [customTeacherNote, setCustomTeacherNote] = useState<string>('');
  const [isPrintSetupOpen, setIsPrintSetupOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Predicate Helper
  const getPredicate = (percentage: number, kkm: number) => {
    if (percentage >= 90) return { label: 'A (Sangat Baik)', code: 'A', bg: 'bg-emerald-50 text-emerald-700' };
    if (percentage >= kkm) return { label: 'B (Baik)', code: 'B', bg: 'bg-blue-50 text-blue-700' };
    if (percentage >= kkm - 15) return { label: 'C (Cukup)', code: 'C', bg: 'bg-amber-50 text-amber-700' };
    return { label: 'D (Perlu Bimbingan)', code: 'D', bg: 'bg-rose-50 text-rose-700' };
  };

  // Current selected student object
  const currentStudent = useMemo(() => {
    return (
      allStudentsMerged.find(s => s.nis.toLowerCase() === selectedStudentNis.trim().toLowerCase()) ||
      filteredStudents[0] ||
      null
    );
  }, [allStudentsMerged, filteredStudents, selectedStudentNis]);

  // Helper: grade compatibility between student class & exam grade
  const isGradeCompatible = (studentClass: string, examGrade: string) => {
    const sc = String(studentClass || '').trim().toLowerCase();
    const eg = String(examGrade || '').trim().toLowerCase();
    if (!sc || !eg || eg === 'umum' || eg.includes('semua')) return true;
    if (sc === eg || sc.startsWith(eg) || eg.startsWith(sc)) return true;
    const scNum = sc.match(/\d+/)?.[0];
    const egNum = eg.match(/\d+/)?.[0];
    if (scNum && egNum && scNum === egNum) return true;
    return false;
  };

  // Build Rapor rows for currentStudent (Individu Mode) across chosen Bidang Studi (1 or All)
  const studentRaporRows = useMemo<StudentRaporSubjectRow[]>(() => {
    if (!currentStudent) return [];

    const studentNisLow = currentStudent.nis.trim().toLowerCase();
    const studentNameLow = currentStudent.name.trim().toLowerCase();

    const studentSubs = (submissions || []).filter(s => {
      const sNo = String(s.studentNo || '').trim().toLowerCase();
      const sName = String(s.studentName || '').trim().toLowerCase();
      return (studentNisLow && sNo === studentNisLow) || (studentNameLow && sName === studentNameLow);
    });

    // Latest submission per examId (prioritizing completed over reset placeholder)
    const subByExamId = new Map<string, Submission>();
    studentSubs.forEach(s => {
      const key = String(s.examId || '').trim().toLowerCase();
      const prev = subByExamId.get(key);
      const sIsRepeat = s.allowRepeat === true || String(s.statusNote || '').toLowerCase().includes('mengulang');
      if (!prev) {
        subByExamId.set(key, s);
      } else {
        const prevIsRepeat = prev.allowRepeat === true || String(prev.statusNote || '').toLowerCase().includes('mengulang');
        if (prevIsRepeat && !sIsRepeat) {
          subByExamId.set(key, s);
        } else if (prevIsRepeat === sIsRepeat && new Date(s.submittedAt).getTime() > new Date(prev.submittedAt).getTime()) {
          subByExamId.set(key, s);
        }
      }
    });

    // Determine exams to include
    const candidateExams = examsMatchingSubject.filter(ex => {
      if (selectedExamId !== 'all' && ex.id !== selectedExamId) return false;
      const exKey = String(ex.id || '').trim().toLowerCase();
      const hasSub = subByExamId.has(exKey);
      if (hasSub) return true;
      if (!includeUnsubmittedInRapor) return false;
      if (ex.status === 'archived' || ex.status === 'draft') return false;
      return isGradeCompatible(currentStudent.classGrade, ex.grade);
    });

    return candidateExams.map(ex => {
      const exKey = String(ex.id || '').trim().toLowerCase();
      const sub = subByExamId.get(exKey);
      const kkm = Number(ex.passingScore) || 75;
      const isRepeat = Boolean(
        sub && (sub.allowRepeat === true || String(sub.statusNote || '').toLowerCase().includes('mengulang'))
      );
      const hasSubmitted = Boolean(sub);
      const pct = sub && !isRepeat ? Number(sub.percentage) || 0 : 0;
      const passed = Boolean(sub && !isRepeat && pct >= kkm);
      const pred = getPredicate(pct, kkm);

      const statusText = !sub
        ? 'Belum Mengerjakan'
        : isRepeat
          ? 'Mengulang Ujian'
          : passed
            ? 'Tuntas'
            : 'Remedial';

      // Calculate TP mastery from questions + student answers
      const questions = StorageService.getQuestionsByExamId(ex.id);
      const tpStatsMap = new Map<string, { total: number; correct: number }>();

      if (sub && !isRepeat && questions.length > 0) {
        questions.forEach(q => {
          const tpLabel = String(q.learningObjective || '').trim();
          if (!tpLabel) return;
          const entry = tpStatsMap.get(tpLabel) || { total: 0, correct: 0 };
          entry.total += 1;
          const ans = sub.answers ? sub.answers[q.id] : undefined;
          if (AnalysisService.isAnswerCorrect(q, ans)) {
            entry.correct += 1;
          }
          tpStatsMap.set(tpLabel, entry);
        });
      }

      let tpDetails: Array<{ objective: string; masteryRate: number; status: string }> = [];
      if (tpStatsMap.size > 0) {
        tpDetails = Array.from(tpStatsMap.entries()).map(([objective, stat]) => {
          const masteryRate = Math.round((stat.correct / stat.total) * 100);
          return {
            objective,
            masteryRate,
            status: masteryRate >= kkm ? 'Tercapai' : 'Perlu Bimbingan'
          };
        });
      } else if (Array.isArray(ex.learningObjectives) && ex.learningObjectives.length > 0 && sub && !isRepeat) {
        tpDetails = ex.learningObjectives.map(tp => ({
          objective: tp,
          masteryRate: pct,
          status: passed ? 'Tercapai' : 'Perlu Bimbingan'
        }));
      }

      return {
        examId: ex.id,
        subject: ex.subject,
        examTitle: ex.title,
        grade: ex.grade,
        passingScore: kkm,
        score: sub && !isRepeat ? Number(sub.score) || 0 : 0,
        maxScore: sub && !isRepeat ? Number(sub.maxScore) || 100 : 100,
        percentage: pct,
        passed,
        predicate: hasSubmitted && !isRepeat ? pred.label : '-',
        statusText,
        hasSubmitted,
        submittedAt: sub?.submittedAt,
        timeSpentSeconds: sub?.timeSpentSeconds,
        tabSwitchCount: sub?.tabSwitchCount,
        tpDetails
      };
    });
  }, [currentStudent, submissions, examsMatchingSubject, selectedExamId, includeUnsubmittedInRapor]);

  // Rapor summary metrics (Individu)
  const raporSummary = useMemo(() => {
    const completed = studentRaporRows.filter(r => r.hasSubmitted && r.statusText !== 'Mengulang Ujian');
    const avg = completed.length > 0
      ? Math.round(completed.reduce((acc, r) => acc + r.percentage, 0) / completed.length)
      : 0;
    const passedCount = completed.filter(r => r.passed).length;
    const remedialCount = completed.length - passedCount;
    const tabSwitches = completed.reduce((acc, r) => acc + (r.tabSwitchCount || 0), 0);
    const pred = getPredicate(avg, 75);

    return {
      totalRows: studentRaporRows.length,
      completedCount: completed.length,
      passedCount,
      remedialCount,
      average: avg,
      predicate: completed.length > 0 ? pred.label : '-',
      tabSwitches
    };
  }, [studentRaporRows]);

  // -----------------------------------------------------------------------
  // KLASIKAL MODE DATA (Supports Single Exam/Subject OR All Subjects Leger)
  // -----------------------------------------------------------------------
  const currentSingleExam = useMemo(() => {
    if (selectedExamId !== 'all') {
      return exams.find(e => e.id === selectedExamId) || null;
    }
    if (examsMatchingSubject.length === 1) {
      return examsMatchingSubject[0];
    }
    return null;
  }, [exams, examsMatchingSubject, selectedExamId]);

  const klasikalSubjects = useMemo(() => {
    if (currentSingleExam) return [currentSingleExam.subject];
    if (selectedSubject !== 'all') return [selectedSubject];
    return availableSubjects;
  }, [currentSingleExam, selectedSubject, availableSubjects]);

  // Build scoreMatrix[nisLower][subject] = { percentage, passed, statusText }
  const klasikalScoreMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, { percentage: number; passed: boolean; statusText: string }>> = {};

    filteredStudents.forEach(st => {
      const nisKey = st.nis.toLowerCase();
      matrix[nisKey] = {};
      const stNameLow = st.name.toLowerCase();

      klasikalSubjects.forEach(subj => {
        const matchingSubjExams = exams.filter(
          e => String(e.subject || '').trim().toLowerCase() === subj.trim().toLowerCase() &&
               (selectedExamId === 'all' || e.id === selectedExamId)
        );
        const examIds = new Set(matchingSubjExams.map(e => e.id.toLowerCase()));

        const relevantSubs = validAllSubmissions.filter(s => {
          const sExam = String(s.examId || '').trim().toLowerCase();
          if (!examIds.has(sExam)) return false;
          const sNo = String(s.studentNo || '').trim().toLowerCase();
          const sName = String(s.studentName || '').trim().toLowerCase();
          return (nisKey && sNo === nisKey) || (stNameLow && sName === stNameLow);
        });

        if (relevantSubs.length > 0) {
          const avgPct = Math.round(
            relevantSubs.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0) / relevantSubs.length
          );
          const kkm = matchingSubjExams[0]?.passingScore || 75;
          const passed = avgPct >= kkm;
          matrix[nisKey][subj] = {
            percentage: avgPct,
            passed,
            statusText: passed ? 'Tuntas' : 'Remedial'
          };
        } else {
          matrix[nisKey][subj] = {
            percentage: 0,
            passed: false,
            statusText: 'Belum Mengerjakan'
          };
        }
      });
    });

    return matrix;
  }, [filteredStudents, klasikalSubjects, exams, selectedExamId, validAllSubmissions]);

  const singleExamSubmissions = useMemo(() => {
    if (!currentSingleExam) return [];
    const targetId = String(currentSingleExam.id).trim().toLowerCase();
    return (submissions || []).filter(s => {
      if (String(s.examId || '').trim().toLowerCase() !== targetId) return false;
      if (selectedClass === 'all') return true;
      return isGradeCompatible(selectedClass, s.classGrade || '');
    });
  }, [submissions, currentSingleExam, selectedClass]);

  const singleExamStats = useMemo(() => {
    const valid = singleExamSubmissions.filter(s => s.statusNote !== 'Mengulang Ujian');
    const total = valid.length;
    if (total === 0) {
      return { total: 0, average: 0, passedCount: 0, remedialCount: 0, passPercentage: 0, highest: 0, lowest: 0, tabSwitchCount: 0 };
    }
    const scores = valid.map(s => Number(s.percentage) || 0);
    const kkm = currentSingleExam?.passingScore || 75;
    const passed = valid.filter(s => (Number(s.percentage) || 0) >= kkm).length;
    return {
      total,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / total),
      passedCount: passed,
      remedialCount: total - passed,
      passPercentage: Math.round((passed / total) * 100),
      highest: Math.max(...scores),
      lowest: Math.min(...scores),
      tabSwitchCount: valid.reduce((acc, s) => acc + (s.tabSwitchCount || 0), 0)
    };
  }, [singleExamSubmissions, currentSingleExam]);

  const subjectFilterLabel = selectedSubject === 'all' ? 'Semua Bidang Studi' : selectedSubject;
  const classFilterLabel = selectedClass === 'all'
    ? (currentStudent?.classGrade || 'Semua Kelas')
    : selectedClass;

  // Export Handlers
  const handleExportWord = async () => {
    setIsExporting(true);
    try {
      if (reportMode === 'individu') {
        if (!currentStudent) return;
        await exportStudentReportToDocx(currentStudent, studentRaporRows, profile, {
          subjectFilterLabel,
          classFilterLabel,
          teacherNote: customTeacherNote.trim() || undefined
        });
      } else if (currentSingleExam) {
        await exportGradeRecapToDocx(
          currentSingleExam,
          singleExamSubmissions,
          profile,
          selectedClass === 'all' ? currentSingleExam.grade : selectedClass
        );
      } else {
        await exportClassicalAllSubjectsToDocx(
          filteredStudents,
          klasikalSubjects,
          klasikalScoreMatrix,
          profile,
          { classFilterLabel: selectedClass === 'all' ? 'Semua Kelas' : selectedClass, subjectFilterLabel }
        );
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (reportMode === 'individu') {
      if (!currentStudent) return;
      exportStudentReportToExcel(currentStudent, studentRaporRows, profile, {
        subjectFilterLabel,
        classFilterLabel,
        teacherNote: customTeacherNote.trim() || undefined
      });
    } else if (currentSingleExam) {
      exportGradeRecapToExcel(
        currentSingleExam,
        singleExamSubmissions,
        profile,
        selectedClass === 'all' ? currentSingleExam.grade : selectedClass
      );
    } else {
      exportClassicalAllSubjectsToExcel(
        filteredStudents,
        klasikalSubjects,
        klasikalScoreMatrix,
        profile,
        { classFilterLabel: selectedClass === 'all' ? 'Semua Kelas' : selectedClass, subjectFilterLabel }
      );
    }
  };

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const defaultEvaluationNote = raporSummary.completedCount === 0
    ? 'Peserta didik belum memiliki rekaman hasil asesmen yang selesai pada cakupan bidang studi ini.'
    : raporSummary.passedCount === raporSummary.completedCount
      ? `Selamat! ${currentStudent?.name || 'Siswa'} telah menuntaskan seluruh bidang studi yang diujikan (${raporSummary.passedCount} tuntas, rata-rata ${raporSummary.average}). Terus pertahankan prestasi dan tingkatkan pemahaman melalui pengayaan.`
      : `${currentStudent?.name || 'Siswa'} telah menyelesaikan ${raporSummary.completedCount} asesmen dengan ${raporSummary.passedCount} tuntas KKM. Bidang studi yang masih Remedial diharapkan mengikuti pembinaan ulang bersama guru pengampu.`;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 pb-20">
      {/* -----------------------------------------------------------------
          TOP CONTROL BAR (Hidden during @media print)
         ----------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kembali ke Portal Guru"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Rapor & Rekap Hasil Ujian Resmi
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  Cetak · .docx · .xlsx
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih kelas, siswa, dan bidang studi (atau semua bidang studi), lalu cetak atau ekspor ke Word / Excel.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Report Mode Selector */}
            <div className="flex items-center rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setReportMode('individu')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  reportMode === 'individu'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Rapor Siswa</span>
              </button>
              <button
                type="button"
                onClick={() => setReportMode('klasikal')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  reportMode === 'klasikal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Rekap Klasikal</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsPrintSetupOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Atur margin, ukuran kertas F4/A4, dan properti printer"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Setup Cetak</span>
            </button>

            <button
              type="button"
              onClick={handleExportWord}
              disabled={isExporting || (reportMode === 'individu' && !currentStudent)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Simpan Rapor / Rekap dalam format Microsoft Word (.docx)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Memproses...' : 'Export .docx'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={reportMode === 'individu' && !currentStudent}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Simpan Rapor / Rekap dalam format Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export .xlsx</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintSetupOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Rapor</span>
            </button>
          </div>
        </div>

        {/* Second row: Cascading Filter Bar (Kelas -> Siswa -> Bidang Studi -> Paket Ujian) */}
        <div className="max-w-7xl mx-auto px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 text-slate-500 font-semibold">
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              <span>Filter Rapor:</span>
            </div>

            {/* 1. Pilih Kelas */}
            <div className="flex items-center gap-1.5">
              <label className="font-semibold text-slate-600 dark:text-slate-400">Kelas:</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
              >
                <option value="all">Semua Kelas ({allStudentsMerged.length} Siswa)</option>
                {availableClasses.map(cls => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Pilih Siswa (for Individu Rapor mode) */}
            {reportMode === 'individu' && (
              <div id="containerPilihSiswa" className="flex items-center gap-1.5">
                <label className="font-bold text-indigo-600 dark:text-indigo-400">Siswa:</label>
                <select
                  id="selectSiswa"
                  value={currentStudent?.nis || selectedStudentNis}
                  onChange={(e) => setSelectedStudentNis(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-indigo-400 bg-indigo-50/70 dark:bg-slate-900 text-slate-900 dark:text-white font-bold max-w-[260px]"
                >
                  {filteredStudents.length === 0 ? (
                    <option value="">-- Tidak ada siswa di kelas ini --</option>
                  ) : (
                    filteredStudents.map(st => (
                      <option key={st.nis} value={st.nis}>
                        {st.nis} - {st.name} ({st.classGrade}) · {st.completedCount} Ujian
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* 3. Pilih Bidang Studi (Semua atau Spesifik) */}
            <div className="flex items-center gap-1.5">
              <label className="font-semibold text-slate-600 dark:text-slate-400">Bidang Studi:</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-400 dark:border-emerald-700 bg-emerald-50/60 dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
              >
                <option value="all">Semua Bidang Studi ({availableSubjects.length} Mapel)</option>
                {availableSubjects.map(subj => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Filter Paket Ujian Opsional */}
            {examsMatchingSubject.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="font-semibold text-slate-600 dark:text-slate-400">Paket:</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium max-w-[240px]"
                >
                  <option value="all">Semua Paket Ujian ({examsMatchingSubject.length})</option>
                  {examsMatchingSubject.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.subject} - {e.title} ({e.grade})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            {reportMode === 'individu' && (
              <>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUnsubmittedInRapor}
                    onChange={(e) => setIncludeUnsubmittedInRapor(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Sertakan Mapel Belum Dikerjakan</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTpSection}
                    onChange={(e) => setShowTpSection(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Rincian TP</span>
                </label>
              </>
            )}

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span>Tanda Tangan</span>
            </label>

            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-3">
              <button
                type="button"
                onClick={() => setFontSizeMode('sm')}
                className={`px-2 py-0.5 rounded cursor-pointer ${fontSizeMode === 'sm' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-200 dark:bg-slate-800'}`}
              >
                Padat
              </button>
              <button
                type="button"
                onClick={() => setFontSizeMode('base')}
                className={`px-2 py-0.5 rounded cursor-pointer ${fontSizeMode === 'base' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-200 dark:bg-slate-800'}`}
              >
                Normal
              </button>
            </div>
          </div>
        </div>

        {/* Optional Custom Teacher Note bar for Individu Rapor */}
        {reportMode === 'individu' && (
          <div className="max-w-7xl mx-auto px-4 py-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400 shrink-0">
              Catatan Guru (Opsional):
            </span>
            <input
              type="text"
              value={customTeacherNote}
              onChange={(e) => setCustomTeacherNote(e.target.value)}
              placeholder="Kosongkan untuk memakai catatan evaluasi otomatis, atau ketik catatan wali kelas khusus untuk rapor ini..."
              className="flex-1 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
            />
          </div>
        )}
      </header>

      {/* -----------------------------------------------------------------
          A4 PAPER CONTAINER FOR REAL PRINTING
         ----------------------------------------------------------------- */}
      <main className={`print-area max-w-[210mm] mx-auto mt-6 bg-white text-black shadow-lg border border-slate-200 p-8 sm:p-10 print:m-0 print:p-0 print:border-none print:shadow-none print:w-full print:max-w-none ${fontSizeMode === 'sm' ? 'text-[11px]' : 'text-xs'}`}>

        {/* ==============================================================
            KOP SURAT RESMI SEKOLAH STANDAR TATA NASKAH DINAS
           ============================================================== */}
        <div className="kop-surat relative border-b-2 border-black pb-3 mb-5 print-break-inside-avoid">
          <div className="flex items-center justify-between gap-4">
            <div className="w-20 h-20 flex items-center justify-center shrink-0">
              <img
                src={sanitizeLogoUrl(profile.regionalGovLogoUrl, PEMKOT_MALANG_LOGO_SVG)}
                alt="Logo Pemda Kiri"
                referrerPolicy="no-referrer"
                className="w-20 h-20 object-contain shrink-0"
              />
            </div>

            <div className="flex-1 text-center font-serif leading-tight">
              <h4 className="text-xs uppercase tracking-widest font-bold text-black">
                {profile.regionalGovName || 'PEMERINTAH KOTA MALANG'}
              </h4>
              <h4 className="text-xs uppercase tracking-wider font-bold text-black mt-0.5">
                {profile.regionalGovDepartment || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}
              </h4>
              <h2 className="text-base sm:text-lg uppercase font-extrabold tracking-wide text-black mt-1">
                {profile.name || 'SD NEGERI PISANGCANDI 1 MALANG'}
              </h2>
              <p className="text-[11px] text-black mt-0.5 font-sans">
                {profile.address || 'Jl. Raya Pisang Candi No. 1, Kec. Sukun, Kota Malang, Jawa Timur 65146'}
              </p>
              <p className="text-[10px] text-black font-mono mt-0.5">
                NPSN: {profile.npsn || '20533857'} · Tahun Ajaran: {profile.academicYear || '2026/2027'} · Semester: {profile.semester || 'Ganjil'}
              </p>
            </div>

            <div className="w-20 h-20 flex items-center justify-center shrink-0">
              <img
                src={sanitizeLogoUrl(profile.logoUrl, SDN_PISANGCANDI_1_LOGO_SVG)}
                alt="Logo Sekolah Kanan"
                referrerPolicy="no-referrer"
                className="w-20 h-20 object-contain shrink-0"
              />
            </div>
          </div>
          <div className="border-b-4 border-black mt-1.5"></div>
        </div>

        {/* ==============================================================
            OPSI A: RAPOR HASIL BELAJAR INDIVIDU (PER SISWA · 1 / SEMUA BIDANG STUDI)
           ============================================================== */}
        {reportMode === 'individu' && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-base sm:text-lg font-bold uppercase tracking-wider underline font-serif">
                RAPOR HASIL EVALUASI ASESMEN PESERTA DIDIK
              </h1>
              <p className="text-xs text-slate-700">
                Tahun Ajaran {profile.academicYear || '2026/2027'} — Semester {profile.semester || 'Ganjil'}
              </p>
            </div>

            {/* Identitas Siswa */}
            <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600 shrink-0">Nama Peserta Didik</span>
                  <span className="font-bold text-slate-900">: {currentStudent?.name || 'Belum Dipilih'}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600 shrink-0">Kelas / Rombel</span>
                  <span className="font-bold">: {currentStudent?.classGrade || classFilterLabel}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600 shrink-0">Nomor Induk (NIS)</span>
                  <span className="font-mono font-bold">: {currentStudent?.nis || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600 shrink-0">Cakupan Bidang Studi</span>
                  <span className="font-bold text-indigo-800">: {subjectFilterLabel}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600 shrink-0">NISN</span>
                  <span className="font-mono">: {currentStudent?.nisn || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-36 font-semibold text-slate-600 shrink-0">Guru Kelas / Pengampu</span>
                  <span>: {profile.teacherName || 'Siti Rahmawati, S.Pd.'}</span>
                </div>
              </div>
            </div>

            {/* Ringkasan KPI Rapor */}
            <div className="grid grid-cols-4 gap-2.5 text-center print-break-inside-avoid">
              <div className="border border-slate-300 rounded-lg p-2.5 bg-white">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Rata-Rata Nilai</span>
                <div className="text-2xl font-extrabold font-mono text-indigo-700 mt-0.5">
                  {raporSummary.completedCount > 0 ? raporSummary.average : '-'}
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg p-2.5 bg-white">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Ujian Selesai</span>
                <div className="text-2xl font-extrabold font-mono text-slate-800 mt-0.5">
                  {raporSummary.completedCount}
                  <span className="text-xs font-normal text-slate-400">/{raporSummary.totalRows}</span>
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg p-2.5 bg-white">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Ketuntasan KKM</span>
                <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-0.5">
                  {raporSummary.passedCount}
                  <span className="text-xs font-normal text-slate-500"> Tuntas</span>
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg p-2.5 bg-white">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Predikat Umum</span>
                <div className="text-sm font-extrabold text-slate-800 mt-1.5">
                  {raporSummary.predicate}
                </div>
              </div>
            </div>

            {/* Tabel Nilai Per Bidang Studi */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>A. Daftar Perolehan Nilai Hasil Asesmen ({subjectFilterLabel})</span>
              </h3>

              <table className="w-full border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="border border-slate-300 p-2 w-9 text-center">No</th>
                    <th className="border border-slate-300 p-2 text-left">Bidang Studi</th>
                    <th className="border border-slate-300 p-2 text-left">Paket / Judul Ujian</th>
                    <th className="border border-slate-300 p-2 w-14 text-center">KKM</th>
                    <th className="border border-slate-300 p-2 w-16 text-center">Skor</th>
                    <th className="border border-slate-300 p-2 w-16 text-center">Nilai</th>
                    <th className="border border-slate-300 p-2 w-28 text-center">Predikat</th>
                    <th className="border border-slate-300 p-2 w-24 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRaporRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-slate-300 p-5 text-center text-slate-400 italic">
                        Belum ada data ujian untuk siswa dan filter bidang studi ini.
                      </td>
                    </tr>
                  ) : (
                    studentRaporRows.map((row, idx) => {
                      const isVal = row.hasSubmitted && row.statusText !== 'Mengulang Ujian';
                      return (
                        <tr key={row.examId} className="border-b border-slate-200">
                          <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                          <td className="border border-slate-300 p-2 font-bold text-slate-900">{row.subject}</td>
                          <td className="border border-slate-300 p-2">
                            <div>{row.examTitle}</div>
                            {row.submittedAt && isVal && (
                              <div className="text-[10px] text-slate-500">
                                Dikerjakan: {new Date(row.submittedAt).toLocaleDateString('id-ID')}
                              </div>
                            )}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-mono">{row.passingScore}</td>
                          <td className="border border-slate-300 p-2 text-center font-mono text-[11px]">
                            {isVal ? `${row.score}/${row.maxScore}` : '-'}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-mono font-bold text-sm">
                            {isVal ? `${row.percentage}` : '-'}
                          </td>
                          <td className="border border-slate-300 p-2 text-center text-[11px] font-semibold">
                            {isVal ? row.predicate : '-'}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-bold">
                            {row.statusText === 'Tuntas' ? (
                              <span className="text-emerald-700">Tuntas</span>
                            ) : row.statusText === 'Remedial' ? (
                              <span className="text-rose-700">Remedial</span>
                            ) : (
                              <span className="text-amber-700 text-[10px]">{row.statusText}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {studentRaporRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={5} className="border border-slate-300 p-2 text-right uppercase">
                        Rata-Rata Keseluruhan ({raporSummary.completedCount} Ujian Selesai)
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-mono text-sm text-indigo-800">
                        {raporSummary.completedCount > 0 ? raporSummary.average : '-'}
                      </td>
                      <td className="border border-slate-300 p-2 text-center text-[11px]">
                        {raporSummary.predicate}
                      </td>
                      <td className="border border-slate-300 p-2 text-center text-[11px]">
                        {raporSummary.completedCount > 0
                          ? `${raporSummary.passedCount}/${raporSummary.completedCount} Tuntas`
                          : '-'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Tabel Capaian Tujuan Pembelajaran (TP) */}
            {showTpSection && studentRaporRows.some(r => r.tpDetails.length > 0) && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                  <span>B. Ketercapaian Tujuan Pembelajaran (TP) Kurikulum Merdeka</span>
                </h3>
                <table className="w-full border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="border border-slate-300 p-2 w-9 text-center">No</th>
                      <th className="border border-slate-300 p-2 w-36 text-left">Bidang Studi</th>
                      <th className="border border-slate-300 p-2 text-left">Deskripsi Tujuan Pembelajaran (TP)</th>
                      <th className="border border-slate-300 p-2 w-20 text-center">Capaian</th>
                      <th className="border border-slate-300 p-2 w-28 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentRaporRows.flatMap((row) =>
                      row.tpDetails.map((tp, tIdx) => ({
                        key: `${row.examId}-tp-${tIdx}`,
                        subject: row.subject,
                        ...tp
                      }))
                    ).map((item, idx) => (
                      <tr key={item.key} className="border-b border-slate-200">
                        <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-semibold">{item.subject}</td>
                        <td className="border border-slate-300 p-2 leading-relaxed">{item.objective}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                          {item.masteryRate}%
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-bold">
                          <span className={item.status === 'Tercapai' ? 'text-emerald-700' : 'text-rose-700'}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Catatan Integritas & Evaluasi Guru */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print-break-inside-avoid">
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50 space-y-1">
                <span className="font-bold text-slate-800 block uppercase tracking-wide flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Integritas Pengerjaan Ujian</span>
                </span>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  {raporSummary.tabSwitches > 0
                    ? `Catatan pengawas: Tercatat ${raporSummary.tabSwitches} kali perpindahan jendela/tab browser selama seluruh ujian berlangsung.`
                    : 'Disiplin dan tertib. Tidak tercatat adanya pelanggaran perpindahan jendela/tab browser selama ujian.'}
                </p>
              </div>

              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50 space-y-1">
                <span className="font-bold text-slate-800 block uppercase tracking-wide">
                  Catatan Evaluasi & Rekomendasi Guru:
                </span>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  {customTeacherNote.trim() || defaultEvaluationNote}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            OPSI B: LAPORAN REKAPITULASI KLASIKAL (REKAP KELAS)
           ============================================================== */}
        {reportMode === 'klasikal' && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-base sm:text-lg font-bold uppercase tracking-wider underline font-serif">
                {currentSingleExam
                  ? 'LAPORAN REKAPITULASI HASIL ASESMEN KLASIKAL'
                  : 'LEGER NILAI HASIL ASESMEN PESERTA DIDIK'}
              </h1>
              <p className="text-xs text-slate-700">
                Tahun Ajaran {profile.academicYear || '2026/2027'} — Semester {profile.semester || 'Ganjil'} · Kelas: <strong>{selectedClass === 'all' ? 'Semua Kelas' : selectedClass}</strong> · Bidang Studi: <strong>{subjectFilterLabel}</strong>
              </p>
            </div>

            {currentSingleExam ? (
              <>
                {/* Identitas 1 Paket Ujian */}
                <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 rounded-lg p-3 bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-32 font-semibold text-slate-600">Bidang Studi</span>
                      <span className="font-bold">: {currentSingleExam.subject}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold text-slate-600">Judul Asesmen</span>
                      <span className="font-bold">: {currentSingleExam.title}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold text-slate-600">Kelas Filter</span>
                      <span>: {selectedClass === 'all' ? currentSingleExam.grade : selectedClass}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-32 font-semibold text-slate-600">Batas KKM</span>
                      <span className="font-bold">: {currentSingleExam.passingScore || 75}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold text-slate-600">Rata-Rata Kelas</span>
                      <span className="font-bold">: {singleExamStats.average}% ({singleExamStats.passPercentage}% Tuntas)</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold text-slate-600">Guru Pengampu</span>
                      <span>: {profile.teacherName || 'Siti Rahmawati, S.Pd.'}</span>
                    </div>
                  </div>
                </div>

                {/* Tabel Rekap 1 Paket */}
                <table className="w-full border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="border border-slate-300 p-2 w-10 text-center">No</th>
                      <th className="border border-slate-300 p-2 w-20 text-center font-mono">NIS</th>
                      <th className="border border-slate-300 p-2 text-left">Nama Lengkap Siswa</th>
                      <th className="border border-slate-300 p-2 w-24 text-center">Kelas</th>
                      <th className="border border-slate-300 p-2 w-16 text-center font-mono">Nilai</th>
                      <th className="border border-slate-300 p-2 w-24 text-center">Status</th>
                      <th className="border border-slate-300 p-2 w-20 text-center">Pindah Tab</th>
                    </tr>
                  </thead>
                  <tbody>
                    {singleExamSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="border border-slate-300 p-6 text-center text-slate-400">
                          Belum ada rekaman nilai untuk pilihan kelas dan ujian ini.
                        </td>
                      </tr>
                    ) : (
                      singleExamSubmissions.map((sub, idx) => {
                        const isMengulang = sub.statusNote === 'Mengulang Ujian';
                        return (
                          <tr key={sub.id || idx} className="border-b border-slate-200">
                            <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                            <td className="border border-slate-300 p-2 text-center font-mono">{sub.studentNo}</td>
                            <td className="border border-slate-300 p-2 font-medium">{sub.studentName}</td>
                            <td className="border border-slate-300 p-2 text-center">{sub.classGrade || currentSingleExam.grade}</td>
                            <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                              {isMengulang ? '-' : `${Number(sub.percentage) || 0}%`}
                            </td>
                            <td className="border border-slate-300 p-2 text-center font-bold">
                              {isMengulang ? (
                                <span className="text-amber-700">Mengulang</span>
                              ) : sub.passed ? (
                                <span className="text-emerald-700">Tuntas</span>
                              ) : (
                                <span className="text-rose-700">Remedial</span>
                              )}
                            </td>
                            <td className="border border-slate-300 p-2 text-center font-mono">
                              {sub.tabSwitchCount || 0}x
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </>
            ) : (
              /* Tabel Leger Lintas Semua Bidang Studi */
              <table className="w-full border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="border border-slate-300 p-2 w-9 text-center">No</th>
                    <th className="border border-slate-300 p-2 w-20 text-center font-mono">NIS</th>
                    <th className="border border-slate-300 p-2 text-left">Nama Siswa</th>
                    <th className="border border-slate-300 p-2 w-20 text-center">Kelas</th>
                    {klasikalSubjects.map(subj => (
                      <th key={subj} className="border border-slate-300 p-2 text-center text-[10px]">
                        {subj}
                      </th>
                    ))}
                    <th className="border border-slate-300 p-2 w-20 text-center">Rata-Rata</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5 + klasikalSubjects.length} className="border border-slate-300 p-6 text-center text-slate-400">
                        Tidak ada siswa yang sesuai dengan filter kelas ini.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const rowScores = klasikalScoreMatrix[st.nis.toLowerCase()] || {};
                      const vals = klasikalSubjects
                        .map(subj => rowScores[subj])
                        .filter(v => v && v.statusText !== 'Belum Mengerjakan')
                        .map(v => v.percentage);
                      const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;

                      return (
                        <tr key={st.nis} className="border-b border-slate-200">
                          <td className="border border-slate-300 p-1.5 text-center font-mono">{idx + 1}</td>
                          <td className="border border-slate-300 p-1.5 text-center font-mono">{st.nis}</td>
                          <td className="border border-slate-300 p-1.5 font-medium">{st.name}</td>
                          <td className="border border-slate-300 p-1.5 text-center">{st.classGrade}</td>
                          {klasikalSubjects.map(subj => {
                            const cell = rowScores[subj];
                            const hasVal = cell && cell.statusText !== 'Belum Mengerjakan';
                            return (
                              <td
                                key={subj}
                                className={`border border-slate-300 p-1.5 text-center font-mono ${
                                  hasVal
                                    ? cell.passed
                                      ? 'font-bold text-emerald-700'
                                      : 'font-bold text-rose-700'
                                    : 'text-slate-400'
                                }`}
                              >
                                {hasVal ? cell.percentage : '-'}
                              </td>
                            );
                          })}
                          <td className="border border-slate-300 p-1.5 text-center font-mono font-bold bg-slate-50">
                            {avg !== null ? avg : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ==============================================================
            KOLOM TANDA TANGAN FORMAL
           ============================================================== */}
        {showSignatures && (
          <div className="mt-8 pt-5 border-t border-slate-300 text-xs print-break-inside-avoid">
            <div className="text-right text-xs mb-4 text-slate-700">
              Kota Malang, {todayStr}
            </div>

            {reportMode === 'klasikal' ? (
              <div className="grid grid-cols-2 gap-8 text-center">
                <div>
                  <span className="block text-slate-600 mb-1">Mengetahui,</span>
                  <span className="block font-bold text-slate-900">Kepala {profile.name || 'SD Negeri Pisangcandi 1'}</span>
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-xs">[Tanda Tangan & Cap Sekolah]</span>
                  </div>
                  <span className="block font-bold underline text-slate-900 mt-2">
                    {profile.principalName || 'Dr. H. Sulaiman, M.Pd.'}
                  </span>
                  <span className="block font-mono text-[11px] text-slate-600">
                    NIP. {profile.principalNip || '19750812 200003 1 002'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-600 mb-1">Pendidik / Guru Kelas</span>
                  <span className="block font-bold text-slate-900">{subjectFilterLabel}</span>
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-xs">[Tanda Tangan Guru]</span>
                  </div>
                  <span className="block font-bold underline text-slate-900 mt-2">
                    {profile.teacherName || 'Siti Rahmawati, S.Pd.'}
                  </span>
                  <span className="block font-mono text-[11px] text-slate-600">
                    NIP. {profile.teacherNip || '19820514 200801 2 009'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <span className="block text-slate-600 mb-1">Orang Tua / Wali Murid</span>
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-[11px]">[Tanda Tangan Wali]</span>
                  </div>
                  <div className="border-b border-black w-36 mx-auto mt-2"></div>
                  <span className="block text-[11px] text-slate-500 mt-0.5">( ......................................... )</span>
                </div>

                <div>
                  <span className="block text-slate-600 mb-1">Guru Kelas / Pengampu</span>
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-[11px]">[Tanda Tangan Guru]</span>
                  </div>
                  <span className="block font-bold underline text-slate-900 mt-2">
                    {profile.teacherName || 'Siti Rahmawati, S.Pd.'}
                  </span>
                  <span className="block font-mono text-[10px] text-slate-600">
                    NIP. {profile.teacherNip || '19820514 200801 2 009'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-600 mb-1">Mengetahui,</span>
                  <span className="block font-bold text-slate-900 text-[11px]">Kepala Sekolah</span>
                  <div className="h-14 flex items-end justify-center">
                    <span className="font-serif italic text-slate-300 text-[11px]">[Cap & Tanda Tangan]</span>
                  </div>
                  <span className="block font-bold underline text-slate-900 mt-2">
                    {profile.principalName || 'Dr. H. Sulaiman, M.Pd.'}
                  </span>
                  <span className="block font-mono text-[10px] text-slate-600">
                    NIP. {profile.principalNip || '19750812 200003 1 002'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Setup Cetak */}
      <PrintSetupModal
        isOpen={isPrintSetupOpen}
        onClose={() => setIsPrintSetupOpen(false)}
        documentTitle={
          reportMode === 'individu'
            ? `Rapor Siswa - ${currentStudent?.name || 'Siswa'} (${subjectFilterLabel})`
            : `Rekap Klasikal - ${classFilterLabel} (${subjectFilterLabel})`
        }
        defaultOrientation="portrait"
      />
    </div>
  );
};
