import supabase from './supabase.js'
import logger from './logger.js'

/**
 * 重置数据库序列
 * 用于解决主键冲突问题
 */
export async function resetTaskSequence() {
  try {
    // 获取当前最大ID
    const { data: maxIdResult, error: maxError } = await supabase
      .from('tasks')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
    
    if (maxError) {
      logger.error('获取最大ID失败:', maxError)
      return { success: false, error: maxError.message }
    }
    
    const maxId = maxIdResult?.[0]?.id || 0
    logger.info('当前最大任务ID:', maxId)
    
    return { success: true, maxId }
  } catch (err) {
    logger.error('重置序列异常:', err)
    return { success: false, error: err.message }
  }
}

export default resetTaskSequence
