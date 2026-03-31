// 全局 BigInt 序列化处理
BigInt.prototype.toJSON = function() { return this.toString(); }
import supabase from '../utils/supabaseToPrismaAdapter.js'
import { redisClient, REDIS_ENABLED } from '../utils/redis.js'
import onlineUserService from './onlineUserService.js'
import exposureQuotaService from './exposureQuotaService.js'
import taskPoolService from './taskPoolService.js'
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import db from '../config/database.js'

// 默认配置
const DEFAULT_CONFIG = {
  initialCoefficient: 1.0,
  initialMinExtra: 5,
  initialMaxExtra: 10,
  maxCoefficient: 3.0,
  checkIntervalMinutes: 5,
  addRatioHigh: 0.3,
  addRatioMid: 0.5,
  addRatioLow: 1.0,
  rateThresholdHigh: 0.7,
  rateThresholdMid: 0.4,
  rateThresholdLow: 0.2,
  // 曝光模式配置
  exposureMode: 'priority', // 'parallel' | 'sequential' | 'priority'(新：优先级模式)
  sequentialThreshold: 0.8, // 完成率阈值（顺序模式用）
  exposureWindow: 9999, // 曝光窗口：移除限制，全部可见
  // 优先级模式配置
  priorityMode: {
    whitelistBonus: 100,     // 白名单优先级加成（与文档一致）
    blacklistPenalty: -50,   // 黑名单优先级惩罚（与文档一致）
    activityWeight: 0.4,     // 活跃度权重
    speedWeight: 0.3,        // 提交速度权重
    completionWeight: 0.3    // 完成率权重
  },
  // V2.0 新增配置
  cityExposureLimit: 3,           // 城市曝光限制默认值
  reservedExposureQuota: 3,       // 预留曝光额度
  heartbeatTimeout: 120,          // 心跳超时（秒）
  offlineBufferTime: 300,         // 离线缓冲时间（秒）
  exposureAllocationInterval: 300, // 曝光分配间隔（秒）
  maxExposureQuota: 20,           // 单用户最大曝光额度
  reservedQuotaRatio: 0.2         // 保留额度比例（给高等级用户）
}

class ExposureService {
  /**
   * 获取曝光配置
   */
  async getConfig() {
    try {
      let data = null

      if (prisma.exposure_config?.findFirst) {
        data = await prisma.exposure_config.findFirst({
          where: { is_active: true }
        })
      } else {
        data = await db.queryOne(
          `
          SELECT *
          FROM exposure_config
          WHERE is_active = true
          ORDER BY id DESC
          LIMIT 1
          `
        )
      }
      
      if (!data) {
        return DEFAULT_CONFIG
      }
      
      return {
        initialCoefficient: Number(data.initial_coefficient),
        initialMinExtra: data.initial_min_extra,
        initialMaxExtra: data.initial_max_extra,
        maxCoefficient: Number(data.max_coefficient),
        checkIntervalMinutes: data.check_interval_minutes,
        addRatioHigh: Number(data.add_ratio_high),
        addRatioMid: Number(data.add_ratio_mid),
        addRatioLow: Number(data.add_ratio_low),
        rateThresholdHigh: Number(data.rate_threshold_high),
        rateThresholdMid: Number(data.rate_threshold_mid),
        rateThresholdLow: Number(data.rate_threshold_low),
        // 曝光模式配置
        exposureMode: data.exposure_mode || 'priority',
        sequentialThreshold: Number(data.sequential_threshold) || 0.8,
        exposureWindow: data.exposure_window || 9999,  // 默认无限制
        // 优先级模式配置
        priorityMode: {
          whitelistBonus: Number(data.whitelist_bonus) ?? 100,
          blacklistPenalty: Number(data.blacklist_penalty) ?? -50,
          activityWeight: Number(data.activity_weight) ?? 0.4,
          speedWeight: Number(data.speed_weight) ?? 0.3,
          completionWeight: Number(data.completion_weight) ?? 0.3
        },
        // V2.0 新增配置
        cityExposureLimit: Number(data.city_exposure_limit) ?? 3,
        reservedExposureQuota: Number(data.reserved_exposure_quota) ?? 3,
        heartbeatTimeout: Number(data.heartbeat_timeout) ?? 120,
        offlineBufferTime: Number(data.offline_buffer_time) ?? 300,
        exposureAllocationInterval: Number(data.exposure_allocation_interval) ?? 300
      }
    } catch (err) {
      logger.warn(`获取曝光配置失败: ${err.message}`)
      return DEFAULT_CONFIG
    }
  }

  async getUserPriorityMetrics(userId) {
    const uid = typeof userId === 'string' ? userId : String(userId)

    try {
      const user = await db.queryOne(
        `
        SELECT
          id,
          level,
          total_tasks,
          completed_tasks,
          canceled_tasks,
          exposure_level,
          exposure_priority,
          is_whitelist,
          is_blacklist,
          current_exposure,
          regular_used,
          reserved_used,
          last_task_date,
          avg_submit_time
        FROM users
        WHERE id = $1
        `,
        [uid]
      )

      if (!user) {
        return null
      }

      return {
        id: user.id ? String(user.id) : null,
        level: Number(user.level || 0),
        total_tasks: Number(user.total_tasks || 0),
        completed_tasks: Number(user.completed_tasks || 0),
        canceled_tasks: Number(user.canceled_tasks || 0),
        exposure_level: user.exposure_level || null,
        exposure_priority: user.exposure_priority === null || user.exposure_priority === undefined
          ? null
          : Number(user.exposure_priority),
        is_whitelist: Boolean(user.is_whitelist),
        is_blacklist: Boolean(user.is_blacklist),
        current_exposure: Number(user.current_exposure || 0),
        regular_used: Number(user.regular_used || 0),
        reserved_used: Number(user.reserved_used || 0),
        last_task_date: user.last_task_date || null,
        avg_submit_time: Number(user.avg_submit_time || 0)
      }
    } catch (err) {
      logger.error(`获取用户优先级指标失败: ${err.message}`)
      return null
    }
  }

  /**
   * 获取用户曝光等级
   * @param {string} userId 用户ID
   * @returns {Promise<{level: string, priority: number}>}
   */
  async getUserExposureLevel(userId) {
    try {
      const user = await prisma.users.findFirst({
        where: { id: userId },
        select: { exposure_level: true, exposure_priority: true }
      })
      
      if (!user) {
        return { level: 'normal', priority: 50 }
      }
      
      return {
        level: user.exposure_level || 'normal',
        priority: user.exposure_priority || 50
      }
    } catch (err) {
      logger.error(`获取用户曝光等级失败: ${err.message}`)
      return { level: 'normal', priority: 50 }
    }
  }

  /**
   * 设置用户曝光等级（白名单/黑名单）
   * @param {string} userId 用户ID
   * @param {string} level 'whitelist' | 'normal' | 'blacklist'
   * @param {number} priority 优先级分数
   */
  async setUserExposureLevel(userId, level, priority = null) {
    try {
      const updateData = { exposure_level: level }
      if (priority !== null) {
        updateData.exposure_priority = priority
      } else {
        // 自动设置优先级
        if (level === 'whitelist') {
          updateData.exposure_priority = 100
        } else if (level === 'blacklist') {
          updateData.exposure_priority = 10
        } else {
          updateData.exposure_priority = 50
        }
      }
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
      
      if (error) {
        logger.error(`设置用户曝光等级失败: ${error.message}`)
        return false
      }
      
      logger.info(`用户 ${userId} 曝光等级已设置为 ${level}, 优先级 ${updateData.exposure_priority}`)
      return true
    } catch (err) {
      logger.error(`设置用户曝光等级异常: ${err.message}`)
      return false
    }
  }

  /**
   * 计算初始曝光量
   */
  calcInitialExposure(needCount, config) {
    const extra = Math.min(
      config.initialMaxExtra,
      Math.max(config.initialMinExtra, Math.floor(needCount * config.initialCoefficient * 0.3))
    )
    return needCount + extra
  }

  /**
   * 计算最大曝光量
   */
  calcMaxExposure(needCount, config) {
    return Math.ceil(needCount * config.maxCoefficient)
  }

  /**
   * 计算追加曝光量
   */
  calcAddExposure(acceptedCount, needCount, currentExposure, maxExposure, config) {
    if (Number(acceptedCount) >= Number(needCount) || Number(currentExposure) >= Number(maxExposure)) {
      return 0
    }
    
    const acceptRate = Number(acceptedCount) / Number(needCount)
    
    if (acceptRate >= config.rateThresholdHigh) {
      return 0
    }
    if (acceptRate >= config.rateThresholdMid) {
      return Math.ceil(Number(needCount) * config.addRatioHigh)
    }
    if (acceptRate >= config.rateThresholdLow) {
      return Math.ceil(Number(needCount) * config.addRatioMid)
    }
    return Math.ceil(Number(needCount) * config.addRatioLow)
  }

