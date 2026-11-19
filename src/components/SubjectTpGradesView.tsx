import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Users,
  User,
  Search,
  Filter,
  RotateCcw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Minus
} from 'lucide-react';
import {
  CurriculumItem,
  Exam,
  Question,
  SchoolProfile,
  Student,
  Submission,
  normalizeLearningObjectives
} from '../types';
import { StorageService } from '../services/storage';
import { AnalysisService } from '../services/analysisService';
import {
  exportSubjectTpGradesToExcel,
  SubjectTpGradeExportRow,
  SubjectTpReferenceExport
} from '../services/exportExcelService';

interface SubjectTpGradesViewProps {
  profile: SchoolProfile;
  exams: Exam[];
  submissions: Submission[];
  students: Student[];
  curriculumItems?: CurriculumItem[];
  initialSubject?: string;
  initialGrade?: string;
  initialStudentNis?: string;
  onNavigateToRekap?: () => void;
}

interface TpDefinition {
  key: string;
  description: string;
  orderIndex: number;
  fromCurriculum: boolean;
  questionOrders: number[];
  questionsByExam: Map<string, Question[]>;
  fallbackExamIds: Set<string>;
  totalQuestions: number;
}

interface SubjectGroup {
  subjectKey: string;
  subjectLabel: string;
  kkm: number;
  exams: Exam[];
  tps: TpDefinition[];
}

interface StudentIdentity {
  key: string;
  nis: string;
  nisn?: string;
  name: string;
  classGrade: string;
}

interface TpScoreDetail {
  code: string;
  description: string;
  score: number | null;
  kkm: number;
  status: 'above' | 'equal' | 'below' | 'untested';
}

interface ComputedSubjectTpRow {
  rowKey: string;
  nis: string;
  studentName: string;
  classGrade: string;
  subject: string;
  kkm: number;
  tpScores: Array<number | null>;
  tpDetails: TpScoreDetail[];
  average: number | null;
  tpAtKkm: number;
  tpAboveKkm: number;
  tpBelowKkm: number;
  evaluatedTpCount: number;
  hasAnySubmission: boolean;
}

const safeString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
};

const normalizeTextKey = (value: unknown): string =>
  safeString(value).toLowerCase().replace(/\s+/g, ' ');

const normalizeIdKey = (value: unknown): string =>
  safeString(value).replace(/\s+/g, '').toLowerCase();

const getSafeAnswers = (sub: Submission | null | undefined): Record<string, any> => {
  if (!sub) return {};
  let ans: any = sub.answers;
  if (!ans && (sub as any).answersJson) {
    ans = (sub as any).answersJson;
  }
  if (typeof ans === 'string') {
    try {
      ans = JSON.parse(ans);
    } catch {
      ans = {};
    }
  }
  return typeof ans === 'object' && ans !== null ? ans : {};
};

const normalizeTpMatchKey = (value: unknown): string =>
  normalizeTextKey(value)
    .replace(/^(?:tp\s*\d+|\d+)\s*[:.)\-]\s*/i, '')
    .trim();

const FASE_GRADE_MAP: Record<string, number[]> = {
  a: [1, 2],
  b: [3, 4],
  c: [5, 6],
  d: [7, 8, 9],
  e: [10],
  f: [11, 12]
};

const ROMAN_GRADE_MAP: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12
};

const parseGradeInfo = (raw: string | undefined): { fases: Set<string>; grades: Set<number> } => {
  const text = normalizeTextKey(raw);
  const fases = new Set<string>();
  const grades = new Set<number>();
  if (!text) return { fases, grades };

  const faseRegex = /\bfase\s*([a-f])\b/g;
  let faseMatch: RegExpExecArray | null;
  while ((faseMatch = faseRegex.exec(text)) !== null) {
    const letter = faseMatch[1];
    fases.add(letter);
    (FASE_GRADE_MAP[letter] || []).forEach(g => grades.add(g));
  }

  const rangeRegex = /\b(1[0-2]|[1-9])\s*[-–]\s*(1[0-2]|[1-9])\b/g;
  let rangeMatch: RegExpExecArray | null;
  while ((rangeMatch = rangeRegex.exec(text)) !== null) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    for (let g = Math.min(start, end); g <= Math.max(start, end); g++) {
      grades.add(g);
    }
  }

  if (grades.size === 0) {
    const firstDigitMatch = text.match(/(?:^|[^0-9])(1[0-2]|[1-9])(?![0-9])/);
    if (firstDigitMatch) {
      grades.add(Number(firstDigitMatch[1]));
    } else {
      const tokens = text.split(/[^a-z]+/).filter(Boolean);
      for (const tok of tokens) {
        if (ROMAN_GRADE_MAP[tok] !== undefined) {
          grades.add(ROMAN_GRADE_MAP[tok]);
          break;
        }
      }
    }
  }

  grades.forEach(g => {
    Object.entries(FASE_GRADE_MAP).forEach(([fKey, gList]) => {
      if (gList.includes(g)) fases.add(fKey);
    });
  });

  return { fases, grades };
};

const doesCurriculumMatchGrade = (currGrade: string | undefined, targetGrade: string): boolean => {
  const normTarget = normalizeTextKey(targetGrade);
  if (!normTarget || normTarget === 'all') return true;
  const normCurr = normalizeTextKey(currGrade);
  if (!normCurr) return true;
  if (normCurr === normTarget || normCurr.includes(normTarget) || normTarget.includes(normCurr)) {
    return true;
  }
  const currInfo = parseGradeInfo(currGrade);
  const targetInfo = parseGradeInfo(targetGrade);
  for (const g of targetInfo.grades) {
    if (currInfo.grades.has(g)) return true;
  }
  for (const f of targetInfo.fases) {
    if (currInfo.fases.has(f)) return true;
  }
  return false;
};

