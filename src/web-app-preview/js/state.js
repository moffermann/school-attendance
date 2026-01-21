// State management with localStorage persistence

/**
 * Normalize course data to ensure consistent structure.
 * @param {Object} course - Raw course data from API
 * @returns {Object} Normalized course with guaranteed fields
 */
function normalizeCourse(course) {
  if (!course) return null;
  return {
    ...course,
    teacher_ids: Array.isArray(course.teacher_ids) ? course.teacher_ids : [],
    status: course.status || 'ACTIVE',
  };
}

const State = {
  // Security: Valid roles for the application
  VALID_ROLES: ['director', 'inspector', 'parent', 'super_admin'],

  data: {
    students: [],
    guardians: [],
    courses: [],
    schedules: [],
    schedule_exceptions: [],
    attendance_events: [],
    devices: [],
    absences: [],
    notifications: [],
    teachers: []
  },
  currentRole: null, // 'director', 'inspector', 'parent'
  currentGuardianId: null,
  // Security: session token for integrity validation
  _sessionToken: null,
  // Multi-tenant: enabled features for current tenant
  _tenantFeatures: [],
  // Multi-tenant: tenant info
  _tenant: null,

  async init() {
    // Try to load from localStorage first
    const stored = localStorage.getItem('appData');
    if (stored) {
      try {
        this.data = JSON.parse(stored);
      } catch (e) {
        console.error('Error parsing stored data', e);
      }
    }

    // If no stored data or empty, load from JSON files
    if (!this.data.students || this.data.students.length === 0) {
      await this.loadFromJSON();
    }

    // Load user session with security validation
    const role = localStorage.getItem('currentRole');
    const guardianId = localStorage.getItem('currentGuardianId');
    const sessionToken = localStorage.getItem('sessionToken');

    // Security: If we have a JWT token, validate it with the backend
    if (typeof API !== 'undefined' && API.accessToken) {
      // Check if this is a super admin token (no tenant bootstrap)
      const payload = this._decodeJWT(API.accessToken);
      if (payload && payload.typ === 'super_admin') {
        // Super admin - set session directly from token (no bootstrap endpoint)
        this._user = {
          id: payload.sub,
          email: payload.email || '',
          full_name: payload.full_name || 'Super Admin',
          role: 'SUPER_ADMIN'
        };
        this.currentRole = 'super_admin';
        this._sessionToken = this._generateSessionToken();
        localStorage.setItem('currentRole', 'super_admin');
        localStorage.setItem('sessionToken', this._sessionToken);
        return; // Super admin session ready
      }

      try {
        // Verify token by fetching bootstrap - this validates the JWT server-side
        const bootstrap = await API.getBootstrap();
        // Token is valid - restore session from server data
        this.setFromBootstrap(bootstrap);
        return; // Session restored from server
      } catch {
        // Token invalid or expired - clear session
        console.warn('JWT token invalid or expired, clearing session');
        this.logout();
        return;
      }
    }

    // No JWT token - fallback to demo mode with localStorage validation
    // Security: Validate role is in allowed list
    if (role && this.VALID_ROLES.includes(role)) {
      // For parent role, validate guardian exists
      if (role === 'parent') {
        const gId = guardianId ? parseInt(guardianId) : null;
        const guardianExists = gId && this.data.guardians.some(g => g.id === gId);
        if (guardianExists) {
          this.currentRole = role;
          this.currentGuardianId = gId;
          this._sessionToken = sessionToken;
        } else {
          // Invalid guardian - clear session
          this.logout();
        }
      } else {
        // Staff roles (director/inspector)
        this.currentRole = role;
        this._sessionToken = sessionToken;
      }
    } else if (role) {
      // Invalid role found in localStorage - clear it
      console.warn('Invalid role in localStorage, clearing session');
      this.logout();
    }
  },

  // Security: Verify session is still valid
  isSessionValid() {
    if (!this.currentRole) return false;
    if (!this.VALID_ROLES.includes(this.currentRole)) return false;
    if (this.currentRole === 'parent' && !this.currentGuardianId) return false;
    return true;
  },

  async loadFromJSON() {
    const files = [
      'students', 'guardians', 'courses', 'schedules',
      'schedule_exceptions', 'attendance_events', 'devices',
      'absences', 'notifications', 'teachers'
    ];

    for (const file of files) {
      try {
        const response = await fetch(`data/${file}.json`);
        this.data[file] = await response.json();
      } catch (e) {
        console.error(`Error loading ${file}.json`, e);
        this.data[file] = [];
      }
    }

    this.persist();
  },

  persist() {
    localStorage.setItem('appData', JSON.stringify(this.data));
  },

  setRole(role, guardianId = null) {
    // Security: Validate role before setting
    if (!this.VALID_ROLES.includes(role)) {
      console.error('Invalid role:', role);
      return;
    }

    // For parent role, validate guardian exists
    if (role === 'parent') {
      if (!guardianId || !this.data.guardians.some(g => g.id === guardianId)) {
        console.error('Invalid guardian for parent role');
        return;
      }
    }

    this.currentRole = role;
    this.currentGuardianId = guardianId;

    // Generate session token for integrity check
    this._sessionToken = this._generateSessionToken();

    localStorage.setItem('currentRole', role);
    localStorage.setItem('sessionToken', this._sessionToken);
    if (guardianId) {
      localStorage.setItem('currentGuardianId', guardianId);
    } else {
      localStorage.removeItem('currentGuardianId');
    }
  },

  _generateSessionToken() {
    // Simple session token - in production this should come from backend
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  _decodeJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Failed to decode JWT:', e);
      return null;
    }
  },

  logout() {
    this.currentRole = null;
    this.currentGuardianId = null;
    this._sessionToken = null;
    this._user = null;
    // Multi-tenant: clear tenant data
    this._tenant = null;
    this._tenantFeatures = [];
    localStorage.removeItem('currentRole');
    localStorage.removeItem('currentGuardianId');
    localStorage.removeItem('sessionToken');
    // Clear API tokens
    if (typeof API !== 'undefined') {
      API.logout();
    }
  },

  /**
   * Set state from API bootstrap data
   * Called after successful JWT login
   */
  setFromBootstrap(bootstrap) {
    // Store user info (API returns current_user)
    this._user = bootstrap.current_user || bootstrap.user;

    // Store tenant info and features (multi-tenant support)
    if (bootstrap.tenant) {
      this._tenant = bootstrap.tenant;
    }
    if (bootstrap.features) {
      // features is an array of enabled feature names
      this._tenantFeatures = Array.isArray(bootstrap.features) ? bootstrap.features : [];
    } else {
      // Default: all features enabled if not specified
      this._tenantFeatures = [];
    }

    // Map API role to local role
    const roleMap = {
      'ADMIN': 'director',
      'DIRECTOR': 'director',
      'INSPECTOR': 'inspector',
      'PARENT': 'parent',
      'SUPER_ADMIN': 'super_admin'
    };
    // Fix: Use this._user instead of bootstrap.user (API may return current_user)
    const role = roleMap[this._user?.role] || 'director';

    // Set role and guardian ID
    this.currentRole = role;
    this.currentGuardianId = this._user?.guardian_id || null;
    this._sessionToken = this._generateSessionToken();

    // Store in localStorage
    localStorage.setItem('currentRole', role);
    localStorage.setItem('sessionToken', this._sessionToken);
    if (this.currentGuardianId) {
      localStorage.setItem('currentGuardianId', this.currentGuardianId);
    }

    // Update data from bootstrap
    if (bootstrap.courses) {
      this.data.courses = bootstrap.courses;
    }
    if (bootstrap.students) {
      this.data.students = bootstrap.students;
    }
    if (bootstrap.guardians) {
      this.data.guardians = bootstrap.guardians;
    }
    if (bootstrap.schedules) {
      this.data.schedules = bootstrap.schedules;
    }
    if (bootstrap.devices) {
      this.data.devices = bootstrap.devices;
    }
    if (bootstrap.teachers) {
      this.data.teachers = bootstrap.teachers;
    }
    if (bootstrap.absences) {
      this.data.absences = bootstrap.absences;
    }
    if (bootstrap.notifications) {
      this.data.notifications = bootstrap.notifications;
    }
    if (bootstrap.attendance_events) {
      this.data.attendance_events = bootstrap.attendance_events;
    }
    if (bootstrap.schedule_exceptions) {
      this.data.schedule_exceptions = bootstrap.schedule_exceptions;
    }

    this.persist();
  },

  /**
   * Get current user info (from API login)
   */
  getCurrentUser() {
    return this._user || null;
  },

  /**
   * Check if using real API auth (vs demo mode)
   */
  isApiAuthenticated() {
    return typeof API !== 'undefined' && API.isAuthenticated();
  },

  /**
   * Check if a feature/module is enabled for the current tenant.
   * Used to conditionally show/hide UI elements based on tenant features.
   *
   * @param {string} featureName - Feature name (e.g., 'webauthn', 'broadcasts', 'whatsapp')
   * @returns {boolean} - True if feature is enabled, false otherwise
   */
  isModuleEnabled(featureName) {
    // In demo mode (no API auth), all features are enabled
    if (!this.isApiAuthenticated()) {
      return true;
    }
    // Check if feature is in the enabled features list
    return this._tenantFeatures.includes(featureName);
  },

  /**
   * Get all enabled features for the current tenant.
   * @returns {string[]} - Array of enabled feature names
   */
  getEnabledFeatures() {
    return [...this._tenantFeatures];
  },

  /**
   * Get current tenant info.
   * @returns {object|null} - Tenant object or null
   */
  getTenant() {
    return this._tenant;
  },

  /**
   * Check if currently in impersonation mode.
   * @returns {boolean} - True if impersonating a tenant
   */
  isImpersonating() {
    return typeof API !== 'undefined' && API.isImpersonating();
  },

  /**
   * Get impersonation info if in impersonation mode.
   * @returns {object|null} - {tenantId, tenantName} or null
   */
  getImpersonationInfo() {
    if (typeof API === 'undefined') return null;
    return API.getImpersonationInfo();
  },

  // Getters
  getStudents() {
    return this.data.students || [];
  },

  getStudent(id) {
    return this.data.students.find(s => s.id === id);
  },

  getCourses() {
    return this.data.courses || [];
  },

  getCourse(id) {
    return this.data.courses.find(c => c.id === id);
  },

  getGuardians() {
    return this.data.guardians || [];
  },

  getGuardian(id) {
    return this.data.guardians.find(g => g.id === id);
  },

  getStudentsByCourse(courseId) {
    return this.data.students.filter(s => s.course_id === courseId);
  },

  getSchedules(courseId = null) {
    if (courseId === null) {
      return this.data.schedules;
    }
    return this.data.schedules.filter(s => s.course_id === courseId);
  },

  getScheduleExceptions() {
    return this.data.schedule_exceptions || [];
  },

  getAttendanceEvents(filters = {}) {
    let events = this.data.attendance_events || [];

    if (filters.studentId) {
      events = events.filter(e => e.student_id === filters.studentId);
    }

    if (filters.date) {
      events = events.filter(e => e.ts.startsWith(filters.date));
    }

    // Date range filter (startDate and endDate)
    if (filters.startDate) {
      events = events.filter(e => e.ts.split('T')[0] >= filters.startDate);
    }
    if (filters.endDate) {
      events = events.filter(e => e.ts.split('T')[0] <= filters.endDate);
    }

    if (filters.type) {
      events = events.filter(e => e.type === filters.type);
    }

    if (filters.courseId) {
      const studentIds = this.getStudentsByCourse(filters.courseId).map(s => s.id);
      events = events.filter(e => studentIds.includes(e.student_id));
    }

    return events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  },

  getTodayEvents() {
    const today = new Date().toISOString().split('T')[0];
    return this.getAttendanceEvents({ date: today });
  },

  getDevices() {
    return this.data.devices || [];
  },

  getAbsences() {
    return this.data.absences || [];
  },

  getNotifications(filters = {}) {
    let notifications = this.data.notifications || [];

    if (filters.status) {
      notifications = notifications.filter(n => n.status?.toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.channel) {
      notifications = notifications.filter(n => n.channel?.toLowerCase() === filters.channel.toLowerCase());
    }

    if (filters.type) {
      notifications = notifications.filter(n => n.type === filters.type);
    }

    if (filters.studentId) {
      notifications = notifications.filter(n => n.student_id === filters.studentId);
    }

    if (filters.dateFrom) {
      notifications = notifications.filter(n => n.sent_at >= filters.dateFrom);
    }

    if (filters.dateTo) {
      notifications = notifications.filter(n => n.sent_at <= filters.dateTo + 'T23:59:59');
    }

    return notifications.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
  },

  getNotificationStats() {
    const notifications = this.data.notifications || [];
    return {
      total: notifications.length,
      delivered: notifications.filter(n => n.status?.toLowerCase() === 'delivered').length,
      failed: notifications.filter(n => n.status?.toLowerCase() === 'failed').length,
      pending: notifications.filter(n => n.status?.toLowerCase() === 'pending').length,
      byChannel: {
        whatsapp: notifications.filter(n => n.channel?.toLowerCase() === 'whatsapp').length,
        email: notifications.filter(n => n.channel?.toLowerCase() === 'email').length
      }
    };
  },

  retryNotification(id) {
    const index = this.data.notifications.findIndex(n => n.id === id);
    if (index !== -1 && this.data.notifications[index].status?.toLowerCase() === 'failed') {
      this.data.notifications[index].status = 'pending';
      this.data.notifications[index].retry_at = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  },

  // Setters
  addScheduleException(exception) {
    const id = Math.max(0, ...this.data.schedule_exceptions.map(e => e.id)) + 1;
    exception.id = id;
    this.data.schedule_exceptions.push(exception);
    this.persist();
    return exception;
  },

  updateScheduleException(id, data) {
    const index = this.data.schedule_exceptions.findIndex(e => e.id === id);
    if (index !== -1) {
      this.data.schedule_exceptions[index] = { ...this.data.schedule_exceptions[index], ...data };
      this.persist();
    }
  },

  deleteScheduleException(id) {
    this.data.schedule_exceptions = this.data.schedule_exceptions.filter(e => e.id !== id);
    this.persist();
  },

  addAbsence(absence) {
    const id = Math.max(0, ...this.data.absences.map(a => a.id)) + 1;
    absence.id = id;
    absence.status = absence.status || 'PENDING';
    this.data.absences.push(absence);
    this.persist();
    return absence;
  },

  updateAbsence(id, data) {
    const index = this.data.absences.findIndex(a => a.id === id);
    if (index !== -1) {
      this.data.absences[index] = { ...this.data.absences[index], ...data };
      this.persist();
    }
  },

  /**
   * Create a new schedule via API
   */
  async createSchedule(courseId, scheduleData) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - crear localmente
      if (!this.data.schedules) this.data.schedules = [];
      const id = Math.max(0, ...this.data.schedules.map(s => s.id)) + 1;
      const schedule = {
        id,
        course_id: courseId,
        weekday: scheduleData.weekday,
        in_time: scheduleData.in_time,
        out_time: scheduleData.out_time
      };
      this.data.schedules.push(schedule);
      this.persist();
      return schedule;
    }

    try {
      const schedule = await API.createSchedule(courseId, scheduleData);
      this.data.schedules.push(schedule);
      this.persist();
      return schedule;
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw error;
    }
  },

  /**
   * Update a schedule via API
   */
  async updateSchedule(scheduleId, updateData) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - actualizar localmente
      const index = this.data.schedules.findIndex(s => s.id === scheduleId);
      if (index !== -1) {
        this.data.schedules[index] = { ...this.data.schedules[index], ...updateData };
        this.persist();
        return this.data.schedules[index];
      }
      throw new Error('Horario no encontrado');
    }

    try {
      const schedule = await API.updateSchedule(scheduleId, updateData);
      const index = this.data.schedules.findIndex(s => s.id === scheduleId);
      if (index !== -1) {
        this.data.schedules[index] = schedule;
      }
      this.persist();
      return schedule;
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  },

  // Stats helpers

  /**
   * Determine if an IN event is late based on the student's course schedule.
   * @param {Object} event - Attendance event with student_id and ts
   * @returns {boolean} - True if the event is after the scheduled in_time
   */
  _isEventLate(event) {
    // Get the student
    const student = this.getStudent(event.student_id);
    if (!student || !student.course_id) return false;

    // Get the event's day of week (JS: 0=Sunday, 1=Monday... 6=Saturday)
    // Schedule weekdays are 1=Monday to 5=Friday
    const eventDate = new Date(event.ts);
    const weekday = eventDate.getDay();

    // Skip weekends - no schedule
    if (weekday === 0 || weekday === 6) return false;

    // Get schedule for this course/weekday
    const schedule = (this.data.schedules || []).find(
      s => s.course_id === student.course_id && s.weekday === weekday
    );

    if (!schedule || !schedule.in_time) return false;

    // Compare times - event time vs schedule in_time
    // Event time format: "HH:MM:SS" or "HH:MM:SS.ssssss"
    // Schedule time format: "HH:MM"
    const eventTime = event.ts.split('T')[1].substring(0, 5); // "HH:MM"
    const scheduleTime = schedule.in_time.substring(0, 5); // "HH:MM"

    return eventTime > scheduleTime;
  },

  getTodayStats() {
    const events = this.getTodayEvents();
    const inEvents = events.filter(e => e.type === 'IN');
    const outEvents = events.filter(e => e.type === 'OUT');

    // Count late arrivals based on each student's course schedule
    const lateEvents = inEvents.filter(e => this._isEventLate(e));

    // Students without IN event
    const studentsWithIn = new Set(inEvents.map(e => e.student_id));
    const allStudents = this.getStudents();
    const noInCount = allStudents.length - studentsWithIn.size;

    return {
      totalIn: inEvents.length,
      totalOut: outEvents.length,
      lateCount: lateEvents.length,
      noInCount
    };
  },

  // Parent helpers
  getGuardianStudents(guardianId) {
    const guardian = this.getGuardian(guardianId);
    if (!guardian) return [];
    return guardian.student_ids.map(id => this.getStudent(id)).filter(Boolean);
  },

  // ============================================
  // CRUD: Guardians (with API integration)
  // ============================================

  /**
   * Refresh guardians from API
   * @param {Object} filters - Optional filters
   * @param {string} [filters.status] - Filter by status (ACTIVE, DELETED)
   * @returns {Promise<Array>} List of guardians
   */
  async refreshGuardians(filters = {}) {
    if (!this.isApiAuthenticated()) {
      // Demo mode: filter locally if status provided
      let guardians = this.data.guardians || [];
      if (filters.status) {
        guardians = guardians.filter(g => (g.status || 'ACTIVE') === filters.status);
      }
      return guardians;
    }

    try {
      const response = await API.getGuardians({ limit: 100, status: filters.status });
      this.data.guardians = response.items || [];
      this.persist();
      return this.data.guardians;
    } catch (error) {
      console.error('Error refreshing guardians:', error);
      // Return local data as fallback
      return this.data.guardians || [];
    }
  },

  /**
   * Create a new guardian via API
   * @param {Object} guardian - Guardian data
   * @param {string} guardian.full_name - Full name (required)
   * @param {Object} [guardian.contacts] - Contact info {email, phone, whatsapp}
   * @param {number[]} [guardian.student_ids] - Student IDs to associate
   * @returns {Promise<Object>} Created guardian
   */
  async addGuardian(guardian) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - create locally
      if (!this.data.guardians) this.data.guardians = [];
      const id = Math.max(0, ...this.data.guardians.map(g => g.id)) + 1;
      guardian.id = id;
      guardian.student_ids = guardian.student_ids || [];
      this.data.guardians.push(guardian);
      this.persist();
      return guardian;
    }

    try {
      const created = await API.createGuardian(guardian);
      // Add to local state
      if (!this.data.guardians) this.data.guardians = [];
      this.data.guardians.push(created);
      this.persist();
      return created;
    } catch (error) {
      console.error('Error adding guardian:', error);
      throw error;
    }
  },

  /**
   * Update a guardian via API
   * @param {number} id - Guardian ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated guardian
   */
  async updateGuardian(id, data) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - update locally
      if (!this.data.guardians) return null;
      const index = this.data.guardians.findIndex(g => g.id === id);
      if (index !== -1) {
        this.data.guardians[index] = { ...this.data.guardians[index], ...data };
        this.persist();
        return this.data.guardians[index];
      }
      throw new Error('Apoderado no encontrado');
    }

    try {
      const updated = await API.updateGuardian(id, data);
      // Update local state
      const index = this.data.guardians.findIndex(g => g.id === id);
      if (index !== -1) {
        this.data.guardians[index] = updated;
      } else {
        this.data.guardians.push(updated);
      }
      this.persist();
      return updated;
    } catch (error) {
      console.error('Error updating guardian:', error);
      throw error;
    }
  },

  /**
   * Delete a guardian via API (soft delete)
   * @param {number} id - Guardian ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteGuardian(id) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - soft delete locally
      if (!this.data.guardians) return;
      const index = this.data.guardians.findIndex(g => g.id === id);
      if (index !== -1) {
        this.data.guardians[index].status = 'DELETED';
      }
      this.persist();
      return true;
    }

    try {
      await API.deleteGuardian(id);
      // Update local state - mark as deleted instead of removing
      const index = this.data.guardians.findIndex(g => g.id === id);
      if (index !== -1) {
        this.data.guardians[index].status = 'DELETED';
      }
      this.persist();
      return true;
    } catch (error) {
      console.error('Error deleting guardian:', error);
      throw error;
    }
  },

  /**
   * Restore a deleted guardian via API
   * @param {number} id - Guardian ID
   * @returns {Promise<Object>} Restored guardian
   */
  async restoreGuardian(id) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - restore locally
      if (!this.data.guardians) return null;
      const index = this.data.guardians.findIndex(g => g.id === id);
      if (index !== -1) {
        this.data.guardians[index].status = 'ACTIVE';
        this.persist();
        return this.data.guardians[index];
      }
      throw new Error('Apoderado no encontrado');
    }

    try {
      const restored = await API.restoreGuardian(id);
      // Update local state
      const index = this.data.guardians.findIndex(g => g.id === id);
      if (index !== -1) {
        this.data.guardians[index] = restored;
      } else {
        this.data.guardians.push(restored);
      }
      this.persist();
      return restored;
    } catch (error) {
      console.error('Error restoring guardian:', error);
      throw error;
    }
  },

  /**
   * Set the complete list of students for a guardian
   * @param {number} guardianId - Guardian ID
   * @param {number[]} studentIds - Array of student IDs
   * @returns {Promise<Object>} Updated guardian
   */
  async setGuardianStudents(guardianId, studentIds) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - update locally
      const index = this.data.guardians.findIndex(g => g.id === guardianId);
      if (index !== -1) {
        this.data.guardians[index].student_ids = studentIds;
        this.persist();
        return this.data.guardians[index];
      }
      throw new Error('Apoderado no encontrado');
    }

    try {
      const updated = await API.setGuardianStudents(guardianId, studentIds);
      // Update local state
      const index = this.data.guardians.findIndex(g => g.id === guardianId);
      if (index !== -1) {
        this.data.guardians[index] = updated;
      }
      this.persist();
      return updated;
    } catch (error) {
      console.error('Error setting guardian students:', error);
      throw error;
    }
  },

  // ============================================
  // CRUD: Students
  // ============================================
  addStudent(student) {
    const id = Math.max(0, ...this.data.students.map(s => s.id)) + 1;
    student.id = id;
    student.photo_pref_opt_in = student.photo_pref_opt_in || false;
    this.data.students.push(student);
    this.persist();
    return student;
  },

  updateStudent(id, data) {
    const index = this.data.students.findIndex(s => s.id === id);
    if (index !== -1) {
      this.data.students[index] = { ...this.data.students[index], ...data };
      this.persist();
      return this.data.students[index];
    }
    return null;
  },

  deleteStudent(id) {
    this.data.students = this.data.students.filter(s => s.id !== id);
    // Also remove from guardians
    this.data.guardians.forEach(g => {
      g.student_ids = g.student_ids.filter(sid => sid !== id);
    });
    // Remove attendance events
    this.data.attendance_events = this.data.attendance_events.filter(e => e.student_id !== id);
    this.persist();
  },

  // ============================================
  // CRUD: Teachers (with API integration)
  // ============================================

  getTeachers() {
    return this.data.teachers || [];
  },

  getTeacher(id) {
    return (this.data.teachers || []).find(t => t.id === id);
  },

  /**
   * Refresh teachers from API
   * @param {Object} filters - Optional filters
   * @param {string} [filters.status] - Filter by status (ACTIVE, INACTIVE, ON_LEAVE, DELETED)
   * @returns {Promise<Array>} List of teachers
   */
  async refreshTeachers(filters = {}) {
    if (!this.isApiAuthenticated()) {
      // Demo mode: filter locally if status provided
      let teachers = this.data.teachers || [];
      if (filters.status) {
        teachers = teachers.filter(t => (t.status || 'ACTIVE') === filters.status);
      }
      return teachers;
    }

    try {
      const response = await API.getTeachers({ limit: 100, status: filters.status });
      this.data.teachers = response.items || [];
      this.persist();
      return this.data.teachers;
    } catch (error) {
      console.error('Error refreshing teachers:', error);
      // Return local data as fallback
      return this.data.teachers || [];
    }
  },

  /**
   * Create a new teacher via API
   * @param {Object} teacher - Teacher data
   * @param {string} teacher.full_name - Full name (required)
   * @param {string} [teacher.email] - Email address
   * @param {string} [teacher.status] - ACTIVE, INACTIVE, or ON_LEAVE
   * @param {boolean} [teacher.can_enroll_biometric] - Can enroll biometric
   * @returns {Promise<Object>} Created teacher
   */
  async addTeacher(teacher) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - create locally
      if (!this.data.teachers) this.data.teachers = [];
      const id = Math.max(0, ...this.data.teachers.map(t => t.id)) + 1;
      teacher.id = id;
      teacher.status = teacher.status || 'ACTIVE';
      teacher.can_enroll_biometric = teacher.can_enroll_biometric || false;
      this.data.teachers.push(teacher);
      this.persist();
      return teacher;
    }

    try {
      const created = await API.createTeacher(teacher);
      // Add to local state
      if (!this.data.teachers) this.data.teachers = [];
      this.data.teachers.push(created);
      this.persist();
      return created;
    } catch (error) {
      console.error('Error adding teacher:', error);
      throw error;
    }
  },

  /**
   * Update a teacher via API
   * @param {number} id - Teacher ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated teacher
   */
  async updateTeacher(id, data) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - update locally
      if (!this.data.teachers) return null;
      const index = this.data.teachers.findIndex(t => t.id === id);
      if (index !== -1) {
        this.data.teachers[index] = { ...this.data.teachers[index], ...data };
        this.persist();
        return this.data.teachers[index];
      }
      throw new Error('Profesor no encontrado');
    }

    try {
      const updated = await API.updateTeacher(id, data);
      // Update local state
      const index = this.data.teachers.findIndex(t => t.id === id);
      if (index !== -1) {
        this.data.teachers[index] = updated;
      } else {
        this.data.teachers.push(updated);
      }
      this.persist();
      return updated;
    } catch (error) {
      console.error('Error updating teacher:', error);
      throw error;
    }
  },

  /**
   * Delete a teacher via API (soft delete)
   * @param {number} id - Teacher ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteTeacher(id) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - soft delete locally
      if (!this.data.teachers) return;
      const index = this.data.teachers.findIndex(t => t.id === id);
      if (index !== -1) {
        this.data.teachers[index].status = 'DELETED';
      }
      this.persist();
      return true;
    }

    try {
      await API.deleteTeacher(id);
      // Update local state - mark as deleted instead of removing
      const index = this.data.teachers.findIndex(t => t.id === id);
      if (index !== -1) {
        this.data.teachers[index].status = 'DELETED';
      }
      this.persist();
      return true;
    } catch (error) {
      console.error('Error deleting teacher:', error);
      throw error;
    }
  },

  /**
   * Restore a deleted teacher via API
   * @param {number} id - Teacher ID
   * @returns {Promise<Object>} Restored teacher
   */
  async restoreTeacher(id) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - restore locally
      if (!this.data.teachers) return null;
      const index = this.data.teachers.findIndex(t => t.id === id);
      if (index !== -1) {
        this.data.teachers[index].status = 'ACTIVE';
        this.persist();
        return this.data.teachers[index];
      }
      throw new Error('Profesor no encontrado');
    }

    try {
      const restored = await API.restoreTeacher(id);
      // Update local state
      const index = this.data.teachers.findIndex(t => t.id === id);
      if (index !== -1) {
        this.data.teachers[index] = restored;
      } else {
        this.data.teachers.push(restored);
      }
      this.persist();
      return restored;
    } catch (error) {
      console.error('Error restoring teacher:', error);
      throw error;
    }
  },

  /**
   * Assign a course to a teacher via API
   * @param {number} teacherId - Teacher ID
   * @param {number} courseId - Course ID
   * @returns {Promise<boolean>} True if assigned
   */
  async assignCourseToTeacher(teacherId, courseId) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - update locally
      const course = this.data.courses.find(c => c.id === courseId);
      if (course) {
        if (!course.teacher_ids) course.teacher_ids = [];
        if (!course.teacher_ids.includes(teacherId)) {
          course.teacher_ids.push(teacherId);
        }
        this.persist();
      }
      return true;
    }

    try {
      await API.assignCourseToTeacher(teacherId, courseId);
      // Update local state
      const course = this.data.courses.find(c => c.id === courseId);
      if (course) {
        if (!course.teacher_ids) course.teacher_ids = [];
        if (!course.teacher_ids.includes(teacherId)) {
          course.teacher_ids.push(teacherId);
        }
      }
      this.persist();
      return true;
    } catch (error) {
      console.error('Error assigning course:', error);
      throw error;
    }
  },

  /**
   * Unassign a course from a teacher via API
   * @param {number} teacherId - Teacher ID
   * @param {number} courseId - Course ID
   * @returns {Promise<boolean>} True if unassigned
   */
  async unassignCourseFromTeacher(teacherId, courseId) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - update locally
      const course = this.data.courses.find(c => c.id === courseId);
      if (course && course.teacher_ids) {
        course.teacher_ids = course.teacher_ids.filter(tid => tid !== teacherId);
        if (course.teacher_id === teacherId) {
          course.teacher_id = null;
        }
        this.persist();
      }
      return true;
    }

    try {
      await API.unassignCourseFromTeacher(teacherId, courseId);
      // Update local state
      const course = this.data.courses.find(c => c.id === courseId);
      if (course && course.teacher_ids) {
        course.teacher_ids = course.teacher_ids.filter(tid => tid !== teacherId);
        if (course.teacher_id === teacherId) {
          course.teacher_id = null;
        }
      }
      this.persist();
      return true;
    } catch (error) {
      console.error('Error unassigning course:', error);
      throw error;
    }
  },

  // ============================================
  // CRUD: Courses (with API integration)
  // ============================================

  /**
   * Refresh courses from API
   */
  async refreshCourses() {
    if (!this.isApiAuthenticated()) {
      // In demo mode, just return local data
      return this.data.courses;
    }

    try {
      const response = await API.getCourses({ limit: 100 });
      // Normalize all courses to ensure consistent structure
      this.data.courses = (response.items || []).map(normalizeCourse);
      this.persist();
      return this.data.courses;
    } catch (error) {
      console.error('Error refreshing courses:', error);
      throw error;
    }
  },

  /**
   * Get course detail with stats from API
   */
  async getCourseDetail(courseId) {
    if (!this.isApiAuthenticated()) {
      // In demo mode, return local course
      return this.getCourse(courseId);
    }

    try {
      return await API.getCourse(courseId);
    } catch (error) {
      console.error('Error getting course detail:', error);
      throw error;
    }
  },

  /**
   * Create a new course via API
   */
  async createCourse(courseData) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - create locally
      if (!this.data.courses) this.data.courses = [];
      const id = Math.max(0, ...this.data.courses.map(c => c.id)) + 1;
      const course = {
        id,
        name: courseData.name,
        grade: courseData.grade,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.courses.push(course);
      this.persist();
      return course;
    }

    try {
      const course = await API.createCourse(courseData);
      // Normalize and add to local data
      const normalized = normalizeCourse(course);
      this.data.courses.push(normalized);
      this.persist();
      return normalized;
    } catch (error) {
      console.error('Error creating course:', error);
      throw error;
    }
  },

  /**
   * Update a course via API
   */
  async updateCourse(courseId, updateData) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - update locally
      const index = this.data.courses.findIndex(c => c.id === courseId);
      if (index !== -1) {
        this.data.courses[index] = { ...this.data.courses[index], ...updateData, updated_at: new Date().toISOString() };
        this.persist();
        return this.data.courses[index];
      }
      throw new Error('Curso no encontrado');
    }

    try {
      const course = await API.updateCourse(courseId, updateData);
      // Normalize and update local data
      const normalized = normalizeCourse(course);
      const index = this.data.courses.findIndex(c => c.id === courseId);
      if (index !== -1) {
        this.data.courses[index] = normalized;
      } else {
        this.data.courses.push(normalized);
      }
      this.persist();
      return normalized;
    } catch (error) {
      console.error('Error updating course:', error);
      throw error;
    }
  },

  /**
   * Delete a course via API (soft delete)
   */
  async deleteCourse(courseId) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - delete locally
      const course = this.getCourse(courseId);
      if (!course) {
        throw new Error('Curso no encontrado');
      }
      // Check for students
      const students = this.getStudentsByCourse(courseId);
      if (students.length > 0) {
        throw new Error(`No se puede eliminar: tiene ${students.length} alumno(s) asignado(s)`);
      }
      this.data.courses = this.data.courses.filter(c => c.id !== courseId);
      // Remove schedules for this course
      this.data.schedules = this.data.schedules.filter(s => s.course_id !== courseId);
      this.persist();
      return true;
    }

    try {
      await API.deleteCourse(courseId);
      // Remove from local data
      this.data.courses = this.data.courses.filter(c => c.id !== courseId);
      this.persist();
      return true;
    } catch (error) {
      console.error('Error deleting course:', error);
      throw error;
    }
  },

  /**
   * Search courses
   */
  async searchCourses(query, options = {}) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - search locally
      const q = query.toLowerCase();
      return this.data.courses.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.grade.toLowerCase().includes(q)
      ).slice(0, options.limit || 20);
    }

    try {
      return await API.searchCourses(query, options);
    } catch (error) {
      console.error('Error searching courses:', error);
      throw error;
    }
  },

  /**
   * Export courses to CSV
   */
  async exportCoursesCSV(filters = {}) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - generate CSV locally
      let courses = this.data.courses;
      if (filters.grade) {
        courses = courses.filter(c => c.grade === filters.grade);
      }

      const headers = ['ID', 'Nombre', 'Grado', 'Estado', 'Creado'];
      const rows = courses.map(c => [c.id, c.name, c.grade, c.status || 'ACTIVE', c.created_at || '']);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      return new Blob([csv], { type: 'text/csv' });
    }

    try {
      return await API.exportCoursesCSV(filters);
    } catch (error) {
      console.error('Error exporting courses:', error);
      throw error;
    }
  },

  /**
   * Export teachers to CSV
   */
  async exportTeachersCSV(filters = {}) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - generate CSV locally
      let teachers = this.data.teachers;
      if (filters.status) {
        teachers = teachers.filter(t => t.status === filters.status);
      }

      const headers = ['ID', 'Nombre', 'Email', 'Estado', 'Creado'];
      const rows = teachers.map(t => [t.id, t.full_name, t.email || '', t.status || 'ACTIVE', t.created_at || '']);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      return new Blob([csv], { type: 'text/csv' });
    }

    try {
      return await API.exportTeachersCSV(filters);
    } catch (error) {
      console.error('Error exporting teachers:', error);
      throw error;
    }
  },

  /**
   * Export guardians to CSV
   */
  async exportGuardiansCSV(filters = {}) {
    if (!this.isApiAuthenticated()) {
      // Demo mode - generate CSV locally
      let guardians = this.data.guardians;
      if (filters.status) {
        guardians = guardians.filter(g => g.status === filters.status);
      }

      const headers = ['ID', 'Nombre', 'Estado', 'Creado'];
      const rows = guardians.map(g => [g.id, g.full_name, g.status || 'ACTIVE', g.created_at || '']);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      return new Blob([csv], { type: 'text/csv' });
    }

    try {
      return await API.exportGuardiansCSV(filters);
    } catch (error) {
      console.error('Error exporting guardians:', error);
      throw error;
    }
  },

  // ============================================
  // CRUD: Devices
  // ============================================
  addDevice(device) {
    const id = Math.max(0, ...this.data.devices.map(d => d.id)) + 1;
    device.id = id;
    device.status = device.status || 'QUEUE';
    device.battery_pct = device.battery_pct || 100;
    device.pending_count = device.pending_count || 0;
    device.last_sync = device.last_sync || new Date().toISOString();
    this.data.devices.push(device);
    this.persist();
    return device;
  },

  updateDevice(id, data) {
    const index = this.data.devices.findIndex(d => d.id === id);
    if (index !== -1) {
      this.data.devices[index] = { ...this.data.devices[index], ...data };
      this.persist();
      return this.data.devices[index];
    }
    return null;
  },

  deleteDevice(id) {
    this.data.devices = this.data.devices.filter(d => d.id !== id);
    this.persist();
  },

  // ============================================
  // Attendance with statistics
  // ============================================
  addAttendanceEvent(event) {
    const id = Math.max(0, ...this.data.attendance_events.map(e => e.id)) + 1;
    event.id = id;
    event.ts = event.ts || new Date().toISOString();
    event.source = event.source || 'MANUAL';
    this.data.attendance_events.push(event);
    this.persist();
    return event;
  },

  getStudentAttendanceStats(studentId, dateFrom = null, dateTo = null) {
    let events = this.data.attendance_events.filter(e => e.student_id === studentId);

    if (dateFrom) {
      events = events.filter(e => e.ts >= dateFrom);
    }
    if (dateTo) {
      events = events.filter(e => e.ts <= dateTo + 'T23:59:59');
    }

    // Group by date
    const dayEvents = {};
    events.forEach(e => {
      const date = e.ts.split('T')[0];
      if (!dayEvents[date]) dayEvents[date] = [];
      dayEvents[date].push(e);
    });

    // Count days with IN events
    const daysPresent = Object.keys(dayEvents).filter(date =>
      dayEvents[date].some(e => e.type === 'IN')
    ).length;

    // Count total school days (simplified: weekdays)
    const start = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), 0, 1);
    const end = dateTo ? new Date(dateTo) : new Date();
    let totalDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) totalDays++;
    }

    const percentage = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;

    return {
      totalEvents: events.length,
      daysPresent,
      totalSchoolDays: totalDays,
      percentage,
      inEvents: events.filter(e => e.type === 'IN').length,
      outEvents: events.filter(e => e.type === 'OUT').length,
      lateArrivals: events.filter(e => e.type === 'IN' && this._isEventLate(e)).length
    };
  },

  getCourseAttendanceStats(courseId, date = null) {
    const students = this.getStudentsByCourse(courseId);
    const targetDate = date || new Date().toISOString().split('T')[0];

    const events = this.data.attendance_events.filter(e =>
      e.ts.startsWith(targetDate) && students.some(s => s.id === e.student_id)
    );

    const studentsWithIn = new Set(events.filter(e => e.type === 'IN').map(e => e.student_id));

    return {
      totalStudents: students.length,
      present: studentsWithIn.size,
      absent: students.length - studentsWithIn.size,
      percentage: students.length > 0 ? Math.round((studentsWithIn.size / students.length) * 100) : 0
    };
  }
};
