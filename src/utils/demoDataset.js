import { v4 as uuidv4 } from 'uuid'

export const DEMO_DATASET_VERSION = 4
export const DEMO_STUDENT_COUNT = 500
export const DEMO_COURSE_COUNT = 10
export const DEMO_YEAR = 2026

const surnames = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗']
const givenNames = ['子涵', '宇轩', '梓萱', '浩然', '欣怡', '雨桐', '子墨', '思远', '嘉怡', '乐然', '晨曦', '星宇']
const unassignedTeacherNames = ['赵老师', '吴老师', '孙老师']

const courseTemplates = [
  { name: '数学思维', teacherName: '王老师', start: '2026-01-10', end: '2026-04-18', count: 8, startTime: '09:00', endTime: '10:30' },
  { name: '英语阅读', teacherName: '李老师', start: '2026-02-07', end: '2026-05-30', count: 9, startTime: '10:40', endTime: '12:10' },
  { name: '少儿编程', teacherName: '张老师', start: '2026-01-18', end: '2026-07-26', count: 14, startTime: '14:00', endTime: '15:30' },
  { name: '物理启蒙', teacherName: '陈老师', start: '2026-03-08', end: '2026-08-23', count: 13, startTime: '15:40', endTime: '17:10' },
  { name: '科学实验', teacherName: '刘老师', start: '2026-04-18', end: '2026-10-03', count: 13, startTime: '09:00', endTime: '10:30', pinnedDates: ['2026-06-27'] },
  { name: '语文写作', teacherName: '王老师', start: '2026-05-10', end: '2026-10-25', count: 13, startTime: '10:40', endTime: '12:10' },
  { name: '美术创作', teacherName: '李老师', start: '2026-06-14', end: '2026-11-29', count: 13, startTime: '14:00', endTime: '15:30' },
  { name: '围棋进阶', teacherName: '张老师', start: '2026-07-04', end: '2026-12-12', count: 12, startTime: '15:40', endTime: '17:10' },
  { name: '机器人搭建', teacherName: '陈老师', start: '2026-08-01', end: '2026-12-19', count: 11, startTime: '09:00', endTime: '10:30' },
  { name: '演讲表达', teacherName: '刘老师', start: '2026-10-10', end: '2026-12-26', count: 8, startTime: '10:40', endTime: '12:10' },
]

