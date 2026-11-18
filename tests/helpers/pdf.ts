import { createRequire } from 'node:module';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// pdf.js ships the standard PDF fonts (Helvetica etc.); pointing it at them avoids a warning.
const require = createRequire(import.meta.url);
const standardFontDataUrl = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep;

export type PdfContent = {
  pageCount: number;
  title: string;
  /** The text of every page, one line per row of text, columns joined with " | ". */
  text: string;
};

/**
 * Reads a PDF the way a person would: page by page, top to bottom, left to right.
 * Comparing this text (not the raw bytes) keeps the check stable when the PDF
 * library writes the same content slightly differently.
 */
export async function readPdf(bytes: Uint8Array): Promise<PdfContent> {
  const doc = await getDocument({ data: bytes, standardFontDataUrl, useSystemFonts: false, isEvalSupported: false }).promise;
  const meta = await doc.getMetadata();
  const pages: string[] = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // Group text pieces into lines by their vertical position.
    const lines = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const line = lines.get(y) ?? [];
      line.push({ x: item.transform[4], str: item.str.trim() });
      lines.set(y, line);
    }
    const text = [...lines.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map(p => p.str).join(' | '))
      .join('\n');
    pages.push(text);
  }

  const info = meta.info as { Title?: string };
  await doc.destroy();
  return { pageCount: pages.length, title: info.Title ?? '', text: pages.join('\n\n--- page break ---\n\n') + '\n' };
}
