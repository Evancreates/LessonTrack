import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import DataTable from '../components/DataTable'
import Drawer from '../components/Drawer'
import {
  formatScheduleRange,
  getPlannedLessonCount,
  getScheduleEnd,
  getScheduleStart,
} from '../utils/courseSchedule'
import {
  getAttendance,
  getCourses,
  getCurrentRole,
  getEnrollments,
  getSessions,
  getStudents,
  getTeachers,
  saveCourses,
} from '../utils/storage'

export default function MyCourses({ dataVersion, onDataChange }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailCourse, setDetailCourse] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  void dataVersion

  const currentRole = getCurrentRole()
  const teacher = getTeachers().find((item) => item.id === currentRole.userId)
  const allCourses = getCourses()
  const allEnrollments = getEnrollments()
  const allStudents = getStudents()
  const allSessions = getSessions()
  const allAttendance = getAttendance()
  const courses = allCourses.filter((course) => teacher?.courseIds.includes(course.id))
  const keyword = search.trim().toLowerCase()

  const courseStats = new Map(courses.map((course) => {
    const sessions = allSessions.filter((session) => session.courseId === course.id)
    const studentIds = new Set(allEnrollments.filter((enrollment) => enrollment.courseId === course.id).map((enrollment) => enrollment.studentId))
    const students = allStudents.filter((student) => studentIds.has(student.id))
    const sessionIds = new Set(sessions.map((session) => session.id))
    const records = allAttendance.filter((record) => sessionIds.has(record.sessionId))
    const present = records.filter((record) => record.status === 'present').length
    const late = records.filter((record) => record.status === 'late').length
    const plannedCount = getPlannedLessonCount(course)
    return [course.id, {
      sessions,
      students,
      sessionIds,
      records,
      plannedCount,
      progress: plannedCount ? Math.min(100, Math.round((sessions.length / plannedCount) * 100)) : 0,
      attendanceRate: records.length ? Math.round(((present + late) / records.length) * 100) : 0,
      startDate: getScheduleStart(course, sessions) || '未设置',
      endDate: getScheduleEnd(course, sessions) || '未设置',
      period: formatScheduleRange(course, sessions),
    }]
  }))

  const displayedCourses = courses.filter((course) => (
    (statusFilter === 'all' || course.status === statusFilter)
    && (!keyword || course.name.toLowerCase().includes(keyword) || course.code.toLowerCase().includes(keyword))
  ))

  const saveStatus = () => {
    if (!statusTarget) return
    saveCourses(allCourses.map((course) => course.id === statusTarget.id
      ? { ...course, status: course.status === 'active' ? 'paused' : 'active' }
      : course))
    setStatusTarget(null)
    onDataChange()
  }

  const columns = [
    { key: 'code', label: '课程编号', width: 130, sortValue: (course) => course.code, render: (course) => <span style={codeStyle}>{course.code}</span> },
    { key: 'name', label: '课程名称', width: 190, sortValue: (course) => course.name, render: (course) => <strong>{course.name}</strong> },
    { key: 'startDate', label: '开始时间', width: 145, sortValue: (course) => courseStats.get(course.id)?.startDate || '', render: (course) => courseStats.get(course.id)?.startDate || '—' },
    { key: 'endDate', label: '结束时间', width: 145, sortValue: (course) => courseStats.get(course.id)?.endDate || '', render: (course) => courseStats.get(course.id)?.endDate || '—' },
    { key: 'progress', label: '教学进度', width: 195, sortValue: (course) => courseStats.get(course.id)?.progress || 0, render: (course) => <Progress value={courseStats.get(course.id)?.progress || 0} detail={`${courseStats.get(course.id)?.sessions.length || 0} / ${courseStats.get(course.id)?.plannedCount || 0} 节`} /> },
    { key: 'students', label: '学生人数', width: 115, align: 'center', sortValue: (course) => courseStats.get(course.id)?.students.length || 0, render: (course) => `${courseStats.get(course.id)?.students.length || 0} 人` },
    { key: 'status', label: '状态', width: 108, align: 'center', sortValue: (course) => course.status, render: (course) => <StatusBadge status={course.status} /> },
    { key: 'actions', label: '操作', width: 210, render: (course) => <div style={actionStyle}><button type="button" onClick={() => setDetailCourse(course)} style={textButtonStyle}>查看学员</button>{['active', 'paused'].includes(course.status) && <button type="button" onClick={() => setStatusTarget(course)} style={textButtonStyle}>{course.status === 'active' ? '暂停课程' : '恢复课程'}</button>}</div> },
  ]

  const detail = detailCourse ? courseStats.get(detailCourse.id) : null

  return (
    <section>
      <div style={pageHeaderStyle}>
        <div><p style={eyebrowStyle}>教师工作台</p><h1 style={titleStyle}>我的课程</h1><p style={subtleStyle}>{teacher ? `${teacher.name}负责的课程、学生与教学进度。` : '未找到当前教师资料。'}</p></div>
      </div>
      <div style={toolbarStyle}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索课程名称或编号" style={searchStyle} />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={selectStyle}><option value="all">全部状态</option><option value="pending">未开始</option><option value="active">进行中</option><option value="paused">暂停中</option><option value="inactive">已结束</option></select>
      </div>
      <DataTable columns={columns} rows={displayedCourses} getRowId={(course) => course.id} emptyMessage="当前没有分配给你的课程。" />

      <Drawer open={Boolean(detailCourse)} title={`课程学员 · ${detailCourse?.name || ''}`} onClose={() => setDetailCourse(null)} full>
        {detail && <div style={{ display: 'grid', gap: 22 }}>
          <div style={metricGridStyle}>
            <Metric label="报名学生" value={`${detail.students.length} 人`} />
            <Metric label="已进行课堂" value={`${detail.sessions.length} 节`} />
            <Metric label="课程进度" value={`${detail.progress}%`} />
            <Metric label="课堂出勤率" value={`${detail.attendanceRate}%`} />
          </div>
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}><div><h3 style={sectionTitleStyle}>课程推进</h3><p style={subtleStyle}>计划时间：{detail.period}</p></div><StatusBadge status={detailCourse.status} /></div>
            <div style={{ marginTop: 16 }}><Progress value={detail.progress} detail={`${detail.sessions.length} / ${detail.plannedCount} 节已完成`} /></div>
          </section>
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}><div><h3 style={sectionTitleStyle}>学员名单</h3><p style={subtleStyle}>可进入详情查看学习轨迹，或从“我的学生”修正已提交的考勤。</p></div></div>
            <div style={{ marginTop: 16 }}>
              <DataTable columns={[
                { key: 'studentNo', label: '学号', width: 150, sortValue: (student) => student.studentNo, render: (student) => student.studentNo },
                { key: 'name', label: '姓名', width: 140, sortValue: (student) => student.name, render: (student) => <strong>{student.name}</strong> },
                { key: 'phone', label: '电话', width: 170, sortValue: (student) => student.phone || '', render: (student) => student.phone || '—' },
                { key: 'progress', label: '学习进度', width: 205, sortValue: (student) => getStudentProgress(student, detail).value, render: (student) => <Progress value={getStudentProgress(student, detail).value} detail={getStudentProgress(student, detail).detail} /> },
                { key: 'detail', label: '操作', width: 110, render: (student) => <Link to={`/student/${student.id}`} style={linkStyle}>查看详情</Link> },
              ]} rows={detail.students} getRowId={(student) => student.id} emptyMessage="当前课程还没有报名学生。" />
            </div>
          </section>
        </div>}
      </Drawer>

      <ConfirmDialog open={Boolean(statusTarget)} title={`${statusTarget?.status === 'active' ? '暂停' : '恢复'}课程`} description={statusTarget?.status === 'active' ? `暂停后不能继续作为进行中课程使用，已有学生和考勤记录会被保留。` : `确认将“${statusTarget?.name}”恢复为进行中吗？`} confirmText={`确认${statusTarget?.status === 'active' ? '暂停' : '恢复'}`} tone="primary" onCancel={() => setStatusTarget(null)} onConfirm={saveStatus} />
    </section>
  )
}

