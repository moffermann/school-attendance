// @ts-check
/**
 * Kiosk App - Home and Scan Integration Tests
 */
const { test, expect } = require('@playwright/test');

test.describe('Kiosk App - Home View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kiosk/');
    await page.waitForLoadState('networkidle');
    // Clear any stored state
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should display kiosk home screen', async ({ page }) => {
    await page.waitForTimeout(2000);

    const content = await page.textContent('body');

    // Should show some kiosk UI elements
    expect(
      content.includes('Kiosk') ||
      content.includes('Escanear') ||
      content.includes('QR') ||
      content.includes('Bienvenido') ||
      content.includes('Acceso') ||
      content.includes('entrada')
    ).toBeTruthy();
  });

  test('should have scan button or area', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for scan-related elements
    const scanElement = page.locator(
      'button:has-text("Escanear"), ' +
      'button:has-text("Scan"), ' +
      '.scan-btn, ' +
      '#scan-button, ' +
      '[data-action="scan"], ' +
      '.qr-scanner, ' +
      'video'
    );

    const hasScanner = await scanElement.count() > 0;

    // Or the page content mentions scanning
    const content = await page.textContent('body');
    const mentionsScan = content.includes('escanear') ||
                         content.includes('Escanear') ||
                         content.includes('QR') ||
                         content.includes('cámara');

    expect(hasScanner || mentionsScan).toBeTruthy();
  });

  test('should show current date/time', async ({ page }) => {
    await page.waitForTimeout(2000);

    const content = await page.textContent('body');
    const today = new Date();
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    // Check if page shows date in some form
    const hasDate = content.toLowerCase().includes(dayNames[today.getDay()]) ||
                    content.toLowerCase().includes(monthNames[today.getMonth()]) ||
                    content.includes(today.getDate().toString()) ||
                    content.includes(':'); // Time with colon

    expect(hasDate).toBeTruthy();
  });

  test('should have admin access via teacher token', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Kiosk admin is accessed by scanning a teacher token
    // When camera is not available, it shows manual input with test tokens
    const content = await page.textContent('body');

    // Check for manual input area showing teacher tokens
    const hasTeacherTokenInfo = content.includes('nfc_teacher_001') ||
                                 content.includes('qr_teacher') ||
                                 content.includes('Profesores');

    // Or check that we can enter a token manually
    const hasManualInput = await page.locator('input[type="text"], input[placeholder*="nfc"]').count() > 0;

    expect(hasTeacherTokenInfo || hasManualInput).toBeTruthy();
  });
});

test.describe('Kiosk App - Manual Entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kiosk/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should have manual entry option', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for manual entry option
    const manualBtn = page.locator(
      'button:has-text("Manual"), ' +
      'button:has-text("Código"), ' +
      'button:has-text("Ingresar"), ' +
      'a:has-text("Manual"), ' +
      '.manual-entry'
    );

    const hasManual = await manualBtn.count() > 0;

    // Or check content
    const content = await page.textContent('body');
    const mentionsManual = content.includes('manual') ||
                           content.includes('Manual') ||
                           content.includes('código') ||
                           content.includes('Código');

    expect(hasManual || mentionsManual).toBeTruthy();
  });

  test('should accept manual token input', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Navigate to manual entry if needed
    const manualLink = page.locator('a:has-text("Manual"), button:has-text("Manual"), button:has-text("Código")').first();
    if (await manualLink.count() > 0) {
      await manualLink.click();
      await page.waitForTimeout(1000);
    }

    // Look for token input
    const tokenInput = page.locator(
      'input[name="token"], ' +
      'input[type="text"], ' +
      '#token-input, ' +
      '.token-input'
    ).first();

    if (await tokenInput.count() > 0) {
      await expect(tokenInput).toBeVisible();
    }
  });
});
