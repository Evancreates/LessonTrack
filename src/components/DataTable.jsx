import { useEffect, useMemo, useState } from 'react'

const defaultSort = { key: '', direction: 'asc' }

/**
 * A compact data table for operational lists. Sorting and column sizing are
 * deliberately handled in one place so every role sees the same behaviour.
 */
export default function DataTable({
  columns,
  rows,
  getRowId,
  getRowDomId,
  getRowStyle,
  emptyMessage = '暂无数据。',
  initialSort = defaultSort,
}) {
  const [sort, setSort] = useState(initialSort)
  const [widths, setWidths] = useState({})
  const [resizing, setResizing] = useState(null)

  const getWidth = (column) => widths[column.key] || column.width || 150

  useEffect(() => {
    if (!resizing) return undefined
    const move = (event) => {
      const width = Math.max(resizing.minWidth || 90, resizing.startWidth + event.clientX - resizing.startX)
      setWidths((current) => ({ ...current, [resizing.key]: width }))
    }
    const stop = () => setResizing(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
  }, [resizing])

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows
    const column = columns.find((item) => item.key === sort.key)
    if (!column?.sortValue) return rows
    return [...rows].sort((a, b) => {
      const first = column.sortValue(a)
      const second = column.sortValue(b)
      const result = typeof first === 'number' && typeof second === 'number'
        ? first - second
        : String(first ?? '').localeCompare(String(second ?? ''), 'zh-CN', { numeric: true })
      return sort.direction === 'asc' ? result : -result
    })
  }, [columns, rows, sort])

  const toggleSort = (column) => {
    if (!column.sortValue) return
    setSort((current) => current.key === column.key
      ? { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key: column.key, direction: 'asc' })
  }

  return (
    <div style={shellStyle}>
      <div style={scrollStyle}>
        <table style={{ ...tableStyle, minWidth: columns.reduce((total, column) => total + getWidth(column), 0) }}>
          <colgroup>{columns.map((column) => <col key={column.key} style={{ width: getWidth(column) }} />)}</colgroup>
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted = sort.key === column.key
                return (
                  <th key={column.key} style={headCellStyle}>
                    <button type="button" onClick={() => toggleSort(column)} disabled={!column.sortValue} style={{ ...sortButtonStyle, cursor: column.sortValue ? 'pointer' : 'default' }}>
                      {column.label}{column.sortValue && <span style={{ color: isSorted ? '#2563eb' : '#94a3b8', fontSize: 11 }}>{isSorted ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>}
                    </button>
                    <span
                      role="separator"
                      aria-label={`拖动调整${column.label}列宽`}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        setResizing({ key: column.key, startX: event.clientX, startWidth: getWidth(column), minWidth: column.minWidth })
                      }}
                      style={resizeHandleStyle}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr><td colSpan={columns.length} style={emptyCellStyle}>{emptyMessage}</td></tr>
            ) : sortedRows.map((row) => (
              <tr key={getRowId(row)} id={getRowDomId?.(row)} style={{ ...rowStyle, ...(getRowStyle?.(row) || {}) }}>
                {columns.map((column) => <td key={column.key} style={{ ...cellStyle, textAlign: column.align || 'left' }}>{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={hintStyle}>点击列标题排序，拖动标题右侧分隔线调整列宽。</p>
    </div>
  )
}

const shellStyle = { borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.055)' }
const scrollStyle = { overflowX: 'auto' }
const tableStyle = { width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, color: '#334155' }
const headCellStyle = { position: 'relative', padding: '13px 16px', background: '#f8fafc', borderBottom: '1px solid #e5edf7', textAlign: 'left', color: '#64748b', fontSize: 12, fontWeight: 700, letterSpacing: '.02em', whiteSpace: 'nowrap' }
const sortButtonStyle = { border: 0, padding: 0, background: 'transparent', color: 'inherit', font: 'inherit', fontWeight: 'inherit', whiteSpace: 'nowrap' }
const resizeHandleStyle = { position: 'absolute', top: 0, right: -4, zIndex: 2, width: 8, height: '100%', cursor: 'col-resize', touchAction: 'none' }
const rowStyle = { background: '#fff' }
const cellStyle = { padding: '14px 16px', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.45, whiteSpace: 'nowrap' }
const emptyCellStyle = { padding: 42, color: '#94a3b8', textAlign: 'center' }
const hintStyle = { margin: 0, padding: '10px 16px', color: '#94a3b8', fontSize: 12, background: '#fbfdff' }
