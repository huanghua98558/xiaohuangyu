/**
 * 全局审核配置服务
 * 
 * 功能：
 * 1. 集中管理所有审核相关配置
 * 2. 内存缓存 + 定时刷新
 * 3. 配置变更日志记录
 * 4. 热更新支持
 */

import db from '../../config/database.js'
import logger from '../../utils/logger.js'

function readBoolean(configMap, key, fallback) {
  const raw = configMap[key]
  if (raw === undefined || raw === null || raw === '') {
    return fallback
  }
  return String(raw) === 'true'
}

function readInteger(configMap, key, fallback) {
  const raw = configMap[key]
  if (raw === undefined || raw === null || raw === '') {
    return fallback
  }
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : fallback
}

function readFloat(configMap, key, fallback) {
  const raw = configMap[key]
  if (raw === undefined || raw === null || raw === '') {
    return fallback
  }
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : fallback
}

function inferConfigCategory(key) {
  if (key.startsWith('link_verify_')) {
    return 'link_review'
  }
  return 'review_global'
}

// ========== 默认配置 ==========
const DEFAULT_CONFIG = {
  // 检测项开关
  checks: {
    follow: true,
    like: true,
    favorite: true,
    comment: true,
    authorName: true,
    commentNickname: true
  },
  // 评论标准
  comment: {
    minLength: 8,
    maxLength: 500
  },
  // 语意识别
  semantic: {
    enabled: true,
    mode: 'default_pass',
    minRelevance: 0.5,
    minPositivity: 0.3,
    minEffectiveness: 0.5
  },
  // AI降级
  aiFallback: {
    enabled: true,
    onReject: true
  },
  // 通过标准
  passMode: 'all',
  // 链接验证
  linkVerify: {
    enabled: true,
    delayMinutes: 15,
    batchThreshold: 5,
    maxWaitMinutes: 60,
    batchSize: 10,
    retryCount: 3
  },
  // 状态流转
  flow: {
    autoTriggerImage: true,
    autoTriggerLink: true,
    blockedDetection: true,
    notifyAdmin: true,
    notifyUser: true
  }
}

// ========== 配置服务类 ==========
class ReviewConfigService {
  constructor() {
    this.config = null
    this.lastUpdate = 0
    this.cacheTTL = 60 * 1000 // 1分钟缓存
    this.listeners = new Set()
  }

  /**
   * 获取配置（带缓存）
   */
  async getConfig() {
    const now = Date.now()
    
    // 缓存有效
    if (this.config && now - this.lastUpdate < this.cacheTTL) {
      return this.config
    }
    
    // 重新加载
    await this.reloadConfig()
    return this.config
  }

