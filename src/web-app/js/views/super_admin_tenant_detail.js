/**
 * Super Admin Tenant Detail View
 */
window.Views = window.Views || {};

Views.superAdminTenantDetail = async function(tenantId) {
  const app = document.getElementById('app');
  app.innerHTML = Components.createSuperAdminLayout('tenants');

  const content = document.getElementById('view-content');
  content.innerHTML = Components.createLoader('Cargando tenant...');

  let tenant = null;
  let features = {};
  let config = null;

  async function loadData() {
    try {
      [tenant, features, config] = await Promise.all([
        SuperAdminAPI.getTenant(tenantId),
        SuperAdminAPI.getTenantFeatures(tenantId),
        SuperAdminAPI.getTenantConfig(tenantId),
      ]);
      render();
    } catch (error) {
      content.innerHTML = `
        <div class="error-state">
          <h3>Error al cargar tenant</h3>
          <p>${Components.escapeHtml(error.message)}</p>
          <button class="btn btn-secondary" onclick="Router.navigate('/super-admin/tenants')">Volver a lista</button>
        </div>
      `;
    }
  }

  function render() {
    const featuresList = features.features || features || [];

    content.innerHTML = `
      <div class="page-header">
        <div class="breadcrumb">
          <a href="#/super-admin/tenants">Tenants</a> / ${Components.escapeHtml(tenant.name)}
        </div>
        <div class="header-actions">
          ${tenant.is_active
            ? `<button class="btn btn-danger" onclick="confirmDeactivateTenant()">Desactivar</button>`
            : `<button class="btn btn-success" onclick="activateThisTenant()">Activar</button>`
          }
        </div>
      </div>

      <div class="tenant-detail-grid">
        <!-- Info Card -->
        <div class="card">
          <div class="card-header">
            <h3>Información General</h3>
            <button class="btn btn-sm btn-secondary" onclick="showEditTenantModal()">Editar</button>
          </div>
          <div class="card-body">
            <div class="info-row">
              <span class="info-label">Nombre:</span>
              <span class="info-value">${Components.escapeHtml(tenant.name)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Slug:</span>
              <span class="info-value"><code>${Components.escapeHtml(tenant.slug)}</code></span>
            </div>
            <div class="info-row">
              <span class="info-label">Dominio:</span>
              <span class="info-value">${Components.escapeHtml(tenant.domain || '-')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Subdominio:</span>
              <span class="info-value">${Components.escapeHtml(tenant.subdomain || '-')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Plan:</span>
              <span class="info-value">${Components.createChip(tenant.plan || 'basic', tenant.plan === 'enterprise' ? 'blue' : tenant.plan === 'pro' ? 'green' : 'gray')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Máx. Alumnos:</span>
              <span class="info-value">${tenant.max_students || 'Sin límite'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Estado:</span>
              <span class="info-value">${Components.createChip(tenant.is_active ? 'Activo' : 'Inactivo', tenant.is_active ? 'green' : 'red')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Creado:</span>
              <span class="info-value">${Components.formatDateTime(tenant.created_at)}</span>
            </div>
          </div>
        </div>

        <!-- Admin Card -->
        <div class="card">
          <div class="card-header">
            <h3>Administrador</h3>
          </div>
          <div class="card-body">
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${Components.escapeHtml(tenant.admin_email || '-')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Estado:</span>
              <span class="info-value">${tenant.admin_setup_complete
                ? Components.createChip('Configurado', 'green')
                : Components.createChip('Pendiente', 'yellow')
              }</span>
            </div>
            <div class="admin-actions">
              ${!tenant.admin_setup_complete
                ? `<button class="btn btn-secondary btn-sm" onclick="resendInvitation()">Reenviar Invitación</button>`
                : `<button class="btn btn-secondary btn-sm" onclick="resetAdminPassword()">Resetear Contraseña</button>`
              }
              <button class="btn btn-primary btn-sm" onclick="impersonateTenant()">Acceder como Admin</button>
            </div>
          </div>
        </div>

        <!-- Features Card -->
        <div class="card">
          <div class="card-header">
            <h3>Módulos Habilitados</h3>
          </div>
          <div class="card-body">
            <div class="features-list">
              ${featuresList.map(f => `
                <label class="feature-toggle">
                  <input type="checkbox"
                         ${f.is_enabled ? 'checked' : ''}
                         onchange="toggleFeature('${f.feature_name}', this.checked)">
                  <span class="feature-name">${getFeatureLabel(f.feature_name)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Config Card -->
        <div class="card">
          <div class="card-header">
            <h3>Configuración</h3>
          </div>
          <div class="card-body">
            <div class="config-section">
              <h4>WhatsApp</h4>
              <div class="info-row">
                <span class="info-label">Estado:</span>
                <span class="info-value">${config.whatsapp_configured
                  ? Components.createChip('Configurado', 'green')
                  : Components.createChip('No configurado', 'gray')
                }</span>
              </div>
              ${config.whatsapp_phone_number_id ? `
              <div class="info-row">
                <span class="info-label">Phone ID:</span>
                <span class="info-value"><code>${Components.escapeHtml(config.whatsapp_phone_number_id)}</code></span>
              </div>
              ` : ''}
              <button class="btn btn-sm btn-secondary" onclick="showWhatsAppConfigModal()">Configurar</button>
            </div>

            <div class="config-section">
              <h4>Email (SES)</h4>
              <div class="info-row">
                <span class="info-label">Estado:</span>
                <span class="info-value">${config.ses_configured
                  ? Components.createChip('Configurado', 'green')
                  : Components.createChip('No configurado', 'gray')
                }</span>
              </div>
              ${config.ses_source_email ? `
              <div class="info-row">
                <span class="info-label">Remitente:</span>
                <span class="info-value">${Components.escapeHtml(config.ses_source_email)}</span>
              </div>
              ` : ''}
              <button class="btn btn-sm btn-secondary" onclick="showEmailConfigModal()">Configurar</button>
            </div>

            <div class="config-section">
              <h4>Almacenamiento (S3)</h4>
              <div class="info-row">
                <span class="info-label">Bucket:</span>
                <span class="info-value">${Components.escapeHtml(config.s3_bucket || 'No configurado')}</span>
              </div>
              <button class="btn btn-sm btn-secondary" onclick="showS3ConfigModal()">Configurar</button>
            </div>

            <div class="config-section">
              <h4>Device API Key</h4>
              <div class="info-row">
                <span class="info-label">Estado:</span>
                <span class="info-value">${config.device_api_key_configured
                  ? Components.createChip('Configurado', 'green')
                  : Components.createChip('No configurado', 'gray')
                }</span>
              </div>
              <button class="btn btn-sm btn-secondary" onclick="generateDeviceKey()">Generar Nueva Clave</button>
            </div>
          </div>
        </div>
      </div>

      <style>
        .tenant-detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
        }
        .card {
          background: var(--bg-primary, white);
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: var(--bg-secondary, #f9fafb);
          border-bottom: 1px solid var(--border-color, #e5e7eb);
        }
        .card-header h3 {
          margin: 0;
          font-size: 1rem;
        }
        .card-body {
          padding: 1.5rem;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border-color, #f3f4f6);
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          color: var(--text-secondary, #6b7280);
          font-size: 0.875rem;
        }
        .info-value {
          font-weight: 500;
        }
        .admin-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }
        .features-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .feature-toggle {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }
        .feature-toggle input {
          width: 18px;
          height: 18px;
          accent-color: var(--primary, #3b82f6);
        }
        .config-section {
          padding: 1rem 0;
          border-bottom: 1px solid var(--border-color, #e5e7eb);
        }
        .config-section:last-child {
          border-bottom: none;
        }
        .config-section h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          color: var(--text-secondary, #6b7280);
        }
        .config-section .btn {
          margin-top: 0.75rem;
        }
        .breadcrumb {
          font-size: 0.875rem;
          color: var(--text-secondary, #6b7280);
        }
        .breadcrumb a {
          color: var(--primary, #3b82f6);
          text-decoration: none;
        }
        code {
          background: var(--bg-secondary, #f3f4f6);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.875rem;
        }
      </style>
    `;
  }

  function getFeatureLabel(name) {
    const labels = {
      webauthn: 'Autenticación Biométrica',
      broadcasts: 'Comunicados Masivos',
      reports: 'Reportes Avanzados',
      whatsapp: 'Notificaciones WhatsApp',
      email: 'Notificaciones Email',
      photo_evidence: 'Evidencia Fotográfica',
      audio_evidence: 'Evidencia de Audio',
      multiple_gates: 'Múltiples Puertas',
      api_access: 'Acceso API Externo',
    };
    return labels[name] || name;
  }

  // Global functions
  window.toggleFeature = async (featureName, enabled) => {
    try {
      await SuperAdminAPI.toggleFeature(tenantId, featureName, enabled);
      Components.showToast(`Módulo ${enabled ? 'habilitado' : 'deshabilitado'}`, 'success');
    } catch (error) {
      Components.showToast(error.message, 'error');
      loadData(); // Reload to reset checkbox
    }
  };

  window.confirmDeactivateTenant = () => {
    Components.showModal(
      'Confirmar desactivación',
      `<p>¿Está seguro que desea desactivar el tenant <strong>${Components.escapeHtml(tenant.name)}</strong>?</p>`,
      [
        { label: 'Cancelar', action: 'close' },
        {
          label: 'Desactivar',
          className: 'btn-danger',
          onClick: async () => {
            try {
              await SuperAdminAPI.deactivateTenant(tenantId);
              Components.showToast('Tenant desactivado', 'success');
              loadData();
            } catch (error) {
              Components.showToast(error.message, 'error');
            }
          }
        }
      ]
    );
  };

  window.activateThisTenant = async () => {
    try {
      await SuperAdminAPI.activateTenant(tenantId);
      Components.showToast('Tenant activado', 'success');
      loadData();
    } catch (error) {
      Components.showToast(error.message, 'error');
    }
  };

  window.resendInvitation = async () => {
    try {
      await SuperAdminAPI.resendInvitation(tenantId);
      Components.showToast('Invitación reenviada', 'success');
    } catch (error) {
      Components.showToast(error.message, 'error');
    }
  };

  window.resetAdminPassword = async () => {
    Components.showModal(
      'Resetear contraseña',
      '<p>Se enviará un email al administrador con un enlace para crear una nueva contraseña.</p>',
      [
        { label: 'Cancelar', action: 'close' },
        {
          label: 'Enviar',
          className: 'btn-primary',
          onClick: async () => {
            try {
              await SuperAdminAPI.resetAdminPassword(tenantId);
              Components.showToast('Email de reseteo enviado', 'success');
            } catch (error) {
              Components.showToast(error.message, 'error');
            }
          }
        }
      ]
    );
  };

  window.impersonateTenant = async () => {
    try {
      const result = await SuperAdminAPI.impersonate(tenantId);
      // BUG-UI-002 fix: Store impersonation token as regular auth token for the new tab
      // and open the correct URL with /app prefix
      localStorage.setItem('impersonationToken', result.access_token);
      localStorage.setItem('impersonatingTenantId', tenantId);
      // Also store as regular auth token so the web-app recognizes it
      localStorage.setItem('authToken', result.access_token);
      // Open in new tab with correct path
      window.open(`/app/#/director/dashboard`, '_blank');
      Components.showToast('Accediendo como administrador del tenant...', 'info');
    } catch (error) {
      Components.showToast(error.message, 'error');
    }
  };

  window.showEditTenantModal = () => {
    const modal = Components.showModal('Editar Tenant', `
      <form id="editTenantForm">
        <div class="form-group">
          <label for="editName">Nombre</label>
          <input type="text" id="editName" value="${Components.escapeHtml(tenant.name)}" required>
        </div>
        <div class="form-group">
          <label for="editDomain">Dominio</label>
          <input type="text" id="editDomain" value="${Components.escapeHtml(tenant.domain || '')}">
        </div>
        <div class="form-group">
          <label for="editSubdomain">Subdominio</label>
          <input type="text" id="editSubdomain" value="${Components.escapeHtml(tenant.subdomain || '')}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="editPlan">Plan</label>
            <select id="editPlan">
              <option value="basic" ${tenant.plan === 'basic' ? 'selected' : ''}>Básico</option>
              <option value="pro" ${tenant.plan === 'pro' ? 'selected' : ''}>Pro</option>
              <option value="enterprise" ${tenant.plan === 'enterprise' ? 'selected' : ''}>Enterprise</option>
            </select>
          </div>
          <div class="form-group">
            <label for="editMaxStudents">Máx. Alumnos</label>
            <input type="number" id="editMaxStudents" value="${tenant.max_students || 500}">
          </div>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close' },
      {
        label: 'Guardar',
        className: 'btn-primary',
        onClick: async () => {
          try {
            await SuperAdminAPI.updateTenant(tenantId, {
              name: document.getElementById('editName').value,
              domain: document.getElementById('editDomain').value || null,
              subdomain: document.getElementById('editSubdomain').value || null,
              plan: document.getElementById('editPlan').value,
              max_students: parseInt(document.getElementById('editMaxStudents').value),
            });
            Components.showToast('Tenant actualizado', 'success');
            modal.close();
            loadData();
          } catch (error) {
            Components.showToast(error.message, 'error');
          }
        }
      }
    ]);
  };

  window.showWhatsAppConfigModal = () => {
    Components.showModal('Configurar WhatsApp', `
      <form id="whatsappForm">
        <div class="form-group">
          <label for="waAccessToken">Access Token</label>
          <input type="password" id="waAccessToken" placeholder="Ingrese nuevo token para cambiar">
        </div>
        <div class="form-group">
          <label for="waPhoneId">Phone Number ID</label>
          <input type="text" id="waPhoneId" value="${Components.escapeHtml(config.whatsapp_phone_number_id || '')}">
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close' },
      {
        label: 'Guardar',
        className: 'btn-primary',
        onClick: async () => {
          try {
            const data = {
              phone_number_id: document.getElementById('waPhoneId').value || null,
            };
            const token = document.getElementById('waAccessToken').value;
            if (token) data.access_token = token;

            await SuperAdminAPI.updateWhatsAppConfig(tenantId, data);
            Components.showToast('Configuración guardada', 'success');
            loadData();
          } catch (error) {
            Components.showToast(error.message, 'error');
          }
        }
      }
    ]);
  };

  window.showEmailConfigModal = () => {
    Components.showModal('Configurar Email (SES)', `
      <form id="emailForm">
        <div class="form-group">
          <label for="sesRegion">Región</label>
          <input type="text" id="sesRegion" value="${Components.escapeHtml(config.ses_region || 'us-east-1')}">
        </div>
        <div class="form-group">
          <label for="sesSourceEmail">Email Remitente</label>
          <input type="email" id="sesSourceEmail" value="${Components.escapeHtml(config.ses_source_email || '')}">
        </div>
        <div class="form-group">
          <label for="sesAccessKey">Access Key</label>
          <input type="password" id="sesAccessKey" placeholder="Ingrese nuevo valor para cambiar">
        </div>
        <div class="form-group">
          <label for="sesSecretKey">Secret Key</label>
          <input type="password" id="sesSecretKey" placeholder="Ingrese nuevo valor para cambiar">
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close' },
      {
        label: 'Guardar',
        className: 'btn-primary',
        onClick: async () => {
          try {
            const data = {
              region: document.getElementById('sesRegion').value || null,
              source_email: document.getElementById('sesSourceEmail').value || null,
            };
            const accessKey = document.getElementById('sesAccessKey').value;
            const secretKey = document.getElementById('sesSecretKey').value;
            if (accessKey) data.access_key = accessKey;
            if (secretKey) data.secret_key = secretKey;

            await SuperAdminAPI.updateEmailConfig(tenantId, data);
            Components.showToast('Configuración guardada', 'success');
            loadData();
          } catch (error) {
            Components.showToast(error.message, 'error');
          }
        }
      }
    ]);
  };

  window.showS3ConfigModal = () => {
    Components.showModal('Configurar S3', `
      <form id="s3Form">
        <div class="form-group">
          <label for="s3Bucket">Bucket</label>
          <input type="text" id="s3Bucket" value="${Components.escapeHtml(config.s3_bucket || '')}">
        </div>
        <div class="form-group">
          <label for="s3Prefix">Prefix</label>
          <input type="text" id="s3Prefix" value="${Components.escapeHtml(config.s3_prefix || '')}" placeholder="tenants/nombre/">
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close' },
      {
        label: 'Guardar',
        className: 'btn-primary',
        onClick: async () => {
          try {
            await SuperAdminAPI.updateS3Config(tenantId, {
              bucket: document.getElementById('s3Bucket').value || null,
              prefix: document.getElementById('s3Prefix').value || null,
            });
            Components.showToast('Configuración guardada', 'success');
            loadData();
          } catch (error) {
            Components.showToast(error.message, 'error');
          }
        }
      }
    ]);
  };

  window.generateDeviceKey = async () => {
    Components.showModal(
      'Generar Device API Key',
      '<p>Se generará una nueva clave. La clave anterior dejará de funcionar.</p><p><strong>La clave solo se mostrará una vez.</strong></p>',
      [
        { label: 'Cancelar', action: 'close' },
        {
          label: 'Generar',
          className: 'btn-primary',
          onClick: async () => {
            try {
              const result = await SuperAdminAPI.generateDeviceKey(tenantId);
              Components.showModal(
                'Nueva Device API Key',
                `<p>Guarde esta clave en un lugar seguro. No podrá verla nuevamente.</p>
                 <div class="code-block">
                   <code id="deviceKeyValue">${Components.escapeHtml(result.device_api_key)}</code>
                   <button class="btn btn-sm btn-secondary" onclick="copyToClipboard('deviceKeyValue')">Copiar</button>
                 </div>
                 <style>
                   .code-block {
                     display: flex;
                     gap: 0.5rem;
                     align-items: center;
                     background: var(--bg-secondary, #f3f4f6);
                     padding: 1rem;
                     border-radius: 8px;
                     margin-top: 1rem;
                   }
                   .code-block code {
                     flex: 1;
                     word-break: break-all;
                   }
                 </style>`,
                [{ label: 'Cerrar', action: 'close' }]
              );
              loadData();
            } catch (error) {
              Components.showToast(error.message, 'error');
            }
          }
        }
      ]
    );
  };

  window.copyToClipboard = (elementId) => {
    const el = document.getElementById(elementId);
    navigator.clipboard.writeText(el.textContent);
    Components.showToast('Copiado al portapapeles', 'success');
  };

  await loadData();
};
