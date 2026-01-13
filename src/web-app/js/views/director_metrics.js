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
    const schedules = State.getSchedules();
    const exceptions = State.getScheduleExceptions();

    // Helper: Get last 30 calendar days (not days with events)
    const getLast30Days = () => {
      const days = [];
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        days.push(`${y}-${m}-${day}`);
      }
      return days;
    };

    // Helper: Check if student was late based on course schedule
    const isLate = (eventTime, scheduleInTime) => {
      if (!eventTime || !scheduleInTime) return false;
      // Add 10 minutes grace period
      const [h, m] = scheduleInTime.split(':').map(Number);
      const graceMinutes = h * 60 + m + 10;
      const [eh, em] = eventTime.split(':').map(Number);
      const eventMinutes = eh * 60 + em;
      return eventMinutes > graceMinutes;
    };

    // Helper: Get weekday (0=Monday...6=Sunday) from date string
    const getWeekday = (dateStr) => {
      const d = new Date(`${dateStr}T00:00:00`);
      const jsDay = d.getDay(); // 0=Sunday
      return jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Monday
    };

    // Helper: Get exception for a date and course (if any)
    const getException = (courseId, dateStr) => {
      // First check for GLOBAL exception (applies to all courses)
      const global = exceptions.find(e => e.scope === 'GLOBAL' && e.date === dateStr);
      if (global) return global;
      // Then check for COURSE-specific exception
      return exceptions.find(e => e.scope === 'COURSE' && e.course_id === courseId && e.date === dateStr);
    };

    // Helper: Check if course has class on a given date (considering exceptions)
    const hasSchedule = (courseId, dateStr) => {
      const weekday = getWeekday(dateStr);
      const baseSchedule = schedules.some(s => s.course_id === courseId && s.weekday === weekday);
      if (!baseSchedule) return false;

      // Check for exception (no class if exception exists without in_time)
      const exception = getException(courseId, dateStr);
      if (exception && !exception.in_time) return false; // Suspended day
      return true;
    };

    // Helper: Get schedule for course on a date (considering exceptions)
    const getScheduleForDate = (courseId, dateStr) => {
      const weekday = getWeekday(dateStr);
      const baseSchedule = schedules.find(s => s.course_id === courseId && s.weekday === weekday);
      if (!baseSchedule) return null;

      // Check for exception with modified schedule
      const exception = getException(courseId, dateStr);
      if (exception) {
        if (!exception.in_time) return null; // No class this day
        // Return modified schedule from exception
        return { ...baseSchedule, in_time: exception.in_time, out_time: exception.out_time };
      }
      return baseSchedule;
    };

    const last30Days = getLast30Days();
    const inEvents = events.filter(e => e.type === 'IN');

    // Filter events to last 30 days
    const last30DaysSet = new Set(last30Days);
    const recentInEvents = inEvents.filter(e => last30DaysSet.has(e.ts.split('T')[0]));

    // Calculate attendance rate (only count school days)
    let totalPossibleDays = 0;
    let totalPresentDays = 0;

    students.forEach(student => {
      last30Days.forEach(date => {
        if (hasSchedule(student.course_id, date)) {
          totalPossibleDays++;
          // Check if student has IN event on this day
          const hasAttended = recentInEvents.some(
            e => e.student_id === student.id && e.ts.startsWith(date)
          );
          if (hasAttended) totalPresentDays++;
        }
      });
    });

    const attendanceRate = totalPossibleDays > 0
      ? ((totalPresentDays / totalPossibleDays) * 100).toFixed(1)
      : 0;

    // Late events (using actual course schedule)
    const lateEvents = [];
    recentInEvents.forEach(e => {
      const student = students.find(s => s.id === e.student_id);
      if (!student) return;
      const date = e.ts.split('T')[0];
      const time = e.ts.split('T')[1].substring(0, 5);
      const schedule = getScheduleForDate(student.course_id, date);
      if (schedule && isLate(time, schedule.in_time)) {
        lateEvents.push(e);
      }
    });

    // Average late per day (only school days)
    const schoolDays = last30Days.filter(date =>
      courses.some(c => hasSchedule(c.id, date))
    );
    const lateDays = new Set(lateEvents.map(e => e.ts.split('T')[0]));
    const avgLatePerDay = schoolDays.length > 0 ? lateEvents.length / schoolDays.length : 0;

    // Late students ranking (count unique late days, not events)
    const lateByStudent = {};
    lateEvents.forEach(e => {
      const key = `${e.student_id}-${e.ts.split('T')[0]}`;
      if (!lateByStudent[e.student_id]) lateByStudent[e.student_id] = new Set();
      lateByStudent[e.student_id].add(e.ts.split('T')[0]);
    });

    // TDD-R5-BUG1 fix: Use parseInt with radix 10
    const lateStudentsRanking = Object.entries(lateByStudent)
      .map(([studentId, dates]) => ({
        student: students.find(s => s.id === parseInt(studentId, 10)),
        count: dates.size // Count unique days, not events
      }))
      .filter(x => x.student)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Frequent late students (more than 3 days)
    const frequentLateStudents = Object.values(lateByStudent).filter(dates => dates.size > 3).length;

    // Days without incidents (no late arrivals on school days)
    const daysWithLate = lateDays.size;
    const daysWithoutIncidents = Math.max(0, schoolDays.length - daysWithLate);

    // Late by hour distribution
    const lateByHour = {};
    lateEvents.forEach(e => {
      const hour = e.ts.split('T')[1].substring(0, 2);
      lateByHour[hour] = (lateByHour[hour] || 0) + 1;
    });

    // Course metrics
    const courseMetrics = courses.map(course => {
      const courseStudents = students.filter(s => s.course_id === course.id);
      const courseScheduleDays = last30Days.filter(date => hasSchedule(course.id, date));
      const courseScheduleDaysSet = new Set(courseScheduleDays);

      // Get events for this course's students ONLY on days with schedule
      const courseEvents = recentInEvents.filter(e => {
        const eventDate = e.ts.split('T')[0];
        return courseStudents.some(s => s.id === e.student_id) &&
               courseScheduleDaysSet.has(eventDate); // Only count school days
      });

      // Group events by student-day and find first IN time
      const firstInByStudentDay = {};
      courseEvents.forEach(e => {
        const date = e.ts.split('T')[0];
        const time = e.ts.split('T')[1].substring(0, 5);
        const key = `${e.student_id}-${date}`;
        if (!firstInByStudentDay[key] || time < firstInByStudentDay[key]) {
          firstInByStudentDay[key] = time;
        }
      });

      // Count student-days with attendance (unique student-day pairs)
      const studentDaysPresent = Object.keys(firstInByStudentDay).length;

      // Count late student-days (where first IN was after schedule + grace)
      let lateStudentDays = 0;
      Object.entries(firstInByStudentDay).forEach(([key, firstInTime]) => {
        const date = key.split('-').slice(1).join('-'); // Extract date from "studentId-YYYY-MM-DD"
        const schedule = getScheduleForDate(course.id, date);
        if (schedule && isLate(firstInTime, schedule.in_time)) {
          lateStudentDays++;
        }
      });

      // totalDays = alumnos × días con clase
      const totalDays = courseStudents.length * courseScheduleDays.length;
      const rate = totalDays > 0 ? ((studentDaysPresent / totalDays) * 100).toFixed(1) : 0;

      return {
        course,
        students: courseStudents.length,
        attendanceRate: rate,
        totalLate: lateStudentDays,
        avgLate: courseStudents.length > 0 ? (lateStudentDays / courseStudents.length).toFixed(2) : 0
      };
    });

    // Risk students (>3 absences or >5 late days in month)
    const riskStudents = students.map(student => {
      const studentScheduleDays = last30Days.filter(date => hasSchedule(student.course_id, date));
      const studentEvents = recentInEvents.filter(e => e.student_id === student.id);
      const studentPresentDays = new Set(studentEvents.map(e => e.ts.split('T')[0])).size;
      const absences = Math.max(0, studentScheduleDays.length - studentPresentDays);

      // Count late days
      let lateDays = 0;
      studentEvents.forEach(e => {
        const date = e.ts.split('T')[0];
        const time = e.ts.split('T')[1].substring(0, 5);
        const schedule = getScheduleForDate(student.course_id, date);
        if (schedule && isLate(time, schedule.in_time)) {
          lateDays++;
        }
      });

      return {
        student,
        absences,
        lateCount: lateDays,
        isRisk: absences > 3 || lateDays > 5
      };
    }).filter(x => x.isRisk);

    // Daily attendance trend (only school days)
    const dailyTrend = last30Days.map(date => {
      // Only count if it's a school day for at least one course
      const isSchoolDay = courses.some(c => hasSchedule(c.id, date));
      if (!isSchoolDay) return 0;
      const dayEvents = recentInEvents.filter(e => e.ts.startsWith(date));
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
      trendLabels: last30Days.map(d => {
        const dt = new Date(`${d}T00:00:00`);
        return `${dt.getDate()}/${dt.getMonth() + 1}`;
      })
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
      Components.drawLineChart(trendCanvas, sampledData, sampledLabels, {
        yAxisLabel: 'Alumnos presentes'
      });
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
    // TDD-R5-BUG3 fix: Store URL to revoke after download to prevent memory leak
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = `alumnos_riesgo_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    // Revoke blob URL after download to free memory
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

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