function getStudentProgress(student, detail) {
  const attended = detail.records.filter((record) => record.studentId === student.id && ['present', 'late'].includes(record.status)).length
  return { value: detail.plannedCount ? Math.round((attended / detail.plannedCount) * 100) : 0, detail: `${attended} / ${detail.plannedCount} 节已上` }
}

function Metric({ label, value }) { return <article style={{ padding: 18, borderRadius: 14, background: '#f8fafc' }}><span style={{ color: '#64748b', fontSize: 13 }}>{label}</span><strong style={{ display: 'block', marginTop: 7, fontSize: 26 }}>{value}</strong></article> }
function StatusBadge({ status }) {
  if (status === 'pending') return <span style={pendingBadgeStyle}>未开始</span>
  if (status === 'paused') return <span style={pausedBadgeStyle}>暂停中</span>
  if (status === 'inactive') return <span style={inactiveBadgeStyle}>已结束</span>
  return <span style={activeBadgeStyle}>进行中</span>
}
function Progress({ value, detail }) { return <div style={{ minWidth: 120 }}><div style={progressTrackStyle}><span style={{ ...progressFillStyle, width: `${Math.max(0, Math.min(100, value))}%` }} /></div><span style={{ display: 'block', marginTop: 5, fontSize: 12, color: '#64748b' }}>{detail} · {value}%</span></div> }

const pageHeaderStyle = { marginBottom: 20 }
const eyebrowStyle = { margin: 0, color: '#2563eb', fontSize: 13, fontWeight: 800, letterSpacing: '.08em' }
const titleStyle = { margin: '5px 0 0', fontSize: 30, letterSpacing: '-.03em' }
const subtleStyle = { margin: '7px 0 0', color: '#64748b', fontSize: 14 }
const toolbarStyle = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 16, padding: 4 }
const searchStyle = { boxSizing: 'border-box', flex: '1 1 340px', minWidth: 280, height: 42, padding: '0 13px', border: '1px solid #d8e2f0', borderRadius: 10, outline: 'none', background: '#fff', color: '#334155' }
const selectStyle = { flex: '0 0 132px', height: 42, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, background: '#fff', color: '#334155' }
const actionStyle = { display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }
const textButtonStyle = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, padding: '5px 6px' }
const linkStyle = { color: '#2563eb', textDecoration: 'none', fontWeight: 700, padding: '5px 6px' }
const metricGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }
const panelStyle = { padding: 22, borderRadius: 16, background: '#f8fafc' }
const sectionHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, flexWrap: 'wrap' }
const sectionTitleStyle = { margin: 0, fontSize: 18 }
const codeStyle = { color: '#475569', fontVariantNumeric: 'tabular-nums' }
const pendingBadgeStyle = { display: 'inline-block', color: '#075985', background: '#e0f2fe', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const activeBadgeStyle = { display: 'inline-block', color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const inactiveBadgeStyle = { display: 'inline-block', color: '#9a3412', background: '#fff1df', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const pausedBadgeStyle = { display: 'inline-block', color: '#b91c1c', background: '#fee2e2', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const progressTrackStyle = { height: 7, background: '#e5edf8', borderRadius: 999, overflow: 'hidden' }
const progressFillStyle = { display: 'block', height: '100%', background: 'linear-gradient(90deg, #2563eb, #4f46e5)', borderRadius: 999 }
