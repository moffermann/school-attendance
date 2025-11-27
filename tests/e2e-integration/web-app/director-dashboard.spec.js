// @ts-check
/**
 * Web App - Director Dashboard Integration Tests
 */
const { test, expect } = require('@playwright/test');
const { TEST_USERS, TEST_COURSES, TEST_STUDENTS, login } = require('../fixtures');

test.describe('Director Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page, 'director');
  });

  test('should display dashboard with metrics', async ({ page }) => {
    // After login, director should be on dashboard
    await page.waitForTimeout(1000);

    // Should show dashboard content with Spanish labels
    const content = await page.textContent('body');
    expect(
      content.includes('Resumen de hoy') ||
      content.includes('Tablero') ||
      content.includes('Alumnos') ||
      content.includes('Eventos')
    ).toBeTruthy();
  });

  test('should show student list', async ({ page }) => {
    // Navigate to students section
    const studentsLink = page.locator('a:has-text("Estudiantes"), a:has-text("Alumnos"), nav >> text=Estudiantes');
    if (await studentsLink.count() > 0) {
      await studentsLink.first().click();
      await page.waitForLoadState('networkidle');

      // Should show at least one test student
      const content = await page.textContent('body');
      const hasStudent = TEST_STUDENTS.some(s => content.includes(s.name));
      expect(hasStudent).toBeTruthy();
    }
  });

  test('should show courses list', async ({ page }) => {
    // Navigate to courses section
    const coursesLink = page.locator('a:has-text("Cursos"), a:has-text("Clases"), nav >> text=Cursos');
    if (await coursesLink.count() > 0) {
      await coursesLink.first().click();
      await page.waitForLoadState('networkidle');

      // Should show test courses
      const content = await page.textContent('body');
      const hasCourse = TEST_COURSES.some(c => content.includes(c.name) || content.includes(c.grade));
      expect(hasCourse).toBeTruthy();
    }
  });

  test('should display attendance overview', async ({ page }) => {
    // Director dashboard shows attendance summary
    await page.waitForTimeout(1000);

    // Look for attendance-related content (Spanish labels)
    const content = await page.textContent('body');
    expect(
      content.includes('Resumen') ||
      content.includes('hoy') ||
      content.includes('Eventos') ||
      content.includes('Alertas') ||
      content.includes('Últimos')
    ).toBeTruthy();
  });

  test('should have navigation menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have navigation elements
    const nav = page.locator('nav, .nav, .menu, .sidebar, header');
    await expect(nav.first()).toBeVisible();
  });

  test('should show user info in header/nav', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const content = await page.textContent('body');
    expect(
      content.includes(TEST_USERS.director.name) ||
      content.includes('Director') ||
      content.includes('Salir')
    ).toBeTruthy();
  });
});
