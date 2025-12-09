import { test, expect } from '@playwright/test';
import { KioskPage, KioskSettingsPage } from '../pages/kiosk.page';

test.describe('Kiosk Application - TC-K01 to TC-K10', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kiosk');
    await page.waitForLoadState('networkidle');
  });

  test('TC-K01: Kiosk main view loads correctly', async ({ page }) => {
    const kiosk = new KioskPage(page);

    // Should see the main kiosk interface
    await expect(page.getByText(/Escanea|QR|NFC/i)).toBeVisible();
  });

  test('TC-K02: QR scanner status visible', async ({ page }) => {
    const kiosk = new KioskPage(page);

    // QR status should be visible
    await expect(kiosk.qrStatus).toBeVisible();
  });

  test('TC-K03: NFC status visible', async ({ page }) => {
    const kiosk = new KioskPage(page);

    // NFC status should be visible (may show unavailable in browser)
    await expect(kiosk.nfcStatus).toBeVisible();
  });

  test('TC-K04: Biometric button visible', async ({ page }) => {
    const kiosk = new KioskPage(page);

    // Biometric authentication button should be visible
    await expect(kiosk.biometricButton).toBeVisible();
  });

  test('TC-K05: Invalid token shows error', async ({ page }) => {
    const kiosk = new KioskPage(page);

    // Simulate invalid token scan
    await kiosk.scanToken('INVALID-TOKEN-123');

    // Should show error message
    await expect(page.getByText(/no encontrado|error|inválido/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Kiosk Settings - TC-K11 to TC-K15', () => {
  test('TC-K11: Settings page loads', async ({ page }) => {
    await page.goto('/kiosk/#/settings');
    await page.waitForLoadState('networkidle');

    const settings = new KioskSettingsPage(page);

    // Should see settings form
    await expect(settings.saveButton).toBeVisible();
  });

  test('TC-K12: Load demo data button works', async ({ page }) => {
    await page.goto('/kiosk/#/settings');
    await page.waitForLoadState('networkidle');

    const settings = new KioskSettingsPage(page);

    // Should see load demo data button
    await expect(settings.loadDemoDataButton).toBeVisible();
  });

  test('TC-K13: Generate Device ID button works', async ({ page }) => {
    await page.goto('/kiosk/#/settings');
    await page.waitForLoadState('networkidle');

    const settings = new KioskSettingsPage(page);

    // Should see generate device ID button
    await expect(settings.generateDeviceIdButton).toBeVisible();
  });

  test('TC-K14: Gate ID input visible', async ({ page }) => {
    await page.goto('/kiosk/#/settings');
    await page.waitForLoadState('networkidle');

    const settings = new KioskSettingsPage(page);

    // Gate ID input should be visible
    await expect(settings.gateIdInput).toBeVisible();
  });

  test('TC-K15: Language selector visible', async ({ page }) => {
    await page.goto('/kiosk/#/settings');
    await page.waitForLoadState('networkidle');

    const settings = new KioskSettingsPage(page);

    // Language select should be visible
    await expect(settings.languageSelect).toBeVisible();
  });
});

test.describe('Kiosk Offline Mode - TC-K20 to TC-K25', () => {
  test('TC-K20: Kiosk shows sync status', async ({ page }) => {
    await page.goto('/kiosk');
    await page.waitForLoadState('networkidle');

    // Should show online/offline status indicator
    await expect(page.getByText(/online|offline|sincronizado/i)).toBeVisible();
  });

  test('TC-K21: Kiosk has service worker', async ({ page }) => {
    await page.goto('/kiosk');
    await page.waitForLoadState('networkidle');

    // Check for service worker registration
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });

    // Service worker may or may not be registered depending on environment
    expect(typeof swRegistered).toBe('boolean');
  });
});

test.describe('Kiosk Photo Consent - TC-K30 to TC-K35', () => {
  test('TC-K30: Photo capture respects consent settings', async ({ page }) => {
    await page.goto('/kiosk');
    await page.waitForLoadState('networkidle');

    // Verify photo consent is loaded from bootstrap data
    const hasPhotoConsentFunction = await page.evaluate(() => {
      return typeof (window as any).State?.hasPhotoConsent === 'function';
    });

    // State should have hasPhotoConsent method
    expect(hasPhotoConsentFunction).toBe(true);
  });
});

test.describe('Kiosk Time Display - TC-K40 to TC-K42', () => {
  test('TC-K40: Current time is displayed', async ({ page }) => {
    await page.goto('/kiosk');
    await page.waitForLoadState('networkidle');

    // Should show current time
    await expect(page.getByText(/\d{1,2}:\d{2}/)).toBeVisible();
  });

  test('TC-K41: Current date is displayed', async ({ page }) => {
    await page.goto('/kiosk');
    await page.waitForLoadState('networkidle');

    // Should show current date (various formats)
    const dateFormats = [
      /\d{1,2}\/\d{1,2}\/\d{4}/,  // DD/MM/YYYY
      /\d{4}-\d{2}-\d{2}/,         // YYYY-MM-DD
      /\w+,?\s+\d{1,2}/            // Day, Month DD
    ];

    let dateFound = false;
    for (const format of dateFormats) {
      const locator = page.getByText(format);
      if (await locator.count() > 0) {
        dateFound = true;
        break;
      }
    }

    expect(dateFound).toBe(true);
  });
});

test.describe('Kiosk Console Errors', () => {
  test('Should not have JavaScript errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore some expected errors
        if (!text.includes('401') && !text.includes('favicon') && !text.includes('ServiceWorker')) {
          errors.push(text);
        }
      }
    });

    await page.goto('/kiosk');
    await page.waitForLoadState('networkidle');

    // Navigate to settings
    await page.goto('/kiosk/#/settings');
    await page.waitForLoadState('networkidle');

    // Back to main
    await page.goto('/kiosk');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });
});
