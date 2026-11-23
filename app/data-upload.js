// Data file checks: upload an instrument CSV file, check it, and score every sample.
//
// File format: a header row, then one row per sample.
//   sample_id,signal_1,signal_2,signal_3
//   RUN-001,0.91,0.88,0.94
//
// Score  = the average of the 3 signals, rounded to 2 decimal places.
// Status = PASS when the score is 0.80 or more, otherwise REVIEW.
// A bad file is rejected as a whole (HTTP 400, clear message, nothing saved).

const HEADER = 'sample_id,signal_1,signal_2,signal_3';
const SIGNALS = ['signal_1', 'signal_2', 'signal_3'];

// Accepted uploads, kept in memory (they reset when the app restarts).
const uploads = [];

// ---------- Part 1: check and score the file ----------

// Rounds to 2 decimal places. EPSILON stops values like 0.805 rounding down by mistake.
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Reads the CSV text. Returns the results, or throws an Error with a clear message.
export function scoreCsv(text, classify) {
  // Split into lines. \r?\n handles Windows (CRLF) and Mac/Linux (LF) line endings.
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length === 0) throw new Error('The file is empty.');
  if (lines[0].trim() !== HEADER) throw new Error(`Line 1: the header must be "${HEADER}".`);
  if (lines.length === 1) throw new Error('The file has a header but no samples.');

  const seenIds = new Set();
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1; // line 1 is the header
    const [sampleId, ...values] = lines[i].split(',').map(cell => cell.trim());

    if (!sampleId) throw new Error(`Line ${lineNumber}: sample_id is missing.`);
    if (seenIds.has(sampleId)) throw new Error(`Line ${lineNumber}: sample_id "${sampleId}" appears more than once.`);
    seenIds.add(sampleId);

    const signals = SIGNALS.map((column, k) => {
      const raw = values[k];
      if (raw === undefined || raw === '') throw new Error(`Line ${lineNumber}: ${column} is missing.`);
      // Only plain numbers like 0.85 are allowed, so "high", "1e3" or "Infinity" are rejected.
      if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`Line ${lineNumber}: ${column} "${raw}" is not a number.`);
      const value = Number(raw);
      if (value < 0 || value > 1) throw new Error(`Line ${lineNumber}: ${column} ${raw} must be between 0 and 1.`);
      return value;
    });

    const score = round2((signals[0] + signals[1] + signals[2]) / 3);
    results.push({ sampleId, score, status: classify({ signalQuality: score }) });
  }
  return results;
}
// ---------- Part 2: the page and the API ----------

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

// Returns true when it handled the request, so server.js knows to stop there.
export async function handleUpload(req, res, path, { audit, classify }) {
  if (req.method === 'GET' && path === '/upload') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(UPLOAD_PAGE);
    return true;
  }

  if (req.method === 'GET' && path === '/api/uploads') {
    send(res, 200, uploads);
    return true;
  }

  if (req.method === 'POST' && path === '/api/upload') {
    // The file name travels in a header; the CSV text is the request body.
    const fileName = String(req.headers['x-file-name'] || '');
    let text = '';
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 1_000_000) return send(res, 413, { error: 'The file is larger than 1 MB.' }), true;
    }

    if (!fileName.toLowerCase().endsWith('.csv')) {
      send(res, 400, { error: `"${fileName || 'The file'}" is not a CSV file. Upload a .csv file.` });
      return true;
    }

    let results;
    try {
      results = scoreCsv(text, classify);
    } catch (error) {
      send(res, 400, { error: error.message }); // rejected: nothing is saved
      return true;
    }

    // The file is valid: save it and record it in the audit log.
    const passCount = results.filter(r => r.status === 'PASS').length;
    const upload = {
      uploadId: `UPL-${String(uploads.length + 1).padStart(4, '0')}`,
      fileName,
      sampleCount: results.length,
      passCount,
      reviewCount: results.length - passCount,
      uploadedAt: new Date().toISOString()
    };
    uploads.push(upload);
    audit.push({
      eventId: `EVT-${String(audit.length + 1).padStart(4, '0')}`,
      uploadId: upload.uploadId,
      action: 'UPLOAD',
      result: `${upload.sampleCount} samples: ${passCount} PASS, ${upload.reviewCount} REVIEW`,
      timestamp: upload.uploadedAt
    });

    send(res, 200, { ...upload, results });
    return true;
  }

  return false;
}
// ---------- Part 3: the upload page ----------

const UPLOAD_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BioGuard AI | Upload instrument data</title>
<style>body{font:16px system-ui;background:#f3f7fb;color:#182a40;margin:0}header{background:#153451;color:white;padding:25px 7%}main{max-width:950px;margin:30px auto;background:white;border-radius:16px;padding:28px;box-shadow:0 4px 24px #d9e2ee}label{display:block;font-weight:600;margin-bottom:6px}button{margin-top:12px;background:#153451;color:white;border:0;border-radius:8px;padding:11px 18px;font:inherit}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;border-bottom:1px solid #dce4ee;text-align:left}.error{margin-top:16px;padding:12px;border-radius:8px;background:#fde2e1;color:#7f1d1d}[hidden]{display:none}code{background:#eef3f8;padding:2px 6px;border-radius:4px}</style></head>
<body><header><h1>BioGuard AI</h1><div>Synthetic Biotech Sample Quality Engineering Demo</div></header>
<main>
  <h2>Upload instrument data</h2>
  <p>Upload a CSV file with the header <code>${HEADER}</code>.</p>
  <form id="upload-form">
    <label for="file">CSV file</label>
    <input id="file" type="file" accept=".csv">
    <div><button type="submit">Upload</button></div>
  </form>
  <div id="error" class="error" role="alert" hidden></div>
  <p id="summary" role="status" hidden></p>
  <table id="results" hidden>
    <thead><tr><th>Sample ID</th><th>Score</th><th>Status</th></tr></thead>
    <tbody></tbody>
  </table>
</main>
<script>
  const form = document.querySelector('#upload-form');
  const error = document.querySelector('#error');
  const summary = document.querySelector('#summary');
  const table = document.querySelector('#results');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    error.hidden = true; summary.hidden = true; table.hidden = true;

    const file = document.querySelector('#file').files[0];
    if (!file) { error.textContent = 'Choose a CSV file first.'; error.hidden = false; return; }

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv', 'X-File-Name': file.name },
      body: await file.text()
    });
    const body = await response.json();

    if (!response.ok) { error.textContent = body.error; error.hidden = false; return; }

    const rows = table.querySelector('tbody');
    rows.replaceChildren();
    for (const r of body.results) {
      const tr = document.createElement('tr');
      for (const value of [r.sampleId, r.score.toFixed(2), r.status]) {
        const td = document.createElement('td');
        td.textContent = value; // textContent, not innerHTML: file content is never run as code
        tr.append(td);
      }
      rows.append(tr);
    }
    summary.textContent = body.sampleCount + ' samples: ' + body.passCount + ' PASS, ' + body.reviewCount + ' REVIEW';
    summary.hidden = false; table.hidden = false;
  });
</script></body></html>`;