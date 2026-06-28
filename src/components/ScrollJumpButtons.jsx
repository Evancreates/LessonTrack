import { useEffect, useState } from 'react'

export default function ScrollJumpButtons() {
  const [state, setState] = useState({ show: false, nearTop: true, nearBottom: false })

  useEffect(() => {
    const update = () => {
      const scrollHeight = document.documentElement.scrollHeight
      const viewportHeight = window.innerHeight
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollable = scrollHeight - viewportHeight > 520
      setState({
        show: scrollable,
        nearTop: scrollTop < 160,
        nearBottom: scrollTop + viewportHeight > scrollHeight - 160,
      })
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  if (!state.show) return null

  return (
    <div style={wrapStyle} aria-label="页面快速滚动">
      <button
        type="button"
        disabled={state.nearTop}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{ ...buttonStyle, opacity: state.nearTop ? 0.45 : 1 }}
      >
        顶部
      </button>
      <button
        type="button"
        disabled={state.nearBottom}
        onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
        style={{ ...buttonStyle, opacity: state.nearBottom ? 0.45 : 1 }}
      >
        底部
      </button>
    </div>
  )
}

const wrapStyle = {
  position: 'fixed',
  right: 24,
  bottom: 24,
  zIndex: 12,
  display: 'grid',
  gap: 8,
  padding: 8,
  borderRadius: 16,
  background: 'rgba(255,255,255,.88)',
  boxShadow: '0 14px 34px rgba(15, 23, 42, .16)',
  backdropFilter: 'blur(12px)',
}

const buttonStyle = {
  border: 0,
  minWidth: 58,
  padding: '9px 12px',
  borderRadius: 11,
  background: '#2563eb',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}
