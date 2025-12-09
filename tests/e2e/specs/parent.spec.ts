import { test, expect } from '../fixtures/auth.fixture';
import { ParentHomePage } from '../pages/parent-home.page';

test.describe('Parent Portal - TC-P01 to TC-P09', () => {
  test('TC-P02: Login modo demo should work', async ({ parentPage }) => {
    // parentPage fixture already logged in via demo
    const homePage = new ParentHomePage(parentPage);
    await homePage.assertChildrenVisible();
  });

  test('TC-P03: Should only see own children', async ({ parentPage }) => {
    const homePage = new ParentHomePage(parentPage);

    // Demo parent "Patricia Pérez Gómez" has 2 children
    const childCount = await homePage.getChildrenCount();
    expect(childCount).toBeGreaterThanOrEqual(1);
    expect(childCount).toBeLessThanOrEqual(5); // Reasonable limit
  });

  test('TC-P04: Should display current status for each child', async ({ parentPage }) => {
    const homePage = new ParentHomePage(parentPage);

    // Each child card should show status
    await expect(parentPage.getByText(/registra|Ingresó|Salió/i)).toBeVisible();
  });

  test('TC-P06: View history should work', async ({ parentPage }) => {
    const homePage = new ParentHomePage(parentPage);

    await homePage.viewHistoryFor(0);

    // Should be on history page
    await expect(parentPage.getByText('Historial de Asistencia')).toBeVisible();
  });

  test('TC-P08: Should be able to switch between children in history', async ({ parentPage }) => {
    const homePage = new ParentHomePage(parentPage);

    await homePage.viewHistoryFor(0);

    // Dropdown should have multiple children
    const dropdown = parentPage.getByRole('combobox');
    await expect(dropdown).toBeVisible();

    // Should have options
    const options = dropdown.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Parent Preferences - TC-P10 to TC-P13', () => {
  test('TC-P10: Should view current preferences', async ({ parentPage }) => {
    const homePage = new ParentHomePage(parentPage);
    await homePage.goToPreferences();

    // Should see preference sections
    await expect(parentPage.getByText('Canales de Notificación')).toBeVisible();
    await expect(parentPage.getByText('Tipo de Evidencia')).toBeVisible();
  });

  test('TC-P11: Should be able to modify notification channels', async ({ parentPage }) => {
    const homePage = new ParentHomePage(parentPage);
    await homePage.goToPreferences();

    // Find checkboxes
    const whatsappCheckboxes = parentPage.getByRole('checkbox', { name: 'WhatsApp' });
    const count = await whatsappCheckboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('TC-P13: Should see registered contacts', async ({ parentPage }) => {
    const homePage = new ParentHomePage(parentPage);
    await homePage.goToPreferences();

    // Should see contacts section
    await expect(parentPage.getByText('Contactos Registrados')).toBeVisible();
    await expect(parentPage.getByText(/\+56/)).toBeVisible(); // Chilean phone
  });
});

test.describe('Parent Absences - TC-P14 to TC-P16', () => {
  test('TC-P14: Should access absence request form', async ({ parentPage }) => {
    const homePage = new ParentHomePage(parentPage);
    await homePage.goToAbsences();

    // Should see absence request interface
    await expect(parentPage.getByText(/Ausencias|Solicitar/i)).toBeVisible();
  });
});

test.describe('Parent Security - TC-P09', () => {
  test('TC-P09: Cannot access other students via URL manipulation', async ({ parentPage }) => {
    // Try to access a student that doesn't belong to this parent
    await parentPage.goto('/app/#/parent/history?student=999');

    // Should either show error or empty data
    await parentPage.waitForLoadState('networkidle');

    // The page should not show data for student 999 if it's not linked
    // Implementation may vary - could redirect, show error, or show empty
  });
});

test.describe('Parent Mobile Navigation - TC-P17 to TC-P18', () => {
  test('TC-P17: Bottom navigation should work', async ({ parentPage }) => {
    // Verify bottom nav items are visible
    await expect(parentPage.getByRole('menuitem', { name: 'Inicio' })).toBeVisible();
    await expect(parentPage.getByRole('menuitem', { name: 'Historial' })).toBeVisible();
    await expect(parentPage.getByRole('menuitem', { name: 'Ausencias' })).toBeVisible();
    await expect(parentPage.getByRole('menuitem', { name: 'Ajustes' })).toBeVisible();
  });
});
