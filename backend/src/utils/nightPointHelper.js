import prisma from '../utils/prisma.js'
import { cache } from '../utils/redis.js'
import logger from '../utils/logger.js'

/**
 * 从 CockroachDB 获取夜间积分配置
 */
export async function getConfigFromDB() {
  try {
    // 直接查询 night_point_config 表
    const config = await prisma.$queryRawUnsafe(`
      SELECT * FROM night_point_config WHERE is_active = true LIMIT 1
    `)

    if (config && config.length > 0) {
      return {
        time_start: Number(config[0].time_start),
        time_end: Number(config[0].time_end),
        base_coefficient: Number(config[0].base_coefficient),
        max_coefficient: Number(config[0].max_coefficient),
        no_accept_bonus: Number(config[0].no_accept_bonus),
        is_active: config[0].is_active
      }
    }
  } catch (error) {
    logger.error('从 CockroachDB 获取夜间配置失败:', error.message)
  }

  // 返回默认配置
  return {
    time_start: 0,
    time_end: 8,
    base_coefficient: 1.4,
    max_coefficient: 1.8,
    no_accept_bonus: 0.1,
    is_active: true
  }
}

/**
 * 从 CockroachDB 获取在线用户系数映射
 */
export async function getCoefficientMapFromDB() {
  try {
    const map = await prisma.$queryRawUnsafe(`
      SELECT * FROM online_user_coefficient_map ORDER BY online_users_max ASC
    `)

    if (map && map.length > 0) {
      return map.map(row => ({
        id: Number(row.id),
        online_users_max: Number(row.online_users_max),
        coefficient: Number(row.coefficient),
        desc: row.desc || ''
      }))
    }
  } catch (error) {
    logger.error('从 CockroachDB 获取系数映射失败:', error.message)
  }

  // 返回默认映射
  return [
    { online_users_max: 5, coefficient: 1.8, desc: '在线人数≤5' },
    { online_users_max: 10, coefficient: 1.7, desc: '在线人数≤10' },
    { online_users_max: 20, coefficient: 1.6, desc: '在线人数≤20' },
    { online_users_max: 50, coefficient: 1.5, desc: '在线人数≤50' },
    { online_users_max: 999, coefficient: 1.4, desc: '在线人数>50' }
  ]
}
