/**
 * Service Worker E2E Tests
 */
import { test, expect } from '@playwright/test';

/**
 * Service Worker E2E Tests
 *
 * Verifies that:
 * 1. Service worker registers successfully
 * 2. All critical resources are cached
 * 3. App works offline after initial load
 */

// Helper to wait for service worker to be ready
async function waitForServiceWorker(page, timeout = 15000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await page.evaluate(() => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      if (navigator.serviceWorker.controller) return 'controlled';

      // Check registrations
      return navigator.serviceWorker.getRegistrations().then(regs => {
        if (regs.length > 0 && regs[0].active) return 'active';
        if (regs.length > 0) return 'registered';
        return 'none';
      });
    });

    if (status === 'controlled' || status === 'active') {
      return status;
    }

    await page.waitForTimeout(500);
  }

  return 'timeout';
}

test.describe('Service Worker', () => {
  test('should register successfully', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for service worker to register
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { supported: false };
      }

      try {
        // Wait up to 10 seconds for registration
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 10000)
          )
        ]);
        return {
          supported: true,
          registered: !!registration,
          scope: registration.scope,
        };
      } catch (e) {
        return { supported: true, registered: false, error: e.message };
      }
    });

    expect(swRegistered.supported).toBe(true);
    expect(swRegistered.registered).toBe(true);
  });

  test('should cache all critical JS files', async ({ page }) => {
    await page.goto('/');

    // Wait for SW to be active
    const swStatus = await waitForServiceWorker(page);
    expect(swStatus).not.toBe('timeout');
    expect(swStatus).not.toBe('unsupported');

    // Check which files are cached
    const cachedFiles = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const allCached = [];

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        allCached.push(...keys.map(r => new URL(r.url).pathname));
      }

      return allCached;
    });

    // Critical JS files that MUST be cached
    const criticalJsFiles = [
      '/js/state.js',
      '/js/router.js',
      '/js/ui.js',
      '/js/sync.js',
      '/js/views/home.js',
      '/js/views/admin_panel.js',  // This is the missing one!
      '/js/views/scan_result.js',
      '/js/views/settings.js',
      '/js/views/queue.js',
    ];

    const missingFiles = criticalJsFiles.filter(f => !cachedFiles.includes(f));

    if (missingFiles.length > 0) {
      console.log('Missing from cache:', missingFiles);
      console.log('Cached files:', cachedFiles.filter(f => f.includes('.js')));
    }

    expect(missingFiles).toEqual([]);
  });

  test('should cache all critical data files', async ({ page }) => {
    await page.goto('/');

    // Wait for SW to be active
    const swStatus = await waitForServiceWorker(page);
    expect(swStatus).not.toBe('timeout');
    expect(swStatus).not.toBe('unsupported');

    const cachedFiles = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const allCached = [];

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        allCached.push(...keys.map(r => new URL(r.url).pathname));
      }

      return allCached;
    });

    // Critical data files that MUST be cached
    const criticalDataFiles = [
      '/data/students.json',
      '/data/tags.json',
      '/data/teachers.json',  // This is missing!
      '/data/device.json',
      '/data/config.json',
    ];

    const missingFiles = criticalDataFiles.filter(f => !cachedFiles.includes(f));

    if (missingFiles.length > 0) {
      console.log('Missing data files from cache:', missingFiles);
    }

    expect(missingFiles).toEqual([]);
  });

  test('should work offline after initial load', async ({ page, context }) => {
    // First, load the page online to populate cache
    await page.goto('/');

    // Wait for SW to be active and cache populated
    const swStatus = await waitForServiceWorker(page);
    expect(swStatus).not.toBe('timeout');

    // Wait a bit for cache to populate
    await page.waitForTimeout(2000);

    // Go offline
    await context.setOffline(true);

    // Try to navigate/reload
    await page.reload();

    // Should still see the app
    const appElement = await page.$('#app');
    expect(appElement).not.toBeNull();

    // Should have the scanner container or settings (depending on config state)
    const hasContent = await page.evaluate(() => {
      const app = document.getElementById('app');
      return app && app.innerHTML.length > 100;
    });

    expect(hasContent).toBe(true);

    // Go back online for cleanup
    await context.setOffline(false);
  });

  test('should cache admin panel for offline access', async ({ page, context }) => {
    // Load home first
    await page.goto('/');

    // Wait for SW
    const swStatus = await waitForServiceWorker(page);
    expect(swStatus).not.toBe('timeout');

    await page.waitForTimeout(1000);

    // Navigate to admin panel (simulating teacher access)
    await page.goto('/#/admin-panel');
    await page.waitForTimeout(500);

    // Go offline
    await context.setOffline(true);

    // Reload admin panel
    await page.reload();

    // Should still render admin panel content
    const hasAdminContent = await page.evaluate(() => {
      const app = document.getElementById('app');
      // Check for admin panel specific content
      return app && (
        app.innerHTML.includes('Panel de Administración') ||
        app.innerHTML.includes('admin-menu')
      );
    });

    // This test will fail if admin_panel.js is not cached
    expect(hasAdminContent).toBe(true);

    await context.setOffline(false);
  });
});
