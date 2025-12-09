import { test, expect } from '../fixtures/auth.fixture';

test.describe('Super Admin Authentication - TC-SA01 to TC-SA02', () => {
  test('TC-SA01: Login with credentials should work', async ({ superAdminPage }) => {
    // superAdminPage fixture already logged in
    await expect(superAdminPage.getByText('Panel de Control')).toBeVisible();
  });

  test('TC-SA03: Dashboard shows platform metrics', async ({ superAdminPage }) => {
    // Check for metric cards
    await expect(superAdminPage.getByText('TOTAL TENANTS')).toBeVisible();
    await expect(superAdminPage.getByText('TENANTS ACTIVOS')).toBeVisible();
    await expect(superAdminPage.getByText('TOTAL ALUMNOS')).toBeVisible();
    await expect(superAdminPage.getByText('EVENTOS HOY')).toBeVisible();
  });

  test('TC-SA04: Should show recent tenants', async ({ superAdminPage }) => {
    await expect(superAdminPage.getByText('Tenants Recientes')).toBeVisible();
    await expect(superAdminPage.getByText('Colegio Demo GoCode')).toBeVisible();
  });
});

test.describe('Super Admin Tenant Management - TC-SA05 to TC-SA11', () => {
  test('TC-SA05: Navigate to tenants list', async ({ superAdminPage }) => {
    await superAdminPage.getByRole('menuitem', { name: 'Tenants' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    await expect(superAdminPage.getByText('Gestión de Tenants')).toBeVisible();
  });

  test('TC-SA05: Tenants list shows columns', async ({ superAdminPage }) => {
    await superAdminPage.getByRole('menuitem', { name: 'Tenants' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    await expect(superAdminPage.getByText('NOMBRE')).toBeVisible();
    await expect(superAdminPage.getByText('DOMINIO')).toBeVisible();
    await expect(superAdminPage.getByText('PLAN')).toBeVisible();
    await expect(superAdminPage.getByText('ALUMNOS')).toBeVisible();
    await expect(superAdminPage.getByText('ESTADO')).toBeVisible();
  });

  test('TC-SA06: Search tenant by name', async ({ superAdminPage }) => {
    await superAdminPage.getByRole('menuitem', { name: 'Tenants' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    const searchInput = superAdminPage.getByPlaceholder(/Buscar/i);
    await searchInput.fill('Demo');

    // Results should still show Demo tenant
    await expect(superAdminPage.getByText('Colegio Demo GoCode')).toBeVisible();
  });

  test('TC-SA07: Filter by status', async ({ superAdminPage }) => {
    await superAdminPage.getByRole('menuitem', { name: 'Tenants' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    // Click Activos filter
    await superAdminPage.getByRole('button', { name: 'Activos' }).click();

    // Should still see demo tenant (it's active)
    await expect(superAdminPage.getByText('Colegio Demo GoCode')).toBeVisible();
  });

  test('TC-SA08: View tenant details', async ({ superAdminPage }) => {
    await superAdminPage.getByRole('menuitem', { name: 'Tenants' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    // Click on tenant name
    await superAdminPage.getByRole('link', { name: 'Colegio Demo GoCode' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    // Should see tenant detail page
    await expect(superAdminPage.getByText(/Detalle|Configuración/i)).toBeVisible();
  });

  test('TC-SA09: New Tenant button visible', async ({ superAdminPage }) => {
    await superAdminPage.getByRole('menuitem', { name: 'Tenants' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    await expect(superAdminPage.getByRole('button', { name: /Nuevo Tenant/i })).toBeVisible();
  });

  test('TC-SA10: Deactivate button visible', async ({ superAdminPage }) => {
    await superAdminPage.getByRole('menuitem', { name: 'Tenants' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    await expect(superAdminPage.getByRole('button', { name: /Desactivar/i })).toBeVisible();
  });
});

test.describe('Super Admin Data Integrity', () => {
  test('Should show correct student count (60)', async ({ superAdminPage }) => {
    // Dashboard shows total alumnos = 60
    await expect(superAdminPage.getByText('60')).toBeVisible();
  });

  test('Should show 1 tenant', async ({ superAdminPage }) => {
    // Dashboard shows 1 tenant
    const tenantCountCard = superAdminPage.getByText('TOTAL TENANTS').locator('..');
    await expect(tenantCountCard.getByText('1')).toBeVisible();
  });
});

test.describe('Super Admin Console Errors', () => {
  test('Should not have JavaScript errors', async ({ superAdminPage }) => {
    const errors: string[] = [];

    superAdminPage.on('console', msg => {
      if (msg.type() === 'error') {
        // Ignore some expected errors
        const text = msg.text();
        if (!text.includes('401') && !text.includes('favicon')) {
          errors.push(text);
        }
      }
    });

    // Navigate through super admin pages
    await superAdminPage.getByRole('menuitem', { name: 'Tenants' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    await superAdminPage.getByRole('menuitem', { name: 'Panel' }).click();
    await superAdminPage.waitForLoadState('networkidle');

    await superAdminPage.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });
});
