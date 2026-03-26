import exposureService from './exposureService.js'
import onlineUserService from './onlineUserService.js'
import supabase from '../utils/supabaseToPrismaAdapter.js'
import taskPoolService from './taskPoolService.js'
import logger from '../utils/logger.js'
import prisma from '../utils/prisma.js'

class ExposureCron {
  constructor() {
    this.timer = null
    this.offlineBufferTimer = null
    this.qualityScoreTimer = null
    this.releaseExpiredTimer = null    // V3.0新增：过期任务释放
    this.poolWarmupTimer = null        // V3.0新增：任务池预热
    this.isRunning = false
  }

  /**
   * 启动定时检查
   */
  start() {
    if (this.timer) {
      logger.warn('曝光控制定时任务已在运行')
      return
    }
    
    // 每5分钟执行一次曝光检查
    this.timer = setInterval(() => {
      this.checkAllExposures()
    }, 5 * 60 * 1000)
    
    // 每1分钟执行一次离线缓冲检查
    this.offlineBufferTimer = setInterval(() => {
      this.checkOfflineBuffer()
    }, 60 * 1000)
    
    // 每10分钟执行一次用户质量评分计算
    this.qualityScoreTimer = setInterval(() => {
      this.calculateUserQualityScores()
    }, 10 * 60 * 1000)
    
    // ═══════════════════════════════════════════════════════════════════════════
    // V3.0 新增：性能优化定时任务
    // ═══════════════════════════════════════════════════════════════════════════
    
    // 每30秒执行一次过期任务释放（从 taskService.getTasks 移出）
    this.releaseExpiredTimer = setInterval(() => {
      this.releaseExpiredTasks()
    }, 30 * 1000)
    
    // 每2分钟执行一次任务池预热
    this.poolWarmupTimer = setInterval(() => {
      this.warmupTaskPools()
    }, 2 * 60 * 1000)
    
    // 延迟30秒后执行第一次检查（等待服务完全启动）
    setTimeout(() => {
      this.checkAllExposures()
    }, 30 * 1000)
    
    // 延迟1分钟后执行第一次离线缓冲检查
    setTimeout(() => {
      this.checkOfflineBuffer()
    }, 60 * 1000)
    
    // 延迟2分钟后执行第一次质量评分计算
    setTimeout(() => {
      this.calculateUserQualityScores()
    }, 120 * 1000)
    
    // 延迟10秒后执行第一次过期任务释放
    setTimeout(() => {
      this.releaseExpiredTasks()
    }, 10 * 1000)
    
    // 延迟30秒后执行第一次任务池预热
    setTimeout(() => {
      this.warmupTaskPools()
    }, 30 * 1000)
    
    logger.info('曝光控制定时任务已启动')
    logger.info('- 曝光检查: 每5分钟')
    logger.info('- 离线缓冲检查: 每1分钟')
    logger.info('- 质量评分计算: 每10分钟')
    logger.info('- 过期任务释放: 每30秒 (V3.0)')
    logger.info('- 任务池预热: 每2分钟 (V3.0)')
  }

