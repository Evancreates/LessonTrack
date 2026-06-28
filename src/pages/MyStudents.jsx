import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import DataTable from '../components/DataTable'
import Drawer from '../components/Drawer'
import { getPlannedLessonCount } from '../utils/courseSchedule'
import {
  getAttendance,
  getCourses,
  getCurrentRole,
  getEnrollments,
  getSessions,
  getStudents,
  getTeachers,
  recalculateStudentCredits,
  saveAttendance,
} from '../utils/storage'

const statusOptions = [
  { value: 'present', label: '出勤' },
  { value: 'late', label: '迟到' },
  { value: 'absent', label: '缺勤' },
]

export default function MyStudents({ dataVersion, onDataChange }) {
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [editingStudent, setEditingStudent] = useState(null)
  const [editedRecords, setEditedRecords] = useState({})
  const [confirmSave, setConfirmSave] = useState(false)
  void dataVersion

  const currentRole = getCurrentRole()
  const teacher = getTeachers().find((item) => item.id === currentRole.userId)
  const allCourses = getCourses()
  const courses = allCourses.filter((course) => teacher?.courseIds.includes(course.id))
  const courseIds = new Set(courses.map((course) => course.id))
  const enrollments = getEnrollments().filter((enrollment) => courseIds.has(enrollment.courseId))
  const students = getStudents()
  const sessions = getSessions().filter((session) => courseIds.has(session.courseId))
  const attendance = getAttendance()
  const keyword = search.trim().toLowerCase()
  const studentIds = new Set(enrollments
    .filter((enrollment) => courseFilter === 'all' || enrollment.courseId === courseFilter)
    .map((enrollment) => enrollment.studentId))
  const rows = students.filter((student) => {
    const matchesSearch = !keyword || student.name.toLowerCase().includes(keyword) || student.studentNo.toLowerCase().includes(keyword) || (student.phone || '').includes(keyword)
    return matchesSearch && studentIds.has(student.id)
  })
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const sessionById = new Map(sessions.map((session) => [session.id, session]))

  const studentStats = new Map(rows.map((student) => {
    const enrolledCourses = enrollments.filter((enrollment) => enrollment.studentId === student.id).map((enrollment) => courseById.get(enrollment.courseId)).filter(Boolean)
    const records = attendance.filter((record) => record.studentId === student.id && sessionById.has(record.sessionId))
    const attended = records.filter((record) => ['present', 'late'].includes(record.status)).length
    const totalSessions = enrolledCourses.reduce((total, course) => total + getPlannedLessonCount(course), 0)
    const attendanceRate = records.length ? Math.round((attended / records.length) * 100) : 0
    return [student.id, { enrolledCourses, records, attended, totalSessions, attendanceRate }]
  }))

  const openEdit = (student) => {
    const records = studentStats.get(student.id)?.records || []
    setEditingStudent(student)
    setEditedRecords(Object.fromEntries(records.map((record) => [record.id, record.status])))
    setConfirmSave(false)
  }

  const saveChanges = () => {
    const changedIds = new Set(Object.keys(editedRecords).filter((id) => attendance.find((record) => record.id === id)?.status !== editedRecords[id]))
    if (changedIds.size) {
      saveAttendance(attendance.map((record) => changedIds.has(record.id) ? { ...record, status: editedRecords[record.id] } : record))
      recalculateStudentCredits()
    }
    setConfirmSave(false)
    setEditingStudent(null)
    onDataChange()
  }

  const columns = [
    { key: 'studentNo', label: '学号', width: 145, sortValue: (student) => student.studentNo, render: (student) => <span style={codeStyle}>{student.studentNo}</span> },
    { key: 'name', label: '姓名', width: 135, sortValue: (student) => student.name, render: (student) => <strong>{student.name}</strong> },
    { key: 'phone', label: '电话', width: 165, sortValue: (student) => student.phone || '', render: (student) => student.phone || '—' },
    { key: 'courses', label: '所学课程', width: 270, sortValue: (student) => studentStats.get(student.id)?.enrolledCourses.map((course) => course.name).join('') || '', render: (student) => <span style={{ color: '#475569' }}>{studentStats.get(student.id)?.enrolledCourses.map((course) => course.name).join('、') || '—'}</span> },
    { key: 'progress', label: '学习进度', width: 195, sortValue: (student) => { const stats = studentStats.get(student.id); return stats?.totalSessions ? stats.attended / stats.totalSessions : 0 }, render: (student) => { const stats = studentStats.get(student.id); return <Progress value={stats?.totalSessions ? Math.round((stats.attended / stats.totalSessions) * 100) : 0} detail={`${stats?.attended || 0} / ${stats?.totalSessions || 0} 节已上`} /> } },
    { key: 'attendance', label: '出勤率', width: 110, align: 'center', sortValue: (student) => studentStats.get(student.id)?.attendanceRate || 0, render: (student) => `${studentStats.get(student.id)?.attendanceRate || 0}%` },
    { key: 'actions', label: '操作', width: 175, render: (student) => <div style={actionStyle}><Link to={`/student/${student.id}`} style={linkStyle}>查看详情</Link><button type="button" onClick={() => openEdit(student)} style={textButtonStyle}>编辑考勤</button></div> },
  ]

  const editableRecords = editingStudent
    ? (studentStats.get(editingStudent.id)?.records || []).map((record) => ({ record, session: sessionById.get(record.sessionId), course: courseById.get(sessionById.get(record.sessionId)?.courseId) })).filter((item) => item.session && item.course).sort((a, b) => b.session.date.localeCompare(a.session.date))
    : []
  const changedCount = editableRecords.filter(({ record }) => editedRecords[record.id] !== record.status).length

  return (
    <section>
      <div style={pageHeaderStyle}><div><p style={eyebrowStyle}>教师工作台</p><h1 style={titleStyle}>我的学生</h1><p style={subtleStyle}>查询所教学生的学习情况，并修正已提交课堂的出勤状态。</p></div></div>
      <div style={toolbarStyle}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名、学号或电话" style={searchStyle} />
        <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} style={selectStyle}><option value="all">全部课程</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select>
      </div>
      <DataTable columns={columns} rows={rows} getRowId={(student) => student.id} emptyMessage="暂无符合条件的学生。" />

      <Drawer open={Boolean(editingStudent)} title={`编辑考勤 · ${editingStudent?.name || ''}`} onClose={() => { setEditingStudent(null); setConfirmSave(false) }} full>
        <div style={{ display: 'grid', gap: 20 }}>
          <section style={summaryStyle}><div><span style={{ color: '#64748b', fontSize: 13 }}>仅显示你负责课程中已提交的课堂记录</span><h3 style={{ margin: '5px 0 0', fontSize: 20 }}>{editingStudent?.studentNo} · {editingStudent?.name}</h3></div><span style={changedCount ? changedBadgeStyle : neutralBadgeStyle}>{changedCount ? `待提交 ${changedCount} 项修改` : '尚未修改'}</span></section>
          {editableRecords.length === 0 ? <section style={emptyStyle}>该学生在你负责课程中还没有已提交的点名记录。请先在“课堂点名”完成提交。</section> : <DataTable columns={[
            { key: 'date', label: '日期', width: 160, sortValue: (item) => item.session.date, render: (item) => item.session.date },
            { key: 'course', label: '课程', width: 230, sortValue: (item) => item.course.name, render: (item) => <strong>{item.course.name}</strong> },
            { key: 'original', label: '原始状态', width: 130, sortValue: (item) => item.record.status, render: (item) => <StatusBadge status={item.record.status} /> },
            { key: 'status', label: '修正后状态', width: 190, sortValue: (item) => editedRecords[item.record.id], render: (item) => <select value={editedRecords[item.record.id] || item.record.status} onChange={(event) => setEditedRecords((current) => ({ ...current, [item.record.id]: event.target.value }))} style={attendanceSelectStyle}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> },
          ]} rows={editableRecords} getRowId={(item) => item.record.id} emptyMessage="暂无记录。" />}
          <div style={submitRowStyle}><button type="button" onClick={() => setEditingStudent(null)} style={secondaryButtonStyle}>取消</button><button type="button" disabled={changedCount === 0} onClick={() => setConfirmSave(true)} style={{ ...primaryButtonStyle, opacity: changedCount ? 1 : .55 }}>提交考勤修正</button></div>
        </div>
      </Drawer>
      <ConfirmDialog open={confirmSave} title="确认更新出勤状态" description={`将提交 ${changedCount} 项考勤修正，并同步更新学生已上课时数和管理员数据中心。`} confirmText="确认提交" tone="primary" onCancel={() => setConfirmSave(false)} onConfirm={saveChanges} />
    </section>
  )
}

