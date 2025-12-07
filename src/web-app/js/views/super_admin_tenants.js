/**
 * Super Admin Tenants List View
 */
const Views = Views || {};

Views.superAdminTenants = async function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createSuperAdminLayout('tenants');

  const content = document.getElementById('view-content');
  content.innerHTML = Components.createLoader('Cargando tenants...');

  let tenants = [];
  let filterStatus = 'all';
  let searchQuery = '';

  async function loadTenants() {
    try {
      const filters = {};
      if (filterStatus !== 'all') {
        filters.isActive = filterStatus === 'active';
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }

      const data = await SuperAdminAPI.listTenants(filters);
      tenants = data.tenants || data || [];
      renderTenants();
    } catch (error) {
      content.innerHTML = `
        <div class="error-state">
          <h3>Error al cargar tenants</h3>
          <p>${Components.escapeHtml(error.message)}</p>
          <button class="btn btn-primary" onclick="Views.superAdminTenants()">Reintentar</button>
        </div>
      `;
    }
  }

  function renderTenants() {
    content.innerHTML = `
      <div class="page-header">
        <h2>Gestión de Tenants</h2>
        <button class="btn btn-primary" onclick="showCreateTenantModal()">
          + Nuevo Tenant
        </button>
      </div>

      <div class="filters-bar">
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="Buscar por nombre o slug..." value="${Components.escapeHtml(searchQuery)}">
        </div>
        <div class="filter-buttons">
          <button class="btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="setFilter('all')">Todos</button>
          <button class="btn btn-sm ${filterStatus === 'active' ? 'btn-primary' : 'btn-secondary'}" onclick="setFilter('active')">Activos</button>
          <button class="btn btn-sm ${filterStatus === 'inactive' ? 'btn-primary' : 'btn-secondary'}" onclick="setFilter('inactive')">Inactivos</button>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Dominio</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${tenants.length > 0 ? tenants.map(tenant => `
              <tr>
                <td>
                  <a href="#/super-admin/tenant/${tenant.id}" class="tenant-link">
                    ${Components.escapeHtml(tenant.name)}
                  </a>
                </td>
                <td><code>${Components.escapeHtml(tenant.slug)}</code></td>
                <td>${Components.escapeHtml(tenant.domain || tenant.subdomain || '-')}</td>
                <td>${Components.createChip(tenant.plan || 'basic', tenant.plan === 'enterprise' ? 'blue' : tenant.plan === 'pro' ? 'green' : 'gray')}</td>
                <td>${Components.createChip(tenant.is_active ? 'Activo' : 'Inactivo', tenant.is_active ? 'green' : 'red')}</td>
                <td>${Components.formatDate(tenant.created_at)}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="Router.navigate('/super-admin/tenant/${tenant.id}')" title="Ver detalles">
                      Ver
                    </button>
                    ${tenant.is_active
                      ? `<button class="btn btn-sm btn-danger" onclick="confirmDeactivate(${tenant.id}, '${Components.escapeHtml(tenant.name)}')" title="Desactivar">
                          Desactivar
                        </button>`
                      : `<button class="btn btn-sm btn-success" onclick="activateTenant(${tenant.id})" title="Activar">
                          Activar
                        </button>`
                    }
                  </div>
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="7" class="empty-state">No se encontraron tenants</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <style>
        .filters-bar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        .search-box {
          flex: 1;
          min-width: 200px;
        }
        .search-box input {
          width: 100%;
          padding: 0.5rem 1rem;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 6px;
        }
        .filter-buttons {
          display: flex;
          gap: 0.5rem;
        }
        .tenant-link {
          color: var(--primary, #3b82f6);
          text-decoration: none;
          font-weight: 500;
        }
        .tenant-link:hover {
          text-decoration: underline;
        }
        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }
        code {
          background: var(--bg-secondary, #f3f4f6);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.875rem;
        }
      </style>
    `;

    // Setup search input
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchQuery = e.target.value;
        loadTenants();
      }, 300);
    });
  }

  // Global functions for this view
  window.setFilter = (status) => {
    filterStatus = status;
    loadTenants();
  };

  window.confirmDeactivate = (tenantId, tenantName) => {
    Components.showModal(
      'Confirmar desactivación',
      `<p>¿Está seguro que desea desactivar el tenant <strong>${Components.escapeHtml(tenantName)}</strong>?</p>
       <p class="text-warning">Los usuarios de este tenant no podrán acceder al sistema.</p>`,
      [
        { label: 'Cancelar', action: 'close' },
        {
          label: 'Desactivar',
          className: 'btn-danger',
          action: 'deactivate',
          onClick: async () => {
            try {
              await SuperAdminAPI.deactivateTenant(tenantId);
              Components.showToast('Tenant desactivado', 'success');
              loadTenants();
            } catch (error) {
              Components.showToast(error.message, 'error');
            }
          }
        }
      ]
    );
  };

  window.activateTenant = async (tenantId) => {
    try {
      await SuperAdminAPI.activateTenant(tenantId);
      Components.showToast('Tenant activado', 'success');
      loadTenants();
    } catch (error) {
      Components.showToast(error.message, 'error');
    }
  };

  window.showCreateTenantModal = () => {
    const modalContent = `
      <form id="createTenantForm">
        <div class="form-group">
          <label for="tenantName">Nombre del Colegio *</label>
          <input type="text" id="tenantName" required placeholder="Colegio San José">
        </div>
        <div class="form-group">
          <label for="tenantSlug">Slug (identificador único) *</label>
          <input type="text" id="tenantSlug" required placeholder="san-jose" pattern="[a-z0-9-]+" title="Solo letras minúsculas, números y guiones">
          <small>Se usará para el subdominio y nombre del schema</small>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="tenantDomain">Dominio personalizado</label>
            <input type="text" id="tenantDomain" placeholder="colegio.ejemplo.com">
          </div>
          <div class="form-group">
            <label for="tenantSubdomain">Subdominio</label>
            <input type="text" id="tenantSubdomain" placeholder="san-jose">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="tenantPlan">Plan</label>
            <select id="tenantPlan">
              <option value="basic">Básico</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div class="form-group">
            <label for="tenantMaxStudents">Máx. Alumnos</label>
            <input type="number" id="tenantMaxStudents" value="500" min="1">
          </div>
        </div>
        <hr>
        <h4>Administrador del Tenant</h4>
        <div class="form-row">
          <div class="form-group">
            <label for="adminEmail">Email del Admin *</label>
            <input type="email" id="adminEmail" required placeholder="admin@colegio.cl">
          </div>
          <div class="form-group">
            <label for="adminName">Nombre del Admin *</label>
            <input type="text" id="adminName" required placeholder="Juan Pérez">
          </div>
        </div>
      </form>
      <style>
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;

    const modal = Components.showModal('Crear Nuevo Tenant', modalContent, [
      { label: 'Cancelar', action: 'close' },
      {
        label: 'Crear Tenant',
        className: 'btn-primary',
        action: 'create',
        onClick: async () => {
          const form = document.getElementById('createTenantForm');
          if (!Components.validateForm(form)) return;

          const data = {
            name: document.getElementById('tenantName').value,
            slug: document.getElementById('tenantSlug').value,
            domain: document.getElementById('tenantDomain').value || null,
            subdomain: document.getElementById('tenantSubdomain').value || null,
            plan: document.getElementById('tenantPlan').value,
            max_students: parseInt(document.getElementById('tenantMaxStudents').value) || 500,
            admin_email: document.getElementById('adminEmail').value,
            admin_name: document.getElementById('adminName').value,
          };

          try {
            await SuperAdminAPI.createTenant(data);
            Components.showToast('Tenant creado exitosamente. Se envió invitación al administrador.', 'success');
            modal.close();
            loadTenants();
          } catch (error) {
            Components.showToast(error.message, 'error');
          }
        }
      }
    ]);

    // Auto-generate slug from name
    const nameInput = document.getElementById('tenantName');
    const slugInput = document.getElementById('tenantSlug');
    nameInput.addEventListener('input', () => {
      if (!slugInput.dataset.manual) {
        slugInput.value = nameInput.value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
    });
    slugInput.addEventListener('input', () => {
      slugInput.dataset.manual = 'true';
    });
  };

  await loadTenants();
};
