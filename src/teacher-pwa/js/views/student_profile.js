// Student Profile View with attendance statistics
Views.studentProfile = async function() {
  const app = document.getElementById('app');
  const params = Router.getParams();
  const studentId = parseInt(params.id);

  if (!studentId) {
    Router.navigate('/roster');
    return;
  }

  // Show loading
  app.innerHTML = `
    ${UI.createHeader('Perfil Alumno')}
    <div class="container">
      <div class="loading">Cargando perfil...</div>
    </div>
  `;

  // Get student data
  const students = await IDB.getAll('students');
  const student = students.find(s => s.id === studentId);

  if (!student) {
    UI.showToast('Alumno no encontrado', 'error');
    Router.navigate('/roster');
    return;
  }

  // Get course info
  const courses = await IDB.getAll('courses');
  const course = courses.find(c => c.id === student.course_id);

  // Get all attendance events for this student
  const queue = await IDB.getAll('queue');
  const studentEvents = queue.filter(e => e.student_id === studentId);

  // Calculate statistics
  const stats = calculateAttendanceStats(studentEvents);

  // Get recent events (last 30)
  const recentEvents = studentEvents
    .sort((a, b) => new Date(getEventTs(b)) - new Date(getEventTs(a)))
    .slice(0, 30);

  const safeName = UI.escapeHtml(student.full_name);
  const courseName = course ? UI.escapeHtml(course.name + ' - ' + course.grade) : 'Sin curso';

  app.innerHTML = `
    ${UI.createHeader('Perfil Alumno')}
    <div class="container" style="padding-bottom: 100px;">
      <!-- Student Info Card -->
      <div class="card mb-2">
        <div class="card-header">Informacion del Alumno</div>
        <div class="student-info">
          <div class="student-avatar">${getInitials(student.full_name)}</div>
          <div class="student-details">
            <div class="student-name-large">${safeName}</div>
            <div class="student-course">${courseName}</div>
            ${student.rut ? `<div class="student-rut">RUT: ${UI.escapeHtml(student.rut)}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Attendance Stats -->
      <div class="card mb-2">
        <div class="card-header">Estadisticas de Asistencia</div>
        <div class="stats-grid-4">
          <div class="stat-card ${stats.percentage >= 90 ? 'stat-success' : stats.percentage >= 75 ? 'stat-warning' : 'stat-error'}">
            <div class="stat-value">${stats.percentage}%</div>
            <div class="stat-label">Asistencia</div>
          </div>
          <div class="stat-card stat-success">
            <div class="stat-value">${stats.daysPresent}</div>
            <div class="stat-label">Presente</div>
          </div>
          <div class="stat-card stat-error">
            <div class="stat-value">${stats.daysAbsent}</div>
            <div class="stat-label">Ausente</div>
          </div>
          <div class="stat-card stat-warning">
            <div class="stat-value">${stats.lateArrivals}</div>
            <div class="stat-label">Atrasos</div>
          </div>
        </div>
        <div class="stats-summary">
          <span>Total dias habiles: ${stats.totalSchoolDays}</span>
          <span>Eventos registrados: ${stats.totalEvents}</span>
        </div>
      </div>

      <!-- Manual Attendance -->
      <div class="card mb-2">
        <div class="card-header">Registrar Asistencia Manual</div>
        <div class="manual-attendance-buttons">
          <button class="btn btn-success btn-lg" onclick="Views.studentProfile.registerAttendance(${studentId}, 'IN')">
            <span class="btn-icon">&#10003;</span> Registrar Entrada
          </button>
          <button class="btn btn-secondary btn-lg" onclick="Views.studentProfile.registerAttendance(${studentId}, 'OUT')">
            <span class="btn-icon">&#8617;</span> Registrar Salida
          </button>
        </div>
      </div>

      <!-- Recent Events -->
      <div class="card">
        <div class="card-header">Ultimos Registros</div>
        ${recentEvents.length > 0 ? `
          <div class="events-list">
            ${recentEvents.map(e => {
              const ts = getEventTs(e);
              const date = formatDateShort(ts);
              const time = UI.formatTime(ts);
              const typeLabel = e.type === 'IN' ? 'Entrada' : 'Salida';
              const typeClass = e.type === 'IN' ? 'success' : 'info';
              const sourceLabel = e.source || 'Manual';
              return `
                <div class="event-item">
                  <div class="event-date">${date}</div>
                  <div class="event-time">${time}</div>
                  <div class="event-type">${UI.createChip(typeLabel, typeClass)}</div>
                  <div class="event-source">${UI.createChip(sourceLabel, 'gray')}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <p>Sin registros de asistencia</p>
          </div>
        `}
      </div>

      <!-- Back button -->
      <div class="mt-2">
        <button class="btn btn-secondary btn-block" onclick="Router.navigate('/roster')">
          &#8592; Volver a Nomina
        </button>
      </div>
    </div>
    ${UI.createBottomNav('/roster')}
  `;
};

// Register attendance event
Views.studentProfile.registerAttendance = async function(studentId, type) {
  await State.enqueueEvent({
    student_id: studentId,
    type: type,
    course_id: State.currentCourseId,
    source: 'MANUAL',
    occurred_at: new Date().toISOString(),
    ts: new Date().toISOString()
  });

  const typeLabel = type === 'IN' ? 'Entrada' : 'Salida';
  UI.showToast(`${typeLabel} registrada correctamente`, 'success');

  // Refresh view
  Views.studentProfile();
};

// Helper: Get event timestamp
function getEventTs(event) {
  return event.ts || event.occurred_at || event.created_at || '';
}

// Helper: Get initials from name
function getInitials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Helper: Format date short
function formatDateShort(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
}

// Helper: Calculate attendance statistics
function calculateAttendanceStats(events) {
  // Group events by date
  const dayEvents = {};
  events.forEach(e => {
    const ts = getEventTs(e);
    if (!ts) return;
    const date = ts.split('T')[0];
    if (!dayEvents[date]) dayEvents[date] = [];
    dayEvents[date].push(e);
  });

  // Count days with IN events (present days)
  const daysPresent = Object.keys(dayEvents).filter(date =>
    dayEvents[date].some(e => e.type === 'IN')
  ).length;

  // Count late arrivals (IN after 08:30)
  const lateArrivals = events.filter(e => {
    if (e.type !== 'IN') return false;
    const ts = getEventTs(e);
    if (!ts) return false;
    const time = ts.split('T')[1] || '';
    return time > '08:30:00';
  }).length;

  // Calculate total school days (weekdays from start of year)
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 2, 1); // March 1st (school year start in Chile)
  let totalSchoolDays = 0;

  for (let d = new Date(startOfYear); d <= now; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) totalSchoolDays++;
  }

  // Ensure minimum of 1 to avoid division by zero
  totalSchoolDays = Math.max(totalSchoolDays, 1);

  const percentage = Math.round((daysPresent / totalSchoolDays) * 100);
  const daysAbsent = totalSchoolDays - daysPresent;

  return {
    totalEvents: events.length,
    daysPresent,
    daysAbsent: Math.max(0, daysAbsent),
    totalSchoolDays,
    percentage: Math.min(100, percentage),
    lateArrivals
  };
}
