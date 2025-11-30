/**
 * NFC Enrollment - E2E Tests
 * Tests the complete enrollment workflow for students and teachers
 */
const { test, expect } = require('@playwright/test');

async function setupDirectorSession(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.setItem('currentRole', 'director');
    localStorage.setItem('sessionToken', 'test_token_' + Date.now());
  });
}

test.describe('Student NFC Enrollment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show Enrolar NFC button in student profile modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Click on view profile button for first student
    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();

    // Wait for modal to appear
    await page.waitForSelector('.modal-container.active');

    // Check for Enrolar NFC button
    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await expect(nfcButton).toBeVisible();
  });

  test('should open enrollment modal when clicking Enrolar NFC', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Open student profile
    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    // Click Enrolar NFC
    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();

    // Wait for enrollment modal
    await page.waitForTimeout(500);
    await page.waitForSelector('.modal-container.active');

    // Verify enrollment modal content
    const modalTitle = await page.textContent('.modal-title');
    expect(modalTitle).toContain('Enrolar NFC');
  });

  test('should display student information in enrollment modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Get first student name
    const studentName = await page.locator('table tbody tr').first().locator('td strong').first().textContent();

    // Open profile and enrollment
    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    // Check modal contains student info
    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Nombre:');
    expect(modalContent).toContain(studentName);
    expect(modalContent).toContain('Token:');
    expect(modalContent).toContain('Colegio:');
  });

  test('should display school contact info for lost & found', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Navigate to enrollment modal
    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    // Check school info is present
    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Direccion:');
    expect(modalContent).toContain('porteria');
  });

  test('should show NFC warning on unsupported browsers', async ({ page }) => {
    await setupDirectorSession(page);

    // Check if NFC is not supported (most test environments)
    const nfcSupported = await page.evaluate(() => 'NDEFReader' in window);

    if (!nfcSupported) {
      await page.goto('/#/director/students');
      await page.waitForTimeout(1500);

      const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
      await viewProfileBtn.click();
      await page.waitForSelector('.modal-container.active');

      const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
      await nfcButton.click();
      await page.waitForTimeout(500);

      // Should show warning about NFC not being supported
      const warning = page.locator('.alert-warning');
      await expect(warning).toBeVisible();
      const warningText = await warning.textContent();
      expect(warningText).toContain('NFC no disponible');
    }
  });

  test('should have Write Tag button when NFC supported', async ({ page }) => {
    await setupDirectorSession(page);

    // Mock NFC support
    await page.evaluate(() => {
      window.NDEFReader = class {
        async write() { return Promise.resolve(); }
        async scan() { return Promise.resolve(); }
      };
    });

    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    // Should have Write Tag button
    const writeButton = page.locator('.modal-footer button:has-text("Escribir Tag")');
    await expect(writeButton).toBeVisible();
  });

  test('should close enrollment modal with Cancel button', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    // Click Cancel
    const cancelButton = page.locator('.modal-footer button:has-text("Cancelar")');
    await cancelButton.click();

    // Modal should close
    await page.waitForTimeout(300);
    const modalActive = await page.locator('.modal-container.active').isVisible();
    expect(modalActive).toBe(false);
  });
});

test.describe('Teacher NFC Enrollment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show view profile button in teachers list', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    // Check view profile button exists
    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await expect(viewProfileBtn).toBeVisible();
  });

  test('should show Enrolar NFC button in teacher profile modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    // Click view profile
    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();

    await page.waitForSelector('.modal-container.active');

    // Check for Enrolar NFC button
    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await expect(nfcButton).toBeVisible();
  });

  test('should display teacher information in enrollment modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    // Get first teacher name
    const teacherName = await page.locator('table tbody tr').first().locator('td strong').first().textContent();

    // Navigate to enrollment modal
    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    // Check modal contains teacher info
    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Nombre:');
    expect(modalContent).toContain(teacherName);
    expect(modalContent).toContain('Cargo:');
    expect(modalContent).toContain('Profesor');
  });

  test('should display teacher specialty and email', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Email:');
  });

  test('should include courses in teacher enrollment data', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Cursos:');
  });
});

