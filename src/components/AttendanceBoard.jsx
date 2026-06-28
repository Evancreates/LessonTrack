import DataTable from './DataTable'

const statusOptions = [
  { value: 'present', label: '出勤', color: '#15803d', activeBackground: '#16a34a' },
  { value: 'late', label: '迟到', color: '#b45309', activeBackground: '#d97706' },
  { value: 'absent', label: '缺勤', color: '#b91c1c', activeBackground: '#dc2626' },
]

export default function AttendanceBoard({ students, records, onMark }) {
  const recordByStudentId = new Map(records.map((record) => [record.studentId, record]))
  const columns = [
    { key: 'studentNo', label: '学号', width: 150, sortValue: (student) => student.studentNo, render: (student) => <span style={{ color: '#475569' }}>{student.studentNo}</span> },
    { key: 'name', label: '学生姓名', width: 160, sortValue: (student) => student.name, render: (student) => <strong>{student.name}</strong> },
    { key: 'phone', label: '电话', width: 170, sortValue: (student) => student.phone || '', render: (student) => student.phone || '—' },
    { key: 'mark', label: '点名操作', width: 280, render: (student) => { const status = recordByStudentId.get(student.id)?.status; return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{statusOptions.map((option) => <button key={option.value} type="button" onClick={() => onMark(student.id, option.value)} style={{ border: 0, minWidth: 58, padding: '8px 11px', borderRadius: 9, color: status === option.value ? '#fff' : option.color, background: status === option.value ? option.activeBackground : `${option.color}14`, fontWeight: 700 }}>{option.label}</button>)}</div> } },
  ]
  return <DataTable columns={columns} rows={students} getRowId={(student) => student.id} emptyMessage="该课程暂无已报名学生。" />
}
