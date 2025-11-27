/**
 * Shared fixtures and test data for E2E integration tests
 */

// Test users (must match seed data)
const TEST_USERS = {
  director: {
    email: 'director@example.com',
    password: 'secret123',
    role: 'DIRECTOR',
    name: 'Ana Directora',
  },
  inspector: {
    email: 'inspector@example.com',
    password: 'secret123',
    role: 'INSPECTOR',
    name: 'Pedro Inspector',
  },
  parent: {
    email: 'maria@example.com',
    password: 'secret123',
    role: 'PARENT',
    name: 'María González',
  },
  teacher: {
    email: 'profesor@example.com',
    password: 'secret123',
    role: 'TEACHER',
    name: 'Carlos Profesor',
  },
};

// Test courses (must match seed data)
const TEST_COURSES = [
  { name: '1° Básico A', grade: '1A' },
  { name: '2° Básico B', grade: '2B' },
];

// Test students (must match seed data)
const TEST_STUDENTS = [
  { name: 'Sofía González', course: '1° Básico A' },
  { name: 'Matías Pérez', course: '1° Básico A' },
  { name: 'Isidora López', course: '2° Básico B' },
];

/**
 * Login helper - performs login and returns auth token
 * The web app has a server-side login at /login, then redirects to the SPA at /
 * @param {import('@playwright/test').Page} page
 * @param {keyof typeof TEST_USERS} userType
 */
async function login(page, userType) {
  const user = TEST_USERS[userType];
  if (!user) throw new Error(`Unknown user type: ${userType}`);

  // Go to /login for the server-rendered login form
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Wait for login form to be visible
  const emailField = page.locator('#email');
  await emailField.waitFor({ state: 'visible', timeout: 5000 });

  // Clear and fill email
  await emailField.clear();
  await emailField.fill(user.email);

  // Fill password
  const passwordField = page.locator('#password');
  await passwordField.clear();
  await passwordField.fill(user.password);

  // Submit
  await page.click('button[type="submit"], input[type="submit"], button:has-text("Ingresar"), button:has-text("Entrar")');

  // Wait for redirect to main app (will land on / with session)
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');

  return user;
}

/**
 * Logout helper
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
  // Try clicking logout button/link
  const logoutBtn = page.locator('a:has-text("Salir"), button:has-text("Salir"), a:has-text("Cerrar sesión"), button:has-text("Cerrar sesión")');
  if (await logoutBtn.count() > 0) {
    await logoutBtn.first().click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
  } else {
    // Fallback: clear cookies and navigate to login
    await page.context().clearCookies();
    await page.goto('/login');
  }
}

/**
 * API helper - make authenticated API request
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} token
 * @param {string} method
 * @param {string} endpoint
 * @param {object} [data]
 */
async function apiRequest(request, token, method, endpoint, data) {
  const options = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.data = data;
  }

  const baseUrl = process.env.E2E_BASE_URL || 'https://school-attendance.dev.gocode.cl';
  const url = `${baseUrl}${endpoint}`;

  switch (method.toUpperCase()) {
    case 'GET':
      return request.get(url, options);
    case 'POST':
      return request.post(url, options);
    case 'PUT':
      return request.put(url, options);
    case 'DELETE':
      return request.delete(url, options);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

/**
 * Wait for toast notification
 * @param {import('@playwright/test').Page} page
 * @param {string} text - Text to look for in toast
 * @param {number} timeout - Timeout in ms
 */
async function waitForToast(page, text, timeout = 5000) {
  const toast = page.locator('.toast, [role="alert"], .notification').filter({ hasText: text });
  await toast.waitFor({ state: 'visible', timeout });
  return toast;
}

module.exports = {
  TEST_USERS,
  TEST_COURSES,
  TEST_STUDENTS,
  login,
  logout,
  apiRequest,
  waitForToast,
};
