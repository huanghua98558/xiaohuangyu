/**
 * 封控账号服务
 * 
 * 功能：
 * 1. 检测和记录疑似封控账号
 * 2. 查询封控状态
 * 3. 管理员确认/标记误报
 */

import supabase from '../../utils/supabaseToPrismaAdapter.js'
import logger from '../../utils/logger.js'

/**
 * 检测并记录封控账号
 */
export async function detectAndRecordBlock(params) {
  const {
    userId,
    claimId,
    platform,
    platformUserId,
    platformUsername,
    failReason,
    evidence
  } = params

  try {
    // 检查是否已存在记录
    const { data: existing } = await supabase
      .from('blocked_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .order('detected_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      // 更新出现次数
      await supabase
        .from('blocked_accounts')
        .update({
          occurrence_count: (existing.occurrence_count || 1) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      return {
        isNewBlock: false,
        status: existing.status,
        block: existing
      }
    }

    // 创建新记录
    const { data: block, error } = await supabase
      .from('blocked_accounts')
      .insert({
        user_id: userId,
        claim_id: claimId,
        platform,
        platform_user_id: platformUserId,
        platform_nickname: platformUsername,
        block_type: 'comment_hidden',
        detection_method: 'link_verification',
        status: 'suspected',
        evidence,
        detected_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // 更新用户标记
    await supabase
      .from('users')
      .update({
        has_blocked_account: true,
        blocked_account_count: 1,
        last_blocked_at: new Date().toISOString()
      })
      .eq('id', userId)

    return {
      isNewBlock: true,
      status: 'suspected',
      block
    }

  } catch (error) {
    logger.error('[BlockedAccounts] 检测封控失败:', error)
    throw error
  }
}

/**
 * 获取封控账号列表
 */
export async function getBlockedAccounts(params = {}) {
  const {
    status,
    platform,
    page = 1,
    pageSize = 20
  } = params

  try {
    let query = supabase
      .from('blocked_accounts')
      .select('*, users(phone, username)', { count: 'exact' })
      .order('detected_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (status) query = query.eq('status', status)
    if (platform) query = query.eq('platform', platform)

    const { data, count, error } = await query
    if (error) throw error

    return { list: data || [], total: count || 0 }
  } catch (error) {
    logger.error('[BlockedAccounts] 获取列表失败:', error)
    return { list: [], total: 0 }
  }
}

/**
 * 获取封控统计
 */
export async function getBlockedStats() {
  try {
    const { data, error } = await supabase
      .from('blocked_accounts')
      .select('status')

    if (error) throw error

    const stats = {
      total: data?.length || 0,
      suspected: data?.filter(i => i.status === 'suspected').length || 0,
      confirmed: data?.filter(i => i.status === 'confirmed').length || 0,
      false_alarm: data?.filter(i => i.status === 'false_alarm').length || 0
    }

    return stats
  } catch (error) {
    logger.error('[BlockedAccounts] 获取统计失败:', error)
    return { total: 0, suspected: 0, confirmed: 0, false_alarm: 0 }
  }
}

/**
 * 确认封控
 */
export async function confirmBlock(id, adminId, note = '') {
  try {
    const { data, error } = await supabase
      .from('blocked_accounts')
      .update({
        status: 'confirmed',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        review_note: note,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // 更新关联的claim状态
    if (data.claim_id) {
      await supabase
        .from('claims')
        .update({
          status: 'rejected',
          block_status: 'confirmed',
          reviewed_at: new Date().toISOString(),
          review_note: '账号确认封控'
        })
        .eq('id', data.claim_id)
    }

    return { success: true, data }
  } catch (error) {
    logger.error('[BlockedAccounts] 确认封控失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 标记误报
 */
export async function markFalseAlarm(id, adminId, note = '') {
  try {
    const { data, error } = await supabase
      .from('blocked_accounts')
      .update({
        status: 'false_alarm',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        review_note: note,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // 更新关联的claim状态为通过
    if (data.claim_id) {
      await supabase
        .from('claims')
        .update({
          status: 'done',
          block_status: 'false_alarm',
          reviewed_at: new Date().toISOString(),
          ai_review_status: 'approved'
        })
        .eq('id', data.claim_id)
    }

    return { success: true, data }
  } catch (error) {
    logger.error('[BlockedAccounts] 标记误报失败:', error)
    return { success: false, error: error.message }
  }
}

export default {
  detectAndRecordBlock,
  getBlockedAccounts,
  getBlockedStats,
  confirmBlock,
  markFalseAlarm
}
