/**
 * NFC Enrollment Service - Unit Tests
 * Tests run in browser context using Playwright's evaluate()
 */
const { test, expect } = require('@playwright/test');

async function setupPage(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  // Setup mock data
  await page.evaluate(() => {
    localStorage.setItem('currentRole', 'director');
    localStorage.setItem('sessionToken', 'test_token_' + Date.now());
  });
  // Wait for scripts to load
  await page.waitForTimeout(500);
}

test.describe('NFCEnrollment Service - Unit Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('NFCEnrollment should be defined', async ({ page }) => {
    const isDefined = await page.evaluate(() => {
      return typeof window.NFCEnrollment !== 'undefined';
    });
    expect(isDefined).toBe(true);
  });

  test('isSupported() should return boolean', async ({ page }) => {
    const result = await page.evaluate(() => {
      return typeof NFCEnrollment.isSupported() === 'boolean';
    });
    expect(result).toBe(true);
  });

  test('schoolConfig should have required properties', async ({ page }) => {
    const config = await page.evaluate(() => {
      return NFCEnrollment.schoolConfig;
    });
    expect(config).toHaveProperty('name');
    expect(config).toHaveProperty('address');
    expect(config).toHaveProperty('phone');
    expect(config).toHaveProperty('email');
    expect(config).toHaveProperty('lostFoundMessage');
  });

  test('generateToken() should generate valid student token', async ({ page }) => {
    const token = await page.evaluate(() => {
      return NFCEnrollment.generateToken('student', 123);
    });
    expect(token).toMatch(/^nfc_123_[a-z0-9]+$/);
  });

  test('generateToken() should generate valid teacher token', async ({ page }) => {
    const token = await page.evaluate(() => {
      return NFCEnrollment.generateToken('teacher', 456);
    });
    expect(token).toMatch(/^nfc_teacher_456_[a-z0-9]+$/);
  });

  test('generateToken() should generate unique tokens', async ({ page }) => {
    const tokens = await page.evaluate(() => {
      const t1 = NFCEnrollment.generateToken('student', 1);
      const t2 = NFCEnrollment.generateToken('student', 1);
      const t3 = NFCEnrollment.generateToken('student', 1);
      return [t1, t2, t3];
    });
    // All tokens should be unique
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(3);
  });

  test('buildStudentRecords() should return array with 3 records', async ({ page }) => {
    const records = await page.evaluate(() => {
      const student = { id: 1, full_name: 'Test Student', national_id: '12345678-9', course_id: 1 };
      const course = { id: 1, name: '1A', grade: '1ro Basico' };
      const guardians = [{ full_name: 'Parent Name', contacts: [] }];
      const token = 'test_token_123';
      return NFCEnrollment.buildStudentRecords(student, course, guardians, token);
    });
    expect(records).toHaveLength(3);
    expect(records[0].recordType).toBe('url');
    expect(records[1].recordType).toBe('text');
    expect(records[2].recordType).toBe('mime');
  });

  test('buildStudentRecords() URL should contain token', async ({ page }) => {
    const records = await page.evaluate(() => {
      const student = { id: 1, full_name: 'Test Student', national_id: '12345678-9' };
      const course = { id: 1, name: '1A', grade: '1ro' };
      const guardians = [];
      const token = 'unique_test_token';
      return NFCEnrollment.buildStudentRecords(student, course, guardians, token);
    });
    expect(records[0].data).toContain('unique_test_token');
  });

  test('buildStudentRecords() text should contain valid JSON', async ({ page }) => {
    const textRecord = await page.evaluate(() => {
      const student = { id: 1, full_name: 'Maria Garcia', national_id: '12345678-9' };
      const course = { id: 1, name: '1A', grade: '1ro' };
      const guardians = [{ full_name: 'Pedro Garcia', contacts: [{type: 'email', value: 'test@test.com'}] }];
      const token = 'test_token';
      const records = NFCEnrollment.buildStudentRecords(student, course, guardians, token);
      return records[1].data;
    });

    const parsed = JSON.parse(textRecord);
    expect(parsed.type).toBe('student');
    expect(parsed.id).toBe(1);
    expect(parsed.name).toBe('Maria Garcia');
    expect(parsed.national_id).toBe('12345678-9');
    expect(parsed.guardians).toHaveLength(1);
    expect(parsed.school).toHaveProperty('name');
    expect(parsed.enrolled_at).toBeDefined();
  });

  test('buildStudentRecords() vCard should contain student name', async ({ page }) => {
    const vcardRecord = await page.evaluate(() => {
      const student = { id: 1, full_name: 'Juan Perez', national_id: '12345678-9' };
      const course = { id: 1, name: '1A', grade: '1ro' };
      const guardians = [];
      const token = 'test_token';
      const records = NFCEnrollment.buildStudentRecords(student, course, guardians, token);
      return records[2];
    });
    expect(vcardRecord.mediaType).toBe('text/vcard');
    expect(vcardRecord.data).toContain('FN:Juan Perez');
    expect(vcardRecord.data).toContain('BEGIN:VCARD');
    expect(vcardRecord.data).toContain('END:VCARD');
  });

  test('buildTeacherRecords() should return array with 3 records', async ({ page }) => {
    const records = await page.evaluate(() => {
      const teacher = { id: 1, full_name: 'Test Teacher', email: 'teacher@test.com', specialty: 'Math' };
      const courses = [{ id: 1, name: '1A', grade: '1ro' }];
      const token = 'teacher_token_123';
      return NFCEnrollment.buildTeacherRecords(teacher, courses, token);
    });
    expect(records).toHaveLength(3);
    expect(records[0].recordType).toBe('url');
    expect(records[1].recordType).toBe('text');
    expect(records[2].recordType).toBe('mime');
  });

  test('buildTeacherRecords() text should contain teacher type', async ({ page }) => {
    const textRecord = await page.evaluate(() => {
      const teacher = { id: 5, full_name: 'Prof. Martinez', email: 'prof@school.cl', specialty: 'Sciences' };
      const courses = [{ id: 1, name: '1A', grade: '1ro' }, { id: 2, name: '2A', grade: '2do' }];
      const token = 'teacher_token';
      const records = NFCEnrollment.buildTeacherRecords(teacher, courses, token);
      return records[1].data;
    });

    const parsed = JSON.parse(textRecord);
    expect(parsed.type).toBe('teacher');
    expect(parsed.id).toBe(5);
    expect(parsed.name).toBe('Prof. Martinez');
    expect(parsed.specialty).toBe('Sciences');
    expect(parsed.courses).toHaveLength(2);
  });

  test('buildTeacherRecords() vCard should contain teacher info', async ({ page }) => {
    const vcardRecord = await page.evaluate(() => {
      const teacher = { id: 1, full_name: 'Ana Lopez', email: 'ana@school.cl', phone: '+56912345678', specialty: 'Language' };
      const courses = [];
      const token = 'test';
      const records = NFCEnrollment.buildTeacherRecords(teacher, courses, token);
      return records[2];
    });
    expect(vcardRecord.data).toContain('FN:Ana Lopez');
    expect(vcardRecord.data).toContain('EMAIL:ana@school.cl');
    expect(vcardRecord.data).toContain('TEL:+56912345678');
    expect(vcardRecord.data).toContain('Profesor - Language');
  });

  test('_buildVCard() internal method should create valid vCard', async ({ page }) => {
    const vcard = await page.evaluate(() => {
      return NFCEnrollment._buildVCard({
        name: 'Test Person',
        org: 'Test School',
        title: 'Student',
        note: 'Test note',
        email: 'test@test.com',
        tel: '+1234567890'
      });
    });
    expect(vcard).toContain('BEGIN:VCARD');
    expect(vcard).toContain('VERSION:3.0');
    expect(vcard).toContain('FN:Test Person');
    expect(vcard).toContain('ORG:Test School');
    expect(vcard).toContain('TITLE:Student');
    expect(vcard).toContain('EMAIL:test@test.com');
    expect(vcard).toContain('TEL:+1234567890');
    expect(vcard).toContain('END:VCARD');
  });

  test('writeTag() should return error when NFC not supported', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Mock NFC as unsupported
      const originalNDEF = window.NDEFReader;
      delete window.NDEFReader;
      const result = await NFCEnrollment.writeTag([]);
      window.NDEFReader = originalNDEF; // Restore
      return result;
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('no soportado');
  });

  test('readTag() should return error when NFC not supported', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const originalNDEF = window.NDEFReader;
      delete window.NDEFReader;
      const result = await NFCEnrollment.readTag(100); // Short timeout
      window.NDEFReader = originalNDEF;
      return result;
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('no soportado');
  });
});

