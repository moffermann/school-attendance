/**
 * NFC Enrollment Service
 * Handles writing enrollment data to NFC tags using Web NFC API
 */
const NFCEnrollment = {
  // Check if Web NFC is supported
  isSupported() {
    return 'NDEFReader' in window;
  },

  // School configuration (should be loaded from API in production)
  schoolConfig: {
    name: 'Colegio Demo',
    address: 'Av. Principal 1234, Santiago, Chile',
    phone: '+56 2 1234 5678',
    email: 'contacto@colegiodemo.cl',
    lostFoundMessage: 'Si encontro esta credencial, por favor devolverla en porteria del colegio o llamar al telefono indicado. Gracias.'
  },

  /**
   * Build NDEF records for a student
   * @param {Object} student - Student data
   * @param {Object} course - Course data
   * @param {Array} guardians - Guardian data
   * @param {string} token - Unique token for kiosk identification
   * @returns {Array} NDEF records
   */
  buildStudentRecords(student, course, guardians, token) {
    const guardiansText = guardians.length > 0
      ? guardians.map(g => g.full_name).join(', ')
      : 'No registrados';

    // Build vCard for contact information
    const vcard = this._buildVCard({
      name: student.full_name,
      org: this.schoolConfig.name,
      title: `Alumno - ${course ? course.name : 'Sin curso'}`,
      note: `RUT: ${student.rut || 'No registrado'}\nCurso: ${course ? course.name + ' - ' + course.grade : 'N/A'}\nApoderados: ${guardiansText}\n\n${this.schoolConfig.lostFoundMessage}`,
      email: student.email || '',
      tel: ''
    });

    // Build enrollment data as JSON for internal use
    const enrollmentData = {
      type: 'student',
      id: student.id,
      token: token,
      name: student.full_name,
      rut: student.rut || '',
      course: course ? { id: course.id, name: course.name, grade: course.grade } : null,
      guardians: guardians.map(g => ({
        name: g.full_name,
        contacts: g.contacts
      })),
      school: {
        name: this.schoolConfig.name,
        address: this.schoolConfig.address,
        phone: this.schoolConfig.phone,
        email: this.schoolConfig.email
      },
      enrolled_at: new Date().toISOString()
    };

    return [
      // Primary: URL for kiosk recognition (token-based)
      { recordType: 'url', data: `${window.location.origin}/t/${token}` },
      // Secondary: Full enrollment data as JSON
      { recordType: 'text', data: JSON.stringify(enrollmentData) },
      // Tertiary: vCard for lost & found
      { recordType: 'mime', mediaType: 'text/vcard', data: vcard }
    ];
  },

  /**
   * Build NDEF records for a teacher
   * @param {Object} teacher - Teacher data
   * @param {Array} courses - Assigned courses
   * @param {string} token - Unique token for kiosk identification
   * @returns {Array} NDEF records
   */
  buildTeacherRecords(teacher, courses, token) {
    const coursesText = courses.length > 0
      ? courses.map(c => c.name).join(', ')
      : 'Sin cursos asignados';

    // Build vCard for contact information
    const vcard = this._buildVCard({
      name: teacher.full_name,
      org: this.schoolConfig.name,
      title: `Profesor - ${teacher.specialty || 'General'}`,
      note: `Especialidad: ${teacher.specialty || 'No especificada'}\nCursos: ${coursesText}\n\n${this.schoolConfig.lostFoundMessage}`,
      email: teacher.email || '',
      tel: teacher.phone || ''
    });

    // Build enrollment data as JSON for internal use
    const enrollmentData = {
      type: 'teacher',
      id: teacher.id,
      token: token,
      name: teacher.full_name,
      email: teacher.email || '',
      phone: teacher.phone || '',
      specialty: teacher.specialty || '',
      courses: courses.map(c => ({ id: c.id, name: c.name, grade: c.grade })),
      school: {
        name: this.schoolConfig.name,
        address: this.schoolConfig.address,
        phone: this.schoolConfig.phone,
        email: this.schoolConfig.email
      },
      enrolled_at: new Date().toISOString()
    };

    return [
      // Primary: URL for kiosk recognition (token-based)
      { recordType: 'url', data: `${window.location.origin}/t/${token}` },
      // Secondary: Full enrollment data as JSON
      { recordType: 'text', data: JSON.stringify(enrollmentData) },
      // Tertiary: vCard for lost & found
      { recordType: 'mime', mediaType: 'text/vcard', data: vcard }
    ];
  },

  /**
   * Build a vCard string
   * @private
   */
  _buildVCard({ name, org, title, note, email, tel }) {
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name}`,
      `ORG:${org}`,
      `TITLE:${title}`,
      `NOTE:${note.replace(/\n/g, '\\n')}`,
    ];
    if (email) lines.push(`EMAIL:${email}`);
    if (tel) lines.push(`TEL:${tel}`);
    lines.push(`ADR:;;${this.schoolConfig.address};;;;`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  },

  /**
   * Generate a unique token for enrollment
   * @param {string} type - 'student' or 'teacher'
   * @param {number} id - Entity ID
   * @returns {string} Token
   */
  generateToken(type, id) {
    const prefix = type === 'student' ? 'nfc_' : 'nfc_teacher_';
    const random = Math.random().toString(36).substring(2, 10);
    return `${prefix}${id}_${random}`;
  },

  /**
   * Write data to NFC tag
   * @param {Array} records - NDEF records to write
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<{success: boolean, serialNumber?: string, error?: string}>}
   */
  async writeTag(records, onProgress = () => {}) {
    if (!this.isSupported()) {
      return { success: false, error: 'NFC no soportado en este navegador' };
    }

    try {
      onProgress('initializing', 'Inicializando NFC...');
      const ndef = new NDEFReader();

      onProgress('waiting', 'Acerque el tag NFC al dispositivo...');

      // Build NDEF message
      const ndefRecords = records.map(record => {
        if (record.recordType === 'url') {
          return { recordType: 'url', data: record.data };
        } else if (record.recordType === 'text') {
          return { recordType: 'text', data: record.data };
        } else if (record.recordType === 'mime') {
          const encoder = new TextEncoder();
          return {
            recordType: 'mime',
            mediaType: record.mediaType,
            data: encoder.encode(record.data)
          };
        }
        return record;
      });

      onProgress('writing', 'Escribiendo datos en el tag...');
      await ndef.write({ records: ndefRecords });

      onProgress('success', 'Tag escrito correctamente');
      return { success: true };

    } catch (error) {
      console.error('NFC write error:', error);

      let errorMessage = 'Error desconocido';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permiso NFC denegado. Por favor, permita el acceso a NFC.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'NFC no soportado en este dispositivo.';
      } else if (error.name === 'NetworkError') {
        errorMessage = 'Error de comunicacion con el tag. Intente de nuevo.';
      } else if (error.name === 'AbortError') {
        errorMessage = 'Operacion cancelada.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Read and verify an NFC tag
   * @param {number} timeoutMs - Read timeout in milliseconds
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async readTag(timeoutMs = 10000) {
    if (!this.isSupported()) {
      return { success: false, error: 'NFC no soportado en este navegador' };
    }

    return new Promise(async (resolve) => {
      let timeoutId;
      let resolved = false;

      // TDD-R7-BUG5 fix: Store event handler references for cleanup
      let readingHandler = null;
      let errorHandler = null;
      let ndef = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        // Remove event listeners to prevent memory leak
        if (ndef && readingHandler) {
          ndef.removeEventListener('reading', readingHandler);
        }
        if (ndef && errorHandler) {
          ndef.removeEventListener('readingerror', errorHandler);
        }
      };

      try {
        ndef = new NDEFReader();
        await ndef.scan();

        timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({ success: false, error: 'Tiempo de espera agotado. Acerque el tag NFC.' });
          }
        }, timeoutMs);

        readingHandler = ({ message, serialNumber }) => {
          if (resolved) return;
          resolved = true;
          cleanup();

          // Parse records
          const result = {
            success: true,
            serialNumber,
            records: [],
            enrollmentData: null
          };

          for (const record of message.records) {
            if (record.recordType === 'text') {
              const decoder = new TextDecoder(record.encoding || 'utf-8');
              const text = decoder.decode(record.data);
              result.records.push({ type: 'text', data: text });

              // Try to parse as enrollment JSON
              try {
                const parsed = JSON.parse(text);
                if (parsed.type && parsed.id && parsed.token) {
                  result.enrollmentData = parsed;
                }
              } catch (e) {
                // Not JSON, ignore
              }
            } else if (record.recordType === 'url') {
              const decoder = new TextDecoder();
              const url = decoder.decode(record.data);
              result.records.push({ type: 'url', data: url });
            } else if (record.recordType === 'mime') {
              const decoder = new TextDecoder();
              const data = decoder.decode(record.data);
              result.records.push({ type: 'mime', mediaType: record.mediaType, data });
            }
          }

          resolve(result);
        };

        errorHandler = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve({ success: false, error: 'Error al leer el tag NFC' });
        };

        ndef.addEventListener('reading', readingHandler);
        ndef.addEventListener('readingerror', errorHandler);

      } catch (error) {
        if (resolved) return;
        resolved = true;
        cleanup();

        let errorMessage = 'Error al iniciar lectura NFC';
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Permiso NFC denegado';
        }
        resolve({ success: false, error: errorMessage });
      }
    });
  },

  /**
   * Show enrollment modal for a student
   * @param {number} studentId - Student ID
   */
  showStudentEnrollmentModal(studentId) {
    const student = State.getStudent(studentId);
    if (!student) {
      Components.showToast('Alumno no encontrado', 'error');
      return;
    }

    const course = State.getCourse(student.course_id);
    const guardians = State.getGuardians().filter(g => g.student_ids.includes(studentId));
    const token = this.generateToken('student', studentId);

    this._showEnrollmentModal({
      type: 'student',
      entity: student,
      course,
      guardians,
      token,
      title: `Enrolar NFC - ${student.full_name}`,
      records: this.buildStudentRecords(student, course, guardians, token)
    });
  },

  /**
   * Show enrollment modal for a teacher
   * @param {number} teacherId - Teacher ID
   */
  showTeacherEnrollmentModal(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    const allCourses = State.getCourses();
    const courses = allCourses.filter(c =>
      (c.teacher_ids && c.teacher_ids.includes(teacherId)) ||
      c.teacher_id === teacherId
    );
    const token = this.generateToken('teacher', teacherId);

    this._showEnrollmentModal({
      type: 'teacher',
      entity: teacher,
      courses,
      token,
      title: `Enrolar NFC - ${teacher.full_name}`,
      records: this.buildTeacherRecords(teacher, courses, token)
    });
  },

  /**
   * Internal method to show enrollment modal
   * @private
   */
  _showEnrollmentModal({ type, entity, course, courses, guardians, token, title, records }) {
    const nfcSupported = this.isSupported();
    const isStudent = type === 'student';

    // Build info display
    let infoHTML = '';
    if (isStudent) {
      const guardiansText = guardians && guardians.length > 0
        ? guardians.map(g => `<li>${Components.escapeHtml(g.full_name)}</li>`).join('')
        : '<li style="color: var(--color-gray-500);">Sin apoderados registrados</li>';

      infoHTML = `
        <div class="enrollment-info">
          <div class="info-row"><strong>Nombre:</strong> ${Components.escapeHtml(entity.full_name)}</div>
          <div class="info-row"><strong>RUT:</strong> ${Components.escapeHtml(entity.rut || 'No registrado')}</div>
          <div class="info-row"><strong>Curso:</strong> ${course ? Components.escapeHtml(course.name + ' - ' + course.grade) : 'Sin curso'}</div>
          <div class="info-row"><strong>Apoderados:</strong></div>
          <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0;">${guardiansText}</ul>
        </div>
      `;
    } else {
      const coursesText = courses && courses.length > 0
        ? courses.map(c => Components.escapeHtml(c.name)).join(', ')
        : 'Sin cursos asignados';

      infoHTML = `
        <div class="enrollment-info">
          <div class="info-row"><strong>Nombre:</strong> ${Components.escapeHtml(entity.full_name)}</div>
          <div class="info-row"><strong>Email:</strong> ${Components.escapeHtml(entity.email || 'No registrado')}</div>
          <div class="info-row"><strong>Telefono:</strong> ${Components.escapeHtml(entity.phone || 'No registrado')}</div>
          <div class="info-row"><strong>Cargo:</strong> Profesor - ${Components.escapeHtml(entity.specialty || 'General')}</div>
          <div class="info-row"><strong>Cursos:</strong> ${coursesText}</div>
        </div>
      `;
    }

    const schoolInfoHTML = `
      <div class="enrollment-info" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-gray-200);">
        <div class="info-row"><strong>Colegio:</strong> ${Components.escapeHtml(this.schoolConfig.name)}</div>
        <div class="info-row"><strong>Direccion:</strong> ${Components.escapeHtml(this.schoolConfig.address)}</div>
        <div class="info-row"><strong>Telefono:</strong> ${Components.escapeHtml(this.schoolConfig.phone)}</div>
      </div>
    `;

    const modalContent = `
      <div class="nfc-enrollment-container">
        ${!nfcSupported ? `
          <div class="alert alert-warning" style="margin-bottom: 1rem; padding: 1rem; background: var(--color-warning-light); border-radius: 8px; display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.5rem;">⚠️</span>
            <div>
              <strong>NFC no disponible</strong><br>
              <span style="font-size: 0.9rem;">Use Chrome en Android para escribir tags NFC. En otros navegadores solo puede ver la informacion.</span>
            </div>
          </div>
        ` : ''}

        <div class="card mb-2">
          <div class="card-header">Informacion a escribir en el tag</div>
          <div class="card-body">
            ${infoHTML}
            ${schoolInfoHTML}
            <div class="enrollment-info" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-gray-200);">
              <div class="info-row"><strong>Token:</strong> <code style="background: var(--color-gray-100); padding: 0.25rem 0.5rem; border-radius: 4px;">${Components.escapeHtml(token)}</code></div>
              <div class="info-row" style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--color-gray-500);">
                <strong>Nota de extravio:</strong> ${Components.escapeHtml(this.schoolConfig.lostFoundMessage)}
              </div>
            </div>
          </div>
        </div>

        <div id="nfc-status-container" style="display: none;" class="card mb-2">
          <div class="card-body" style="text-align: center; padding: 2rem;">
            <div id="nfc-status-icon" style="font-size: 3rem; margin-bottom: 1rem;">📱</div>
            <div id="nfc-status-text" style="font-size: 1.1rem; font-weight: 500;">Esperando...</div>
            <div id="nfc-status-detail" style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 0.5rem;"></div>
          </div>
        </div>

        <div id="nfc-success-container" style="display: none;" class="card mb-2">
          <div class="card-body" style="text-align: center; padding: 2rem; background: var(--color-success-light);">
            <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
            <div style="font-size: 1.1rem; font-weight: 500; color: var(--color-success);">Tag NFC escrito correctamente</div>
            <div style="font-size: 0.9rem; color: var(--color-gray-600); margin-top: 0.5rem;">El tag esta listo para ser usado en el kiosko.</div>
          </div>
        </div>

        <div id="nfc-test-container" style="display: none;" class="card mb-2">
          <div class="card-body" style="text-align: center; padding: 2rem;">
            <div id="nfc-test-icon" style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
            <div id="nfc-test-text" style="font-size: 1.1rem; font-weight: 500;">Acerque el tag para verificar...</div>
            <div id="nfc-test-result" style="margin-top: 1rem;"></div>
          </div>
        </div>
      </div>
    `;

    // Store records and entity info for later use
    this._currentEnrollment = { type, entity, token, records, course, courses, guardians };

    Components.showModal(title, modalContent, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      ...(nfcSupported ? [
        { label: 'Escribir Tag', action: 'write', className: 'btn-primary', onClick: () => this._startWriteProcess() },
      ] : [])
    ]);
  },

  /**
   * Start the NFC write process
   * @private
   */
  async _startWriteProcess() {
    const statusContainer = document.getElementById('nfc-status-container');
    const statusIcon = document.getElementById('nfc-status-icon');
    const statusText = document.getElementById('nfc-status-text');
    const statusDetail = document.getElementById('nfc-status-detail');
    const successContainer = document.getElementById('nfc-success-container');

    if (statusContainer) statusContainer.style.display = 'block';
    if (successContainer) successContainer.style.display = 'none';

    const updateStatus = (icon, text, detail = '') => {
      if (statusIcon) statusIcon.textContent = icon;
      if (statusText) statusText.textContent = text;
      if (statusDetail) statusDetail.textContent = detail;
    };

    const result = await this.writeTag(this._currentEnrollment.records, (stage, message) => {
      switch (stage) {
        case 'initializing':
          updateStatus('⚙️', message);
          break;
        case 'waiting':
          updateStatus('📱', message, 'Mantenga el tag cerca hasta que termine la escritura');
          break;
        case 'writing':
          updateStatus('✍️', message, 'No retire el tag...');
          break;
        case 'success':
          updateStatus('✅', message);
          break;
      }
    });

    if (result.success) {
      if (statusContainer) statusContainer.style.display = 'none';
      if (successContainer) successContainer.style.display = 'block';

      // Update modal buttons to show test option
      const modalFooter = document.querySelector('.modal-footer');
      if (modalFooter) {
        modalFooter.innerHTML = `
          <button class="btn btn-secondary" data-action="close">Cerrar</button>
          <button class="btn btn-primary" onclick="NFCEnrollment._startTestProcess()">Probar Tag</button>
        `;
        // Re-attach close handler
        modalFooter.querySelector('[data-action="close"]').addEventListener('click', () => {
          document.querySelector('.modal-container').click();
        });
      }

      Components.showToast('Tag NFC escrito correctamente', 'success');
    } else {
      updateStatus('❌', 'Error al escribir', result.error);
      Components.showToast(result.error, 'error');
    }
  },

  /**
   * Start the NFC test/verification process
   * @private
   */
  async _startTestProcess() {
    const statusContainer = document.getElementById('nfc-status-container');
    const successContainer = document.getElementById('nfc-success-container');
    const testContainer = document.getElementById('nfc-test-container');
    const testIcon = document.getElementById('nfc-test-icon');
    const testText = document.getElementById('nfc-test-text');
    const testResult = document.getElementById('nfc-test-result');

    if (statusContainer) statusContainer.style.display = 'none';
    if (successContainer) successContainer.style.display = 'none';
    if (testContainer) testContainer.style.display = 'block';

    if (testIcon) testIcon.textContent = '🔍';
    if (testText) testText.textContent = 'Acerque el tag NFC para verificar...';
    if (testResult) testResult.innerHTML = '';

    const result = await this.readTag(15000);

    if (result.success && result.enrollmentData) {
      const data = result.enrollmentData;
      const isMatch = data.id === this._currentEnrollment.entity.id &&
                      data.type === this._currentEnrollment.type;

      if (isMatch) {
        if (testIcon) testIcon.textContent = '✅';
        if (testText) testText.textContent = 'Verificacion exitosa';
        if (testResult) {
          testResult.innerHTML = `
            <div style="background: var(--color-success-light); padding: 1rem; border-radius: 8px; text-align: left;">
              <div style="color: var(--color-success); font-weight: 600; margin-bottom: 0.5rem;">Tag verificado correctamente</div>
              <div><strong>Tipo:</strong> ${data.type === 'student' ? 'Alumno' : 'Profesor'}</div>
              <div><strong>Nombre:</strong> ${Components.escapeHtml(data.name)}</div>
              <div><strong>Token:</strong> <code>${Components.escapeHtml(data.token)}</code></div>
              <div><strong>Escrito:</strong> ${Components.formatDateTime(data.enrolled_at)}</div>
            </div>
          `;
        }
        Components.showToast('Tag verificado correctamente', 'success');
      } else {
        if (testIcon) testIcon.textContent = '⚠️';
        if (testText) testText.textContent = 'Tag no coincide';
        if (testResult) {
          testResult.innerHTML = `
            <div style="background: var(--color-warning-light); padding: 1rem; border-radius: 8px; text-align: left;">
              <div style="color: var(--color-warning); font-weight: 600; margin-bottom: 0.5rem;">El tag contiene datos de otra persona</div>
              <div><strong>Encontrado:</strong> ${Components.escapeHtml(data.name)} (${data.type})</div>
              <div><strong>Esperado:</strong> ${Components.escapeHtml(this._currentEnrollment.entity.full_name)}</div>
            </div>
          `;
        }
        Components.showToast('El tag no corresponde a esta persona', 'warning');
      }
    } else if (result.success && result.records.length > 0) {
      // Tag has data but not enrollment format
      if (testIcon) testIcon.textContent = '⚠️';
      if (testText) testText.textContent = 'Tag con formato diferente';
      if (testResult) {
        testResult.innerHTML = `
          <div style="background: var(--color-warning-light); padding: 1rem; border-radius: 8px;">
            <div style="color: var(--color-warning); font-weight: 600;">El tag contiene datos en otro formato</div>
            <div style="font-size: 0.9rem; margin-top: 0.5rem;">Registros encontrados: ${result.records.length}</div>
          </div>
        `;
      }
    } else {
      if (testIcon) testIcon.textContent = '❌';
      if (testText) testText.textContent = result.error || 'No se pudo leer el tag';
      if (testResult) {
        testResult.innerHTML = `
          <div style="background: var(--color-error-light); padding: 1rem; border-radius: 8px;">
            <div style="color: var(--color-error); font-weight: 600;">Error de verificacion</div>
            <div style="font-size: 0.9rem; margin-top: 0.5rem;">${Components.escapeHtml(result.error || 'Intente acercar el tag nuevamente')}</div>
          </div>
        `;
      }
    }

    // Add retry button
    const modalFooter = document.querySelector('.modal-footer');
    if (modalFooter) {
      modalFooter.innerHTML = `
        <button class="btn btn-secondary" data-action="close">Cerrar</button>
        <button class="btn btn-primary" onclick="NFCEnrollment._startTestProcess()">Verificar de nuevo</button>
      `;
      modalFooter.querySelector('[data-action="close"]').addEventListener('click', () => {
        document.querySelector('.modal-container').click();
      });
    }
  },

  // Current enrollment data (used during modal interactions)
  _currentEnrollment: null
};

// Export for global access
window.NFCEnrollment = NFCEnrollment;
