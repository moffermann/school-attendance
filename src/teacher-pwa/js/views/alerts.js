// Alerts view - Shows students without attendance
Views.alerts = async function() {
  if (!State.currentCourseId) {
    Router.navigate('/classes');
    return;
  }

  const app = document.getElementById('app');
  const courseId = State.currentCourseId;
  const today = new Date().toISOString().split('T')[0];

  // Show loading
  app.innerHTML = `
    ${UI.createHeader('Alertas')}
    <div class="container">
      <div class="loading">Verificando asistencia...</div>
    </div>
  `;

  // Get students and events
  let students = await State.getCachedStudents(courseId);
  if (!students.length && State.isOnline() && API.isAuthenticated()) {
    try {
      students = await API.getCourseStudents(courseId);
      await State.cacheStudents(courseId, students);
    } catch (e) {
      console.error('Error fetching students:', e);
    }
  }

  const queue = await IDB.getAll('queue');
  const courses = await IDB.getAll('courses');
  const currentCourse = courses.find(c => c.id === courseId) || State.courses.find(c => c.id === courseId);

  // Get today's events for this course
  const todayEvents = queue.filter(e =>
    e.course_id === courseId &&
    (e.ts || e.occurred_at || '').startsWith(today)
  );

  // Find students with IN events
  const studentsWithIN = new Set(
    todayEvents.filter(e => e.type === 'IN').map(e => e.student_id)
  );

  // Students without attendance
  const absentStudents = students.filter(s => !studentsWithIN.has(s.id));

  // Calculate time since school start (assuming 8:00 AM)
  const now = new Date();
  const schoolStart = new Date(now);
  schoolStart.setHours(8, 0, 0, 0);
  const minutesLate = Math.floor((now - schoolStart) / 60000);

  const courseName = currentCourse ? UI.escapeHtml(currentCourse.name) : 'Curso';

  app.innerHTML = `
    ${UI.createHeader('Alertas - ' + courseName)}
    <div class="container" style="padding-bottom:80px">
      <!-- Summary Card -->
      <div class="card mb-2">
        <div class="card-header">Resumen del Día</div>
        <div class="stats-grid">
          <div class="stat-card stat-success">
            <div class="stat-value">${studentsWithIN.size}</div>
            <div class="stat-label">Presentes</div>
          </div>
          <div class="stat-card ${absentStudents.length > 0 ? 'stat-error' : ''}">
            <div class="stat-value">${absentStudents.length}</div>
            <div class="stat-label">Sin Registro</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${students.length}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat-card ${minutesLate > 30 ? 'stat-warning' : ''}">
            <div class="stat-value">${minutesLate > 0 ? '+' + minutesLate : '0'}</div>
            <div class="stat-label">Min. Desde 8:00</div>
          </div>
        </div>
      </div>

      <!-- Alert Level -->
      ${absentStudents.length > 0 ? `
        <div class="alert-banner ${minutesLate > 60 ? 'alert-critical' : minutesLate > 30 ? 'alert-warning' : 'alert-info'} mb-2">
          <div class="alert-icon">${minutesLate > 60 ? '🚨' : minutesLate > 30 ? '⚠️' : 'ℹ️'}</div>
          <div class="alert-content">
            <div class="alert-title">
              ${minutesLate > 60 ? 'Alerta Crítica' : minutesLate > 30 ? 'Atención Requerida' : 'Información'}
            </div>
            <div class="alert-text">
              ${absentStudents.length} alumno${absentStudents.length > 1 ? 's' : ''} sin registro de entrada
            </div>
          </div>
        </div>
      ` : `
        <div class="alert-banner alert-success mb-2">
          <div class="alert-icon">✅</div>
          <div class="alert-content">
            <div class="alert-title">Todo en Orden</div>
            <div class="alert-text">Todos los alumnos han registrado entrada</div>
          </div>
        </div>
      `}

      <!-- Absent Students List -->
      ${absentStudents.length > 0 ? `
        <div class="card mb-2">
          <div class="card-header flex justify-between items-center">
            <span>Alumnos Sin Registro (${absentStudents.length})</span>
            <button class="btn btn-primary" style="font-size:.75rem;padding:.5rem" onclick="Views.alerts.markAllPresent()">
              Marcar Todos
            </button>
          </div>
          <div class="absent-student-list">
            ${absentStudents.map(s => {
              const safeName = UI.escapeHtml(s.full_name);
              return `
                <div class="absent-student-item" data-student-id="${s.id}">
                  <div class="absent-student-info">
                    <span class="absent-student-name">${safeName}</span>
                    <span class="absent-student-status">Sin entrada</span>
                  </div>
                  <div class="absent-student-actions">
                    <button class="btn btn-success" style="font-size:.75rem;padding:.25rem .5rem" onclick="Views.alerts.markPresent(${s.id})">
                      ✓ Presente
                    </button>
                    <button class="btn btn-warning" style="font-size:.75rem;padding:.25rem .5rem" onclick="Views.alerts.markLate(${s.id})">
                      ⏰ Tardanza
                    </button>
                    <button class="btn btn-error" style="font-size:.75rem;padding:.25rem .5rem" onclick="Views.alerts.markAbsent(${s.id})">
                      ✗ Ausente
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Present Students (collapsible) -->
      ${studentsWithIN.size > 0 ? `
        <div class="card">
          <div class="card-header flex justify-between items-center" onclick="Views.alerts.togglePresent()" style="cursor:pointer">
            <span>Alumnos Presentes (${studentsWithIN.size})</span>
            <span id="present-toggle">▼</span>
          </div>
          <div id="present-list" class="student-summary-list hidden">
            ${students.filter(s => studentsWithIN.has(s.id)).map(s => {
              const inEvent = todayEvents.find(e => e.student_id === s.id && e.type === 'IN');
              const inTime = inEvent ? UI.formatTime(inEvent.ts || inEvent.occurred_at) : '-';
              const safeName = UI.escapeHtml(s.full_name);
              return `
                <div class="student-summary-item">
                  <span class="student-name">${safeName}</span>
                  <span class="time-in">🟢 ${inTime}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Actions -->
      <div class="flex gap-2 mt-2">
        <button class="btn btn-secondary" onclick="Views.alerts.refresh()">
          🔄 Actualizar
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('/roster')">
          📋 Ver Nómina
        </button>
      </div>
    </div>
    ${UI.createBottomNav('/alerts')}
  `;
};

// Toggle present students list
Views.alerts.togglePresent = function() {
  const list = document.getElementById('present-list');
  const toggle = document.getElementById('present-toggle');
  if (list && toggle) {
    list.classList.toggle('hidden');
    toggle.textContent = list.classList.contains('hidden') ? '▼' : '▲';
  }
};

// Mark student as present (normal IN)
Views.alerts.markPresent = async function(studentId) {
  await State.enqueueEvent({
    student_id: studentId,
    type: 'IN',
    course_id: State.currentCourseId,
    source: 'MANUAL',
    occurred_at: new Date().toISOString(),
    ts: new Date().toISOString()
  });
  UI.showToast('Asistencia registrada', 'success');
  Views.alerts();
};

// Mark student as late (IN with late flag)
Views.alerts.markLate = async function(studentId) {
  await State.enqueueEvent({
    student_id: studentId,
    type: 'IN',
    course_id: State.currentCourseId,
    source: 'MANUAL',
    notes: 'TARDANZA',
    occurred_at: new Date().toISOString(),
    ts: new Date().toISOString()
  });
  UI.showToast('Tardanza registrada', 'warning');
  Views.alerts();
};

// Mark student as absent (creates absence record)
Views.alerts.markAbsent = async function(studentId) {
  await State.enqueueEvent({
    student_id: studentId,
    type: 'ABSENT',
    course_id: State.currentCourseId,
    source: 'MANUAL',
    occurred_at: new Date().toISOString(),
    ts: new Date().toISOString()
  });
  UI.showToast('Ausencia registrada', 'info');
  Views.alerts();
};

// Mark all absent students as present
Views.alerts.markAllPresent = async function() {
  const items = document.querySelectorAll('.absent-student-item');
  let count = 0;

  for (const item of items) {
    const studentId = parseInt(item.dataset.studentId, 10);
    if (studentId) {
      await State.enqueueEvent({
        student_id: studentId,
        type: 'IN',
        course_id: State.currentCourseId,
        source: 'MANUAL',
        occurred_at: new Date().toISOString(),
        ts: new Date().toISOString()
      });
      count++;
    }
  }

  UI.showToast(`${count} asistencias registradas`, 'success');
  Views.alerts();
};

// Refresh the view
Views.alerts.refresh = function() {
  Views.alerts();
};
