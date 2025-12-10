/**
 * Login App - Unified Authentication
 * Handles login and app selection based on user role
 */

// Create API client
const API = createApiClient('loginAppConfig');

// App access permissions by role
const APP_ACCESS = {
  SUPER_ADMIN: ['/app', '/teacher', '/kiosk'],  // Super admin has access to all
  ADMIN: ['/app', '/teacher', '/kiosk'],
  DIRECTOR: ['/app', '/teacher', '/kiosk'],
  INSPECTOR: ['/app', '/kiosk'],
  TEACHER: ['/teacher', '/kiosk'],
  PARENT: ['/app']
};

// App information for selector
const APP_INFO = {
  '/app': {
    name: 'Panel Administrativo',
    icon: '🏫',
    iconClass: 'admin',
    description: 'Gestion de asistencia, reportes y configuracion'
  },
  '/teacher': {
    name: 'Portal Profesores',
    icon: '👨‍🏫',
    iconClass: 'teacher',
    description: 'Toma de asistencia en sala de clases'
  },
  '/kiosk': {
    name: 'Modo Kiosco',
    icon: '📱',
    iconClass: 'kiosk',
    description: 'Registro de entrada y salida de estudiantes'
  }
};

// Role display names
const ROLE_NAMES = {
  SUPER_ADMIN: 'Super Administrador',
  ADMIN: 'Administrador',
  DIRECTOR: 'Director',
  INSPECTOR: 'Inspector',
  TEACHER: 'Profesor',
  PARENT: 'Apoderado'
};

// State
let currentUser = null;
let tokens = null;

/**
 * Decode JWT token to get payload
 */
function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT:', e);
    return null;
  }
}

/**
 * Get initials from name
 */
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * Redirect to app with tokens
 */
function redirectToApp(path, accessToken, refreshToken) {
  // Use hash fragment to pass tokens (secure - not sent to server)
  window.location.href = `${path}#token=${accessToken}&refresh=${refreshToken}`;
}

/**
 * Try login with super admin endpoint first, then regular endpoint
 * The role is determined by the backend based on the user's role in the database
 */
async function tryLogin(email, password) {
  // First try super admin login
  try {
    const response = await fetch('/api/v1/super-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      const data = await response.json();
      // Super admin token has typ: "super_admin"
      return { data, isSuperAdmin: true };
    }
  } catch (e) {
    // Super admin login failed, try regular login
  }

  // Try regular tenant login
  const data = await API.login(email, password);
  return { data, isSuperAdmin: false };
}

/**
 * Render login form
 */
