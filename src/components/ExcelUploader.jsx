import { useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { downloadStudentImportTemplate, readStudentsFromExcel } from '../utils/excel'
import { getPlannedLessonCount } from '../utils/courseSchedule'
import {
  getCourses,
  getEnrollments,
  getStudents,
  generateStudentNo,
  saveEnrollments,
  saveStudents,
} from '../utils/storage'

export default function ExcelUploader({ onImport }) {
  const inputRef = useRef(null)
  const [message, setMessage] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isError = message.startsWith('导入失败') || message.startsWith('请使用') || message.startsWith('Excel') || message.startsWith('第 ')

  const openFilePicker = () => {
    setMenuOpen(false)
    inputRef.current?.click()
  }

  const downloadTemplate = () => {
    downloadStudentImportTemplate(getCourses())
    setMenuOpen(false)
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setMessage('')

    try {
      const rows = await readStudentsFromExcel(file)
      const courses = getCourses()
      const courseByName = new Map(courses.map((course) => [course.name.trim().toLowerCase(), course]))
      const existingStudents = getStudents()
      const enrollments = getEnrollments()
      const nextEnrollments = [...enrollments]
      const enrollmentKeys = new Set(enrollments.map((enrollment) => `${enrollment.studentId}-${enrollment.courseId}`))
      const newStudents = []
      let newEnrollmentCount = 0
      let unavailableCourseRows = 0
      let unmatchedCourseRows = 0

      rows.forEach((row) => {
        const normalizedPhone = row.phone.trim()
        const normalizedName = row.name.trim().toLowerCase()
        const key = row.courseName.toLowerCase()
        const course = courseByName.get(key)

        if (!course) {
          unmatchedCourseRows += 1
          return
        }

        if (course.status !== 'active') {
          unavailableCourseRows += 1
          return
        }

        let student = existingStudents.find((item) => (
          (normalizedPhone && (item.phone || '').trim() === normalizedPhone)
          || item.name.trim().toLowerCase() === normalizedName
        )) || newStudents.find((item) => (
          (normalizedPhone && (item.phone || '').trim() === normalizedPhone)
          || item.name.trim().toLowerCase() === normalizedName
        ))

        if (!student) {
          student = {
            id: uuidv4(),
            studentNo: generateStudentNo(),
            name: row.name,
            phone: row.phone,
            totalCredits: 0,
            usedCredits: 0,
          }
          newStudents.push(student)
        }

        const enrollmentKey = `${student.id}-${course.id}`
        if (!enrollmentKeys.has(enrollmentKey)) {
          nextEnrollments.push({
            id: uuidv4(),
            studentId: student.id,
            courseId: course.id,
            joinedAt: new Date().toISOString().split('T')[0],
          })
          enrollmentKeys.add(enrollmentKey)
          newEnrollmentCount += 1
        }
      })

      const courseById = new Map(courses.map((course) => [course.id, course]))
      saveStudents([...existingStudents, ...newStudents].map((student) => ({
        ...student,
        totalCredits: nextEnrollments
          .filter((enrollment) => enrollment.studentId === student.id)
          .reduce((total, enrollment) => total + getPlannedLessonCount(courseById.get(enrollment.courseId)), 0),
      })))
      saveEnrollments(nextEnrollments)
      setMessage(
        newStudents.length || newEnrollmentCount
          ? `新增 ${newStudents.length} 名学生，${newEnrollmentCount} 条课程报名。${unmatchedCourseRows ? ` 已跳过 ${unmatchedCourseRows} 条课程名不匹配数据。` : ''}${unavailableCourseRows ? ` 已跳过 ${unavailableCourseRows} 条非进行中课程报名。` : ''}`
          : unmatchedCourseRows || unavailableCourseRows ? `已跳过 ${unmatchedCourseRows + unavailableCourseRows} 条无法导入的数据。` : '没有新增学生或课程报名。',
      )
      onImport()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败，请检查 Excel 文件。')
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button type="button" onClick={() => setMenuOpen(true)} disabled={isImporting} style={importButtonStyle}>
        {isImporting ? '正在导入…' : '导入 Excel 学生名单'}
      </button>
      <span style={{ color: isError ? '#b91c1c' : '#15803d', fontSize: 14 }}>{message}</span>
      {menuOpen && (
        <div role="presentation" style={overlayStyle} onClick={() => setMenuOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Excel 导入" style={menuStyle} onClick={(event) => event.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Excel 学生名单</h3>
            <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>首次导入建议先下载模板；报名课程名称必须与系统课程名称完全一致。</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={openFilePicker} style={primaryActionStyle}>导入 Excel 学生名单</button>
              <button type="button" onClick={downloadTemplate} style={secondaryActionStyle}>下载 Excel 模板</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

const importButtonStyle = { border: '1px solid #bfdbfe', borderRadius: 10, padding: '11px 16px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 750, boxShadow: '0 5px 14px rgba(37, 99, 235, .08)' }
const overlayStyle = { position: 'fixed', inset: 0, zIndex: 35, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(15, 23, 42, .38)' }
const menuStyle = { width: 'min(100%, 420px)', padding: 24, borderRadius: 16, background: '#fff', boxShadow: '0 20px 48px rgba(15, 23, 42, .24)' }
const primaryActionStyle = { border: 0, borderRadius: 10, padding: '12px 16px', background: '#2563eb', color: '#fff', fontWeight: 800 }
const secondaryActionStyle = { border: 0, borderRadius: 10, padding: '12px 16px', background: '#eef2f7', color: '#475569', fontWeight: 800 }
