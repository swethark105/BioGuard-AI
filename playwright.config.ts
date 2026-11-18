import { defineConfig, devices } from '@playwright/test';

// Tests that only call the API (no browser) run once.
const apiOnly = [/api\.spec\.ts$/, /ai-failure-analysis\.spec\.ts$/];

// The user-facing pages are checked in all three browser engines.
const crossBrowser = [/ui\.spec\.ts$/, /seed\.spec\.ts$/, /agents\/.*\.spec\.ts$/];

// The internal AI review dashboard changes saved state, so it runs once, in Chromium.
const chromiumOnly = [/ai-review\.spec\.ts$/];

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
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
