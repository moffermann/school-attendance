// Reset Password view - Set new password with reset token
window.Views = window.Views || {};

Views.resetPassword = function() {
  const app = document.getElementById('app');

  // Extract token from URL hash query params
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.split('?')[1] || '');
  const token = params.get('token');

  if (!token) {
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gradient-mesh px-4">
        <div class="auth-card-new p-8 md:p-12 max-w-md w-full text-center">
          <span class="material-symbols-outlined text-5xl text-red-400 mb-4">error</span>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Enlace Inválido</h2>
          <p class="text-slate-500 dark:text-slate-400 mb-6">No se encontró un token válido en el enlace.</p>
          <a href="#/auth" class="inline-block px-6 py-3 bg-brand-gradient text-white font-bold rounded-xl">
            Ir al Login
          </a>
        </div>
      </div>
    `;
    return;
  }

  // Show loading while validating
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gradient-mesh px-4">
      <div class="auth-card-new p-8 md:p-12 max-w-md w-full text-center">
        ${Components.createLoader('Validando enlace...')}
      </div>
    </div>
  `;

  validateAndRender(token);

  async function validateAndRender(token) {
    try {
      const response = await fetch(`${API.baseUrl}/auth/validate-reset?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!response.ok || !data.valid) {
        showError('El enlace de recuperación es inválido o ha expirado.');
        return;
      }

      renderResetForm(data.email, token);
    } catch (error) {
      console.error('Token validation error:', error);
      showError('Error al validar el enlace. Intente nuevamente.');
    }
  }

  function showError(message) {
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gradient-mesh px-4">
        <div class="blur-decoration absolute -top-24 -left-24 w-96 h-96 bg-primary/20"></div>
        <div class="auth-card-new p-8 md:p-12 max-w-md w-full text-center relative z-10">
          <span class="material-symbols-outlined text-5xl text-amber-400 mb-4">warning</span>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Enlace Expirado</h2>
          <p class="text-slate-500 dark:text-slate-400 mb-6">${Components.escapeHtml(message)}</p>
          <p class="text-slate-400 text-sm mb-6">
            Puede solicitar un nuevo enlace de recuperación desde la página de login.
          </p>
          <a href="#/forgot-password" class="inline-block px-6 py-3 bg-brand-gradient text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30">
            Solicitar Nuevo Enlace
          </a>
        </div>
      </div>
    `;
  }

  function renderResetForm(email, token) {
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gradient-mesh overflow-hidden relative px-4">
        <div class="blur-decoration absolute -top-24 -left-24 w-96 h-96 bg-primary/20"></div>
        <div class="blur-decoration absolute top-1/2 -right-24 w-80 h-80 bg-purple-500/20"></div>

        <main class="relative z-10 w-full max-w-[480px]">
          <div class="auth-card-new p-8 md:p-12">
            <!-- Logo -->
            <div class="text-center mb-8">
              <div class="flex flex-col items-center mb-6">
                <div class="w-20 h-20 mb-3">
                  <img src="assets/LOGO Neuvox 1000X1000.png" alt="NEUVOX.AI" class="w-full h-full object-contain">
                </div>
                <div class="flex items-center text-2xl font-black tracking-tighter uppercase">
                  <span class="text-[#000080] dark:text-sky-500">NEUVOX</span>
                  <span class="text-sky-500 dark:text-purple-500">.AI</span>
                </div>
              </div>
              <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                Nueva Contraseña
              </h1>
              <p class="text-slate-500 dark:text-slate-400 text-sm">
                Establezca su nueva contraseña
              </p>
            </div>

            <!-- Email display -->
            <div class="mb-6 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-indigo-500 text-lg">mail</span>
                <span class="text-sm text-slate-600 dark:text-slate-300 font-medium">${Components.escapeHtml(email)}</span>
              </div>
            </div>

            <!-- Password Form -->
            <div id="reset-form-section">
              <form id="reset-form" class="space-y-5">
                <div>
                  <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Nueva Contraseña
                  </label>
                  <input type="password" id="reset-password"
                         class="auth-input" placeholder="Mínimo 8 caracteres" required minlength="8">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Confirmar Contraseña
                  </label>
                  <input type="password" id="reset-password-confirm"
                         class="auth-input" placeholder="Repita la contraseña" required minlength="8">
                </div>

                <!-- Password requirements -->
                <div id="password-requirements" class="space-y-1 text-sm">
                  <p class="text-slate-500 font-medium mb-1">Requisitos:</p>
                  <div class="flex items-center gap-2" id="req-length">
                    <span class="material-symbols-outlined text-sm text-slate-300">circle</span>
                    <span class="text-slate-500">Al menos 8 caracteres</span>
                  </div>
                  <div class="flex items-center gap-2" id="req-upper">
                    <span class="material-symbols-outlined text-sm text-slate-300">circle</span>
                    <span class="text-slate-500">Una letra mayúscula</span>
                  </div>
                  <div class="flex items-center gap-2" id="req-lower">
                    <span class="material-symbols-outlined text-sm text-slate-300">circle</span>
                    <span class="text-slate-500">Una letra minúscula</span>
                  </div>
                  <div class="flex items-center gap-2" id="req-number">
                    <span class="material-symbols-outlined text-sm text-slate-300">circle</span>
                    <span class="text-slate-500">Un número</span>
                  </div>
                  <div class="flex items-center gap-2" id="req-match">
                    <span class="material-symbols-outlined text-sm text-slate-300">circle</span>
                    <span class="text-slate-500">Las contraseñas coinciden</span>
                  </div>
                </div>

                <div id="reset-error" class="text-red-500 text-sm text-center" style="display: none;"></div>

                <button type="submit" id="reset-btn"
                        class="w-full py-3 px-4 rounded-xl bg-brand-gradient text-white font-bold
                               shadow-lg shadow-indigo-500/30 hover:opacity-90 transition-all disabled:opacity-50"
                        disabled>
                  Cambiar Contraseña
                </button>
              </form>
            </div>

            <!-- Success message (hidden by default) -->
            <div id="reset-success" style="display: none;" class="text-center">
              <div class="mb-6">
                <span class="material-symbols-outlined text-5xl text-green-400">check_circle</span>
              </div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Contraseña Actualizada</h2>
              <p class="text-slate-500 dark:text-slate-400 text-sm mb-6">
                Su contraseña ha sido actualizada exitosamente. Ya puede iniciar sesión con su nueva contraseña.
              </p>
              <a href="#/auth" class="inline-block px-6 py-3 bg-brand-gradient text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30">
                Ir al Login
              </a>
            </div>
          </div>
        </main>
      </div>
    `;

    // Password validation logic
    const passwordInput = document.getElementById('reset-password');
    const confirmInput = document.getElementById('reset-password-confirm');
    const submitBtn = document.getElementById('reset-btn');

    function checkRequirements() {
      const pass = passwordInput.value;
      const confirm = confirmInput.value;

      const checks = {
        'req-length': pass.length >= 8,
        'req-upper': /[A-Z]/.test(pass),
        'req-lower': /[a-z]/.test(pass),
        'req-number': /[0-9]/.test(pass),
        'req-match': pass.length > 0 && pass === confirm,
      };

      let allMet = true;
      for (const [id, met] of Object.entries(checks)) {
        const el = document.getElementById(id);
        if (!el) continue;
        const icon = el.querySelector('.material-symbols-outlined');
        const text = el.querySelector('span:last-child');
        if (met) {
          icon.textContent = 'check_circle';
          icon.className = 'material-symbols-outlined text-sm text-green-500';
          text.className = 'text-green-600 dark:text-green-400';
        } else {
          icon.textContent = 'circle';
          icon.className = 'material-symbols-outlined text-sm text-slate-300';
          text.className = 'text-slate-500';
          allMet = false;
        }
      }

      submitBtn.disabled = !allMet;
    }

    passwordInput.addEventListener('input', checkRequirements);
    confirmInput.addEventListener('input', checkRequirements);

    // Form submission
    document.getElementById('reset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = passwordInput.value;
      const errorDiv = document.getElementById('reset-error');
      const btn = document.getElementById('reset-btn');

      errorDiv.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Actualizando...';

      try {
        const response = await fetch(`${API.baseUrl}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Error al actualizar la contraseña');
        }

        // Show success
        document.getElementById('reset-form-section').style.display = 'none';
        document.getElementById('reset-success').style.display = 'block';
      } catch (error) {
        console.error('Reset password error:', error);
        errorDiv.textContent = error.message || 'Error al actualizar la contraseña';
        errorDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Cambiar Contraseña';
      }
    });
  }
};
