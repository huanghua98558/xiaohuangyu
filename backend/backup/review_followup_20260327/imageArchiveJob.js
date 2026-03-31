/**
 * 图片归档压缩定时任务
 * 每天凌晨2点执行
 * 压缩15天前的图片（150KB -> 50KB）
 */

import prisma from '../prisma.js'
import { archiveImage, imageExists } from '../utils/storage.js'
import logger from '../utils/logger.js'
import fs from 'fs/promises'

const ARCHIVE_DAYS = 15

export async function runArchiveJob() {
  const startTime = Date.now()
  const logFile = '/data/images/logs/archive_' + new Date().toISOString().split('T')[0] + '.log'
  
  logger.info('========== 图片归档任务开始 ==========')
  
  try {
    const archiveDate = new Date()
    archiveDate.setDate(archiveDate.getDate() - ARCHIVE_DAYS)
    
    const tasks = await prisma.claims.findMany({
      where: {
        status: 'approved',
        approvedAt: { lt: archiveDate },
        NOT: { screenshots: "[]" }
      },
      select: { id: true, screenshots: true, approvedAt: true }
    })
    
    logger.info(`找到 ${tasks.length} 个待归档任务`)
    
    let archivedCount = 0
    let errorCount = 0
    
    for (const task of tasks) {
      if (!task.screenshots || task.screenshots.length === 0) continue
      
      for (const screenshot of task.screenshots) {
        try {
          const exists = await imageExists(screenshot)
          if (!exists) continue
          
          const success = await archiveImage(screenshot)
          if (success) archivedCount++
          else errorCount++
        } catch (e) {
          logger.error(`归档图片失败: ${screenshot}`, e.message)
          errorCount++
        }
      }
    }
    
    const duration = Date.now() - startTime
    
    const logContent = `
========================================
图片归档任务执行报告
时间: ${new Date().toISOString()}
扫描任务数: ${tasks.length}
归档图片数: ${archivedCount}
失败数量: ${errorCount}
执行耗时: ${duration}ms
========================================
`
    
    await fs.appendFile(logFile, logContent)
    
    logger.info(`图片归档任务完成: 归档 ${archivedCount} 张，失败 ${errorCount} 张，耗时 ${duration}ms`)
    
    return { archivedCount, errorCount, duration }
    
  } catch (error) {
    logger.error('图片归档任务失败:', error)
    throw error
  }
}

export default { runArchiveJob }
