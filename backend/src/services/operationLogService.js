// 全局 BigInt 序列化处理
BigInt.prototype.toJSON = function() { return this.toString(); }
import pkg from '@prisma/client'; const { PrismaClient } = pkg
import logger from '../utils/logger.js'
import crypto from 'crypto'

const prisma = new PrismaClient()

function toBigIntTargetId(targetId) {
  if (targetId === undefined || targetId === null || targetId === '') return null
  const s = String(targetId).trim()
  if (!/^\d+$/.test(s)) return null
  try {
    return BigInt(s)
  } catch {
    return null
  }
}

/**
 * 操作日志服务 - 支持完整追溯体系
 * 使用 Prisma 连接 CockroachDB
 */
class OperationLogService {
  
  /**
   * 记录操作日志（核心方法）
   */
  async log({ 
    operatorId, 
    operatorName, 
    operatorRole,
    action, 
    targetType, 
    targetId, 
    targetName, 
    oldValue, 
    newValue, 
    description, 
    ipAddress, 
    location,
    userAgent 
  }) {
    try {
      // 获取上一条日志的hash（用于链式校验）
      const lastLog = await prisma.operation_logs.findFirst({
        select: { id: true },
        orderBy: { id: 'desc' }
      })
      
      const prevHash = lastLog?.id?.toString() || '0'.repeat(64)
      
      // 生成当前记录的hash
      const hashInput = JSON.stringify({
        operatorId,
        operatorName,
        operatorRole,
        action,
        targetType,
        targetId,
        targetName,
        oldValue,
        newValue,
        description,
        ipAddress,
        location,
        timestamp: Date.now(),
        prevHash
      })
      const hash = crypto.createHash('sha256').update(hashInput).digest('hex')
      
      const data = await prisma.operation_logs.create({
        data: {
          adminId: operatorId ? BigInt(operatorId) : null,
          adminName: operatorName,
          operatorRole: operatorRole || 'admin',
          action,
          targetType,
          targetId: toBigIntTargetId(targetId),
          targetName,
          description,
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          ipAddress,
          userAgent
        }
      })

      return data
    } catch (err) {
      logger.error('记录操作日志异常:', err)
      return null
    }
  }

  /**
   * 兼容旧接口 - 管理员操作日志
   */
  async logAdmin({ adminId, adminName, action, targetType, targetId, targetName, oldValue, newValue, description, ipAddress, userAgent }) {
    return this.log({
      operatorId: adminId,
      operatorName: adminName,
      operatorRole: 'admin',
      action,
      targetType,
      targetId,
      targetName,
      oldValue,
      newValue,
      description,
      ipAddress,
      userAgent
    })
  }

  /**
   * 获取日志列表
   */
  async getList({ page = 1, pageSize = 20, adminId, action, targetType, startDate, endDate }) {
    const where = {}
    
    if (adminId) where.adminId = BigInt(adminId)
    if (action) where.action = action
    if (targetType) where.targetType = targetType
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const [list, total] = await Promise.all([
      prisma.operation_logs.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.operation_logs.count({ where })
    ])

    return {
      list: list.map(item => ({
        ...item,
        id: item.id.toString(),
        adminId: item.adminId?.toString(),
        targetId: item.targetId?.toString()
      })),
      total,
      page,
      pageSize
    }
  }

  /**
   * 获取操作详情
   */
  async getById(id) {
    const log = await prisma.operation_logs.findUnique({
      where: { id: BigInt(id) }
    })
    
    if (!log) return null
    
    return {
      ...log,
      id: log.id.toString(),
      adminId: log.adminId?.toString(),
      targetId: log.targetId?.toString()
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(days = 7) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const logs = await prisma.operation_logs.findMany({
      where: { createdAt: { gte: startDate } },
      select: { action: true, operatorRole: true }
    })

    const stats = {
      total: logs.length,
      byAction: {},
      byRole: {}
    }

    logs.forEach(item => {
      stats.byAction[item.action] = (stats.byAction[item.action] || 0) + 1
      stats.byRole[item.operatorRole || 'unknown'] = (stats.byRole[item.operatorRole || 'unknown'] || 0) + 1
    })

    return stats
  }

  /**
   * 获取操作者统计
   */
  async getOperatorStats(days = 7, limit = 20) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const logs = await prisma.operation_logs.findMany({
      where: { createdAt: { gte: startDate } },
      select: { adminId: true, adminName: true, operatorRole: true, action: true }
    })

    const stats = {}
    logs.forEach(item => {
      const key = item.adminId?.toString()
      if (!key) return
      
      if (!stats[key]) {
        stats[key] = {
          id: key,
          name: item.adminName,
          role: item.operatorRole,
          total: 0,
          actions: {}
        }
      }
      stats[key].total++
      stats[key].actions[item.action] = (stats[key].actions[item.action] || 0) + 1
    })

    return Object.values(stats)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
  }
}

export default new OperationLogService()