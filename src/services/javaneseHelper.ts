export interface AksaraItem {
  char: string;
  preview?: string;
  latin: string;
  name: string;
  note?: string;
}

export const AKSARA_NGLEGENA: AksaraItem[] = [
  { char: 'ꦲ', latin: 'ha / a', name: 'Ha' },
  { char: 'ꦤ', latin: 'na', name: 'Na' },
  { char: 'ꦕ', latin: 'ca', name: 'Ca' },
  { char: 'ꦫ', latin: 'ra', name: 'Ra' },
  { char: 'ꦏ', latin: 'ka', name: 'Ka' },
  { char: 'ꦢ', latin: 'da', name: 'Da' },
  { char: 'ꦠ', latin: 'ta', name: 'Ta' },
  { char: 'ꦱ', latin: 'sa', name: 'Sa' },
  { char: 'ꦮ', latin: 'wa', name: 'Wa' },
  { char: 'ꦭ', latin: 'la', name: 'La' },
  { char: 'ꦥ', latin: 'pa', name: 'Pa' },
  { char: 'ꦝ', latin: 'dha', name: 'Dha' },
  { char: 'ꦗ', latin: 'ja', name: 'Ja' },
  { char: 'ꦪ', latin: 'ya', name: 'Ya' },
  { char: 'ꦚ', latin: 'nya', name: 'Nya' },
  { char: 'ꦩ', latin: 'ma', name: 'Ma' },
  { char: 'ꦒ', latin: 'ga', name: 'Ga' },
  { char: 'ꦧ', latin: 'ba', name: 'Ba' },
  { char: 'ꦛ', latin: 'tha', name: 'Tha' },
  { char: 'ꦔ', latin: 'nga', name: 'Nga' },
];

export const AKSARA_KHUSUS_SWARA_REKAN: AksaraItem[] = [
  { char: 'ꦉ', latin: 'rê (pa cerek)', name: 'Pa Cerek', note: 'Pengganti ra + pepet' },
  { char: 'ꦊ', latin: 'lê (nga lelet)', name: 'Nga Lelet', note: 'Pengganti la + pepet' },
  { char: 'ꦄ', latin: 'A', name: 'Aksara Swara A', note: 'Vokal A mandiri (kata serapan)' },
  { char: 'ꦆ', latin: 'I', name: 'Aksara Swara I', note: 'Vokal I mandiri' },
  { char: 'ꦈ', latin: 'U', name: 'Aksara Swara U', note: 'Vokal U mandiri' },
  { char: 'ꦌ', latin: 'E', name: 'Aksara Swara E', note: 'Vokal E mandiri' },
  { char: 'ꦎ', latin: 'O', name: 'Aksara Swara O', note: 'Vokal O mandiri' },
  { char: 'ꦏ꦳', latin: 'kha', name: 'Rekan Kha', note: 'Ka + cecak telu' },
  { char: 'ꦢ꦳', latin: 'dza', name: 'Rekan Dza', note: 'Da + cecak telu' },
  { char: 'ꦥ꦳', latin: 'fa / va', name: 'Rekan Fa/Va', note: 'Pa + cecak telu' },
  { char: 'ꦗ꦳', latin: 'za', name: 'Rekan Za', note: 'Ja + cecak telu' },
  { char: 'ꦒ꦳', latin: 'gha', name: 'Rekan Gha', note: 'Ga + cecak telu' },
];

export const AKSARA_MURDA: AksaraItem[] = [
  { char: 'ꦟ', latin: 'Na Murda', name: 'Na Murda', note: 'Huruf kapital/penghormatan N' },
  { char: 'ꦑ', latin: 'Ka Murda', name: 'Ka Murda', note: 'Huruf kapital/penghormatan K' },
  { char: 'ꦡ', latin: 'Ta Murda', name: 'Ta Murda', note: 'Huruf kapital/penghormatan T' },
  { char: 'ꦯ', latin: 'Sa Murda', name: 'Sa Murda', note: 'Huruf kapital/penghormatan S' },
  { char: 'ꦦ', latin: 'Pa Murda', name: 'Pa Murda', note: 'Huruf kapital/penghormatan P' },
  { char: 'ꦘ', latin: 'Nya Murda', name: 'Nya Murda', note: 'Huruf kapital/penghormatan Ny' },
  { char: 'ꦓ', latin: 'Ga Murda', name: 'Ga Murda', note: 'Huruf kapital/penghormatan G' },
  { char: 'ꦨ', latin: 'Ba Murda', name: 'Ba Murda', note: 'Huruf kapital/penghormatan B' },
  { char: 'ꦖ', latin: 'Ca Murda', name: 'Ca Murda', note: 'Varian Murda C (jarang)' },
];

