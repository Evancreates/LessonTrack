import { getCurrentRole } from '../utils/storage'

export default function RoleGuard({ allowedRole, allowedRoles, children }) {
  const currentRole = getCurrentRole()

  if ((allowedRoles || [allowedRole]).includes(currentRole.role)) return children

  return (
    <section>
      <h1>无访问权限</h1>
      <p style={{ color: '#6b7280' }}>当前角色无权访问此模块。</p>
    </section>
  )
}
