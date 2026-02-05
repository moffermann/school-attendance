// Director Devices Management - Redesign Tailwind (Diseño Aprobado)
// Uses centralized Components for sidebar and navigation
Views.directorDevices = async function() {
  const app = document.getElementById('app');

  // State
  let devices = [];
  let isLoading = true;
  let currentPage = 1;
  const itemsPerPage = 10;

  // Flags to prevent double-click
  let isSaving = false;
  let isDeleting = false;

  // Current path for sidebar highlighting
  const currentPath = '/director/devices';

  // Get user info
  const user = State.getCurrentUser();
  const userName = user?.full_name || 'Director';

  // Helper: Get battery badge classes
  const getBatteryBadgeClasses = (batteryPct) => {
    if (batteryPct >= 50) {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
  };

  // Helper: Get status badge classes (SIN dot indicator)
  const getStatusBadgeClasses = (isOnline) => {
    if (isOnline) {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
  };

  // Helper: Calculate KPIs
  const calculateKPIs = (deviceList) => {
    const online = deviceList.filter(d => d.online).length;
    const offline = deviceList.filter(d => !d.online).length;
    const lowBattery = deviceList.filter(d => d.battery_pct < 50).length;
    return { online, offline, lowBattery };
  };

  // Toggle dark mode
  Views.directorDevices.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
  };

  // Render full layout
  function render() {
    const isDark = document.documentElement.classList.contains('dark');
    const kpis = calculateKPIs(devices);

    // Pagination
    const totalPages = Math.ceil(devices.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, devices.length);
    const paginatedDevices = devices.slice(startIndex, endIndex);

    app.innerHTML = `
      <div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
        <!-- Centralized Sidebar -->
        ${Components.directorSidebar(currentPath)}

        <!-- Main Content -->
        <main class="flex-1 flex flex-col overflow-hidden relative">
          <!-- Header -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-4 md:px-8 z-10 shadow-sm">
            <div class="flex items-center gap-4">
              <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors" onclick="Components.toggleDirectorSidebar()">
                <span class="material-icons-round text-2xl">menu</span>
              </button>
              <h2 class="text-xl font-bold text-slate-800 dark:text-white">Puertas y Dispositivos</h2>
            </div>
            <div class="flex items-center gap-2 md:gap-4">
              <div id="notification-bell-placeholder"></div>
              <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark" onclick="Views.directorDevices.toggleDarkMode()">
                <span class="material-icons-round" id="dark-mode-icon">${isDark ? 'light_mode' : 'dark_mode'}</span>
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
          </header>

          <!-- Content Area -->
          <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc] dark:bg-slate-900">
            ${isLoading ? renderLoading() : renderContent(paginatedDevices, kpis, startIndex, endIndex, totalPages)}
          </div>

          <!-- Footer -->
          <footer class="text-center text-xs text-slate-400 py-4 bg-[#f8fafc] dark:bg-slate-900">
            &copy; 2026 NEUVOX. Todos los derechos reservados.
          </footer>
        </main>
      </div>
    `;

    // Re-attach pagination event listeners
    if (!isLoading && devices.length > 0) {
      const btnPrev = document.getElementById('btn-prev-page');
      const btnNext = document.getElementById('btn-next-page');
      if (btnPrev) {
        btnPrev.onclick = () => {
          if (currentPage > 1) {
            currentPage--;
            render();
          }
        };
      }
      if (btnNext) {
        btnNext.onclick = () => {
          if (currentPage < totalPages) {
            currentPage++;
            render();
          }
        };
      }
    }

    // Update notification bell after re-render
    if (typeof Components !== 'undefined' && Components.updateNotificationBell) {
      Components.updateNotificationBell();
    }
  }

  function renderLoading() {
    return `
      <div class="flex items-center justify-center py-20">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p class="text-muted-light dark:text-muted-dark">Cargando dispositivos...</p>
        </div>
      </div>
    `;
  }

  function renderContent(paginatedDevices, kpis, startIndex, endIndex, totalPages) {
    return `
      <div class="space-y-6">
        <!-- Title Section -->
        <section>
          <div class="flex justify-between items-end mb-6">
            <div>
              <h3 class="text-lg font-bold text-slate-800 dark:text-white">Kioscos y Dispositivos</h3>
              <p class="text-sm text-slate-500" id="devices-count">${devices.length} dispositivo${devices.length !== 1 ? 's' : ''} registrado${devices.length !== 1 ? 's' : ''}</p>
            </div>
            <button class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:opacity-90 transition-all flex items-center gap-2" onclick="Views.directorDevices.showCreateForm()">
              <span class="material-icons-round text-lg">add</span>
              Nuevo Dispositivo
            </button>
          </div>
        </section>

        <!-- KPI Cards (3 cards, SIN iconos) -->
        <section>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Card: En Linea (green) -->
            <div class="bg-white dark:bg-card-dark p-6 rounded-xl border-l-4 border-l-green-500 shadow-sm">
              <div class="flex flex-col">
                <span class="text-4xl font-bold text-slate-800 dark:text-white mb-1" id="kpi-online">${kpis.online}</span>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">EN LINEA</span>
              </div>
            </div>

            <!-- Card: Desconectados (orange) -->
            <div class="bg-white dark:bg-card-dark p-6 rounded-xl border-l-4 border-l-orange-400 shadow-sm">
              <div class="flex flex-col">
                <span class="text-4xl font-bold text-slate-800 dark:text-white mb-1" id="kpi-offline">${kpis.offline}</span>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">DESCONECTADOS</span>
              </div>
            </div>

            <!-- Card: Bateria Baja (red) -->
            <div class="bg-white dark:bg-card-dark p-6 rounded-xl border-l-4 border-l-red-500 shadow-sm">
              <div class="flex flex-col">
                <span class="text-4xl font-bold text-slate-800 dark:text-white mb-1" id="kpi-low-battery">${kpis.lowBattery}</span>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">BATERIA BAJA</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Devices Table -->
        <section class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
          <div class="p-6 border-b border-border-light dark:border-border-dark">
            <h3 class="text-lg font-bold text-slate-800 dark:text-white">Dispositivos Registrados</h3>
          </div>

          ${devices.length === 0 ? `
            <div class="p-12 text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                <span class="material-icons-round text-3xl text-slate-400">devices</span>
              </div>
              <p class="text-slate-600 dark:text-slate-400 font-medium mb-2">Sin dispositivos</p>
              <p class="text-sm text-slate-500">No hay dispositivos registrados. Haga clic en "Nuevo Dispositivo" para agregar uno.</p>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <th class="px-6 py-4">PUERTA</th>
                    <th class="px-6 py-4">DEVICE ID</th>
                    <th class="px-6 py-4 text-center">VERSION</th>
                    <th class="px-6 py-4">ULTIMA SYNC</th>
                    <th class="px-6 py-4 text-center">PENDIENTES</th>
                    <th class="px-6 py-4 text-center">BATERIA</th>
                    <th class="px-6 py-4 text-center">ESTADO</th>
                    <th class="px-6 py-4 text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  ${paginatedDevices.map(device => `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <!-- Puerta -->
                      <td class="px-6 py-5 font-bold text-slate-700 dark:text-slate-200">${Components.escapeHtml(device.gate_id)}</td>

                      <!-- Device ID (span con border, no code) -->
                      <td class="px-6 py-5">
                        <span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded text-xs font-medium border border-slate-200 dark:border-slate-700">
                          ${Components.escapeHtml(device.device_id)}
                        </span>
                      </td>

                      <!-- Version -->
                      <td class="px-6 py-5 text-center text-slate-500 text-sm">${device.firmware_version || '1.0.0'}</td>

                      <!-- Ultima Sync -->
                      <td class="px-6 py-5 text-slate-500 text-sm">
                        ${device.last_sync ? Components.formatDateTime(device.last_sync) : '<span class="italic">Nunca</span>'}
                      </td>

                      <!-- Pendientes (badge circular) -->
                      <td class="px-6 py-5 text-center">
                        <span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 w-8 h-8 rounded-full inline-flex items-center justify-center text-xs font-bold">
                          ${device.pending_events || 0}
                        </span>
                      </td>

                      <!-- Bateria (badge pill) -->
                      <td class="px-6 py-5 text-center">
                        <span class="${getBatteryBadgeClasses(device.battery_pct)} px-3 py-1 rounded-full text-xs font-bold">
                          ${device.battery_pct}%
                        </span>
                      </td>

                      <!-- Estado (badge pill SIN dot) -->
                      <td class="px-6 py-5 text-center">
                        <span class="${getStatusBadgeClasses(device.online)} px-3 py-1 rounded-full text-xs font-bold">
                          ${device.online ? 'En Linea' : 'Desconectado'}
                        </span>
                      </td>

                      <!-- Acciones (3 botones: settings, edit, delete) -->
                      <td class="px-6 py-5">
                        <div class="flex justify-end gap-2">
                          <button onclick="Views.directorDevices.ping(${device.id})" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all" title="Configurar/Ping">
                            <span class="material-icons-round text-xl">settings</span>
                          </button>
                          <button onclick="Views.directorDevices.showEditForm(${device.id})" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Editar">
                            <span class="material-icons-round text-xl">edit</span>
                          </button>
                          <button onclick="Views.directorDevices.confirmDelete(${device.id})" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Eliminar">
                            <span class="material-icons-round text-xl">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Pagination Footer -->
            <div class="p-6 border-t border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <span class="text-sm text-slate-500" id="pagination-info">
                Mostrando ${startIndex + 1} a ${endIndex} de ${devices.length} dispositivos
              </span>
              <div class="flex gap-2">
                <button id="btn-prev-page" class="p-2 rounded-lg border border-border-light dark:border-border-dark hover:bg-white dark:hover:bg-slate-700 transition-colors ${currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage <= 1 ? 'disabled' : ''}>
                  <span class="material-icons-round text-lg">chevron_left</span>
                </button>
                <button id="btn-next-page" class="p-2 rounded-lg border border-border-light dark:border-border-dark hover:bg-white dark:hover:bg-slate-700 transition-colors ${currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage >= totalPages ? 'disabled' : ''}>
                  <span class="material-icons-round text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          `}
        </section>
      </div>
    `;
  }

  // ========== CRUD Functions (PRESERVED) ==========

  Views.directorDevices.showCreateForm = function() {
    Components.showModal('Nuevo Dispositivo', `
      <form id="device-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Identificador de Puerta *</label>
          <input type="text" id="device-gate" class="w-full px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required placeholder="Ej: PUERTA-PRINCIPAL, ENTRADA-A">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Device ID *</label>
          <input type="text" id="device-id" class="w-full px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required placeholder="Ej: KIOSK-001">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Version Firmware</label>
          <input type="text" id="device-version" class="w-full px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value="1.0.0" placeholder="Ej: 1.0.0">
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorDevices.saveDevice() }
    ]);
  };

  Views.directorDevices.saveDevice = async function(deviceId = null) {
    if (isSaving) return;

    const gateId = document.getElementById('device-gate').value.trim();
    const deviceIdVal = document.getElementById('device-id').value.trim();
    const firmwareVersion = document.getElementById('device-version')?.value.trim() || '1.0.0';

    if (!gateId || !deviceIdVal) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    // Build payload with backend field names
    const payload = {
      gate_id: gateId,
      device_id: deviceIdVal,
      firmware_version: firmwareVersion,
    };

    // For edit, include additional fields if present
    if (deviceId) {
      const batteryInput = document.getElementById('device-battery');
      const onlineSelect = document.getElementById('device-online');
      if (batteryInput) {
        payload.battery_pct = parseInt(batteryInput.value) || 100;
      }
      if (onlineSelect) {
        payload.online = onlineSelect.value === 'true';
      }
    }

    isSaving = true;
    Components.showToast(deviceId ? 'Actualizando...' : 'Creando...', 'info', 2000);

    try {
      let result;
      if (deviceId) {
        result = await API.updateDevice(deviceId, payload);
        // Update local array
        const index = devices.findIndex(d => d.id === deviceId);
        if (index !== -1) {
          devices[index] = result;
        }
        Components.showToast('Dispositivo actualizado correctamente', 'success');
      } else {
        result = await API.createDevice(payload);
        devices.push(result);
        Components.showToast('Dispositivo creado correctamente', 'success');
      }

      document.querySelector('.modal-container')?.click();
      render();

    } catch (error) {
      console.error('Error saving device:', error);
      Components.showToast(error.message || 'Error al guardar dispositivo', 'error');
    } finally {
      isSaving = false;
    }
  };

  Views.directorDevices.showEditForm = function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    Components.showModal('Editar Dispositivo', `
      <form id="device-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Identificador de Puerta *</label>
          <input type="text" id="device-gate" class="w-full px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required value="${Components.escapeHtml(device.gate_id)}">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Device ID *</label>
          <input type="text" id="device-id" class="w-full px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required value="${Components.escapeHtml(device.device_id)}">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Version Firmware</label>
          <input type="text" id="device-version" class="w-full px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value="${Components.escapeHtml(device.firmware_version || '1.0.0')}">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estado</label>
          <select id="device-online" class="w-full px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            <option value="false" ${!device.online ? 'selected' : ''}>Desconectado</option>
            <option value="true" ${device.online ? 'selected' : ''}>En Linea</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nivel de Bateria (%)</label>
          <input type="number" id="device-battery" class="w-full px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value="${device.battery_pct}" min="0" max="100">
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorDevices.saveDevice(deviceId) }
    ]);
  };

  Views.directorDevices.confirmDelete = function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    Components.showModal('Confirmar Eliminacion', `
      <div class="text-center py-4">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
          <span class="material-icons-round text-3xl text-red-600 dark:text-red-400">warning</span>
        </div>
        <p class="text-lg text-slate-700 dark:text-slate-300 mb-2">¿Esta seguro de eliminar el dispositivo?</p>
        <p class="font-bold text-red-600 dark:text-red-400">${Components.escapeHtml(device.gate_id)} (${Components.escapeHtml(device.device_id)})</p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: async () => {
        if (isDeleting) return;
        isDeleting = true;

        try {
          await API.deleteDevice(deviceId);
          devices = devices.filter(d => d.id !== deviceId);
          document.querySelector('.modal-container')?.click();
          Components.showToast('Dispositivo eliminado', 'success');
          render();
        } catch (error) {
          console.error('Error deleting device:', error);
          Components.showToast(error.message || 'Error al eliminar dispositivo', 'error');
        } finally {
          isDeleting = false;
        }
      }}
    ]);
  };

  Views.directorDevices.ping = async function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    Components.showToast(`Enviando ping a ${device.device_id}...`, 'info', 2000);

    try {
      const result = await API.pingDevice(deviceId);
      // Update local device data
      const index = devices.findIndex(d => d.id === deviceId);
      if (index !== -1) {
        devices[index] = result;
      }
      Components.showToast(`Ping a ${device.device_id}: OK`, 'success');
      render();
    } catch (error) {
      console.error('Error pinging device:', error);
      Components.showToast(`Ping a ${device.device_id}: Error - ${error.message}`, 'error');
    }
  };

  Views.directorDevices.showLogs = async function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    // Show loading state in modal
    Components.showModal(`Logs - ${device.device_id}`, `
      <div class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
        <p class="text-muted-light dark:text-muted-dark">Cargando logs...</p>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);

    try {
      const logs = await API.getDeviceLogs(deviceId);
      const logsText = logs.join('\n');

      // Update modal content with actual logs
      const modalBody = document.querySelector('.modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <pre class="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">${Components.escapeHtml(logsText)}</pre>
        `;
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      const modalBody = document.querySelector('.modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div class="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-lg">
            <p class="text-red-700 dark:text-red-400">Error al cargar logs: ${error.message}</p>
          </div>
        `;
      }
    }
  };

  // ========== Initialization ==========

  // Initial render with loading
  render();

  // Load devices from API
  try {
    devices = await API.getDevices();
    // Also update State for consistency
    State.data.devices = devices.map(d => ({
      ...d,
      // Map backend fields to frontend display names for compatibility
      status: d.online ? 'ACTIVE' : 'QUEUE',
      version: d.firmware_version,
      pending_count: d.pending_events
    }));
    State.persist();
    isLoading = false;
    render();
  } catch (error) {
    console.error('Error loading devices:', error);
    isLoading = false;
    app.innerHTML = `
      <div class="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div class="text-center p-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
            <span class="material-icons-round text-3xl text-red-600">error</span>
          </div>
          <h2 class="text-xl font-bold text-slate-800 dark:text-white mb-2">Error al cargar</h2>
          <p class="text-slate-500 dark:text-slate-400 mb-4">No se pudieron cargar los dispositivos.</p>
          <p class="text-sm text-red-600 dark:text-red-400">${error.message || ''}</p>
          <button onclick="location.reload()" class="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    `;
  }
};
