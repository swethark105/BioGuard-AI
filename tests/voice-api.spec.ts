import { test, expect } from '@playwright/test';
import answers from '../app/voice-answers.json' with { type: 'json' };

// The voice Q&A API: POST /api/voice/ask with { question }.

const questions = [
  { question: 'Which browsers do you test?', id: 'browsers' },
  { question: 'How does the login lockout work?', id: 'login' },
  { question: 'How is the PDF report checked?', id: 'pdf' },
  { question: 'Is it run in Jenkins?', id: 'ci' }
];

test('VOICE-001 known questions get the matching answer', async ({ request }) => {
  for (const { question, id } of questions) {
    await test.step(`"${question}" -> ${id}`, async () => {
      const response = await request.post('/api/voice/ask', { data: { question } });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({ matched: true, id });
      expect(body.answer).toBe(answers.find(a => a.id === id)!.answer);
    });
  }
});

test('VOICE-002 an unknown question is answered honestly and logged', async ({ request }) => {
  const question = `What is the weather on planet ${Date.now()}?`;

  const response = await request.post('/api/voice/ask', { data: { question } });

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    matched: false,
    answer: "I don't know that yet. The README has the full details.",
    readme: 'https://github.com/swethark105/BioGuard-AI#readme'
  });
  const log = await (await request.get('/api/voice/unanswered')).json();
  expect(log.map((entry: { question: string }) => entry.question)).toContain(question);
});

test('VOICE-003 an empty or too long question is rejected', async ({ request }) => {
  for (const question of ['', '   ', 'a'.repeat(301)]) {
    const response = await request.post('/api/voice/ask', { data: { question } });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Ask a question of 1 to 300 characters.' });
  }
});

test('VOICE-004 every answer in the file can be reached by its own keywords', async ({ request }) => {
  for (const entry of answers) {
    const response = await request.post('/api/voice/ask', { data: { question: entry.keywords.join(' ') } });
    expect((await response.json()).id, `keywords of "${entry.id}" led to another answer`).toBe(entry.id);
  }
});