const isStaleAutoZero = (sub: Submission, exam?: Exam): boolean => {
  if (!exam || !StorageService.isExamSessionOpen(exam)) return false;
  return StorageService.isAutoZeroSubmission(sub);
};

export const SubjectTpGradesView: React.FC<SubjectTpGradesViewProps> = ({
  profile,
  exams,
  submissions,
  students,
  curriculumItems: curriculumItemsProp,
  initialSubject,
  initialGrade,
  initialStudentNis,
  onNavigateToRekap
}) => {
  const [viewMode, setViewMode] = useState<'klasikal' | 'individu'>('klasikal');
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || 'all');
  const [selectedGrade, setSelectedGrade] = useState<string>(initialGrade || 'all');
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyTestedStudents, setOnlyTestedStudents] = useState<boolean>(false);
  const [activeStudentKey, setActiveStudentKey] = useState<string>(initialStudentNis || '');
  const [sortKey, setSortKey] = useState<string>('default');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const effectiveCurriculum = useMemo<CurriculumItem[]>(
    () => (curriculumItemsProp !== undefined ? curriculumItemsProp : StorageService.getCurriculum()),
    [curriculumItemsProp]
  );

  const distinctSubjects = useMemo(() => {
    const map = new Map<string, string>();
    effectiveCurriculum.forEach(c => {
      const s = safeString(c?.subject);
      if (s && !map.has(s.toLowerCase())) {
        map.set(s.toLowerCase(), s);
      }
    });
    exams.forEach(e => {
      const s = safeString(e?.subject);
      if (s && !map.has(s.toLowerCase())) {
        map.set(s.toLowerCase(), s);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'id'));
  }, [exams, effectiveCurriculum]);

  const distinctGrades = useMemo(() => {
    const set = new Set<string>();
    exams.forEach(e => {
      const g = safeString(e?.grade);
      if (g) set.add(g);
    });
    students.forEach(st => {
      const g = safeString(st?.classGrade);
      if (g) set.add(g);
    });
    submissions.forEach(sub => {
      const g = safeString(sub?.classGrade);
      if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
    );
  }, [exams, students, submissions]);

  const filteredExamOptions = useMemo(() => {
    return exams
      .filter(e => {
        const matchSubj =
          selectedSubject === 'all' ||
          normalizeTextKey(e.subject) === normalizeTextKey(selectedSubject);
        const matchGrade =
          selectedGrade === 'all' ||
          normalizeTextKey(e.grade) === normalizeTextKey(selectedGrade);
        return matchSubj && matchGrade;
      })
      .sort((a, b) => safeString(a.title).localeCompare(safeString(b.title), 'id', { numeric: true }));
  }, [exams, selectedSubject, selectedGrade]);

  const scopedExams = useMemo(() => {
    if (selectedExamId !== 'all') {
      const found = filteredExamOptions.find(e => e.id === selectedExamId) || exams.find(e => e.id === selectedExamId);
      return found ? [found] : filteredExamOptions;
    }
    return filteredExamOptions;
  }, [selectedExamId, filteredExamOptions, exams]);

  // Bangun struktur Mata Pelajaran -> Daftar TP terurut sesuai menu Capaian & TP + KKM
  const subjectGroups = useMemo<SubjectGroup[]>(() => {
    const groupMap = new Map<string, { subjectLabel: string; exams: Exam[] }>();

    scopedExams.forEach(exam => {
      const rawSubj = safeString(exam.subject) || 'Umum';
      const key = normalizeTextKey(rawSubj);
      const existing = groupMap.get(key);
      if (existing) {
        existing.exams.push(exam);
      } else {
        groupMap.set(key, { subjectLabel: rawSubj, exams: [exam] });
      }
    });

    // Sertakan mata pelajaran dari menu Capaian & TP jika filter paket adalah Gabungan Semua Paket
    if (selectedExamId === 'all') {
      effectiveCurriculum.forEach(c => {
        const rawSubj = safeString(c.subject);
        if (!rawSubj) return;
        const subjKey = normalizeTextKey(rawSubj);
        if (selectedSubject !== 'all' && subjKey !== normalizeTextKey(selectedSubject)) {
          return;
        }
        if (selectedGrade !== 'all' && !doesCurriculumMatchGrade(c.grade, selectedGrade)) {
          return;
        }
        if (!groupMap.has(subjKey)) {
          groupMap.set(subjKey, { subjectLabel: rawSubj, exams: [] });
        }
      });
    }

    const groups: SubjectGroup[] = [];
    groupMap.forEach((group, subjectKey) => {
      const kkmValues = group.exams.map(e => Number(e.passingScore) || 75);
      const kkm =
        kkmValues.length > 0
          ? Math.round(kkmValues.reduce((a, b) => a + b, 0) / kkmValues.length)
          : 75;

      const tpMap = new Map<string, TpDefinition>();
      const tpMatchLookup = new Map<string, string>();

      const ensureTpEntry = (desc: string, fromCurriculum: boolean): TpDefinition => {
        const tpKey = normalizeTextKey(desc);
        const matchKey = normalizeTpMatchKey(desc);
        const mappedKey = tpMap.has(tpKey) ? tpKey : (tpMatchLookup.get(matchKey) || tpKey);

        let entry = tpMap.get(mappedKey);
        if (!entry) {
          entry = {
            key: mappedKey,
            description: desc,
            orderIndex: tpMap.size + 1,
            fromCurriculum,
            questionOrders: [],
            questionsByExam: new Map<string, Question[]>(),
            fallbackExamIds: new Set<string>(),
            totalQuestions: 0
          };
          tpMap.set(mappedKey, entry);
          if (matchKey && !tpMatchLookup.has(matchKey)) {
            tpMatchLookup.set(matchKey, mappedKey);
          }
        }
        return entry;
      };

      // 1. PRIORITAS UTAMA: Inisialisasi TP terlebih dahulu dari menu Capaian & TP sesuai urutan input
      const subjectCurriculumItems = effectiveCurriculum.filter(
        c => normalizeTextKey(c.subject) === subjectKey
      );
      const targetGrades =
        selectedGrade !== 'all'
          ? [selectedGrade]
          : Array.from(new Set(group.exams.map(e => safeString(e.grade)).filter(Boolean)));

      const gradeMatchedCurriculum =
        targetGrades.length > 0
          ? subjectCurriculumItems.filter(c =>
              targetGrades.some(tg => doesCurriculumMatchGrade(c.grade, tg))
            )
          : subjectCurriculumItems;

      const orderedCurriculumItems =
        gradeMatchedCurriculum.length > 0 ? gradeMatchedCurriculum : subjectCurriculumItems;

      orderedCurriculumItems.forEach(c => {
        normalizeLearningObjectives(c.learningObjectives).forEach(tpText => {
          const desc = safeString(tpText);
          if (!desc) return;
          ensureTpEntry(desc, true);
        });
      });

      // 2. Petakan soal-soal & paket ujian ke TP yang sesuai (TP non-kurikulum ditambahkan setelahnya)
      const sortedExams = [...group.exams].sort((a, b) =>
        safeString(a.createdAt || a.title).localeCompare(safeString(b.createdAt || b.title), 'id')
      );

      sortedExams.forEach(exam => {
        const examQuestions = [...StorageService.getQuestionsByExamId(exam.id)].sort(
          (a, b) => (a.order || 0) - (b.order || 0)
        );
        const examTps = normalizeLearningObjectives(exam.learningObjectives);

        examQuestions.forEach(q => {
          const tpFromExam =
            examTps.length > 0 ? examTps[(Math.max(1, q.order || 1) - 1) % examTps.length] : '';
          const desc =
            safeString(q.learningObjective) ||
            safeString(q.indicator) ||
            tpFromExam ||
            `Tujuan Pembelajaran Soal #${q.order || 1}`;

          const tpEntry = ensureTpEntry(desc, false);

          if (q.order && !tpEntry.questionOrders.includes(q.order)) {
            tpEntry.questionOrders.push(q.order);
          }
          const listForExam = tpEntry.questionsByExam.get(exam.id) || [];
          listForExam.push(q);
          tpEntry.questionsByExam.set(exam.id, listForExam);
          tpEntry.totalQuestions += 1;
        });

        // Tambahkan TP dari konfigurasi paket ujian jika belum muncul di daftar soal
        examTps.forEach(tpText => {
          const desc = safeString(tpText);
          if (!desc) return;
          const tpEntry = ensureTpEntry(desc, false);
          if (examQuestions.length === 0) {
            tpEntry.fallbackExamIds.add(exam.id);
          }
        });
      });

      const tps = Array.from(tpMap.values()).map((tp, idx) => ({
        ...tp,
        orderIndex: idx + 1,
        questionOrders: [...tp.questionOrders].sort((a, b) => a - b)
      }));

      groups.push({
        subjectKey,
        subjectLabel: group.subjectLabel,
        kkm,
        exams: sortedExams,
        tps
      });
    });

    return groups.sort((a, b) => a.subjectLabel.localeCompare(b.subjectLabel, 'id'));
  }, [scopedExams, effectiveCurriculum, selectedExamId, selectedSubject, selectedGrade]);

  // Daftar siswa yang valid dalam cakupan filter kelas
  const scopedStudents = useMemo<StudentIdentity[]>(() => {
    const map = new Map<string, StudentIdentity>();

    const addOrMergeStudent = (candidate: StudentIdentity) => {
      const byNis = normalizeIdKey(candidate.nis);
      const byName = normalizeTextKey(candidate.name);
      let existingKey: string | null = null;

      map.forEach((val, key) => {
        if (existingKey) return;
        const valNis = normalizeIdKey(val.nis);
        const valNisn = normalizeIdKey(val.nisn);
        const valName = normalizeTextKey(val.name);
        if (byNis && byNis !== '-' && (valNis === byNis || valNisn === byNis)) {
          existingKey = key;
        } else if (byName && valName === byName && (!byNis || !valNis || byNis === '-' || valNis === '-')) {
          existingKey = key;
        }
      });

      if (existingKey) {
        const cur = map.get(existingKey)!;
        if ((!cur.nis || cur.nis === '-') && candidate.nis && candidate.nis !== '-') {
          cur.nis = candidate.nis;
        }
        if ((!cur.classGrade || cur.classGrade === '-') && candidate.classGrade && candidate.classGrade !== '-') {
          cur.classGrade = candidate.classGrade;
        }
        if (!cur.nisn && candidate.nisn) {
          cur.nisn = candidate.nisn;
        }
      } else {
        map.set(candidate.key, candidate);
      }
    };

    students.forEach(st => {
      const grade = safeString(st.classGrade);
      if (selectedGrade !== 'all' && normalizeTextKey(grade) !== normalizeTextKey(selectedGrade)) {
        return;
      }
      const nis = safeString(st.studentNo || st.nis || st.nisn) || '-';
      const name = safeString(st.fullName) || 'Siswa';
      const key = normalizeIdKey(nis !== '-' ? nis : name) || st.id;
      addOrMergeStudent({
        key,
        nis,
        nisn: safeString(st.nisn),
        name,
        classGrade: grade || '-'
      });
    });

    const scopedExamIds = new Set(scopedExams.map(e => e.id));
    submissions.forEach(sub => {
      if (!scopedExamIds.has(sub.examId)) return;
      if (sub.statusNote === 'Mengulang Ujian') return;
      const ex = exams.find(e => e.id === sub.examId);
      if (isStaleAutoZero(sub, ex)) return;

      const grade = safeString(sub.classGrade) || safeString(ex?.grade);
      if (selectedGrade !== 'all' && normalizeTextKey(grade) !== normalizeTextKey(selectedGrade)) {
        return;
      }

      const nis = safeString(sub.studentNo) || '-';
      const name = safeString(sub.studentName) || 'Peserta Ujian';
      const key = normalizeIdKey(nis !== '-' ? nis : name) || sub.id;
      addOrMergeStudent({
        key,
        nis,
        name,
        classGrade: grade || '-'
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const cmpName = a.name.localeCompare(b.name, 'id');
      if (cmpName !== 0) return cmpName;
      return a.nis.localeCompare(b.nis, 'id', { numeric: true });
    });
  }, [students, submissions, scopedExams, exams, selectedGrade]);

  const currentStudent = useMemo<StudentIdentity | null>(() => {
    if (scopedStudents.length === 0) return null;
    if (!activeStudentKey) return scopedStudents[0];
    const targetNorm = normalizeIdKey(activeStudentKey);
    const targetNameNorm = normalizeTextKey(activeStudentKey);
    const found = scopedStudents.find(
      s =>
        s.key === activeStudentKey ||
        normalizeIdKey(s.nis) === targetNorm ||
        normalizeIdKey(s.nisn) === targetNorm ||
        normalizeTextKey(s.name) === targetNameNorm
    );
    return found || scopedStudents[0];
  }, [scopedStudents, activeStudentKey]);

  const currentStudentIndex = useMemo(() => {
    if (!currentStudent) return -1;
    return scopedStudents.findIndex(s => s.key === currentStudent.key);
  }, [scopedStudents, currentStudent]);

  // Indeks submisi terbaik per (studentKey, examId)
  const validSubmissionsList = useMemo(() => {
    const scopedExamMap = new Map(scopedExams.map(e => [e.id, e]));
    return submissions.filter(sub => {
      const ex = scopedExamMap.get(sub.examId);
      if (!ex) return false;
      if (sub.statusNote === 'Mengulang Ujian') return false;
      if (isStaleAutoZero(sub, ex)) return false;
      return true;
    });
  }, [submissions, scopedExams]);

  const getBestSubmissionForStudentExam = (student: StudentIdentity, examId: string): Submission | null => {
    const stNis = normalizeIdKey(student.nis);
    const stNisn = normalizeIdKey(student.nisn);
    const stName = normalizeTextKey(student.name);

    const matched = validSubmissionsList.filter(sub => {
      if (sub.examId !== examId) return false;
      const subNis = normalizeIdKey(sub.studentNo);
      const subName = normalizeTextKey(sub.studentName);
      const nisHit = Boolean(subNis && subNis !== '-' && ((stNis && stNis !== '-' && subNis === stNis) || (stNisn && stNisn !== '-' && subNis === stNisn)));
      const nameHit = Boolean(stName && subName && stName === subName);
      return nisHit || nameHit;
    });

    if (matched.length === 0) return null;
    return [...matched].sort((a, b) => {
      const pctDiff = (Number(b.percentage) || 0) - (Number(a.percentage) || 0);
      if (pctDiff !== 0) return pctDiff;
      return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
    })[0];
  };

  // Hitung nilai per (Siswa, Mata Pelajaran) dan per Tujuan Pembelajaran
  const buildRowForStudentSubject = (
    student: StudentIdentity,
    group: SubjectGroup
  ): ComputedSubjectTpRow => {
    const examSubMap = new Map<string, Submission | null>();
    let hasAnySubmission = false;

    group.exams.forEach(ex => {
      const best = getBestSubmissionForStudentExam(student, ex.id);
      examSubMap.set(ex.id, best);
      if (best) hasAnySubmission = true;
    });

    const tpDetails: TpScoreDetail[] = [];
    const tpScores: Array<number | null> = [];

    group.tps.forEach((tp, idx) => {
      const code = `Tujuan Pembelajaran ${idx + 1}`;
      let totalMaxPoints = 0;
      let totalEarnedPoints = 0;
      let hasTestedQuestionSubmission = false;
      const fallbackPercentages: number[] = [];

      // Cek setiap paket ujian yang memiliki butir soal pada TP ini
      tp.questionsByExam.forEach((qs, exId) => {
        const sub = examSubMap.get(exId);
        if (!sub) return;
        hasTestedQuestionSubmission = true;

        const safeAns = getSafeAnswers(sub);
        const hasDetailedAnswers = Object.keys(safeAns).length > 0;

        if (hasDetailedAnswers && qs.length > 0) {
          qs.forEach(q => {
            const pts = Math.max(1, Number(q.points) || 1);
            totalMaxPoints += pts;
            const ans = safeAns[q.id];
            if (AnalysisService.isAnswerCorrect(q, ans)) {
              totalEarnedPoints += pts;
            }
          });
        } else {
          fallbackPercentages.push(Math.round(Number(sub.percentage) || 0));
        }
      });

      // Jika TP hanya didefinisikan di paket tanpa butir soal dan siswa sudah mengerjakan paket tersebut
      if (!hasTestedQuestionSubmission && tp.questionsByExam.size === 0 && tp.fallbackExamIds.size > 0) {
        tp.fallbackExamIds.forEach(exId => {
          const sub = examSubMap.get(exId);
          if (sub) {
            hasTestedQuestionSubmission = true;
            fallbackPercentages.push(Math.round(Number(sub.percentage) || 0));
          }
        });
      }

      let score: number | null = null;
      if (hasTestedQuestionSubmission) {
        if (totalMaxPoints > 0) {
          score = Math.round((totalEarnedPoints / totalMaxPoints) * 100);
        } else if (fallbackPercentages.length > 0) {
          score = Math.round(
            fallbackPercentages.reduce((a, b) => a + b, 0) / fallbackPercentages.length
          );
        }
      }

      let status: TpScoreDetail['status'] = 'untested';
      if (score !== null) {
        if (score > group.kkm) status = 'above';
        else if (score === group.kkm) status = 'equal';
        else status = 'below';
      }

      tpScores.push(score);
      tpDetails.push({
        code,
        description: tp.description,
        score,
        kkm: group.kkm,
        status
      });
    });

    const numericScores = tpScores.filter((v): v is number => v !== null);
    const evaluatedTpCount = numericScores.length;
    const average =
      evaluatedTpCount > 0
        ? Math.round(numericScores.reduce((a, b) => a + b, 0) / evaluatedTpCount)
        : null;

    const tpAtKkm = numericScores.filter(v => v === group.kkm).length;
    const tpAboveKkm = numericScores.filter(v => v > group.kkm).length;
    const tpBelowKkm = numericScores.filter(v => v < group.kkm).length;

    return {
      rowKey: `${student.key}__${group.subjectKey}`,
      nis: student.nis,
      studentName: student.name,
      classGrade: student.classGrade,
      subject: group.subjectLabel,
      kkm: group.kkm,
      tpScores,
      tpDetails,
      average,
      tpAtKkm,
      tpAboveKkm,
      tpBelowKkm,
      evaluatedTpCount,
      hasAnySubmission
    };
  };

  // Daftar baris sesuai mode tampilan (Klasikal vs Individu)
  const displayedRows = useMemo<ComputedSubjectTpRow[]>(() => {
    const rawRows: ComputedSubjectTpRow[] = [];

    if (viewMode === 'klasikal') {
      subjectGroups.forEach(group => {
        scopedStudents.forEach(student => {
          const row = buildRowForStudentSubject(student, group);
          if (onlyTestedStudents && !row.hasAnySubmission) return;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = row.studentName.toLowerCase().includes(q);
            const matchNis = row.nis.toLowerCase().includes(q);
            const matchSubj = row.subject.toLowerCase().includes(q);
            const matchClass = row.classGrade.toLowerCase().includes(q);
            if (!matchName && !matchNis && !matchSubj && !matchClass) return;
          }
          rawRows.push(row);
        });
      });
    } else if (currentStudent) {
      subjectGroups.forEach(group => {
        const row = buildRowForStudentSubject(currentStudent, group);
        rawRows.push(row);
      });
    }

    if (sortKey === 'default') return rawRows;

    return [...rawRows].sort((a, b) => {
      let valA: number | string = '';
      let valB: number | string = '';

      if (sortKey === 'nis') {
        valA = a.nis;
        valB = b.nis;
      } else if (sortKey === 'studentName') {
        valA = a.studentName;
        valB = b.studentName;
      } else if (sortKey === 'subject') {
        valA = a.subject;
        valB = b.subject;
      } else if (sortKey === 'average') {
        valA = a.average ?? -1;
        valB = b.average ?? -1;
      } else if (sortKey === 'tpAtKkm') {
        valA = a.tpAtKkm;
        valB = b.tpAtKkm;
      } else if (sortKey === 'tpAboveKkm') {
        valA = a.tpAboveKkm;
        valB = b.tpAboveKkm;
      } else if (sortKey === 'tpBelowKkm') {
        valA = a.tpBelowKkm;
        valB = b.tpBelowKkm;
      } else if (sortKey.startsWith('tp_')) {
        const tpIdx = Number(sortKey.replace('tp_', ''));
        valA = a.tpScores[tpIdx] ?? -1;
        valB = b.tpScores[tpIdx] ?? -1;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDir === 'asc'
        ? strA.localeCompare(strB, 'id', { numeric: true })
        : strB.localeCompare(strA, 'id', { numeric: true });
    });
  }, [
    viewMode,
    subjectGroups,
    scopedStudents,
    currentStudent,
    onlyTestedStudents,
    searchQuery,
    sortKey,
    sortDir,
    validSubmissionsList
  ]);

  const maxTpCount = useMemo(() => {
    const maxFromGroups = subjectGroups.reduce((max, g) => Math.max(max, g.tps.length), 0);
    const maxFromRows = displayedRows.reduce((max, r) => Math.max(max, r.tpScores.length), 0);
    return Math.max(1, maxFromGroups, maxFromRows);
  }, [subjectGroups, displayedRows]);

  const kpiSummary = useMemo(() => {
    const evaluatedRows = displayedRows.filter(r => r.average !== null);
    const overallAvg =
      evaluatedRows.length > 0
        ? Math.round(
            evaluatedRows.reduce((sum, r) => sum + (r.average ?? 0), 0) / evaluatedRows.length
          )
        : 0;
    const totalAtKkm = displayedRows.reduce((sum, r) => sum + r.tpAtKkm, 0);
    const totalAboveKkm = displayedRows.reduce((sum, r) => sum + r.tpAboveKkm, 0);
    const totalBelowKkm = displayedRows.reduce((sum, r) => sum + r.tpBelowKkm, 0);
    return {
      totalRows: displayedRows.length,
      evaluatedRows: evaluatedRows.length,
      overallAvg,
      totalAtKkm,
      totalAboveKkm,
      totalBelowKkm
    };
  }, [displayedRows]);

  const classTpAverages = useMemo(() => {
    return Array.from({ length: maxTpCount }, (_, idx) => {
      const vals = displayedRows
        .map(r => r.tpScores[idx])
        .filter((v): v is number => typeof v === 'number');
      return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    });
  }, [displayedRows, maxTpCount]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'nis' || key === 'studentName' || key === 'subject' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (key: string) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />;
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
    );
  };

  const handleExportExcel = () => {
    if (displayedRows.length === 0) {
      alert('Belum ada data nilai per mata pelajaran dan TP yang dapat diekspor.');
      return;
    }

    const exportRows: SubjectTpGradeExportRow[] = displayedRows.map((row, idx) => ({
      no: idx + 1,
      nis: row.nis,
      studentName: row.studentName,
      classGrade: row.classGrade,
      subject: row.subject,
      kkm: row.kkm,
      tpScores: row.tpScores,
      average: row.average,
      tpAtKkm: row.tpAtKkm,
      tpAboveKkm: row.tpAboveKkm,
      tpBelowKkm: row.tpBelowKkm
    }));

    const references: SubjectTpReferenceExport[] = subjectGroups.map(g => ({
      subject: g.subjectLabel,
      kkm: g.kkm,
      objectives: g.tps.map((tp, idx) => ({
        code: `Tujuan Pembelajaran ${idx + 1}`,
        description: tp.description,
        questionCount: tp.totalQuestions,
        questionOrders: tp.questionOrders.join(', ')
      }))
    }));

    exportSubjectTpGradesToExcel(exportRows, maxTpCount, references, profile, {
      mode: viewMode,
      subjectFilterLabel: selectedSubject === 'all' ? 'Semua Mata Pelajaran' : selectedSubject,
      classFilterLabel: selectedGrade === 'all' ? 'Semua Kelas' : selectedGrade,
      studentName: currentStudent?.name,
      studentNis: currentStudent?.nis
    });
  };

  const singleSubjectGroup = subjectGroups.length === 1 ? subjectGroups[0] : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Daftar Nilai per Mata Pelajaran & Tujuan Pembelajaran
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Menampilkan capaian nilai setiap Tujuan Pembelajaran (TP 1, TP 2, ...) sesuai data dan urutan input pada menu Capaian & TP, rerata, serta jumlah TP pada KKM, di atas KKM, dan di bawah KKM dalam mode klasikal atau individu siswa.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
          {onNavigateToRekap && (
            <button
              type="button"
              onClick={onNavigateToRekap}
              className="h-9 inline-flex items-center gap-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Rekap Nilai Paket</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={displayedRows.length === 0}
            className="h-9 inline-flex items-center gap-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-xs whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => {
                setViewMode('klasikal');
                setSortKey('default');
              }}
              className={`h-8 inline-flex items-center gap-2 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'klasikal'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Tampilan Klasikal (Seluruh Siswa)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('individu');
                setSortKey('default');
              }}
              className={`h-8 inline-flex items-center gap-2 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'individu'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Tampilan Individu Siswa</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {viewMode === 'klasikal' && (
              <label className="inline-flex items-center gap-2 cursor-pointer select-none font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyTestedStudents}
                  onChange={e => setOnlyTestedStudents(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Hanya siswa yang sudah mengerjakan</span>
              </label>
            )}
            {(selectedSubject !== 'all' || selectedGrade !== 'all' || selectedExamId !== 'all' || searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject('all');
                  setSelectedGrade('all');
                  setSelectedExamId('all');
                  setSearchQuery('');
                  setSortKey('default');
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filter Mata Pelajaran */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Mata Pelajaran
            </label>
            <select
              value={selectedSubject}
              onChange={e => {
                setSelectedSubject(e.target.value);
                setSelectedExamId('all');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">Semua Mata Pelajaran ({distinctSubjects.length})</option>
              {distinctSubjects.map(subj => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Kelas */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Kelas / Rombel
            </label>
            <select
              value={selectedGrade}
              onChange={e => {
                setSelectedGrade(e.target.value);
                setSelectedExamId('all');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">Semua Kelas ({distinctGrades.length})</option>
              {distinctGrades.map(grd => (
                <option key={grd} value={grd}>
                  {grd}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Paket Asesmen */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Paket Asesmen
            </label>
            <select
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">Gabungan Semua Paket ({filteredExamOptions.length} Paket)</option>
              {filteredExamOptions.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.subject} · KKM {ex.passingScore ?? 75})
                </option>
              ))}
            </select>
          </div>

          {/* Pencarian (Klasikal) vs Pemilih Siswa (Individu) */}
          {viewMode === 'klasikal' ? (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Cari NIS / Nama Siswa
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Ketik NIS, nama siswa, atau mapel..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Pilih Siswa ({scopedStudents.length} Siswa)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentStudentIndex <= 0}
                  onClick={() => {
                    if (currentStudentIndex > 0) {
                      setActiveStudentKey(scopedStudents[currentStudentIndex - 1].key);
                    }
                  }}
                  className="h-8.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                  title="Siswa sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={currentStudent?.key || ''}
                  onChange={e => setActiveStudentKey(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-2 text-xs font-semibold rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/40 text-slate-900 dark:text-white"
                >
                  {scopedStudents.length === 0 ? (
                    <option value="">Tidak ada siswa pada kelas ini</option>
                  ) : (
                    scopedStudents.map(st => (
                      <option key={st.key} value={st.key}>
                        {st.nis} · {st.name} ({st.classGrade})
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  disabled={currentStudentIndex < 0 || currentStudentIndex >= scopedStudents.length - 1}
                  onClick={() => {
                    if (currentStudentIndex >= 0 && currentStudentIndex < scopedStudents.length - 1) {
                      setActiveStudentKey(scopedStudents[currentStudentIndex + 1].key);
                    }
                  }}
                  className="h-8.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                  title="Siswa berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ringkasan KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>{viewMode === 'klasikal' ? 'Baris Data Klasikal' : 'Mata Pelajaran Siswa'}</span>
            <Filter className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
            {kpiSummary.totalRows}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {kpiSummary.evaluatedRows} baris memiliki nilai TP
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Rerata Nilai TP</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
            {kpiSummary.overallAvg}
            <span className="text-xs font-normal text-slate-400 ml-1">/ 100</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {singleSubjectGroup ? `Acuan KKM: ${singleSubjectGroup.kkm}` : 'Sesuai KKM masing-masing mapel'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>TP Di Atas & Pada KKM</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {kpiSummary.totalAboveKkm + kpiSummary.totalAtKkm}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {kpiSummary.totalAboveKkm} di atas KKM · {kpiSummary.totalAtKkm} pada KKM
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>TP Di Bawah KKM</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
            {kpiSummary.totalBelowKkm}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            TP perlu bimbingan / remedial
          </div>
        </div>
      </div>

      {/* Identitas Siswa Terpilih pada Mode Individu */}
      {viewMode === 'individu' && currentStudent && (
        <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {currentStudent.name}
              </h4>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                <span>NIS: {currentStudent.nis}</span>
                <span aria-hidden="true">·</span>
                <span>Kelas {currentStudent.classGrade}</span>
                <span aria-hidden="true">·</span>
                <span>{displayedRows.length} Mata Pelajaran</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium tabular-nums">
            <span className="text-emerald-700 dark:text-emerald-400">
              Di atas KKM: <strong>{kpiSummary.totalAboveKkm} TP</strong>
            </span>
            <span className="text-indigo-700 dark:text-indigo-400">
              Pada KKM: <strong>{kpiSummary.totalAtKkm} TP</strong>
            </span>
            <span className="text-rose-700 dark:text-rose-400">
              Di bawah KKM: <strong>{kpiSummary.totalBelowKkm} TP</strong>
            </span>
          </div>
        </div>
      )}

      {/* Tabel Utama Daftar Nilai per Mata Pelajaran & per Tujuan Pembelajaran */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Tabel Nilai per Mata Pelajaran & Tujuan Pembelajaran ({viewMode === 'klasikal' ? 'Klasikal' : 'Individu Siswa'})
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>&gt; KKM (Di Atas KKM)</span>
            </span>
            <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400 font-medium">
              <Minus className="w-3 h-3" />
              <span>= KKM (Pada KKM)</span>
            </span>
            <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-medium">
              <AlertTriangle className="w-3 h-3" />
              <span>&lt; KKM (Di Bawah KKM)</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-3 text-center w-12 whitespace-nowrap">Nomor</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none whitespace-nowrap"
                  onClick={() => handleSort('nis')}
                >
                  <div className="flex items-center gap-1">
                    <span>NIS</span>
                    {renderSortIcon('nis')}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none whitespace-nowrap"
                  onClick={() => handleSort('studentName')}
                >
                  <div className="flex items-center gap-1">
                    <span>Nama Siswa</span>
                    {renderSortIcon('studentName')}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none whitespace-nowrap"
                  onClick={() => handleSort('subject')}
                >
                  <div className="flex items-center gap-1">
                    <span>Mata Pelajaran</span>
                    {renderSortIcon('subject')}
                  </div>
                </th>

                {Array.from({ length: maxTpCount }, (_, tpIdx) => {
                  const singleTp = singleSubjectGroup?.tps[tpIdx];
                  const colSortKey = `tp_${tpIdx}`;
                  return (
                    <th
                      key={`tp-hdr-${tpIdx}`}
                      onClick={() => handleSort(colSortKey)}
                      className="py-3 px-2.5 text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none whitespace-nowrap min-w-[96px]"
                      title={singleTp ? `TP ${tpIdx + 1}: ${singleTp.description}` : `Tujuan Pembelajaran ${tpIdx + 1}`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          <span>TP {tpIdx + 1}</span>
                          {renderSortIcon(colSortKey)}
                        </div>
                        {singleTp && (
                          <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 max-w-[110px] truncate">
                            {singleTp.description}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}

                <th
                  className="py-3 px-3 text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none whitespace-nowrap bg-indigo-50/60 dark:bg-indigo-950/30"
                  onClick={() => handleSort('average')}
                >
                  <div className="flex items-center justify-center gap-1 text-indigo-700 dark:text-indigo-300">
                    <span>Rerata</span>
                    {renderSortIcon('average')}
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none whitespace-nowrap"
                  onClick={() => handleSort('tpAtKkm')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>TP pada KKM</span>
                    {renderSortIcon('tpAtKkm')}
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none whitespace-nowrap"
                  onClick={() => handleSort('tpAboveKkm')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>TP di atas KKM</span>
                    {renderSortIcon('tpAboveKkm')}
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none whitespace-nowrap"
                  onClick={() => handleSort('tpBelowKkm')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>TP di bawah KKM</span>
                    {renderSortIcon('tpBelowKkm')}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {displayedRows.map((row, rowIdx) => (
                <tr
                  key={row.rowKey}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-400">
                    {rowIdx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {row.nis}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-900 dark:text-white">{row.studentName}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      Kelas {row.classGrade}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{row.subject}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                      KKM {row.kkm}
                    </div>
                  </td>

                  {Array.from({ length: maxTpCount }, (_, tpIdx) => {
                    const detail = row.tpDetails[tpIdx];
                    if (!detail) {
                      return (
                        <td
                          key={`${row.rowKey}-tp-${tpIdx}`}
                          className="py-2.5 px-2.5 text-center text-slate-300 dark:text-slate-700 font-mono tabular-nums"
                          title="Mata pelajaran ini tidak memiliki TP pada urutan kolom ini"
                        >
                          —
                        </td>
                      );
                    }

                    if (detail.score === null) {
                      return (
                        <td
                          key={`${row.rowKey}-tp-${tpIdx}`}
                          className="py-2.5 px-2.5 text-center text-slate-400 dark:text-slate-500 font-mono tabular-nums"
                          title={`${detail.code}: ${detail.description} (Belum dinilai)`}
                        >
                          —
                        </td>
                      );
                    }

                    const toneClass =
                      detail.status === 'above'
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40'
                        : detail.status === 'equal'
                        ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40'
                        : 'text-rose-700 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/40';

                    const statusDesc =
                      detail.status === 'above'
                        ? 'Di atas KKM'
                        : detail.status === 'equal'
                        ? 'Pada KKM'
                        : 'Di bawah KKM';

                    return (
                      <td
                        key={`${row.rowKey}-tp-${tpIdx}`}
                        className="py-2.5 px-2.5 text-center font-mono tabular-nums"
                        title={`${detail.code} (${detail.description}): Nilai ${detail.score} · KKM ${detail.kkm} (${statusDesc})`}
                      >
                        <span
                          className={`inline-block min-w-[44px] px-2 py-0.5 rounded-md font-bold ${toneClass}`}
                        >
                          {detail.score}
                        </span>
                      </td>
                    );
                  })}

                  <td className="py-2.5 px-3 text-center font-mono tabular-nums bg-indigo-50/30 dark:bg-indigo-950/15">
                    {row.average !== null ? (
                      <span
                        className={`inline-block min-w-[44px] px-2.5 py-0.5 rounded-md font-extrabold ${
                          row.average >= row.kkm
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {row.average}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-center font-mono tabular-nums font-bold text-indigo-700 dark:text-indigo-300">
                    {row.tpAtKkm}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                    {row.tpAboveKkm}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
                    {row.tpBelowKkm}
                  </td>
                </tr>
              ))}
            </tbody>

            {viewMode === 'klasikal' && displayedRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <td colSpan={4} className="py-3 px-3 text-right">
                    Rata-rata / Total Klasikal:
                  </td>
                  {classTpAverages.map((avgVal, idx) => (
                    <td key={`avg-tp-${idx}`} className="py-3 px-2.5 text-center font-mono tabular-nums">
                      {avgVal !== null ? avgVal : '—'}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-center font-mono tabular-nums text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30">
                    {kpiSummary.evaluatedRows > 0 ? kpiSummary.overallAvg : '—'}
                  </td>
                  <td className="py-3 px-3 text-center font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
                    {kpiSummary.totalAtKkm}
                  </td>
                  <td className="py-3 px-3 text-center font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {kpiSummary.totalAboveKkm}
                  </td>
                  <td className="py-3 px-3 text-center font-mono tabular-nums text-rose-700 dark:text-rose-400">
                    {kpiSummary.totalBelowKkm}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {displayedRows.length === 0 && (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Belum ada daftar nilai mata pelajaran & tujuan pembelajaran untuk filter ini.
              </p>
              <p className="text-xs mt-1">
                Pastikan paket ujian sudah dibuat, memiliki Tujuan Pembelajaran (TP), dan disesuaikan dengan filter kelas atau mata pelajaran.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Rincian Individu Siswa per TP (khusus mode Individu) */}
      {viewMode === 'individu' && currentStudent && displayedRows.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Rincian Pencapaian per Tujuan Pembelajaran — {currentStudent.name}</span>
          </h4>

          <div className="space-y-4">
            {displayedRows.map(row => (
              <div
                key={`detail-${row.rowKey}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {row.subject} <span className="font-normal text-slate-500 dark:text-slate-400">· KKM {row.kkm}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]">
                    <span>Rerata: <strong>{row.average !== null ? row.average : '—'}</strong></span>
                    <span className="text-indigo-600 dark:text-indigo-400">Pada KKM: <strong>{row.tpAtKkm}</strong></span>
                    <span className="text-emerald-600 dark:text-emerald-400">Di atas KKM: <strong>{row.tpAboveKkm}</strong></span>
                    <span className="text-rose-600 dark:text-rose-400">Di bawah KKM: <strong>{row.tpBelowKkm}</strong></span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {row.tpDetails.length === 0 ? (
                    <div className="p-4 text-xs text-slate-400">
                      Belum ada Tujuan Pembelajaran yang terpetakan untuk mata pelajaran ini.
                    </div>
                  ) : (
                    row.tpDetails.map((detail, dIdx) => (
                      <div
                        key={`${row.rowKey}-det-${dIdx}`}
                        className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            TP {dIdx + 1}: {detail.description}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {detail.score !== null ? detail.score : '—'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-sans text-[11px] font-semibold min-w-[115px] justify-end ${
                              detail.status === 'above'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : detail.status === 'equal'
                                ? 'text-indigo-700 dark:text-indigo-400'
                                : detail.status === 'below'
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {detail.status === 'above' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {detail.status === 'equal' && <Minus className="w-3.5 h-3.5" />}
                            {detail.status === 'below' && <AlertTriangle className="w-3.5 h-3.5" />}
                            <span>
                              {detail.status === 'above'
                                ? 'Di Atas KKM'
                                : detail.status === 'equal'
                                ? 'Pada KKM'
                                : detail.status === 'below'
                                ? 'Di Bawah KKM'
                                : 'Belum Dinilai'}
                            </span>
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referensi Deskripsi Tujuan Pembelajaran (TP 1 .. TP N) */}
      {subjectGroups.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Keterangan Kode Tujuan Pembelajaran (TP 1 – TP {maxTpCount}) · Urutan Sesuai Capaian & TP</span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {subjectGroups.length} Mata Pelajaran
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {subjectGroups.map(group => (
              <div key={`ref-${group.subjectKey}`} className="p-4 sm:px-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">{group.subjectLabel}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    KKM {group.kkm} · {group.tps.length} TP · {group.exams.length} Paket Ujian
                  </span>
                </div>

                {group.tps.length === 0 ? (
                  <p className="text-xs text-slate-400">Belum ada Tujuan Pembelajaran pada mata pelajaran ini.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    {group.tps.map((tp, idx) => (
                      <div
                        key={`${group.subjectKey}-${tp.key}`}
                        className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2 py-1"
                      >
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                          TP {idx + 1}:
                        </span>
                        <span className="leading-snug">
                          {tp.description}
                          {tp.questionOrders.length > 0 && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1.5 font-mono">
                              (Soal #{tp.questionOrders.join(', ')})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
