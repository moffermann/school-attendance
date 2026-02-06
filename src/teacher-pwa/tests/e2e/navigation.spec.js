/**
 * Teacher PWA - Navigation & PWA E2E Tests
 */
import { test, expect } from '@playwright/test';

test.describe('Navigation - Unauthenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API endpoints to prevent hanging
    await page.route('**/api/v1/**', route => route.abort());

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.clear();
      try { indexedDB.deleteDatabase('TeacherPWA'); } catch {}
    });
  });

  test('should redirect to auth without session', async ({ page }) => {
    await page.goto('/#/classes');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth');
  });

  test('should redirect history to auth', async ({ page }) => {
    await page.goto('/#/history');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth');
  });

  test('should redirect queue to auth', async ({ page }) => {
    await page.goto('/#/queue');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth');
  });
});

test.describe('PWA Features', () => {
  test('should have manifest link', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href').catch(() => null);
    expect(manifest).toBeTruthy();
  });

  test('should have viewport meta tag', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('should have theme-color meta tag', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content').catch(() => null);
    expect(themeColor).toBeTruthy();
  });
});
