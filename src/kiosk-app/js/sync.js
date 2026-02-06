// Sync module - Real API integration
const Sync = {
  isSyncing: false,

  // ==================== Image Cache for Authenticated Photos ====================
  imageCache: new Map(),
  MAX_CACHE_SIZE: 30, // Less than web-app (kiosk has less memory)

  /**
   * Load an image with device key authentication and return a blob URL
   * Used for displaying student photos that require device key authentication
   * @param {string} url - Full URL to the image
   * @returns {Promise<string|null>} - Blob URL or null on error
   */
  async loadImageWithDeviceKey(url) {
    try {
      // Check cache first
      if (this.imageCache.has(url)) {
        return this.imageCache.get(url);
      }

      // Loading timeout of 10 seconds
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Get headers with device key (without Content-Type for image fetch)
      const headers = this.getHeaders();
      delete headers['Content-Type'];

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
   * Should be called on cache clear to prevent memory leaks
   */
  clearImageCache() {
    this.imageCache.forEach(blobUrl => URL.revokeObjectURL(blobUrl));
    this.imageCache.clear();
  },

  // Get API configuration from State
  getApiConfig() {
    return {
      baseUrl: State.config.apiBaseUrl || '/api/v1',
      deviceKey: State.config.deviceApiKey || '',
      deviceId: State.device.device_id || 'DEV-01',
      gateId: State.device.gate_id || 'GATE-1',
      tenantId: State.config.tenantId || null
    };
  },

  // Get common headers for API requests
  getHeaders() {
    const config = this.getApiConfig();
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Key': config.deviceKey
    };
    if (config.tenantId) {
      headers['X-Tenant-ID'] = config.tenantId;
    }
    return headers;
  },

  async processQueue() {
    if (this.isSyncing || !State.device.online) {
      return;
    }

    // Filter out events older than 7 days (server rejects them)
    const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const now = Date.now();
    const expiredEvents = State.queue.filter(e => {
      const eventTime = new Date(e.ts).getTime();
      return (now - eventTime) > MAX_EVENT_AGE_MS;
    });

    // Mark expired events and remove from queue
    if (expiredEvents.length > 0) {
      console.warn(`[Sync] Removing ${expiredEvents.length} expired events (older than 7 days)`);
      expiredEvents.forEach(e => {
        State.updateEventStatus(e.id, 'expired');
      });
      // Remove expired events from queue
      State.queue = State.queue.filter(e => e.status !== 'expired');
      State.persist();
    }

    // Process events that need full sync
    const pending = State.queue.filter(e => e.status === 'pending' || e.status === 'error');
    // Also process events that need photo retry (max 3 retries)
    const partialSync = State.queue.filter(e =>
      e.status === 'partial_sync' && (e.photo_retries || 0) < 3
    );

    if (pending.length === 0 && partialSync.length === 0) {
      return;
    }

    this.isSyncing = true;
    UI.showToast('Sincronizando...', 'info', 2000);

    // Process pending events first
    for (const event of pending.slice(0, 5)) { // Process 5 at a time
      State.updateEventStatus(event.id, 'in_progress');

      const success = await this.syncEvent(event);

      if (!success) {
        // Stop processing if we hit an error (might be network issue)
        break;
      }
    }

    // Retry photo uploads for partial_sync events
    for (const event of partialSync.slice(0, 3)) {
      if (event.server_id && event.photo_data) {
        try {
          const photoSuccess = await this.uploadPhoto(event.server_id, event.photo_data);
          if (photoSuccess) {
            State.markSynced(event.id);
            console.log('Photo retry successful for event:', event.id);
          } else {
            // Increment retry counter
            State.markPartialSync(event.id, event.server_id);
          }
        } catch (e) {
          console.error('Photo retry failed:', e);
          State.markPartialSync(event.id, event.server_id);
        }
      }
    }

    this.isSyncing = false;
  },

  // Sync a single event to the real API
  async syncEvent(event) {
    const config = this.getApiConfig();

    // If no API key configured, fall back to simulation
    if (!config.deviceKey) {
      console.log('No device API key configured, using simulation mode');
      return await this.simulateSync(event);
    }

    try {
      // Prepare payload matching AttendanceEventCreate schema
      const payload = {
        student_id: event.student_id,
        device_id: config.deviceId,
        gate_id: config.gateId,
        type: event.type, // 'IN' or 'OUT'
        occurred_at: event.ts,
        photo_ref: event.photo_ref || null,
        local_seq: event.local_seq,  // Usar entero local_seq, no string event.id
        source: event.source || null  // BIOMETRIC, QR, NFC, MANUAL
      };

      const response = await fetch(`${config.baseUrl}/attendance/events`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Event synced successfully:', result);

        // Store the server-side event ID for photo upload
        event.server_id = result.id;

        // If there's a photo to upload, do it now
        let photoSuccess = true;
        if (event.photo_data && result.id) {
          try {
            photoSuccess = await this.uploadPhoto(result.id, event.photo_data);
          } catch (e) {
            console.error('Photo upload failed:', e);
            photoSuccess = false;
          }
        }

        if (photoSuccess || !event.photo_data) {
          State.markSynced(event.id);
        } else {
          // Event synced but photo failed - mark for retry
          State.markPartialSync(event.id, result.id);
        }
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Sync failed:', response.status, errorData);

        // Mark as error but allow retry
        State.updateEventStatus(event.id, 'error');

        // If it's a 4xx error, it's likely a data issue, not network
        if (response.status >= 400 && response.status < 500) {
          UI.showToast(`Error: ${errorData.detail || 'Datos inválidos'}`, 'error');
        }

        return false;
      }
    } catch (err) {
      console.error('Network error syncing event:', err);
      State.updateEventStatus(event.id, 'error');

      // Network error - stop processing queue
      UI.showToast('Error de conexión', 'error');
      return false;
    }
  },

  // Upload photo for an event
  async uploadPhoto(eventId, photoData) {
    const config = this.getApiConfig();

    if (!config.deviceKey || !photoData) {
      return false;
    }

    try {
      // Convert base64 to blob
      const blob = await this.dataURLToBlob(photoData);

      const formData = new FormData();
      formData.append('file', blob, `photo_${eventId}.jpg`);

      // For FormData, don't set Content-Type (browser sets it with boundary)
      const headers = { 'X-Device-Key': config.deviceKey };
      if (config.tenantId) headers['X-Tenant-ID'] = config.tenantId;

      const response = await fetch(`${config.baseUrl}/attendance/events/${eventId}/photo`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (response.ok) {
        console.log('Photo uploaded successfully for event:', eventId);
        return true;
      } else {
        console.error('Photo upload failed:', response.status);
        return false;
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      return false;
    }
  },

  // Helper: Convert data URL to Blob
  // F8 fix: Added try/catch for invalid data URLs
  async dataURLToBlob(dataURL) {
    try {
      const response = await fetch(dataURL);
      return await response.blob();
    } catch (err) {
      console.error('Error converting data URL to blob:', err);
      throw new Error('Invalid photo data');
    }
  },

  // Simulation mode for development without backend
  async simulateSync(event) {
    return new Promise(resolve => {
      setTimeout(() => {
        // 15% chance of failure in simulation
        const success = Math.random() > 0.15;

        if (success) {
          State.markSynced(event.id);
        } else {
          State.updateEventStatus(event.id, 'error');
        }

        resolve(success);
      }, 500 + Math.random() * 1000);
    });
  },

  async syncNow() {
    if (!State.device.online) {
      UI.showToast('Dispositivo offline', 'error');
      return;
    }

    await this.processQueue();

    const synced = State.queue.filter(e => e.status === 'synced').length;
    const errors = State.queue.filter(e => e.status === 'error').length;

    if (errors > 0) {
      UI.showToast(`Sincronizado: ${synced}, Errores: ${errors}`, 'warning');
    } else if (synced > 0) {
      UI.showToast('Sincronización completa', 'success');
    }
  },

  // Check if we're in real API mode or simulation
  isRealApiMode() {
    const config = this.getApiConfig();
    return !!config.deviceKey;
  },

  // Sync student data including photo preferences from backend
  async syncStudents() {
    const config = this.getApiConfig();

    if (!config.deviceKey) {
      console.log('No device API key configured, skipping student sync');
      return false;
    }

    try {
      const headers = { 'X-Device-Key': config.deviceKey };
      if (config.tenantId) headers['X-Tenant-ID'] = config.tenantId;

      const response = await fetch(`${config.baseUrl}/kiosk/students`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const students = await response.json();

        // Update local student data with server data
        State.updateStudents(students);
        console.log(`Synced ${students.length} students with photo preferences`);
        return true;
      } else {
        console.error('Student sync failed:', response.status);
        return false;
      }
    } catch (err) {
      console.error('Error syncing students:', err);
      return false;
    }
  },

  // Sync tags from backend (incremental update)
  async syncTags() {
    const config = this.getApiConfig();

    if (!config.deviceKey) {
      console.log('No device API key configured, skipping tags sync');
      return false;
    }

    try {
      const headers = { 'X-Device-Key': config.deviceKey };
      if (config.tenantId) headers['X-Tenant-ID'] = config.tenantId;

      const response = await fetch(`${config.baseUrl}/kiosk/tags`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const tags = await response.json();
        State.updateTags(tags);
        console.log(`Synced ${tags.length} tags from server`);
        return true;
      } else {
        console.error('Tags sync failed:', response.status);
        return false;
      }
    } catch (err) {
      console.error('Error syncing tags:', err);
      return false;
    }
  },

  // Full bootstrap sync - get all kiosk data
  async syncBootstrap() {
    const config = this.getApiConfig();

    if (!config.deviceKey) {
      console.log('No device API key configured, skipping bootstrap sync');
      return false;
    }

    try {
      const url = `${config.baseUrl}/kiosk/bootstrap`;
      const headers = { 'X-Device-Key': config.deviceKey };
      if (config.tenantId) headers['X-Tenant-ID'] = config.tenantId;

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const data = await response.json();

        // Update all local data
        State.updateStudents(data.students);
        State.updateTags(data.tags);
        State.updateTeachers(data.teachers);

        // Import today's events for IN/OUT state tracking
        if (data.today_events) {
          State.importTodayEvents(data.today_events);
        }

        // Update authorized pickups for withdrawal feature
        if (data.authorized_pickups) {
          State.updateAuthorizedPickups(data.authorized_pickups);
        }

        // Update today's withdrawals
        if (data.today_withdrawals) {
          State.updateTodayWithdrawals(data.today_withdrawals);
        }

        console.log('Bootstrap sync complete:', {
          students: data.students.length,
          tags: data.tags.length,
          teachers: data.teachers.length,
          today_events: data.today_events?.length || 0,
          authorized_pickups: data.authorized_pickups?.length || 0,
          today_withdrawals: data.today_withdrawals?.length || 0
        });

        return true;
      } else {
        console.error('Bootstrap sync failed:', response.status);
        return false;
      }
    } catch (err) {
      console.error('Error in bootstrap sync:', err);
      return false;
    }
  },

  // Sync today's events for IN/OUT state (called after cache clear)
  async syncTodayEvents() {
    const config = this.getApiConfig();

    if (!config.deviceKey) {
      console.log('No device API key configured, skipping today events sync');
      return false;
    }

    try {
      const headers = { 'X-Device-Key': config.deviceKey };
      if (config.tenantId) headers['X-Tenant-ID'] = config.tenantId;

      // Sync both attendance events AND withdrawals in parallel
      const [eventsResponse, withdrawalsResponse] = await Promise.all([
        fetch(`${config.baseUrl}/kiosk/today-events`, { method: 'GET', headers }),
        fetch(`${config.baseUrl}/kiosk/today-withdrawals`, { method: 'GET', headers })
      ]);

      let eventsOk = false;
      let withdrawalsOk = false;

      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        State.importTodayEvents(events);
        console.log(`Synced ${events.length} today events for IN/OUT state`);
        eventsOk = true;
      } else {
        console.error('Today events sync failed:', eventsResponse.status);
      }

      if (withdrawalsResponse.ok) {
        const withdrawals = await withdrawalsResponse.json();
        State.updateTodayWithdrawals(withdrawals);
        console.log(`Synced ${withdrawals.length} today withdrawals`);
        withdrawalsOk = true;
      } else {
        console.error('Today withdrawals sync failed:', withdrawalsResponse.status);
      }

      return eventsOk && withdrawalsOk;
    } catch (err) {
      console.error('Error syncing today events:', err);
      return false;
    }
  }
};

// ==================== Device Heartbeat ====================

/**
 * Send heartbeat to backend to report device status
 * Includes battery level if available (resolves "simulated ping" issue)
 * @returns {Promise<boolean>} - True if heartbeat sent successfully
 */
Sync.sendHeartbeat = async function() {
  const config = this.getApiConfig();

  if (!config.deviceKey) {
    console.log('[Heartbeat] No device API key configured, skipping');
    return false;
  }

  try {
    // Get battery level if available (mobile devices)
    let batteryPct = State.device.battery_pct || 100;
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        batteryPct = Math.round(battery.level * 100);
        // Update local state with real battery level
        State.device.battery_pct = batteryPct;
      } catch (e) {
        console.warn('[Heartbeat] Battery API not available:', e.message);
      }
    }

    // Prepare heartbeat payload
    const payload = {
      device_id: config.deviceId,
      gate_id: config.gateId,
      firmware_version: State.device.version || '1.0.0',
      battery_pct: batteryPct,
      pending_events: State.getPendingCount(),
      online: true
    };

    const headers = this.getHeaders();
    if (config.tenantId) {
      headers['X-Tenant-ID'] = config.tenantId;
    }

    const response = await fetch(`${config.baseUrl}/devices/heartbeat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Heartbeat] Sent successfully:', {
        device: config.deviceId,
        battery: batteryPct,
        pending: payload.pending_events
      });
      // Update local state
      State.device.online = true;
      return true;
    } else {
      console.error('[Heartbeat] Failed:', response.status);
      return false;
    }
  } catch (err) {
    console.error('[Heartbeat] Network error:', err.message);
    return false;
  }
};

/**
 * Start automatic heartbeat interval
 * Sends heartbeat every 2 minutes to keep device marked as online
 */
Sync.startHeartbeat = function() {
  // Clear existing interval if any
  if (this._heartbeatIntervalId) {
    clearInterval(this._heartbeatIntervalId);
  }

  // Send initial heartbeat immediately
  this.sendHeartbeat();

  // Then send every 2 minutes (offline detection runs every 5 min with 5 min threshold)
  this._heartbeatIntervalId = setInterval(() => {
    if (State.device.online && this.isRealApiMode()) {
      this.sendHeartbeat();
    }
  }, 2 * 60 * 1000); // 2 minutes

  console.log('[Heartbeat] Automatic heartbeat started (every 2 min)');
};

/**
 * Stop automatic heartbeat interval
 */
Sync.stopHeartbeat = function() {
  if (this._heartbeatIntervalId) {
    clearInterval(this._heartbeatIntervalId);
    this._heartbeatIntervalId = null;
    console.log('[Heartbeat] Automatic heartbeat stopped');
  }
};

// R3-R3 fix: Store interval references for potential cleanup
// Auto-sync every 30 seconds
// TDD-BUG4 fix: Check isSyncing to prevent concurrent queue processing
Sync._queueIntervalId = setInterval(() => {
  if (State.device.online && !Sync.isSyncing) {
    Sync.processQueue();
  }
}, 30000);

// Sync student preferences and tags every 5 minutes
Sync._studentsIntervalId = setInterval(() => {
  if (State.device.online && Sync.isRealApiMode()) {
    Sync.syncStudents();
    Sync.syncTags();
  }
}, 5 * 60 * 1000);

// R3-R3 fix: Method to stop sync intervals (useful for testing/cleanup)
Sync.stopIntervals = function() {
  if (this._queueIntervalId) {
    clearInterval(this._queueIntervalId);
    this._queueIntervalId = null;
  }
  if (this._studentsIntervalId) {
    clearInterval(this._studentsIntervalId);
    this._studentsIntervalId = null;
  }
  // Also stop heartbeat when stopping all intervals
  this.stopHeartbeat();
};

// R4-F2 fix: Cleanup intervals on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => Sync.stopIntervals());
window.addEventListener('pagehide', () => Sync.stopIntervals());

// ==================== Withdrawal API Methods ====================

/**
 * Initiate a withdrawal for one or more students
 * @param {number[]} studentIds - Array of student IDs to withdraw
 * @param {number|null} authorizedPickupId - ID of the authorized pickup (null for admin override)
 * @returns {Promise<object|null>} - Withdrawal response or null on error
 */
Sync.initiateWithdrawal = async function(studentIds, authorizedPickupId = null) {
  const config = this.getApiConfig();

  if (!config.deviceKey) {
    console.error('[Withdrawal] No device API key configured');
    return null;
  }

  try {
    // Get device timezone automatically
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const payload = {
      student_ids: studentIds,
      authorized_pickup_id: authorizedPickupId,
      device_id: config.deviceId,
      device_timezone: deviceTimezone
    };

    const response = await fetch(`${config.baseUrl}/withdrawals/initiate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Withdrawal] Initiated successfully:', result);
      return result;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Withdrawal] Initiate failed:', response.status, errorData);
      throw new Error(errorData.detail || 'Error al iniciar retiro');
    }
  } catch (err) {
    console.error('[Withdrawal] Network error:', err);
    throw err;
  }
};

