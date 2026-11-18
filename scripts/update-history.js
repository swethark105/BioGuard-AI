// Adds the latest test run to a history file and builds trends.html from it.
//
// Local use (after `npm test` and `npm run report`):
//   npm run trends            -> artifacts/history.json + artifacts/trends.html
//
// CI use (GitHub Actions publishes the history with the results site, and the
// next run downloads it, adds its own result and publishes it again):
//   node scripts/update-history.js --history site/history.json --out site --dashboard index.html
import fs from 'node:fs';
import path from 'node:path';

const MAX_RUNS = 90;

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const outDir = arg('out', 'artifacts');
const historyFile = arg('history', path.join(outDir, 'history.json'));
const summaryFile = arg('summary', 'artifacts/quality-summary.json');
// The latest-results page: quality-dashboard.html locally, index.html on the published site.
const dashboardLink = arg('dashboard', 'quality-dashboard.html');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// ---------- 1. Update the history ----------
let history = readJson(historyFile, []);
if (!Array.isArray(history)) history = [];

const summary = readJson(summaryFile, null);
if (summary?.totals) {
  const env = process.env;
  const entry = {
    runAt: summary.startTime || summary.generatedAt,
    trigger: env.GITHUB_EVENT_NAME || 'local',
    commit: (env.GITHUB_SHA || '').slice(0, 7),
    runUrl: env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : '',
    tests: summary.totals.tests,
    passed: summary.totals.passed,
    failed: summary.totals.failed,
    browserRuns: summary.totals.runs ?? summary.totals.tests,
    browsers: summary.totals.browsers?.length ?? 0,
    durationMs: summary.durationMs || 0,
    failedTests: summary.failedTests || []
  };
  // A re-run of the same test run replaces its entry instead of adding a second one.
  history = history.filter(h => h.runAt !== entry.runAt);
  history.push(entry);
} else {
  console.warn(`No test summary at ${summaryFile}; the history is unchanged.`);
}
history.sort((a, b) => String(a.runAt).localeCompare(String(b.runAt)));
history = history.slice(-MAX_RUNS);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'history.json'), JSON.stringify(history, null, 2));

// ---------- 2. Build trends.html ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = iso => String(iso).slice(0, 10);
const time = iso => String(iso).slice(11, 16);
const secs = ms => (ms / 1000).toFixed(1);

const n = history.length;
const greenRuns = history.filter(h => h.failed === 0).length;
const avgMs = n ? history.reduce((s, h) => s + h.durationMs, 0) / n : 0;
const passRate = n ? (100 * history.reduce((s, h) => s + h.passed, 0) / Math.max(1, history.reduce((s, h) => s + h.tests, 0))) : 0;

// Chart geometry shared by both charts: one slot per run, oldest on the left.
const W = 1000, PAD_L = 56, PAD_R = 16, plotW = W - PAD_L - PAD_R;
const slot = n ? plotW / n : plotW;
const xMid = i => PAD_L + slot * i + slot / 2;
const labelEvery = Math.max(1, Math.ceil(n / 10));
const xLabels = (y) => history.map((h, i) => (i % labelEvery === 0 || i === n - 1)
  ? `<text x="${xMid(i).toFixed(1)}" y="${y}" text-anchor="middle" class="tick">${esc(day(h.runAt).slice(5))}</text>` : '').join('');

