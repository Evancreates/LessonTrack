import { useEffect } from 'react'
import { lockBodyScroll } from '../utils/scrollLock'

export default function Drawer({ open, title, onClose, children, full = false }) {
  useEffect(() => {
    if (!open) return undefined
    return lockBodyScroll()
  }, [open])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(15, 23, 42, 0.44)', display: 'flex', justifyContent: 'flex-end', overscrollBehavior: 'contain' }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onWheel={(event) => event.stopPropagation()}
        style={{ width: full ? '100%' : 'min(100%, 580px)', height: '100vh', background: '#fff', padding: full ? '32px clamp(24px, 6vw, 96px)' : 28, boxSizing: 'border-box', overflowY: 'auto', overscrollBehavior: 'contain', boxShadow: '-12px 0 36px rgba(15, 23, 42, 0.2)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: '#1e293b' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="关闭" style={closeButtonStyle}>关闭</button>
        </div>
        {children}
      </aside>
    </div>
  )
}

const closeButtonStyle = { border: 0, background: '#eef2ff', color: '#3730a3', padding: '9px 13px', borderRadius: 10, fontWeight: 700 }
