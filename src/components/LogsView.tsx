import React, { useState } from 'react';
import { AppLog } from '../types';
import { StorageService } from '../services/storage';
import { GasClient } from '../services/gasClient';
import { 
  Terminal, 
  Trash2, 
  RefreshCw, 
  Download, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  Layers
} from 'lucide-react';

interface LogsViewProps {
  logs: AppLog[];
  onRefresh: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, onRefresh }) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AppLog | null>(null);

  const filteredLogs = logs.filter(log => {
    if (filterCategory !== 'ALL' && log.category !== filterCategory) return false;
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        log.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleClearLogs = () => {
    if (confirm('Hapus semua riwayat catatan log debug?')) {
      StorageService.clearLogs();
      onRefresh();
    }
  };

  const handleExportLogs = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `examflow_debug_logs_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelBadge = (level: AppLog['level']) => {
    switch (level) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>SUCCESS</span>
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>WARNING</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>ERROR</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
            <Info className="w-3.5 h-3.5" />
            <span>INFO</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Konsol Log Koneksi & Pelacak Error</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit riwayat sinkronisasi Google Sheets, panggilan AI Gemini, dan peristiwa aplikasi secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor JSON</span>
          </button>
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Bersihkan Log</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="SYNC">SYNC (Google Sheets)</option>
            <option value="NETWORK">NETWORK (Koneksi Web)</option>
            <option value="AI_GEMINI">AI_GEMINI (Pembuat Soal)</option>
            <option value="EXAM">EXAM (Aktivitas Siswa)</option>
            <option value="AUTH">AUTH (Akses Pengguna)</option>
          </select>

          {/* Level Filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
          >
            <option value="ALL">Semua Level</option>
            <option value="info">INFO</option>
            <option value="success">SUCCESS</option>
            <option value="warn">WARNING</option>
            <option value="error">ERROR</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari kata kunci log..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Logs Table / Stream */}
      <div className="bg-slate-950 text-slate-200 rounded-xl border border-slate-800 shadow-md overflow-hidden font-mono text-xs">
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-400">
          <span>{filteredLogs.length} Entri Log Tercatat</span>
          <span className="text-[11px]">Format: [Waktu] [Kategori] [Status] Pesan</span>
        </div>

        <div className="max-h-[550px] overflow-y-auto divide-y divide-slate-800/60 p-2">
          {filteredLogs.map(log => (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className="p-2.5 hover:bg-slate-900/80 rounded-md transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-start sm:items-center gap-3">
                <span className="text-slate-400 tabular-nums shrink-0">
                  {log.timestamp}
                </span>

                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 shrink-0">
                  {log.category}
                </span>

                {getLevelBadge(log.level)}

                <span className="text-slate-200 truncate max-w-xl font-sans text-xs">
                  {log.message}
                </span>
              </div>

              {log.details && (
                <span className="text-[10px] text-indigo-400 hover:underline shrink-0">
                  Lihat Rincian
                </span>
              )}
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="p-8 text-center text-slate-400 font-sans text-xs">
              Tidak ada log yang sesuai dengan filter pencarian Anda.
            </div>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-slate-100 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 animate-fadeIn font-mono text-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <span className="font-bold text-indigo-400">Rincian Log [{selectedLog.category}]</span>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 font-sans">
              <div>
                <span className="text-slate-400 text-xs block">Waktu:</span>
                <span className="font-mono text-xs">{selectedLog.timestamp}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Pesan:</span>
                <p className="text-xs font-semibold text-white">{selectedLog.message}</p>
              </div>
              {selectedLog.details && (
                <div>
                  <span className="text-slate-400 text-xs block mb-1">Rincian / Payload:</span>
                  <pre className="p-3 bg-slate-950 rounded-lg text-slate-300 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-56">
                    {selectedLog.details}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg font-sans font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
