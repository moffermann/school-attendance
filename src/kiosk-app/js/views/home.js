// Home view - Real QR scanner with camera + NFC support
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

  // Auto-resume configuration (default 5 seconds, 0 = disabled)
  // Note: Read at runtime to ensure State.config is loaded
  function getAutoResumeMs() {
    return State.config.autoResumeDelay || 5000;
  }

  function renderCamera() {
    const nfcStatusClass = nfcSupported ? 'nfc-active' : 'nfc-inactive';
    const nfcStatusText = nfcSupported ? I18n.t('scanner.nfc_active') : I18n.t('scanner.nfc_unavailable');

    app.innerHTML = `
      <div class="qr-scanner-container">
        <video id="qr-video" class="qr-video" autoplay playsinline></video>
        <canvas id="qr-canvas" class="qr-canvas"></canvas>
        <div class="qr-overlay">
          <div class="scan-status-bar">
            <div class="scan-status-item ${nfcStatusClass}" id="nfc-status">
              <span class="status-icon">📶</span>
              <span class="status-text">${nfcStatusText}</span>
            </div>
            <div class="scan-status-item qr-active" id="qr-status">
              <span class="status-icon">📷</span>
              <span class="status-text">${I18n.t('scanner.qr_active')}</span>
            </div>
          </div>
          <div class="qr-frame">
            <div class="qr-corner qr-corner-tl"></div>
            <div class="qr-corner qr-corner-tr"></div>
            <div class="qr-corner qr-corner-bl"></div>
            <div class="qr-corner qr-corner-br"></div>
          </div>
          <!-- NFC activation button - Web NFC requires user gesture -->
          ${nfcSupported ? `
            <button class="nfc-reading-indicator nfc-tap-to-activate" id="nfc-indicator"
                    aria-label="Activar NFC">
              <div class="nfc-pulse-ring"></div>
              <div class="nfc-icon">📱</div>
              <div class="nfc-text">Toca para activar NFC</div>
            </button>
          ` : ''}
          <div class="qr-instruction">
            ${nfcSupported
              ? I18n.t('scanner.instruction_both')
              : I18n.t('scanner.instruction_qr')}
          </div>
        </div>
        <!-- Fingerprint option button - outside qr-overlay for proper click handling -->
        <button class="btn btn-biometric" id="biometric-btn" aria-label="Usar huella digital">
          🖐️ ¿Olvidaste tu tarjeta? Usa tu huella
        </button>
      </div>
    `;

    video = document.getElementById('qr-video');
    canvas = document.getElementById('qr-canvas');
    canvasContext = canvas.getContext('2d');

    startCamera();

    // NFC is NOT started automatically - requires user gesture
    // Attach click handler to NFC button
    const nfcButton = document.getElementById('nfc-indicator');
    if (nfcButton) {
      nfcButton.addEventListener('click', activateNFC);
    }

    // Attach click handler to biometric button
    const biometricButton = document.getElementById('biometric-btn');
    console.log('Biometric button found:', biometricButton);
    if (biometricButton) {
      biometricButton.addEventListener('click', (e) => {
        console.log('Biometric button clicked!', e);
        stopCamera();
        stopNFC();
        Router.navigate('/biometric-auth');
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

  // Update NFC indicator state
  function updateNFCIndicator(state, message) {
    const indicator = document.getElementById('nfc-indicator');
    const nfcStatus = document.getElementById('nfc-status');

    if (indicator) {
      const textEl = indicator.querySelector('.nfc-text');
      const iconEl = indicator.querySelector('.nfc-icon');

      indicator.className = 'nfc-reading-indicator';

      switch (state) {
        case 'waiting':
          indicator.classList.add('nfc-waiting');
          iconEl.textContent = '📱';
          textEl.textContent = message || I18n.t('scanner.waiting_nfc');
          break;
        case 'reading':
          indicator.classList.add('nfc-reading');
          iconEl.textContent = '🔄';
          textEl.textContent = message || I18n.t('scanner.reading_card');
          break;
        case 'success':
          indicator.classList.add('nfc-success');
          iconEl.textContent = '✅';
          textEl.textContent = message || I18n.t('scanner.card_detected');
          break;
        case 'error':
          indicator.classList.add('nfc-error');
          iconEl.textContent = '⚠️';
          textEl.textContent = message || I18n.t('scanner.read_error');
          break;
        case 'retrying':
          indicator.classList.add('nfc-retrying');
          iconEl.textContent = '🔄';
          textEl.textContent = message || I18n.t('scanner.retrying');
          break;
      }
    }

    if (nfcStatus) {
      nfcStatus.className = 'scan-status-item';
      if (state === 'error' || state === 'retrying') {
        nfcStatus.classList.add('nfc-inactive');
      } else {
        nfcStatus.classList.add('nfc-active');
      }
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

    const indicator = document.getElementById('nfc-indicator');
    if (indicator) {
      indicator.classList.remove('nfc-tap-to-activate');
      indicator.querySelector('.nfc-text').textContent = 'Activando NFC...';
      indicator.querySelector('.nfc-icon').textContent = '🔄';
    }

    try {
      nfcReader = new NDEFReader();
      await nfcReader.scan();

      console.log('NFC scan started successfully');
      nfcActivated = true;
      updateNFCIndicator('waiting');
      UI.showToast('NFC activado correctamente', 'success');

      nfcReader.addEventListener('reading', ({ message, serialNumber }) => {
        console.log('NFC tag detected:', serialNumber);
        updateNFCIndicator('reading', 'Leyendo tarjeta...');

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
          updateNFCIndicator('success', '¡Tarjeta detectada!');
          processToken(token, 'NFC');
        }
      });

      nfcReader.addEventListener('readingerror', () => {
        console.log('NFC reading error');
        updateNFCIndicator('error', 'Error al leer tarjeta');
        UI.showToast('Error al leer tarjeta NFC', 'error');

        // Return to waiting state after delay
        setTimeout(() => {
          if (scanningState === 'ready' && nfcActivated) {
            updateNFCIndicator('waiting');
          }
        }, 2000);
      });

    } catch (err) {
      console.error('Error starting NFC:', err);

      // Show error and reset to tap-to-activate state
      UI.showToast('No se pudo activar NFC. Toca de nuevo para reintentar.', 'error');

      if (indicator) {
        indicator.classList.add('nfc-tap-to-activate');
        indicator.querySelector('.nfc-text').textContent = 'Toca para activar NFC';
        indicator.querySelector('.nfc-icon').textContent = '📱';
      }

      // Update status bar
      const nfcStatus = document.getElementById('nfc-status');
      if (nfcStatus) {
        nfcStatus.classList.remove('nfc-active');
        nfcStatus.classList.add('nfc-inactive');
      }
    }
  }

  function stopNFC() {
    // F1 fix: NDEFReader doesn't have a stop method, but we can use AbortController
    // for the reading event, or at minimum nullify the reader to prevent callbacks
    if (nfcReader) {
      // Remove references to prevent callbacks from firing
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
  // R9-K1 fix: Close AudioContext after use to prevent memory leak
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

      // R9-K1 fix: Close AudioContext after sound finishes
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
      // Student detected - provide feedback and show welcome
      provideScanFeedback();
      scanningState = 'showing_result';
      stopCamera();
      stopNFC();
      renderResult(result.data, source);
    }
  }

  function stopCamera() {
    scanning = false;
    // F13 fix: cancel any pending animation frame
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  }

  function renderResult(student, source) {
    const eventType = State.nextEventTypeFor(student.id);
    const timestamp = new Date().toISOString();
    const sourceIcon = source === 'NFC' ? '📶' : '📷';
    const AUTO_RESUME_VALUE = State.config.autoResumeDelay || 5000;
    const autoResumeEnabled = AUTO_RESUME_VALUE > 0;
    const isEntry = eventType === 'IN';
    const greeting = isEntry ? I18n.t('welcome.greeting_in') : I18n.t('welcome.greeting_out');
    const entryIcon = isEntry ? '👋' : '🎒';
    const actionLabel = isEntry ? 'Ingreso' : 'Salida';

    // Store photo URL for async loading (if available from API)
    const studentPhotoUrl = student.photo_url;

    app.innerHTML = `
      <div class="welcome-screen ${isEntry ? 'welcome-entry' : 'welcome-exit'}">
        <div class="welcome-card">
          <div class="capture-flash"></div>
          <div class="welcome-type-badge ${isEntry ? 'badge-entry' : 'badge-exit'}">
            <span class="badge-icon">${entryIcon}</span>
            <span class="badge-text">${actionLabel}</span>
          </div>
          <img id="student-photo" src="assets/placeholder_photo.jpg" alt="Foto" class="welcome-photo">
          <div class="welcome-name">${UI.escapeHtml(student.full_name)}</div>
          <div class="welcome-message ${isEntry ? 'message-entry' : 'message-exit'}">${greeting}</div>
          <div class="welcome-time ${isEntry ? 'time-entry' : 'time-exit'}">${UI.formatTime(timestamp)}</div>
          <div class="welcome-source">${sourceIcon} ${I18n.t('welcome.detected_by')} ${source}</div>
          ${autoResumeEnabled ? `
            <div class="auto-resume-indicator" id="auto-resume-indicator">
              <div class="auto-resume-progress ${isEntry ? 'progress-entry' : 'progress-exit'}" id="auto-resume-progress"></div>
              <span class="auto-resume-text">${I18n.t('welcome.returning_in')} <span id="auto-resume-countdown">${Math.ceil(AUTO_RESUME_VALUE / 1000)}</span>s...</span>
            </div>
          ` : ''}
          <button class="btn ${isEntry ? 'btn-success' : 'btn-error'}" style="margin-top: 1rem" onclick="Views.home.resumeScan()">
            ${autoResumeEnabled ? I18n.t('welcome.scan_now') : I18n.t('welcome.scan_next')}
          </button>
        </div>
      </div>
    `;

    // Load student photo with device key authentication (if URL available)
    if (studentPhotoUrl) {
      Sync.loadImageWithDeviceKey(studentPhotoUrl).then(blobUrl => {
        const img = document.getElementById('student-photo');
        if (img && blobUrl) {
          img.src = blobUrl;
        }
      }).catch(err => {
        console.error('Error loading student photo:', err);
        // Keep placeholder on error
      });
    }

    // Enqueue event automatically
    const event = {
      student_id: student.id,
      type: eventType,
      ts: timestamp,
      source: source,
      photo_ref: State.config.photoEnabled ? 'simulated.jpg' : null
    };
    State.enqueueEvent(event);

    // Start auto-resume countdown if enabled
    if (autoResumeEnabled) {
      startAutoResumeCountdown(AUTO_RESUME_VALUE);
    }
  }

  function startAutoResumeCountdown(resumeDelayMs) {
    const progressEl = document.getElementById('auto-resume-progress');
    const countdownEl = document.getElementById('auto-resume-countdown');
    let remaining = resumeDelayMs;

    // Animate progress bar
    if (progressEl) {
      progressEl.style.transition = `width ${resumeDelayMs}ms linear`;
      setTimeout(() => {
        progressEl.style.width = '100%';
      }, 50);
    }

    // Update countdown text
    const countdownInterval = setInterval(() => {
      remaining -= 1000;
      if (countdownEl && remaining > 0) {
        countdownEl.textContent = Math.ceil(remaining / 1000);
      }
    }, 1000);

    // Auto-resume after delay
    autoResumeTimeout = setTimeout(() => {
      clearInterval(countdownInterval);
      if (scanningState === 'showing_result') {
        Views.home.resumeScan();
      }
    }, resumeDelayMs);
  }

  function showManualInput() {
    app.innerHTML = `
      <div class="camera-container">
        <div class="scan-input-modal">
          <div class="scan-input-header">⚠️ ${I18n.t('manual.camera_unavailable')}</div>
          <p style="margin-bottom: 1.5rem; color: var(--color-gray-500);">
            ${I18n.t('manual.enter_code')}
          </p>
          <input type="text" id="scan-token-input" class="scan-input-field"
            placeholder="nfc_001, qr_011, nfc_teacher_001..."
            autofocus>
          <div class="scan-input-buttons">
            <button class="btn btn-primary btn-lg" onclick="Views.home.processManualInput()">
              ${I18n.t('manual.scan')}
            </button>
            <button class="btn btn-secondary" onclick="Views.home.generateRandom()">
              ${I18n.t('manual.generate_random')}
            </button>
          </div>
          <div class="scan-help-text">
            <strong>${I18n.t('manual.test_tokens')}</strong><br>
            ${I18n.t('manual.students')}: nfc_001, nfc_002, qr_011, qr_012<br>
            ${I18n.t('manual.teachers')}: nfc_teacher_001, nfc_teacher_002, qr_teacher_003
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
    renderCamera();
  };

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

  renderCamera();
};
