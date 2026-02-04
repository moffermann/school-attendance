/**
 * Web App - Authentication E2E Tests
 */
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('should show auth page on initial load', async ({ page }) => {
    await page.goto('/#/auth');
    await page.waitForTimeout(500);

    const pageContent = await page.textContent('body');
    const hasAuthContent = pageContent.includes('Director') ||
                           pageContent.includes('Inspector') ||
                           pageContent.includes('Iniciar') ||
                           pageContent.includes('Login');
    expect(hasAuthContent).toBe(true);
  });

  test('should have role selection buttons', async ({ page }) => {
    await page.goto('/#/auth');
    await page.waitForTimeout(500);

    const pageContent = await page.textContent('body');
    const hasRoles = pageContent.includes('Director') ||
                     pageContent.includes('Apoderado') ||
                     pageContent.includes('Parent');
    expect(hasRoles).toBe(true);
  });

  test('should redirect to auth for protected routes', async ({ page }) => {
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth');
  });

  test('should have demo login option', async ({ page }) => {
    await page.goto('/#/auth');
    await page.waitForTimeout(500);

    const pageContent = await page.textContent('body');
    const hasDemo = pageContent.includes('Demo') ||
                    pageContent.includes('demo') ||
                    pageContent.includes('Entrar');
    expect(hasDemo).toBe(true);
  });
});
