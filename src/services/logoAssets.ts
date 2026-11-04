/**
 * Assets Logo Resmi untuk Kop Surat Kedinasan
 * Logo Pemkot Malang: Lambang Perisai Segi Lima Hijau dengan Bintang Emas, Tugu Malang, dan Semboyan Malangkuçeçwara
 */

export const PEMKOT_MALANG_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 180" width="160" height="180">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%2316a34a"/>
      <stop offset="100%" stop-color="%2315803d"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23fde047"/>
      <stop offset="100%" stop-color="%23ca8a04"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Outer Pentagon Border (Red) -->
  <polygon points="80,8 152,52 126,168 34,168 8,52" fill="%23dc2626" filter="url(%23shadow)"/>

  <!-- Middle Border (Gold) -->
  <polygon points="80,14 146,55 122,162 38,162 14,55" fill="url(%23goldGrad)"/>

  <!-- Inner Pentagon Shield (Green) -->
  <polygon points="80,20 140,58 118,156 42,156 20,58" fill="url(%23shieldGrad)"/>

  <!-- Top Yellow Star -->
  <polygon points="80,30 84,42 96,42 86,50 90,62 80,54 70,62 74,50 64,42 76,42" fill="%23facc15" stroke="%23a16207" stroke-width="0.8"/>

  <!-- Tugu Malang (Monument in Center) -->
  <!-- Base Pedestal -->
  <rect x="52" y="126" width="56" height="10" rx="1.5" fill="%231e3a8a" stroke="%23ffffff" stroke-width="0.8"/>
  <rect x="58" y="118" width="44" height="8" rx="1" fill="%232563eb" stroke="%23ffffff" stroke-width="0.8"/>
  <rect x="64" y="112" width="32" height="6" fill="%233b82f6" stroke="%23ffffff" stroke-width="0.6"/>

  <!-- Monument Shaft / Body -->
  <polygon points="73,112 87,112 85,72 75,72" fill="%230284c7" stroke="%23ffffff" stroke-width="0.8"/>
  <polygon points="75,72 85,72 83,56 77,56" fill="%2338bdf8" stroke="%23ffffff" stroke-width="0.6"/>
  <!-- Pinnacle / Peak -->
  <polygon points="80,48 84,56 76,56" fill="%23facc15" stroke="%23ffffff" stroke-width="0.6"/>

  <!-- Water Ripples / Foundation waves -->
  <path d="M50,140 Q65,137 80,140 T110,140" fill="none" stroke="%23ffffff" stroke-width="1.2"/>
  <path d="M46,144 Q63,141 80,144 T114,144" fill="none" stroke="%23ffffff" stroke-width="1.2"/>

  <!-- Ribbon Banner at Bottom: MALANGKUÇEÇWARA -->
  <path d="M28,148 L132,148 L128,162 L32,162 Z" fill="%23ffffff" stroke="%231e293b" stroke-width="0.8"/>
  <polygon points="28,148 20,155 28,162 26,155" fill="%23cbd5e1" stroke="%231e293b" stroke-width="0.6"/>
  <polygon points="132,148 140,155 132,162 134,155" fill="%23cbd5e1" stroke="%231e293b" stroke-width="0.6"/>
  <text x="80" y="158" font-family="Arial, sans-serif" font-size="7.5" font-weight="bold" fill="%230f172a" text-anchor="middle" letter-spacing="0.5">MALANGKUÇEÇWARA</text>
</svg>`;

export const SDN_PISANGCANDI_1_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <circle cx="80" cy="80" r="74" fill="%23ffffff" stroke="%23dc2626" stroke-width="5"/>
  <circle cx="80" cy="80" r="67" fill="%23ffffff" stroke="%232563eb" stroke-width="2"/>
  <path id="curve" d="M 24,80 A 56,56 0 1,1 136,80" fill="none"/>
  <text font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="%231e293b" letter-spacing="1">
    <textPath href="%23curve" startOffset="50%" text-anchor="middle">SD NEGERI PISANGCANDI 1</textPath>
  </text>
  <path id="curveBottom" d="M 136,80 A 56,56 0 0,1 24,80" fill="none"/>
  <text font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="%23dc2626" letter-spacing="1">
    <textPath href="%23curveBottom" startOffset="50%" text-anchor="middle">KOTA MALANG</textPath>
  </text>
  <!-- Center Torch & Book -->
  <path d="M52,105 Q80,95 108,105 L104,115 Q80,105 56,115 Z" fill="%230284c7" stroke="%23ffffff" stroke-width="1"/>
  <polygon points="76,60 84,60 82,95 78,95" fill="%23d97706"/>
  <path d="M80,42 Q86,52 80,60 Q74,52 80,42 Z" fill="%23ef4444"/>
  <path d="M80,47 Q83,53 80,58 Q77,53 80,47 Z" fill="%23facc15"/>
</svg>`;

/**
 * Normalizer untuk URL gambar agar selalu aman ditampilkan di <img src="..." />
 * Mendukung data URI SVG, Base64 PNG/JPG, raw SVG string, dan standard HTTPS URLs
 */
export function sanitizeLogoUrl(rawUrl?: string, fallback: string = PEMKOT_MALANG_LOGO_SVG): string {
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed) return fallback;

  // Jika berupa raw SVG (<svg ...</svg>), ubah menjadi valid SVG Data URI
  if (trimmed.startsWith('<svg') || trimmed.includes('xmlns="http://www.w3.org/2000/svg"')) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
  }

  // Jika URL biasa atau data URI
  if (
    trimmed.startsWith('http://') || 
    trimmed.startsWith('https://') || 
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('./assets/')
  ) {
    return trimmed;
  }

  // Jika hanya berupa Base64 murni tanpa prefix data URI
  if (trimmed.startsWith('/9j/') || trimmed.startsWith('iVBORw0KGgo')) {
    return `data:image/png;base64,${trimmed}`;
  }

  return trimmed;
}
