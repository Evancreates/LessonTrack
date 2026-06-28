import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  isPlannedDate,
} from '../utils/courseSchedule'
import {
  getAttendance,
  getCourses,
  getEnrollments,
  getSessions,
  getStudents,
} from '../utils/storage'

const today = () => new Date().toISOString().split('T')[0]

export default function Dashboard({ dataVersion, onDataChange }) {
  const [refreshSummary, setRefreshSummary] = useState(null)
  const [courseSearch, setCourseSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshBaseline, setRefreshBaseline] = useState(null)
  const [progressBandTarget, setProgressBandTarget] = useState(null)
  void dataVersion
  const students = getStudents()
  const courses = getCourses()
  const enrollments = getEnrollments()
  const sessions = getSessions()
  const attendance = getAttendance()
  const totalCredits = students.reduce((total, student) => total + Number(student.totalCredits || 0), 0)
  const usedCredits = students.reduce((total, student) => total + Number(student.usedCredits || 0), 0)
  const remainingCredits = totalCredits - usedCredits
  const attendedRecords = attendance.filter((record) => record.status === 'present' || record.status === 'late').length
  const attendanceRate = attendance.length ? Math.round((attendedRecords / attendance.length) * 100) : 0
  const sessionByCourseId = new Map(courses.map((course) => [course.id, sessions.filter((session) => session.courseId === course.id)]))
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const studentProgress = students.map((student) => {
    const progress = student.totalCredits ? Math.min(100, Math.round((student.usedCredits / student.totalCredits) * 100)) : 0
    const studentRecords = attendance.filter((record) => record.studentId === student.id)
    const studentAttendance = studentRecords.length
      ? Math.round((studentRecords.filter((record) => ['present', 'late'].includes(record.status)).length / studentRecords.length) * 100)
      : 0
    const courseNames = enrollments
      .filter((enrollment) => enrollment.studentId === student.id)
      .map((enrollment) => courseById.get(enrollment.courseId)?.name)
      .filter(Boolean)
      .join('、')
    return { student, progress, attendance: studentAttendance, hasRecords: studentRecords.length > 0, courseNames }
  })
  const learningBands = [
    { label: '进度 0–29%', students: studentProgress.filter((item) => item.progress < 30), color: '#94a3b8' },
    { label: '进度 30–69%', students: studentProgress.filter((item) => item.progress >= 30 && item.progress < 70), color: '#f59e0b' },
    { label: '进度 70–100%', students: studentProgress.filter((item) => item.progress >= 70), color: '#2563eb' },
  ].map((band) => ({ ...band, count: band.students.length }))
  const averageStudentProgress = studentProgress.length ? Math.round(studentProgress.reduce((total, item) => total + item.progress, 0) / studentProgress.length) : 0
  const averageStudentAttendance = studentProgress.filter((item) => item.hasRecords).length
    ? Math.round(studentProgress.filter((item) => item.hasRecords).reduce((total, item) => total + item.attendance, 0) / studentProgress.filter((item) => item.hasRecords).length)
    : 0
  const currentCounts = {
    students: students.length,
    courses: courses.length,
    enrollments: enrollments.length,
    sessions: sessions.length,
    attendance: attendance.length,
  }
  const teacherOptions = [...new Set(courses.map((course) => course.teacherName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const courseRows = courses.map((course) => {
    const courseSessions = sessionByCourseId.get(course.id) || []
    const plannedCount = getPlannedLessonCount(course)
    const progress = plannedCount ? Math.min(100, Math.round((courseSessions.length / plannedCount) * 100)) : 0
    return {
      course,
      studentCount: enrollments.filter((enrollment) => enrollment.courseId === course.id).length,
      startDate: getScheduleStart(course, courseSessions),
      endDate: getScheduleEnd(course, courseSessions),
      sessionCount: courseSessions.length,
      plannedCount,
      progress,
    }
  })
  const overallCourseProgress = courseRows.length
    ? Math.round(courseRows.reduce((total, row) => total + row.progress, 0) / courseRows.length)
    : 0
  const activeCourseCount = courses.filter((course) => course.status === 'active').length
  const completedCourseCount = courses.filter((course) => course.status === 'inactive').length
  const pausedCourseCount = courses.filter((course) => course.status === 'paused').length
  const courseKeyword = courseSearch.trim().toLowerCase()
  const displayedCourseRows = courseRows.filter((row) => (
    (courseFilter === 'all' || row.course.id === courseFilter)
    && (teacherFilter === 'all' || row.course.teacherName === teacherFilter)
    && (statusFilter === 'all' || row.course.status === statusFilter)
    && (!courseKeyword || row.course.name.toLowerCase().includes(courseKeyword) || row.course.code.toLowerCase().includes(courseKeyword) || (row.course.teacherName || '').toLowerCase().includes(courseKeyword))
  ))
  const showRefreshFeedback = () => {
    onDataChange()
    const previous = refreshBaseline || currentCounts
    const added = {
      students: Math.max(0, currentCounts.students - previous.students),
      courses: Math.max(0, currentCounts.courses - previous.courses),
      enrollments: Math.max(0, currentCounts.enrollments - previous.enrollments),
      sessions: Math.max(0, currentCounts.sessions - previous.sessions),
      attendance: Math.max(0, currentCounts.attendance - previous.attendance),
    }
    setRefreshBaseline(currentCounts)
    setRefreshSummary(added)
  }

  return (
    <section>
      <div style={headerStyle}>
        <div>
          <h1 style={dashboardTitleStyle}>数据中心</h1>
        </div>
        <button type="button" onClick={showRefreshFeedback} style={primaryButtonStyle}>刷新数据</button>
      </div>

      <div style={metricGridStyle}>
        <MetricCard label="学生总数" value={students.length} hint="全机构在读学生" />
        <MetricCard label="总课时数" value={totalCredits} hint="全部报名课时" />
        <MetricCard label="今日课程数" value={courses.filter((course) => isPlannedDate(course, today())).length} hint="按课程计划统计" />
        <MetricCard label="已进行课时" value={usedCredits} hint="出勤与迟到均计入课时" />
        <MetricCard label="剩余课时" value={remainingCredits} hint="待完成学习计划" />
        <MetricCard label="整体出勤率" value={`${attendanceRate}%`} hint="出勤与迟到占比" />
      </div>

      <div style={overviewGridStyle}>
        <section style={{ ...panelStyle, background: '#f8fbff' }}>
          <div style={panelHeadingStyle}><div><h2 style={panelTitleStyle}>总体课程进度</h2><p style={subtleStyle}>按每门课程的已进行课堂与计划课时汇总</p></div><strong style={{ fontSize: 30, color: '#1d4ed8' }}>{`${overallCourseProgress}%`}</strong></div>
          <ProgressBar value={overallCourseProgress} color="#2563eb" height={16} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginTop: 20 }}>
            <MiniMetric label="课程总计" value={`${courses.length} 门`} />
            <MiniMetric label="进行中课程" value={`${activeCourseCount} 门`} />
            <MiniMetric label="已结束课程" value={`${completedCourseCount} 门`} />
            <MiniMetric label="暂停中课程" value={`${pausedCourseCount} 门`} />
          </div>
        </section>

        <section style={{ ...panelStyle, background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)' }}>
          <div style={panelHeadingStyle}><div><h2 style={panelTitleStyle}>出勤质量</h2><p style={subtleStyle}>以已提交考勤为统计口径</p></div><strong style={{ fontSize: 30, color: '#15803d', whiteSpace: 'nowrap' }}>{`${attendanceRate}%`}</strong></div>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <AttendanceLine label="出勤" value={attendance.filter((record) => record.status === 'present').length} total={attendance.length} color="#16a34a" />
            <AttendanceLine label="迟到" value={attendance.filter((record) => record.status === 'late').length} total={attendance.length} color="#d97706" />
            <AttendanceLine label="缺勤" value={attendance.filter((record) => record.status === 'absent').length} total={attendance.length} color="#dc2626" />
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, marginTop: 20, background: '#fffdf7' }}>
        <div style={panelHeadingStyle}><div><h2 style={panelTitleStyle}>学生学习概况</h2><p style={subtleStyle}>从学习进度与已提交考勤两条维度观察学生整体状态。</p></div></div>
        <div style={studentOverviewStyle}>
          <div style={studentMetricGridStyle}><MiniMetric label="平均学习进度" value={`${averageStudentProgress}%`} /><MiniMetric label="平均出勤率" value={`${averageStudentAttendance}%`} /><MiniMetric label="尚无考勤记录" value={`${studentProgress.filter((item) => !item.hasRecords).length} 人`} /></div>
          <div style={bandChartStyle}>{learningBands.map((band) => <div key={band.label} style={bandRowStyle}><span style={{ color: '#475569', fontSize: 13 }}>{band.label}</span><ProgressBar value={students.length ? Math.round((band.count / students.length) * 100) : 0} color={band.color} /><strong style={{ textAlign: 'right', color: '#334155', fontSize: 14 }}>{`${band.count} 人`}</strong><button type="button" onClick={() => setProgressBandTarget(band)} style={textButtonStyle}>详情</button></div>)}</div>
        </div>
      </section>

      <section style={{ ...panelStyle, marginTop: 20, background: '#fbfdff' }}>
        <div style={panelHeadingStyle}><div><h2 style={panelTitleStyle}>教师与课程进度</h2><p style={subtleStyle}>按课程查看学生规模、授课老师和课堂推进情况</p></div></div>
        <div style={courseFilterBarStyle}>
          <input value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="搜索课程、编号或老师" style={searchStyle} />
          <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} style={filterSelectStyle}><option value="all">全部课程</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select>
          <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} style={filterSelectStyle}><option value="all">全部老师</option>{teacherOptions.map((teacherName) => <option key={teacherName} value={teacherName}>{teacherName}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={filterSelectStyle}><option value="all">全部状态</option><option value="pending">未开始</option><option value="active">进行中</option><option value="paused">暂停中</option><option value="inactive">已结束</option></select>
        </div>
        <div style={{ marginTop: 16 }}>
          <DataTable columns={[
            { key: 'course', label: '课程', width: 190, sortValue: (row) => row.course.name, render: (row) => <div><strong>{row.course.name}</strong><span style={{ display: 'block', marginTop: 4, color: '#94a3b8', fontSize: 12 }}>{row.course.code}</span></div> },
            { key: 'students', label: '学生数', width: 92, align: 'center', sortValue: (row) => row.studentCount, render: (row) => row.studentCount },
            { key: 'teacher', label: '授课老师', width: 120, sortValue: (row) => row.course.teacherName || '', render: (row) => row.course.teacherName || '未分配' },
            { key: 'startDate', label: '开始时间', width: 145, sortValue: (row) => row.startDate, render: (row) => formatScheduleStart(row.course, sessionByCourseId.get(row.course.id) || []) || '—' },
            { key: 'endDate', label: '结束时间', width: 145, sortValue: (row) => row.endDate, render: (row) => formatScheduleEnd(row.course, sessionByCourseId.get(row.course.id) || []) || '—' },
            { key: 'status', label: '状态', width: 100, sortValue: (row) => getCourseStatusMeta(row.course.status).label, render: (row) => <span style={getCourseStatusMeta(row.course.status).badgeStyle}>{getCourseStatusMeta(row.course.status).label}</span> },
            { key: 'progress', label: '教学进度', width: 190, sortValue: (row) => row.progress, render: (row) => <ProgressBarWithDetail value={row.progress} color={getCourseStatusMeta(row.course.status).progressColor} detail={`${row.sessionCount} / ${row.plannedCount} 课时`} /> },
          ]} rows={displayedCourseRows} getRowId={(row) => row.course.id} emptyMessage="暂无符合条件的课程进度。" />
        </div>
      </section>

      <section style={{ ...panelStyle, marginTop: 20, background: '#f8fbff' }}>
        <div style={panelHeadingStyle}><div><h2 style={panelTitleStyle}>课程运行看板</h2><p style={subtleStyle}>课程从开课至当前课堂的进度概览</p></div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 16 }}>
          {courses.map((course) => {
            const courseSessions = sessionByCourseId.get(course.id) || []
            const plannedCount = getPlannedLessonCount(course)
            const progress = plannedCount ? Math.min(100, Math.round((courseSessions.length / plannedCount) * 100)) : 0
            const statusMeta = getCourseStatusMeta(course.status)
            return <article key={course.id} style={{ ...courseCardStyle, ...statusMeta.cardStyle }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{course.name}</strong><span style={statusMeta.badgeStyle}>{statusMeta.label}</span></div><span style={{ display: 'block', color: '#64748b', marginTop: 5, fontSize: 13 }}>{course.teacherName || '未分配教师'} · {course.code}</span><span style={courseTimeStyle}>{formatScheduleRange(course, courseSessions)}</span><div style={{ marginTop: 14 }}><ProgressBar value={progress} color={statusMeta.progressColor} /><span style={{ display: 'block', marginTop: 6, color: '#64748b', fontSize: 12 }}>{courseSessions.length} / {plannedCount} 课时 · {progress}%</span></div></article>
          })}
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(refreshSummary)}
        title="数据已更新"
        description={refreshSummary ? formatAddedSummary(refreshSummary) : ''}
        cancelText="知道了"
        hideConfirm
        tone="primary"
        onCancel={() => setRefreshSummary(null)}
      />
      <Drawer open={Boolean(progressBandTarget)} title={`${progressBandTarget?.label || ''}学生详情`} onClose={() => setProgressBandTarget(null)} full>
        {progressBandTarget && <DataTable columns={[
          { key: 'studentNo', label: '学号', width: 150, sortValue: (row) => row.student.studentNo, render: (row) => row.student.studentNo },
          { key: 'name', label: '姓名', width: 140, sortValue: (row) => row.student.name, render: (row) => <strong>{row.student.name}</strong> },
          { key: 'progress', label: '学习进度', width: 130, align: 'center', sortValue: (row) => row.progress, render: (row) => `${row.progress}%` },
          { key: 'attendance', label: '出勤率', width: 120, align: 'center', sortValue: (row) => row.attendance, render: (row) => row.hasRecords ? `${row.attendance}%` : '暂无记录' },
          { key: 'courses', label: '报名课程', width: 280, sortValue: (row) => row.courseNames, render: (row) => row.courseNames || '—' },
          { key: 'detail', label: '操作', width: 90, render: (row) => <Link to={`/student/${row.student.id}`} style={linkStyle}>详情</Link> },
        ]} rows={progressBandTarget.students} getRowId={(row) => row.student.id} emptyMessage="暂无学生。" />}
      </Drawer>
    </section>
  )
}

