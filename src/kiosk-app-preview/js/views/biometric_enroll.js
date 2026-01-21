// Biometric enrollment view for kiosk
// Allows authorized teachers to register student fingerprints
Views.biometricEnroll = function() {
  const app = document.getElementById('app');
  const params = Router.getQueryParams();
  // TDD-R6-BUG2/3 fix: Use parseInt with radix 10 and validate NaN
  const teacherId = parseInt(params.teacher_id, 10);

  // Validate teacherId before proceeding
  if (isNaN(teacherId)) {
    console.error('Invalid teacher_id parameter:', params.teacher_id);
    Router.navigate('/home');
    return;
  }

  let selectedStudent = null;
  let enrollInProgress = false;

  async function render() {
    // First check if teacher can enroll
    const canEnroll = await WebAuthn.canTeacherEnroll(teacherId);

    if (!canEnroll) {
      renderNoPermission();
      return;
    }

    renderEnrollUI();
  }

  function renderNoPermission() {
    app.innerHTML = `
      <div class="enroll-screen">
        <div class="enroll-card">
          <button class="back-btn" onclick="Router.navigate('/admin-panel')" aria-label="Volver">
            &#10094;
          </button>
          <div class="enroll-header">
            <div class="enroll-icon">🚫</div>
            <h1 class="enroll-title">Sin Permiso</h1>
            <p class="enroll-subtitle">
              No tienes autorización para registrar huellas digitales.
              Contacta al Director o Inspector para solicitar este permiso.
            </p>
          </div>
          <button class="btn btn-secondary btn-lg" onclick="Router.navigate('/admin-panel')">
            Volver al Panel
          </button>
        </div>
      </div>
    `;
  }

  function renderEnrollUI() {
    const supported = WebAuthn.isSupported();

    app.innerHTML = `
      <div class="enroll-screen">
        <div class="enroll-card enroll-card-wide">
          <button class="back-btn" onclick="Router.navigate('/admin-panel')" aria-label="Volver">
            &#10094;
          </button>
          <div class="enroll-header">
            <div class="enroll-icon">🖐️</div>
            <h1 class="enroll-title">Registro de Huella Digital</h1>
            <p class="enroll-subtitle">
              ${supported
                ? 'Selecciona un estudiante y registra su huella digital'
                : 'Este dispositivo no soporta registro biométrico'}
            </p>
          </div>

          ${supported ? `
            <!-- Two-column layout -->
            <div class="enroll-content-grid">
              <!-- Left: Student search -->
              <div class="enroll-left-column">
                <div class="search-section">
                  <label for="student-search" class="search-label">Buscar Estudiante</label>
                  <input type="text" id="student-search" class="search-input"
                         placeholder="Nombre o RUT del estudiante..."
                         oninput="Views.biometricEnroll.searchStudents(this.value)">
                </div>
                <div class="student-list" id="student-list">
                  <p class="student-list-hint">Ingresa un nombre para buscar</p>
                </div>
              </div>

              <!-- Right: Enrollment area -->
              <div class="enroll-right-column">
                <div class="selected-student-area" id="selected-student-area">
                  <div class="no-selection">
                    <div class="no-selection-icon">👆</div>
                    <p>Selecciona un estudiante de la lista</p>
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div class="enroll-unsupported">
              <p>Por favor usa un dispositivo compatible para registrar huellas.</p>
              <button class="btn btn-secondary btn-lg" onclick="Router.navigate('/admin-panel')">
                Volver al Panel
              </button>
            </div>
          `}

          <!-- Status area -->
          <div class="enroll-status" id="enroll-status"></div>
        </div>
      </div>
    `;
  }

  function showStatus(type, message) {
    const statusEl = document.getElementById('enroll-status');
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

      // Auto-clear non-error messages
      if (type !== 'error' && type !== 'loading') {
        setTimeout(() => {
          statusEl.innerHTML = '';
        }, 5000);
      }
    }
  }

  Views.biometricEnroll.searchStudents = function(query) {
    const listEl = document.getElementById('student-list');
    if (!listEl) return;

    if (!query || query.length < 2) {
      listEl.innerHTML = '<p class="student-list-hint">Ingresa al menos 2 caracteres</p>';
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = State.students.filter(s =>
      s.full_name.toLowerCase().includes(lowerQuery) ||
      (s.national_id && s.national_id.includes(query))
    ).slice(0, 10); // Limit to 10 results

    if (matches.length === 0) {
      listEl.innerHTML = '<p class="student-list-hint">No se encontraron estudiantes</p>';
      return;
    }

    listEl.innerHTML = matches.map(student => `
      <div class="student-list-item" onclick="Views.biometricEnroll.selectStudent(${student.id})">
        <div class="student-list-name">${student.full_name}</div>
        <div class="student-list-info">${student.course_id}° - ${student.national_id || 'Sin ID'}</div>
      </div>
    `).join('');
  };

  Views.biometricEnroll.selectStudent = async function(studentId) {
    selectedStudent = State.students.find(s => s.id === studentId);
    if (!selectedStudent) return;

    const areaEl = document.getElementById('selected-student-area');
    if (!areaEl) return;

    // Check if student already has biometric
    const biometricStatus = await WebAuthn.checkStudentBiometric(studentId);

    areaEl.innerHTML = `
      <div class="selected-student">
        <div class="student-avatar">
          ${selectedStudent.photo_url
            ? `<img src="${selectedStudent.photo_url}" alt="Foto" onerror="this.parentElement.innerHTML='<span class=\\'avatar-placeholder\\'>👤</span>'">`
            : '<span class="avatar-placeholder">👤</span>'
          }
        </div>
        <div class="student-info">
          <div class="student-name-large">${selectedStudent.full_name}</div>
          <div class="student-details">${selectedStudent.course_id}° Básico</div>
          ${biometricStatus.hasBiometric
            ? `<div class="biometric-badge biometric-registered">
                 ✅ ${biometricStatus.count} huella(s) registrada(s)
               </div>`
            : `<div class="biometric-badge biometric-not-registered">
                 ⚠️ Sin huella registrada
               </div>`
          }
        </div>
      </div>

      <div class="enroll-actions">
        <button class="btn btn-primary btn-lg btn-enroll"
                id="enroll-btn"
                onclick="Views.biometricEnroll.startEnrollment()">
          🖐️ Registrar Huella
        </button>
        ${biometricStatus.hasBiometric ? `
          <p class="enroll-note">Agregar una nueva huella mantendrá las anteriores</p>
        ` : ''}
      </div>

      <div class="fingerprint-guide" id="fingerprint-guide" style="display: none;">
        <div class="fingerprint-sensor sensor-enrollment" id="fingerprint-sensor">
          <div class="fingerprint-icon">🖐️</div>
          <div class="fingerprint-pulse"></div>
        </div>
        <p class="guide-text" id="guide-text">Preparando sensor...</p>
      </div>
    `;
  };

  Views.biometricEnroll.startEnrollment = async function() {
    if (!selectedStudent || enrollInProgress) return;
    enrollInProgress = true;

    const btn = document.getElementById('enroll-btn');
    const guide = document.getElementById('fingerprint-guide');

    // Hide button, show guide
    if (btn) btn.style.display = 'none';
    if (guide) guide.style.display = 'block';

    updateEnrollState('waiting', 'Coloca el dedo del estudiante en el sensor...');
    showStatus('loading', 'Iniciando registro...');

    try {
      const result = await WebAuthn.registerStudent(
        selectedStudent.id,
        `Kiosk ${State.device.device_id || 'Principal'}`
      );

      if (result.success) {
        updateEnrollState('success', '¡Huella registrada correctamente!');
        showStatus('success', `Huella de ${selectedStudent.full_name} registrada exitosamente`);

        // Play success feedback
        playSuccessFeedback();

        // Refresh the selected student display
        setTimeout(() => {
          Views.biometricEnroll.selectStudent(selectedStudent.id);
          enrollInProgress = false;
        }, 2000);
      } else {
        updateEnrollState('error', result.error || 'Error al registrar');
        showStatus('error', result.error || 'No se pudo registrar la huella');

        // Reset UI
        setTimeout(() => {
          if (btn) btn.style.display = 'block';
          if (guide) guide.style.display = 'none';
          enrollInProgress = false;
        }, 3000);
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      updateEnrollState('error', 'Error durante el registro');
      showStatus('error', 'Error inesperado durante el registro');

      setTimeout(() => {
        if (btn) btn.style.display = 'block';
        if (guide) guide.style.display = 'none';
        enrollInProgress = false;
      }, 3000);
    }
  };

  function updateEnrollState(state, message) {
    const sensor = document.getElementById('fingerprint-sensor');
    const guideText = document.getElementById('guide-text');

    if (sensor) {
      sensor.className = 'fingerprint-sensor sensor-enrollment';
      sensor.classList.add(`sensor-${state}`);
    }

    if (guideText) {
      guideText.textContent = message;
    }
  }

  // R9-K3 fix: Close AudioContext after use to prevent memory leak
  function playSuccessFeedback() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Two-tone success sound
      oscillator.frequency.value = 523; // C5
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.15); // E5
      oscillator.stop(audioContext.currentTime + 0.3);

      // R9-K3 fix: Close AudioContext after sound finishes
      oscillator.onended = () => {
        audioContext.close();
      };
    } catch (e) {
      console.log('Audio not available:', e);
    }

    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }

  render();
};
