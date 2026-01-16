/**
 * API client for web-app
 * Extends shared base with web-app specific methods
 *
 * Note: Requires api-base.js to be loaded first (createApiClient function)
 * Include in HTML: <script src="/lib/api-base.js"></script>
 */
const API = Object.assign(createApiClient('webAppConfig'), {

  // ==================== Image Cache for Authenticated Photos ====================
  imageCache: new Map(),
  MAX_CACHE_SIZE: 50,

  /**
   * Load an image with authentication headers and return a blob URL
   * Used for displaying photos that require JWT authentication
   * @param {string} url - Full URL to the image
   * @returns {Promise<string|null>} - Blob URL or null on error
   */
  async loadAuthenticatedImage(url) {
    try {
      // Check cache first
      if (this.imageCache.has(url)) {
        return this.imageCache.get(url);
      }

      // Loading timeout of 10 seconds
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const headers = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error('Image load failed:', response.status, url);
        return null;
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // LRU cache: remove oldest entry if at capacity
      if (this.imageCache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.imageCache.keys().next().value;
        const oldBlobUrl = this.imageCache.get(firstKey);
        URL.revokeObjectURL(oldBlobUrl);
        this.imageCache.delete(firstKey);
      }

      this.imageCache.set(url, blobUrl);
      return blobUrl;

    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Image load timeout:', url);
      } else {
        console.error('Error loading image:', error);
      }
      return null;
    }
  },

  /**
   * Clear all cached image blob URLs
   * Should be called on logout to prevent memory leaks
   */
  clearImageCache() {
    this.imageCache.forEach(blobUrl => URL.revokeObjectURL(blobUrl));
    this.imageCache.clear();
  },

  /**
   * Override logout to also clear image cache
   */
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.clearImageCache();
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
   * List absence requests (legacy endpoint)
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
   * List absences with pagination (new enterprise endpoint)
   * @param {Object} filters - status, type, course_id, start_date, end_date
   * @param {number} offset - pagination offset
   * @param {number} limit - max results per page
   */
  async getAbsencesPaginated(filters = {}, offset = 0, limit = 50) {
    const params = new URLSearchParams();
    params.append('offset', offset);
    params.append('limit', limit);
    if (filters.status) params.append('status', filters.status);
    if (filters.type) params.append('type', filters.type);
    if (filters.course_id) params.append('course_id', filters.course_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const response = await this.request(`/absences/paginated?${params.toString()}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener las ausencias');
    }
    return response.json();
  },

  /**
   * Get absence statistics (counts by status)
   */
  async getAbsenceStats() {
    const response = await this.request('/absences/stats');
    if (!response.ok) {
      throw new Error('No se pudo obtener estadisticas');
    }
    return response.json();
  },

  /**
   * Search absences by student name or comment
   */
  async searchAbsences(query, limit = 20) {
    const params = new URLSearchParams({ q: query, limit: limit });
    const response = await this.request(`/absences/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Error en la busqueda');
    }
    return response.json();
  },

  /**
   * Export absences to CSV
   */
  async exportAbsencesCSV(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const response = await this.request(`/absences/export?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Error al exportar');
    }
    return response.blob();
  },

  /**
   * Submit absence request (legacy)
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
   * Update absence status (legacy - approve/reject)
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

  /**
   * Approve an absence request
   */
  async approveAbsence(absenceId) {
    const response = await this.request(`/absences/${absenceId}/approve`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al aprobar' }));
      throw new Error(error.detail || 'Error al aprobar solicitud');
    }
    return response.json();
  },

  /**
   * Reject an absence request with optional reason
   */
  async rejectAbsence(absenceId, rejectionReason = null) {
    const response = await this.request(`/absences/${absenceId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al rechazar' }));
      throw new Error(error.detail || 'Error al rechazar solicitud');
    }
    return response.json();
  },

  /**
   * Delete a pending absence request
   */
  async deleteAbsence(absenceId) {
    const response = await this.request(`/absences/${absenceId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al eliminar' }));
      throw new Error(error.detail || 'Error al eliminar solicitud');
    }
    return response.json();
  },

  /**
   * Upload attachment for an absence request
   * @param {number} absenceId - Absence request ID
   * @param {File} file - File to upload (PDF, JPG, PNG, max 5MB)
   * @returns {Promise<Object>} Updated absence with attachment_url
   */
  async uploadAbsenceAttachment(absenceId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.requestMultipart(`/absences/${absenceId}/attachment`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al subir archivo' }));
      if (response.status === 400) {
        throw new Error(error.detail || 'Archivo no válido');
      } else if (response.status === 404) {
        throw new Error('Solicitud no encontrada');
      } else if (response.status === 403) {
        throw new Error('Sin permisos para adjuntar archivo');
      }
      throw new Error(error.detail || 'Error al subir archivo');
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

  /**
   * Create a new device
   * @param {Object} data - Device data
   * @param {string} data.device_id - Unique device identifier
   * @param {string} data.gate_id - Gate/door identifier
   * @param {string} [data.firmware_version] - Firmware version
   * @returns {Promise<Object>} Created device
   */
  async createDevice(data) {
    const response = await this.request('/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 409) {
        throw new Error(error.detail || 'Ya existe un dispositivo con ese ID');
      }
      throw new Error(error.detail || 'No se pudo crear el dispositivo');
    }
    return response.json();
  },

  /**
   * Update an existing device
   * @param {number} deviceId - Device ID (numeric)
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated device
   */
  async updateDevice(deviceId, data) {
    const response = await this.request(`/devices/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Dispositivo no encontrado');
      }
      if (response.status === 409) {
        throw new Error(error.detail || 'Ya existe un dispositivo con ese ID');
      }
      throw new Error(error.detail || 'No se pudo actualizar el dispositivo');
    }
    return response.json();
  },

  /**
   * Delete a device
   * @param {number} deviceId - Device ID (numeric)
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteDevice(deviceId) {
    const response = await this.request(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Dispositivo no encontrado');
      }
      throw new Error(error.detail || 'No se pudo eliminar el dispositivo');
    }
    return true;
  },

  /**
   * Ping a device to check connectivity
   * @param {number} deviceId - Device ID (numeric)
   * @returns {Promise<Object>} Device with updated last_sync
   */
  async pingDevice(deviceId) {
    const response = await this.request(`/devices/${deviceId}/ping`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Dispositivo no encontrado');
      }
      throw new Error(error.detail || 'No se pudo hacer ping al dispositivo');
    }
    return response.json();
  },

  /**
   * Get device logs
   * @param {number} deviceId - Device ID (numeric)
   * @returns {Promise<string[]>} Array of log entries
   */
  async getDeviceLogs(deviceId) {
    const response = await this.request(`/devices/${deviceId}/logs`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Dispositivo no encontrado');
      }
      throw new Error(error.detail || 'No se pudo obtener los logs');
    }
    return response.json();
  },

  // ==================== Tags API ====================

  /**
   * Provision a new NFC/QR tag for a student
   * @param {number} studentId - Student ID
   * @returns {Promise<{ndef_uri: string, tag_token_preview: string, checksum: string}>}
   */
  async provisionTag(studentId) {
    const response = await this.request('/tags/provision', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 403) {
        throw new Error('No tienes permisos para generar tags');
      } else if (response.status === 404) {
        throw new Error('Estudiante no encontrado');
      } else if (response.status === 409) {
        throw new Error('Ya existe un proceso de enrolamiento activo. Espere 5 minutos.');
      }
      throw new Error(error.detail || 'No se pudo generar el token del tag');
    }
    return response.json();
  },

  /**
   * Confirm NFC/QR tag write (after writing to hardware)
   * @param {number} studentId
   * @param {string} tagTokenPreview - Preview del token (8 chars)
   * @param {string|null} tagUID - UID del hardware NFC (opcional)
   * @param {string|null} checksum - Checksum para verificación
   * @returns {Promise<{id: number, student_id: number, status: string, tag_token_preview: string}>}
   */
  async confirmTag(studentId, tagTokenPreview, tagUID = null, checksum = null) {
    const body = {
      student_id: studentId,
      tag_token_preview: tagTokenPreview,
    };
    if (tagUID) body.tag_uid = tagUID;
    if (checksum) body.checksum = checksum;

    const response = await this.request('/tags/confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Tag pendiente no encontrado');
      }
      throw new Error(error.detail || 'No se pudo confirmar el tag');
    }
    return response.json();
  },

  /**
   * Revoke an existing tag
   * @param {number} tagId
   */
  async revokeTag(tagId) {
    const response = await this.request(`/tags/${tagId}/revoke`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Tag no encontrado');
      }
      throw new Error(error.detail || 'No se pudo revocar el tag');
    }
    return response.json();
  },

  // ==================== Schedules API ====================

  /**
   * Get schedules for a course
   */
  async getSchedules(courseId) {
    const response = await this.request(`/schedules/courses/${courseId}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener horarios');
    }
    return response.json();
  },

  /**
   * Create a schedule for a course
   */
  async createSchedule(courseId, data) {
    const response = await this.request(`/schedules/courses/${courseId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));

      // Manejo específico por código HTTP
      if (response.status === 403) {
        throw new Error('No tienes permisos para crear horarios');
      } else if (response.status === 400 || response.status === 422) {
        throw new Error(error.detail || 'Datos de horario inválidos');
      } else if (response.status === 404) {
        throw new Error('Curso no encontrado');
      }

      throw new Error(error.detail || 'No se pudo crear horario');
    }
    return response.json();
  },

  /**
   * Update a schedule
   */
  async updateSchedule(scheduleId, data) {
    const response = await this.request(`/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));

      if (response.status === 403) {
        throw new Error('No tienes permisos para modificar horarios');
      } else if (response.status === 404) {
        throw new Error('Horario no encontrado');
      } else if (response.status === 400 || response.status === 422) {
        throw new Error(error.detail || 'Datos de horario inválidos');
      }

      throw new Error(error.detail || 'No se pudo actualizar horario');
    }
    return response.json();
  },

  /**
   * Create a schedule exception (holiday, suspension, modified schedule)
   */
  async createScheduleException(data) {
    const response = await this.request('/schedules/exceptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));

      if (response.status === 403) {
        throw new Error('No tienes permisos para crear excepciones');
      } else if (response.status === 400 || response.status === 422) {
        throw new Error(error.detail || 'Datos de excepcion invalidos');
      }

      throw new Error(error.detail || 'No se pudo crear excepcion');
    }
    return response.json();
  },

  /**
   * Delete a schedule exception
   */
  async deleteScheduleException(exceptionId) {
    const response = await this.request(`/schedules/exceptions/${exceptionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));

      if (response.status === 403) {
        throw new Error('No tienes permisos para eliminar excepciones');
      } else if (response.status === 404) {
        throw new Error('Excepcion no encontrada');
      }

      throw new Error(error.detail || 'No se pudo eliminar excepcion');
    }
    // DELETE returns 204 No Content
    return true;
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

  // ==================== Courses API ====================

  /**
   * List courses with pagination and filters
   */
  async getCourses(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    if (filters.grade) params.append('grade', filters.grade);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString();
    const response = await this.request(`/courses${queryString ? '?' + queryString : ''}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener cursos');
    }
    return response.json();
  },

  /**
   * Get course detail with statistics
   */
  async getCourse(courseId) {
    const response = await this.request(`/courses/${courseId}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Curso no encontrado');
      }
      throw new Error('No se pudo obtener el curso');
    }
    return response.json();
  },

  /**
   * Search courses
   */
  async searchCourses(query, options = {}) {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options.limit) params.append('limit', options.limit);
    if (options.fuzzy) params.append('fuzzy', options.fuzzy);

    const response = await this.request(`/courses/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error('No se pudo buscar cursos');
    }
    return response.json();
  },

  /**
   * Create a new course
   */
  async createCourse(data) {
    const response = await this.request('/courses', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al crear curso' }));
      throw new Error(error.detail || 'Error al crear curso');
    }
    return response.json();
  },

  /**
   * Update a course
   */
  async updateCourse(courseId, data) {
    const response = await this.request(`/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al actualizar curso' }));
      throw new Error(error.detail || 'Error al actualizar curso');
    }
    return response.json();
  },

  /**
   * Delete a course (soft delete)
   */
  async deleteCourse(courseId) {
    const response = await this.request(`/courses/${courseId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al eliminar curso' }));
      throw new Error(error.detail || 'Error al eliminar curso');
    }
    return true;
  },

  /**
   * Export courses to CSV
   */
  async exportCoursesCSV(filters = {}) {
    const params = new URLSearchParams();
    if (filters.grade) params.append('grade', filters.grade);
    if (filters.status) params.append('status', filters.status);

    const queryString = params.toString();
    const response = await this.request(`/courses/export${queryString ? '?' + queryString : ''}`);
    if (!response.ok) {
      throw new Error('No se pudo exportar cursos');
    }
    return response.blob();
  },

  // ==================== Students API ====================

  /**
   * Get student details
   */
  async getStudent(studentId) {
    const response = await this.request(`/students/${studentId}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Estudiante no encontrado');
      }
      throw new Error('No se pudo obtener el estudiante');
    }
    return response.json();
  },

  /**
   * Create a new student
   * @param {Object} data - Student data
   * @param {string} data.full_name - Student's full name (required)
   * @param {number} data.course_id - Course ID (required)
   * @param {string} [data.national_id] - National ID/RUT (optional)
   * @param {string} [data.evidence_preference] - Evidence preference: "photo", "audio", or "none"
   * @returns {Promise<Object>} Created student
   */
  async createStudent(data) {
    const response = await this.request('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al crear estudiante' }));
      if (response.status === 422) {
        throw new Error(error.detail || 'Datos inválidos');
      }
      throw new Error(error.detail || 'Error al crear estudiante');
    }
    return response.json();
  },

  /**
   * Update student
   */
  async updateStudent(studentId, data) {
    const response = await this.request(`/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al actualizar estudiante' }));
      throw new Error(error.detail || 'Error al actualizar estudiante');
    }
    return response.json();
  },

  /**
   * Delete a student
   * @param {number} studentId - Student ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteStudent(studentId) {
    const response = await this.request(`/students/${studentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Estudiante no encontrado');
      }
      const error = await response.json().catch(() => ({ detail: 'Error al eliminar estudiante' }));
      throw new Error(error.detail || 'Error al eliminar estudiante');
    }
    return true;
  },

  /**
   * Upload student photo
   * @param {number} studentId - Student ID
   * @param {File} file - Image file to upload
   * @returns {Promise<{id: number, full_name: string, photo_url: string, photo_presigned_url: string}>}
   */
  async uploadStudentPhoto(studentId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.requestMultipart(`/students/${studentId}/photo`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al subir foto' }));
      if (response.status === 400) {
        throw new Error(error.detail || 'Archivo no válido');
      } else if (response.status === 404) {
        throw new Error('Estudiante no encontrado');
      }
      throw new Error(error.detail || 'Error al subir foto');
    }
    return response.json();
  },

  /**
   * Delete student photo
   */
  async deleteStudentPhoto(studentId) {
    const response = await this.request(`/students/${studentId}/photo`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Estudiante no encontrado');
      }
      throw new Error('Error al eliminar foto');
    }
    return true;
  },

  /**
   * Make multipart/form-data request (for file uploads)
   */
  async requestMultipart(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {};

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Don't set Content-Type - browser will set it automatically with boundary
    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
  },

  // ==================== Guardians API ====================

  /**
   * List guardians with pagination and search
   * @param {Object} params - Query parameters
   * @param {string} [params.q] - Search by name
   * @param {number} [params.skip=0] - Records to skip
   * @param {number} [params.limit=50] - Max records to return
   * @param {string} [params.status] - Filter by status (ACTIVE, DELETED)
   * @returns {Promise<{items: Array, total: number, skip: number, limit: number, has_more: boolean}>}
   */
  async getGuardians(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.q) queryParams.append('q', params.q);
    if (params.skip) queryParams.append('skip', params.skip);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);
    if (params.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    const response = await this.request(`/guardians${queryString ? '?' + queryString : ''}`);

    if (!response.ok) {
      throw new Error('No se pudo obtener apoderados');
    }
    return response.json();
  },

  /**
   * Search guardians by name
   * @param {string} query - Search term
   * @param {Object} options - Search options
   * @param {number} [options.limit=20] - Max results
   * @param {boolean} [options.fuzzy=false] - Use fuzzy search
   * @returns {Promise<Array>} List of matching guardians
   */
  async searchGuardians(query, options = {}) {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options.limit) params.append('limit', options.limit);
    if (options.fuzzy) params.append('fuzzy', options.fuzzy);

    const response = await this.request(`/guardians/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error('No se pudo buscar apoderados');
    }
    return response.json();
  },

  /**
   * Export guardians to CSV
   * @param {Object} filters - Export filters
   * @param {string} [filters.status] - Filter by status
   * @returns {Promise<Blob>} CSV file blob
   */
  async exportGuardiansCSV(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);

    const queryString = params.toString();
    const response = await this.request(`/guardians/export${queryString ? '?' + queryString : ''}`);
    if (!response.ok) {
      throw new Error('No se pudo exportar apoderados');
    }
    return response.blob();
  },

  /**
   * Restore a deleted guardian
   * @param {number} guardianId - Guardian ID
   * @returns {Promise<Object>} Restored guardian
   */
  async restoreGuardian(guardianId) {
    const response = await this.request(`/guardians/${guardianId}/restore`, {
      method: 'PATCH',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Apoderado no encontrado');
      }
      if (response.status === 400) {
        throw new Error(error.detail || 'El apoderado no esta eliminado');
      }
      throw new Error(error.detail || 'Error al restaurar apoderado');
    }
    return response.json();
  },

  /**
   * Get a guardian by ID
   * @param {number} guardianId - Guardian ID
   * @returns {Promise<Object>} Guardian data
   */
  async getGuardian(guardianId) {
    const response = await this.request(`/guardians/${guardianId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Apoderado no encontrado');
      }
      throw new Error('No se pudo obtener el apoderado');
    }
    return response.json();
  },

  /**
   * Create a new guardian
   * @param {Object} data - Guardian data
   * @param {string} data.full_name - Guardian's full name (required)
   * @param {Object} [data.contacts] - Contact information {email, phone, whatsapp}
   * @param {number[]} [data.student_ids] - IDs of students to associate
   * @returns {Promise<Object>} Created guardian
   */
  async createGuardian(data) {
    const response = await this.request('/guardians', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 422) {
        throw new Error(error.detail || 'Datos de apoderado inválidos');
      }
      throw new Error(error.detail || 'Error al crear apoderado');
    }
    return response.json();
  },

  /**
   * Update a guardian
   * @param {number} guardianId - Guardian ID
   * @param {Object} data - Fields to update
   * @param {string} [data.full_name] - Guardian's full name
   * @param {Object} [data.contacts] - Contact information {email, phone, whatsapp}
   * @param {number[]} [data.student_ids] - IDs of students to associate
   * @returns {Promise<Object>} Updated guardian
   */
  async updateGuardian(guardianId, data) {
    const response = await this.request(`/guardians/${guardianId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Apoderado no encontrado');
      }
      if (response.status === 422) {
        throw new Error(error.detail || 'Datos de apoderado inválidos');
      }
      throw new Error(error.detail || 'Error al actualizar apoderado');
    }
    return response.json();
  },

  /**
   * Delete a guardian
   * @param {number} guardianId - Guardian ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteGuardian(guardianId) {
    const response = await this.request(`/guardians/${guardianId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Apoderado no encontrado');
      }
      throw new Error(error.detail || 'Error al eliminar apoderado');
    }
    return true;
  },

  /**
   * Set the complete list of students for a guardian
   * Replaces all existing associations
   * @param {number} guardianId - Guardian ID
   * @param {number[]} studentIds - Array of student IDs
   * @returns {Promise<Object>} Updated guardian with new student_ids
   */
  async setGuardianStudents(guardianId, studentIds) {
    const response = await this.request(`/guardians/${guardianId}/students`, {
      method: 'PUT',
      body: JSON.stringify({ student_ids: studentIds }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Apoderado no encontrado');
      }
      throw new Error(error.detail || 'Error al asociar alumnos');
    }
    return response.json();
  },

  // ==================== Teachers API ====================

  /**
   * List teachers with pagination and search
   * @param {Object} params - Query parameters
   * @param {string} [params.q] - Search by name or email
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.page_size=20] - Records per page
   * @param {string} [params.status] - Filter by status (ACTIVE, INACTIVE, ON_LEAVE, DELETED)
   * @returns {Promise<{items: Array, total: number, page: number, page_size: number, pages: number}>}
   */
  async getTeachers(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.q) queryParams.append('q', params.q);
    if (params.page) queryParams.append('page', params.page);
    if (params.page_size) queryParams.append('page_size', params.page_size);
    if (params.status) queryParams.append('status', params.status);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);

    const queryString = queryParams.toString();
    const response = await this.request(`/teachers${queryString ? '?' + queryString : ''}`);

    if (!response.ok) {
      throw new Error('No se pudo obtener profesores');
    }
    return response.json();
  },

  /**
   * Search teachers by name or email
   * @param {string} query - Search term
   * @param {Object} options - Search options
   * @param {number} [options.limit=20] - Max results
   * @param {boolean} [options.fuzzy=false] - Use fuzzy search
   * @returns {Promise<Array>} List of matching teachers
   */
  async searchTeachers(query, options = {}) {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options.limit) params.append('limit', options.limit);
    if (options.fuzzy) params.append('fuzzy', options.fuzzy);

    const response = await this.request(`/teachers/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error('No se pudo buscar profesores');
    }
    return response.json();
  },

  /**
   * Export teachers to CSV
   * @param {Object} filters - Export filters
   * @param {string} [filters.status] - Filter by status
   * @returns {Promise<Blob>} CSV file blob
   */
  async exportTeachersCSV(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);

    const queryString = params.toString();
    const response = await this.request(`/teachers/export${queryString ? '?' + queryString : ''}`);
    if (!response.ok) {
      throw new Error('No se pudo exportar profesores');
    }
    return response.blob();
  },

  /**
   * Restore a deleted teacher
   * @param {number} teacherId - Teacher ID
   * @returns {Promise<Object>} Restored teacher
   */
  async restoreTeacher(teacherId) {
    const response = await this.request(`/teachers/${teacherId}/restore`, {
      method: 'PATCH',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Profesor no encontrado');
      }
      if (response.status === 400) {
        throw new Error(error.detail || 'El profesor no esta eliminado');
      }
      throw new Error(error.detail || 'Error al restaurar profesor');
    }
    return response.json();
  },

  /**
   * Get a teacher by ID
   * @param {number} teacherId - Teacher ID
   * @returns {Promise<Object>} Teacher data
   */
  async getTeacher(teacherId) {
    const response = await this.request(`/teachers/${teacherId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Profesor no encontrado');
      }
      throw new Error('No se pudo obtener el profesor');
    }
    return response.json();
  },

  /**
   * Create a new teacher
   * @param {Object} data - Teacher data
   * @param {string} data.full_name - Teacher's full name (required)
   * @param {string} [data.email] - Email address (optional)
   * @param {string} [data.status] - ACTIVE, INACTIVE, or ON_LEAVE
   * @param {boolean} [data.can_enroll_biometric] - Can enroll biometric
   * @returns {Promise<Object>} Created teacher
   */
  async createTeacher(data) {
    const response = await this.request('/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 409) {
        throw new Error('Ya existe un profesor con este email');
      }
      if (response.status === 422) {
        throw new Error(error.detail || 'Datos de profesor inválidos');
      }
      throw new Error(error.detail || 'Error al crear profesor');
    }
    return response.json();
  },

  /**
   * Update a teacher
   * @param {number} teacherId - Teacher ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated teacher
   */
  async updateTeacher(teacherId, data) {
    const response = await this.request(`/teachers/${teacherId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Profesor no encontrado');
      }
      if (response.status === 409) {
        throw new Error('Ya existe un profesor con este email');
      }
      if (response.status === 422) {
        throw new Error(error.detail || 'Datos de profesor inválidos');
      }
      throw new Error(error.detail || 'Error al actualizar profesor');
    }
    return response.json();
  },

  /**
   * Delete a teacher
   * @param {number} teacherId - Teacher ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteTeacher(teacherId) {
    const response = await this.request(`/teachers/${teacherId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Profesor no encontrado');
      }
      throw new Error(error.detail || 'Error al eliminar profesor');
    }
    return true;
  },

  /**
   * Assign a course to a teacher
   * @param {number} teacherId - Teacher ID
   * @param {number} courseId - Course ID
   * @returns {Promise<boolean>} True if assigned successfully
   */
  async assignCourseToTeacher(teacherId, courseId) {
    const response = await this.request(`/teachers/${teacherId}/courses/${courseId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Profesor o curso no encontrado');
      }
      throw new Error(error.detail || 'Error al asignar curso');
    }
    return true;
  },

  /**
   * Unassign a course from a teacher
   * @param {number} teacherId - Teacher ID
   * @param {number} courseId - Course ID
   * @returns {Promise<boolean>} True if unassigned successfully
   */
  async unassignCourseFromTeacher(teacherId, courseId) {
    const response = await this.request(`/teachers/${teacherId}/courses/${courseId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('Profesor o curso no encontrado');
      }
      throw new Error(error.detail || 'Error al desasignar curso');
    }
    return true;
  },
});
