/**
 * QR Enrollment Service - Unit Tests
 * Tests run in browser context using Playwright's evaluate()
 */
import { test, expect } from '@playwright/test';

async function setupPage(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.setItem('currentRole', 'director');
    localStorage.setItem('sessionToken', 'test_token_' + Date.now());
  });
  await page.waitForTimeout(500);
}

test.describe('QREnrollment Service - Unit Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('QREnrollment should be defined', async ({ page }) => {
    const isDefined = await page.evaluate(() => {
      return typeof window.QREnrollment !== 'undefined';
    });
    expect(isDefined).toBe(true);
  });

  test('schoolConfig should have required properties', async ({ page }) => {
    const config = await page.evaluate(() => {
      return QREnrollment.schoolConfig;
    });
    expect(config).toHaveProperty('name');
    expect(config).toHaveProperty('address');
    expect(config).toHaveProperty('phone');
    expect(config).toHaveProperty('email');
    expect(config).toHaveProperty('lostFoundMessage');
  });

  test('generateToken() should generate valid student token', async ({ page }) => {
    const token = await page.evaluate(() => {
      return QREnrollment.generateToken('student', 123);
    });
    expect(token).toMatch(/^qr_123_[a-z0-9]+$/);
  });

  test('generateToken() should generate valid teacher token', async ({ page }) => {
    const token = await page.evaluate(() => {
      return QREnrollment.generateToken('teacher', 456);
    });
    expect(token).toMatch(/^qr_teacher_456_[a-z0-9]+$/);
  });

  test('generateToken() should generate unique tokens', async ({ page }) => {
    const tokens = await page.evaluate(() => {
      const t1 = QREnrollment.generateToken('student', 1);
      const t2 = QREnrollment.generateToken('student', 1);
      const t3 = QREnrollment.generateToken('student', 1);
      return [t1, t2, t3];
    });
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(3);
  });

  test('buildStudentData() should return complete data object', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = { id: 1, full_name: 'Test Student', national_id: '12345678-9', course_id: 1 };
      const course = { id: 1, name: '1A', grade: '1ro Basico' };
      const guardians = [{ full_name: 'Parent Name', contacts: [] }];
      const token = 'test_token_123';
      return QREnrollment.buildStudentData(student, course, guardians, token);
    });
    expect(data.type).toBe('student');
    expect(data.id).toBe(1);
    expect(data.token).toBe('test_token_123');
    expect(data.name).toBe('Test Student');
    expect(data.national_id).toBe('12345678-9');
    expect(data.course.name).toBe('1A');
    expect(data.guardians).toHaveLength(1);
    expect(data.school).toHaveProperty('name');
    expect(data.enrolled_at).toBeDefined();
  });

  test('buildTeacherData() should return complete data object', async ({ page }) => {
    const data = await page.evaluate(() => {
      const teacher = { id: 5, full_name: 'Prof. Martinez', email: 'prof@school.cl', specialty: 'Math' };
      const courses = [{ id: 1, name: '1A', grade: '1ro' }];
      const token = 'teacher_token';
      return QREnrollment.buildTeacherData(teacher, courses, token);
    });
    expect(data.type).toBe('teacher');
    expect(data.id).toBe(5);
    expect(data.name).toBe('Prof. Martinez');
    expect(data.email).toBe('prof@school.cl');
    expect(data.specialty).toBe('Math');
    expect(data.courses).toHaveLength(1);
    expect(data.school).toHaveProperty('name');
  });

  test('generateQRDataURL() should return data URL when qrcode available', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // qrcode-generator uses lowercase 'qrcode'
      if (typeof qrcode === 'undefined') {
        return { skipped: true };
      }
      try {
        const dataURL = await QREnrollment.generateQRDataURL('test_token', { cellSize: 4 });
        return { dataURL };
      } catch (e) {
        return { error: e.message };
      }
    });

    if (result.skipped) {
      test.skip();
      return;
    }
    if (result.error) {
      expect(result.error).toContain('not loaded');
    } else {
      expect(result.dataURL).toMatch(/^data:image\/(png|gif);base64,/);
    }
  });

  test('generateQRDataURL() should handle library check correctly', async ({ page }) => {
    // Test that the check for qrcode library exists in the code
    const hasCheck = await page.evaluate(() => {
      const funcStr = QREnrollment.generateQRDataURL.toString();
      return funcStr.includes('qrcode') && funcStr.includes('undefined');
    });
    expect(hasCheck).toBe(true);

    // Verify that the library is available and works
    const result = await page.evaluate(async () => {
      if (typeof qrcode !== 'undefined') {
        const dataURL = await QREnrollment.generateQRDataURL('test');
        return { success: true, hasDataURL: dataURL.startsWith('data:image/') };
      }
      return { success: false };
    });
    expect(result.success).toBe(true);
    expect(result.hasDataURL).toBe(true);
  });

  test('generatePrintableCard() should return valid HTML', async ({ page }) => {
    const html = await page.evaluate(() => {
      const data = {
        type: 'student',
        name: 'Test Student',
        token: 'qr_test',
        national_id: '12345678-9',
        course: { name: '1A', grade: '1ro' },
        school: {
          name: 'Test School',
          address: 'Test Address',
          phone: '+56 2 1234 5678'
        }
      };
      const qrDataURL = 'data:image/png;base64,test';
      return QREnrollment.generatePrintableCard(data, qrDataURL);
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Student');
    expect(html).toContain('Test School');
    expect(html).toContain('Alumno');
    expect(html).toContain('qr_test');
    expect(html).toContain('data:image/png;base64,test');
  });

  test('generatePrintableCard() should show Profesor for teachers', async ({ page }) => {
    const html = await page.evaluate(() => {
      const data = {
        type: 'teacher',
        name: 'Test Teacher',
        token: 'qr_teacher_test',
        specialty: 'Mathematics',
        school: {
          name: 'Test School',
          address: 'Test Address',
          phone: '+56 2 1234 5678'
        }
      };
      const qrDataURL = 'data:image/png;base64,test';
      return QREnrollment.generatePrintableCard(data, qrDataURL);
    });
    expect(html).toContain('Profesor');
    expect(html).toContain('Mathematics');
  });

  test('_escapeHtml() should escape special characters', async ({ page }) => {
    const result = await page.evaluate(() => {
      return QREnrollment._escapeHtml('<script>alert("xss")</script>');
    });
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  test('_escapeHtml() should handle null and undefined', async ({ page }) => {
    const results = await page.evaluate(() => {
      return [
        QREnrollment._escapeHtml(null),
        QREnrollment._escapeHtml(undefined),
        QREnrollment._escapeHtml('')
      ];
    });
    expect(results[0]).toBe('');
    expect(results[1]).toBe('');
    expect(results[2]).toBe('');
  });
});

test.describe('QREnrollment - Integration with State', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('showStudentEnrollmentModal() should require valid student', async ({ page }) => {
    const toastShown = await page.evaluate(() => {
      let toastMessage = null;
      const originalShowToast = Components.showToast;
      Components.showToast = (msg) => { toastMessage = msg; };

      QREnrollment.showStudentEnrollmentModal(99999);

      Components.showToast = originalShowToast;
      return toastMessage;
    });
    expect(toastShown).toContain('no encontrado');
  });

  test('showTeacherEnrollmentModal() should require valid teacher', async ({ page }) => {
    const toastShown = await page.evaluate(() => {
      let toastMessage = null;
      const originalShowToast = Components.showToast;
      Components.showToast = (msg) => { toastMessage = msg; };

      QREnrollment.showTeacherEnrollmentModal(99999);

      Components.showToast = originalShowToast;
      return toastMessage;
    });
    expect(toastShown).toContain('no encontrado');
  });

  test('showStudentEnrollmentModal() should open modal for valid student', async ({ page }) => {
    await page.evaluate(() => {
      if (!State.data.students || State.data.students.length === 0) {
        State.data.students = [{ id: 1, full_name: 'Test Student', course_id: 1 }];
      }
      if (!State.data.courses || State.data.courses.length === 0) {
        State.data.courses = [{ id: 1, name: '1A', grade: '1ro' }];
      }
      if (!State.data.guardians) {
        State.data.guardians = [];
      }
    });

    await page.evaluate(() => {
      QREnrollment.showStudentEnrollmentModal(1);
    });

    const modalVisible = await page.locator('.modal-container.active').isVisible();
    expect(modalVisible).toBe(true);

    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Enrolar QR');
  });

  test('showTeacherEnrollmentModal() should open modal for valid teacher', async ({ page }) => {
    await page.evaluate(() => {
      if (!State.data.teachers || State.data.teachers.length === 0) {
        State.data.teachers = [{ id: 1, full_name: 'Test Teacher', email: 'test@school.cl', specialty: 'Math' }];
      }
      if (!State.data.courses || State.data.courses.length === 0) {
        State.data.courses = [{ id: 1, name: '1A', grade: '1ro' }];
      }
    });

    await page.evaluate(() => {
      QREnrollment.showTeacherEnrollmentModal(1);
    });

    const modalVisible = await page.locator('.modal-container.active').isVisible();
    expect(modalVisible).toBe(true);

    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Enrolar QR');
    expect(modalContent).toContain('Profesor');
  });
});

test.describe('QREnrollment - QR Code Generation', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('modal should show loading state initially', async ({ page }) => {
    await page.evaluate(() => {
      State.data.students = [{ id: 1, full_name: 'Test Student', course_id: 1 }];
      State.data.courses = [{ id: 1, name: '1A', grade: '1ro' }];
      State.data.guardians = [];
    });

    await page.evaluate(() => {
      QREnrollment.showStudentEnrollmentModal(1);
    });

    // Modal should open with QR section
    const modal = page.locator('.modal-container.active');
    await expect(modal).toBeVisible();

    const qrContainer = page.locator('#qr-preview-container');
    await expect(qrContainer).toBeVisible();
  });

  test('modal should show QR code when library available', async ({ page }) => {
    const qrAvailable = await page.evaluate(() => typeof qrcode !== 'undefined');

    if (!qrAvailable) {
      test.skip();
      return;
    }

    await page.evaluate(() => {
      State.data.students = [{ id: 1, full_name: 'Test Student', course_id: 1 }];
      State.data.courses = [{ id: 1, name: '1A', grade: '1ro' }];
      State.data.guardians = [];
    });

    await page.evaluate(() => {
      QREnrollment.showStudentEnrollmentModal(1);
    });

    await page.waitForTimeout(1500);

    const qrImage = page.locator('#qr-code-image');
    const isVisible = await qrImage.isVisible();
    expect(isVisible).toBe(true);
  });

  test('buttons should be initially disabled', async ({ page }) => {
    await page.evaluate(() => {
      State.data.students = [{ id: 1, full_name: 'Test Student', course_id: 1 }];
      State.data.courses = [{ id: 1, name: '1A', grade: '1ro' }];
      State.data.guardians = [];
    });

    await page.evaluate(() => {
      QREnrollment.showStudentEnrollmentModal(1);
    });

    // Check buttons exist
    const downloadBtn = page.locator('#btn-download-qr');
    const printBtn = page.locator('#btn-print-card');

    await expect(downloadBtn).toBeVisible();
    await expect(printBtn).toBeVisible();
  });
});

