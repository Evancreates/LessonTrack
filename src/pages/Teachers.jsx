import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import DataTable from '../components/DataTable'
import Drawer from '../components/Drawer'
import { getPlannedLessonCount } from '../utils/courseSchedule'
import { getAttendance, getCourses, getEnrollments, getSessions, getStudents, getTeachers, saveCourses } from '../utils/storage'

export default function Teachers({ dataVersion, onDataChange }) {
  const [search, setSearch] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [coverageFilter, setCoverageFilter] = useState('all')
  const [detailTeacher, setDetailTeacher] = useState(null)
  const [editingTeacher, setEditingTeacher] = useState(null)
  const [form, setForm] = useState({ name: '', courseIds: [] })
  const [error, setError] = useState('')
  const [confirmEdit, setConfirmEdit] = useState(false)
  void dataVersion

  const teachers = getTeachers()
  const courses = getCourses()
  const enrollments = getEnrollments()
  const students = getStudents()
  const sessions = getSessions()
  const attendance = getAttendance()
  const keyword = search.trim().toLowerCase()
  const currentMonth = new Date().toISOString().slice(0, 7)

  const statsByTeacherId = useMemo(() => new Map(teachers.map((teacher) => {
    const teacherCourses = courses.filter((course) => teacher.courseIds.includes(course.id))
    const courseIds = new Set(teacherCourses.map((course) => course.id))
    const studentIds = new Set(enrollments.filter((enrollment) => courseIds.has(enrollment.courseId)).map((enrollment) => enrollment.studentId))
    const teacherSessions = sessions.filter((session) => courseIds.has(session.courseId))
    const totalCredits = teacherCourses.reduce((total, course) => total + getPlannedLessonCount(course), 0)
    const settlementRows = teacherCourses.map((course) => {
      const courseSessions = teacherSessions.filter((session) => session.courseId === course.id).sort((a, b) => a.date.localeCompare(b.date))
      const sessionIds = new Set(courseSessions.map((session) => session.id))
      const courseStudentIds = new Set(enrollments.filter((enrollment) => enrollment.courseId === course.id).map((enrollment) => enrollment.studentId))
      const effectiveAttendance = attendance.filter((record) => sessionIds.has(record.sessionId) && record.status !== 'absent').length
      const plannedCount = getPlannedLessonCount(course)
      return {
        course,
        courseSessions,
        studentCount: courseStudentIds.size,
        taughtCount: courseSessions.length,
        effectiveAttendance,
        plannedCount,
        progress: plannedCount ? Math.min(100, Math.round((courseSessions.length / plannedCount) * 100)) : 0,
        lastDate: courseSessions[courseSessions.length - 1]?.date || '',
      }
    })
    return [teacher.id, {
      courses: teacherCourses,
      students: students.filter((student) => studentIds.has(student.id)),
      sessions: teacherSessions,
      currentMonthSessions: teacherSessions.filter((session) => String(session.date || '').startsWith(currentMonth)),
      totalCredits,
      settlementRows,
      progress: totalCredits ? Math.min(100, Math.round((teacherSessions.length / totalCredits) * 100)) : 0,
      attended: attendance.filter((record) => studentIds.has(record.studentId) && teacherSessions.some((session) => session.id === record.sessionId) && record.status !== 'absent').length,
    }]
  })), [attendance, courses, currentMonth, enrollments, sessions, students, teachers])

  const displayedTeachers = teachers.filter((teacher) => {
    const stats = statsByTeacherId.get(teacher.id)
    return (!keyword || teacher.name.toLowerCase().includes(keyword) || String(teacher.teacherNo || '').toLowerCase().includes(keyword) || stats?.courses.some((course) => course.name.toLowerCase().includes(keyword)))
      && (teacherFilter === 'all' || teacher.id === teacherFilter)
      && (coverageFilter === 'all' || (coverageFilter === 'active' ? stats?.courses.some((course) => course.status === 'active') : stats?.courses.length === 0))
  })

  const openEdit = (teacher) => {
    setEditingTeacher(teacher)
    setForm({ name: teacher.name, courseIds: [...teacher.courseIds] })
    setError('')
  }

  const closeEdit = () => {
    setEditingTeacher(null)
    setError('')
    setConfirmEdit(false)
  }

  const validateEdit = (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('请填写教师姓名。')
      return
    }
    setConfirmEdit(true)
  }

  const saveTeacherEdit = () => {
    if (!editingTeacher) return
    const name = form.name.trim()
    const selectedCourseIds = new Set(form.courseIds)
    saveCourses(courses.map((course) => {
      if (selectedCourseIds.has(course.id)) return { ...course, teacherName: name }
      if (editingTeacher.courseIds.includes(course.id)) return { ...course, teacherName: '' }
      return course
    }))
    closeEdit()
    onDataChange()
  }

  const columns = [
    { key: 'teacherNo', label: '教师编号', width: 120, sortValue: (teacher) => teacher.teacherNo || '', render: (teacher) => <span style={codeStyle}>{teacher.teacherNo || '—'}</span> },
    { key: 'name', label: '教师姓名', width: 150, sortValue: (teacher) => teacher.name, render: (teacher) => <strong>{teacher.name}</strong> },
    { key: 'courseCount', label: '课程数', width: 105, align: 'center', sortValue: (teacher) => statsByTeacherId.get(teacher.id)?.courses.length || 0, render: (teacher) => `${statsByTeacherId.get(teacher.id)?.courses.length || 0} 门` },
    { key: 'courses', label: '负责课程', width: 290, sortValue: (teacher) => statsByTeacherId.get(teacher.id)?.courses.map((course) => course.name).join('') || '', render: (teacher) => <span style={{ color: '#475569' }}>{statsByTeacherId.get(teacher.id)?.courses.map((course) => course.name).join('、') || '暂未分配'}</span> },
    { key: 'students', label: '管理学生', width: 125, align: 'center', sortValue: (teacher) => statsByTeacherId.get(teacher.id)?.students.length || 0, render: (teacher) => `${statsByTeacherId.get(teacher.id)?.students.length || 0} 人` },
    { key: 'progress', label: '总体进度', width: 210, sortValue: (teacher) => statsByTeacherId.get(teacher.id)?.progress || 0, render: (teacher) => <Progress value={statsByTeacherId.get(teacher.id)?.progress || 0} detail={`${statsByTeacherId.get(teacher.id)?.sessions.length || 0} / ${statsByTeacherId.get(teacher.id)?.totalCredits || 0} 节`} /> },
    { key: 'actions', label: '操作', width: 165, render: (teacher) => <div style={actionStyle}><button type="button" onClick={() => setDetailTeacher(teacher)} style={textButtonStyle}>查看详情</button><button type="button" onClick={() => openEdit(teacher)} style={textButtonStyle}>编辑</button></div> },
  ]

  const detail = detailTeacher ? statsByTeacherId.get(detailTeacher.id) : null
  return (
    <section>
      <div style={pageHeaderStyle}><div><h1 style={titleStyle}>教师管理</h1><p style={subtleStyle}>从教师、课程和学生三个层面查看教学进展。</p></div></div>
      <div style={toolbarStyle}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索教师编号、姓名或课程" style={searchStyle} />
        <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} style={selectStyle}><option value="all">全部教师姓名</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.teacherNo || '教师'} · {teacher.name}</option>)}</select>
        <select value={coverageFilter} onChange={(event) => setCoverageFilter(event.target.value)} style={selectStyle}><option value="all">全部教师状态</option><option value="active">有进行中课程</option><option value="unassigned">未分配课程</option></select>
      </div>
      <DataTable columns={columns} rows={displayedTeachers} getRowId={(teacher) => teacher.id} emptyMessage="暂无符合条件的教师。创建课程并填写授课老师后会自动生成。" />

      <Drawer open={Boolean(detailTeacher)} title={`教师详情 · ${detailTeacher?.teacherNo || ''} ${detailTeacher?.name || ''}`} onClose={() => setDetailTeacher(null)} full>
        {detail && <div style={{ display: 'grid', gap: 22 }}>
          <div style={metricGridStyle}><Metric label="教师编号" value={detailTeacher?.teacherNo || '—'} /><Metric label="总授课课次" value={`${detail.sessions.length} 节`} /><Metric label="本月授课课次" value={`${detail.currentMonthSessions.length} 节`} /><Metric label="有效出勤人次" value={`${detail.attended} 次`} /></div>
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}><div><h3 style={sectionTitleStyle}>课时结算统计</h3><p style={subtleStyle}>按课程汇总已进行课堂，便于核对教师课酬。</p></div></div>
            <div style={{ marginTop: 16 }}>
              <DataTable columns={[
                { key: 'code', label: '课程编号', width: 120, sortValue: (row) => row.course.code, render: (row) => <span style={codeStyle}>{row.course.code}</span> },
                { key: 'course', label: '课程名称', width: 190, sortValue: (row) => row.course.name, render: (row) => <strong>{row.course.name}</strong> },
                { key: 'students', label: '学生数', width: 100, align: 'center', sortValue: (row) => row.studentCount, render: (row) => `${row.studentCount} 人` },
                { key: 'taught', label: '已授课次', width: 115, align: 'center', sortValue: (row) => row.taughtCount, render: (row) => <strong>{row.taughtCount} 节</strong> },
                { key: 'attendance', label: '有效出勤人次', width: 140, align: 'center', sortValue: (row) => row.effectiveAttendance, render: (row) => `${row.effectiveAttendance} 次` },
                { key: 'lastDate', label: '最近上课', width: 130, sortValue: (row) => row.lastDate, render: (row) => row.lastDate || '—' },
                { key: 'progress', label: '计划进度', width: 190, sortValue: (row) => row.progress, render: (row) => <Progress value={row.progress} detail={`${row.taughtCount} / ${row.plannedCount} 节`} /> },
              ]} rows={detail.settlementRows} getRowId={(row) => row.course.id} emptyMessage="该教师暂未负责课程。" />
            </div>
          </section>
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}><div><h3 style={sectionTitleStyle}>授课日期明细</h3><p style={subtleStyle}>只统计已经开课并提交到机构数据的课堂。</p></div></div>
            <div style={dateDetailGridStyle}>{detail.settlementRows.map((row) => <article key={row.course.id} style={settlementCardStyle}><div style={sectionHeaderStyle}><div><strong>{row.course.code} · {row.course.name}</strong><span style={{ display: 'block', marginTop: 5, color: '#64748b', fontSize: 13 }}>已授课 {row.taughtCount} 节</span></div><StatusBadge status={row.course.status} /></div><div style={dateChipWrapStyle}>{row.courseSessions.length ? row.courseSessions.map((session) => <span key={session.id} style={dateChipStyle}>{session.date}</span>) : <span style={{ color: '#94a3b8', fontSize: 13 }}>暂无已进行课堂</span>}</div></article>)}</div>
          </section>
          <section style={panelStyle}><h3 style={sectionTitleStyle}>所教学生</h3><DataTable columns={[{ key: 'studentNo', label: '学号', width: 150, sortValue: (student) => student.studentNo, render: (student) => student.studentNo }, { key: 'name', label: '姓名', width: 140, sortValue: (student) => student.name, render: (student) => <strong>{student.name}</strong> }, { key: 'courses', label: '报名课程', width: 270, sortValue: (student) => enrollments.filter((enrollment) => enrollment.studentId === student.id && detail.courses.some((course) => course.id === enrollment.courseId)).length, render: (student) => enrollments.filter((enrollment) => enrollment.studentId === student.id && detail.courses.some((course) => course.id === enrollment.courseId)).map((enrollment) => courses.find((course) => course.id === enrollment.courseId)?.name).filter(Boolean).join('、') }, { key: 'attended', label: '已上课时', width: 140, sortValue: (student) => attendance.filter((record) => record.studentId === student.id && detail.sessions.some((session) => session.id === record.sessionId) && record.status !== 'absent').length, render: (student) => `${attendance.filter((record) => record.studentId === student.id && detail.sessions.some((session) => session.id === record.sessionId) && record.status !== 'absent').length} 节` }, { key: 'detail', label: '操作', width: 90, render: (student) => <Link to={`/student/${student.id}`} style={linkStyle}>详情</Link> }]} rows={detail.students} getRowId={(student) => student.id} emptyMessage="暂无学生。" /></section>
        </div>}
      </Drawer>

      <Drawer open={Boolean(editingTeacher)} title={`编辑教师 · ${editingTeacher?.name || ''}`} onClose={closeEdit}>
        <form onSubmit={validateEdit} style={formStyle}><label style={labelStyle}>教师姓名<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} style={inputStyle} /></label><fieldset style={courseFieldsetStyle}><legend style={{ color: '#475569', fontWeight: 700 }}>负责课程</legend><p style={{ margin: '8px 0 12px', color: '#64748b', fontSize: 13 }}>勾选课程将分配给该教师；取消原负责课程的勾选会解除其授课老师。</p><div style={{ display: 'grid', gap: 8 }}>{courses.map((course) => <label key={course.id} style={checkboxStyle}><input type="checkbox" checked={form.courseIds.includes(course.id)} onChange={() => setForm((current) => ({ ...current, courseIds: current.courseIds.includes(course.id) ? current.courseIds.filter((id) => id !== course.id) : [...current.courseIds, course.id] }))} /> <span>{course.code} · {course.name}<small style={{ color: '#94a3b8' }}> · 当前：{course.teacherName || '未分配'}</small></span></label>)}</div></fieldset>{error && <p style={{ margin: 0, color: '#dc2626' }}>{error}</p>}<div style={submitRowStyle}><button type="button" onClick={closeEdit} style={secondaryButtonStyle}>取消</button><button type="submit" style={primaryButtonStyle}>保存教师设置</button></div></form>
      </Drawer>
      <ConfirmDialog open={confirmEdit} title="确认更新教师与课程" description="这会同步更新所选课程的授课老师信息。" confirmText="确认保存" tone="primary" onCancel={() => setConfirmEdit(false)} onConfirm={saveTeacherEdit} />
    </section>
  )
}

