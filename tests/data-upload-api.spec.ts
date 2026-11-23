import fs from 'node:fs';
import path from 'node:path';
import { type APIRequestContext } from '@playwright/test';
import { test, expect } from '../fixtures/test-options';

// Data file checks through the API: is the science calculated correctly,
// and are bad files rejected without saving anything?

/** Sends one file from tests/data to the upload API, the same way the page does. */
async function upload(request: APIRequestContext, fileName: string) {
  const text = fs.readFileSync(path.join('tests', 'data', fileName), 'utf8');
  const response = await request.post('/api/upload', {
    headers: { 'Content-Type': 'text/csv', 'X-File-Name': fileName },
    data: text
  });
  return { status: response.status(), body: await response.json() };
}

/** How many uploads and audit entries exist right now. */
async function savedCounts(request: APIRequestContext) {
  const uploads = await (await request.get('/api/uploads')).json();
  const audit = await (await request.get('/api/audit')).json();
  return { uploads: uploads.length, audit: audit.length };
}

test('DATA-001 the valid file gives the expected score and status for every sample', async ({ request }) => {
  const expected = JSON.parse(fs.readFileSync(path.join('tests', 'data', 'valid-samples.expected.json'), 'utf8'));

  const { status, body } = await upload(request, 'valid-samples.csv');

  expect(status).toBe(200);
  expect(body.results).toEqual(expected); // every ID, score and status, in order
  expect(body.sampleCount).toBe(5);
  expect(body.passCount).toBe(3);
  expect(body.reviewCount).toBe(2);
});

test('DATA-002 0.80 is PASS, 0.79 is REVIEW, and 0.797 rounds up to 0.80', async ({ request }) => {
  const { status, body } = await upload(request, 'boundary-samples.csv');

  expect(status).toBe(200);
  expect(body.results).toEqual([
    { sampleId: 'EDGE-080', score: 0.8, status: 'PASS' },
    { sampleId: 'EDGE-079', score: 0.79, status: 'REVIEW' },
    { sampleId: 'EDGE-ROUND', score: 0.8, status: 'PASS' } // (0.80 + 0.80 + 0.79) / 3 = 0.797 -> 0.80
  ]);
});

// DATA-003 to DATA-009 and DATA-013: one bad file each. Same steps, different data,
// so they are written once as a table and Playwright makes one test per row.
const badFiles = [
  { id: 'DATA-003', file: 'missing-value.csv', error: 'Line 2: signal_2 is missing.' },
  { id: 'DATA-004', file: 'non-numeric.csv', error: 'Line 2: signal_2 "high" is not a number.' },
  { id: 'DATA-005', file: 'out-of-range.csv', error: 'Line 3: signal_1 1.20 must be between 0 and 1.' },
  { id: 'DATA-006', file: 'duplicate-id.csv', error: 'Line 3: sample_id "RUN-001" appears more than once.' },
  { id: 'DATA-007', file: 'wrong-header.csv', error: 'Line 1: the header must be "sample_id,signal_1,signal_2,signal_3".' },
  { id: 'DATA-008', file: 'empty.csv', error: 'The file is empty.' },
  { id: 'DATA-009', file: 'header-only.csv', error: 'The file has a header but no samples.' },
  { id: 'DATA-013', file: 'samples.txt', error: '"samples.txt" is not a CSV file. Upload a .csv file.' }
];

for (const bad of badFiles) {
  test(`${bad.id} ${bad.file} is rejected with a clear error and nothing is saved`, async ({ request }) => {
    const before = await savedCounts(request);

    const { status, body } = await upload(request, bad.file);

    expect(status).toBe(400);
    expect(body.error).toBe(bad.error);
    expect(await savedCounts(request), 'no upload or audit entry is saved').toEqual(before);
  });
}

test('DATA-010 a successful upload is recorded in the audit log', async ({ request }) => {
  const { body } = await upload(request, 'valid-samples.csv');

  const audit = await (await request.get('/api/audit')).json();
  const entry = audit.find((e: { uploadId?: string }) => e.uploadId === body.uploadId);

  expect(entry, 'audit entry for this upload').toBeTruthy();
  expect(entry.action).toBe('UPLOAD');
  expect(entry.result).toBe('5 samples: 3 PASS, 2 REVIEW');
  expect(entry.timestamp).toBeTruthy();
});