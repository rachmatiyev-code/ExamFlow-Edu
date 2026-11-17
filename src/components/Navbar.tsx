import React, { useState, useRef, useEffect } from 'react';
import { SchoolProfile, AppSettings, UiPreset } from '../types';
import {
  Sun,
  Moon,
  RefreshCw,
  CheckCircle2,
  Layout,
  PanelLeft,
  Rows3,
  Menu,
  X,
  ChevronDown,
  Check,
  Calendar,
  GraduationCap,
  FileText,
  ClipboardList,
  Printer,
  FileSpreadsheet,
  Activity,
  Edit3,
  Target,
  BarChart3,
  Users,
  UserCog,
  Building2,
  Code,
  MessageSquare,
  SlidersHorizontal
} from 'lucide-react';
import { sanitizeLogoUrl, SDN_PISANGCANDI_1_LOGO_SVG } from '../services/logoAssets';

export type MainTabType =
  | 'student'
  | 'teacher'
  | 'kisi-kisi'
  | 'naskah-soal'
  | 'laporan-cetak'
  | 'analisis-butir'
  | 'logs';

export type TeacherSubTabType =
  | 'exams'
  | 'questions'
  | 'curriculum'
  | 'analytics'
  | 'rekap'
  | 'tp_mastery'
  | 'students'
  | 'users'
  | 'profile'
  | 'gas'
  | 'chat';

interface NavbarProps {
  currentTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  teacherSubTab?: TeacherSubTabType;
  onSelectTeacherSubTab?: (subTab: TeacherSubTabType) => void;
  profile: SchoolProfile;
  settings: AppSettings;
  uiPreset: UiPreset;
  onSelectUiPreset: (preset: UiPreset) => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onManualSync: () => void;
  isSyncing: boolean;
  syncSuccessBanner: string | null;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapsed?: () => void;
  onOpenMobileSidebar?: () => void;
}

export const MAIN_NAV_ITEMS: Array<{
  id: MainTabType;
  label: string;
  shortLabel: string;
  group: 'portal' | 'cetak' | 'sistem';
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'student', label: 'Jadwal Ujian Siswa', shortLabel: 'Ujian Siswa', group: 'portal', icon: Calendar },
  { id: 'teacher', label: 'Portal Guru & Kelola', shortLabel: 'Portal Guru', group: 'portal', icon: GraduationCap },
  { id: 'laporan-cetak', label: 'Rapor Siswa', shortLabel: 'Rapor Siswa', group: 'cetak', icon: FileText },
  { id: 'kisi-kisi', label: 'Cetak Kisi-Kisi', shortLabel: 'Kisi-Kisi', group: 'cetak', icon: ClipboardList },
  { id: 'naskah-soal', label: 'Cetak Naskah Soal', shortLabel: 'Naskah Soal', group: 'cetak', icon: Printer },
  { id: 'analisis-butir', label: 'Analisis Butir Soal', shortLabel: 'Analisis Butir', group: 'cetak', icon: FileSpreadsheet },
  { id: 'logs', label: 'Log Koneksi', shortLabel: 'Log', group: 'sistem', icon: Activity }
];

export const TEACHER_SUB_NAV_ITEMS: Array<{
  id: TeacherSubTabType;
  label: string;
  group: 'ujian' | 'nilai' | 'kelola';
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'exams', label: 'Riwayat & Manajemen Ujian', group: 'ujian', icon: Calendar },
  { id: 'questions', label: 'Editor Soal & AI', group: 'ujian', icon: Edit3 },
  { id: 'curriculum', label: 'Capaian & TP (CP/TP)', group: 'ujian', icon: Target },
  { id: 'analytics', label: 'Dasbor Nilai Siswa', group: 'nilai', icon: BarChart3 },
  { id: 'rekap', label: 'Rekap Nilai (Mapel & Kelas)', group: 'nilai', icon: FileSpreadsheet },
  { id: 'tp_mastery', label: 'Analisis Capaian TP', group: 'nilai', icon: Target },
  { id: 'students', label: 'Data Siswa', group: 'kelola', icon: Users },
  { id: 'users', label: 'Kelola Pengguna', group: 'kelola', icon: UserCog },
  { id: 'profile', label: 'Profil Sekolah & Logo', group: 'kelola', icon: Building2 },
  { id: 'gas', label: 'Kode Google Apps Script', group: 'kelola', icon: Code },
  { id: 'chat', label: 'Chat & Bantuan Siswa', group: 'kelola', icon: MessageSquare }
];

