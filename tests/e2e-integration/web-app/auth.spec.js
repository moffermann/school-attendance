// @ts-check
/**
 * Web App - Authentication Integration Tests
 * Tests real login/logout against the deployed backend
 */
const { test, expect } = require('@playwright/test');
const { TEST_USERS, login, logout } = require('../fixtures');

test.describe('Web App Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
  });

  test('should display login page', async ({ page }) => {
    // Web app uses server-rendered login form at /login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Should have email and password fields
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Should have submit button
    await expect(page.locator('button[type="submit"], button:has-text("Entrar")')).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('#email', 'invalid@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"], button:has-text("Entrar")');

    // Should stay on login page and show error
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/login');
  });

  test('should login as director successfully', async ({ page }) => {
    const user = await login(page, 'director');

    // Should show director dashboard content (user name and dashboard)
    const content = await page.textContent('body');
    expect(
      content.includes(user.name) ||
      content.includes('Hola') ||
      content.includes('Tablero') ||
      content.includes('Resumen de hoy')
    ).toBeTruthy();

    // Navigation should show logged-in state (has logout link)
    const hasSalir = await page.locator('a:has-text("Salir")').count() > 0;
    const hasTablero = await page.locator('a:has-text("Tablero")').count() > 0;
    expect(hasSalir || hasTablero).toBeTruthy();
  });

  test('should login as inspector successfully', async ({ page }) => {
    const user = await login(page, 'inspector');

    // Inspector gets director-like dashboard
    const content = await page.textContent('body');
    expect(
      content.includes(user.name) ||
      content.includes('Hola') ||
      content.includes('Tablero') ||
      content.includes('Resumen')
    ).toBeTruthy();
  });

  test('should login as parent successfully', async ({ page }) => {
    // Clear any existing session first
    await page.context().clearCookies();

    // Parent users should access the app via /app route (not / which is director-only)
    // First login
    await page.goto('/login?next=/app');
    await page.waitForLoadState('networkidle');

    const user = TEST_USERS.parent;
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.click('button:has-text("Entrar")');

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Parent should land on /app (the SPA) after login
    const url = page.url();
    const content = await page.textContent('body');

    // Should be in the SPA (shows role selection or parent content)
    expect(
      url.includes('/app') ||
      content.includes('Apoderado') ||
      content.includes('Dirección') ||
      content.includes('Selecciona')
    ).toBeTruthy();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await login(page, 'director');

    // Verify we're logged in (see dashboard content)
    let content = await page.textContent('body');
    expect(content.includes('Hola') || content.includes('Resumen')).toBeTruthy();

    // Then logout
    await logout(page);

    // Should be back at login (show login form)
    await page.waitForTimeout(1000);
    await expect(page.locator('input[type="email"], input[name="email"], #email')).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear cookies and try to access protected page directly
    await page.context().clearCookies();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should redirect to /login or show the login form
    const url = page.url();
    const hasLoginForm = await page.locator('#email').count() > 0;
    expect(url.includes('/login') || hasLoginForm).toBeTruthy();
  });

  test('should persist session across page reloads', async ({ page }) => {
    await login(page, 'director');

    // Verify we're logged in
    let content = await page.textContent('body');
    expect(content.includes('Hola') || content.includes('Resumen')).toBeTruthy();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should still be logged in (see dashboard content, not login form)
    content = await page.textContent('body');
    expect(content.includes('Hola') || content.includes('Resumen')).toBeTruthy();
  });
});
