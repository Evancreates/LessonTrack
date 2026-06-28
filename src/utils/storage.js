import { v4 as uuidv4 } from 'uuid'
import { DEMO_DATASET_VERSION } from './demoDataset.js'
import { ADMIN_USERNAME, getDashboardData } from './dashboardData.js'
import { ensureUserData, getInitialUserData, saveUserData } from './userDataStore.js'

const KEYS = {
  students: 'lessontrack_students',
  courses: 'lessontrack_courses',
  enrollments: 'lessontrack_enrollments',
  sessions: 'lessontrack_sessions',
  attendance: 'lessontrack_attendance',
  counters: 'lessontrack_counters',
  teachers: 'lessontrack_teachers',
  currentRole: 'lessontrack_current_role',
  authSession: 'lessontrack_auth_session',
  adminAccount: 'lessontrack_admin_account',
  attendanceDrafts: 'lessontrack_attendance_drafts',
  settings: 'lessontrack_settings',
  dashboardDataSource: 'lessontrack_dashboard_data_source',
}

function read(key) {
  try {
    const value = localStorage.getItem(key)
    const data = value ? JSON.parse(value) : []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function write(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function readObject(key) {
  try {
    const value = localStorage.getItem(key)
    const data = value ? JSON.parse(value) : {}
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

function writeObject(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

const defaultSettings = {
  defaultCourseStartTime: '09:00',
  defaultCourseEndTime: '12:00',
}

const defaultAdminAccount = {
  username: ADMIN_USERNAME,
  password: '123456',
}

const defaultUserRole = 'user'

function isAdminSession(session) {
  return session?.role === 'admin'
}

function createUserContext({ id, userId, username, role } = {}) {
  const normalizedRole = ['admin', 'teacher', defaultUserRole].includes(role) ? role : defaultUserRole
  const normalizedUsername = String(username || userId || id || '').trim()
  const normalizedId = String(id || userId || normalizedUsername || 'anonymous').trim()

  return {
    id: normalizedId,
    username: normalizedUsername || normalizedId,
    role: normalizedRole,
  }
}

function createAdminUserContext(username = ADMIN_USERNAME) {
  return createUserContext({
    id: ADMIN_USERNAME,
    username,
    role: 'admin',
  })
}

function writeDatasetToStorage(dataset) {
  write(KEYS.courses, dataset.courses)
  write(KEYS.students, dataset.students)
  write(KEYS.enrollments, dataset.enrollments)
  write(KEYS.sessions, dataset.sessions)
  write(KEYS.attendance, dataset.attendance)
  write(KEYS.teachers, dataset.teachers)
  write(KEYS.attendanceDrafts, [])
  writeObject(KEYS.counters, dataset.counters)
}

function getCurrentDatasetFromStorage() {
  return {
    courses: read(KEYS.courses),
    students: read(KEYS.students),
    enrollments: read(KEYS.enrollments),
    sessions: read(KEYS.sessions),
    attendance: read(KEYS.attendance),
    teachers: read(KEYS.teachers),
    counters: readObject(KEYS.counters),
  }
}

function getSessionUserContext(user) {
  if (isAdminSession(user)) return createAdminUserContext(user.username || ADMIN_USERNAME)
  return createUserContext({
    id: user?.userId || user?.id,
    username: user?.username,
    role: user?.role,
  })
}

function writeDashboardDataset(user, dataset) {
  const userContext = getSessionUserContext(user)
  const nextDataset = dataset || (isAdminSession(user) ? getInitialUserData(userContext) : ensureUserData(userContext))

  writeDatasetToStorage(nextDataset)
  saveUserData(userContext.id, nextDataset)
  writeObject(KEYS.dashboardDataSource, {
    role: userContext.role,
    userId: userContext.id,
    demoDatasetVersion: nextDataset.counters?.demoDatasetVersion || null,
  })
}

function applyDashboardDataForUser(user) {
  if (isAdminSession(user)) {
    writeDashboardDataset(user)
    return
  }

  writeObject(KEYS.dashboardDataSource, {
    role: user?.role || '',
    userId: user?.userId || '',
    demoDatasetVersion: null,
  })
}

function restoreDashboardDataForSession(session) {
  if (!isAdminSession(session)) return

  const userContext = getSessionUserContext(session)
  const baselineData = getInitialUserData(userContext)
  writeDashboardDataset(session, baselineData)
}

function ensureDashboardDataForSession(session) {
  if (!isAdminSession(session)) return

  const source = readObject(KEYS.dashboardDataSource)
  if (
    source.role === session.role
    && source.userId === session.userId
    && source.demoDatasetVersion === DEMO_DATASET_VERSION
  ) {
    return
  }

  writeDashboardDataset(session)
}

function shouldUseStoredDashboardData() {
  const session = readObject(KEYS.authSession)
  if (!isAdminSession(session)) return false

  ensureDashboardDataForSession(session)
  return true
}

function persistActiveUserData() {
  const session = readObject(KEYS.authSession)
  if (!session.role || !session.userId) return
  if (isAdminSession(session)) return

  const userContext = getSessionUserContext(session)
  saveUserData(userContext.id, getCurrentDatasetFromStorage())
}

function toCreditNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function normalizeCourseSchedule(schedule) {
  if (!Array.isArray(schedule)) return []
  const seen = new Set()
  return schedule
    .map((item) => ({
      date: String(item?.date || '').trim(),
      startTime: String(item?.startTime || '').trim(),
      endTime: String(item?.endTime || '').trim(),
    }))
    .filter((item) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || seen.has(item.date)) return false
      seen.add(item.date)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

function normalizeCourseForSave(course) {
  const schedule = normalizeCourseSchedule(course.schedule)
  return {
    ...course,
    schedule,
    totalCredits: schedule.length ? schedule.length : toCreditNumber(course.totalCredits),
    status: normalizeCourseStatusBySchedule(course.status, schedule),
  }
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function normalizeCourseStatus(status) {
  return ['pending', 'active', 'paused', 'inactive'].includes(status) ? status : 'active'
}

function normalizeCourseStatusBySchedule(status, schedule) {
  const normalizedStatus = normalizeCourseStatus(status)
  const startDate = schedule[0]?.date || ''
  const endDate = schedule[schedule.length - 1]?.date || ''
  if (endDate && endDate < today()) return 'inactive'
  if (normalizedStatus !== 'inactive' && startDate && startDate > today()) return 'pending'
  if (normalizedStatus === 'pending') return 'active'
  return normalizedStatus
}

function getCurrentYearShort(date = new Date()) {
  return String(date.getFullYear()).slice(-2)
}

function getCurrentMonthCode(date = new Date()) {
  return String(date.getMonth() + 1).padStart(2, '0')
}

function getCurrentStudentMonthKey(date = new Date()) {
  return `${getCurrentYearShort(date)}${getCurrentMonthCode(date)}`
}

function formatCourseCode(year, sequence) {
  return `C${year}${String(sequence).padStart(3, '0')}`
}

function formatStudentNo(monthKey, sequence) {
  return `${monthKey}${String(sequence).padStart(sequence > 999 ? 4 : 3, '0')}`
}

function formatTeacherNo(year, sequence) {
  return `T${year}${String(sequence).padStart(sequence > 99 ? 3 : 2, '0')}`
}

function hasModernYearPrefix(year) {
  const number = Number(year)
  return Number.isInteger(number) && number >= 24 && number <= 99
}

function isValidMonth(month) {
  const number = Number(month)
  return Number.isInteger(number) && number >= 1 && number <= 12
}

function getTeacherNumberMigration(teachers, counters) {
  const year = getCurrentYearShort()
  const preparedTeachers = teachers.map((teacher) => ({
    ...teacher,
    name: String(teacher.name || '').trim(),
    courseIds: Array.isArray(teacher.courseIds) ? [...new Set(teacher.courseIds)] : [],
  }))
  const usedTeacherNos = new Set()
  const retainedIndexes = new Set()
  let maxTeacherSequence = counters.teacherNoYear === year ? Number(counters.teacherNoSequence) || 0 : 0
  let changed = false

  preparedTeachers.forEach((teacher, index) => {
    const matched = typeof teacher.teacherNo === 'string' && teacher.teacherNo.match(/^T(\d{2})(\d{2,})$/)
    if (!matched || !hasModernYearPrefix(matched[1]) || usedTeacherNos.has(teacher.teacherNo)) return
    usedTeacherNos.add(teacher.teacherNo)
    retainedIndexes.add(index)
    if (matched[1] === year) maxTeacherSequence = Math.max(maxTeacherSequence, Number(matched[2]))
  })

  const nextTeachers = preparedTeachers.map((teacher, index) => {
    if (retainedIndexes.has(index)) return teacher
    let teacherNo
    do {
      maxTeacherSequence += 1
      teacherNo = formatTeacherNo(year, maxTeacherSequence)
    } while (usedTeacherNos.has(teacherNo))
    usedTeacherNos.add(teacherNo)
    changed = true
    return { ...teacher, teacherNo }
  })

  if (preparedTeachers.some((teacher, index) => (
    teacher.name !== teachers[index]?.name
    || JSON.stringify(teacher.courseIds) !== JSON.stringify(teachers[index]?.courseIds || [])
  ))) {
    changed = true
  }

  return {
    teachers: nextTeachers,
    counters: { ...counters, teacherNoYear: year, teacherNoSequence: maxTeacherSequence },
    changed,
  }
}

function migrateSaasFields() {
  const courses = read(KEYS.courses)
  const students = read(KEYS.students)
  const teachers = read(KEYS.teachers)
  const counters = readObject(KEYS.counters)
  const usedCourseCodes = new Set()
  const year = getCurrentYearShort()
  let maxCourseSequence = counters.courseCodeYear === year ? Number(counters.courseCodeSequence) || 0 : 0
  let coursesChanged = false

  const nextCourses = courses.map((course) => {
    const matchedCode = typeof course.code === 'string' && course.code.match(/^C(\d{2})(\d{3,})$/)
    const codeYear = matchedCode?.[1]
    const currentSequence = matchedCode ? Number(matchedCode[2]) : 0
    const canKeepCode = matchedCode && hasModernYearPrefix(codeYear) && currentSequence > 0 && !usedCourseCodes.has(course.code)
    let code = course.code

    if (canKeepCode) {
      usedCourseCodes.add(code)
      if (codeYear === year) maxCourseSequence = Math.max(maxCourseSequence, currentSequence)
    } else {
      do {
        maxCourseSequence += 1
        code = formatCourseCode(year, maxCourseSequence)
      } while (usedCourseCodes.has(code))
      usedCourseCodes.add(code)
      coursesChanged = true
    }

    const teacherName = typeof course.teacherName === 'string' ? course.teacherName : ''
    const schedule = normalizeCourseSchedule(course.schedule)
    const status = normalizeCourseStatusBySchedule(course.status, schedule)
    if (course.code !== code || course.teacherName !== teacherName || course.status !== status) coursesChanged = true
    return { ...course, code, teacherName, status }
  })

  const usedStudentNos = new Set()
  const monthKey = getCurrentStudentMonthKey()
  let maxStudentSequence = counters.studentNoMonthKey === monthKey ? Number(counters.studentNoSequence) || 0 : 0
  let studentsChanged = false
  const nextStudents = students.map((student) => {
    const matchedNo = typeof student.studentNo === 'string' && student.studentNo.match(/^(\d{2})(\d{2})(\d{3,4})$/)
    const currentMonthKey = matchedNo ? `${matchedNo[1]}${matchedNo[2]}` : ''
    const currentSequence = matchedNo ? Number(matchedNo[3]) : 0
    const canKeepNo = matchedNo
      && hasModernYearPrefix(matchedNo[1])
      && isValidMonth(matchedNo[2])
      && currentSequence > 0
      && !usedStudentNos.has(student.studentNo)
    let studentNo = student.studentNo

    if (canKeepNo) {
      usedStudentNos.add(studentNo)
      if (currentMonthKey === monthKey) maxStudentSequence = Math.max(maxStudentSequence, currentSequence)
    } else {
      do {
        maxStudentSequence += 1
        studentNo = formatStudentNo(monthKey, maxStudentSequence)
      } while (usedStudentNos.has(studentNo))
      usedStudentNos.add(studentNo)
      studentsChanged = true
    }

    return student.studentNo === studentNo ? student : { ...student, studentNo }
  })

  if (coursesChanged) write(KEYS.courses, nextCourses)
  if (studentsChanged) write(KEYS.students, nextStudents)
  const teacherMigration = getTeacherNumberMigration(teachers, counters)
  if (teacherMigration.changed) write(KEYS.teachers, teacherMigration.teachers)
  writeObject(KEYS.counters, {
    ...counters,
    ...teacherMigration.counters,
    courseCodeYear: year,
    courseCodeSequence: maxCourseSequence,
    studentNoMonthKey: monthKey,
    studentNoSequence: maxStudentSequence,
  })
}

function syncTeachersWithCourses() {
  const courses = read(KEYS.courses)
  const teachers = read(KEYS.teachers)
  const teacherByName = new Map()
  const nextTeachers = teachers.map((teacher) => {
    const name = String(teacher.name || '').trim()
    const normalizedTeacher = { ...teacher, name, courseIds: [] }
    if (name && !teacherByName.has(name.toLowerCase())) {
      teacherByName.set(name.toLowerCase(), normalizedTeacher)
    }
    return normalizedTeacher
  })

  courses.forEach((course) => {
    const teacherName = String(course.teacherName || '').trim()
    if (!teacherName) return
    const key = teacherName.toLowerCase()
    let teacher = teacherByName.get(key)

    if (!teacher) {
      teacher = { id: uuidv4(), name: teacherName, courseIds: [] }
      teacherByName.set(key, teacher)
      nextTeachers.push(teacher)
    }
    teacher.courseIds.push(course.id)
  })

  const normalizedTeachersWithoutNos = nextTeachers
    .filter((teacher) => teacher.name)
    .map((teacher) => ({ ...teacher, courseIds: [...new Set(teacher.courseIds)] }))
  const counters = readObject(KEYS.counters)
  const teacherMigration = getTeacherNumberMigration(normalizedTeachersWithoutNos, counters)
  const normalizedTeachers = teacherMigration.teachers

  if (JSON.stringify(teachers) !== JSON.stringify(normalizedTeachers)) {
    write(KEYS.teachers, normalizedTeachers)
  }
  if (teacherMigration.changed) writeObject(KEYS.counters, teacherMigration.counters)
}

function migrateCourseSchedules() {
  const courses = read(KEYS.courses)
  if (courses.length === 0) return

  const sessions = read(KEYS.sessions)
  const sessionsByCourseId = new Map()
  sessions.forEach((session) => {
    if (!session.courseId || !session.date) return
    const dates = sessionsByCourseId.get(session.courseId) || []
    dates.push(session.date)
    sessionsByCourseId.set(session.courseId, dates)
  })

  let changed = false
  const nextCourses = courses.map((course) => {
    const normalizedSchedule = normalizeCourseSchedule(course.schedule)
    const fallbackDates = [...new Set(sessionsByCourseId.get(course.id) || [])].sort()
    const schedule = normalizedSchedule.length
      ? normalizedSchedule
      : fallbackDates.map((date) => ({ date, startTime: '', endTime: '' }))
    const totalCredits = normalizedSchedule.length
      ? normalizedSchedule.length
      : Math.max(toCreditNumber(course.totalCredits), schedule.length)
    const nextCourse = {
      ...course,
      schedule,
      totalCredits,
      status: normalizeCourseStatusBySchedule(course.status, schedule),
    }
    if (JSON.stringify(nextCourse) !== JSON.stringify(course)) changed = true
    return nextCourse
  })

  if (changed) write(KEYS.courses, nextCourses)
}

function migrateCourseTimelineDistribution() {
  const counters = readObject(KEYS.counters)
  if (counters.demoDatasetVersion === DEMO_DATASET_VERSION) return

  const courses = read(KEYS.courses)
  const students = read(KEYS.students)
  const looksLikeDemoData = students.length >= 100 && courses.length >= 10
  if (!looksLikeDemoData) return

  const dataset = getDashboardData({ userId: ADMIN_USERNAME, role: 'admin' })
  write(KEYS.courses, dataset.courses)
  write(KEYS.enrollments, dataset.enrollments)
  write(KEYS.sessions, dataset.sessions)
  write(KEYS.attendance, dataset.attendance)
  write(KEYS.students, dataset.students)
  write(KEYS.teachers, dataset.teachers)
  write(KEYS.attendanceDrafts, [])
  writeObject(KEYS.counters, { ...counters, ...dataset.counters })
}

function migrateLegacyRelations() {
  const students = read(KEYS.students)
  const courses = read(KEYS.courses)
  const enrollments = read(KEYS.enrollments)
  const legacyStudents = students.filter((student) => student.courseId)
  const needsCourseMigration = courses.some(
    (course) => !course.code || typeof course.totalCredits !== 'number' || !course.status,
  )
  const enrollmentKeys = new Set(enrollments.map((enrollment) => `${enrollment.studentId}-${enrollment.courseId}`))
  const needsEnrollmentMigration = legacyStudents.some(
    (student) => !enrollmentKeys.has(`${student.id}-${student.courseId}`),
  )

  if (!needsCourseMigration && !needsEnrollmentMigration && legacyStudents.length === 0) return

  const legacyCreditsByCourseId = new Map()
  legacyStudents.forEach((student) => {
    const current = legacyCreditsByCourseId.get(student.courseId) || 0
    legacyCreditsByCourseId.set(student.courseId, Math.max(current, toCreditNumber(student.totalCredits)))
  })

  const nextCourses = courses.map((course, index) => {
    const schedule = normalizeCourseSchedule(course.schedule)
    return {
      ...course,
      code: typeof course.code === 'string' && course.code.trim()
        ? course.code.trim()
        : formatCourseCode(getCurrentYearShort(), index + 1),
      totalCredits: typeof course.totalCredits === 'number'
        ? toCreditNumber(course.totalCredits)
        : legacyCreditsByCourseId.get(course.id) || 0,
      status: normalizeCourseStatusBySchedule(course.status, schedule),
      schedule,
    }
  })
  const nextEnrollments = [...enrollments]

  legacyStudents.forEach((student) => {
    const key = `${student.id}-${student.courseId}`
    if (!enrollmentKeys.has(key)) {
      nextEnrollments.push({
        id: uuidv4(),
        studentId: student.id,
        courseId: student.courseId,
        joinedAt: today(),
      })
    }
  })

  const nextStudents = students.map((student) => {
    const nextStudent = { ...student }
    delete nextStudent.courseId
    return nextStudent
  })
  write(KEYS.courses, nextCourses)
  write(KEYS.enrollments, nextEnrollments)
  write(KEYS.students, nextStudents)
}

function migrateStudentCredits() {
  const students = read(KEYS.students)
  const counters = readObject(KEYS.counters)
  const needsMigration = students.some(
    (student) => typeof student.totalCredits !== 'number' || typeof student.usedCredits !== 'number',
  ) || counters.creditCalculationVersion !== 2

  if (!needsMigration) return

  migrateLegacyAttendance()
  const attendance = read(KEYS.attendance)
  const attendedCountByStudentId = new Map()
  const sessionIds = new Set(read(KEYS.sessions).map((session) => session.id))
  attendance.forEach((record) => {
    if (!sessionIds.has(record.sessionId) || !['present', 'late'].includes(record.status)) return
    attendedCountByStudentId.set(
      record.studentId,
      (attendedCountByStudentId.get(record.studentId) || 0) + 1,
    )
  })

  write(KEYS.students, students.map((student) => ({
    ...student,
    totalCredits: toCreditNumber(student.totalCredits),
    usedCredits: attendedCountByStudentId.get(student.id) || 0,
  })))
  writeObject(KEYS.counters, { ...counters, creditCalculationVersion: 2 })
}

function migrateLegacyAttendance() {
  const attendance = read(KEYS.attendance)
  const hasLegacyRecords = attendance.some(
    (record) => !record.sessionId && record.courseId && record.date,
  )

  if (!hasLegacyRecords) return

  const sessions = read(KEYS.sessions)
  const sessionByCourseAndDate = new Map(
    sessions.map((session) => [`${session.courseId}-${session.date}`, session]),
  )
  const nextSessions = [...sessions]

  const nextAttendance = attendance.map((record) => {
    if (record.sessionId || !record.courseId || !record.date) return record

    const key = `${record.courseId}-${record.date}`
    let session = sessionByCourseAndDate.get(key)

    if (!session) {
      session = { id: uuidv4(), courseId: record.courseId, date: record.date }
      sessionByCourseAndDate.set(key, session)
      nextSessions.push(session)
    }

    return {
      id: record.id || uuidv4(),
      sessionId: session.id,
      studentId: record.studentId,
      status: record.status,
    }
  })

  write(KEYS.sessions, nextSessions)
  write(KEYS.attendance, nextAttendance)
}

export const getStudents = () => {
  if (!shouldUseStoredDashboardData()) return []
  migrateLegacyRelations()
  migrateSaasFields()
  migrateCourseSchedules()
  migrateCourseTimelineDistribution()
  migrateStudentCredits()
  return read(KEYS.students)
}
export const saveStudents = (students) => {
  write(KEYS.students, students)
  persistActiveUserData()
}

export const getCourses = () => {
  if (!shouldUseStoredDashboardData()) return []
  migrateLegacyRelations()
  migrateSaasFields()
  migrateCourseSchedules()
  migrateCourseTimelineDistribution()
  syncTeachersWithCourses()
  return read(KEYS.courses)
}
export const saveCourses = (courses) => {
  write(KEYS.courses, courses.map(normalizeCourseForSave))
  syncTeachersWithCourses()
  persistActiveUserData()
}

export const getEnrollments = () => {
  if (!shouldUseStoredDashboardData()) return []
  migrateLegacyRelations()
  migrateSaasFields()
  return read(KEYS.enrollments)
}
export const saveEnrollments = (enrollments) => {
  write(KEYS.enrollments, enrollments)
  persistActiveUserData()
}

export const getSessions = () => {
  if (!shouldUseStoredDashboardData()) return []
  migrateLegacyAttendance()
  migrateCourseTimelineDistribution()
  return read(KEYS.sessions)
}
export const saveSessions = (sessions) => {
  write(KEYS.sessions, sessions)
  persistActiveUserData()
}

export const getAttendance = () => {
  if (!shouldUseStoredDashboardData()) return []
  migrateLegacyAttendance()
  migrateCourseTimelineDistribution()
  return read(KEYS.attendance)
}
export const saveAttendance = (attendance) => {
  write(KEYS.attendance, attendance)
  persistActiveUserData()
}

export const getAttendanceDrafts = () => read(KEYS.attendanceDrafts)
export const saveAttendanceDrafts = (drafts) => write(KEYS.attendanceDrafts, drafts)

export const recalculateStudentCredits = () => {
  const attendedStudentIds = new Map()
  const sessionIds = new Set(read(KEYS.sessions).map((session) => session.id))
  read(KEYS.attendance).forEach((record) => {
    if (!sessionIds.has(record.sessionId) || !['present', 'late'].includes(record.status)) return
    attendedStudentIds.set(record.studentId, (attendedStudentIds.get(record.studentId) || 0) + 1)
  })
  const students = read(KEYS.students)
  write(KEYS.students, students.map((student) => ({ ...student, usedCredits: attendedStudentIds.get(student.id) || 0 })))
  persistActiveUserData()
}

function getStoredTeachers() {
  migrateLegacyRelations()
  migrateSaasFields()
  migrateCourseSchedules()
  migrateCourseTimelineDistribution()
  syncTeachersWithCourses()
  return read(KEYS.teachers)
}

export const getTeachers = () => {
  if (!shouldUseStoredDashboardData()) return []
  return getStoredTeachers()
}
export const saveTeachers = (teachers) => {
  const counters = readObject(KEYS.counters)
  const teacherMigration = getTeacherNumberMigration(teachers, counters)
  write(KEYS.teachers, teacherMigration.teachers)
  writeObject(KEYS.counters, teacherMigration.counters)
  persistActiveUserData()
}

export const getAdminAccount = () => {
  const account = readObject(KEYS.adminAccount)
  const username = defaultAdminAccount.username
  const password = defaultAdminAccount.password
  const normalized = { username, password }
  if (account.username !== normalized.username || account.password !== normalized.password) {
    writeObject(KEYS.adminAccount, normalized)
  }
  return normalized
}

export const updateAdminAccount = ({ username, currentPassword, nextPassword }) => {
  const account = getAdminAccount()
  const nextUsername = String(username || '').trim()
  const nextPasswordText = String(nextPassword || '')
  if (!nextUsername) return { ok: false, message: '请填写管理员账号。' }
  if (account.password !== String(currentPassword || '')) return { ok: false, message: '当前密码不正确。' }
  if (nextPasswordText.length < 6) return { ok: false, message: '新密码至少需要 6 位。' }
  writeObject(KEYS.adminAccount, { username: nextUsername, password: nextPasswordText })
  return { ok: true }
}

export const getAuthSession = () => {
  const session = readObject(KEYS.authSession)
  if (session.role === 'admin' && session.userId === ADMIN_USERNAME) {
    return { userId: ADMIN_USERNAME, username: session.username || ADMIN_USERNAME, role: 'admin' }
  }
  if (session.role === 'teacher' && session.userId && getStoredTeachers().some((teacher) => teacher.id === session.userId)) {
    const teacher = getStoredTeachers().find((item) => item.id === session.userId)
    return { userId: session.userId, username: teacher?.username || session.username || session.userId, role: 'teacher' }
  }
  return null
}

export const authenticateUser = ({ username, password }) => {
  const accountName = String(username || '').trim()
  const passwordText = String(password || '')
  const adminAccount = getAdminAccount()
  if (accountName === adminAccount.username && passwordText === adminAccount.password) {
    const session = { userId: ADMIN_USERNAME, username: adminAccount.username, role: 'admin' }
    writeObject(KEYS.authSession, session)
    writeObject(KEYS.currentRole, session)
    applyDashboardDataForUser(session)
    return { ok: true, session, redirectPath: '/' }
  }

  const teacher = getStoredTeachers().find((item) => (
    String(item.username || '').trim() === accountName
    && String(item.password || '') === passwordText
  ))
  if (teacher) {
    const session = { userId: teacher.id, username: teacher.username, role: 'teacher' }
    writeObject(KEYS.authSession, session)
    writeObject(KEYS.currentRole, session)
    applyDashboardDataForUser(session)
    return { ok: true, session, redirectPath: '/my-courses' }
  }

  return { ok: false, message: '账号或密码不正确。' }
}

export const clearAuthSession = () => {
  const session = readObject(KEYS.authSession)
  if (isAdminSession(session)) {
    writeObject(KEYS.adminAccount, defaultAdminAccount)
  }
  restoreDashboardDataForSession(session)
  localStorage.removeItem(KEYS.authSession)
}

export const getCurrentRole = () => {
  const currentRole = readObject(KEYS.currentRole)
  if (currentRole.role === 'teacher' && currentRole.userId && getStoredTeachers().some((teacher) => teacher.id === currentRole.userId)) {
    return { userId: currentRole.userId, role: 'teacher' }
  }
  if (currentRole.role === 'admin' && currentRole.userId) {
    return { userId: currentRole.userId, role: 'admin' }
  }

  const adminRole = { userId: ADMIN_USERNAME, role: 'admin' }
  writeObject(KEYS.currentRole, adminRole)
  return adminRole
}

export const saveCurrentRole = (role) => writeObject(KEYS.currentRole, role)

export const getCurrentUserContext = () => {
  const session = getAuthSession() || getCurrentRole()
  return getSessionUserContext(session)
}

export const getSettings = () => {
  const settings = readObject(KEYS.settings)
  return {
    ...defaultSettings,
    ...settings,
  }
}

export const saveSettings = (settings) => writeObject(KEYS.settings, {
  ...getSettings(),
  ...settings,
})

export const saveCounters = (counters) => {
  writeObject(KEYS.counters, {
    ...readObject(KEYS.counters),
    ...counters,
  })
  persistActiveUserData()
}

export const generateCourseCode = () => {
  migrateSaasFields()
  const counters = readObject(KEYS.counters)
  const courses = read(KEYS.courses)
  const year = getCurrentYearShort()
  const maxExistingSequence = courses.reduce((max, course) => {
    const matched = typeof course.code === 'string' && course.code.match(/^C(\d{2})(\d{3,})$/)
    return matched && matched[1] === year ? Math.max(max, Number(matched[2])) : max
  }, 0)
  const counterSequence = counters.courseCodeYear === year ? Number(counters.courseCodeSequence) || 0 : 0
  const sequence = Math.max(counterSequence, maxExistingSequence) + 1
  writeObject(KEYS.counters, { ...counters, courseCodeYear: year, courseCodeSequence: sequence })
  persistActiveUserData()
  return formatCourseCode(year, sequence)
}

export const generateStudentNo = () => {
  migrateSaasFields()
  const counters = readObject(KEYS.counters)
  const students = read(KEYS.students)
  const monthKey = getCurrentStudentMonthKey()
  const maxExistingSequence = students.reduce((max, student) => {
    const matched = typeof student.studentNo === 'string' && student.studentNo.match(/^(\d{4})(\d{3,4})$/)
    return matched && matched[1] === monthKey ? Math.max(max, Number(matched[2])) : max
  }, 0)
  const counterSequence = counters.studentNoMonthKey === monthKey ? Number(counters.studentNoSequence) || 0 : 0
  const sequence = Math.max(counterSequence, maxExistingSequence) + 1
  writeObject(KEYS.counters, { ...counters, studentNoMonthKey: monthKey, studentNoSequence: sequence })
  persistActiveUserData()
  return formatStudentNo(monthKey, sequence)
}

export const generateTeacherNo = () => {
  migrateSaasFields()
  const counters = readObject(KEYS.counters)
  const teachers = read(KEYS.teachers)
  const year = getCurrentYearShort()
  const maxExistingSequence = teachers.reduce((max, teacher) => {
    const matched = typeof teacher.teacherNo === 'string' && teacher.teacherNo.match(/^T(\d{2})(\d{2,})$/)
    return matched && matched[1] === year ? Math.max(max, Number(matched[2])) : max
  }, 0)
  const counterSequence = counters.teacherNoYear === year ? Number(counters.teacherNoSequence) || 0 : 0
  const sequence = Math.max(counterSequence, maxExistingSequence) + 1
  writeObject(KEYS.counters, { ...counters, teacherNoYear: year, teacherNoSequence: sequence })
  persistActiveUserData()
  return formatTeacherNo(year, sequence)
}