test.describe('NFCEnrollment - Integration with State', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('showStudentEnrollmentModal() should require valid student', async ({ page }) => {
    const toastShown = await page.evaluate(() => {
      let toastMessage = null;
      const originalShowToast = Components.showToast;
      Components.showToast = (msg) => { toastMessage = msg; };

      NFCEnrollment.showStudentEnrollmentModal(99999); // Non-existent ID

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

      NFCEnrollment.showTeacherEnrollmentModal(99999); // Non-existent ID

      Components.showToast = originalShowToast;
      return toastMessage;
    });
    expect(toastShown).toContain('no encontrado');
  });

  test('showStudentEnrollmentModal() should open modal for valid student', async ({ page }) => {
    // First ensure we have students in state
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
      NFCEnrollment.showStudentEnrollmentModal(1);
    });

    // Check modal is visible
    const modalVisible = await page.locator('.modal-container.active').isVisible();
    expect(modalVisible).toBe(true);

    // Check modal contains student info
    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Enrolar NFC');
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
      NFCEnrollment.showTeacherEnrollmentModal(1);
    });

    const modalVisible = await page.locator('.modal-container.active').isVisible();
    expect(modalVisible).toBe(true);

    const modalContent = await page.textContent('.modal');
    expect(modalContent).toContain('Enrolar NFC');
    expect(modalContent).toContain('Profesor');
  });
});

