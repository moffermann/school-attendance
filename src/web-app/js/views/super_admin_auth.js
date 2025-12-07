/**
 * Super Admin Authentication View
 */
const Views = Views || {};

Views.superAdminAuth = async function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-container">
        <div class="auth-header">
          <img src="assets/logo.svg" alt="Logo" class="auth-logo">
          <h1>Super Admin</h1>
          <p>Panel de Administración de Plataforma</p>
        </div>

        <form id="superAdminLoginForm" class="auth-form">
          <div class="form-group">
            <label for="email">Correo electrónico</label>
            <input type="email" id="email" name="email" required autocomplete="email" placeholder="admin@ejemplo.com">
          </div>

          <div class="form-group">
            <label for="password">Contraseña</label>
            <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••">
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="loginBtn">
            Iniciar Sesión
          </button>
        </form>

        <div class="auth-footer">
          <a href="#/auth" class="auth-link">Volver al login de usuarios</a>
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