test.describe('NFC Enrollment - Token Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
    await setupDirectorSession(page);
  });

  test('should generate unique token for each enrollment', async ({ page }) => {
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Open enrollment modal first time
    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    // Get first token
    const token1 = await page.evaluate(() => {
      return document.querySelector('.modal').textContent.match(/nfc_\d+_[a-z0-9]+/)?.[0];
    });

    // Close and reopen
    await page.locator('.modal-footer button:has-text("Cancelar")').click();
    await page.waitForTimeout(300);

    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');
    await nfcButton.click();
    await page.waitForTimeout(500);

    // Get second token
    const token2 = await page.evaluate(() => {
      return document.querySelector('.modal').textContent.match(/nfc_\d+_[a-z0-9]+/)?.[0];
    });

    // Tokens should be different
    expect(token1).not.toBe(token2);
  });

  test('student token should start with nfc_', async ({ page }) => {
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    const tokenText = await page.textContent('.modal code');
    expect(tokenText).toMatch(/^nfc_\d+_[a-z0-9]+$/);
  });

  test('teacher token should start with nfc_teacher_', async ({ page }) => {
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    const tokenText = await page.textContent('.modal code');
    expect(tokenText).toMatch(/^nfc_teacher_\d+_[a-z0-9]+$/);
  });
});

test.describe('NFC Enrollment - UI States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show status container when writing starts', async ({ page }) => {
    await setupDirectorSession(page);

    // Mock NFC with delay to test UI states
    await page.evaluate(() => {
      window.NDEFReader = class {
        async write() {
          return new Promise(resolve => setTimeout(resolve, 100));
        }
      };
    });

    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    // Click Write Tag
    const writeButton = page.locator('.modal-footer button:has-text("Escribir Tag")');
    await writeButton.click();

    // Status container should become visible
    const statusContainer = page.locator('#nfc-status-container');
    await expect(statusContainer).toBeVisible();
  });

  test('should show success state after successful write', async ({ page }) => {
    await setupDirectorSession(page);

    // Mock successful NFC write
    await page.evaluate(() => {
      window.NDEFReader = class {
        async write() {
          return Promise.resolve();
        }
      };
    });

    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');
    await nfcButton.click();
    await page.waitForTimeout(500);

    const writeButton = page.locator('.modal-footer button:has-text("Escribir Tag")');
    await writeButton.click();

    // Wait for success
    await page.waitForTimeout(1000);

    // Success container should be visible
    const successContainer = page.locator('#nfc-success-container');
    await expect(successContainer).toBeVisible();

    // Should have "Probar Tag" button
    const testButton = page.locator('.modal-footer button:has-text("Probar Tag")');
    await expect(testButton).toBeVisible();
  });
});

test.describe('NFC Enrollment - Access Control', () => {
  test('should not show enrollment on parent role', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Set parent role
    await page.evaluate(() => {
      localStorage.setItem('currentRole', 'parent');
      localStorage.setItem('sessionToken', 'test_token_' + Date.now());
      localStorage.setItem('currentGuardianId', '1');
    });

    // Parent doesn't have access to students management
    await page.goto('/#/parent/home');
    await page.waitForTimeout(1500);

    // Verify we're on parent view, not director
    const pageContent = await page.textContent('body');
    const hasDirectorContent = pageContent.includes('Gestión de Alumnos');
    expect(hasDirectorContent).toBe(false);
  });

  test('director role should have access to enrollment', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Should see students list
    const pageContent = await page.textContent('body');
    const hasStudentsContent = pageContent.includes('Alumno') || pageContent.includes('Estudiante');
    expect(hasStudentsContent).toBe(true);
  });

  test('inspector role should have access to enrollment', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.setItem('currentRole', 'inspector');
      localStorage.setItem('sessionToken', 'test_token_' + Date.now());
    });

    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Should see students list (inspector has access)
    const pageContent = await page.textContent('body');
    const hasStudentsContent = pageContent.includes('Alumno') || pageContent.includes('Estudiante');
    expect(hasStudentsContent).toBe(true);
  });
});
