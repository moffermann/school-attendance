// @ts-check
/**
 * Playwright configuration for E2E integration tests against real backend
 * Run with: npx playwright test --config=playwright.integration.config.js
 */
const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'https://school-attendance.dev.gocode.cl';

module.exports = defineConfig({
  fullyParallel: false, // Run sequentially to avoid race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker for integration tests
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-integration' }],
  ],
  timeout: 60000, // 60s timeout for real API calls
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Accept self-signed certs if needed
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'integration-web-app',
      testDir: './tests/e2e-integration/web-app',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'integration-teacher-pwa',
      testDir: './tests/e2e-integration/teacher-pwa',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'integration-kiosk',
      testDir: './tests/e2e-integration/kiosk',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  // No webServer - we test against the real deployed app
});
