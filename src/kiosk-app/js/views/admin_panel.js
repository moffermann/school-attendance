// Admin Panel - Accessible only by teachers
Views.adminPanel = function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    ${UI.createHeader()}
    <div class="container">
      <div class="card">
        <div class="card-header">Panel de Administración</div>
        <p style="margin-bottom: 2rem; color: var(--color-gray-500);">
          Acceso exclusivo para profesores y personal autorizado
        </p>

        <div class="admin-menu-grid">
          <div class="admin-menu-item" onclick="Router.navigate('/queue')">
            <div class="admin-menu-icon">📋</div>
            <div class="admin-menu-title">Cola de Sincronización</div>
            <div class="admin-menu-desc">Ver eventos pendientes (${State.getPendingCount()})</div>
          </div>

          <div class="admin-menu-item" onclick="Router.navigate('/device')">
            <div class="admin-menu-icon">📊</div>
            <div class="admin-menu-title">Estado del Dispositivo</div>
            <div class="admin-menu-desc">Información y diagnóstico</div>
          </div>

          <div class="admin-menu-item" onclick="Router.navigate('/settings')">
            <div class="admin-menu-icon">⚙️</div>
            <div class="admin-menu-title">Configuración</div>
            <div class="admin-menu-desc">Ajustes del tótem</div>
          </div>

          <div class="admin-menu-item" onclick="Router.navigate('/help')">
            <div class="admin-menu-icon">❓</div>
            <div class="admin-menu-title">Ayuda</div>
            <div class="admin-menu-desc">Guía de uso y tokens de prueba</div>
          </div>
        </div>

        <div class="mt-3">
          <button class="btn btn-secondary btn-lg" onclick="Router.navigate('/home')">
            ← Volver al Escaneo
          </button>
        </div>
      </div>
    </div>
  `;
};
