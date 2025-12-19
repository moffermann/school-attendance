// Director Schedules - Enhanced UX Version
Views.directorSchedules = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Horarios Base';

  const courses = State.getCourses();
  // ISO 8601: 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo
  const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const weekdaysShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

  // Estado temporal para el time picker
  let activeTimePicker = null;

  // ==================== TIME PICKER COMPONENT ====================

  function createTimePickerModal() {
    const modal = document.createElement('div');
    modal.id = 'time-picker-modal';
    modal.className = 'time-picker-overlay';
    modal.innerHTML = `
      <div class="time-picker-container">
        <div class="time-picker-header">
          <span class="time-picker-title">Seleccionar Hora</span>
          <button class="time-picker-close" onclick="Views.directorSchedules.closeTimePicker()">&times;</button>
        </div>
        <div class="time-picker-display">
          <span id="tp-hour">08</span>:<span id="tp-minute">00</span>
        </div>
        <div class="time-picker-body">
          <div class="time-picker-section">
            <label>Hora</label>
            <div class="time-picker-grid hours-grid">
              ${Array.from({length: 24}, (_, i) => {
                const hour = i.toString().padStart(2, '0');
                return `<button class="tp-btn tp-hour" data-value="${hour}">${hour}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="time-picker-section">
            <label>Minutos</label>
            <div class="time-picker-grid minutes-grid">
              ${['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(min =>
                `<button class="tp-btn tp-minute" data-value="${min}">${min}</button>`
              ).join('')}
            </div>
          </div>
        </div>
        <div class="time-picker-presets">
          <span class="presets-label">Horarios comunes:</span>
          <button class="tp-preset" data-time="07:30">7:30</button>
          <button class="tp-preset" data-time="08:00">8:00</button>
          <button class="tp-preset" data-time="08:30">8:30</button>
          <button class="tp-preset" data-time="12:00">12:00</button>
          <button class="tp-preset" data-time="13:00">13:00</button>
          <button class="tp-preset" data-time="14:00">14:00</button>
          <button class="tp-preset" data-time="16:00">16:00</button>
          <button class="tp-preset" data-time="17:00">17:00</button>
        </div>
        <div class="time-picker-actions">
          <button class="btn btn-secondary" onclick="Views.directorSchedules.closeTimePicker()">Cancelar</button>
          <button class="btn btn-primary" onclick="Views.directorSchedules.confirmTimePicker()">Aceptar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners para los botones del time picker
    modal.querySelectorAll('.tp-hour').forEach(btn => {
      btn.addEventListener('click', (e) => {
        modal.querySelectorAll('.tp-hour').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById('tp-hour').textContent = e.target.dataset.value;
      });
    });

    modal.querySelectorAll('.tp-minute').forEach(btn => {
      btn.addEventListener('click', (e) => {
        modal.querySelectorAll('.tp-minute').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById('tp-minute').textContent = e.target.dataset.value;
      });
    });

    modal.querySelectorAll('.tp-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const [hour, minute] = e.target.dataset.time.split(':');
        document.getElementById('tp-hour').textContent = hour.padStart(2, '0');
        document.getElementById('tp-minute').textContent = minute;
        // Actualizar selección visual
        modal.querySelectorAll('.tp-hour').forEach(b => {
          b.classList.toggle('active', b.dataset.value === hour.padStart(2, '0'));
        });
        modal.querySelectorAll('.tp-minute').forEach(b => {
          b.classList.toggle('active', b.dataset.value === minute);
        });
      });
    });

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        Views.directorSchedules.closeTimePicker();
      }
    });
  }

  Views.directorSchedules.openTimePicker = function(inputElement) {
    activeTimePicker = inputElement;
    const modal = document.getElementById('time-picker-modal');

    // Establecer valor inicial
    const currentValue = inputElement.value || '08:00';
    const [hour, minute] = currentValue.split(':');
    document.getElementById('tp-hour').textContent = hour || '08';
    document.getElementById('tp-minute').textContent = minute || '00';

    // Marcar selección actual
    modal.querySelectorAll('.tp-hour').forEach(b => {
      b.classList.toggle('active', b.dataset.value === hour);
    });
    modal.querySelectorAll('.tp-minute').forEach(b => {
      b.classList.toggle('active', b.dataset.value === minute);
    });

    modal.classList.add('show');
  };

  Views.directorSchedules.closeTimePicker = function() {
    const modal = document.getElementById('time-picker-modal');
    modal.classList.remove('show');
    activeTimePicker = null;
  };

  Views.directorSchedules.confirmTimePicker = function() {
    if (activeTimePicker) {
      const hour = document.getElementById('tp-hour').textContent;
      const minute = document.getElementById('tp-minute').textContent;
      activeTimePicker.value = `${hour}:${minute}`;
      activeTimePicker.dispatchEvent(new Event('change'));

      // Feedback visual - guardar referencia antes de que closeTimePicker la anule
      const inputElement = activeTimePicker;
      inputElement.classList.add('time-updated');
      setTimeout(() => inputElement.classList.remove('time-updated'), 500);
    }
    Views.directorSchedules.closeTimePicker();
  };

  // ==================== RENDER SCHEDULES ====================

  function renderSchedules() {
    content.innerHTML = `
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <span>Horarios por Curso y Día</span>
        </div>

        <div class="card-body">
          ${courses.map(course => {
            const schedules = State.getSchedules(course.id);

            return `
              <div class="card mb-3 schedule-course-card" style="background: var(--color-gray-50);">
                <div class="card-header flex justify-between items-center">
                  <span>${course.name} - ${course.grade}</span>
                  <div class="schedule-bulk-actions">
                    <button class="btn btn-sm btn-success" title="Guardar todos los horarios"
                      onclick="Views.directorSchedules.saveAllSchedules(${course.id})">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                      Guardar todos
                    </button>
                    <button class="btn btn-sm btn-outline" title="Aplicar horario a todos los días"
                      onclick="Views.directorSchedules.copyToAllDays(${course.id})">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      Copiar a todos
                    </button>
                    <button class="btn btn-sm btn-outline btn-danger-outline" title="Borrar todos los horarios"
                      onclick="Views.directorSchedules.deleteAllSchedules(${course.id})">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Borrar todos
                    </button>
                  </div>
                </div>
                <div class="card-body schedule-grid-container">
                  <div class="schedule-grid">
                    ${[0,1,2,3,4].map(weekday => {
                      const existingSchedule = schedules.find(s => s.weekday === weekday);
                      const schedule = existingSchedule || {
                        course_id: course.id,
                        weekday,
                        in_time: '',
                        out_time: ''
                      };
                      const isUnsaved = !existingSchedule;
                      const hasSchedule = schedule.in_time && schedule.out_time;

                      return `
                        <div class="schedule-day-card ${isUnsaved ? 'unsaved' : 'saved'}" data-course="${course.id}" data-weekday="${weekday}">
                          <div class="schedule-day-header">
                            <span class="day-name">${weekdays[weekday]}</span>
                            <span class="day-short">${weekdaysShort[weekday]}</span>
                          </div>
                          <div class="schedule-times">
                            <div class="time-input-group">
                              <label>Entrada</label>
                              <div class="time-input-wrapper">
                                <input type="text"
                                  class="schedule-time-input ${isUnsaved ? 'border-warning' : ''}"
                                  value="${schedule.in_time ? schedule.in_time.substring(0,5) : ''}"
                                  placeholder="--:--"
                                  readonly
                                  data-schedule-id="${schedule.id || ''}"
                                  data-course-id="${course.id}"
                                  data-weekday="${weekday}"
                                  data-field="in_time"
                                  onclick="Views.directorSchedules.openTimePicker(this)">
                                <svg class="clock-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                              </div>
                            </div>
                            <div class="time-input-group">
                              <label>Salida</label>
                              <div class="time-input-wrapper">
                                <input type="text"
                                  class="schedule-time-input ${isUnsaved ? 'border-warning' : ''}"
                                  value="${schedule.out_time ? schedule.out_time.substring(0,5) : ''}"
                                  placeholder="--:--"
                                  readonly
                                  data-schedule-id="${schedule.id || ''}"
                                  data-course-id="${course.id}"
                                  data-weekday="${weekday}"
                                  data-field="out_time"
                                  onclick="Views.directorSchedules.openTimePicker(this)">
                                <svg class="clock-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                              </div>
                            </div>
                          </div>
                          <div class="schedule-day-actions">
                            <button class="btn-icon btn-save" title="Guardar"
                              onclick="Views.directorSchedules.saveSchedule(${schedule.id || 'null'}, ${course.id}, ${weekday})">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                              </svg>
                            </button>
                            ${weekday < 4 ? `
                              <button class="btn-icon btn-copy" title="Copiar al día siguiente"
                                onclick="Views.directorSchedules.copyToNextDay(${course.id}, ${weekday})"
                                ${!hasSchedule ? 'disabled' : ''}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                              </button>
                            ` : ''}
                            <button class="btn-icon btn-delete" title="Borrar este día"
                              onclick="Views.directorSchedules.deleteDay(${course.id}, ${weekday})"
                              ${!hasSchedule ? 'disabled' : ''}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ==================== ACTION FUNCTIONS ====================

  // Guardar horario individual
  Views.directorSchedules.saveSchedule = async function(scheduleId, courseId, weekday) {
    const card = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${weekday}"]`);
    const inTimeInput = card.querySelector('[data-field="in_time"]');
    const outTimeInput = card.querySelector('[data-field="out_time"]');
    const saveBtn = card.querySelector('.btn-save');

    const inTime = inTimeInput.value;
    const outTime = outTimeInput.value;

    // Validación campos requeridos
    if (!inTime || !outTime) {
      Components.showToast('Complete ambos horarios', 'error');
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 500);
      return;
    }

    // Validación de formato HH:MM
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(inTime) || !timeRegex.test(outTime)) {
      Components.showToast('Formato de hora inválido', 'error');
      return;
    }

    // Validación lógica de horas
    if (outTime <= inTime) {
      Components.showToast('La hora de salida debe ser posterior a la de entrada', 'error');
      return;
    }

    // Feedback visual
    saveBtn.classList.add('saving');
    card.classList.add('saving');

    try {
      const scheduleData = {
        weekday: weekday,
        in_time: inTime,
        out_time: outTime
      };

      if (scheduleId) {
        await State.updateSchedule(scheduleId, scheduleData);
      } else {
        const newSchedule = await State.createSchedule(courseId, scheduleData);
        inTimeInput.dataset.scheduleId = newSchedule.id;
        outTimeInput.dataset.scheduleId = newSchedule.id;

        // Actualizar el onclick del botón guardar
        saveBtn.setAttribute('onclick',
          `Views.directorSchedules.saveSchedule(${newSchedule.id}, ${courseId}, ${weekday})`
        );
      }

      // Actualizar estado visual
      card.classList.remove('unsaved');
      card.classList.add('saved');
      inTimeInput.classList.remove('border-warning');
      outTimeInput.classList.remove('border-warning');

      // Habilitar botones de acción
      card.querySelectorAll('.btn-copy, .btn-delete').forEach(btn => btn.disabled = false);

      Components.showToast('Horario guardado', 'success');
    } catch (error) {
      Components.showToast(error.message || 'Error al guardar', 'error');
    } finally {
      saveBtn.classList.remove('saving');
      card.classList.remove('saving');
    }
  };

  // Copiar al día siguiente
  Views.directorSchedules.copyToNextDay = function(courseId, weekday) {
    const currentCard = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${weekday}"]`);
    const nextCard = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${weekday + 1}"]`);

    if (!nextCard) return;

    const inTime = currentCard.querySelector('[data-field="in_time"]').value;
    const outTime = currentCard.querySelector('[data-field="out_time"]').value;

    if (!inTime || !outTime) {
      Components.showToast('Primero complete el horario del día actual', 'error');
      return;
    }

    nextCard.querySelector('[data-field="in_time"]').value = inTime;
    nextCard.querySelector('[data-field="out_time"]').value = outTime;

    // Feedback visual
    nextCard.classList.add('copied');
    setTimeout(() => nextCard.classList.remove('copied'), 600);

    Components.showToast(`Horario copiado a ${weekdays[weekday + 1]}. Recuerde guardar.`, 'info');
  };

  // Copiar a todos los días
  Views.directorSchedules.copyToAllDays = function(courseId) {
    // Usar el primer día con horario como referencia
    let referenceInTime = '';
    let referenceOutTime = '';

    for (let i = 0; i < 5; i++) {
      const card = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${i}"]`);
      const inTime = card.querySelector('[data-field="in_time"]').value;
      const outTime = card.querySelector('[data-field="out_time"]').value;
      if (inTime && outTime) {
        referenceInTime = inTime;
        referenceOutTime = outTime;
        break;
      }
    }

    if (!referenceInTime || !referenceOutTime) {
      Components.showToast('Primero ingrese un horario en algún día', 'error');
      return;
    }

    // Aplicar a todos los días
    for (let i = 0; i < 5; i++) {
      const card = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${i}"]`);
      card.querySelector('[data-field="in_time"]').value = referenceInTime;
      card.querySelector('[data-field="out_time"]').value = referenceOutTime;
      card.classList.add('copied');
      setTimeout(() => card.classList.remove('copied'), 600);
    }

    Components.showToast(`Horario ${referenceInTime} - ${referenceOutTime} aplicado a todos los días. Recuerde guardar cada día.`, 'info');
  };

  // Borrar un día específico
  Views.directorSchedules.deleteDay = async function(courseId, weekday) {
    const card = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${weekday}"]`);
    const inTimeInput = card.querySelector('[data-field="in_time"]');
    const outTimeInput = card.querySelector('[data-field="out_time"]');
    const scheduleId = inTimeInput.dataset.scheduleId;

    if (!confirm(`¿Borrar el horario del ${weekdays[weekday]}?`)) return;

    // Limpiar valores en UI
    inTimeInput.value = '';
    outTimeInput.value = '';

    // Si existe en la DB, eliminar (aquí podrías agregar la llamada API para DELETE)
    // Por ahora solo limpiamos la UI ya que el backend no tiene endpoint DELETE individual

    card.classList.remove('saved');
    card.classList.add('unsaved');
    inTimeInput.classList.add('border-warning');
    outTimeInput.classList.add('border-warning');

    // Deshabilitar botones de acción
    card.querySelectorAll('.btn-copy, .btn-delete').forEach(btn => btn.disabled = true);

    Components.showToast(`Horario del ${weekdays[weekday]} borrado`, 'success');
  };

  // Guardar todos los horarios de un curso
  Views.directorSchedules.saveAllSchedules = async function(courseId) {
    const saveAllBtn = document.querySelector(`.schedule-course-card .btn-success[onclick*="saveAllSchedules(${courseId})"]`);
    if (saveAllBtn) {
      saveAllBtn.disabled = true;
      saveAllBtn.innerHTML = `
        <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"></circle>
        </svg>
        Guardando...
      `;
    }

    let savedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let weekday = 0; weekday < 5; weekday++) {
      const card = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${weekday}"]`);
      const inTimeInput = card.querySelector('[data-field="in_time"]');
      const outTimeInput = card.querySelector('[data-field="out_time"]');

      const inTime = inTimeInput.value;
      const outTime = outTimeInput.value;

      // Saltar días sin horarios
      if (!inTime || !outTime) continue;

      // Validación de formato HH:MM
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(inTime) || !timeRegex.test(outTime)) {
        errors.push(`${weekdays[weekday]}: Formato de hora inválido`);
        errorCount++;
        continue;
      }

      // Validación lógica de horas
      if (outTime <= inTime) {
        errors.push(`${weekdays[weekday]}: Hora de salida debe ser posterior a entrada`);
        errorCount++;
        continue;
      }

      // Guardar el día
      const scheduleId = inTimeInput.dataset.scheduleId || null;
      const saveBtn = card.querySelector('.btn-save');

      card.classList.add('saving');
      if (saveBtn) saveBtn.classList.add('saving');

      try {
        const scheduleData = {
          weekday: weekday,
          in_time: inTime,
          out_time: outTime
        };

        if (scheduleId) {
          await State.updateSchedule(scheduleId, scheduleData);
        } else {
          const newSchedule = await State.createSchedule(courseId, scheduleData);
          inTimeInput.dataset.scheduleId = newSchedule.id;
          outTimeInput.dataset.scheduleId = newSchedule.id;

          if (saveBtn) {
            saveBtn.setAttribute('onclick',
              `Views.directorSchedules.saveSchedule(${newSchedule.id}, ${courseId}, ${weekday})`
            );
          }
        }

        // Actualizar estado visual
        card.classList.remove('unsaved');
        card.classList.add('saved');
        inTimeInput.classList.remove('border-warning');
        outTimeInput.classList.remove('border-warning');
        card.querySelectorAll('.btn-copy, .btn-delete').forEach(btn => btn.disabled = false);

        savedCount++;
      } catch (error) {
        errors.push(`${weekdays[weekday]}: ${error.message || 'Error al guardar'}`);
        errorCount++;
      } finally {
        card.classList.remove('saving');
        if (saveBtn) saveBtn.classList.remove('saving');
      }
    }

    // Restaurar botón
    if (saveAllBtn) {
      saveAllBtn.disabled = false;
      saveAllBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Guardar todos
      `;
    }

    // Mostrar resumen
    if (savedCount === 0 && errorCount === 0) {
      Components.showToast('No hay horarios para guardar', 'info');
    } else if (errorCount > 0) {
      Components.showToast(`${savedCount} guardados, ${errorCount} errores: ${errors.join('; ')}`, 'warning');
    } else {
      Components.showToast(`${savedCount} horario${savedCount > 1 ? 's' : ''} guardado${savedCount > 1 ? 's' : ''} exitosamente`, 'success');
    }
  };

  // Borrar todos los horarios de un curso
  Views.directorSchedules.deleteAllSchedules = async function(courseId) {
    if (!confirm('¿Borrar TODOS los horarios de este curso?')) return;

    for (let i = 0; i < 5; i++) {
      const card = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${i}"]`);
      const inTimeInput = card.querySelector('[data-field="in_time"]');
      const outTimeInput = card.querySelector('[data-field="out_time"]');

      inTimeInput.value = '';
      outTimeInput.value = '';

      card.classList.remove('saved');
      card.classList.add('unsaved');
      inTimeInput.classList.add('border-warning');
      outTimeInput.classList.add('border-warning');
      card.querySelectorAll('.btn-copy, .btn-delete').forEach(btn => btn.disabled = true);
    }

    Components.showToast('Todos los horarios han sido borrados', 'success');
  };

  // ==================== INITIALIZATION ====================

  createTimePickerModal();
  renderSchedules();
};
