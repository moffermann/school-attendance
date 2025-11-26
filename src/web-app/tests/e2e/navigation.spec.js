/**
 * Web App - Navigation E2E Tests
 */
const { test, expect } = require('@playwright/test');

async function setupDirectorSession(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.setItem('currentRole', 'director');
    localStorage.setItem('sessionToken', 'test_token_' + Date.now());
  });
}

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should navigate to dashboard', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/director/dashboard');
  });

  test('should navigate to reports', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/reports');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/director/reports');
  });

  test('should navigate to devices', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/devices');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/director/devices');
  });

  test('should redirect to auth without session', async ({ page }) => {
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth');
  });

  test('should have sidebar with navigation links', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1500);

    const sidebar = page.locator('.sidebar, .sidebar-nav, aside');
    const hasSidebar = await sidebar.first().isVisible().catch(() => false);
    expect(hasSidebar).toBe(true);
  });

  test('should have multiple navigation items', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasNavItems = pageContent.includes('Dashboard') ||
                        pageContent.includes('Reportes') ||
                        pageContent.includes('Dispositivos');
    expect(hasNavItems).toBe(true);
  });
});

test.describe('Access Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('parent should not access director pages', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('currentRole', 'parent');
      localStorage.setItem('currentGuardianId', '1');
      localStorage.setItem('sessionToken', 'test_token_' + Date.now());
    });

    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1000);

    // Should redirect to parent home or show error
    const url = page.url();
    const redirected = url.includes('/parent') || url.includes('/auth');
    expect(redirected).toBe(true);
  });

  test('director should not access parent pages', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/parent/home');
    await page.waitForTimeout(1000);

    // Should redirect to director dashboard or show error
    const url = page.url();
    const redirected = url.includes('/director') || url.includes('/auth');
    expect(redirected).toBe(true);
  });
});
