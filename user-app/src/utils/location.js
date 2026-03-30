/**
 * 用户位置管理
 *
 * 策略（按你的要求）：
 * - 本地展示缓存较长（默认 7 天），减少无意义刷新
 * - 自动定位（进入首页等）：每天最多触发 3 次真实 GPS 逆地理流程，超出则仅用 IP 兜底
 * - 用户点击「刷新定位」：忽略每日上限，强制走一轮 GPS（与手动 refreshLocation 一致）
 *
 * 后端 /api/location/resolve：GPS 逆地理优先离线库（offlineGeocoder），失败才走高德；
 * /api/location/ip：IP 归属地为 ip-api / ipapi 等，不用高德。
 */

const API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || import.meta.env.VITE_API_BASE || '/api'
const LOCATION_KEY = 'xiaohuangyu_location'
/** 展示用缓存：有则直接显示，不自动再打 GPS */
const LOCATION_DISPLAY_EXPIRE = 7 * 24 * 60 * 60 * 1000

const GPS_QUOTA_KEY = 'xiaohuangyu_auto_gps_quota_v1'
/** 自动进入首页等触发的 GPS+逆地理次数上限（每天）；手动「刷新定位」不占此额度 */
const MAX_AUTO_GPS_PER_DAY = 3

let manualSelectCallback = null

export function setManualSelectCallback(callback) {
  manualSelectCallback = callback
}

export function isWechat() {
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('micromessenger')
}

function todayKey() {
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function readGpsQuota() {
  try {
    const raw = localStorage.getItem(GPS_QUOTA_KEY)
    if (!raw) return { day: todayKey(), count: 0 }
    const o = JSON.parse(raw)
    if (o.day !== todayKey()) return { day: todayKey(), count: 0 }
    return { day: o.day, count: Number(o.count) || 0 }
  } catch {
    return { day: todayKey(), count: 0 }
  }
}

function incrementAutoGpsCount() {
  const q = readGpsQuota()
  const day = todayKey()
  const count = q.day === day ? q.count + 1 : 1
  localStorage.setItem(GPS_QUOTA_KEY, JSON.stringify({ day, count }))
}

function canAttemptAutoGps() {
  return readGpsQuota().count < MAX_AUTO_GPS_PER_DAY
}

export function getSavedLocation() {
  try {
    const saved = localStorage.getItem(LOCATION_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      if (Date.now() - data.timestamp < LOCATION_DISPLAY_EXPIRE) {
        // 不完整缓存视为无效，交给 getLocation 走 IP / GPS 补全，避免首页只显示一半地址
        if (data.province && data.city) {
          return data
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

export async function saveLocation(location) {
  try {
    localStorage.setItem(
      LOCATION_KEY,
      JSON.stringify({
        ...location,
        timestamp: Date.now()
      })
    )
    uploadLocationToServer(location)
  } catch (e) {
    // ignore
  }
}

async function uploadLocationToServer(location) {
  if (!location || !location.province) return

  try {
    const token = localStorage.getItem('xiaohuangyu_token')
    if (!token) {
      return
    }

    const response = await fetch(`${API_BASE}/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        province: location.province,
        city: location.city || location.province
      })
    })

    const result = await response.json()
    if (result.code !== 0) {
      console.warn('[Location] 位置上报失败:', result.message)
    }
  } catch (e) {
    console.warn('[Location] 位置上报请求失败:', e.message)
  }
}

export function clearLocation() {
  try {
    localStorage.removeItem(LOCATION_KEY)
  } catch (e) {
    // ignore
  }
}

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
        timeout: 15000,
        /** 允许浏览器在短时间内复用最近一次坐标，减少硬件唤醒次数 */
        maximumAge: 10 * 60 * 1000
      }
    )
  })
}

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

async function getGPSLocation({ countAgainstQuota = false } = {}) {
  if (countAgainstQuota) {
    incrementAutoGpsCount()
  }

  let coords
  if (isWechat()) {
    coords = await getWechatLocation()
  } else {
    coords = await getBrowserLocation()
  }

  const response = await fetch(`${API_BASE}/location/resolve`, {
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
}

async function getIPLocation() {
  try {
    const response = await fetch(`${API_BASE}/location/ip`)
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
 * @param {{ bypassDailyQuota?: boolean }} opts
 * bypassDailyQuota: 手动刷新时为 true，不占用每日自动 GPS 次数
 */
export async function getLocation(opts = {}) {
  const bypassDailyQuota = opts.bypassDailyQuota === true

  const saved = getSavedLocation()
  if (saved && saved.province && saved.city) {
    return saved
  }

  let gpsLocation = null
  if (bypassDailyQuota || canAttemptAutoGps()) {
    try {
      gpsLocation = await getGPSLocation({
        countAgainstQuota: !bypassDailyQuota
      })
    } catch (e) {
      console.warn('[Location] GPS定位失败:', e.message)
      gpsLocation = null
    }
  } else {
    console.log('[Location] 今日自动GPS已达上限，改用IP定位')
  }

  if (gpsLocation && gpsLocation.city) {
    await saveLocation(gpsLocation)
    return gpsLocation
  }

  const ipLocation = await getIPLocation()
  if (ipLocation) {
    const location = {
      province: ipLocation.province,
      city: ipLocation.city,
      source: 'ip'
    }
    await saveLocation(location)
    return location
  }

  const manualLocation = await triggerManualSelect()
  if (manualLocation) {
    const location = {
      province: manualLocation.province,
      city: manualLocation.city,
      source: 'manual'
    }
    await saveLocation(location)
    return location
  }

  return null
}

export async function refreshLocation() {
  clearLocation()
  return await getLocation({ bypassDailyQuota: true })
}

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
