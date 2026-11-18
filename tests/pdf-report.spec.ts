import fs from 'node:fs';
import { test, expect } from '../fixtures/test-options';
import { readPdf } from './helpers/pdf';

const REPORT_URL = '/api/reports/sample-qc.pdf';

test.describe('Sample QC report (PDF)', () => {
  test('PDF-001 downloaded QC report matches the approved version', async ({ page }) => {
    await test.step('GIVEN the user is on the QC Reports page', async () => {
      await page.goto('/reports');
      await expect(page.getByRole('heading', { name: 'QC Reports' })).toBeVisible();
    });

    const download = await test.step('WHEN the user downloads the sample QC report', async () => {
      const [file] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('link', { name: 'Download sample QC report (PDF)' }).click()
      ]);
      return file;
    });

    await test.step('THEN the file matches the approved report', async () => {
      expect(download.suggestedFilename()).toBe('bioguard-sample-qc-report.pdf');
      const bytes = new Uint8Array(fs.readFileSync(await download.path()));
      const pdf = await readPdf(bytes);
      // The approved text lives in tests/__snapshots__/pdf-report.spec.ts/sample-qc-report.txt.
      // After an intended change, approve the new version with: npx playwright test --update-snapshots
      expect(pdf.text).toMatchSnapshot('sample-qc-report.txt');
    });
  });

  test('PDF-002 QC report endpoint returns a valid one-page PDF', async ({ request }) => {
    const response = await request.get(REPORT_URL);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');
    expect(response.headers()['content-disposition']).toContain('attachment; filename="bioguard-sample-qc-report.pdf"');

    const bytes = new Uint8Array(await response.body());
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');

    const pdf = await readPdf(bytes);
    expect(pdf.pageCount).toBe(1);
    expect(pdf.title).toBe('BioGuard AI Sample QC Report');
  });

  test('PDF-003 QC report shows the same values as the API', async ({ request }) => {
    const samples: { sampleId: string; fragmentLength: number; signalQuality: number; qcStatus: string }[] =
      await (await request.get('/api/samples')).json();
    const pdf = await readPdf(new Uint8Array(await (await request.get(REPORT_URL)).body()));

    for (const s of samples) {
      expect(pdf.text, `row for ${s.sampleId}`).toContain(
        `${s.sampleId} | ${s.fragmentLength} | ${s.signalQuality} | ${s.qcStatus}`
      );
    }
    const pass = samples.filter(s => s.qcStatus === 'PASS').length;
    expect(pdf.text).toContain(`Summary: ${samples.length} samples, ${pass} PASS, ${samples.length - pass} REVIEW`);
  });
});
