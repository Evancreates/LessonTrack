import { ADMIN_USERNAME } from './dashboardData.js'

export const USER_ROLES = {
  admin: 'admin',
  teacher: 'teacher',
  user: 'user',
}

export function createUserContext({ id, userId, username, role } = {}) {
  const normalizedRole = Object.values(USER_ROLES).includes(role) ? role : USER_ROLES.user
  const normalizedUsername = String(username || userId || id || '').trim()
  const normalizedId = String(id || userId || normalizedUsername || 'anonymous').trim()

  return {
    id: normalizedId,
    username: normalizedUsername || normalizedId,
    role: normalizedRole,
  }
}

export function createAdminUserContext(username = ADMIN_USERNAME) {
  return createUserContext({
    id: ADMIN_USERNAME,
    username,
    role: USER_ROLES.admin,
  })
}

export function createTeacherUserContext(teacher) {
  return createUserContext({
    id: teacher?.id,
    username: teacher?.username,
    role: USER_ROLES.teacher,
  })
}
