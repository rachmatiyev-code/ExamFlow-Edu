import React, { useMemo, useState } from 'react';
import { Exam, Student, Submission, UiPreset } from '../types';
import { StorageService } from '../services/storage';
import { getLocalDateInputValue, parseFlexibleTimestamp } from '../services/dateTimeHelper';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Check,
  Search,
  Users,
  BookOpen,
  UserX,
  BarChart3
} from 'lucide-react';

interface TodayExamParticipationCardProps {
  exams: Exam[];
  students: Student[];
  submissions: Submission[];
  uiPreset?: UiPreset;
  onCreateExam?: () => void;
  onSelectSubjectFilter?: (subject: string) => void;
}

interface PendingStudentInfo {
  key: string;
  studentNo: string;
  fullName: string;
  classGrade: string;
  missingExamTitles: string[];
  hasAutoZero: boolean;
}

interface SubjectParticipationSummary {
  subject: string;
  exams: Exam[];
  classesLabel: string;
  totalTarget: number;
  completedCount: number;
  pendingCount: number;
  completionRate: number;
  pendingStudents: PendingStudentInfo[];
}

function normalizeNumericId(val?: string | number | null): string {
  const clean = String(val ?? '').trim().toLowerCase();
  if (!clean) return '';
  return /^\d+$/.test(clean) ? (clean.replace(/^0+/, '') || '0') : clean;
}

function normalizeNameStr(val?: string | null): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function extractLocalDayKey(raw?: string | null): string | null {
  const str = String(raw || '').trim();
  if (!str) return null;
  const isoDateMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:$|[\sT])/);
  if (isoDateMatch) return isoDateMatch[1];
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const ms = parseFlexibleTimestamp(str);
  if (!Number.isFinite(ms)) return null;
  return getLocalDateInputValue(ms);
}

function isResetSubmissionEntry(sub: Submission): boolean {
  const rawNote = String(sub.statusNote || '').toLowerCase();
  return (
    sub.allowRepeat === true ||
    String(sub.allowRepeat).toLowerCase() === 'true' ||
    String(sub.allowRepeat) === '1' ||
    rawNote.includes('ulang') ||
    rawNote.includes('reset') ||
    rawNote.includes('retake')
  );
}

function matchSubToExam(sub: Submission, exam: Exam): boolean {
  const sExId = String(sub.examId || '').trim().toLowerCase();
  const exId = String(exam.id || '').trim().toLowerCase();
  if (sExId && exId && sExId === exId) return true;
  const sTitle = String(sub.examTitle || '').trim().toLowerCase();
  const exTitle = String(exam.title || '').trim().toLowerCase();
  return Boolean(!sExId && sTitle && exTitle && sTitle === exTitle);
}

function doesSubmissionMatchStudent(sub: Submission, st: Student): boolean {
  const subNo = normalizeNumericId(sub.studentNo);
  const stNos = [
    normalizeNumericId(st.studentNo),
    normalizeNumericId(st.nis),
    normalizeNumericId(st.nisn)
  ].filter(Boolean);

  if (subNo && stNos.some(n => n === subNo)) return true;

  const subName = normalizeNameStr(sub.studentName);
  const stName = normalizeNameStr(st.fullName);
  return Boolean(subName && stName && subName === stName);
}

