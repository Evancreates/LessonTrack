import * as XLSX from 'xlsx'

const fieldNames = {
  name: ['姓名', 'name', '学生姓名'],
  phone: ['手机号', '手机', 'phone', '电话'],
  courseName: ['课程名', '课程', 'course', '课程名称', '报名课程'],
}

function findColumn(headers, names) {
  return headers.findIndex((header) => names.includes(header.toLowerCase()))
}

export async function readStudentsFromExcel(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new Error('Excel 文件中没有工作表。')
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: '',
    raw: false,
  })

  if (rows.length < 2) {
    throw new Error('Excel 至少需要包含表头和一条学生数据。')
  }

  const headers = rows[0].map((header) => String(header).trim())
  const nameIndex = findColumn(headers, fieldNames.name)
  const phoneIndex = findColumn(headers, fieldNames.phone)
  const courseIndex = findColumn(headers, fieldNames.courseName)

  if (nameIndex === -1 || phoneIndex === -1 || courseIndex === -1) {
    throw new Error('请使用“姓名、电话、报名课程”作为 Excel 第一行表头。')
  }

  const students = rows.slice(1)
    .map((row) => ({
      name: String(row[nameIndex] ?? '').trim(),
      phone: String(row[phoneIndex] ?? '').trim(),
      courseName: String(row[courseIndex] ?? '').trim(),
    }))
    .filter((student) => student.name || student.phone || student.courseName)

  const invalidRow = students.findIndex(
    (student) => !student.name || !student.courseName,
  )
  if (invalidRow !== -1) {
    throw new Error(`第 ${invalidRow + 2} 行缺少姓名或报名课程。`)
  }

  return students
}

export function downloadStudentImportTemplate(courses = []) {
  const courseNames = courses.map((course) => course.name).filter(Boolean).join('、') || '请先在系统中新增课程'
  const templateRows = [
    ['姓名', '电话', '报名课程', '填写说明'],
    ['', '', '', '报名课程必须与系统中的课程名称完全一致，才能正确导入。'],
    ['', '', '', `当前可用课程：${courseNames}`],
  ]
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(templateRows)
  worksheet['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 72 }]
  XLSX.utils.book_append_sheet(workbook, worksheet, '学生名单')
  XLSX.writeFile(workbook, 'LessonTrack学生导入模板.xlsx')
}
