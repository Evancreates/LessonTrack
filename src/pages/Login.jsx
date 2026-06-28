import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authenticateUser, getAuthSession } from '../utils/storage'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getAuthSession()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')

  if (session) return <Navigate to={session.role === 'admin' ? '/' : '/my-courses'} replace />

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const result = authenticateUser(form)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onLogin()
    const fromPath = location.state?.from?.pathname
    navigate(getRedirectPath(result, fromPath), { replace: true })
  }

  return (
    <main className="login-page" style={pageStyle}>
      <section className="login-hero" style={heroStyle}>
        <div style={brandBlockStyle}>
          <span style={brandMarkStyle}>迹</span>
          <div>
            <h1 style={brandTitleStyle}>课迹</h1>
            <p style={brandSubTitleStyle}>教学运营工作台</p>
          </div>
        </div>
        <div style={copyBlockStyle}>
          <span style={eyebrowStyle}>Haiyne Education</span>
          <strong style={heroTitleStyle}>课程、学生、教师和点名数据统一管理</strong>
        </div>
      </section>

      <section className="login-panel" style={loginPanelStyle}>
        <form onSubmit={handleSubmit} style={formStyle}>
          <div>
            <h2 style={formTitleStyle}>登录后台</h2>
            <p style={subtleStyle}>请输入账号和密码。</p>
          </div>
          <label style={labelStyle}>账号<input value={form.username} onChange={(event) => updateField('username', event.target.value)} autoComplete="username" style={inputStyle} /></label>
          <label style={labelStyle}>密码<input type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} autoComplete="current-password" style={inputStyle} /></label>
          {error && <p style={errorStyle}>{error}</p>}
          <button type="submit" style={primaryButtonStyle}>进入系统</button>
        </form>
      </section>
    </main>
  )
}

function getRedirectPath(result, fromPath) {
  if (!fromPath || fromPath === '/login') return result.redirectPath
  if (result.session.role === 'teacher') {
    return ['/my-courses', '/my-students', '/attendance', '/student'].some((path) => fromPath.startsWith(path))
      ? fromPath
      : result.redirectPath
  }
  return ['/my-courses', '/my-students'].some((path) => fromPath.startsWith(path))
    ? result.redirectPath
    : fromPath
}

const pageStyle = { minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(420px, .95fr)', background: '#eef4f8', color: '#1e293b', fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif' }
const heroStyle = { position: 'relative', overflow: 'hidden', minHeight: '100vh', padding: '48px 56px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg, #0f766e 0%, #2563eb 58%, #f59e0b 130%)', color: '#fff' }
const brandBlockStyle = { display: 'flex', alignItems: 'center', gap: 13, position: 'relative', zIndex: 1 }
const brandMarkStyle = { width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(255, 255, 255, .18)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.3)', fontSize: 24, fontWeight: 900 }
const brandTitleStyle = { margin: 0, fontSize: 30, letterSpacing: 1 }
const brandSubTitleStyle = { margin: '3px 0 0', color: 'rgba(255,255,255,.76)', fontSize: 13 }
const copyBlockStyle = { position: 'relative', zIndex: 1, display: 'grid', gap: 16, maxWidth: 540 }
const eyebrowStyle = { color: 'rgba(255,255,255,.72)', fontSize: 13, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }
const heroTitleStyle = { fontSize: 45, lineHeight: 1.12, letterSpacing: 0, maxWidth: 620 }
const loginPanelStyle = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 32, boxSizing: 'border-box', background: '#f8fafc' }
const formStyle = { width: '100%', maxWidth: 410, display: 'grid', gap: 18, padding: 30, borderRadius: 16, background: '#fff', boxShadow: '0 24px 70px rgba(15, 23, 42, .12)', border: '1px solid #e2e8f0' }
const formTitleStyle = { margin: 0, fontSize: 28, letterSpacing: 0 }
const subtleStyle = { margin: '7px 0 0', color: '#64748b', fontSize: 14 }
const labelStyle = { display: 'grid', gap: 8, color: '#475569', fontSize: 14, fontWeight: 700 }
const inputStyle = { boxSizing: 'border-box', width: '100%', height: 46, padding: '0 13px', border: '1px solid #d8e2f0', borderRadius: 10, outline: 'none', color: '#1e293b', background: '#fff', font: 'inherit', fontWeight: 500 }
const errorStyle = { margin: 0, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 700 }
const primaryButtonStyle = { height: 46, border: 0, borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 800, boxShadow: '0 10px 24px rgba(37, 99, 235, .26)' }
