// Biometric authentication view for kiosk
Views.biometricAuth = function() {
  const app = document.getElementById('app');
  let authInProgress = false;

  function render() {
    const supported = WebAuthn.isSupported();

    app.innerHTML = `
      <div class="biometric-screen">
        <div class="biometric-card">
          <!-- Header -->
          <button class="back-btn" onclick="Router.navigate('/home')" aria-label="Volver">
            &#10094;
          </button>
          <div class="biometric-header">
            <div class="biometric-icon">🖐️</div>
            <h1 class="biometric-title">Identificación Biométrica</h1>
            <p class="biometric-subtitle">
              ${supported
                ? 'Coloca tu dedo en el sensor para identificarte'
                : 'Tu dispositivo no soporta autenticación biométrica'}
            </p>
          </div>

          ${supported ? `
            <!-- Authentication UI -->
            <div class="biometric-auth-area" id="auth-area">
              <div class="fingerprint-sensor" id="fingerprint-sensor">
                <div class="fingerprint-icon">🔐</div>
                <div class="fingerprint-pulse"></div>
              </div>
              <p class="auth-instruction" id="auth-instruction">
                Toca el sensor para comenzar
              </p>
            </div>

            <button class="btn btn-primary btn-lg" id="start-auth-btn" onclick="Views.biometricAuth.startAuth()">
              🖐️ Iniciar Identificación
            </button>
          ` : `
            <!-- Fallback message -->
            <div class="biometric-unsupported">
              <p>Por favor usa tu tarjeta QR o NFC para identificarte.</p>
              <button class="btn btn-secondary btn-lg" onclick="Router.navigate('/home')">
                Volver al escáner
              </button>
            </div>
          `}

          <!-- Status messages area -->
          <div class="biometric-status" id="biometric-status"></div>
        </div>
      </div>
    `;

    // Check for platform authenticator availability
    if (supported) {
      checkPlatformSupport();
    }
  }

  async function checkPlatformSupport() {
    const available = await WebAuthn.isPlatformAuthenticatorAvailable();
    if (!available) {
      showStatus('warning', 'No se detectó sensor biométrico en este dispositivo');
    }
  }

  function showStatus(type, message) {
    const statusEl = document.getElementById('biometric-status');
    if (statusEl) {
      const iconMap = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        loading: '⏳'
      };

      statusEl.innerHTML = `
        <div class="status-message status-${type}">
          <span class="status-icon">${iconMap[type] || ''}</span>
          <span class="status-text">${message}</span>
        </div>
      `;
    }
  }

  function updateSensorState(state) {
    const sensor = document.getElementById('fingerprint-sensor');
    const instruction = document.getElementById('auth-instruction');
    const btn = document.getElementById('start-auth-btn');

    if (sensor) {
      sensor.className = 'fingerprint-sensor';
      sensor.classList.add(`sensor-${state}`);
    }

    if (instruction) {
      const messages = {
        idle: 'Toca el sensor para comenzar',
        waiting: 'Coloca tu dedo en el sensor...',
        reading: 'Leyendo huella...',
        success: '¡Identificado correctamente!',
        error: 'No se pudo identificar. Intenta de nuevo.'
      };
      instruction.textContent = messages[state] || messages.idle;
    }

    if (btn) {
      btn.disabled = state === 'waiting' || state === 'reading';
      btn.textContent = state === 'waiting' || state === 'reading'
        ? '⏳ Procesando...'
        : '🖐️ Iniciar Identificación';
    }
  }

  Views.biometricAuth.startAuth = async function() {
    if (authInProgress) return;
    authInProgress = true;

    updateSensorState('waiting');
    showStatus('loading', 'Preparando autenticación...');

    try {
      const result = await WebAuthn.authenticateStudent();

      if (result.success && result.student) {
        updateSensorState('success');
        showStatus('success', `¡Bienvenido, ${result.student.full_name}!`);

        // Update local student data with biometric response
        State.updateStudentFromBiometric(result.student);

        // Play success feedback
        playSuccessFeedback();

        // Navigate to scan result after brief delay
        setTimeout(() => {
          Router.navigate(`/scan-result?student_id=${result.student.student_id}&source=Biometric`);
        }, 1500);
      } else {
        updateSensorState('error');
        showStatus('error', result.error || 'No se pudo identificar');

        // Reset after delay
        setTimeout(() => {
          updateSensorState('idle');
          authInProgress = false;
        }, 3000);
      }
    } catch (err) {
      console.error('Authentication error:', err);
      updateSensorState('error');
      showStatus('error', 'Error durante la autenticación');

      setTimeout(() => {
        updateSensorState('idle');
        authInProgress = false;
      }, 3000);
    }
  };

  function playSuccessFeedback() {
    // Audio beep
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      console.log('Audio not available:', e);
    }

    // Vibration
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
  }

  render();
};
