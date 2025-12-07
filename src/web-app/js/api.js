/**
 * API client for web-app
 * Extends shared base with web-app specific methods
 *
 * Note: Requires api-base.js to be loaded first (createApiClient function)
 * Include in HTML: <script src="/lib/api-base.js"></script>
 */
const API = Object.assign(createApiClient('webAppConfig'), {

  // ==================== Web App API Methods ====================

  /**
   * Get bootstrap data (user info, courses, students, etc.)
   */
  async getBootstrap() {
    const response = await this.request('/web-app/bootstrap');
    if (!response.ok) {
      throw new Error('No se pudo obtener datos iniciales');
    }
    return response.json();
  },

  /**
   * Get dashboard snapshot for a date
   */
  async getDashboard(filters = {}) {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.courseId) params.append('course_id', filters.courseId);
    if (filters.type) params.append('type', filters.type);
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString();
    const response = await this.request(`/web-app/dashboard${queryString ? '?' + queryString : ''}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener el dashboard');
    }
    return response.json();
  },

  /**
   * Export dashboard to CSV
   */
  async exportDashboardCSV(filters = {}) {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.courseId) params.append('course_id', filters.courseId);
    if (filters.type) params.append('type', filters.type);
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString();
    const response = await this.request(`/web-app/dashboard/export${queryString ? '?' + queryString : ''}`);
    if (!response.ok) {
      throw new Error('No se pudo exportar el dashboard');
    }
    return response.blob();
  },

  /**
   * Get reports data for date range
   */
  async getReports(startDate, endDate, courseId = null) {
    const params = new URLSearchParams();
    params.append('start', startDate);
    params.append('end', endDate);
    if (courseId) params.append('course_id', courseId);

    const response = await this.request(`/web-app/reports?${params.toString()}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener los reportes');
    }
    return response.json();
  },

  // ==================== Absences API ====================

  /**
   * List absence requests
   */
  async getAbsences(filters = {}) {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);
    if (filters.status) params.append('status', filters.status);

    const queryString = params.toString();
    const response = await this.request(`/absences${queryString ? '?' + queryString : ''}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener las ausencias');
    }
    return response.json();
  },

  /**
   * Submit absence request
   */
  async submitAbsence(data) {
    const response = await this.request('/absences', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al crear solicitud' }));
      throw new Error(error.detail || 'Error al crear solicitud');
    }
    return response.json();
  },

  /**
   * Update absence status (approve/reject)
   */
  async updateAbsenceStatus(absenceId, status) {
    const response = await this.request(`/absences/${absenceId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al actualizar estado' }));
      throw new Error(error.detail || 'Error al actualizar estado');
    }
    return response.json();
  },

  // ==================== Parent API ====================

  /**
   * Get guardian preferences
   */
  async getGuardianPreferences(guardianId) {
    const response = await this.request(`/parents/${guardianId}/preferences`);
    if (!response.ok) {
      throw new Error('No se pudo obtener preferencias');
    }
    return response.json();
  },

  /**
   * Update guardian preferences
   */
  async updateGuardianPreferences(guardianId, preferences) {
    const response = await this.request(`/parents/${guardianId}/preferences`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al actualizar preferencias' }));
      throw new Error(error.detail || 'Error al actualizar preferencias');
    }
    return response.json();
  },

  // ==================== Devices API ====================

  /**
   * Get devices list
   */
  async getDevices() {
    const response = await this.request('/devices');
    if (!response.ok) {
      throw new Error('No se pudo obtener dispositivos');
    }
    return response.json();
  },

  // ==================== Schedules API ====================

  /**
   * Get schedules
   */
  async getSchedules(courseId = null) {
    const params = courseId ? `?course_id=${courseId}` : '';
    const response = await this.request(`/schedules${params}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener horarios');
    }
    return response.json();
  },

  /**
   * Update schedule
   */
  async updateSchedule(scheduleId, data) {
    const response = await this.request(`/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('No se pudo actualizar horario');
    }
    return response.json();
  },

  // ==================== Notifications API ====================

  /**
   * Get notifications log
   */
  async getNotifications(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.channel) params.append('channel', filters.channel);
    if (filters.type) params.append('type', filters.type);
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);

    const queryString = params.toString();
    const response = await this.request(`/notifications${queryString ? '?' + queryString : ''}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener notificaciones');
    }
    return response.json();
  },

  // ==================== Broadcast API ====================

  /**
   * Send broadcast message
   */
  async sendBroadcast(data) {
    // R11-1 fix: Use correct route /broadcasts/send (not /broadcast)
    const response = await this.request('/broadcasts/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al enviar mensaje' }));
      throw new Error(error.detail || 'Error al enviar mensaje');
    }
    return response.json();
  },

  // ==================== Super Admin API ====================

  /**
   * List all tenants (super admin only)
   */
  async listTenants(includeInactive = false) {
    const params = includeInactive ? '?include_inactive=true' : '';
    const response = await this.request(`/super-admin/tenants${params}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener tenants');
    }
    return response.json();
  },

  /**
   * Get tenant details (super admin only)
   */
  async getTenant(tenantId) {
    const response = await this.request(`/super-admin/tenants/${tenantId}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener tenant');
    }
    return response.json();
  },

  /**
   * Impersonate a tenant (super admin only)
   * Returns a token to access the tenant as if you were a DIRECTOR
   */
  async impersonateTenant(tenantId) {
    const response = await this.request(`/super-admin/tenants/${tenantId}/impersonate`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al impersonar tenant' }));
      throw new Error(error.detail || 'Error al impersonar tenant');
    }
    return response.json();
  },

  /**
   * Start impersonation session - switches to tenant context
   */
  async startImpersonation(tenantId) {
    // Store current tokens for later restoration
    const originalAccessToken = this.accessToken;
    const originalRefreshToken = this.refreshToken;

    // Store in sessionStorage for restoration
    sessionStorage.setItem('impersonation_original_access', originalAccessToken);
    sessionStorage.setItem('impersonation_original_refresh', originalRefreshToken);

    // Get impersonation token
    const impersonation = await this.impersonateTenant(tenantId);

    // Switch to impersonation token
    this.accessToken = impersonation.access_token;
    this.refreshToken = null; // No refresh token for impersonation

    // Store impersonation info
    sessionStorage.setItem('impersonation_tenant_id', impersonation.tenant_id);
    sessionStorage.setItem('impersonation_tenant_name', impersonation.tenant_name);

    return impersonation;
  },

  /**
   * End impersonation session - returns to super admin context
   */
  endImpersonation() {
    // Restore original tokens
    const originalAccessToken = sessionStorage.getItem('impersonation_original_access');
    const originalRefreshToken = sessionStorage.getItem('impersonation_original_refresh');

    if (originalAccessToken) {
      this.accessToken = originalAccessToken;
      this.refreshToken = originalRefreshToken;
    }

    // Clear impersonation data
    sessionStorage.removeItem('impersonation_original_access');
    sessionStorage.removeItem('impersonation_original_refresh');
    sessionStorage.removeItem('impersonation_tenant_id');
    sessionStorage.removeItem('impersonation_tenant_name');
  },

  /**
   * Check if currently in impersonation mode
   */
  isImpersonating() {
    return !!sessionStorage.getItem('impersonation_tenant_id');
  },

  /**
   * Get current impersonation info
   */
  getImpersonationInfo() {
    const tenantId = sessionStorage.getItem('impersonation_tenant_id');
    if (!tenantId) return null;

    return {
      tenantId: parseInt(tenantId),
      tenantName: sessionStorage.getItem('impersonation_tenant_name'),
    };
  },
});
