// @ts-check
/**
 * Teacher PWA - Authentication Integration Tests
 */
const { test, expect } = require('@playwright/test');
const { TEST_USERS } = require('../fixtures');

test.describe('Teacher PWA Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    // Clear localStorage and IndexedDB
    await page.goto('/teacher/');
    await page.evaluate(() => {
      localStorage.clear();
      try { indexedDB.deleteDatabase('TeacherPWA'); } catch(e) {}
    });
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/teacher/');
    await page.waitForLoadState('networkidle');

    // Should show login form or redirect to auth
    await expect(page.locator('input[type="email"], input[name="email"], #email')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"], input[name="password"], #password')).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/teacher/');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"], input[name="email"], #email', 'invalid@example.com');
    await page.fill('input[type="password"], input[name="password"], #password', 'wrongpassword');

    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Iniciar Sesión")');
    await submitBtn.click();

    // Should show error message "Credenciales inválidas" or stay on login
    await page.waitForTimeout(3000);
    const content = await page.textContent('body');
    const hasError = content.includes('Credenciales inválidas') ||
                     content.includes('error') ||
                     content.includes('Error');
    expect(hasError).toBeTruthy();
  });

  test('should login as teacher successfully', async ({ page }) => {
    const user = TEST_USERS.teacher;

    await page.goto('/teacher/');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"], input[name="email"], #email', user.email);
    await page.fill('input[type="password"], input[name="password"], #password', user.password);

    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Ingresar")');
    await submitBtn.click();

    // Wait for redirect to classes or main view
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Should no longer be on login/auth page
    const url = page.url();
    expect(url.includes('auth') || url.includes('login')).toBeFalsy();
  });

  test('should reject non-teacher users', async ({ page }) => {
    // Parent should not be able to login to teacher PWA
    const user = TEST_USERS.parent;

    await page.goto('/teacher/');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"], input[name="email"], #email', user.email);
    await page.fill('input[type="password"], input[name="password"], #password', user.password);

    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Iniciar Sesión")');
    await submitBtn.click();

    await page.waitForTimeout(3000);

    // Should show error or stay on login (parent can't access teacher PWA)
    // Either shows error message or stays on login page
    const content = await page.textContent('body');
    const hasLoginForm = content.includes('Email') || content.includes('Contraseña') || content.includes('Iniciar Sesión');
    const hasError = content.includes('error') ||
                     content.includes('Error') ||
                     content.includes('inválidas') ||
                     content.includes('no autorizado') ||
                     content.includes('permiso');
    expect(hasLoginForm || hasError).toBeTruthy();
  });
});
