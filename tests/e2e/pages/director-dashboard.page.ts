import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Director Dashboard
 */
export class DirectorDashboardPage {
  readonly page: Page;

  // Stats cards
  readonly statsCards: Locator;
  readonly ingressCount: Locator;
  readonly egressCount: Locator;
  readonly lateCount: Locator;
  readonly noShowCount: Locator;

  // Filters
  readonly courseFilter: Locator;
  readonly eventTypeFilter: Locator;
  readonly searchInput: Locator;
  readonly applyFiltersButton: Locator;

  // Actions
  readonly exportCsvButton: Locator;
  readonly viewPhotosButton: Locator;

  // Events table
  readonly eventsTable: Locator;

  // Navigation
  readonly sidebar: Locator;

  constructor(page: Page) {
    this.page = page;

    // Stats cards - using text content
    this.statsCards = page.locator('main');
    this.ingressCount = page.getByText('INGRESOS HOY').locator('..').locator('text=/\\d+/');
    this.egressCount = page.getByText('SALIDAS HOY').locator('..').locator('text=/\\d+/');
    this.lateCount = page.getByText('ATRASOS').locator('..').locator('text=/\\d+/');
    this.noShowCount = page.getByText('SIN INGRESO').locator('..').locator('text=/\\d+/');

    // Filters
    this.courseFilter = page.getByRole('combobox').first();
    this.eventTypeFilter = page.getByRole('combobox').nth(1);
    this.searchInput = page.getByPlaceholder('Escriba un nombre...');
    this.applyFiltersButton = page.getByRole('button', { name: 'Aplicar Filtros' });

    // Actions
    this.exportCsvButton = page.getByRole('button', { name: 'Exportar CSV' });
    this.viewPhotosButton = page.getByRole('button', { name: /Ver Fotos/ });

    // Events table
    this.eventsTable = page.locator('table, .events-list');

    // Navigation
    this.sidebar = page.getByRole('navigation', { name: 'Navegación principal' });
  }

  /**
   * Navigate to dashboard
   */
  async goto() {
    await this.page.goto('/app/#/director/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get total student count from stats
   */
  async getStudentCount(): Promise<number> {
    const text = await this.noShowCount.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Filter by course
   */
  async filterByCourse(courseName: string) {
    await this.courseFilter.selectOption(courseName);
    await this.applyFiltersButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Filter by event type
   */
  async filterByEventType(type: 'Todos' | 'Ingreso' | 'Salida') {
    await this.eventTypeFilter.selectOption(type);
    await this.applyFiltersButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Search for student by name
   */
  async searchStudent(name: string) {
    await this.searchInput.fill(name);
    await this.applyFiltersButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to a section via sidebar
   */
  async navigateTo(section: string) {
    await this.sidebar.getByRole('menuitem', { name: section }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Export CSV
   */
  async exportCsv() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportCsvButton.click(),
    ]);
    return download;
  }

  /**
   * Assert stats are visible
   */
  async assertStatsVisible() {
    await expect(this.page.getByText('INGRESOS HOY')).toBeVisible();
    await expect(this.page.getByText('SALIDAS HOY')).toBeVisible();
    await expect(this.page.getByText('ATRASOS')).toBeVisible();
    await expect(this.page.getByText('SIN INGRESO')).toBeVisible();
  }

  /**
   * Assert no console errors
   */
  async assertNoConsoleErrors() {
    const errors: string[] = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await this.page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('401'))).toHaveLength(0);
  }
}
