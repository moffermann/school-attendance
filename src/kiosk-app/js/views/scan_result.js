// Scan result and confirmation with live camera
Views.scanResult = function() {
  const app = document.getElementById('app');
  const params = Router.getQueryParams();
  const studentId = parseInt(params.student_id);
  const source = params.source || 'QR';

  const student = State.students.find(s => s.id === studentId);
  if (!student) {
    Router.navigate('/home');
    return;
  }

  // Determine event type based on today's records (no manual selection)
  const eventType = State.nextEventTypeFor(studentId);
  const timestamp = new Date();

  let video = null;
  let canvas = null;
  let canvasContext = null;
  let photoDataUrl = null;

  // Format date and time
  function formatDate(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-CL', options);
  }

  function formatTime(date) {
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function render() {
    const isEntry = eventType === 'IN';
    const actionText = isEntry ? 'Ingreso' : 'Salida';
    const messageText = isEntry ? '¡Bienvenido!' : '¡Hasta pronto!';
    const buttonClass = isEntry ? 'btn-success' : 'btn-error';

    app.innerHTML = `
      <div class="scan-result-screen ${isEntry ? 'screen-entry' : 'screen-exit'}">
        <div class="scan-result-card">
          <!-- Botón volver -->
          <button class="back-btn" onclick="Views.scanResult.cancel()" aria-label="Volver">
            &#10094;
          </button>

          <!-- Header con nombre del colegio -->
          <div class="result-header">
            <div class="school-name">${State.config.schoolName || 'Colegio'}</div>
            <div class="student-course">${student.course_id}° Básico</div>
          </div>

          <!-- Layout de 2 columnas para tablet -->
          <div class="result-content-grid">
            <!-- Columna izquierda: Info del alumno -->
            <div class="result-left-column">
              <!-- Mensaje de bienvenida con nombre del alumno -->
              <div class="welcome-section">
                <div class="welcome-icon-large">${isEntry ? '👋' : '🎒'}</div>
                <div class="welcome-greeting">${messageText}</div>
                <div class="welcome-student-name">${student.full_name}</div>
                <div class="welcome-guardian">Apoderado: ${student.guardian_name || 'No registrado'}</div>
              </div>

              <!-- Fecha y hora destacadas -->
              <div class="datetime-highlight ${isEntry ? 'dt-entry' : 'dt-exit'}">
                <div class="datetime-label">${isEntry ? 'Hora de Ingreso' : 'Hora de Salida'}</div>
                <div class="datetime-time" id="live-time">${formatTime(timestamp)}</div>
                <div class="datetime-date">${formatDate(timestamp)}</div>
              </div>
            </div>

            <!-- Columna derecha: Cámara y botón -->
            <div class="result-right-column">
              ${State.config.photoEnabled ? `
                <div class="evidence-section">
                  <div class="evidence-label">📷 Captura de Evidencia</div>
                  <div class="camera-preview-container">
                    <video id="evidence-video" class="evidence-video" autoplay playsinline></video>
                    <canvas id="evidence-canvas" class="evidence-canvas"></canvas>
                    <img id="captured-photo" class="captured-photo hidden" alt="Foto capturada">
                  </div>
                </div>
              ` : ''}

              <!-- Botón de confirmación -->
              <button class="btn ${buttonClass} btn-xl btn-confirm-main" onclick="Views.scanResult.confirm()">
                ✓ Confirmar ${actionText}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Start live clock update
    startLiveClock();

    // Start camera for evidence if enabled
    if (State.config.photoEnabled) {
      startEvidenceCamera();
    }
  }

  let clockInterval = null;

  function startLiveClock() {
    const timeElement = document.getElementById('live-time');
    if (!timeElement) return;

    clockInterval = setInterval(() => {
      timeElement.textContent = formatTime(new Date());
    }, 1000);
  }

  function stopLiveClock() {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  }

  async function startEvidenceCamera() {
    video = document.getElementById('evidence-video');
    canvas = document.getElementById('evidence-canvas');

    if (!video || !canvas) return;

    canvasContext = canvas.getContext('2d');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });

      video.srcObject = stream;
      video.play();
    } catch (err) {
      console.error('Error accessing camera for evidence:', err);
      const container = document.querySelector('.camera-preview-container');
      if (container) {
        container.innerHTML = `
          <div class="camera-error">
            <span>📷</span>
            <p>Cámara no disponible</p>
          </div>
        `;
      }
    }
  }

  // Camera shutter sound - real audio file
  function playCameraSound() {
    try {
      const audio = new Audio('assets/camera-shutter-sound.mp3');
      audio.volume = 1.0;
      audio.play().catch(e => console.log('Could not play sound:', e));
    } catch (e) {
      console.log('Could not play camera sound:', e);
    }
  }

  function capturePhoto() {
    if (!video || !canvas || !canvasContext) return null;

    // Play shutter sound
    playCameraSound();

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  function stopCamera() {
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
  }

  Views.scanResult.confirm = function() {
    const confirmTimestamp = new Date();
    const isEntry = eventType === 'IN';

    if (State.config.photoEnabled && video && video.srcObject) {
      photoDataUrl = capturePhoto();

      if (photoDataUrl) {
        // Show fullscreen photo with zoom effect
        showPhotoOverlay(photoDataUrl, confirmTimestamp, isEntry);
      }
    }

    stopCamera();
    stopLiveClock();

    const event = {
      student_id: studentId,
      type: eventType,
      ts: confirmTimestamp.toISOString(),
      source: source,
      photo_ref: photoDataUrl ? `photo_${Date.now()}.jpg` : null
    };

    State.enqueueEvent(event);

    // Delay navigation to show the photo effect
    const delay = photoDataUrl ? 3500 : 1500;
    setTimeout(function() {
      // Remove overlay if exists
      const overlay = document.querySelector('.photo-fullscreen-overlay');
      if (overlay) {
        overlay.remove();
      }
      Router.navigate('/home');
    }, delay);
  };

  function showPhotoOverlay(photoUrl, timestamp, isEntry) {
    // Create fullscreen overlay
    const overlay = document.createElement('div');
    overlay.className = 'photo-fullscreen-overlay';

    overlay.innerHTML = `
      <img src="${photoUrl}" class="photo-fullscreen-img" alt="Foto capturada">
      <div class="photo-timestamp ${isEntry ? 'timestamp-entry' : 'timestamp-exit'}">
        <div class="photo-timestamp-time">${formatTime(timestamp)}</div>
        <div class="photo-timestamp-date">${formatDate(timestamp)}</div>
      </div>
      <div class="photo-success-badge ${isEntry ? 'badge-entry' : 'badge-exit'}">
        <span class="success-icon">✓</span>
        <span class="success-text">${isEntry ? 'Ingreso Registrado' : 'Salida Registrada'}</span>
      </div>
    `;

    document.body.appendChild(overlay);

    // Trigger animation after a small delay for smoother effect
    setTimeout(() => {
      overlay.classList.add('active');
    }, 50);
  }

  Views.scanResult.cancel = function() {
    stopCamera();
    stopLiveClock();
    Router.navigate('/home');
  };

  window.addEventListener('hashchange', function cleanup() {
    stopCamera();
    stopLiveClock();
    window.removeEventListener('hashchange', cleanup);
  });

  render();
};
