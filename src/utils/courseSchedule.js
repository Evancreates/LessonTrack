export function normalizeSchedule(schedule) {
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

export function getPlannedLessonCount(course) {
  const scheduleCount = normalizeSchedule(course?.schedule).length
  const legacyTotal = Number(course?.totalCredits || 0)
  return Math.max(scheduleCount, Number.isFinite(legacyTotal) ? legacyTotal : 0)
}

export function getScheduleStart(course, fallbackSessions = []) {
  const schedule = normalizeSchedule(course?.schedule)
  if (schedule.length) return schedule[0].date
  const dates = fallbackSessions.map((session) => session.date).filter(Boolean).sort()
  return dates[0] || ''
}

export function getScheduleEnd(course, fallbackSessions = []) {
  const schedule = normalizeSchedule(course?.schedule)
  if (schedule.length) return schedule[schedule.length - 1].date
  const dates = fallbackSessions.map((session) => session.date).filter(Boolean).sort()
  return dates[dates.length - 1] || ''
}

export function formatScheduleStart(course, fallbackSessions = []) {
  const schedule = normalizeSchedule(course?.schedule)
  if (schedule.length) {
    const first = schedule[0]
    return first.startTime ? `${first.date} ${first.startTime}` : first.date
  }
  return getScheduleStart(course, fallbackSessions)
}

export function formatScheduleEnd(course, fallbackSessions = []) {
  const schedule = normalizeSchedule(course?.schedule)
  if (schedule.length) {
    const last = schedule[schedule.length - 1]
    return last.endTime ? `${last.date} ${last.endTime}` : last.date
  }
  return getScheduleEnd(course, fallbackSessions)
}

export function formatScheduleRange(course, fallbackSessions = []) {
  const start = formatScheduleStart(course, fallbackSessions)
  const end = formatScheduleEnd(course, fallbackSessions)
  if (!start) return '未设置计划'
  return start === end ? start : `${start} 至 ${end}`
}

export function formatScheduleSummary(course, fallbackSessions = []) {
  const schedule = normalizeSchedule(course?.schedule)
  if (!schedule.length) return formatScheduleRange(course, fallbackSessions)
  const first = schedule[0]
  const last = schedule[schedule.length - 1]
  const timeText = first.startTime && first.endTime ? ` · ${first.startTime}-${first.endTime}` : ''
  if (schedule.length === 1) return `${first.date}${timeText}`
  return `${first.date} 至 ${last.date} · ${schedule.length} 次`
}

export function isPlannedDate(course, date) {
  if (!date) return false
  return normalizeSchedule(course?.schedule).some((item) => item.date === date)
}

export function getPlanForDate(course, date) {
  return normalizeSchedule(course?.schedule).find((item) => item.date === date) || null
}
