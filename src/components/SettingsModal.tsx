import React, { useState } from 'react';
import { AppSettings } from '../types';
import { StorageService } from '../services/storage';
import { GasClient, PingResult } from '../services/gasClient';
import { AiGeneratorService } from '../services/aiGenerator';
import { 
  X, 
  Key, 
  Database, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Volume2, 
  Moon, 
  Sun,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetData
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Testing states
  const [isPingingGas, setIsPingingGas] = useState(false);
  const [gasPingResult, setGasPingResult] = useState<PingResult | null>(null);

  const [isValidatingGemini, setIsValidatingGemini] = useState(false);
  const [geminiResult, setGeminiResult] = useState<{ valid: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestGas = async () => {
    setIsPingingGas(true);
    setGasPingResult(null);
    const res = await GasClient.ping(formData.gasWebAppUrl);
    setGasPingResult(res);
    setIsPingingGas(false);
  };

  const handleTestGemini = async () => {
    setIsValidatingGemini(true);
    setGeminiResult(null);
    const res = await AiGeneratorService.validateApiKey(formData.geminiApiKey);
    setGeminiResult(res);
    setIsValidatingGemini(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveSettings(formData);
    onUpdateSettings(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Pengaturan Aplikasi & Integrasi API
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Atur koneksi Google Apps Script dan Kunci API Gemini untuk kecerdasan buatan.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* SECTION 1: GOOGLE APPS SCRIPT SETTINGS */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label className="text-sm font-bold text-slate-900 dark:text-white">
                URL Google Apps Script (Web App)
              </label>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              URL hasil penyebaran (deploy) Web App dari spreadsheet Google Sheets Anda.
            </p>

            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={formData.gasWebAppUrl}
                onChange={(e) => setFormData({ ...formData, gasWebAppUrl: e.target.value })}
                className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleTestGas}
                disabled={isPingingGas}
                className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
              >
                {isPingingGas ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Tes Ping</span>
              </button>
            </div>

            {gasPingResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                  gasPingResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {gasPingResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{gasPingResult.message}</div>
                  {gasPingResult.latencyMs && (
                    <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                      Waktu respons: {gasPingResult.latencyMs}ms · Spreadsheet: {gasPingResult.spreadsheetName || 'Terkoneksi'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: GEMINI AI API KEY SETTINGS */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label className="text-sm font-bold text-slate-900 dark:text-white">
                Kunci API Gemini (Google AI Studio)
              </label>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Digunakan untuk pembuatan soal otomatis berbasis AI. Disimpan dengan aman di browser lokal Anda.
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={formData.geminiApiKey}
                  onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                  className="w-full pl-3 pr-9 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestGemini}
                disabled={isValidatingGemini}
                className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
              >
                {isValidatingGemini ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Validasi Kunci</span>
              </button>
            </div>

            {/* Model Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pilihan Model Gemini AI:
              </label>
              <select
                value={formData.geminiModel || 'gemini-3.8-flash'}
                onChange={(e) => setFormData({ ...formData, geminiModel: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="gemini-3.8-flash">gemini-3.8-flash (Rekomendasi Utama - Cepat & Seimbang)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Ringan - Tahan Antrean)</option>
                <option value="gemini-flash-latest">gemini-flash-latest (Versi Flash Terbaru)</option>
                <option value="gemini-4-argon">gemini-4-argon (Penalaran Kompleks & Analitis)</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Jika server Google sedang mengalami lonjakan beban (high demand) pada satu model, sistem otomatis beralih ke model cadangan.
              </span>
            </div>

            {geminiResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                  geminiResult.valid
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {geminiResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 font-semibold">{geminiResult.message}</div>
              </div>
            )}
          </div>

          {/* SECTION 3: APP PREFERENCES */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Preferensi Tampilan & Suara
            </h4>

            {/* Theme Selector */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                {formData.theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Mode Tema</div>
                  <div className="text-[11px] text-slate-400">Pilih tema terang atau gelap</div>
                </div>
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: 'light' })}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    formData.theme === 'light' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Terang
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: 'dark' })}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    formData.theme === 'dark' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Gelap
                </button>
              </div>
            </div>

            {/* Audio Chime */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-indigo-500" />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Efek Suara Selesai</div>
                  <div className="text-[11px] text-slate-400">Bunyi notifikasi saat ujian berhasil dikirim</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.enableAudioChime}
                onChange={(e) => setFormData({ ...formData, enableAudioChime: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (confirm('Pulihkan data bawaan awal? Perubahan lokal akan direset.')) {
                  onResetData();
                  onClose();
                }
              }}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Data Awal</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Tutup
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors"
              >
                Simpan Pengaturan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
