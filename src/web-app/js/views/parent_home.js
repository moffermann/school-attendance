// Parent Home - Today's status
Views.parentHome = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent', { activeView: 'home' });

  const content = document.getElementById('view-content');

  if (!State.currentGuardianId) {
    content.innerHTML = Components.createEmptyState('Error', 'No hay apoderado seleccionado');
    return;
  }

  const students = State.getGuardianStudents(State.currentGuardianId);
  const today = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Avatar colors by student index (inline hex to avoid Tailwind JIT issues with dynamic classes)
  const avatarColors = ['#6366f1', '#a855f7', '#3b82f6', '#ec4899', '#f97316'];

  // Helper: Render status bar (full-width at bottom of card)
  function renderStatusBar(events) {
    const inEvent = events.find(e => e.type === 'IN');
    const outEvent = events.find(e => e.type === 'OUT');

    if (outEvent) {
      return `
        <div class="bg-blue-50 dark:bg-blue-900/10 p-4 flex items-center gap-3">
          <span class="material-symbols-outlined text-blue-500">check_circle</span>
          <span class="text-sm font-medium text-blue-700 dark:text-blue-300">
            Salida Registrada: ${Components.formatTime(outEvent.ts)}
          </span>
        </div>
      `;
    } else if (inEvent) {
      const isLate = State.isEventLate(inEvent);
      if (isLate) {
        return `
          <div class="bg-yellow-50 dark:bg-yellow-900/10 p-4 flex items-center gap-3">
            <span class="material-symbols-outlined text-yellow-500">schedule</span>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
              Ingreso Tardío: ${Components.formatTime(inEvent.ts)}
            </span>
          </div>
        `;
      } else {
        return `
          <div class="bg-green-50 dark:bg-green-900/10 p-4 flex items-center gap-3">
            <span class="material-symbols-outlined text-green-600">check_circle</span>
            <span class="text-sm font-medium text-green-700 dark:text-green-300">
              Ingreso Registrado: ${Components.formatTime(inEvent.ts)}
            </span>
          </div>
        `;
      }
    } else {
      return `
        <div class="bg-red-50 dark:bg-red-900/10 p-4 flex items-center gap-3">
          <span class="material-symbols-outlined text-red-500">help</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            Aún no registra ingreso
          </span>
        </div>
      `;
    }
  }

  content.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-8">
      <div>
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Estado de Hoy</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 md:hidden capitalize">${todayFormatted}</p>
      </div>

      ${students.map((student, index) => {
        const course = State.getCourse(student.course_id);
        const events = State.getAttendanceEvents({ studentId: student.id, date: today });
        const initial = student.full_name.charAt(0).toUpperCase();
        const avatarColor = avatarColors[index % avatarColors.length];

        return `
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div class="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-50 dark:border-gray-800">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-lg text-white flex items-center justify-center text-xl font-bold flex-shrink-0" style="background-color: ${avatarColor};">
                  ${initial}
                </div>
                <div>
                  <h4 class="text-lg font-bold text-gray-900 dark:text-white">${student.full_name}</h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">${course ? course.name : ''}</p>
                </div>
              </div>
              <a href="#/parent/history?student=${student.id}"
                 class="w-full md:w-auto px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-center gap-2 transition-colors">
                <span class="material-symbols-outlined text-lg">history</span> Ver Historial
              </a>
            </div>
            ${renderStatusBar(events)}
          </div>
        `;
      }).join('')}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <a href="#/parent/prefs" class="group flex items-center justify-center gap-3 p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all">
          <span class="material-symbols-outlined text-gray-500 group-hover:text-indigo-600 transition-colors">settings</span>
          <span class="font-medium text-gray-700 dark:text-gray-200">Preferencias de Notificación</span>
        </a>
        <a href="#/parent/absences" class="group flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none hover:shadow-xl transition-all transform hover:-translate-y-0.5">
          <span class="material-symbols-outlined text-white">calendar_today</span>
          <span class="font-bold text-white">Solicitar Ausencia</span>
        </a>
      </div>
    </div>
  `;
};
