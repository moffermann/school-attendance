/**
 * Tenant Admin Setup View
 * Used when tenant admin clicks the invitation email link to set up their password
 */
const Views = Views || {};

Views.tenantAdminSetup = async function() {
  const app = document.getElementById('app');

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const token = urlParams.get('token');

  if (!token) {
    app.innerHTML = `
      <div class="setup-page">
        <div class="setup-container error">
          <h1>Enlace Inválido</h1>
          <p>El enlace de invitación no es válido o ha expirado.</p>
          <p>Contacte al administrador de la plataforma para solicitar un nuevo enlace.</p>
          <a href="#/auth" class="btn btn-primary">Ir a Inicio de Sesión</a>
        </div>
      </div>
    `;
    return;
  }

  // Verify token first
  app.innerHTML = `
    <div class="setup-page">
      <div class="setup-container">
        ${Components.createLoader('Verificando invitación...')}
      </div>
    </div>
  `;

  let tokenData = null;

  try {
    const response = await fetch(`/api/v1/tenant-setup/validate-token?token=${encodeURIComponent(token)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Token inválido' }));
      throw new Error(error.detail || 'Token inválido o expirado');
    }
    tokenData = await response.json();
  } catch (error) {
    app.innerHTML = `
      <div class="setup-page">
        <div class="setup-container error">
          <h1>Enlace Inválido</h1>
          <p>${Components.escapeHtml(error.message)}</p>
          <p>Contacte al administrador de la plataforma para solicitar un nuevo enlace.</p>
          <a href="#/auth" class="btn btn-primary">Ir a Inicio de Sesión</a>
        </div>
      </div>
    `;
    return;
  }

  // Show setup form
  app.innerHTML = `
    <div class="setup-page">
      <div class="setup-container">
        <div class="setup-header">
          <img src="assets/logo.svg" alt="Logo" class="setup-logo">
          <h1>Configurar Cuenta</h1>
          <p>Bienvenido a <strong>${Components.escapeHtml(tokenData.tenant_name)}</strong></p>
          <p class="setup-email">${Components.escapeHtml(tokenData.email)}</p>
        </div>

        <form id="setupForm" class="setup-form">
          <div class="form-group">
            <label for="fullName">Nombre Completo</label>
            <input type="text" id="fullName" name="fullName" required
                   value="${Components.escapeHtml(tokenData.admin_name || '')}"
                   placeholder="Su nombre completo">
          </div>

          <div class="form-group">
            <label for="password">Contraseña</label>
            <input type="password" id="password" name="password" required
                   minlength="8" placeholder="Mínimo 8 caracteres"
                   autocomplete="new-password">
            <div class="password-requirements">
              <div class="requirement" id="reqLength">Al menos 8 caracteres</div>
              <div class="requirement" id="reqUpper">Una letra mayúscula</div>
              <div class="requirement" id="reqLower">Una letra minúscula</div>
              <div class="requirement" id="reqNumber">Un número</div>
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmar Contraseña</label>
            <input type="password" id="confirmPassword" name="confirmPassword" required
                   placeholder="Repita la contraseña"
                   autocomplete="new-password">
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="setupBtn">
            Crear Cuenta
          </button>
        </form>
      </div>
    </div>

    <style>
      .setup-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-secondary, #f3f4f6);
        padding: 2rem;
      }
      .setup-container {
        background: white;
        padding: 2.5rem;
        border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.1);
        width: 100%;
        max-width: 420px;
      }
      .setup-container.error {
        text-align: center;
      }
      .setup-container.error h1 {
        color: var(--error, #dc2626);
      }
      .setup-header {
        text-align: center;
        margin-bottom: 2rem;
      }
      .setup-logo {
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
      }
      .setup-header h1 {
        margin: 0 0 0.5rem 0;
        font-size: 1.5rem;
      }
      .setup-header p {
        color: var(--text-secondary, #6b7280);
        margin: 0.25rem 0;
      }
      .setup-email {
        font-weight: 500;
        color: var(--primary, #3b82f6) !important;
      }
      .setup-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .form-group label {
        font-weight: 500;
        font-size: 0.875rem;
      }
      .form-group input {
        padding: 0.75rem 1rem;
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 8px;
        font-size: 1rem;
      }
      .form-group input:focus {
        outline: none;
        border-color: var(--primary, #3b82f6);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      .password-requirements {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.25rem;
        font-size: 0.75rem;
        margin-top: 0.5rem;
      }
      .requirement {
        color: var(--text-secondary, #9ca3af);
        padding-left: 1.25rem;
        position: relative;
      }
      .requirement::before {
        content: '○';
        position: absolute;
        left: 0;
      }
      .requirement.valid {
        color: var(--success, #10b981);
      }
      .requirement.valid::before {
        content: '✓';
      }
      .btn-block {
        width: 100%;
        padding: 0.875rem;
        font-size: 1rem;
      }
    </style>
  `;

  // Password validation
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPassword');

  passwordInput.addEventListener('input', () => {
    const pwd = passwordInput.value;
    document.getElementById('reqLength').classList.toggle('valid', pwd.length >= 8);
    document.getElementById('reqUpper').classList.toggle('valid', /[A-Z]/.test(pwd));
    document.getElementById('reqLower').classList.toggle('valid', /[a-z]/.test(pwd));
    document.getElementById('reqNumber').classList.toggle('valid', /[0-9]/.test(pwd));
  });

  // Form submission
  const form = document.getElementById('setupForm');
  const setupBtn = document.getElementById('setupBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    // Validate
    if (password.length < 8) {
      Components.showToast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      Components.showToast('La contraseña debe incluir mayúsculas, minúsculas y números', 'error');
      return;
    }

    if (password !== confirmPassword) {
      Components.showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    setupBtn.disabled = true;
    setupBtn.textContent = 'Creando cuenta...';

    try {
      const response = await fetch('/api/v1/tenant-setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          full_name: fullName,
          password,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Error al crear cuenta' }));
        throw new Error(error.detail || 'Error al crear cuenta');
      }

      const result = await response.json();

      // Show success and redirect
      Components.showToast('Cuenta creada exitosamente', 'success');

      // Auto-login if tokens are returned
      if (result.access_token) {
        localStorage.setItem('accessToken', result.access_token);
        if (result.refresh_token) {
          localStorage.setItem('refreshToken', result.refresh_token);
        }
        // Redirect to dashboard
        setTimeout(() => {
          window.location.href = `${result.tenant_url || ''}#/director/dashboard`;
        }, 1500);
      } else {
        // Redirect to login
        setTimeout(() => {
          Router.navigate('/auth');
        }, 1500);
      }

    } catch (error) {
      Components.showToast(error.message, 'error');
      setupBtn.disabled = false;
      setupBtn.textContent = 'Crear Cuenta';
    }
  });
};