export const SANDHANGAN_SWARA: AksaraItem[] = [
  { char: 'ꦶ', preview: 'ꦲꦶ', latin: 'i (wulu)', name: 'Wulu', note: 'Mengubah vokal menjadi i (contoh: ꦲꦶ = hi)' },
  { char: 'ꦸ', preview: 'ꦲꦸ', latin: 'u (suku)', name: 'Suku', note: 'Mengubah vokal menjadi u (contoh: ꦲꦸ = hu)' },
  { char: 'ꦺ', preview: 'ꦲꦺ', latin: 'é / è (taling)', name: 'Taling', note: 'Mengubah vokal menjadi é/è (contoh: ꦲꦺ = hé)' },
  { char: 'ꦼ', preview: 'ꦲꦼ', latin: 'ê (pepet)', name: 'Pepet', note: 'Mengubah vokal menjadi ê lemah (contoh: ꦲꦼ = hê)' },
  { char: 'ꦺꦴ', preview: 'ꦲꦺꦴ', latin: 'o (taling tarung)', name: 'Taling Tarung', note: 'Mengubah vokal menjadi o (contoh: ꦲꦺꦴ = ho)' },
  { char: 'ꦷ', preview: 'ꦲꦷ', latin: 'ī (wulu melik)', name: 'Wulu Melik', note: 'Vokal i panjang' },
  { char: 'ꦹ', preview: 'ꦲꦹ', latin: 'ū (suku mendut)', name: 'Suku Mendut', note: 'Vokal u panjang' },
  { char: 'ꦻ', preview: 'ꦲꦻ', latin: 'ai (dirga mure)', name: 'Dirga Mure', note: 'Diftong ai' },
  { char: 'ꦻꦴ', preview: 'ꦲꦻꦴ', latin: 'au (dirga tarung)', name: 'Dirga Mure Tarung', note: 'Diftong au' },
];

export const SANDHANGAN_PANYIGEG_WYANJANA: AksaraItem[] = [
  { char: 'ꦁ', preview: 'ꦲꦁ', latin: '-ng (cecak)', name: 'Cecak', note: 'Menutup suku kata dengan bunyi -ng' },
  { char: 'ꦂ', preview: 'ꦲꦂ', latin: '-r (layar)', name: 'Layar', note: 'Menutup suku kata dengan bunyi -r' },
  { char: 'ꦃ', preview: 'ꦲꦃ', latin: '-h (wignyan)', name: 'Wignyan', note: 'Menutup suku kata dengan bunyi -h' },
  { char: '꧀', preview: 'ꦲ꧀', latin: 'pangkon (mati)', name: 'Pangkon', note: 'Mematikan vokal / membentuk pasangan jika diikuti aksara' },
  { char: 'ꦿ', preview: 'ꦏꦿ', latin: '-ra (cakra)', name: 'Cakra', note: 'Sisipan konsonan -r- (misal: kra, pra)' },
  { char: 'ꦽ', preview: 'ꦏꦽ', latin: '-rê (keret)', name: 'Cakra Keret', note: 'Sisipan konsonan -rê- (misal: krê, srê)' },
  { char: 'ꦾ', preview: 'ꦏꦾ', latin: '-ya (pengkal)', name: 'Pengkal', note: 'Sisipan konsonan -y- (misal: kya, tya)' },
  { char: '꦳', preview: 'ꦏ꦳', latin: 'rekan (cecak 3)', name: 'Cecak Telu', note: 'Penanda huruf serapan (fa, za, kha, dza, gha)' },
];

export const PASANGAN_CARAKAN: AksaraItem[] = AKSARA_NGLEGENA.map((item) => ({
  char: `\uA9C0${item.char}`,
  preview: `◌\uA9C0${item.char}`,
  latin: `pas. ${item.latin.split(' ')[0]}`,
  name: `Pasangan ${item.name}`,
  note: `Ketik setelah aksara sebelumnya untuk mematikan vokal & menyambung ${item.name}`
}));

export const PASANGAN_MURDA: AksaraItem[] = AKSARA_MURDA.slice(0, 8).map((item) => ({
  char: `\uA9C0${item.char}`,
  preview: `◌\uA9C0${item.char}`,
  latin: `pas. ${item.name}`,
  name: `Pasangan ${item.name}`,
  note: `Pasangan huruf kapital/penghormatan ${item.name}`
}));

