import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ConfirmDialog from '../components/ConfirmDialog'
import DataTable from '../components/DataTable'
import Drawer from '../components/Drawer'
import {
  formatScheduleEnd,
  formatScheduleRange,
  formatScheduleStart,
  getPlannedLessonCount,
  getScheduleEnd,
  getScheduleStart,
  normalizeSchedule,
} from '../utils/courseSchedule'
import {
  generateCourseCode,
  getAttendance,
  getCourses,
  getEnrollments,
  getSettings,
  getSessions,
  getStudents,
  recalculateStudentCredits,
  saveAttendance,
  saveCourses,
  saveEnrollments,
  saveStudents,
} from '../utils/storage'

const emptyForm = { name: '', teacherName: '', schedule: [] }
const weekLabels = ['日', '一', '二', '三', '四', '五', '六']
const statusOrder = { pending: 0, active: 1, paused: 2, inactive: 3 }

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function todayString() {
  return new Date().toISOString().split('T')[0]
}

export default function Courses({ dataVersion, onDataChange }) {
  const [form, setForm] = useState(emptyForm)
  const [calendarMonth, setCalendarMonth] = useState(currentMonth())
  const [editingCourse, setEditingCourse] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scheduleDetailCourse, setScheduleDetailCourse] = useState(null)
  const [detailCalendarMonth, setDetailCalendarMonth] = useState(currentMonth())
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingRemoveStudent, setPendingRemoveStudent] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  void dataVersion

  const courses = getCourses()
  const enrollments = getEnrollments()
  const students = getStudents()
  const sessions = getSessions()
  const attendance = getAttendance()
  const settings = getSettings()
  const keyword = search.trim().toLowerCase()

  const sortedCourses = [...courses].sort((a, b) => {
    const aStart = getScheduleStart(a, sessions.filter((session) => session.courseId === a.id))
    const bStart = getScheduleStart(b, sessions.filter((session) => session.courseId === b.id))
    return String(bStart || '').localeCompare(String(aStart || ''))
  })

  const displayedCourses = sortedCourses.filter((course) => (
    (statusFilter === 'all' || course.status === statusFilter)
    && (!keyword || course.code.toLowerCase().includes(keyword) || course.name.toLowerCase().includes(keyword) || (course.teacherName || '').toLowerCase().includes(keyword))
  ))

  const statsByCourseId = new Map(courses.map((course) => {
    const courseSessions = sessions.filter((session) => session.courseId === course.id)
    const plannedCount = getPlannedLessonCount(course)
    return [course.id, {
      enrollmentCount: enrollments.filter((enrollment) => enrollment.courseId === course.id).length,
      sessionCount: courseSessions.length,
      plannedCount,
      progress: plannedCount ? Math.min(100, Math.round((courseSessions.length / plannedCount) * 100)) : 0,
    }]
  }))

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingCourse(null)
    setForm(emptyForm)
    setError('')
  }

  const openCreate = () => {
    setEditingCourse(null)
    setForm(emptyForm)
    setCalendarMonth(currentMonth())
    setError('')
    setDrawerOpen(true)
  }

  const openEdit = (course) => {
    const schedule = normalizeSchedule(course.schedule)
    setEditingCourse(course)
    setForm({ name: course.name, teacherName: course.teacherName || '', schedule })
    setCalendarMonth(schedule[0]?.date.slice(0, 7) || currentMonth())
    setError('')
    setDrawerOpen(true)
  }

  const openScheduleDetail = (course) => {
    const schedule = normalizeSchedule(course.schedule)
    setDetailCalendarMonth(schedule[0]?.date.slice(0, 7) || currentMonth())
    setScheduleDetailCourse(course)
  }

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const syncStudentTotalCredits = (nextCourses, nextEnrollments = getEnrollments()) => {
    const courseById = new Map(nextCourses.map((course) => [course.id, course]))
    saveStudents(getStudents().map((student) => ({
      ...student,
      totalCredits: nextEnrollments
        .filter((enrollment) => enrollment.studentId === student.id)
        .reduce((total, enrollment) => total + getPlannedLessonCount(courseById.get(enrollment.courseId)), 0),
    })))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const name = form.name.trim()
    const teacherName = form.teacherName.trim()
    const schedule = normalizeSchedule(form.schedule)
    if (!name) {
      setError('请填写课程名称。')
      return
    }
    if (schedule.length === 0) {
      setError('请至少在课程计划中选择一次上课日期。')
      return
    }
    if (schedule.some((item) => !item.startTime || !item.endTime || item.startTime >= item.endTime)) {
      setError('请为每次课程填写有效的开始时间和结束时间。')
      return
    }
    if (courses.some((course) => course.id !== editingCourse?.id && course.name.trim().toLowerCase() === name.toLowerCase())) {
      setError('课程名称已存在。')
      return
    }

    const totalCredits = schedule.length
    if (editingCourse) {
      const scheduleEnd = schedule[schedule.length - 1]?.date || ''
      const nextStatus = editingCourse.status === 'inactive' && scheduleEnd >= todayString()
        ? 'active'
        : editingCourse.status
      const nextCourses = courses.map((course) => course.id === editingCourse.id
        ? { ...course, name, teacherName, schedule, totalCredits, status: nextStatus }
        : course)
      saveCourses(nextCourses)
      syncStudentTotalCredits(nextCourses)
    } else {
      const nextCourses = [...courses, { id: uuidv4(), code: generateCourseCode(), name, teacherName, schedule, totalCredits, status: 'active' }]
      saveCourses(nextCourses)
      syncStudentTotalCredits(nextCourses)
    }
    onDataChange()
    closeDrawer()
  }

  const confirmStatusChange = () => {
    if (!statusTarget) return
    saveCourses(courses.map((course) => course.id === statusTarget.course.id
      ? { ...course, status: statusTarget.nextStatus }
      : course))
    setStatusTarget(null)
    onDataChange()
  }

  const confirmDelete = () => {
    if (!pendingDelete || enrollments.some((enrollment) => enrollment.courseId === pendingDelete.id)) return
    saveCourses(courses.filter((course) => course.id !== pendingDelete.id))
    setPendingDelete(null)
    onDataChange()
  }

  const confirmRemoveStudent = () => {
    if (!pendingRemoveStudent) return
    const { course, student } = pendingRemoveStudent
    const courseSessionIds = new Set(sessions.filter((session) => session.courseId === course.id).map((session) => session.id))
    const nextEnrollments = enrollments.filter((enrollment) => !(enrollment.courseId === course.id && enrollment.studentId === student.id))
    const nextAttendance = attendance.filter((record) => !(record.studentId === student.id && courseSessionIds.has(record.sessionId)))
    saveEnrollments(nextEnrollments)
    saveAttendance(nextAttendance)
    syncStudentTotalCredits(courses, nextEnrollments)
    recalculateStudentCredits()
    setPendingRemoveStudent(null)
    onDataChange()
  }

  const enrolledCount = pendingDelete ? enrollments.filter((enrollment) => enrollment.courseId === pendingDelete.id).length : 0
  const editStudents = editingCourse ? students
    .filter((student) => enrollments.some((enrollment) => enrollment.courseId === editingCourse.id && enrollment.studentId === student.id))
    .map((student) => {
      const courseSessionIds = new Set(sessions.filter((session) => session.courseId === editingCourse.id).map((session) => session.id))
      const attended = attendance.filter((record) => record.studentId === student.id && courseSessionIds.has(record.sessionId) && record.status !== 'absent').length
      return { ...student, attended }
    }) : []

  const columns = [
    { key: 'code', label: '课程编号', width: 108, sortValue: (course) => course.code, render: (course) => <span style={codeStyle}>{course.code}</span> },
    { key: 'name', label: '课程名称', width: 140, sortValue: (course) => course.name, render: (course) => <strong>{course.name}</strong> },
    { key: 'teacher', label: '授课老师', width: 112, sortValue: (course) => course.teacherName || '', render: (course) => course.teacherName || '未分配' },
    { key: 'startDate', label: '开始时间', width: 142, sortValue: (course) => getScheduleStart(course, sessions.filter((session) => session.courseId === course.id)), render: (course) => formatScheduleStart(course, sessions.filter((session) => session.courseId === course.id)) || '—' },
    { key: 'endDate', label: '结束时间', width: 142, sortValue: (course) => getScheduleEnd(course, sessions.filter((session) => session.courseId === course.id)), render: (course) => formatScheduleEnd(course, sessions.filter((session) => session.courseId === course.id)) || '—' },
    { key: 'planDetail', label: '课时详情', width: 90, align: 'center', render: (course) => <button type="button" onClick={() => openScheduleDetail(course)} style={textButtonStyle}>查看</button> },
    { key: 'credits', label: '计划课时', width: 90, align: 'center', sortValue: (course) => getPlannedLessonCount(course), render: (course) => `${getPlannedLessonCount(course)} 节` },
    { key: 'progress', label: '教学进度', width: 150, sortValue: (course) => statsByCourseId.get(course.id)?.progress || 0, render: (course) => <Progress value={statsByCourseId.get(course.id)?.progress || 0} detail={`${statsByCourseId.get(course.id)?.sessionCount || 0} / ${statsByCourseId.get(course.id)?.plannedCount || 0} 节`} /> },
    { key: 'status', label: '状态', width: 90, align: 'center', sortValue: (course) => statusOrder[course.status] ?? 3, render: (course) => <StatusBadge status={course.status} /> },
    { key: 'students', label: '学生', width: 76, align: 'center', sortValue: (course) => statsByCourseId.get(course.id)?.enrollmentCount || 0, render: (course) => `${statsByCourseId.get(course.id)?.enrollmentCount || 0} 人` },
    { key: 'actions', label: '操作', width: 210, render: (course) => <CourseActions course={course} onEdit={openEdit} onStatusChange={(nextStatus) => setStatusTarget({ course, nextStatus })} onDelete={setPendingDelete} /> },
  ]

  return (
    <section>
      <div style={pageHeaderStyle}><div><h1 style={titleStyle}>课程管理</h1><p style={subtleStyle}>维护课程、授课老师、授课计划、学习进度和报名学生。</p></div></div>
      <div style={toolbarStyle}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索课程编号、名称或老师" style={searchStyle} />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={selectStyle}><option value="all">全部状态</option><option value="pending">未开始</option><option value="active">进行中</option><option value="paused">暂停中</option><option value="inactive">已结束</option></select>
        <button type="button" onClick={openCreate} style={primaryButtonStyle}>＋ 新增课程</button>
      </div>
      <DataTable columns={columns} rows={displayedCourses} getRowId={(course) => course.id} emptyMessage="暂无符合条件的课程。" />

      <Drawer open={drawerOpen} title={editingCourse ? `编辑课程 · ${editingCourse.name}` : '新增课程'} onClose={closeDrawer} full={Boolean(editingCourse)}>
        <form onSubmit={handleSubmit} style={editingCourse ? editLayoutStyle : formStyle}>
          <div style={formPanelStyle}>
            <p style={sectionCaptionStyle}>{editingCourse ? `课程编号：${editingCourse.code}` : '课程编号将在创建后自动生成。'}</p>
            <label style={labelStyle}>课程名称<input value={form.name} onChange={(event) => updateField('name', event.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>授课老师<input value={form.teacherName} onChange={(event) => updateField('teacherName', event.target.value)} placeholder="例如：王老师" style={inputStyle} /></label>
            <PlanScheduleEditor value={form.schedule} onChange={(schedule) => updateField('schedule', schedule)} month={calendarMonth} onMonthChange={setCalendarMonth} defaultStartTime={settings.defaultCourseStartTime} defaultEndTime={settings.defaultCourseEndTime} />
            <div style={planSummaryStyle}><span>课时数</span><strong>{normalizeSchedule(form.schedule).length} 节</strong></div>
            {error && <p style={errorStyle}>{error}</p>}
            <div style={submitRowStyle}><button type="button" onClick={closeDrawer} style={secondaryButtonStyle}>取消</button><button type="submit" style={primaryButtonStyle}>{editingCourse ? '保存课程设置' : '确认新增课程'}</button></div>
          </div>
          {editingCourse && <section style={studentPanelStyle}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}><div><h3 style={{ margin: 0 }}>课程学员与学习进度</h3><p style={subtleStyle}>课时按已提交的出勤或迟到记录统计。</p></div><strong style={{ color: '#1d4ed8' }}>{editStudents.length} 名学员</strong></div><div style={{ marginTop: 16 }}><DataTable columns={[{ key: 'studentNo', label: '学号', width: 150, sortValue: (student) => student.studentNo, render: (student) => student.studentNo }, { key: 'name', label: '姓名', width: 130, sortValue: (student) => student.name, render: (student) => <strong>{student.name}</strong> }, { key: 'phone', label: '电话', width: 160, sortValue: (student) => student.phone || '', render: (student) => student.phone || '—' }, { key: 'attended', label: '已上课时', width: 170, sortValue: (student) => student.attended, render: (student) => { const total = getPlannedLessonCount(editingCourse); return <Progress value={total ? Math.round((student.attended / total) * 100) : 0} detail={`${student.attended} / ${total} 节`} /> } }, { key: 'delete', label: '操作', width: 90, render: (student) => <button type="button" onClick={() => setPendingRemoveStudent({ course: editingCourse, student })} style={dangerTextButtonStyle}>删除</button> }]} rows={editStudents} getRowId={(student) => student.id} emptyMessage="当前课程还没有报名学员。" /></div></section>}
        </form>
      </Drawer>

      <Drawer open={Boolean(scheduleDetailCourse)} title={`授课计划 · ${scheduleDetailCourse?.name || ''}`} onClose={() => setScheduleDetailCourse(null)} full>
        {scheduleDetailCourse && <ScheduleDetail course={scheduleDetailCourse} sessions={sessions.filter((session) => session.courseId === scheduleDetailCourse.id)} month={detailCalendarMonth} onMonthChange={setDetailCalendarMonth} />}
      </Drawer>

      <ConfirmDialog open={Boolean(statusTarget)} title={getStatusDialog(statusTarget).title} description={getStatusDialog(statusTarget).description} confirmText={getStatusDialog(statusTarget).confirmText} tone="primary" onCancel={() => setStatusTarget(null)} onConfirm={confirmStatusChange} />
      <ConfirmDialog open={Boolean(pendingDelete)} title="确认删除课程" description={enrolledCount ? `课程“${pendingDelete?.name}”仍有 ${enrolledCount} 名已报名学生。请先在学生管理中移除全部报名学生，再删除课程。` : `确定删除课程“${pendingDelete?.name}”吗？此操作不可撤销。`} confirmText="确认删除" hideConfirm={Boolean(enrolledCount)} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />
      <ConfirmDialog open={Boolean(pendingRemoveStudent)} title="确认移出课程" description={`确定将“${pendingRemoveStudent?.student.name}”从“${pendingRemoveStudent?.course.name}”中删除吗？该课程下已有点名记录会同步移除。`} confirmText="确认删除" onCancel={() => setPendingRemoveStudent(null)} onConfirm={confirmRemoveStudent} />
    </section>
  )
}

function CourseActions({ course, onEdit, onStatusChange, onDelete }) {
  return (
    <div style={actionStyle}>
      <button type="button" onClick={() => onEdit(course)} style={textButtonStyle}>{course.status === 'inactive' ? '延期' : '编辑'}</button>
      {course.status === 'active' && <button type="button" onClick={() => onStatusChange('paused')} style={textButtonStyle}>暂停</button>}
      {course.status === 'paused' && <button type="button" onClick={() => onStatusChange('active')} style={textButtonStyle}>恢复</button>}
      {course.status !== 'inactive' && course.status !== 'pending' && <button type="button" onClick={() => onStatusChange('inactive')} style={textButtonStyle}>结束</button>}
      <button type="button" onClick={() => onDelete(course)} style={dangerTextButtonStyle}>删除</button>
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'pending') return <span style={pendingBadgeStyle}>未开始</span>
  if (status === 'paused') return <span style={pausedBadgeStyle}>暂停中</span>
  if (status === 'inactive') return <span style={inactiveBadgeStyle}>已结束</span>
  return <span style={activeBadgeStyle}>进行中</span>
}

function getStatusDialog(target) {
  if (!target) return { title: '', description: '', confirmText: '' }
  const { course, nextStatus } = target
  if (nextStatus === 'paused') {
    return {
      title: '暂停课程',
      description: `确认将“${course.name}”标记为暂停中吗？已报名学生、授课计划和历史点名记录都会保留。`,
      confirmText: '确认暂停',
    }
  }
  if (nextStatus === 'inactive') {
    return {
      title: '结束课程',
      description: `确认将“${course.name}”标记为已结束吗？结束后不再作为进行中课程用于新增报名。`,
      confirmText: '确认结束',
    }
  }
  return {
    title: '恢复课程',
    description: `确认将“${course.name}”恢复为进行中吗？恢复后可继续作为进行中课程使用。`,
    confirmText: '确认恢复',
  }
}

function ScheduleDetail({ course, sessions, month, onMonthChange }) {
  const schedule = normalizeSchedule(course.schedule)
  const selectedDates = new Set(schedule.map((item) => item.date))
  const completedDates = new Set(sessions.map((session) => session.date))
  const days = getMonthDays(month)

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={planSummaryPanelStyle}>
        <div><span style={{ color: '#64748b', fontSize: 13 }}>课程编号</span><strong style={detailMetricValueStyle}>{course.code}</strong></div>
        <div><span style={{ color: '#64748b', fontSize: 13 }}>计划时间</span><strong style={detailMetricValueStyle}>{formatScheduleRange(course, sessions)}</strong></div>
        <div><span style={{ color: '#64748b', fontSize: 13 }}>计划课时</span><strong style={detailMetricValueStyle}>{schedule.length} 节</strong></div>
      </section>
      <section style={plannerStyle}>
        <div style={plannerHeaderStyle}>
          <div><strong>授课日历</strong></div>
          <div style={monthControlsStyle}>
            <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} style={monthButtonStyle}>上月</button>
            <strong style={{ color: '#1d4ed8' }}>{month}</strong>
            <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} style={monthButtonStyle}>下月</button>
          </div>
        </div>
        <div style={calendarStyle}>
          {weekLabels.map((label) => <span key={label} style={weekLabelStyle}>{label}</span>)}
          {days.map((day) => day.blank
            ? <span key={day.key} />
            : <span key={day.date} style={selectedDates.has(day.date) ? readOnlySelectedDayStyle : readOnlyDayStyle}>{day.day}</span>)}
        </div>
      </section>
      <section style={detailListStyle}>
        {schedule.length === 0 ? <p style={{ margin: 0, color: '#94a3b8' }}>该课程还没有维护授课计划。</p> : schedule.map((item, index) => (
          <div key={item.date} style={detailPlanRowStyle}>
            <span style={lessonIndexStyle}>第 {index + 1} 次</span>
            <strong>{item.date}</strong>
            <span>{item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : '未设置时间'}</span>
            <span style={completedDates.has(item.date) ? completedBadgeStyle : pendingLessonBadgeStyle}>{completedDates.has(item.date) ? '已进行' : '未进行'}</span>
          </div>
        ))}
      </section>
    </div>
  )
}

function PlanScheduleEditor({ value, onChange, month, onMonthChange, defaultStartTime, defaultEndTime }) {
  const schedule = normalizeSchedule(value)
  const selectedDates = new Set(schedule.map((item) => item.date))
  const days = getMonthDays(month)

  const toggleDate = (date) => {
    if (selectedDates.has(date)) {
      onChange(schedule.filter((item) => item.date !== date))
      return
    }
    onChange(normalizeSchedule([...schedule, { date, startTime: defaultStartTime || '09:00', endTime: defaultEndTime || '12:00' }]))
  }

  const updatePlan = (date, field, fieldValue) => {
    onChange(schedule.map((item) => item.date === date ? { ...item, [field]: fieldValue } : item))
  }

  return (
    <section style={plannerStyle}>
      <div style={plannerHeaderStyle}>
        <div><strong>授课计划时间</strong></div>
        <div style={monthControlsStyle}>
          <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} style={monthButtonStyle}>上月</button>
          <strong style={{ color: '#1d4ed8' }}>{month}</strong>
          <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} style={monthButtonStyle}>下月</button>
        </div>
      </div>
      <div style={calendarStyle}>
        {weekLabels.map((label) => <span key={label} style={weekLabelStyle}>{label}</span>)}
        {days.map((day) => day.blank
          ? <span key={day.key} />
          : <button key={day.date} type="button" onClick={() => toggleDate(day.date)} style={selectedDates.has(day.date) ? selectedDayStyle : dayButtonStyle}>{day.day}</button>)}
      </div>
      <div style={selectedListStyle}>
        {schedule.length === 0 ? <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>还没有选择上课日期。</p> : schedule.map((item) => (
          <div key={item.date} style={planRowStyle}>
            <strong style={{ color: '#334155' }}>{item.date}</strong>
            <input type="time" value={item.startTime} onChange={(event) => updatePlan(item.date, 'startTime', event.target.value)} style={timeInputStyle} />
            <span style={{ color: '#94a3b8' }}>至</span>
            <input type="time" value={item.endTime} onChange={(event) => updatePlan(item.date, 'endTime', event.target.value)} style={timeInputStyle} />
            <button type="button" onClick={() => toggleDate(item.date)} style={removePlanButtonStyle}>移除</button>
          </div>
        ))}
      </div>
    </section>
  )
}

