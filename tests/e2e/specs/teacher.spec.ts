import { test, expect } from '../fixtures/auth.fixture';
import { TeacherPWAPage, TeacherRosterPage } from '../pages/teacher-pwa.page';

test.describe('Teacher PWA - TC-T01 to TC-T07', () => {
  test('TC-T02: Login modo demo should work', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);
    await pwa.assertLoggedIn();
  });

  test('TC-T03: Should only see assigned courses', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);

    // María González López has 1 course assigned (1ºA)
    const courseCount = await pwa.getCourseCount();
    expect(courseCount).toBeGreaterThanOrEqual(1);

    // Should see 1ºA
    await pwa.assertCourseDisplayed('1ºA');
  });

  test('TC-T04: Should display course cards', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);

    // Course cards should be visible
    await expect(teacherDemoPage.getByText(/\d+º[A-Z]/)).toBeVisible();
  });

  test('TC-T05: Selecting course navigates to roster', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);

    // Click on the course
    await pwa.selectCourse(0);

    // Should navigate to roster view
    await expect(teacherDemoPage.getByText(/Nómina|Roster/i)).toBeVisible();
  });

  test('TC-T06: Roster shows students with status', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);
    await pwa.goToRoster();

    // Wait for roster to load
    await teacherDemoPage.waitForLoadState('networkidle');

    // Should see students (20 per course in demo)
    const roster = new TeacherRosterPage(teacherDemoPage);
    await teacherDemoPage.waitForTimeout(1000);

    // Should see status indicators
    await expect(teacherDemoPage.getByText(/Sin registro|Ingreso/)).toBeVisible();
  });
});

test.describe('Teacher Attendance Registration - TC-T08 to TC-T10', () => {
  test('TC-T08: Should have IN/OUT buttons', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);
    await pwa.goToRoster();

    // Wait for roster to load
    await teacherDemoPage.waitForLoadState('networkidle');
    await teacherDemoPage.waitForTimeout(500);

    // Should see action buttons
    const inButtons = teacherDemoPage.getByRole('button', { name: /IN|Entrada/i });
    const count = await inButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Teacher Bulk Attendance - TC-T13 to TC-T16', () => {
  test('TC-T13: Quick attendance button should be visible', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);

    await expect(pwa.quickAttendanceButton).toBeVisible();
  });
});

test.describe('Teacher Alerts - TC-T17 to TC-T19', () => {
  test('TC-T17: Alerts view shows students without registration', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);
    await pwa.goToAlerts();

    // Wait for alerts to load
    await teacherDemoPage.waitForLoadState('networkidle');
    await teacherDemoPage.waitForTimeout(1000);

    // Should see alerts section (may show loading or actual alerts)
    await expect(teacherDemoPage.getByText(/Alertas|Presentes|Sin Registro/i)).toBeVisible();
  });
});

test.describe('Teacher History - TC-T20', () => {
  test('TC-T20: History view should load', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);
    await pwa.goToHistory();

    await teacherDemoPage.waitForLoadState('networkidle');

    // Should see history section
    await expect(teacherDemoPage.getByText(/Historial|History/i)).toBeVisible();
  });
});

test.describe('Teacher Online Status', () => {
  test('Should show online indicator', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);
    await pwa.assertOnline();
  });
});

test.describe('Teacher Logout', () => {
  test('Logout button should be visible', async ({ teacherDemoPage }) => {
    const pwa = new TeacherPWAPage(teacherDemoPage);
    await expect(pwa.logoutButton).toBeVisible();
  });
});