function getCourseStatusMeta(status) {
  if (status === 'pending') {
    return {
      label: '未开始',
      progressColor: '#38bdf8',
      badgeStyle: pendingBadgeStyle,
      cardStyle: pendingCardStyle,
    }
  }
  if (status === 'paused') {
    return {
      label: '暂停中',
      progressColor: '#fca5a5',
      badgeStyle: pausedBadgeStyle,
      cardStyle: pausedCardStyle,
    }
  }
  if (status === 'inactive') {
    return {
      label: '已结束',
      progressColor: '#94a3b8',
      badgeStyle: inactiveBadgeStyle,
      cardStyle: {},
    }
  }
  return {
    label: '进行中',
    progressColor: '#2563eb',
    badgeStyle: activeBadgeStyle,
    cardStyle: {},
  }
}

function formatAddedSummary(summary) {
  const items = [
    ['学生', summary.students, '名'],
    ['课程', summary.courses, '门'],
    ['课程报名', summary.enrollments, '条'],
    ['已进行课堂', summary.sessions, '节'],
    ['点名记录', summary.attendance, '条'],
  ].filter(([, count]) => count > 0)
  if (items.length === 0) return '本次无新增数据。'
  return `本次已新增${items.map(([label, count, unit]) => `${count}${unit}${label}`).join('、')}。`
}

function MetricCard({ label, value, hint }) {
  return <article style={{ background: '#fff', padding: 18, borderRadius: 14, boxShadow: '0 6px 20px rgba(15, 23, 42, 0.05)', borderTop: '4px solid #dbeafe' }}><span style={{ color: '#64748b', fontSize: 14 }}>{label}</span><strong style={{ display: 'block', fontSize: 31, marginTop: 8 }}>{value}</strong><span style={{ color: '#94a3b8', fontSize: 12 }}>{hint}</span></article>
}

function MiniMetric({ label, value }) {
  return <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}><span style={{ display: 'block', color: '#64748b', fontSize: 12 }}>{label}</span><strong style={{ display: 'block', marginTop: 5, fontSize: 22 }}>{value}</strong></div>
}

function AttendanceLine({ label, value, total, color }) {
  const percent = total ? Math.round((value / total) * 100) : 0
  return <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 74px', alignItems: 'center', gap: 10 }}><span style={{ color: '#475569', fontSize: 13 }}>{label}</span><ProgressBar value={percent} color={color} /><span style={{ color: '#64748b', textAlign: 'right', fontSize: 13 }}>{value} · {`${percent}%`}</span></div>
}

function ProgressBar({ value, color, height = 9 }) {
  return <div style={{ height, width: '100%', background: '#e8eef7', borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, background: color, borderRadius: 999 }} /></div>
}

