// 签到相关 API

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

// 获取签到状态
export async function getSignInStatus() {
  const { data } = await request('/sign-in/status')
  return data
}

// 签到
export async function signIn() {
  const { data, message } = await request('/sign-in', {
    method: 'POST'
  })
  return { data, message }
}

// 获取签到日历
export async function getSignInCalendar(year, month) {
  const query = year && month ? `?year=${year}&month=${month}` : ''
  const { data } = await request(`/sign-in/calendar${query}`)
  return data
}