  /**
   * 强制刷新配置
   */
  async reloadConfig() {
    try {
      const configMap = {}
      const rows = await db.queryMany(
        `
        SELECT key, value
        FROM ai_configs
        WHERE key LIKE 'review_global_%' OR key LIKE 'link_verify_%'
        `
      )

      for (const item of rows || []) {
        configMap[item.key] = item.value
      }
      
      // 构建配置对象
      this.config = {
        checks: {
          follow: readBoolean(configMap, 'review_global_check_follow', DEFAULT_CONFIG.checks.follow),
          like: readBoolean(configMap, 'review_global_check_like', DEFAULT_CONFIG.checks.like),
          favorite: readBoolean(configMap, 'review_global_check_favorite', DEFAULT_CONFIG.checks.favorite),
          comment: readBoolean(configMap, 'review_global_check_comment', DEFAULT_CONFIG.checks.comment),
          authorName: readBoolean(configMap, 'review_global_check_author_name', DEFAULT_CONFIG.checks.authorName),
          commentNickname: readBoolean(configMap, 'review_global_check_comment_nickname', DEFAULT_CONFIG.checks.commentNickname)
        },
        comment: {
          minLength: readInteger(configMap, 'review_global_comment_min_length', DEFAULT_CONFIG.comment.minLength),
          maxLength: readInteger(configMap, 'review_global_comment_max_length', DEFAULT_CONFIG.comment.maxLength)
        },
        semantic: {
          enabled: readBoolean(configMap, 'review_global_semantic_enabled', DEFAULT_CONFIG.semantic.enabled),
          mode: configMap['review_global_semantic_mode'] || DEFAULT_CONFIG.semantic.mode,
          minRelevance: readFloat(configMap, 'review_global_semantic_min_relevance', DEFAULT_CONFIG.semantic.minRelevance),
          minPositivity: readFloat(configMap, 'review_global_semantic_min_positivity', DEFAULT_CONFIG.semantic.minPositivity),
          minEffectiveness: readFloat(configMap, 'review_global_semantic_min_effectiveness', DEFAULT_CONFIG.semantic.minEffectiveness)
        },
        aiFallback: {
          enabled: readBoolean(configMap, 'review_global_ai_fallback_enabled', DEFAULT_CONFIG.aiFallback.enabled),
          onReject: readBoolean(configMap, 'review_global_ai_fallback_on_reject', DEFAULT_CONFIG.aiFallback.onReject)
        },
        passMode: configMap['review_global_pass_mode'] || DEFAULT_CONFIG.passMode,
        linkVerify: {
          enabled: readBoolean(configMap, 'link_verify_enabled', DEFAULT_CONFIG.linkVerify.enabled),
          delayMinutes: readInteger(configMap, 'link_verify_delay_minutes', DEFAULT_CONFIG.linkVerify.delayMinutes),
          batchThreshold: readInteger(configMap, 'link_verify_batch_threshold', DEFAULT_CONFIG.linkVerify.batchThreshold),
          maxWaitMinutes: readInteger(configMap, 'link_verify_max_wait_minutes', DEFAULT_CONFIG.linkVerify.maxWaitMinutes),
          batchSize: readInteger(configMap, 'link_verify_batch_size', DEFAULT_CONFIG.linkVerify.batchSize),
          retryCount: readInteger(configMap, 'link_verify_retry_count', DEFAULT_CONFIG.linkVerify.retryCount)
        },
        flow: {
          autoTriggerImage: readBoolean(configMap, 'review_global_flow_auto_trigger_image', DEFAULT_CONFIG.flow.autoTriggerImage),
          autoTriggerLink: readBoolean(configMap, 'review_global_flow_auto_trigger_link', DEFAULT_CONFIG.flow.autoTriggerLink),
          blockedDetection: readBoolean(configMap, 'review_global_flow_blocked_detection', DEFAULT_CONFIG.flow.blockedDetection),
          notifyAdmin: readBoolean(configMap, 'review_global_flow_notify_admin', DEFAULT_CONFIG.flow.notifyAdmin),
          notifyUser: readBoolean(configMap, 'review_global_flow_notify_user', DEFAULT_CONFIG.flow.notifyUser)
        }
      }
      
      this.lastUpdate = Date.now()
      
      // 通知监听器
      this.listeners.forEach(fn => fn(this.config))
      
      logger.info('[ReviewConfig] 配置已更新')
      
    } catch (error) {
      logger.error('[ReviewConfig] 加载配置失败:', error)
      // 返回默认配置
      this.config = DEFAULT_CONFIG
    }
    
    return this.config
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig, adminInfo = {}) {
    try {
      const now = new Date().toISOString()
      const updates = []
      const logs = []
      
      // 构建更新列表
      if (newConfig.checks) {
        const checks = newConfig.checks
        if (checks.follow !== undefined) {
          updates.push({ key: 'review_global_check_follow', value: String(checks.follow) })
        }
        if (checks.like !== undefined) {
          updates.push({ key: 'review_global_check_like', value: String(checks.like) })
        }
        if (checks.favorite !== undefined) {
          updates.push({ key: 'review_global_check_favorite', value: String(checks.favorite) })
        }
        if (checks.comment !== undefined) {
          updates.push({ key: 'review_global_check_comment', value: String(checks.comment) })
        }
        if (checks.authorName !== undefined) {
          updates.push({ key: 'review_global_check_author_name', value: String(checks.authorName) })
        }
        if (checks.commentNickname !== undefined) {
          updates.push({ key: 'review_global_check_comment_nickname', value: String(checks.commentNickname) })
        }
      }
      
      if (newConfig.comment) {
        if (newConfig.comment.minLength !== undefined) {
          updates.push({ key: 'review_global_comment_min_length', value: String(newConfig.comment.minLength) })
        }
        if (newConfig.comment.maxLength !== undefined) {
          updates.push({ key: 'review_global_comment_max_length', value: String(newConfig.comment.maxLength) })
        }
      }
      
      if (newConfig.semantic) {
        const semantic = newConfig.semantic
        if (semantic.enabled !== undefined) {
          updates.push({ key: 'review_global_semantic_enabled', value: String(semantic.enabled) })
        }
        if (semantic.mode !== undefined) {
          updates.push({ key: 'review_global_semantic_mode', value: semantic.mode })
        }
        if (semantic.minRelevance !== undefined) {
          updates.push({ key: 'review_global_semantic_min_relevance', value: String(semantic.minRelevance) })
        }
        if (semantic.minPositivity !== undefined) {
          updates.push({ key: 'review_global_semantic_min_positivity', value: String(semantic.minPositivity) })
        }
        if (semantic.minEffectiveness !== undefined) {
          updates.push({ key: 'review_global_semantic_min_effectiveness', value: String(semantic.minEffectiveness) })
        }
      }
      
      if (newConfig.aiFallback) {
        if (newConfig.aiFallback.enabled !== undefined) {
          updates.push({ key: 'review_global_ai_fallback_enabled', value: String(newConfig.aiFallback.enabled) })
        }
        if (newConfig.aiFallback.onReject !== undefined) {
          updates.push({ key: 'review_global_ai_fallback_on_reject', value: String(newConfig.aiFallback.onReject) })
        }
      }
      
      if (newConfig.passMode !== undefined) {
        updates.push({ key: 'review_global_pass_mode', value: newConfig.passMode })
      }
      
      if (newConfig.linkVerify) {
        const linkVerify = newConfig.linkVerify
        if (linkVerify.enabled !== undefined) {
          updates.push({ key: 'link_verify_enabled', value: String(linkVerify.enabled) })
        }
        if (linkVerify.delayMinutes !== undefined) {
          updates.push({ key: 'link_verify_delay_minutes', value: String(linkVerify.delayMinutes) })
        }
        if (linkVerify.batchThreshold !== undefined) {
          updates.push({ key: 'link_verify_batch_threshold', value: String(linkVerify.batchThreshold) })
        }
        if (linkVerify.maxWaitMinutes !== undefined) {
          updates.push({ key: 'link_verify_max_wait_minutes', value: String(linkVerify.maxWaitMinutes) })
        }
        if (linkVerify.batchSize !== undefined) {
          updates.push({ key: 'link_verify_batch_size', value: String(linkVerify.batchSize) })
        }
        if (linkVerify.retryCount !== undefined) {
          updates.push({ key: 'link_verify_retry_count', value: String(linkVerify.retryCount) })
        }
      }
      
      if (newConfig.flow) {
        const flow = newConfig.flow
        if (flow.autoTriggerImage !== undefined) {
          updates.push({ key: 'review_global_flow_auto_trigger_image', value: String(flow.autoTriggerImage) })
        }
        if (flow.autoTriggerLink !== undefined) {
          updates.push({ key: 'review_global_flow_auto_trigger_link', value: String(flow.autoTriggerLink) })
        }
        if (flow.blockedDetection !== undefined) {
          updates.push({ key: 'review_global_flow_blocked_detection', value: String(flow.blockedDetection) })
        }
        if (flow.notifyAdmin !== undefined) {
          updates.push({ key: 'review_global_flow_notify_admin', value: String(flow.notifyAdmin) })
        }
        if (flow.notifyUser !== undefined) {
          updates.push({ key: 'review_global_flow_notify_user', value: String(flow.notifyUser) })
        }
      }
      
      // 批量更新
      for (const update of updates) {
        await db.query(
          `
          INSERT INTO ai_configs (key, value, type, category, is_enabled, updated_at)
          VALUES ($1, $2, 'text', $3, true, $4)
          ON CONFLICT (key)
          DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = EXCLUDED.updated_at
          `,
          [update.key, update.value, inferConfigCategory(update.key), now]
        )
      }
      
      // 记录日志
      await this.logChanges(updates, adminInfo)
      
      // 强制刷新缓存
      await this.reloadConfig()
      
      logger.info('[ReviewConfig] 配置已更新，共', updates.length, '项')
      
      return { success: true, updatedCount: updates.length }
      
    } catch (error) {
      logger.error('[ReviewConfig] 更新配置失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 记录变更日志
   */
  async logChanges(updates, adminInfo) {
    try {
      // 获取旧配置用于对比
      const oldConfig = this.config || {}
      
      const logs = updates.map(update => {
        const fieldPath = this.keyToPath(update.key)
        return {
          admin_id: adminInfo.id || 0,
          admin_name: adminInfo.name || '系统',
          field_name: fieldPath,
          new_value: update.value,
          ip_address: adminInfo.ip || null,
          created_at: new Date().toISOString()
        }
      })
      
      // 插入日志（如果有 operation_logs 表）
      // await supabase.from('operation_logs').insert(logs)
      
      logger.info('[ReviewConfig] 变更日志:', logs.length, '条')
      
    } catch (error) {
      logger.error('[ReviewConfig] 记录日志失败:', error)
    }
  }

  /**
   * 配置key转路径
   */
  keyToPath(key) {
    const map = {
      'review_global_check_follow': 'checks.follow',
      'review_global_check_like': 'checks.like',
      'review_global_check_favorite': 'checks.favorite',
      'review_global_check_comment': 'checks.comment',
      'review_global_check_author_name': 'checks.authorName',
      'review_global_check_comment_nickname': 'checks.commentNickname',
      'review_global_comment_min_length': 'comment.minLength',
      'review_global_comment_max_length': 'comment.maxLength',
      'review_global_semantic_enabled': 'semantic.enabled',
      'review_global_semantic_mode': 'semantic.mode',
      'review_global_semantic_min_relevance': 'semantic.minRelevance',
      'review_global_semantic_min_positivity': 'semantic.minPositivity',
      'review_global_semantic_min_effectiveness': 'semantic.minEffectiveness',
      'review_global_ai_fallback_enabled': 'aiFallback.enabled',
      'review_global_ai_fallback_on_reject': 'aiFallback.onReject',
      'review_global_pass_mode': 'passMode',
      'link_verify_enabled': 'linkVerify.enabled',
      'link_verify_delay_minutes': 'linkVerify.delayMinutes',
      'link_verify_batch_threshold': 'linkVerify.batchThreshold',
      'link_verify_max_wait_minutes': 'linkVerify.maxWaitMinutes',
      'link_verify_batch_size': 'linkVerify.batchSize',
      'link_verify_retry_count': 'linkVerify.retryCount',
      'review_global_flow_auto_trigger_image': 'flow.autoTriggerImage',
      'review_global_flow_auto_trigger_link': 'flow.autoTriggerLink',
      'review_global_flow_blocked_detection': 'flow.blockedDetection',
      'review_global_flow_notify_admin': 'flow.notifyAdmin',
      'review_global_flow_notify_user': 'flow.notifyUser'
    }
    return map[key] || key
  }

  /**
   * 监听配置变更
   */
  onChange(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * 重置为默认配置
   */
  async resetToDefault(adminInfo = {}) {
    const defaultConfig = {
      checks: { ...DEFAULT_CONFIG.checks },
      comment: { ...DEFAULT_CONFIG.comment },
      semantic: { ...DEFAULT_CONFIG.semantic },
      aiFallback: { ...DEFAULT_CONFIG.aiFallback },
      passMode: DEFAULT_CONFIG.passMode,
      linkVerify: { ...DEFAULT_CONFIG.linkVerify },
      flow: { ...DEFAULT_CONFIG.flow }
    }
    
    return await this.updateConfig(defaultConfig, adminInfo)
  }
}

// 单例导出
export const reviewConfig = new ReviewConfigService()
export default reviewConfig
