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