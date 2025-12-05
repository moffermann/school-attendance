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
    notifications: [],
    teachers: []
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

    // Security: If we have a JWT token, validate it with the backend
    if (typeof API !== 'undefined' && API.accessToken) {
      try {
        // Verify token by fetching bootstrap - this validates the JWT server-side
        const bootstrap = await API.getBootstrap();
        // Token is valid - restore session from server data
        this.setFromBootstrap(bootstrap);
        return; // Session restored from server
      } catch (e) {
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
    // Store user info (API returns current_user)
    this._user = bootstrap.current_user || bootstrap.user;

    // Map API role to local role
    const roleMap = {
      'ADMIN': 'director',
      'DIRECTOR': 'director',
      'INSPECTOR': 'inspector',
      'PARENT': 'parent'
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
  // CRUD: Teachers
  // ============================================
  getTeachers() {
    return this.data.teachers || [];
  },

  getTeacher(id) {
    return (this.data.teachers || []).find(t => t.id === id);
  },

  addTeacher(teacher) {
    if (!this.data.teachers) this.data.teachers = [];
    const id = Math.max(0, ...this.data.teachers.map(t => t.id)) + 1;
    teacher.id = id;
    this.data.teachers.push(teacher);
    this.persist();
    return teacher;
  },

  updateTeacher(id, data) {
    if (!this.data.teachers) return null;
    const index = this.data.teachers.findIndex(t => t.id === id);
    if (index !== -1) {
      this.data.teachers[index] = { ...this.data.teachers[index], ...data };
      this.persist();
      return this.data.teachers[index];
    }
    return null;
  },

  deleteTeacher(id) {
    if (!this.data.teachers) return;
    this.data.teachers = this.data.teachers.filter(t => t.id !== id);
    // Remove teacher from courses
    this.data.courses.forEach(c => {
      if (c.teacher_ids) {
        c.teacher_ids = c.teacher_ids.filter(tid => tid !== id);
      }
      if (c.teacher_id === id) {
        c.teacher_id = null;
      }
    });
    this.persist();
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
      lateArrivals: events.filter(e => e.type === 'IN' && e.ts.split('T')[1] > '08:30:00').length
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
