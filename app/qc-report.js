// Builds the sample QC report as a PDF from the synthetic sample data.
//
// The report is built from the same data and the same PASS/REVIEW rule as the
// API, so tests can check it against both an approved copy and the live API.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// A fixed date keeps the file's metadata the same on every run.
const REPORT_DATE = new Date('2026-01-01T00:00:00Z');

/**
 * @param {Array<{sampleId:string, fragmentLength:number, signalQuality:number}>} samples
 * @param {(sample:object) => 'PASS'|'REVIEW'} classify the app's QC rule
 * @param {{demoDefect?: boolean}} options demoDefect rounds signal quality to
 *   one decimal place, a deliberate formatting bug for the PDF comparison demo
 * @returns {Promise<Uint8Array>} the PDF file
 */
export async function buildQcReport(samples, classify, { demoDefect = false } = {}) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.setTitle('BioGuard AI Sample QC Report');
  pdf.setAuthor('BioGuard AI (synthetic demo)');
  pdf.setSubject('Quality check results for synthetic samples');
  pdf.setCreator('BioGuard AI');
  pdf.setProducer('BioGuard AI');
  pdf.setCreationDate(REPORT_DATE);
  pdf.setModificationDate(REPORT_DATE);

  const page = pdf.addPage([595, 842]); // A4 portrait, in points
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.16, 0.25);
  const quiet = rgb(0.36, 0.43, 0.51);
  const left = 56;
  let y = 780;

  const text = (words, x, size = 11, font = regular, color = ink) => page.drawText(words, { x, y, size, font, color });

  text('BioGuard AI - Sample QC Report', left, 20, bold);
  y -= 24;
  text('Synthetic demo data. Not for medical or diagnostic use.', left, 10, regular, quiet);
  y -= 36;

  // Table: one row per sample.
  const columns = [left, 160, 290, 410];
  ['Sample ID', 'Fragment length', 'Signal quality', 'QC outcome'].forEach((h, i) => text(h, columns[i], 11, bold));
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: 539, y }, thickness: 1, color: quiet });
  y -= 18;
  for (const s of samples) {
    const quality = demoDefect ? s.signalQuality.toFixed(1) : String(s.signalQuality);
    [s.sampleId, String(s.fragmentLength), quality, classify(s)].forEach((v, i) => text(v, columns[i]));
    y -= 20;
  }

  const passCount = samples.filter(s => classify(s) === 'PASS').length;
  y -= 16;
  text(`Summary: ${samples.length} samples, ${passCount} PASS, ${samples.length - passCount} REVIEW`, left, 11, bold);
  y -= 18;
  text('Rule: signal quality of 0.80 or more is PASS; otherwise REVIEW.', left);

  y = 48;
  text('Page 1 of 1', left, 9, regular, quiet);

  return pdf.save();
}
