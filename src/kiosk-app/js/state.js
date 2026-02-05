// State management for Kiosk
const State = {
  device: {},
  config: {},
  students: [],
  teachers: [],
  tags: [],
  queue: [],
  localSeq: 0,
  // Authorized withdrawals data
  authorizedPickups: [],    // Adults authorized to pick up students
  todayWithdrawals: [],     // Today's withdrawal records
  pendingWithdrawal: null,  // Current withdrawal in progress
  // Debounce tracking for rapid scans
  _lastEventByStudent: {},  // { studentId: { type: 'IN'|'OUT', timestamp: Date } }
  _EVENT_DEBOUNCE_MS: 5000, // 5 second cooldown between events for same student

  // Timezone helper: get LOCAL date string (YYYY-MM-DD) from ISO timestamp or Date.
  // CRITICAL: toISOString() returns UTC date which can differ from local date
  // (e.g., 9:50 PM Chile = 00:50 AM UTC next day). Business logic must use LOCAL dates.
  _getLocalDateStr(isoOrDate) {
    const d = (typeof isoOrDate === 'string') ? new Date(isoOrDate) : (isoOrDate || new Date());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  async init() {
    // Load persisted user data from localStorage (queue, synced data)
    const stored = localStorage.getItem('kioskData');
    if (stored) {
      // TDD-R4-BUG4 fix: Handle corrupted localStorage JSON with try/catch
      try {
        const data = JSON.parse(stored);
        // Only restore user/dynamic data - NOT config (config always from source)
        this.students = data.students || [];
        this.teachers = data.teachers || [];
        this.tags = data.tags || [];
        this.queue = data.queue || [];
        this.localSeq = data.localSeq || 0;
        // Authorized withdrawals data
        this.authorizedPickups = data.authorizedPickups || [];
        this.todayWithdrawals = data.todayWithdrawals || [];
      } catch (e) {
        console.error('Error parsing localStorage data, resetting to defaults:', e);
        localStorage.removeItem('kioskData');
      }
    }

    // Always load config and device from JSON files (deployment config, not user data)
    await this.loadConfigFromJSON();

    // Load mock data only if no students (first run without backend)
    if (!this.students.length) {
      await this.loadMockData();
    }
  },

  async loadConfigFromJSON() {
    try {
      const [device, config] = await Promise.all([
        fetch('data/device.json').then(r => r.json()),
        fetch('data/config.json').then(r => r.json())
      ]);
      this.device = device;
      this.config = config;
    } catch (e) {
      console.error('Error loading config:', e);
      // Fallback defaults if config files fail to load
      this.device = this.device || { device_id: 'DEV-01', gate_id: 'GATE-1', online: true };
      this.config = this.config || { photoEnabled: true, autoResumeDelay: 5000 };
    }
  },

  async loadMockData() {
    try {
      const [students, teachers, tags, queue] = await Promise.all([
        fetch('data/students.json').then(r => r.json()),
        fetch('data/teachers.json').then(r => r.json()),
        fetch('data/tags.json').then(r => r.json()),
        fetch('data/queue.json').then(r => r.json())
      ]);
      this.students = students;
      this.teachers = teachers;
      this.tags = tags;
      this.queue = queue;
      this.persist();
    } catch (e) {
      console.error('Error loading mock data:', e);
    }
  },

  async loadFromJSON() {
    try {
      const [students, teachers, tags, device, queue, config] = await Promise.all([
        fetch('data/students.json').then(r => r.json()),
        fetch('data/teachers.json').then(r => r.json()),
        fetch('data/tags.json').then(r => r.json()),
        fetch('data/device.json').then(r => r.json()),
        fetch('data/queue.json').then(r => r.json()),
        fetch('data/config.json').then(r => r.json())
      ]);

      this.students = students;
      this.teachers = teachers;
      this.tags = tags;
      this.device = device;
      this.queue = queue;
      this.config = config;
      this.persist();
    } catch (e) {
      console.error('Error loading data', e);
    }
  },

  persist() {
    // R4-F10 fix: Handle localStorage quota exceeded error
    // Note: Only persist user/dynamic data. Config and device always come from JSON files.
    try {
      localStorage.setItem('kioskData', JSON.stringify({
        students: this.students,
        teachers: this.teachers,
        tags: this.tags,
        queue: this.queue,
        localSeq: this.localSeq,
        // Authorized withdrawals data
        authorizedPickups: this.authorizedPickups,
        todayWithdrawals: this.todayWithdrawals
        // config and device intentionally NOT persisted - always loaded fresh from JSON
      }));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.error('localStorage quota exceeded, attempting to sync pending events');
        // Notify UI and try to sync to free space
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('Almacenamiento lleno. Sincronizando...', 'warning');
        }
        if (typeof Sync !== 'undefined' && Sync.syncNow) {
          Sync.syncNow();
        }
      } else {
        console.error('Error persisting state:', e);
      }
    }
  },

  resolveByToken(token) {
    // Normalize token for search
    const normalizedToken = token.trim();

    // Try exact match first
    let tag = this.tags.find(t => t.token === normalizedToken);

    // If not found, try preview match (first 8 chars, case-insensitive)
    if (!tag && normalizedToken.length >= 8) {
      const preview = normalizedToken.substring(0, 8).toUpperCase();
      tag = this.tags.find(t =>
        t.token && t.token.toUpperCase().startsWith(preview)
      );
    }

    // If still not found, try matching by tag_token_preview field (backend format)
    if (!tag && normalizedToken.length >= 8) {
      const preview = normalizedToken.substring(0, 8).toUpperCase();
      tag = this.tags.find(t =>
        t.tag_token_preview && t.tag_token_preview.toUpperCase() === preview
      );
    }

    if (!tag) return null;

    // Handle non-active statuses
    if (tag.status === 'REVOKED') return { error: 'REVOKED' };
    if (tag.status === 'EXPIRED') return { error: 'EXPIRED' };
    if (tag.status === 'PENDING') return { error: 'PENDING' };
    if (tag.status !== 'ACTIVE') return { error: 'INVALID_STATUS' };

    // Check if it's a teacher
    if (tag.teacher_id) {
      const teacher = this.teachers.find(t => t.id === tag.teacher_id);
      return teacher ? { type: 'teacher', data: teacher } : null;
    }

    // Check if it's a student
    if (tag.student_id) {
      const student = this.students.find(s => s.id === tag.student_id);
      return student ? { type: 'student', data: student } : null;
    }

    return null;
  },

  resolveStudentByToken(token) {
    // Normalize token for search
    const normalizedToken = token.trim();

    // Try exact match first
    let tag = this.tags.find(t => t.token === normalizedToken);

    // If not found, try preview match (first 8 chars, case-insensitive)
    if (!tag && normalizedToken.length >= 8) {
      const preview = normalizedToken.substring(0, 8).toUpperCase();
      tag = this.tags.find(t =>
        t.token && t.token.toUpperCase().startsWith(preview)
      );
    }

    // If still not found, try matching by tag_token_preview field (backend format)
    if (!tag && normalizedToken.length >= 8) {
      const preview = normalizedToken.substring(0, 8).toUpperCase();
      tag = this.tags.find(t =>
        t.tag_token_preview && t.tag_token_preview.toUpperCase() === preview
      );
    }

    if (!tag) return null;

    // Handle non-active statuses
    if (tag.status === 'REVOKED') return { error: 'REVOKED' };
    if (tag.status === 'EXPIRED') return { error: 'EXPIRED' };
    if (tag.status === 'PENDING') return { error: 'PENDING' };
    if (tag.status !== 'ACTIVE') return { error: 'INVALID_STATUS' };

    const student = this.students.find(s => s.id === tag.student_id);
    return student || null;
  },

  nextEventTypeFor(studentId) {
    // CRITICAL: Use LOCAL date, not UTC. An event at 9:50 PM Chile = 00:50 AM UTC next day.
    // Using UTC would incorrectly include yesterday's late-night events as "today".
    const today = this._getLocalDateStr(new Date());
    // BUG-FIX: Ensure numeric comparison to avoid type mismatch after JSON.parse
    const numStudentId = parseInt(studentId, 10);
    const todayEvents = this.queue.filter(e => {
      const eventStudentId = parseInt(e.student_id, 10);
      const eventLocalDate = this._getLocalDateStr(e.ts);
      return eventStudentId === numStudentId && eventLocalDate === today;
    });

    // Debug logging to help diagnose IN/OUT toggle issues
    console.log(`nextEventTypeFor(${studentId}): today=${today}, queue=${this.queue.length}, todayEvents=${todayEvents.length}`);
    if (todayEvents.length > 0) {
      console.log('Today events:', todayEvents.map(e => ({ id: e.id, type: e.type, ts: e.ts, status: e.status })));
    }

    // BUG-FIX: Check if student has a COMPLETED withdrawal today
    // A completed withdrawal is effectively an OUT event
    const completedWithdrawal = this.todayWithdrawals.find(w =>
      parseInt(w.student_id, 10) === numStudentId &&
      w.status === 'COMPLETED'
    );

    if (completedWithdrawal) {
      console.log(`Student ${studentId} has completed withdrawal today - treating as OUT`);
      // If withdrawn today, their next event should be IN (next day logic)
      // But actually, they already left - so next event is IN
      return 'IN';
    }

    const lastEvent = todayEvents[todayEvents.length - 1];
    const nextType = lastEvent && lastEvent.type === 'IN' ? 'OUT' : 'IN';
    console.log(`Last event: ${lastEvent ? lastEvent.type : 'none'} -> next: ${nextType}`);
    return nextType;
  },

  enqueueEvent(event) {
    const studentId = parseInt(event.student_id, 10);
    const now = Date.now();

    // DEBOUNCE: Check if we recently enqueued an event for this student
    const lastEvent = this._lastEventByStudent[studentId];
    if (lastEvent) {
      const timeSinceLast = now - lastEvent.timestamp;
      if (timeSinceLast < this._EVENT_DEBOUNCE_MS) {
        console.warn(`[State] DEBOUNCE: Ignoring duplicate ${event.type} for student ${studentId} (${timeSinceLast}ms since last event)`);
        return null; // Signal that event was not enqueued
      }
    }

    // Track this event for debouncing
    this._lastEventByStudent[studentId] = {
      type: event.type,
      timestamp: now
    };

    this.localSeq++;
    event.local_seq = this.localSeq;
    event.id = `${this.device.device_id}_${this.localSeq}`;
    event.device_id = this.device.device_id;
    event.gate_id = this.device.gate_id;
    event.status = 'pending';
    event.retries = 0;

    this.queue.push(event);
    this.persist();
    console.log(`[State] Event enqueued: ${event.type} for student ${studentId}`);
    return event;
  },

  markSynced(id) {
    const event = this.queue.find(e => e.id === id);
    if (event) {
      event.status = 'synced';
      this.persist();
    }
  },

  // Mark event as partially synced (event OK, photo failed)
  markPartialSync(id, serverId) {
    const event = this.queue.find(e => e.id === id);
    if (event) {
      event.status = 'partial_sync';
      event.server_id = serverId;
      event.photo_retries = (event.photo_retries || 0) + 1;
      this.persist();
    }
  },

  updateEventStatus(id, status) {
    const event = this.queue.find(e => e.id === id);
    if (event) {
      event.status = status;
      if (status === 'error') event.retries = (event.retries || 0) + 1;
      this.persist();
    }
  },

  getPendingCount() {
    return this.queue.filter(e =>
      e.status === 'pending' ||
      e.status === 'in_progress' ||
      e.status === 'partial_sync'
    ).length;
  },

  toggleOnline() {
    this.device.online = !this.device.online;
    this.persist();
  },

  // Update students from server data (includes photo_url presigned)
  updateStudents(serverStudents) {
    // R4-F5 fix: Validate server response before processing
    if (!serverStudents || serverStudents.length === 0) {
      console.warn('Received empty student list from server, skipping update to prevent data loss');
      return;
    }

    // Merge server data with local data, preserving local-only fields
    const studentMap = new Map(this.students.map(s => [s.id, s]));

    for (const serverStudent of serverStudents) {
      const existing = studentMap.get(serverStudent.id);
      if (existing) {
        // Update existing student with server data
        existing.full_name = serverStudent.full_name;
        existing.course_id = serverStudent.course_id;
        existing.course_name = serverStudent.course_name || null;  // Store course name for display
        existing.photo_url = serverStudent.photo_url;  // Presigned URL from server
        existing.photo_opt_in = serverStudent.photo_pref_opt_in ?? false;
        existing.evidence_preference = serverStudent.evidence_preference ?? 'none';
        existing.guardian_name = serverStudent.guardian_name || null;
      } else {
        // Add new student
        this.students.push({
          id: serverStudent.id,
          full_name: serverStudent.full_name,
          course_id: serverStudent.course_id,
          course_name: serverStudent.course_name || null,  // Store course name for display
          photo_url: serverStudent.photo_url,  // Presigned URL from server
          photo_opt_in: serverStudent.photo_pref_opt_in ?? false,
          evidence_preference: serverStudent.evidence_preference ?? 'none',
          guardian_name: serverStudent.guardian_name || null
        });
      }
    }

    // Remove students that no longer exist on server
    const serverIds = new Set(serverStudents.map(s => s.id));
    this.students = this.students.filter(s => serverIds.has(s.id));

    this.persist();
  },

  // Update tags from server data
  // TDD-R2-BUG5 fix: Validate server response before processing
  updateTags(serverTags) {
    if (!serverTags || serverTags.length === 0) {
      console.warn('Received empty tag list from server, skipping update to prevent data loss');
      return;
    }
    this.tags = serverTags.map(t => ({
      token: t.token,
      student_id: t.student_id,
      teacher_id: t.teacher_id,
      status: t.status
    }));
    this.persist();
  },

  // Update teachers from server data
  // TDD-R2-BUG5 fix: Validate server response before processing
  updateTeachers(serverTeachers) {
    if (!serverTeachers || serverTeachers.length === 0) {
      console.warn('Received empty teacher list from server, skipping update to prevent data loss');
      return;
    }
    this.teachers = serverTeachers.map(t => ({
      id: t.id,
      full_name: t.full_name
    }));
    this.persist();
  },

  // Import today's events from server for IN/OUT state tracking
  // Called on bootstrap to restore proper IN/OUT alternation after cache clear
  importTodayEvents(serverEvents) {
    if (!serverEvents || serverEvents.length === 0) {
      console.log('No server events to import for today');
      return;
    }

    // Add server events to queue as 'synced' so they count for IN/OUT but don't re-sync
    for (const event of serverEvents) {
      // Check if this event already exists in queue (by server id)
      const existing = this.queue.find(e =>
        e.server_id === event.id ||
        (e.student_id === event.student_id && e.ts === event.ts)
      );

      if (!existing) {
        // Add as synced event
        this.queue.push({
          id: `server_${event.id}`,
          server_id: event.id,
          student_id: event.student_id,
          type: event.type,
          ts: event.ts,
          status: 'synced',
          from_server: true  // Flag to identify server-imported events
        });
      }
    }

    console.log(`Imported ${serverEvents.length} server events for today's IN/OUT state`);
    this.persist();
  },

  // Check if student has photo consent
  hasPhotoConsent(studentId) {
    const student = this.students.find(s => s.id === studentId);
    // Privacy by default: require explicit opt-in for photo capture
    return student ? (student.photo_opt_in === true) : false;
  },

  // Get student by ID
  getStudentById(studentId) {
    return this.students.find(s => s.id === studentId) || null;
  },

  // Update or add a student from biometric auth response
  updateStudentFromBiometric(studentData) {
    const existing = this.students.find(s => s.id === studentData.student_id);
    if (existing) {
      // Update existing student
      existing.full_name = studentData.full_name || existing.full_name;
      existing.photo_url = studentData.photo_url || existing.photo_url;
      existing.photo_opt_in = studentData.has_photo_consent ?? existing.photo_opt_in;
      // Sync evidence_preference with photo consent for consistency
      if (studentData.has_photo_consent && (!existing.evidence_preference || existing.evidence_preference === 'none')) {
        existing.evidence_preference = 'photo';
      }
    } else {
      // Add new student from biometric response
      this.students.push({
        id: studentData.student_id,
        full_name: studentData.full_name,
        national_id: studentData.national_id,
        course_id: null,
        photo_url: studentData.photo_url,
        photo_opt_in: studentData.has_photo_consent ?? false,
        evidence_preference: studentData.has_photo_consent ? 'photo' : 'none',
        guardian_name: null
      });
    }
    this.persist();
  },

  // Get evidence preference for a student: "photo", "audio", or "none"
  getEvidencePreference(studentId) {
    const student = this.students.find(s => s.id === studentId);
    if (!student) return 'none';

    // Use new evidence_preference field if available
    if (student.evidence_preference && student.evidence_preference !== 'none') {
      return student.evidence_preference;
    }

    // Fall back to legacy photo_opt_in
    if (student.photo_opt_in === true) {
      return 'photo';
    }

    return 'none';
  },

  // =========================================================================
  // AUTHORIZED WITHDRAWALS METHODS
  // =========================================================================

  // Update authorized pickups from server data (from bootstrap)
  updateAuthorizedPickups(serverPickups) {
    if (!serverPickups || serverPickups.length === 0) {
      console.log('No authorized pickups received from server');
      this.authorizedPickups = [];
      this.persist();
      return;
    }

    this.authorizedPickups = serverPickups.map(p => ({
      id: p.id,
      full_name: p.full_name,
      relationship_type: p.relationship_type,
      qr_code_hash: p.qr_code_hash,
      photo_url: p.photo_url,
      student_ids: p.student_ids || []
    }));
    console.log(`Updated ${this.authorizedPickups.length} authorized pickups`);
    this.persist();
  },

  // Update today's withdrawals from server data (from bootstrap)
  updateTodayWithdrawals(serverWithdrawals) {
    if (!serverWithdrawals) {
      this.todayWithdrawals = [];
      this.persist();
      return;
    }

    this.todayWithdrawals = serverWithdrawals.map(w => ({
      id: w.id,
      student_id: w.student_id,
      pickup_name: w.pickup_name,
      status: w.status,
      withdrawn_at: w.withdrawn_at
    }));
    console.log(`Updated ${this.todayWithdrawals.length} today withdrawals`);
    this.persist();
  },

  // Hash a string using SHA256 (Web Crypto API)
  async _hashSHA256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 64); // Match backend's [:64] truncation
  },

  // Resolve authorized pickup by QR code token
  // The QR contains a token, we hash it to match stored qr_code_hash
  async resolvePickupByQR(qrToken) {
    if (!qrToken) return null;

    const normalizedToken = qrToken.trim();

    // Hash the token to match stored qr_code_hash
    const qrHash = await this._hashSHA256(normalizedToken);

    const pickup = this.authorizedPickups.find(p =>
      p.qr_code_hash && p.qr_code_hash === qrHash
    );

    if (!pickup) return null;

    // Return pickup with their authorized students
    const students = this.students.filter(s =>
      pickup.student_ids.includes(s.id)
    );

    return {
      pickup: pickup,
      students: students
    };
  },

  // Search authorized pickups by name (for manual search fallback)
  searchPickupsByName(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.toLowerCase().trim();
    return this.authorizedPickups.filter(p =>
      p.full_name.toLowerCase().includes(term)
    ).slice(0, 10); // Limit to 10 results
  },

  // Get authorized pickup by ID
  getPickupById(pickupId) {
    return this.authorizedPickups.find(p => p.id === pickupId) || null;
  },

  // Check if student can be withdrawn today
  canWithdrawStudent(studentId) {
    const numStudentId = parseInt(studentId, 10);

    // Check if student already has a COMPLETED withdrawal today
    const completedWithdrawal = this.todayWithdrawals.find(w =>
      w.student_id === numStudentId && w.status === 'COMPLETED'
    );
    if (completedWithdrawal) {
      return { allowed: false, reason: 'Ya fue retirado hoy' };
    }

    // Check if student entered today (has IN event)
    // CRITICAL: Use LOCAL date, not UTC (same timezone fix as nextEventTypeFor)
    const today = this._getLocalDateStr(new Date());
    const todayInEvent = this.queue.find(e =>
      parseInt(e.student_id, 10) === numStudentId &&
      e.type === 'IN' &&
      this._getLocalDateStr(e.ts) === today
    );
    if (!todayInEvent) {
      return { allowed: false, reason: 'No ingresó hoy' };
    }

    // Check if student already exited (last event is OUT)
    const todayEvents = this.queue.filter(e =>
      parseInt(e.student_id, 10) === numStudentId &&
      this._getLocalDateStr(e.ts) === today
    ).sort((a, b) => new Date(a.ts) - new Date(b.ts));

    if (todayEvents.length > 0) {
      const lastEvent = todayEvents[todayEvents.length - 1];
      if (lastEvent.type === 'OUT') {
        return { allowed: false, reason: 'Ya registró salida' };
      }
    }

    return { allowed: true };
  },

  // Get students that a pickup can withdraw (filtered by eligibility)
  getWithdrawableStudents(pickupId) {
    const pickup = this.getPickupById(pickupId);
    if (!pickup) return [];

    return this.students
      .filter(s => pickup.student_ids.includes(s.id))
      .map(s => {
        const eligibility = this.canWithdrawStudent(s.id);
        return {
          ...s,
          canWithdraw: eligibility.allowed,
          withdrawReason: eligibility.reason
        };
      });
  },

  // Start a withdrawal process
  startWithdrawal(pickupId, studentIds) {
    const pickup = this.getPickupById(pickupId);
    if (!pickup) return null;

    this.pendingWithdrawal = {
      pickup_id: pickupId,
      pickup_name: pickup.full_name,
      pickup_relationship: pickup.relationship_type,
      pickup_photo_url: pickup.photo_url,
      student_ids: studentIds,
      students: studentIds.map(id => this.getStudentById(id)).filter(Boolean),
      status: 'INITIATED',
      initiated_at: new Date().toISOString()
    };

    return this.pendingWithdrawal;
  },

  // Update pending withdrawal status
  updateWithdrawalStatus(status, additionalData = {}) {
    if (!this.pendingWithdrawal) return null;

    this.pendingWithdrawal.status = status;
    Object.assign(this.pendingWithdrawal, additionalData);

    if (status === 'COMPLETED') {
      // Add to today's withdrawals
      for (const studentId of this.pendingWithdrawal.student_ids) {
        this.todayWithdrawals.push({
          id: `local_${Date.now()}_${studentId}`,
          student_id: studentId,
          pickup_name: this.pendingWithdrawal.pickup_name,
          status: 'COMPLETED',
          withdrawn_at: new Date().toISOString()
        });
      }
      this.persist();
    }

    return this.pendingWithdrawal;
  },

  // Clear pending withdrawal
  clearPendingWithdrawal() {
    this.pendingWithdrawal = null;
  },

  // Get current pending withdrawal
  getPendingWithdrawal() {
    return this.pendingWithdrawal;
  },

  // Add a single withdrawal to today's list (used by Sync after API completion)
  addTodayWithdrawal(withdrawalData) {
    const { student_id, withdrawn_at, pickup_name } = withdrawalData;

    // Check if already exists to avoid duplicates
    const exists = this.todayWithdrawals.some(w => w.student_id === student_id);
    if (exists) {
      console.log('[State] Withdrawal already exists for student:', student_id);
      return;
    }

    this.todayWithdrawals.push({
      id: `synced_${Date.now()}_${student_id}`,
      student_id,
      pickup_name: pickup_name || 'Desconocido',
      status: 'COMPLETED',
      withdrawn_at: withdrawn_at || new Date().toISOString()
    });

    this.persist();
    console.log('[State] Added withdrawal for student:', student_id);
  }
};

// Expose State globally to ensure availability in all contexts
window.State = State;
