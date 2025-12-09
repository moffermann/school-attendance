import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Teacher PWA
 */
export class TeacherPWAPage {
  readonly page: Page;

  // Header
  readonly header: Locator;
  readonly teacherName: Locator;
  readonly onlineIndicator: Locator;

  // Course cards
  readonly courseCards: Locator;

  // Actions
  readonly quickAttendanceButton: Locator;
  readonly settingsButton: Locator;
  readonly logoutButton: Locator;

  // Bottom navigation
  readonly bottomNav: Locator;
  readonly coursesTab: Locator;
  readonly rosterTab: Locator;
  readonly alertsTab: Locator;
  readonly historyTab: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.header = page.locator('main');
    this.teacherName = page.getByRole('heading', { level: 2 });
    this.onlineIndicator = page.getByText('Online');

    // Course cards
    this.courseCards = page.locator('main').locator('[class*="course"], [class*="card"]').filter({ hasText: /\d+º/ });

    // Actions
    this.quickAttendanceButton = page.getByRole('button', { name: /Tomar Asistencia/ });
    this.settingsButton = page.getByRole('button', { name: /Configuración/ });
    this.logoutButton = page.getByRole('button', { name: /Cerrar Sesión/ });

    // Bottom navigation
    this.bottomNav = page.locator('nav').last();
    this.coursesTab = page.getByRole('link', { name: /Cursos/ });
    this.rosterTab = page.getByRole('link', { name: /Nómina/ });
    this.alertsTab = page.getByRole('link', { name: /Alertas/ });
    this.historyTab = page.getByRole('link', { name: /Historial/ });
  }

  /**
   * Navigate to teacher PWA
   */
  async goto() {
    await this.page.goto('/teacher');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get number of assigned courses
   */
  async getCourseCount(): Promise<number> {
    return await this.courseCards.count();
  }

  /**
   * Select a course by index
   */
  async selectCourse(index: number = 0) {
    await this.courseCards.nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to roster
   */
  async goToRoster() {
    await this.rosterTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to alerts
   */
  async goToAlerts() {
    await this.alertsTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to history
   */
  async goToHistory() {
    await this.historyTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Start quick attendance
   */
  async startQuickAttendance() {
    await this.quickAttendanceButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Logout
   */
  async logout() {
    await this.logoutButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Assert teacher is logged in
   */
  async assertLoggedIn(teacherName?: string) {
    await expect(this.teacherName).toBeVisible();
    if (teacherName) {
      await expect(this.teacherName).toContainText(teacherName);
    }
  }

  /**
   * Assert online status
   */
  async assertOnline() {
    await expect(this.onlineIndicator).toBeVisible();
  }

  /**
   * Assert course is displayed
   */
  async assertCourseDisplayed(courseName: string) {
    await expect(this.page.getByText(courseName)).toBeVisible();
  }
}

/**
 * Page Object for Teacher Roster View
 */
export class TeacherRosterPage {
  readonly page: Page;

  // Student list
  readonly studentRows: Locator;

  // Actions
  readonly inButtons: Locator;
  readonly outButtons: Locator;

  constructor(page: Page) {
    this.page = page;

    // Student list - rows with student names
    this.studentRows = page.locator('main').locator('> div').filter({ hasText: /Sin registro|Ingreso|Salió/ });

    // Action buttons
    this.inButtons = page.getByRole('button', { name: 'IN' });
    this.outButtons = page.getByRole('button', { name: 'OUT' });
  }

  /**
   * Get student count in roster
   */
  async getStudentCount(): Promise<number> {
    return await this.studentRows.count();
  }

  /**
   * Register entry for student by index
   */
  async registerEntry(studentIndex: number) {
    await this.inButtons.nth(studentIndex).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Register exit for student by index
   */
  async registerExit(studentIndex: number) {
    await this.outButtons.nth(studentIndex).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Assert student is in roster
   */
  async assertStudentInRoster(name: string) {
    await expect(this.page.getByText(name)).toBeVisible();
  }
}
