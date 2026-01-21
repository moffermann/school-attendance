// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Scan View E2E Tests
 *
 * Tests for the /scan view which allows manual token input simulation.
 * Verifies:
 * 1. Teacher tokens are detected and redirect to admin panel
 * 2. Student tokens are detected and redirect to scan-result
 * 3. Generate Valid button only generates student tokens (not teacher tokens)
 * 4. Revoked tokens show error message
 */

test.describe('Scan View', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to scan view
    await page.goto('/#/scan');
    await page.waitForSelector('#token-input');
  });

  test('should detect teacher token and navigate to admin panel', async ({ page }) => {
    // Enter a teacher token
    await page.fill('#token-input', 'nfc_teacher_001');

    // Click the scan button
    await page.click('button:has-text("Simular Lectura")');

    // Wait for navigation (there's a setTimeout in the code)
    await page.waitForTimeout(1000);

    // Should navigate to admin panel
    await expect(page).toHaveURL(/#\/admin-panel/);

    // Should see admin panel content
    const content = await page.textContent('#app');
    expect(content).toContain('Panel de Administración');
  });

  test('should detect student token and navigate to scan-result', async ({ page }) => {
    // Enter a student token
    await page.fill('#token-input', 'nfc_001');

    // Click the scan button
    await page.click('button:has-text("Simular Lectura")');

    // Wait for navigation
    await page.waitForTimeout(1000);

    // Should navigate to scan-result with student_id
    await expect(page).toHaveURL(/#\/scan-result\?student_id=1/);
  });

  test('should show error for revoked token', async ({ page }) => {
    // Enter a revoked token
    await page.fill('#token-input', 'nfc_006');

    // Click the scan button
    await page.click('button:has-text("Simular Lectura")');

    // Wait for the toast to appear
    await page.waitForTimeout(1000);

    // Should show error toast
    const toast = await page.locator('.toast-error');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('revocada');

    // Should NOT navigate away
    await expect(page).toHaveURL(/#\/scan/);
  });

  test('should show error for invalid token', async ({ page }) => {
    // Enter an invalid token
    await page.fill('#token-input', 'invalid_xyz_123');

    // Click the scan button
    await page.click('button:has-text("Simular Lectura")');

    // Wait for the toast
    await page.waitForTimeout(1000);

    // Should show error toast
    const toast = await page.locator('.toast-error');
    await expect(toast).toBeVisible();

    // Should NOT navigate away
    await expect(page).toHaveURL(/#\/scan/);
  });

  test('generateValid should only generate student tokens, never teacher tokens', async ({ page }) => {
    // Click generate button multiple times and collect tokens
    const generatedTokens = [];

    for (let i = 0; i < 20; i++) {
      await page.click('button:has-text("Generar Token Válido")');
      const token = await page.inputValue('#token-input');
      generatedTokens.push(token);
    }

    // None of the generated tokens should be teacher tokens
    const teacherTokens = generatedTokens.filter(t => t.includes('teacher'));

    expect(teacherTokens).toEqual([]);
    expect(generatedTokens.length).toBe(20);

    // All tokens should be student tokens (nfc_XXX or qr_XXX without 'teacher')
    const allStudentTokens = generatedTokens.every(t =>
      (t.startsWith('nfc_') || t.startsWith('qr_')) && !t.includes('teacher')
    );
    expect(allStudentTokens).toBe(true);
  });

  test('all generated tokens should be valid and active', async ({ page }) => {
    // Generate a token and verify it works
    await page.click('button:has-text("Generar Token Válido")');
    const token = await page.inputValue('#token-input');

    // The token should not be empty
    expect(token.length).toBeGreaterThan(0);

    // Click scan - should NOT show error (token should be valid)
    await page.click('button:has-text("Simular Lectura")');
    await page.waitForTimeout(1000);

    // Should navigate to scan-result (not show error)
    const url = page.url();
    expect(url).toMatch(/#\/scan-result/);
  });

});
