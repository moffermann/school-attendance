// Scan result and confirmation with live camera or audio recording
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

  // Get evidence preference: "photo", "audio", or "none"
  const evidencePreference = State.getEvidencePreference(studentId);
  const photoEnabled = State.config.photoEnabled && evidencePreference === 'photo';
  const audioEnabled = State.config.photoEnabled && evidencePreference === 'audio';

  let video = null;
  let canvas = null;
  let canvasContext = null;
  let photoDataUrl = null;

  // Audio recording state
  let mediaRecorder = null;
  let audioChunks = [];
  let audioBlob = null;
  let isRecording = false;
  let recordingStartTime = null;
  const MAX_AUDIO_DURATION = 10000; // 10 seconds max

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
            <div class="school-name">${UI.escapeHtml(State.config.schoolName) || 'Colegio'}</div>
            <div class="student-course">${UI.escapeHtml(student.course_id)}° Básico</div>
          </div>

          <!-- Layout de 2 columnas para tablet -->
          <div class="result-content-grid">
            <!-- Columna izquierda: Info del alumno -->
            <div class="result-left-column">
              <!-- Mensaje de bienvenida con nombre del alumno -->
              <div class="welcome-section">
                <div class="welcome-icon-large">${isEntry ? '👋' : '🎒'}</div>
                <div class="welcome-greeting">${messageText}</div>
                <div class="welcome-student-name">${UI.escapeHtml(student.full_name)}</div>
                <div class="welcome-guardian">Apoderado: ${UI.escapeHtml(student.guardian_name) || 'No registrado'}</div>
              </div>

              <!-- Fecha y hora destacadas -->
              <div class="datetime-highlight ${isEntry ? 'dt-entry' : 'dt-exit'}">
                <div class="datetime-label">${isEntry ? 'Hora de Ingreso' : 'Hora de Salida'}</div>
                <div class="datetime-time" id="live-time">${formatTime(timestamp)}</div>
                <div class="datetime-date">${formatDate(timestamp)}</div>
              </div>
            </div>

            <!-- Columna derecha: Evidencia y botón -->
            <div class="result-right-column">
              ${photoEnabled ? `
                <div class="evidence-section">
                  <div class="evidence-label">📷 Captura de Evidencia</div>
                  <div class="camera-preview-container">
                    <video id="evidence-video" class="evidence-video" autoplay playsinline></video>
                    <canvas id="evidence-canvas" class="evidence-canvas"></canvas>
                    <img id="captured-photo" class="captured-photo hidden" alt="Foto capturada">
                  </div>
                </div>
              ` : ''}

              ${audioEnabled ? `
                <div class="evidence-section">
                  <div class="evidence-label">🎤 Grabación de Audio</div>
                  <div class="audio-record-container">
                    <div id="audio-status" class="audio-status">
                      <span class="audio-icon">🎤</span>
                      <span class="audio-text">Presiona para grabar</span>
                    </div>
                    <button id="audio-record-btn" class="btn btn-audio-record" onclick="Views.scanResult.toggleRecording()" aria-label="Grabar audio">
                      <span class="record-icon">⏺</span>
                      <span class="record-text">Grabar</span>
                    </button>
                    <div id="audio-timer" class="audio-timer hidden">00:00</div>
                    <audio id="audio-preview" class="audio-preview hidden" controls></audio>
                  </div>
                </div>
              ` : ''}

              <!-- Botón de confirmación -->
              <button class="btn ${buttonClass} btn-xl btn-confirm-main" onclick="Views.scanResult.confirm()" aria-label="Confirmar ${actionText}">
                ✓ Confirmar ${actionText}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Start live clock update
    startLiveClock();

    // Start camera for evidence if enabled and student consents
    if (photoEnabled) {
      startEvidenceCamera();
    }

    // Initialize audio recording if enabled
    if (audioEnabled) {
      initAudioRecording();
    }
  }

  let clockInterval = null;

  function startLiveClock() {
    const timeElement = document.getElementById('live-time');
    if (!timeElement) return;

    // Prevent multiple intervals
    if (clockInterval) {
      clearInterval(clockInterval);
    }

    clockInterval = setInterval(() => {
      // Check if element still exists (view may have changed)
      const el = document.getElementById('live-time');
      if (!el) {
        clearInterval(clockInterval);
        clockInterval = null;
        return;
      }
      el.textContent = formatTime(new Date());
    }, 1000);
  }

  function stopLiveClock() {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  }

  let cameraInitializing = false;

  async function startEvidenceCamera() {
    video = document.getElementById('evidence-video');
    canvas = document.getElementById('evidence-canvas');

    if (!video || !canvas) return;

    // Prevent race condition: don't initialize if already active or initializing
    if (video.srcObject) {
      console.log('Camera already active');
      return;
    }
    if (cameraInitializing) {
      console.log('Camera initialization already in progress');
      return;
    }

    cameraInitializing = true;
    canvasContext = canvas.getContext('2d');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });

      // Check if video element still exists (view may have changed during async)
      video = document.getElementById('evidence-video');
      if (!video) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

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
    } finally {
      cameraInitializing = false;
    }
  }

  // Audio recording functions
  let audioTimerInterval = null;

  async function initAudioRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audioPreview = document.getElementById('audio-preview');
        if (audioPreview) {
          audioPreview.src = audioUrl;
          audioPreview.classList.remove('hidden');
        }
        updateAudioStatus('recorded');
      };

      updateAudioStatus('ready');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      const container = document.querySelector('.audio-record-container');
      if (container) {
        container.innerHTML = `
          <div class="audio-error">
            <span>🎤</span>
            <p>Micrófono no disponible</p>
          </div>
        `;
      }
    }
  }

  function updateAudioStatus(status) {
    const statusEl = document.getElementById('audio-status');
    const btnEl = document.getElementById('audio-record-btn');
    const timerEl = document.getElementById('audio-timer');

    if (!statusEl || !btnEl) return;

    switch (status) {
      case 'ready':
        statusEl.innerHTML = '<span class="audio-icon">🎤</span><span class="audio-text">Listo para grabar</span>';
        btnEl.innerHTML = '<span class="record-icon">⏺</span><span class="record-text">Grabar</span>';
        btnEl.classList.remove('recording');
        if (timerEl) timerEl.classList.add('hidden');
        break;
      case 'recording':
        statusEl.innerHTML = '<span class="audio-icon recording-pulse">🔴</span><span class="audio-text">Grabando...</span>';
        btnEl.innerHTML = '<span class="record-icon">⏹</span><span class="record-text">Detener</span>';
        btnEl.classList.add('recording');
        if (timerEl) timerEl.classList.remove('hidden');
        break;
      case 'recorded':
        statusEl.innerHTML = '<span class="audio-icon">✅</span><span class="audio-text">Audio grabado</span>';
        btnEl.innerHTML = '<span class="record-icon">🔄</span><span class="record-text">Regrabar</span>';
        btnEl.classList.remove('recording');
        if (timerEl) timerEl.classList.add('hidden');
        break;
    }
  }

  function startAudioTimer() {
    const timerEl = document.getElementById('audio-timer');
    if (!timerEl) return;

    recordingStartTime = Date.now();

    audioTimerInterval = setInterval(() => {
      const elapsed = Date.now() - recordingStartTime;
      const seconds = Math.floor(elapsed / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      // Auto-stop at max duration
      if (elapsed >= MAX_AUDIO_DURATION) {
        Views.scanResult.toggleRecording();
      }
    }, 100);
  }

  function stopAudioTimer() {
    if (audioTimerInterval) {
      clearInterval(audioTimerInterval);
      audioTimerInterval = null;
    }
  }

  Views.scanResult.toggleRecording = function() {
    if (!mediaRecorder) return;

    if (isRecording) {
      // Stop recording
      mediaRecorder.stop();
      isRecording = false;
      stopAudioTimer();
    } else {
      // Start recording (clear previous)
      audioChunks = [];
      audioBlob = null;
      const audioPreview = document.getElementById('audio-preview');
      if (audioPreview) {
        audioPreview.classList.add('hidden');
        audioPreview.src = '';
      }

      mediaRecorder.start();
      isRecording = true;
      updateAudioStatus('recording');
      startAudioTimer();
    }
  };

  function stopAudioRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
    }
    stopAudioTimer();
    if (mediaRecorder && mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
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

    // Quality 0.6 reduces file size ~40% vs 0.8 with minimal visible difference
    return canvas.toDataURL('image/jpeg', 0.6);
  }

  function stopCamera() {
    // F2 fix: properly cleanup camera including race condition during init
    cameraInitializing = false;  // Cancel any pending initialization
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  }

  Views.scanResult.confirm = function() {
    const confirmTimestamp = new Date();
    const isEntry = eventType === 'IN';

    if (photoEnabled && video && video.srcObject) {
      photoDataUrl = capturePhoto();

      if (photoDataUrl) {
        // Show fullscreen photo with zoom effect
        showPhotoOverlay(photoDataUrl, confirmTimestamp, isEntry);
      }
    }

    // Stop audio recording if in progress
    if (audioEnabled && isRecording) {
      Views.scanResult.toggleRecording();
    }

    stopCamera();
    stopAudioRecording();
    stopLiveClock();

    // Convert audio blob to base64 if exists
    let audioDataUrl = null;
    if (audioBlob) {
      const reader = new FileReader();
      reader.onloadend = function() {
        audioDataUrl = reader.result;
        enqueueEventWithData(confirmTimestamp, photoDataUrl, audioDataUrl);
      };
      reader.readAsDataURL(audioBlob);
    } else {
      enqueueEventWithData(confirmTimestamp, photoDataUrl, null);
    }

    // Delay navigation to show the photo/audio confirmation effect
    const delay = photoDataUrl ? 3500 : (audioBlob ? 2000 : 1500);
    setTimeout(function() {
      // Remove overlay if exists
      const overlay = document.querySelector('.photo-fullscreen-overlay');
      if (overlay) {
        overlay.remove();
      }
      Router.navigate('/home');
    }, delay);
  };

  function enqueueEventWithData(confirmTimestamp, photoData, audioData) {
    const event = {
      student_id: studentId,
      type: eventType,
      ts: confirmTimestamp.toISOString(),
      source: source,
      photo_ref: photoData ? `photo_${Date.now()}.jpg` : null,
      photo_data: photoData || null,
      audio_ref: audioData ? `audio_${Date.now()}.webm` : null,
      audio_data: audioData || null
    };

    State.enqueueEvent(event);
  }

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
    stopAudioRecording();
    stopLiveClock();
    Router.navigate('/home');
  };

  window.addEventListener('hashchange', function cleanup() {
    stopCamera();
    stopAudioRecording();
    stopLiveClock();
    window.removeEventListener('hashchange', cleanup);
  });

  render();
};
