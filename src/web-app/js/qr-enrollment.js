/**
 * QR Enrollment Service
 * Handles generating QR codes for student/teacher enrollment
 */
const QREnrollment = {
  // School configuration (should be loaded from API in production)
  schoolConfig: {
    name: 'Colegio Demo',
    address: 'Av. Principal 1234, Santiago, Chile',
    phone: '+56 2 1234 5678',
    email: 'contacto@colegiodemo.cl',
    lostFoundMessage: 'Si encontro esta credencial, por favor devolverla en porteria del colegio o llamar al telefono indicado. Gracias.'
  },

  // Token info from backend provisioning
  _tokenInfo: null,

  /**
   * Provision a secure token from the backend
   * @param {number} studentId - Student ID
   * @returns {Promise<string>} Token preview
   */
  async provisionToken(studentId) {
    try {
      const response = await API.provisionTag(studentId);

      // Store for later confirmation
      this._tokenInfo = {
        preview: response.tag_token_preview,
        ndef_uri: response.ndef_uri,
        checksum: response.checksum
      };

      return response.tag_token_preview;
    } catch (error) {
      Components.showToast(error.message || 'Error al generar token', 'error');
      throw error;
    }
  },

  /**
   * Generate a unique token for enrollment (LEGACY - for teachers only)
   * @param {string} type - 'student' or 'teacher'
   * @param {number} id - Entity ID
   * @returns {string} Token
   */
  generateToken(type, id) {
    const prefix = type === 'student' ? 'qr_' : 'qr_teacher_';
    const random = Math.random().toString(36).substring(2, 10);
    return `${prefix}${id}_${random}`;
  },

  /**
   * Build enrollment data for a student
   * @param {Object} student - Student data
   * @param {Object} course - Course data
   * @param {Array} guardians - Guardian data
   * @param {string} token - Unique token for kiosk identification
   * @returns {Object} Enrollment data
   */
  buildStudentData(student, course, guardians, token) {
    return {
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
  },

  /**
   * Build enrollment data for a teacher
   * @param {Object} teacher - Teacher data
   * @param {Array} courses - Assigned courses
   * @param {string} token - Unique token for kiosk identification
   * @returns {Object} Enrollment data
   */
  buildTeacherData(teacher, courses, token) {
    return {
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
  },

  /**
   * Generate QR code as data URL
   * Uses qrcode-generator library (local, no CDN)
   * @param {string} data - Data to encode in QR
   * @param {Object} options - QR options
   * @returns {Promise<string>} Data URL of QR code image
   */
  async generateQRDataURL(data, options = {}) {
    const cellSize = options.cellSize || 4;
    const margin = options.margin || 4;

    // Check if qrcode library is available (qrcode-generator)
    if (typeof qrcode === 'undefined') {
      throw new Error('qrcode library not loaded');
    }

    return new Promise((resolve, reject) => {
      try {
        // Type 0 = auto-detect, 'M' = medium error correction
        const qr = qrcode(0, 'M');
        qr.addData(data);
        qr.make();

        // createDataURL returns a base64 PNG data URL
        const dataURL = qr.createDataURL(cellSize, margin);
        resolve(dataURL);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Generate printable QR card HTML
   * @param {Object} data - Enrollment data
   * @param {string} qrDataURL - QR code data URL
   * @returns {string} HTML for printable card
   */
  generatePrintableCard(data, qrDataURL) {
    const isStudent = data.type === 'student';
    const role = isStudent ? 'Alumno' : 'Profesor';
    const subtitle = isStudent
      ? (data.course ? `${data.course.name} - ${data.course.grade}` : 'Sin curso')
      : (data.specialty || 'Profesor');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Credencial QR - ${this._escapeHtml(data.name)}</title>
        <style>
          @page { size: 85.6mm 53.98mm; margin: 0; }
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
          }
          .card {
            width: 85.6mm;
            height: 53.98mm;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            overflow: hidden;
            margin: 0 auto;
          }
          .card-left {
            flex: 1;
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .card-right {
            width: 45mm;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px;
          }
          .school-name {
            font-size: 10px;
            font-weight: 600;
            color: #1a56db;
            margin-bottom: 4px;
          }
          .person-name {
            font-size: 14px;
            font-weight: 700;
            color: #111;
            margin-bottom: 2px;
            line-height: 1.2;
          }
          .person-role {
            font-size: 9px;
            color: #666;
            margin-bottom: 2px;
          }
          .person-subtitle {
            font-size: 10px;
            color: #333;
            font-weight: 500;
          }
          .person-rut {
            font-size: 9px;
            color: #666;
            margin-top: 4px;
          }
          .qr-code {
            width: 38mm;
            height: 38mm;
          }
          .footer {
            font-size: 7px;
            color: #999;
            line-height: 1.3;
          }
          .token {
            font-size: 7px;
            color: #999;
            font-family: monospace;
            margin-top: 2px;
          }
          .print-btn {
            display: block;
            margin: 20px auto;
            padding: 12px 24px;
            background: #1a56db;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          }
          .print-btn:hover { background: #1e429f; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="card-left">
            <div>
              <div class="school-name">${this._escapeHtml(data.school.name)}</div>
              <div class="person-name">${this._escapeHtml(data.name)}</div>
              <div class="person-role">${role}</div>
              <div class="person-subtitle">${this._escapeHtml(subtitle)}</div>
              ${data.rut ? `<div class="person-rut">RUT: ${this._escapeHtml(data.rut)}</div>` : ''}
            </div>
            <div class="footer">
              ${this._escapeHtml(data.school.address)}<br>
              Tel: ${this._escapeHtml(data.school.phone)}
              <div class="token">${this._escapeHtml(data.token)}</div>
            </div>
          </div>
          <div class="card-right">
            <img src="${qrDataURL}" class="qr-code" alt="QR Code">
          </div>
        </div>
        <button class="print-btn no-print" onclick="window.print()">Imprimir Credencial</button>
      </body>
      </html>
    `;
  },

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  _escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  /**
   * Show enrollment modal for a student
   * @param {number} studentId - Student ID
   */
  async showStudentEnrollmentModal(studentId) {
    const student = State.getStudent(studentId);
    if (!student) {
      Components.showToast('Alumno no encontrado', 'error');
      return;
    }

    const course = State.getCourse(student.course_id);
    const guardians = State.getGuardians().filter(g => g.student_ids.includes(studentId));

    try {
      // Show loading
      Components.showToast('Generando token seguro...', 'info');

      // Provision token from backend (creates PENDING tag in DB)
      const token = await this.provisionToken(studentId);
      const data = this.buildStudentData(student, course, guardians, token);

      this._showEnrollmentModal({
        type: 'student',
        entity: student,
        course,
        guardians,
        token,
        data,
        title: `Enrolar QR - ${student.full_name}`
      });
    } catch (error) {
      // Error already shown in provisionToken()
      console.error('Error provisioning QR tag:', error);
    }
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
    const data = this.buildTeacherData(teacher, courses, token);

    this._showEnrollmentModal({
      type: 'teacher',
      entity: teacher,
      courses,
      token,
      data,
      title: `Enrolar QR - ${teacher.full_name}`
    });
  },

  /**
   * Internal method to show enrollment modal
   * @private
   */
  async _showEnrollmentModal({ type, entity, course, courses, guardians, token, data, title }) {
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
      <div class="qr-enrollment-container">
        <div class="card mb-2">
          <div class="card-header">Informacion de la credencial</div>
          <div class="card-body">
            ${infoHTML}
            ${schoolInfoHTML}
            <div class="enrollment-info" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-gray-200);">
              <div class="info-row"><strong>Token:</strong> <code style="background: var(--color-gray-100); padding: 0.25rem 0.5rem; border-radius: 4px;">${Components.escapeHtml(token)}</code></div>
            </div>
          </div>
        </div>

        <div id="qr-preview-container" class="card mb-2">
          <div class="card-header">Codigo QR</div>
          <div class="card-body" style="text-align: center; padding: 1.5rem;">
            <div id="qr-loading" style="padding: 2rem;">
              <div class="spinner" style="margin: 0 auto;"></div>
              <div style="margin-top: 1rem; color: var(--color-gray-500);">Generando QR...</div>
            </div>
            <div id="qr-code-display" style="display: none;">
              <img id="qr-code-image" style="max-width: 200px; border: 1px solid var(--color-gray-200); border-radius: 8px;" alt="Codigo QR">
              <div style="margin-top: 1rem; font-size: 0.9rem; color: var(--color-gray-600);">
                Escanea este codigo con el kiosk para registrar asistencia
              </div>
            </div>
            <div id="qr-error" style="display: none; color: var(--color-error); padding: 1rem;">
              Error al generar el codigo QR
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Opciones de impresion</div>
          <div class="card-body">
            <p style="font-size: 0.9rem; color: var(--color-gray-600); margin-bottom: 1rem;">
              Puede imprimir una credencial con el codigo QR para que ${isStudent ? 'el alumno' : 'el profesor'} la lleve consigo.
            </p>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-secondary" id="btn-download-qr" disabled>
                Descargar QR
              </button>
              <button class="btn btn-primary" id="btn-print-card" disabled>
                Imprimir Credencial
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Store data for later use
    this._currentEnrollment = { type, entity, token, data, course, courses, guardians };

    Components.showModal(title, modalContent, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);

    // Generate QR code after modal is shown
    await this._generateAndDisplayQR(token);
  },

  /**
   * Generate and display QR code in modal
   * @private
   */
  async _generateAndDisplayQR(token) {
    const loadingEl = document.getElementById('qr-loading');
    const displayEl = document.getElementById('qr-code-display');
    const imageEl = document.getElementById('qr-code-image');
    const errorEl = document.getElementById('qr-error');
    const downloadBtn = document.getElementById('btn-download-qr');
    const printBtn = document.getElementById('btn-print-card');

    try {
      // Generate QR with token as data (same format kiosk expects)
      const qrDataURL = await this.generateQRDataURL(token, { size: 256 });

      // Store for later use
      this._currentQRDataURL = qrDataURL;

      // Confirm tag in backend (QR generated = "written")
      if (this._tokenInfo && this._currentEnrollment?.type === 'student') {
        try {
          await API.confirmTag(
            this._currentEnrollment.entity.id,
            this._tokenInfo.preview,
            null, // No hardware UID for QR
            this._tokenInfo.checksum
          );
          console.log('Tag confirmed in backend');
        } catch (confirmError) {
          console.error('Failed to confirm tag:', confirmError);
          // Don't block QR display, but warn user
          Components.showToast('QR generado, pero confirmación pendiente', 'warning');
        }
      }

      // Update UI
      if (loadingEl) loadingEl.style.display = 'none';
      if (imageEl) {
        imageEl.src = qrDataURL;
        imageEl.alt = `QR Code: ${token}`;
      }
      if (displayEl) displayEl.style.display = 'block';
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.onclick = () => this._downloadQR();
      }
      if (printBtn) {
        printBtn.disabled = false;
        printBtn.onclick = () => this._printCard();
      }

    } catch (error) {
      console.error('QR generation error:', error);
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.textContent = `Error: ${error.message}`;
      }
    }
  },

  /**
   * Download QR code as image
   * @private
   */
  _downloadQR() {
    if (!this._currentQRDataURL || !this._currentEnrollment) return;

    const link = document.createElement('a');
    link.download = `qr-${this._currentEnrollment.token}.png`;
    link.href = this._currentQRDataURL;
    link.click();

    Components.showToast('QR descargado', 'success');
  },

  /**
   * Print credential card
   * @private
   */
  _printCard() {
    if (!this._currentQRDataURL || !this._currentEnrollment) return;

    const cardHTML = this.generatePrintableCard(
      this._currentEnrollment.data,
      this._currentQRDataURL
    );

    // Open print window
    const printWindow = window.open('', '_blank', 'width=400,height=300');
    if (printWindow) {
      printWindow.document.write(cardHTML);
      printWindow.document.close();
    } else {
      Components.showToast('No se pudo abrir la ventana de impresion. Permita popups.', 'error');
    }
  },

  // Current enrollment data
  _currentEnrollment: null,
  _currentQRDataURL: null
};

// Export for global access
window.QREnrollment = QREnrollment;
