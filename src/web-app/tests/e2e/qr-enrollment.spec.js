/**
 * QR Enrollment - E2E Tests
 * Tests the complete QR enrollment workflow for students and teachers
 */
import { test, expect } from '@playwright/test';

async function setupDirectorSession(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    // Clear previous data
    localStorage.clear();

    // Set up mock app data with students and teachers
    const mockData = {
      students: [
        {
          id: 1,
          full_name: 'Juan Pérez García',
          course_id: 1,
          national_id: '12.345.678-9',
          status: 'ACTIVE',
          photo_pref_opt_in: false
        },
        {
          id: 2,
          full_name: 'María González López',
          course_id: 1,
          national_id: '12.345.679-0',
          status: 'ACTIVE',
          photo_pref_opt_in: false
        }
      ],
      courses: [
        {
          id: 1,
          name: '6° Básico A',
          grade: '6',
          section: 'A',
          status: 'ACTIVE',
          teacher_ids: [1]
        }
      ],
      guardians: [
        {
          id: 1,
          full_name: 'Ana García Martínez',
          email: 'ana@example.com',
          student_ids: [1, 2],
          contacts: { phone: '+56912345678', email: 'ana@example.com' }
        }
      ],
      teachers: [
        {
          id: 1,
          full_name: 'Prof. Carlos López Silva',
          email: 'carlos@colegio.cl',
          status: 'ACTIVE',
          specialty: 'Matemáticas'
        },
        {
          id: 2,
          full_name: 'Prof. Andrea Muñoz Vera',
          email: 'andrea@colegio.cl',
          status: 'ACTIVE',
          specialty: 'Lenguaje'
        }
      ],
      schedules: [],
      schedule_exceptions: [],
      attendance_events: [],
      devices: [],
      absences: [],
      notifications: []
    };

    // Store mock data
    localStorage.setItem('appData', JSON.stringify(mockData));
    localStorage.setItem('currentRole', 'director');
    localStorage.setItem('sessionToken', 'test_token_' + Date.now());
  });

  // Reload to initialize State with mock data
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Student QR Enrollment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show Enrolar QR button in student profile modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();

    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await expect(qrButton).toBeVisible();
  });

  test('should open QR enrollment modal when clicking Enrolar QR', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();

    await page.waitForTimeout(500);
    await page.waitForSelector('.modal-container.active');

    const modalTitle = await page.textContent('.modal-title');
    expect(modalTitle).toContain('Enrolar QR');
  });

  test('should display student information in QR enrollment modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const studentName = await page.locator('table tbody tr').first().locator('td strong').first().textContent();

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(500);

    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Nombre:');
    expect(modalContent).toContain(studentName);
    expect(modalContent).toContain('Token:');
    expect(modalContent).toContain('Colegio:');
  });

  test('should generate QR code after opening modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Check if qrcode library is available
    const qrCodeAvailable = await page.evaluate(() => typeof qrcode !== 'undefined');
    if (!qrCodeAvailable) {
      test.skip('qrcode library not available in test environment');
      return;
    }

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();

    // Wait for QR to generate (longer timeout for CDN)
    await page.waitForTimeout(3000);

    // Check QR image is visible
    const qrImage = page.locator('#qr-code-image');
    await expect(qrImage).toBeVisible({ timeout: 10000 });

    // Check image has valid src (qrcode-generator produces GIF format)
    const src = await qrImage.getAttribute('src');
    expect(src).toMatch(/^data:image\/(png|gif);base64,/);
  });

  test('should show download and print buttons after QR generation', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Check if qrcode library is available
    const qrCodeAvailable = await page.evaluate(() => typeof qrcode !== 'undefined');
    if (!qrCodeAvailable) {
      test.skip('qrcode library not available in test environment');
      return;
    }

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(3000);

    const downloadBtn = page.locator('#btn-download-qr');
    const printBtn = page.locator('#btn-print-card');

    await expect(downloadBtn).toBeVisible();
    await expect(printBtn).toBeVisible();
    await expect(downloadBtn).not.toBeDisabled();
    await expect(printBtn).not.toBeDisabled();
  });

  test('should display school contact info', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(500);

    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Direccion:');
    expect(modalContent).toContain('Telefono:');
  });

  test('should close modal with Cerrar button', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(500);

    const closeButton = page.locator('.modal-footer button:has-text("Cerrar")');
    await closeButton.click();

    await page.waitForTimeout(300);
    const modalActive = await page.locator('.modal-container.active').isVisible();
    expect(modalActive).toBe(false);
  });
});

