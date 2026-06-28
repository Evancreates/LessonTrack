import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import AttendanceBoard from '../components/AttendanceBoard'
import DataTable from '../components/DataTable'
import {
  getPlanForDate,
  isPlannedDate,
  normalizeSchedule,
} from '../utils/courseSchedule'
import {
  getAttendance,
  getAttendanceDrafts,
  getCourses,
  getCurrentRole,
  getEnrollments,
  getSessions,
  getStudents,
  getTeachers,
  recalculateStudentCredits,
  saveAttendance,
  saveAttendanceDrafts,
  saveSessions,
} from '../utils/storage'

const statusLabels = { present: '出勤', late: '迟到', absent: '缺勤' }
const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const today = () => new Date().toISOString().split('T')[0]

export default function Attendance({ dataVersion, onDataChange }) {
  const todayDate = today()
  const currentRole = getCurrentRole()
  const teacher = getTeachers().find((item) => item.id === currentRole.userId)
  const allCourses = getCourses()
  const courses = currentRole.role === 'admin' ? allCourses : allCourses.filter((course) => teacher?.courseIds.includes(course.id))
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [drafts, setDrafts] = useState(() => getAttendanceDrafts())
  const [message, setMessage] = useState('')

  const defaultCourseId = currentRole.role === 'teacher'
    ? courses.find((course) => isPlannedDate(course, todayDate))?.id || courses[0]?.id || ''
    : courses[0]?.id || ''
  const activeCourseId = courses.some((course) => course.id === selectedCourseId) ? selectedCourseId : defaultCourseId
  const activeCourse = courses.find((course) => course.id === activeCourseId)
  const sessions = getSessions()
  const activeCourseSessions = sessions.filter((session) => session.courseId === activeCourseId).sort((a, b) => a.date.localeCompare(b.date))
  const teacherDateOptions = currentRole.role === 'teacher' && activeCourse
    ? getTeacherDateOptions(activeCourse, activeCourseSessions, todayDate)
    : []
  const selectedSessionDate = currentRole.role === 'admin' && activeCourseSessions.length && !activeCourseSessions.some((session) => session.date === selectedDate)
    ? activeCourseSessions[0].date
    : currentRole.role === 'teacher' && teacherDateOptions.length && !teacherDateOptions.some((option) => option.date === selectedDate)
      ? teacherDateOptions[0].date
      : selectedDate
  const activeSession = sessions.find((session) => session.courseId === activeCourseId && session.date === selectedSessionDate)
  const planned = activeCourse ? (currentRole.role === 'admin' ? Boolean(activeSession) : isPlannedDate(activeCourse, selectedSessionDate)) : false
  const plannedItem = activeCourse ? getPlanForDate(activeCourse, selectedSessionDate) : null
  const studentIds = new Set(getEnrollments().filter((enrollment) => enrollment.courseId === activeCourseId).map((enrollment) => enrollment.studentId))
  const allStudents = getStudents()
  const students = planned ? allStudents.filter((student) => studentIds.has(student.id)) : []
  const committedRecords = getAttendance().filter((record) => record.sessionId === activeSession?.id)
  const draftKey = `${activeCourseId}:${selectedSessionDate}`
  const draft = currentRole.role === 'teacher' && selectedSessionDate === todayDate ? drafts.find((item) => item.key === draftKey) : null
  const canTakeAttendance = currentRole.role === 'teacher' && planned && selectedSessionDate === todayDate && !activeSession
  const records = canTakeAttendance ? draft?.records || committedRecords : committedRecords
  void dataVersion

  const saveDraft = (nextDraft) => {
    const nextDrafts = [...getAttendanceDrafts().filter((item) => item.key !== nextDraft.key), nextDraft]
    saveAttendanceDrafts(nextDrafts)
    setDrafts(nextDrafts)
  }

  const handleMark = (studentId, status) => {
    if (!canTakeAttendance) return
    const baseRecords = draft?.records || committedRecords
    const recordIndex = baseRecords.findIndex((record) => record.studentId === studentId)
    const nextRecords = recordIndex === -1
      ? [...baseRecords, { studentId, status }]
      : baseRecords.map((record, index) => index === recordIndex ? { ...record, status } : record)
    saveDraft({ key: draftKey, courseId: activeCourseId, date: selectedSessionDate, records: nextRecords })
    setMessage('点名已暂存，点击“提交本次点名”后才会写入机构数据。')
  }

  const submitAttendance = () => {
    if (currentRole.role !== 'teacher') return
    if (selectedSessionDate !== todayDate) {
      setMessage('只能提交今天的课堂点名，历史和未来日期仅支持查询。')
      return
    }
    if (!activeCourseId || !planned) {
      setMessage('今天无课程，不能提交点名。')
      return
    }
    if (activeSession) {
      setMessage('今天的点名已提交，当前为查询状态，不能再次编辑。')
      return
    }
    if (students.length === 0) return
    const recordByStudentId = new Map(records.map((record) => [record.studentId, record]))
    if (students.some((student) => !recordByStudentId.has(student.id))) {
      setMessage(`仍有 ${students.filter((student) => !recordByStudentId.has(student.id)).length} 名学生未点名，请完成后再提交。`)
      return
    }
    let session = activeSession
    if (!session) {
      session = { id: uuidv4(), courseId: activeCourseId, date: selectedSessionDate }
      saveSessions([...sessions, session])
    }
    const retained = getAttendance().filter((record) => record.sessionId !== session.id)
    saveAttendance([...retained, ...students.map((student) => ({ id: uuidv4(), sessionId: session.id, studentId: student.id, status: recordByStudentId.get(student.id).status }))])
    recalculateStudentCredits()
    const nextDrafts = getAttendanceDrafts().filter((item) => item.key !== draftKey)
    saveAttendanceDrafts(nextDrafts)
    setDrafts(nextDrafts)
    setMessage(`已提交 ${selectedSessionDate} 的点名记录，管理员数据中心已同步更新。`)
    onDataChange()
  }

  const onCourseChange = (courseId) => {
    const nextCourse = courses.find((course) => course.id === courseId)
    const submittedSessions = sessions.filter((session) => session.courseId === courseId).sort((a, b) => a.date.localeCompare(b.date))
    setSelectedCourseId(courseId)
    if (currentRole.role === 'admin') {
      setSelectedDate(submittedSessions[0]?.date || todayDate)
    } else {
      const nextDateOptions = nextCourse ? getTeacherDateOptions(nextCourse, submittedSessions, todayDate) : []
      setSelectedDate(nextDateOptions[0]?.date || todayDate)
    }
    setMessage('')
  }

  return (
    <section>
      <div style={headerStyle}><div><h1 style={titleStyle}>{currentRole.role === 'admin' ? '点名查询' : '课堂点名'}</h1><p style={subtleStyle}>{currentRole.role === 'admin' ? '管理员仅查询教师已提交的点名记录，不在此页面执行点名。' : '默认进入今天课程；历史、已提交和未来课程仅作为查询。'}</p></div>{canTakeAttendance && draft && <span style={draftBadgeStyle}>本次记录暂存中</span>}</div>
      {courses.length === 0 ? <p style={emptyStyle}>暂无可管理课程。</p> : <>
        <div style={controlRowStyle}>
          <label style={controlLabelStyle}>选择课程<select value={activeCourseId} onChange={(event) => onCourseChange(event.target.value)} style={selectStyle}>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></label>
          {currentRole.role === 'admin' && <label style={controlLabelStyle}>课堂日期<select value={activeCourseSessions.length ? selectedSessionDate : ''} onChange={(event) => { setSelectedDate(event.target.value); setMessage('') }} style={selectStyle}>{activeCourseSessions.length === 0 ? <option value="">暂无已提交日期</option> : activeCourseSessions.map((session) => <option key={session.id} value={session.date}>{formatDateChip(session.date)}</option>)}</select></label>}
          {currentRole.role !== 'admin' && <label style={controlLabelStyle}>课堂日期<select value={teacherDateOptions.length ? selectedSessionDate : ''} onChange={(event) => { setSelectedDate(event.target.value); setMessage('') }} style={selectStyle}>{teacherDateOptions.length === 0 ? <option value="">暂无可查询日期</option> : teacherDateOptions.map((option) => <option key={option.date} value={option.date}>{getDateOptionLabel(option)}</option>)}</select></label>}
          {plannedItem?.startTime && plannedItem?.endTime && <span style={timeBadgeStyle}>{plannedItem.startTime} - {plannedItem.endTime}</span>}
          {currentRole.role !== 'admin' && <span style={canTakeAttendance ? operationBadgeStyle : queryBadgeStyle}>{canTakeAttendance ? '今天点名' : '查询状态'}</span>}
        </div>
        {activeCourse && currentRole.role === 'admin' && <PlanDateStrip course={activeCourse} sessions={activeCourseSessions} selectedDate={selectedSessionDate} adminView onSelect={(date) => { setSelectedDate(date); setMessage('') }} />}
        {message && <p style={{ ...messageStyle, color: message.startsWith('已提交') ? '#15803d' : '#475569' }}>{message}</p>}
        {currentRole.role === 'admin'
          ? <AdminAttendanceResults course={activeCourse} activeSession={activeSession} records={committedRecords} students={allStudents} planned={planned} />
          : canTakeAttendance
            ? <><AttendanceBoard students={students} records={records} onMark={handleMark} /><div style={submitRowStyle}><button type="button" disabled={students.length === 0} onClick={submitAttendance} style={{ ...primaryButtonStyle, opacity: students.length === 0 ? .55 : 1 }}>提交本次点名</button></div></>
            : <TeacherAttendanceResults course={activeCourse} activeSession={activeSession} records={committedRecords} students={allStudents} planned={planned} selectedDate={selectedSessionDate} todayDate={todayDate} />}
      </>}
    </section>
  )
}

