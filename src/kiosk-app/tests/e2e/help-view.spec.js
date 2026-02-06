/**
 * Help View E2E Tests
 */
import { test, expect } from '@playwright/test';

/**
 * Help View E2E Tests
 *
 * Tests for the /help view which displays usage information.
 * Verifies:
 * 1. Teacher tokens are documented
 * 2. Admin panel access is explained
 * 3. Student tokens are documented
 * 4. Basic help content is present
 */

test.describe('Help View', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to help view
    await page.goto('/#/help');
    await page.waitForSelector('.card-header');
  });

  test('should display help page title', async ({ page }) => {
    const header = await page.textContent('.card-header');
    expect(header).toBe('Ayuda Rápida');
  });

  test('should document teacher tokens', async ({ page }) => {
    const content = await page.textContent('#app');

    // Should mention teacher tokens
    expect(content).toContain('Profesor');
    expect(content).toMatch(/nfc_teacher_001|qr_teacher/i);
  });

  test('should explain admin panel access', async ({ page }) => {
    const content = await page.textContent('#app');

    // Should mention admin panel
    expect(content).toMatch(/[Pp]anel.*[Aa]dministraci[oó]n|[Aa]dmin.*[Pp]anel/);
  });

  test('should document student tokens', async ({ page }) => {
    const content = await page.textContent('#app');

    // Should mention student tokens (these were already documented)
    expect(content).toContain('nfc_001');
    expect(content).toContain('qr_011');
  });

  test('should document revoked tokens', async ({ page }) => {
    const content = await page.textContent('#app');

    // Should mention revoked tokens
    expect(content).toContain('Revocados');
    expect(content).toContain('nfc_006');
  });

  test('should have back button to navigate home', async ({ page }) => {
    // Find and click back button
    await page.click('button:has-text("Volver")');

    // Should navigate to home
    await page.waitForURL(/#\/home/);
    await expect(page).toHaveURL(/#\/home/);
  });

});
