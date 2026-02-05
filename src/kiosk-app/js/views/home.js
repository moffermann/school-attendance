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

  async function processToken(token, source) {
    // Debounce check - prevent duplicate scans
    const now = Date.now();
    if (now - lastScanTime < DEBOUNCE_MS) {
      console.log('Debounce: ignoring duplicate scan');
      return;
    }
    lastScanTime = now;

    console.log(`${source} detected:`, token);

    const result = State.resolveByToken(token);

    if (result) {
      // Known student or teacher
      if (result.error === 'REVOKED') {
        UI.showToast(I18n.t('scanner.revoked_credential'), 'error');
        resumeScanning();
      } else if (result.type === 'teacher') {
        provideScanFeedback();
        stopCamera();
        stopNFC();
        Router.navigate('/admin-panel');
      } else if (result.type === 'student') {
        provideScanFeedback();
        stopCamera();
        stopNFC();
        Router.navigate(`/scan-result?student_id=${result.data.id}&source=${source.toUpperCase()}`);
      }
      return;
    }

    // Not a student/teacher - check if it's an authorized pickup
    console.log('[Home] Token not student/teacher, checking pickup...');
    const pickup = await State.resolvePickupByQR(token);

    if (pickup && pickup.pickup) {
      console.log('[Home] Pickup detected:', pickup.pickup.full_name);
      provideScanFeedback();
      scanningState = 'showing_result';

      // Stop QR scanner camera BEFORE opening selfie camera.
      // Some phones can't handle two simultaneous camera streams.
      stopCamera();
      stopNFC();

      // Start withdrawal flow with modals
      startWithdrawalFlow(pickup.pickup);
    } else {
      // Unknown QR
      UI.showToast(I18n.t('scanner.invalid_credential'), 'error');
      resumeScanning();
    }
  }

  function resumeScanning() {
    setTimeout(() => {
      scanning = true;
      scanningState = 'ready';
      requestAnimationFrame(scanQRCode);
    }, 2000);
  }

  // =====================================================
  // WITHDRAWAL FLOW - Integrated modals
  // =====================================================

  let withdrawalState = {
    pickup: null,
    selectedStudents: [],
    selfieData: null,
    signatureData: null
  };

  async function startWithdrawalFlow(pickup) {
    withdrawalState = {
      pickup: pickup,
      selectedStudents: [],
      selfieData: null,
      signatureData: null
    };

    // Get students this pickup can withdraw
    const studentIds = pickup.student_ids || [];
    const students = studentIds
      .map(id => State.students.find(s => s.id === id))
      .filter(s => s); // Filter out nulls

    if (students.length === 0) {
      UI.showToast('Esta persona no tiene estudiantes asignados', 'error');
      resumeAfterWithdrawal();
      return;
    }

    // Show student selection modal
    showStudentSelectionModal(pickup, students);
  }

  function showStudentSelectionModal(pickup, students) {
    const modal = document.createElement('div');
    modal.id = 'withdrawal-modal';
    modal.className = 'withdrawal-modal-overlay';
    modal.innerHTML = `
      <div class="withdrawal-modal-container glass-panel">
        <div class="withdrawal-modal-header">
          <div class="withdrawal-pickup-info">
            <span class="material-symbols-outlined text-3xl text-amber-400">person</span>
            <div>
              <h2 class="text-xl font-bold text-white">${UI.escapeHtml(pickup.full_name)}</h2>
              <p class="text-slate-400 text-sm">${UI.escapeHtml(pickup.relationship_type)}</p>
            </div>
          </div>
          <button id="modal-close-btn" class="withdrawal-modal-close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="withdrawal-modal-body">
          <h3 class="text-lg font-semibold text-white mb-4">Seleccione estudiante(s) a retirar:</h3>
          <div class="withdrawal-student-list">
            ${students.map(s => `
              <label class="withdrawal-student-item" data-student-id="${s.id}">
                <input type="checkbox" value="${s.id}" class="withdrawal-checkbox">
                <div class="withdrawal-student-info">
                  <span class="font-medium text-white">${UI.escapeHtml(s.full_name)}</span>
                  <span class="text-sm text-slate-400">${UI.escapeHtml(s.course_name || 'Sin curso')}</span>
                </div>
                <span class="material-symbols-outlined text-green-400 withdrawal-check-icon">check_circle</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="withdrawal-modal-footer">
          <button id="cancel-withdrawal-btn" class="withdrawal-btn-secondary">
            Cancelar
          </button>
          <button id="continue-withdrawal-btn" class="withdrawal-btn-primary" disabled>
            Continuar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    const checkboxes = modal.querySelectorAll('.withdrawal-checkbox');
    const continueBtn = modal.querySelector('#continue-withdrawal-btn');

    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const selected = modal.querySelectorAll('.withdrawal-checkbox:checked');
        continueBtn.disabled = selected.length === 0;
      });
    });

    modal.querySelector('#modal-close-btn').addEventListener('click', closeWithdrawalModal);
    modal.querySelector('#cancel-withdrawal-btn').addEventListener('click', closeWithdrawalModal);

    continueBtn.addEventListener('click', () => {
      const selected = Array.from(modal.querySelectorAll('.withdrawal-checkbox:checked'))
        .map(cb => parseInt(cb.value));
      withdrawalState.selectedStudents = selected;
      closeWithdrawalModal();
      showSelfieModal();
    });

    // Animate in
    requestAnimationFrame(() => modal.classList.add('active'));
  }

  function showSelfieModal() {
    const modal = document.createElement('div');
    modal.id = 'withdrawal-modal';
    modal.className = 'withdrawal-modal-overlay';
    modal.innerHTML = `
      <div class="withdrawal-modal-container glass-panel">
        <div class="withdrawal-modal-header">
          <h2 class="text-xl font-bold text-white">
            <span class="material-symbols-outlined text-2xl align-middle mr-2">photo_camera</span>
            Verificación de Identidad
          </h2>
          <button id="modal-close-btn" class="withdrawal-modal-close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="withdrawal-modal-body">
          <p class="text-slate-300 mb-4 text-center">Capture una foto del adulto que retira</p>
          <div class="withdrawal-camera-container">
            <video id="selfie-video" autoplay playsinline class="withdrawal-camera-video"></video>
            <canvas id="selfie-canvas" hidden></canvas>
            <img id="selfie-preview" class="withdrawal-camera-preview hidden">
          </div>
        </div>

        <div class="withdrawal-modal-footer">
          <button id="cancel-selfie-btn" class="withdrawal-btn-secondary">Cancelar</button>
          <button id="capture-selfie-btn" class="withdrawal-btn-primary">
            <span class="material-symbols-outlined">photo_camera</span>
            Capturar
          </button>
          <button id="retake-selfie-btn" class="withdrawal-btn-secondary hidden">Retomar</button>
          <button id="confirm-selfie-btn" class="withdrawal-btn-primary hidden">Confirmar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const selfieVideo = modal.querySelector('#selfie-video');
    const selfieCanvas = modal.querySelector('#selfie-canvas');
    const selfiePreview = modal.querySelector('#selfie-preview');
    const captureBtn = modal.querySelector('#capture-selfie-btn');
    const retakeBtn = modal.querySelector('#retake-selfie-btn');
    const confirmBtn = modal.querySelector('#confirm-selfie-btn');
    let selfieStream = null;

    // Start camera for selfie (front camera)
    // Use 'ideal' constraints with progressive fallback for broad device compatibility.
    // Exact constraints cause black screens / failures on some phones.
    // Delay 500ms to allow QR scanner camera hardware to fully release.
    const preferredConstraints = {
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    };
    const fallbackConstraints = { video: { facingMode: 'user' } };
    const minimalConstraints = { video: true };

    setTimeout(() => {
      navigator.mediaDevices.getUserMedia(preferredConstraints)
        .catch(err => {
          console.warn('Selfie preferred constraints failed, trying fallback:', err.message);
          return navigator.mediaDevices.getUserMedia(fallbackConstraints);
        })
        .catch(err => {
          console.warn('Selfie fallback constraints failed, trying minimal:', err.message);
          return navigator.mediaDevices.getUserMedia(minimalConstraints);
        })
        .then(stream => {
          selfieStream = stream;
          selfieVideo.srcObject = stream;
          return selfieVideo.play();
        })
        .then(() => {
          console.log('Selfie camera stream active');
        })
        .catch(err => {
          console.error('Selfie camera error:', err);
          UI.showToast('No se pudo acceder a la cámara: ' + (err.message || 'Permiso denegado'), 'error');
        });
    }, 500);

    captureBtn.addEventListener('click', () => {
      // Capture frame
      selfieCanvas.width = selfieVideo.videoWidth;
      selfieCanvas.height = selfieVideo.videoHeight;
      selfieCanvas.getContext('2d').drawImage(selfieVideo, 0, 0);
      const dataUrl = selfieCanvas.toDataURL('image/jpeg', 0.8);

      selfiePreview.src = dataUrl;
      selfiePreview.classList.remove('hidden');
      selfieVideo.classList.add('hidden');

      captureBtn.classList.add('hidden');
      retakeBtn.classList.remove('hidden');
      confirmBtn.classList.remove('hidden');

      withdrawalState.selfieData = dataUrl;
    });

    retakeBtn.addEventListener('click', () => {
      selfiePreview.classList.add('hidden');
      selfieVideo.classList.remove('hidden');
      captureBtn.classList.remove('hidden');
      retakeBtn.classList.add('hidden');
      confirmBtn.classList.add('hidden');
      withdrawalState.selfieData = null;
    });

    confirmBtn.addEventListener('click', () => {
      if (selfieStream) {
        selfieStream.getTracks().forEach(t => t.stop());
      }
      closeWithdrawalModal();
      showSignatureModal();
    });

    modal.querySelector('#modal-close-btn').addEventListener('click', () => {
      if (selfieStream) selfieStream.getTracks().forEach(t => t.stop());
      closeWithdrawalModal();
      resumeAfterWithdrawal();
    });

    modal.querySelector('#cancel-selfie-btn').addEventListener('click', () => {
      if (selfieStream) selfieStream.getTracks().forEach(t => t.stop());
      closeWithdrawalModal();
      resumeAfterWithdrawal();
    });

    requestAnimationFrame(() => modal.classList.add('active'));
  }

  function showSignatureModal() {
    const studentNames = withdrawalState.selectedStudents
      .map(id => State.students.find(s => s.id === id)?.full_name || 'Estudiante')
      .join(', ');

    const modal = document.createElement('div');
    modal.id = 'withdrawal-modal';
    modal.className = 'withdrawal-modal-overlay';
    modal.innerHTML = `
      <div class="withdrawal-modal-container glass-panel withdrawal-modal-large">
        <div class="withdrawal-modal-header">
          <h2 class="text-xl font-bold text-white">
            <span class="material-symbols-outlined text-2xl align-middle mr-2">draw</span>
            Firma de Retiro
          </h2>
          <button id="modal-close-btn" class="withdrawal-modal-close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="withdrawal-modal-body">
          <div class="withdrawal-signature-info">
            <p class="text-slate-300">
              Yo, <strong class="text-white">${UI.escapeHtml(withdrawalState.pickup.full_name)}</strong>,
              retiro a:
            </p>
            <p class="text-amber-400 font-medium mt-1">${UI.escapeHtml(studentNames)}</p>
            <p class="text-slate-500 text-sm mt-2">
              ${new Date().toLocaleDateString('es-CL')} - ${new Date().toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'})}
            </p>
          </div>

          <div class="withdrawal-signature-pad-container">
            <canvas id="signature-canvas" class="withdrawal-signature-canvas"></canvas>
            <p class="text-slate-500 text-xs mt-2 text-center">Firme en el recuadro</p>
          </div>
        </div>

        <div class="withdrawal-modal-footer">
          <button id="clear-signature-btn" class="withdrawal-btn-secondary">
            <span class="material-symbols-outlined">refresh</span>
            Limpiar
          </button>
          <button id="confirm-signature-btn" class="withdrawal-btn-primary">
            <span class="material-symbols-outlined">check</span>
            Confirmar Retiro
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup signature canvas
    const sigCanvas = modal.querySelector('#signature-canvas');
    const sigCtx = sigCanvas.getContext('2d');
    let isDrawing = false;

    // Set canvas size
    const rect = sigCanvas.getBoundingClientRect();
    sigCanvas.width = rect.width * 2;
    sigCanvas.height = rect.height * 2;
    sigCtx.scale(2, 2);
    sigCtx.strokeStyle = '#1e293b';  // Dark slate for visibility on white background
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';

    function getPos(e) {
      const rect = sigCanvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }

    function startDraw(e) {
      isDrawing = true;
      const pos = getPos(e);
      sigCtx.beginPath();
      sigCtx.moveTo(pos.x, pos.y);
      e.preventDefault();
    }

    function draw(e) {
      if (!isDrawing) return;
      const pos = getPos(e);
      sigCtx.lineTo(pos.x, pos.y);
      sigCtx.stroke();
      e.preventDefault();
    }

    function endDraw() {
      isDrawing = false;
    }

    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', draw);
    sigCanvas.addEventListener('mouseup', endDraw);
    sigCanvas.addEventListener('mouseleave', endDraw);
    sigCanvas.addEventListener('touchstart', startDraw);
    sigCanvas.addEventListener('touchmove', draw);
    sigCanvas.addEventListener('touchend', endDraw);

    modal.querySelector('#clear-signature-btn').addEventListener('click', () => {
      sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    });

    modal.querySelector('#confirm-signature-btn').addEventListener('click', async () => {
      withdrawalState.signatureData = sigCanvas.toDataURL('image/png');
      closeWithdrawalModal();
      await completeWithdrawal();
    });

    modal.querySelector('#modal-close-btn').addEventListener('click', () => {
      closeWithdrawalModal();
      resumeAfterWithdrawal();
    });

    requestAnimationFrame(() => modal.classList.add('active'));
  }

  async function completeWithdrawal() {
    UI.showToast('Procesando retiro...', 'info', 2000);

    try {
      // Call API to register withdrawal
      const completedWithdrawals = await Sync.registerWithdrawal({
        pickup_id: withdrawalState.pickup.id,
        student_ids: withdrawalState.selectedStudents,
        selfie_data: withdrawalState.selfieData,
        signature_data: withdrawalState.signatureData
      });

      // API returns array of completed withdrawals
      if (completedWithdrawals && completedWithdrawals.length > 0) {
        showWithdrawalSuccess();
      } else {
        UI.showToast('No se pudieron completar los retiros', 'error');
        resumeAfterWithdrawal();
      }
    } catch (err) {
      console.error('Withdrawal error:', err);
      UI.showToast(err.message || 'Error al procesar retiro', 'error');
      resumeAfterWithdrawal();
    }
  }

  function showWithdrawalSuccess() {
    const studentNames = withdrawalState.selectedStudents
      .map(id => State.students.find(s => s.id === id)?.full_name || 'Estudiante')
      .join(', ');

    const modal = document.createElement('div');
    modal.id = 'withdrawal-modal';
    modal.className = 'withdrawal-modal-overlay';
    modal.innerHTML = `
      <div class="withdrawal-modal-container glass-panel withdrawal-success-container">
        <div class="withdrawal-success-icon">
          <span class="material-symbols-outlined">check_circle</span>
        </div>
        <h2 class="text-2xl font-bold text-white mt-4">Retiro Registrado</h2>
        <p class="text-slate-300 mt-2">${UI.escapeHtml(studentNames)}</p>
        <p class="text-slate-400 text-sm mt-1">
          Retirado por: ${UI.escapeHtml(withdrawalState.pickup.full_name)}
        </p>
        <p class="text-slate-500 text-xs mt-4">
          ${new Date().toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'})}
        </p>
      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));

    // Auto close after 3 seconds
    setTimeout(() => {
      closeWithdrawalModal();
      resumeAfterWithdrawal();
    }, 3000);
  }

  function closeWithdrawalModal() {
    const modal = document.getElementById('withdrawal-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    }
  }

  function resumeAfterWithdrawal() {
    withdrawalState = { pickup: null, selectedStudents: [], selfieData: null, signatureData: null };
    scanningState = 'ready';
    scanning = true;

    // Re-render to restart camera
    if (isMobileViewport()) {
      renderMobileCamera();
    } else {
      renderCamera();
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
