// Home view - Real QR scanner with camera
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

  function renderCamera() {
    app.innerHTML = `
      <div class="qr-scanner-container">
        <video id="qr-video" class="qr-video" autoplay playsinline></video>
        <canvas id="qr-canvas" class="qr-canvas"></canvas>
        <div class="qr-overlay">
          <div class="qr-frame">
            <div class="qr-corner qr-corner-tl"></div>
            <div class="qr-corner qr-corner-tr"></div>
            <div class="qr-corner qr-corner-bl"></div>
            <div class="qr-corner qr-corner-br"></div>
          </div>
          <div class="qr-instruction">
            Acerca el código QR a la cámara
          </div>
        </div>
      </div>
    `;

    video = document.getElementById('qr-video');
    canvas = document.getElementById('qr-canvas');
    canvasContext = canvas.getContext('2d');

    startCamera();
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
        processQRCode(code.data);
        return;
      }
    }

    animationFrame = requestAnimationFrame(scanQRCode);
  }

  function processQRCode(token) {
    console.log('QR detected:', token);

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
      // Teacher detected - stop camera and navigate
      stopCamera();
      Router.navigate('/admin-panel');
    } else if (result.type === 'student') {
      // Student detected - show welcome
      scanningState = 'showing_result';
      stopCamera();
      renderResult(result.data);
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

  function renderResult(student) {
    const eventType = State.nextEventTypeFor(student.id);
    const timestamp = new Date().toISOString();

    app.innerHTML = `
      <div class="welcome-screen">
        <div class="welcome-card">
          <div class="capture-flash"></div>
          <img src="assets/placeholder_photo.jpg" alt="Foto" class="welcome-photo">
          <div class="welcome-name">${student.full_name}</div>
          <div class="welcome-message">${eventType === 'IN' ? '¡Bienvenido!' : '¡Hasta pronto!'}</div>
          <div class="welcome-time">${UI.formatTime(timestamp)}</div>
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
      source: 'QR',
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

    processQRCode(token);
  };

  Views.home.generateRandom = function() {
    const validTokens = State.tags.filter(t => t.status === 'ACTIVE' && t.student_id);
    const randomTag = validTokens[Math.floor(Math.random() * validTokens.length)];
    document.getElementById('scan-token-input').value = randomTag.token;
  };

  Views.home.resumeScan = function() {
    scanningState = 'ready';
    renderCamera();
  };

  // Cleanup on navigation
  window.addEventListener('hashchange', function cleanup() {
    stopCamera();
    window.removeEventListener('hashchange', cleanup);
  });

  renderCamera();
};
