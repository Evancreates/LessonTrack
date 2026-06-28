import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authenticateUser, getAuthSession } from '../utils/storage'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getAuthSession()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
        <div style={sceneStyle} aria-hidden="true">
          <div style={browserStyle}>
            <div style={browserDotsStyle}><span /><span /><span /></div>
            <div style={chartPanelStyle}>
              <span style={{ ...chartBarStyle, height: 62 }} />
              <span style={{ ...chartBarStyle, height: 94 }} />
              <span style={{ ...chartBarStyle, height: 78 }} />
              <span style={{ ...chartBarStyle, height: 118 }} />
            </div>
            <div style={studentCardStyle}>
              <span style={avatarStyle} />
              <span style={cardLineStyle} />
              <span style={{ ...cardLineStyle, width: 78, opacity: .55 }} />
            </div>
            <div style={calendarStyle}>
              <span style={calendarRingStyle} />
              <span style={{ ...calendarRingStyle, left: 74 }} />
              {[0, 1, 2, 3, 4, 5].map((item) => <span key={item} style={calendarCheckStyle}>✓</span>)}
            </div>
          </div>
          <div style={capStyle}><span style={capTopStyle} /><span style={capTailStyle} /></div>
          <div style={cloudStyle}>↑</div>
          <div style={floatingCardStyle} />
        </div>
        <div style={copyBlockStyle}>
          <strong style={heroTitleStyle}>流畅的课堂考勤管理工具</strong>
          <p style={heroSubtitleStyle}>课程管理、学生考勤、教师点名，一站式轻松搞定</p>
          <div style={featureRowStyle}>
            <FeaturePill icon="♙" label="简单易用" />
            <FeaturePill icon="✓" label="高效准确" />
            <FeaturePill icon="◈" label="数据安全" />
            <FeaturePill icon="↻" label="实时同步" />
          </div>
        </div>
      </section>

      <section className="login-panel" style={loginPanelStyle}>
        <form onSubmit={handleSubmit} style={formStyle}>
          <div>
            <h2 style={formTitleStyle}>登录后台</h2>
            <p style={subtleStyle}>请输入账号和密码。</p>
          </div>
          <label style={labelStyle}>账号<span style={inputWrapStyle}><UserIcon /><input value={form.username} onChange={(event) => updateField('username', event.target.value)} autoComplete="username" placeholder="请输入账号" style={inputStyle} /></span></label>
          <label style={labelStyle}>密码<span style={inputWrapStyle}><LockIcon /><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => updateField('password', event.target.value)} autoComplete="current-password" placeholder="请输入密码" style={{ ...inputStyle, paddingRight: 44 }} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? '隐藏密码' : '显示密码'} style={eyeButtonStyle}><EyeIcon active={showPassword} /></button></span></label>
          {error && <p style={errorStyle}>{error}</p>}
          <button type="submit" style={primaryButtonStyle}>进入系统</button>
        </form>
      </section>
    </main>
  )
}

function FeaturePill({ icon, label }) {
  return <span style={featurePillStyle}><span style={featureIconStyle}>{icon}</span>{label}</span>
}

function UserIcon() {
  return <svg style={inputIconStyle} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></svg>
}

function LockIcon() {
  return <svg style={inputIconStyle} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
}

