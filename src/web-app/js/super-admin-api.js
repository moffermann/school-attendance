/**
 * Super Admin API client
 * API methods for super admin panel
 */
const SuperAdminAPI = {
  _baseUrl: '/api/v1/super-admin',
  _token: null,

  // Initialize with stored token
  init() {
    // First check localStorage (direct super admin login)
    this._token = localStorage.getItem('superAdminToken');

    // If no token in localStorage, check sessionStorage for unified login token
    if (!this._token) {
      const unifiedToken = sessionStorage.getItem('accessToken');
      if (unifiedToken) {
        // Verify it's a super admin token
        try {
          const base64Url = unifiedToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join('')));
          if (payload.typ === 'super_admin') {
            this._token = unifiedToken;
          }
        } catch (e) {
          // Not a valid JWT, ignore
        }
      }
    }
  },

  // Set auth token
  setToken(token) {
    this._token = token;
    localStorage.setItem('superAdminToken', token);
  },

  // Clear token
  clearToken() {
    this._token = null;
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminRefreshToken');
  },

  // Check if authenticated
  isAuthenticated() {
    return !!this._token;
  },

  // Make authenticated request
  async request(endpoint, options = {}) {
    const url = `${this._baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 - try to refresh token
    if (response.status === 401 && !options._retried) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        return this.request(endpoint, { ...options, _retried: true });
      }
      this.clearToken();
      window.location.hash = '#/super-admin/auth';
    }

    return response;
  },

  // Refresh token
  async refreshToken() {
    const refreshToken = localStorage.getItem('superAdminRefreshToken');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this._baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('superAdminRefreshToken', data.refresh_token);
        }
        return true;
      }
    } catch (e) {
      console.error('Token refresh failed:', e);
    }
    return false;
  },

  // ==================== Auth ====================

  async login(email, password) {
    const response = await fetch(`${this._baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error de autenticación' }));
      throw new Error(error.detail || 'Credenciales inválidas');
    }

    const data = await response.json();
    this.setToken(data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('superAdminRefreshToken', data.refresh_token);
    }
    return data;
  },

  async getProfile() {
    const response = await this.request('/auth/me');
    if (!response.ok) {
      throw new Error('No se pudo obtener perfil');
    }
    return response.json();
  },

  async changePassword(currentPassword, newPassword) {
    const response = await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al cambiar contraseña' }));
      throw new Error(error.detail || 'Error al cambiar contraseña');
    }
    return response.json();
  },

  // ==================== Tenants ====================

  async listTenants(filters = {}) {
    const params = new URLSearchParams();
    if (filters.isActive !== undefined) params.append('is_active', filters.isActive);
    if (filters.plan) params.append('plan', filters.plan);
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString();
    // Use trailing slash to avoid HTTP redirect from FastAPI
    const response = await this.request(`/tenants/${queryString ? '?' + queryString : ''}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener lista de tenants');
    }
    return response.json();
  },

  async getTenant(tenantId) {
    const response = await this.request(`/tenants/${tenantId}`);
    if (!response.ok) {
      throw new Error('No se pudo obtener tenant');
    }
    return response.json();
  },

  async createTenant(data) {
    const response = await this.request('/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al crear tenant' }));
      throw new Error(error.detail || 'Error al crear tenant');
    }
    return response.json();
  },

  async updateTenant(tenantId, data) {
    const response = await this.request(`/tenants/${tenantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al actualizar tenant' }));
      throw new Error(error.detail || 'Error al actualizar tenant');
    }
    return response.json();
  },

  async deactivateTenant(tenantId) {
    const response = await this.request(`/tenants/${tenantId}/deactivate`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al desactivar tenant' }));
      throw new Error(error.detail || 'Error al desactivar tenant');
    }
    return response.json();
  },

  async activateTenant(tenantId) {
    const response = await this.request(`/tenants/${tenantId}/activate`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al activar tenant' }));
      throw new Error(error.detail || 'Error al activar tenant');
    }
    return response.json();
  },

  // ==================== Features ====================

  async getTenantFeatures(tenantId) {
    const response = await this.request(`/tenants/${tenantId}/features`);
    if (!response.ok) {
      throw new Error('No se pudo obtener features');
    }
    return response.json();
  },

  async toggleFeature(tenantId, featureName, enabled) {
    const response = await this.request(`/tenants/${tenantId}/features/${featureName}`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al cambiar feature' }));
      throw new Error(error.detail || 'Error al cambiar feature');
    }
    return response.json();
  },

  // ==================== Config ====================

  async getTenantConfig(tenantId) {
    const response = await this.request(`/tenants/${tenantId}/config`);
    if (!response.ok) {
      throw new Error('No se pudo obtener configuración');
    }
    return response.json();
  },

  async updateWhatsAppConfig(tenantId, config) {
    const response = await this.request(`/tenants/${tenantId}/config/whatsapp`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al actualizar configuración' }));
      throw new Error(error.detail || 'Error al actualizar configuración');
    }
    return response.json();
  },

  async updateEmailConfig(tenantId, config) {
    const response = await this.request(`/tenants/${tenantId}/config/email`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al actualizar configuración' }));
      throw new Error(error.detail || 'Error al actualizar configuración');
    }
    return response.json();
  },

  async updateS3Config(tenantId, config) {
    const response = await this.request(`/tenants/${tenantId}/config/s3`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al actualizar configuración' }));
      throw new Error(error.detail || 'Error al actualizar configuración');
    }
    return response.json();
  },

  async generateDeviceKey(tenantId) {
    const response = await this.request(`/tenants/${tenantId}/config/generate-device-key`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al generar clave' }));
      throw new Error(error.detail || 'Error al generar clave');
    }
    return response.json();
  },

  // ==================== Admin Invitations ====================

  async resendInvitation(tenantId) {
    const response = await this.request(`/tenants/${tenantId}/resend-invite`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al reenviar invitación' }));
      throw new Error(error.detail || 'Error al reenviar invitación');
    }
    return response.json();
  },

  async resetAdminPassword(tenantId) {
    const response = await this.request(`/tenants/${tenantId}/reset-admin`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al resetear contraseña' }));
      throw new Error(error.detail || 'Error al resetear contraseña');
    }
    return response.json();
  },

  // ==================== Usage Stats ====================

  async getTenantUsage(tenantId) {
    const response = await this.request(`/tenants/${tenantId}/usage`);
    if (!response.ok) {
      throw new Error('No se pudo obtener estadísticas de uso');
    }
    return response.json();
  },

  async getGlobalStats() {
    const response = await this.request('/stats/overview');
    if (!response.ok) {
      throw new Error('No se pudo obtener estadísticas globales');
    }
    return response.json();
  },

  // ==================== Impersonation ====================

  async impersonate(tenantId) {
    const response = await this.request(`/tenants/${tenantId}/impersonate`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al impersonar' }));
      throw new Error(error.detail || 'Error al impersonar');
    }
    return response.json();
  },
};

// Initialize on load
SuperAdminAPI.init();