test.describe('NFCEnrollment - Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('student enrollment data should include all required fields', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = {
        id: 42,
        full_name: 'Complete Student',
        national_id: '12.345.678-9',
        course_id: 1,
        email: 'student@email.com'
      };
      const course = { id: 1, name: '1A', grade: '1ro Basico' };
      const guardians = [
        { full_name: 'Mother Name', contacts: [{type: 'whatsapp', value: '+56912345678'}] },
        { full_name: 'Father Name', contacts: [{type: 'email', value: 'father@email.com'}] }
      ];
      const token = 'test_token';
      const records = NFCEnrollment.buildStudentRecords(student, course, guardians, token);
      return JSON.parse(records[1].data);
    });

    expect(data.type).toBe('student');
    expect(data.id).toBe(42);
    expect(data.token).toBe('test_token');
    expect(data.name).toBe('Complete Student');
    expect(data.national_id).toBe('12.345.678-9');
    expect(data.course.name).toBe('1A');
    expect(data.course.grade).toBe('1ro Basico');
    expect(data.guardians).toHaveLength(2);
    expect(data.guardians[0].name).toBe('Mother Name');
    expect(data.school.name).toBeDefined();
    expect(data.school.address).toBeDefined();
    expect(data.enrolled_at).toBeDefined();
  });

  test('teacher enrollment data should include all required fields', async ({ page }) => {
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
      const token = 'teacher_token_xyz';
      const records = NFCEnrollment.buildTeacherRecords(teacher, courses, token);
      return JSON.parse(records[1].data);
    });

    expect(data.type).toBe('teacher');
    expect(data.id).toBe(7);
    expect(data.token).toBe('teacher_token_xyz');
    expect(data.name).toBe('Complete Teacher');
    expect(data.email).toBe('teacher@school.cl');
    expect(data.phone).toBe('+56987654321');
    expect(data.specialty).toBe('Mathematics');
    expect(data.courses).toHaveLength(2);
    expect(data.school.name).toBeDefined();
    expect(data.enrolled_at).toBeDefined();
  });

  test('vCard should contain lost & found message', async ({ page }) => {
    const vcard = await page.evaluate(() => {
      const student = { id: 1, full_name: 'Test', national_id: '1-9' };
      const course = { id: 1, name: '1A', grade: '1ro' };
      const records = NFCEnrollment.buildStudentRecords(student, course, [], 'token');
      return records[2].data;
    });

    expect(vcard).toContain('porteria');
  });

  test('URL record should use window.location.origin', async ({ page }) => {
    const urlRecord = await page.evaluate(() => {
      const student = { id: 1, full_name: 'Test', national_id: '1-9' };
      const course = { id: 1, name: '1A', grade: '1ro' };
      const records = NFCEnrollment.buildStudentRecords(student, course, [], 'mytoken');
      return records[0].data;
    });

    expect(urlRecord).toContain('/t/mytoken');
  });
});

test.describe('NFCEnrollment - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('should handle student without national_id', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = { id: 1, full_name: 'No ID Student', course_id: 1 };
      const course = { id: 1, name: '1A', grade: '1ro' };
      const records = NFCEnrollment.buildStudentRecords(student, course, [], 'token');
      return JSON.parse(records[1].data);
    });
    expect(data.national_id).toBe('');
  });

  test('should handle student without course', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = { id: 1, full_name: 'No Course Student' };
      const records = NFCEnrollment.buildStudentRecords(student, null, [], 'token');
      return JSON.parse(records[1].data);
    });
    expect(data.course).toBeNull();
  });

  test('should handle student with empty guardians', async ({ page }) => {
    const data = await page.evaluate(() => {
      const student = { id: 1, full_name: 'Orphan Student' };
      const course = { id: 1, name: '1A', grade: '1ro' };
      const records = NFCEnrollment.buildStudentRecords(student, course, [], 'token');
      return JSON.parse(records[1].data);
    });
    expect(data.guardians).toHaveLength(0);
  });

  test('should handle teacher without courses', async ({ page }) => {
    const data = await page.evaluate(() => {
      const teacher = { id: 1, full_name: 'New Teacher' };
      const records = NFCEnrollment.buildTeacherRecords(teacher, [], 'token');
      return JSON.parse(records[1].data);
    });
    expect(data.courses).toHaveLength(0);
  });

  test('should handle teacher without optional fields', async ({ page }) => {
    const data = await page.evaluate(() => {
      const teacher = { id: 1, full_name: 'Minimal Teacher' };
      const records = NFCEnrollment.buildTeacherRecords(teacher, [], 'token');
      return JSON.parse(records[1].data);
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
      const records = NFCEnrollment.buildStudentRecords(student, course, guardians, 'token');
      return JSON.parse(records[1].data);
    });
    expect(data.name).toBe("María José O'Connor");
    expect(data.guardians[0].name).toBe('José "Pepe" García');
  });
});
