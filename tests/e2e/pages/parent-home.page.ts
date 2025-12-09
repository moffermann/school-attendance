import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Parent Home View
 */
export class ParentHomePage {
  readonly page: Page;

  // Header
  readonly header: Locator;
  readonly logoutButton: Locator;

  // Children cards
  readonly childrenCards: Locator;
  readonly dateDisplay: Locator;

  // Navigation
  readonly bottomNav: Locator;
  readonly prefsLink: Locator;
  readonly absencesLink: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.header = page.getByRole('banner');
    this.logoutButton = page.getByRole('button', { name: 'Cerrar sesión' });

    // Children cards
    this.childrenCards = page.locator('main').locator('> div').filter({ hasText: /Ver Historial/ });
    this.dateDisplay = page.getByText(/Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo/);

    // Navigation
    this.bottomNav = page.getByRole('navigation', { name: 'Navegación móvil' });
    this.prefsLink = page.getByRole('link', { name: 'Preferencias de Notificación' });
    this.absencesLink = page.getByRole('link', { name: 'Solicitar Ausencia' });
  }

  /**
   * Navigate to parent home
   */
  async goto() {
    await this.page.goto('/app/#/parent/home');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get number of children displayed
   */
  async getChildrenCount(): Promise<number> {
    return await this.childrenCards.count();
  }

  /**
   * Get child names
   */
  async getChildNames(): Promise<string[]> {
    const names: string[] = [];
    const count = await this.childrenCards.count();
    for (let i = 0; i < count; i++) {
      const card = this.childrenCards.nth(i);
      // Get the name from the card (first text after the initial)
      const text = await card.textContent();
      if (text) {
        // Extract name pattern: single letter followed by name
        const match = text.match(/^[A-Z]\s*([A-Za-záéíóúñÁÉÍÓÚÑ\s]+)/);
        if (match) {
          names.push(match[1].trim().split('\n')[0]);
        }
      }
    }
    return names;
  }

  /**
   * Click view history for a specific child
   */
  async viewHistoryFor(childIndex: number = 0) {
    const historyLinks = this.page.getByRole('link', { name: 'Ver Historial' });
    await historyLinks.nth(childIndex).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to preferences
   */
  async goToPreferences() {
    await this.prefsLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to absences
   */
  async goToAbsences() {
    await this.absencesLink.click();
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
   * Assert children are displayed
   */
  async assertChildrenVisible() {
    await expect(this.childrenCards.first()).toBeVisible();
  }

  /**
   * Assert specific child is displayed
   */
  async assertChildDisplayed(name: string) {
    await expect(this.page.getByText(name)).toBeVisible();
  }

  /**
   * Get status for a child
   */
  async getChildStatus(childIndex: number = 0): Promise<string> {
    const card = this.childrenCards.nth(childIndex);
    const statusText = await card.textContent();

    if (statusText?.includes('Ingresó')) return 'in';
    if (statusText?.includes('Salió')) return 'out';
    if (statusText?.includes('Aún no registra')) return 'pending';
    return 'unknown';
  }
}
