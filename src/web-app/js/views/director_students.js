// Director Students Management
// Counter for race condition protection when loading photos
let photoLoadCounter = 0;

Views.directorStudents = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Alumnos y Cursos';

  const courses = State.getCourses();
  let filteredStudents = State.getStudents();
  let searchTerm = '';
  let selectedCourse = '';

  function renderStudents() {
    content.innerHTML = `
      <div class="filters" style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; margin-bottom: 1.5rem;">
        <div class="filter-group" style="flex: 1; min-width: 200px;">
          <label class="form-label">Buscar alumno</label>
          <input type="text" id="search-student" class="form-input" placeholder="Nombre..." value="${searchTerm}">
        </div>

        <div class="filter-group" style="flex: 1; min-width: 150px;">
          <label class="form-label">Curso</label>
          <select id="filter-course" class="form-select">
            <option value="">Todos</option>
            ${courses.map(c => `<option value="${c.id}" ${selectedCourse === c.id ? 'selected' : ''}>${Components.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>

        <div class="filter-group" style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" onclick="Views.directorStudents.applyFilters()">Filtrar</button>
          <button class="btn btn-primary" onclick="Views.directorStudents.showCreateForm()">+ Nuevo Alumno</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Lista de Alumnos (${filteredStudents.length})</span>
        </div>
        <div class="card-body">
          ${filteredStudents.length === 0 ? Components.createEmptyState(
            'Sin alumnos',
            searchTerm || selectedCourse
              ? 'No hay alumnos que coincidan con los filtros seleccionados'
              : 'No hay alumnos registrados en el sistema'
          ) : `
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Curso</th>
                <th>Asistencia</th>
                <th>Aut. Foto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.map(student => {
                const course = State.getCourse(student.course_id);
                const photoChip = student.photo_pref_opt_in
                  ? Components.createChip('Sí', 'success')
                  : Components.createChip('No', 'gray');
                const stats = State.getStudentAttendanceStats(student.id);
                const attendanceChip = stats.percentage >= 90
                  ? Components.createChip(stats.percentage + '%', 'success')
                  : stats.percentage >= 75
                    ? Components.createChip(stats.percentage + '%', 'warning')
                    : Components.createChip(stats.percentage + '%', 'error');

                return `
                  <tr>
                    <td><strong>${Components.escapeHtml(student.full_name)}</strong></td>
                    <td>${course ? Components.escapeHtml(course.name) : '-'}</td>
                    <td>${attendanceChip}</td>
                    <td>${photoChip}</td>
                    <td style="white-space: nowrap;">
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorStudents.viewProfile(${student.id})" title="Ver perfil">
                        👁️
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorStudents.showEnrollMenu(${student.id})" title="Generar credencial QR/NFC">
                        💳
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorStudents.viewAttendance(${student.id})" title="Ver asistencia">
                        📊
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorStudents.showEditForm(${student.id})" title="Editar">
                        ✏️
                      </button>
                      <button class="btn btn-error btn-sm" onclick="Views.directorStudents.confirmDelete(${student.id})" title="Eliminar">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          `}
        </div>
      </div>
    `;
  }

  Views.directorStudents.applyFilters = function() {
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

    renderStudents();
  };

  Views.directorStudents.showCreateForm = function() {
    const coursesOptions = courses.map(c =>
      `<option value="${c.id}">${Components.escapeHtml(c.name)} - ${Components.escapeHtml(c.grade)}</option>`
    ).join('');

    // Get guardians for selector
    const guardians = State.getGuardians();
    const guardiansOptions = guardians.map(g =>
      `<option value="${g.id}">${Components.escapeHtml(g.full_name)} (${Components.escapeHtml(g.email || 'sin email')})</option>`
    ).join('');

    Components.showModal('Nuevo Alumno', `
      <form id="student-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="student-name" class="form-input" required placeholder="Ej: Juan Pérez García">
        </div>
        <div class="form-group">
          <label class="form-label">Curso *</label>
          <select id="student-course" class="form-select" required>
            <option value="">Seleccione un curso</option>
            ${coursesOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">RUT o N° Matrícula (opcional)</label>
          <input type="text" id="student-rut" class="form-input" placeholder="Ej: 12.345.678-9 o MAT-2024-001">
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            Identificador único del alumno en el colegio
          </small>
        </div>

        <!-- Guardian selector -->
        <div class="form-group">
          <label class="form-label">Apoderado</label>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
            <select id="student-guardian" class="form-select" style="flex: 1;">
              <option value="">Sin apoderado asignado</option>
              ${guardiansOptions}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Views.directorStudents.goToCreateGuardian()" title="Crear nuevo apoderado" style="white-space: nowrap;">
              + Nuevo
            </button>
          </div>
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            El apoderado recibirá notificaciones de asistencia.
            <a href="#/director/guardians" style="color: var(--color-primary);">Ir a gestión de apoderados</a>
          </small>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="student-photo">
            <span>Autorizar captura de fotos</span>
          </label>
        </div>

        <!-- Nota sobre enrolamiento -->
        <div style="background: var(--color-info-light); padding: 0.75rem; border-radius: 8px; margin-top: 1rem; font-size: 0.85rem;">
          <strong>💳 Credenciales QR/NFC:</strong>
          <p style="margin: 0.25rem 0 0; color: var(--color-gray-600);">
            Después de guardar el alumno, podrás generar su credencial QR o NFC desde el botón "👁️ Ver perfil" en la tabla.
          </p>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorStudents.saveStudent() }
    ]);
  };

  Views.directorStudents.goToCreateGuardian = function() {
    document.querySelector('.modal-container').click();
    Components.showToast('Cree el apoderado y luego vuelva a crear el alumno', 'info', 3000);
    Router.navigate('/director/guardians');
  };

  Views.directorStudents.saveStudent = async function(studentId = null) {
    const name = document.getElementById('student-name').value.trim();
    const courseId = parseInt(document.getElementById('student-course').value);
    const nationalId = document.getElementById('student-rut')?.value.trim() || '';
    const photoOptIn = document.getElementById('student-photo').checked;
    const guardianSelect = document.getElementById('student-guardian');
    const guardianId = guardianSelect ? parseInt(guardianSelect.value) || null : null;
    const photoFileInput = document.getElementById('student-photo-file');
    const photoFile = photoFileInput?.files?.[0] || null;

    if (!name || !courseId) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const studentData = {
      full_name: name,
      course_id: courseId,
      national_id: nationalId,
      photo_pref_opt_in: photoOptIn
    };

    let newStudentId = studentId;
    if (studentId) {
      State.updateStudent(studentId, studentData);
    } else {
      const newStudent = State.addStudent(studentData);
      newStudentId = newStudent.id;
    }

    // Upload photo if a new one was selected
    if (photoFile && newStudentId) {
      try {
        Components.showToast('Subiendo foto...', 'info', 2000);
        await API.uploadStudentPhoto(newStudentId, photoFile);
        Components.showToast('Foto subida correctamente', 'success');
      } catch (e) {
        console.error('Error uploading photo:', e);
        Components.showToast(e.message || 'Error al subir la foto', 'error');
      }
    }

    // Handle guardian association
    if (newStudentId) {
      const guardians = State.getGuardians();

      // Find current guardian (if editing)
      const currentGuardian = guardians.find(g => g.student_ids && g.student_ids.includes(newStudentId));

      // Remove from old guardian if different
      if (currentGuardian && currentGuardian.id !== guardianId) {
        State.updateGuardian(currentGuardian.id, {
          student_ids: currentGuardian.student_ids.filter(id => id !== newStudentId)
        });
      }

      // Add to new guardian if selected
      if (guardianId) {
        const newGuardian = State.getGuardian(guardianId);
        if (newGuardian) {
          const guardianStudentIds = newGuardian.student_ids || [];
          if (!guardianStudentIds.includes(newStudentId)) {
            State.updateGuardian(guardianId, {
              student_ids: [...guardianStudentIds, newStudentId]
            });
          }
        }
      }
    }

    Components.showToast(studentId ? 'Alumno actualizado correctamente' : 'Alumno creado correctamente', 'success');
    document.querySelector('.modal-container').click(); // Close modal
    filteredStudents = State.getStudents();
    renderStudents();
  };

  Views.directorStudents.showEditForm = async function(studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    // Try to get photo URL from backend if available
    let photoPreviewUrl = null;
    try {
      const studentDetails = await API.getStudent(studentId);
      photoPreviewUrl = studentDetails.photo_presigned_url;
    } catch (e) {
      console.log('Could not fetch student photo details:', e);
    }

    // Generate unique ID for this photo load (race condition protection)
    const currentPhotoLoadId = ++photoLoadCounter;

    const coursesOptions = courses.map(c =>
      `<option value="${c.id}" ${c.id === student.course_id ? 'selected' : ''}>${Components.escapeHtml(c.name)} - ${Components.escapeHtml(c.grade)}</option>`
    ).join('');

    // Get guardians and find current guardian for this student
    const guardians = State.getGuardians();
    const currentGuardian = guardians.find(g => g.student_ids && g.student_ids.includes(studentId));
    const guardiansOptions = guardians.map(g =>
      `<option value="${g.id}" ${currentGuardian && currentGuardian.id === g.id ? 'selected' : ''}>${Components.escapeHtml(g.full_name)} (${Components.escapeHtml(g.email || 'sin email')})</option>`
    ).join('');

    // Build photo HTML with loading state if URL exists
    const photoHTML = photoPreviewUrl
      ? `<div style="position: relative; display: inline-block; width: 100%; height: 100%;">
           <img id="photo-preview" src="" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.3;" data-loading="true">
           <div id="photo-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;">⏳</div>
         </div>`
      : `<span id="photo-placeholder" style="font-size: 2rem; color: var(--color-gray-400);">📷</span>`;

    Components.showModal('Editar Alumno', `
      <form id="student-form">
        <!-- Photo Upload Section -->
        <div class="form-group">
          <label class="form-label">Foto del Alumno</label>
          <div style="display: flex; gap: 1rem; align-items: flex-start;">
            <div id="photo-preview-container" style="width: 100px; height: 100px; border: 2px dashed var(--color-gray-300); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--color-gray-50);">
              ${photoHTML}
            </div>
            <div style="flex: 1;">
              <input type="file" id="student-photo-file" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="Views.directorStudents.previewPhoto(this)">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('student-photo-file').click()">
                ${photoPreviewUrl ? '📷 Cambiar foto' : '📷 Subir foto'}
              </button>
              ${photoPreviewUrl ? `
                <button type="button" class="btn btn-error btn-sm" onclick="Views.directorStudents.removePhotoPreview(${studentId})" style="margin-left: 0.5rem;">
                  🗑️ Eliminar
                </button>
              ` : ''}
              <small style="color: var(--color-gray-500); display: block; margin-top: 0.5rem;">
                Formatos: JPG, PNG, WebP. Máximo: 5MB
              </small>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="student-name" class="form-input" required value="${Components.escapeHtml(student.full_name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Curso *</label>
          <select id="student-course" class="form-select" required>
            ${coursesOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">RUT o N° Matrícula</label>
          <input type="text" id="student-rut" class="form-input" value="${Components.escapeHtml(student.national_id || '')}" placeholder="Ej: 12.345.678-9 o MAT-2024-001">
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            Identificador único del alumno en el colegio
          </small>
        </div>

        <!-- Guardian selector -->
        <div class="form-group">
          <label class="form-label">Apoderado</label>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
            <select id="student-guardian" class="form-select" style="flex: 1;">
              <option value="">Sin apoderado asignado</option>
              ${guardiansOptions}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Views.directorStudents.goToCreateGuardian()" title="Crear nuevo apoderado" style="white-space: nowrap;">
              + Nuevo
            </button>
          </div>
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            El apoderado recibirá notificaciones de asistencia.
          </small>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="student-photo" ${student.photo_pref_opt_in ? 'checked' : ''}>
            <span>Autorizar captura de fotos</span>
          </label>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorStudents.saveStudent(studentId) }
    ]);

    // Load photo with authentication after modal is rendered
    if (photoPreviewUrl) {
      API.loadAuthenticatedImage(photoPreviewUrl).then(blobUrl => {
        // Verify no navigation occurred during load (race condition protection)
        if (photoLoadCounter !== currentPhotoLoadId) return;

        const img = document.getElementById('photo-preview');
        const loading = document.getElementById('photo-loading');

        if (img && blobUrl) {
          img.src = blobUrl;
          img.style.opacity = '1';
          img.removeAttribute('data-loading');
        }
        if (loading) loading.remove();
      }).catch(err => {
        console.error('Error loading photo:', err);
        const loading = document.getElementById('photo-loading');
        if (loading) loading.innerHTML = '❌';
      });
    }
  };

  // Preview photo before upload
  Views.directorStudents.previewPhoto = function(input) {
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        Components.showToast('La imagen es demasiado grande. Máximo 5MB', 'error');
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        const container = document.getElementById('photo-preview-container');
        container.innerHTML = `<img id="photo-preview" src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove photo preview and mark for deletion
  Views.directorStudents.removePhotoPreview = async function(studentId) {
    try {
      await API.deleteStudentPhoto(studentId);
      const container = document.getElementById('photo-preview-container');
      container.innerHTML = `<span id="photo-placeholder" style="font-size: 2rem; color: var(--color-gray-400);">📷</span>`;
      document.getElementById('student-photo-file').value = '';
      Components.showToast('Foto eliminada', 'success');
    } catch (e) {
      Components.showToast(e.message || 'Error al eliminar foto', 'error');
    }
  };

  Views.directorStudents.confirmDelete = function(studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    Components.showModal('Confirmar Eliminación', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Está seguro de eliminar al alumno?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(student.full_name)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          Esta acción eliminará también todos los registros de asistencia del alumno.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: () => {
        State.deleteStudent(studentId);
        document.querySelector('.modal-container').click();
        Components.showToast('Alumno eliminado', 'success');
        filteredStudents = State.getStudents();
        renderStudents();
      }}
    ]);
  };

  Views.directorStudents.viewProfile = async function(studentId) {
    const student = State.getStudent(studentId);
    const course = State.getCourse(student.course_id);
    const guardians = State.getGuardians().filter(g => g.student_ids.includes(studentId));
    const stats = State.getStudentAttendanceStats(studentId);

    // Try to get photo URL from backend
    let photoUrl = null;
    try {
      const studentDetails = await API.getStudent(studentId);
      photoUrl = studentDetails.photo_presigned_url;
    } catch (e) {
      console.log('Could not fetch student photo:', e);
    }

    // Generate unique ID for this photo load (race condition protection)
    const currentPhotoLoadId = ++photoLoadCounter;

    const guardiansHTML = guardians.map(g => `
      <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100);">
        <strong>${Components.escapeHtml(g.full_name)}</strong><br>
        <span style="font-size: 0.85rem; color: var(--color-gray-500);">
          ${g.contacts.map(c => `${c.type}: ${c.value} ${c.verified ? '✅' : '⏳'}`).join(' | ')}
        </span>
      </li>
    `).join('');

    // Build photo HTML with loading state if URL exists
    const photoHTML = photoUrl
      ? `<div style="position: relative; display: inline-block;">
           <img id="profile-photo" src="" style="width: 120px; height: 120px; object-fit: cover; border-radius: 50%; border: 3px solid var(--color-primary); opacity: 0.3;" data-loading="true">
           <div id="profile-photo-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;">⏳</div>
         </div>`
      : `<div style="width: 120px; height: 120px; border-radius: 50%; background: var(--color-gray-200); display: flex; align-items: center; justify-content: center; font-size: 3rem; color: var(--color-gray-400);">👤</div>`;

    Components.showModal(`Perfil - ${student.full_name}`, `
      <div class="card mb-2">
        <div class="card-header">Información Básica</div>
        <div class="card-body">
          <div style="display: flex; gap: 1.5rem; align-items: flex-start;">
            <div style="flex-shrink: 0;">
              ${photoHTML}
            </div>
            <div style="flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
              <div><strong>Nombre:</strong><br>${Components.escapeHtml(student.full_name)}</div>
              <div><strong>Curso:</strong><br>${course ? Components.escapeHtml(course.name + ' - ' + course.grade) : '-'}</div>
              <div><strong>RUT/Matrícula:</strong><br>${student.national_id || 'No registrado'}</div>
              <div><strong>ID Sistema:</strong><br><span style="font-family: monospace; color: var(--color-gray-500);">#${student.id}</span> <small style="color: var(--color-gray-400);">(auto)</small></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header">Estadísticas de Asistencia</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
            <div style="background: var(--color-success-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">${stats.percentage}%</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Asistencia</div>
            </div>
            <div style="background: var(--color-primary-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-primary);">${stats.daysPresent}</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Días Presente</div>
            </div>
            <div style="background: var(--color-warning-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">${stats.lateArrivals}</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Atrasos</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Apoderados Vinculados</div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${guardiansHTML || '<li style="color: var(--color-gray-500);">Sin apoderados registrados</li>'}
          </ul>
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' },
      { label: 'Enrolar QR', action: 'qr', className: 'btn-secondary', onClick: () => {
        document.querySelector('.modal-container').click();
        if (typeof QREnrollment !== 'undefined') {
          QREnrollment.showStudentEnrollmentModal(studentId);
        } else {
          Components.showToast('Servicio QR no disponible', 'error');
        }
      }},
      { label: 'Enrolar NFC', action: 'nfc', className: 'btn-secondary', onClick: () => {
        document.querySelector('.modal-container').click();
        if (typeof NFCEnrollment !== 'undefined') {
          NFCEnrollment.showStudentEnrollmentModal(studentId);
        } else {
          Components.showToast('Servicio NFC no disponible', 'error');
        }
      }},
      { label: 'Ver Asistencia', action: 'attendance', className: 'btn-primary', onClick: () => {
        document.querySelector('.modal-container').click();
        Views.directorStudents.viewAttendance(studentId);
      }}
    ]);

    // Load photo with authentication after modal is rendered
    if (photoUrl) {
      API.loadAuthenticatedImage(photoUrl).then(blobUrl => {
        // Verify no navigation occurred during load (race condition protection)
        if (photoLoadCounter !== currentPhotoLoadId) return;

        const img = document.getElementById('profile-photo');
        const loading = document.getElementById('profile-photo-loading');

        if (img && blobUrl) {
          img.src = blobUrl;
          img.style.opacity = '1';
          img.removeAttribute('data-loading');
        }
        if (loading) loading.remove();
      }).catch(err => {
        console.error('Error loading profile photo:', err);
        const loading = document.getElementById('profile-photo-loading');
        if (loading) loading.innerHTML = '❌';
      });
    }
  };

  Views.directorStudents.viewAttendance = function(studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    const course = State.getCourse(student.course_id);
    const stats = State.getStudentAttendanceStats(studentId);
    const events = State.getAttendanceEvents({ studentId }).slice(0, 20);

    const eventsHTML = events.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Tipo</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          ${events.map(e => `
            <tr>
              <td>${Components.formatDate(e.ts)}</td>
              <td>${Components.formatTime(e.ts)}</td>
              <td>${e.type === 'IN' ? Components.createChip('Entrada', 'success') : Components.createChip('Salida', 'info')}</td>
              <td>${Components.createChip(e.source || 'QR', 'gray')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color: var(--color-gray-500); text-align: center;">Sin registros de asistencia</p>';

    Components.showModal(`Asistencia - ${student.full_name}`, `
      <div style="margin-bottom: 1rem; padding: 1rem; background: var(--color-gray-50); border-radius: 8px;">
        <strong>${Components.escapeHtml(student.full_name)}</strong>
        <span style="color: var(--color-gray-500);">${course ? ' - ' + Components.escapeHtml(course.name) : ''}</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 0.75rem; background: ${stats.percentage >= 90 ? 'var(--color-success-light)' : stats.percentage >= 75 ? 'var(--color-warning-light)' : 'var(--color-error-light)'}; border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.percentage}%</div>
          <div style="font-size: 0.7rem;">Asistencia</div>
        </div>
        <div style="text-align: center; padding: 0.75rem; background: var(--color-gray-100); border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.daysPresent}</div>
          <div style="font-size: 0.7rem;">Presente</div>
        </div>
        <div style="text-align: center; padding: 0.75rem; background: var(--color-gray-100); border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.totalSchoolDays - stats.daysPresent}</div>
          <div style="font-size: 0.7rem;">Ausente</div>
        </div>
        <div style="text-align: center; padding: 0.75rem; background: var(--color-gray-100); border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.lateArrivals}</div>
          <div style="font-size: 0.7rem;">Atrasos</div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Registrar Asistencia Manual</span>
        </div>
        <div class="card-body">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-success" onclick="Views.directorStudents.registerAttendance(${studentId}, 'IN')">
              ✓ Registrar Entrada
            </button>
            <button class="btn btn-secondary" onclick="Views.directorStudents.registerAttendance(${studentId}, 'OUT')">
              ↩ Registrar Salida
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Últimos 20 Registros</div>
        <div class="card-body" style="max-height: 300px; overflow-y: auto;">
          ${eventsHTML}
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  Views.directorStudents.registerAttendance = function(studentId, type) {
    State.addAttendanceEvent({
      student_id: studentId,
      type: type,
      source: 'MANUAL'
    });
    Components.showToast(`${type === 'IN' ? 'Entrada' : 'Salida'} registrada correctamente`, 'success');
    // Refresh the modal
    document.querySelector('.modal-container').click();
    Views.directorStudents.viewAttendance(studentId);
  };

  Views.directorStudents.showEnrollMenu = function(studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    Components.showModal('Generar Credencial', `
      <div style="text-align: center; padding: 1rem;">
        <p style="margin-bottom: 1.5rem;">
          Selecciona el tipo de credencial para <strong>${Components.escapeHtml(student.full_name)}</strong>:
        </p>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <button class="btn btn-primary btn-lg" onclick="Views.directorStudents.enrollQR(${studentId})">
            📱 Generar QR
            <small style="display: block; font-weight: normal; font-size: 0.8rem;">Para imprimir en credencial</small>
          </button>
          <button class="btn btn-secondary btn-lg" onclick="Views.directorStudents.enrollNFC(${studentId})">
            💳 Escribir NFC
            <small style="display: block; font-weight: normal; font-size: 0.8rem;">Requiere lector NFC</small>
          </button>
        </div>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  Views.directorStudents.enrollQR = function(studentId) {
    document.querySelector('.modal-container')?.click();
    if (typeof QREnrollment !== 'undefined') {
      QREnrollment.showStudentEnrollmentModal(studentId);
    } else {
      Components.showToast('Servicio QR no disponible', 'error');
    }
  };

  Views.directorStudents.enrollNFC = function(studentId) {
    document.querySelector('.modal-container')?.click();
    if (typeof NFCEnrollment !== 'undefined') {
      NFCEnrollment.showStudentEnrollmentModal(studentId);
    } else {
      Components.showToast('Servicio NFC no disponible', 'error');
    }
  };

  renderStudents();

  // Check for viewProfile query param to auto-open student profile
  const hash = window.location.hash;
  const queryMatch = hash.match(/\?viewProfile=(\d+)/);
  if (queryMatch) {
    const studentId = parseInt(queryMatch[1]);
    if (studentId && State.getStudent(studentId)) {
      setTimeout(() => Views.directorStudents.viewProfile(studentId), 100);
    }
  }
};
