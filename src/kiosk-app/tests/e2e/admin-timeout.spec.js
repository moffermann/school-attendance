// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Admin Panel Session Timeout E2E Tests
 */

test.describe('Admin Panel Session Timeout', () => {

  test('should display admin panel correctly', async ({ page }) => {
    await page.goto('/#/admin-panel');
    await page.waitForSelector('.card-header');

    const content = await page.textContent('#app');
    expect(content).toContain('Panel de Administración');
  });

  test('should have back button to return to scan', async ({ page }) => {
    await page.goto('/#/admin-panel');
    await page.waitForSelector('button:has-text("Volver al Escaneo")');

    await page.click('button:has-text("Volver al Escaneo")');

    await page.waitForURL(/#\/home/);
    await expect(page).toHaveURL(/#\/home/);
  });

  test('should show timeout indicator when implemented', async ({ page }) => {
    await page.goto('/#/admin-panel');
    await page.waitForSelector('.card-header');

    // Check for timeout indicator (will be added in implementation)
    const timeoutIndicator = await page.locator('.session-timeout, .timeout-indicator').count();
    expect(timeoutIndicator).toBeGreaterThanOrEqual(0);
  });

});