function renderLoginForm() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">🏫</div>
        <h1 class="auth-title">Sistema de Asistencia</h1>
        <p class="auth-subtitle">Ingresa tus credenciales para continuar</p>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Correo electronico</label>
            <input type="email" id="login-email" class="form-input"
                   placeholder="tu@correo.cl" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Contrasena</label>
            <input type="password" id="login-password" class="form-input"
                   placeholder="Tu contrasena" required autocomplete="current-password">
          </div>
          <div id="login-error" class="error-message"></div>
          <button type="submit" class="btn btn-primary btn-block" id="login-btn">
            Iniciar Sesion
          </button>
        </form>
      </div>
      <p class="auth-footer">Sistema de Control de Asistencia Escolar</p>
    </div>
  `;

  // Setup form handler
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  // Clear previous error
  errorDiv.classList.remove('show');
  errorDiv.textContent = '';

  // Disable button
  btn.disabled = true;
  btn.textContent = 'Iniciando sesion...';

  try {
    // Try login (will try super admin first, then regular)
    const { data, isSuperAdmin } = await tryLogin(email, password);

    // Decode token to get role
    const payload = decodeJWT(data.access_token);

    // Determine role from token
    let role;
    if (isSuperAdmin || payload.typ === 'super_admin') {
      role = 'SUPER_ADMIN';
    } else {
      role = payload.role || 'PARENT';
    }

    currentUser = {
      full_name: payload.full_name || email.split('@')[0],
      role: role,
      email: email
    };

    tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token
    };

    // Check next parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const nextUrl = urlParams.get('next');

    // Determine available apps for this role
    const availableApps = APP_ACCESS[currentUser.role] || ['/app'];

    // If only one app available or PARENT, redirect directly
    if (currentUser.role === 'PARENT') {
      redirectToApp('/app', tokens.access_token, tokens.refresh_token);
      return;
    }

    // If next URL is valid for this role, redirect there
    if (nextUrl && availableApps.includes(nextUrl)) {
      redirectToApp(nextUrl, tokens.access_token, tokens.refresh_token);
      return;
    }

    // Show app selector
    renderAppSelector();

  } catch (error) {
    console.error('Login error:', error);
    // Handle different error formats
    let errorMessage = 'Error al iniciar sesion';
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && error.message) {
      errorMessage = error.message;
    } else if (error && error.detail) {
      // Handle FastAPI validation errors
      if (Array.isArray(error.detail)) {
        errorMessage = error.detail.map(d => d.msg).join(', ');
      } else {
        errorMessage = error.detail;
      }
    }
    errorDiv.textContent = errorMessage;
    errorDiv.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Iniciar Sesion';
  }
}

/**
 * Render app selector
 */
function renderAppSelector() {
  const availableApps = APP_ACCESS[currentUser.role] || ['/app'];

  const appCards = availableApps.map(path => {
    const info = APP_INFO[path];
    return `
      <div class="app-card" onclick="selectApp('${path}')">
        <div class="app-icon ${info.iconClass}">${info.icon}</div>
        <div class="app-info">
          <div class="app-name">${info.name}</div>
          <div class="app-description">${info.description}</div>
        </div>
        <div class="app-arrow">→</div>
      </div>
    `;
  }).join('');

  // Add super admin panel link if super admin
  let superAdminCard = '';
  if (currentUser.role === 'SUPER_ADMIN') {
    superAdminCard = `
      <div class="app-card" onclick="selectApp('/app#/super-admin/dashboard')">
        <div class="app-icon super-admin">⚡</div>
        <div class="app-info">
          <div class="app-name">Panel Super Admin</div>
          <div class="app-description">Gestion de tenants y configuracion global</div>
        </div>
        <div class="app-arrow">→</div>
      </div>
    `;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="user-info">
          <div class="user-avatar">${getInitials(currentUser.full_name)}</div>
          <div class="user-details">
            <div class="user-name">${currentUser.full_name}</div>
            <div class="user-role">${ROLE_NAMES[currentUser.role] || currentUser.role}</div>
          </div>
          <button class="btn-logout" onclick="handleLogout()">Salir</button>
        </div>

        <h2 class="app-selector-title">Selecciona una aplicacion</h2>
        <p class="app-selector-subtitle">Elige a cual sistema deseas acceder</p>

        <div class="app-grid">
          ${appCards}
          ${superAdminCard}
        </div>
      </div>
      <p class="auth-footer">Sistema de Control de Asistencia Escolar</p>
    </div>
  `;
}

/**
 * Select an app and redirect
 */
function selectApp(path) {
  if (!tokens) {
    renderLoginForm();
    return;
  }

  // Handle super admin panel special case
  if (path.includes('#')) {
    const [basePath, hash] = path.split('#');
    window.location.href = `${basePath}#token=${tokens.access_token}&refresh=${tokens.refresh_token}&redirect=${hash}`;
  } else {
    redirectToApp(path, tokens.access_token, tokens.refresh_token);
  }
}

/**
 * Handle logout
 */
function handleLogout() {
  currentUser = null;
  tokens = null;
  API.logout();
  renderLoginForm();
}

/**
 * Initialize app
 */
function init() {
  // Check if already has valid tokens in session
  if (API.isAuthenticated()) {
    const token = API.accessToken;
    const payload = decodeJWT(token);

    if (payload && payload.exp * 1000 > Date.now()) {
      // Token still valid - determine role from token
      let role;
      if (payload.typ === 'super_admin') {
        role = 'SUPER_ADMIN';
      } else {
        role = payload.role || 'PARENT';
      }

      currentUser = {
        full_name: payload.full_name || 'Usuario',
        role: role,
        email: ''
      };
      tokens = {
        access_token: API.accessToken,
        refresh_token: API.refreshToken
      };

      // Check if PARENT, redirect directly
      if (currentUser.role === 'PARENT') {
        redirectToApp('/app', tokens.access_token, tokens.refresh_token);
        return;
      }

      renderAppSelector();
      return;
    }
  }

  // No valid session - show login
  renderLoginForm();
}

// Make functions available globally for onclick handlers
window.selectApp = selectApp;
window.handleLogout = handleLogout;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
