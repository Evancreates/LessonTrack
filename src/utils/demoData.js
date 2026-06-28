import { ADMIN_USERNAME, getDashboardData } from './dashboardData.js'
import {
  saveAttendance,
  saveAttendanceDrafts,
  saveCounters,
  saveCourses,
  saveCurrentRole,
  saveEnrollments,
  saveSessions,
  saveStudents,
  saveTeachers,
} from './storage.js'

export function loadDemoData() {
  const dataset = getDashboardData({ userId: ADMIN_USERNAME, role: 'admin' })

  saveTeachers([])
  saveCourses(dataset.courses)
  saveTeachers(dataset.teachers)
  saveStudents(dataset.students)
  saveEnrollments(dataset.enrollments)
  saveSessions(dataset.sessions)
  saveAttendance(dataset.attendance)
  saveAttendanceDrafts([])
  saveCounters(dataset.counters)
  saveCurrentRole({ userId: ADMIN_USERNAME, role: 'admin' })

  return {
    students: dataset.students.length,
    courses: dataset.courses.length,
    enrollments: dataset.enrollments.length,
    sessions: dataset.sessions.length,
    attendance: dataset.attendance.length,
  }
}
