import { createDemoDataset, DEMO_YEAR } from './demoDataset.js'

export const ADMIN_USERNAME = 'admin'

const MOCK_DASHBOARD_DATE = '2026-06-28'
const MOCK_DASHBOARD_TOTAL_LESSONS = 11418

function getYearShort() {
  return String(DEMO_YEAR).slice(-2)
}

function getMonthKey() {
  return MOCK_DASHBOARD_DATE.slice(2, 7).replace('-', '')
}

function createEmptyDashboardData() {
  return {
    courses: [],
    students: [],
    enrollments: [],
    sessions: [],
    attendance: [],
    teachers: [],
    counters: {
      courseCodeYear: getYearShort(),
      courseCodeSequence: 0,
      studentNoMonthKey: getMonthKey(),
      studentNoSequence: 0,
      teacherNoYear: getYearShort(),
      teacherNoSequence: 0,
      creditCalculationVersion: 2,
      courseTimelineDistributionVersion: 0,
      demoDatasetVersion: null,
    },
  }
}

function normalizeMockDashboardTotals(dataset) {
  const currentTotal = dataset.students.reduce((total, student) => total + Number(student.totalCredits || 0), 0)
  const creditDelta = MOCK_DASHBOARD_TOTAL_LESSONS - currentTotal
  if (!creditDelta || dataset.students.length === 0) return dataset

  const students = dataset.students.map((student) => ({ ...student }))
  const direction = creditDelta > 0 ? 1 : -1
  let remaining = Math.abs(creditDelta)
  let index = 0

  while (remaining > 0 && index < students.length * Math.abs(creditDelta)) {
    const student = students[index % students.length]
    if (direction > 0 || Number(student.totalCredits || 0) > Number(student.usedCredits || 0)) {
      student.totalCredits = Number(student.totalCredits || 0) + direction
      remaining -= 1
    }
    index += 1
  }

  return { ...dataset, students }
}

export function getDashboardData(user) {
  if (user?.role === 'admin') {
    return normalizeMockDashboardTotals(createDemoDataset({ currentDate: MOCK_DASHBOARD_DATE }))
  }

  return createEmptyDashboardData()
}
