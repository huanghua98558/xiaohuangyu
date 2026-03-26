// 成就相关 API

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

// 获取成就列表
export async function getAchievements() {
  const { data } = await request('/achievements')
  return data
}

// 获取用户成就（别名）
export const getUserAchievements = getAchievements

// 获取成就统计
export async function getAchievementStats() {
  const { data } = await request('/achievements/stats')
  return data
}

// 领取成就奖励
export async function claimAchievementReward(achievementId) {
  const { data, message } = await request(`/achievements/${achievementId}/claim`, {
    method: 'POST'
  })
  return { data, message }
}