export const TodayExamParticipationCard: React.FC<TodayExamParticipationCardProps> = ({
  exams,
  students,
  submissions,
  uiPreset = 'classic_clean',
  onCreateExam,
  onSelectSubjectFilter
}) => {
  const [scopeMode, setScopeMode] = useState<'today' | 'all_active'>('today');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [copiedSubject, setCopiedSubject] = useState<string | null>(null);

  const todayKey = getLocalDateInputValue(new Date());
  const todayFormatted = useMemo(() => {
    try {
      return new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return todayKey;
    }
  }, [todayKey]);

  const activeRoster = useMemo(() => {
    const map = new Map<string, Student>();
    (students || [])
      .filter(st => st && st.status !== 'inactive')
      .forEach(st => {
        const key = normalizeNumericId(st.studentNo || st.nis || st.nisn) || normalizeNameStr(st.fullName) || st.id;
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, st);
        }
      });
    return Array.from(map.values()).sort((a, b) =>
      String(a.fullName || '').localeCompare(String(b.fullName || ''), 'id', { sensitivity: 'base' })
    );
  }, [students]);

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    activeRoster.forEach(st => {
      const c = String(st.classGrade || '').trim();
      if (c) set.add(c);
    });
    (exams || []).forEach(ex => {
      const g = String(ex.grade || '').trim();
      if (g && g.toLowerCase() !== 'umum' && g.toLowerCase() !== 'semua') {
        set.add(g);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [activeRoster, exams]);

  const activeExamsAll = useMemo(() => {
    return (exams || []).filter(ex => ex && ex.status !== 'archived' && ex.status !== 'draft');
  }, [exams]);

  const targetExams = useMemo(() => {
    if (scopeMode === 'all_active') return activeExamsAll;

    return activeExamsAll.filter(ex => {
      const startDay = extractLocalDayKey(ex.startsAt);
      const endDay = extractLocalDayKey(ex.endsAt);
      const sessionStartDay = extractLocalDayKey(ex.sessionStartedAt);
      const sessionEndDay = extractLocalDayKey(ex.sessionEndedAt);

      if (StorageService.isExamSessionOpen(ex)) return true;

      if (startDay && endDay && startDay <= todayKey && endDay >= todayKey) return true;
      if (startDay === todayKey || endDay === todayKey) return true;
      if (sessionStartDay === todayKey || sessionEndDay === todayKey) return true;

      const hasSubmissionToday = (submissions || []).some(sub => {
        if (!sub || !matchSubToExam(sub, ex)) return false;
        if (isResetSubmissionEntry(sub) || StorageService.isAutoZeroSubmission(sub)) return false;
        const subDay = extractLocalDayKey(sub.submittedAt);
        return subDay === todayKey;
      });
      if (hasSubmissionToday) return true;

      // Konsisten dengan halaman siswa ("Jadwal Ujian Tersedia Hari Ini"):
      // Ujian aktif yang tidak diberi batas tanggal spesifik tetap tampil sebagai jadwal tersedia hari ini.
      const hasNoExplicitDate = !startDay && !endDay;
      if (hasNoExplicitDate && ex.status === 'active' && ex.sessionStatus !== 'ended' && !StorageService.isExamStopped(ex)) {
        return true;
      }

      return false;
    });
  }, [activeExamsAll, scopeMode, todayKey, submissions]);

  const subjectSummaries = useMemo<SubjectParticipationSummary[]>(() => {
    const bySubject = new Map<string, Exam[]>();
    targetExams.forEach(ex => {
      if (classFilter !== 'all' && !StorageService.isGradeCompatible(classFilter, ex.grade)) {
        return;
      }
      const subject = String(ex.subject || '').trim() || 'Umum';
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject)!.push(ex);
    });

    const filteredRoster = classFilter === 'all'
      ? activeRoster
      : activeRoster.filter(st => StorageService.isGradeCompatible(st.classGrade, classFilter));

    const results: SubjectParticipationSummary[] = [];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    bySubject.forEach((subjectExams, subject) => {
      const classSet = new Set<string>();
      subjectExams.forEach(ex => {
        const g = String(ex.grade || '').trim();
        if (g) classSet.add(g);
      });

      const validSubsForSubject = (submissions || []).filter(sub =>
        sub && subjectExams.some(ex => matchSubToExam(sub, ex))
      );

      let completedCount = 0;
      const pendingStudents: PendingStudentInfo[] = [];
      const matchedRosterKeys = new Set<string>();

      filteredRoster.forEach(st => {
        const applicableExams = subjectExams.filter(ex =>
          StorageService.isGradeCompatible(st.classGrade, ex.grade)
        );
        if (applicableExams.length === 0) return;

        const stKey = normalizeNumericId(st.studentNo || st.nis || st.nisn) || normalizeNameStr(st.fullName) || st.id;
        matchedRosterKeys.add(stKey);

        const missingExamTitles: string[] = [];
        let hasAutoZero = false;

        applicableExams.forEach(ex => {
          const examSubs = validSubsForSubject.filter(sub =>
            matchSubToExam(sub, ex) && doesSubmissionMatchStudent(sub, st)
          );

          const hasRealCompletion = examSubs.some(sub =>
            !isResetSubmissionEntry(sub) && !StorageService.isAutoZeroSubmission(sub)
          );

          if (!hasRealCompletion) {
            missingExamTitles.push(ex.title || ex.id);
            if (examSubs.some(sub => StorageService.isAutoZeroSubmission(sub))) {
              hasAutoZero = true;
            }
          }
        });

        if (missingExamTitles.length === 0) {
          completedCount += 1;
        } else {
          pendingStudents.push({
            key: stKey,
            studentNo: st.studentNo || st.nis || '-',
            fullName: st.fullName || 'Tanpa Nama',
            classGrade: st.classGrade || '-',
            missingExamTitles,
            hasAutoZero
          });
        }
      });

      // Hitung juga submisi sah dari siswa yang mungkin belum masuk roster lokal
      const extraCompletedKeys = new Set<string>();
      validSubsForSubject.forEach(sub => {
        if (isResetSubmissionEntry(sub) || StorageService.isAutoZeroSubmission(sub)) return;
        if (classFilter !== 'all' && sub.classGrade && !StorageService.isGradeCompatible(sub.classGrade, classFilter)) {
          return;
        }
        const alreadyInRoster = filteredRoster.some(st => doesSubmissionMatchStudent(sub, st));
        if (!alreadyInRoster) {
          const extKey = normalizeNumericId(sub.studentNo) || normalizeNameStr(sub.studentName) || sub.id;
          if (extKey && !matchedRosterKeys.has(extKey)) {
            extraCompletedKeys.add(extKey);
          }
        }
      });
      completedCount += extraCompletedKeys.size;

      const filteredPending = normalizedQuery
        ? pendingStudents.filter(p =>
            subject.toLowerCase().includes(normalizedQuery) ||
            p.fullName.toLowerCase().includes(normalizedQuery) ||
            p.studentNo.toLowerCase().includes(normalizedQuery) ||
            p.classGrade.toLowerCase().includes(normalizedQuery)
          )
        : pendingStudents;

      const subjectMatchesQuery = !normalizedQuery ||
        subject.toLowerCase().includes(normalizedQuery) ||
        filteredPending.length > 0;

      if (!subjectMatchesQuery) return;

      const pendingCount = pendingStudents.length;
      const totalTarget = completedCount + pendingCount;
      const completionRate = totalTarget > 0 ? Math.round((completedCount / totalTarget) * 100) : 0;

      results.push({
        subject,
        exams: subjectExams,
        classesLabel: Array.from(classSet).join(', ') || 'Semua Kelas',
        totalTarget,
        completedCount,
        pendingCount,
        completionRate,
        pendingStudents: filteredPending
      });
    });

    return results.sort((a, b) => a.subject.localeCompare(b.subject, 'id', { sensitivity: 'base' }));
  }, [targetExams, activeRoster, submissions, classFilter, searchQuery]);

  const totals = useMemo(() => {
    const totalCompleted = subjectSummaries.reduce((acc, item) => acc + item.completedCount, 0);
    const totalPending = subjectSummaries.reduce((acc, item) => acc + item.pendingCount, 0);
    const totalExpected = totalCompleted + totalPending;
    const rate = totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0;
    return {
      subjectCount: subjectSummaries.length,
      totalCompleted,
      totalPending,
      totalExpected,
      rate
    };
  }, [subjectSummaries]);

  const handleCopyPendingList = async (summary: SubjectParticipationSummary) => {
    if (summary.pendingStudents.length === 0) return;
    const lines = [
      `Siswa Belum Mengerjakan — ${summary.subject} (${todayFormatted})`,
      ...summary.pendingStudents.map(
        (p, idx) => `${idx + 1}. ${p.fullName} (NIS: ${p.studentNo} · ${p.classGrade})`
      )
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSubject(summary.subject);
      setTimeout(() => {
        setCopiedSubject(prev => (prev === summary.subject ? null : prev));
      }, 2200);
    } catch {
      // Abaikan bila clipboard ditolak oleh browser
    }
  };

  const toggleExpandSubject = (subject: string) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subject]: !prev[subject]
    }));
  };

  const isCompact = uiPreset === 'academic_compact';

  return (
    <section
      aria-label="Ringkasan partisipasi ujian hari ini per mata pelajaran"
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 ${
        isCompact ? 'p-4' : 'p-5'
      } space-y-4`}
    >
      {/* Top Header & Functional Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Ringkasan Partisipasi Ujian per Mata Pelajaran
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
            <span>{scopeMode === 'today' ? `Jadwal Hari Ini · ${todayFormatted}` : 'Semua Ujian Aktif'}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{totals.subjectCount} Mata Pelajaran</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{activeRoster.length} Siswa Terdaftar</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Scope Switcher */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setScopeMode('today')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scopeMode === 'today'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ujian Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setScopeMode('all_active')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scopeMode === 'all_active'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua Aktif ({activeExamsAll.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Tampilkan Rincian</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Ringkas</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Aggregate Visual Comparison Bar + Quick Metrics */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-5 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Sudah Mengerjakan
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
              {totals.totalCompleted}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Belum Mengerjakan
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
              {totals.totalPending}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Partisipasi Total
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {totals.rate}%
            </div>
          </div>
        </div>

        {/* Visual Proportional Bar + Legend */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Sudah ({totals.totalCompleted})</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Belum ({totals.totalPending})</span>
              </span>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {totals.totalCompleted} / {totals.totalExpected} pengerjaan
            </span>
          </div>
          <div
            className="h-3 w-full rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden flex border border-slate-200/70 dark:border-slate-700/70"
            role="img"
            aria-label={`Perbandingan visual: ${totals.totalCompleted} sudah mengerjakan vs ${totals.totalPending} belum mengerjakan`}
          >
            {totals.totalExpected > 0 ? (
              <>
                <div
                  className="bg-emerald-500 dark:bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(totals.totalCompleted / totals.totalExpected) * 100}%` }}
                />
                <div
                  className="bg-rose-400 dark:bg-rose-500/80 transition-all duration-300"
                  style={{ width: `${(totals.totalPending / totals.totalExpected) * 100}%` }}
                />
              </>
            ) : (
              <div className="w-full bg-slate-200 dark:bg-slate-700" />
            )}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Filter Bar */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari mata pelajaran, nama siswa, atau NIS..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Filter Kelas:
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
              >
                <option value="all">Semua Kelas</option>
                {availableClasses.map(cls => (
                  <option key={cls} value={cls}>Kelas {cls}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Per-Subject Visual Cards */}
          {subjectSummaries.length === 0 ? (
            <div className="py-8 px-4 text-center border-t border-slate-100 dark:border-slate-800 space-y-3">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto opacity-70" />
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {scopeMode === 'today' && activeExamsAll.length > 0
                    ? 'Tidak ada jadwal ujian yang cocok untuk hari ini'
                    : 'Belum ada data ujian aktif untuk diringkas'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  {searchQuery
                    ? 'Tidak ditemukan mata pelajaran atau nama siswa sesuai kata kunci pencarian.'
                    : scopeMode === 'today' && activeExamsAll.length > 0
                    ? 'Terdapat ujian aktif di luar jadwal tanggal hari ini. Anda dapat menampilkan seluruh ujian aktif atau membuat ujian baru.'
                    : 'Buat paket ujian aktif dan pastikan daftar siswa telah terisi untuk memantau progres pengerjaan.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Bersihkan Pencarian
                  </button>
                )}
                {scopeMode === 'today' && activeExamsAll.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setScopeMode('all_active')}
                    className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Tampilkan Semua Ujian Aktif ({activeExamsAll.length})
                  </button>
                )}
                {onCreateExam && (
                  <button
                    type="button"
                    onClick={onCreateExam}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Buat Ujian Baru
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 ${
                isCompact ? 'xl:grid-cols-2 gap-3' : 'xl:grid-cols-3 gap-4'
              }`}
            >
              {subjectSummaries.map(summary => {
                const isExpanded = Boolean(expandedSubjects[summary.subject]) || Boolean(searchQuery.trim());
                const visiblePending = isExpanded
                  ? summary.pendingStudents
                  : summary.pendingStudents.slice(0, 5);
                const hiddenCount = Math.max(0, summary.pendingStudents.length - visiblePending.length);

                const completedPct =
                  summary.totalTarget > 0 ? (summary.completedCount / summary.totalTarget) * 100 : 0;
                const pendingPct =
                  summary.totalTarget > 0 ? (summary.pendingCount / summary.totalTarget) * 100 : 0;

                return (
                  <article
                    key={summary.subject}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-4 flex flex-col justify-between gap-3.5"
                  >
                    <div className="space-y-3">
                      {/* Card Title + Quiet Unboxed Metadata */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onSelectSubjectFilter && onSelectSubjectFilter(summary.subject)}
                            className="text-left group cursor-pointer"
                            title="Klik untuk memfilter daftar ujian ke mata pelajaran ini"
                          >
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                              {summary.subject}
                            </h4>
                          </button>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                            <span>Kelas {summary.classesLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{summary.exams.length} Paket</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{summary.totalTarget} Siswa</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-sm font-bold font-mono tabular-nums ${
                              summary.completionRate >= 80
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : summary.completionRate >= 50
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {summary.completionRate}%
                          </span>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            Selesai
                          </div>
                        </div>
                      </div>

                      {/* Stacked Visual Comparison Bar */}
                      <div className="space-y-2">
                        <div
                          className="h-2.5 w-full rounded-md bg-slate-200/70 dark:bg-slate-800 overflow-hidden flex"
                          role="img"
                          aria-label={`${summary.subject}: ${summary.completedCount} sudah mengerjakan, ${summary.pendingCount} belum mengerjakan`}
                        >
                          {summary.totalTarget > 0 ? (
                            <>
                              <div
                                className="bg-emerald-500 dark:bg-emerald-500 transition-all duration-300"
                                style={{ width: `${completedPct}%` }}
                              />
                              <div
                                className="bg-rose-400 dark:bg-rose-500/85 transition-all duration-300"
                                style={{ width: `${pendingPct}%` }}
                              />
                            </>
                          ) : (
                            <div className="w-full bg-slate-200 dark:bg-slate-700" />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-0.5">
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Sudah:</span>
                            <span className="font-mono font-bold tabular-nums">{summary.completedCount}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-medium">
                            <UserX className="w-3.5 h-3.5 shrink-0" />
                            <span>Belum:</span>
                            <span className="font-mono font-bold tabular-nums">{summary.pendingCount}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pending Students List */}
                      <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Siswa Belum Mengerjakan ({summary.pendingStudents.length})</span>
                          </span>

                          {summary.pendingStudents.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleCopyPendingList(summary)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                              title="Salin daftar nama siswa yang belum mengerjakan"
                            >
                              {copiedSubject === summary.subject ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600 dark:text-emerald-400">Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Salin Nama</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {summary.totalTarget === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
                            Belum ada data siswa yang cocok dengan kelas mata pelajaran ini.
                          </p>
                        ) : summary.pendingStudents.length === 0 ? (
                          <div className="flex items-center gap-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>
                              {searchQuery.trim()
                                ? 'Tidak ada siswa belum mengerjakan yang cocok dengan pencarian.'
                                : 'Semua siswa sudah mengerjakan ujian ini.'}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/80 max-h-56 overflow-y-auto thin-scrollbar pr-1">
                              {visiblePending.map((st, idx) => (
                                <li
                                  key={st.key}
                                  className="py-1.5 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="flex items-baseline gap-2 min-w-0">
                                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums w-5 shrink-0">
                                      {idx + 1}.
                                    </span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                      {st.fullName}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                                    {st.classGrade}
                                    {st.studentNo && st.studentNo !== '-' ? ` · ${st.studentNo}` : ''}
                                  </div>
                                </li>
                              ))}
                            </ul>

                            {(hiddenCount > 0 || (isExpanded && summary.pendingStudents.length > 5 && !searchQuery.trim())) && (
                              <button
                                type="button"
                                onClick={() => toggleExpandSubject(summary.subject)}
                                className="w-full pt-1.5 text-left text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    <span>Tampilkan lebih ringkas</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    <span>Lihat semua {summary.pendingStudents.length} siswa (+{hiddenCount} lainnya)</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};
