/**
 * Super Admin Dashboard View
 */
window.Views = window.Views || {};

Views.superAdminDashboard = async function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createSuperAdminLayout('dashboard');

  const content = document.getElementById('view-content');
  content.innerHTML = Components.createLoader('Cargando estadísticas...');

  try {
    // Load global stats and tenants list
    const [stats, tenantsData] = await Promise.all([
      SuperAdminAPI.getGlobalStats().catch(() => null),
      SuperAdminAPI.listTenants(),
    ]);

    const tenants = tenantsData.tenants || tenantsData || [];
    const activeTenants = tenants.filter(t => t.is_active).length;
    const totalStudents = stats?.total_students || tenants.reduce((sum, t) => sum + (t.student_count || 0), 0);
    const totalEvents = stats?.total_events_today || 0;

    content.innerHTML = `
      <div class="page-header">
        <h2>Panel de Control</h2>
        <p>Vista general de la plataforma</p>
      </div>

      <div class="stats-grid">
        ${Components.createStatCard('Total Tenants', tenants.length, 'info')}
        ${Components.createStatCard('Tenants Activos', activeTenants, 'success')}
        ${Components.createStatCard('Total Alumnos', totalStudents, 'info')}
        ${Components.createStatCard('Eventos Hoy', totalEvents, 'warning')}
      </div>

      <div class="section">
        <div class="section-header">
          <h3>Tenants Recientes</h3>
          <a href="#/super-admin/tenants" class="btn btn-secondary btn-sm">Ver todos</a>
        </div>

        <div class="tenants-list">
          ${tenants.slice(0, 5).map(tenant => `
            <div class="tenant-card" onclick="Router.navigate('/super-admin/tenant/${tenant.id}')">
              <div class="tenant-info">
                <div class="tenant-name">${Components.escapeHtml(tenant.name)}</div>
                <div class="tenant-slug">${Components.escapeHtml(tenant.slug)}</div>
              </div>
              <div class="tenant-stats">
                <span class="tenant-plan chip chip-${tenant.plan === 'enterprise' ? 'blue' : tenant.plan === 'pro' ? 'green' : 'gray'}">${Components.escapeHtml(tenant.plan || 'basic')}</span>
                <span class="chip chip-${tenant.is_active ? 'green' : 'red'}">${tenant.is_active ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
          `).join('') || '<p class="empty-message">No hay tenants registrados</p>'}
        </div>
      </div>

      <style>
        .tenants-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .tenant-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: var(--bg-secondary, #f9fafb);
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .tenant-card:hover {
          background: var(--bg-tertiary, #f3f4f6);
        }
        .tenant-name {
          font-weight: 600;
          color: var(--text-primary, #111827);
        }
        .tenant-slug {
          font-size: 0.875rem;
          color: var(--text-secondary, #6b7280);
        }
        .tenant-stats {
          display: flex;
          gap: 0.5rem;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .empty-message {
          text-align: center;
          color: var(--text-secondary, #6b7280);
          padding: 2rem;
        }
      </style>
    `;

  } catch (error) {
    console.error('Error loading dashboard:', error);
    content.innerHTML = `
      <div class="error-state">
        <h3>Error al cargar datos</h3>
        <p>${Components.escapeHtml(error.message)}</p>
        <button class="btn btn-primary" onclick="Views.superAdminDashboard()">Reintentar</button>
      </div>
    `;
  }
};
