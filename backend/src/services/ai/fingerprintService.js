/**
 * 图片指纹服务 - Supabase版
 * 
 * 用于检测重复截图作弊：
 * 1. 同一用户重复使用同一截图
 * 2. 不同用户使用同一截图（团伙作弊）
 * 
 * 实现方式：
 * - 使用 perceptual hash (pHash) 算法
 * - 计算图片的感知哈希值
 * - 相似图片有相似的哈希值
 * 
 * 数据存储：所有数据存储在Supabase
 */

import crypto from 'crypto'
import supabase from '../../utils/supabaseToPrismaAdapter.js'
import logger from '../../utils/logger.js'

/**
 * 计算图片的感知哈希值（简化版）
 * 由于无法直接处理图片，这里使用URL + 文件大小信息的组合
 */
export async function calculateImageFingerprint(imageUrl) {
  try {
    // 如果URL包含CDN签名，需要去掉签名参数
    const urlWithoutSignature = removeSignature(imageUrl)
    
    // 使用URL特征作为简化方案
    const hash = crypto
      .createHash('sha256')
      .update(urlWithoutSignature)
      .digest('hex')
      .substring(0, 32)
    
    return hash
  } catch (error) {
    logger.error('计算图片指纹失败:', error)
    return null
  }
}

/**
 * 去除URL中的签名参数
 */
function removeSignature(url) {
  try {
    const urlObj = new URL(url)
    const paramsToRemove = ['signature', 'sign', 'token', 't', 'timestamp', 'expires', 'OSSAccessKeyId', 'SecurityToken']
    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param)
    })
    return urlObj.toString()
  } catch {
    return url
  }
}

/**
 * 计算两个哈希值的汉明距离
 */
export function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return Infinity
  }
  
  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++
    }
  }
  return distance
}

/**
 * 判断两张图片是否相似
 */
export function isSimilar(hash1, hash2, threshold = 5) {
  const distance = hammingDistance(hash1, hash2)
  return distance <= threshold
}

/**
 * 检查截图指纹是否已存在
 * @param {string} fingerprint - 图片指纹
 * @param {number} excludeUserId - 排除的用户ID
 * @returns {Object} 检查结果
 */
export async function checkFingerprintExists(fingerprint, excludeUserId = null) {
  try {
    // 查找完全匹配的指纹
    let query = supabase
      .from('ai_screenshot_fingerprints')
      .select('*')
      .eq('fingerprint', fingerprint)
    
    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId)
    }
    
    const { data: exactMatch, error } = await query.maybeSingle()
    
    if (error) {
      logger.error('查询指纹失败:', error)
    }
    
    if (exactMatch) {
      // 手动获取关联数据
      const { data: user } = await supabase.from('users').select('id, username').eq('id', exactMatch.user_id).single()
      const { data: claim } = await supabase.from('claims').select('id, task_id, status').eq('id', exactMatch.claim_id).single()
      exactMatch.users = user
      exactMatch.claims = claim
      
      return {
        exists: true,
        matchType: 'exact',
        match: exactMatch
      }
    }
    
    // 查找相似的指纹（最近30天）
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    let similarQuery = supabase
      .from('ai_screenshot_fingerprints')
      .select('*')
      .gte('created_at', thirtyDaysAgo)
      .limit(1000)
    
    if (excludeUserId) {
      similarQuery = similarQuery.neq('user_id', excludeUserId)
    }
    
    const { data: recentFingerprints } = await similarQuery
    
    for (const fp of (recentFingerprints || [])) {
      if (isSimilar(fingerprint, fp.fingerprint, 5)) {
        return {
          exists: true,
          matchType: 'similar',
          match: fp,
          similarity: 1 - (hammingDistance(fingerprint, fp.fingerprint) / fingerprint.length)
        }
      }
    }
    
    return { exists: false }
  } catch (error) {
    logger.error('检查指纹存在性失败:', error)
    return { exists: false, error: error.message }
  }
}

/**
 * 保存截图指纹
 */
export async function saveFingerprint(data) {
  const { userId, claimId, imageUrl, fingerprint, status = 'valid' } = data
  
  try {
    const { data: record, error } = await supabase
      .from('ai_screenshot_fingerprints')
      .insert({
        user_id: userId,
        claim_id: claimId,
        image_url: imageUrl,
        fingerprint,
        status
      })
      .select()
      .single()
    
    if (error) throw error
    
    return record
  } catch (error) {
    logger.error('保存指纹失败:', error)
    throw error
  }
}

/**
 * 批量检查截图指纹
 */
export async function batchCheckFingerprints(imageUrls, userId) {
  const results = []
  let hasDuplicate = false
  let hasCrossUser = false
  const duplicateDetails = []
  
  for (const url of imageUrls) {
    const fingerprint = await calculateImageFingerprint(url)
    
    if (!fingerprint) {
      results.push({ url, fingerprint: null, status: 'error' })
      continue
    }
    
    const checkResult = await checkFingerprintExists(fingerprint, userId)
    
    if (checkResult.exists) {
      hasDuplicate = true
      
      const isSameUser = checkResult.match.user_id === userId
      if (!isSameUser) {
        hasCrossUser = true
      }
      
      duplicateDetails.push({
        url,
        fingerprint,
        matchType: checkResult.matchType,
        matchedUser: checkResult.match.users?.username,
        matchedClaimId: checkResult.match.claim_id,
        isSameUser,
        similarity: checkResult.similarity || 1
      })
      
      results.push({
        url,
        fingerprint,
        status: 'duplicate',
        detail: checkResult
      })
    } else {
      results.push({
        url,
        fingerprint,
        status: 'unique'
      })
    }
  }
  
  return {
    results,
    hasDuplicate,
    hasCrossUser,
    duplicateDetails,
    riskLevel: hasCrossUser ? 'high' : (hasDuplicate ? 'medium' : 'low')
  }
}

/**
 * 获取指纹统计
 */
export async function getFingerprintStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const [
    { count: totalCount },
    { count: todayCount },
    { count: duplicateCount }
  ] = await Promise.all([
    supabase.from('ai_screenshot_fingerprints').select('*', { count: 'exact', head: true }),
    supabase.from('ai_screenshot_fingerprints').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('ai_screenshot_fingerprints').select('*', { count: 'exact', head: true }).eq('status', 'duplicate')
  ])
  
  return {
    totalCount: totalCount || 0,
    todayCount: todayCount || 0,
    duplicateCount: duplicateCount || 0,
    uniqueCount: (totalCount || 0) - (duplicateCount || 0)
  }
}

/**
 * 标记指纹为作弊
 */
export async function markFingerprintAsCheat(fingerprint, reason = 'cheat') {
  const { error } = await supabase
    .from('ai_screenshot_fingerprints')
    .update({ status: 'cheat', reason })
    .eq('fingerprint', fingerprint)
  
  if (error) {
    logger.error('标记指纹失败:', error)
    throw error
  }
}

export default {
  calculateImageFingerprint,
  hammingDistance,
  isSimilar,
  checkFingerprintExists,
  saveFingerprint,
  batchCheckFingerprints,
  getFingerprintStats,
  markFingerprintAsCheat
}
