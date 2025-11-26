/**
 * Web App - Director Views E2E Tests
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

test.describe('Reports View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display reports page', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/reports');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasReportsContent = pageContent.includes('Reportes') ||
                              pageContent.includes('Reports') ||
                              pageContent.includes('Fecha');
    expect(hasReportsContent).toBe(true);
  });

  test('should have date range filters', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/reports');
    await page.waitForTimeout(1500);

    const dateInput = page.locator('input[type="date"]');
    const count = await dateInput.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Devices View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display devices page', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/devices');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasDevicesContent = pageContent.includes('Dispositivos') ||
                              pageContent.includes('Devices') ||
                              pageContent.includes('Gate') ||
                              pageContent.includes('Batería');
    expect(hasDevicesContent).toBe(true);
  });

  test('should show device status', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/devices');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasStatus = pageContent.includes('Activo') ||
                      pageContent.includes('Active') ||
                      pageContent.includes('Online') ||
                      pageContent.includes('%');
    expect(hasStatus).toBe(true);
  });
});

test.describe('Schedules View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display schedules page', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/schedules');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasSchedulesContent = pageContent.includes('Horarios') ||
                                pageContent.includes('Schedules') ||
                                pageContent.includes('Lunes') ||
                                pageContent.includes('Entrada');
    expect(hasSchedulesContent).toBe(true);
  });
});

test.describe('Absences View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display absences page', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/absences');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasAbsencesContent = pageContent.includes('Ausencias') ||
                               pageContent.includes('Absences') ||
                               pageContent.includes('Pendiente') ||
                               pageContent.includes('Solicitud');
    expect(hasAbsencesContent).toBe(true);
  });

  test('should have tabs for status', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/absences');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasTabs = pageContent.includes('Pendiente') ||
                    pageContent.includes('Aprobado') ||
                    pageContent.includes('Rechazado');
    expect(hasTabs).toBe(true);
  });
});

test.describe('Broadcast View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display broadcast page', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/broadcast');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasBroadcastContent = pageContent.includes('Mensaje') ||
                                pageContent.includes('Broadcast') ||
                                pageContent.includes('Enviar') ||
                                pageContent.includes('Notificación');
    expect(hasBroadcastContent).toBe(true);
  });
});

test.describe('Students View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display students page', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasStudentsContent = pageContent.includes('Estudiantes') ||
                               pageContent.includes('Students') ||
                               pageContent.includes('Alumno') ||
                               pageContent.includes('Curso');
    expect(hasStudentsContent).toBe(true);
  });

  test('should have search input', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"], input[type="text"]');
    const hasSearch = await searchInput.first().isVisible().catch(() => false);
    expect(hasSearch).toBe(true);
  });
});
