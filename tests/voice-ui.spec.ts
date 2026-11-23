import { test, expect } from '../fixtures/test-options';

// The voice page in a real browser (Chromium, Firefox and WebKit).
// Tests type the question: a test cannot talk into a microphone.

// Replace the browser's speaker with a recorder, so tests can check what would be said aloud.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as any).spoken = spoken;
    // Some test browsers have no speech engine at all, so give them a stand-in.
    if (!('SpeechSynthesisUtterance' in window)) {
      (window as any).SpeechSynthesisUtterance = class { voice = null; constructor(public text: string) {} };
    }
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: (u: { text: string }) => spoken.push(u.text), cancel: () => {}, getVoices: () => [] }
    });
  });
});

test('VOICE-005 a typed question shows the right answer', async ({ voicePage }) => {
  await test.step('GIVEN the user is on the voice page', async () => {
    await voicePage.open();
  });

  await test.step('WHEN the user asks which browsers are tested', async () => {
    await voicePage.ask('Which browsers do you test?');
  });

  await test.step('THEN the browsers answer is shown, with no README link', async () => {
    await expect(voicePage.answer).toContainText('three browser engines');
    await expect(voicePage.readmeLink).toBeHidden();
  });
});

test('VOICE-006 the answer is read aloud', async ({ voicePage, page }) => {
  await voicePage.open();

  await voicePage.ask('How does the login lockout work?');

  await expect(voicePage.answer).toContainText('six digit code');
  await expect.poll(() => page.evaluate(() => (window as any).spoken)).toEqual([await voicePage.answer.textContent()]);
});

test('VOICE-007 an unknown question points to the README', async ({ voicePage }) => {
  await voicePage.open();

  await voicePage.ask('What is the weather today?');

  await expect(voicePage.answer).toHaveText("I don't know that yet. The README has the full details.");
  await expect(voicePage.readmeLink).toHaveAttribute('href', 'https://github.com/swethark105/BioGuard-AI#readme');
});

test('VOICE-008 the mic button shows only where the browser supports speech input', async ({ voicePage, page }) => {
  await voicePage.open();

  const supported = await page.evaluate(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  if (supported) {
    await expect(voicePage.micButton).toBeVisible();
    await expect(voicePage.micNote).toBeHidden();
  } else {
    await expect(voicePage.micButton).toBeHidden();
    await expect(voicePage.micNote).toBeVisible();
  }
});
test('VOICE-009 a pause while speaking does not cut the question short', async ({ voicePage, page }) => {
  // A fake microphone: the test decides what it "hears" and when.
  await page.addInitScript(() => {
    class FakeRecognition {
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      constructor() { (window as any).fakeMic = this; }
      start() {}
      stop() { this.onend?.(); }
      hear(...parts: string[]) { this.onresult?.({ results: parts.map(transcript => [{ transcript }]) }); }
    }
    (window as any).SpeechRecognition = FakeRecognition;
  });
  await voicePage.open();

  await test.step('WHEN the user clicks Speak, says "Which", and pauses', async () => {
    await voicePage.micButton.click();
    await page.evaluate(() => (window as any).fakeMic.hear('Which'));
  });

  await test.step('THEN it keeps listening and does not answer yet', async () => {
    await expect(voicePage.stopButton).toBeVisible();
    await expect(voicePage.questionInput).toHaveValue('Which');
    await expect(voicePage.answer).toBeHidden();
  });

  await test.step('WHEN the user finishes the question and clicks Stop', async () => {
    await page.evaluate(() => (window as any).fakeMic.hear('Which', 'browsers do you test'));
    await voicePage.stopButton.click();
  });

  await test.step('THEN the whole question is answered', async () => {
    await expect(voicePage.questionInput).toHaveValue('Which browsers do you test');
    await expect(voicePage.answer).toContainText('three browser engines');
    await expect(voicePage.micButton).toBeVisible();
  });
});

test('VOICE-010 Listen reads the project intro aloud', async ({ voicePage, page }) => {
  await voicePage.open();

  await voicePage.listenButton.click();

  const spoken: string[] = await page.evaluate(() => (window as any).spoken);
  expect(spoken).toHaveLength(1);
  expect(spoken[0]).toContain('welcome to BioGuard AI');
  expect(spoken[0]).toContain('a person always makes the final call');
});

test('VOICE-011 the page still answers with no server, as on GitHub Pages', async ({ voicePage, page }) => {
  // GitHub Pages has no /api, so every API call gets "404 Not Found".
  await page.route('**/api/voice/**', route => route.fulfill({ status: 404, body: 'Not Found' }));
  await voicePage.open();

  await test.step('a known question is answered from voice-answers.json', async () => {
    await voicePage.ask('Which browsers do you test?');
    await expect(voicePage.answer).toContainText('three browser engines');
    await expect(voicePage.readmeLink).toBeHidden();
  });

  await test.step('an unknown question still points to the README', async () => {
    await voicePage.ask('What is the weather today?');
    await expect(voicePage.answer).toHaveText("I don't know that yet. The README has the full details.");
    await expect(voicePage.readmeLink).toBeVisible();
  });
});