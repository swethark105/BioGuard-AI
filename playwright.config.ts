import { defineConfig, devices } from '@playwright/test';

// Tests that only call the API (no browser) run once.
const apiOnly = [/api\.spec\.ts$/, /ai-failure-analysis\.spec\.ts$/];

// The user-facing pages are checked in all three browser engines.
const crossBrowser = [/ui\.spec\.ts$/, /seed\.spec\.ts$/, /agents\/.*\.spec\.ts$/];

// Run once, in Chromium: the AI review dashboard (it changes saved state) and
// the PDF report checks (the PDF is the same whichever browser downloads it).
const chromiumOnly = [/ai-review\.spec\.ts$/, /pdf-report\.spec\.ts$/];

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  // Approved files for toMatchSnapshot (e.g. the PDF report text), one per test file,
  // shared by every operating system and browser.
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFileName}/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'api', testMatch: apiOnly },
    { name: 'chromium', testMatch: [...crossBrowser, ...chromiumOnly], use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testMatch: crossBrowser, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: crossBrowser, use: { ...devices['Desktop Safari'] } }
  ],
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/results.json' }],
    ['junit', { outputFile: 'artifacts/junit.xml' }],
    ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]
  ]
});
