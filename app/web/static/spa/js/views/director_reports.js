// Director Reports (datos reales)
Views.directorReports = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Reportes';

  const courses = State.getCourses();
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let filters = { start: weekAgo, end: today, course_id: '' };
  let snapshot = { courses: [], trend: [], start_date: weekAgo, end_date: today };

  async function loadReport(showToast = false) {
    content.innerHTML = Components.createLoader('Calculando reportes...');
    try {
      snapshot = await State.fetchReportsSnapshot({
        start: filters.start,
        end: filters.end,
        course_id: filters.course_id || undefined
      });
      renderReport();
      if (showToast) Components.showToast('Reporte actualizado', 'success');
    } catch (error) {
      console.error('No se pudo generar el reporte', error);
      content.innerHTML = Components.createEmptyState('No disponible', 'No se pudo calcular el reporte de asistencia.');
    }
  }

  function renderReport() {
    content.innerHTML = `
      <div class="card mb-3">
        <div class="card-header">Filtros de Reporte</div>
        <div class="card-body">
          <div class="flex gap-2 flex-wrap items-end">
            <div class="form-group" style="flex: 1; min-width: 200px;">
              <label class="form-label">Fecha Inicio</label>
              <input type="date" id="date-start" class="form-input" value="${filters.start}">
            </div>

            <div class="form-group" style="flex: 1; min-width: 200px;">
              <label class="form-label">Fecha Fin</label>
              <input type="date" id="date-end" class="form-input" value="${filters.end}">
            </div>

            <div class="form-group" style="flex: 1; min-width: 200px;">
              <label class="form-label">Curso</label>
              <select id="course-select" class="form-select">
                <option value="">Todos</option>
                ${courses.map(c => `<option value="${c.id}" ${filters.course_id === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>

            <button class="btn btn-primary" onclick="Views.directorReports.generateReport()">Generar</button>
          </div>
        </div>
      </div>

      <div id="report-results"></div>
    `;

    renderResults();
  }

  function renderResults() {
    const resultsDiv = document.getElementById('report-results');
    const summaries = snapshot.courses || [];

    const totals = summaries.reduce(
      (acc, item) => {
        acc.students += item.total_students;
        acc.present += item.present;
        acc.late += item.late;
        acc.absent += item.absent;
        return acc;
      },
      { students: 0, present: 0, late: 0, absent: 0 }
    );

    const rows = summaries.map(item => [
      item.course_name,
      item.total_students,
      item.present,
      item.late,
      item.absent,
      `${item.attendance_pct}%`
    ]);

    resultsDiv.innerHTML = `
      <div class="cards-grid">
        ${Components.createStatCard('Alumnos', totals.students)}
        ${Components.createStatCard('Presentes', totals.present)}
        ${Components.createStatCard('Atrasos', totals.late)}
        ${Components.createStatCard('Ausentes', totals.absent)}
      </div>

      <div class="card mb-3">
        <div class="card-header">Resumen por Curso</div>
        <div class="card-body">
          ${Components.createTable(
            ['Curso', 'Total Alumnos', 'Presentes', 'Atrasos', 'Ausentes', '% Asistencia'],
            rows
          )}
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header">Asistencia por Curso</div>
        <div class="card-body">
          <canvas id="attendance-chart" width="800" height="300"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Tendencia diaria</div>
        <div class="card-body">
          <canvas id="trend-chart" width="800" height="300"></canvas>
        </div>
      </div>
    `;

    setTimeout(() => drawCharts(summaries, snapshot.trend || []), 50);
  }

  function drawCharts(summaries, trend) {
    const barCanvas = document.getElementById('attendance-chart');
    if (barCanvas) {
      const data = summaries.map(item => item.attendance_pct);
      const labels = summaries.map(item => item.course_name);
      Components.drawBarChart(barCanvas, data, labels);
    }

    const lineCanvas = document.getElementById('trend-chart');
    if (lineCanvas) {
      const labels = trend.map(point => Components.formatDate(point.date));
      const data = trend.map(point => point.present);
      Components.drawLineChart(lineCanvas, data, labels);
    }
  }

  Views.directorReports.generateReport = function() {
    filters = {
      start: document.getElementById('date-start').value,
      end: document.getElementById('date-end').value,
      course_id: document.getElementById('course-select').value
    };
    loadReport(true);
  };

  loadReport();
};
