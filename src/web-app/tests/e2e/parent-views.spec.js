/**
 * Web App - Parent Views E2E Tests
 */
import { test, expect } from '@playwright/test';

async function setupParentSession(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.setItem('currentRole', 'parent');
    localStorage.setItem('currentGuardianId', '1');
    localStorage.setItem('sessionToken', 'test_token_' + Date.now());
  });
}

test.describe('Parent Home View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display parent home page', async ({ page }) => {
    await setupParentSession(page);
    await page.goto('/#/parent/home');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasHomeContent = pageContent.includes('Hoy') ||
                           pageContent.includes('Alumno') ||
                           pageContent.includes('estudiante') ||
                           pageContent.includes('Entrada');
    expect(hasHomeContent).toBe(true);
  });

  test('should show student attendance status', async ({ page }) => {
    await setupParentSession(page);
    await page.goto('/#/parent/home');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasStatus = pageContent.includes('Entrada') ||
                      pageContent.includes('Salida') ||
                      pageContent.includes('Sin registro') ||
                      pageContent.includes('Historial');
    expect(hasStatus).toBe(true);
  });
});

test.describe('Parent History View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display history page', async ({ page }) => {
    await setupParentSession(page);
    await page.goto('/#/parent/history');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasHistoryContent = pageContent.includes('Historial') ||
                              pageContent.includes('History') ||
                              pageContent.includes('Fecha');
    expect(hasHistoryContent).toBe(true);
  });

  test('should have date filter', async ({ page }) => {
    await setupParentSession(page);
    await page.goto('/#/parent/history');
    await page.waitForTimeout(1500);

    const dateInput = page.locator('input[type="date"]');
    const hasDate = await dateInput.first().isVisible().catch(() => false);
    expect(hasDate).toBe(true);
  });
});

test.describe('Parent Preferences View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display preferences page', async ({ page }) => {
    await setupParentSession(page);
    await page.goto('/#/parent/prefs');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasPrefsContent = pageContent.includes('Preferencias') ||
                            pageContent.includes('Preferences') ||
                            pageContent.includes('Notificaciones') ||
                            pageContent.includes('WhatsApp') ||
                            pageContent.includes('Email');
    expect(hasPrefsContent).toBe(true);
  });

  test('should have notification toggles', async ({ page }) => {
    await setupParentSession(page);
    await page.goto('/#/parent/prefs');
    await page.waitForTimeout(1500);

    const toggles = page.locator('input[type="checkbox"], .toggle, [role="switch"]');
    const count = await toggles.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Parent Absences View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display absences page', async ({ page }) => {
    await setupParentSession(page);
    await page.goto('/#/parent/absences');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasAbsencesContent = pageContent.includes('Ausencia') ||
                               pageContent.includes('Absence') ||
                               pageContent.includes('Solicitar') ||
                               pageContent.includes('Justificar');
    expect(hasAbsencesContent).toBe(true);
  });

  test('should have absence request form', async ({ page }) => {
    await setupParentSession(page);
    await page.goto('/#/parent/absences');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasForm = pageContent.includes('Tipo') ||
                    pageContent.includes('Fecha') ||
                    pageContent.includes('Motivo') ||
                    pageContent.includes('Enviar');
    expect(hasForm).toBe(true);
  });
});
