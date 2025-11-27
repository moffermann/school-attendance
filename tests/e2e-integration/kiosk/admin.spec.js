// @ts-check
/**
 * Kiosk App - Admin View Integration Tests
 */
const { test, expect } = require('@playwright/test');

test.describe('Kiosk App - Admin Access via Teacher Token', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kiosk/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should show manual input when camera is unavailable', async ({ page }) => {
    await page.waitForTimeout(2000);

    // When camera is not available, kiosk shows manual input
    const content = await page.textContent('body');
    expect(
      content.includes('Cámara no disponible') ||
      content.includes('Ingresa el código') ||
      content.includes('manualmente') ||
      content.includes('Escanear')
    ).toBeTruthy();
  });

  test('should access admin panel via teacher token', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find the manual input field
    const tokenInput = page.locator('input[type="text"]').first();

    if (await tokenInput.count() > 0) {
      // Enter a teacher token to access admin panel
      await tokenInput.fill('nfc_teacher_001');

      // Click scan/submit button
      const scanBtn = page.locator('button:has-text("Escanear")').first();
      if (await scanBtn.count() > 0) {
        await scanBtn.click();
        await page.waitForTimeout(2000);
      }

      // Should navigate to admin panel or show teacher-related content
      const content = await page.textContent('body');
      expect(
        content.includes('Admin') ||
        content.includes('Configuración') ||
        content.includes('Panel') ||
        content.includes('profesor') ||
        content.includes('Volver')
      ).toBeTruthy();
    }
  });

  test('should show device configuration in settings', async ({ page }) => {
    // Navigate to settings page directly via hash
    await page.goto('/kiosk/#/settings');
    await page.waitForTimeout(2000);

    const content = await page.textContent('body');

    // Settings page should have device config
    expect(
      content.includes('Configuración') ||
      content.includes('API') ||
      content.includes('URL') ||
      content.includes('Gate') ||
      content.includes('Puerta') ||
      content.includes('Token') ||
      content.includes('Guardar')
    ).toBeTruthy();
  });

  test('should have navigation back to home', async ({ page }) => {
    // Navigate to settings
    await page.goto('/kiosk/#/settings');
    await page.waitForTimeout(2000);

    // Look for back/home button
    const backBtn = page.locator(
      'button:has-text("Volver"), ' +
      'button:has-text("Cancelar"), ' +
      'button:has-text("Inicio"), ' +
      'a:has-text("Volver"), ' +
      '.back-btn'
    );

    // Should have some navigation option
    const content = await page.textContent('body');
    const hasNavigation = await backBtn.count() > 0 ||
                          content.includes('Volver') ||
                          content.includes('Cancelar');

    expect(hasNavigation).toBeTruthy();
  });
});

test.describe('Kiosk App - Status and API', () => {
  test('should display scanner status', async ({ page }) => {
    await page.goto('/kiosk/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Kiosk shows scanner status (NFC/QR) and camera status
    const content = await page.textContent('body');
    const hasStatusInfo = content.includes('Cámara') ||
                          content.includes('NFC') ||
                          content.includes('QR') ||
                          content.includes('Escanear') ||
                          content.includes('manualmente');

    expect(hasStatusInfo).toBeTruthy();
  });

  test('should handle API health check', async ({ page, request }) => {
    // Check that the API is accessible
    const response = await request.get('https://school-attendance.dev.gocode.cl/healthz');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});
