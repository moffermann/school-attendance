/**
 * Teacher PWA - Authentication E2E Tests
 */
const { test, expect } = require('@playwright/test');

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.clear();
      try { indexedDB.deleteDatabase('TeacherPWA'); } catch(e) {}
    });
    await page.reload();
  });

  test('should show login form on /auth', async ({ page }) => {
    await page.goto('/#/auth');
    await expect(page.locator('input[type="email"], input[name="email"], #email')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"], #password')).toBeVisible();
  });

  test('should redirect to /auth when not authenticated', async ({ page }) => {
    await page.goto('/#/classes');
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/auth');
  });

  test('should redirect to /auth for protected routes', async ({ page }) => {
    const protectedRoutes = ['/classes', '/roster', '/history', '/queue', '/settings'];

    for (const route of protectedRoutes) {
      await page.goto(`/#${route}`);
      await page.waitForTimeout(300);
      expect(page.url()).toContain('/auth');
    }
  });
});
