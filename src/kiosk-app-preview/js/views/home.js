// Home view - Redesigned QR scanner with camera + NFC support (2026 Redesign)
// Supports both tablet (large screen) and mobile (small screen) layouts
const Views = window.Views || {};
window.Views = Views;

Views.home = function() {
  const app = document.getElementById('app');
  let video = null;
  let canvas = null;
  let canvasContext = null;
  let scanning = false;
  let scanningState = 'ready'; // ready, showing_result
  let animationFrame = null;
  let nfcReader = null;
  let nfcSupported = 'NDEFReader' in window;
  let autoResumeTimeout = null;

  // Debounce: prevent duplicate scans within 500ms
  let lastScanTime = 0;
  const DEBOUNCE_MS = 500;

  // NFC configuration
  let nfcActivated = false; // Track if user has activated NFC

  // Detect mobile viewport (based on approved mobile design max-width 420px)
  function isMobileViewport() {
    return window.innerWidth <= 500;
  }

  // Auto-resume configuration (default 5 seconds, 0 = disabled)
  // Note: Read at runtime to ensure State.config is loaded
  function getAutoResumeMs() {
    return State.config.autoResumeDelay || 5000;
  }

  // Mobile layout render (based on kiosco-home-scanner-acceso-celular.html)
  function renderMobileCamera() {
    app.innerHTML = `
      <div class="mobile-home-container">
        <!-- Background gradient glows -->
        <div class="mobile-home-glow-top"></div>
        <div class="mobile-home-glow-bottom"></div>

        <!-- Header -->
        <header class="mobile-home-header">
          <div class="mobile-home-header-logo">
            <div class="mobile-home-header-logo-icon">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 class="mobile-home-header-logo-text">NEUVOX</h2>
          </div>
          <button id="mobile-settings-btn" class="mobile-home-notification-btn">
            <span class="material-symbols-outlined text-white text-xl">settings</span>
          </button>
        </header>

        <!-- Main Content -->
        <main class="mobile-home-main">
          <!-- Headline -->
          <div class="mobile-home-headline">
            <h1>Escanea tu código</h1>
            <p>Coloca tu credencial frente a la cámara</p>
          </div>

          <!-- QR Scanner with neon corners -->
          <div class="mobile-scanner-frame">
            <div class="mobile-scanner-viewport">
              <video id="qr-video" autoplay playsinline></video>
              <canvas id="qr-canvas" hidden></canvas>
              <div class="mobile-scan-line"></div>
              <!-- QR icon overlay -->
              <div class="mobile-scanner-icon-overlay">
                <span class="material-symbols-outlined">qr_code_scanner</span>
              </div>
            </div>
            <!-- Neon corners -->
            <div class="mobile-scanner-corner top-left"></div>
            <div class="mobile-scanner-corner top-right"></div>
            <div class="mobile-scanner-corner bottom-left"></div>
            <div class="mobile-scanner-corner bottom-right"></div>
          </div>

          <!-- Help text -->
          <div class="mobile-scanner-help">
            <p>Asegúrate de que el código esté dentro del recuadro</p>
          </div>
        </main>

        <!-- Footer with stacked buttons -->
        <footer class="mobile-home-footer">
          <div class="mobile-home-buttons">
            <!-- NFC Button -->
            <button id="nfc-btn" class="mobile-home-btn-nfc" ${nfcSupported ? '' : 'disabled style="opacity: 0.5"'}>
              <span class="material-symbols-outlined">nfc</span>
              <span>${nfcSupported ? (nfcActivated ? 'NFC ACTIVO' : 'ACTIVAR NFC') : 'NFC NO DISPONIBLE'}</span>
            </button>
            <!-- Fingerprint Button -->
            <button id="biometric-btn" class="mobile-home-btn-fingerprint">
              <span class="material-symbols-outlined">fingerprint</span>
              <span>HUELLA DIGITAL</span>
            </button>
          </div>
        </footer>

        <!-- iOS-style home indicator -->
        <div class="mobile-home-indicator"></div>
      </div>
    `;

    video = document.getElementById('qr-video');
    canvas = document.getElementById('qr-canvas');
    canvasContext = canvas.getContext('2d');

    startCamera();
    attachMobileEventHandlers();
  }

  function attachMobileEventHandlers() {
    const nfcButton = document.getElementById('nfc-btn');
    if (nfcButton && nfcSupported) {
      nfcButton.addEventListener('click', activateNFC);
    }

    const biometricButton = document.getElementById('biometric-btn');
    if (biometricButton) {
      biometricButton.addEventListener('click', () => {
        stopCamera();
        stopNFC();
        Router.navigate('/biometric-auth');
      });
    }

    const settingsButton = document.getElementById('mobile-settings-btn');
    if (settingsButton) {
      settingsButton.addEventListener('click', () => {
        stopCamera();
        stopNFC();
        Router.navigate('/settings');
      });
    }
  }

  // Tablet layout render (original design)
  function renderCamera() {
    const gateId = State.device?.gate_id || 'No configurado';
    const isOnline = State.device?.online !== false;

    app.innerHTML = `
      <div class="kiosk-home min-h-screen flex flex-col">
        <!-- Blur effects background -->
        <div class="blur-bg-blue"></div>
        <div class="blur-bg-purple"></div>

        <!-- Header con logo NEUVOX (SIN toggle dark mode - siempre oscuro) -->
        <header class="pt-8 sm:pt-12 flex justify-center relative z-10">
          <div class="flex flex-col items-center">
            <img src="assets/LOGO Neuvox 1000X1000.png"
                 alt="NEUVOX"
                 class="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-lg" />
            <h1 class="text-3xl sm:text-4xl font-extrabold text-gradient-primary mt-2">
              NEUVOX
            </h1>
          </div>
        </header>

        <!-- Main: Scanner area + buttons -->
        <main class="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
          <!-- Instrucciones (responsive) -->
          <div class="text-center mb-4 sm:mb-8 px-2">
            <h2 class="text-xl sm:text-2xl md:text-3xl font-semibold text-white mb-2">
              ${I18n.t('scanner.instruction_both') || 'Acerca tu código QR o activa el lector NFC'}
            </h2>
            <p class="text-slate-400 text-sm sm:text-base md:text-lg">Inicia sesión para registrar tu asistencia</p>
          </div>

          <!-- QR Scanner con esquinas animadas (responsive) -->
          <div class="qr-scanner-container relative w-full max-w-xs sm:max-w-sm md:max-w-md aspect-square mb-6 sm:mb-10">
            <div class="absolute inset-0 rounded-3xl overflow-hidden bg-slate-900 border border-white/10">
              <video id="qr-video" autoplay playsinline class="w-full h-full object-cover"></video>
              <canvas id="qr-canvas" hidden></canvas>
              <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/80"></div>
            </div>
            <!-- Esquinas QR animadas -->
            <div class="absolute inset-8 pointer-events-none">
              ${UI.createQRCorners()}
              <!-- Linea de escaneo -->
              <div class="scanner-line absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
            </div>
          </div>

          <!-- Boton NFC (responsive) -->
          <button id="nfc-btn" class="w-full max-w-xs sm:max-w-sm md:max-w-md h-16 sm:h-20 bg-gradient-primary text-white rounded-2xl
                                 font-bold text-lg sm:text-xl shadow-xl flex items-center justify-center gap-3 sm:gap-4
                                 transition-all active:scale-95 ${nfcSupported ? 'animate-pulse-slow' : 'opacity-50 cursor-not-allowed'}"
                  ${nfcSupported ? '' : 'disabled'}>
            <span class="material-symbols-rounded text-2xl sm:text-3xl">nfc</span>
            <span>${nfcSupported ? (nfcActivated ? 'NFC ACTIVO' : 'ACTIVAR NFC') : 'NFC NO DISPONIBLE'}</span>
          </button>

          <!-- Boton Huella Digital -->
          <button id="biometric-btn" class="mt-4 flex items-center gap-2 px-8 py-4 text-slate-400 hover:text-white
                     transition-colors group">
            <span class="material-symbols-rounded text-2xl group-hover:scale-110 transition-transform">fingerprint</span>
            <span class="font-semibold uppercase tracking-wider text-sm">HUELLA DIGITAL</span>
          </button>
        </main>

        <!-- Footer -->
        <footer class="relative z-10 w-full px-8 pb-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <!-- Botones auxiliares -->
          <div class="flex gap-3">
            <button id="manual-btn" class="glass-panel px-6 py-3 rounded-xl flex items-center gap-2
                       text-slate-400 hover:text-white transition-all text-sm font-medium">
              <span class="material-symbols-rounded text-lg">keyboard</span>
              Entrada Manual
            </button>
            <button id="settings-btn" class="glass-panel px-4 py-3 rounded-xl flex items-center justify-center
                       text-slate-400 hover:text-white transition-all">
              <span class="material-symbols-rounded text-lg">settings</span>
            </button>
          </div>

          <!-- Estado sistema (DINAMICO) -->
          <div class="flex flex-col items-center md:items-end gap-1">
            ${UI.createStatusBadge(isOnline)}
            <p class="text-xs text-slate-500 font-medium">
              Gate ID: <span class="text-slate-300">${UI.escapeHtml(gateId)}</span>
            </p>
          </div>
        </footer>
      </div>
    `;

    video = document.getElementById('qr-video');
    canvas = document.getElementById('qr-canvas');
    canvasContext = canvas.getContext('2d');

    startCamera();

    // Attach click handlers
    const nfcButton = document.getElementById('nfc-btn');
    if (nfcButton && nfcSupported) {
      nfcButton.addEventListener('click', activateNFC);
    }

    const biometricButton = document.getElementById('biometric-btn');
    if (biometricButton) {
      biometricButton.addEventListener('click', (e) => {
        console.log('Biometric button clicked!', e);
        stopCamera();
        stopNFC();
        Router.navigate('/biometric-auth');
      });
    }

    const manualButton = document.getElementById('manual-btn');
    if (manualButton) {
      manualButton.addEventListener('click', () => {
        stopCamera();
        stopNFC();
        Router.navigate('/manual');
      });
    }

    const settingsButton = document.getElementById('settings-btn');
    if (settingsButton) {
      settingsButton.addEventListener('click', () => {
        stopCamera();
        stopNFC();
        Router.navigate('/settings');
      });
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      video.srcObject = stream;
      video.setAttribute('playsinline', true);
      video.play();

      scanning = true;
      requestAnimationFrame(scanQRCode);
    } catch (err) {
      console.error('Error accessing camera:', err);
      UI.showToast(I18n.t('scanner.camera_error'), 'error');
      // Fallback to manual input
      showManualInput();
    }
  }

  // Update NFC button state
  function updateNFCButton(state, message) {
    const nfcBtn = document.getElementById('nfc-btn');
    if (!nfcBtn) return;

    const iconEl = nfcBtn.querySelector('.material-symbols-rounded');
    const textEl = nfcBtn.querySelector('span:last-child');

    switch (state) {
      case 'waiting':
        nfcBtn.classList.remove('animate-pulse-slow');
        nfcBtn.classList.add('nfc-active-state');
        if (iconEl) iconEl.textContent = 'nfc';
        if (textEl) textEl.textContent = message || 'NFC ACTIVO - Acerca tu tarjeta';
        break;
      case 'reading':
        if (iconEl) iconEl.textContent = 'sync';
        if (textEl) textEl.textContent = message || 'Leyendo tarjeta...';
        break;
      case 'success':
        if (iconEl) iconEl.textContent = 'check_circle';
        if (textEl) textEl.textContent = message || '¡Tarjeta detectada!';
        break;
      case 'error':
        if (iconEl) iconEl.textContent = 'error';
        if (textEl) textEl.textContent = message || 'Error al leer tarjeta';
        setTimeout(() => {
          if (nfcActivated) updateNFCButton('waiting');
        }, 2000);
        break;
      default:
        if (iconEl) iconEl.textContent = 'nfc';
        if (textEl) textEl.textContent = 'ACTIVAR NFC';
    }
  }

  // User-initiated NFC activation (called from button click)
  async function activateNFC() {
    if (!nfcSupported) {
      UI.showToast('NFC no soportado en este navegador', 'error');
      return;
    }

    if (nfcActivated && nfcReader) {
      // Already activated
      return;
    }

    updateNFCButton('reading', 'Activando NFC...');

    try {
      nfcReader = new NDEFReader();
      await nfcReader.scan();

      console.log('NFC scan started successfully');
      nfcActivated = true;
      updateNFCButton('waiting');
      UI.showToast('NFC activado correctamente', 'success');

      nfcReader.addEventListener('reading', ({ message, serialNumber }) => {
        console.log('NFC tag detected:', serialNumber);
        updateNFCButton('reading', 'Leyendo tarjeta...');

        // Try to read NDEF text record
        let token = null;

        for (const record of message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding);
            const content = textDecoder.decode(record.data);

            // Check if content contains "Token: XXXXXXXX" pattern (enrollment info format)
            const tokenMatch = content.match(/Token:\s*([A-Za-z0-9]+)/);
            if (tokenMatch) {
              token = tokenMatch[1];
              console.log('Extracted token from enrollment info:', token);
            } else {
              // Use content directly as token
              token = content;
            }
            break;
          } else if (record.recordType === 'url') {
            const textDecoder = new TextDecoder();
            const url = textDecoder.decode(record.data);
            // Extract token from URL if it contains one
            const match = url.match(/token=([^&]+)/);
            if (match) token = match[1];
            break;
          }
        }

        // If no NDEF data, use serial number as token
        if (!token) {
          token = serialNumber.replace(/:/g, '_');
        }

        if (token && scanningState === 'ready') {
          updateNFCButton('success', '¡Tarjeta detectada!');
          processToken(token, 'NFC');
        }
      });

      nfcReader.addEventListener('readingerror', () => {
        console.log('NFC reading error');
        updateNFCButton('error', 'Error al leer tarjeta');
        UI.showToast('Error al leer tarjeta NFC', 'error');
      });

    } catch (err) {
      console.error('Error starting NFC:', err);
      UI.showToast('No se pudo activar NFC. Toca de nuevo para reintentar.', 'error');
      updateNFCButton('default');
    }
  }

  function stopNFC() {
    // NDEFReader doesn't have a stop method, but we can nullify to prevent callbacks
    if (nfcReader) {
      nfcReader.onreading = null;
      nfcReader.onreadingerror = null;
      nfcReader = null;
    }
    nfcActivated = false;
  }

  function scanQRCode() {
    if (!scanning || scanningState !== 'ready') return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        // QR code detected!
        scanning = false;
        processToken(code.data, 'QR');
        return;
      }
    }

    animationFrame = requestAnimationFrame(scanQRCode);
  }

  // Audio feedback - beep sound on successful scan
  function playSuccessBeep() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 880; // A5 note
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15); // 150ms beep

      oscillator.onended = () => {
        audioContext.close();
      };
    } catch (e) {
      console.log('Audio feedback not available:', e);
    }
  }

  // Vibration feedback for mobile devices
  function vibrateDevice() {
    if ('vibrate' in navigator) {
      navigator.vibrate(100); // 100ms vibration
    }
  }

  // Combined feedback for successful scan
  function provideScanFeedback() {
    playSuccessBeep();
    vibrateDevice();
  }

  function processToken(token, source) {
    // Debounce check - prevent duplicate scans
    const now = Date.now();
    if (now - lastScanTime < DEBOUNCE_MS) {
      console.log('Debounce: ignoring duplicate scan');
      return;
    }
    lastScanTime = now;

    console.log(`${source} detected:`, token);

    const result = State.resolveByToken(token);

    if (!result) {
      UI.showToast(I18n.t('scanner.invalid_credential'), 'error');
      setTimeout(() => {
        scanning = true;
        scanningState = 'ready';
        requestAnimationFrame(scanQRCode);
      }, 2000);
    } else if (result.error === 'REVOKED') {
      UI.showToast(I18n.t('scanner.revoked_credential'), 'error');
      setTimeout(() => {
        scanning = true;
        scanningState = 'ready';
        requestAnimationFrame(scanQRCode);
      }, 2000);
    } else if (result.type === 'teacher') {
      // Teacher detected - provide feedback, stop camera and NFC, navigate
      provideScanFeedback();
      stopCamera();
      stopNFC();
      Router.navigate('/admin-panel');
    } else if (result.type === 'student') {
      // Student detected - provide feedback and navigate to scan-result
      provideScanFeedback();
      stopCamera();
      stopNFC();

      // Always navigate to the redesigned scan-result view
      Router.navigate(`/scan-result?student_id=${result.data.id}&source=${source.toUpperCase()}`);
    }
  }

  function stopCamera() {
    scanning = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  }

  function showManualInput() {
    app.innerHTML = `
      <div class="kiosk-home min-h-screen flex flex-col items-center justify-center">
        <div class="blur-bg-blue"></div>
        <div class="blur-bg-purple"></div>

        <div class="relative z-10 bg-card-dark rounded-3xl p-8 max-w-md w-full mx-4 shadow-heavy">
          <div class="text-center mb-6">
            <span class="material-symbols-rounded text-6xl text-kiosk-warning mb-4">videocam_off</span>
            <h2 class="text-2xl font-bold text-white mb-2">${I18n.t('manual.camera_unavailable')}</h2>
            <p class="text-slate-400">${I18n.t('manual.enter_code')}</p>
          </div>

          <input type="text" id="scan-token-input"
            class="w-full p-4 rounded-xl bg-slate-800 border border-white/10 text-white text-lg placeholder-slate-500 focus:outline-none focus:border-kiosk-primary"
            placeholder="nfc_001, qr_011..."
            autofocus>

          <div class="flex gap-3 mt-4">
            <button class="flex-1 bg-gradient-primary text-white font-bold py-4 rounded-xl" onclick="Views.home.processManualInput()">
              ${I18n.t('manual.scan')}
            </button>
            <button class="bg-slate-700 text-white font-bold py-4 px-6 rounded-xl" onclick="Views.home.generateRandom()">
              🎲
            </button>
          </div>

          <div class="mt-6 text-xs text-slate-500 text-center">
            <strong>${I18n.t('manual.test_tokens')}</strong><br>
            ${I18n.t('manual.students')}: nfc_001, nfc_002, qr_011, qr_012
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById('scan-token-input')?.focus();
    }, 100);

    document.getElementById('scan-token-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') Views.home.processManualInput();
    });
  }

  Views.home.processManualInput = function() {
    const input = document.getElementById('scan-token-input');
    const token = input?.value.trim();

    if (!token) {
      UI.showToast(I18n.t('manual.enter_code_error'), 'error');
      return;
    }

    // Determine source based on token prefix
    const source = token.startsWith('nfc_') ? 'NFC' : 'QR';
    processToken(token, source);
  };

  Views.home.generateRandom = function() {
    const validTokens = State.tags.filter(t => t.status === 'ACTIVE' && t.student_id);
    const randomTag = validTokens[Math.floor(Math.random() * validTokens.length)];
    document.getElementById('scan-token-input').value = randomTag.token;
  };

  Views.home.resumeScan = function() {
    // Cancel any pending auto-resume
    if (autoResumeTimeout) {
      clearTimeout(autoResumeTimeout);
      autoResumeTimeout = null;
    }

    scanningState = 'ready';
    nfcSupported = 'NDEFReader' in window; // Re-check NFC support
    nfcActivated = false; // Reset NFC activation state

    // Choose layout based on viewport
    if (isMobileViewport()) {
      renderMobileCamera();
    } else {
      renderCamera();
    }
  };

  // Expose activateNFC for external use
  Views.home.activateNFC = activateNFC;

  // Cleanup on navigation
  window.addEventListener('hashchange', function cleanup() {
    stopCamera();
    stopNFC();
    if (autoResumeTimeout) {
      clearTimeout(autoResumeTimeout);
      autoResumeTimeout = null;
    }
    window.removeEventListener('hashchange', cleanup);
  });

  // Choose layout based on viewport size
  if (isMobileViewport()) {
    renderMobileCamera();
  } else {
    renderCamera();
  }
};
