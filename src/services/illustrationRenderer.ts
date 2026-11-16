/**
 * Utilitas sanitasi SVG dan konversi SVG ilustrasi/grafik menjadi PNG resolusi tinggi
 * agar dapat disimpan ke Google Drive sebagai berkas gambar standar (.png).
 */

export interface RenderedIllustrationResult {
  pngBlob: Blob;
  pngDataUrl: string;
  sanitizedSvg: string;
  width: number;
  height: number;
}

export function sanitizeEducationalSvg(rawSvg: string, defaultWidth = 960, defaultHeight = 600): string {
  let svg = String(rawSvg || '').trim();

  // Ekstrak tag <svg ...>...</svg> jika ada teks pembungkus
  const svgMatch = svg.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    svg = svgMatch[0];
  }

  // Hapus tag script / foreignObject / event handler berbahaya
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '');

  // Pastikan atribut xmlns ada
  if (!/xmlns\s*=\s*['"]http:\/\/www\.w3\.org\/2000\/svg['"]/i.test(svg)) {
    svg = svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Pastikan viewBox ada
  if (!/viewBox\s*=/i.test(svg)) {
    svg = svg.replace(/^<svg/i, `<svg viewBox="0 0 ${defaultWidth} ${defaultHeight}"`);
  }

  return svg;
}

export async function svgToPng(
  rawSvg: string,
  targetWidth = 1200,
  targetHeight = 750
): Promise<RenderedIllustrationResult> {
  const sanitizedSvg = sanitizeEducationalSvg(rawSvg, 960, 600);

  // Tentukan dimensi SVG untuk rasterisasi tajam
  const viewBoxMatch = sanitizedSvg.match(/viewBox\s*=\s*['"]\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*['"]/i);
  const vbW = viewBoxMatch ? Math.max(200, Number(viewBoxMatch[1]) || 960) : 960;
  const vbH = viewBoxMatch ? Math.max(150, Number(viewBoxMatch[2]) || 600) : 600;
  const ratio = vbH / vbW;
  const width = targetWidth;
  const height = Math.round(targetWidth * ratio) || targetHeight;

  // Pastikan width & height eksplisit pada tag root <svg> saat di-render ke Image
  let renderSvg = sanitizedSvg
    .replace(/\swidth\s*=\s*['"][^'"]*['"]/i, '')
    .replace(/\sheight\s*=\s*['"][^'"]*['"]/i, '');
  renderSvg = renderSvg.replace(/^<svg/i, `<svg width="${width}" height="${height}"`);

  const svgBase64 = btoa(unescape(encodeURIComponent(renderSvg)));
  const svgUrl = `data:image/svg+xml;base64,${svgBase64}`;

  return new Promise<RenderedIllustrationResult>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context tidak tersedia.'));
          return;
        }

        // Latar putih bersih agar grafik & ilustrasi terbaca jelas di semua tema maupun cetak
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const pngDataUrl = canvas.toDataURL('image/png', 0.95);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Gagal mengonversi grafik/ilustrasi ke berkas PNG.'));
              return;
            }
            resolve({
              pngBlob: blob,
              pngDataUrl,
              sanitizedSvg,
              width,
              height
            });
          },
          'image/png',
          0.95
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Gagal merender SVG ilustrasi menjadi gambar PNG.'));
    };
    img.src = svgUrl;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(parts[1] || '');
  const len = binary.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}
