/**
 * 封控账号服务
 * 处理封控账号的检测、记录、查询和管理
 */

import supabase from '../utils/supabaseToPrismaAdapter.js'
import { 
  BLOCK_STATUS, 
  BLOCK_STATUS_NAMES,
  ADMIN_NOTIFICATION_TYPES,
  USER_NOTIFICATION_TYPES,
} from '../constants/taskActions.js'

/**
 * 检测并记录封控账号
 * @param {Object} params
 * @param {string} params.userId - 用户ID
 * @param {string} params.claimId - 任务ID
 * @param {string} params.platform - 平台
 * @param {string} params.platformUserId - 平台用户ID
 * @param {string} params.platformUsername - 平台用户名
 * @param {string} params.failReason - 失败原因
 * @param {Object} params.evidence - 证据数据
 * @returns {Promise<Object>} 封控记录
 */
export async function detectAndRecordBlock(params) {
  const {
    userId,
    claimId,
    platform,
    platformUserId,
    platformUsername,
    failReason,
    evidence = {},
  } = params

  console.log('[BlockedAccounts] 检测封控账号:', {
    userId,
    claimId,
    platform,
    platformUserId,
    failReason,
  })

  try {
    // 1. 检查是否已存在封控记录
    const { data: existingBlock, error: queryError } = await supabase
      .from('blocked_accounts')
      .select('*')
      .eq('platform', platform)
      .eq('platform_user_id', platformUserId)
      .eq('status', BLOCK_STATUS.CONFIRMED)
      .single()

    if (queryError && queryError.code !== 'PGRST116') {
      throw queryError
    }

    if (existingBlock) {
      console.log('[BlockedAccounts] 已存在确认封控记录:', existingBlock.id)
      
      // 更新关联的任务状态
      await updateClaimBlockStatus(claimId, BLOCK_STATUS.CONFIRMED)
      
      return {
        isNewBlock: false,
        block: existingBlock,
        status: 'already_confirmed',
      }
    }

    // 2. 创建新的封控记录（疑似状态）
    const blockData = {
      user_id: userId,
      claim_id: claimId,
      platform,
      platform_user_id: platformUserId,
      platform_username: platformUsername,
      status: BLOCK_STATUS.SUSPECTED,
      detection_source: 'link_verification',
      detection_reason: failReason,
      evidence: {
        ...evidence,
        detected_at: new Date().toISOString(),
        fail_reason: failReason,
      },
      detection_count: 1,
    }

    const { data: newBlock, error: insertError } = await supabase
      .from('blocked_accounts')
      .insert(blockData)
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    console.log('[BlockedAccounts] 创建疑似封控记录:', newBlock.id)

    // 3. 更新任务的封控状态
    await updateClaimBlockStatus(claimId, BLOCK_STATUS.SUSPECTED)

    // 4. 更新用户的封控统计
    await updateUserBlockStats(userId)

    // 5. 发送管理员通知
    await sendAdminNotification({
      type: ADMIN_NOTIFICATION_TYPES.BLOCK_DETECTED,
      blockId: newBlock.id,
      userId,
      claimId,
      platform,
      platformUserId,
      platformUsername,
      failReason,
    })

    // 6. 发送用户通知
    await sendUserNotification({
      type: USER_NOTIFICATION_TYPES.BLOCK_DETECTED,
      userId,
      claimId,
      platform,
      failReason,
    })

    return {
      isNewBlock: true,
      block: newBlock,
      status: 'suspected',
    }
  } catch (error) {
    console.error('[BlockedAccounts] 检测封控账号失败:', error)
    throw error
  }
}

/**
 * 更新任务的封控状态
 */