/**
 * Verify identity for a withdrawal
 * @param {number} withdrawalId - ID of the withdrawal to verify
 * @param {string} verificationMethod - QR_SCAN, PHOTO_MATCH, or ADMIN_OVERRIDE
 * @param {string|null} pickupPhotoRef - S3 reference to selfie photo (optional)
 * @returns {Promise<object|null>} - Updated withdrawal or null on error
 */
Sync.verifyWithdrawal = async function(withdrawalId, verificationMethod, pickupPhotoRef = null) {
  const config = this.getApiConfig();

  if (!config.deviceKey) {
    console.error('[Withdrawal] No device API key configured');
    return null;
  }

  try {
    const payload = {
      verification_method: verificationMethod,
      pickup_photo_ref: pickupPhotoRef
    };

    const response = await fetch(`${config.baseUrl}/withdrawals/${withdrawalId}/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Withdrawal] Verified successfully:', result);
      return result;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Withdrawal] Verify failed:', response.status, errorData);
      throw new Error(errorData.detail || 'Error al verificar retiro');
    }
  } catch (err) {
    console.error('[Withdrawal] Network error:', err);
    throw err;
  }
};

/**
 * Complete a withdrawal with signature
 * @param {number} withdrawalId - ID of the withdrawal to complete
 * @param {string|null} signatureData - Base64 PNG/SVG of digital signature
 * @param {string|null} reason - Reason for withdrawal
 * @returns {Promise<object|null>} - Completed withdrawal or null on error
 */
Sync.completeWithdrawal = async function(withdrawalId, signatureData = null, reason = null) {
  const config = this.getApiConfig();

  if (!config.deviceKey) {
    console.error('[Withdrawal] No device API key configured');
    return null;
  }

  try {
    const payload = {
      signature_data: signatureData,
      reason: reason
    };

    const response = await fetch(`${config.baseUrl}/withdrawals/${withdrawalId}/complete`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Withdrawal] Completed successfully:', result);
      return result;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Withdrawal] Complete failed:', response.status, errorData);
      throw new Error(errorData.detail || 'Error al completar retiro');
    }
  } catch (err) {
    console.error('[Withdrawal] Network error:', err);
    throw err;
  }
};

/**
 * Lookup authorized pickup by QR code hash
 * @param {string} qrHash - QR code hash to lookup
 * @returns {Promise<object|null>} - Pickup info or null if not found
 */
Sync.lookupPickupByQR = async function(qrHash) {
  const config = this.getApiConfig();

  if (!config.deviceKey) {
    console.error('[Withdrawal] No device API key configured');
    return null;
  }

  try {
    const response = await fetch(`${config.baseUrl}/withdrawals/lookup-qr/${encodeURIComponent(qrHash)}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Withdrawal] QR lookup successful:', result);
      return result;
    } else if (response.status === 404) {
      console.log('[Withdrawal] QR not found');
      return null;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Withdrawal] QR lookup failed:', response.status, errorData);
      return null;
    }
  } catch (err) {
    console.error('[Withdrawal] Network error:', err);
    return null;
  }
};