export const TANDA_BACA_JAWA: AksaraItem[] = [
  { char: '꧋', latin: 'adeg-adeg', name: 'Pada Adeg-adeg', note: 'Mengawali kalimat / paragraf / alinea' },
  { char: '꧈', latin: 'lingsa (,)', name: 'Pada Lingsa', note: 'Tanda koma / pemisah jeda antarklausa' },
  { char: '꧉', latin: 'lungsi (.)', name: 'Pada Lungsi', note: 'Tanda titik / pengakhir kalimat' },
  { char: '꧇', latin: 'pangkat (angka)', name: 'Pada Pangkat', note: 'Wajib mengapit Angka Jawa (misal: ꧇꧒꧐꧒꧕꧇)' },
  { char: '꧊', latin: 'pada adeg', name: 'Pada Adeg', note: 'Tanda petik atau pembuka bagian khusus' },
  { char: '꧌', latin: 'piseleh kiwa', name: 'Pada Piseleh (Buka)', note: 'Tanda kurung buka dalam aksara Jawa' },
  { char: '꧍', latin: 'piseleh tengen', name: 'Pada Piseleh (Tutup)', note: 'Tanda kurung tutup dalam aksara Jawa' },
  { char: '꧁', latin: 'rerenggan kiwa', name: 'Rerenggan Kiri', note: 'Ornamen pembuka judul / tembang' },
  { char: '꧂', latin: 'rerenggan tengen', name: 'Rerenggan Kanan', note: 'Ornamen penutup judul / tembang' },
  { char: '꧃', latin: 'pada andhap', name: 'Pada Andhap', note: 'Surat untuk orang lebih muda/rendah derajatnya' },
  { char: '꧄', latin: 'pada madya', name: 'Pada Madya', note: 'Surat untuk orang sebaya/setara' },
  { char: '꧅', latin: 'pada luhur', name: 'Pada Luhur', note: 'Surat untuk orang yang dihormati / lebih tua' },
  { char: '꧆', latin: 'pada windu', name: 'Pada Windu', note: 'Penanda jeda atau akhir bab/tembang' },
];

export const ANGKA_JAWA: AksaraItem[] = [
  { char: '꧐', latin: '0', name: 'Nol (꧐)' },
  { char: '꧑', latin: '1', name: 'Siji (꧑)' },
  { char: '꧒', latin: '2', name: 'Loro (꧒)' },
  { char: '꧓', latin: '3', name: 'Telu (꧓)' },
  { char: '꧔', latin: '4', name: 'Papat (꧔)' },
  { char: '꧕', latin: '5', name: 'Lima (꧕)' },
  { char: '꧖', latin: '6', name: 'Enem (꧖)' },
  { char: '꧗', latin: '7', name: 'Pitu (꧗)' },
  { char: '꧘', latin: '8', name: 'Wolu (꧘)' },
  { char: '꧙', latin: '9', name: 'Sanga (꧙)' },
];

/**
 * Konverter / Transliterasi praktis Latin -> Aksara Jawa Unicode (U+A980-U+A9DF)
 * Catatan:
 * - Gunakan "é" atau "è" untuk bunyi taling (é/è seperti pada kata "lélé", "témpe")
 * - Gunakan "e" atau "ê" untuk bunyi pepet (ê seperti pada kata "sega", "teka")
 */
