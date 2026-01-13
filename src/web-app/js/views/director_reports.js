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
          <button class="btn btn-secondary" onclick="Views.directorReports.exportPDF()">Exportar PDF</button>
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
    const startDate = document.getElementById('date-start').value;
    const endDate = document.getElementById('date-end').value;
    const selectedCourses = courseId ? [State.getCourse(parseInt(courseId))] : courses;
    const exceptions = State.getScheduleExceptions(); // Excepciones de horario (feriados, suspensiones)

    // Helper: Get all dates in range (con fix de timezone)
    const getDatesInRange = (start, end) => {
      const dates = [];
      // Agregar T00:00:00 para interpretar como hora local, no UTC
      const current = new Date(`${start}T00:00:00`);
      const endDt = new Date(`${end}T00:00:00`);
      while (current <= endDt) {
        // Usar getFullYear/Month/Date para evitar shift de timezone
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    // Helper: Check if student was late on a given day
    const isLate = (firstInTime, scheduleInTime) => {
      if (!firstInTime || !scheduleInTime) return false;
      // Add 10 minutes grace period
      const [h, m] = scheduleInTime.split(':').map(Number);
      const graceMinutes = h * 60 + m + 10;
      const [eh, em] = firstInTime.split(':').map(Number);
      const eventMinutes = eh * 60 + em;
      return eventMinutes > graceMinutes;
    };

    // Helper: Get exception for a date and course (if any)
    const getException = (courseId, dateStr) => {
      // First check for GLOBAL exception (applies to all courses)
      const global = exceptions.find(e => e.scope === 'GLOBAL' && e.date === dateStr);
      if (global) return global;
      // Then check for COURSE-specific exception
      return exceptions.find(e => e.scope === 'COURSE' && e.course_id === courseId && e.date === dateStr);
    };

    // Helper: Get schedule for course on a date (considering exceptions)
    const getScheduleForDate = (courseId, schedules, dateStr) => {
      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      const weekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const baseSchedule = schedules.find(s => s.weekday === weekday);
      if (!baseSchedule) return null;

      // Check for exception
      const exception = getException(courseId, dateStr);
      if (exception) {
        if (!exception.in_time) return null; // No class this day (holiday/suspension)
        // Return modified schedule from exception
        return { ...baseSchedule, in_time: exception.in_time, out_time: exception.out_time };
      }
      return baseSchedule;
    };

    const allDates = getDatesInRange(startDate, endDate);
    const trendData = {}; // date -> count of present students

    const reportRows = selectedCourses.map(course => {
      const courseStudents = State.getStudentsByCourse(course.id);
      const schedules = State.getSchedules(course.id); // Array of schedules by weekday

      // Get events filtered by date range and course
      const events = State.getAttendanceEvents({
        courseId: course.id,
        startDate: startDate,
        endDate: endDate
      });
      const inEvents = events.filter(e => e.type === 'IN');

      // Track unique students who attended at least once
      const studentsPresent = new Set();
      // Track late students (unique across all days)
      const studentsLate = new Set();

      // Process each day in range
      allDates.forEach(date => {
        // Get schedule considering exceptions (holidays, suspensions)
        const schedule = getScheduleForDate(course.id, schedules, date);

        // Skip days without schedule (weekends, holidays, suspensions)
        if (!schedule) return;

        // Get events for this day
        const dayEvents = inEvents.filter(e => e.ts.startsWith(date));

        // Find first IN event per student for this day
        const firstInByStudent = {};
        dayEvents.forEach(e => {
          const time = e.ts.split('T')[1].substring(0, 5); // HH:MM
          if (!firstInByStudent[e.student_id] || time < firstInByStudent[e.student_id]) {
            firstInByStudent[e.student_id] = time;
          }
        });

        // Count present and late
        Object.entries(firstInByStudent).forEach(([studentId, firstInTime]) => {
          studentsPresent.add(parseInt(studentId));
          if (isLate(firstInTime, schedule.in_time)) {
            studentsLate.add(parseInt(studentId));
          }
        });

        // Track trend data (total present across all courses per day)
        if (!trendData[date]) trendData[date] = new Set();
        Object.keys(firstInByStudent).forEach(sid => trendData[date].add(parseInt(sid)));
      });

      const presentCount = studentsPresent.size;
      const lateCount = studentsLate.size;
      const totalStudents = courseStudents.length;
      const absentCount = Math.max(0, totalStudents - presentCount);

      // Handle division by zero
      const attendancePercent = totalStudents > 0
        ? ((presentCount / totalStudents) * 100).toFixed(1)
        : '0.0';

      return [
        course.name,
        totalStudents,
        presentCount,
        lateCount,
        absentCount,
        `${attendancePercent}%`
      ];
    });

    resultsDiv.innerHTML = `
      <div class="card mb-3">
        <div class="card-header">Resumen por Curso (${Components.formatDate(startDate)} - ${Components.formatDate(endDate)})</div>
        <div class="card-body">
          ${Components.createTable(
            ['Curso', 'Total Alumnos', 'Presentes', 'Atrasos', 'Ausentes', '% Asistencia'],
            reportRows
          )}
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header">Gráfico de Asistencia por Curso</div>
        <div class="card-body">
          <canvas id="attendance-chart" width="800" height="300"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Tendencia de Asistencia</div>
        <div class="card-body">
          <canvas id="trend-chart" width="800" height="300"></canvas>
        </div>
      </div>
    `;

    // Draw charts
    setTimeout(() => {
      const barCanvas = document.getElementById('attendance-chart');
      if (barCanvas) {
        const presentData = reportRows.map(row => row[2]); // Present count
        const absentData = reportRows.map(row => row[4]);  // Absent count
        const labels = reportRows.map(row => row[0]); // Course name
        Components.drawBarChart(barCanvas, null, labels, {
          grouped: [
            { data: presentData, color: '#22c55e', label: 'Presentes' },
            { data: absentData, color: '#ef4444', label: 'Ausentes' }
          ]
        });
      }

      const lineCanvas = document.getElementById('trend-chart');
      if (lineCanvas) {
        // Real trend data from events
        const trendLabels = allDates.map(d => {
          const dt = new Date(d);
          return `${dt.getDate()}/${dt.getMonth() + 1}`;
        });
        const trendCounts = allDates.map(d => trendData[d] ? trendData[d].size : 0);
        Components.drawLineChart(lineCanvas, trendCounts, trendLabels, {
          yAxisLabel: 'Alumnos presentes'
        });
      }
    }, 100);

    Components.showToast('Reporte generado', 'success');
  };

  Views.directorReports.exportPDF = function() {
    const courseId = document.getElementById('course-select').value;
    const dateStart = document.getElementById('date-start').value;
    const dateEnd = document.getElementById('date-end').value;
    const selectedCourses = courseId ? [State.getCourse(parseInt(courseId))] : courses;
    const exceptions = State.getScheduleExceptions(); // Excepciones de horario (feriados, suspensiones)

    const doc = Components.generatePDF('Reporte de Asistencia Escolar');
    if (!doc) return;

    // Helper functions (same as generateReport, con fix de timezone)
    const getDatesInRange = (start, end) => {
      const dates = [];
      // Agregar T00:00:00 para interpretar como hora local, no UTC
      const current = new Date(`${start}T00:00:00`);
      const endDt = new Date(`${end}T00:00:00`);
      while (current <= endDt) {
        // Usar getFullYear/Month/Date para evitar shift de timezone
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    const isLate = (firstInTime, scheduleInTime) => {
      if (!firstInTime || !scheduleInTime) return false;
      const [h, m] = scheduleInTime.split(':').map(Number);
      const graceMinutes = h * 60 + m + 10;
      const [eh, em] = firstInTime.split(':').map(Number);
      const eventMinutes = eh * 60 + em;
      return eventMinutes > graceMinutes;
    };

    // Helper: Get exception for a date and course (if any)
    const getException = (courseId, dateStr) => {
      const global = exceptions.find(e => e.scope === 'GLOBAL' && e.date === dateStr);
      if (global) return global;
      return exceptions.find(e => e.scope === 'COURSE' && e.course_id === courseId && e.date === dateStr);
    };

    // Helper: Get schedule for course on a date (considering exceptions)
    const getScheduleForDate = (courseId, schedules, dateStr) => {
      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      const weekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const baseSchedule = schedules.find(s => s.weekday === weekday);
      if (!baseSchedule) return null;

      const exception = getException(courseId, dateStr);
      if (exception) {
        if (!exception.in_time) return null; // No class this day
        return { ...baseSchedule, in_time: exception.in_time, out_time: exception.out_time };
      }
      return baseSchedule;
    };

    const allDates = getDatesInRange(dateStart, dateEnd);

    let y = 40;

    // Add date range info
    y = Components.addPDFText(doc, `Período: ${Components.formatDate(dateStart)} - ${Components.formatDate(dateEnd)}`, y);
    y += 5;

    // Summary section
    y = Components.addPDFSection(doc, 'Resumen por Curso', y);

    const tableHeaders = ['Curso', 'Total Alumnos', 'Presentes', 'Atrasos', 'Ausentes', '% Asistencia'];
    let grandTotalStudents = 0;
    let grandTotalPresent = 0;
    let grandTotalLate = 0;

    const tableRows = selectedCourses.map(course => {
      const students = State.getStudentsByCourse(course.id);
      const schedules = State.getSchedules(course.id);
      const events = State.getAttendanceEvents({
        courseId: course.id,
        startDate: dateStart,
        endDate: dateEnd
      });
      const inEvents = events.filter(e => e.type === 'IN');

      const studentsPresent = new Set();
      const studentsLate = new Set();

      allDates.forEach(date => {
        // Get schedule considering exceptions (holidays, suspensions)
        const schedule = getScheduleForDate(course.id, schedules, date);
        if (!schedule) return; // No class this day (weekend, holiday, suspension)

        const dayEvents = inEvents.filter(e => e.ts.startsWith(date));
        const firstInByStudent = {};
        dayEvents.forEach(e => {
          const time = e.ts.split('T')[1].substring(0, 5);
          if (!firstInByStudent[e.student_id] || time < firstInByStudent[e.student_id]) {
            firstInByStudent[e.student_id] = time;
          }
        });

        Object.entries(firstInByStudent).forEach(([studentId, firstInTime]) => {
          studentsPresent.add(parseInt(studentId));
          if (isLate(firstInTime, schedule.in_time)) {
            studentsLate.add(parseInt(studentId));
          }
        });
      });

      const presentCount = studentsPresent.size;
      const lateCount = studentsLate.size;
      const totalStudents = students.length;
      const absentCount = Math.max(0, totalStudents - presentCount);
      const attendancePercent = totalStudents > 0
        ? ((presentCount / totalStudents) * 100).toFixed(1)
        : '0.0';

      grandTotalStudents += totalStudents;
      grandTotalPresent += presentCount;
      grandTotalLate += lateCount;

      return [
        course.name,
        totalStudents.toString(),
        presentCount.toString(),
        lateCount.toString(),
        absentCount.toString(),
        attendancePercent + '%'
      ];
    });

    y = Components.addPDFTable(doc, tableHeaders, tableRows, y);

    // Totals
    const overallRate = grandTotalStudents > 0
      ? ((grandTotalPresent / grandTotalStudents) * 100).toFixed(1)
      : '0.0';

    let finalY = Components.addPDFSection(doc, 'Totales Generales', y);
    finalY = Components.addPDFText(doc, `Total Alumnos: ${grandTotalStudents}`, finalY);
    finalY = Components.addPDFText(doc, `Total Presentes: ${grandTotalPresent}`, finalY);
    finalY = Components.addPDFText(doc, `Total Atrasos: ${grandTotalLate}`, finalY);
    Components.addPDFText(doc, `Tasa de Asistencia General: ${overallRate}%`, finalY);

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text('Control de Ingreso/Salida Escolar - Reporte Automático', 15, pageHeight - 10);
    doc.text(`Página 1 de 1`, doc.internal.pageSize.getWidth() - 30, pageHeight - 10);

    // Save
    const filename = `reporte_asistencia_${dateStart}_${dateEnd}.pdf`;
    Components.savePDF(doc, filename);
  };
};
