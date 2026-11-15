/**
 * Utilitas Tanggal & Waktu Lokal Sesuai Setting Regional Perangkat
 * Menghindari penggunaan waktu GMT+00 (.toISOString()) agar pencatatan dan pembacaan waktu akurat.
 */

export function parseFlexibleTimestamp(raw: any): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return raw;
  }
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isNaN(t) ? Date.now() : t;
  }
  const str = String(raw || '').trim();
  if (!str) return Date.now();

  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str);
    return str.length === 10 ? num * 1000 : num;
  }

  // Format umum: YYYY-MM-DD HH:mm:ss (tanpa Z -> tafsirkan sebagai waktu lokal)
  const spaceIsoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (spaceIsoMatch) {
    const [, y, m, d, hh, mm, ss = '0'] = spaceIsoMatch;
    const localDate = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    if (!Number.isNaN(localDate.getTime())) return localDate.getTime();
  }

  // Format regional ID/EU: DD/MM/YYYY[, ]HH[:.]mm[:.]ss
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/);
  if (dmyMatch) {
    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = dmyMatch;
    const localDate = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    if (!Number.isNaN(localDate.getTime())) return localDate.getTime();
  }

  const parsed = Date.parse(str);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function toLocalIsoString(input?: Date | number | string): string {
  const date =
    input instanceof Date
      ? input
      : input !== undefined && input !== null && input !== ''
      ? new Date(parseFlexibleTimestamp(input))
      : new Date();

  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (n: number) => String(n).padStart(2, '0');

  const year = safeDate.getFullYear();
  const month = pad(safeDate.getMonth() + 1);
  const day = pad(safeDate.getDate());
  const hours = pad(safeDate.getHours());
  const minutes = pad(safeDate.getMinutes());
  const seconds = pad(safeDate.getSeconds());

  // getTimezoneOffset() mengembalikan selisih menit (UTC - Local), misal WIB (-420) -> +07:00
  const offsetMinutes = -safeDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
}

export function getLocalDateInputValue(input?: Date | number | string): string {
  const date =
    input instanceof Date
      ? input
      : input !== undefined && input !== null && input !== ''
      ? new Date(parseFlexibleTimestamp(input))
      : new Date();

  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}-${pad(safeDate.getDate())}`;
}

export function getLocalTimezoneLabel(): string {
  const now = new Date();
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMins = Math.abs(offsetMinutes);
  const hrs = Math.floor(absMins / 60);
  const mins = absMins % 60;
  const utcOffsetStr = mins > 0 ? `UTC${sign}${hrs}:${String(mins).padStart(2, '0')}` : `UTC${sign}${hrs}`;

  if (offsetMinutes === 420) return `WIB (${utcOffsetStr})`;
  if (offsetMinutes === 480) return `WITA (${utcOffsetStr})`;
  if (offsetMinutes === 540) return `WIT (${utcOffsetStr})`;

  try {
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tzName ? `${tzName} (${utcOffsetStr})` : utcOffsetStr;
  } catch {
    return utcOffsetStr;
  }
}

export function formatChatDateTime(ts: number | string, includeSeconds = true): string {
  const ms = parseFlexibleTimestamp(ts);
  const date = new Date(ms);
  try {
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: false,
    });
  } catch {
    return toLocalIsoString(date).replace('T', ' ').slice(0, includeSeconds ? 19 : 16);
  }
}

export function formatChatShortDateTime(ts: number | string): string {
  const ms = parseFlexibleTimestamp(ts);
  const date = new Date(ms);
  try {
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return toLocalIsoString(date).replace('T', ' ').slice(5, 16);
  }
}

export function getLocalDayKey(ts: number | string): string {
  return getLocalDateInputValue(ts);
}

export function formatChatDayDivider(ts: number | string): string {
  const ms = parseFlexibleTimestamp(ts);
  const date = new Date(ms);
  const todayKey = getLocalDateInputValue(new Date());
  const yesterdayKey = getLocalDateInputValue(new Date(Date.now() - 86400000));
  const msgKey = getLocalDateInputValue(date);

  let datePart = '';
  try {
    datePart = date.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    datePart = msgKey;
  }

  if (msgKey === todayKey) return `Hari Ini · ${datePart}`;
  if (msgKey === yesterdayKey) return `Kemarin · ${datePart}`;
  return datePart;
}
