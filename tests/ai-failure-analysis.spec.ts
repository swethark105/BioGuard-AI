import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// These tests run ai/explain-failures.js against a fake Ollama server, so they
// are deterministic and need no real AI model or internet connection.

const failedRun = {
  stats: { startTime: '2026-10-27T10:00:00.000Z' },
  suites: [{
    specs: [
      { title: 'API-002 rejects negative fragment lengths', tests: [{ results: [{ status: 'failed', error: { message: 'Expected: 422\nReceived: 200' } }] }] },
      { title: 'API-003 rejects out-of-range quality', tests: [{ results: [{ status: 'passed' }] }] }
    ]
  }]
};

async function withFakeModel(reply: string, run: (url: string) => Promise<void>) {
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ response: reply }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

function runExplainer(dir: string, ollamaUrl: string) {
  return new Promise<{ code: number }>(resolve => {
    execFile(process.execPath, ['ai/explain-failures.js'], {
      env: {
        ...process.env,
        OLLAMA_URL: ollamaUrl,
        RESULTS_FILE: path.join(dir, 'results.json'),
        FAILURE_ANALYSIS_FILE: path.join(dir, 'analysis.json')
      }
    }, error => resolve({ code: error ? (error.code as number) ?? 1 : 0 }));
  });
}

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bioguard-explain-'));
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(failedRun));
  return dir;
}

test('AI-004 failure explanations are kept only for failed tests and marked unverified', async () => {
  const dir = setup();
  const reply = JSON.stringify({
    explanations: [
      { testId: 'API-002', likelyCause: 'Validation accepts negative lengths.', suggestedCheck: 'Check the fragmentLength rule.', verification: 'CONFIRMED' },
      { testId: 'API-003', likelyCause: 'This test passed, so this note must be dropped.' },
      { testId: 'API-999', likelyCause: 'Invented test ID, must be dropped.' }
    ]
  });

  await withFakeModel(reply, async url => {
    const { code } = await runExplainer(dir, url);
    expect(code).toBe(0);
  });

  const analysis = JSON.parse(fs.readFileSync(path.join(dir, 'analysis.json'), 'utf8'));
  expect(Object.keys(analysis.explanations)).toEqual(['API-002']);
  expect(analysis.explanations['API-002'].verification).toBe('UNVERIFIED');
  expect(analysis.resultsStartTime).toBe(failedRun.stats.startTime);
  expect(analysis.notice).toContain('not verified');
});

test('AI-005 unusable AI output is rejected and test results are left unchanged', async () => {
  const dir = setup();
  const before = fs.readFileSync(path.join(dir, 'results.json'), 'utf8');

  await withFakeModel('this is not JSON', async url => {
    const { code } = await runExplainer(dir, url);
    expect(code).not.toBe(0);
  });

  expect(fs.existsSync(path.join(dir, 'analysis.json'))).toBe(false);
  expect(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')).toBe(before);
});
