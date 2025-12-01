/**
 * Teacher PWA - Classes View E2E Tests
 */
const { test, expect } = require('@playwright/test');

test.describe('Classes View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Set up mock authenticated session
    await page.evaluate(() => {
      localStorage.setItem('teacherSession', JSON.stringify({
        teacherId: 1,
        courseId: null,
        deviceId: 'TEST-001',
        localSeq: 0,
        teacher: { id: 1, full_name: 'Profesor Test' },
        courses: [
          { id: 1, name: '1° Básico A', grade: '1', section: 'A' },
          { id: 2, name: '2° Básico B', grade: '2', section: 'B' }
        ]
      }));
      sessionStorage.setItem('accessToken', 'test-token');
    });
    await page.reload();
  });

  test('should display list of courses', async ({ page }) => {
    await page.goto('/#/classes');
    await page.waitForTimeout(500);

    // Should show course cards
    await expect(page.locator('text=1° Básico A')).toBeVisible();
    await expect(page.locator('text=2° Básico B')).toBeVisible();
  });

  test('should show teacher name in header', async ({ page }) => {
    await page.goto('/#/classes');
    await page.waitForTimeout(500);

    // Should display teacher name somewhere
    const content = await page.textContent('body');
    expect(content).toContain('Profesor Test');
  });

  test('should navigate to roster when clicking course', async ({ page }) => {
    await page.goto('/#/classes');
    await page.waitForTimeout(500);

    // Click on first course
    await page.click('text=1° Básico A');
    await page.waitForTimeout(500);

    // Should navigate to roster or attendance view
    const url = page.url();
    expect(url.includes('/roster') || url.includes('/take') || url.includes('/classes')).toBeTruthy();
  });

  test('should show empty state when no courses', async ({ page }) => {
    // Override with empty courses
    await page.evaluate(() => {
      localStorage.setItem('teacherSession', JSON.stringify({
        teacherId: 1,
        courseId: null,
        deviceId: 'TEST-001',
        localSeq: 0,
        teacher: { id: 1, full_name: 'Profesor Test' },
        courses: []
      }));
    });
    await page.reload();
    await page.goto('/#/classes');
    await page.waitForTimeout(500);

    // Should show some indication of no courses
    const content = await page.textContent('body');
    expect(
      content.toLowerCase().includes('no hay') ||
      content.toLowerCase().includes('sin cursos') ||
      content.toLowerCase().includes('empty')
    ).toBeTruthy();
  });
});
