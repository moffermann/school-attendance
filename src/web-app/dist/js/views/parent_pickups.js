// Parent Pickups - Authorized Persons Management
Views.parentPickups = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent', { activeView: 'pickups' });

  const content = document.getElementById('view-content');

  if (!State.currentGuardianId) {
    content.innerHTML = Components.createEmptyState('Error', 'No hay apoderado seleccionado');
    return;
  }

  const guardianId = State.currentGuardianId;
  const students = State.getGuardianStudents(guardianId);
  const pickups = State.getAuthorizedPickups({ guardianId: guardianId });

  // Relationship options
  const relationshipOptions = [
    'Padre', 'Madre', 'Abuelo/a', 'Tío/a', 'Hermano/a',
    'Primo/a', 'Vecino/a', 'Nana', 'Chofer', 'Otro'
  ];

  // Status badges
  function pickupStatusBadge(pickup) {
    if (!pickup.is_active) {
      return `<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
        <span class="material-symbols-outlined text-xs">block</span> Inactivo
      </span>`;
    }
    const badges = [];
    if (pickup.has_qr) {
      badges.push(`<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium">
        <span class="material-symbols-outlined text-xs">qr_code</span> QR
      </span>`);
    }
    if (pickup.has_photo) {
      badges.push(`<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium">
        <span class="material-symbols-outlined text-xs">photo_camera</span> Foto
      </span>`);
    }
    return badges.join(' ') || `<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-medium">
      <span class="material-symbols-outlined text-xs">warning</span> Sin QR
    </span>`;
  }

  // Student name badges for a pickup
  function studentBadges(pickup) {
    if (!pickup.student_ids || pickup.student_ids.length === 0) return '';
    return pickup.student_ids.map(sid => {
      const s = State.getStudent(sid);
      if (!s) return '';
      return `<span class="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium">${Components.escapeHtml(s.full_name)}</span>`;
    }).join(' ');
  }

  const activePickups = pickups.filter(p => p.is_active);
  const inactivePickups = pickups.filter(p => !p.is_active);

  // Withdrawal requests for Tab 2
  const withdrawalRequests = State.getWithdrawalRequests();
  const pendingRequestCount = withdrawalRequests.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').length;

  content.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6">
      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav class="flex gap-6" role="tablist">
          <button onclick="Views.parentPickups.switchTab('pickups')" id="tab-pickups"
                  class="tab-btn pb-3 text-sm font-semibold border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 flex items-center gap-2"
                  role="tab" aria-selected="true">
            <span class="material-symbols-outlined text-lg">badge</span> Personas Autorizadas
          </button>
          <button onclick="Views.parentPickups.switchTab('requests')" id="tab-requests"
                  class="tab-btn pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-2"
                  role="tab" aria-selected="false">
            <span class="material-symbols-outlined text-lg">schedule_send</span> Solicitudes de Retiro
            ${pendingRequestCount > 0 ? `<span class="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-indigo-500 rounded-full">${pendingRequestCount}</span>` : ''}
          </button>
        </nav>
      </div>

      <!-- Tab 1: Personas Autorizadas -->
      <div id="panel-pickups" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Personas Autorizadas</h2>
            <p class="text-gray-500 dark:text-gray-400 text-sm">Gestione las personas autorizadas para retirar a sus hijos</p>
          </div>
          <button onclick="Views.parentPickups.showCreateForm()"
                  class="btn-gradient flex items-center gap-2">
            <span class="material-symbols-outlined text-lg">person_add</span>
            <span class="hidden sm:inline">Agregar</span>
          </button>
        </div>

        <!-- Active Pickups -->
      <div id="pickups-list">
        ${activePickups.length === 0 ? `
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 text-center py-12">
            <span class="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">badge</span>
            <p class="text-base font-medium text-gray-500 dark:text-gray-400">No hay personas autorizadas</p>
            <p class="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">Agregue personas que pueden retirar a sus hijos</p>
            <button onclick="Views.parentPickups.showCreateForm()"
                    class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-medium text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
              <span class="material-symbols-outlined text-lg">person_add</span> Agregar Persona
            </button>
          </div>
        ` : `
          <div class="grid gap-4">
            ${activePickups.map(pickup => `
              <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div class="p-4 flex items-start gap-4">
                  <div class="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden pickup-avatar"
                       data-pickup-id="${pickup.id}"
                       ${pickup.has_photo && pickup.photo_url ? `data-photo-url="${pickup.photo_url}"` : ''}>
                    <span class="text-xl font-bold text-indigo-600 dark:text-indigo-400 pickup-initial">${pickup.full_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <h4 class="text-base font-semibold text-gray-900 dark:text-white">${Components.escapeHtml(pickup.full_name)}</h4>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">${Components.escapeHtml(pickup.relationship_type)}</span>
                    </div>
                    ${pickup.national_id ? `
                      <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-0.5">
                        <span class="material-symbols-outlined text-xs">badge</span> RUT: ${Components.escapeHtml(pickup.national_id)}
                      </p>
                    ` : ''}
                    ${pickup.phone ? `
                      <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-0.5">
                        <span class="material-symbols-outlined text-xs">phone</span> ${Components.escapeHtml(pickup.phone)}
                      </p>
                    ` : ''}
                    ${pickup.email ? `
                      <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-0.5">
                        <span class="material-symbols-outlined text-xs">mail</span> ${Components.escapeHtml(pickup.email)}
                      </p>
                    ` : ''}
                    <div class="flex items-center gap-2 flex-wrap mt-2">
                      ${pickupStatusBadge(pickup)}
                      ${studentBadges(pickup)}
                    </div>
                  </div>
                </div>
                <div class="border-t border-gray-50 dark:border-gray-700 px-4 py-3 flex items-center gap-2 flex-wrap bg-gray-50/50 dark:bg-slate-800/50">
                  ${pickup.has_qr ? `
                    <button onclick="Views.parentPickups.showQR(${pickup.id})"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                      <span class="material-symbols-outlined text-sm">qr_code</span> Ver QR
                    </button>
                  ` : `
                    <button onclick="Views.parentPickups.regenerateQR(${pickup.id})"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors">
                      <span class="material-symbols-outlined text-sm">qr_code</span> Generar QR
                    </button>
                  `}
                  <button onclick="Views.parentPickups.showEditForm(${pickup.id})"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <span class="material-symbols-outlined text-sm">edit</span> Editar
                  </button>
                  <button onclick="Views.parentPickups.confirmDeactivate(${pickup.id}, '${Components.escapeHtml(pickup.full_name).replace(/'/g, "\\'")}')"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors ml-auto">
                    <span class="material-symbols-outlined text-sm">person_off</span> Desactivar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

        ${inactivePickups.length > 0 ? `
          <!-- Inactive Pickups (collapsible) -->
          <div class="mt-6">
            <button onclick="Views.parentPickups.toggleInactive()"
                    class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              <span class="material-symbols-outlined text-lg transition-transform" id="inactive-chevron">expand_more</span>
              Personas Inactivas (${inactivePickups.length})
            </button>
            <div id="inactive-pickups-list" class="hidden mt-3 grid gap-3">
              ${inactivePickups.map(pickup => `
                <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden opacity-60">
                  <div class="p-4 flex items-start gap-4">
                    <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <span class="text-lg font-bold text-gray-400 dark:text-gray-500">${pickup.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-1">
                        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400">${Components.escapeHtml(pickup.full_name)}</h4>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">${Components.escapeHtml(pickup.relationship_type)}</span>
                        ${pickupStatusBadge(pickup)}
                      </div>
                      ${pickup.national_id ? `
                        <p class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <span class="material-symbols-outlined text-xs">badge</span> RUT: ${Components.escapeHtml(pickup.national_id)}
                        </p>
                      ` : ''}
                      <div class="flex items-center gap-2 flex-wrap mt-1">
                        ${studentBadges(pickup)}
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

      </div><!-- end panel-pickups -->

      <!-- Tab 2: Solicitudes de Retiro -->
      <div id="panel-requests" class="space-y-6 hidden">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Solicitudes de Retiro</h2>
            <p class="text-gray-500 dark:text-gray-400 text-sm">Notifique al colegio sobre retiros programados</p>
          </div>
          ${activePickups.length > 0 ? `
            <button onclick="Views.parentPickups.showRequestForm()"
                    class="btn-gradient flex items-center gap-2">
              <span class="material-symbols-outlined text-lg">schedule_send</span>
              <span class="hidden sm:inline">Nueva Solicitud</span>
            </button>
          ` : ''}
        </div>

        ${activePickups.length === 0 ? `
          <div class="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-4 flex items-start gap-3">
            <span class="material-symbols-outlined text-yellow-500 mt-0.5">warning</span>
            <div>
              <p class="text-sm font-medium text-yellow-700 dark:text-yellow-300">Primero agregue una persona autorizada</p>
              <p class="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Para crear una solicitud de retiro, necesita tener al menos una persona autorizada registrada.</p>
            </div>
          </div>
        ` : ''}

        ${withdrawalRequests.length === 0 ? `
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 text-center py-12">
            <span class="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">schedule_send</span>
            <p class="text-base font-medium text-gray-500 dark:text-gray-400">No hay solicitudes de retiro</p>
            <p class="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">Cree una solicitud para notificar al colegio sobre un retiro próximo</p>
            ${activePickups.length > 0 ? `
              <button onclick="Views.parentPickups.showRequestForm()"
                      class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-medium text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
                <span class="material-symbols-outlined text-lg">schedule_send</span> Nueva Solicitud
              </button>
            ` : ''}
          </div>
        ` : `
          <div class="grid gap-4">
            ${withdrawalRequests.map(req => {
              const student = State.getStudent(req.student_id);
              const statusConfig = {
                PENDING: {
                  icon: 'hourglass_top', label: 'Pendiente',
                  containerBg: 'bg-yellow-50 dark:bg-yellow-900/20',
                  iconColor: 'text-yellow-600 dark:text-yellow-400',
                  badgeBg: 'bg-yellow-50 dark:bg-yellow-900/20',
                  badgeText: 'text-yellow-700 dark:text-yellow-400',
                },
                APPROVED: {
                  icon: 'check_circle', label: 'Aprobada',
                  containerBg: 'bg-green-50 dark:bg-green-900/20',
                  iconColor: 'text-green-600 dark:text-green-400',
                  badgeBg: 'bg-green-50 dark:bg-green-900/20',
                  badgeText: 'text-green-700 dark:text-green-400',
                },
                REJECTED: {
                  icon: 'cancel', label: 'Rechazada',
                  containerBg: 'bg-red-50 dark:bg-red-900/20',
                  iconColor: 'text-red-600 dark:text-red-400',
                  badgeBg: 'bg-red-50 dark:bg-red-900/20',
                  badgeText: 'text-red-700 dark:text-red-400',
                },
                COMPLETED: {
                  icon: 'task_alt', label: 'Completada',
                  containerBg: 'bg-blue-50 dark:bg-blue-900/20',
                  iconColor: 'text-blue-600 dark:text-blue-400',
                  badgeBg: 'bg-blue-50 dark:bg-blue-900/20',
                  badgeText: 'text-blue-700 dark:text-blue-400',
                },
                CANCELLED: {
                  icon: 'block', label: 'Cancelada',
                  containerBg: 'bg-gray-50 dark:bg-gray-700',
                  iconColor: 'text-gray-600 dark:text-gray-400',
                  badgeBg: 'bg-gray-50 dark:bg-gray-700',
                  badgeText: 'text-gray-700 dark:text-gray-300',
                },
                EXPIRED: {
                  icon: 'schedule', label: 'Expirada',
                  containerBg: 'bg-gray-50 dark:bg-gray-700',
                  iconColor: 'text-gray-600 dark:text-gray-400',
                  badgeBg: 'bg-gray-50 dark:bg-gray-700',
                  badgeText: 'text-gray-700 dark:text-gray-300',
                },
              };
              const sc = statusConfig[req.status] || statusConfig.PENDING;
              const canCancel = req.status === 'PENDING' || req.status === 'APPROVED';
              const formattedDate = new Date(req.scheduled_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });

              const isCompleted = req.status === 'COMPLETED';
              return `
                <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden ${isCompleted ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors' : ''}"
                     ${isCompleted ? `onclick="Views.parentPickups.showWithdrawalDetailsForRequest(${req.id})"` : ''}>
                  <div class="p-4 flex items-start gap-4">
                    <div class="w-10 h-10 rounded-lg ${sc.containerBg} flex items-center justify-center flex-shrink-0">
                      <span class="material-symbols-outlined ${sc.iconColor}">${sc.icon}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-1">
                        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">${student ? Components.escapeHtml(student.full_name) : 'Estudiante'}</h4>
                        <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${sc.badgeBg} ${sc.badgeText} font-medium">
                          <span class="material-symbols-outlined text-xs">${sc.icon}</span> ${sc.label}
                        </span>
                        ${isCompleted ? `<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium">
                          <span class="material-symbols-outlined text-xs">visibility</span> Ver detalle
                        </span>` : ''}
                      </div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-0.5">
                        <span class="material-symbols-outlined text-xs">calendar_today</span> ${formattedDate}
                        ${req.scheduled_time ? ` a las ${req.scheduled_time.substring(0, 5)}` : ''}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-0.5">
                        <span class="material-symbols-outlined text-xs">person</span>
                        ${req.pickup_name ? Components.escapeHtml(req.pickup_name) : 'Persona autorizada'}
                        ${req.pickup_relationship ? `(${Components.escapeHtml(req.pickup_relationship)})` : ''}
                      </p>
                      ${req.reason ? `
                        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">"${Components.escapeHtml(req.reason)}"</p>
                      ` : ''}
                      ${req.review_notes ? `
                        <div class="mt-2 bg-gray-50 dark:bg-slate-700 rounded-lg p-2">
                          <p class="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1">
                            <span class="material-symbols-outlined text-xs mt-0.5 flex-shrink-0">comment</span>
                            ${Components.escapeHtml(req.review_notes)}
                          </p>
                        </div>
                      ` : ''}
                    </div>
                    ${canCancel ? `
                      <button onclick="Views.parentPickups.confirmCancelRequest(${req.id}, '${student ? Components.escapeHtml(student.full_name).replace(/'/g, "\\'") : ''}')"
                              class="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Cancelar solicitud">
                        <span class="material-symbols-outlined text-lg">close</span>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div><!-- end panel-requests -->
    </div>

    <!-- Modal container (single-layer: click on backdrop closes, click on content stops) -->
    <div id="pickup-modal" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-black/50"
         onclick="if(event.target===this)Views.parentPickups.closeModal()">
      <div id="pickup-modal-content" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
      </div>
    </div>
  `;

  // Load photos with authentication after render
  Views.parentPickups.loadPhotos();
};

// ── Modal helpers ──────────────────────────────────────────

Views.parentPickups.openModal = function(html) {
  const modal = document.getElementById('pickup-modal');
  const modalContent = document.getElementById('pickup-modal-content');
  if (modal && modalContent) {
    modalContent.innerHTML = html;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

Views.parentPickups.closeModal = function() {
  const modal = document.getElementById('pickup-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// ── Load Photos with Authentication ──────────────────────────────────────────

Views.parentPickups.loadPhotos = async function() {
  const avatars = document.querySelectorAll('.pickup-avatar[data-photo-url]');

  for (const avatar of avatars) {
    const photoUrl = avatar.dataset.photoUrl;
    if (!photoUrl) continue;

    try {
      // Fetch photo with JWT authentication
      const response = await fetch(photoUrl, {
        headers: {
          'Authorization': `Bearer ${API.accessToken}`
        }
      });

      if (!response.ok) continue;

      // Convert to blob URL
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Replace initial with photo
      const initial = avatar.querySelector('.pickup-initial');
      if (initial) {
        initial.remove();
      }

      const img = document.createElement('img');
      img.src = blobUrl;
      img.alt = 'Foto';
      img.className = 'w-full h-full object-cover';
      avatar.appendChild(img);
    } catch (err) {
      console.warn('Failed to load photo:', photoUrl, err);
    }
  }
};

// ── Create Form ──────────────────────────────────────────

Views.parentPickups.showCreateForm = function() {
  const guardianId = State.currentGuardianId;
  const students = State.getGuardianStudents(guardianId);

  const relationshipOptions = [
    'Padre', 'Madre', 'Abuelo/a', 'Tío/a', 'Hermano/a',
    'Primo/a', 'Vecino/a', 'Nana', 'Chofer', 'Otro'
  ];

  const html = `
    <div class="p-5">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-indigo-500">person_add</span>
          Nueva Persona Autorizada
        </h3>
        <button onclick="Views.parentPickups.closeModal()" class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <form id="create-pickup-form">
        <div class="space-y-4">
          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Nombre completo *</label>
            <input type="text" id="pickup-name" required maxlength="255" placeholder="Ej: Juan Pérez González"
                   class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Parentesco *</label>
              <select id="pickup-relationship" required
                      class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                <option value="">Seleccione...</option>
                ${relationshipOptions.map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">RUT</label>
              <input type="text" id="pickup-rut" maxlength="20" placeholder="12.345.678-9"
                     class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Teléfono</label>
              <input type="tel" id="pickup-phone" maxlength="20" placeholder="+56 9 1234 5678"
                     class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Email</label>
              <input type="email" id="pickup-email" placeholder="correo@ejemplo.com"
                     class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            </div>
          </div>

          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Alumnos autorizados *</label>
            <div class="space-y-2">
              ${students.map(s => {
                const course = State.getCourse(s.course_id);
                return `
                  <label class="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                    <input type="checkbox" name="student_ids" value="${s.id}" checked
                           class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                    <span class="text-sm text-gray-900 dark:text-white font-medium">${Components.escapeHtml(s.full_name)}</span>
                    ${course ? `<span class="text-xs text-gray-400 dark:text-gray-500">${course.name}</span>` : ''}
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <button type="button" onclick="Views.parentPickups.submitCreate()"
                class="btn-gradient w-full mt-6 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">person_add</span>
          Agregar Persona
        </button>
      </form>
    </div>
  `;

  Views.parentPickups.openModal(html);
};

Views.parentPickups.submitCreate = async function() {
  const name = document.getElementById('pickup-name')?.value?.trim();
  const relationship = document.getElementById('pickup-relationship')?.value;
  const rut = document.getElementById('pickup-rut')?.value?.trim() || null;
  const phone = document.getElementById('pickup-phone')?.value?.trim() || null;
  const email = document.getElementById('pickup-email')?.value?.trim() || null;

  const checkboxes = document.querySelectorAll('input[name="student_ids"]:checked');
  const studentIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

  if (!name || name.length < 2) {
    Components.showToast('Ingrese el nombre completo', 'error');
    return;
  }
  if (!relationship) {
    Components.showToast('Seleccione el parentesco', 'error');
    return;
  }
  if (studentIds.length === 0) {
    Components.showToast('Seleccione al menos un alumno', 'error');
    return;
  }

  const btn = document.querySelector('#create-pickup-form button[type="button"]');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-60');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Creando...';
  }

  try {
    const data = {
      full_name: name,
      relationship_type: relationship,
      national_id: rut,
      phone: phone,
      email: email,
      student_ids: studentIds,
    };

    if (State.isApiAuthenticated()) {
      const created = await API.createParentPickup(State.currentGuardianId, data);
      State.addAuthorizedPickup(created);
    } else {
      // Demo mode
      const demoPickup = {
        id: Date.now(),
        ...data,
        is_active: true,
        has_photo: false,
        has_qr: false,
      };
      State.addAuthorizedPickup(demoPickup);
    }

    Components.showToast('Persona autorizada creada', 'success');
    Views.parentPickups.closeModal();
    setTimeout(() => Views.parentPickups(), 300);
  } catch (error) {
    console.error('Error creating pickup:', error);
    Components.showToast('Error: ' + (error.message || 'Intente nuevamente'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60');
      btn.innerHTML = '<span class="material-symbols-outlined">person_add</span> Agregar Persona';
    }
  }
};

// ── Edit Form ──────────────────────────────────────────

Views.parentPickups.showEditForm = function(pickupId) {
  const pickups = State.getAuthorizedPickups({ guardianId: State.currentGuardianId });
  const pickup = pickups.find(p => p.id === pickupId);
  if (!pickup) {
    Components.showToast('Persona no encontrada', 'error');
    return;
  }

  const students = State.getGuardianStudents(State.currentGuardianId);
  const pickupStudentIds = pickup.student_ids || [];

  const relationshipOptions = [
    'Padre', 'Madre', 'Abuelo/a', 'Tío/a', 'Hermano/a',
    'Primo/a', 'Vecino/a', 'Nana', 'Chofer', 'Otro'
  ];

  const html = `
    <div class="p-5">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-indigo-500">edit</span>
          Editar Persona
        </h3>
        <button onclick="Views.parentPickups.closeModal()" class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <form id="edit-pickup-form">
        <div class="space-y-4">
          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Nombre completo *</label>
            <input type="text" id="edit-pickup-name" required maxlength="255" value="${Components.escapeHtml(pickup.full_name)}"
                   class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Parentesco *</label>
              <select id="edit-pickup-relationship" required
                      class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                ${relationshipOptions.map(r => `<option value="${r}" ${r === pickup.relationship_type ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Teléfono</label>
              <input type="tel" id="edit-pickup-phone" maxlength="20" value="${pickup.phone ? Components.escapeHtml(pickup.phone) : ''}"
                     class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            </div>
          </div>

          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Email</label>
            <input type="email" id="edit-pickup-email" value="${pickup.email ? Components.escapeHtml(pickup.email) : ''}"
                   class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
          </div>

          <!-- Student associations -->
          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Alumnos autorizados *</label>
            <div class="space-y-2">
              ${students.map(s => {
                const course = State.getCourse(s.course_id);
                const isChecked = pickupStudentIds.includes(s.id);
                return `
                  <label class="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                    <input type="checkbox" name="edit_student_ids" value="${s.id}" ${isChecked ? 'checked' : ''}
                           class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                    <span class="text-sm text-gray-900 dark:text-white font-medium">${Components.escapeHtml(s.full_name)}</span>
                    ${course ? `<span class="text-xs text-gray-400 dark:text-gray-500">${course.name}</span>` : ''}
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Photo upload -->
          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Foto</label>
            <div class="border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl p-4 text-center hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                 onclick="document.getElementById('edit-pickup-photo').click()">
              <input type="file" id="edit-pickup-photo" accept="image/*" class="hidden">
              <span class="material-symbols-outlined text-2xl text-gray-400 dark:text-gray-500 mb-1 block">photo_camera</span>
              <p class="text-xs text-gray-500 dark:text-gray-400">${pickup.has_photo ? 'Cambiar foto' : 'Subir foto (opcional)'}</p>
              <div id="edit-photo-name" class="mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium hidden"></div>
            </div>
          </div>
        </div>

        <input type="hidden" id="edit-pickup-id" value="${pickup.id}">

        <button type="button" onclick="Views.parentPickups.submitEdit()"
                class="btn-gradient w-full mt-6 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">save</span>
          Guardar Cambios
        </button>
      </form>
    </div>
  `;

  Views.parentPickups.openModal(html);

  // File input handler
  setTimeout(() => {
    const fileInput = document.getElementById('edit-pickup-photo');
    const fileNameDisplay = document.getElementById('edit-photo-name');
    if (fileInput && fileNameDisplay) {
      fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
          fileNameDisplay.textContent = this.files[0].name;
          fileNameDisplay.classList.remove('hidden');
        } else {
          fileNameDisplay.classList.add('hidden');
        }
      });
    }
  }, 100);
};

Views.parentPickups.submitEdit = async function() {
  const pickupId = parseInt(document.getElementById('edit-pickup-id')?.value);
  const name = document.getElementById('edit-pickup-name')?.value?.trim();
  const relationship = document.getElementById('edit-pickup-relationship')?.value;
  const phone = document.getElementById('edit-pickup-phone')?.value?.trim() || null;
  const email = document.getElementById('edit-pickup-email')?.value?.trim() || null;
  const photoFile = document.getElementById('edit-pickup-photo')?.files?.[0] || null;

  const studentCheckboxes = document.querySelectorAll('input[name="edit_student_ids"]:checked');
  const studentIds = Array.from(studentCheckboxes).map(cb => parseInt(cb.value));

  if (!name || name.length < 2) {
    Components.showToast('Ingrese el nombre completo', 'error');
    return;
  }
  if (studentIds.length === 0) {
    Components.showToast('Seleccione al menos un alumno', 'error');
    return;
  }

  const btn = document.querySelector('#edit-pickup-form button[type="button"]');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-60');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Guardando...';
  }

  try {
    const data = {
      full_name: name,
      relationship_type: relationship,
      phone: phone,
      email: email,
      student_ids: studentIds,
    };

    if (State.isApiAuthenticated()) {
      let updated = await API.updateParentPickup(State.currentGuardianId, pickupId, data);

      // Upload photo if selected
      if (photoFile) {
        if (photoFile.size > 5 * 1024 * 1024) {
          Components.showToast('La foto no puede exceder 5MB', 'error');
          return;
        }
        if (btn) btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Subiendo foto...';
        try {
          updated = await API.uploadParentPickupPhoto(State.currentGuardianId, pickupId, photoFile);
        } catch (photoErr) {
          Components.showToast('Datos guardados, pero error al subir foto', 'warning');
        }
      }

      State.updateAuthorizedPickup(pickupId, updated);
    } else {
      State.updateAuthorizedPickup(pickupId, data);
    }

    Components.showToast('Persona actualizada', 'success');
    Views.parentPickups.closeModal();
    setTimeout(() => Views.parentPickups(), 300);
  } catch (error) {
    console.error('Error updating pickup:', error);
    Components.showToast('Error: ' + (error.message || 'Intente nuevamente'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60');
      btn.innerHTML = '<span class="material-symbols-outlined">save</span> Guardar Cambios';
    }
  }
};

// ── QR Modal ──────────────────────────────────────────

Views.parentPickups.showQR = async function(pickupId) {
  const pickups = State.getAuthorizedPickups({ guardianId: State.currentGuardianId });
  const pickup = pickups.find(p => p.id === pickupId);
  if (!pickup) return;

  let qrContent = '';
  if (pickup.qr_token && typeof qrcode === 'function') {
    // Generate QR client-side using the stored token
    try {
      const qr = qrcode(0, 'M');
      qr.addData(pickup.qr_token);
      qr.make();
      const dataURL = qr.createDataURL(6, 4);
      qrContent = `<img src="${dataURL}" alt="Código QR" class="w-64 h-64 mx-auto border border-gray-200 dark:border-gray-600 rounded-lg">`;
    } catch (error) {
      qrContent = `
        <div class="text-center py-8">
          <span class="material-symbols-outlined text-4xl text-red-400 mb-2 block">error</span>
          <p class="text-sm text-red-500">Error al generar QR</p>
        </div>
      `;
    }
  } else if (pickup.has_qr) {
    // QR exists in DB but token not in memory — prompt regeneration
    qrContent = `
      <div class="w-64 h-64 mx-auto bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
        <div class="text-center px-4">
          <span class="material-symbols-outlined text-5xl text-gray-400 mb-2 block">qr_code</span>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">Para ver el código QR, presione "Regenerar" abajo.</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">Esto generará un nuevo código y el anterior quedará invalidado.</p>
        </div>
      </div>
    `;
  } else {
    qrContent = `
      <div class="w-64 h-64 mx-auto bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
        <div class="text-center px-4">
          <span class="material-symbols-outlined text-5xl text-gray-400 mb-2 block">qr_code</span>
          <p class="text-sm text-gray-500 dark:text-gray-400">Presione "Regenerar" para crear un código QR.</p>
        </div>
      </div>
    `;
  }

  const html = `
    <div class="p-5">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-green-500">qr_code</span>
          QR de Retiro - ${Components.escapeHtml(pickup.full_name)}
        </h3>
        <button onclick="Views.parentPickups.closeModal()" class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="mb-6">${qrContent}</div>

      <div class="text-center mb-4">
        <p class="text-base font-semibold text-gray-900 dark:text-white">${Components.escapeHtml(pickup.full_name)}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">${Components.escapeHtml(pickup.relationship_type)}</p>
        ${pickup.national_id ? `<p class="text-sm text-gray-500 dark:text-gray-400">RUT: ${Components.escapeHtml(pickup.national_id)}</p>` : ''}
      </div>

      <div class="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-3 mb-4">
        <p class="text-xs text-yellow-800 dark:text-yellow-300 font-semibold mb-1">Importante:</p>
        <p class="text-xs text-yellow-700 dark:text-yellow-400">
          Este código es único y solo se muestra una vez. Descargue o imprima antes de cerrar.
        </p>
      </div>

      <div class="flex gap-3">
        <button onclick="Views.parentPickups.closeModal()"
                class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cerrar
        </button>
        <button onclick="Views.parentPickups.downloadQR('${Components.escapeHtml(pickup.full_name).replace(/'/g, "\\'")}')"
                class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
          <span class="material-symbols-outlined text-lg">download</span> Descargar
        </button>
      </div>
      <button onclick="Views.parentPickups.regenerateQR(${pickup.id})"
              class="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs font-medium text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors">
        <span class="material-symbols-outlined text-sm">refresh</span> Regenerar QR (invalida el anterior)
      </button>
    </div>
  `;

  Views.parentPickups.openModal(html);
};

Views.parentPickups.downloadQR = function(pickupName) {
  const qrImg = document.querySelector('#pickup-modal-content img[alt="Código QR"]');
  if (!qrImg) {
    Components.showToast('No hay QR para descargar', 'error');
    return;
  }
  const link = document.createElement('a');
  link.href = qrImg.src;
  link.download = `qr-retiro-${pickupName.replace(/\s+/g, '-')}.png`;
  link.click();
  Components.showToast('QR descargado', 'success');
};

// ── Regenerate QR ──────────────────────────────────────────

Views.parentPickups.regenerateQR = async function(pickupId) {
  if (!State.isApiAuthenticated()) {
    Components.showToast('QR solo disponible en modo conectado', 'warning');
    return;
  }

  try {
    const updated = await API.regenerateParentPickupQR(State.currentGuardianId, pickupId);
    // Store full pickup data including qr_token in State
    State.updateAuthorizedPickup(pickupId, updated);
    Components.showToast('QR regenerado exitosamente', 'success');
    Views.parentPickups.closeModal();
    // Re-open QR modal to show the newly generated QR
    setTimeout(() => Views.parentPickups.showQR(pickupId), 300);
  } catch (error) {
    console.error('Error regenerating QR:', error);
    Components.showToast('Error: ' + (error.message || 'Intente nuevamente'), 'error');
  }
};

// ── Deactivate ──────────────────────────────────────────

Views.parentPickups.confirmDeactivate = function(pickupId, pickupName) {
  const html = `
    <div class="p-5">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-red-500">warning</span>
          Confirmar Desactivación
        </h3>
        <button onclick="Views.parentPickups.closeModal()" class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 mb-5">
        <p class="text-sm text-red-700 dark:text-red-300">
          <strong>${Components.escapeHtml(pickupName)}</strong> ya no podrá retirar alumnos del colegio. Su código QR quedará invalidado.
        </p>
      </div>

      <div class="flex gap-3">
        <button onclick="Views.parentPickups.closeModal()"
                class="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cancelar
        </button>
        <button onclick="Views.parentPickups.doDeactivate(${pickupId})"
                class="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-900 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-lg">person_off</span> Desactivar
        </button>
      </div>
    </div>
  `;

  Views.parentPickups.openModal(html);
};

Views.parentPickups.doDeactivate = async function(pickupId) {
  try {
    if (State.isApiAuthenticated()) {
      const updated = await API.deleteParentPickup(State.currentGuardianId, pickupId);
      State.updateAuthorizedPickup(pickupId, updated);
    } else {
      State.removeAuthorizedPickup(pickupId);
    }

    Components.showToast('Persona desactivada', 'success');
    Views.parentPickups.closeModal();
    setTimeout(() => Views.parentPickups(), 300);
  } catch (error) {
    console.error('Error deactivating pickup:', error);
    Components.showToast('Error: ' + (error.message || 'Intente nuevamente'), 'error');
  }
};

// ── Toggle Inactive List ──────────────────────────────────────────

Views.parentPickups.toggleInactive = function() {
  const list = document.getElementById('inactive-pickups-list');
  const chevron = document.getElementById('inactive-chevron');
  if (list && chevron) {
    const isHidden = list.classList.contains('hidden');
    if (isHidden) {
      list.classList.remove('hidden');
      chevron.textContent = 'expand_less';
    } else {
      list.classList.add('hidden');
      chevron.textContent = 'expand_more';
    }
  }
};

// ── Tab Switching ──────────────────────────────────────────

Views.parentPickups.switchTab = function(tabName) {
  const tabs = ['pickups', 'requests'];
  tabs.forEach(t => {
    const tabBtn = document.getElementById('tab-' + t);
    const panel = document.getElementById('panel-' + t);
    if (t === tabName) {
      if (tabBtn) {
        tabBtn.classList.add('border-indigo-500', 'text-indigo-600', 'dark:text-indigo-400', 'font-semibold');
        tabBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'font-medium');
        tabBtn.setAttribute('aria-selected', 'true');
      }
      if (panel) panel.classList.remove('hidden');
    } else {
      if (tabBtn) {
        tabBtn.classList.remove('border-indigo-500', 'text-indigo-600', 'dark:text-indigo-400', 'font-semibold');
        tabBtn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'font-medium');
        tabBtn.setAttribute('aria-selected', 'false');
      }
      if (panel) panel.classList.add('hidden');
    }
  });
};

// ── Withdrawal Request Form ──────────────────────────────────

Views.parentPickups.showRequestForm = function() {
  const guardianId = State.currentGuardianId;
  const students = State.getGuardianStudents(guardianId);
  const activePickups = State.getAuthorizedPickups({ guardianId, activeOnly: true });

  if (activePickups.length === 0) {
    Components.showToast('Primero agregue una persona autorizada', 'warning');
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  const html = `
    <div class="p-5">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-indigo-500">schedule_send</span>
          Nueva Solicitud de Retiro
        </h3>
        <button onclick="Views.parentPickups.closeModal()" class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <form id="create-request-form">
        <div class="space-y-4">
          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Alumno *</label>
            <select id="req-student-id" required
                    class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
              ${students.length === 1
                ? `<option value="${students[0].id}">${Components.escapeHtml(students[0].full_name)}</option>`
                : `<option value="">Seleccione alumno...</option>${students.map(s => `<option value="${s.id}">${Components.escapeHtml(s.full_name)}</option>`).join('')}`
              }
            </select>
          </div>

          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Persona que retira *</label>
            <select id="req-pickup-id" required
                    class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
              ${activePickups.length === 1
                ? `<option value="${activePickups[0].id}">${Components.escapeHtml(activePickups[0].full_name)} (${Components.escapeHtml(activePickups[0].relationship_type)})</option>`
                : `<option value="">Seleccione persona...</option>${activePickups.map(p => `<option value="${p.id}">${Components.escapeHtml(p.full_name)} (${Components.escapeHtml(p.relationship_type)})</option>`).join('')}`
              }
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Fecha *</label>
              <input type="date" id="req-date" required min="${today}"
                     class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Hora aprox.</label>
              <input type="time" id="req-time"
                     class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            </div>
          </div>

          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Motivo</label>
            <textarea id="req-reason" rows="2" maxlength="500" placeholder="Ej: Cita médica, control dental..."
                      class="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"></textarea>
          </div>
        </div>

        <div class="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 mt-4 mb-2">
          <p class="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <span class="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">info</span>
            La solicitud será revisada por el colegio. Recibirá una notificación cuando sea aprobada o rechazada.
          </p>
        </div>

        <button type="button" onclick="Views.parentPickups.submitRequest()"
                class="btn-gradient w-full mt-4 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">schedule_send</span>
          Enviar Solicitud
        </button>
      </form>
    </div>
  `;

  Views.parentPickups.openModal(html);
};

Views.parentPickups.submitRequest = async function() {
  const studentId = parseInt(document.getElementById('req-student-id')?.value);
  const pickupId = parseInt(document.getElementById('req-pickup-id')?.value);
  const scheduledDate = document.getElementById('req-date')?.value;
  const scheduledTime = document.getElementById('req-time')?.value || null;
  const reason = document.getElementById('req-reason')?.value?.trim() || null;

  if (!studentId) {
    Components.showToast('Seleccione un alumno', 'error');
    return;
  }
  if (!pickupId) {
    Components.showToast('Seleccione la persona que retira', 'error');
    return;
  }
  if (!scheduledDate) {
    Components.showToast('Seleccione la fecha', 'error');
    return;
  }

  const btn = document.querySelector('#create-request-form button[type="button"]');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-60');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Enviando...';
  }

  try {
    const data = {
      student_id: studentId,
      authorized_pickup_id: pickupId,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      reason: reason,
    };

    if (State.isApiAuthenticated()) {
      const created = await API.createWithdrawalRequest(State.currentGuardianId, data);
      State.addWithdrawalRequest(created);
    } else {
      const pickups = State.getAuthorizedPickups({ guardianId: State.currentGuardianId });
      const pickup = pickups.find(p => p.id === pickupId);
      const student = State.getStudent(studentId);
      const demoReq = {
        id: Date.now(),
        ...data,
        status: 'PENDING',
        pickup_name: pickup ? pickup.full_name : null,
        pickup_relationship: pickup ? pickup.relationship_type : null,
        student_name: student ? student.full_name : null,
        review_notes: null,
        created_at: new Date().toISOString(),
      };
      State.addWithdrawalRequest(demoReq);
    }

    Components.showToast('Solicitud enviada exitosamente', 'success');
    Views.parentPickups.closeModal();
    setTimeout(() => {
      Views.parentPickups();
      // Switch to requests tab
      setTimeout(() => Views.parentPickups.switchTab('requests'), 50);
    }, 300);
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    Components.showToast('Error: ' + (error.message || 'Intente nuevamente'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60');
      btn.innerHTML = '<span class="material-symbols-outlined">schedule_send</span> Enviar Solicitud';
    }
  }
};

// ── Cancel Withdrawal Request ──────────────────────────────────

Views.parentPickups.confirmCancelRequest = function(requestId, studentName) {
  const html = `
    <div class="p-5">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-red-500">warning</span>
          Cancelar Solicitud
        </h3>
        <button onclick="Views.parentPickups.closeModal()" class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 mb-5">
        <p class="text-sm text-red-700 dark:text-red-300">
          ¿Desea cancelar la solicitud de retiro para <strong>${Components.escapeHtml(studentName)}</strong>?
        </p>
      </div>

      <div class="flex gap-3">
        <button onclick="Views.parentPickups.closeModal()"
                class="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          No, Mantener
        </button>
        <button onclick="Views.parentPickups.doCancelRequest(${requestId})"
                class="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-900 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-lg">close</span> Sí, Cancelar
        </button>
      </div>
    </div>
  `;

  Views.parentPickups.openModal(html);
};

Views.parentPickups.doCancelRequest = async function(requestId) {
  try {
    if (State.isApiAuthenticated()) {
      const updated = await API.cancelWithdrawalRequest(State.currentGuardianId, requestId);
      State.updateWithdrawalRequest(requestId, updated);
    } else {
      State.updateWithdrawalRequest(requestId, { status: 'CANCELLED' });
    }

    Components.showToast('Solicitud cancelada', 'success');
    Views.parentPickups.closeModal();
    setTimeout(() => {
      Views.parentPickups();
      setTimeout(() => Views.parentPickups.switchTab('requests'), 50);
    }, 300);
  } catch (error) {
    console.error('Error cancelling request:', error);
    Components.showToast('Error: ' + (error.message || 'Intente nuevamente'), 'error');
  }
};

// ── Withdrawal Details Modal ──────────────────────────────────

Views.parentPickups.showWithdrawalDetailsForRequest = function(requestId) {
  console.log('[ParentPickups] showWithdrawalDetailsForRequest called with requestId:', requestId);
  const requests = State.getWithdrawalRequests();
  const request = requests.find(r => r.id === requestId);

  if (!request) {
    console.warn('[ParentPickups] Request not found:', requestId);
    Components.showToast('Solicitud no encontrada', 'error');
    return;
  }

  console.log('[ParentPickups] Found request:', request);

  // Try to find the linked withdrawal
  let withdrawal = null;

  if (request.student_withdrawal_id) {
    // Direct link via student_withdrawal_id
    const withdrawals = State.getWithdrawals ? State.getWithdrawals() : (State.data.withdrawals || []);
    withdrawal = withdrawals.find(w => w.id === request.student_withdrawal_id);
    console.log('[ParentPickups] Found withdrawal by direct ID:', withdrawal);
  }

  if (!withdrawal) {
    // Fallback: find by student_id on the same date
    const withdrawals = State.getWithdrawals ? State.getWithdrawals() : (State.data.withdrawals || []);
    const reqDate = request.scheduled_date;
    withdrawal = withdrawals.find(w =>
      w.student_id === request.student_id &&
      w.status === 'COMPLETED' &&
      w.completed_at && w.completed_at.startsWith(reqDate)
    );
    console.log('[ParentPickups] Found withdrawal by fallback:', withdrawal);
  }

  if (!withdrawal) {
    console.warn('[ParentPickups] No withdrawal found for request');
    Components.showToast('Detalles del retiro no disponibles', 'warning');
    return;
  }

  Views.parentPickups.showWithdrawalDetails(withdrawal);
};

Views.parentPickups.showWithdrawalDetails = function(withdrawal) {
  console.log('[ParentPickups] showWithdrawalDetails called with:', withdrawal);
  const student = State.getStudent(withdrawal.student_id);

  const completedDate = withdrawal.completed_at
    ? new Date(withdrawal.completed_at).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/A';
  const completedTime = withdrawal.completed_at
    ? new Date(withdrawal.completed_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const verificationLabels = {
    'QR_SCAN': { icon: 'qr_code_scanner', label: 'Código QR' },
    'BIOMETRIC': { icon: 'fingerprint', label: 'Biométrico' },
    'ADMIN_OVERRIDE': { icon: 'admin_panel_settings', label: 'Verificación manual' },
    'PHOTO_MATCH': { icon: 'face', label: 'Reconocimiento facial' },
  };
  const verif = verificationLabels[withdrawal.verification_method] || { icon: 'verified', label: withdrawal.verification_method || 'N/A' };

  const html = `
    <div class="p-5">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-blue-500">info</span>
          Detalle del Retiro
        </h3>
        <button onclick="Views.parentPickups.closeModal()" class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Student & Date -->
      <div class="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 mb-4">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <span class="material-symbols-outlined text-indigo-600 dark:text-indigo-400">school</span>
          </div>
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">${student ? Components.escapeHtml(student.full_name) : 'Estudiante'}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${withdrawal.course_name || ''}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Fecha</p>
            <p class="font-medium text-gray-900 dark:text-white">${completedDate}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Hora</p>
            <p class="font-medium text-gray-900 dark:text-white">${completedTime}</p>
          </div>
        </div>
      </div>

      <!-- Pickup Person -->
      <div class="mb-4">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Retirado por</p>
        <div class="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
          <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
            <span class="material-symbols-outlined text-green-600 dark:text-green-400">person</span>
          </div>
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">${withdrawal.pickup_name || 'N/A'}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${withdrawal.pickup_relationship || ''}</p>
          </div>
        </div>
      </div>

      <!-- Verification Method -->
      <div class="mb-4">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Método de verificación</p>
        <div class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <span class="material-symbols-outlined text-blue-600 dark:text-blue-400">${verif.icon}</span>
          <span class="font-medium text-gray-900 dark:text-white">${verif.label}</span>
        </div>
      </div>

      ${withdrawal.reason ? `
        <!-- Reason -->
        <div class="mb-4">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Motivo</p>
          <p class="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">${Components.escapeHtml(withdrawal.reason)}</p>
        </div>
      ` : ''}

      ${withdrawal.pickup_photo_ref ? `
        <!-- Photo Evidence -->
        <div class="mb-4">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Foto del retiro</p>
          <div id="withdrawal-photo-container" class="bg-gray-100 dark:bg-slate-700 rounded-xl overflow-hidden flex items-center justify-center" style="min-height: 200px;">
            <span class="material-symbols-outlined text-3xl text-gray-400 animate-pulse">hourglass_top</span>
          </div>
        </div>
      ` : ''}

      ${withdrawal.signature_data ? `
        <!-- Signature -->
        <div class="mb-4">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Firma digital</p>
          <div class="bg-white dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-slate-600 p-2">
            <img src="${withdrawal.signature_data}" alt="Firma" class="max-w-full h-auto mx-auto" style="max-height: 120px;">
          </div>
        </div>
      ` : ''}

      ${withdrawal.device_id ? `
        <!-- Device -->
        <div class="mb-4">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Dispositivo</p>
          <p class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">devices</span> ${Components.escapeHtml(withdrawal.device_id)}
          </p>
        </div>
      ` : ''}

      <button onclick="Views.parentPickups.closeModal()"
              class="w-full mt-4 px-4 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors">
        Cerrar
      </button>
    </div>
  `;

  Views.parentPickups.openModal(html);

  // Load photo with authentication if present
  if (withdrawal.pickup_photo_ref) {
    Views.parentPickups.loadWithdrawalPhoto(withdrawal.id);
  }
};

Views.parentPickups.loadWithdrawalPhoto = async function(withdrawalId) {
  const container = document.getElementById('withdrawal-photo-container');
  if (!container) return;

  try {
    // Use the withdrawal photo endpoint
    const photoUrl = `/api/v1/withdrawals/${withdrawalId}/photo`;

    const response = await fetch(photoUrl, {
      headers: {
        'Authorization': `Bearer ${API.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load photo');
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    container.innerHTML = `<img src="${blobUrl}" alt="Foto del retiro" class="w-full h-auto max-h-64 object-contain">`;
  } catch (err) {
    console.warn('Failed to load withdrawal photo:', err);
    container.innerHTML = `
      <div class="text-center py-8">
        <span class="material-symbols-outlined text-3xl text-gray-400 mb-2 block">broken_image</span>
        <p class="text-sm text-gray-500 dark:text-gray-400">No se pudo cargar la foto</p>
      </div>
    `;
  }
};