function StatusBadge({ status }) { const label = statusOptions.find((item) => item.value === status)?.label || status; const style = status === 'present' ? presentBadgeStyle : status === 'late' ? lateBadgeStyle : absentBadgeStyle; return <span style={style}>{label}</span> }
function Progress({ value, detail }) { return <div style={{ minWidth: 120 }}><div style={progressTrackStyle}><span style={{ ...progressFillStyle, width: `${Math.max(0, Math.min(100, value))}%` }} /></div><span style={{ display: 'block', marginTop: 5, fontSize: 12, color: '#64748b' }}>{detail} · {value}%</span></div> }

const pageHeaderStyle = { marginBottom: 20 }
const eyebrowStyle = { margin: 0, color: '#2563eb', fontSize: 13, fontWeight: 800, letterSpacing: '.08em' }
const titleStyle = { margin: '5px 0 0', fontSize: 30, letterSpacing: '-.03em' }
const subtleStyle = { margin: '7px 0 0', color: '#64748b', fontSize: 14 }
const toolbarStyle = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 16, padding: 4 }
const searchStyle = { boxSizing: 'border-box', flex: '1 1 340px', minWidth: 280, height: 42, padding: '0 13px', border: '1px solid #d8e2f0', borderRadius: 10, outline: 'none', background: '#fff', color: '#334155' }
const selectStyle = { flex: '0 0 180px', height: 42, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, background: '#fff', color: '#334155' }
const actionStyle = { display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }
const linkStyle = { color: '#2563eb', textDecoration: 'none', fontWeight: 700, padding: '5px 6px' }
const textButtonStyle = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, padding: '5px 6px' }
const summaryStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 20, borderRadius: 16, background: '#f8fafc' }
const changedBadgeStyle = { padding: '7px 11px', borderRadius: 999, color: '#1d4ed8', background: '#dbeafe', fontSize: 13, fontWeight: 700 }
const neutralBadgeStyle = { padding: '7px 11px', borderRadius: 999, color: '#64748b', background: '#eaf0f7', fontSize: 13, fontWeight: 700 }
const emptyStyle = { padding: 24, borderRadius: 14, background: '#f8fafc', color: '#64748b' }
const attendanceSelectStyle = { minWidth: 120, height: 38, padding: '0 10px', border: '1px solid #d8e2f0', borderRadius: 9, background: '#fff', color: '#334155', font: 'inherit' }
const submitRowStyle = { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }
const primaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#2563eb', color: '#fff', fontWeight: 750, boxShadow: '0 5px 14px rgba(37, 99, 235, .2)' }
const secondaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#eef2f7', color: '#475569', fontWeight: 700 }
const codeStyle = { color: '#475569', fontVariantNumeric: 'tabular-nums' }
const presentBadgeStyle = { display: 'inline-block', padding: '4px 9px', borderRadius: 999, color: '#166534', background: '#dcfce7', fontSize: 12, fontWeight: 700 }
const lateBadgeStyle = { display: 'inline-block', padding: '4px 9px', borderRadius: 999, color: '#9a3412', background: '#fff1df', fontSize: 12, fontWeight: 700 }
const absentBadgeStyle = { display: 'inline-block', padding: '4px 9px', borderRadius: 999, color: '#b91c1c', background: '#fee2e2', fontSize: 12, fontWeight: 700 }
const progressTrackStyle = { height: 7, background: '#e5edf8', borderRadius: 999, overflow: 'hidden' }
const progressFillStyle = { display: 'block', height: '100%', background: 'linear-gradient(90deg, #2563eb, #4f46e5)', borderRadius: 999 }