function ProgressBarWithDetail({ value, color, detail }) {
  return <div style={{ width: 150, maxWidth: '100%' }}><ProgressBar value={value} color={color} /><span style={{ display: 'block', marginTop: 6, color: '#64748b', fontSize: 12 }}>{detail} · {value}%</span></div>
}

const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }
const dashboardTitleStyle = { margin: '5px 0 0', fontSize: 30, letterSpacing: '-.03em' }
const metricGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }
const overviewGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginTop: 20 }
const panelStyle = { padding: 20, borderRadius: 14, background: '#fff', boxShadow: '0 6px 20px rgba(15, 23, 42, 0.05)' }
const studentOverviewStyle = { display: 'grid', gridTemplateColumns: 'minmax(260px, .75fr) minmax(320px, 1.25fr)', gap: 24, alignItems: 'center', marginTop: 16 }
const studentMetricGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }
const bandChartStyle = { display: 'grid', gap: 13, padding: 16, borderRadius: 12, background: '#f8fafc' }
const bandRowStyle = { display: 'grid', gridTemplateColumns: '90px 1fr 68px 48px', gap: 10, alignItems: 'center' }
const panelHeadingStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, minWidth: 0 }
const panelTitleStyle = { margin: 0, whiteSpace: 'nowrap' }
const subtleStyle = { color: '#64748b', margin: '6px 0 0', fontSize: 13 }
const courseFilterBarStyle = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', overflowX: 'auto', marginTop: 16, paddingBottom: 2 }
const searchStyle = { boxSizing: 'border-box', flex: '1 1 280px', minWidth: 240, height: 40, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, background: '#fff', color: '#334155', outline: 'none' }
const filterSelectStyle = { flex: '0 0 170px', height: 40, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, background: '#fff', color: '#334155' }
const courseCardStyle = { padding: 15, borderRadius: 12, background: '#f8fafc' }
const pausedCardStyle = { background: '#fff5f5' }
const pendingCardStyle = { background: '#f0f9ff' }
const courseTimeStyle = { display: 'block', marginTop: 8, color: '#475569', fontSize: 12, padding: '6px 8px', borderRadius: 9, background: '#eef4ff' }
const textButtonStyle = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 800, padding: '4px 2px' }
const linkStyle = { color: '#2563eb', textDecoration: 'none', fontWeight: 700, padding: '5px 6px' }
const pendingBadgeStyle = { color: '#075985', background: '#e0f2fe', borderRadius: 999, padding: '3px 8px', fontSize: 12, whiteSpace: 'nowrap' }
const activeBadgeStyle = { color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '3px 8px', fontSize: 12, whiteSpace: 'nowrap' }
const inactiveBadgeStyle = { color: '#475569', background: '#e2e8f0', borderRadius: 999, padding: '3px 8px', fontSize: 12, whiteSpace: 'nowrap' }
const pausedBadgeStyle = { color: '#b91c1c', background: '#fee2e2', borderRadius: 999, padding: '3px 8px', fontSize: 12, whiteSpace: 'nowrap' }
const primaryButtonStyle = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 700, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.24)' }
