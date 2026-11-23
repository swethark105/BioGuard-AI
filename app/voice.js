// Voice Q&A: visitors ask about the project by voice or by typing.
// The page itself is public/voice.html; it is also published on GitHub Pages.
// The browser turns speech into text and reads the answer aloud (Web Speech API).
// Answers come only from voice-answers.json, so nothing is made up and there is no AI cost.

import fs from 'node:fs';

const ANSWERS_FILE = new URL('./voice-answers.json', import.meta.url);
const PAGE_FILE = new URL('../public/voice.html', import.meta.url);
const ANSWERS = JSON.parse(fs.readFileSync(ANSWERS_FILE, 'utf8'));
const README_URL = 'https://github.com/swethark105/BioGuard-AI#readme';
const NO_ANSWER = "I don't know that yet. The README has the full details.";

// Questions we could not answer, kept in memory so we know what to add next.
const unanswered = [];

// ---------- Part 1: find the best answer ----------

// Picks the entry whose keywords match the most words in the question.
export function findAnswer(question) {
  const words = new Set(String(question).toLowerCase().match(/[a-z0-9]+/g) || []);
  let best = null;
  let bestScore = 0;
  for (const entry of ANSWERS) {
    const score = entry.keywords.filter(k => words.has(k)).length;
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

// ---------- Part 2: the page and the API ----------

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

// Returns true when it handled the request, so server.js knows to stop there.
export async function handleVoice(req, res, path) {
  if (req.method === 'GET' && path === '/voice') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(PAGE_FILE));
    return true;
  }

  // The page reads this file itself when there is no server (GitHub Pages).
  if (req.method === 'GET' && path === '/voice-answers.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(fs.readFileSync(ANSWERS_FILE));
    return true;
  }

  if (req.method === 'GET' && path === '/api/voice/unanswered') {
    send(res, 200, unanswered);
    return true;
  }

  if (req.method === 'POST' && path === '/api/voice/ask') {
    let body = '';
    for await (const chunk of req) body += chunk;

    let question;
    try {
      question = String(JSON.parse(body).question || '').trim();
    } catch {
      question = '';
    }
    if (!question || question.length > 300) {
      send(res, 400, { error: 'Ask a question of 1 to 300 characters.' });
      return true;
    }

    const entry = findAnswer(question);
    if (entry) {
      send(res, 200, { matched: true, id: entry.id, answer: entry.answer });
    } else {
      unanswered.push({ question, askedAt: new Date().toISOString() });
      send(res, 200, { matched: false, answer: NO_ANSWER, readme: README_URL });
    }
    return true;
  }

  return false;
}