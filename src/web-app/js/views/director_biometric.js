// Director Biometric Management
// Allows directors and inspectors to enroll and manage student biometric credentials
Views.directorBiometric = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Gestión Biométrica';

  const courses = State.getCourses();
  let filteredStudents = State.getStudents();
  let searchTerm = '';
  let selectedCourse = '';
  let selectedStudent = null;
  let studentCredentials = [];

  async function renderMain() {
    content.innerHTML = `
      <div class="biometric-container">
        <!-- Header with info -->
        <div class="card mb-2">
          <div class="card-body">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="font-size: 2.5rem;">🖐️</div>
              <div>
                <h3 style="margin: 0 0 0.25rem;">Registro de Huellas Digitales</h3>
                <p style="margin: 0; color: var(--color-gray-500);">
                  Registre las huellas digitales de los estudiantes para permitir autenticación biométrica en los kioscos.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="biometric-grid">
          <!-- Left: Student Search & List -->
          <div class="biometric-left">
            <div class="card">
              <div class="card-header">Seleccionar Alumno</div>
              <div class="card-body">
                <div class="filters" style="margin-bottom: 1rem;">
                  <div class="form-group" style="margin-bottom: 0.75rem;">
                    <input type="text" id="search-student" class="form-input"
                           placeholder="Buscar por nombre..." value="${searchTerm}"
                           oninput="Views.directorBiometric.filterStudents()">
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <select id="filter-course" class="form-select" onchange="Views.directorBiometric.filterStudents()">
                      <option value="">Todos los cursos</option>
                      ${courses.map(c => `<option value="${c.id}" ${selectedCourse == c.id ? 'selected' : ''}>${Components.escapeHtml(c.name)}</option>`).join('')}
                    </select>
                  </div>
                </div>

                <div class="student-list" id="student-list" style="max-height: 400px; overflow-y: auto;">
                  ${renderStudentList()}
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Enrollment Area -->
          <div class="biometric-right">
            <div class="card" id="enrollment-card">
              <div class="card-header">Registro Biométrico</div>
              <div class="card-body" id="enrollment-area">
                ${renderEnrollmentArea()}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    addStyles();
  }

  function renderStudentList() {
    if (filteredStudents.length === 0) {
      return `<div class="empty-list">No hay alumnos que coincidan con la búsqueda</div>`;
    }

    return filteredStudents.map(student => {
      const course = State.getCourse(student.course_id);
      const isSelected = selectedStudent && selectedStudent.id === student.id;
      // Check biometric status from local mock (would come from API in real implementation)
      const hasBiometric = student.has_biometric || false;

      return `
        <div class="student-list-item ${isSelected ? 'selected' : ''}"
             onclick="Views.directorBiometric.selectStudent(${student.id})">
          <div class="student-info">
            <div class="student-name">${Components.escapeHtml(student.full_name)}</div>
            <div class="student-course">${course ? Components.escapeHtml(course.name) : '-'}</div>
          </div>
          <div class="biometric-indicator ${hasBiometric ? 'has-biometric' : 'no-biometric'}">
            ${hasBiometric ? '🖐️' : '○'}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderEnrollmentArea() {
    if (!selectedStudent) {
      return `
        <div class="empty-enrollment">
          <div class="empty-icon">👆</div>
          <p>Seleccione un alumno de la lista para gestionar su registro biométrico</p>
        </div>
      `;
    }

    const course = State.getCourse(selectedStudent.course_id);
    const hasBiometric = selectedStudent.has_biometric || false;

    return `
      <div class="selected-student-info">
        <div class="student-avatar">
          ${selectedStudent.photo_ref
            ? `<img src="${selectedStudent.photo_ref}" alt="Foto">`
            : '<span class="avatar-placeholder">👤</span>'
          }
        </div>
        <div class="student-details">
          <h3 class="student-name-lg">${Components.escapeHtml(selectedStudent.full_name)}</h3>
          <div class="student-meta">${course ? Components.escapeHtml(course.name) : ''} ${selectedStudent.rut ? '| RUT: ' + selectedStudent.rut : ''}</div>
        </div>
      </div>

      <div class="biometric-status-card ${hasBiometric ? 'status-registered' : 'status-pending'}">
        <div class="status-icon">${hasBiometric ? '✅' : '⏳'}</div>
        <div class="status-text">
          <strong>${hasBiometric ? 'Biometría Registrada' : 'Sin Registro Biométrico'}</strong>
          <p>${hasBiometric
            ? `${studentCredentials.length} credencial(es) registrada(s)`
            : 'El alumno no tiene huellas digitales registradas'
          }</p>
        </div>
      </div>

      <div class="enrollment-actions">
        <button class="btn btn-primary btn-lg" id="start-enroll-btn"
                onclick="Views.directorBiometric.startEnrollment()">
          🖐️ ${hasBiometric ? 'Agregar Nueva Huella' : 'Registrar Huella Digital'}
        </button>

        ${hasBiometric ? `
          <button class="btn btn-secondary" onclick="Views.directorBiometric.viewCredentials()">
            📋 Ver Credenciales (${studentCredentials.length})
          </button>
          <button class="btn btn-error btn-sm" onclick="Views.directorBiometric.confirmDeleteAll()">
            🗑️ Eliminar Todas
          </button>
        ` : ''}
      </div>

      <div class="enrollment-guide" id="enrollment-guide" style="display: none;">
        <div class="fingerprint-sensor-container">
          <div class="fingerprint-sensor" id="fingerprint-sensor">
            <div class="fingerprint-icon">🖐️</div>
            <div class="fingerprint-pulse"></div>
          </div>
        </div>
        <p class="guide-text" id="guide-text">Coloque el dedo del alumno en el lector...</p>
        <button class="btn btn-secondary" onclick="Views.directorBiometric.cancelEnrollment()">
          Cancelar
        </button>
      </div>
    `;
  }

  Views.directorBiometric.filterStudents = function() {
    searchTerm = document.getElementById('search-student').value.toLowerCase();
    selectedCourse = document.getElementById('filter-course').value;

    filteredStudents = State.getStudents().filter(student => {
      if (searchTerm && !student.full_name.toLowerCase().includes(searchTerm)) {
        return false;
      }
      if (selectedCourse && student.course_id !== parseInt(selectedCourse)) {
        return false;
      }
      return true;
    });

    const listEl = document.getElementById('student-list');
    if (listEl) {
      listEl.innerHTML = renderStudentList();
    }
  };

  Views.directorBiometric.selectStudent = async function(studentId) {
    selectedStudent = State.getStudent(studentId);

    // Fetch credentials from API
    try {
      const response = await API.request(`/webauthn/admin/students/${studentId}/credentials`);
      if (response.ok) {
        const data = await response.json();
        studentCredentials = data.credentials || [];
        selectedStudent.has_biometric = studentCredentials.length > 0;
      } else {
        studentCredentials = [];
      }
    } catch (err) {
      console.error('Error fetching credentials:', err);
      studentCredentials = [];
    }

    // Re-render list to show selection
    const listEl = document.getElementById('student-list');
    if (listEl) {
      listEl.innerHTML = renderStudentList();
    }

    // Re-render enrollment area
    const enrollmentArea = document.getElementById('enrollment-area');
    if (enrollmentArea) {
      enrollmentArea.innerHTML = renderEnrollmentArea();
    }
  };

  Views.directorBiometric.startEnrollment = async function() {
    if (!selectedStudent) return;

    const btn = document.getElementById('start-enroll-btn');
    const guide = document.getElementById('enrollment-guide');

    if (btn) btn.style.display = 'none';
    if (guide) guide.style.display = 'block';

    updateEnrollState('waiting', 'Iniciando registro...');

    try {
      // Start enrollment via API
      const startResponse = await API.request(`/webauthn/admin/students/${selectedStudent.id}/register/start`, {
        method: 'POST',
        body: JSON.stringify({ device_name: 'Web Admin' }),
      });

      if (!startResponse.ok) {
        const error = await startResponse.json().catch(() => ({}));
        throw new Error(error.detail || 'Error al iniciar registro');
      }

      const { challenge_id, options } = await startResponse.json();

      updateEnrollState('waiting', 'Coloque el dedo del alumno en el lector biométrico...');

      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        throw new Error('Este navegador no soporta WebAuthn');
      }

      // Parse options and create credential
      const credential = await createCredential(options);

      if (!credential) {
        throw new Error('El usuario canceló el registro');
      }

      updateEnrollState('reading', 'Verificando huella...');

      // Complete enrollment
      const completeResponse = await API.request(`/webauthn/admin/students/${selectedStudent.id}/register/complete`, {
        method: 'POST',
        body: JSON.stringify({
          challenge_id: challenge_id,
          credential: credential,
        }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json().catch(() => ({}));
        throw new Error(error.detail || 'Error al completar registro');
      }

      updateEnrollState('success', '¡Huella registrada correctamente!');
      Components.showToast('Huella digital registrada exitosamente', 'success');

      // Refresh display
      setTimeout(() => {
        Views.directorBiometric.selectStudent(selectedStudent.id);
      }, 1500);

    } catch (err) {
      console.error('Enrollment error:', err);
      updateEnrollState('error', err.message);
      Components.showToast(err.message, 'error');

      setTimeout(() => {
        if (btn) btn.style.display = 'block';
        if (guide) guide.style.display = 'none';
      }, 2000);
    }
  };

  Views.directorBiometric.cancelEnrollment = function() {
    const btn = document.getElementById('start-enroll-btn');
    const guide = document.getElementById('enrollment-guide');

    if (btn) btn.style.display = 'block';
    if (guide) guide.style.display = 'none';
  };

  Views.directorBiometric.viewCredentials = function() {
    if (!selectedStudent || studentCredentials.length === 0) return;

    // R10-W2 fix: Use data-* attributes to prevent XSS via credential_id
    const credentialsHTML = studentCredentials.map(cred => `
      <tr>
        <td>${Components.escapeHtml(cred.device_name || 'Sin nombre')}</td>
        <td>${Components.formatDate(cred.created_at)}</td>
        <td>${cred.last_used_at ? Components.formatDate(cred.last_used_at) : 'Nunca'}</td>
        <td>
          <button class="btn btn-error btn-sm delete-credential-btn" data-credential-id="${Components.escapeHtml(cred.credential_id)}">
            🗑️
          </button>
        </td>
      </tr>
    `).join('');

    Components.showModal('Credenciales Biométricas', `
      <p style="margin-bottom: 1rem;">Credenciales registradas para <strong>${Components.escapeHtml(selectedStudent.full_name)}</strong>:</p>
      <table>
        <thead>
          <tr>
            <th>Dispositivo</th>
            <th>Registrado</th>
            <th>Último Uso</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${credentialsHTML}
        </tbody>
      </table>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);

    // R10-W2 fix: Attach event listeners after modal is shown
    setTimeout(() => {
      document.querySelectorAll('.delete-credential-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const credId = this.dataset.credentialId;
          Views.directorBiometric.deleteCredential(credId);
        });
      });
    }, 0);
  };

  Views.directorBiometric.deleteCredential = async function(credentialId) {
    if (!selectedStudent) return;

    try {
      const response = await API.request(
        `/webauthn/admin/students/${selectedStudent.id}/credentials/${encodeURIComponent(credentialId)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        Components.showToast('Credencial eliminada', 'success');
        document.querySelector('.modal-container')?.click();
        Views.directorBiometric.selectStudent(selectedStudent.id);
      } else {
        throw new Error('Error al eliminar credencial');
      }
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  };

  Views.directorBiometric.confirmDeleteAll = function() {
    if (!selectedStudent) return;

    Components.showModal('Confirmar Eliminación', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Eliminar todas las huellas de?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(selectedStudent.full_name)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          El alumno deberá registrar sus huellas nuevamente para usar autenticación biométrica.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar Todas', action: 'delete', className: 'btn-error', onClick: async () => {
        try {
          // Delete all credentials one by one
          for (const cred of studentCredentials) {
            await API.request(
              `/webauthn/admin/students/${selectedStudent.id}/credentials/${encodeURIComponent(cred.credential_id)}`,
              { method: 'DELETE' }
            );
          }
          document.querySelector('.modal-container')?.click();
          Components.showToast('Todas las credenciales eliminadas', 'success');
          Views.directorBiometric.selectStudent(selectedStudent.id);
        } catch (err) {
          Components.showToast('Error al eliminar credenciales', 'error');
        }
      }}
    ]);
  };

  function updateEnrollState(state, message) {
    const sensor = document.getElementById('fingerprint-sensor');
    const guideText = document.getElementById('guide-text');

    if (sensor) {
      sensor.className = 'fingerprint-sensor';
      sensor.classList.add(`sensor-${state}`);
    }

    if (guideText) {
      guideText.textContent = message;
    }
  }

  // WebAuthn helpers
  async function createCredential(options) {
    const publicKeyCredentialCreationOptions = parseCreationOptions(options);

    try {
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });
      return credentialToJSON(credential);
    } catch (err) {
      console.error('Error creating credential:', err);
      throw err;
    }
  }

  function parseCreationOptions(options) {
    const parsed = { ...options };

    if (parsed.challenge) {
      parsed.challenge = base64urlToBuffer(parsed.challenge);
    }
    if (parsed.user && parsed.user.id) {
      parsed.user.id = base64urlToBuffer(parsed.user.id);
    }
    if (parsed.excludeCredentials) {
      parsed.excludeCredentials = parsed.excludeCredentials.map(cred => ({
        ...cred,
        id: base64urlToBuffer(cred.id)
      }));
    }

    return parsed;
  }

  function credentialToJSON(credential) {
    return {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
        attestationObject: bufferToBase64url(credential.response.attestationObject),
        transports: credential.response.getTransports ? credential.response.getTransports() : []
      }
    };
  }

  function base64urlToBuffer(base64url) {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) base64 += '='.repeat(4 - padding);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function addStyles() {
    if (document.getElementById('biometric-styles')) return;

    const style = document.createElement('style');
    style.id = 'biometric-styles';
    style.textContent = `
      .biometric-container {
        max-width: 1200px;
      }

      .biometric-grid {
        display: grid;
        grid-template-columns: 350px 1fr;
        gap: 1.5rem;
      }

      @media (max-width: 900px) {
        .biometric-grid {
          grid-template-columns: 1fr;
        }
      }

      .student-list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        border-bottom: 1px solid var(--color-gray-100);
        cursor: pointer;
        transition: background 0.2s;
      }

      .student-list-item:hover {
        background: var(--color-gray-50);
      }

      .student-list-item.selected {
        background: var(--color-primary-light);
        border-left: 3px solid var(--color-primary);
      }

      .student-list-item .student-name {
        font-weight: 600;
      }

      .student-list-item .student-course {
        font-size: 0.85rem;
        color: var(--color-gray-500);
      }

      .biometric-indicator {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
      }

      .biometric-indicator.has-biometric {
        background: var(--color-success-light);
      }

      .biometric-indicator.no-biometric {
        background: var(--color-gray-100);
        color: var(--color-gray-400);
      }

      .empty-enrollment {
        text-align: center;
        padding: 3rem;
        color: var(--color-gray-500);
      }

      .empty-enrollment .empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }

      .empty-list {
        text-align: center;
        padding: 2rem;
        color: var(--color-gray-500);
      }

      .selected-student-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: var(--color-gray-50);
        border-radius: 12px;
        margin-bottom: 1.5rem;
      }

      .student-avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--color-gray-200);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .student-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-placeholder {
        font-size: 2rem;
      }

      .student-name-lg {
        margin: 0 0 0.25rem;
        font-size: 1.25rem;
      }

      .student-meta {
        color: var(--color-gray-500);
        font-size: 0.9rem;
      }

      .biometric-status-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
      }

      .biometric-status-card.status-registered {
        background: var(--color-success-light);
      }

      .biometric-status-card.status-pending {
        background: var(--color-warning-light);
      }

      .status-icon {
        font-size: 2rem;
      }

      .status-text p {
        margin: 0.25rem 0 0;
        font-size: 0.9rem;
        color: var(--color-gray-600);
      }

      .enrollment-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
      }

      .enrollment-guide {
        text-align: center;
        padding: 2rem;
        background: var(--color-gray-50);
        border-radius: 12px;
      }

      .fingerprint-sensor-container {
        margin-bottom: 1.5rem;
      }

      .fingerprint-sensor {
        width: 120px;
        height: 120px;
        margin: 0 auto;
        border-radius: 50%;
        background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .fingerprint-sensor .fingerprint-icon {
        font-size: 3rem;
        z-index: 1;
      }

      .fingerprint-sensor .fingerprint-pulse {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 3px solid rgba(99, 102, 241, 0.5);
        animation: fp-pulse 2s ease-out infinite;
      }

      @keyframes fp-pulse {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(1.4); opacity: 0; }
      }

      .fingerprint-sensor.sensor-waiting {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      }

      .fingerprint-sensor.sensor-reading {
        background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%);
      }

      .fingerprint-sensor.sensor-reading .fingerprint-pulse {
        animation-duration: 0.5s;
      }

      .fingerprint-sensor.sensor-success {
        background: linear-gradient(135deg, #d1fae5 0%, #6ee7b7 100%);
      }

      .fingerprint-sensor.sensor-success .fingerprint-pulse {
        animation: none;
      }

      .fingerprint-sensor.sensor-error {
        background: linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%);
      }

      .fingerprint-sensor.sensor-error .fingerprint-pulse {
        animation: none;
      }

      .guide-text {
        font-size: 1.1rem;
        color: var(--color-gray-600);
        margin-bottom: 1rem;
      }
    `;
    document.head.appendChild(style);
  }

  renderMain();
};