export function latinToAksaraJawa(
  input: string,
  options: { useAdegAdeg?: boolean; wrapDigitsWithPangkat?: boolean } = {}
): string {
  if (!input || !input.trim()) return '';

  const { useAdegAdeg = false, wrapDigitsWithPangkat = true } = options;

  const consMap: Record<string, string> = {
    ng: 'ꦔ',
    ny: 'ꦚ',
    dh: 'ꦝ',
    th: 'ꦛ',
    kh: 'ꦏ꦳',
    dz: 'ꦢ꦳',
    gh: 'ꦒ꦳',
    h: 'ꦲ',
    n: 'ꦤ',
    c: 'ꦕ',
    r: 'ꦫ',
    k: 'ꦏ',
    d: 'ꦢ',
    t: 'ꦠ',
    s: 'ꦱ',
    w: 'ꦮ',
    l: 'ꦭ',
    p: 'ꦥ',
    j: 'ꦗ',
    y: 'ꦪ',
    m: 'ꦩ',
    g: 'ꦒ',
    b: 'ꦧ',
    f: 'ꦥ꦳',
    v: 'ꦥ꦳',
    z: 'ꦗ꦳',
    q: 'ꦏ',
    x: 'ꦏ꧀ꦱ',
  };

  const digitMap: Record<string, string> = {
    '0': '꧐',
    '1': '꧑',
    '2': '꧒',
    '3': '꧓',
    '4': '꧔',
    '5': '꧕',
    '6': '꧖',
    '7': '꧗',
    '8': '꧘',
    '9': '꧙',
  };

  const isVowel = (ch: string) => ['a', 'i', 'u', 'e', 'é', 'è', 'ê', 'o'].includes(ch);

  const vowelSandhangan = (v: string): string => {
    switch (v) {
      case 'a':
        return '';
      case 'i':
        return 'ꦶ';
      case 'u':
        return 'ꦸ';
      case 'é':
      case 'è':
        return 'ꦺ';
      case 'e':
      case 'ê':
        return 'ꦼ';
      case 'o':
        return 'ꦺꦴ';
      default:
        return '';
    }
  };

  const raw = input.trim();
  let out = '';
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    // 1. Spasi -> dalam aksara Jawa tradisional tidak memakai spasi antarkata dalam kalimat,
    // namun pertahankan newline; untuk spasi antarkata, lewati agar sambungan pasangan alami,
    // kecuali setelah tanda baca
    if (ch === '\n') {
      out += '\n';
      i++;
      continue;
    }

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // 2. Angka
    if (/[0-9]/.test(ch)) {
      let numStr = '';
      while (i < raw.length && /[0-9]/.test(raw[i])) {
        numStr += digitMap[raw[i]] || raw[i];
        i++;
      }
      out += wrapDigitsWithPangkat ? `꧇${numStr}꧇` : numStr;
      continue;
    }

    // 3. Tanda Baca
    if (ch === ',') {
      out += '꧈ ';
      i++;
      continue;
    }
    if (ch === '.') {
      out += '꧉ ';
      i++;
      continue;
    }
    if (ch === ':') {
      out += '꧇';
      i++;
      continue;
    }
    if (ch === '(') {
      out += '꧌';
      i++;
      continue;
    }
    if (ch === ')') {
      out += '꧍';
      i++;
      continue;
    }

    const lowerRem = raw.slice(i).toLowerCase();

    // 4. Vokal di awal / berdiri sendiri -> pakai 'ꦲ' + sandhangan
    const firstLower = lowerRem[0];
    if (isVowel(firstLower)) {
      // Cek diftong ai / au
      if (lowerRem.startsWith('ai')) {
        out += 'ꦲꦻ';
        i += 2;
        continue;
      }
      if (lowerRem.startsWith('au')) {
        out += 'ꦲꦻꦴ';
        i += 2;
        continue;
      }
      out += 'ꦲ' + vowelSandhangan(firstLower);
      i++;
      continue;
    }

    // 5. Konsonan (cek digraf ng, ny, dh, th, kh, dz, gh dulu)
    let matchedCons = '';
    for (const dg of ['ng', 'ny', 'dh', 'th', 'kh', 'dz', 'gh']) {
      if (lowerRem.startsWith(dg)) {
        matchedCons = dg;
        break;
      }
    }
    if (!matchedCons && consMap[firstLower]) {
      matchedCons = firstLower;
    }

    if (!matchedCons) {
      // Karakter lain (tanda tanya, seru, dll)
      out += ch;
      i++;
      continue;
    }

    const afterConsIdx = i + matchedCons.length;
    const nextChar = (raw[afterConsIdx] || '').toLowerCase();

    // Kasus khusus panyigeg wanda di akhir suku kata (ng, r, h tidak diikuti vokal)
    if (!isVowel(nextChar)) {
      if (matchedCons === 'ng') {
        out += 'ꦁ';
        i += 2;
        continue;
      }
      if (matchedCons === 'r') {
        out += 'ꦂ';
        i += 1;
        continue;
      }
      if (matchedCons === 'h') {
        out += 'ꦃ';
        i += 1;
        continue;
      }
    }

    // Kasus khusus Pa Cerek (re/rê) & Nga Lelet (le/lê)
    if (matchedCons === 'r' && (nextChar === 'e' || nextChar === 'ê')) {
      out += 'ꦉ';
      i += 2;
      continue;
    }
    if (matchedCons === 'l' && (nextChar === 'e' || nextChar === 'ê')) {
      out += 'ꦊ';
      i += 2;
      continue;
    }

    const baseAksara = consMap[matchedCons];

    // Kasus gugus konsonan (Wyanjana: C + r + vokal -> cakra/keret, C + y + vokal -> pengkal)
    if (nextChar === 'r' && afterConsIdx + 1 < raw.length && isVowel(raw[afterConsIdx + 1].toLowerCase())) {
      const vAfterR = raw[afterConsIdx + 1].toLowerCase();
      if (vAfterR === 'e' || vAfterR === 'ê') {
        out += baseAksara + 'ꦽ';
      } else {
        out += baseAksara + 'ꦿ' + vowelSandhangan(vAfterR);
      }
      i = afterConsIdx + 2;
      continue;
    }

    if (nextChar === 'y' && afterConsIdx + 1 < raw.length && isVowel(raw[afterConsIdx + 1].toLowerCase())) {
      const vAfterY = raw[afterConsIdx + 1].toLowerCase();
      out += baseAksara + 'ꦾ' + vowelSandhangan(vAfterY);
      i = afterConsIdx + 2;
      continue;
    }

    // Konsonan + Vokal normal
    if (isVowel(nextChar)) {
      const twoV = raw.slice(afterConsIdx, afterConsIdx + 2).toLowerCase();
      if (twoV === 'ai') {
        out += baseAksara + 'ꦻ';
        i = afterConsIdx + 2;
        continue;
      }
      if (twoV === 'au') {
        out += baseAksara + 'ꦻꦴ';
        i = afterConsIdx + 2;
        continue;
      }
      out += baseAksara + vowelSandhangan(nextChar);
      i = afterConsIdx + 1;
      continue;
    }

    // Konsonan mati (tidak diikuti vokal -> beri pangkon ꧀)
    out += baseAksara + '꧀';
    i = afterConsIdx;
  }

  let finalResult = out.trim();
  if (useAdegAdeg && finalResult && !finalResult.startsWith('꧋')) {
    finalResult = '꧋' + finalResult;
  }

  return finalResult;
}

