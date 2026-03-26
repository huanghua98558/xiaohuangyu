/**
 * 用户位置管理 - GPS优先策略
 * 1. localStorage缓存（24小时）
 * 2. GPS定位 + 地理编码（优先，最准确）
 * 3. IP定位（GPS失败后的备用方案）
 * 4. 手动选择城市
 * 
 * V2.0 新增：位置上报到服务器
 */

const LOCATION_KEY = 'xiaohuangyu_location'
const LOCATION_EXPIRE = 24 * 60 * 60 * 1000 // 24小时缓存

// 手动选择回调（由外部设置）
let manualSelectCallback = null

/**
 * 设置手动选择城市回调
 * @param {Function} callback 当需要手动选择城市时调用
 */
export function setManualSelectCallback(callback) {
  manualSelectCallback = callback
}

/**
 * 检测是否在微信环境
 */
export function isWechat() {
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('micromessenger')
}

/**
 * 获取保存的用户位置
 */
export function getSavedLocation() {
  try {
    const saved = localStorage.getItem(LOCATION_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      // 检查是否过期
      if (Date.now() - data.timestamp < LOCATION_EXPIRE) {
        return data
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

/**
 * 保存用户位置（本地 + 上报到服务器）
 */
export async function saveLocation(location) {
  try {
    // 保存到本地存储
    localStorage.setItem(LOCATION_KEY, JSON.stringify({
      ...location,
      timestamp: Date.now()
    }))
    
    // 上报到服务器（异步，不阻塞）
    uploadLocationToServer(location)
  } catch (e) {
    // ignore
  }
}

/**
 * 上传位置到服务器
 */
async function uploadLocationToServer(location) {
  if (!location || !location.province) return
  
  try {
    const token = localStorage.getItem('xiaohuangyu_token')
    if (!token) {
      console.log('[Location] 用户未登录，跳过位置上报')
      return
    }
    
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        province: location.province,
        city: location.city || location.province
      })
    })
    
    const result = await response.json()
    if (result.code === 0) {
      console.log('[Location] 位置已上报到服务器:', location.province, location.city)
    } else {
      console.warn('[Location] 位置上报失败:', result.message)
    }
  } catch (e) {
    console.warn('[Location] 位置上报请求失败:', e.message)
  }
}

/**
 * 清除用户位置
 */
export function clearLocation() {
  try {
    localStorage.removeItem(LOCATION_KEY)
  } catch (e) {
    // ignore
  }
}

/**
 * 浏览器GPS定位
 */
function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
      },
      (error) => {
        let msg = '定位失败'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = '用户拒绝定位权限'
            break
          case error.POSITION_UNAVAILABLE:
            msg = '定位信息不可用'
            break
          case error.TIMEOUT:
            msg = '定位超时'
            break
        }
        reject(new Error(msg))
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,  // GPS定位给更长时间
        maximumAge: 0   // 不使用缓存位置，确保获取最新位置
      }
    )
  })
}

/**
 * 微信定位
 */
function getWechatLocation() {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.getLocation) {
      return getBrowserLocation().then(resolve).catch(reject)
    }

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        resolve({
          lat: res.latitude,
          lng: res.longitude,
          accuracy: res.accuracy
        })
      },
      fail: () => {
        getBrowserLocation().then(resolve).catch(reject)
      }
    })
  })
}

/**
 * GPS地理编码
 */
async function getGPSLocation() {
  try {
    let coords
    if (isWechat()) {
      coords = await getWechatLocation()
    } else {
      coords = await getBrowserLocation()
    }

    console.log('[Location] GPS坐标获取成功:', coords.lat, coords.lng)

    const response = await fetch('/api/location/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coords)
    })

    const result = await response.json()
    
    if (result.code === 0 && result.data && result.data.province) {
      return {
        lat: coords.lat,
        lng: coords.lng,
        province: result.data.province,
        city: result.data.city,
        district: result.data.district,
        source: 'gps'
      }
    }
    return null
  } catch (e) {
    console.warn('[Location] GPS定位失败:', e.message)
    return null
  }
}

/**
 * IP定位（通过后端，快速）
 */
async function getIPLocation() {
  try {
    const response = await fetch('/api/location/ip')
    const result = await response.json()
    
    if (result.code === 0 && result.data && result.data.province) {
      return {
        province: result.data.province,
        city: result.data.city || result.data.province,
        source: 'ip'
      }
    }
    return null
  } catch (e) {
    console.warn('[Location] IP定位失败:', e.message)
    return null
  }
}

/**
 * 触发手动选择城市
 */
async function triggerManualSelect() {
  if (manualSelectCallback) {
    return new Promise((resolve) => {
      manualSelectCallback((location) => {
        resolve(location)
      })
    })
  }
  return null
}

/**
 * 自动获取位置（GPS优先模式）
 * 优先级：缓存 → GPS定位（优先，最准确）→ IP定位（备用）→ 手动选择
 */
export async function getLocation() {
  // 第一层：检查缓存（毫秒级）
  const saved = getSavedLocation()
  if (saved && saved.province && saved.city) {
    console.log('[Location] 使用缓存:', saved.province, saved.city)
    return saved
  }

  // 第二层：GPS定位（优先，最准确）
  console.log('[Location] 尝试GPS定位...')
  const gpsLocation = await getGPSLocation()
  if (gpsLocation && gpsLocation.city) {
    await saveLocation(gpsLocation)  // 保存并上报
    console.log('[Location] GPS定位成功:', gpsLocation.province, gpsLocation.city)
    return gpsLocation
  }

  // 第三层：IP定位（GPS失败后的备用方案）
  console.log('[Location] GPS定位失败，尝试IP定位...')
  const ipLocation = await getIPLocation()
  if (ipLocation) {
    const location = {
      province: ipLocation.province,
      city: ipLocation.city,
      source: 'ip'
    }
    await saveLocation(location)  // 保存并上报
    console.log('[Location] IP定位成功:', location.province, location.city)
    return location
  }

  // 第四层：手动选择城市
  console.log('[Location] 自动定位失败，触发手动选择')
  const manualLocation = await triggerManualSelect()
  if (manualLocation) {
    const location = {
      province: manualLocation.province,
      city: manualLocation.city,
      source: 'manual'
    }
    await saveLocation(location)  // 保存并上报
    return location
  }

  return null
}

/**
 * 强制刷新位置（忽略缓存，GPS优先）
 */
export async function refreshLocation() {
  clearLocation()
  return await getLocation()
}

/**
 * 获取位置状态
 */
export function getLocationStatus() {
  const saved = getSavedLocation()
  if (saved && saved.province && saved.city) {
    return {
      hasLocation: true,
      location: saved,
      expired: false
    }
  }
  return {
    hasLocation: false,
    location: null,
    expired: true
  }
}

export default {
  getLocation,
  getSavedLocation,
  saveLocation,
  clearLocation,
  refreshLocation,
  setManualSelectCallback,
  getLocationStatus
}
