// State management with localStorage persistence
const State = {
  // Security: Valid roles for the application
  VALID_ROLES: ['director', 'inspector', 'parent'],

  data: {
    students: [],
    guardians: [],
    courses: [],
    schedules: [],
    schedule_exceptions: [],
    attendance_events: [],
    devices: [],
    absences: [],
    notifications: []
  },
  currentRole: null, // 'director', 'inspector', 'parent'
  currentGuardianId: null,
  // Security: session token for integrity validation
  _sessionToken: null,

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
      'absences', 'notifications'
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

  logout() {
    this.currentRole = null;
    this.currentGuardianId = null;
    this._sessionToken = null;
    this._user = null;
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
    // Store user info
    this._user = bootstrap.user;

    // Map API role to local role
    const roleMap = {
      'ADMIN': 'director',
      'DIRECTOR': 'director',
      'INSPECTOR': 'inspector',
      'PARENT': 'parent'
    };
    const role = roleMap[bootstrap.user.role] || 'director';

    // Set role and guardian ID
    this.currentRole = role;
    this.currentGuardianId = bootstrap.user.guardian_id || null;
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

  getSchedules(courseId) {
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
      notifications = notifications.filter(n => n.status === filters.status);
    }

    if (filters.channel) {
      notifications = notifications.filter(n => n.channel === filters.channel);
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
      delivered: notifications.filter(n => n.status === 'delivered').length,
      failed: notifications.filter(n => n.status === 'failed').length,
      pending: notifications.filter(n => n.status === 'pending').length,
      byChannel: {
        whatsapp: notifications.filter(n => n.channel === 'whatsapp').length,
        email: notifications.filter(n => n.channel === 'email').length
      }
    };
  },

  retryNotification(id) {
    const index = this.data.notifications.findIndex(n => n.id === id);
    if (index !== -1 && this.data.notifications[index].status === 'failed') {
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

  updateSchedule(id, data) {
    const index = this.data.schedules.findIndex(s => s.id === id);
    if (index !== -1) {
      this.data.schedules[index] = { ...this.data.schedules[index], ...data };
      this.persist();
    }
  },

  // Stats helpers
  getTodayStats() {
    const events = this.getTodayEvents();
    const inEvents = events.filter(e => e.type === 'IN');
    const outEvents = events.filter(e => e.type === 'OUT');

    // Count late arrivals (after 08:30)
    const lateEvents = inEvents.filter(e => {
      const time = e.ts.split('T')[1];
      return time > '08:30:00';
    });

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
  }
};
