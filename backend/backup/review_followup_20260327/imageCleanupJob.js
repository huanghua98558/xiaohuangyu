/**
 * 图片清理定时任务
 * 每天凌晨3点执行
 * 清理过期图片
 */

import prisma from '../prisma.js'
import { deleteImage, imageExists } from '../utils/storage.js'
import logger from '../utils/logger.js'
import fs from 'fs/promises'

// 清理规则配置
const CLEANUP_RULES = {
  approved: 30,      // 已完成任务：30天后清理
  cancelled: 7,      // 取消/超时任务：7天后清理
  rejected: 3,       // 被拒绝任务：3天后清理
  userDeleted: 10    // 注销用户头像：10天后清理
}

export async function runCleanupJob() {
  const startTime = Date.now()
  const logFile = '/data/images/logs/cleanup_' + new Date().toISOString().split('T')[0] + '.log'
  
  logger.info('========== 图片清理任务开始 ==========')
  
  const stats = {
    approved: { count: 0, files: 0 },
    cancelled: { count: 0, files: 0 },
    rejected: { count: 0, files: 0 },
    userDeleted: { count: 0, files: 0 }
  }
  
  try {
    // 1. 清理30天前已完成的任务截图
    const approvedDate = new Date()
    approvedDate.setDate(approvedDate.getDate() - CLEANUP_RULES.approved)
    
    const approvedTasks = await prisma.claims.findMany({
      where: {
        status: 'approved',
        reviewed_at: { lt: approvedDate },
        NOT: { screenshots: "[]" }
      },
      select: { id: true, screenshots: true }
    })
    
    for (const task of approvedTasks) {
      for (const screenshot of task.screenshots || []) {
        try {
          await deleteImage(screenshot)
          stats.approved.files++
        } catch (e) {
          logger.debug(`删除图片失败: ${screenshot}`)
        }
      }
      stats.approved.count++
    }
    
    // 2. 清理7天前取消/超时的任务截图
    const cancelledDate = new Date()
    cancelledDate.setDate(cancelledDate.getDate() - CLEANUP_RULES.cancelled)
    
    const cancelledTasks = await prisma.claims.findMany({
      where: {
        status: { in: ['cancelled', 'expired'] },
        updated_at: { lt: cancelledDate },
        NOT: { screenshots: "[]" }
      },
      select: { id: true, screenshots: true }
    })
    
    for (const task of cancelledTasks) {
      for (const screenshot of task.screenshots || []) {
        try {
          await deleteImage(screenshot)
          stats.cancelled.files++
        } catch (e) {
          logger.debug(`删除图片失败: ${screenshot}`)
        }
      }
      stats.cancelled.count++
    }
    
    // 3. 清理3天前被拒绝的任务截图
    const rejectedDate = new Date()
    rejectedDate.setDate(rejectedDate.getDate() - CLEANUP_RULES.rejected)
    
    const rejectedTasks = await prisma.claims.findMany({
      where: {
        status: 'rejected',
        reviewed_at: { lt: rejectedDate },
        NOT: { screenshots: "[]" }
      },
      select: { id: true, screenshots: true }
    })
    
    for (const task of rejectedTasks) {
      for (const screenshot of task.screenshots || []) {
        try {
          await deleteImage(screenshot)
          stats.rejected.files++
        } catch (e) {
          logger.debug(`删除图片失败: ${screenshot}`)
        }
      }
      stats.rejected.count++
    }
    
    // 4. 清理10天前注销用户的头像
    const deletedUserDate = new Date()
    deletedUserDate.setDate(deletedUserDate.getDate() - CLEANUP_RULES.userDeleted)
    
    const deletedUsers = await prisma.user.findMany({
      where: {
        deletedAt: { lt: deletedUserDate },
        avatar: { not: null }
      },
      select: { id: true, avatar: true }
    })
    
    for (const user of deletedUsers) {
      if (user.avatar) {
        try {
          await deleteImage(user.avatar)
          stats.userDeleted.files++
        } catch (e) {
          logger.debug(`删除头像失败: ${user.avatar}`)
        }
      }
      stats.userDeleted.count++
    }
    
    const duration = Date.now() - startTime
    
    // 记录日志
    const totalFiles = stats.approved.files + stats.cancelled.files + stats.rejected.files + stats.userDeleted.files
    const logContent = `
========================================
图片清理任务执行报告
时间: ${new Date().toISOString()}
----------------------------------------
已完成任务: ${stats.approved.count}个，删除 ${stats.approved.files} 张图片
取消/超时任务: ${stats.cancelled.count}个，删除 ${stats.cancelled.files} 张图片
被拒绝任务: ${stats.rejected.count}个，删除 ${stats.rejected.files} 张图片
注销用户: ${stats.userDeleted.count}个，删除 ${stats.userDeleted.files} 张头像
----------------------------------------
总计删除: ${totalFiles} 个文件
执行耗时: ${duration}ms
========================================
`
    
    await fs.appendFile(logFile, logContent)
    
    logger.info(`图片清理任务完成: 删除 ${totalFiles} 个文件，耗时 ${duration}ms`)
    
    return { stats, totalFiles, duration }
    
  } catch (error) {
    logger.error('图片清理任务失败:', error)
    throw error
  }
}

export default { runCleanupJob, CLEANUP_RULES }
