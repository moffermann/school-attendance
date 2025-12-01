/**
 * API client for web-app
 * Handles authentication and communication with backend
 */
const API = {
  // Base URL for API - can be configured via localStorage
  get baseUrl() {
    const config = JSON.parse(localStorage.getItem('webAppConfig') || '{}');
    return config.apiUrl || '/api/v1';
  },

  // Access token storage - use sessionStorage to limit XSS exposure
  // Tokens are cleared when browser tab closes
  get accessToken() {
    return sessionStorage.getItem('accessToken');
  },

  set accessToken(token) {
    if (token) {
      sessionStorage.setItem('accessToken', token);
    } else {
      sessionStorage.removeItem('accessToken');
    }
  },

  // Refresh token - also in sessionStorage for security
  // Note: For better security, consider HttpOnly cookies in backend
  get refreshToken() {
    return sessionStorage.getItem('refreshToken');
  },

  set refreshToken(token) {
    if (token) {
      sessionStorage.setItem('refreshToken', token);
    } else {
      sessionStorage.removeItem('refreshToken');
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken;
  },

  /**
   * Make an authenticated request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 - try to refresh token
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // Retry the original request with new token
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          return fetch(url, { ...options, headers });
        }
      }

      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  /**
   * Try to refresh the access token
   */
  async tryRefreshToken() {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    // Refresh failed - clear tokens
    this.logout();
    return false;
  },

  /**
   * Login with email and password
   */
  async login(email, password) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error de autenticación' }));
      throw new Error(error.detail || 'Error de autenticación');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    return data;
  },

  /**
   * Logout - clear all tokens
   */
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
  },

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
    const response = await this.request('/broadcast', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al enviar mensaje' }));
      throw new Error(error.detail || 'Error al enviar mensaje');
    }
    return response.json();
  },
};
