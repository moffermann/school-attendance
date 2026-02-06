/**
 * Web App - API Client Unit Tests
 */
import { test, expect } from '@playwright/test';

test.describe('API Client', () => {
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

  test('API should be defined', async ({ page }) => {
    const apiExists = await page.evaluate(() => typeof API !== 'undefined');
    expect(apiExists).toBeTruthy();
  });

  test('API.baseUrl should return default URL', async ({ page }) => {
    const baseUrl = await page.evaluate(() => API.baseUrl);
    expect(baseUrl).toBe('/api/v1');
  });

  test('API.baseUrl should be configurable via localStorage', async ({ page }) => {
    const baseUrl = await page.evaluate(() => {
      localStorage.setItem('webAppConfig', JSON.stringify({ apiUrl: '/custom/api' }));
      return API.baseUrl;
    });
    expect(baseUrl).toBe('/custom/api');
  });

  test('API.isAuthenticated should return false when no token', async ({ page }) => {
    const isAuth = await page.evaluate(() => API.isAuthenticated());
    expect(isAuth).toBeFalsy();
  });

  test('API.isAuthenticated should return true when token exists', async ({ page }) => {
    const isAuth = await page.evaluate(() => {
      sessionStorage.setItem('accessToken', 'test-token');
      return API.isAuthenticated();
    });
    expect(isAuth).toBeTruthy();
  });

  test('API.accessToken getter should read from sessionStorage', async ({ page }) => {
    const token = await page.evaluate(() => {
      sessionStorage.setItem('accessToken', 'my-secret-token');
      return API.accessToken;
    });
    expect(token).toBe('my-secret-token');
  });

  test('API.accessToken setter should write to sessionStorage', async ({ page }) => {
    const token = await page.evaluate(() => {
      API.accessToken = 'new-token';
      return sessionStorage.getItem('accessToken');
    });
    expect(token).toBe('new-token');
  });

  test('API.accessToken setter should remove on null', async ({ page }) => {
    const token = await page.evaluate(() => {
      sessionStorage.setItem('accessToken', 'existing');
      API.accessToken = null;
      return sessionStorage.getItem('accessToken');
    });
    expect(token).toBeNull();
  });

  test('API.logout should clear tokens', async ({ page }) => {
    const result = await page.evaluate(() => {
      sessionStorage.setItem('accessToken', 'access');
      sessionStorage.setItem('refreshToken', 'refresh');
      API.logout();
      return {
        access: sessionStorage.getItem('accessToken'),
        refresh: sessionStorage.getItem('refreshToken')
      };
    });
    expect(result.access).toBeNull();
    expect(result.refresh).toBeNull();
  });

  test('API.refreshToken getter/setter should work', async ({ page }) => {
    const token = await page.evaluate(() => {
      API.refreshToken = 'my-refresh-token';
      return API.refreshToken;
    });
    expect(token).toBe('my-refresh-token');
  });
});

test.describe('API Security', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Tokens should be stored in sessionStorage not localStorage', async ({ page }) => {
    const result = await page.evaluate(() => {
      API.accessToken = 'session-token';
      return {
        sessionStorage: sessionStorage.getItem('accessToken'),
        localStorage: localStorage.getItem('accessToken')
      };
    });
    expect(result.sessionStorage).toBe('session-token');
    expect(result.localStorage).toBeNull();
  });
});
