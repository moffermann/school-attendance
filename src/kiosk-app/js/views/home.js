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

  // Debounce: prevent duplicate scans within 500ms
  let lastScanTime = 0;
  const DEBOUNCE_MS = 500;

  function renderCamera() {
    const nfcStatusClass = nfcSupported ? 'nfc-active' : 'nfc-inactive';
    const nfcStatusText = nfcSupported ? 'NFC Activo' : 'NFC No disponible';

    app.innerHTML = `
      <div class="qr-scanner-container">
        <video id="qr-video" class="qr-video" autoplay playsinline></video>
        <canvas id="qr-canvas" class="qr-canvas"></canvas>
        <div class="qr-overlay">
          <div class="scan-status-bar">
            <div class="scan-status-item ${nfcStatusClass}">
              <span class="status-icon">📶</span>
              <span class="status-text">${nfcStatusText}</span>
            </div>
            <div class="scan-status-item qr-active">
              <span class="status-icon">📷</span>
              <span class="status-text">QR Activo</span>
            </div>
          </div>
          <div class="qr-frame">
            <div class="qr-corner qr-corner-tl"></div>
            <div class="qr-corner qr-corner-tr"></div>
            <div class="qr-corner qr-corner-bl"></div>
            <div class="qr-corner qr-corner-br"></div>
          </div>
          <div class="qr-instruction">
            ${nfcSupported
              ? 'Acerca tu tarjeta NFC o código QR'
              : 'Acerca el código QR a la cámara'}
          </div>
        </div>
      </div>
    `;

    video = document.getElementById('qr-video');
    canvas = document.getElementById('qr-canvas');
    canvasContext = canvas.getContext('2d');

    startCamera();
    startNFC();
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
      UI.showToast('No se pudo acceder a la cámara', 'error');
      // Fallback to manual input
      showManualInput();
    }
  }

  async function startNFC() {
    if (!nfcSupported) {
      console.log('Web NFC not supported in this browser');
      return;
    }

    try {
      nfcReader = new NDEFReader();
      await nfcReader.scan();
      console.log('NFC scan started successfully');

      nfcReader.addEventListener('reading', ({ message, serialNumber }) => {
        console.log('NFC tag detected:', serialNumber);

        // Try to read NDEF text record
        let token = null;

        for (const record of message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding);
            token = textDecoder.decode(record.data);
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
          processToken(token, 'NFC');
        }
      });

      nfcReader.addEventListener('readingerror', () => {
        console.log('NFC reading error');
        UI.showToast('Error al leer tarjeta NFC', 'error');
      });

    } catch (err) {
      console.error('Error starting NFC:', err);
      // Update UI to show NFC is not available
      nfcSupported = false;
      const nfcStatus = document.querySelector('.scan-status-item.nfc-active');
      if (nfcStatus) {
        nfcStatus.classList.remove('nfc-active');
        nfcStatus.classList.add('nfc-inactive');
        nfcStatus.querySelector('.status-text').textContent = 'NFC No disponible';
      }
    }
  }

  function stopNFC() {
    // NDEFReader doesn't have a stop method, but setting to null helps with cleanup
    nfcReader = null;
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
      UI.showToast('Código no válido', 'error');
      setTimeout(() => {
        scanning = true;
        scanningState = 'ready';
        requestAnimationFrame(scanQRCode);
      }, 2000);
    } else if (result.error === 'REVOKED') {
      UI.showToast('Credencial revocada', 'error');
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
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
  }

  function renderResult(student, source) {
    const eventType = State.nextEventTypeFor(student.id);
    const timestamp = new Date().toISOString();
    const sourceIcon = source === 'NFC' ? '📶' : '📷';

    app.innerHTML = `
      <div class="welcome-screen">
        <div class="welcome-card">
          <div class="capture-flash"></div>
          <img src="assets/placeholder_photo.jpg" alt="Foto" class="welcome-photo">
          <div class="welcome-name">${student.full_name}</div>
          <div class="welcome-message">${eventType === 'IN' ? '¡Bienvenido!' : '¡Hasta pronto!'}</div>
          <div class="welcome-time">${UI.formatTime(timestamp)}</div>
          <div class="welcome-source">${sourceIcon} Detectado por ${source}</div>
          <button class="btn btn-secondary" style="margin-top: 1.5rem" onclick="Views.home.resumeScan()">
            Escanear siguiente
          </button>
        </div>
      </div>
    `;

    // Enqueue event automatically
    const event = {
      student_id: student.id,
      type: eventType,
      ts: timestamp,
      source: source,
      photo_ref: State.config.photoEnabled ? 'simulated.jpg' : null
    };
    State.enqueueEvent(event);
  }

  function showManualInput() {
    app.innerHTML = `
      <div class="camera-container">
        <div class="scan-input-modal">
          <div class="scan-input-header">⚠️ Cámara no disponible</div>
          <p style="margin-bottom: 1.5rem; color: var(--color-gray-500);">
            Ingresa el código manualmente para probar
          </p>
          <input type="text" id="scan-token-input" class="scan-input-field"
            placeholder="nfc_001, qr_011, nfc_teacher_001..."
            autofocus>
          <div class="scan-input-buttons">
            <button class="btn btn-primary btn-lg" onclick="Views.home.processManualInput()">
              Escanear
            </button>
            <button class="btn btn-secondary" onclick="Views.home.generateRandom()">
              Generar Aleatorio
            </button>
          </div>
          <div class="scan-help-text">
            <strong>Tokens de prueba:</strong><br>
            Alumnos: nfc_001, nfc_002, qr_011, qr_012<br>
            Profesores: nfc_teacher_001, nfc_teacher_002, qr_teacher_003
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
      UI.showToast('Ingresa un código', 'error');
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
    scanningState = 'ready';
    nfcSupported = 'NDEFReader' in window; // Re-check NFC support
    renderCamera();
  };

  // Cleanup on navigation
  window.addEventListener('hashchange', function cleanup() {
    stopCamera();
    stopNFC();
    window.removeEventListener('hashchange', cleanup);
  });

  renderCamera();
};
