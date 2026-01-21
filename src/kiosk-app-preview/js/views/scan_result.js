// Scan result and confirmation - Redesign 2026
// Preserves all existing functionality with new visual design
// Supports both tablet (large screen) and mobile (small screen) layouts
Views.scanResult = function() {
  const app = document.getElementById('app');
  const params = Router.getQueryParams();
  // TDD-R4-BUG3/5 fix: Use parseInt with radix 10 and validate NaN
  const studentId = parseInt(params.student_id, 10);
  const source = params.source || 'QR';

  // Validate studentId is a valid number
  if (isNaN(studentId)) {
    console.error('Invalid student_id parameter:', params.student_id);
    Router.navigate('/home');
    return;
  }

  const student = State.students.find(s => s.id === studentId);
  if (!student) {
    Router.navigate('/home');
    return;
  }

  // Determine event type based on today's records (no manual selection)
  const eventType = State.nextEventTypeFor(studentId);
  const timestamp = new Date();

  // Detect mobile viewport (based on approved mobile design max-width 450px)
  function isMobileViewport() {
    return window.innerWidth <= 500;
  }

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
  let audioObjectUrl = null;  // R3-R1 fix: Track Object URL for cleanup
  let isRecording = false;
  let recordingStartTime = null;
  const MAX_AUDIO_DURATION = 10000; // 10 seconds max

  // Countdown state
  let countdownInterval = null;
  let countdownSeconds = 0;

  // Format date and time
  function formatDate(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-CL', options);
  }

  function formatTime(date) {
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // Default placeholder as data URL (SVG) - guaranteed to never fail
  const PLACEHOLDER_DATA_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23475569' width='100' height='100'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%2394a3b8'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='24' fill='%2394a3b8'/%3E%3C/svg%3E";

  // Check if URL looks valid (not empty, not just whitespace, not 'null'/'undefined')
  function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
    return true;
  }

  // Get student photo URL - returns placeholder for initial render
  // The real photo will be loaded async with authentication
  function getStudentPhotoUrl() {
    // Always return placeholder for initial render
    // Real photo loaded via loadAuthenticatedPhoto() after render
    return PLACEHOLDER_DATA_URL;
  }

  // Get the raw student photo URL (for authenticated loading)
  function getStudentPhotoRawUrl() {
    if (isValidUrl(student.photo_url)) return student.photo_url;
    if (isValidUrl(student.photo)) return student.photo;
    return null;
  }

  // Load student photo with device key authentication
  async function loadAuthenticatedPhoto() {
    const photoUrl = getStudentPhotoRawUrl();
    console.log('[Photo Debug] Student data:', {
      id: student.id,
      name: student.full_name,
      photo_url: student.photo_url,
      photo: student.photo,
      course_name: student.course_name,
      course_id: student.course_id
    });
    console.log('[Photo Debug] Raw photo URL:', photoUrl);

    if (!photoUrl) {
      console.log('[Photo Debug] No photo URL found, keeping placeholder');
      return; // No photo to load
    }

    const imgElement = document.getElementById('student-photo');
    if (!imgElement) {
      console.log('[Photo Debug] Image element not found');
      return;
    }

    // Check if Sync module has the image loading function
    // Use typeof check to handle both global and window.Sync cases
    const syncAvailable = typeof Sync !== 'undefined' && typeof Sync.loadImageWithDeviceKey === 'function';
    console.log('[Photo Debug] Sync module check:', {
      syncDefined: typeof Sync !== 'undefined',
      windowSyncDefined: typeof window.Sync !== 'undefined',
      hasLoadImageFn: syncAvailable
    });

    if (syncAvailable) {
      try {
        console.log('[Photo Debug] Loading with device key authentication...');
        const blobUrl = await Sync.loadImageWithDeviceKey(photoUrl);
        console.log('[Photo Debug] Blob URL result:', blobUrl ? 'success' : 'null');
        if (blobUrl && imgElement) {
          imgElement.src = blobUrl;
          console.log('[Photo Debug] Photo loaded successfully');
        } else {
          console.log('[Photo Debug] Blob URL was null, keeping placeholder');
        }
      } catch (err) {
        console.error('[Photo Debug] Failed to load authenticated photo:', err);
        // Keep placeholder on error
      }
    } else {
      // Fallback: try direct URL (may work for public photos)
      console.log('[Photo Debug] Sync not available, trying direct URL (will likely fail without auth)');
      imgElement.src = photoUrl;
      // Add error handler for when direct URL fails
      imgElement.onerror = function() {
        console.log('[Photo Debug] Direct URL failed, reverting to placeholder');
        handlePhotoError(imgElement);
      };
    }
  }

  // Handle image load error - use data URL as final fallback to prevent infinite loops
  function handlePhotoError(imgElement) {
    if (imgElement.dataset.errorHandled) return; // Prevent infinite loop
    imgElement.dataset.errorHandled = 'true';
    imgElement.src = PLACEHOLDER_DATA_URL;
  }

  // Dark mode toggle
  function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      icon.textContent = document.documentElement.classList.contains('dark')
        ? 'light_mode'
        : 'dark_mode';
    }
    // Persist preference
    try {
      localStorage.setItem('kiosk-dark-mode', document.documentElement.classList.contains('dark'));
    } catch (e) {}
  }

  // Apply saved dark mode preference
  function applyDarkModePreference() {
    try {
      const savedPref = localStorage.getItem('kiosk-dark-mode');
      if (savedPref === 'true') {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  }

  // Countdown SVG circle (tablet layout)
  function createCountdownCircle(seconds, total) {
    const circumference = 2 * Math.PI * 28;
    const offset = circumference - (seconds / total) * circumference;
    return `
      <svg class="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" stroke-width="4" fill="none"
                class="countdown-bg-circle" />
        <circle cx="32" cy="32" r="28" stroke-width="4" fill="none"
                class="countdown-progress-circle"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
      </svg>
      <span class="countdown-seconds">${seconds}</span>
    `;
  }

  // Mobile progress bar countdown
  function updateMobileProgressBar(seconds, total) {
    const progressBar = document.getElementById('mobile-progress-fill');
    const timerText = document.getElementById('mobile-timer-text');
    if (progressBar) {
      const percentage = (seconds / total) * 100;
      progressBar.style.width = `${percentage}%`;
    }
    if (timerText) {
      timerText.textContent = `${seconds}s`;
    }
  }

  // Start countdown timer
  function startCountdown() {
    const totalSeconds = Math.floor((State.config.autoResumeDelay || 8000) / 1000);
    countdownSeconds = totalSeconds;
    const isMobile = isMobileViewport();

    if (isMobile) {
      // Mobile: use progress bar
      updateMobileProgressBar(totalSeconds, totalSeconds);
    } else {
      // Tablet: use circular countdown
      const container = document.getElementById('countdown-container');
      if (container) {
        container.innerHTML = createCountdownCircle(totalSeconds, totalSeconds);
      }
    }

    // Update every second
    countdownInterval = setInterval(() => {
      countdownSeconds--;

      if (countdownSeconds <= 0) {
        stopCountdown();
        cleanup();
        Router.navigate('/home');
        return;
      }

      if (isMobile) {
        updateMobileProgressBar(countdownSeconds, totalSeconds);
      } else {
        const cont = document.getElementById('countdown-container');
        if (cont) {
          cont.innerHTML = createCountdownCircle(countdownSeconds, totalSeconds);
        }
      }
    }, 1000);
  }

  // Stop countdown
  function stopCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // Mobile layout render (based on kiosco-confirmacion-registro-celular.html)
  function renderMobile() {
    const isEntry = eventType === 'IN';
    const photoUrl = getStudentPhotoUrl();
    const totalSeconds = Math.floor((State.config.autoResumeDelay || 8000) / 1000);

    // Apply dark mode preference
    applyDarkModePreference();
    const isDark = document.documentElement.classList.contains('dark');

    // Split student name for mobile layout (first name / last name)
    const nameParts = (student.full_name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    app.innerHTML = `
      <div class="kiosk-mobile-container ${isDark ? 'dark' : ''}">
        <!-- Top Progress Bar -->
        <div class="mobile-progress-bar">
          <div id="mobile-progress-fill" class="mobile-progress-bar-fill" style="width: 100%;"></div>
        </div>

        <!-- Header with Logo and Timer -->
        <header class="mobile-header">
          <div class="mobile-header-logo">
            <div class="mobile-header-logo-icon">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 class="mobile-header-logo-text">NEUVOX</h2>
          </div>
          <div class="mobile-timer-badge">
            <span class="material-symbols-outlined">timer</span>
            <span id="mobile-timer-text" class="mobile-timer-badge-text">${totalSeconds}s</span>
          </div>
        </header>

        <!-- Main Content -->
        <main class="mobile-main-content">
          <!-- Student Profile -->
          <div class="mobile-student-profile">
            <div class="mobile-photo-container">
              <!-- Glow effect -->
              <div class="mobile-photo-glow"></div>
              <!-- Photo -->
              <div class="mobile-photo">
                <img id="student-photo"
                     src="${UI.escapeHtml(photoUrl)}"
                     alt="Foto de ${UI.escapeHtml(student.full_name)}"
                     style="width: 100%; height: 100%; object-fit: cover;"
                     onerror="Views.scanResult.handlePhotoError(this)" />
              </div>
            </div>
            <div class="mobile-student-info">
              <p class="mobile-student-status">Identificado</p>
              <h1 class="mobile-student-name">
                ${UI.escapeHtml(firstName)}<br/>${UI.escapeHtml(lastName)}
              </h1>
              <p class="mobile-student-id">${UI.escapeHtml(student.course_name || '')}</p>
            </div>
          </div>

          <!-- Action Button - Single button based on next expected event type -->
          <div class="mobile-action-buttons">
            ${isEntry ? `
            <!-- Entry Button -->
            <button class="mobile-action-btn mobile-action-btn-entry"
                    onclick="Views.scanResult.confirm()">
              <div class="mobile-action-btn-content">
                <span class="mobile-action-btn-label">Acción de Entrada</span>
                <span class="mobile-action-btn-text">REGISTRAR INGRESO</span>
              </div>
              <span class="material-symbols-outlined">login</span>
            </button>
            ` : `
            <!-- Exit Button -->
            <button class="mobile-action-btn mobile-action-btn-exit"
                    onclick="Views.scanResult.confirm()">
              <div class="mobile-action-btn-content">
                <span class="mobile-action-btn-label">Acción de Salida</span>
                <span class="mobile-action-btn-text">REGISTRAR SALIDA</span>
              </div>
              <span class="material-symbols-outlined">logout</span>
            </button>
            `}
          </div>

          <!-- Cancel -->
          <button class="mobile-cancel-btn" onclick="Views.scanResult.cancel()">
            <span class="material-symbols-outlined">close</span>
            <span class="mobile-cancel-btn-text">Cancelar Operación</span>
          </button>
        </main>

        <!-- Footer -->
        <footer class="mobile-footer">
          <div class="mobile-status-indicator">
            <span class="mobile-status-dot"></span>
            <span class="mobile-status-text">Sistema Conectado - Terminal ${UI.escapeHtml(State.device?.gate_id || '01')}</span>
          </div>
        </footer>
      </div>
    `;

    // Start countdown
    startCountdown();

    // Load authenticated photo
    loadAuthenticatedPhoto();
  }

  // Tablet layout render (original design)
  function render() {
    const isEntry = eventType === 'IN';
    const photoUrl = getStudentPhotoUrl();

    // Apply dark mode preference BEFORE rendering to prevent flickering
    applyDarkModePreference();
    const isDark = document.documentElement.classList.contains('dark');

    app.innerHTML = `
      <div class="kiosk-confirmation h-full min-h-screen flex flex-col items-center justify-center p-6 sm:p-12
                  ${isDark ? 'bg-kiosk-bg-dark' : 'bg-kiosk-bg-light'}">

        <!-- Header con logo NEUVOX (absolute + z-20 para estar encima del card) -->
        <div class="absolute top-10 left-10 flex items-center space-x-3 z-20">
          <div class="bg-kiosk-primary p-2 rounded-xl shadow-lg">
            <span class="material-symbols-rounded text-white text-3xl">school</span>
          </div>
          <span class="text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}">NEUVOX</span>
        </div>

        <!-- Toggle Dark Mode (absolute + z-20 para estar encima del card) -->
        <button class="absolute top-10 right-10 p-3 rounded-full transition-transform hover:scale-110 z-20
                       ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'}"
                onclick="Views.scanResult.toggleDarkMode()" aria-label="Cambiar tema">
          <span class="material-symbols-rounded" id="dark-mode-icon">
            ${isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <!-- Main Card (diseño aprobado) -->
        <main class="w-full max-w-4xl rounded-3xl shadow-heavy p-8 sm:p-12
                     flex flex-col items-center text-center
                     ${isDark ? 'bg-kiosk-card-dark' : 'bg-white'}">

          <!-- Foto con badge de verificación (diseño aprobado) -->
          <div class="relative mb-8">
            <div class="w-48 h-48 rounded-full border-8 overflow-hidden shadow-inner
                        ${isDark ? 'border-slate-800' : 'border-slate-100'}">
              <img id="student-photo"
                   src="${UI.escapeHtml(photoUrl)}"
                   alt="Foto de ${UI.escapeHtml(student.full_name)}"
                   class="w-full h-full object-cover"
                   loading="eager"
                   onerror="Views.scanResult.handlePhotoError(this)" />
            </div>
            <div class="absolute -bottom-2 -right-2 bg-kiosk-success text-white p-2 rounded-full shadow-lg border-4
                        ${isDark ? 'border-kiosk-card-dark' : 'border-white'}">
              <span class="material-symbols-rounded text-2xl">check_circle</span>
            </div>
          </div>

          <!-- Datos del estudiante (diseño aprobado) -->
          <div class="text-center mb-10">
            <h1 class="text-5xl font-extrabold uppercase mb-2 tracking-tight
                       ${isDark ? 'text-white' : 'text-slate-900'}">
              ${UI.escapeHtml(student.full_name)}
            </h1>
            <p class="text-2xl font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}">
              ${UI.escapeHtml(student.course_name || '')}
            </p>
            <!-- Badge verificación -->
            <div class="mt-6 inline-flex items-center space-x-2 px-6 py-2 rounded-full font-medium border
                        ${isDark ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}">
              <span class="material-symbols-rounded text-xl">verified</span>
              <span>Identidad Verificada Correctamente</span>
            </div>
          </div>

          <!-- Fecha y hora (responsive) -->
          <div class="text-center mb-4 sm:mb-6 md:mb-8">
            <div class="text-base sm:text-lg font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}" id="live-time">
              ${formatTime(timestamp)}
            </div>
            <div class="text-xs sm:text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}">
              ${formatDate(timestamp)}
            </div>
          </div>

          <!-- Sección de evidencia (foto/audio) si está habilitada -->
          ${photoEnabled ? `
            <div class="w-full max-w-md mb-8">
              <div class="evidence-label-new mb-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}">
                <span class="material-symbols-rounded text-lg align-middle">photo_camera</span>
                <span class="ml-2 text-sm font-medium">Captura de Evidencia</span>
              </div>
              <div class="camera-preview-new rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-gray-100'}">
                <video id="evidence-video" class="w-full h-32 object-cover" autoplay playsinline></video>
                <canvas id="evidence-canvas" class="hidden"></canvas>
              </div>
            </div>
          ` : ''}

          ${audioEnabled ? `
            <div class="w-full max-w-md mb-8">
              <div class="evidence-label-new mb-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}">
                <span class="material-symbols-rounded text-lg align-middle">mic</span>
                <span class="ml-2 text-sm font-medium">Grabación de Audio</span>
              </div>
              <div class="audio-controls-new flex items-center gap-4 p-4 rounded-2xl
                          ${isDark ? 'bg-slate-800' : 'bg-gray-100'}">
                <button id="audio-record-btn"
                        class="w-14 h-14 rounded-full flex items-center justify-center transition-all
                               ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-white hover:bg-gray-50'} shadow-lg"
                        onclick="Views.scanResult.toggleRecording()" aria-label="Grabar audio">
                  <span class="material-symbols-rounded text-2xl text-red-500" id="record-icon">mic</span>
                </button>
                <div class="flex-1">
                  <div id="audio-status" class="text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}">
                    Presiona para grabar
                  </div>
                  <div id="audio-timer" class="text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'} hidden">00:00</div>
                </div>
                <audio id="audio-preview" class="hidden" controls></audio>
              </div>
            </div>
          ` : ''}

          <!-- Botón de acción único (automático según último registro) -->
          <div class="w-full max-w-md">
            <button class="${isEntry ? 'bg-kiosk-success hover:bg-emerald-600' : 'bg-kiosk-warning hover:bg-orange-600'}
                           text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 w-full
                           flex flex-col items-center justify-center gap-3 sm:gap-4
                           transition-all active:scale-95 shadow-xl group"
                    onclick="Views.scanResult.confirm()">
              <span class="material-symbols-rounded text-5xl sm:text-6xl md:text-7xl group-hover:scale-110 transition-transform">
                ${isEntry ? 'login' : 'logout'}
              </span>
              <span class="text-xl sm:text-2xl md:text-3xl font-bold">
                ${isEntry ? 'CONFIRMAR INGRESO' : 'CONFIRMAR SALIDA'}
              </span>
            </button>
          </div>

          <!-- Countdown circular (responsive) -->
          <div class="mt-6 sm:mt-8 md:mt-10 flex flex-col items-center gap-1 sm:gap-2">
            <div id="countdown-container" class="countdown-circle-container relative flex items-center justify-center scale-75 sm:scale-90 md:scale-100">
              <!-- SVG rendered by startCountdown() -->
            </div>
            <p class="text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}">Volviendo al inicio</p>
          </div>

          <!-- Botón cancelar (responsive) -->
          <button class="mt-4 sm:mt-6 px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition-all text-sm sm:text-base
                         ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}"
                  onclick="Views.scanResult.cancel()">
            <span class="material-symbols-rounded align-middle mr-2">arrow_back</span>
            <span class="font-medium">Cancelar</span>
          </button>
        </main>
      </div>
    `;

    // Start live clock update
    startLiveClock();

    // Start countdown
    startCountdown();

    // Start camera for evidence if enabled
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
      const container = document.querySelector('.camera-preview-new');
      if (container) {
        container.innerHTML = `
          <div class="flex items-center justify-center h-32 text-slate-400">
            <span class="material-symbols-rounded text-3xl mr-2">no_photography</span>
            <span>Cámara no disponible</span>
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
        // R3-R1 fix: Revoke previous Object URL before creating new one
        if (audioObjectUrl) {
          URL.revokeObjectURL(audioObjectUrl);
        }
        audioObjectUrl = URL.createObjectURL(audioBlob);
        const audioPreview = document.getElementById('audio-preview');
        if (audioPreview) {
          audioPreview.src = audioObjectUrl;
          audioPreview.classList.remove('hidden');
        }
        updateAudioStatus('recorded');
      };

      updateAudioStatus('ready');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      const container = document.querySelector('.audio-controls-new');
      if (container) {
        container.innerHTML = `
          <div class="flex items-center justify-center w-full text-slate-400 py-4">
            <span class="material-symbols-rounded text-2xl mr-2">mic_off</span>
            <span>Micrófono no disponible</span>
          </div>
        `;
      }
    }
  }

  function updateAudioStatus(status) {
    const statusEl = document.getElementById('audio-status');
    const iconEl = document.getElementById('record-icon');
    const timerEl = document.getElementById('audio-timer');

    if (!statusEl) return;

    switch (status) {
      case 'ready':
        statusEl.textContent = 'Listo para grabar';
        if (iconEl) iconEl.textContent = 'mic';
        if (timerEl) timerEl.classList.add('hidden');
        break;
      case 'recording':
        statusEl.textContent = 'Grabando...';
        if (iconEl) {
          iconEl.textContent = 'stop';
          iconEl.classList.add('animate-pulse');
        }
        if (timerEl) timerEl.classList.remove('hidden');
        break;
      case 'recorded':
        statusEl.textContent = 'Audio grabado ✓';
        if (iconEl) {
          iconEl.textContent = 'refresh';
          iconEl.classList.remove('animate-pulse');
        }
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
    // R3-R1 fix: Revoke Object URL on cleanup
    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
      audioObjectUrl = null;
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

  // Register event (entry or exit)
  Views.scanResult.registerEvent = function(type) {
    // Stop countdown immediately
    stopCountdown();

    const confirmTimestamp = new Date();
    const mappedType = type === 'entry' ? 'IN' : 'OUT';

    if (photoEnabled && video && video.srcObject) {
      photoDataUrl = capturePhoto();

      if (photoDataUrl) {
        // Show fullscreen photo with zoom effect
        showPhotoOverlay(photoDataUrl, confirmTimestamp, type === 'entry');
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
        enqueueEventWithData(confirmTimestamp, mappedType, photoDataUrl, audioDataUrl);
      };
      reader.readAsDataURL(audioBlob);
    } else {
      enqueueEventWithData(confirmTimestamp, mappedType, photoDataUrl, null);
    }

    // Show toast
    UI.showToast(
      type === 'entry' ? 'Ingreso registrado correctamente' : 'Salida registrada correctamente',
      'success'
    );

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

  // Legacy confirm function for backwards compatibility
  Views.scanResult.confirm = function() {
    const isEntry = eventType === 'IN';
    Views.scanResult.registerEvent(isEntry ? 'entry' : 'exit');
  };

  function enqueueEventWithData(confirmTimestamp, type, photoData, audioData) {
    const event = {
      student_id: studentId,
      type: type,
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
    cleanup();
    Router.navigate('/home');
  };

  // Dark mode toggle exposed
  Views.scanResult.toggleDarkMode = toggleDarkMode;

  // Photo error handler exposed (prevents infinite onerror loops)
  Views.scanResult.handlePhotoError = handlePhotoError;

  // Cleanup function
  function cleanup() {
    stopCountdown();
    stopCamera();
    stopAudioRecording();
    stopLiveClock();
  }

  window.addEventListener('hashchange', function cleanupHandler() {
    cleanup();
    window.removeEventListener('hashchange', cleanupHandler);
  });

  // Choose layout based on viewport size
  if (isMobileViewport()) {
    renderMobile();
  } else {
    render();
    // Load the student photo with authentication after render (tablet only - mobile handles this internally)
    loadAuthenticatedPhoto();
  }
};
