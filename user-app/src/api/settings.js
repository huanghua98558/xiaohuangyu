const BASE = (typeof window !== 'undefined' && window.__API_BASE__)
  || import.meta.env.VITE_API_BASE
  || '/api'
const TOKEN_KEY = 'xiaohuangyu_token'
const SETTINGS_KEY = 'xiaohuangyu_notification_settings'

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

export function fetchNotificationSettings() {
  return request('/settings/notifications').then((data) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
    }
    return data
  })
}

export function saveNotificationSettings(payload) {
  return request('/settings/notifications', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((data) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
    }
    return data
  })
}
