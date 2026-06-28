import { useEffect } from 'react'
import { lockBodyScroll } from '../utils/scrollLock'

export default function ConfirmDialog({ open, title = '确认操作', description, confirmText = '确认', cancelText = '取消', confirmDisabled = false, hideConfirm = false, tone = 'danger', onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined
    return lockBodyScroll()
  }, [open])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(15, 23, 42, 0.45)', display: 'grid', placeItems: 'center', padding: 20, boxSizing: 'border-box' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: 'min(100%, 440px)', background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 20px 48px rgba(15, 23, 42, 0.28)' }}
      >
        <h2 style={{ marginTop: 0, fontSize: 19 }}>{title}</h2>
        <p style={{ color: '#4b5563', lineHeight: 1.6 }}>{description}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button type="button" onClick={onCancel} style={hideConfirm && tone === 'primary' ? singlePrimaryButtonStyle : cancelButtonStyle}>{cancelText}</button>
          {!hideConfirm && <button type="button" onClick={onConfirm} disabled={confirmDisabled} style={{ ...confirmButtonStyle, background: tone === 'danger' ? '#dc2626' : '#2563eb' }}>{confirmText}</button>}
        </div>
      </section>
    </div>
  )
}

const cancelButtonStyle = { border: 0, background: '#f1f5f9', color: '#475569', padding: '10px 16px', borderRadius: 10, fontWeight: 700 }
const confirmButtonStyle = { border: 0, color: '#fff', padding: '10px 17px', borderRadius: 10, fontWeight: 700, boxShadow: '0 5px 12px rgba(37, 99, 235, 0.2)' }
const singlePrimaryButtonStyle = { ...confirmButtonStyle, background: '#2563eb' }
