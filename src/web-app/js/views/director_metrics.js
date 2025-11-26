// Director Advanced Metrics (Métricas Extendidas)
Views.directorMetrics = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Métricas Avanzadas';

  const courses = State.getCourses();
  const students = State.getStudents();
  const events = State.getAttendanceEvents();

  // Calculate metrics
  const metrics = calculateMetrics(events, students, courses);

  content.innerHTML = `
    <div class="cards-grid">
      ${Components.createStatCard('Tasa de Asistencia', metrics.attendanceRate + '%')}
      ${Components.createStatCard('Promedio Atrasos/Día', metrics.avgLatePerDay.toFixed(1))}
      ${Components.createStatCard('Alumnos Con Atrasos Frecuentes', metrics.frequentLateStudents)}
      ${Components.createStatCard('Días Sin Incidentes', metrics.daysWithoutIncidents)}
    </div>

    <div style="margin-bottom: 1rem;">
      <button class="btn btn-secondary" onclick="Views.directorMetrics.exportFullPDF()">Exportar Reporte Completo PDF</button>
    </div>

    <div class="grid-2-cols" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1rem;">
      <div class="card">
        <div class="card-header">Top 10 Alumnos con Más Atrasos</div>
        <div class="card-body">
          ${renderLateStudentsTable(metrics.lateStudentsRanking)}
        </div>
      </div>

      <div class="card">
        <div class="card-header">Distribución de Atrasos por Hora</div>
        <div class="card-body">
          <canvas id="late-by-hour-chart" width="400" height="250"></canvas>
        </div>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-header">Análisis por Curso</div>
      <div class="card-body">
        ${renderCourseAnalysis(metrics.courseMetrics)}
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-header">Tendencia de Asistencia (Últimos 30 días)</div>
      <div class="card-body">
        <canvas id="attendance-trend-chart" width="800" height="300"></canvas>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-header">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>Alumnos en Riesgo (>3 ausencias o >5 atrasos en el mes)</span>
          <button class="btn btn-secondary btn-sm" onclick="Views.directorMetrics.exportRiskReport()">Exportar</button>
        </div>
      </div>
      <div class="card-body">
        ${renderRiskStudents(metrics.riskStudents)}
      </div>
    </div>
  `;

  // Draw charts after render
  setTimeout(() => drawCharts(metrics), 100);

  function calculateMetrics(events, students, courses) {
    // Get unique dates
    const dates = [...new Set(events.map(e => e.ts.split('T')[0]))].sort();
    const last30Days = dates.slice(-30);

    // Calculate attendance rate
    const inEvents = events.filter(e => e.type === 'IN');
    const uniqueStudentDays = new Set(inEvents.map(e => `${e.student_id}-${e.ts.split('T')[0]}`));
    const totalPossibleDays = students.length * last30Days.length;
    const attendanceRate = totalPossibleDays > 0
      ? ((uniqueStudentDays.size / totalPossibleDays) * 100).toFixed(1)
      : 0;

    // Late events (after 08:30)
    const lateEvents = inEvents.filter(e => {
      const time = e.ts.split('T')[1];
      return time > '08:30:00';
    });

    // Average late per day
    const lateDays = new Set(lateEvents.map(e => e.ts.split('T')[0]));
    const avgLatePerDay = lateDays.size > 0 ? lateEvents.length / lateDays.size : 0;

    // Late students ranking
    const lateByStudent = {};
    lateEvents.forEach(e => {
      lateByStudent[e.student_id] = (lateByStudent[e.student_id] || 0) + 1;
    });

    const lateStudentsRanking = Object.entries(lateByStudent)
      .map(([studentId, count]) => ({
        student: students.find(s => s.id === parseInt(studentId)),
        count
      }))
      .filter(x => x.student)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Frequent late students (more than 3)
    const frequentLateStudents = Object.values(lateByStudent).filter(c => c > 3).length;

    // Days without incidents (no late arrivals)
    const daysWithLate = new Set(lateEvents.map(e => e.ts.split('T')[0])).size;
    const daysWithoutIncidents = Math.max(0, last30Days.length - daysWithLate);

    // Late by hour distribution
    const lateByHour = {};
    lateEvents.forEach(e => {
      const hour = e.ts.split('T')[1].substring(0, 2);
      lateByHour[hour] = (lateByHour[hour] || 0) + 1;
    });

    // Course metrics
    const courseMetrics = courses.map(course => {
      const courseStudents = students.filter(s => s.course_id === course.id);
      const courseEvents = inEvents.filter(e =>
        courseStudents.some(s => s.id === e.student_id)
      );
      const courseLate = courseEvents.filter(e => e.ts.split('T')[1] > '08:30:00');

      const studentDays = new Set(courseEvents.map(e => `${e.student_id}-${e.ts.split('T')[0]}`));
      const totalDays = courseStudents.length * last30Days.length;
      const rate = totalDays > 0 ? ((studentDays.size / totalDays) * 100).toFixed(1) : 0;

      return {
        course,
        students: courseStudents.length,
        attendanceRate: rate,
        totalLate: courseLate.length,
        avgLate: courseStudents.length > 0 ? (courseLate.length / courseStudents.length).toFixed(2) : 0
      };
    });

    // Risk students (>3 absences or >5 late in month)
    const riskStudents = students.map(student => {
      const studentEvents = inEvents.filter(e => e.student_id === student.id);
      const studentLate = studentEvents.filter(e => e.ts.split('T')[1] > '08:30:00').length;
      const studentDays = new Set(studentEvents.map(e => e.ts.split('T')[0])).size;
      const absences = Math.max(0, last30Days.length - studentDays);

      return {
        student,
        absences,
        lateCount: studentLate,
        isRisk: absences > 3 || studentLate > 5
      };
    }).filter(x => x.isRisk);

    // Daily attendance trend
    const dailyTrend = last30Days.map(date => {
      const dayEvents = inEvents.filter(e => e.ts.startsWith(date));
      return new Set(dayEvents.map(e => e.student_id)).size;
    });

    return {
      attendanceRate,
      avgLatePerDay,
      frequentLateStudents,
      daysWithoutIncidents,
      lateStudentsRanking,
      lateByHour,
      courseMetrics,
      riskStudents,
      dailyTrend,
      trendLabels: last30Days.map(d => d.substring(5)) // MM-DD format
    };
  }

  function renderLateStudentsTable(ranking) {
    if (ranking.length === 0) {
      return Components.createEmptyState('Sin datos', 'No hay registros de atrasos');
    }

    const headers = ['#', 'Alumno', 'Curso', 'Atrasos'];
    const rows = ranking.map((item, idx) => {
      const course = courses.find(c => c.id === item.student.course_id);
      return [
        idx + 1,
        Components.escapeHtml(item.student.full_name),
        course ? Components.escapeHtml(course.name) : '-',
        Components.createChip(item.count, item.count > 5 ? 'error' : item.count > 3 ? 'warning' : 'gray')
      ];
    });

    return Components.createTable(headers, rows);
  }

  function renderCourseAnalysis(courseMetrics) {
    const headers = ['Curso', 'Alumnos', '% Asistencia', 'Atrasos Totales', 'Prom. Atrasos/Alumno'];
    const rows = courseMetrics.map(m => [
      Components.escapeHtml(m.course.name),
      m.students,
      Components.createChip(m.attendanceRate + '%', parseFloat(m.attendanceRate) >= 90 ? 'success' : parseFloat(m.attendanceRate) >= 75 ? 'warning' : 'error'),
      m.totalLate,
      m.avgLate
    ]);

    return Components.createTable(headers, rows);
  }

  function renderRiskStudents(riskStudents) {
    if (riskStudents.length === 0) {
      return Components.createEmptyState('Sin alumnos en riesgo', 'No hay alumnos que superen los umbrales de ausencias o atrasos');
    }

    const headers = ['Alumno', 'Curso', 'Ausencias', 'Atrasos', 'Riesgo'];
    const rows = riskStudents.map(item => {
      const course = courses.find(c => c.id === item.student.course_id);
      const riskLevel = (item.absences > 5 || item.lateCount > 8) ? 'Alto' : 'Medio';
      const riskChip = riskLevel === 'Alto'
        ? Components.createChip('Alto', 'error')
        : Components.createChip('Medio', 'warning');

      return [
        Components.escapeHtml(item.student.full_name),
        course ? Components.escapeHtml(course.name) : '-',
        item.absences,
        item.lateCount,
        riskChip
      ];
    });

    return Components.createTable(headers, rows);
  }

  function drawCharts(metrics) {
    // Late by hour chart
    const hourCanvas = document.getElementById('late-by-hour-chart');
    if (hourCanvas) {
      const hours = ['08', '09', '10', '11', '12'];
      const hourData = hours.map(h => metrics.lateByHour[h] || 0);
      const hourLabels = hours.map(h => h + ':00');
      Components.drawBarChart(hourCanvas, hourData, hourLabels);
    }

    // Attendance trend chart
    const trendCanvas = document.getElementById('attendance-trend-chart');
    if (trendCanvas && metrics.dailyTrend.length > 0) {
      // Sample every 3rd day for readability
      const sampledData = metrics.dailyTrend.filter((_, i) => i % 3 === 0 || i === metrics.dailyTrend.length - 1);
      const sampledLabels = metrics.trendLabels.filter((_, i) => i % 3 === 0 || i === metrics.trendLabels.length - 1);
      Components.drawLineChart(trendCanvas, sampledData, sampledLabels);
    }
  }

  Views.directorMetrics.exportRiskReport = function() {
    const metrics = calculateMetrics(events, students, courses);

    if (metrics.riskStudents.length === 0) {
      Components.showToast('No hay alumnos en riesgo para exportar', 'info');
      return;
    }

    const headers = ['Alumno', 'Curso', 'Ausencias', 'Atrasos', 'Nivel de Riesgo'];
    const rows = metrics.riskStudents.map(item => {
      const course = courses.find(c => c.id === item.student.course_id);
      const riskLevel = (item.absences > 5 || item.lateCount > 8) ? 'Alto' : 'Medio';
      return [
        item.student.full_name,
        course ? course.name : '-',
        item.absences,
        item.lateCount,
        riskLevel
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alumnos_riesgo_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    Components.showToast(`${metrics.riskStudents.length} alumnos exportados`, 'success');
  };

  Views.directorMetrics.exportFullPDF = function() {
    const metrics = calculateMetrics(events, students, courses);

    const doc = Components.generatePDF('Reporte de Métricas Avanzadas');
    if (!doc) return;

    let y = 40;

    // KPIs section
    y = Components.addPDFSection(doc, 'Indicadores Clave (KPIs)', y);
    y = Components.addPDFText(doc, `Tasa de Asistencia General: ${metrics.attendanceRate}%`, y);
    y = Components.addPDFText(doc, `Promedio de Atrasos por Día: ${metrics.avgLatePerDay.toFixed(1)}`, y);
    y = Components.addPDFText(doc, `Alumnos con Atrasos Frecuentes (>3): ${metrics.frequentLateStudents}`, y);
    y = Components.addPDFText(doc, `Días Sin Incidentes: ${metrics.daysWithoutIncidents}`, y);
    y += 5;

    // Top late students
    if (metrics.lateStudentsRanking.length > 0) {
      y = Components.addPDFSection(doc, 'Top 10 Alumnos con Más Atrasos', y);
      const lateHeaders = ['#', 'Alumno', 'Curso', 'Atrasos'];
      const lateRows = metrics.lateStudentsRanking.map((item, idx) => {
        const course = courses.find(c => c.id === item.student.course_id);
        return [
          (idx + 1).toString(),
          item.student.full_name,
          course ? course.name : '-',
          item.count.toString()
        ];
      });
      y = Components.addPDFTable(doc, lateHeaders, lateRows, y);
    }

    // Course analysis
    y = Components.addPDFSection(doc, 'Análisis por Curso', y);
    const courseHeaders = ['Curso', 'Alumnos', '% Asistencia', 'Atrasos', 'Prom/Alumno'];
    const courseRows = metrics.courseMetrics.map(m => [
      m.course.name,
      m.students.toString(),
      m.attendanceRate + '%',
      m.totalLate.toString(),
      m.avgLate
    ]);
    y = Components.addPDFTable(doc, courseHeaders, courseRows, y);

    // Risk students
    if (metrics.riskStudents.length > 0) {
      // Check if need new page
      if (y > 220) {
        doc.addPage();
        y = 20;
      }

      y = Components.addPDFSection(doc, 'Alumnos en Riesgo', y);
      const riskHeaders = ['Alumno', 'Curso', 'Ausencias', 'Atrasos', 'Nivel'];
      const riskRows = metrics.riskStudents.map(item => {
        const course = courses.find(c => c.id === item.student.course_id);
        const riskLevel = (item.absences > 5 || item.lateCount > 8) ? 'Alto' : 'Medio';
        return [
          item.student.full_name,
          course ? course.name : '-',
          item.absences.toString(),
          item.lateCount.toString(),
          riskLevel
        ];
      });
      y = Components.addPDFTable(doc, riskHeaders, riskRows, y);
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text('Control de Ingreso/Salida Escolar - Métricas Avanzadas', 15, pageHeight - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() - 30, pageHeight - 10);
    }

    // Save
    const filename = `metricas_${new Date().toISOString().split('T')[0]}.pdf`;
    Components.savePDF(doc, filename);
  };
};
