/**
 * Super Admin Authentication View
 */
window.Views = window.Views || {};

Views.superAdminAuth = async function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <img src="assets/logo.png" alt="Logo">
        </div>
        <h1 class="auth-title">Super Admin</h1>
        <p style="color: var(--color-gray-500); margin-bottom: 2rem; font-size: 0.95rem;">Panel de Administración de Plataforma</p>

        <form id="superAdminLoginForm">
          <div class="form-group">
            <label class="form-label" for="email">Correo electrónico</label>
            <input type="email" id="email" name="email" class="form-input" required autocomplete="email" placeholder="admin@ejemplo.com">
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Contraseña</label>
            <input type="password" id="password" name="password" class="form-input" required autocomplete="current-password" placeholder="••••••••">
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="loginBtn">
            Iniciar Sesión
          </button>
        </form>

        <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--color-gray-200);">
          <a href="#/auth" style="color: var(--color-primary); text-decoration: none; font-size: 0.9rem;">← Volver al login de usuarios</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('superAdminLoginForm');
  const loginBtn = document.getElementById('loginBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      Components.showToast('Complete todos los campos', 'error');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Iniciando sesión...';

    try {
      await SuperAdminAPI.login(email, password);
      Components.showToast('Inicio de sesión exitoso', 'success');
      Router.navigate('/super-admin/dashboard');
    } catch (error) {
      Components.showToast(error.message, 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Iniciar Sesión';
    }
  });
};
