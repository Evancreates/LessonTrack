import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ConfirmDialog from './ConfirmDialog'
import Drawer from './Drawer'
import ScrollJumpButtons from './ScrollJumpButtons'
import {
  clearAuthSession,
  generateTeacherNo,
  getAdminAccount,
  getCurrentRole,
  getSettings,
  getTeachers,
  saveSettings,
  saveTeachers,
  updateAdminAccount,
} from '../utils/storage'

const adminNavigation = [
  { to: '/', label: '总览', end: true },
  { to: '/courses', label: '课程管理' },
  { to: '/teachers', label: '教师管理' },
  { to: '/students', label: '学生管理' },
  { to: '/attendance', label: '点名管理' },
]

const teacherNavigation = [
  { to: '/my-courses', label: '我的课程' },
  { to: '/my-students', label: '我的学生' },
  { to: '/attendance', label: '课堂点名' },
]

export default function Layout({ onRoleChange, onAuthChange }) {
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPanel, setSettingsPanel] = useState('menu')
  const [settingsForm, setSettingsForm] = useState(() => getSettings())
  const [settingsError, setSettingsError] = useState('')
  const [roleForm, setRoleForm] = useState({ name: '', username: '', password: '' })
  const [roleError, setRoleError] = useState('')
  const [passwordForm, setPasswordForm] = useState({ username: '', currentPassword: '', nextPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  const [utilityMessage, setUtilityMessage] = useState(null)
  const currentRole = getCurrentRole()
  const teachers = getTeachers()
  const currentTeacher = currentRole.role === 'teacher' ? teachers.find((teacher) => teacher.id === currentRole.userId) : null
  const navigation = currentRole.role === 'admin' ? adminNavigation : teacherNavigation

  const openSettings = () => {
    setSettingsForm(getSettings())
    setSettingsPanel('menu')
    setSettingsError('')
    setRoleError('')
    setPasswordError('')
    setSettingsOpen(true)
  }

  const openPasswordSettings = () => {
    if (currentRole.role !== 'admin') {
      setUtilityMessage({ title: '修改密码', description: '教师账号密码请由管理员在角色管理中维护。' })
      return
    }
    const adminAccount = getAdminAccount()
    setPasswordForm({ username: adminAccount.username, currentPassword: '', nextPassword: '', confirmPassword: '' })
    setPasswordError('')
    setSettingsPanel('password')
    setSettingsOpen(true)
  }

  const saveCourseSettings = (event) => {
    event.preventDefault()
    if (!settingsForm.defaultCourseStartTime || !settingsForm.defaultCourseEndTime || settingsForm.defaultCourseStartTime >= settingsForm.defaultCourseEndTime) {
      setSettingsError('请设置有效的默认开始和结束时间。')
      return
    }
    saveSettings(settingsForm)
    setSettingsError('')
    setUtilityMessage({ title: '课程设置已保存', description: '新增课程时，点击日期会自动带入默认上课时间。' })
    onRoleChange()
  }

  const saveNewTeacher = (event) => {
    event.preventDefault()
    const name = roleForm.name.trim()
    const username = roleForm.username.trim()
    const password = roleForm.password
    if (!name || !username || !password) {
      setRoleError('请填写教师姓名、账户名称和初始密码。')
      return
    }
    if (teachers.some((teacher) => teacher.name.trim().toLowerCase() === name.toLowerCase())) {
      setRoleError('教师姓名已存在。')
      return
    }
    if (teachers.some((teacher) => String(teacher.username || '').trim().toLowerCase() === username.toLowerCase())) {
      setRoleError('账户名称已存在。')
      return
    }
    if (getAdminAccount().username.toLowerCase() === username.toLowerCase()) {
      setRoleError('账户名称已被管理员使用。')
      return
    }
    saveTeachers([...teachers, { id: uuidv4(), teacherNo: generateTeacherNo(), name, username, password, courseIds: [] }])
    setRoleForm({ name: '', username: '', password: '' })
    setRoleError('')
    setUtilityMessage({ title: '教师角色已新增', description: `已新增教师“${name}”，可在教师管理中分配课程。` })
    onRoleChange()
  }

  const savePasswordSettings = (event) => {
    event.preventDefault()
    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setPasswordError('两次输入的新密码不一致。')
      return
    }
    const result = updateAdminAccount(passwordForm)
    if (!result.ok) {
      setPasswordError(result.message)
      return
    }
    setPasswordForm((current) => ({ ...current, currentPassword: '', nextPassword: '', confirmPassword: '' }))
    setPasswordError('')
    setUtilityMessage({ title: '登录密码已更新', description: '下次登录请使用新的管理员账号和密码。' })
  }

  const logout = () => {
    clearAuthSession()
    onAuthChange()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', color: '#1e293b', fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif' }}>
      <aside style={asideStyle}>
        <div style={{ display: 'grid', gap: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #4f46e5)', color: '#fff', fontWeight: 800 }}>迹</span><strong style={{ display: 'block', fontSize: 23, letterSpacing: 1, color: '#1d4ed8' }}>课迹</strong></div>
            <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 39 }}>教学运营工作台</span>
          </div>
          <section style={identityCardStyle}>
            <span style={{ color: '#64748b', fontSize: 12, fontWeight: 750 }}>当前账号</span>
            <strong style={{ marginTop: 4, color: '#1e293b' }}>{currentRole.role === 'admin' ? '管理员' : currentTeacher?.name || '教师'}</strong>
            <small style={{ marginTop: 2, color: '#94a3b8' }}>{currentRole.role === 'admin' ? 'Admin' : currentTeacher?.teacherNo || 'Teacher'}</small>
          </section>
          <nav style={{ display: 'grid', gap: 6 }}>
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  textDecoration: 'none',
                  padding: '11px 12px',
                  borderRadius: 10,
                  color: isActive ? '#fff' : '#475569',
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? '#2563eb' : 'transparent',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div style={bottomMenuStyle}>
          <UtilityButton label="设置" onClick={openSettings}><SettingsIcon /></UtilityButton>
          <UtilityButton label="修改密码" onClick={openPasswordSettings}><PasswordIcon /></UtilityButton>
          <UtilityButton label="退出登录" onClick={logout}><LogoutIcon /></UtilityButton>
        </div>
      </aside>
      <main style={{ minWidth: 0, padding: '28px 32px 96px', marginLeft: 250 }}>
        <div style={{ maxWidth: 1440, margin: '0 auto' }}><Outlet /></div>
      </main>
      <ScrollJumpButtons />
      <Drawer open={settingsOpen} title="设置" onClose={() => setSettingsOpen(false)}>
        {settingsPanel === 'menu' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <button type="button" onClick={() => setSettingsPanel('course')} style={settingsMenuButtonStyle}>课程设置</button>
            <button type="button" onClick={() => setSettingsPanel('roles')} style={settingsMenuButtonStyle}>角色管理</button>
            {currentRole.role === 'admin' && <button type="button" onClick={openPasswordSettings} style={settingsMenuButtonStyle}>登录密码</button>}
          </div>
        ) : settingsPanel === 'course' ? (
          <form onSubmit={saveCourseSettings} style={{ display: 'grid', gap: 18 }}>
            <button type="button" onClick={() => setSettingsPanel('menu')} style={secondaryButtonStyle}>返回设置</button>
            <section style={settingsPanelStyle}>
              <h3 style={{ margin: 0, fontSize: 18 }}>默认课程时间设置</h3>
              <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13 }}>新增课程时，点击日期后会自动带入这里设置的默认时间，仍可在课程表中单独修改。</p>
            </section>
            <label style={labelStyle}>默认开始时间<input type="time" value={settingsForm.defaultCourseStartTime} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultCourseStartTime: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>默认结束时间<input type="time" value={settingsForm.defaultCourseEndTime} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultCourseEndTime: event.target.value }))} style={inputStyle} /></label>
            {settingsError && <p style={{ margin: 0, color: '#dc2626' }}>{settingsError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="submit" style={primaryButtonStyle}>保存课程设置</button></div>
          </form>
        ) : settingsPanel === 'roles' ? (
          <form onSubmit={saveNewTeacher} style={{ display: 'grid', gap: 18 }}>
            <button type="button" onClick={() => setSettingsPanel('menu')} style={secondaryButtonStyle}>返回设置</button>
            <section style={settingsPanelStyle}>
              <h3 style={{ margin: 0, fontSize: 18 }}>角色管理</h3>
              <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13 }}>新增教师角色后，可在教师管理中分配课程。</p>
            </section>
            <label style={labelStyle}>教师姓名<input value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>账户名称<input value={roleForm.username} onChange={(event) => setRoleForm((current) => ({ ...current, username: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>初始密码<input type="password" value={roleForm.password} onChange={(event) => setRoleForm((current) => ({ ...current, password: event.target.value }))} style={inputStyle} /></label>
            {roleError && <p style={{ margin: 0, color: '#dc2626' }}>{roleError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="submit" style={primaryButtonStyle}>新增教师角色</button></div>
          </form>
        ) : (
          <form onSubmit={savePasswordSettings} style={{ display: 'grid', gap: 18 }}>
            <button type="button" onClick={() => setSettingsPanel('menu')} style={secondaryButtonStyle}>返回设置</button>
            <section style={settingsPanelStyle}>
              <h3 style={{ margin: 0, fontSize: 18 }}>管理员登录密码</h3>
              <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13 }}>修改后会立即用于登录页校验。</p>
            </section>
            <label style={labelStyle}>管理员账号<input value={passwordForm.username} onChange={(event) => setPasswordForm((current) => ({ ...current, username: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>当前密码<input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>新密码<input type="password" value={passwordForm.nextPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>确认新密码<input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} style={inputStyle} /></label>
            {passwordError && <p style={{ margin: 0, color: '#dc2626' }}>{passwordError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="submit" style={primaryButtonStyle}>保存登录密码</button></div>
          </form>
        )}
      </Drawer>
      <ConfirmDialog
        open={Boolean(utilityMessage)}
        title={utilityMessage?.title || ''}
        description={utilityMessage?.description || ''}
        cancelText="知道了"
        hideConfirm
        tone="primary"
        onCancel={() => setUtilityMessage(null)}
      />
    </div>
  )
}

function UtilityButton({ label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="sidebar-tool" style={iconButtonStyle}>
      {children}
      <span className="sidebar-tooltip">{label}</span>
    </button>
  )
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .63l-.03.08a2 2 0 1 1-3.94 0L10 20a1.7 1.7 0 0 0-1-.63 1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-.63-1l-.08-.03a2 2 0 1 1 0-3.94L4 10a1.7 1.7 0 0 0 .63-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-.63l.03-.08a2 2 0 1 1 3.94 0L14 4a1.7 1.7 0 0 0 1 .63 1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.37 9c.27.38.48.72.63 1l.08.03a2 2 0 1 1 0 3.94L20 14c-.15.28-.36.62-.6 1Z" /></svg>
}

function PasswordIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v2" /></svg>
}

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-5" /></svg>
}

const asideStyle = { position: 'fixed', inset: '0 auto 0 0', zIndex: 10, width: 250, height: '100vh', flexShrink: 0, padding: '24px 16px', boxSizing: 'border-box', background: '#fff', borderRight: '1px solid #e7edf5', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 28, overflowY: 'auto' }
const identityCardStyle = { display: 'grid', padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e7edf5' }
const bottomMenuStyle = { display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 16, borderTop: '1px solid #e7edf5' }
const iconButtonStyle = { width: 42, height: 40, border: 0, borderRadius: 10, background: '#f1f5f9', color: '#475569', display: 'grid', placeItems: 'center' }
const settingsMenuButtonStyle = { width: '100%', border: 0, borderRadius: 12, padding: '14px 16px', background: '#eff6ff', color: '#1d4ed8', textAlign: 'left', fontWeight: 800 }
const settingsPanelStyle = { padding: 16, borderRadius: 14, background: '#f8fafc' }
const labelStyle = { display: 'grid', gap: 7, color: '#475569', fontSize: 14, fontWeight: 650 }
const inputStyle = { boxSizing: 'border-box', width: '100%', height: 43, padding: '0 12px', border: '1px solid #d8e2f0', borderRadius: 10, font: 'inherit' }
const primaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 17px', background: '#2563eb', color: '#fff', fontWeight: 750, boxShadow: '0 5px 14px rgba(37, 99, 235, .2)' }
const secondaryButtonStyle = { justifySelf: 'start', border: 0, borderRadius: 10, padding: '10px 14px', background: '#eef2f7', color: '#475569', fontWeight: 700 }
