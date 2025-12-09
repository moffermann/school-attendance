import { test as base, expect, Page } from '@playwright/test';

/**
 * Authentication fixtures for different user roles.
 */

// Demo credentials
const CREDENTIALS = {
  director: {
    email: 'director@colegio-demo.cl',
    password: 'Demo123!',
  },
  inspector: {
    email: 'inspector@colegio-demo.cl',
    password: 'Demo123!',
  },
  superAdmin: {
    email: 'admin@gocode.cl',
    password: 'Demo123!',
  },
  parent: {
    email: 'apoderado1@colegio-demo.cl',
    password: 'Demo123!',
  },
};

// Extended test with authentication fixtures
export const test = base.extend<{
  directorPage: Page;
  inspectorPage: Page;
  superAdminPage: Page;
  parentPage: Page;
  teacherDemoPage: Page;
}>({
  // Director authenticated page
  directorPage: async ({ page }, use) => {
    await loginAsDirectorDemo(page);
    await use(page);
  },

  // Inspector authenticated page
  inspectorPage: async ({ page }, use) => {
    await loginAsInspectorDemo(page);
    await use(page);
  },

  // Super Admin authenticated page
  superAdminPage: async ({ page }, use) => {
    await loginAsSuperAdmin(page);
    await use(page);
  },

  // Parent authenticated page
  parentPage: async ({ page }, use) => {
    await loginAsParentDemo(page);
    await use(page);
  },

  // Teacher demo page
  teacherDemoPage: async ({ page }, use) => {
    await loginAsTeacherDemo(page);
    await use(page);
  },
});

/**
 * Login as Director using demo button
 */
async function loginAsDirectorDemo(page: Page) {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Director' }).click();
  await expect(page.getByText('Modo demo activado')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Cerrar' }).click();
}

/**
 * Login as Inspector using demo button
 */
async function loginAsInspectorDemo(page: Page) {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Inspector' }).click();
  await expect(page.getByText('Modo demo activado')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Cerrar' }).click();
}

/**
 * Login as Super Admin with credentials
 */
async function loginAsSuperAdmin(page: Page) {
  await page.goto('/app/#/super-admin/auth');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(CREDENTIALS.superAdmin.email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(CREDENTIALS.superAdmin.password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await expect(page.getByText('Inicio de sesión exitoso')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Cerrar' }).click();
}

/**
 * Login as Parent using demo selector
 */
async function loginAsParentDemo(page: Page) {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Apoderado' }).click();

  // Select first parent in demo modal
  await page.getByRole('combobox').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByText('Modo demo activado')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Cerrar' }).click();
}

/**
 * Login as Teacher using demo button
 */
async function loginAsTeacherDemo(page: Page) {
  await page.goto('/teacher');

  // Click first teacher demo button
  await page.getByRole('button', { name: /María González/ }).click();

  await expect(page.getByText('Bienvenido')).toBeVisible({ timeout: 10000 });
}

export { expect };