function createRandom(seed = 20260627) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function toDate(dateText) {
  const [year, month, day] = dateText.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function dateToString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayString() {
  return dateToString(new Date())
}

function buildRangeSchedule(template) {
  const start = toDate(template.start)
  const end = toDate(template.end)
  const distance = end.getTime() - start.getTime()
  const generated = Array.from({ length: template.count }, (_, index) => {
    if (template.count <= 1) return template.end
    return dateToString(new Date(start.getTime() + Math.round((distance * index) / (template.count - 1))))
  })
  const dates = [...new Set([...generated, ...(template.pinnedDates || [])])]
    .filter((date) => date >= template.start && date <= template.end)
    .sort((a, b) => a.localeCompare(b))

  return dates.map((date) => ({
    date,
    startTime: template.startTime,
    endTime: template.endTime,
  }))
}

function getCourseStatus(schedule, currentDate) {
  const startDate = schedule[0]?.date || ''
  const endDate = schedule[schedule.length - 1]?.date || ''
  if (endDate && endDate < currentDate) return 'inactive'
  if (startDate && startDate > currentDate) return 'pending'
  return 'active'
}

function getAttendanceStatus(studentId, sessionId, date) {
  const value = `${studentId}-${sessionId}-${date}`.split('').reduce((total, char) => (total + char.charCodeAt(0)) % 100, 0)
  if (value < 89) return 'present'
  if (value < 95) return 'late'
  return 'absent'
}

function selectCourseIndexes(index, random) {
  const targetCount = 1 + (index % 3)
  const indexes = new Set([index % DEMO_COURSE_COUNT])
  while (indexes.size < targetCount) indexes.add(Math.floor(random() * DEMO_COURSE_COUNT))
  return [...indexes]
}

export function createDemoDataset({ currentDate = todayString() } = {}) {
  const random = createRandom()
  const yearShort = String(DEMO_YEAR).slice(-2)
  const monthKey = currentDate.slice(2, 4) === yearShort ? currentDate.slice(2, 7).replace('-', '') : `${yearShort}06`
  const courses = courseTemplates.map((template, index) => {
    const schedule = buildRangeSchedule(template)
    return {
      id: uuidv4(),
      code: `C${yearShort}${String(index + 1).padStart(3, '0')}`,
      name: template.name,
      teacherName: template.teacherName,
      totalCredits: schedule.length,
      schedule,
      status: getCourseStatus(schedule, currentDate),
    }
  })

  const students = []
  const enrollments = []
  for (let index = 0; index < DEMO_STUDENT_COUNT; index += 1) {
    const id = uuidv4()
    const courseIndexes = selectCourseIndexes(index, random)
    students.push({
      id,
      studentNo: `${monthKey}${String(index + 1).padStart(3, '0')}`,
      name: `${surnames[index % surnames.length]}${givenNames[Math.floor(random() * givenNames.length)]}`,
      phone: `139${String(10000000 + index).padStart(8, '0')}`,
      totalCredits: courseIndexes.reduce((total, courseIndex) => total + courses[courseIndex].totalCredits, 0),
      usedCredits: 0,
    })
    courseIndexes.forEach((courseIndex) => {
      enrollments.push({
        id: uuidv4(),
        studentId: id,
        courseId: courses[courseIndex].id,
        joinedAt: courses[courseIndex].schedule[0]?.date || currentDate,
      })
    })
  }

  const sessions = []
  const sessionsByCourseId = new Map()
  courses.forEach((course) => {
    const courseSessions = course.schedule
      .filter((item) => item.date < currentDate)
      .map((item) => ({ id: uuidv4(), courseId: course.id, date: item.date }))
    sessions.push(...courseSessions)
    sessionsByCourseId.set(course.id, courseSessions)
  })

  const enrollmentsByCourseId = new Map()
  enrollments.forEach((enrollment) => {
    const courseEnrollments = enrollmentsByCourseId.get(enrollment.courseId) || []
    courseEnrollments.push(enrollment)
    enrollmentsByCourseId.set(enrollment.courseId, courseEnrollments)
  })

  const attendance = []
  const usedCreditsByStudentId = new Map()
  courses.forEach((course) => {
    const courseEnrollments = enrollmentsByCourseId.get(course.id) || []
    sessionsByCourseId.get(course.id).forEach((session) => {
      courseEnrollments.forEach((enrollment) => {
        const status = getAttendanceStatus(enrollment.studentId, session.id, session.date)
        attendance.push({ id: uuidv4(), sessionId: session.id, studentId: enrollment.studentId, status })
        if (status !== 'absent') {
          usedCreditsByStudentId.set(enrollment.studentId, (usedCreditsByStudentId.get(enrollment.studentId) || 0) + 1)
        }
      })
    })
  })

  const studentsWithCredits = students.map((student) => ({
    ...student,
    usedCredits: usedCreditsByStudentId.get(student.id) || 0,
  }))
  const assignedTeacherNames = [...new Set(courseTemplates.map((template) => template.teacherName))]
  const teachers = [
    ...assignedTeacherNames.map((name, index) => ({
      id: uuidv4(),
      teacherNo: `T${yearShort}${String(index + 1).padStart(2, '0')}`,
      name,
      username: `teacher-${index + 1}`,
      password: '123456',
      courseIds: courses.filter((course) => course.teacherName === name).map((course) => course.id),
    })),
    ...unassignedTeacherNames.map((name, index) => ({
      id: uuidv4(),
      teacherNo: `T${yearShort}${String(assignedTeacherNames.length + index + 1).padStart(2, '0')}`,
      name,
      username: `teacher-free-${index + 1}`,
      password: '123456',
      courseIds: [],
    })),
  ]

  return {
    courses,
    students: studentsWithCredits,
    enrollments,
    sessions,
    attendance,
    teachers,
    counters: {
      courseCodeYear: yearShort,
      courseCodeSequence: courses.length,
      studentNoMonthKey: monthKey,
      studentNoSequence: students.length,
      teacherNoYear: yearShort,
      teacherNoSequence: teachers.length,
      creditCalculationVersion: 2,
      courseTimelineDistributionVersion: DEMO_DATASET_VERSION,
      demoDatasetVersion: DEMO_DATASET_VERSION,
    },
  }
}