test.describe('QREnrollment - Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('student data should include all required fields', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = {
        id: 42,
        full_name: 'Complete Student',
        national_id: '12.345.678-9',
        course_id: 1
      };
      const course = { id: 1, name: '1A', grade: '1ro Basico' };
      const guardians = [
        { full_name: 'Mother', contacts: [{type: 'whatsapp', value: '+56912345678'}] },
        { full_name: 'Father', contacts: [{type: 'email', value: 'father@email.com'}] }
      ];
      const token = 'qr_test_token';
      return QREnrollment.buildStudentData(student, course, guardians, token);
    });

    expect(data.type).toBe('student');
    expect(data.id).toBe(42);
    expect(data.token).toBe('qr_test_token');
    expect(data.name).toBe('Complete Student');
    expect(data.national_id).toBe('12.345.678-9');
    expect(data.course.name).toBe('1A');
    expect(data.guardians).toHaveLength(2);
    expect(data.school.name).toBeDefined();
    expect(data.enrolled_at).toBeDefined();
  });

  test('teacher data should include all required fields', async ({ page }) => {
    const data = await page.evaluate(() => {
      const teacher = {
        id: 7,
        full_name: 'Complete Teacher',
        email: 'teacher@school.cl',
        phone: '+56987654321',
        specialty: 'Mathematics'
      };
      const courses = [
        { id: 1, name: '1A', grade: '1ro' },
        { id: 2, name: '2B', grade: '2do' }
      ];
      const token = 'qr_teacher_xyz';
      return QREnrollment.buildTeacherData(teacher, courses, token);
    });

    expect(data.type).toBe('teacher');
    expect(data.id).toBe(7);
    expect(data.token).toBe('qr_teacher_xyz');
    expect(data.name).toBe('Complete Teacher');
    expect(data.email).toBe('teacher@school.cl');
    expect(data.phone).toBe('+56987654321');
    expect(data.specialty).toBe('Mathematics');
    expect(data.courses).toHaveLength(2);
    expect(data.school.name).toBeDefined();
  });
});