function resultsChart() {
  // One tile per run: green = every test passed, red = some failed (the number inside).
  const H = 96, y0 = 8, tileH = 44;
  const tileW = Math.max(3, Math.min(40, slot - 4));
  const tiles = history.map((h, i) => {
    const x = xMid(i) - tileW / 2;
    const tip = `${day(h.runAt)} ${time(h.runAt)} UTC: ${h.passed} passed, ${h.failed} failed` + (h.failedTests?.length ? ` (${h.failedTests.join(', ')})` : '');
    return `<g><title>${esc(tip)}</title><rect x="${x.toFixed(1)}" y="${y0}" width="${tileW.toFixed(1)}" height="${tileH}" rx="4" class="${h.failed ? 'failbar' : 'pass'}"/>` +
      (h.failed && tileW >= 14 ? `<text x="${xMid(i).toFixed(1)}" y="${y0 + tileH / 2 + 5}" text-anchor="middle" class="count">${h.failed}</text>` : '') + `</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Result of each run: green all passed, red some failed">${tiles}${xLabels(H - 28)}` +
    `<text x="${PAD_L}" y="${H - 8}" class="tick">Run date (month-day, UTC)</text></svg>`;
}

function durationChart() {
  const H = 220, top = 16, bottom = 176, plotH = bottom - top;
  const maxS = Math.max(1, ...history.map(h => h.durationMs / 1000));
  const step = [5, 10, 15, 20, 30, 60, 120, 300, 600].find(st => st * 4 >= maxS) || Math.ceil(maxS / 4);
  const niceMax = step * Math.ceil(maxS / step);
  const y = s => bottom - (s / niceMax) * plotH;
  const grid = Array.from({ length: niceMax / step + 1 }, (_, k) => k * step).map(v =>
    `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${PAD_L - 8}" y="${y(v) + 4}" text-anchor="end" class="tick">${v}s</text>`).join('');
  const pts = history.map((h, i) => `${xMid(i).toFixed(1)},${y(h.durationMs / 1000).toFixed(1)}`).join(' ');
  const dots = history.map((h, i) =>
    `<circle cx="${xMid(i).toFixed(1)}" cy="${y(h.durationMs / 1000).toFixed(1)}" r="3.5" class="${h.failed ? 'dot-bad' : 'dot'}"><title>${esc(`${day(h.runAt)}: ${secs(h.durationMs)} s`)}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Test run duration per run">${grid}` +
    (n > 1 ? `<polyline points="${pts}" class="line"/>` : '') + dots + xLabels(H - 20) +
    `<text x="${PAD_L}" y="${H - 2}" class="tick">Run date (month-day, UTC)</text></svg>`;
}

// Tests that failed at least once in the window: candidates for flakiness or regressions.
const unstable = new Map();
for (const h of history) {
  for (const id of h.failedTests || []) {
    const u = unstable.get(id) || { id, count: 0, last: '' };
    u.count += 1;
    u.last = h.runAt;
    unstable.set(id, u);
  }
}
const unstableRows = [...unstable.values()].sort((a, b) => b.count - a.count || String(b.last).localeCompare(String(a.last)));
const unstableSection = unstableRows.length
  ? `<table><tr><th>Test</th><th>Failed in</th><th>Last failed</th></tr>${unstableRows.map(u =>
      `<tr><td>${esc(u.id)}</td><td>${u.count} of ${n} runs</td><td>${esc(day(u.last))} ${esc(time(u.last))} UTC</td></tr>`).join('')}</table>`
  : `<p class="good">No test failed in the last ${n} run${n === 1 ? '' : 's'}.</p>`;

const recent = [...history].reverse().slice(0, 15);
const recentRows = recent.map(h =>
  `<tr><td>${esc(day(h.runAt))} ${esc(time(h.runAt))}</td><td>${esc(h.trigger)}</td><td>${h.commit ? `<code>${esc(h.commit)}</code>` : '—'}</td>` +
  `<td class="${h.failed ? 'bad' : 'ok'}">${h.failed ? `${h.failed} failed` : 'all passed'} (${h.passed}/${h.tests})</td>` +
  `<td>${secs(h.durationMs)} s</td><td>${h.runUrl ? `<a href="${esc(h.runUrl)}">run log</a>` : '—'}</td></tr>`).join('');

const style = 'body{font:16px system-ui;margin:40px auto;max-width:1100px;color:#21334a;padding:0 16px}svg{width:100%;height:auto;display:block;margin:8px 0 24px}.grid{stroke:#e3e9f0}.tick{font-size:12px;fill:#5c6e81}.pass{fill:#2e9e5b}.failbar{fill:#d64545}.count{font-size:14px;font-weight:700;fill:#fff}.line{fill:none;stroke:#2f6db5;stroke-width:2}.dot{fill:#2f6db5}.dot-bad{fill:#d64545}table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border:1px solid #ccd5e0;padding:10px;text-align:left}th{background:#e9f0f8}.kpi{display:inline-block;padding:16px;background:#edf4fa;border-radius:10px;margin:6px}.ok{color:#14532d}.bad{color:#7f1d1d;font-weight:600}.good{color:#14532d}.key span{display:inline-block;width:12px;height:12px;border-radius:2px;margin:0 6px 0 16px;vertical-align:-1px}.note{color:#4a5b6e}';

const body = n === 0
  ? `<p>No runs recorded yet. The trends fill in after the first published run.</p>`
  : `<p>${greenRuns} of the last ${n} run${n === 1 ? '' : 's'} passed every test. Average duration ${secs(avgMs)} s.</p>` +
    `<div class="kpi">Runs recorded: <b>${n}</b></div><div class="kpi">All-green runs: <b>${greenRuns}</b></div>` +
    `<div class="kpi">Overall pass rate: <b>${passRate.toFixed(1)}%</b></div><div class="kpi">Average duration: <b>${secs(avgMs)} s</b></div>` +
    `<h2>Result of each run</h2><p class="key note"><span style="background:#2e9e5b"></span>all tests passed<span style="background:#d64545"></span>some failed (number of failed tests inside; hover for names)</p>${resultsChart()}` +
    `<h2>Run duration</h2><p class="note">Time for the whole suite, all browsers. A sudden rise can mean a slow page or a test that waits too long. Red dots are runs with failures.</p>${durationChart()}` +
    `<h2>Unstable tests</h2><p class="note">Tests that failed at least once in these runs. A test that fails now and then without code changes may be flaky.</p>${unstableSection}` +
    `<h2>Recent runs</h2><table><tr><th>Started (UTC)</th><th>Trigger</th><th>Commit</th><th>Result</th><th>Duration</th><th>Log</th></tr>${recentRows}</table>`;

fs.writeFileSync(path.join(outDir, 'trends.html'),
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BioGuard AI — Test Trends</title><style>${style}</style></head><body>` +
  `<h1>BioGuard AI — Test Trends</h1><p><a href="${esc(dashboardLink)}">← Latest results</a></p>${body}` +
  `<p class="note">Keeps the last ${MAX_RUNS} runs. Synthetic educational demo.</p></body></html>`);
console.log(`History has ${n} run(s). Wrote ${path.join(outDir, 'history.json')} and ${path.join(outDir, 'trends.html')}`);