function getMonthDays(month) {
  const [year, monthIndex] = month.split('-').map(Number)
  const first = new Date(year, monthIndex - 1, 1)
  const last = new Date(year, monthIndex, 0)
  const blanks = Array.from({ length: first.getDay() }, (_, index) => ({ blank: true, key: `blank-${index}` }))
  const days = Array.from({ length: last.getDate() }, (_, index) => {
    const day = index + 1
    const date = `${year}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { date, day }
  })
  return [...blanks, ...days]
}

function shiftMonth(month, offset) {
  const [year, monthIndex] = month.split('-').map(Number)
  const date = new Date(year, monthIndex - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function Progress({ value, detail }) {
  return <div style={{ width: 150, maxWidth: '100%' }}><div style={progressTrackStyle}><span style={{ ...progressFillStyle, width: `${Math.max(0, Math.min(100, value))}%` }} /></div><span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 5 }}>{detail} · {value}%</span></div>
}

const pageHeaderStyle = { marginBottom: 20 }
const titleStyle = { margin: '5px 0 0', fontSize: 30, letterSpacing: '-.03em' }
const subtleStyle = { margin: '7px 0 0', color: '#64748b', fontSize: 14 }
const toolbarStyle = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 16, padding: 4 }
const searchStyle = { boxSizing: 'border-box', flex: '1 1 340px', minWidth: 280, height: 42, padding: '0 13px', border: '1px solid #d8e2f0', outline: 'none', borderRadius: 10, background: '#fff', color: '#334155' }
const selectStyle = { flex: '0 0 132px', height: 42, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, background: '#fff', color: '#334155' }
const primaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#2563eb', color: '#fff', fontWeight: 750, whiteSpace: 'nowrap', boxShadow: '0 5px 14px rgba(37, 99, 235, .2)' }
const secondaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#eef2f7', color: '#475569', fontWeight: 700 }
const actionStyle = { display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }
const textButtonStyle = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, padding: '5px 6px' }
const dangerTextButtonStyle = { ...textButtonStyle, color: '#dc2626' }
const codeStyle = { color: '#475569', fontVariantNumeric: 'tabular-nums' }
const pendingBadgeStyle = { display: 'inline-block', color: '#075985', background: '#e0f2fe', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const activeBadgeStyle = { display: 'inline-block', color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const inactiveBadgeStyle = { display: 'inline-block', color: '#9a3412', background: '#fff1df', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const pausedBadgeStyle = { display: 'inline-block', color: '#b91c1c', background: '#fee2e2', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const formStyle = { display: 'grid', gap: 16 }
const editLayoutStyle = { display: 'grid', gridTemplateColumns: 'minmax(360px, .78fr) minmax(0, 1.4fr)', gap: 24, alignItems: 'start' }
const formPanelStyle = { display: 'grid', gap: 16, padding: 22, borderRadius: 16, background: '#f8fafc' }
const studentPanelStyle = { minWidth: 0, padding: 22, borderRadius: 16, background: '#f8fafc' }
const sectionCaptionStyle = { margin: 0, color: '#64748b', fontSize: 14 }
const labelStyle = { display: 'grid', gap: 7, color: '#475569', fontSize: 14, fontWeight: 650 }
const inputStyle = { boxSizing: 'border-box', width: '100%', height: 43, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, background: '#fff', color: '#1e293b', font: 'inherit', fontWeight: 400 }
const submitRowStyle = { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6, flexWrap: 'wrap' }
const errorStyle = { margin: 0, color: '#dc2626', fontSize: 14 }
const progressTrackStyle = { height: 7, background: '#e5edf8', borderRadius: 999, overflow: 'hidden' }
const progressFillStyle = { display: 'block', height: '100%', background: 'linear-gradient(90deg, #2563eb, #4f46e5)', borderRadius: 999 }
const planSummaryPanelStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, padding: 16, borderRadius: 14, background: '#f8fafc' }
const detailMetricValueStyle = { display: 'block', marginTop: 6, color: '#1e293b', fontSize: 18 }
const plannerStyle = { padding: 16, borderRadius: 14, background: '#fff', border: '1px solid #e6edf7' }
const plannerHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }
const monthControlsStyle = { display: 'flex', alignItems: 'center', gap: 8 }
const monthButtonStyle = { border: 0, borderRadius: 9, padding: '7px 10px', background: '#eef2ff', color: '#3730a3', fontWeight: 750 }
const calendarStyle = { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 7, marginTop: 14 }
const weekLabelStyle = { textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: 800 }
const dayButtonStyle = { height: 36, border: 0, borderRadius: 10, background: '#f1f5f9', color: '#475569', fontWeight: 750 }
const selectedDayStyle = { ...dayButtonStyle, background: '#2563eb', color: '#fff', boxShadow: '0 5px 14px rgba(37, 99, 235, .22)' }
const readOnlyDayStyle = { height: 36, display: 'grid', placeItems: 'center', borderRadius: 10, background: '#f1f5f9', color: '#475569', fontWeight: 750 }
const readOnlySelectedDayStyle = { ...readOnlyDayStyle, background: '#2563eb', color: '#fff', boxShadow: '0 5px 14px rgba(37, 99, 235, .22)' }
const selectedListStyle = { display: 'grid', gap: 9, marginTop: 14, maxHeight: 280, overflowY: 'auto', overscrollBehavior: 'contain' }
const detailListStyle = { display: 'grid', gap: 9, maxHeight: 420, overflowY: 'auto', overscrollBehavior: 'contain' }
const detailPlanRowStyle = { display: 'grid', gridTemplateColumns: '86px minmax(130px, 1fr) minmax(120px, 1fr) 86px', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, background: '#f8fafc', color: '#475569' }
const lessonIndexStyle = { color: '#1d4ed8', fontWeight: 800, fontSize: 13 }
const completedBadgeStyle = { justifySelf: 'start', color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const pendingLessonBadgeStyle = { justifySelf: 'start', color: '#64748b', background: '#e2e8f0', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const planRowStyle = { display: 'grid', gridTemplateColumns: '1fr 104px 22px 104px auto', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, background: '#f8fafc' }
const timeInputStyle = { height: 36, padding: '0 8px', border: '1px solid #d8e2f0', borderRadius: 9, background: '#fff', color: '#334155' }
const removePlanButtonStyle = { border: 0, borderRadius: 9, padding: '8px 10px', color: '#b91c1c', background: '#fee2e2', fontWeight: 750 }
const planSummaryStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#eff6ff', color: '#475569' }
