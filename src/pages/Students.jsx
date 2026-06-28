import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ConfirmDialog from '../components/ConfirmDialog'
import Drawer from '../components/Drawer'
import ExcelUploader from '../components/ExcelUploader'
import StudentTable from '../components/StudentTable'
import { getPlannedLessonCount } from '../utils/courseSchedule'
import {
  generateStudentNo,
  getAttendance,
  getCourses,
  getEnrollments,
  getSessions,
  getStudents,
  recalculateStudentCredits,
  saveAttendance,
  saveEnrollments,
  saveStudents,
} from '../utils/storage'

const emptyStudentForm = { name: '', phone: '', courseIds: [] }

export default function Students({ dataVersion, onDataChange }) {
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyStudentForm)
  const [editingStudent, setEditingStudent] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [error, setError] = useState('')
  void dataVersion
  const students = getStudents()
  const courses = getCourses()
  const enrollments = getEnrollments()
  const attendance = getAttendance()
  const sessions = getSessions()
  const enrollableCourses = courses.filter((course) => course.status !== 'inactive')
  const selectableCourses = editingStudent ? courses : enrollableCourses
  const keyword = search.trim().toLowerCase()
  const filteredStudents = students.filter((student) => (
    !keyword || student.name.toLowerCase().includes(keyword) || student.studentNo.toLowerCase().includes(keyword)
  ))
  const existingEnrollments = editingStudent
    ? enrollments.filter((enrollment) => enrollment.studentId === editingStudent.id)
    : []

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingStudent(null)
    setForm(emptyStudentForm)
    setError('')
  }

  const openCreate = () => {
    setEditingStudent(null)
    setForm(emptyStudentForm)
    setError('')
    setDrawerOpen(true)
  }

  const openEdit = (student) => {
    const selectedCourseIds = enrollments
      .filter((enrollment) => enrollment.studentId === student.id)
      .map((enrollment) => enrollment.courseId)
    setEditingStudent(student)
    setForm({ name: student.name, phone: student.phone || '', courseIds: selectedCourseIds })
    setError('')
    setDrawerOpen(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const name = form.name.trim()
    const phone = form.phone.trim()
    const selectedCourses = selectableCourses.filter((course) => form.courseIds.includes(course.id))
    const finalCourseIds = [...new Set(selectedCourses.map((course) => course.id))]

    if (!name || finalCourseIds.length === 0) {
      setError('请填写姓名，并至少选择一门课程。')
      return
    }

    const courseById = new Map(courses.map((course) => [course.id, course]))
    const totalCredits = finalCourseIds.reduce((total, courseId) => total + getPlannedLessonCount(courseById.get(courseId)), 0)
    const joinedAt = new Date().toISOString().split('T')[0]

    if (editingStudent) {
      const removedCourseIds = new Set(existingEnrollments.map((enrollment) => enrollment.courseId).filter((courseId) => !finalCourseIds.includes(courseId)))
      const removedSessionIds = new Set(sessions.filter((session) => removedCourseIds.has(session.courseId)).map((session) => session.id))
      saveStudents(students.map((student) => (
        student.id === editingStudent.id
          ? { ...student, name, phone, totalCredits, usedCredits: student.usedCredits }
          : student
      )))
      const enrollmentByCourseId = new Map(existingEnrollments.map((enrollment) => [enrollment.courseId, enrollment]))
      saveEnrollments([
        ...enrollments.filter((enrollment) => enrollment.studentId !== editingStudent.id),
        ...finalCourseIds.map((courseId) => {
          const enrollment = enrollmentByCourseId.get(courseId)
          return enrollment || { id: uuidv4(), studentId: editingStudent.id, courseId, joinedAt }
        }),
      ])
      if (removedSessionIds.size) {
        saveAttendance(attendance.filter((record) => !(record.studentId === editingStudent.id && removedSessionIds.has(record.sessionId))))
        recalculateStudentCredits()
      }
    } else {
      const id = uuidv4()
      saveStudents([
        ...students,
        { id, studentNo: generateStudentNo(), name, phone, totalCredits, usedCredits: 0 },
      ])
      saveEnrollments([
        ...enrollments,
        ...finalCourseIds.map((courseId) => ({ id: uuidv4(), studentId: id, courseId, joinedAt })),
      ])
    }

    onDataChange()
    closeDrawer()
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    saveStudents(students.filter((student) => student.id !== pendingDelete.id))
    saveEnrollments(enrollments.filter((enrollment) => enrollment.studentId !== pendingDelete.id))
    saveAttendance(attendance.filter((record) => record.studentId !== pendingDelete.id))
    setPendingDelete(null)
    onDataChange()
  }

  return (
    <section>
      <div style={pageHeaderStyle}>
        <div><h1 style={{ margin: '5px 0 0', fontSize: 30 }}>学生管理</h1><p style={subtleStyle}>维护学生档案、报名课程和学习进度。</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><ExcelUploader onImport={onDataChange} /><button type="button" onClick={openCreate} style={primaryButtonStyle}>＋ 新增学生</button></div>
      </div>

      <div style={toolbarStyle}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名或学号" style={inputStyle} /></div>
      <StudentTable students={filteredStudents} onEdit={openEdit} onDelete={setPendingDelete} />

      <Drawer open={drawerOpen} title={editingStudent ? '编辑学生' : '新增学生'} onClose={closeDrawer}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18, paddingBottom: 12 }}>
          {!editingStudent && <p style={{ margin: 0, color: '#6b7280' }}>学号将在创建时自动生成。</p>}
          {editingStudent && <p style={{ margin: 0, color: '#6b7280' }}>学号：{editingStudent.studentNo}</p>}
          <label><span style={labelStyle}>姓名</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} style={inputStyle} /></label>
          <label><span style={labelStyle}>电话</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} style={inputStyle} /></label>
          <fieldset style={{ border: 0, borderRadius: 14, padding: 16, margin: 0, background: '#f8fafc' }}>
            <legend style={{ padding: 0, color: '#475569', fontWeight: 700 }}>报名课程（可多选）</legend>
            <div style={{ display: 'grid', gap: 10, marginTop: 9 }}>
              {selectableCourses.map((course) => (
                <label key={course.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: '#fff', borderRadius: 9 }}>
                  <input
                    type="checkbox"
                    checked={form.courseIds.includes(course.id)}
                    onChange={() => setForm((current) => ({
                      ...current,
                      courseIds: current.courseIds.includes(course.id)
                        ? current.courseIds.filter((courseId) => courseId !== course.id)
                        : [...current.courseIds, course.id],
                    }))}
                  />
                  {course.code} · {course.name}<small style={{ color: '#94a3b8' }}> · {getCourseStatusLabel(course.status)}</small>
                </label>
              ))}
            </div>
          </fieldset>
          {enrollableCourses.length === 0 && !editingStudent && <p style={{ color: '#b91c1c', margin: 0 }}>暂无可报名课程，无法新增学生。</p>}
          {error && <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}><button type="button" onClick={closeDrawer} style={secondaryButtonStyle}>取消</button><button type="submit" disabled={!editingStudent && enrollableCourses.length === 0} style={primaryButtonStyle}>{editingStudent ? '保存学生资料' : '确认新增学生'}</button></div>
        </form>
      </Drawer>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="确认删除学生"
        description={`确定删除学生“${pendingDelete?.name}”吗？其报名课程和点名记录将一并删除。`}
        confirmText="确认删除"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
)
}

function getCourseStatusLabel(status) {
  if (status === 'pending') return '未开始'
  if (status === 'paused') return '暂停中'
  if (status === 'inactive') return '已结束'
  return '进行中'
}

const pageHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }
const subtleStyle = { margin: '7px 0 0', color: '#64748b' }
const toolbarStyle = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }
const inputStyle = { boxSizing: 'border-box', width: '100%', minWidth: 220, padding: '11px 12px', border: '1px solid #d8e2f0', borderRadius: 10, outline: 'none', color: '#1e293b', background: '#fff' }
const labelStyle = { display: 'block', marginBottom: 7, color: '#475569', fontSize: 14, fontWeight: 650 }
const primaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#2563eb', color: '#fff', fontWeight: 750, boxShadow: '0 5px 14px rgba(37, 99, 235, .2)' }
const secondaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#eef2f7', color: '#475569', fontWeight: 700 }
