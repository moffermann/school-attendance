/**
 * Home View UX Improvements E2E Tests
 */
import { test, expect } from '@playwright/test';

// Setup mock student data before each test
async function setupMockData(page) {
  await page.evaluate(() => {
    const config = {
      schoolName: 'Colegio San Patricio',
      photoEnabled: false,
      deviceId: 'test-device'
    };

    const students = [
      {
        id: 1,
        full_name: 'Martín González Pérez',
        course_id: 1,
        course_name: '1° Básico',
        nfc_token: 'nfc_001',
        qr_token: 'qr_001'
      }
    ];

    const tags = [
      { token: 'nfc_001', student_id: 1, active: true },
      { token: 'qr_001', student_id: 1, active: true }
    ];

    const courses = [
      { id: 1, name: '1° Básico', grade: '1', section: 'A' }
    ];

    const kioskData = {
      config: config,
      students: students,
      tags: tags,
      courses: courses,
      queue: [],
      lastSync: Date.now()
    };

    localStorage.setItem('kioskData', JSON.stringify(kioskData));
  });
}

test.describe('Home View UX Improvements', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await setupMockData(page);
  });

  test('should process valid token and show welcome', async ({ page }) => {
    await page.goto('/#/scan');
    await page.waitForSelector('#token-input');

    await page.fill('#token-input', 'nfc_001');
    await page.click('button:has-text("Simular Lectura")');

    await page.waitForURL(/#\/scan-result/, { timeout: 3000 });

    // Wait for either mobile or tablet container
    await page.waitForTimeout(1000);

    // Check that student name is displayed
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Martín González Pérez');
  });

});
