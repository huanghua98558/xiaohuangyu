const BASE = (typeof window !== 'undefined' && window.__API_BASE__)
  || import.meta.env.VITE_API_BASE
  || '/api'
const TOKEN_KEY = 'xiaohuangyu_token'

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(BASE + url, { ...options, headers })
  const json = await res.json().catch(() => ({}))

  if (res.ok && json.code === 0) {
    return json.data
  }

  throw new Error(json.message || '请求失败')
}

export function fetchAdminNotifications({ page = 1, size = 20, unreadOnly = false } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  })
  if (unreadOnly) params.set('unreadOnly', 'true')
  return request(`/admin-v2/admin-notifications?${params.toString()}`)
}

export function fetchAdminNotificationUnreadCount() {
  return request('/admin-v2/admin-notifications/unread-count')
}

export function markAdminNotificationRead(id) {
  return request(`/admin-v2/admin-notifications/${id}/read`, {
    method: 'POST',
  })
}

export function markAllAdminNotificationsRead() {
  return request('/admin-v2/admin-notifications/read-all', {
    method: 'POST',
  })
}

export function fetchAdminAlerts({ page = 1, pageSize = 20, status = 'pending' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (status) params.set('status', status)
  return request(`/admin-v2/alerts?${params.toString()}`)
}

export function fetchAdminAlertStats() {
  return request('/admin-v2/alerts/stats')
}

export function handleAdminAlert(id, payload) {
  return request(`/admin-v2/alerts/${id}/handle`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
