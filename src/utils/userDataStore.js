import { getDashboardData } from './dashboardData.js'

const USER_DATA_KEY_PREFIX = 'lessontrack_user_data'

function getUserDataKey(userId) {
  return `${USER_DATA_KEY_PREFIX}:${encodeURIComponent(String(userId || 'anonymous'))}`
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data))
}

function createUserContext({ id, userId, username, role } = {}) {
  const normalizedRole = ['admin', 'teacher', 'user'].includes(role) ? role : 'user'
  const normalizedUsername = String(username || userId || id || '').trim()
  const normalizedId = String(id || userId || normalizedUsername || 'anonymous').trim()

  return {
    id: normalizedId,
    username: normalizedUsername || normalizedId,
    role: normalizedRole,
  }
}

export function createEmptyUserData() {
  return getDashboardData(createUserContext())
}

export function getInitialUserData(userContext) {
  return getDashboardData(createUserContext(userContext))
}

export function getUserData(userId) {
  try {
    const value = localStorage.getItem(getUserDataKey(userId))
    if (!value) return createEmptyUserData()
    const data = JSON.parse(value)
    return data && typeof data === 'object' && !Array.isArray(data) ? data : createEmptyUserData()
  } catch {
    return createEmptyUserData()
  }
}

export function saveUserData(userId, data) {
  const nextData = data && typeof data === 'object' && !Array.isArray(data) ? data : createEmptyUserData()
  localStorage.setItem(getUserDataKey(userId), JSON.stringify(nextData))
  return cloneData(nextData)
}

export function ensureUserData(userContext) {
  const user = createUserContext(userContext)
  const existingValue = localStorage.getItem(getUserDataKey(user.id))
  if (existingValue) return getUserData(user.id)

  return saveUserData(user.id, getInitialUserData(user))
}