function EyeIcon({ active }) {
  return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{!active && <path d="M4 4l16 16" />}</svg>
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

const pageStyle = { minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.08fr) minmax(420px, .92fr)', background: '#f7faff', color: '#1e293b', fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif' }
const heroStyle = { position: 'relative', overflow: 'hidden', minHeight: '100vh', padding: '46px 54px 36px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'radial-gradient(circle at 18% 8%, rgba(255,255,255,.55), transparent 31%), linear-gradient(135deg, #1d8bff 0%, #2d6bff 47%, #9c8cff 100%)', color: '#fff' }
const brandBlockStyle = { display: 'flex', alignItems: 'center', gap: 13, position: 'relative', zIndex: 1 }
const brandMarkStyle = { width: 54, height: 54, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg, #1f6fff, #173ee9)', boxShadow: '0 18px 35px rgba(17, 78, 235, .3), inset 0 0 0 1px rgba(255,255,255,.35)', fontSize: 30, fontWeight: 900 }
const brandTitleStyle = { margin: 0, fontSize: 31, lineHeight: 1, letterSpacing: 1, color: '#16324d' }
const brandSubTitleStyle = { margin: '8px 0 0', color: '#314963', fontSize: 13, fontWeight: 700 }
const sceneStyle = { position: 'relative', zIndex: 1, alignSelf: 'center', width: 'min(560px, 86%)', height: 320, marginTop: 20 }
const browserStyle = { position: 'absolute', left: 24, bottom: 18, width: 390, height: 230, borderRadius: 20, background: 'linear-gradient(145deg, rgba(255,255,255,.96), rgba(222,235,255,.86))', boxShadow: '0 34px 70px rgba(25, 79, 210, .3)', transform: 'perspective(700px) rotateX(4deg) rotateY(-9deg)' }
const browserDotsStyle = { position: 'absolute', top: 20, left: 22, display: 'flex', gap: 8, color: '#93b4ff' }
const chartPanelStyle = { position: 'absolute', left: 38, bottom: 38, width: 160, height: 124, borderRadius: 15, background: 'rgba(235,242,255,.94)', display: 'flex', alignItems: 'end', gap: 13, padding: '16px 19px', boxSizing: 'border-box' }
const chartBarStyle = { width: 18, borderRadius: 8, background: 'linear-gradient(180deg, #86b6ff, #2365ff)' }
const studentCardStyle = { position: 'absolute', right: 58, top: 52, width: 142, height: 70, borderRadius: 14, background: 'rgba(255,255,255,.82)', boxShadow: '0 14px 32px rgba(79, 104, 205, .18)' }
const avatarStyle = { position: 'absolute', left: 15, top: 18, width: 33, height: 33, borderRadius: '50%', background: 'linear-gradient(135deg, #ffd0ac, #6e8cff)' }
const cardLineStyle = { position: 'absolute', left: 58, top: 22, width: 62, height: 9, borderRadius: 99, background: '#a9bdf5' }
const calendarStyle = { position: 'absolute', right: 18, bottom: 18, width: 148, height: 110, borderRadius: 18, background: 'linear-gradient(160deg, #ffffff, #dce8ff)', boxShadow: '0 18px 38px rgba(26, 75, 204, .2)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '30px 18px 16px', boxSizing: 'border-box' }
const calendarRingStyle = { position: 'absolute', top: -10, left: 44, width: 10, height: 28, borderRadius: 99, background: '#6b91ff' }
const calendarCheckStyle = { display: 'grid', placeItems: 'center', borderRadius: 8, background: '#edf4ff', color: '#2b6cff', fontWeight: 900 }
const capStyle = { position: 'absolute', left: 225, top: 20, width: 130, height: 88, transform: 'rotate(31deg)' }
const capTopStyle = { position: 'absolute', inset: '10px 6px 28px', borderRadius: 10, background: 'linear-gradient(145deg, #6195ff, #1758ef)', boxShadow: '0 18px 34px rgba(31, 95, 230, .24)' }
const capTailStyle = { position: 'absolute', right: 6, bottom: 4, width: 5, height: 58, borderRadius: 99, background: '#ffc241' }
const cloudStyle = { position: 'absolute', right: 22, bottom: 76, width: 78, height: 56, display: 'grid', placeItems: 'center', borderRadius: 24, background: 'rgba(255,255,255,.32)', color: '#fff', fontSize: 30, fontWeight: 900, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.28)' }
const floatingCardStyle = { position: 'absolute', right: 52, top: 70, width: 118, height: 66, borderRadius: 12, background: 'rgba(255,255,255,.28)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)' }
const copyBlockStyle = { position: 'relative', zIndex: 1, display: 'grid', gap: 12, maxWidth: 610 }
const heroTitleStyle = { fontSize: 39, lineHeight: 1.12, letterSpacing: 0, maxWidth: 620 }
const heroSubtitleStyle = { margin: 0, color: 'rgba(255,255,255,.9)', fontSize: 17, fontWeight: 700 }
const featureRowStyle = { display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 16 }
const featurePillStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.92)', fontSize: 14, fontWeight: 750 }
const featureIconStyle = { width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'rgba(255,255,255,.2)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.24)' }
const loginPanelStyle = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 32, boxSizing: 'border-box', background: 'linear-gradient(135deg, #ffffff 0%, #f6f9ff 100%)' }
const formStyle = { width: '100%', maxWidth: 430, display: 'grid', gap: 20, padding: 32, borderRadius: 24, background: 'rgba(255,255,255,.92)', boxShadow: '0 26px 70px rgba(35, 70, 130, .13)', border: '1px solid #dce7f6' }
const formTitleStyle = { margin: 0, fontSize: 30, letterSpacing: 0, color: '#12213a' }
const subtleStyle = { margin: '9px 0 0', color: '#71829a', fontSize: 14 }
const labelStyle = { display: 'grid', gap: 9, color: '#25364d', fontSize: 14, fontWeight: 800 }
const inputWrapStyle = { position: 'relative', display: 'block' }
const inputIconStyle = { position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', width: 19, height: 19, color: '#9aaabd', pointerEvents: 'none' }
const inputStyle = { boxSizing: 'border-box', width: '100%', height: 48, padding: '0 14px 0 46px', border: '1px solid #d8e2f0', borderRadius: 12, outline: 'none', color: '#1e293b', background: '#fff', font: 'inherit', fontWeight: 600, boxShadow: '0 8px 22px rgba(30, 64, 175, .04)' }
const eyeButtonStyle = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, border: 0, display: 'grid', placeItems: 'center', color: '#9aaabd', background: 'transparent' }
const errorStyle = { margin: 0, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 700 }
const primaryButtonStyle = { height: 50, border: 0, borderRadius: 12, background: 'linear-gradient(135deg, #2d70ff, #1d57ef)', color: '#fff', fontWeight: 900, boxShadow: '0 15px 34px rgba(37, 99, 235, .26)' }