  /**
   * 停止定时检查
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.offlineBufferTimer) {
      clearInterval(this.offlineBufferTimer)
      this.offlineBufferTimer = null
    }
    if (this.qualityScoreTimer) {
      clearInterval(this.qualityScoreTimer)
      this.qualityScoreTimer = null
    }
    if (this.releaseExpiredTimer) {
      clearInterval(this.releaseExpiredTimer)
      this.releaseExpiredTimer = null
    }
    if (this.poolWarmupTimer) {
      clearInterval(this.poolWarmupTimer)
      this.poolWarmupTimer = null
    }
    logger.info('曝光控制定时任务已停止')
  }

  /**
   * 检查所有活跃任务的曝光
   */
  async checkAllExposures() {
    if (this.isRunning) {
      logger.debug('曝光检查正在进行中，跳过本次')
      return
    }
    
    this.isRunning = true
    
    try {
      // 获取检查间隔配置
      const config = await exposureService.getConfig()
      const intervalMs = Number(config.checkIntervalMinutes) * 60 * 1000
      const cutoffTime = new Date(Date.now() - intervalMs).toISOString()
      
      // 获取所有需要检查的曝光记录
      const { data: exposures, error } = await supabase
        .from('task_exposure')
        .select('task_id')
        .eq('status', 'active')
        .or(`last_check_at.is.null,last_check_at.lt.${cutoffTime}`)
        .limit(100) // 每次最多处理100个
      
      if (error) {
        logger.error(`获取待检查曝光失败: ${error.message}`)
        return
      }
      
      if (!exposures || exposures.length === 0) {
        logger.debug('没有需要检查的曝光记录')
        return
      }
      
      logger.info(`开始检查 ${exposures.length} 个任务的曝光`)
      
      // 逐个检查
      let addCount = 0
      for (const exposure of exposures) {
        try {
          const result = await exposureService.checkAndAddExposure(exposure.task_id)
          if (result && result.added > 0) {
            addCount++
          }
        } catch (err) {
          logger.error(`检查任务 ${exposure.task_id} 曝光失败: ${err.message}`)
        }
      }
      
      // 标记已完成的任务
      await this.markCompleted()
      
      logger.info(`曝光检查完成，追加了 ${addCount} 个任务的曝光`)
    } catch (err) {
      logger.error('曝光检查异常:', err.stack || err)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 标记已完成的任务
   */
  async markCompleted() {
    try {
      // 查找已接满的任务
      const { data: completedTasks, error } = await supabase
        .from('task_exposure')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('status', 'active')
        .filter('accepted_count', 'gte', 'need_count')
        .select('task_id')
      
      if (error) {
        logger.warn(`标记完成任务失败: ${error.message}`)
        return
      }
      
      if (completedTasks && completedTasks.length > 0) {
        logger.info(`标记 ${completedTasks.length} 个任务为已完成`)
        
        // 记录日志
        for (const task of completedTasks) {
          await supabase
            .from('task_exposure_logs')
            .insert({
              task_id: task.task_id,
              event_type: 'completed',
              reason: '任务已接满'
            })
        }
      }
    } catch (err) {
      logger.warn(`标记完成任务异常: ${err.message}`)
    }
  }

  /**
   * 标记过期的任务
   */
  async markExpired() {
    try {
      // 查找已过期但仍活跃的任务
      const now = new Date().toISOString()
      
      const { data: expiredTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('status', 'expired')
      
      if (!expiredTasks || expiredTasks.length === 0) return
      
      const taskIds = expiredTasks.map(t => t.id)
      
      const { data: updated } = await supabase
        .from('task_exposure')
        .update({ 
          status: 'expired',
          updated_at: now
        })
        .eq('status', 'active')
        .in('task_id', taskIds)
        .select('task_id')
      
      if (updated && updated.length > 0) {
        logger.info(`标记 ${updated.length} 个任务为已过期`)
      }
    } catch (err) {
      logger.warn(`标记过期任务异常: ${err.message}`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增定时任务
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 检查离线缓冲（V2.0新增）
   * 缓冲期结束后释放曝光额度
   */
  async checkOfflineBuffer() {
    try {
      const processedCount = await onlineUserService.checkOfflineBuffer()
      
      if (processedCount > 0) {
        logger.info(`离线缓冲检查完成，释放了 ${processedCount} 个用户的曝光额度`)
      }
    } catch (err) {
      logger.error(`离线缓冲检查失败: ${err.message}`)
    }
  }

  /**
   * 计算用户质量评分（V2.0新增）
   * 定期更新用户的活跃度、质量和综合评分
   */
  /**
   * 计算用户质量评分（V2.0新增）
   * 定期更新用户的活跃度、质量和综合评分
   */
  async calculateUserQualityScores() {
    try {
      logger.info('开始计算用户质量评分')
      
      // 使用原始SQL查询，只查询存在的字段
      const activeThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      
      const activeUsers = await prisma.$queryRaw`
        SELECT id, level, total_tasks, last_task_date, created_at
        FROM users
        WHERE last_task_date >= ${activeThreshold}::timestamp
        LIMIT 500
      `
      
      if (!activeUsers || activeUsers.length === 0) {
        logger.debug('没有需要计算评分的用户')
        return
      }
      
      let updatedCount = 0
      
      for (const user of activeUsers) {
        try {
          // 计算活跃度评分（0-100）
          let activityScore = 0
          const daysSinceLastTask = user.last_task_date 
            ? (Date.now() - new Date(user.last_task_date).getTime()) / (1000 * 60 * 60 * 24)
            : 999
          
          if (daysSinceLastTask <= 1) activityScore = 100
          else if (daysSinceLastTask <= 3) activityScore = 80
          else if (daysSinceLastTask <= 7) activityScore = 60
          else activityScore = 30
          
          // 计算完成质量评分（基于total_tasks，简化逻辑）
          let qualityScore = 50
          const totalTasks = Number(user.total_tasks || 0)
          
          // 简化评分逻辑：根据总任务数
          if (totalTasks >= 100) qualityScore = 90
          else if (totalTasks >= 50) qualityScore = 70
          else if (totalTasks >= 20) qualityScore = 60
          else if (totalTasks >= 10) qualityScore = 50
          else if (totalTasks >= 5) qualityScore = 40
          else qualityScore = 30
          
          // 计算等级评分（0-100）
          const levelScores = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100, 6: 100 }
          const onlineScore = levelScores[user.level] || 20
          
          // 计算综合评分
          let totalScore = Math.round(
            activityScore * 0.3 + 
            qualityScore * 0.4 + 
            onlineScore * 0.3
          )
          
          // 确定用户等级标签
          let levelLabel = 'new'
          if (totalScore >= 90) levelLabel = 'core'
          else if (totalScore >= 70) levelLabel = 'active'
          else if (totalScore >= 50) levelLabel = 'normal'
          else levelLabel = 'low'
          
          // 使用原始SQL插入/更新评分记录
          await prisma.$executeRaw`
            INSERT INTO user_quality_score (user_id, activity_score, quality_score, online_score, total_score, level, last_calculated_at)
            VALUES (${user.id}, ${activityScore}, ${qualityScore}, ${onlineScore}, ${totalScore}, ${levelLabel}, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
              activity_score = ${activityScore},
              quality_score = ${qualityScore},
              online_score = ${onlineScore},
              total_score = ${totalScore},
              level = ${levelLabel},
              last_calculated_at = NOW()
          `
          
          updatedCount++
        } catch (err) {
          logger.warn(`更新用户 ${user.id} 评分失败: ${err.message}`)
        }
      }
      
      logger.info(`用户质量评分计算完成，更新了 ${updatedCount} 个用户`)
    } catch (err) {
      logger.error(`计算用户质量评分失败: ${err.message}`)
    }
  }

  /**
   * 执行曝光分配（V2.0新增）
   * 为待分配的任务选择合适的用户进行曝光
   */
  async allocateExposures() {
    try {
      logger.info('开始执行曝光分配')
      
      // 获取需要分配曝光的任务
      const { data: tasksNeedingExposure, error } = await supabase
        .from('task_exposure')
        .select(`
          task_id,
          current_exposure,
          max_exposure,
          need_count,
          accepted_count,
          tasks!inner(id, city, province, status)
        `)
        .eq('status', 'active')
        .eq('tasks.status', 'active')
        .limit(50)
      
      if (error || !tasksNeedingExposure || tasksNeedingExposure.length === 0) {
        logger.debug('没有需要分配曝光的任务')
        return
      }
      
      // 获取在线用户列表
      const onlineUsers = await onlineUserService.getOnlineUsersSnapshot()
      
      if (!onlineUsers || onlineUsers.length === 0) {
        logger.debug('当前没有在线用户')
        return
      }
      
      let allocatedCount = 0
      
      for (const exposure of tasksNeedingExposure) {
        try {
          // 计算还需要多少曝光
          const neededExposure = exposure.max_exposure - exposure.current_exposure
          
          if (neededExposure <= 0) continue
          
          // 筛选符合条件的在线用户
          const task = exposure.tasks
          const candidateUsers = onlineUsers.filter(user => {
            // 用户有可用额度
            if (user.available_quota <= 0) return false
            
            // 城市匹配（可选）
            if (task.city && user.city !== task.city && user.city !== '未知') {
              // 允许跨城市曝光，但降低优先级
            }
            
            return true
          })
          
          if (candidateUsers.length === 0) continue
          
          // 执行公平轮换选择
          const selectCount = Math.min(neededExposure, candidateUsers.length, 10) // 每次最多选择10个
          const selectedUsers = await exposureService.fairRoundRobinSelect(
            candidateUsers.map(u => u.user_id),
            selectCount,
            task.city
          )
          
          if (selectedUsers.length === 0) continue
          
          // 记录分配日志
          for (const userId of selectedUsers) {
            await supabase
              .from('exposure_allocation_logs')
              .insert({
                task_id: task.id,
                user_id: userId,
                allocation_type: 'regular',
                selection_score: candidateUsers.find(u => u.user_id === userId)?.selection_score || 0,
                user_level: candidateUsers.find(u => u.user_id === userId)?.level || 1,
                user_city: candidateUsers.find(u => u.user_id === userId)?.city || '未知'
              })
          }
          
          allocatedCount += selectedUsers.length
        } catch (err) {
          logger.error(`分配任务 ${exposure.task_id} 曝光失败: ${err.message}`)
        }
      }
      
      logger.info(`曝光分配完成，分配了 ${allocatedCount} 次曝光`)
    } catch (err) {
      logger.error(`执行曝光分配失败: ${err.message}`)
    }
  }

  /**
   * 刷新全局统计缓存
   */
  async refreshStats() {
    try {
      await onlineUserService.refreshGlobalStats()
      logger.debug('全局统计缓存已刷新')
    } catch (err) {
      logger.error(`刷新全局统计缓存失败: ${err.message}`)
    }
  }

  /**
   * 手动触发检查（用于测试或紧急情况）
   */
  async triggerCheck() {
    logger.info('手动触发曝光检查')
    await this.checkAllExposures()
  }

  /**
   * 手动触发离线缓冲检查
   */
  async triggerOfflineBufferCheck() {
    logger.info('手动触发离线缓冲检查')
    await this.checkOfflineBuffer()
  }

  /**
   * 手动触发质量评分计算
   */
  async triggerQualityScoreCalculation() {
    logger.info('手动触发质量评分计算')
    await this.calculateUserQualityScores()
  }

  /**
   * 手动触发曝光分配
   */
  async triggerAllocation() {
    logger.info('手动触发曝光分配')
    await this.allocateExposures()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V3.0 新增：性能优化方法
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 释放过期任务（从 taskService.getTasks 移出的性能优化）
   * 原来每次请求都执行，改为定时执行，减少请求延迟
   */
  async releaseExpiredTasks() {
    try {
      const now = new Date()
      
      // 查找过期的领取记录（限制每次最多处理100个）
      const { data: expiredClaims, error } = await supabase
        .from('claims')
        .select('id, task_id')
        .eq('status', 'doing')
        .lt('expires_at', now.toISOString())
        .limit(100)

      if (!expiredClaims || expiredClaims.length === 0) {
        return
      }
      
      logger.debug(`[V3.0] 发现 ${expiredClaims.length} 个过期任务需要释放`)

      // 批量更新过期状态
      const claimIds = expiredClaims.map(c => c.id)
      await supabase
        .from('claims')
        .update({ status: 'expired' })
        .in('id', claimIds)

      // 统计每个任务需要恢复的名额
      const taskRecovery = new Map()
      for (const claim of expiredClaims) {
        taskRecovery.set(claim.task_id, (taskRecovery.get(claim.task_id) || 0) + 1)
      }

      // 批量恢复任务名额
      for (const [taskId, count] of taskRecovery) {
        // 尝试使用 RPC 函数
        const { error: rpcError } = await supabase.rpc('increment_task_remain', { 
          task_id: taskId, 
          increment_by: count 
        })
        
        // 如果 RPC 不存在，使用传统方式
        if (rpcError) {
          const { data: task } = await supabase
            .from('tasks')
            .select('remain')
            .eq('id', taskId)
            .single()
          
          if (task) {
            await supabase
              .from('tasks')
              .update({ remain: task.remain + count })
              .eq('id', taskId)
          }
        }
      }

      logger.info(`[V3.0] 释放了 ${expiredClaims.length} 个过期任务，涉及 ${taskRecovery.size} 个任务`)
    } catch (err) {
      logger.error(`[V3.0] 释放过期任务失败: ${err.message}`)
    }
  }

  /**
   * 预热任务池（V3.0新增）
   * 定期为活跃城市预热任务池缓存
   */
  async warmupTaskPools() {
    try {
      // 预热全局热门池
      await taskPoolService.warmupHotPool()
      
      // 检查并补充池
      await taskPoolService.checkAndReplenish()
      
      logger.debug('[V3.0] 任务池预热检查完成')
    } catch (err) {
      logger.error(`[V3.0] 任务池预热失败: ${err.message}`)
    }
  }

  /**
   * 手动触发过期任务释放
   */
  async triggerReleaseExpired() {
    logger.info('手动触发过期任务释放')
    await this.releaseExpiredTasks()
  }

  /**
   * 手动触发任务池预热
   */
  async triggerPoolWarmup() {
    logger.info('手动触发任务池预热')
    await this.warmupTaskPools()
  }
}

export default new ExposureCron()