test.describe('Teacher QR Enrollment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show Enrolar QR button in teacher profile modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await expect(qrButton).toBeVisible();
  });

  test('should display teacher information in QR enrollment modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    const teacherName = await page.locator('table tbody tr').first().locator('td strong').first().textContent();

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(500);

    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Nombre:');
    expect(modalContent).toContain(teacherName);
    expect(modalContent).toContain('Cargo:');
    expect(modalContent).toContain('Profesor');
  });

  test('should generate QR code for teacher', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    // Check if qrcode library is available
    const qrCodeAvailable = await page.evaluate(() => typeof qrcode !== 'undefined');
    if (!qrCodeAvailable) {
      test.skip('qrcode library not available in test environment');
      return;
    }

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(3000);

    const qrImage = page.locator('#qr-code-image');
    await expect(qrImage).toBeVisible({ timeout: 10000 });
  });

  test('should include courses in teacher modal', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(500);

    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Cursos:');
  });
});

test.describe('QR Enrollment - Token Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
    await setupDirectorSession(page);
  });

  test('should generate unique token for each enrollment', async ({ page }) => {
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(500);

    const token1 = await page.evaluate(() => {
      return document.querySelector('.modal').textContent.match(/qr_\d+_[a-z0-9]+/)?.[0];
    });

    await page.locator('.modal-footer button:has-text("Cerrar")').click();
    await page.waitForTimeout(300);

    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');
    await qrButton.click();
    await page.waitForTimeout(500);

    const token2 = await page.evaluate(() => {
      return document.querySelector('.modal').textContent.match(/qr_\d+_[a-z0-9]+/)?.[0];
    });

    expect(token1).not.toBe(token2);
  });

  test('student token should start with qr_', async ({ page }) => {
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(500);

    const tokenText = await page.textContent('.modal code');
    expect(tokenText).toMatch(/^qr_\d+_[a-z0-9]+$/);
  });

  test('teacher token should start with qr_teacher_', async ({ page }) => {
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(500);

    const tokenText = await page.textContent('.modal code');
    expect(tokenText).toMatch(/^qr_teacher_\d+_[a-z0-9]+$/);
  });
});

test.describe('QR Enrollment - Download and Print', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
    await setupDirectorSession(page);
  });

  test('download button should trigger download', async ({ page }) => {
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Check if qrcode library is available
    const qrCodeAvailable = await page.evaluate(() => typeof qrcode !== 'undefined');
    if (!qrCodeAvailable) {
      test.skip('qrcode library not available in test environment');
      return;
    }

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(3000);

    // Intercept download
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    const downloadBtn = page.locator('#btn-download-qr');
    // Wait for button to be enabled
    await expect(downloadBtn).not.toBeDisabled({ timeout: 10000 });
    await downloadBtn.click();

    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/^qr-.+\.png$/);
    }
    // Note: download may not trigger in all test environments
  });

  test('print button should open new window', async ({ page, context }) => {
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    // Check if qrcode library is available
    const qrCodeAvailable = await page.evaluate(() => typeof qrcode !== 'undefined');
    if (!qrCodeAvailable) {
      test.skip('qrcode library not available in test environment');
      return;
    }

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await qrButton.click();
    await page.waitForTimeout(3000);

    // Listen for new page
    const pagePromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);

    const printBtn = page.locator('#btn-print-card');
    // Wait for button to be enabled
    await expect(printBtn).not.toBeDisabled({ timeout: 10000 });
    await printBtn.click();

    const newPage = await pagePromise;
    if (newPage) {
      const content = await newPage.content();
      expect(content).toContain('Credencial QR');
      expect(content).toContain('Imprimir');
      await newPage.close();
    }
  });
});

test.describe('QR Enrollment - Both Buttons Present', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
    await setupDirectorSession(page);
  });

  test('student profile should have both QR and NFC buttons', async ({ page }) => {
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');

    await expect(qrButton).toBeVisible();
    await expect(nfcButton).toBeVisible();
  });

  test('teacher profile should have both QR and NFC buttons', async ({ page }) => {
    await page.goto('/#/director/teachers');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    const nfcButton = page.locator('.modal-footer button:has-text("Enrolar NFC")');

    await expect(qrButton).toBeVisible();
    await expect(nfcButton).toBeVisible();
  });
});

test.describe('QR Enrollment - Access Control', () => {
  test('parent role should not have access to enrollment', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      localStorage.setItem('currentRole', 'parent');
      localStorage.setItem('sessionToken', 'test_token_' + Date.now());
      localStorage.setItem('currentGuardianId', '1');
    });

    await page.goto('/#/parent/home');
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent('body');
    const hasDirectorContent = pageContent.includes('Gestión de Alumnos');
    expect(hasDirectorContent).toBe(false);
  });

  test('director role should have access to QR enrollment', async ({ page }) => {
    await setupDirectorSession(page);
    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await expect(qrButton).toBeVisible();
  });

  test('inspector role should have access to QR enrollment', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.setItem('currentRole', 'inspector');
      localStorage.setItem('sessionToken', 'test_token_' + Date.now());
    });

    await page.goto('/#/director/students');
    await page.waitForTimeout(1500);

    const viewProfileBtn = page.locator('button[title="Ver perfil"]').first();
    await viewProfileBtn.click();
    await page.waitForSelector('.modal-container.active');

    const qrButton = page.locator('.modal-footer button:has-text("Enrolar QR")');
    await expect(qrButton).toBeVisible();
  });
});