const UI_PRESET_META: Array<{
  id: UiPreset;
  label: string;
  shortLabel: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'classic_clean',
    label: '1. Minimalis Rapi',
    shortLabel: 'Minimalis',
    desc: 'Header atas bersih & kartu tanpa kotak bertumpuk',
    icon: Layout
  },
  {
    id: 'sidebar_workspace',
    label: '2. Sidebar Workspace',
    shortLabel: 'Sidebar',
    desc: 'Navigasi utama & sub-menu guru di panel kiri',
    icon: PanelLeft
  },
  {
    id: 'academic_compact',
    label: '3. Akademik Kompak',
    shortLabel: 'Kompak',
    desc: 'Pita ganda hangat & baris padat cepat dipindai',
    icon: Rows3
  }
];

export const UiPresetSwitcher: React.FC<{
  uiPreset: UiPreset;
  onSelectUiPreset: (preset: UiPreset) => void;
  compact?: boolean;
}> = ({ uiPreset, onSelectUiPreset, compact = false }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const activeMeta = UI_PRESET_META.find(p => p.id === uiPreset) || UI_PRESET_META[0];
  const ActiveIcon = activeMeta.icon;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
        title="Pilih 3 Alternatif Tampilan Aplikasi"
      >
        <ActiveIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        {!compact && <span className="hidden sm:inline whitespace-nowrap">{activeMeta.shortLabel}</span>}
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-fadeIn">
          <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Alternatif Tampilan</span>
            <SlidersHorizontal className="w-3 h-3" />
          </div>
          <div className="space-y-1 mt-1">
            {UI_PRESET_META.map(preset => {
              const Icon = preset.icon;
              const isActive = preset.id === uiPreset;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onSelectUiPreset(preset.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold flex items-center justify-between">
                      <span>{preset.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                      {preset.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const WorkspaceSidebar: React.FC<{
  currentTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  teacherSubTab?: TeacherSubTabType;
  onSelectTeacherSubTab?: (subTab: TeacherSubTabType) => void;
  profile: SchoolProfile;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
}> = ({
  currentTab,
  onSelectTab,
  teacherSubTab = 'exams',
  onSelectTeacherSubTab,
  profile,
  mobileOpen,
  onCloseMobile,
  isCollapsed = false
}) => {
  const schoolLogoSrc = sanitizeLogoUrl(profile?.logoUrl, SDN_PISANGCANDI_1_LOGO_SVG);
  const schoolName = profile?.name || 'SD NEGERI PISANGCANDI 1 MALANG';
  const teacherName = profile?.teacherName || '';

  const portalItems = MAIN_NAV_ITEMS.filter(i => i.group === 'portal');
  const printItems = MAIN_NAV_ITEMS.filter(i => i.group === 'cetak');
  const systemItems = MAIN_NAV_ITEMS.filter(i => i.group === 'sistem');

  const renderNavContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full">
      {/* Sidebar Brand Header */}
      <div className="h-14 px-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => {
            onSelectTab('student');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer focus:outline-none"
        >
          <img
            src={schoolLogoSrc}
            alt={schoolName}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = SDN_PISANGCANDI_1_LOGO_SVG;
            }}
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight leading-tight truncate">
                ExamFlow <span className="text-indigo-600 dark:text-indigo-400">Edu</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={schoolName}>
                {schoolName}
              </div>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          aria-label="Tutup menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-2.5 space-y-5">
        {/* Group 1: Portal Utama */}
        <div>
          {!collapsed && (
            <div className="px-2.5 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Portal Utama
            </div>
          )}
          <div className="space-y-0.5">
            {portalItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      onCloseMobile();
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>

                  {/* Sub-menu Portal Guru muncul rapi terstruktur di sidebar saat tab Guru aktif */}
                  {item.id === 'teacher' && currentTab === 'teacher' && !collapsed && (
                    <div className="mt-1.5 ml-3 pl-2.5 border-l border-slate-200 dark:border-slate-800 space-y-3">
                      {([
                        { key: 'ujian', label: 'Ujian & Bank Soal' },
                        { key: 'nilai', label: 'Nilai & Analisis' },
                        { key: 'kelola', label: 'Pengguna & Sistem' }
                      ] as const).map(subGroup => (
                        <div key={subGroup.key} className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                            {subGroup.label}
                          </div>
                          {TEACHER_SUB_NAV_ITEMS.filter(s => s.group === subGroup.key).map(sub => {
                            const SubIcon = sub.icon;
                            const isSubActive = teacherSubTab === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  onSelectTeacherSubTab?.(sub.id);
                                  onCloseMobile();
                                }}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                                  isSubActive
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs border border-slate-200/80 dark:border-slate-700'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                <SubIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                <span className="truncate">{sub.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Group 2: Cetak & Laporan */}
        <div>
          {!collapsed && (
            <div className="px-2.5 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Cetak & Analisis
            </div>
          )}
          <div className="space-y-0.5">
            {printItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Group 3: Sistem */}
        <div>
          {!collapsed && (
            <div className="px-2.5 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Sistem
            </div>
          )}
          <div className="space-y-0.5">
            {systemItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer identity in sidebar */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">
            {teacherName || 'Mode Asesmen Digital'}
          </div>
          <div className="truncate">
            TP {profile?.academicYear || '2026/2027'} · {profile?.semester || 'Ganjil'}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen transition-all no-print ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderNavContent(isCollapsed)}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full shadow-2xl z-10">
            {renderNavContent(false)}
          </aside>
        </div>
      )}
    </>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  teacherSubTab = 'exams',
  onOpenSettings,
  profile,
  settings,
  uiPreset,
  onSelectUiPreset,
  onToggleTheme,
  onManualSync,
  isSyncing,
  syncSuccessBanner,
  onToggleSidebarCollapsed,
  onOpenMobileSidebar
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const schoolLogoSrc = sanitizeLogoUrl(profile?.logoUrl, SDN_PISANGCANDI_1_LOGO_SVG);
  const schoolName = profile?.name || 'SD NEGERI PISANGCANDI 1 MALANG';
  const teacherName = profile?.teacherName || '';
  const activeTabMeta = MAIN_NAV_ITEMS.find(m => m.id === currentTab) || MAIN_NAV_ITEMS[0];
  const activeSubTabMeta = TEACHER_SUB_NAV_ITEMS.find(s => s.id === teacherSubTab);

  const renderUtilityControls = (compactSwitch = false) => (
    <div className="flex items-center gap-2 shrink-0">
      {/* Quick 3-Appearance Switcher */}
      <UiPresetSwitcher
        uiPreset={uiPreset}
        onSelectUiPreset={onSelectUiPreset}
        compact={compactSwitch}
      />

      {/* Online Badge (Student) / Manual Sync (Teacher/Admin) */}
      {currentTab === 'student' ? (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border ${
            isOnline
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
          title={
            isOnline
              ? 'Perangkat terhubung ke internet'
              : 'Perangkat offline. Jawaban akan tetap tersimpan di memori perangkat.'
          }
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="hidden xl:inline whitespace-nowrap">
            {isOnline ? 'Online · Siap Ujian' : 'Offline (Lokal)'}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onManualSync}
          disabled={isSyncing}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all border cursor-pointer ${
            isSyncing
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 animate-pulse'
              : settings.gasWebAppUrl
              ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
          title={
            settings.gasWebAppUrl
              ? 'Sinkronkan data dengan Google Sheets'
              : 'Buka Pengaturan untuk memasukkan URL Web App Google Apps Script'
          }
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline whitespace-nowrap">
            {isSyncing ? 'Sync...' : settings.gasWebAppUrl ? 'Sync Sheets' : 'Hubungkan'}
          </span>
        </button>
      )}

      {/* Settings Trigger */}
      <button
        type="button"
        onClick={onOpenSettings}
        className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
        title="Pengaturan Aplikasi & API"
      >
        Pengaturan
      </button>

      {/* Dark / Light Toggle */}
      <button
        type="button"
        onClick={onToggleTheme}
        className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="Ganti Mode Gelap / Terang"
        aria-label="Toggle theme"
      >
        {settings.theme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-slate-600" />
        )}
      </button>
    </div>
  );

  // =========================================================================
  // ALTERNATIF 2: SIDEBAR WORKSPACE (Slim Contextual Header)
  // =========================================================================
  if (uiPreset === 'sidebar_workspace') {
    return (
      <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors no-print">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onToggleSidebarCollapsed}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Perkecil / Perlebar Sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex items-center gap-2 text-xs">
              <span className="text-slate-400 hidden sm:inline">ExamFlow Edu</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                {activeTabMeta.label}
              </span>
              {currentTab === 'teacher' && activeSubTabMeta && (
                <>
                  <span className="text-slate-300 dark:text-slate-700 hidden md:inline">/</span>
                  <span className="hidden md:inline text-indigo-600 dark:text-indigo-400 font-medium truncate">
                    {activeSubTabMeta.label}
                  </span>
                </>
              )}
            </div>
          </div>

          {renderUtilityControls(false)}
        </div>

        {syncSuccessBanner && (
          <div className="bg-emerald-600 text-white text-xs font-medium py-1.5 px-4 text-center flex items-center justify-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{syncSuccessBanner}</span>
          </div>
        )}
      </header>
    );
  }

  // =========================================================================
  // ALTERNATIF 3: AKADEMIK KOMPAK (2-Tier Sticky Academic Ribbon)
  // =========================================================================
  if (uiPreset === 'academic_compact') {
    return (
      <header className="sticky top-0 z-40 w-full bg-[#fbfaf7]/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-stone-200 dark:border-slate-800 transition-colors no-print">
        {/* Tier 1: Identity + Quick Controls */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-13 flex items-center justify-between gap-4 border-b border-stone-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={schoolLogoSrc}
              alt={schoolName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 p-0.5 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = SDN_PISANGCANDI_1_LOGO_SVG;
              }}
            />
            <button
              type="button"
              onClick={() => onSelectTab('student')}
              className="text-left group cursor-pointer focus:outline-none min-w-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                  ExamFlow <span className="text-indigo-600 dark:text-indigo-400">Edu</span>
                </span>
                <span className="hidden sm:inline text-stone-300 dark:text-slate-700">|</span>
                <span className="hidden sm:inline text-xs text-slate-600 dark:text-slate-400 truncate max-w-[260px]">
                  {schoolName}
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {renderUtilityControls(false)}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="md:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-stone-200/70 dark:hover:bg-slate-800"
              aria-label="Menu Navigasi"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Tier 2: Full-width Academic Menu Ribbon */}
        <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1 overflow-x-auto thin-scrollbar py-1 text-xs font-medium">
            {MAIN_NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-stone-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 space-y-1">
            {MAIN_NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {syncSuccessBanner && (
          <div className="bg-emerald-600 text-white text-xs font-medium py-1.5 px-4 text-center flex items-center justify-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{syncSuccessBanner}</span>
          </div>
        )}
      </header>
    );
  }

  // =========================================================================
  // ALTERNATIF 1: MINIMALIS RAPI (Classic Clean Topbar + Mobile Menu)
  // =========================================================================
  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Zone 1: Brand Wordmark with School Logo */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <img
            src={schoolLogoSrc}
            alt={schoolName}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-xl object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = SDN_PISANGCANDI_1_LOGO_SVG;
            }}
          />
          <button
            type="button"
            onClick={() => onSelectTab('student')}
            className="text-left group cursor-pointer focus:outline-none min-w-0"
          >
            <div className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              ExamFlow <span className="text-indigo-600 dark:text-indigo-400">Edu</span>
            </div>
            <div
              className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[150px] lg:max-w-[200px]"
              title={`${schoolName}${teacherName ? ` · ${teacherName}` : ''}`}
            >
              {schoolName} {teacherName ? `· ${teacherName}` : ''}
            </div>
          </button>
        </div>

        {/* Zone 2: Clean Single-Line Navigation Links (Responsive overflow) */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 overflow-x-auto thin-scrollbar">
          {MAIN_NAV_ITEMS.map(item => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions & Controls + Mobile Nav Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {renderUtilityControls(false)}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Menu Navigasi"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Menu Panel for < lg */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {MAIN_NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Real-time Sync Success Banner */}
      {syncSuccessBanner && (
        <div className="bg-emerald-600 text-white text-xs font-medium py-1.5 px-4 text-center flex items-center justify-center gap-2 animate-fadeIn transition-all">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{syncSuccessBanner}</span>
        </div>
      )}
    </header>
  );
};
