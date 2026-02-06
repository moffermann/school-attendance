/**
 * WebAuthn Client for Parent Portal PWA
 * Handles passkey registration and authentication for guardian users
 */

const WebAuthn = {
  /**
   * Check if WebAuthn is supported in this browser
   */
  isSupported() {
    return !!(
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === 'function'
    );
  },

  /**
   * Check if platform authenticator (biometrics) is available
   */
  async isPlatformAuthenticatorAvailable() {
    if (!this.isSupported()) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  },

  /**
   * Check if conditional mediation (autofill) is supported
   */
  async isConditionalMediationAvailable() {
    if (!this.isSupported()) return false;
    try {
      return await PublicKeyCredential.isConditionalMediationAvailable?.() || false;
    } catch {
      return false;
    }
  },

  /**
   * Convert base64url to ArrayBuffer
   */
  base64urlToBuffer(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  /**
   * Convert ArrayBuffer to base64url
   */
  bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  /**
   * Transform server options for navigator.credentials.create()
   */
  prepareRegistrationOptions(serverOptions) {
    const options = { ...serverOptions };

    // Convert challenge
    options.challenge = this.base64urlToBuffer(options.challenge);

    // Convert user.id
    if (options.user?.id) {
      options.user.id = this.base64urlToBuffer(options.user.id);
    }

    // Convert excludeCredentials
    if (options.excludeCredentials) {
      options.excludeCredentials = options.excludeCredentials.map(cred => ({
        ...cred,
        id: this.base64urlToBuffer(cred.id),
      }));
    }

    return options;
  },

  /**
   * Transform server options for navigator.credentials.get()
   */
  prepareAuthenticationOptions(serverOptions) {
    const options = { ...serverOptions };

    // Convert challenge
    options.challenge = this.base64urlToBuffer(options.challenge);

    // Convert allowCredentials
    if (options.allowCredentials) {
      options.allowCredentials = options.allowCredentials.map(cred => ({
        ...cred,
        id: this.base64urlToBuffer(cred.id),
      }));
    }

    return options;
  },

  /**
   * Transform credential for server (registration)
   */
  prepareRegistrationCredential(credential) {
    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.bufferToBase64url(credential.response.clientDataJSON),
        attestationObject: this.bufferToBase64url(credential.response.attestationObject),
        transports: credential.response.getTransports?.() || [],
      },
      authenticatorAttachment: credential.authenticatorAttachment,
    };
  },

  /**
   * Transform credential for server (authentication)
   */
  prepareAuthenticationCredential(credential) {
    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.bufferToBase64url(credential.response.clientDataJSON),
        authenticatorData: this.bufferToBase64url(credential.response.authenticatorData),
        signature: this.bufferToBase64url(credential.response.signature),
        userHandle: credential.response.userHandle
          ? this.bufferToBase64url(credential.response.userHandle)
          : null,
      },
      authenticatorAttachment: credential.authenticatorAttachment,
    };
  },

  /**
   * Register a new passkey for the current user
   * Requires user to be authenticated via traditional login first
   */
  async registerPasskey(deviceName = null) {
    if (!this.isSupported()) {
      throw new Error('WebAuthn no está soportado en este navegador');
    }

    // Step 1: Get registration options from server
    const startResponse = await API.request('/webauthn/users/register/start', {
      method: 'POST',
      body: JSON.stringify({ device_name: deviceName }),
    });

    if (!startResponse.ok) {
      const error = await startResponse.json();
      throw new Error(error.detail || 'Error al iniciar registro de passkey');
    }

    const { challenge_id, options: serverOptions } = await startResponse.json();

    // Step 2: Create credential with browser
    const publicKeyOptions = this.prepareRegistrationOptions(serverOptions);

    let credential;
    try {
      credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Registro cancelado o denegado');
      }
      if (err.name === 'InvalidStateError') {
        throw new Error('Ya tienes un passkey registrado en este dispositivo');
      }
      throw new Error(`Error al crear passkey: ${err.message}`);
    }

    // Step 3: Send credential to server for verification
    const credentialForServer = this.prepareRegistrationCredential(credential);

    const completeResponse = await API.request('/webauthn/users/register/complete', {
      method: 'POST',
      body: JSON.stringify({
        challenge_id,
        credential: credentialForServer,
      }),
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      throw new Error(error.detail || 'Error al completar registro de passkey');
    }

    return await completeResponse.json();
  },

  /**
   * Authenticate with passkey (passwordless login)
   * Returns JWT tokens on success
   */
  async authenticateWithPasskey() {
    if (!this.isSupported()) {
      throw new Error('WebAuthn no está soportado en este navegador');
    }

    // Step 1: Get authentication options from server
    const startResponse = await fetch(`${API.baseUrl}/webauthn/users/authenticate/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!startResponse.ok) {
      const error = await startResponse.json();
      throw new Error(error.detail || 'Error al iniciar autenticación');
    }

    const { challenge_id, options: serverOptions } = await startResponse.json();

    // Step 2: Get credential from browser
    const publicKeyOptions = this.prepareAuthenticationOptions(serverOptions);

    let credential;
    try {
      credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Autenticación cancelada o denegada');
      }
      throw new Error(`Error al obtener passkey: ${err.message}`);
    }

    // Step 3: Send credential to server for verification
    const credentialForServer = this.prepareAuthenticationCredential(credential);

    const verifyResponse = await fetch(`${API.baseUrl}/webauthn/users/authenticate/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_id,
        credential: credentialForServer,
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      throw new Error(error.detail || 'Error al verificar passkey');
    }

    const result = await verifyResponse.json();

    // Store tokens
    sessionStorage.setItem('accessToken', result.access_token);
    sessionStorage.setItem('refreshToken', result.refresh_token);

    return result;
  },

  /**
   * List registered passkeys for current user
   */
  async listPasskeys() {
    const response = await API.request('/webauthn/users/me/credentials');
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Error al listar passkeys');
    }
    const data = await response.json();
    // API returns { credentials: [], count: N }
    return data.credentials || [];
  },

  /**
   * Delete a passkey
   */
  async deletePasskey(credentialId) {
    const response = await API.request(`/webauthn/users/me/credentials/${encodeURIComponent(credentialId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Error al eliminar passkey');
    }
    return true;
  },

  /**
   * Check if current user has any registered passkeys
   */
  async hasPasskeys() {
    try {
      const passkeys = await this.listPasskeys();
      return passkeys.length > 0;
    } catch {
      return false;
    }
  },
};
