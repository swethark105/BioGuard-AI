// Optional: ask a local AI model (Ollama) to suggest a likely cause for each
// failed test. The output is a hypothesis for an engineer to check. It never
// changes a test result, and the dashboard labels it "AI suggestion - not verified".
//
// Usage (after a test run):  npm run explain
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resultsFile = process.env.RESULTS_FILE || 'artifacts/results.json';
const outputFile = process.env.FAILURE_ANALYSIS_FILE || 'artifacts/ai-failure-analysis.json';
const requirementsFile = process.env.REQUIREMENTS_FILE || 'requirements/requirements.json';
const endpoint = process.env.OLLAMA_URL || 'http://localhost:11434';
const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

const MAX_FAILURES = 5;
const MAX_TEXT = 600;

const stripAnsi = s => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
const clip = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
const cleanText = (value, n = MAX_TEXT) => (typeof value === 'string' ? clip(value.trim(), n) : '');

// The few lines of test code that failed, so the model can see what was expected.
function testSource(file, line) {
  if (!file || !line) return '';
  const candidates = [file, path.join('tests', file)];
  const found = candidates.find(f => fs.existsSync(f));
  if (!found) return '';
  const lines = fs.readFileSync(found, 'utf8').split('\n');
  // Take the failing test only: stop at the next test or after the closing "});".
  const picked = [];
  for (let i = line - 1; i < lines.length && picked.length < 25; i++) {
    if (i > line - 1 && /^\s*test(\.\w+)?\(/.test(lines[i])) break;
    picked.push(lines[i]);
    if (/^\}\);/.test(lines[i])) break;
  }
  return clip(picked.join('\n'), 1200);
}

function collectFailures(report) {
  const failures = [];
  const walk = suite => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const r = t.results?.at(-1);
        if (!r || r.status === 'passed' || r.status === 'skipped') continue;
        failures.push({
          testId: (spec.title.match(/^(API|UI|AI)-\d+/) || [])[0] || spec.title,
          title: spec.title,
          status: r.status,
          error: clip(stripAnsi(r.error?.message || r.error?.value || 'No error message recorded'), 1500),
          source: testSource(spec.file, spec.line)
        });
      }
    }
    for (const child of suite.suites || []) walk(child);
  };
  for (const suite of report.suites || []) walk(suite);
  return failures;
}

// Small models do not always follow the requested shape. Accept a bare list,
// a wrapped list or a single object, keep only tests that really failed, and
// always mark the result as unverified.
export function normalizeExplanations(raw, failedIds) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.explanations)
      ? raw.explanations
      : Object.values(raw || {}).find(Array.isArray) || (raw && typeof raw === 'object' ? [raw] : []);

  const out = {};
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const testId = String(item.testId || '').trim();
    const likelyCause = cleanText(item.likelyCause);
    if (!failedIds.has(testId) || !likelyCause || out[testId]) continue;
    out[testId] = {
      testId,
      likelyCause,
      suggestedCheck: cleanText(item.suggestedCheck),
      verification: 'UNVERIFIED'
    };
  }
  return out;
}

async function main() {
  if (!fs.existsSync(resultsFile)) {
    throw Error(`${resultsFile} not found. Run the tests first.`);
  }
  const report = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  const requirements = JSON.parse(fs.readFileSync(requirementsFile, 'utf8'));
  const resultsStartTime = report.stats?.startTime || null;

  // Remove any analysis from an earlier run so the dashboard never shows a stale one.
  fs.rmSync(outputFile, { force: true });

  const failures = collectFailures(report).slice(0, MAX_FAILURES);
  if (failures.length === 0) {
    console.log('No failed tests in the latest run, so there is nothing to explain.');
    return;
  }

  const requirementFor = id => requirements.find(r => r.testIds.includes(id));
  const context = failures.map(f => {
    const req = requirementFor(f.testId);
    return {
      testId: f.testId,
      title: f.title,
      requirement: req ? `${req.id} (${req.risk} risk): ${req.title}` : 'not linked',
      error: f.error,
      testCode: f.source
    };
  });

  const prompt = `You are helping a QA engineer investigate failed automated tests in a fictional demo app.
The app's POST /api/analyze endpoint should reject (HTTP 422) any sample unless: sampleId matches SYN-### ; fragmentLength is a whole number from 1 to 100000 ; signalQuality is a number from 0 to 1 ; variantCount is a whole number of 0 or more. Signal quality of 0.80 or more is PASS, otherwise REVIEW.
For each failed test below, give the most likely cause and one concrete thing the engineer should check to confirm it. Be brief (one or two sentences each). Say "unclear" rather than guessing. Do not claim the cause is confirmed.
Respond with a JSON object of the form {"explanations":[{"testId":"...","likelyCause":"...","suggestedCheck":"..."}]}.
Failed tests: ${JSON.stringify(context)}`;

  let response;
  try {
    response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
      signal: AbortSignal.timeout(180000)
    });
  } catch {
    throw Error(`could not reach Ollama at ${endpoint}. Is it running, and has the model ${model} been downloaded?`);
  }
  if (!response.ok) throw Error(`Ollama HTTP ${response.status}`);
  const payload = await response.json();

  let parsed;
  try {
    parsed = JSON.parse(payload.response);
  } catch {
    throw Error('The model did not return valid JSON; try running it again');
  }

  const explanations = normalizeExplanations(parsed, new Set(failures.map(f => f.testId)));
  const count = Object.keys(explanations).length;
  if (count === 0) throw Error('The model returned no usable explanations; try running it again');

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify({
    model,
    generatedAt: new Date().toISOString(),
    resultsStartTime,
    notice: 'AI suggestion - not verified. An engineer must confirm the cause.',
    explanations
  }, null, 2));
  console.log(`Saved ${count} unverified failure explanation(s) to ${outputFile}`);
}

// Run only when started directly (not when imported by a test).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    await main();
  } catch (e) {
    console.error('Optional AI failure analysis unavailable:', e.message);
    process.exitCode = 1;
  }
}
