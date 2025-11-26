/**
 * API client for teacher-pwa
 * Handles authentication and communication with backend
 */
const API = {
  // Base URL for API - can be configured via localStorage
  get baseUrl() {
    const config = JSON.parse(localStorage.getItem('pwaConfig') || '{}');
    return config.apiUrl || '/api/v1';
  },

  // Access token storage
  get accessToken() {
    return localStorage.getItem('accessToken');
  },

  set accessToken(token) {
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  },

  get refreshToken() {
    return localStorage.getItem('refreshToken');
  },

  set refreshToken(token) {
    if (token) {
      localStorage.setItem('refreshToken', token);
    } else {
      localStorage.removeItem('refreshToken');
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

  // ==================== Teacher API Methods ====================

  /**
   * Get current teacher profile and courses
   */
  async getTeacherMe() {
    const response = await this.request('/teachers/me');
    if (!response.ok) {
      throw new Error('No se pudo obtener perfil del profesor');
    }
    return response.json();
  },

  /**
   * Get students for a course
   */
  async getCourseStudents(courseId) {
    const response = await this.request(`/teachers/courses/${courseId}/students`);
    if (!response.ok) {
      throw new Error('No se pudo obtener lista de estudiantes');
    }
    return response.json();
  },

  /**
   * Submit bulk attendance events
   */
  async submitBulkAttendance(courseId, gateId, deviceId, events) {
    const response = await this.request('/teachers/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({
        course_id: courseId,
        gate_id: gateId,
        device_id: deviceId,
        events: events,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al enviar asistencia' }));
      throw new Error(error.detail || 'Error al enviar asistencia');
    }

    return response.json();
  },

  /**
   * Submit a single attendance event (for real-time sync)
   */
  async submitAttendanceEvent(event) {
    const response = await this.request('/attendance/events', {
      method: 'POST',
      body: JSON.stringify({
        student_id: event.student_id,
        type: event.type,
        gate_id: event.gate_id || 'PWA',
        device_id: event.device_id,
        occurred_at: event.occurred_at,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al registrar evento' }));
      throw new Error(error.detail || 'Error al registrar evento');
    }

    return response.json();
  },
};
