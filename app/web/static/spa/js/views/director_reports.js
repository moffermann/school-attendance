// Director Reports
Views.directorReports = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Reportes';

  const courses = State.getCourses();
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  content.innerHTML = `
    <div class="card mb-3">
      <div class="card-header">Filtros de Reporte</div>
      <div class="card-body">
        <div class="flex gap-2 flex-wrap items-end">
          <div class="form-group" style="flex: 1; min-width: 200px;">
            <label class="form-label">Fecha Inicio</label>
            <input type="date" id="date-start" class="form-input" value="${weekAgo}">
          </div>

          <div class="form-group" style="flex: 1; min-width: 200px;">
            <label class="form-label">Fecha Fin</label>
            <input type="date" id="date-end" class="form-input" value="${today}">
          </div>

          <div class="form-group" style="flex: 1; min-width: 200px;">
            <label class="form-label">Curso</label>
            <select id="course-select" class="form-select">
              <option value="">Todos</option>
              ${courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>

          <button class="btn btn-primary" onclick="Views.directorReports.generateReport()">Generar</button>
        </div>
      </div>
    </div>

    <div id="report-results"></div>
  `;

  // Auto-generate initial report
  setTimeout(() => Views.directorReports.generateReport(), 100);

  Views.directorReports.generateReport = function() {
    const resultsDiv = document.getElementById('report-results');
    const courseId = document.getElementById('course-select').value;
    const selectedCourses = courseId ? [State.getCourse(parseInt(courseId))] : courses;

    let totalStudents = 0;
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;

    const reportRows = selectedCourses.map(course => {
      const students = State.getStudentsByCourse(course.id);
      const events = State.getAttendanceEvents({ courseId: course.id });
      const inEvents = events.filter(e => e.type === 'IN');
      const lateEvents = inEvents.filter(e => e.ts.split('T')[1] > '08:30:00');

      const presentCount = new Set(inEvents.map(e => e.student_id)).size;
      const absentCount = students.length - presentCount;

      totalStudents += students.length;
      totalPresent += presentCount;
      totalLate += lateEvents.length;
      totalAbsent += absentCount;

      const attendancePercent = ((presentCount / students.length) * 100).toFixed(1);

      return [
        course.name,
        students.length,
        presentCount,
        lateEvents.length,
        absentCount,
        `${attendancePercent}%`
      ];
    });

    resultsDiv.innerHTML = `
      <div class="card mb-3">
        <div class="card-header">Resumen por Curso</div>
        <div class="card-body">
          ${Components.createTable(
            ['Curso', 'Total Alumnos', 'Presentes', 'Atrasos', 'Ausentes', '% Asistencia'],
            reportRows
          )}
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header">Gráfico de Asistencia</div>
        <div class="card-body">
          <canvas id="attendance-chart" width="800" height="300"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Tendencia Semanal</div>
        <div class="card-body">
          <canvas id="trend-chart" width="800" height="300"></canvas>
        </div>
      </div>
    `;

    // Draw charts
    setTimeout(() => {
      const barCanvas = document.getElementById('attendance-chart');
      if (barCanvas) {
        const data = selectedCourses.map(c => {
          const students = State.getStudentsByCourse(c.id);
          const events = State.getAttendanceEvents({ courseId: c.id });
          const inEvents = events.filter(e => e.type === 'IN');
          return new Set(inEvents.map(e => e.student_id)).size;
        });
        const labels = selectedCourses.map(c => c.name);
        Components.drawBarChart(barCanvas, data, labels);
      }

      const lineCanvas = document.getElementById('trend-chart');
      if (lineCanvas) {
        // Mock weekly trend data
        const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
        const trendData = [45, 52, 48, 55, 50]; // Mock data
        Components.drawLineChart(lineCanvas, trendData, weekDays);
      }
    }, 100);

    Components.showToast('Reporte generado', 'success');
  };
};
