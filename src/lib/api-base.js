/**
 * Shared API client base for all frontend apps
 * Handles authentication, token management, and common request logic
 */
function createApiClient(configKey) {
  return {
    // Config key for localStorage (e.g., 'webAppConfig', 'pwaConfig')
    _configKey: configKey,

    // Base URL for API - can be configured via localStorage
    get baseUrl() {
      const config = JSON.parse(localStorage.getItem(this._configKey) || '{}');
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
        const error = await response.json().catch(() => ({ detail: 'Error de autenticacion' }));
        throw new Error(error.detail || 'Error de autenticacion');
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
  };
}

// Export for module systems (if available)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createApiClient };
}
