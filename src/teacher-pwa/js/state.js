/**
 * State management with IndexedDB
 * Handles teacher session and offline data
 */
const State = {
  currentTeacherId: null,
  currentCourseId: null,
  teacher: null,
  courses: [],
  localSeq: 0,
  deviceId: '',
  demoMode: false,
  data: {},

  async init() {
    await IDB.open();

    // Restore session from localStorage
    const stored = localStorage.getItem('teacherSession');
    if (stored) {
      const { teacherId, courseId, deviceId, localSeq, teacher, courses } = JSON.parse(stored);
      this.currentTeacherId = teacherId;
      this.currentCourseId = courseId;
      this.teacher = teacher || null;
      this.courses = courses || [];
      this.deviceId = deviceId || this.generateDeviceId();
      this.localSeq = localSeq || 0;
    }

    // Generate device ID if not exists
    if (!this.deviceId) {
      this.deviceId = this.generateDeviceId();
    }

    // Security: If we have a JWT token, validate it with the backend
    if (typeof API !== 'undefined' && API.accessToken) {
      try {
        // Verify token by fetching teacher profile - this validates the JWT server-side
        const data = await API.getTeacherMe();
        // Token is valid - restore session from server data
        this.setTeacherProfile(data.teacher, data.courses);
      } catch (e) {
        // Token invalid or expired - clear session
        console.warn('JWT token invalid or expired, clearing session');
        this.logout();
      }
    }

    // Load fallback data if no students in IDB (offline mode)
    const students = await IDB.getAll('students');
    if (!students.length) {
      await this.loadFromJSON();
    }
  },

  generateDeviceId() {
    return 'PWA-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  },

  /**
   * Load fallback data from JSON files (for offline/demo mode)
   */
  async loadFromJSON() {
    const files = ['teachers', 'courses', 'rosters', 'students', 'attendance_local', 'queue', 'config'];
    for (const file of files) {
      try {
        const res = await fetch(`data/${file}.json`);
        const data = await res.json();
        await IDB.clear(file);
        if (Array.isArray(data)) {
          for (const item of data) await IDB.put(file, item);
        } else {
          await IDB.put(file, { id: 1, ...data });
        }
      } catch (e) {
        console.error(`Error loading ${file}`, e);
      }
    }
  },

  /**
   * Set teacher profile after login
   */
  setTeacherProfile(teacher, courses) {
    this.teacher = teacher;
    this.courses = courses;
    this.currentTeacherId = teacher.id;
    this.saveSession();

    // Cache courses in IDB for offline access
    this.cacheCourses(courses);
  },

  /**
   * Cache courses in IndexedDB
   */
  async cacheCourses(courses) {
    try {
      await IDB.clear('courses');
      for (const course of courses) {
        await IDB.put('courses', course);
      }
    } catch (e) {
      console.error('Error caching courses:', e);
    }
  },

  /**
   * Cache students for a course in IndexedDB
   */
  async cacheStudents(courseId, students) {
    try {
      // Store students with course reference
      for (const student of students) {
        await IDB.put('students', { ...student, course_id: courseId });
      }
    } catch (e) {
      console.error('Error caching students:', e);
    }
  },

  /**
   * Get cached students for a course
   */
  async getCachedStudents(courseId) {
    const allStudents = await IDB.getAll('students');
    return allStudents.filter(s => s.course_id === courseId);
  },

  /**
   * Set current course for taking attendance
   */
  setSession(teacherId, courseId) {
    this.currentTeacherId = teacherId;
    this.currentCourseId = courseId;
    this.saveSession();
  },

  /**
   * Persist session to localStorage
   */
  saveSession() {
    localStorage.setItem('teacherSession', JSON.stringify({
      teacherId: this.currentTeacherId,
      courseId: this.currentCourseId,
      deviceId: this.deviceId,
      localSeq: this.localSeq,
      teacher: this.teacher,
      courses: this.courses,
    }));
  },

  /**
   * Logout - clear session and tokens
   */
  logout() {
    this.currentTeacherId = null;
    this.currentCourseId = null;
    this.teacher = null;
    this.courses = [];
    localStorage.removeItem('teacherSession');
    API.logout();
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return API.isAuthenticated() && this.currentTeacherId !== null;
  },

  /**
   * Enqueue an attendance event for sync
   */
  async enqueueEvent(event) {
    this.localSeq++;
    event.local_seq = this.localSeq;
    event.device_id = this.deviceId;
    event.status = 'pending';
    event.retries = 0;
    event.id = Date.now() + Math.random();
    event.created_at = new Date().toISOString();

    await IDB.put('queue', event);
    this.saveSession();

    // Try to sync immediately if online
    if (this.isOnline() && API.isAuthenticated()) {
      Sync.processQueue();
    }

    return event;
  },

  /**
   * Check if device is online
   */
  isOnline() {
    // Check navigator.onLine first
    if (!navigator.onLine) return false;

    // Also check manual override
    const config = JSON.parse(localStorage.getItem('pwaConfig') || '{}');
    return config.online !== false;
  },

  /**
   * Toggle online mode (for testing)
   */
  toggleOnline() {
    const config = JSON.parse(localStorage.getItem('pwaConfig') || '{}');
    config.online = !config.online;
    localStorage.setItem('pwaConfig', JSON.stringify(config));
  },

  /**
   * Set demo mode
   */
  setDemoMode(enabled) {
    this.demoMode = enabled;
  },

  /**
   * Load fallback data from JSON files for demo mode
   */
  async loadFallbackData() {
    const files = ['teachers', 'courses', 'rosters', 'students'];
    for (const file of files) {
      try {
        const res = await fetch(`data/${file}.json`);
        this.data[file] = await res.json();
      } catch (e) {
        console.warn(`Could not load ${file}.json`, e);
        this.data[file] = [];
      }
    }
  },

  /**
   * Get students for a course (demo mode)
   */
  getStudentsByCourse(courseId) {
    // TDD-R7-BUG4 fix: Validate all data structures before accessing
    if (!this.data?.rosters || !this.data?.students) return [];
    const roster = this.data.rosters.find(r => r.course_id === courseId && r.teacher_id === this.currentTeacherId);
    // Validate roster.student_ids exists and is array before using includes()
    if (!roster?.student_ids || !Array.isArray(roster.student_ids)) return [];
    return this.data.students.filter(s => roster.student_ids.includes(s.id));
  },

  /**
   * Get course by ID
   */
  getCourse(courseId) {
    return this.courses.find(c => c.id === courseId) || null;
  },
};
