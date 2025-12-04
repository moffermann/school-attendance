// Sync module - Real API integration
const Sync = {
  isSyncing: false,

  // Get API configuration from State
  getApiConfig() {
    return {
      baseUrl: State.config.apiBaseUrl || '/api/v1',
      deviceKey: State.config.deviceApiKey || '',
      deviceId: State.device.device_id || 'DEV-01',
      gateId: State.device.gate_id || 'GATE-1'
    };
  },

  async processQueue() {
    if (this.isSyncing || !State.device.online) {
      return;
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
        local_seq: event.id
      };

      const response = await fetch(`${config.baseUrl}/attendance/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Key': config.deviceKey
        },
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

      const response = await fetch(`${config.baseUrl}/attendance/events/${eventId}/photo`, {
        method: 'POST',
        headers: {
          'X-Device-Key': config.deviceKey
        },
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
      const response = await fetch(`${config.baseUrl}/kiosk/students`, {
        method: 'GET',
        headers: {
          'X-Device-Key': config.deviceKey
        }
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

  // Full bootstrap sync - get all kiosk data
  async syncBootstrap() {
    const config = this.getApiConfig();

    if (!config.deviceKey) {
      console.log('No device API key configured, skipping bootstrap sync');
      return false;
    }

    try {
      UI.showToast('Sincronizando datos...', 'info', 2000);

      const response = await fetch(`${config.baseUrl}/kiosk/bootstrap`, {
        method: 'GET',
        headers: {
          'X-Device-Key': config.deviceKey
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Update all local data
        State.updateStudents(data.students);
        State.updateTags(data.tags);
        State.updateTeachers(data.teachers);

        console.log('Bootstrap sync complete:', {
          students: data.students.length,
          tags: data.tags.length,
          teachers: data.teachers.length
        });

        UI.showToast('Datos sincronizados', 'success');
        return true;
      } else {
        console.error('Bootstrap sync failed:', response.status);
        UI.showToast('Error al sincronizar', 'error');
        return false;
      }
    } catch (err) {
      console.error('Error in bootstrap sync:', err);
      UI.showToast('Error de conexión', 'error');
      return false;
    }
  }
};

// R3-R3 fix: Store interval references for potential cleanup
// Auto-sync every 30 seconds
Sync._queueIntervalId = setInterval(() => {
  if (State.device.online) {
    Sync.processQueue();
  }
}, 30000);

// Sync student preferences every 5 minutes
Sync._studentsIntervalId = setInterval(() => {
  if (State.device.online && Sync.isRealApiMode()) {
    Sync.syncStudents();
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
};
