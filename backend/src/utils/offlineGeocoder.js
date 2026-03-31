/**
 * 离线地理编码服务
 * 
 * 不依赖任何第三方 API，完全本地查询
 * 
 * 功能：
 * 1. GPS 坐标 -> 省市信息（离线边界框匹配）
 * 2. 距离计算用于精确匹配
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import logger from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 缓存数据
let provincesData = null
let citiesData = null

/**
 * 加载地理数据（懒加载，只加载一次）
 */
function loadGeoData() {
  if (!provincesData) {
    try {
      const provincesPath = join(__dirname, '../../data/china-provinces.json')
      provincesData = JSON.parse(readFileSync(provincesPath, 'utf-8')).provinces
      logger.info(`[离线地理编码] 加载 ${provincesData.length} 个省份数据`)
    } catch (e) {
      logger.error('[离线地理编码] 加载省份数据失败:', e.message)
      provincesData = []
    }
  }

  if (!citiesData) {
    try {
      const citiesPath = join(__dirname, '../../data/china-cities.json')
      citiesData = JSON.parse(readFileSync(citiesPath, 'utf-8')).cities
      logger.info(`[离线地理编码] 加载 ${citiesData.length} 个城市数据`)
    } catch (e) {
      logger.error('[离线地理编码] 加载城市数据失败:', e.message)
      citiesData = []
    }
  }
}

/**
 * 计算两点之间的距离（Haversine 公式）
 * @param {number} lng1 点1经度
 * @param {number} lat1 点1纬度
 * @param {number} lng2 点2经度
 * @param {number} lat2 点2纬度
 * @returns {number} 距离（公里）
 */
function calculateDistance(lng1, lat1, lng2, lat2) {
  const R = 6371 // 地球半径（公里）
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg) {
  return deg * (Math.PI / 180)
}

/**
 * 检查点是否在边界框内
 */
function isInBounds(lng, lat, bounds) {
  return lng >= bounds.minLng && lng <= bounds.maxLng &&
         lat >= bounds.minLat && lat <= bounds.maxLat
}

/**
 * GPS 逆地理编码：根据经纬度获取省市信息
 * 
 * @param {number} lng 经度
 * @param {number} lat 纬度
 * @returns {{province: string, city: string, district: string, source: string}}
 */
export function reverseGeocode(lng, lat) {
  loadGeoData()

  if (!lng || !lat) {
    return null
  }

  // 数值化
  lng = parseFloat(lng)
  lat = parseFloat(lat)

  if (isNaN(lng) || isNaN(lat)) {
    return null
  }

  // 检查是否在中国范围内
  if (lng < 73 || lng > 136 || lat < 3 || lat > 54) {
    logger.warn(`[离线地理编码] 坐标不在中围范围内: ${lng}, ${lat}`)
    return null
  }

  // 第一步：在城市级别查找（更精确）
  let matchedCity = null
  let minDistance = Infinity

  for (const city of citiesData) {
    if (isInBounds(lng, lat, city)) {
      // 计算到城市中心的距离
      const centerLng = (city.minLng + city.maxLng) / 2
      const centerLat = (city.minLat + city.maxLat) / 2
      const distance = calculateDistance(lng, lat, centerLng, centerLat)

      // 选择距离最近的城市
      if (distance < minDistance) {
        minDistance = distance
        matchedCity = city
      }
    }
  }

  // 如果找到了城市
  if (matchedCity) {
    const result = {
      province: matchedCity.province,
      city: matchedCity.name,
      district: '',
      source: 'offline-city',
      confidence: Math.max(0, 1 - minDistance / 100) // 简单的置信度计算
    }
    logger.debug(`[离线地理编码] 城市匹配成功: ${result.province} ${result.city}, 距离: ${minDistance.toFixed(2)}km`)
    return result
  }

  // 第二步：在省份级别查找
  let matchedProvince = null
  minDistance = Infinity

  for (const province of provincesData) {
    if (isInBounds(lng, lat, province)) {
      const distance = calculateDistance(lng, lat, province.center[0], province.center[1])
      if (distance < minDistance) {
        minDistance = distance
        matchedProvince = province
      }
    }
  }

  if (matchedProvince) {
    const result = {
      province: matchedProvince.name,
      city: matchedProvince.name, // 省会或省份名称
      district: '',
      source: 'offline-province',
      confidence: Math.max(0, 1 - minDistance / 200)
    }
    logger.debug(`[离线地理编码] 省份匹配成功: ${result.province}, 距离: ${minDistance.toFixed(2)}km`)
    return result
  }

  // 第三步：使用最近邻省份
  let nearestProvince = null
  minDistance = Infinity

  for (const province of provincesData) {
    const distance = calculateDistance(lng, lat, province.center[0], province.center[1])
    if (distance < minDistance) {
      minDistance = distance
      nearestProvince = province
    }
  }

  if (nearestProvince && minDistance < 500) { // 500km 内认为是合理的
    const result = {
      province: nearestProvince.name,
      city: nearestProvince.name,
      district: '',
      source: 'offline-nearest',
      confidence: Math.max(0, 1 - minDistance / 500),
      note: `基于最近匹配，距离 ${minDistance.toFixed(0)}km`
    }
    logger.debug(`[离线地理编码] 最近邻匹配: ${result.province}, 距离: ${minDistance.toFixed(2)}km`)
    return result
  }

  return null
}

/**
 * 根据省份名称获取省份信息
 */
export function getProvinceByName(name) {
  loadGeoData()
  
  // 标准化名称
  const normalizedName = name.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, '')
  
  return provincesData.find(p => 
    p.name.includes(normalizedName) || 
    p.shortName.includes(normalizedName)
  )
}

/**
 * 根据城市名称获取城市信息
 */
export function getCityByName(name) {
  loadGeoData()
  
  const normalizedName = name.replace(/市/g, '')
  
  return citiesData.find(c => 
    c.name.includes(normalizedName) ||
    c.name.replace(/市/g, '').includes(normalizedName)
  )
}

/**
 * 获取所有省份列表
 */
export function getAllProvinces() {
  loadGeoData()
  return provincesData
}

/**
 * 获取所有城市列表
 */
export function getAllCities() {
  loadGeoData()
  return citiesData
}

export default {
  reverseGeocode,
  getProvinceByName,
  getCityByName,
  getAllProvinces,
  getAllCities
}
