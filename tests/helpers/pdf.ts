import { createRequire } from 'node:module';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

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

/**
 * Draws one PDF page as a PNG image, the way a PDF viewer shows it.
 * Rendering happens in Node (pdf.js + the Skia graphics library) with the
 * fonts bundled in pdf.js, not in a browser and not with system fonts, so
 * the same PDF gives the same image on every Linux machine.
 */
export async function renderPdfPage(bytes: Uint8Array, pageNumber = 1, scale = 1.5): Promise<Buffer> {
  const doc = await getDocument({ data: bytes, standardFontDataUrl, useSystemFonts: false, isEvalSupported: false }).promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff'; // PDF pages are white; a canvas starts transparent
  context.fillRect(0, 0, canvas.width, canvas.height);
  // pdf.js accepts this canvas in Node; its types expect the browser's canvas
  await page.render({ canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise;
  await doc.destroy();
  return canvas.toBuffer('image/png');
}
