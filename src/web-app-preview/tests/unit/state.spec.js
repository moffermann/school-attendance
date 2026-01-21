/**
 * Web App - State Management Unit Tests
 */
const { test, expect } = require('@playwright/test');

test.describe('State Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Clear storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('State should be defined', async ({ page }) => {
    const stateExists = await page.evaluate(() => typeof State !== 'undefined');
    expect(stateExists).toBeTruthy();
  });

  test('State should have VALID_ROLES defined', async ({ page }) => {
    const roles = await page.evaluate(() => State.VALID_ROLES);
    expect(roles).toContain('director');
    expect(roles).toContain('inspector');
    expect(roles).toContain('parent');
  });

  test('State.isSessionValid should return false when not logged in', async ({ page }) => {
    const isValid = await page.evaluate(() => {
      State.currentRole = null;
      return State.isSessionValid();
    });
    expect(isValid).toBeFalsy();
  });

  test('State.setRole should validate role', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Try to set invalid role
      State.setRole('invalid_role');
      return State.currentRole;
    });
    // Should not set invalid role
    expect(result).not.toBe('invalid_role');
  });

  test('State.setRole should set valid role', async ({ page }) => {
    const result = await page.evaluate(() => {
      State.setRole('director');
      return State.currentRole;
    });
    expect(result).toBe('director');
  });

  test('State.logout should clear session', async ({ page }) => {
    const result = await page.evaluate(() => {
      State.setRole('director');
      State.logout();
      return {
        role: State.currentRole,
        guardianId: State.currentGuardianId,
        localStorageRole: localStorage.getItem('currentRole')
      };
    });
    expect(result.role).toBeNull();
    expect(result.guardianId).toBeNull();
    expect(result.localStorageRole).toBeNull();
  });

  test('State.getStudents should return array', async ({ page }) => {
    const students = await page.evaluate(() => State.getStudents());
    expect(Array.isArray(students)).toBeTruthy();
  });

  test('State.getCourses should return array', async ({ page }) => {
    const courses = await page.evaluate(() => State.getCourses());
    expect(Array.isArray(courses)).toBeTruthy();
  });

  test('State.persist should save to localStorage', async ({ page }) => {
    const saved = await page.evaluate(() => {
      State.data.students = [{ id: 1, full_name: 'Test Student' }];
      State.persist();
      const stored = localStorage.getItem('appData');
      return JSON.parse(stored);
    });
    expect(saved.students).toHaveLength(1);
    expect(saved.students[0].full_name).toBe('Test Student');
  });
});

test.describe('State Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Set up test data
    await page.evaluate(() => {
      State.data = {
        students: [
          { id: 1, full_name: 'Ana García', course_id: 1 },
          { id: 2, full_name: 'Carlos López', course_id: 1 },
          { id: 3, full_name: 'María Pérez', course_id: 2 }
        ],
        courses: [
          { id: 1, name: '1° Básico A' },
          { id: 2, name: '2° Básico B' }
        ],
        guardians: [],
        schedules: [],
        schedule_exceptions: [],
        attendance_events: [],
        devices: [],
        absences: [],
        notifications: [],
        teachers: []
      };
    });
  });

  test('State.getStudentsByCourse should filter by course', async ({ page }) => {
    const students = await page.evaluate(() => State.getStudentsByCourse(1));
    expect(students).toHaveLength(2);
    expect(students.map(s => s.full_name)).toContain('Ana García');
    expect(students.map(s => s.full_name)).toContain('Carlos López');
  });

  test('State.getStudent should return student by id', async ({ page }) => {
    const student = await page.evaluate(() => State.getStudent(1));
    expect(student.full_name).toBe('Ana García');
  });

  test('State.getCourse should return course by id', async ({ page }) => {
    const course = await page.evaluate(() => State.getCourse(2));
    expect(course.name).toBe('2° Básico B');
  });
});
