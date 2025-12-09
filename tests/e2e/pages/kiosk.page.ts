import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Kiosk Application
 */
export class KioskPage {
  readonly page: Page;

  // Status indicators
  readonly nfcStatus: Locator;
  readonly qrStatus: Locator;

  // Main actions
  readonly biometricButton: Locator;

  // Scan result
  readonly studentName: Locator;
  readonly eventType: Locator;

  constructor(page: Page) {
    this.page = page;

    // Status indicators
    this.nfcStatus = page.getByText(/NFC/);
    this.qrStatus = page.getByText(/QR/);

    // Main actions
    this.biometricButton = page.getByRole('button', { name: /huella digital|fingerprint/i });

    // Scan result
    this.studentName = page.locator('.student-name, [class*="welcome"]');
    this.eventType = page.locator('.event-type, [class*="entry"], [class*="exit"]');
  }

  /**
   * Navigate to kiosk home
   */
  async goto() {
    await this.page.goto('/kiosk');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to kiosk settings
   */
  async goToSettings() {
    await this.page.goto('/kiosk/#/settings');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Simulate token scan (manual input)
   */
  async scanToken(token: string) {
    // The kiosk might have a hidden input or listen for keyboard input
    await this.page.keyboard.type(token);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Click biometric authentication button
   */
  async startBiometricAuth() {
    await this.biometricButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Assert QR scanner is active
   */
  async assertQRActive() {
    await expect(this.qrStatus).toContainText('Activo');
  }

  /**
   * Assert NFC status
   */
  async assertNFCStatus(status: 'available' | 'unavailable') {
    if (status === 'available') {
      await expect(this.nfcStatus).toContainText('Activo');
    } else {
      await expect(this.nfcStatus).toContainText('No disponible');
    }
  }

  /**
   * Assert scan result shows student name
   */
  async assertScanResult(studentName: string) {
    await expect(this.page.getByText(studentName)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Assert entry registration
   */
  async assertEntryRegistered() {
    await expect(this.page.getByText(/Bienvenido|Ingreso/i)).toBeVisible();
  }

  /**
   * Assert exit registration
   */
  async assertExitRegistered() {
    await expect(this.page.getByText(/Hasta mañana|Salida/i)).toBeVisible();
  }
}

/**
 * Page Object for Kiosk Settings
 */
export class KioskSettingsPage {
  readonly page: Page;

  // Form fields
  readonly gateIdInput: Locator;
  readonly deviceIdInput: Locator;
  readonly languageSelect: Locator;
  readonly photoCaptureCheckbox: Locator;

  // Actions
  readonly saveButton: Locator;
  readonly loadDemoDataButton: Locator;
  readonly generateDeviceIdButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form fields
    this.gateIdInput = page.getByLabel(/Gate ID/i);
    this.deviceIdInput = page.getByLabel(/Device ID/i);
    this.languageSelect = page.getByRole('combobox', { name: /idioma|language/i });
    this.photoCaptureCheckbox = page.getByRole('checkbox', { name: /foto|photo/i });

    // Actions
    this.saveButton = page.getByRole('button', { name: /Guardar|Save/i });
    this.loadDemoDataButton = page.getByRole('button', { name: /Cargar Datos|Load Demo/i });
    this.generateDeviceIdButton = page.getByRole('button', { name: /Generar|Generate/i });
  }

  /**
   * Configure kiosk settings
   */
  async configure(options: {
    gateId?: string;
    deviceId?: string;
    enablePhoto?: boolean;
  }) {
    if (options.gateId) {
      await this.gateIdInput.fill(options.gateId);
    }
    if (options.deviceId) {
      await this.deviceIdInput.fill(options.deviceId);
    }
    if (options.enablePhoto !== undefined) {
      const isChecked = await this.photoCaptureCheckbox.isChecked();
      if (isChecked !== options.enablePhoto) {
        await this.photoCaptureCheckbox.click();
      }
    }
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Load demo data
   */
  async loadDemoData() {
    await this.loadDemoDataButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Generate device ID
   */
  async generateDeviceId() {
    await this.generateDeviceIdButton.click();
    const deviceId = await this.deviceIdInput.inputValue();
    return deviceId;
  }
}
