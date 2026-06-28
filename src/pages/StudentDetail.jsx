import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import DataTable from '../components/DataTable'
import {
  getPlanForDate,
  getPlannedLessonCount,
} from '../utils/courseSchedule'
import {
  getAttendance,
  getCourses,
  getCurrentRole,
  getEnrollments,
  getSessions,
  getStudents,
  getTeachers,
} from '../utils/storage'

const statusLabels = { present: '出勤', late: '迟到', absent: '缺勤' }

export default function StudentDetail({ dataVersion }) {
  void dataVersion
  const { id } = useParams()
  const location = useLocation()
  const [selectedStatus, setSelectedStatus] = useState(() => location.state?.highlightStatus || null)
  const [activeHighlightId, setActiveHighlightId] = useState('')
  const [shareMessage, setShareMessage] = useState(false)
  const student = getStudents().find((item) => item.id === id)
  const currentRole = getCurrentRole()
  const teacher = currentRole.role === 'teacher'
    ? getTeachers().find((item) => item.id === currentRole.userId)
    : null
  const courses = getCourses()
  const allEnrollments = getEnrollments()
  const sessions = getSessions()
  const attendance = getAttendance()
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const highlightRecordId = location.state?.highlightRecordId || ''
  const backPath = location.state?.from || (currentRole.role === 'teacher' ? '/my-students' : '/students')
  const backLabel = location.state?.label || '返回学生列表'
  const canViewStudent = currentRole.role === 'admin' || allEnrollments.some(
    (enrollment) => enrollment.studentId === id && teacher?.courseIds.includes(enrollment.courseId),
  )
  const enrollments = student ? allEnrollments.filter((enrollment) => enrollment.studentId === student.id) : []
  const records = student ? attendance
    .filter((record) => record.studentId === student.id)
    .map((record) => ({ record, session: sessionById.get(record.sessionId) }))
    .filter((item) => item.session && (currentRole.role === 'admin' || teacher?.courseIds.includes(item.session.courseId)))
    .sort((a, b) => b.session.date.localeCompare(a.session.date)) : []
  const highlightedRecord = highlightRecordId ? records.find(({ record }) => record.id === highlightRecordId) : null
  const highlightedRecordStatus = highlightedRecord?.record.status || ''

  useEffect(() => {
    if (!highlightRecordId || !highlightedRecordStatus) return undefined
    const frameId = window.requestAnimationFrame(() => {
      setActiveHighlightId(highlightRecordId)
      document.getElementById(`attendance-record-${highlightRecordId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    const timerId = window.setTimeout(() => setActiveHighlightId(''), 2000)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timerId)
    }
  }, [highlightRecordId, highlightedRecordStatus])

  if (!student || !canViewStudent) {
    return <section><h1>学生详情</h1><p style={{ color: '#64748b' }}>未找到该学生，或当前账号没有访问权限。</p><Link to={backPath} style={backLinkStyle}>{backLabel}</Link></section>
  }
  const presentCount = records.filter(({ record }) => record.status === 'present').length
  const lateCount = records.filter(({ record }) => record.status === 'late').length
  const absentCount = records.filter(({ record }) => record.status === 'absent').length
  const attendanceRate = records.length ? Math.round(((presentCount + lateCount) / records.length) * 100) : 0

  const courseCards = enrollments
    .map((enrollment) => {
      const course = courseById.get(enrollment.courseId)
      if (!course || (currentRole.role === 'teacher' && !teacher?.courseIds.includes(course.id))) return null
      const courseSessions = sessions.filter((session) => session.courseId === course.id)
      const courseRecords = records.filter(({ session }) => session.courseId === course.id)
      const usedCredits = courseRecords.filter(({ record }) => ['present', 'late'].includes(record.status)).length
      const plannedCount = getPlannedLessonCount(course)
      const progress = plannedCount ? Math.min(100, Math.round((usedCredits / plannedCount) * 100)) : 0
      return { enrollment, course, courseSessions, usedCredits, plannedCount, progress }
    })
    .filter(Boolean)
  const filteredStatusRecords = selectedStatus
    ? records.filter(({ record }) => record.status === selectedStatus)
    : []

  return (
    <section>
      <div style={topRowStyle}>
        <Link to={backPath} style={backLinkStyle}>{backLabel}</Link>
        <div style={topActionStyle}>{currentRole.role === 'admin' && <span style={adminHintStyle}>管理员可在学生管理中编辑学生资料与报名课程</span>}<button type="button" onClick={() => setShareMessage(true)} style={shareButtonStyle}>分享</button></div>
      </div>
      <section style={heroStyle}>
        <div><p style={eyebrowStyle}>学生学习档案</p><h1 style={{ margin: '5px 0 0', fontSize: 30 }}>{student.name}</h1><p style={subtleStyle}>{student.studentNo} · {student.phone || '未填写电话'}</p></div>
        <div style={heroProgressStyle}><span style={{ color: '#dbeafe', fontSize: 13 }}>整体出勤率</span><strong style={{ display: 'block', marginTop: 4, fontSize: 36 }}>{attendanceRate}%</strong><Progress value={attendanceRate} color="#93c5fd" track="#315fb5" /></div>
      </section>

      <div style={metricGridStyle}>
        <Metric label="报名课程" value={`${courseCards.length} 门`} />
        <Metric label="总课时" value={`${student.totalCredits} 节`} />
        <Metric label="已上课时" value={`${student.usedCredits} 节`} />
        <Metric label="剩余课时" value={`${Math.max(0, student.totalCredits - student.usedCredits)} 节`} />
      </div>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}><div><h2 style={headingStyle}>学习进度</h2><p style={subtleStyle}>按每门课程的已提交出勤和迟到记录汇总。</p></div></div>
        {courseCards.length === 0 ? <p style={emptyTextStyle}>暂无可查看的报名课程。</p> : <div style={courseGridStyle}>{courseCards.map(({ enrollment, course, usedCredits, progress, courseSessions, plannedCount }) => <article key={enrollment.id} style={courseCardStyle}><div style={sectionHeaderStyle}><div><strong>{course.name}</strong><span style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: 13 }}>{course.code} · {getCourseStatusLabel(course.status)}</span></div><strong style={{ color: '#1d4ed8' }}>{progress}%</strong></div><div style={{ marginTop: 16 }}><Progress value={progress} color="#2563eb" /><div style={courseNumbersStyle}><span>已上 {usedCredits} 节</span><span>计划 {plannedCount} 节</span><span>已开 {courseSessions.length} 节</span></div></div></article>)}</div>}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}><div><h2 style={headingStyle}>出勤情况</h2><p style={subtleStyle}>以提交到机构数据的课堂记录为准。</p></div><strong style={{ color: '#1d4ed8', fontSize: 24 }}>{attendanceRate}%</strong></div>
        <div style={attendanceGridStyle}>
          <AttendanceMetric label="出勤" status="present" value={presentCount} total={records.length} color="#16a34a" active={selectedStatus === 'present'} onClick={setSelectedStatus} />
          <AttendanceMetric label="迟到" status="late" value={lateCount} total={records.length} color="#d97706" active={selectedStatus === 'late'} onClick={setSelectedStatus} />
          <AttendanceMetric label="缺勤" status="absent" value={absentCount} total={records.length} color="#dc2626" active={selectedStatus === 'absent'} onClick={setSelectedStatus} />
        </div>
        {selectedStatus && <div style={statusDetailStyle}>
          <div style={sectionHeaderStyle}><div><h3 style={{ margin: 0 }}>{statusLabels[selectedStatus]}明细</h3><p style={subtleStyle}>点击上方数字可切换状态；再次点击当前状态可收起。</p></div><button type="button" onClick={() => setSelectedStatus(null)} style={smallButtonStyle}>收起明细</button></div>
          <div style={{ marginTop: 14 }}><DataTable columns={[
            { key: 'date', label: '日期', width: 150, sortValue: (item) => item.session.date, render: (item) => item.session.date },
            { key: 'time', label: '上课时间', width: 150, sortValue: (item) => getPlanForDate(courseById.get(item.session.courseId), item.session.date)?.startTime || '', render: (item) => { const plan = getPlanForDate(courseById.get(item.session.courseId), item.session.date); return plan?.startTime && plan?.endTime ? `${plan.startTime}-${plan.endTime}` : '—' } },
            { key: 'course', label: '课程', width: 240, sortValue: (item) => courseById.get(item.session.courseId)?.name || '', render: (item) => <strong>{courseById.get(item.session.courseId)?.name || '未找到课程'}</strong> },
            { key: 'status', label: '状态', width: 130, sortValue: (item) => item.record.status, render: (item) => <StatusBadge status={item.record.status} /> },
          ]} rows={filteredStatusRecords} getRowId={(item) => item.record.id} getRowDomId={(item) => `attendance-record-${item.record.id}`} getRowStyle={(item) => item.record.id === activeHighlightId ? highlightRowStyle : null} emptyMessage={`暂无${statusLabels[selectedStatus]}记录。`} /></div>
        </div>}
      </section>

      <ConfirmDialog open={shareMessage} title="分享学生档案" description="分享入口已创建，后续接入权限与链接生成后，可转发给家长或老师查看。" cancelText="知道了" hideConfirm tone="primary" onCancel={() => setShareMessage(false)} />
    </section>
  )
}

function Metric({ label, value }) { return <article style={metricStyle}><span style={{ color: '#64748b', fontSize: 13 }}>{label}</span><strong style={{ display: 'block', marginTop: 7, fontSize: 27 }}>{value}</strong></article> }
function AttendanceMetric({ label, status, value, total, color, active, onClick }) { const percent = total ? Math.round((value / total) * 100) : 0; return <button type="button" onClick={() => onClick(active ? null : status)} style={{ ...attendanceMetricStyle, boxShadow: active ? `0 0 0 2px ${color}33` : 'none' }}><div style={sectionHeaderStyle}><span style={{ color: '#475569', fontWeight: 700 }}>{label}</span><strong style={{ fontSize: 22 }}>{value}</strong></div><div style={{ marginTop: 12 }}><Progress value={percent} color={color} /><span style={{ display: 'block', marginTop: 6, color: '#64748b', fontSize: 12 }}>{percent}% · 共 {total} 次记录</span></div></button> }
function StatusBadge({ status }) { const style = status === 'present' ? presentBadgeStyle : status === 'late' ? lateBadgeStyle : absentBadgeStyle; return <span style={style}>{statusLabels[status] || status}</span> }
function getCourseStatusLabel(status) { return status === 'pending' ? '未开始' : status === 'active' ? '进行中' : status === 'paused' ? '暂停中' : '已结束' }
function Progress({ value, color, track = '#e5edf8' }) { return <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: track }}><span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, borderRadius: 999, background: color }} /></div> }

const topRowStyle = { display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }
const topActionStyle = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }
const backLinkStyle = { color: '#1d4ed8', textDecoration: 'none', fontWeight: 800, padding: '9px 13px', borderRadius: 10, background: '#dbeafe' }
const adminHintStyle = { padding: '6px 10px', borderRadius: 999, color: '#475569', background: '#eaf0f7', fontSize: 12, fontWeight: 700 }
const shareButtonStyle = { border: 0, borderRadius: 10, padding: '9px 14px', background: '#2563eb', color: '#fff', fontWeight: 800, boxShadow: '0 5px 14px rgba(37, 99, 235, .2)' }
const heroStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: '26px 28px', borderRadius: 18, color: '#fff', background: 'linear-gradient(125deg, #1d4ed8, #4338ca)' }
const eyebrowStyle = { margin: 0, color: '#bfdbfe', fontSize: 13, fontWeight: 800, letterSpacing: '.08em' }
const subtleStyle = { margin: '7px 0 0', color: '#64748b', fontSize: 14 }
const heroProgressStyle = { width: 'min(100%, 270px)', padding: '15px 18px', borderRadius: 14, background: 'rgba(255,255,255,.12)' }
const metricGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginTop: 18 }
const metricStyle = { padding: 18, borderRadius: 14, background: '#fff', boxShadow: '0 6px 20px rgba(15, 23, 42, .05)' }
const cardStyle = { marginTop: 20, padding: 22, borderRadius: 16, background: '#fff', boxShadow: '0 6px 20px rgba(15, 23, 42, .05)' }
const sectionHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 14, flexWrap: 'wrap' }
const headingStyle = { margin: 0, fontSize: 19 }
const emptyTextStyle = { color: '#64748b' }
const courseGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginTop: 16 }
const courseCardStyle = { padding: 17, borderRadius: 13, background: '#f8fafc' }
const courseNumbersStyle = { display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 8, color: '#64748b', fontSize: 12 }
const attendanceGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginTop: 16 }
const attendanceMetricStyle = { padding: 16, border: 0, borderRadius: 13, background: '#f8fafc', textAlign: 'left', color: 'inherit' }
const statusDetailStyle = { marginTop: 16, padding: 16, borderRadius: 14, background: '#f8fafc' }
const highlightRowStyle = { background: '#eff6ff', boxShadow: 'inset 4px 0 0 #2563eb' }
const smallButtonStyle = { border: 0, borderRadius: 10, padding: '8px 12px', color: '#475569', background: '#eaf0f7', fontWeight: 750 }
const presentBadgeStyle = { display: 'inline-block', padding: '4px 9px', borderRadius: 999, color: '#166534', background: '#dcfce7', fontSize: 12, fontWeight: 700 }
const lateBadgeStyle = { display: 'inline-block', padding: '4px 9px', borderRadius: 999, color: '#9a3412', background: '#fff1df', fontSize: 12, fontWeight: 700 }
const absentBadgeStyle = { display: 'inline-block', padding: '4px 9px', borderRadius: 999, color: '#b91c1c', background: '#fee2e2', fontSize: 12, fontWeight: 700 }
