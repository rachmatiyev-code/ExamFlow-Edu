import katex from 'katex';

/**
 * Utility untuk memproses dan merender rumus matematika (LaTeX / KaTeX)
 * serta simbol ilmiah ke dalam HTML aman dan presisi.
 */
export class MathRenderer {
  /**
   * Render string LaTeX murni menjadi HTML KaTeX
   */
  static renderFormula(latex: string, displayMode: boolean = false): string {
    if (!latex || !latex.trim()) return '';
    try {
      return katex.renderToString(latex.trim(), {
        throwOnError: false,
        displayMode,
        output: 'htmlAndMathml'
      });
    } catch (err) {
      console.warn('KaTeX render error:', err);
      return `<span class="text-rose-600 font-mono text-xs font-semibold">[Rumus: ${latex}]</span>`;
    }
  }

  /**
   * Mengurai teks yang berisi campuran HTML, teks biasa, rumus inline $...$,
   * dan rumus block $$...$$
   */
  static renderMixedText(content: string): string {
    if (!content) return '';

    // Ganti newline tab non-breaking jika ada
    let processed = content
      .replace(/\t/g, '&emsp;&emsp;')
      .replace(/\u00a0/g, '&nbsp;');

    // 1. Proses block math: $$...$$
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula) => {
      const rendered = this.renderFormula(formula, true);
      return `<div class="my-3 py-1 flex justify-center overflow-x-auto">${rendered}</div>`;
    });

    // 2. Proses inline math: $...$
    // Hindari mencocokkan tanda mata uang dollar $10 atau $ 100 dengan regex cerdas
    processed = processed.replace(/\$([^\$\n\r]+?)\$/g, (_match, formula) => {
      // Jika hanya spasi atau angka tunggal biasa tanpa operator matematika
      if (/^\s*\d+([.,]\d+)?\s*$/.test(formula)) {
        return `$${formula}$`;
      }
      const rendered = this.renderFormula(formula, false);
      return `<span class="inline-block mx-0.5 align-middle">${rendered}</span>`;
    });

    return processed;
  }
}