  /**
   * 初始化任务曝光记录
   */
  async initTaskExposure(taskId, needCount) {
    try {
      const config = await this.getConfig()
      const initialExposure = this.calcInitialExposure(needCount, config)
      const maxExposure = this.calcMaxExposure(needCount, config)
      
      // 检查是否已存在
      const { data: existing } = await supabase
        .from('task_exposure')
        .select('id')
        .eq('task_id', taskId)
        .maybeSingle()
      
      if (existing) {
        logger.debug(`任务 ${taskId} 曝光记录已存在`)
        return existing
      }
      
      // 获取下一个队列位置
      const { data: maxPos } = await supabase
        .from('task_exposure')
        .select('queue_position')
        .order('queue_position', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      const queuePosition = (maxPos?.queue_position || 0) + 1
      
      // 顺序模式下，第一个任务自动解锁
      const unlockedAt = (config.exposureMode === 'sequential' && queuePosition === 1) 
        ? new Date().toISOString() 
        : null
      
      const { data, error } = await supabase
        .from('task_exposure')
        .insert({
          task_id: taskId,
          need_count: needCount,
          initial_exposure: initialExposure,
          current_exposure: 0,
          max_exposure: maxExposure,
          accepted_count: 0,
          submitted_count: 0,
          status: 'active',
          queue_position: queuePosition,
          unlocked_at: unlockedAt
        })
        .select()
        .single()
      
      if (error) {
        logger.error(`初始化任务曝光失败: ${error.message}`)
        throw error
      }
      
      // 记录日志
      await supabase
        .from('task_exposure_logs')
        .insert({
          task_id: taskId,
          event_type: 'initial',
          exposure_before: 0,
          exposure_after: initialExposure,
          exposure_add: initialExposure,
          reason: `任务创建，初始化曝光量，队列位置: ${queuePosition}`
        })
      
      logger.info(`任务 ${taskId} 初始化曝光: ${initialExposure}, 最大: ${maxExposure}, 队列: ${queuePosition}`)
      return data
    } catch (err) {
      logger.error(`初始化任务曝光异常: ${err.message}`)
      throw err
    }
  }

  /**
   * 检查并追加曝光（定时任务调用）
   */
  async checkAndAddExposure(taskId) {
    try {
      const { data: exposure, error } = await supabase
        .from('task_exposure')
        .select('*')
        .eq('task_id', taskId)
        .eq('status', 1)
        .single()
      
      if (!exposure) return null
      
      const config = await this.getConfig()
      
      // 获取当前已接人数
      const { count: acceptedCount } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId)
        .in('status', ['doing', 'pending', 'done'])
      
      // 更新已接人数
      await supabase
        .from('task_exposure')
        .update({ 
          accepted_count: acceptedCount || 0,
          last_check_at: new Date().toISOString()
        })
        .eq('task_id', taskId)
      
      // 计算追加量
      const addAmount = this.calcAddExposure(
        acceptedCount || 0,
        exposure.need_count,
        exposure.current_exposure,
        exposure.max_exposure,
        config
      )
      
      if (addAmount > 0) {
        const newExposure = Math.min(
          Number(exposure.current_exposure) + addAmount,
          Number(exposure.max_exposure)
        )
        const actualAdd = newExposure - Number(exposure.current_exposure)
        
        await supabase
          .from('task_exposure')
          .update({ 
            current_exposure: newExposure,
            updated_at: new Date().toISOString()
          })
          .eq('task_id', taskId)
        
        // 记录日志
        const acceptRate = (Number(acceptedCount || 0) / Number(exposure.need_count)).toFixed(4)
        await supabase
          .from('task_exposure_logs')
          .insert({
            task_id: taskId,
            event_type: 'add',
            exposure_before: exposure.current_exposure,
            exposure_after: newExposure,
            exposure_add: actualAdd,
            accept_rate: parseFloat(acceptRate),
            reason: `接单率 ${acceptRate}，追加曝光`
          })
        
        logger.info(`任务 ${taskId} 追加曝光: +${actualAdd}, 总计: ${newExposure}`)
        return { added: actualAdd, newExposure }
      }
      
      return { added: 0, newExposure: exposure.current_exposure }
    } catch (err) {
      logger.error(`检查任务曝光失败: ${err.message}`)
      return null
    }
  }

  /**
   * 记录任务浏览（曝光）
   */
  async recordView(taskId, userId, city, province, source = 'list') {
    try {
      // 检查是否已浏览过
      const { data: existing } = await supabase
        .from('task_view_records')
        .select('id')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .maybeSingle()
      
      if (existing) {
        return { isNew: false }
      }
      
      // 记录浏览
      const { error: viewError } = await supabase
        .from('task_view_records')
        .insert({
          task_id: taskId,
          user_id: userId,
          city,
          province,
          source
        })
      
      if (viewError) {
        // 唯一约束冲突，说明已存在
        if (viewError.code === '23505') {
          return { isNew: false }
        }
        logger.warn(`记录浏览失败: ${viewError.message}`)
        return { isNew: false }
      }
      
      // 更新曝光计数
      const { error: updateError } = await supabase
        .rpc('increment_exposure', { p_task_id: taskId })
      
      if (updateError) {
        logger.warn(`更新曝光计数失败: ${updateError.message}`)
      }
      
      return { isNew: true }
    } catch (err) {
      logger.warn(`记录浏览异常: ${err.message}`)
      return { isNew: false }
    }
  }

  /**
   * 批量记录任务浏览（曝光）
   * @param {Array} tasks - 任务列表
   * @param {string} userId - 用户ID
   * @param {string} city - 城市
   * @param {string} province - 省份
   * @param {string} source - 来源
   * @returns {Promise<number>} - 成功记录的数量
   */
  async batchRecordViews(tasks, userId, city, province, source = 'list') {
    if (!tasks || tasks.length === 0 || !userId) {
      return 0
    }

    try {
      const taskIds = tasks.map(t => t.id)
      
      // 查询已浏览的任务
      const { data: viewedTasks, error: queryError } = await supabase
        .from('task_view_records')
        .select('task_id')
        .eq('user_id', userId)
        .in('task_id', taskIds)
      
      if (queryError) {
        logger.warn(`查询已浏览任务失败: ${queryError.message}`)
        return 0
      }
      
      const viewedSet = new Set((viewedTasks || []).map(v => v.task_id))
      
      // 过滤出未浏览的任务
      const newViewRecords = taskIds
        .filter(taskId => !viewedSet.has(taskId))
        .map(taskId => ({
          task_id: taskId,
          user_id: userId,
          city,
          province,
          source
        }))
      
      if (newViewRecords.length === 0) {
        return 0
      }
      
      // 批量插入浏览记录
      const { error: insertError } = await supabase
        .from('task_view_records')
        .insert(newViewRecords)
      
      if (insertError) {
        // 如果是唯一约束冲突，说明部分任务已被浏览，忽略错误
        if (insertError.code !== '23505') {
          logger.warn(`批量记录浏览失败: ${insertError.message}`)
        }
        return 0
      }
      
      // 更新曝光计数（批量）
      for (const taskId of taskIds.filter(id => !viewedSet.has(id))) {
        await supabase.rpc('increment_exposure', { p_task_id: taskId }).catch(() => {})
      }
      
      return newViewRecords.length
    } catch (err) {
      logger.warn(`批量记录浏览异常: ${err.message}`)
      return 0
    }
  }

  /**
   * 检查任务是否可以展示给用户
   */
  async canShowTask(taskId, userId, city, province) {
    try {
      // 获取任务信息
      const { data: task } = await supabase
        .from('tasks')
        .select('exposure_enabled, city_limit, province_limit')
        .eq('id', taskId)
        .single()
      
      // 如果未启用曝光控制，直接允许
      if (!task || !task.exposure_enabled) {
        return { canShow: true, reason: 'exposure_disabled' }
      }
      
      // 获取曝光记录
      const { data: exposure } = await supabase
        .from('task_exposure')
        .select('*')
        .eq('task_id', taskId)
        .single()
      
      // 如果没有曝光记录，允许展示
      if (!exposure) {
        return { canShow: true, reason: 'no_exposure_record' }
      }
      
      // 检查状态
      if (exposure.status !== 'active') {
        return { canShow: false, reason: 'task_not_active' }
      }
      
      // 检查是否已曝光给该用户
      const { data: viewRecord } = await supabase
        .from('task_view_records')
        .select('id')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .maybeSingle()
      
      if (viewRecord) {
        return { canShow: true, reason: 'already_viewed' }
      }
      
      // 检查是否超过曝光上限
      if (Number(exposure.current_exposure) >= Number(exposure.max_exposure)) {
        return { canShow: false, reason: 'exposure_limit_reached' }
      }
      
      // 检查地域限制
      const { count: cityCount } = await supabase
        .from('task_view_records')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId)
        .eq('city', city)
      
      const { count: provinceCount } = await supabase
        .from('task_view_records')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId)
        .eq('province', province)
      
      if (cityCount >= (task?.city_limit || 1)) {
        return { canShow: false, reason: 'city_limit_reached' }
      }
      
      if (provinceCount >= (task?.province_limit || 4)) {
        return { canShow: false, reason: 'province_limit_reached' }
      }
      
