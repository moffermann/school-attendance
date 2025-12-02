// WebAuthn module for biometric authentication
const WebAuthn = {
  // Check if WebAuthn is supported in this browser
  isSupported() {
    return window.PublicKeyCredential !== undefined &&
           typeof window.PublicKeyCredential === 'function';
  },

  // Check if platform authenticator (fingerprint/Face ID) is available
  async isPlatformAuthenticatorAvailable() {
    if (!this.isSupported()) return false;

    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (err) {
      console.error('Error checking platform authenticator:', err);
      return false;
    }
  },

  // Get API configuration from State
  getApiConfig() {
    return {
      baseUrl: State.config.apiBaseUrl || '/api/v1',
      deviceKey: State.config.deviceApiKey || ''
    };
  },

  // =========================================================================
  // Student Registration (Enrollment)
  // =========================================================================

  /**
   * Start registration process for a student
   * @param {number} studentId - The student's ID
   * @param {string} deviceName - Optional name for this credential
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async registerStudent(studentId, deviceName = null) {
    const config = this.getApiConfig();

    if (!config.deviceKey) {
      return { success: false, error: 'No hay API key configurada' };
    }

    if (!this.isSupported()) {
      return { success: false, error: 'WebAuthn no soportado en este navegador' };
    }

    try {
      // Step 1: Get registration options from server
      const startResponse = await fetch(`${config.baseUrl}/webauthn/kiosk/students/register/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Key': config.deviceKey
        },
        body: JSON.stringify({
          student_id: studentId,
          device_name: deviceName || `Kiosk ${State.device.device_id || 'Principal'}`
        })
      });

      if (!startResponse.ok) {
        const error = await startResponse.json().catch(() => ({}));
        return { success: false, error: error.detail || 'Error al iniciar registro' };
      }

      const { challenge_id, options } = await startResponse.json();

      // Step 2: Create credential using WebAuthn API
      const credential = await this.createCredential(options);

      if (!credential) {
        return { success: false, error: 'El usuario canceló el registro' };
      }

      // Step 3: Send credential to server for verification
      const completeResponse = await fetch(`${config.baseUrl}/webauthn/kiosk/students/register/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Key': config.deviceKey
        },
        body: JSON.stringify({
          challenge_id: challenge_id,
          credential: credential
        })
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json().catch(() => ({}));
        return { success: false, error: error.detail || 'Error al completar registro' };
      }

      const result = await completeResponse.json();
      return { success: true, credentialId: result.credential_id };

    } catch (err) {
      console.error('WebAuthn registration error:', err);

      if (err.name === 'NotAllowedError') {
        return { success: false, error: 'El usuario canceló o el tiempo expiró' };
      }
      if (err.name === 'InvalidStateError') {
        return { success: false, error: 'Este autenticador ya está registrado' };
      }

      return { success: false, error: err.message || 'Error desconocido' };
    }
  },

  // =========================================================================
  // Student Authentication
  // =========================================================================

  /**
   * Authenticate a student using biometrics
   * @returns {Promise<{success: boolean, student?: object, error?: string}>}
   */
  async authenticateStudent() {
    const config = this.getApiConfig();

    if (!config.deviceKey) {
      return { success: false, error: 'No hay API key configurada' };
    }

    if (!this.isSupported()) {
      return { success: false, error: 'WebAuthn no soportado en este navegador' };
    }

    try {
      // Step 1: Get authentication options from server
      const startResponse = await fetch(`${config.baseUrl}/webauthn/kiosk/authenticate/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Key': config.deviceKey
        }
      });

      if (!startResponse.ok) {
        const error = await startResponse.json().catch(() => ({}));
        return { success: false, error: error.detail || 'Error al iniciar autenticación' };
      }

      const { challenge_id, options } = await startResponse.json();

      // Step 2: Get credential assertion from authenticator
      const assertion = await this.getCredential(options);

      if (!assertion) {
        return { success: false, error: 'El usuario canceló la autenticación' };
      }

      // Step 3: Verify assertion with server
      const verifyResponse = await fetch(`${config.baseUrl}/webauthn/kiosk/authenticate/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Key': config.deviceKey
        },
        body: JSON.stringify({
          challenge_id: challenge_id,
          credential: assertion
        })
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json().catch(() => ({}));
        return { success: false, error: error.detail || 'Huella no reconocida' };
      }

      const student = await verifyResponse.json();
      return { success: true, student: student };

    } catch (err) {
      console.error('WebAuthn authentication error:', err);

      if (err.name === 'NotAllowedError') {
        return { success: false, error: 'El usuario canceló o el tiempo expiró' };
      }

      return { success: false, error: err.message || 'Error desconocido' };
    }
  },

  // =========================================================================
  // Check if student has biometric registered
  // =========================================================================

  /**
   * Check if a student has any registered biometric credentials
   * @param {number} studentId - The student's ID
   * @returns {Promise<{hasBiometric: boolean, count: number}>}
   */
  async checkStudentBiometric(studentId) {
    const config = this.getApiConfig();

    if (!config.deviceKey) {
      return { hasBiometric: false, count: 0 };
    }

    try {
      const response = await fetch(`${config.baseUrl}/webauthn/kiosk/students/${studentId}/biometric-status`, {
        method: 'GET',
        headers: {
          'X-Device-Key': config.deviceKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        return { hasBiometric: data.has_biometric, count: data.credential_count };
      }

      return { hasBiometric: false, count: 0 };
    } catch (err) {
      console.error('Error checking biometric status:', err);
      return { hasBiometric: false, count: 0 };
    }
  },

  // =========================================================================
  // Check if teacher can enroll students
  // =========================================================================

  /**
   * Check if a teacher has permission to enroll students with biometrics
   * @param {number} teacherId - The teacher's ID
   * @returns {Promise<boolean>}
   */
  async canTeacherEnroll(teacherId) {
    const config = this.getApiConfig();

    if (!config.deviceKey) {
      return false;
    }

    try {
      const response = await fetch(`${config.baseUrl}/webauthn/teachers/${teacherId}/can-enroll`, {
        method: 'GET',
        headers: {
          'X-Device-Key': config.deviceKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.can_enroll_biometric === true;
      }

      return false;
    } catch (err) {
      console.error('Error checking teacher enrollment permission:', err);
      return false;
    }
  },

  // =========================================================================
  // WebAuthn Credential Helpers
  // =========================================================================

  /**
   * Create a new credential (registration)
   * @param {object} options - PublicKeyCredentialCreationOptions from server
   * @returns {Promise<object|null>} Credential response or null if cancelled
   */
  async createCredential(options) {
    // Parse the options from JSON format to WebAuthn format
    const publicKeyCredentialCreationOptions = this.parseCreationOptions(options);

    try {
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      // Convert credential to JSON-serializable format
      return this.credentialToJSON(credential);
    } catch (err) {
      console.error('Error creating credential:', err);
      throw err;
    }
  },

  /**
   * Get credential assertion (authentication)
   * @param {object} options - PublicKeyCredentialRequestOptions from server
   * @returns {Promise<object|null>} Assertion response or null if cancelled
   */
  async getCredential(options) {
    // Parse the options from JSON format to WebAuthn format
    const publicKeyCredentialRequestOptions = this.parseRequestOptions(options);

    try {
      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });

      // Convert assertion to JSON-serializable format
      return this.assertionToJSON(assertion);
    } catch (err) {
      console.error('Error getting credential:', err);
      throw err;
    }
  },

  // =========================================================================
  // JSON Parsing Helpers
  // =========================================================================

  /**
   * Parse server's creation options to WebAuthn format
   */
  parseCreationOptions(options) {
    const parsed = { ...options };

    // Convert base64url strings to ArrayBuffer
    if (parsed.challenge) {
      parsed.challenge = this.base64urlToBuffer(parsed.challenge);
    }

    if (parsed.user && parsed.user.id) {
      parsed.user.id = this.base64urlToBuffer(parsed.user.id);
    }

    if (parsed.excludeCredentials) {
      parsed.excludeCredentials = parsed.excludeCredentials.map(cred => ({
        ...cred,
        id: this.base64urlToBuffer(cred.id)
      }));
    }

    return parsed;
  },

  /**
   * Parse server's request options to WebAuthn format
   */
  parseRequestOptions(options) {
    const parsed = { ...options };

    // Convert base64url strings to ArrayBuffer
    if (parsed.challenge) {
      parsed.challenge = this.base64urlToBuffer(parsed.challenge);
    }

    if (parsed.allowCredentials) {
      parsed.allowCredentials = parsed.allowCredentials.map(cred => ({
        ...cred,
        id: this.base64urlToBuffer(cred.id)
      }));
    }

    return parsed;
  },

  /**
   * Convert credential to JSON-serializable format
   */
  credentialToJSON(credential) {
    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.bufferToBase64url(credential.response.clientDataJSON),
        attestationObject: this.bufferToBase64url(credential.response.attestationObject),
        transports: credential.response.getTransports ? credential.response.getTransports() : []
      }
    };
  },

  /**
   * Convert assertion to JSON-serializable format
   */
  assertionToJSON(assertion) {
    return {
      id: assertion.id,
      rawId: this.bufferToBase64url(assertion.rawId),
      type: assertion.type,
      response: {
        clientDataJSON: this.bufferToBase64url(assertion.response.clientDataJSON),
        authenticatorData: this.bufferToBase64url(assertion.response.authenticatorData),
        signature: this.bufferToBase64url(assertion.response.signature),
        userHandle: assertion.response.userHandle
          ? this.bufferToBase64url(assertion.response.userHandle)
          : null
      }
    };
  },

  // =========================================================================
  // Base64url Encoding/Decoding
  // =========================================================================

  /**
   * Convert base64url string to ArrayBuffer
   */
  base64urlToBuffer(base64url) {
    // Add padding if needed
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  /**
   * Convert ArrayBuffer to base64url string
   */
  bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
};
