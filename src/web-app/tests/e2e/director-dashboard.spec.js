/**
 * Web App - Director Dashboard E2E Tests
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

test.describe('Director Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should display dashboard page', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasDashboardContent = pageContent.includes('Dashboard') ||
                                pageContent.includes('Entradas') ||
                                pageContent.includes('Salidas') ||
                                pageContent.includes('Hoy');
    expect(hasDashboardContent).toBe(true);
  });

  test('should show statistics cards', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasStats = pageContent.includes('Llegadas') ||
                     pageContent.includes('Salidas') ||
                     pageContent.includes('Tardanzas') ||
                     pageContent.includes('Sin ingreso');
    expect(hasStats).toBe(true);
  });

  test('should have sidebar navigation', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1500);

    const sidebar = page.locator('.sidebar, .sidebar-nav, nav');
    const hasSidebar = await sidebar.first().isVisible().catch(() => false);
    expect(hasSidebar).toBe(true);
  });

  test('should have events section', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasEvents = pageContent.includes('Eventos') ||
                      pageContent.includes('Events') ||
                      pageContent.includes('Alumno') ||
                      pageContent.includes('Hora');
    expect(hasEvents).toBe(true);
  });

  test('should have filter options', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/dashboard');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasFilters = pageContent.includes('Filtrar') ||
                       pageContent.includes('Curso') ||
                       pageContent.includes('Tipo');
    expect(hasFilters).toBe(true);
  });
});