      return { canShow: true, reason: 'ok' }
    } catch (err) {
      logger.warn(`检查任务展示失败: ${err.message}`)
      return { canShow: true, reason: 'error_fallback' }
    }
  }

  /**
   * 批量过滤任务（根据曝光控制）
   * 新版本：全部可见+优先级排序，移除窗口限制
   */
  async filterTasksByExposure(tasks, userId, city, province) {
    if (!tasks || tasks.length === 0) return []
    
    try {
      // 获取曝光配置
      const config = await this.getConfig()
      
      // 如果启用优先级模式，使用新的过滤逻辑
      if (config.exposureMode === 'priority') {
        return this.filterTasksByPriority(tasks, userId, city, province)
      }
      
      // 以下是原有的窗口限制逻辑（保留作为备选）
      const taskIds = tasks.map(t => t.id)
      
      // 获取任务曝光设置
      const { data: taskSettings } = await supabase
        .from('tasks')
        .select('id, exposure_enabled, city_limit, province_limit')
        .in('id', taskIds)
      
      const settingsMap = new Map(
        (taskSettings || []).map(s => [s.id, s])
      )
      
      // 获取所有任务的曝光记录
      const { data: exposures } = await supabase
        .from('task_exposure')
        .select('task_id, current_exposure, max_exposure, status')
        .in('task_id', taskIds)
      
      const exposureMap = new Map(
        (exposures || []).map(e => [e.task_id, e])
      )
      
      // 获取用户已浏览的任务
      const { data: viewedTasks } = await supabase
        .from('task_view_records')
        .select('task_id')
        .eq('user_id', userId)
        .in('task_id', taskIds)
      
      const viewedSet = new Set(
        (viewedTasks || []).map(v => v.task_id)
      )
      
      // 获取各任务的地域统计
      const { data: regionStats } = await supabase
        .from('task_view_records')
        .select('task_id, city, province')
        .in('task_id', taskIds)
      
      // 统计每个任务的城市和省份数量
      const taskRegionMap = new Map()
      for (const stat of (regionStats || [])) {
        if (!taskRegionMap.has(stat.task_id)) {
          taskRegionMap.set(stat.task_id, { cityCount: 0, provinceCount: 0 })
        }
        if (stat.city === city) {
          taskRegionMap.get(stat.task_id).cityCount++
        }
        if (stat.province === province) {
          taskRegionMap.get(stat.task_id).provinceCount++
        }
      }
      
      // 过滤任务
      return tasks.filter(task => {
        const settings = settingsMap.get(task.id)
        
        // 如果未启用曝光控制，不过滤
        if (!settings || !settings.exposure_enabled) return true
        
        const exposure = exposureMap.get(task.id)
        
        // 如果没有曝光记录，不过滤
        if (!exposure) return true
        
        // 状态不是 active，过滤
        if (exposure.status !== 'active') return false
        
        // 用户已浏览过，可以展示
        if (viewedSet.has(task.id)) return true
        
        // 超过最大曝光，过滤
        if (Number(exposure.current_exposure) >= Number(exposure.max_exposure)) return false
        
        // 地域限制检查
        const region = taskRegionMap.get(task.id) || { cityCount: 0, provinceCount: 0 }
        if (region.cityCount >= (settings.city_limit || 1)) return false
        if (region.provinceCount >= (settings.province_limit || 4)) return false
        
        return true
      })
    } catch (err) {
      logger.error(`过滤任务失败: ${err.message}`)
      return tasks // 出错时返回原列表
    }
  }

  /**
   * 顺序曝光模式：获取当前可曝光的任务ID列表
   * 按创建时间顺序，只有前面任务达到完成阈值后，后面任务才解锁
   */
  async getSequentialExposedTaskIds(config) {
    try {
      // 获取所有活跃任务的曝光记录，按队列位置排序
      const { data: exposures, error } = await supabase
        .from('task_exposure')
        .select(`
          task_id,
          queue_position,
          unlocked_at,
          need_count,
          accepted_count,
          status,
          tasks!inner(created_at, status)
        `)
        .eq('status', 1)
        .eq('tasks.status', 'active')
        .order('queue_position', { ascending: true })
      
      if (error) {
        logger.error(`查询曝光记录失败: ${error.message}`)
        return []
      }
      if (!exposures || exposures.length === 0) {
        logger.warn('没有找到活跃的曝光记录')
        return []
      }

      logger.info(`顺序曝光: 找到 ${exposures.length} 个活跃任务`)
      
      const threshold = config.sequentialThreshold || 0.8
      const windowSize = config.exposureWindow || 3
      
      const exposedTaskIds = []
      let blocked = false
      
      for (let i = 0; i < exposures.length; i++) {
        const exp = exposures[i]
        const completionRate = Number(exp.need_count) > 0 
          ? (Number(exp.accepted_count || 0)) / Number(exp.need_count) 
          : 0
        
        logger.debug(`任务 ${exp.task_id}: 队列位置=${exp.queue_position}, 完成率=${completionRate.toFixed(2)}, 解锁=${!!exp.unlocked_at}`)
        
        // 如果任务已解锁
        if (exp.unlocked_at) {
          // 检查窗口限制 - 已解锁的任务也需要受窗口限制
          if (exposedTaskIds.length >= windowSize) {
            logger.debug(`任务 ${exp.task_id} 已解锁，但窗口已满(${windowSize})，跳过`)
            continue
          }
          
          exposedTaskIds.push(exp.task_id)
          logger.debug(`任务 ${exp.task_id} 已解锁，加入曝光列表 (当前窗口: ${exposedTaskIds.length}/${windowSize})`)
          continue
        }
        
        // 如果被阻塞，检查是否达到解锁条件
        if (blocked) {
          // 前一个任务达到阈值，当前任务解锁
          const prevExp = exposures[i - 1]
          const prevRate = Number(prevExp.need_count) > 0 
            ? (Number(prevExp.accepted_count || 0)) / Number(prevExp.need_count) 
            : 0
          
          if (prevRate >= threshold) {
            // 解锁当前任务
            await this.unlockTask(exp.task_id)
            exposedTaskIds.push(exp.task_id)
            blocked = false
            logger.info(`任务 ${exp.task_id} 达到解锁条件（前任务完成率 ${prevRate.toFixed(2)} >= ${threshold}）`)
          }
          continue
        }
        
        // 第一个任务或已解锁的任务
        exposedTaskIds.push(exp.task_id)
        logger.debug(`任务 ${exp.task_id} 加入曝光列表（队列首个未解锁任务）`)
        
        // 检查是否达到曝光窗口限制
        if (exposedTaskIds.length >= windowSize) {
          blocked = true
          logger.debug(`达到曝光窗口限制 ${windowSize}，阻塞后续任务`)
        }
        
        // 如果当前任务未达到阈值，阻塞后续任务
        if (completionRate < threshold) {
          blocked = true
          logger.debug(`任务 ${exp.task_id} 完成率 ${completionRate.toFixed(2)} < ${threshold}，阻塞后续任务`)
        }
      }
      
      logger.info(`顺序曝光: 最终曝光 ${exposedTaskIds.length} 个任务: ${exposedTaskIds.join(', ')}`)
      return exposedTaskIds
    } catch (err) {
      logger.error(`获取顺序曝光任务失败: ${err.message}`)
      return []
    }
  }

  /**
   * 解锁任务（允许曝光）
   */
  async unlockTask(taskId) {
    try {
      const { error } = await supabase
        .from('task_exposure')
        .update({ unlocked_at: new Date().toISOString() })
        .eq('task_id', taskId)
      
      if (error) {
        logger.error(`解锁任务失败: ${error.message}`)
        return false
      }
      
      logger.info(`任务 ${taskId} 已解锁曝光`)
      return true
    } catch (err) {
      logger.error(`解锁任务异常: ${err.message}`)
      return false
    }
  }

  /**
   * 为新任务分配队列位置
   */
  async assignQueuePosition(taskId) {
    try {
      // 获取当前最大队列位置
      const { data: maxPos } = await supabase
        .from('task_exposure')
        .select('queue_position')
        .order('queue_position', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      const nextPosition = (maxPos?.queue_position || 0) + 1
      
      // 更新当前任务的队列位置
      const { error } = await supabase
        .from('task_exposure')
        .update({ queue_position: nextPosition })
        .eq('task_id', taskId)
      
      if (error) {
        logger.error(`分配队列位置失败: ${error.message}`)
        return null
      }
      
      logger.info(`任务 ${taskId} 分配队列位置: ${nextPosition}`)
      return nextPosition
    } catch (err) {
      logger.error(`分配队列位置异常: ${err.message}`)
      return null
    }
  }

  /**
   * 批量过滤任务（支持顺序曝光模式）
   */
  async filterTasksByExposureWithSequential(tasks, userId, city, province, config) {
    // 如果是并行模式，使用原有逻辑
    if (config.exposureMode !== 'sequential') {
      return this.filterTasksByExposure(tasks, userId, city, province)
    }
    
    // 顺序曝光模式
    try {
      // 获取当前可曝光的任务ID
      const exposedTaskIds = await this.getSequentialExposedTaskIds(config)
      const exposedSet = new Set(exposedTaskIds)
      
      // 过滤任务
      const filteredTasks = tasks.filter(task => exposedSet.has(task.id))
      
      // 再应用原有的曝光过滤逻辑
      return this.filterTasksByExposure(filteredTasks, userId, city, province)
    } catch (err) {
      logger.error(`顺序曝光过滤失败: ${err.message}`)
      return this.filterTasksByExposure(tasks, userId, city, province)
    }
  }

  /**
   * 获取曝光统计
   */
  async getStats(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .rpc('get_exposure_stats', {
          p_start_date: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          p_end_date: endDate || new Date().toISOString()
        })
      
      if (error) throw error
      
      return data?.[0] || {
        total_tasks: 0,
        active_exposures: 0,
        completed_exposures: 0,
        avg_exposure_rate: 0,
        avg_accept_rate: 0,
        total_exposures: 0
      }
    } catch (err) {
      logger.error(`获取曝光统计失败: ${err.message}`)
      return {
        total_tasks: 0,
        active_exposures: 0,
        completed_exposures: 0,
        avg_exposure_rate: 0,
        avg_accept_rate: 0,
        total_exposures: 0
      }
    }
  }

  /**
   * 获取任务曝光详情
   */
  async getTaskExposureDetail(taskId) {
    try {
      const { data: exposure, error } = await supabase
        .from('task_exposure')
        .select('*')
        .eq('task_id', taskId)
        .single()
      
      if (error) throw error
      
      // 获取日志
      const { data: logs } = await supabase
        .from('task_exposure_logs')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(20)
      
      return {
        ...exposure,
        logs: logs || [],
        acceptRate: Number(exposure.need_count) > 0 
          ? Number(exposure.accepted_count) / Number(exposure.need_count) 
          : 0,
        exposureRate: Number(exposure.max_exposure) > 0 
          ? Number(exposure.current_exposure) / Number(exposure.max_exposure) 
          : 0
      }
    } catch (err) {
      logger.error(`获取任务曝光详情失败: ${err.message}`)
      return null
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(config) {
    try {
      const updateData = {
        initial_coefficient: config.initialCoefficient,
        initial_min_extra: config.initialMinExtra,
        initial_max_extra: config.initialMaxExtra,
        max_coefficient: config.maxCoefficient,
        check_interval_minutes: config.checkIntervalMinutes,
        add_ratio_high: config.addRatioHigh,
        add_ratio_mid: config.addRatioMid,
        add_ratio_low: config.addRatioLow,
        rate_threshold_high: config.rateThresholdHigh,
        rate_threshold_mid: config.rateThresholdMid,
        rate_threshold_low: config.rateThresholdLow,
        updated_at: new Date().toISOString()
      }
      
      // 顺序曝光配置
      if (config.exposureMode !== undefined) {
        updateData.exposure_mode = config.exposureMode
      }
      if (config.sequentialThreshold !== undefined) {
        updateData.sequential_threshold = config.sequentialThreshold
      }
      if (config.exposureWindow !== undefined) {
        updateData.exposure_window = config.exposureWindow
      }
      
      // V2.0 新增配置
      if (config.cityExposureLimit !== undefined) {
        updateData.city_exposure_limit = config.cityExposureLimit
      }
      if (config.reservedExposureQuota !== undefined) {
        updateData.reserved_exposure_quota = config.reservedExposureQuota
      }
      if (config.heartbeatTimeout !== undefined) {
        updateData.heartbeat_timeout = config.heartbeatTimeout
      }
      if (config.offlineBufferTime !== undefined) {
        updateData.offline_buffer_time = config.offlineBufferTime
      }
      if (config.exposureAllocationInterval !== undefined) {
        updateData.exposure_allocation_interval = config.exposureAllocationInterval
      }
      
      // 优先级模式配置
      if (config.priorityMode !== undefined) {
        if (config.priorityMode.whitelistBonus !== undefined) {
          updateData.whitelist_bonus = config.priorityMode.whitelistBonus
        }
        if (config.priorityMode.blacklistPenalty !== undefined) {
          updateData.blacklist_penalty = config.priorityMode.blacklistPenalty
        }
        if (config.priorityMode.activityWeight !== undefined) {
          updateData.activity_weight = config.priorityMode.activityWeight
        }
        if (config.priorityMode.speedWeight !== undefined) {
          updateData.speed_weight = config.priorityMode.speedWeight
        }
        if (config.priorityMode.completionWeight !== undefined) {
          updateData.completion_weight = config.priorityMode.completionWeight
        }
      }
      
      const { data, error } = await supabase
        .from('exposure_config')
        .update(updateData)
        .eq('is_active', true)
        .select()
        .single()
      
      if (error) throw error
      
      logger.info('曝光配置已更新')
      return data
    } catch (err) {
      logger.error(`更新曝光配置失败: ${err.message}`)
      throw err
    }
  }

  /**
   * 标记任务完成
   */
  async markTaskCompleted(taskId) {
    try {
      const { error } = await supabase
        .from('task_exposure')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('task_id', taskId)
      
      if (!error) {
        logger.info(`任务 ${taskId} 已标记为完成`)
      }
    } catch (err) {
      logger.warn(`标记任务完成失败: ${err.message}`)
    }
  }

  /**
   * 为现有任务初始化曝光记录
   */
  async initExistingTasks() {
    try {
      // 获取所有活跃任务
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, remain')
        .eq('status', 1)
        .gt('remain', 0)
      
      if (error) throw error
      
      let count = 0
      for (const task of (tasks || [])) {
        try {
          // 计算需求人数（这里简化处理，实际需要根据已接记录计算）
          const needCount = task.remain + 1 // 假设至少需要1人
          await this.initTaskExposure(task.id, needCount)
          count++
        } catch (err) {
          // 忽略已存在的错误
        }
      }
      
      logger.info(`为 ${count} 个现有任务初始化了曝光记录`)
      return count
    } catch (err) {
      logger.error(`初始化现有任务曝光失败: ${err.message}`)
      return 0
    }
  }

  /**
   * 重新计算所有任务的队列位置（按创建时间排序）
   */
  async recalculateQueuePositions() {
    try {
      // 获取所有任务的曝光记录，按任务创建时间排序
      const { data: exposures, error } = await supabase
        .from('task_exposure')
        .select(`
          id,
          task_id,
          tasks!inner(created_at)
        `)
        .order('tasks.created_at', { ascending: true })
      
      if (error) throw error
      
      let count = 0
      for (let i = 0; i < (exposures || []).length; i++) {
        const exp = exposures[i]
        const position = i + 1
        
        const { error: updateError } = await supabase
          .from('task_exposure')
          .update({ queue_position: position })
          .eq('id', exp.id)
        
        if (!updateError) {
          count++
        }
      }
      
      logger.info(`重新计算了 ${count} 个任务的队列位置`)
      return count
    } catch (err) {
      logger.error(`重新计算队列位置失败: ${err.message}`)
      return 0
    }
  }

  /**
   * 根据供需比动态调整曝光窗口和城市限制
   * @returns {Promise<{windowSize: number, mode: string, cityLimit: number, provinceLimit: number, reason: string}>}
   */
  async getDynamicExposureWindow() {
    try {
      // 获取供需数据
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      // 活跃用户数（使用last_task_date作为活跃指标）
      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .in('status', [1, 'active'])  // 兼容不同的status格式
        .gte('last_task_date', oneDayAgo)
      
      // 可接任务名额
      const { data: tasks } = await supabase
        .from('tasks')
        .select('remain')
        .eq('status', 1)
        .gt('remain', 0)
      
      const availableSlots = (tasks || []).reduce((sum, t) => sum + t.remain, 0)
      
      // 获取基础配置
      const config = await this.getConfig()
      let windowSize = config.exposureWindow
      let mode = config.exposureMode
      let cityLimit = 5   // 默认每城市5人（与taskService一致）
      let provinceLimit = 15  // 默认每省份15人
      let reason = '默认配置'
      
      // 计算供需比
      const ratio = availableSlots > 0 ? (activeUsers || 0) / availableSlots : 0
      
      if (ratio > 2) {
        // 用户多任务少：缩小窗口，促进轮换
        windowSize = Math.max(10, Math.floor(config.exposureWindow * 0.7))
        mode = 'sequential'
        cityLimit = 3   // 稍微收紧
        provinceLimit = 10
        reason = `供需比=${ratio.toFixed(1)}（用户多任务少），适当收紧促进轮换`
      } else if (ratio < 0.1) {
        // 任务极多用户极少：大幅扩大窗口
        windowSize = Math.min(50, Math.ceil(config.exposureWindow * 2))
        reason = `供需比=${ratio.toFixed(1)}（任务极多用户少），大幅扩大窗口`
      } else if (ratio < 0.5) {
        // 任务多用户少：扩大窗口
        windowSize = Math.min(40, Math.ceil(config.exposureWindow * 1.5))
        reason = `供需比=${ratio.toFixed(1)}（任务多用户少），扩大窗口增加曝光`
      } else {
        reason = `供需比=${ratio.toFixed(1)}（平衡状态），使用默认配置`
      }
      
      logger.info(`动态配置: 窗口=${windowSize}, 城市限制=${cityLimit}, 省份限制=${provinceLimit} (活跃用户:${activeUsers}, 可接名额:${availableSlots})`)
      
      return { windowSize, mode, cityLimit, provinceLimit, ratio, reason }
    } catch (err) {
      logger.error(`计算动态曝光窗口失败: ${err.message}`)
      const config = await this.getConfig()
      return { 
        windowSize: config.exposureWindow, 
        mode: config.exposureMode, 
        cityLimit: 5,
        provinceLimit: 15,
        ratio: 1, 
        reason: '计算失败，使用默认值' 
      }
    }
  }

  /**
   * 获取供需统计（供前端展示）
   */
  async getSupplyDemandStats() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      // 活跃用户（使用last_task_date作为活跃指标）
      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 1)
        .gte('last_task_date', oneDayAgo)
      
      // 活跃任务
      const { count: activeTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 1)
      
      // 可接名额
      const { data: taskSlots } = await supabase
        .from('tasks')
        .select('remain')
        .eq('status', 1)
        .gt('remain', 0)
      
      const availableSlots = (taskSlots || []).reduce((sum, t) => sum + t.remain, 0)
      
      // 今日完成数
      const today = new Date().toISOString().split('T')[0]
      const { count: todayCompleted } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .in('status', ['approved', 'done'])
        .gte('reviewed_at', today)
      
      return {
        activeUsers: activeUsers || 0,
        activeTasks: activeTasks || 0,
        availableSlots,
        ratio: availableSlots > 0 ? ((activeUsers || 0) / availableSlots).toFixed(2) : '0',
        todayCompleted: todayCompleted || 0
      }
    } catch (err) {
      logger.error(`获取供需统计失败: ${err.message}`)
      return {
        activeUsers: 0,
        activeTasks: 0,
        availableSlots: 0,
        ratio: '0',
        todayCompleted: 0
      }
    }
  }

  /**
   * 计算任务优先级（基于用户活跃度、完成率、提交速度）
   * @param {string} userId 用户ID
   * @returns {Promise<number>} 优先级分数 0-100
   */
  async calculateTaskPriority(userId) {
    try {
      const user = await this.getUserPriorityMetrics(userId)
      if (!user) {
        return 50 // 默认中等优先级
      }

      // 白名单用户：最高优先级
      if (user.is_whitelist) {
        return 100
      }

      // 黑名单用户：最低优先级
      if (user.is_blacklist) {
        return 0
      }

      // 如果有预设优先级，直接使用
      if (user.exposure_priority !== null && user.exposure_priority !== undefined) {
        return user.exposure_priority
      }

      // 根据活跃度等级返回基础分数
      const levelScores = {
        4: 90, // 核心用户
        3: 75, // 高活跃用户
        2: 60, // 活跃用户
        1: 40  // 新手用户
      }

      let baseScore = levelScores[user.exposure_level] || 50

      // 完成率调整（权重30%）
      const totalTasks = user.total_tasks || 0
      const completedTasks = user.completed_tasks || 0
      const canceledTasks = user.canceled_tasks || 0
      const completionRate = totalTasks > 0 
        ? (completedTasks / totalTasks) * 100 
        : 50

      // 提交速度调整（权重20%）
      const avgSubmitTime = user.avg_submit_time || 0
      let speedScore = 50
      if (avgSubmitTime > 0) {
        // 速度越快分数越高，30分钟内满分，超过2小时低分
        if (avgSubmitTime <= 30) speedScore = 100
        else if (avgSubmitTime <= 60) speedScore = 80
        else if (avgSubmitTime <= 120) speedScore = 60
        else speedScore = 40
      }

      // 综合计算：活跃度50% + 完成率30% + 提交速度20%
      const priority = Math.round(
        baseScore * 0.5 + 
        completionRate * 0.3 + 
        speedScore * 0.2
      )

      return Math.min(100, Math.max(0, priority))
    } catch (err) {
      logger.error(`计算任务优先级失败: ${err.message}`)
      return 50
    }
  }

  /**
   * 按优先级排序任务（新增优先级模式）
   * @param {Array} tasks 任务列表
   * @param {string} userId 用户ID
   * @param {string} city 用户城市
   * @param {string} province 用户省份
   * @returns {Promise<Array>} 排序后的任务列表
   */
  async sortTasksByPriority(tasks, userId, city, province) {
    try {
      const userPriority = await this.calculateTaskPriority(userId)
      
      // 为每个任务计算对用户的匹配度
      const tasksWithScore = await Promise.all(
        tasks.map(async (task) => {
          let score = 50 // 基础分

          // 1. 优先级匹配：高优先级用户优先看到高价值任务
          if (task.reward >= 200) {
            score += userPriority >= 75 ? 20 : 10
          } else if (task.reward >= 100) {
            score += userPriority >= 60 ? 15 : 5
          }

          // 2. 地域匹配：本地任务加分
          if (task.city === city) {
            score += 15
          } else if (task.province === province) {
            score += 8
          }

          // 3. 剩余名额：名额多的任务更容易被领取，降权
          if (task.remain >= 50) {
            score -= 10
          } else if (task.remain >= 20) {
            score -= 5
          } else if (task.remain <= 5) {
            score += 10 // 名额少，优先曝光
          }

          // 4. 任务新鲜度
          const taskAge = Date.now() - new Date(task.created_at).getTime()
          const hours = taskAge / (1000 * 60 * 60)
          if (hours <= 1) {
            score += 10 // 新任务加分
          } else if (hours >= 24) {
            score -= 10 // 老任务降权
          }

          return { ...task, priorityScore: score }
        })
      )

      // 按优先级分数降序排序
      tasksWithScore.sort((a, b) => b.priorityScore - a.priorityScore)

      return tasksWithScore
    } catch (err) {
      logger.error(`按优先级排序任务失败: ${err.message}`)
      return tasks
    }
  }

  /**
   * 获取用户动态并发限制
   * @param {string} userId 用户ID
   * @returns {Promise<number>} 并发限制数
   */
  async getUserDynamicConcurrency(userId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('exposure_level, is_whitelist')
        .eq('id', userId)
        .single()

      if (error || !user) {
        return 5 // 默认5个
      }

      // 白名单用户：最大并发
      if (user.is_whitelist) {
        return 15
      }

      // 根据活跃度等级返回并发限制
      const concurrencyLimits = {
        4: 10, // 核心用户
        3: 8,  // 高活跃用户
        2: 6,  // 活跃用户
        1: 5   // 新手用户
      }

      return concurrencyLimits[user.exposure_level] || 5
    } catch (err) {
      logger.error(`获取用户动态并发限制失败: ${err.message}`)
      return 5
    }
  }

  /**
   * 设置用户白名单
   * @param {string} userId 用户ID
   * @param {boolean} isWhitelist 是否加入白名单
   * @returns {Promise<boolean>}
   */
  async setUserWhitelist(userId, isWhitelist) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_whitelist: isWhitelist,
          exposure_priority: isWhitelist ? 100 : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      logger.info(`用户 ${userId} 白名单状态已更新: ${isWhitelist}`)
      return true
    } catch (err) {
      logger.error(`设置用户白名单失败: ${err.message}`)
      return false
    }
  }

  /**
   * 设置用户黑名单
   * @param {string} userId 用户ID
   * @param {boolean} isBlacklist 是否加入黑名单
   * @returns {Promise<boolean>}
   */
  async setUserBlacklist(userId, isBlacklist) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_blacklist: isBlacklist,
          exposure_priority: isBlacklist ? 0 : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      logger.info(`用户 ${userId} 黑名单状态已更新: ${isBlacklist}`)
      return true
    } catch (err) {
      logger.error(`设置用户黑名单失败: ${err.message}`)
      return false
    }
  }

  /**
   * 基于优先级的任务过滤（新版本，替代旧的窗口限制逻辑）
   * @param {Array} tasks 任务列表
   * @param {string} userId 用户ID
   * @param {string} city 用户城市
   * @param {string} province 用户省份
   * @returns {Promise<Array>} 过滤并排序后的任务列表
   */
  async filterTasksByPriority(tasks, userId, city, province) {
    try {
      // 1. 按优先级排序
      const sortedTasks = await this.sortTasksByPriority(tasks, userId, city, province)

      // 2. 获取用户并发限制
      const concurrencyLimit = await this.getUserDynamicConcurrency(userId)

      // 3. 获取用户当前进行中的任务数
      const { count: inProgressCount } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress'])

      // 4. 如果已达到并发限制，减少返回的任务数量
      const maxShow = Math.max(0, concurrencyLimit - (inProgressCount || 0))

      // 5. 返回排序后的任务（不限制数量，只做排序）
      // 实际的并发控制在领取时进行
      return sortedTasks
    } catch (err) {
      logger.error(`基于优先级过滤任务失败: ${err.message}`)
      return tasks
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：选择分数计算
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 计算用户选择分数（用于公平轮换）
   * @param {number} userId - 用户ID
   * @returns {Promise<number>} - 选择分数（越高越优先被选中）
   */
  async calculateSelectionScore(userId) {
    try {
      const user = await this.getUserPriorityMetrics(userId)
      if (!user) {
        return 0
      }

      const config = await this.getConfig()

      // 白名单用户：最高优先级
      if (user.is_whitelist) {
        return 100 + (config.priorityMode?.whitelistBonus || 50)
      }

      // 黑名单用户：最低优先级
      if (user.is_blacklist) {
        return 0
      }

      // 基础分数
      let baseScore = 50

      // 1. 等级贡献（权重 20%）
      const levelScores = { 1: 0, 2: 10, 3: 20, 4: 30, 5: 40, 6: 50 }
      baseScore += levelScores[user.level] || 0

      // 2. 完成率贡献（权重 30%）
      const totalTasks = user.total_tasks || 0
      const completedTasks = user.completed_tasks || 0
      const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0
      baseScore += completionRate * 30

      // 3. 提交速度贡献（权重 20%）
      const avgSubmitTime = user.avg_submit_time || 0
      let speedScore = 0
      if (avgSubmitTime > 0) {
        if (avgSubmitTime <= 30) speedScore = 20
        else if (avgSubmitTime <= 60) speedScore = 15
        else if (avgSubmitTime <= 120) speedScore = 10
        else speedScore = 5
      }
      baseScore += speedScore

      // 4. 曝光额度使用率（权重 20%）- 额度用得多的用户优先级降低
      const exposureLimit = await exposureQuotaService.getExposureLimitByLevel(user.level)
      const currentExposure = user.current_exposure || 0
      const exposureUsageRate = exposureLimit > 0 ? currentExposure / exposureLimit : 0
      baseScore += (1 - exposureUsageRate) * 20

      // 5. 活跃度贡献（权重 10%）
      const lastActiveHours = user.last_task_date 
        ? (Date.now() - new Date(user.last_task_date).getTime()) / (1000 * 60 * 60)
        : 999
      let activityScore = 0
      if (lastActiveHours <= 1) activityScore = 10
      else if (lastActiveHours <= 6) activityScore = 8
      else if (lastActiveHours <= 24) activityScore = 5
      else if (lastActiveHours <= 72) activityScore = 2
      baseScore += activityScore

      // 6. 取消率惩罚
      const canceledTasks = user.canceled_tasks || 0
      const cancelRate = totalTasks > 0 ? canceledTasks / totalTasks : 0
      if (cancelRate > 0.3) {
        baseScore -= 20
      } else if (cancelRate > 0.2) {
        baseScore -= 10
      } else if (cancelRate > 0.1) {
        baseScore -= 5
      }

      return Math.max(0, Math.min(150, Math.round(baseScore)))
    } catch (err) {
      logger.error(`计算选择分数失败: ${err.message}`)
      return 0
    }
  }

  /**
   * 批量计算用户选择分数
   * @param {Array<number>} userIds - 用户ID列表
   * @returns {Promise<Map<number, number>>} - 用户ID -> 选择分数映射
   */
  async batchCalculateSelectionScores(userIds) {
    const scoreMap = new Map()
    
    if (!userIds || userIds.length === 0) {
      return scoreMap
    }

    try {
      // 批量获取用户信息
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id,
          level,
          total_tasks,
          completed_tasks,
          canceled_tasks,
          is_whitelist,
          is_blacklist,
          current_exposure,
          regular_used,
          reserved_used,
          last_task_date,
          avg_submit_time
        `)
        .in('id', userIds)

      if (error || !users) {
        return scoreMap
      }

      const config = await this.getConfig()

      for (const user of users) {
        // 白名单用户
        if (user.is_whitelist) {
          scoreMap.set(user.id, 100 + (config.priorityMode?.whitelistBonus || 50))
          continue
        }

        // 黑名单用户
        if (user.is_blacklist) {
          scoreMap.set(user.id, 0)
          continue
        }

        // 计算分数
        let baseScore = 50

        // 等级贡献
        const levelScores = { 1: 0, 2: 10, 3: 20, 4: 30, 5: 40, 6: 50 }
        baseScore += levelScores[user.level] || 0

        // 完成率贡献
        const totalTasks = user.total_tasks || 0
        const completedTasks = user.completed_tasks || 0
        const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0
        baseScore += completionRate * 30

        // 提交速度贡献
        const avgSubmitTime = user.avg_submit_time || 0
        let speedScore = 0
        if (avgSubmitTime > 0) {
          if (avgSubmitTime <= 30) speedScore = 20
          else if (avgSubmitTime <= 60) speedScore = 15
          else if (avgSubmitTime <= 120) speedScore = 10
          else speedScore = 5
        }
        baseScore += speedScore

        // 曝光额度使用率贡献
        const exposureLimit = await exposureQuotaService.getExposureLimitByLevel(user.level)
        const currentExposure = user.current_exposure || 0
        const exposureUsageRate = exposureLimit > 0 ? currentExposure / exposureLimit : 0
        baseScore += (1 - exposureUsageRate) * 20

        // 活跃度贡献
        const lastActiveHours = user.last_task_date 
          ? (Date.now() - new Date(user.last_task_date).getTime()) / (1000 * 60 * 60)
          : 999
        let activityScore = 0
        if (lastActiveHours <= 1) activityScore = 10
        else if (lastActiveHours <= 6) activityScore = 8
        else if (lastActiveHours <= 24) activityScore = 5
        else if (lastActiveHours <= 72) activityScore = 2
        baseScore += activityScore

        // 取消率惩罚
        const canceledTasks = user.canceled_tasks || 0
        const cancelRate = totalTasks > 0 ? canceledTasks / totalTasks : 0
        if (cancelRate > 0.3) {
          baseScore -= 20
        } else if (cancelRate > 0.2) {
          baseScore -= 10
        } else if (cancelRate > 0.1) {
          baseScore -= 5
        }

        scoreMap.set(user.id, Math.max(0, Math.min(150, Math.round(baseScore))))
      }

      return scoreMap
    } catch (err) {
      logger.error(`批量计算选择分数失败: ${err.message}`)
      return scoreMap
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：动态容量计算
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 计算任务动态曝光容量
   * @param {number} taskId - 任务ID
   * @returns {Promise<object>} - 动态容量信息
   */
  async calculateDynamicCapacity(taskId) {
    try {
      // 获取任务信息
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, remain, city, province, created_at, status')
        .eq('id', taskId)
        .single()

      if (taskError || !task) {
        return { capacity: 0, reason: '任务不存在' }
      }

      // 获取配置
      const config = await this.getConfig()

      // 基础容量 = 剩余名额 * 系数
      let baseCapacity = Math.ceil(task.remain * config.initialCoefficient)

      // 动态调整因子
      const dynamicFactors = {
        timeFactor: 1.0,
        supplyFactor: 1.0,
        regionFactor: 1.0
      }

      // 1. 时间因子：任务越老，需要更多曝光
      const taskAgeHours = (Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60)
      if (taskAgeHours > 24) {
        dynamicFactors.timeFactor = 1.3
      } else if (taskAgeHours > 12) {
        dynamicFactors.timeFactor = 1.15
      } else if (taskAgeHours > 6) {
        dynamicFactors.timeFactor = 1.05
      }

      // 2. 供需因子：根据当前供需比调整
      const supplyDemand = await this.getSupplyDemandStats()
      const ratio = parseFloat(supplyDemand.ratio) || 1
      if (ratio > 2) {
        // 用户多任务少，减少每个任务的曝光容量
        dynamicFactors.supplyFactor = 0.7
      } else if (ratio > 1.5) {
        dynamicFactors.supplyFactor = 0.85
      } else if (ratio < 0.5) {
        // 任务多用户少，增加曝光容量
        dynamicFactors.supplyFactor = 1.5
      } else if (ratio < 0.8) {
        dynamicFactors.supplyFactor = 1.2
      }

      // 3. 地域因子：本地任务优先
      const { count: localUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('city', task.city)
        .eq('status', 1)

      if (localUsers && localUsers < 10) {
        // 本地用户少，扩大曝光范围
        dynamicFactors.regionFactor = 1.3
      }

      // 综合计算动态容量
      const dynamicCapacity = Math.ceil(
        baseCapacity * dynamicFactors.timeFactor * dynamicFactors.supplyFactor * dynamicFactors.regionFactor
      )

      // 限制最大容量
      const maxCapacity = Math.ceil(task.remain * config.maxCoefficient)
      const finalCapacity = Math.min(dynamicCapacity, maxCapacity)

      return {
        capacity: finalCapacity,
        baseCapacity,
        dynamicFactors,
        supplyDemandRatio: ratio,
        taskAge: taskAgeHours.toFixed(1) + 'h',
        localUsers: localUsers || 0,
        reason: `基础${baseCapacity} × 时间${dynamicFactors.timeFactor} × 供需${dynamicFactors.supplyFactor} × 地域${dynamicFactors.regionFactor}`
      }
    } catch (err) {
      logger.error(`计算动态容量失败: ${err.message}`)
      return { capacity: 10, reason: '计算失败，使用默认值' }
    }
  }

  /**
   * 批量计算任务动态容量
   * @param {Array<number>} taskIds - 任务ID列表
   * @returns {Promise<Map<number, object>>} - 任务ID -> 容量信息映射
   */
  async batchCalculateDynamicCapacities(taskIds) {
    const capacityMap = new Map()

    if (!taskIds || taskIds.length === 0) {
      return capacityMap
    }

    try {
      // 获取供需比（只需计算一次）
      const supplyDemand = await this.getSupplyDemandStats()
      const ratio = parseFloat(supplyDemand.ratio) || 1

      const config = await this.getConfig()

      // 批量获取任务信息
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, remain, city, province, created_at, status')
        .in('id', taskIds)

      if (error || !tasks) {
        return capacityMap
      }

      for (const task of tasks) {
        // 基础容量
        let baseCapacity = Math.ceil(task.remain * config.initialCoefficient)

        // 时间因子
        const taskAgeHours = (Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60)
        let timeFactor = 1.0
        if (taskAgeHours > 24) timeFactor = 1.3
        else if (taskAgeHours > 12) timeFactor = 1.15
        else if (taskAgeHours > 6) timeFactor = 1.05

        // 供需因子
        let supplyFactor = 1.0
        if (ratio > 2) supplyFactor = 0.7
        else if (ratio > 1.5) supplyFactor = 0.85
        else if (ratio < 0.5) supplyFactor = 1.5
        else if (ratio < 0.8) supplyFactor = 1.2

        // 地域因子（简化处理）
        let regionFactor = 1.0

        // 计算最终容量
        const dynamicCapacity = Math.ceil(baseCapacity * timeFactor * supplyFactor * regionFactor)
        const maxCapacity = Math.ceil(task.remain * config.maxCoefficient)

        capacityMap.set(task.id, {
          capacity: Math.min(dynamicCapacity, maxCapacity),
          baseCapacity,
          factors: { timeFactor, supplyFactor, regionFactor }
        })
      }

      return capacityMap
    } catch (err) {
      logger.error(`批量计算动态容量失败: ${err.message}`)
      return capacityMap
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：公平轮换算法
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 公平轮换选择用户
   * @param {Array<number>} candidateUserIds - 候选用户ID列表
   * @param {number} selectCount - 需要选择的用户数量
   * @param {string} city - 城市限制
   * @returns {Promise<Array<number>>} - 选中的用户ID列表
   */
  async fairRoundRobinSelect(candidateUserIds, selectCount, city = null) {
    if (!candidateUserIds || candidateUserIds.length === 0) {
      return []
    }

    if (candidateUserIds.length <= selectCount) {
      return candidateUserIds
    }

    try {
      // 1. 获取候选用户的选择分数
      const scoreMap = await this.batchCalculateSelectionScores(candidateUserIds)

      // 2. 获取候选用户的曝光额度使用情况
      const quotaMap = await this.batchGetUserExposureQuotas(candidateUserIds)

      // 3. 获取各城市的在线用户数
      const cityOnlineStats = await onlineUserService.getOnlineStatsByCity()
      const cityOnlineMap = new Map(cityOnlineStats.map(s => [s.city, s.onlineCount]))

      // 4. 按城市分组候选用户
      const usersByCity = new Map()
      const usersWithoutCity = []

      // 批量获取用户城市信息
      const { data: userCities } = await supabase
        .from('users')
        .select('id, city')
        .in('id', candidateUserIds)

      const userCityMap = new Map((userCities || []).map(u => [u.id, u.city]))

      for (const userId of candidateUserIds) {
        const userCity = userCityMap.get(userId)
        if (userCity && userCity !== '未知') {
          if (!usersByCity.has(userCity)) {
            usersByCity.set(userCity, [])
          }
          usersByCity.get(userCity).push(userId)
        } else {
          usersWithoutCity.push(userId)
        }
      }

      // 5. 获取城市曝光限制配置
      const config = await this.getConfig()
      const cityExposureLimit = config.cityExposureLimit || 3

      // 6. 执行公平轮换选择
      const selectedUsers = []
      const citySelectedCount = new Map()

      // 6.1 按选择分数排序所有用户
      const sortedUsers = [...candidateUserIds].sort((a, b) => {
        return (scoreMap.get(b) || 0) - (scoreMap.get(a) || 0)
      })

      // 6.2 轮换选择
      for (const userId of sortedUsers) {
        if (selectedUsers.length >= selectCount) break

        const userCity = userCityMap.get(userId)
        const quota = quotaMap.get(userId) || { available: 10, current: 0 }

        // 检查曝光额度
        if (quota.available <= 0) continue

        // 检查城市限制
        if (userCity && userCity !== '未知') {
          const currentCityCount = citySelectedCount.get(userCity) || 0
          if (currentCityCount >= cityExposureLimit) continue
          citySelectedCount.set(userCity, currentCityCount + 1)
        }

        selectedUsers.push(userId)
      }

      // 7. 如果选择数量不足，从剩余用户中补充
      if (selectedUsers.length < selectCount) {
        const remainingUsers = sortedUsers.filter(u => !selectedUsers.includes(u))
        for (const userId of remainingUsers) {
          if (selectedUsers.length >= selectCount) break
          const quota = quotaMap.get(userId) || { available: 10 }
          if (quota.available > 0) {
            selectedUsers.push(userId)
          }
        }
      }

      return selectedUsers
    } catch (err) {
      logger.error(`公平轮换选择失败: ${err.message}`)
      // 降级：简单返回前N个用户
      return candidateUserIds.slice(0, selectCount)
    }
  }

  /**
   * 批量获取用户曝光额度
   * @param {Array<number>} userIds - 用户ID列表
   * @returns {Promise<Map<number, object>>} - 用户ID -> 额度信息映射
   */
  async batchGetUserExposureQuotas(userIds) {
    const quotaMap = new Map()

    if (!userIds || userIds.length === 0) {
      return quotaMap
    }

    try {
      // 优先从Redis批量获取
      if (REDIS_ENABLED && redisClient) {
        const keys = userIds.map(id => `user_exposure:${id}`)
        const values = await redisClient.mGet(keys)

        for (let i = 0; i < userIds.length; i++) {
          if (values[i]) {
            try {
              const data = JSON.parse(values[i])
              quotaMap.set(userIds[i], data)
            } catch (e) {
              // 忽略解析错误
            }
          }
        }

        if (quotaMap.size === userIds.length) {
          return quotaMap
        }
      }

      // 从数据库获取未缓存的用户
      const uncachedIds = userIds.filter(id => !quotaMap.has(id))
      if (uncachedIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, level, current_exposure, regular_used, reserved_used')
          .in('id', uncachedIds)

        for (const user of (users || [])) {
          const limit = await exposureQuotaService.getExposureLimitByLevel(user.level)
          quotaMap.set(user.id, {
            limit,
            current: user.current_exposure || 0,
            regularUsed: user.regular_used || 0,
            reservedUsed: user.reserved_used || 0,
            available: Math.max(0, limit - (user.current_exposure || 0))
          })
        }
      }

      return quotaMap
    } catch (err) {
      logger.error(`批量获取用户曝光额度失败: ${err.message}`)
      return quotaMap
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：曝光额度管理
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 检查用户是否有可用曝光额度
   * @param {number} userId - 用户ID
   * @returns {Promise<object>} - 额度检查结果
   */
  async checkUserExposureQuota(userId) {
    try {
      const quota = await exposureQuotaService.getUserExposureQuota(userId)
      
      return {
        hasQuota: quota.available > 0,
        available: quota.available,
        limit: quota.limit,
        current: quota.current,
        regularUsed: quota.regularUsed,
        reservedUsed: quota.reservedUsed,
        selectionScore: await this.calculateSelectionScore(userId)
      }
    } catch (err) {
      logger.error(`检查用户曝光额度失败: ${err.message}`)
      return {
        hasQuota: true, // 出错时默认允许
        available: 5,
        limit: 10,
        current: 0,
        regularUsed: 0,
        reservedUsed: 0,
        selectionScore: 50
      }
    }
  }

  /**
   * 占用用户曝光额度
   * @param {number} userId - 用户ID
   * @param {number} count - 占用数量
   * @param {string} type - 类型 'regular' | 'reserved'
   * @returns {Promise<boolean>} - 是否成功
   */
  async acquireExposureQuota(userId, count = 1, type = 'regular') {
    try {
      const quota = await this.checkUserExposureQuota(userId)
      
      if (quota.available < count) {
        logger.warn(`用户 ${userId} 曝光额度不足: 需要 ${count}, 可用 ${quota.available}`)
        return false
      }

      // 更新额度
      const success = await exposureQuotaService.updateUserExposureQuota(userId, count, type)
      
      if (success) {
        logger.info(`用户 ${userId} 占用 ${count} 个曝光额度 (${type})`)
      }
      
      return success
    } catch (err) {
      logger.error(`占用曝光额度失败: ${err.message}`)
      return false
    }
  }

  /**
   * 释放用户曝光额度
   * @param {number} userId - 用户ID
   * @param {number} count - 释放数量
   * @param {string} reason - 释放原因
   * @returns {Promise<boolean>} - 是否成功
   */
  async releaseExposureQuota(userId, count = 1, reason = 'manual') {
    try {
      const success = await exposureQuotaService.releaseQuota(userId, count)
      
      if (success) {
        logger.info(`用户 ${userId} 释放 ${count} 个曝光额度，原因: ${reason}`)
      }
      
      return success
    } catch (err) {
      logger.error(`释放曝光额度失败: ${err.message}`)
      return false
    }
  }

  /**
   * 重置用户曝光额度（任务提交后调用）
   * 
   * ⚠️ 重要修复：提交任务后应该"释放"额度，而不是"重置为0"
   * - 用户领取任务时占用1个额度
   * - 提交任务后应该释放1个额度，恢复额度
   * - 而不是将所有额度重置为0
   * 
   * @param {number} userId - 用户ID
   * @param {number} count - 释放的额度数量，默认1
   * @returns {Promise<boolean>} - 是否成功
   */
  async resetExposureQuotaOnSubmit(userId, count = 1) {
    try {
      const quota = await this.checkUserExposureQuota(userId)
      
      // 释放指定数量的额度（而不是重置为0）
      if (count > 0) {
        const success = await exposureQuotaService.releaseQuota(userId, count)
        
        if (success) {
          logger.info(`用户 ${userId} 提交任务后释放 ${count} 个曝光额度 (${quota.current} -> ${quota.current - count})`)
        }
        return success
      }
      
      return true
    } catch (err) {
      logger.error(`释放曝光额度失败: ${err.message}`)
      return false
    }
  }

  /**
   * 获取用户曝光额度统计
   * @param {number} userId - 用户ID
   * @returns {Promise<object>} - 统计信息
   */
  async getUserExposureStats(userId) {
    try {
      const quota = await this.checkUserExposureQuota(userId)
      const score = await this.calculateSelectionScore(userId)
      
      // 获取今日曝光记录
      const today = new Date().toISOString().split('T')[0]
      const { count: todayExposure } = await supabase
        .from('task_view_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', today)

      return {
        quota,
        selectionScore: score,
        todayExposure: todayExposure || 0,
        quotaUsageRate: quota.limit > 0 ? (quota.current / quota.limit).toFixed(2) : '0'
      }
    } catch (err) {
      logger.error(`获取用户曝光统计失败: ${err.message}`)
      return {
        quota: { hasQuota: true, available: 10, limit: 10, current: 0 },
        selectionScore: 50,
        todayExposure: 0,
        quotaUsageRate: '0'
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：城市曝光限制管理
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 检查任务城市曝光限制
   * @param {number} taskId - 任务ID
   * @param {string} city - 城市
   * @returns {Promise<object>} - 检查结果
   */
  async checkCityExposureLimit(taskId, city) {
    try {
      const config = await this.getConfig()
      const cityLimit = config.cityExposureLimit || 3

      // 获取该任务在该城市的曝光数
      const { count: cityExposure } = await supabase
        .from('task_view_records')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId)
        .eq('city', city)

      const remaining = Math.max(0, cityLimit - (cityExposure || 0))

      return {
        limit: cityLimit,
        current: cityExposure || 0,
        remaining,
        canExpose: remaining > 0
      }
    } catch (err) {
      logger.error(`检查城市曝光限制失败: ${err.message}`)
      return { limit: 3, current: 0, remaining: 3, canExpose: true }
    }
  }

  /**
   * 更新城市曝光限制配置
   * @param {number} newLimit - 新的限制值
   * @returns {Promise<boolean>} - 是否成功
   */
  async updateCityExposureLimit(newLimit) {
    try {
      const { error } = await supabase
        .from('exposure_config')
        .update({ 
          city_exposure_limit: newLimit,
          updated_at: new Date().toISOString()
        })
        .eq('is_active', true)

      if (error) throw error

      logger.info(`城市曝光限制已更新为: ${newLimit}`)
      return true
    } catch (err) {
      logger.error(`更新城市曝光限制失败: ${err.message}`)
      return false
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：综合曝光决策
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 综合曝光决策：判断是否应该向用户展示任务
   * @param {number} taskId - 任务ID
   * @param {number} userId - 用户ID
   * @param {string} city - 用户城市
   * @param {string} province - 用户省份
   * @returns {Promise<object>} - 决策结果
   */
  async shouldExposeTask(taskId, userId, city, province) {
    try {
      // 1. 检查用户曝光额度
      const quotaCheck = await this.checkUserExposureQuota(userId)
      if (!quotaCheck.hasQuota) {
        return {
          shouldExpose: false,
          reason: 'exposure_quota_exhausted',
          detail: `用户曝光额度已用完: ${quotaCheck.current}/${quotaCheck.limit}`
        }
      }

      // 2. 检查任务城市限制
      const cityCheck = await this.checkCityExposureLimit(taskId, city)
      if (!cityCheck.canExpose) {
        return {
          shouldExpose: false,
          reason: 'city_limit_reached',
          detail: `该城市曝光已达上限: ${cityCheck.current}/${cityCheck.limit}`
        }
      }

      // 3. 检查任务是否已曝光给该用户
      const { data: existingView } = await supabase
        .from('task_view_records')
        .select('id')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .maybeSingle()

      if (existingView) {
        return {
          shouldExpose: true,
          reason: 'already_viewed',
          detail: '用户已浏览过该任务'
        }
      }

      // 4. 检查任务曝光容量
      const capacity = await this.calculateDynamicCapacity(taskId)
      const { data: exposure } = await supabase
        .from('task_exposure')
        .select('current_exposure')
        .eq('task_id', taskId)
        .single()

      if (exposure && Number(exposure.current_exposure) >= Number(capacity.capacity)) {
        return {
          shouldExpose: false,
          reason: 'task_capacity_reached',
          detail: `任务曝光容量已达上限: ${exposure.current_exposure}/${capacity.capacity}`
        }
      }

      // 5. 计算选择分数
      const selectionScore = quotaCheck.selectionScore

      // 6. 综合决策
      return {
        shouldExpose: true,
        reason: 'ok',
        detail: {
          quotaAvailable: quotaCheck.available,
          cityRemaining: cityCheck.remaining,
          selectionScore,
          capacityRemaining: capacity.capacity - (exposure?.current_exposure || 0)
        }
      }
    } catch (err) {
      logger.error(`综合曝光决策失败: ${err.message}`)
      return {
        shouldExpose: true, // 出错时默认允许
        reason: 'error_fallback',
        detail: err.message
      }
    }
  }

  /**
   * 批量过滤任务（V2.0版本，整合所有过滤逻辑）
   * @param {Array} tasks - 任务列表
   * @param {number} userId - 用户ID
   * @param {string} city - 用户城市
   * @param {string} province - 用户省份
   * @returns {Promise<Array>} - 过滤后的任务列表
   */
  async filterTasksV2(tasks, userId, city, province) {
    if (!tasks || tasks.length === 0) return []

    try {
      // 获取用户曝光额度
      const quotaCheck = await this.checkUserExposureQuota(userId)
      
      // 如果额度不足，返回空列表
      if (!quotaCheck.hasQuota) {
        logger.info(`用户 ${userId} 曝光额度不足，不展示任务`)
        return []
      }

      // 批量检查任务
      const taskDecisions = await Promise.all(
        tasks.map(async (task) => {
          const decision = await this.shouldExposeTask(task.id, userId, city, province)
          return { task, decision }
        })
      )

      // 过滤并添加决策信息
      const filteredTasks = taskDecisions
        .filter(({ decision }) => decision.shouldExpose)
        .map(({ task, decision }) => ({
          ...task,
          exposureDecision: decision
        }))

      // 按优先级排序
      const sortedTasks = await this.sortTasksByPriority(filteredTasks, userId, city, province)

      return sortedTasks
    } catch (err) {
      logger.error(`V2任务过滤失败: ${err.message}`)
      return tasks
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：总曝光容量计算
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 计算当前总曝光容量
   * 总容量 = Σ(在线用户的可用曝光额度)
   * @returns {Promise<object>} - 容量信息
   */
  async calculateTotalExposureCapacity() {
    try {
      // 获取所有在线用户快照
      const onlineUsers = await onlineUserService.getOnlineUsersSnapshot()

      if (!onlineUsers || onlineUsers.length === 0) {
        return {
          totalCapacity: 0,
          totalUsed: 0,
          totalAvailable: 0,
          exposureDemand: 0,
          supplyDemandRatio: 1,
          onlineUserCount: 0,
          levelDistribution: {},
          cityDistribution: {},
          userDetails: []
        }
      }

      // 计算每个用户的可用额度
      let totalCapacity = 0
      let totalUsed = 0
      const userDetails = []
      const levelDistribution = {}
      const cityDistribution = {}

      for (const user of onlineUsers) {
        const exposureLimit = user.exposure_limit || await exposureQuotaService.getExposureLimitByLevel(user.level)
        const currentExposure = user.current_exposure || 0
        const availableQuota = Math.max(0, exposureLimit - currentExposure)

        totalCapacity += exposureLimit
        totalUsed += currentExposure

        // 统计等级分布
        const level = user.level || 1
        levelDistribution[level] = (levelDistribution[level] || 0) + 1

        // 统计城市分布
        const city = user.city || '未知'
        cityDistribution[city] = (cityDistribution[city] || 0) + 1

        userDetails.push({
          userId: user.user_id,
          level: level,
          exposureLimit,
          currentExposure,
          availableQuota,
          selectionScore: user.selection_score || 0
        })
      }

      // 获取当前曝光需求
      const exposureDemand = await this.getTotalExposureDemand()

      // 计算供需比例
      const totalAvailable = totalCapacity - totalUsed
      const supplyDemandRatio = exposureDemand > 0
        ? totalAvailable / exposureDemand
        : 1

      return {
        totalCapacity,           // 总容量
        totalUsed,              // 已使用
        totalAvailable,         // 可用容量
        exposureDemand,         // 曝光需求
        supplyDemandRatio,      // 供需比例
        onlineUserCount: onlineUsers.length,
        levelDistribution,      // 等级分布
        cityDistribution,       // 城市分布
        userDetails            // 用户详情列表（可选，用于调试）
      }
    } catch (err) {
      logger.error(`计算总曝光容量失败: ${err.message}`)
      return {
        totalCapacity: 0,
        totalUsed: 0,
        totalAvailable: 0,
        exposureDemand: 0,
        supplyDemandRatio: 1,
        onlineUserCount: 0,
        levelDistribution: {},
        cityDistribution: {},
        userDetails: [],
        error: err.message
      }
    }
  }

  /**
   * 获取当前总曝光需求
   * @returns {Promise<number>} - 曝光需求数量
   */
  async getTotalExposureDemand() {
    try {
      const { data: tasks } = await supabase
        .from('task_exposure')
        .select('need_count, current_exposure, accepted_count')
        .eq('status', 1)

      if (!tasks) return 0

      return tasks.reduce((sum, task) => {
        const remaining = task.need_count - (task.accepted_count || 0)
        return sum + Math.max(0, remaining)
      }, 0)
    } catch (err) {
      logger.error(`获取总曝光需求失败: ${err.message}`)
      return 0
    }
  }

  /**
   * 获取曝光系统综合统计（供监控 API 使用）
   * @returns {Promise<object>} - 综合统计信息
   */
  async getExposureSystemStats() {
    try {
      // 并行获取各项统计
      const [
        capacity,
        supplyDemand,
        poolStats,
        onlineStats
      ] = await Promise.all([
        this.calculateTotalExposureCapacity(),
        this.getSupplyDemandStats(),
        taskPoolService?.getPoolStats() || { hotPool: null },
        onlineUserService?.getGlobalOnlineStats() || { totalOnline: 0 }
      ])

      // 获取任务曝光统计
      const { data: exposureStats } = await supabase
        .from('task_exposure')
        .select('status, current_exposure, max_exposure, need_count, accepted_count')
        .in('status', ['active', 'completed'])

      let totalExposure = 0
      let totalAccepted = 0
      let activeTasks = 0
      let completedTasks = 0

      for (const stat of (exposureStats || [])) {
        totalExposure += stat.current_exposure || 0
        totalAccepted += stat.accepted_count || 0
        if (stat.status === 'active') activeTasks++
        if (stat.status === 'completed') completedTasks++
      }

      return {
        // 容量相关
        capacity: {
          totalCapacity: capacity.totalCapacity,
          totalUsed: capacity.totalUsed,
          totalAvailable: capacity.totalAvailable,
          supplyDemandRatio: capacity.supplyDemandRatio.toFixed(2),
          onlineUserCount: capacity.onlineUserCount
        },
        // 需求相关
        demand: {
          exposureDemand: capacity.exposureDemand,
          activeTasks,
          completedTasks,
          totalExposure,
          totalAccepted,
          acceptRate: totalExposure > 0 ? (totalAccepted / totalExposure).toFixed(2) : '0'
        },
        // 用户分布
        distribution: {
          level: capacity.levelDistribution,
          city: Object.fromEntries(
            Object.entries(capacity.cityDistribution).slice(0, 10)  // 只返回前10个城市
          )
        },
        // 供需统计
        supplyDemand: {
          activeUsers: supplyDemand.activeUsers,
          activeTasks: supplyDemand.activeTasks,
          availableSlots: supplyDemand.availableSlots,
          ratio: supplyDemand.ratio,
          todayCompleted: supplyDemand.todayCompleted
        },
        // 池状态
        pool: {
          enabled: poolStats.enabled,
          hotPoolSize: poolStats.hotPool?.size || 0,
          hotPoolWarmedAt: poolStats.hotPool?.warmedAt,
          totalActive: poolStats.hotPool?.totalActive || 0
        },
        // 在线统计
        online: {
          totalOnline: onlineStats.totalOnline,
          lastUpdated: onlineStats.lastUpdated
        },
        timestamp: new Date().toISOString()
      }
    } catch (err) {
      logger.error(`获取曝光系统综合统计失败: ${err.message}`)
      return {
        capacity: { totalCapacity: 0, totalUsed: 0, totalAvailable: 0, supplyDemandRatio: '1', onlineUserCount: 0 },
        demand: { exposureDemand: 0, activeTasks: 0, completedTasks: 0, totalExposure: 0, totalAccepted: 0, acceptRate: '0' },
        distribution: { level: {}, city: {} },
        supplyDemand: { activeUsers: 0, activeTasks: 0, availableSlots: 0, ratio: '0', todayCompleted: 0 },
        pool: { enabled: false, hotPoolSize: 0, hotPoolWarmedAt: null, totalActive: 0 },
        online: { totalOnline: 0, lastUpdated: null },
        timestamp: new Date().toISOString(),
        error: err.message
      }
    }
  }
}

export default new ExposureService()
