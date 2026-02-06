// Parent Absence Requests - Solicitudes de Ausencia
Views.parentAbsences = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent', { activeView: 'absences' });

  const content = document.getElementById('view-content');

  if (!State.currentGuardianId) {
    content.innerHTML = Components.createEmptyState('Error', 'No hay apoderado seleccionado');
    return;
  }

  const students = State.getGuardianStudents(State.currentGuardianId);
  const studentIds = students.map(s => s.id);
  const absences = State.getAbsences().filter(a => studentIds.includes(a.student_id));

  // Set default dates
  const today = new Date().toISOString().split('T')[0];

  // Type config with Material icons
  const typeOptions = [
    { value: 'MEDICAL', icon: 'medical_services', label: 'Médica', color: 'red' },
    { value: 'FAMILY', icon: 'family_restroom', label: 'Familiar', color: 'purple' },
    { value: 'VACATION', icon: 'flight', label: 'Vacaciones', color: 'blue' },
    { value: 'OTHER', icon: 'description', label: 'Otro', color: 'gray' }
  ];

  // Status badges config
  const statusBadges = {
    PENDING: { icon: 'schedule', label: 'Pendiente', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
    APPROVED: { icon: 'check_circle', label: 'Aprobada', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
    REJECTED: { icon: 'cancel', label: 'Rechazada', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' }
  };

  content.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Solicitudes de Ausencia</h2>
      <p class="text-gray-500 dark:text-gray-400 text-sm">Informe ausencias anticipadas o por enfermedad</p>
    </div>

    <!-- New Request Form -->
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6">
      <div class="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <span class="material-symbols-outlined text-lg text-indigo-600 dark:text-indigo-400">event_busy</span>
        </div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Nueva Solicitud</h3>
      </div>

      <div class="p-4">
        <form id="absence-form">
          <div class="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Alumno *</label>
              <select id="absence-student" required
                      class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600
                             rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                <option value="">Seleccione un alumno...</option>
                ${students.map(s => {
                  const course = State.getCourse(s.course_id);
                  return `<option value="${s.id}">${s.full_name} - ${course ? course.name : ''}</option>`;
                }).join('')}
              </select>
            </div>

            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Tipo de Ausencia *</label>
              <select id="absence-type" required
                      class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600
                             rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                ${typeOptions.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Fecha Inicio *</label>
              <input type="date" id="absence-start" required value="${today}"
                     class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600
                            rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white
                            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            </div>

            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Fecha Fin *</label>
              <input type="date" id="absence-end" required value="${today}"
                     class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600
                            rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white
                            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            </div>
          </div>

          <div class="mb-4">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Comentario o Motivo</label>
            <textarea id="absence-comment" rows="3"
                      placeholder="Describa brevemente el motivo de la ausencia (opcional)"
                      class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600
                             rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"></textarea>
          </div>

          <div class="mb-4">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Adjunto</label>
            <div class="border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl p-6 text-center
                        hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                 onclick="document.getElementById('absence-attachment').click()">
              <input type="file" id="absence-attachment" accept="image/*,.pdf" class="hidden">
              <span class="material-symbols-outlined text-3xl text-gray-400 dark:text-gray-500 mb-2 block">attach_file</span>
              <p class="text-sm text-gray-600 dark:text-gray-400">Haga clic para adjuntar un archivo</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF, JPG, PNG (max. 5MB)</p>
              <div id="file-name" class="mt-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium hidden"></div>
            </div>
          </div>

          <button type="button" class="btn-gradient w-full" onclick="Views.parentAbsences.submitRequest()">
            <span class="material-symbols-outlined">send</span>
            Enviar Solicitud
          </button>
        </form>
      </div>
    </div>

    <!-- Request History -->
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
      <div class="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-lg text-gray-600 dark:text-gray-400">history</span>
          </div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Historial</h3>
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400">${absences.length} solicitud${absences.length !== 1 ? 'es' : ''}</span>
      </div>

      <div id="absences-list">
        ${absences.length === 0 ? `
          <div class="text-center py-10">
            <span class="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2 block">inbox</span>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Sin solicitudes previas</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Las solicitudes que envíe aparecerán aquí</p>
          </div>
        ` : `
          <div class="divide-y divide-gray-50 dark:divide-gray-800">
            ${absences.map(absence => {
              const student = State.getStudent(absence.student_id);
              const type = typeOptions.find(t => t.value === absence.type) || typeOptions[3];
              const status = statusBadges[absence.status] || statusBadges.PENDING;

              const colorMap = {
                red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
                purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
                blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
                gray: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' }
              };
              const typeColor = colorMap[type.color] || colorMap.gray;

              return `
                <div class="p-4 flex items-start gap-3">
                  <div class="w-10 h-10 rounded-lg ${typeColor.bg} flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-lg ${typeColor.text}">${type.icon}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-0.5">
                      <span class="text-sm font-semibold text-gray-900 dark:text-white">${student ? student.full_name : 'Alumno'}</span>
                      <span class="text-xs px-2 py-0.5 rounded-full ${typeColor.bg} ${typeColor.text} font-medium">${type.label}</span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">calendar_today</span>
                      ${Components.formatDate(absence.start)}${absence.start !== absence.end ? ` al ${Components.formatDate(absence.end)}` : ''}
                    </p>
                    ${absence.comment ? `
                      <p class="text-xs text-gray-400 dark:text-gray-500 italic mt-1 truncate">"${absence.comment}"</p>
                    ` : ''}
                  </div>
                  <div class="flex-shrink-0">
                    <span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${status.bg} ${status.text} font-medium">
                      <span class="material-symbols-outlined text-xs">${status.icon}</span>
                      ${status.label}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // File input handler
  const fileInput = document.getElementById('absence-attachment');
  const fileNameDisplay = document.getElementById('file-name');

  fileInput?.addEventListener('change', function() {
    if (this.files && this.files[0]) {
      fileNameDisplay.innerHTML = `<span class="material-symbols-outlined text-xs align-middle">description</span> ${this.files[0].name}`;
      fileNameDisplay.classList.remove('hidden');
    } else {
      fileNameDisplay.classList.add('hidden');
    }
  });

  Views.parentAbsences.submitRequest = async function() {
    const form = document.getElementById('absence-form');
    if (!Components.validateForm(form)) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const startDate = document.getElementById('absence-start').value;
    const endDate = document.getElementById('absence-end').value;

    if (startDate > endDate) {
      Components.showToast('La fecha de inicio no puede ser mayor a la fecha de fin', 'error');
      return;
    }

    const fileInput = document.getElementById('absence-attachment');
    const file = fileInput.files[0] || null;

    // Validate file size (max 5MB)
    if (file && file.size > 5 * 1024 * 1024) {
      Components.showToast('El archivo excede el tamaño máximo de 5MB', 'error');
      return;
    }

    const absence = {
      student_id: parseInt(document.getElementById('absence-student').value),
      type: document.getElementById('absence-type').value,
      start: startDate,
      end: endDate,
      comment: document.getElementById('absence-comment').value,
      attachment_name: null
    };

    // Disable submit button while processing
    const submitBtn = form.querySelector('button[type="button"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-60');
      submitBtn.innerHTML = `<span class="material-symbols-outlined animate-spin">progress_activity</span> Enviando...`;
    }

    try {
      let created;

      // Call API to submit absence request
      if (State.isApiAuthenticated()) {
        created = await API.submitAbsence(absence);

        // If there's a file, upload it
        if (file) {
          if (submitBtn) {
            submitBtn.innerHTML = `<span class="material-symbols-outlined animate-spin">progress_activity</span> Subiendo archivo...`;
          }
          try {
            const updated = await API.uploadAbsenceAttachment(created.id, file);
            created = updated;
          } catch (uploadError) {
            console.error('Error uploading attachment:', uploadError);
            Components.showToast('Solicitud creada, pero error al subir archivo: ' + uploadError.message, 'warning');
          }
        }

        // Add to local state for immediate UI update
        State.data.absences.push(created);
        State.persist();
      } else {
        // Demo mode - save locally only (no real upload)
        State.addAbsence(absence);
      }

      Components.showToast('Solicitud enviada exitosamente', 'success');

      // Reset form
      form.reset();
      document.getElementById('file-name').classList.add('hidden');

      // Refresh view
      setTimeout(() => Views.parentAbsences(), 500);
    } catch (error) {
      console.error('Error submitting absence:', error);
      Components.showToast('Error al enviar solicitud: ' + (error.message || 'Intente nuevamente'), 'error');
    } finally {
      // Re-enable submit button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-60');
        submitBtn.innerHTML = `<span class="material-symbols-outlined">send</span> Enviar Solicitud`;
      }
    }
  };
};