async function updateClaimBlockStatus(claimId, blockStatus) {
  const { error } = await supabase
    .from('claims')
    .update({
      block_status: blockStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)

  if (error) {
    console.error('[BlockedAccounts] 更新任务封控状态失败:', error)
  }
}

/**
 * 更新用户的封控统计
 */
async function updateUserBlockStats(userId) {
  // 查询用户的封控账号数量
  const { data: blockedAccounts, error: queryError } = await supabase
    .from('blocked_accounts')
    .select('id')
    .eq('user_id', userId)
    .in('status', [BLOCK_STATUS.SUSPECTED, BLOCK_STATUS.CONFIRMED])

  if (queryError) {
    console.error('[BlockedAccounts] 查询用户封控统计失败:', queryError)
    return
  }

  const blockedCount = blockedAccounts?.length || 0
  const hasBlocked = blockedCount > 0

  // 更新用户表
  const { error: updateError } = await supabase
    .from('users')
    .update({
      has_blocked_account: hasBlocked,
      blocked_account_count: blockedCount,
      last_blocked_at: hasBlocked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updateError) {
    console.error('[BlockedAccounts] 更新用户封控统计失败:', updateError)
  }
}

/**
 * 发送管理员通知
 */
async function sendAdminNotification(params) {
  const {
    type,
    blockId,
    userId,
    claimId,
    platform,
    platformUserId,
    platformUsername,
    failReason,
  } = params

  const notificationData = {
    type,
    title: 'Detected Blocked Account',
    message: 'Blocked account detected for user',
    data: {
      block_id: blockId,
      user_id: userId,
      claim_id: claimId,
      platform,
      platform_user_id: platformUserId,
      platform_username: platformUsername,
      fail_reason: failReason,
    },
    is_read: false,
  }

  const { error } = await supabase
    .from('admin_notifications')
    .insert(notificationData)

  if (error) {
    console.error('[BlockedAccounts] 发送管理员通知失败:', error)
  }
}

/**
 * 发送用户通知
 */
async function sendUserNotification(params) {
  const { type, userId, claimId, platform, failReason } = params

  const notificationData = {
    user_id: userId,
    type,
    title: '账号异常提醒',
    message: 'Blocked account detected for user',
    data: {
      claim_id: claimId,
      platform,
      fail_reason: failReason,
    },
    is_read: false,
  }

  const { error } = await supabase
    .from('user_notifications')
    .insert(notificationData)

  if (error) {
    console.error('[BlockedAccounts] 发送用户通知失败:', error)
  }
}

/**
 * 确认封控账号
 * @param {string} blockId - 封控记录ID
 * @param {string} adminId - 管理员ID
 * @param {string} notes - 备注
 */
export async function confirmBlock(blockId, adminId, notes = '') {
  console.log('[BlockedAccounts] 确认封控:', blockId)

  const { data: block, error: fetchError } = await supabase
    .from('blocked_accounts')
    .select('*')
    .eq('id', blockId)
    .single()

  if (fetchError) throw fetchError

  const { data: updatedBlock, error: updateError } = await supabase
    .from('blocked_accounts')
    .update({
      status: BLOCK_STATUS.CONFIRMED,
      confirmed_at: new Date().toISOString(),
      confirmed_by: adminId,
      admin_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', blockId)
    .select()
    .single()

  if (updateError) throw updateError

  // 更新关联任务状态
  if (block.claim_id) {
    await updateClaimBlockStatus(block.claim_id, BLOCK_STATUS.CONFIRMED)
  }

  // 更新用户统计
  await updateUserBlockStats(block.user_id)

  return updatedBlock
}

/**
 * 标记为误报
 * @param {string} blockId - 封控记录ID
 * @param {string} adminId - 管理员ID
 * @param {string} notes - 备注
 */
export async function markAsFalsePositive(blockId, adminId, notes = '') {
  console.log('[BlockedAccounts] 标记误报:', blockId)

  const { data: block, error: fetchError } = await supabase
    .from('blocked_accounts')
    .select('*')
    .eq('id', blockId)
    .single()

  if (fetchError) throw fetchError

  const { data: updatedBlock, error: updateError } = await supabase
    .from('blocked_accounts')
    .update({
      status: BLOCK_STATUS.FALSE_POSITIVE,
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
      admin_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', blockId)
    .select()
    .single()

  if (updateError) throw updateError

  // 恢复任务状态
  if (block.claim_id) {
    await updateClaimBlockStatus(block.claim_id, BLOCK_STATUS.NONE)
  }

  // 更新用户统计
  await updateUserBlockStats(block.user_id)

  return updatedBlock
}

/**
 * 查询封控账号列表
 * @param {Object} params - 查询参数
 */
export async function getBlockedAccounts(params = {}) {
  const {
    status,
    platform,
    userId,
    page = 1,
    pageSize = 20,
  } = params

  let query = supabase
    .from('blocked_accounts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }
  if (platform) {
    query = query.eq('platform', platform)
  }
  if (userId) {
    query = query.eq('user_id', userId)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('[BlockedAccounts] 查询失败:', error)
    throw error
  }

  return {
    list: data || [],
    total: count || 0,
    page,
    pageSize,
  }
}

/**
 * 获取封控统计信息
 */
export async function getBlockStats() {
  const { data, error } = await supabase
    .from('blocked_accounts')
    .select('status, platform')

  if (error) throw error

  const stats = {
    total: data?.length || 0,
    byStatus: {},
    byPlatform: {},
  }

  data?.forEach(item => {
    // 按状态统计
    stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1
    // 按平台统计
    stats.byPlatform[item.platform] = (stats.byPlatform[item.platform] || 0) + 1
  })

  return stats
}

/**
 * 检查账号是否被封控
 * @param {string} platform - 平台
 * @param {string} platformUserId - 平台用户ID
 */
export async function checkAccountBlocked(platform, platformUserId) {
  const { data, error } = await supabase
    .from('blocked_accounts')
    .select('*')
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId)
    .eq('status', BLOCK_STATUS.CONFIRMED)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  return {
    isBlocked: !!data,
    block: data,
  }
}

export default {
  detectAndRecordBlock,
  confirmBlock,
  markAsFalsePositive,
  getBlockedAccounts,
  getBlockStats,
  checkAccountBlocked,
}