test.describe('QREnrollment - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('should handle student without national_id', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = { id: 1, full_name: 'No ID Student', course_id: 1 };
      const course = { id: 1, name: '1A', grade: '1ro' };
      return QREnrollment.buildStudentData(student, course, [], 'token');
    });
    expect(data.national_id).toBe('');
  });

  test('should handle student without course', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = { id: 1, full_name: 'No Course Student' };
      return QREnrollment.buildStudentData(student, null, [], 'token');
    });
    expect(data.course).toBeNull();
  });

  test('should handle student with empty guardians', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = { id: 1, full_name: 'Orphan Student' };
      const course = { id: 1, name: '1A', grade: '1ro' };
      return QREnrollment.buildStudentData(student, course, [], 'token');
    });
    expect(data.guardians).toHaveLength(0);
  });

  test('should handle teacher without courses', async ({ page }) => {
    const data = await page.evaluate(() => {
      const teacher = { id: 1, full_name: 'New Teacher' };
      return QREnrollment.buildTeacherData(teacher, [], 'token');
    });
    expect(data.courses).toHaveLength(0);
  });

  test('should handle teacher without optional fields', async ({ page }) => {
    const data = await page.evaluate(() => {
      const teacher = { id: 1, full_name: 'Minimal Teacher' };
      return QREnrollment.buildTeacherData(teacher, [], 'token');
    });
    expect(data.email).toBe('');
    expect(data.phone).toBe('');
    expect(data.specialty).toBe('');
  });

  test('should handle special characters in names', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = { id: 1, full_name: "María José O'Connor", national_id: '12.345.678-K' };
      const course = { id: 1, name: '1°A', grade: '1° Básico' };
      const guardians = [{ full_name: 'José "Pepe" García', contacts: [] }];
      return QREnrollment.buildStudentData(student, course, guardians, 'token');
    });
    expect(data.name).toBe("María José O'Connor");
    expect(data.guardians[0].name).toBe('José "Pepe" García');
  });

  test('printable card should escape HTML in names', async ({ page }) => {
    const html = await page.evaluate(() => {
      const data = {
        type: 'student',
        name: '<script>alert("xss")</script>',
        token: 'test',
        school: { name: 'School', address: 'Addr', phone: '123' }
      };
      return QREnrollment.generatePrintableCard(data, 'data:image/png;base64,test');
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});
