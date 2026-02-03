// Director Advanced Metrics (Métricas Extendidas) - NEUVOX Design
// Chart.js loaded via CDN in index.html
// Uses centralized Components.directorSidebar() and Components.directorHeader()

Views.directorMetrics = function() {
  const app = document.getElementById('app');

  // Get data from State
  const courses = State.getCourses();
  const students = State.getStudents();
  const events = State.getAttendanceEvents();
  const user = State.getCurrentUser();
  const userName = user?.full_name || 'Director General';
  const currentPath = '/director/metrics';

  // State variables
  let riskStudentsPage = 1;
  const riskStudentsPerPage = 3;
  let chartDistribution = null;
  let chartTrend = null;

  // Calculate metrics
  const metrics = calculateMetrics(events, students, courses);

  // Render main layout using centralized components
  app.innerHTML = `
<div class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body transition-colors duration-300 antialiased h-screen flex overflow-hidden">
  ${Components.directorSidebar(currentPath)}

  <!-- Main Content -->
  <main class="flex-1 flex flex-col overflow-hidden relative bg-gray-50 dark:bg-background-dark">
    ${Components.directorHeader('Métricas Avanzadas', userName, { showDarkMode: true, onToggleDarkMode: 'Views.directorMetrics.toggleDarkMode()' })}

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 bg-[#f8fafc] dark:bg-slate-900">
          <!-- KPI Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <!-- Tasa de Asistencia -->
            <div class="kpi-card">
              <div class="kpi-card-border bg-indigo-500"></div>
              <p class="kpi-card-label">Tasa de Asistencia</p>
              <h3 class="kpi-card-value text-indigo-600 dark:text-indigo-400">${metrics.attendanceRate}%</h3>
            </div>
            <!-- Promedio Atrasos/Día -->
            <div class="kpi-card">
              <div class="kpi-card-border bg-blue-500"></div>
              <p class="kpi-card-label">Promedio Atrasos/Día</p>
              <h3 class="kpi-card-value text-blue-600 dark:text-blue-400">${metrics.avgLatePerDay.toFixed(1)}</h3>
            </div>
            <!-- Alumnos con Atrasos Frecuentes -->
            <div class="kpi-card">
              <div class="kpi-card-border bg-purple-500"></div>
              <p class="kpi-card-label">Alumnos con Atrasos Frecuentes</p>
              <h3 class="kpi-card-value text-purple-600 dark:text-purple-400">${metrics.frequentLateStudents}</h3>
            </div>
            <!-- Días Sin Incidentes -->
            <div class="kpi-card">
              <div class="kpi-card-border bg-emerald-500"></div>
              <p class="kpi-card-label">Días Sin Incidentes</p>
              <h3 class="kpi-card-value text-emerald-600 dark:text-emerald-400">${metrics.daysWithoutIncidents}</h3>
            </div>
          </div>

          <!-- Export Button -->
          <div class="flex justify-start">
            <button onclick="Views.directorMetrics.exportFullPDF()" class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
              <span class="material-icons-round text-[18px]">picture_as_pdf</span>
              Exportar Reporte Completo PDF
            </button>
          </div>

          <!-- Top 10 + Distribution Chart Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Top 10 Alumnos con Más Atrasos -->
            <div class="lg:col-span-5 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
              <div class="p-5 border-b border-gray-50 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-700/30">
                <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200">Top 10 Alumnos con Más Atrasos</h4>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left">
                  <thead class="bg-white dark:bg-slate-800">
                    <tr class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700">
                      <th class="px-5 py-3 w-12 text-center">#</th>
                      <th class="px-5 py-3">Alumno</th>
                      <th class="px-5 py-3">Curso</th>
                      <th class="px-5 py-3 text-center">Atrasos</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50 dark:divide-slate-700" id="top10-tbody">
                    ${renderTop10Rows(metrics.lateStudentsRanking, courses)}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Distribución de Atrasos por Hora -->
            <div class="lg:col-span-7 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <div class="p-5 border-b border-gray-50 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-700/30">
                <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200">Distribución de Atrasos por Hora</h4>
              </div>
              <div class="p-4 md:p-8 h-[300px]">
                <canvas id="distribucionChart"></canvas>
              </div>
            </div>
          </div>

          <!-- Análisis por Curso -->
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div class="p-5 border-b border-gray-50 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-700/30">
              <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200">Análisis por Curso</h4>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="bg-gray-50 dark:bg-slate-700/50 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    <th class="px-4 md:px-8 py-3">Curso</th>
                    <th class="px-4 md:px-8 py-3">Alumnos</th>
                    <th class="px-4 md:px-8 py-3">% Asistencia</th>
                    <th class="px-4 md:px-8 py-3">Atrasos Totales</th>
                    <th class="px-4 md:px-8 py-3">Prom. Atrasos/Alumno</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                  ${renderCourseAnalysisRows(metrics.courseMetrics)}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Tendencia de Asistencia -->
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div class="p-5 border-b border-gray-50 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-700/30">
              <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200">Tendencia de Asistencia (Últimos 30 días)</h4>
            </div>
            <div class="p-4 md:p-8 h-[350px]">
              <canvas id="tendenciaChart"></canvas>
            </div>
          </div>

          <!-- Alumnos en Riesgo -->
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div class="p-5 border-b border-gray-50 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-700/30 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div>
                <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200">Alumnos en Riesgo</h4>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">&gt;3 ausencias o &gt;5 atrasos en el mes</p>
              </div>
              <button onclick="Views.directorMetrics.exportRiskReport()" class="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700">Exportar</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="bg-gray-50 dark:bg-slate-700/50 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    <th class="px-4 md:px-8 py-3">Alumno</th>
                    <th class="px-4 md:px-8 py-3">Curso</th>
                    <th class="px-4 md:px-8 py-3">Ausencias</th>
                    <th class="px-4 md:px-8 py-3">Atrasos</th>
                    <th class="px-4 md:px-8 py-3 text-center">Riesgo</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700" id="risk-students-tbody">
                  ${renderRiskStudentsRows(metrics.riskStudents, courses, riskStudentsPage, riskStudentsPerPage)}
                </tbody>
              </table>
            </div>
            <!-- Pagination -->
            <div class="px-4 md:px-8 py-4 bg-gray-50/50 dark:bg-slate-700/30 flex items-center justify-between">
              <span id="risk-pagination-info" class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                Mostrando ${Math.min(riskStudentsPerPage, metrics.riskStudents.length)} de ${metrics.riskStudents.length} alumnos
              </span>
              <div class="flex gap-2">
                <button id="risk-prev-btn" onclick="Views.directorMetrics.prevRiskPage()" class="px-3 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-bold ${riskStudentsPage === 1 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}">Anterior</button>
                <button id="risk-next-btn" onclick="Views.directorMetrics.nextRiskPage()" class="px-3 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-bold ${riskStudentsPage * riskStudentsPerPage >= metrics.riskStudents.length ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}">Siguiente</button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <footer class="text-center text-[10px] text-gray-400 dark:text-gray-500 pt-8 pb-4">
            © 2026 NEUVOX. Todos los derechos reservados.
          </footer>
        </div>
      </main>
    </div>
  `;

  // Initialize charts after render
  setTimeout(() => initCharts(metrics), 100);

  // ===== HELPER FUNCTIONS =====

  function getDelayBadgeColor(count) {
    if (count >= 5) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (count >= 3) return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }

  function getAttendanceChipColor(rate) {
    const percentage = parseFloat(rate);
    if (percentage >= 90) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (percentage >= 70) return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
  }

  function renderTop10Rows(ranking, courses) {
    if (ranking.length === 0) {
      return `<tr><td colspan="4" class="px-5 py-8 text-center text-xs text-gray-400 dark:text-gray-500">Sin datos de atrasos</td></tr>`;
    }

    return ranking.map((item, idx) => {
      const course = courses.find(c => c.id === item.student.course_id);
      return `
        <tr class="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
          <td class="px-5 py-3 text-[11px] text-gray-400 dark:text-gray-500 text-center">${idx + 1}</td>
          <td class="px-5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200">${Components.escapeHtml(item.student.full_name)}</td>
          <td class="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">${course ? Components.escapeHtml(course.name) : '-'}</td>
          <td class="px-5 py-3 text-center">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${getDelayBadgeColor(item.count)} text-[10px] font-bold">${item.count}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderCourseAnalysisRows(courseMetrics) {
    return courseMetrics.map(m => `
      <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
        <td class="px-4 md:px-8 py-4 text-xs font-semibold text-slate-700 dark:text-slate-200">${Components.escapeHtml(m.course.name)}</td>
        <td class="px-4 md:px-8 py-4 text-xs text-slate-600 dark:text-slate-300">${m.students}</td>
        <td class="px-4 md:px-8 py-4">
          <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${getAttendanceChipColor(m.attendanceRate)}">${m.attendanceRate}%</span>
        </td>
        <td class="px-4 md:px-8 py-4 text-xs text-slate-600 dark:text-slate-300">${m.totalLate}</td>
        <td class="px-4 md:px-8 py-4 text-xs text-slate-600 dark:text-slate-300">${m.avgLate}</td>
      </tr>
    `).join('');
  }

  function renderRiskStudentsRows(riskStudents, courses, page, perPage) {
    if (riskStudents.length === 0) {
      return `<tr><td colspan="5" class="px-8 py-8 text-center text-xs text-gray-400 dark:text-gray-500">No hay alumnos en riesgo</td></tr>`;
    }

    const start = (page - 1) * perPage;
    const end = start + perPage;
    const pageStudents = riskStudents.slice(start, end);

    return pageStudents.map(item => {
      const course = courses.find(c => c.id === item.student.course_id);
      const riskLevel = (item.absences > 5 || item.lateCount > 8) ? 'Alto' : 'Medio';
      const riskClass = riskLevel === 'Alto'
        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';

      return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
          <td class="px-4 md:px-8 py-4 text-xs font-semibold text-slate-700 dark:text-slate-200">${Components.escapeHtml(item.student.full_name)}</td>
          <td class="px-4 md:px-8 py-4 text-xs text-slate-600 dark:text-slate-300">${course ? Components.escapeHtml(course.name) : '-'}</td>
          <td class="px-4 md:px-8 py-4 text-xs text-slate-600 dark:text-slate-300">${item.absences}</td>
          <td class="px-4 md:px-8 py-4 text-xs text-slate-600 dark:text-slate-300">${item.lateCount}</td>
          <td class="px-4 md:px-8 py-4 text-center">
            <span class="inline-flex px-2.5 py-1 rounded text-[10px] font-bold ${riskClass}">${riskLevel}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function initCharts(metrics) {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#6b7280';
    const gridColor = isDark ? '#334155' : '#e5e7eb';

    // Distribution Chart (Bar)
    const distCanvas = document.getElementById('distribucionChart');
    if (distCanvas) {
      const ctx = distCanvas.getContext('2d');
      const hours = ['08', '09', '10', '11', '12'];
      const hourData = hours.map(h => metrics.lateByHour[h] || 0);

      chartDistribution = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: hours.map(h => h + ':00'),
          datasets: [{
            data: hourData,
            backgroundColor: '#6366f1',
            borderRadius: 4,
            barThickness: 24
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: gridColor, drawBorder: false },
              ticks: { font: { size: 10 }, color: textColor, stepSize: 1 }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, color: textColor }
            }
          }
        }
      });
    }

    // Trend Chart (Line)
    const trendCanvas = document.getElementById('tendenciaChart');
    if (trendCanvas && metrics.dailyTrend.length > 0) {
      const ctx = trendCanvas.getContext('2d');

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
      gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

      // Sample every 3rd day for readability
      const sampledData = metrics.dailyTrend.filter((_, i) => i % 3 === 0 || i === metrics.dailyTrend.length - 1);
      const sampledLabels = metrics.trendLabels.filter((_, i) => i % 3 === 0 || i === metrics.trendLabels.length - 1);

      chartTrend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: sampledLabels,
          datasets: [{
            label: 'Asistencia',
            data: sampledData,
            borderColor: '#6366f1',
            borderWidth: 2,
            fill: true,
            backgroundColor: gradient,
            tension: 0.4,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#6366f1',
            pointBorderWidth: 2,
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: gridColor, drawBorder: false },
              ticks: { font: { size: 10 }, color: textColor }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, color: textColor }
            }
          }
        }
      });
    }
  }

  // ===== CALCULATION LOGIC (PRESERVED FROM ORIGINAL) =====

  function calculateMetrics(events, students, courses) {
    const schedules = State.getSchedules();
    const exceptions = State.getScheduleExceptions();

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

    const isLate = (eventTime, scheduleInTime) => {
      if (!eventTime || !scheduleInTime) return false;
      const [h, m] = scheduleInTime.split(':').map(Number);
      const graceMinutes = h * 60 + m + 10;
      const [eh, em] = eventTime.split(':').map(Number);
      const eventMinutes = eh * 60 + em;
      return eventMinutes > graceMinutes;
    };

    const getWeekday = (dateStr) => {
      const d = new Date(`${dateStr}T00:00:00`);
      const jsDay = d.getDay();
      return jsDay === 0 ? 6 : jsDay - 1;
    };

    const getException = (courseId, dateStr) => {
      const global = exceptions.find(e => e.scope === 'GLOBAL' && e.date === dateStr);
      if (global) return global;
      return exceptions.find(e => e.scope === 'COURSE' && e.course_id === courseId && e.date === dateStr);
    };

    const hasSchedule = (courseId, dateStr) => {
      const weekday = getWeekday(dateStr);
      const baseSchedule = schedules.some(s => s.course_id === courseId && s.weekday === weekday);
      if (!baseSchedule) return false;
      const exception = getException(courseId, dateStr);
      if (exception && !exception.in_time) return false;
      return true;
    };

    const getScheduleForDate = (courseId, dateStr) => {
      const weekday = getWeekday(dateStr);
      const baseSchedule = schedules.find(s => s.course_id === courseId && s.weekday === weekday);
      if (!baseSchedule) return null;
      const exception = getException(courseId, dateStr);
      if (exception) {
        if (!exception.in_time) return null;
        return { ...baseSchedule, in_time: exception.in_time, out_time: exception.out_time };
      }
      return baseSchedule;
    };

    const last30Days = getLast30Days();
    const inEvents = events.filter(e => e.type === 'IN');
    const last30DaysSet = new Set(last30Days);
    const recentInEvents = inEvents.filter(e => last30DaysSet.has(e.ts.split('T')[0]));

    let totalPossibleDays = 0;
    let totalPresentDays = 0;

    students.forEach(student => {
      last30Days.forEach(date => {
        if (hasSchedule(student.course_id, date)) {
          totalPossibleDays++;
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

    const schoolDays = last30Days.filter(date =>
      courses.some(c => hasSchedule(c.id, date))
    );
    const lateDays = new Set(lateEvents.map(e => e.ts.split('T')[0]));
    const avgLatePerDay = schoolDays.length > 0 ? lateEvents.length / schoolDays.length : 0;

    const lateByStudent = {};
    lateEvents.forEach(e => {
      if (!lateByStudent[e.student_id]) lateByStudent[e.student_id] = new Set();
      lateByStudent[e.student_id].add(e.ts.split('T')[0]);
    });

    const lateStudentsRanking = Object.entries(lateByStudent)
      .map(([studentId, dates]) => ({
        student: students.find(s => s.id === parseInt(studentId, 10)),
        count: dates.size
      }))
      .filter(x => x.student)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const frequentLateStudents = Object.values(lateByStudent).filter(dates => dates.size > 3).length;
    const daysWithLate = lateDays.size;
    const daysWithoutIncidents = Math.max(0, schoolDays.length - daysWithLate);

    const lateByHour = {};
    lateEvents.forEach(e => {
      const hour = e.ts.split('T')[1].substring(0, 2);
      lateByHour[hour] = (lateByHour[hour] || 0) + 1;
    });

    const courseMetrics = courses.map(course => {
      const courseStudents = students.filter(s => s.course_id === course.id);
      const courseScheduleDays = last30Days.filter(date => hasSchedule(course.id, date));
      const courseScheduleDaysSet = new Set(courseScheduleDays);

      const courseEvents = recentInEvents.filter(e => {
        const eventDate = e.ts.split('T')[0];
        return courseStudents.some(s => s.id === e.student_id) &&
               courseScheduleDaysSet.has(eventDate);
      });

      const firstInByStudentDay = {};
      courseEvents.forEach(e => {
        const date = e.ts.split('T')[0];
        const time = e.ts.split('T')[1].substring(0, 5);
        const key = `${e.student_id}-${date}`;
        if (!firstInByStudentDay[key] || time < firstInByStudentDay[key]) {
          firstInByStudentDay[key] = time;
        }
      });

      const studentDaysPresent = Object.keys(firstInByStudentDay).length;

      let lateStudentDays = 0;
      Object.entries(firstInByStudentDay).forEach(([key, firstInTime]) => {
        const date = key.split('-').slice(1).join('-');
        const schedule = getScheduleForDate(course.id, date);
        if (schedule && isLate(firstInTime, schedule.in_time)) {
          lateStudentDays++;
        }
      });

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

    const riskStudents = students.map(student => {
      const studentScheduleDays = last30Days.filter(date => hasSchedule(student.course_id, date));
      const studentEvents = recentInEvents.filter(e => e.student_id === student.id);
      const studentPresentDays = new Set(studentEvents.map(e => e.ts.split('T')[0])).size;
      const absences = Math.max(0, studentScheduleDays.length - studentPresentDays);

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

    const dailyTrend = last30Days.map(date => {
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

  // ===== EVENT HANDLERS =====

  Views.directorMetrics.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
    // Redraw charts with new colors
    if (chartDistribution) chartDistribution.destroy();
    if (chartTrend) chartTrend.destroy();
    initCharts(metrics);
  };

  // toggleMobileSidebar now uses centralized Components.toggleDirectorSidebar()

  Views.directorMetrics.prevRiskPage = function() {
    if (riskStudentsPage > 1) {
      riskStudentsPage--;
      updateRiskTable();
    }
  };

  Views.directorMetrics.nextRiskPage = function() {
    const totalPages = Math.ceil(metrics.riskStudents.length / riskStudentsPerPage);
    if (riskStudentsPage < totalPages) {
      riskStudentsPage++;
      updateRiskTable();
    }
  };

  function updateRiskTable() {
    const tbody = document.getElementById('risk-students-tbody');
    const paginationInfo = document.getElementById('risk-pagination-info');
    const prevBtn = document.getElementById('risk-prev-btn');
    const nextBtn = document.getElementById('risk-next-btn');
    const totalPages = Math.ceil(metrics.riskStudents.length / riskStudentsPerPage);

    // Update table body
    if (tbody) {
      tbody.innerHTML = renderRiskStudentsRows(metrics.riskStudents, courses, riskStudentsPage, riskStudentsPerPage);
    }

    // Update pagination info
    if (paginationInfo) {
      const start = (riskStudentsPage - 1) * riskStudentsPerPage + 1;
      const end = Math.min(riskStudentsPage * riskStudentsPerPage, metrics.riskStudents.length);
      paginationInfo.textContent = `Mostrando ${start}-${end} de ${metrics.riskStudents.length} alumnos`;
    }

    // Update prev button state
    if (prevBtn) {
      if (riskStudentsPage === 1) {
        prevBtn.className = 'px-3 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-bold text-gray-400 dark:text-gray-600 cursor-not-allowed';
      } else {
        prevBtn.className = 'px-3 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30';
      }
    }

    // Update next button state
    if (nextBtn) {
      if (riskStudentsPage >= totalPages) {
        nextBtn.className = 'px-3 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-bold text-gray-400 dark:text-gray-600 cursor-not-allowed';
      } else {
        nextBtn.className = 'px-3 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30';
      }
    }
  }

  Views.directorMetrics.exportRiskReport = function() {
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
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = `alumnos_riesgo_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

    Components.showToast(`${metrics.riskStudents.length} alumnos exportados`, 'success');
  };

  Views.directorMetrics.exportFullPDF = function() {
    const doc = Components.generatePDF('Reporte de Métricas Avanzadas');
    if (!doc) return;

    let y = 40;

    y = Components.addPDFSection(doc, 'Indicadores Clave (KPIs)', y);
    y = Components.addPDFText(doc, `Tasa de Asistencia General: ${metrics.attendanceRate}%`, y);
    y = Components.addPDFText(doc, `Promedio de Atrasos por Día: ${metrics.avgLatePerDay.toFixed(1)}`, y);
    y = Components.addPDFText(doc, `Alumnos con Atrasos Frecuentes (>3): ${metrics.frequentLateStudents}`, y);
    y = Components.addPDFText(doc, `Días Sin Incidentes: ${metrics.daysWithoutIncidents}`, y);
    y += 5;

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

    if (metrics.riskStudents.length > 0) {
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

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text('Control de Ingreso/Salida Escolar - Métricas Avanzadas', 15, pageHeight - 10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() - 30, pageHeight - 10);
    }

    const filename = `metricas_${new Date().toISOString().split('T')[0]}.pdf`;
    Components.savePDF(doc, filename);
  };

  // Initialize dark mode from localStorage
  if (localStorage.getItem('darkMode') === 'true') {
    document.documentElement.classList.add('dark');
  }
};