/**
 * Register a complete withdrawal (initiate + verify + complete in one call)
 * Convenience method for kiosk flow
 * @param {object} params - Withdrawal parameters
 * @param {number} params.pickup_id - ID of the authorized pickup
 * @param {number[]} params.student_ids - Array of student IDs to withdraw
 * @param {string|null} params.selfie_data - Base64 selfie image (optional)
 * @param {string|null} params.signature_data - Base64 signature image (optional)
 * @param {string|null} params.reason - Reason for withdrawal (optional)
 * @returns {Promise<object[]>} - Array of completed withdrawal records
 */
Sync.registerWithdrawal = async function(params) {
  const { pickup_id, student_ids, selfie_data, signature_data, reason } = params;

  console.log('[Withdrawal] Starting full registration flow:', {
    pickup_id,
    student_ids,
    has_selfie: !!selfie_data,
    has_signature: !!signature_data
  });

  // Step 1: Initiate withdrawal for all students
  const initiatedWithdrawals = await this.initiateWithdrawal(student_ids, pickup_id);

  if (!initiatedWithdrawals || initiatedWithdrawals.length === 0) {
    throw new Error('No se pudieron iniciar los retiros');
  }

  console.log('[Withdrawal] Initiated:', initiatedWithdrawals.length, 'withdrawals');

  const completedWithdrawals = [];

  // Step 2 & 3: Verify and complete each withdrawal
  for (const withdrawal of initiatedWithdrawals) {
    try {
      // Upload selfie and get reference if provided
      let photoRef = null;
      if (selfie_data && withdrawal.id) {
        try {
          photoRef = await this.uploadWithdrawalPhoto(withdrawal.id, selfie_data);
        } catch (e) {
          console.warn('[Withdrawal] Selfie upload failed, continuing without photo:', e.message);
        }
      }

      // Step 2: Verify
      await this.verifyWithdrawal(
        withdrawal.id,
        'QR_SCAN', // Verification was done via QR scan
        photoRef
      );

      // Step 3: Complete with signature
      const completed = await this.completeWithdrawal(
        withdrawal.id,
        signature_data,
        reason
      );

      completedWithdrawals.push(completed);

      // Update local state to mark student as withdrawn today
      if (completed && completed.student_id) {
        State.addTodayWithdrawal({
          student_id: completed.student_id,
          withdrawn_at: completed.completed_at || new Date().toISOString(),
          pickup_name: completed.pickup_name || 'Desconocido'
        });
      }

    } catch (e) {
      console.error('[Withdrawal] Failed to complete withdrawal:', withdrawal.id, e);
      // Continue with other students even if one fails
    }
  }

  if (completedWithdrawals.length === 0) {
    throw new Error('No se pudo completar ningún retiro');
  }

  console.log('[Withdrawal] Completed:', completedWithdrawals.length, 'withdrawals');
  return completedWithdrawals;
};

/**
 * Upload selfie photo for a withdrawal
 * @param {number} withdrawalId - ID of the withdrawal
 * @param {string} photoData - Base64 image data
 * @returns {Promise<string|null>} - Photo reference or null
 */
Sync.uploadWithdrawalPhoto = async function(withdrawalId, photoData) {
  const config = this.getApiConfig();

  if (!config.deviceKey || !photoData) {
    return null;
  }

  try {
    // Convert base64 to blob
    const blob = await this.dataURLToBlob(photoData);

    const formData = new FormData();
    formData.append('file', blob, `withdrawal_selfie_${withdrawalId}.jpg`);

    const headers = { 'X-Device-Key': config.deviceKey };
    if (config.tenantId) headers['X-Tenant-ID'] = config.tenantId;

    const response = await fetch(`${config.baseUrl}/withdrawals/${withdrawalId}/photo`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Withdrawal] Photo uploaded:', result);
      return result.photo_ref || result.url || null;
    } else {
      console.error('[Withdrawal] Photo upload failed:', response.status);
      return null;
    }
  } catch (err) {
    console.error('[Withdrawal] Error uploading photo:', err);
    return null;
  }
};

// Expose Sync globally to ensure availability in all contexts
window.Sync = Sync;
