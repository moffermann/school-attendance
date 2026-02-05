// Parent History - Historial de Asistencia (Calendar + Timeline)
Views.parentHistory = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent', { activeView: 'history' });

  const content = document.getElementById('view-content');

  if (!State.currentGuardianId) {
    content.innerHTML = Components.createEmptyState('Error', 'No hay apoderado seleccionado');
    return;
  }

  const students = State.getGuardianStudents(State.currentGuardianId);

  // Get student from URL if present
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const selectedStudentId = urlParams.get('student');

  // Security: Validate that the requested student belongs to this guardian
  const allowedStudentIds = new Set(students.map(s => s.id));
  let filteredStudentId;

  if (selectedStudentId) {
    const parsedId = parseInt(selectedStudentId);
    filteredStudentId = allowedStudentIds.has(parsedId) ? parsedId : (students[0]?.id || null);
  } else {
    filteredStudentId = students[0]?.id || null;
  }

  // Calendar state
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();
  let selectedDate = new Date().toISOString().split('T')[0];

  // Helper: Determine dot color for a day based on events
  function getDotColor(events, hasWithdrawal) {
    if (!events.length && !hasWithdrawal) return null;
    if (hasWithdrawal) return '#7c3aed';  // violet-600 (withdrawal)
    const hasIn = events.some(e => e.type === 'IN');
    if (!hasIn) return '#ef4444';  // red-500 (absent)
    const lateIn = events.find(e => e.type === 'IN' && State.isEventLate(e));
    if (lateIn) return '#eab308';  // yellow-500 (late)
    return '#22c55e';  // green-500 (present on time)
  }

  // Helper: Generate calendar grid HTML
  function generateCalendar(year, month, events) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0=Sun, 1=Mon...

    // Group events by date
    const eventsByDate = {};
    events.forEach(event => {
      const date = event.ts.split('T')[0];
      if (!eventsByDate[date]) eventsByDate[date] = [];
      eventsByDate[date].push(event);
    });

    // Group completed withdrawals by date
    const withdrawalsByDate = {};
    if (filteredStudentId) {
      const studentWithdrawals = State.getWithdrawals({ studentId: filteredStudentId, status: 'COMPLETED' });
      studentWithdrawals.forEach(w => {
        const d = (w.completed_at || w.initiated_at || '').split('T')[0];
        if (d) {
          if (!withdrawalsByDate[d]) withdrawalsByDate[d] = [];
          withdrawalsByDate[d].push(w);
        }
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Day name headers
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    let html = '<div class="grid grid-cols-7 text-center mb-2">';
    dayNames.forEach(d => {
      html += `<div class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide py-2">${d}</div>`;
    });
    html += '</div><div class="grid grid-cols-7 gap-2">';

    // Empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      html += '<div class="calendar-day weekend"></div>';
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = eventsByDate[dateStr] || [];
      const hasWithdrawal = !!(withdrawalsByDate[dateStr] && withdrawalsByDate[dateStr].length);
      const dotColor = getDotColor(dayEvents, hasWithdrawal);
      const dayOfWeek = new Date(year, month, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;

      html += `
        <div class="calendar-day ${isWeekend ? 'weekend' : ''} ${isSelected ? 'selected' : ''}"
             data-date="${dateStr}" onclick="Views.parentHistory.selectDate('${dateStr}')">
          <span class="text-sm font-medium ${isToday && !isSelected ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}">${day}</span>
          ${dotColor ? `<div class="calendar-dot" style="background: ${dotColor};"></div>` : ''}
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  // Helper: Convert events to timeline HTML
  function eventsToTimeline(events, dateStr) {
    // Get completed withdrawals for this date
    const dateWithdrawals = filteredStudentId
      ? State.getWithdrawals({ studentId: filteredStudentId, status: 'COMPLETED' })
          .filter(w => {
            const d = (w.completed_at || w.initiated_at || '').split('T')[0];
            return d === dateStr;
          })
      : [];

    if (!events.length && !dateWithdrawals.length) {
      return `
        <div class="text-center py-8 text-gray-400 dark:text-gray-500">
          <span class="material-symbols-outlined text-4xl mb-2 block">event_busy</span>
          <p class="text-sm">Sin eventos para este día</p>
        </div>
      `;
    }

    // Build unified timeline items
    const timelineItems = [];

    events.forEach(event => {
      timelineItems.push({ ts: event.ts, kind: 'attendance', event });
    });

    dateWithdrawals.forEach(w => {
      timelineItems.push({ ts: w.completed_at || w.initiated_at || '', kind: 'withdrawal', withdrawal: w });
    });

    // Sort chronologically
    timelineItems.sort((a, b) => a.ts.localeCompare(b.ts));

    let html = '<div class="relative">';
    html += '<div class="absolute left-4 top-2 bottom-6 w-0.5 bg-gray-100 dark:bg-gray-800 z-0"></div>';

    timelineItems.forEach(item => {
      if (item.kind === 'attendance') {
        const event = item.event;
        const isIn = event.type === 'IN';
        const time = Components.formatTime(event.ts);
        const isLate = isIn && State.isEventLate(event);

        const iconBg = isIn
          ? (isLate ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-green-100 dark:bg-green-900/30')
          : 'bg-blue-100 dark:bg-blue-900/30';
        const iconColor = isIn
          ? (isLate ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400')
          : 'text-blue-600 dark:text-blue-400';
        const icon = isIn ? (isLate ? 'warning' : 'login') : 'logout';
        const label = isIn ? (isLate ? 'Ingreso con Atraso' : 'Ingreso Correcto') : 'Salida Registrada';
        const hasPhoto = event.photo_url || event.photo_ref;

        html += `
          <div class="relative z-10 flex gap-4 pb-5">
            <div class="w-8 h-8 rounded-full ${iconBg} ${iconColor} flex items-center justify-center border-2 border-white dark:border-slate-800 flex-shrink-0">
              <span class="material-symbols-outlined text-sm font-bold">${icon}</span>
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">${label}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${time}</p>
              ${hasPhoto ? '<p class="text-xs text-indigo-500 mt-0.5"><span class="material-symbols-outlined text-xs align-middle">photo_camera</span> Con evidencia</p>' : ''}
            </div>
          </div>
        `;
      } else {
        // Withdrawal event
        const w = item.withdrawal;
        const time = Components.formatTime(w.completed_at || w.initiated_at);
        const pickupInfo = w.pickup_name
          ? `${w.pickup_name}${w.pickup_relationship ? ` (${w.pickup_relationship})` : ''}`
          : 'Adulto autorizado';

        html += `
          <div class="relative z-10 flex gap-4 pb-5">
            <div class="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center border-2 border-white dark:border-slate-800 flex-shrink-0">
              <span class="material-symbols-outlined text-sm font-bold">directions_walk</span>
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">Retiro</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${time}</p>
              <p class="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                <span class="material-symbols-outlined text-xs align-middle">person</span> ${Components.escapeHtml(pickupInfo)}
              </p>
              ${w.reason ? `<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${Components.escapeHtml(w.reason)}</p>` : ''}
            </div>
          </div>
        `;
      }
    });

    html += '</div>';
    return html;
  }

  // Helper: Calculate monthly stats
  function calculateMonthStats(events, year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const eventsByDate = {};
    events.forEach(event => {
      const date = event.ts.split('T')[0];
      if (!eventsByDate[date]) eventsByDate[date] = [];
      eventsByDate[date].push(event);
    });

    let present = 0, late = 0, absent = 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, day).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      // Don't count future days
      if (dateStr > todayStr) continue;

      const dayEvents = eventsByDate[dateStr] || [];
      const hasIn = dayEvents.some(e => e.type === 'IN');
      if (!hasIn) { absent++; continue; }
      present++;  // Any day with an IN event counts as present
      if (dayEvents.some(e => e.type === 'IN' && State.isEventLate(e))) late++;
    }

    return { present, late, absent };
  }

  // Get all events for current student in the displayed month
  function getMonthEvents() {
    if (!filteredStudentId) return [];
    const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    return State.getAttendanceEvents({ studentId: filteredStudentId })
      .filter(e => {
        const eventDate = e.ts.split('T')[0];
        return eventDate >= monthStart && eventDate <= monthEnd;
      });
  }

  // Get events for a specific date
  function getDateEvents(dateStr) {
    if (!filteredStudentId) return [];
    return State.getAttendanceEvents({ studentId: filteredStudentId })
      .filter(e => e.ts.split('T')[0] === dateStr);
  }

  // Main render
  function renderHistory() {
    const selectedStudent = students.find(s => s.id === filteredStudentId);
    const monthEvents = getMonthEvents();
    const stats = calculateMonthStats(monthEvents, currentYear, currentMonth);
    const totalDays = stats.present + stats.absent;
    const dateEvents = getDateEvents(selectedDate);
    const dateWithdrawals = filteredStudentId
      ? State.getWithdrawals({ studentId: filteredStudentId, status: 'COMPLETED' })
          .filter(w => (w.completed_at || w.initiated_at || '').split('T')[0] === selectedDate)
      : [];
    const totalDateEvents = dateEvents.length + dateWithdrawals.length;

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const selectedDateFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    content.innerHTML = `
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Historial de Asistencia</h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm">Calendario mensual y detalle diario</p>
      </div>

      <!-- Student Selector -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-4">
        <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Alumno</label>
        <select id="student-select" class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600
                   rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                onchange="Views.parentHistory.changeStudent(this.value)">
          ${students.map(s => {
            const c = State.getCourse(s.course_id);
            return `
              <option value="${s.id}" ${s.id === filteredStudentId ? 'selected' : ''}>
                ${Components.escapeHtml(s.full_name)} ${c ? `(${c.name})` : ''}
              </option>
            `;
          }).join('')}
        </select>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col">
          <div class="flex justify-between items-start mb-2">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Días Presente</p>
            <span class="material-symbols-outlined text-green-500 p-1.5 rounded-lg text-lg" style="background: #dcfce7;">check_circle</span>
          </div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white">${stats.present}</h3>
          <p class="text-xs mt-1 font-medium" style="color: #16a34a;">${totalDays > 0 ? Math.round(stats.present / totalDays * 100) : 0}% asistencia</p>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col">
          <div class="flex justify-between items-start mb-2">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Atrasos</p>
            <span class="material-symbols-outlined text-orange-500 p-1.5 rounded-lg text-lg" style="background: #fff7ed;">schedule</span>
          </div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white">${stats.late}</h3>
          <p class="text-xs mt-1 font-medium" style="color: #ea580c;">Este mes</p>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col">
          <div class="flex justify-between items-start mb-2">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Ausencias</p>
            <span class="material-symbols-outlined text-red-500 p-1.5 rounded-lg text-lg" style="background: #fef2f2;">cancel</span>
          </div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white">${stats.absent}</h3>
          <p class="text-xs mt-1 font-medium" style="color: #dc2626;">Este mes</p>
        </div>
      </div>

      <!-- Calendar + Timeline Side by Side -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Calendar (2/3 width on desktop) -->
        <div class="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6">
          <!-- Month Navigation -->
          <div class="flex items-center justify-between mb-4">
            <button onclick="Views.parentHistory.prevMonth()"
                    class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500">
              <span class="material-symbols-outlined">chevron_left</span>
            </button>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-indigo-500 text-lg">calendar_month</span>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                ${monthNames[currentMonth]} ${currentYear}
              </h3>
            </div>
            <button onclick="Views.parentHistory.nextMonth()"
                    class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500">
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <!-- Calendar Grid -->
          ${generateCalendar(currentYear, currentMonth, monthEvents)}

          <!-- Legend -->
          <div class="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400 justify-center flex-wrap">
            <div class="flex items-center gap-1.5">
              <div class="w-2.5 h-2.5 rounded-full" style="background: #22c55e;"></div>
              <span>Presente</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-2.5 h-2.5 rounded-full" style="background: #eab308;"></div>
              <span>Atraso</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-2.5 h-2.5 rounded-full" style="background: #ef4444;"></div>
              <span>Ausencia</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-2.5 h-2.5 rounded-full" style="background: #7c3aed;"></div>
              <span>Retiro</span>
            </div>
          </div>
        </div>

        <!-- Timeline for Selected Date (1/3 width on desktop) -->
        <div class="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white">Detalle del día</h3>
            <div class="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <span class="material-symbols-outlined text-sm">event</span>
              <span>${totalDateEvents}</span>
            </div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 capitalize mb-4">${selectedDateFormatted}</p>
          <div class="flex-1">
            ${eventsToTimeline(dateEvents, selectedDate)}
          </div>
        </div>
      </div>
    `;
  }

  // Navigation functions
  Views.parentHistory.prevMonth = function() {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    // Reset selected date to first of new month
    selectedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    renderHistory();
  };

  Views.parentHistory.nextMonth = function() {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    // Reset selected date to first of new month
    selectedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    renderHistory();
  };

  Views.parentHistory.selectDate = function(dateStr) {
    selectedDate = dateStr;
    renderHistory();
  };

  Views.parentHistory.changeStudent = function(studentId) {
    const parsedId = parseInt(studentId);
    if (allowedStudentIds.has(parsedId)) {
      filteredStudentId = parsedId;
      renderHistory();
    }
  };

  // Legacy compatibility
  Views.parentHistory.applyFilters = function() {
    renderHistory();
  };

  // R10-W1 fix: Store resize handler for cleanup
  let resizeTimeout;
  const resizeHandler = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(renderHistory, 250);
  };
  window.addEventListener('resize', resizeHandler);

  // R10-W1 fix: Cleanup function to remove listener on navigation
  Views.parentHistory.cleanup = function() {
    window.removeEventListener('resize', resizeHandler);
    clearTimeout(resizeTimeout);
  };

  renderHistory();
};
