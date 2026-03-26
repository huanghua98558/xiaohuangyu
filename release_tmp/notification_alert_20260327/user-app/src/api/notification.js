// 消息通知相关 API

const BASE = (typeof window !== 'undefined' && window.__API_BASE__) 
  || import.meta.env.VITE_API_BASE 
  || '/api'
const TOKEN_KEY = 'xiaohuangyu_token'

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  const res = await fetch(BASE + url, { ...options, headers })
  const json = await res.json().catch(() => ({}))
  
  if (res.ok && json.code === 0) {
    return json
  }
  
  throw new Error(json.message || '请求失败')
}

// 获取通知列表
export async function fetchNotifications(params = {}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', params.page)
  if (params.size) query.set('pageSize', params.size)
  if (params.unreadOnly) query.set('unreadOnly', 'true')
  if (params.type) query.set('type', params.type)
  const queryString = query.toString() ? `?${query.toString()}` : ''
  const { data } = await request(`/user-notifications${queryString}`)
  return data
}

// 获取未读数量
export async function fetchUnreadCount() {
  const { data } = await request('/user-notifications/unread-count')
  return Number(data?.count || 0)
}

// 标记已读
export async function markAsRead(id) {
  const { data, message } = await request(`/user-notifications/${id}/read`, {
    method: 'POST'
  })
  return { data, message }
}

// 标记全部已读
export async function markAllRead() {
  const { data, message } = await request('/user-notifications/read-all', {
    method: 'POST'
  })
  return { data, message }
}

// 删除通知
export async function deleteNotification(id) {
  const { data, message } = await request(`/user-notifications/${id}`, {
    method: 'DELETE'
  })
  return { data, message }
}
