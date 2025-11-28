Views.roster = async function() {
  if (!State.currentCourseId) {
    Router.navigate('/classes');
    return;
  }

  const app = document.getElementById('app');
  const courseId = State.currentCourseId;

  // Show loading
  app.innerHTML = `
    ${UI.createHeader('Nómina')}
    <div class="container">
      <div class="loading">Cargando estudiantes...</div>
    </div>
  `;

  let studentList = [];

  try {
    // Try to fetch from API if online
    if (State.isOnline() && API.isAuthenticated()) {
      const students = await API.getCourseStudents(courseId);
      studentList = students;
      // Cache for offline use
      await State.cacheStudents(courseId, students);
    } else {
      // Fallback to cached students
      studentList = await State.getCachedStudents(courseId);
    }
  } catch (error) {
    console.error('Error loading students:', error);
    // Fallback to cached students on error
    studentList = await State.getCachedStudents(courseId);
    if (studentList.length) {
      UI.showToast('Usando datos en caché', 'info');
    }
  }

  // Get today's events from queue
  const queue = await IDB.getAll('queue');
  const today = new Date().toISOString().split('T')[0];

  // Find current course name
  const course = State.courses.find(c => c.id === courseId);
  const courseName = course ? `${course.name} - ${course.grade}` : 'Curso';

  app.innerHTML = `
    ${UI.createHeader('Nómina')}
    <div class="container" style="padding-bottom:80px">
      <div class="course-title" style="font-weight: 600; margin-bottom: 1rem;">
        ${UI.escapeHtml(courseName)}
      </div>
      ${studentList.length ? `
        <div class="card">
          <div class="card-header">Estado del Día</div>
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${studentList.map(s => {
                const eventsToday = queue.filter(e =>
                  e.student_id === s.id &&
                  (e.ts || e.occurred_at || e.created_at || '').startsWith(today)
                );
                const inEvent = eventsToday.find(e => e.type === 'IN');
                const outEvent = eventsToday.find(e => e.type === 'OUT');
                const eventTime = outEvent?.ts || outEvent?.occurred_at || inEvent?.ts || inEvent?.occurred_at;
                const status = outEvent
                  ? `Salió ${UI.formatTime(eventTime)}`
                  : inEvent
                    ? `Ingreso ${UI.formatTime(eventTime)}`
                    : 'Sin registro';
                const safeName = UI.escapeHtml(s.full_name);
                return `
                  <tr>
                    <td>${safeName}</td>
                    <td>${UI.createChip(status, inEvent ? 'success' : 'gray')}</td>
                    <td style="white-space: nowrap;">
                      <button class="btn btn-sm btn-icon" style="font-size:.75rem;padding:.25rem .5rem" onclick="Router.navigate('/student-profile?id=${s.id}')" title="Ver perfil">&#128100;</button>
                      <button class="btn btn-success btn-sm" style="font-size:.75rem;padding:.25rem .5rem" onclick="Views.roster.markIN(${s.id})" title="Entrada">IN</button>
                      <button class="btn btn-secondary btn-sm" style="font-size:.75rem;padding:.25rem .5rem" onclick="Views.roster.markOUT(${s.id})" title="Salida">OUT</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="card">
          <div class="card-header">Sin estudiantes</div>
          <p style="color: #666;">No hay estudiantes registrados en este curso.</p>
        </div>
      `}
      <div class="flex gap-1">
        <button class="btn btn-secondary" onclick="Router.navigate('/scan-qr')">Escanear QR</button>
        <button class="btn btn-secondary" onclick="Router.navigate('/take-attendance')">Marcado en Lote</button>
      </div>
    </div>
    ${UI.createBottomNav('/roster')}
  `;

  Views.roster.markIN = async function(studentId) {
    await State.enqueueEvent({
      student_id: studentId,
      type: 'IN',
      course_id: State.currentCourseId,
      source: 'MANUAL',
      occurred_at: new Date().toISOString(),
      ts: new Date().toISOString()
    });
    UI.showToast('Ingreso registrado', 'success');
    Views.roster();
  };

  Views.roster.markOUT = async function(studentId) {
    await State.enqueueEvent({
      student_id: studentId,
      type: 'OUT',
      course_id: State.currentCourseId,
      source: 'MANUAL',
      occurred_at: new Date().toISOString(),
      ts: new Date().toISOString()
    });
    UI.showToast('Salida registrada', 'success');
    Views.roster();
  };
};