function Metric({ label, value }) { return <article style={{ padding: 18, borderRadius: 14, background: '#f8fafc' }}><span style={{ color: '#64748b', fontSize: 13 }}>{label}</span><strong style={{ display: 'block', marginTop: 7, fontSize: 26 }}>{value}</strong></article> }
function Progress({ value, detail }) { return <div style={{ width: 150, maxWidth: '100%' }}><div style={progressTrackStyle}><span style={{ ...progressFillStyle, width: `${Math.max(0, Math.min(100, value))}%` }} /></div><span style={{ display: 'block', marginTop: 5, fontSize: 12, color: '#64748b' }}>{detail} · {value}%</span></div> }
function StatusBadge({ status }) {
  if (status === 'pending') return <span style={pendingBadgeStyle}>未开始</span>
  if (status === 'paused') return <span style={pausedBadgeStyle}>暂停中</span>
  if (status === 'inactive') return <span style={inactiveBadgeStyle}>已结束</span>
  return <span style={activeBadgeStyle}>进行中</span>
}

const pageHeaderStyle = { marginBottom: 20 }
const titleStyle = { margin: '5px 0 0', fontSize: 30, letterSpacing: '-.03em' }
const subtleStyle = { margin: '7px 0 0', color: '#64748b', fontSize: 14 }
const toolbarStyle = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 16, padding: 4 }
const searchStyle = { boxSizing: 'border-box', flex: '1 1 340px', minWidth: 280, height: 42, padding: '0 13px', border: '1px solid #d8e2f0', borderRadius: 10, background: '#fff', color: '#334155' }
const selectStyle = { flex: '0 0 180px', height: 42, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, background: '#fff', color: '#334155' }
const actionStyle = { display: 'flex', gap: 4, whiteSpace: 'nowrap' }
const textButtonStyle = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, padding: '5px 6px' }
const linkStyle = { color: '#2563eb', textDecoration: 'none', fontWeight: 700, padding: '5px 6px' }
const codeStyle = { color: '#475569', fontVariantNumeric: 'tabular-nums' }
const metricGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }
const panelStyle = { padding: 22, borderRadius: 16, background: '#f8fafc' }
const sectionHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, flexWrap: 'wrap' }
const sectionTitleStyle = { margin: 0, fontSize: 18 }
const dateDetailGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 16 }
const settlementCardStyle = { padding: 16, borderRadius: 14, background: '#fff', boxShadow: 'inset 0 0 0 1px #e6edf7' }
const dateChipWrapStyle = { display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }
const dateChipStyle = { padding: '5px 8px', borderRadius: 999, background: '#eef4ff', color: '#475569', fontSize: 12, fontWeight: 700 }
const formStyle = { display: 'grid', gap: 18 }
const labelStyle = { display: 'grid', gap: 7, color: '#475569', fontSize: 14, fontWeight: 650 }
const inputStyle = { boxSizing: 'border-box', width: '100%', height: 43, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, font: 'inherit' }
const courseFieldsetStyle = { margin: 0, padding: 16, border: 0, borderRadius: 14, background: '#f8fafc' }
const checkboxStyle = { display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 9, background: '#fff' }
const submitRowStyle = { display: 'flex', justifyContent: 'flex-end', gap: 10 }
const primaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#2563eb', color: '#fff', fontWeight: 750, boxShadow: '0 5px 14px rgba(37, 99, 235, .2)' }
const secondaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#eef2f7', color: '#475569', fontWeight: 700 }
const progressTrackStyle = { height: 7, background: '#e5edf8', borderRadius: 999, overflow: 'hidden' }
const progressFillStyle = { display: 'block', height: '100%', background: 'linear-gradient(90deg, #2563eb, #4f46e5)', borderRadius: 999 }
const pendingBadgeStyle = { display: 'inline-block', color: '#075985', background: '#e0f2fe', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const activeBadgeStyle = { display: 'inline-block', color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const inactiveBadgeStyle = { display: 'inline-block', color: '#9a3412', background: '#fff1df', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
const pausedBadgeStyle = { display: 'inline-block', color: '#b91c1c', background: '#fee2e2', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }
