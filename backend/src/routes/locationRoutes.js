import { Router } from 'express'
import locationUtil from '../utils/location.js'
import { success, error } from '../utils/response.js'

const router = Router()

/**
 * 位置解析接口（GPS逆地理编码）
 * POST /api/location/resolve
 * 前端发送GPS经纬度，后端返回省市信息
 * 
 * Body: { lat, lng }
 * Response: { province, city, district, formattedAddress }
 */
router.post('/resolve', async (req, res, next) => {
  try {
    const { lat, lng } = req.body

    if (!lat || !lng) {
      return error(res, '缺少经纬度参数')
    }

    // 逆地理编码
    const location = await locationUtil.reverseGeocode(lng, lat)
    
    if (!location) {
      return error(res, '位置解析失败')
    }

    // 获取客户端IP并查询归属地（用于风控记录）
    const clientIP = locationUtil.getClientIP(req)
    const ipLocation = await locationUtil.getIPLocation(clientIP)

    // 记录位置与IP的关系（用于风控分析）
    if (ipLocation) {
      const isMatch = locationUtil.validateLocation(location.province, ipLocation.province)
      if (!isMatch) {
        console.log(`[位置风控] GPS:${location.province} IP:${ipLocation.province} IP:${clientIP}`)
      }
    }

    success(res, {
      ...location,
      ip: clientIP,
      ipMatch: ipLocation ? locationUtil.validateLocation(location.province, ipLocation.province) : null
    })
  } catch (err) {
    next(err)
  }
})

/**
 * IP定位接口（无API限制，城市级精度）
 * GET /api/location/ip
 * 根据客户端IP返回省市信息
 * 
 * Response: { province, city }
 */
router.get('/ip', async (req, res, next) => {
  try {
    const clientIP = locationUtil.getClientIP(req)
    
    // 获取IP归属地
    const location = await locationUtil.getIPLocation(clientIP)
    
    if (!location || !location.province) {
      return error(res, 'IP定位失败')
    }

    success(res, {
      province: location.province,
      city: location.city || location.province,
      country: location.country,
      ip: clientIP
    })
  } catch (err) {
    next(err)
  }
})

export default router
