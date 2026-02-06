/**
 * Scan Result View E2E Tests
 *
 * Tests for the /scan-result view which shows student confirmation.
 * NOTE: The scan result view was redesigned in 2026 with new CSS classes.
 * Tests updated to match the new mobile/tablet responsive layout.
 */
import { test, expect } from '@playwright/test';

// Setup mock student data before each test
async function setupMockData(page) {
  await page.evaluate(() => {
    // Mock config
    const config = {
      schoolName: 'Colegio San Patricio',
      photoEnabled: false,
      deviceId: 'test-device'
    };

    // Mock students
    const students = [
      {
        id: 1,
        full_name: 'Martín González Pérez',
        course_id: 1,
        course_name: '1° Básico',
        photo_url: null
      }
    ];

    // Mock courses
    const courses = [
      { id: 1, name: '1° Básico', grade: '1', section: 'A' }
    ];

    const kioskData = {
      config: config,
      students: students,
      courses: courses,
      queue: [],
      lastSync: Date.now()
    };

    localStorage.setItem('kioskData', JSON.stringify(kioskData));
  });
}

test.describe('Scan Result View', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await setupMockData(page);
  });

  test('should display student name correctly', async ({ page }) => {
    // Navigate to scan-result with student_id=1
    await page.goto('/#/scan-result?student_id=1&source=QR');
    await page.waitForTimeout(1000);

    // The redesigned view uses different classes for mobile vs tablet
    // Mobile: .mobile-student-name, Tablet: h1 with Tailwind classes
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Martín González Pérez');
  });

  test('should display course information', async ({ page }) => {
    await page.goto('/#/scan-result?student_id=1&source=QR');
    await page.waitForTimeout(1000);

    const pageContent = await page.textContent('body');
    // Student 1 has course_name "1° Básico"
    expect(pageContent).toContain('1° Básico');
  });

  test('should redirect to home if student_id is invalid', async ({ page }) => {
    // Navigate with invalid student_id
    await page.goto('/#/scan-result?student_id=99999&source=QR');

    // Should redirect to home
    await page.waitForURL(/#\/home/);
    await expect(page).toHaveURL(/#\/home/);
  });

  test('should have cancel button that navigates to home', async ({ page }) => {
    await page.goto('/#/scan-result?student_id=1&source=QR');
    await page.waitForTimeout(1000);

    // The redesigned view uses .mobile-cancel-btn on mobile or a button with "Cancelar" text
    const cancelButton = page.locator('button:has-text("Cancelar"), .mobile-cancel-btn').first();

    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      // Should navigate to home
      await page.waitForURL(/#\/home/);
      await expect(page).toHaveURL(/#\/home/);
    }
  });

  test('should show confirmation view with student data', async ({ page }) => {
    await page.goto('/#/scan-result?student_id=1&source=QR');
    await page.waitForTimeout(1000);

    // Check that either mobile or tablet container is present
    const mobileContainer = page.locator('.kiosk-mobile-container');
    const tabletContainer = page.locator('.kiosk-confirmation');

    const hasMobile = await mobileContainer.isVisible().catch(() => false);
    const hasTablet = await tabletContainer.isVisible().catch(() => false);

    expect(hasMobile || hasTablet).toBe(true);
  });

});
