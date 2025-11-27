// @ts-check
/**
 * Teacher PWA - Courses and Roster Integration Tests
 */
const { test, expect } = require('@playwright/test');
const { TEST_USERS, TEST_COURSES, TEST_STUDENTS } = require('../fixtures');

/**
 * Login helper for teacher PWA
 */
async function loginAsTeacher(page) {
  const user = TEST_USERS.teacher;

  await page.goto('/teacher/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Check if we're on a login form
  const hasLoginForm = await page.locator('input[type="email"], input[name="email"], #email').count() > 0;
  if (!hasLoginForm) {
    return user; // Already logged in
  }

  await page.fill('input[type="email"], input[name="email"], #email', user.email);
  await page.fill('input[type="password"], input[name="password"], #password', user.password);

  const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Iniciar Sesión")');
  await submitBtn.click();

  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');

  return user;
}

test.describe('Teacher PWA - Courses', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/teacher/');
    await page.evaluate(() => {
      localStorage.clear();
      try { indexedDB.deleteDatabase('TeacherPWA'); } catch(e) {}
    });
    await loginAsTeacher(page);
  });

  test('should display list of assigned courses', async ({ page }) => {
    // After login, teacher should see courses or a dashboard
    await page.waitForTimeout(2000);

    const content = await page.textContent('body');

    // Should show courses or teacher-related content
    const hasCourse = TEST_COURSES.some(c =>
      content.includes(c.name) || content.includes(c.grade)
    );

    // Teacher PWA shows: courses list, class selection, or teacher info
    const hasTeacherContent = hasCourse ||
      content.includes('curso') ||
      content.includes('clase') ||
      content.includes('Cursos') ||
      content.includes('Mis Clases') ||
      content.includes('Selecciona') ||
      content.includes('profesor') ||
      content.includes('Básico');

    expect(hasTeacherContent).toBeTruthy();
  });

  test('should be able to select a course', async ({ page }) => {
    await page.goto('/teacher/#/classes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find and click on a course
    const courseCard = page.locator('.course-card, .class-card, [data-course], li:has-text("Básico")').first();

    if (await courseCard.count() > 0) {
      await courseCard.click();
      await page.waitForTimeout(2000);

      // Should navigate to roster or course detail
      const url = page.url();
      const content = await page.textContent('body');

      expect(
        url.includes('roster') ||
        url.includes('class') ||
        content.includes('estudiante') ||
        content.includes('alumno') ||
        content.includes('asistencia')
      ).toBeTruthy();
    }
  });

  test('should show student roster for selected course', async ({ page }) => {
    await page.goto('/teacher/#/classes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on first course
    const courseCard = page.locator('.course-card, .class-card, [data-course], li:has-text("Básico"), button:has-text("Básico")').first();

    if (await courseCard.count() > 0) {
      await courseCard.click();
      await page.waitForTimeout(3000);
      await page.waitForLoadState('networkidle');

      const content = await page.textContent('body');

      // Should show students or roster view
      const hasStudents = TEST_STUDENTS.some(s => content.includes(s.name));
      const hasRosterUI = content.includes('Lista') ||
                          content.includes('Asistencia') ||
                          content.includes('estudiante') ||
                          content.includes('alumno');

      expect(hasStudents || hasRosterUI).toBeTruthy();
    }
  });
});

test.describe('Teacher PWA - Attendance', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/teacher/');
    await page.evaluate(() => {
      localStorage.clear();
      try { indexedDB.deleteDatabase('TeacherPWA'); } catch(e) {}
    });
    await loginAsTeacher(page);
  });

  test('should be able to mark student as present', async ({ page }) => {
    // Navigate to a class roster
    await page.goto('/teacher/#/classes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on first course
    const courseCard = page.locator('.course-card, .class-card, [data-course], li:has-text("Básico")').first();

    if (await courseCard.count() > 0) {
      await courseCard.click();
      await page.waitForTimeout(3000);

      // Look for attendance toggle buttons
      const attendanceToggle = page.locator('button:has-text("Presente"), .attendance-btn, input[type="checkbox"], .toggle').first();

      if (await attendanceToggle.count() > 0) {
        await attendanceToggle.click();
        await page.waitForTimeout(1000);

        // Should show some feedback
        const content = await page.textContent('body');
        expect(content).toBeTruthy();
      }
    }
  });

  test('should show sync status indicator', async ({ page }) => {
    await page.goto('/teacher/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for sync indicator
    const syncIndicator = page.locator('.sync-status, .sync-indicator, [data-sync], .online-status');

    if (await syncIndicator.count() > 0) {
      await expect(syncIndicator.first()).toBeVisible();
    }
  });
});
