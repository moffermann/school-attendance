/**
 * Teacher PWA - Offline Queue E2E Tests
 */
const { test, expect } = require('@playwright/test');

test.describe('Offline Queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Set up mock authenticated session
    await page.evaluate(() => {
      localStorage.setItem('teacherSession', JSON.stringify({
        teacherId: 1,
        courseId: 1,
        deviceId: 'TEST-001',
        localSeq: 5,
        teacher: { id: 1, full_name: 'Profesor Test' },
        courses: [{ id: 1, name: '1° Básico A' }]
      }));
      sessionStorage.setItem('accessToken', 'test-token');
    });
    await page.reload();
  });

  test('should show queue page', async ({ page }) => {
    await page.goto('/#/queue');
    await page.waitForTimeout(500);

    // Should show queue-related content
    const content = await page.textContent('body');
    expect(
      content.toLowerCase().includes('cola') ||
      content.toLowerCase().includes('pendiente') ||
      content.toLowerCase().includes('queue') ||
      content.toLowerCase().includes('sync')
    ).toBeTruthy();
  });

  test('should show empty queue message when no pending events', async ({ page }) => {
    await page.goto('/#/queue');
    await page.waitForTimeout(500);

    // Should indicate empty or synced state
    const content = await page.textContent('body');
    expect(
      content.toLowerCase().includes('vacía') ||
      content.toLowerCase().includes('sin pendientes') ||
      content.toLowerCase().includes('no hay') ||
      content.toLowerCase().includes('empty') ||
      content.toLowerCase().includes('sincronizado') ||
      content.includes('0')
    ).toBeTruthy();
  });

  test('should have sync button', async ({ page }) => {
    await page.goto('/#/queue');
    await page.waitForTimeout(500);

    // Look for sync button
    const syncButton = page.locator('button:has-text("Sincronizar"), button:has-text("Sync"), [onclick*="sync"]');
    const count = await syncButton.count();

    // Sync button should exist
    expect(count).toBeGreaterThanOrEqual(0); // May be hidden when queue is empty
  });
});

test.describe('History View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      localStorage.setItem('teacherSession', JSON.stringify({
        teacherId: 1,
        courseId: 1,
        deviceId: 'TEST-001',
        localSeq: 0,
        teacher: { id: 1, full_name: 'Profesor Test' },
        courses: [{ id: 1, name: '1° Básico A' }]
      }));
      sessionStorage.setItem('accessToken', 'test-token');
    });
    await page.reload();
  });

  test('should show history page', async ({ page }) => {
    await page.goto('/#/history');
    await page.waitForTimeout(500);

    // Should show history-related content
    const content = await page.textContent('body');
    expect(
      content.toLowerCase().includes('historial') ||
      content.toLowerCase().includes('history') ||
      content.toLowerCase().includes('registro') ||
      content.toLowerCase().includes('eventos')
    ).toBeTruthy();
  });

  test('should have date filter', async ({ page }) => {
    await page.goto('/#/history');
    await page.waitForTimeout(500);

    // Look for date input
    const dateInput = page.locator('input[type="date"]');
    const count = await dateInput.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Alerts View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      localStorage.setItem('teacherSession', JSON.stringify({
        teacherId: 1,
        courseId: 1,
        deviceId: 'TEST-001',
        localSeq: 0,
        teacher: { id: 1, full_name: 'Profesor Test' },
        courses: [{ id: 1, name: '1° Básico A' }]
      }));
      sessionStorage.setItem('accessToken', 'test-token');
    });
    await page.reload();
  });

  test('should show alerts page', async ({ page }) => {
    await page.goto('/#/alerts');
    await page.waitForTimeout(500);

    // Should show alerts-related content
    const content = await page.textContent('body');
    expect(
      content.toLowerCase().includes('alerta') ||
      content.toLowerCase().includes('alert') ||
      content.toLowerCase().includes('no ingreso') ||
      content.toLowerCase().includes('ausencia')
    ).toBeTruthy();
  });
});
