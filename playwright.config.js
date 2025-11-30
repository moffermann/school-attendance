// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'kiosk-app',
      testDir: './src/kiosk-app/tests/e2e',
      use: {
        browserName: 'chromium',
        baseURL: 'http://localhost:8081',
      },
    },
    {
      name: 'teacher-pwa',
      testDir: './src/teacher-pwa/tests/e2e',
      use: {
        browserName: 'chromium',
        baseURL: 'http://localhost:8082',
      },
    },
    {
      name: 'web-app',
      testDir: './src/web-app/tests/e2e',
      use: {
        browserName: 'chromium',
        baseURL: 'http://localhost:8083',
      },
    },
    {
      name: 'web-app-unit',
      testDir: './src/web-app/tests/unit',
      use: {
        browserName: 'chromium',
        baseURL: 'http://localhost:8083',
      },
    },
  ],
  webServer: [
    {
      command: 'npx serve src/kiosk-app -l 8081 -s',
      url: 'http://localhost:8081',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npx serve src/teacher-pwa -l 8082 -s',
      url: 'http://localhost:8082',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npx serve src/web-app -l 8083 -s',
      url: 'http://localhost:8083',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
