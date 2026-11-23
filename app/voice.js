// Voice Q&A: visitors ask about the project by voice or by typing.
// The browser turns speech into text and reads the answer aloud (Web Speech API).
// Answers come only from voice-answers.json, so nothing is made up and there is no AI cost.

import fs from 'node:fs';

const ANSWERS = JSON.parse(fs.readFileSync(new URL('./voice-answers.json', import.meta.url), 'utf8'));
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
    res.end(VOICE_PAGE);
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

// ---------- Part 3: the voice page ----------

const VOICE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BioGuard AI | Ask about this project</title>
<style>body{font:16px system-ui;background:#f3f7fb;color:#182a40;margin:0}header{background:#153451;color:white;padding:25px 7%}main{max-width:750px;margin:30px auto;background:white;border-radius:16px;padding:28px;box-shadow:0 4px 24px #d9e2ee}label{display:block;font-weight:600;margin-bottom:6px}input{width:100%;box-sizing:border-box;padding:10px;font:inherit;border:1px solid #b8c6d6;border-radius:8px}button{margin:12px 8px 0 0;background:#153451;color:white;border:0;border-radius:8px;padding:11px 18px;font:inherit}#answer{margin-top:20px;padding:14px;border-radius:8px;background:#edf4fa}.note{color:#4a5b6e}[hidden]{display:none}</style></head>
<body><header><h1>BioGuard AI</h1><div>Ask about this project</div></header>
<main>
  <h2>Ask a question</h2>
  <p class="note">Try: "Which browsers do you test?" or "How does the login lockout work?"</p>
  <form id="ask-form">
    <label for="question">Your question</label>
    <input id="question" autocomplete="off">
    <button type="submit">Ask</button>
    <button type="button" id="mic">🎤 Speak</button>
  </form>
  <p id="mic-note" class="note" hidden>Voice input works in Chrome and Edge. In this browser, type your question instead.</p>
  <p id="answer" role="status" hidden></p>
  <p id="readme" hidden><a href="${README_URL}">Read the full README</a></p>
</main>
<script>
  const form = document.querySelector('#ask-form');
  const input = document.querySelector('#question');
  const mic = document.querySelector('#mic');
  const answerBox = document.querySelector('#answer');
  const readme = document.querySelector('#readme');

  // Read the answer aloud, using a female voice when the computer has one.
  const PREFERRED_VOICES = ['Microsoft Zira', 'Microsoft Aria', 'Google UK English Female', 'Samantha'];
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices.find(v => PREFERRED_VOICES.some(name => v.name.includes(name))) || null;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  async function ask(question) {
    const response = await fetch('/api/voice/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    const data = await response.json();
    const text = data.answer || data.error;
    answerBox.textContent = text;
    answerBox.hidden = false;
    readme.hidden = data.matched !== false;
    speak(text);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    ask(input.value);
  });

  // Speech to text. Chrome and Edge support it; Firefox does not, so we show a note.
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    mic.hidden = true;
    document.querySelector('#mic-note').hidden = false;
  } else {
    mic.addEventListener('click', () => {
      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.onresult = event => {
        input.value = event.results[0][0].transcript;
        ask(input.value);
      };
      recognition.start();
    });
  }
</script>
</body></html>`;