// Director Reports - Diseño Aprobado NEUVOX (Tailwind)
// NO MODIFICAR CLASES TAILWIND - Copiadas exactamente del diseño aprobado

Views.directorReports = function() {
  const app = document.getElementById('app');
  const courses = State.getCourses();
  const user = State.getCurrentUser();
  const userName = user?.full_name || 'Director';
  const currentPath = window.location.hash.slice(1) || '/director/reports';

  // Variables de estado
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let reportData = []; // Datos calculados del reporte
  let trendData = {}; // Datos para gráfico de tendencia

  // Helper: check if nav item is active
  const isActive = (path) => currentPath === path;
  const navItemClass = (path) => isActive(path)
    ? 'flex items-center px-6 py-3 bg-indigo-800/50 text-white border-l-4 border-indigo-500 group transition-colors'
    : 'flex items-center px-6 py-3 hover:bg-white/5 hover:text-white group transition-colors border-l-4 border-transparent';
  const iconClass = (path) => isActive(path)
    ? 'material-icons-round mr-3'
    : 'material-icons-round mr-3 text-gray-400 group-hover:text-white transition-colors';

  // Navigation items - del diseño aprobado
  const navItems = [
    { path: '/director/dashboard', icon: 'dashboard', label: 'Tablero' },
    { path: '/director/reports', icon: 'analytics', label: 'Reportes' },
    { path: '/director/metrics', icon: 'bar_chart', label: 'Métricas' },
    { path: '/director/schedules', icon: 'schedule', label: 'Horarios' },
    { path: '/director/exceptions', icon: 'event_busy', label: 'Excepciones' },
    { path: '/director/broadcast', icon: 'campaign', label: 'Comunicados' },
    { path: '/director/devices', icon: 'devices', label: 'Dispositivos' },
    { path: '/director/students', icon: 'school', label: 'Alumnos' },
    { path: '/director/guardians', icon: 'family_restroom', label: 'Apoderados' },
    { path: '/director/teachers', icon: 'badge', label: 'Profesores' },
    { path: '/director/courses', icon: 'class', label: 'Cursos' },
    { path: '/director/absences', icon: 'person_off', label: 'Ausencias' },
    { path: '/director/notifications', icon: 'notifications', label: 'Notificaciones' },
    { path: '/director/biometric', icon: 'fingerprint', label: 'Biometría' },
  ];

  // ========================================
  // RENDER PRINCIPAL - HTML del diseño aprobado
  // ========================================
  app.innerHTML = `
<div class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body transition-colors duration-300 antialiased h-screen flex overflow-hidden">
  <!-- Mobile Backdrop -->
  <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden" onclick="Views.directorReports.toggleMobileSidebar()"></div>

  <!-- Sidebar - EXACTO del diseño aprobado -->
  <aside class="w-64 bg-sidebar-dark text-gray-300 flex-shrink-0 flex-col transition-all duration-300 mobile-hidden border-r border-indigo-900/50 shadow-2xl z-50">
    <div class="h-20 flex items-center justify-between px-6 border-b border-indigo-900/50">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
          <div class="w-4 h-4 bg-indigo-900 rounded-full"></div>
        </div>
        <h1 class="text-xl font-bold tracking-tight text-white">NEUVOX</h1>
      </div>
      <button class="desktop-hidden text-gray-400 hover:text-white p-1" onclick="Views.directorReports.toggleMobileSidebar()">
        <span class="material-icons-round">close</span>
      </button>
    </div>
    <nav class="flex-1 overflow-y-auto py-6 space-y-1">
      ${navItems.map(item => `
        <a class="${navItemClass(item.path)}" href="#${item.path}">
          <span class="${iconClass(item.path)}">${item.icon}</span>
          <span class="font-medium text-sm">${item.label}</span>
        </a>
      `).join('')}
    </nav>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 flex flex-col overflow-hidden relative bg-gray-50 dark:bg-background-dark">
    <!-- Header - Estandarizado con Dashboard -->
    <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
      <div class="flex items-center gap-4">
        <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors" onclick="Views.directorReports.toggleMobileSidebar()">
          <span class="material-icons-round text-2xl">menu</span>
        </button>
        <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Reportes Académicos</h2>
      </div>
      <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
        <div class="flex items-center gap-2 md:gap-3">
          <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark" onclick="Views.directorReports.toggleDarkMode()">
            <span class="material-icons-round" id="dark-mode-icon">dark_mode</span>
          </button>
          <div class="flex items-center gap-2 cursor-pointer">
            <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
              ${userName.charAt(0).toUpperCase()}
            </div>
            <div class="text-right mobile-hidden">
              <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${Components.escapeHtml(userName)}</p>
            </div>
          </div>
          <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600" href="#" onclick="event.preventDefault(); State.logout(); Router.navigate('/login')">
            <span class="material-icons-round text-lg">logout</span>
            <span class="mobile-hidden">Salir</span>
          </a>
        </div>
      </div>
    </header>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 scroll-smooth">
      <!-- Filtros de Reporte - EXACTO del diseño aprobado -->
      <section class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
        <div class="p-6">
          <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">Filtros de Reporte</h3>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div class="space-y-2">
              <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400">Fecha Inicio</label>
              <div class="relative">
                <input id="date-start" type="date" value="${weekAgo}" class="w-full pl-3 pr-4 py-2.5 text-sm border-gray-200 dark:border-gray-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50/50 dark:bg-white/5 text-gray-700 dark:text-gray-200">
              </div>
            </div>
            <div class="space-y-2">
              <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400">Fecha Fin</label>
              <div class="relative">
                <input id="date-end" type="date" value="${today}" class="w-full pl-3 pr-4 py-2.5 text-sm border-gray-200 dark:border-gray-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50/50 dark:bg-white/5 text-gray-700 dark:text-gray-200">
              </div>
            </div>
            <div class="space-y-2">
              <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400">Curso</label>
              <div class="relative">
                <select id="course-select" class="w-full pl-3 pr-10 py-2.5 text-sm border-gray-200 dark:border-gray-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50/50 dark:bg-white/5 text-gray-700 dark:text-gray-200 appearance-none">
                  <option value="">Todos</option>
                  ${courses.map(c => `<option value="${c.id}">${Components.escapeHtml(c.name)}</option>`).join('')}
                </select>
                <span class="absolute right-3 top-2.5 pointer-events-none text-gray-400 material-icons-round text-lg">expand_more</span>
              </div>
            </div>
            <div class="flex gap-3">
              <button onclick="Views.directorReports.generateReport()" class="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2">
                <span class="material-icons-round text-sm">settings_suggest</span>
                Generar Reporte
              </button>
              <button onclick="Views.directorReports.exportPDF()" class="flex-1 py-2.5 bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                <span class="material-icons-round text-sm">picture_as_pdf</span>
                Exportar PDF
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Contenedor de Resultados -->
      <div id="report-results"></div>

      <!-- Footer - del diseño aprobado -->
      <footer class="text-center text-xs text-muted-light dark:text-muted-dark pt-8 pb-4">
        © 2024 NEUVOX. Todos los derechos reservados.
      </footer>
    </div>
  </main>
</div>
  `;

  // ========================================
  // FUNCIONES DE RENDERIZADO
  // ========================================

  function formatDateDisplay(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function renderSummaryTable(data, startDate, endDate) {
    if (data.length === 0) {
      return `
        <section class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
          <div class="p-8 text-center text-gray-500 dark:text-gray-400">
            <span class="material-icons-round text-4xl mb-2 block">assessment</span>
            <p>No hay datos para el período seleccionado</p>
          </div>
        </section>
      `;
    }

    const rows = data.map(row => {
      // Determinar color del progress bar según % asistencia
      const percent = parseFloat(row.attendancePercent);
      let progressColor = 'bg-rose-500';
      if (percent >= 80) progressColor = 'bg-emerald-500';
      else if (percent >= 50) progressColor = 'bg-rose-400';

      return `
        <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
          <td class="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 transition-colors">${Components.escapeHtml(row.courseName)}</td>
          <td class="px-6 py-4 text-center text-gray-600 dark:text-gray-300">${row.totalStudents}</td>
          <td class="px-6 py-4 text-center font-medium text-emerald-600">${row.presentCount}</td>
          <td class="px-6 py-4 text-center font-medium text-amber-600">${row.lateCount}</td>
          <td class="px-6 py-4 text-center font-medium text-rose-600">${row.absentCount}</td>
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full ${progressColor} rounded-full" style="width: ${row.attendancePercent}%"></div>
              </div>
              <span class="text-xs font-bold text-gray-700 dark:text-gray-300 w-10 text-right">${row.attendancePercent}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <section class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
        <div class="p-6 border-b border-gray-100 dark:border-border-dark flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <span class="material-icons-round text-indigo-600 dark:text-indigo-400">assessment</span>
            </div>
            <h3 class="text-lg font-bold text-gray-800 dark:text-text-dark">Resumen de Asistencia por Curso</h3>
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 px-4 py-1.5 rounded-full font-medium">
            Periodo: ${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-50/50 dark:bg-white/5 border-y border-gray-100 dark:border-border-dark">
                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">CURSO</th>
                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">TOTAL ALUMNOS</th>
                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">PRESENTES</th>
                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">ATRASOS</th>
                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">AUSENTES</th>
                <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest w-48">% ASISTENCIA</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-border-dark text-sm bg-white dark:bg-card-dark">
              ${rows}
            </tbody>
          </table>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 dark:border-border-dark flex items-center justify-between">
          <span class="text-xs text-gray-500 dark:text-gray-400">Mostrando datos para ${data.length} curso${data.length !== 1 ? 's' : ''} seleccionado${data.length !== 1 ? 's' : ''}</span>
          <div class="flex gap-2">
            <button class="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <span class="material-icons-round text-sm leading-none">chevron_left</span>
            </button>
            <button class="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <span class="material-icons-round text-sm leading-none">chevron_right</span>
            </button>
          </div>
        </div>
      </section>
    `;
  }

  function renderBarChart(data) {
    if (data.length === 0) return '';

    // Calcular altura máxima para escalar
    const maxStudents = Math.max(...data.map(d => Math.max(d.totalStudents, d.presentCount + d.absentCount)));
    const maxHeight = maxStudents > 0 ? maxStudents : 20;

    const bars = data.map(row => {
      const presentHeight = maxHeight > 0 ? (row.presentCount / maxHeight) * 100 : 0;
      const absentHeight = maxHeight > 0 ? (row.absentCount / maxHeight) * 100 : 0;

      return `
        <div class="bar-group">
          <div class="bar-present" style="height: ${presentHeight}%;"></div>
          <div class="bar-absent" style="height: ${absentHeight}%;"></div>
          <div class="absolute -bottom-8 left-0 right-0 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">${Components.escapeHtml(row.courseName.length > 12 ? row.courseName.substring(0, 12) + '...' : row.courseName)}</div>
        </div>
      `;
    }).join('');

    // Generar escala Y
    const yLabels = [];
    const step = Math.ceil(maxHeight / 4);
    for (let i = 4; i >= 0; i--) {
      yLabels.push(i * step);
    }

    return `
      <section class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden p-6">
        <div class="flex justify-between items-center mb-10">
          <h3 class="text-base font-bold text-gray-800 dark:text-text-dark">Gráfico de Asistencia por Curso</h3>
          <div class="flex items-center gap-6">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-sm bg-emerald-500"></div>
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">Presentes</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-sm bg-rose-500"></div>
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">Ausentes</span>
            </div>
          </div>
        </div>
        <div class="bar-chart-grid mt-4">
          <div class="absolute left-0 h-full flex flex-col justify-between text-[10px] text-gray-400 -translate-x-2">
            ${yLabels.map(v => `<span>${v}</span>`).join('')}
          </div>
          ${bars}
        </div>
        <div class="h-8"></div>
      </section>
    `;
  }

  function renderLineChart(trendDataObj, dates) {
    if (dates.length === 0) return '';

    // Convertir datos de tendencia a array de conteos
    const counts = dates.map(d => trendDataObj[d] ? trendDataObj[d].size : 0);
    const maxCount = Math.max(...counts, 1);

    // Generar puntos SVG
    const width = 1000;
    const height = 240;
    const padding = 0;

    const points = counts.map((count, i) => {
      const x = dates.length > 1 ? (i / (dates.length - 1)) * width : width / 2;
      const y = height - (count / maxCount) * (height - 20);
      return { x, y };
    });

    // Generar path para la línea
    let pathD = points.map((p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      // Curva suave usando Q (quadratic bezier)
      const prev = points[i - 1];
      const cpX = (prev.x + p.x) / 2;
      return `Q${cpX},${prev.y} ${cpX},${(prev.y + p.y) / 2} T${p.x},${p.y}`;
    }).join(' ');

    // Simplificar a líneas rectas para evitar problemas con curvas
    pathD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');

    // Path para el área de relleno
    const areaPath = pathD + ` L${width},${height} L0,${height} Z`;

    // Círculos en los puntos de datos
    const circles = points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#4f46e5" stroke="white" stroke-width="2"/>`).join('');

    // Etiquetas del eje X (fechas)
    const xLabels = dates.map(d => {
      const dt = new Date(`${d}T00:00:00`);
      return `${dt.getDate()}/${dt.getMonth() + 1}`;
    });

    // Escala Y
    const yLabels = [];
    const step = Math.ceil(maxCount / 7);
    for (let i = 7; i >= 0; i--) {
      yLabels.push(i * step);
    }

    return `
      <section class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden p-6">
        <h3 class="text-base font-bold text-gray-800 dark:text-text-dark mb-10">Tendencia de Asistencia</h3>
        <div class="relative h-[280px] w-full mt-4 flex">
          <div class="absolute left-0 top-0 h-[240px] flex flex-col justify-center items-center -rotate-90 origin-left -translate-x-6 translate-y-full">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Alumnos presentes</span>
          </div>
          <div class="flex-1 ml-10">
            <div class="relative h-[240px] border-b border-gray-100 dark:border-border-dark w-full">
              <!-- Grid lines -->
              <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                ${yLabels.map(() => '<div class="w-full border-t border-gray-100 dark:border-border-dark/50"></div>').join('')}
              </div>
              <!-- SVG Chart -->
              <svg class="absolute inset-0 w-full h-full" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.2"/>
                    <stop offset="100%" stop-color="#4f46e5" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                <path d="${areaPath}" fill="url(#chartGradient)"/>
                <path d="${pathD}" fill="none" stroke="#4f46e5" stroke-width="3" stroke-linecap="round"/>
                ${circles}
              </svg>
              <!-- Y Axis Labels -->
              <div class="absolute -left-6 top-0 h-full flex flex-col justify-between text-[10px] text-gray-400">
                ${yLabels.map(v => `<span>${v}</span>`).join('')}
              </div>
            </div>
            <!-- X Axis Labels -->
            <div class="flex justify-between mt-4 text-[10px] font-medium text-gray-500 dark:text-gray-400 px-0">
              ${xLabels.map(label => `<span>${label}</span>`).join('')}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // ========================================
  // LÓGICA DE CÁLCULO (conservada del original)
  // ========================================

  function calculateReportData(startDate, endDate, courseId) {
    const exceptions = State.getScheduleExceptions();
    const selectedCourses = courseId ? [State.getCourse(parseInt(courseId))] : courses;

    // Helper: Get all dates in range (con fix de timezone)
    const getDatesInRange = (start, end) => {
      const dates = [];
      const current = new Date(`${start}T00:00:00`);
      const endDt = new Date(`${end}T00:00:00`);
      while (current <= endDt) {
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
      const [h, m] = scheduleInTime.split(':').map(Number);
      const graceMinutes = h * 60 + m + 10;
      const [eh, em] = firstInTime.split(':').map(Number);
      const eventMinutes = eh * 60 + em;
      return eventMinutes > graceMinutes;
    };

    // Helper: Get exception for a date and course
    const getException = (courseId, dateStr) => {
      const global = exceptions.find(e => e.scope === 'GLOBAL' && e.date === dateStr);
      if (global) return global;
      return exceptions.find(e => e.scope === 'COURSE' && e.course_id === courseId && e.date === dateStr);
    };

    // Helper: Get schedule for course on a date
    const getScheduleForDate = (courseId, schedules, dateStr) => {
      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      const weekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const baseSchedule = schedules.find(s => s.weekday === weekday);
      if (!baseSchedule) return null;

      const exception = getException(courseId, dateStr);
      if (exception) {
        if (!exception.in_time) return null;
        return { ...baseSchedule, in_time: exception.in_time, out_time: exception.out_time };
      }
      return baseSchedule;
    };

    const allDates = getDatesInRange(startDate, endDate);
    trendData = {}; // Reset trend data

    reportData = selectedCourses.map(course => {
      const courseStudents = State.getStudentsByCourse(course.id);
      const schedules = State.getSchedules(course.id);

      const events = State.getAttendanceEvents({
        courseId: course.id,
        startDate: startDate,
        endDate: endDate
      });
      const inEvents = events.filter(e => e.type === 'IN');

      const studentsPresent = new Set();
      const studentsLate = new Set();

      allDates.forEach(date => {
        const schedule = getScheduleForDate(course.id, schedules, date);
        if (!schedule) return;

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

        // Track trend data
        if (!trendData[date]) trendData[date] = new Set();
        Object.keys(firstInByStudent).forEach(sid => trendData[date].add(parseInt(sid)));
      });

      const presentCount = studentsPresent.size;
      const lateCount = studentsLate.size;
      const totalStudents = courseStudents.length;
      const absentCount = Math.max(0, totalStudents - presentCount);
      const attendancePercent = totalStudents > 0
        ? ((presentCount / totalStudents) * 100).toFixed(1)
        : '0.0';

      return {
        courseName: course.name,
        totalStudents,
        presentCount,
        lateCount,
        absentCount,
        attendancePercent
      };
    });

    return { reportData, trendData, allDates };
  }

  // ========================================
  // DARK MODE & MOBILE SIDEBAR
  // ========================================

  Views.directorReports.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', isDark);
    const icon = document.getElementById('dark-mode-icon');
    if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
  };

  Views.directorReports.toggleMobileSidebar = function() {
    const sidebar = document.querySelector('aside');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      const isHidden = sidebar.classList.contains('mobile-hidden');
      if (isHidden) {
        sidebar.classList.remove('mobile-hidden');
        sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-50', 'flex');
        if (backdrop) backdrop.classList.remove('hidden');
      } else {
        sidebar.classList.add('mobile-hidden');
        sidebar.classList.remove('fixed', 'inset-y-0', 'left-0', 'z-50', 'flex');
        if (backdrop) backdrop.classList.add('hidden');
      }
    }
  };

  // Initialize dark mode from localStorage
  const savedDarkMode = localStorage.getItem('darkMode') === 'true';
  if (savedDarkMode) {
    document.documentElement.classList.add('dark');
  }
  setTimeout(() => {
    const icon = document.getElementById('dark-mode-icon');
    if (icon) icon.textContent = savedDarkMode ? 'light_mode' : 'dark_mode';
  }, 0);

  // ========================================
  // PUBLIC METHODS
  // ========================================

  Views.directorReports.generateReport = function() {
    const startDate = document.getElementById('date-start').value;
    const endDate = document.getElementById('date-end').value;
    const courseId = document.getElementById('course-select').value;

    const { reportData: data, trendData: trend, allDates } = calculateReportData(startDate, endDate, courseId);

    const resultsDiv = document.getElementById('report-results');
    resultsDiv.innerHTML = `
      ${renderSummaryTable(data, startDate, endDate)}
      <div class="grid grid-cols-1 gap-8 mt-8">
        ${renderBarChart(data)}
        ${renderLineChart(trend, allDates)}
      </div>
    `;

    Components.showToast('Reporte generado', 'success');
  };

  Views.directorReports.exportPDF = function() {
    const courseId = document.getElementById('course-select').value;
    const dateStart = document.getElementById('date-start').value;
    const dateEnd = document.getElementById('date-end').value;
    const selectedCourses = courseId ? [State.getCourse(parseInt(courseId))] : courses;
    const exceptions = State.getScheduleExceptions();

    const doc = Components.generatePDF('Reporte de Asistencia Escolar');
    if (!doc) return;

    // Helper functions
    const getDatesInRange = (start, end) => {
      const dates = [];
      const current = new Date(`${start}T00:00:00`);
      const endDt = new Date(`${end}T00:00:00`);
      while (current <= endDt) {
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

    const getException = (courseId, dateStr) => {
      const global = exceptions.find(e => e.scope === 'GLOBAL' && e.date === dateStr);
      if (global) return global;
      return exceptions.find(e => e.scope === 'COURSE' && e.course_id === courseId && e.date === dateStr);
    };

    const getScheduleForDate = (courseId, schedules, dateStr) => {
      const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
      const weekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const baseSchedule = schedules.find(s => s.weekday === weekday);
      if (!baseSchedule) return null;

      const exception = getException(courseId, dateStr);
      if (exception) {
        if (!exception.in_time) return null;
        return { ...baseSchedule, in_time: exception.in_time, out_time: exception.out_time };
      }
      return baseSchedule;
    };

    const allDates = getDatesInRange(dateStart, dateEnd);

    let y = 40;
    y = Components.addPDFText(doc, `Período: ${Components.formatDate(dateStart)} - ${Components.formatDate(dateEnd)}`, y);
    y += 5;
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
        const schedule = getScheduleForDate(course.id, schedules, date);
        if (!schedule) return;

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

    const overallRate = grandTotalStudents > 0
      ? ((grandTotalPresent / grandTotalStudents) * 100).toFixed(1)
      : '0.0';

    let finalY = Components.addPDFSection(doc, 'Totales Generales', y);
    finalY = Components.addPDFText(doc, `Total Alumnos: ${grandTotalStudents}`, finalY);
    finalY = Components.addPDFText(doc, `Total Presentes: ${grandTotalPresent}`, finalY);
    finalY = Components.addPDFText(doc, `Total Atrasos: ${grandTotalLate}`, finalY);
    Components.addPDFText(doc, `Tasa de Asistencia General: ${overallRate}%`, finalY);

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text('Control de Ingreso/Salida Escolar - Reporte Automático', 15, pageHeight - 10);
    doc.text(`Página 1 de 1`, doc.internal.pageSize.getWidth() - 30, pageHeight - 10);

    const filename = `reporte_asistencia_${dateStart}_${dateEnd}.pdf`;
    Components.savePDF(doc, filename);
  };

  // ========================================
  // AUTO-GENERATE INITIAL REPORT
  // ========================================
  setTimeout(() => Views.directorReports.generateReport(), 100);
};
