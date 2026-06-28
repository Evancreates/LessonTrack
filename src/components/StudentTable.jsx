import { Link } from 'react-router-dom'
import DataTable from './DataTable'

export default function StudentTable({ students, onEdit, onDelete }) {
  const columns = [
    { key: 'studentNo', label: '学号', width: 145, sortValue: (student) => student.studentNo, render: (student) => <span style={{ color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{student.studentNo}</span> },
    { key: 'name', label: '姓名', width: 135, sortValue: (student) => student.name, render: (student) => <strong>{student.name}</strong> },
    { key: 'phone', label: '电话', width: 155, sortValue: (student) => student.phone || '', render: (student) => student.phone || '—' },
    { key: 'totalCredits', label: '总课时', width: 105, align: 'center', sortValue: (student) => Number(student.totalCredits), render: (student) => `${student.totalCredits} 节` },
    { key: 'usedCredits', label: '已上课时', width: 115, align: 'center', sortValue: (student) => Number(student.usedCredits), render: (student) => `${student.usedCredits} 节` },
    { key: 'remaining', label: '剩余课时', width: 115, align: 'center', sortValue: (student) => Number(student.totalCredits) - Number(student.usedCredits), render: (student) => `${Math.max(0, student.totalCredits - student.usedCredits)} 节` },
    { key: 'actions', label: '操作', width: 190, render: (student) => <div style={actionStyle}><Link to={`/student/${student.id}`} style={linkStyle}>详情</Link><button type="button" onClick={() => onEdit(student)} style={buttonStyle}>编辑</button><button type="button" onClick={() => onDelete(student)} style={dangerButtonStyle}>删除</button></div> },
  ]
  return <DataTable columns={columns} rows={students} getRowId={(student) => student.id} emptyMessage="暂无符合条件的学生。" />
}

const actionStyle = { display: 'flex', gap: 5, whiteSpace: 'nowrap' }
const linkStyle = { color: '#2563eb', textDecoration: 'none', fontWeight: 700, padding: '5px 6px' }
const buttonStyle = { border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, padding: '5px 6px' }
const dangerButtonStyle = { ...buttonStyle, color: '#dc2626' }
