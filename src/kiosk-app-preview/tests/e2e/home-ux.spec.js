// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Home View UX Improvements E2E Tests
 */

test.describe('Home View UX Improvements', () => {

  test('should process valid token and show welcome', async ({ page }) => {
    await page.goto('/#/scan');
    await page.waitForSelector('#token-input');

    await page.fill('#token-input', 'nfc_001');
    await page.click('button:has-text("Simular Lectura")');

    await page.waitForURL(/#\/scan-result/, { timeout: 3000 });

    await page.waitForSelector('.welcome-student-name');
    const name = await page.textContent('.welcome-student-name');
    expect(name).toBeTruthy();
  });

});