export const PANDUAN_AKSARA_JAWA = [
  {
    title: '1. Aksara Nglegena (Carakan 20 Huruf Dasar)',
    description:
      'Setiap aksara dasar secara bawaan berbunyi vokal /a/ (dibaca "ha, na, ca, ra, ka..."). Untuk menulis kata berakhiran vokal "a" seperti "kaca" atau "mara", cukup susun aksaranya langsung: ꦏꦕ (kaca), ꦩꦫ (mara).'
  },
  {
    title: '2. Sandhangan (Pengubah Vokal & Penutup Suku Kata)',
    description:
      'Tambahkan sandhangan tepat SETELAH aksara dasar untuk mengubah bunyi vokalnya: Wulu (ꦶ = i), Suku (ꦸ = u), Taling (ꦺ = é/è), Pepet (ꦼ = ê), Taling Tarung (ꦺꦴ = o). Untuk penutup bunyi akhir, gunakan Cecak (ꦁ = -ng), Layar (ꦂ = -r), Wignyan (ꦃ = -h), atau Pangkon (꧀) untuk mematikan vokal di akhir kalimat.'
  },
  {
    title: '3. Pasangan (Mematikan Vokal di Tengah Kata/Kalimat)',
    description:
      'Dalam tata tulis Aksara Jawa, Pangkon (꧀) TIDAK boleh dipakai di tengah kalimat. Untuk mematikan vokal konsonan sebelum huruf berikutnya, pilih tab "Pasangan" (kombinasi otomatis ꧀ + Aksara). Contoh: "mangan sega" = ꦩꦔꦤ꧀ꦱꦼꦒ (aksara "na" dimatikan oleh pasangan "sa").'
  },
  {
    title: '4. Aksara Murda (Huruf Penghormatan / Kapital)',
    description:
      'Dipakai di awal kata untuk menulis nama tokoh terhormat, gelar, nama tempat/kota, atau lembaga penting. Hanya ada 8 huruf utama (Na ꦟ, Ka ꦑ, Ta ꦡ, Sa ꦯ, Pa ꦦ, Nya ꦘ, Ga ꦓ, Ba ꦨ). Jika huruf depan tidak punya bentuk Murda, gunakan pada suku kata berikutnya atau tetap pakai Carakan biasa.'
  },
  {
    title: '5. Angka Jawa & Tanda Baca (Pada)',
    description:
      'Setiap penulisan angka Jawa (꧐–꧙) WAJIB diapit tanda Pada Pangkat (꧇) di depan dan di belakangnya agar tidak tertukar dengan aksara mirip (misalnya ꧇꧒꧐꧒꧕꧇ untuk tahun 2025). Gunakan Pada Adeg-adeg (꧋) di awal kalimat/paragraf, Pada Lingsa (꧈) untuk koma, dan Pada Lungsi (꧉) untuk titik.'
  }
];
