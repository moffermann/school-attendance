// Parent Setup view - Complete account activation
window.Views = window.Views || {};

Views.parentSetup = function() {
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
        ${Components.createLoader('Validando invitación...')}
      </div>
    </div>
  `;

  // Validate the token
  validateAndRender(token);

  async function validateAndRender(token) {
    try {
      const response = await fetch(`${API.baseUrl}/auth/validate-invitation?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!response.ok || !data.valid) {
        showError('Token de invitación inválido o expirado.');
        return;
      }

      renderSetupForm(data.email, token);
    } catch (error) {
      console.error('Token validation error:', error);
      showError('Error al validar la invitación. Intente nuevamente.');
    }
  }

  function showError(message) {
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gradient-mesh px-4">
        <div class="blur-decoration absolute -top-24 -left-24 w-96 h-96 bg-primary/20"></div>
        <div class="auth-card-new p-8 md:p-12 max-w-md w-full text-center relative z-10">
          <span class="material-symbols-outlined text-5xl text-amber-400 mb-4">warning</span>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Invitación No Válida</h2>
          <p class="text-slate-500 dark:text-slate-400 mb-6">${Components.escapeHtml(message)}</p>
          <p class="text-slate-400 text-sm mb-6">
            Si crees que esto es un error, contacta al director del establecimiento para recibir una nueva invitación.
          </p>
          <a href="#/auth" class="inline-block px-6 py-3 bg-brand-gradient text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30">
            Ir al Login
          </a>
        </div>
      </div>
    `;
  }

  function renderSetupForm(email, token) {
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
                Activar Cuenta de Apoderado
              </h1>
              <p class="text-slate-500 dark:text-slate-400 text-sm">
                Establezca su contraseña para acceder al portal
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
            <form id="setup-form" class="space-y-5">
              <div>
                <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Nueva Contraseña
                </label>
                <input type="password" id="setup-password"
                       class="auth-input" placeholder="Mínimo 8 caracteres" required minlength="8">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Confirmar Contraseña
                </label>
                <input type="password" id="setup-password-confirm"
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

              <div id="setup-error" class="text-red-500 text-sm text-center" style="display: none;"></div>

              <button type="submit" id="setup-btn"
                      class="w-full py-3 px-4 rounded-xl bg-brand-gradient text-white font-bold
                             shadow-lg shadow-indigo-500/30 hover:opacity-90 transition-all disabled:opacity-50"
                      disabled>
                Activar Cuenta
              </button>
            </form>
          </div>
        </main>
      </div>
    `;

    // Password validation logic
    const passwordInput = document.getElementById('setup-password');
    const confirmInput = document.getElementById('setup-password-confirm');
    const submitBtn = document.getElementById('setup-btn');

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
    document.getElementById('setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = passwordInput.value;
      const errorDiv = document.getElementById('setup-error');
      const btn = document.getElementById('setup-btn');

      errorDiv.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Activando...';

      try {
        const response = await fetch(`${API.baseUrl}/auth/complete-setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Error al activar la cuenta');
        }

        // Store tokens and login
        API.accessToken = data.access_token;
        API.refreshToken = data.refresh_token;

        // Get bootstrap data
        const bootstrap = await API.getBootstrap();
        State.setFromBootstrap(bootstrap);

        Components.showToast('Cuenta activada exitosamente', 'success');
        Router.navigate('/parent/home');
      } catch (error) {
        console.error('Setup error:', error);
        errorDiv.textContent = error.message || 'Error al activar la cuenta';
        errorDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Activar Cuenta';
      }
    });
  }
};