function getTeacherDateOptions(course, sessions, todayDate) {
  const schedule = normalizeSchedule(course.schedule)
  const planByDate = new Map(schedule.map((item) => [item.date, item]))
  const sessionDates = new Set(sessions.map((session) => session.date))
  const options = []
  const todayPlan = planByDate.get(todayDate)

  if (todayPlan) {
    options.push({
      date: todayDate,
      type: sessionDates.has(todayDate) ? 'submittedToday' : 'today',
    })
  }

  sessions
    .filter((session) => session.date !== todayDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((session) => {
      options.push({ date: session.date, type: 'submitted' })
    })

  schedule
    .filter((item) => item.date > todayDate && !sessionDates.has(item.date))
    .forEach((item) => {
      options.push({ date: item.date, type: 'future' })
    })

  schedule
    .filter((item) => item.date < todayDate && !sessionDates.has(item.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((item) => {
      options.push({ date: item.date, type: 'missed' })
    })

  return options
}

function getDateOptionLabel(option) {
  const typeLabel = {
    today: '今天点名',
    submittedToday: '今天已提交',
    submitted: '已提交查询',
    future: '计划查询',
    missed: '过去未提交',
  }[option.type]
  return `${formatDateChip(option.date)} · ${typeLabel}`
}

function PlanDateStrip({ course, sessions, selectedDate, adminView, onSelect }) {
  const stripRef = useRef(null)
  const [scrollState, setScrollState] = useState({ left: false, right: false })
  const schedule = adminView
    ? sessions.map((session) => {
      const plan = getPlanForDate(course, session.date)
      return { date: session.date, startTime: plan?.startTime || '', endTime: plan?.endTime || '' }
    })
    : normalizeSchedule(course.schedule)

  const updateScrollState = () => {
    const element = stripRef.current
    if (!element) return
    setScrollState({
      left: element.scrollLeft > 4,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    })
  }

  useEffect(() => {
    updateScrollState()
    const element = stripRef.current
    if (!element) return undefined
    element.addEventListener('scroll', updateScrollState)
    window.addEventListener('resize', updateScrollState)
    return () => {
      element.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [schedule.length])

  const scrollDates = (direction) => {
    stripRef.current?.scrollBy({ left: direction * 260, behavior: 'smooth' })
  }

  if (schedule.length === 0) return <section style={dateStripStyle}><span style={{ color: '#94a3b8' }}>{adminView ? '该课程还没有已提交的点名记录。' : '该课程还没有维护授课计划。'}</span></section>
  return (
    <section style={dateStripShellStyle}>
      {scrollState.left && <button type="button" aria-label="向左查看更多日期" onClick={() => scrollDates(-1)} style={{ ...dateScrollButtonStyle, left: 4 }}>‹</button>}
      <div ref={stripRef} style={dateStripStyle}>
        {schedule.map((item) => <button key={item.date} type="button" onClick={() => onSelect(item.date)} style={selectedDate === item.date ? activeDateChipStyle : dateChipStyle}><strong>{formatDateChip(item.date)}</strong>{item.startTime && item.endTime && <span>{item.startTime}-{item.endTime}</span>}</button>)}
      </div>
      {scrollState.right && <button type="button" aria-label="向右查看更多日期" onClick={() => scrollDates(1)} style={{ ...dateScrollButtonStyle, right: 4 }}>›</button>}
    </section>
  )
}

function formatDateChip(date) {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = weekdayLabels[new Date(year, month - 1, day).getDay()]
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${weekday}`
}

function AdminAttendanceResults({ course, activeSession, records, students, planned }) {
  const studentById = new Map(students.map((student) => [student.id, student]))
  const rows = records.map((record) => ({ record, student: studentById.get(record.studentId) })).filter((item) => item.student)
  const present = rows.filter((item) => item.record.status === 'present').length
  const late = rows.filter((item) => item.record.status === 'late').length
  const absent = rows.filter((item) => item.record.status === 'absent').length

  if (!planned) {
    return <section style={emptyStateStyle}><strong>暂无已提交点名记录</strong><p>“{course?.name || '该课程'}”还没有可查询的已进行课堂。</p></section>
  }

  return (
    <section style={resultPanelStyle}>
      <div style={resultSummaryStyle}>
        <Metric label="出勤" value={present} />
        <Metric label="迟到" value={late} />
        <Metric label="缺勤" value={absent} />
      </div>
      <div style={teacherInfoStyle}>授课老师：<strong>{course?.teacherName || '未分配'}</strong></div>
      {!activeSession || rows.length === 0 ? <section style={emptyStateStyle}><strong>当天暂无已提交点名记录</strong><p>教师提交后，这里会展示具体学生与出勤状态。</p></section> : <DataTable columns={[
        { key: 'studentNo', label: '学号', width: 160, sortValue: (item) => item.student.studentNo, render: (item) => item.student.studentNo },
        { key: 'name', label: '姓名', width: 150, sortValue: (item) => item.student.name, render: (item) => <strong>{item.student.name}</strong> },
        { key: 'phone', label: '电话', width: 170, sortValue: (item) => item.student.phone || '', render: (item) => item.student.phone || '—' },
        { key: 'status', label: '出勤状态', width: 140, align: 'center', sortValue: (item) => item.record.status, render: (item) => <StatusBadge status={item.record.status} /> },
        { key: 'detail', label: '操作', width: 110, render: (item) => <Link to={`/student/${item.student.id}`} state={{ from: '/attendance', label: '返回点名管理', highlightRecordId: item.record.id, highlightStatus: item.record.status }} style={linkStyle}>详情</Link> },
      ]} rows={rows} getRowId={(item) => item.record.id} emptyMessage="当天暂无已提交点名记录。" />}
    </section>
  )
}

function TeacherAttendanceResults({ course, activeSession, records, students, planned, selectedDate, todayDate }) {
  const studentById = new Map(students.map((student) => [student.id, student]))
  const rows = records.map((record) => ({ record, student: studentById.get(record.studentId) })).filter((item) => item.student)
  const present = rows.filter((item) => item.record.status === 'present').length
  const late = rows.filter((item) => item.record.status === 'late').length
  const absent = rows.filter((item) => item.record.status === 'absent').length

  if (!planned) {
    return <section style={emptyStateStyle}><strong>今天无可点名课程</strong><p>所选日期不在“{course?.name || '该课程'}”的授课计划内，因此不能点名。请在查询日期中查看已提交记录。</p></section>
  }

  if (!activeSession || rows.length === 0) {
    const description = selectedDate > todayDate
      ? '这是未来计划课程，仅可查看计划，开课当天才会进入点名操作。'
      : selectedDate === todayDate
        ? '今天课程尚未提交点名，选择“今天点名”状态后完成课堂点名。'
        : '该历史日期没有已提交记录，不能在点名页补录或修改。'
    return <section style={emptyStateStyle}><strong>暂无已提交点名记录</strong><p>{description}</p></section>
  }

  return (
    <section style={resultPanelStyle}>
      <div style={queryNoticeStyle}><strong>{selectedDate === todayDate ? '今天点名已提交' : '历史点名查询'}</strong><span>当前为只读查询状态，不能再次编辑或提交。</span></div>
      <div style={resultSummaryStyle}>
        <Metric label="出勤" value={present} />
        <Metric label="迟到" value={late} />
        <Metric label="缺勤" value={absent} />
      </div>
      <DataTable columns={[
        { key: 'studentNo', label: '学号', width: 160, sortValue: (item) => item.student.studentNo, render: (item) => item.student.studentNo },
        { key: 'name', label: '姓名', width: 150, sortValue: (item) => item.student.name, render: (item) => <strong>{item.student.name}</strong> },
        { key: 'phone', label: '电话', width: 170, sortValue: (item) => item.student.phone || '', render: (item) => item.student.phone || '—' },
        { key: 'status', label: '出勤状态', width: 140, align: 'center', sortValue: (item) => item.record.status, render: (item) => <StatusBadge status={item.record.status} /> },
        { key: 'detail', label: '操作', width: 110, render: (item) => <Link to={`/student/${item.student.id}`} state={{ from: '/attendance', label: '返回课堂点名', highlightRecordId: item.record.id, highlightStatus: item.record.status }} style={linkStyle}>详情</Link> },
      ]} rows={rows} getRowId={(item) => item.record.id} emptyMessage="暂无已提交点名记录。" />
    </section>
  )
}

function Metric({ label, value }) {
  return <article style={metricStyle}><span>{label}</span><strong style={metricValueStyle}>{value}</strong></article>
}

function StatusBadge({ status }) {
  const style = status === 'present' ? presentBadgeStyle : status === 'late' ? lateBadgeStyle : absentBadgeStyle
  return <span style={style}>{statusLabels[status] || status}</span>
}

const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }
const titleStyle = { margin: '5px 0 0', fontSize: 30, letterSpacing: '-.03em' }
const subtleStyle = { margin: '7px 0 0', color: '#64748b', fontSize: 14 }
const draftBadgeStyle = { padding: '7px 11px', borderRadius: 999, color: '#9a3412', background: '#fff1df', fontSize: 13, fontWeight: 700 }
const controlRowStyle = { display: 'flex', alignItems: 'end', gap: 14, flexWrap: 'wrap', padding: 18, marginBottom: 12, borderRadius: 16, background: '#fff', boxShadow: '0 8px 24px rgba(15, 23, 42, .055)' }
const controlLabelStyle = { display: 'grid', gap: 7, minWidth: 220, color: '#475569', fontSize: 13, fontWeight: 700 }
const selectStyle = { boxSizing: 'border-box', width: '100%', height: 42, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, background: '#fff', color: '#334155', font: 'inherit', fontWeight: 400 }
const primaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#2563eb', color: '#fff', fontWeight: 750, whiteSpace: 'nowrap', boxShadow: '0 5px 14px rgba(37, 99, 235, .2)' }
const messageStyle = { margin: '10px 0 16px', padding: '10px 13px', borderRadius: 10, background: '#f8fafc', fontSize: 14 }
const emptyStyle = { padding: 24, borderRadius: 14, background: '#fff', color: '#64748b' }
const submitRowStyle = { display: 'flex', justifyContent: 'flex-end', marginTop: 16 }
const dateStripShellStyle = { position: 'relative', marginBottom: 2 }
const dateStripStyle = { display: 'flex', gap: 9, overflowX: 'auto', padding: '4px 4px 14px', overscrollBehaviorX: 'contain', scrollbarWidth: 'thin' }
const dateScrollButtonStyle = { position: 'absolute', top: '50%', zIndex: 2, width: 32, height: 32, transform: 'translateY(-60%)', border: 0, borderRadius: 999, background: 'rgba(37, 99, 235, .92)', color: '#fff', fontSize: 24, lineHeight: 1, boxShadow: '0 8px 18px rgba(37, 99, 235, .24)' }
const dateChipStyle = { display: 'grid', gap: 2, minWidth: 106, border: 0, borderRadius: 13, padding: '9px 10px', background: '#fff', color: '#475569', boxShadow: '0 6px 18px rgba(15, 23, 42, .055)', textAlign: 'left' }
const activeDateChipStyle = { ...dateChipStyle, background: '#2563eb', color: '#fff', boxShadow: '0 8px 18px rgba(37, 99, 235, .24)' }
const timeBadgeStyle = { alignSelf: 'center', padding: '10px 13px', borderRadius: 999, color: '#1d4ed8', background: '#dbeafe', fontSize: 13, fontWeight: 800 }
const operationBadgeStyle = { alignSelf: 'center', padding: '10px 13px', borderRadius: 999, color: '#166534', background: '#dcfce7', fontSize: 13, fontWeight: 800 }
const queryBadgeStyle = { alignSelf: 'center', padding: '10px 13px', borderRadius: 999, color: '#475569', background: '#e2e8f0', fontSize: 13, fontWeight: 800 }
const emptyStateStyle = { padding: 24, borderRadius: 16, background: '#fff', color: '#64748b', boxShadow: '0 8px 24px rgba(15, 23, 42, .055)' }
const resultPanelStyle = { display: 'grid', gap: 16 }
const resultSummaryStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }
const metricStyle = { padding: 16, borderRadius: 14, background: '#fff', boxShadow: '0 6px 20px rgba(15, 23, 42, .05)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, color: '#64748b' }
const metricValueStyle = { color: '#1e293b', fontSize: 30, lineHeight: 1, fontWeight: 850 }
const teacherInfoStyle = { padding: '2px 4px', color: '#475569', fontSize: 14 }
const queryNoticeStyle = { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 12, background: '#f8fafc', color: '#475569', fontSize: 14 }
const linkStyle = { color: '#2563eb', textDecoration: 'none', fontWeight: 700, padding: '5px 6px' }
const presentBadgeStyle = { display: 'inline-block', padding: '4px 9px', borderRadius: 999, color: '#166534', background: '#dcfce7', fontSize: 12, fontWeight: 700 }
const lateBadgeStyle = { display: 'inline-block', padding: '4px 9px', borderRadius: 999, color: '#9a3412', background: '#fff1df', fontSize: 12, fontWeight: 700 }
const absentBadgeStyle = { display: 'inline-block', padding: '4px 9px', borderRadius: 999, color: '#b91c1c', background: '#fee2e2', fontSize: 12, fontWeight: 700 }
