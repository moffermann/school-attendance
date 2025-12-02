// Admin Panel - Accessible only by teachers
Views.adminPanel = function() {
  const app = document.getElementById('app');

  // Session timeout configuration (5 minutes = 300000ms)
  const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
  const WARNING_THRESHOLD_MS = 60 * 1000; // Show warning at 1 minute remaining
  let timeoutId = null;
  let warningId = null;
  let countdownInterval = null;
  let sessionStartTime = Date.now();

  function render() {
    app.innerHTML = `
      ${UI.createHeader()}
      <div class="container">
        <div class="card">
          <div class="card-header">${I18n.t('admin.title')}</div>

          <!-- Session timeout indicator -->
          <div class="session-timeout" id="session-timeout">
            <span class="timeout-icon">⏱️</span>
            <span class="timeout-text" id="timeout-text">Sesión activa</span>
          </div>

          <p style="margin-bottom: 2rem; color: var(--color-gray-500);">
            Acceso exclusivo para profesores y personal autorizado
          </p>

          <div class="admin-menu-grid">
            <div class="admin-menu-item" onclick="Views.adminPanel.navigateTo('/queue')">
              <div class="admin-menu-icon">📋</div>
              <div class="admin-menu-title">${I18n.t('admin.sync_queue')}</div>
              <div class="admin-menu-desc">${I18n.t('admin.sync_desc')} (${State.getPendingCount()})</div>
            </div>

            <div class="admin-menu-item" onclick="Views.adminPanel.navigateTo('/device')">
              <div class="admin-menu-icon">📊</div>
              <div class="admin-menu-title">${I18n.t('admin.device_status')}</div>
              <div class="admin-menu-desc">${I18n.t('admin.device_desc')}</div>
            </div>

            <div class="admin-menu-item" onclick="Views.adminPanel.navigateTo('/settings')">
              <div class="admin-menu-icon">⚙️</div>
              <div class="admin-menu-title">${I18n.t('admin.settings')}</div>
              <div class="admin-menu-desc">${I18n.t('admin.settings_desc')}</div>
            </div>

            <div class="admin-menu-item" onclick="Views.adminPanel.navigateTo('/help')">
              <div class="admin-menu-icon">❓</div>
              <div class="admin-menu-title">${I18n.t('admin.help')}</div>
              <div class="admin-menu-desc">${I18n.t('admin.help_desc')}</div>
            </div>

            <div class="admin-menu-item admin-menu-item-highlight" onclick="Views.adminPanel.openBiometricEnroll()">
              <div class="admin-menu-icon">🖐️</div>
              <div class="admin-menu-title">Registro Biométrico</div>
              <div class="admin-menu-desc">Registrar huellas de estudiantes</div>
            </div>
          </div>

          <div class="mt-3">
            <button class="btn btn-secondary btn-lg" onclick="Views.adminPanel.logout()">
              ← ${I18n.t('admin.back_to_scan')}
            </button>
          </div>
        </div>
      </div>
    `;

    startSessionTimer();
  }

  function startSessionTimer() {
    // Clear any existing timers
    clearTimers();

    sessionStartTime = Date.now();

    // Set warning timer (show warning 1 minute before expiry)
    warningId = setTimeout(() => {
      showWarning();
    }, SESSION_TIMEOUT_MS - WARNING_THRESHOLD_MS);

    // Set session expiry timer
    timeoutId = setTimeout(() => {
      handleTimeout();
    }, SESSION_TIMEOUT_MS);
  }

  function showWarning() {
    const timeoutElement = document.getElementById('session-timeout');
    const textElement = document.getElementById('timeout-text');

    if (timeoutElement && textElement) {
      timeoutElement.classList.add('timeout-warning');

      // Start countdown
      let remaining = WARNING_THRESHOLD_MS / 1000;
      textElement.textContent = `Sesión expira en ${remaining}s`;

      countdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          textElement.textContent = `Sesión expira en ${remaining}s`;
        } else {
          textElement.textContent = 'Sesión expirada';
        }
      }, 1000);
    }
  }

  function handleTimeout() {
    clearTimers();
    UI.showToast('Sesión expirada por inactividad', 'info');
    Router.navigate('/home');
  }

  function resetTimer() {
    const timeoutElement = document.getElementById('session-timeout');
    const textElement = document.getElementById('timeout-text');

    if (timeoutElement) {
      timeoutElement.classList.remove('timeout-warning');
    }
    if (textElement) {
      textElement.textContent = 'Sesión activa';
    }

    startSessionTimer();
  }

  function clearTimers() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (warningId) {
      clearTimeout(warningId);
      warningId = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // Navigate to sub-page and reset timer
  Views.adminPanel.navigateTo = function(route) {
    clearTimers();
    Router.navigate(route);
  };

  // Logout - clear timers and go home
  Views.adminPanel.logout = function() {
    clearTimers();
    Router.navigate('/home');
  };

  // Open biometric enrollment (needs teacher ID)
  // TODO: Get actual teacher ID from session
  Views.adminPanel.openBiometricEnroll = function() {
    clearTimers();
    // For now, use teacher_id=1 as placeholder
    // In real implementation, this would come from the login session
    Router.navigate('/biometric-enroll?teacher_id=1');
  };

  // Expose handleTimeout for testing
  Views.adminPanel.handleTimeout = handleTimeout;

  // Cleanup on navigation away
  window.addEventListener('hashchange', function cleanup() {
    clearTimers();
    window.removeEventListener('hashchange', cleanup);
  });

  render();
};
