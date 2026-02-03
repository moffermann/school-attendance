// Director Schedules - Redesigned with Approved HTML Design
// Uses centralized Components.directorSidebar()
Views.directorSchedules = function() {
  const app = document.getElementById('app');

  // Days of the week (Monday = 0 for ISO 8601 compatibility)
  const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  // Estado temporal para el time picker
  let activeTimePicker = null;

  // Filter state
  let selectedCourseFilter = 'all';
  const currentPath = '/director/schedules';

  // ==================== LAYOUT RENDER ====================

  function renderLayout() {
    const user = State.getCurrentUser() || {};
    const userName = user.full_name || user.name || 'Director';
    const courses = State.getCourses() || [];

    app.innerHTML = `
<div class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body transition-colors duration-300 antialiased h-screen flex overflow-hidden">
  ${Components.directorSidebar(currentPath)}

  <!-- Main Content -->
  <main class="flex-1 flex flex-col overflow-hidden relative bg-gray-50 dark:bg-background-dark">
          <!-- Header - Custom with course filter -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
            <div class="flex items-center gap-4">
              <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors" onclick="Components.toggleDirectorSidebar()">
                <span class="material-icons-round text-2xl">menu</span>
              </button>
              <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Gestión de Horarios</h2>
              <!-- Vertical divider -->
              <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mobile-hidden"></div>
              <!-- Course selector -->
              <div class="flex items-center gap-2 mobile-hidden">
                <span class="text-xs font-semibold text-gray-500 uppercase">Filtrar:</span>
                <select id="course-filter" class="text-sm border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg py-1.5 focus:ring-indigo-500 min-w-[180px]">
                  <option value="all">Todos los cursos</option>
                  ${courses.map(c => `<option value="${c.id}">${Components.escapeHtml(c.name)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
              <div class="flex items-center gap-2 md:gap-3">
                <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark" onclick="Views.directorSchedules.toggleDarkMode()">
                  <span class="material-icons-round" id="dark-mode-icon">dark_mode</span>
                </button>
                <div class="flex items-center gap-2 cursor-pointer">
                  <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
                    ${userName.charAt(0).toUpperCase()}
                  </div>
                  <div class="text-right mobile-hidden">
                    <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${Components.escapeHtml(userName)}</p>
                  </div>
                </div>
                <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600" href="#" onclick="event.preventDefault(); State.logout(); Router.navigate('/login')">
                  <span class="material-icons-round text-lg">logout</span>
                  <span class="mobile-hidden">Salir</span>
                </a>
              </div>
            </div>
          </header>

          <!-- Content Area -->
          <div id="schedules-content" class="flex-1 overflow-y-auto p-8 space-y-10 scroll-smooth">
            <!-- Course sections will be rendered here -->
          </div>
        </main>
      </div>
    `;

    // Setup course filter listener
    const filterSelect = document.getElementById('course-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        selectedCourseFilter = e.target.value;
        renderSchedules();
      });
    }
  }

  // ==================== TIME PICKER COMPONENT (PRESERVED) ====================

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

    // Event listeners for time picker buttons
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
        // Update visual selection
        modal.querySelectorAll('.tp-hour').forEach(b => {
          b.classList.toggle('active', b.dataset.value === hour.padStart(2, '0'));
        });
        modal.querySelectorAll('.tp-minute').forEach(b => {
          b.classList.toggle('active', b.dataset.value === minute);
        });
      });
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        Views.directorSchedules.closeTimePicker();
      }
    });
  }

  Views.directorSchedules.openTimePicker = function(inputElement) {
    activeTimePicker = inputElement;
    const modal = document.getElementById('time-picker-modal');

    // Set initial value
    const currentValue = inputElement.value || '08:00';
    const [hour, minute] = currentValue.split(':');
    document.getElementById('tp-hour').textContent = hour || '08';
    document.getElementById('tp-minute').textContent = minute || '00';

    // Mark current selection
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

      // Visual feedback
      const inputElement = activeTimePicker;
      inputElement.classList.add('time-updated');
      setTimeout(() => inputElement.classList.remove('time-updated'), 500);
    }
    Views.directorSchedules.closeTimePicker();
  };

  // ==================== RENDER SCHEDULES (NEW DESIGN) ====================

  function renderSchedules() {
    const content = document.getElementById('schedules-content');
    if (!content) return;

    const courses = State.getCourses() || [];

    // Filter courses based on selection
    const filteredCourses = selectedCourseFilter === 'all'
      ? courses
      : courses.filter(c => c.id.toString() === selectedCourseFilter);

    if (filteredCourses.length === 0) {
      content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16">
          <span class="material-icons-round text-6xl text-gray-300 dark:text-gray-600 mb-4">schedule</span>
          <p class="text-gray-500 dark:text-gray-400">No hay cursos disponibles</p>
        </div>
      `;
      return;
    }

    content.innerHTML = filteredCourses.map((course, index) => {
      const schedules = State.getSchedules(course.id) || [];

      // Alternate icon colors between indigo and blue
      const iconBg = index % 2 === 0 ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'bg-blue-50 dark:bg-blue-900/30';
      const iconColor = index % 2 === 0 ? 'text-indigo-600' : 'text-blue-600';

      return `
        <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden" data-course-section="${course.id}">
          <!-- Course Header with Action Buttons -->
          <div class="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
            <div class="flex items-center gap-3">
              <!-- Course Icon -->
              <div class="w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center">
                <span class="material-icons-round ${iconColor}">class</span>
              </div>
              <div>
                <h3 class="font-bold text-gray-800 dark:text-white">${course.name}</h3>
                <p class="text-xs text-gray-500 uppercase tracking-wider">Configuración Semanal</p>
              </div>
            </div>

            <!-- Action Buttons (3 buttons) -->
            <div class="flex items-center gap-3">
              <button onclick="Views.directorSchedules.saveAllSchedules(${course.id})"
                class="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-100 dark:shadow-none flex items-center gap-2 transition-all">
                <span class="material-icons-round text-sm">save</span> Guardar Todo
              </button>
              <button onclick="Views.directorSchedules.copyToAllDays(${course.id})"
                class="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2">
                <span class="material-icons-round text-sm">content_copy</span> Copiar a Todos
              </button>
              <button onclick="Views.directorSchedules.deleteAllSchedules(${course.id})"
                class="px-4 py-2 border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                <span class="material-icons-round text-sm">delete</span> Borrar Todo
              </button>
            </div>
          </div>

          <!-- Days Grid (always expanded, NO accordion) -->
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
              ${weekdays.map((dayName, dayIndex) => {
                const existingSchedule = schedules.find(s => s.weekday === dayIndex);
                const hasSchedule = existingSchedule && existingSchedule.in_time && existingSchedule.out_time;

                if (hasSchedule) {
                  // Day Card Configured (with schedule)
                  return `
                    <div class="p-5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 hover:shadow-md transition-shadow relative group"
                         data-course="${course.id}" data-weekday="${dayIndex}">
                      <!-- Day Name (NO point indicator) -->
                      <div class="flex items-center justify-between mb-4">
                        <span class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">${dayName}</span>
                      </div>

                      <!-- Time Inputs (type="text", icon on LEFT) -->
                      <div class="space-y-3">
                        <div>
                          <label class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Entrada</label>
                          <div class="relative">
                            <input type="text"
                              value="${existingSchedule.in_time ? existingSchedule.in_time.substring(0,5) : ''}"
                              class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                              readonly
                              data-schedule-id="${existingSchedule.id || ''}"
                              data-course-id="${course.id}"
                              data-weekday="${dayIndex}"
                              data-field="in_time"
                              onclick="Views.directorSchedules.openTimePicker(this)">
                            <span class="material-icons-round absolute left-2 top-2 text-gray-400 text-base">schedule</span>
                          </div>
                        </div>
                        <div>
                          <label class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Salida</label>
                          <div class="relative">
                            <input type="text"
                              value="${existingSchedule.out_time ? existingSchedule.out_time.substring(0,5) : ''}"
                              class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                              readonly
                              data-schedule-id="${existingSchedule.id || ''}"
                              data-course-id="${course.id}"
                              data-weekday="${dayIndex}"
                              data-field="out_time"
                              onclick="Views.directorSchedules.openTimePicker(this)">
                            <span class="material-icons-round absolute left-2 top-2 text-gray-400 text-base">schedule</span>
                          </div>
                        </div>
                      </div>

                      <!-- Action Buttons (save, forward, delete) -->
                      <div class="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between gap-2">
                        <button onclick="Views.directorSchedules.saveSchedule(${existingSchedule.id || 'null'}, ${course.id}, ${dayIndex})"
                          class="flex-1 p-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex justify-center"
                          title="Guardar">
                          <span class="material-icons-round text-lg">save</span>
                        </button>
                        ${dayIndex < 4 ? `
                        <button onclick="Views.directorSchedules.copyToNextDay(${course.id}, ${dayIndex})"
                          class="flex-1 p-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex justify-center"
                          title="Copiar al día siguiente">
                          <span class="material-icons-round text-lg">arrow_forward</span>
                        </button>
                        ` : `
                        <button disabled
                          class="flex-1 p-1.5 rounded-lg border border-gray-100 dark:border-slate-700 text-gray-300 dark:text-gray-600 cursor-not-allowed flex justify-center"
                          title="No hay día siguiente">
                          <span class="material-icons-round text-lg">arrow_forward</span>
                        </button>
                        `}
                        <button onclick="Views.directorSchedules.deleteDay(${course.id}, ${dayIndex})"
                          class="flex-1 p-1.5 rounded-lg border border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex justify-center"
                          title="Borrar">
                          <span class="material-icons-round text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  `;
                } else {
                  // Day Card Empty (no schedule - uses .dashed-card)
                  return `
                    <div class="p-5 dashed-card flex flex-col justify-between"
                         data-course="${course.id}" data-weekday="${dayIndex}">
                      <!-- Day Name (gray text) -->
                      <span class="text-sm font-bold text-gray-400 uppercase tracking-tight block mb-4">${dayName}</span>

                      <!-- Empty time placeholders -->
                      <div class="space-y-3 mb-4">
                        <div>
                          <label class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Entrada</label>
                          <div class="relative">
                            <input type="text"
                              value=""
                              placeholder="--:--"
                              class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-700/50 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-transparent"
                              readonly
                              data-schedule-id=""
                              data-course-id="${course.id}"
                              data-weekday="${dayIndex}"
                              data-field="in_time"
                              onclick="Views.directorSchedules.openTimePicker(this)">
                            <span class="material-icons-round absolute left-2 top-2 text-gray-300 dark:text-gray-500 text-base">schedule</span>
                          </div>
                        </div>
                        <div>
                          <label class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Salida</label>
                          <div class="relative">
                            <input type="text"
                              value=""
                              placeholder="--:--"
                              class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-700/50 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-transparent"
                              readonly
                              data-schedule-id=""
                              data-course-id="${course.id}"
                              data-weekday="${dayIndex}"
                              data-field="out_time"
                              onclick="Views.directorSchedules.openTimePicker(this)">
                            <span class="material-icons-round absolute left-2 top-2 text-gray-300 dark:text-gray-500 text-base">schedule</span>
                          </div>
                        </div>
                      </div>

                      <!-- Action Buttons (muted colors) -->
                      <div class="flex justify-between gap-2 border-t border-gray-100 dark:border-slate-700 pt-3">
                        <button onclick="Views.directorSchedules.saveSchedule(null, ${course.id}, ${dayIndex})"
                          class="flex-1 p-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/20 text-indigo-300 hover:text-indigo-600 transition-colors flex justify-center"
                          title="Guardar">
                          <span class="material-icons-round text-lg">save</span>
                        </button>
                        ${dayIndex < 4 ? `
                        <button onclick="Views.directorSchedules.copyToNextDay(${course.id}, ${dayIndex})" disabled
                          class="flex-1 p-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/20 text-indigo-300 cursor-not-allowed flex justify-center"
                          title="Ingrese horario primero">
                          <span class="material-icons-round text-lg">arrow_forward</span>
                        </button>
                        ` : `
                        <button disabled
                          class="flex-1 p-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/20 text-indigo-300 cursor-not-allowed flex justify-center"
                          title="No hay día siguiente">
                          <span class="material-icons-round text-lg">arrow_forward</span>
                        </button>
                        `}
                        <button onclick="Views.directorSchedules.deleteDay(${course.id}, ${dayIndex})" disabled
                          class="flex-1 p-1.5 rounded-lg border border-red-100/50 dark:border-red-900/20 text-red-200 cursor-not-allowed flex justify-center"
                          title="Sin horario para borrar">
                          <span class="material-icons-round text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  `;
                }
              }).join('')}
            </div>
          </div>
        </section>
      `;
    }).join('') + `
      <!-- Footer -->
      <footer class="text-center text-xs text-gray-400 pt-8 pb-4">
        © 2026 NEUVOX. Todos los derechos reservados.
      </footer>
    `;
  }

  // ==================== ACTION FUNCTIONS (PRESERVED LOGIC) ====================

  // Save individual schedule
  Views.directorSchedules.saveSchedule = async function(scheduleId, courseId, weekday) {
    const card = document.querySelector(`[data-course="${courseId}"][data-weekday="${weekday}"]`);
    const inTimeInput = card.querySelector('[data-field="in_time"]');
    const outTimeInput = card.querySelector('[data-field="out_time"]');
    const saveBtn = card.querySelector('button[title="Guardar"]');

    const inTime = inTimeInput.value;
    const outTime = outTimeInput.value;

    // Validation - required fields
    if (!inTime || !outTime) {
      Components.showToast('Complete ambos horarios', 'error');
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 500);
      return;
    }

    // Validation - HH:MM format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(inTime) || !timeRegex.test(outTime)) {
      Components.showToast('Formato de hora inválido', 'error');
      return;
    }

    // Validation - logical order
    if (outTime <= inTime) {
      Components.showToast('La hora de salida debe ser posterior a la de entrada', 'error');
      return;
    }

    // Visual feedback
    if (saveBtn) saveBtn.classList.add('animate-pulse');

    try {
      const scheduleData = {
        weekday: weekday,
        in_time: inTime,
        out_time: outTime
      };

      if (scheduleId) {
        await State.updateSchedule(scheduleId, scheduleData);
      } else {
        await State.createSchedule(courseId, scheduleData);
      }

      Components.showToast('Horario guardado', 'success');
      renderSchedules(); // Re-render to update UI
    } catch (error) {
      Components.showToast(error.message || 'Error al guardar', 'error');
    } finally {
      if (saveBtn) saveBtn.classList.remove('animate-pulse');
    }
  };

  // Copy to next day
  Views.directorSchedules.copyToNextDay = function(courseId, weekday) {
    const currentCard = document.querySelector(`[data-course="${courseId}"][data-weekday="${weekday}"]`);
    const nextCard = document.querySelector(`[data-course="${courseId}"][data-weekday="${weekday + 1}"]`);

    if (!nextCard) return;

    const inTime = currentCard.querySelector('[data-field="in_time"]').value;
    const outTime = currentCard.querySelector('[data-field="out_time"]').value;

    if (!inTime || !outTime) {
      Components.showToast('Primero complete el horario del día actual', 'error');
      return;
    }

    nextCard.querySelector('[data-field="in_time"]').value = inTime;
    nextCard.querySelector('[data-field="out_time"]').value = outTime;

    // Visual feedback
    nextCard.classList.add('ring-2', 'ring-indigo-500');
    setTimeout(() => nextCard.classList.remove('ring-2', 'ring-indigo-500'), 600);

    Components.showToast(`Horario copiado a ${weekdays[weekday + 1]}. Recuerde guardar.`, 'info');
  };

  // Copy to all days
  Views.directorSchedules.copyToAllDays = function(courseId) {
    // Use first day with schedule as reference
    let referenceInTime = '';
    let referenceOutTime = '';

    for (let i = 0; i < 5; i++) {
      const card = document.querySelector(`[data-course="${courseId}"][data-weekday="${i}"]`);
      if (!card) continue;
      const inTime = card.querySelector('[data-field="in_time"]')?.value;
      const outTime = card.querySelector('[data-field="out_time"]')?.value;
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

    // Apply to all days
    for (let i = 0; i < 5; i++) {
      const card = document.querySelector(`[data-course="${courseId}"][data-weekday="${i}"]`);
      if (!card) continue;
      const inInput = card.querySelector('[data-field="in_time"]');
      const outInput = card.querySelector('[data-field="out_time"]');
      if (inInput) inInput.value = referenceInTime;
      if (outInput) outInput.value = referenceOutTime;
      card.classList.add('ring-2', 'ring-indigo-500');
      setTimeout(() => card.classList.remove('ring-2', 'ring-indigo-500'), 600);
    }

    Components.showToast(`Horario ${referenceInTime} - ${referenceOutTime} aplicado a todos los días. Recuerde guardar cada día.`, 'info');
  };

  // Delete specific day
  Views.directorSchedules.deleteDay = async function(courseId, weekday) {
    const card = document.querySelector(`[data-course="${courseId}"][data-weekday="${weekday}"]`);
    const inTimeInput = card.querySelector('[data-field="in_time"]');
    const outTimeInput = card.querySelector('[data-field="out_time"]');

    if (!confirm(`¿Borrar el horario del ${weekdays[weekday]}?`)) return;

    // Clear values in UI
    inTimeInput.value = '';
    outTimeInput.value = '';

    Components.showToast(`Horario del ${weekdays[weekday]} borrado`, 'success');
    renderSchedules(); // Re-render to update UI
  };

  // Save all schedules for a course
  Views.directorSchedules.saveAllSchedules = async function(courseId) {
    const section = document.querySelector(`[data-course-section="${courseId}"]`);
    const saveAllBtn = section?.querySelector('button[onclick*="saveAllSchedules"]');

    if (saveAllBtn) {
      saveAllBtn.disabled = true;
      saveAllBtn.innerHTML = `
        <span class="material-icons-round text-sm animate-spin">sync</span> Guardando...
      `;
    }

    let savedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let weekday = 0; weekday < 5; weekday++) {
      const card = document.querySelector(`[data-course="${courseId}"][data-weekday="${weekday}"]`);
      if (!card) continue;

      const inTimeInput = card.querySelector('[data-field="in_time"]');
      const outTimeInput = card.querySelector('[data-field="out_time"]');
      if (!inTimeInput || !outTimeInput) continue;

      const inTime = inTimeInput.value;
      const outTime = outTimeInput.value;

      // Skip days without schedules
      if (!inTime || !outTime) continue;

      // Validate HH:MM format
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(inTime) || !timeRegex.test(outTime)) {
        errors.push(`${weekdays[weekday]}: Formato de hora inválido`);
        errorCount++;
        continue;
      }

      // Validate logical order
      if (outTime <= inTime) {
        errors.push(`${weekdays[weekday]}: Hora de salida debe ser posterior a entrada`);
        errorCount++;
        continue;
      }

      // Save the day
      const scheduleId = inTimeInput.dataset.scheduleId || null;

      try {
        const scheduleData = {
          weekday: weekday,
          in_time: inTime,
          out_time: outTime
        };

        if (scheduleId) {
          await State.updateSchedule(scheduleId, scheduleData);
        } else {
          await State.createSchedule(courseId, scheduleData);
        }

        savedCount++;
      } catch (error) {
        errors.push(`${weekdays[weekday]}: ${error.message || 'Error al guardar'}`);
        errorCount++;
      }
    }

    // Restore button
    if (saveAllBtn) {
      saveAllBtn.disabled = false;
      saveAllBtn.innerHTML = `
        <span class="material-icons-round text-sm">save</span> Guardar Todo
      `;
    }

    // Show summary
    if (savedCount === 0 && errorCount === 0) {
      Components.showToast('No hay horarios para guardar', 'info');
    } else if (errorCount > 0) {
      Components.showToast(`${savedCount} guardados, ${errorCount} errores: ${errors.join('; ')}`, 'warning');
    } else {
      Components.showToast(`${savedCount} horario${savedCount > 1 ? 's' : ''} guardado${savedCount > 1 ? 's' : ''} exitosamente`, 'success');
      renderSchedules(); // Re-render to update UI
    }
  };

  // Delete all schedules for a course
  Views.directorSchedules.deleteAllSchedules = async function(courseId) {
    if (!confirm('¿Borrar TODOS los horarios de este curso?')) return;

    for (let i = 0; i < 5; i++) {
      const card = document.querySelector(`[data-course="${courseId}"][data-weekday="${i}"]`);
      if (!card) continue;
      const inTimeInput = card.querySelector('[data-field="in_time"]');
      const outTimeInput = card.querySelector('[data-field="out_time"]');

      if (inTimeInput) inTimeInput.value = '';
      if (outTimeInput) outTimeInput.value = '';
    }

    Components.showToast('Todos los horarios han sido borrados', 'success');
    renderSchedules(); // Re-render to update UI
  };

  // ==================== HEADER FUNCTIONS ====================

  // toggleMobileSidebar now uses centralized Components.toggleDirectorSidebar()

  // Toggle dark mode
  Views.directorSchedules.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      icon.textContent = document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode';
    }
  };

  // ==================== INITIALIZATION ====================

  renderLayout();
  createTimePickerModal();
  renderSchedules();
};
