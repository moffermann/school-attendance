// Director Dashboard - Live events
Views.directorDashboard = function() {
  const app = document.getElementById('app');
  let stats = State.getTodayStats();
  let todayEvents = State.getTodayEvents();

  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Tablero en Vivo';

  let currentPage = 1;
  let filteredEvents = [...todayEvents];
  let filters = { course: '', type: '', search: '' };
  let autoRefreshInterval = null;
  let autoRefreshPaused = false;
  const AUTO_REFRESH_INTERVAL_MS = 30000; // 30 seconds

  // Clean up auto-refresh when navigating away
  Views.directorDashboard.cleanup = function() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  };

  // Toggle auto-refresh pause state
  Views.directorDashboard.toggleAutoRefresh = function() {
    autoRefreshPaused = !autoRefreshPaused;
    const indicator = document.getElementById('live-indicator');
    const toggleBtn = document.getElementById('auto-refresh-toggle');

    if (indicator) {
      indicator.style.opacity = autoRefreshPaused ? '0.5' : '1';
      indicator.querySelector('span:last-child').textContent = autoRefreshPaused ? 'Pausado' : 'En vivo';
    }
    if (toggleBtn) {
      toggleBtn.textContent = autoRefreshPaused ? '▶️ Reanudar' : '⏸️ Pausar';
    }

    Components.showToast(
      autoRefreshPaused ? 'Auto-refresh pausado' : 'Auto-refresh reanudado',
      'info'
    );
  };

  // Show/hide refresh loading indicator
  function setRefreshLoading(isLoading) {
    const indicator = document.getElementById('live-indicator');
    const refreshIcon = document.getElementById('refresh-loading-icon');

    if (isLoading) {
      if (indicator) indicator.style.opacity = '0.7';
      if (refreshIcon) refreshIcon.style.display = 'inline-block';
    } else {
      if (indicator) indicator.style.opacity = '1';
      if (refreshIcon) refreshIcon.style.display = 'none';
    }
  }

  // Function to refresh data without full re-render
  async function refreshData() {
    if (autoRefreshPaused) return;

    setRefreshLoading(true);

    try {
      // If API is authenticated, refresh bootstrap data to get latest events
      if (State.isApiAuthenticated() && typeof API !== 'undefined' && API.getBootstrap) {
        try {
          const bootstrap = await API.getBootstrap();
          if (bootstrap && bootstrap.attendance_events) {
            State.data.attendance_events = bootstrap.attendance_events;
            State.persist();
          }
        } catch (apiError) {
          // API call failed - continue with local data
          console.warn('API refresh failed, using local data:', apiError.message);
        }
      }

      // Update local references
      const newStats = State.getTodayStats();
      const newEvents = State.getTodayEvents();

      // Check if there are new events
      const hasNewEvents = newEvents.length !== todayEvents.length;

      // Update state
      stats = newStats;
      todayEvents = newEvents;

      // Re-apply filters to new events
      applyFiltersToEvents();

      // Update stats display without full re-render
      updateStatsDisplay();

      // Update table if there are new events
      if (hasNewEvents) {
        renderEventsTable();
      }

      // Always update timestamp to show refresh is working
      const lastUpdate = document.getElementById('last-update-time');
      if (lastUpdate) {
        lastUpdate.textContent = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    } finally {
      setRefreshLoading(false);
    }
  }

  // Apply current filters to events
  function applyFiltersToEvents() {
    filteredEvents = todayEvents.filter(event => {
      const student = State.getStudent(event.student_id);

      if (filters.course && student?.course_id !== parseInt(filters.course)) {
        return false;
      }
      if (filters.type && event.type !== filters.type) {
        return false;
      }
      if (filters.search && student && !student.full_name.toLowerCase().includes(filters.search)) {
        return false;
      }
      return true;
    });
  }

  // Update just the stats cards
  function updateStatsDisplay() {
    const statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
      statsGrid.innerHTML = `
        ${createEnhancedStatCard('Ingresos Hoy', stats.totalIn, '📥', 'success')}
        ${createEnhancedStatCard('Salidas Hoy', stats.totalOut, '📤', 'primary')}
        ${createEnhancedStatCard('Atrasos', stats.lateCount, '⏰', 'warning')}
        ${createEnhancedStatCard('Sin Ingreso', stats.noInCount, '❌', 'error')}
      `;
    }

    // Update no-ingress alert if needed
    const alertContainer = document.getElementById('no-ingress-alert');
    if (alertContainer) {
      alertContainer.style.display = stats.noInCount > 0 ? 'block' : 'none';
      const alertCount = alertContainer.querySelector('.alert-count');
      if (alertCount) {
        alertCount.textContent = `${stats.noInCount} alumno${stats.noInCount > 1 ? 's' : ''}`;
      }
    }
  }

  // Stat card con icono y color personalizado
  function createEnhancedStatCard(label, value, icon, colorClass) {
    const colors = {
      primary: { bg: 'var(--gradient-primary)', light: 'var(--color-primary-50)' },
      success: { bg: 'var(--gradient-success)', light: 'var(--color-success-light)' },
      warning: { bg: 'var(--gradient-warning)', light: 'var(--color-warning-light)' },
      error: { bg: 'var(--gradient-error)', light: 'var(--color-error-light)' }
    };
    const color = colors[colorClass] || colors.primary;

    return `
      <div class="stat-card" style="position: relative;">
        <div style="position: absolute; top: 1rem; right: 1rem; width: 48px; height: 48px; background: ${color.light}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
          ${icon}
        </div>
        <div class="stat-label">${Components.escapeHtml(label)}</div>
        <div class="stat-value">${Components.escapeHtml(String(value))}</div>
      </div>
    `;
  }

  function renderDashboard() {
    const courses = State.getCourses();
    const todayFormatted = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    const currentTime = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    content.innerHTML = `
      <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <p style="color: var(--color-gray-500); font-size: 0.9rem; text-transform: capitalize;">${todayFormatted}</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span style="font-size: 0.75rem; color: var(--color-gray-500);">
            Actualizado: <span id="last-update-time">${currentTime}</span>
          </span>
          <button id="auto-refresh-toggle" class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.toggleAutoRefresh()" title="Pausar/Reanudar actualización automática">
            ⏸️ Pausar
          </button>
          <span id="live-indicator" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--color-success-light); color: #065f46; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; transition: opacity 0.2s;">
            <span id="refresh-loading-icon" style="display: none; animation: spin 1s linear infinite;">🔄</span>
            <span style="width: 8px; height: 8px; background: var(--color-success); border-radius: 50%; animation: pulse 2s infinite;"></span>
            <span>En vivo</span>
          </span>
        </div>
      </div>

      <div id="stats-grid" class="cards-grid">
        ${createEnhancedStatCard('Ingresos Hoy', stats.totalIn, '📥', 'success')}
        ${createEnhancedStatCard('Salidas Hoy', stats.totalOut, '📤', 'primary')}
        ${createEnhancedStatCard('Atrasos', stats.lateCount, '⏰', 'warning')}
        ${createEnhancedStatCard('Sin Ingreso', stats.noInCount, '❌', 'error')}
      </div>

      <div id="no-ingress-alert" style="display: ${stats.noInCount > 0 ? 'block' : 'none'};">
      <!-- Alerta destacada de alumnos sin ingreso -->
      <div class="card" style="background: linear-gradient(135deg, var(--color-error-light) 0%, #fff 100%); border-left: 4px solid var(--color-error); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 2rem;">🚨</span>
            <div>
              <strong class="alert-count" style="color: var(--color-error-dark); font-size: 1.1rem;">${stats.noInCount} alumno${stats.noInCount > 1 ? 's' : ''}</strong>
              <span style="color: var(--color-error-dark); font-size: 1.1rem;"> sin registro de entrada</span>
              <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-gray-600);">
                Estos alumnos no han registrado ingreso hoy.
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.showNoIngressList()">
              👁️ Ver Lista
            </button>
            <button class="btn btn-primary btn-sm" onclick="Router.navigate('/director/reports?filter=no-ingress')">
              📊 Ir a Reportes
            </button>
          </div>
        </div>
      </div>
      </div>

      <div class="card">
        <div class="card-header flex justify-between items-center">
          <span style="font-size: 1.1rem;">Eventos de Hoy</span>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.exportCSV()">
              ${Components.icons.reports}
              Exportar CSV
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.showPhotos()">
              📷 Ver Fotos
            </button>
          </div>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label class="form-label">Curso</label>
            <select id="filter-course" class="form-select">
              <option value="">Todos los cursos</option>
              ${courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label class="form-label">Tipo de Evento</label>
            <select id="filter-type" class="form-select">
              <option value="">Todos</option>
              <option value="IN">Ingreso</option>
              <option value="OUT">Salida</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="form-label">Buscar alumno</label>
            <input type="text" id="filter-search" class="form-input" placeholder="Escriba un nombre...">
          </div>

          <div class="filter-group">
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-primary" onclick="Views.directorDashboard.applyFilters()">
              Aplicar Filtros
            </button>
          </div>
        </div>

        <div class="card-body">
          <div id="events-table"></div>
        </div>
      </div>

      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    renderEventsTable();
  }

  function renderEventsTable() {
    const tableDiv = document.getElementById('events-table');

    if (filteredEvents.length === 0) {
      tableDiv.innerHTML = Components.createEmptyState(
        'Sin eventos',
        filters.course || filters.type || filters.search
          ? 'No hay eventos que coincidan con los filtros seleccionados'
          : 'No hay eventos registrados hoy'
      );
      return;
    }

    const headers = ['Alumno', 'Curso', 'Tipo', 'Fuente', 'Puerta', 'Hora', 'Foto'];

    // Helper to create source chip with appropriate styling
    const createSourceChip = (source) => {
      const sourceConfig = {
        'BIOMETRIC': { label: '🔐 Biométrico', color: 'success' },
        'QR': { label: '📱 QR', color: 'info' },
        'NFC': { label: '📶 NFC', color: 'warning' },
        'MANUAL': { label: '✋ Manual', color: 'gray' }
      };
      const config = sourceConfig[source] || { label: source || 'Manual', color: 'gray' };
      return Components.createChip(config.label, config.color);
    };

    const rows = filteredEvents.map(event => {
      const student = State.getStudent(event.student_id);
      const course = State.getCourse(student?.course_id);
      const typeChip = event.type === 'IN'
        ? Components.createChip('Ingreso', 'success')
        : Components.createChip('Salida', 'info');
      // TDD-BUG5 fix: Check photo_url (presigned URL) with photo_ref fallback
      const photoIcon = (event.photo_url || event.photo_ref) ? '📷' : '-';
      const sourceChip = createSourceChip(event.source);

      return [
        student ? Components.escapeHtml(student.full_name) : '-',
        course ? Components.escapeHtml(course.name) : '-',
        typeChip,
        sourceChip,
        event.gate_id || '-',
        Components.formatTime(event.ts),
        photoIcon
      ];
    });

    tableDiv.innerHTML = Components.createTable(headers, rows, {
      perPage: 20,
      currentPage,
      onPageChange: 'Views.directorDashboard.changePage'
    });
  }

  // Public methods
  Views.directorDashboard.changePage = function(page) {
    currentPage = page;
    renderEventsTable();
  };

  Views.directorDashboard.applyFilters = function() {
    filters.course = document.getElementById('filter-course').value;
    filters.type = document.getElementById('filter-type').value;
    filters.search = document.getElementById('filter-search').value.toLowerCase();

    filteredEvents = todayEvents.filter(event => {
      const student = State.getStudent(event.student_id);

      if (filters.course && student.course_id !== parseInt(filters.course)) {
        return false;
      }

      if (filters.type && event.type !== filters.type) {
        return false;
      }

      if (filters.search && !student.full_name.toLowerCase().includes(filters.search)) {
        return false;
      }

      return true;
    });

    currentPage = 1;
    renderEventsTable();
    Components.showToast('Filtros aplicados', 'success');
  };

  Views.directorDashboard.exportCSV = function() {
    if (filteredEvents.length === 0) {
      Components.showToast('No hay eventos para exportar', 'warning');
      return;
    }

    // CSV helper to escape values properly
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    // Define columns
    const headers = ['Fecha', 'Hora', 'Alumno', 'Curso', 'Tipo', 'Puerta', 'Fuente'];

    // Build rows
    const rows = filteredEvents.map(event => {
      const student = State.getStudent(event.student_id);
      const course = student ? State.getCourse(student.course_id) : null;
      const date = event.ts.split('T')[0];
      const time = Components.formatTime(event.ts);
      const eventType = event.type === 'IN' ? 'Ingreso' : 'Salida';
      const source = event.source || 'MANUAL';

      return [
        date,
        time,
        student ? student.full_name : '-',
        course ? course.name : '-',
        eventType,
        event.gate_id || '-',
        source
      ].map(escapeCSV).join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\r\n');

    // Add BOM for Excel compatibility with UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `eventos_asistencia_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Components.showToast(`${filteredEvents.length} eventos exportados a CSV`, 'success');
  };

  Views.directorDashboard.showPhotos = function() {
    // TDD-BUG5 fix: Check photo_url (presigned URL) with photo_ref fallback
    const eventsWithPhotos = filteredEvents.filter(e => e.photo_url || e.photo_ref);

    if (eventsWithPhotos.length === 0) {
      Components.showModal('Fotos de Evidencia', `
        <p style="text-align: center; color: var(--color-gray-500);">No hay fotos disponibles para los eventos filtrados.</p>
      `, [
        { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
      ]);
      return;
    }

    // Build HTML with loading states and unique IDs
    const photosToShow = eventsWithPhotos.slice(0, 6);
    const photosHTML = photosToShow.map((e, idx) => {
      const student = State.getStudent(e.student_id);
      const studentName = student ? Components.escapeHtml(student.full_name) : 'Desconocido';
      return `
        <div class="card" style="margin-bottom: 1rem;">
          <div class="card-body">
            <strong>${studentName}</strong> - ${Components.formatTime(e.ts)}
            <div style="margin-top: 0.5rem; position: relative; min-height: 100px; display: flex; align-items: center; justify-content: center;">
              <img id="evidence-photo-${idx}"
                   src="assets/placeholder_photo.svg"
                   alt="Foto"
                   style="max-width: 200px; border-radius: 4px; opacity: 0.3; transition: opacity 0.3s;"
                   data-loading="true">
              <span id="evidence-loading-${idx}" style="position: absolute; font-size: 1.5rem;">⏳</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    Components.showModal('Fotos de Evidencia', `
      <div>${photosHTML}</div>
      ${eventsWithPhotos.length > 6 ? `<p style="text-align: center; color: var(--color-gray-500); margin-top: 1rem;">Mostrando 6 de ${eventsWithPhotos.length} fotos</p>` : ''}
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);

    // Load photos asynchronously after modal is rendered
    photosToShow.forEach((event, idx) => {
      const photoUrl = event.photo_url || event.photo_ref;
      if (!photoUrl) return;

      API.loadAuthenticatedImage(photoUrl).then(blobUrl => {
        const img = document.getElementById(`evidence-photo-${idx}`);
        const loading = document.getElementById(`evidence-loading-${idx}`);

        if (img && blobUrl) {
          img.src = blobUrl;
          img.style.opacity = '1';
          img.removeAttribute('data-loading');
        } else if (img) {
          // Failed to load - show error state
          img.src = 'assets/placeholder_photo.svg';
          img.style.opacity = '0.5';
        }
        if (loading) loading.remove();
      }).catch(() => {
        const img = document.getElementById(`evidence-photo-${idx}`);
        const loading = document.getElementById(`evidence-loading-${idx}`);
        if (loading) loading.textContent = '❌';
        if (img) img.style.opacity = '0.5';
      });
    });
  };

  // UX #10: Show list of students without entry today
  Views.directorDashboard.showNoIngressList = function() {
    const students = State.getStudents();
    const todayStr = new Date().toISOString().split('T')[0];

    // Get students who have NOT registered IN today
    const studentsWithIN = new Set(
      todayEvents
        .filter(e => e.type === 'IN')
        .map(e => e.student_id)
    );

    const noIngressStudents = students.filter(s => !studentsWithIN.has(s.id));

    const listHTML = noIngressStudents.length > 0
      ? `
        <table style="width: 100%;">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${noIngressStudents.slice(0, 20).map(s => {
              const course = State.getCourse(s.course_id);
              return `
                <tr>
                  <td>${Components.escapeHtml(s.full_name)}</td>
                  <td>${course ? Components.escapeHtml(course.name) : '-'}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="Components.showStudentProfile(${s.id}, { onBack: () => Views.directorDashboard.showNoIngressList() })">
                      Ver Perfil
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ${noIngressStudents.length > 20 ? `<p style="margin-top: 1rem; text-align: center; color: var(--color-gray-500);">... y ${noIngressStudents.length - 20} más. <a href="#" onclick="Router.navigate('/director/reports?filter=no-ingress'); return false;">Ver todos en Reportes</a></p>` : ''}
      `
      : '<p>Todos los alumnos han registrado entrada hoy. ✅</p>';

    Components.showModal(`🚨 Alumnos Sin Ingreso (${noIngressStudents.length})`, `
      <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--color-warning-light); border-radius: 8px; font-size: 0.9rem;">
        <strong>💡 Nota:</strong> Estos alumnos no tienen registro de entrada el día de hoy (${new Date().toLocaleDateString('es-CL')}).
      </div>
      ${listHTML}
    `, [
      { label: 'Ir a Reportes', action: () => Router.navigate('/director/reports?filter=no-ingress'), className: 'btn-primary' },
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  renderDashboard();

  // Start auto-refresh interval
  autoRefreshInterval = setInterval(refreshData, AUTO_REFRESH_INTERVAL_MS);

  // Store cleanup function for router to call when navigating away
  if (typeof Router !== 'undefined' && Router.onViewChange) {
    Router.onViewChange(Views.directorDashboard.cleanup);
  }
};
