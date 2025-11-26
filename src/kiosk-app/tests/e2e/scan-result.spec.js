// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Scan Result View E2E Tests
 *
 * Tests for the /scan-result view which shows student confirmation.
 * Verifies:
 * 1. School name comes from config, not hardcoded
 * 2. Student information is displayed correctly
 * 3. Entry/Exit states are handled properly
 */

test.describe('Scan Result View', () => {

  test('should display school name from config, not hardcoded', async ({ page }) => {
    // Navigate to scan-result with a valid student
    await page.goto('/#/scan-result?student_id=1&source=QR');

    // Wait for the page to render
    await page.waitForSelector('.school-name');

    // Get the school name displayed
    const schoolName = await page.textContent('.school-name');

    // Should match the config value "Colegio San Patricio", NOT "Dunalastair Peñalolén"
    expect(schoolName).toBe('Colegio San Patricio');
    expect(schoolName).not.toBe('Dunalastair Peñalolén');
  });

  test('should display student name correctly', async ({ page }) => {
    // Navigate to scan-result with student_id=1 (Martín González Pérez)
    await page.goto('/#/scan-result?student_id=1&source=QR');

    await page.waitForSelector('.welcome-student-name');

    const studentName = await page.textContent('.welcome-student-name');
    expect(studentName).toContain('Martín González Pérez');
  });

  test('should display guardian name correctly', async ({ page }) => {
    // Navigate to scan-result with student_id=1
    await page.goto('/#/scan-result?student_id=1&source=QR');

    await page.waitForSelector('.welcome-guardian');

    const guardianText = await page.textContent('.welcome-guardian');
    expect(guardianText).toContain('Roberto González Silva');
  });

  test('should show entry state for first scan of the day', async ({ page }) => {
    // Clear any existing queue data first
    await page.goto('/');
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('kioskData') || '{}');
      data.queue = [];
      localStorage.setItem('kioskData', JSON.stringify(data));
    });

    // Navigate to scan-result
    await page.goto('/#/scan-result?student_id=1&source=QR');

    await page.waitForSelector('.welcome-greeting');

    // First scan should be entry (IN)
    const greeting = await page.textContent('.welcome-greeting');
    expect(greeting).toContain('¡Bienvenido!');

    // Should have entry styling
    const screen = await page.locator('.scan-result-screen');
    await expect(screen).toHaveClass(/screen-entry/);
  });

  test('should display course information', async ({ page }) => {
    await page.goto('/#/scan-result?student_id=1&source=QR');

    await page.waitForSelector('.student-course');

    const courseText = await page.textContent('.student-course');
    // Student 1 has course_id=1, so should show "1° Básico"
    expect(courseText).toContain('1');
    expect(courseText).toContain('Básico');
  });

  test('should redirect to home if student_id is invalid', async ({ page }) => {
    // Navigate with invalid student_id
    await page.goto('/#/scan-result?student_id=99999&source=QR');

    // Should redirect to home
    await page.waitForURL(/#\/home/);
    await expect(page).toHaveURL(/#\/home/);
  });

  test('should have back button that navigates to home', async ({ page }) => {
    await page.goto('/#/scan-result?student_id=1&source=QR');

    await page.waitForSelector('.back-btn');

    // Click back button
    await page.click('.back-btn');

    // Should navigate to home
    await page.waitForURL(/#\/home/);
    await expect(page).toHaveURL(/#\/home/);
  });

});
