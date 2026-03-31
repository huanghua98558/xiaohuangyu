/**
 * 用户相关API
 */

const API_BASE = '/api'

function getAuthHeaders() {
  const token = localStorage.getItem('xiaohuangyu_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }
}

/**
 * 更新用户位置
 * @param {string} province - 省份
 * @param {string} city - 城市
 */
export async function updateUserLocation(province, city) {
  try {
    const response = await fetch(`${API_BASE}/user/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ province, city })
    })
    
    const result = await response.json()
    
    if (result.code === 0) {
      console.log('[API] 位置更新成功:', province, city)
      return true
    } else {
      console.warn('[API] 位置更新失败:', result.message)
      return false
    }
  } catch (e) {
    console.warn('[API] 位置更新请求失败:', e.message)
    return false
  }
}

/**
 * 获取用户信息
 */
export async function getUserInfo() {
  try {
    const response = await fetch(`${API_BASE}/user/me`, {
      headers: getAuthHeaders()
    })
    const result = await response.json()
    if (result.code === 0) {
      return result.data
    }
    return null
  } catch (e) {
    console.warn('[API] 获取用户信息失败:', e.message)
    return null
  }
}

export default {
  updateUserLocation,
  getUserInfo
}
