/**
 * 修复 task_exposure 数据越界问题
 * 
 * 执行方式：node scripts/fix_exposure_overflow.js
 */

import supabase from '../src/utils/supabase.js'
import logger from '../src/utils/logger.js'

async function fixExposureOverflow() {
  try {
    logger.info('开始修复 task_exposure 数据越界问题...')
    
    // 1. 查询越界数据
    const { data: overflowData, error: queryError } = await supabase
      .rpc('query', {
        sql: `
          SELECT 
            task_id,
            current_exposure,
            max_exposure,
            current_exposure - max_exposure as overflow_amount
          FROM task_exposure 
          WHERE current_exposure > max_exposure
          ORDER BY overflow_amount DESC
          LIMIT 20
        `
      })
    
    if (queryError) {
      logger.error('查询越界数据失败:', queryError.message)
    } else if (overflowData && overflowData.length > 0) {
      logger.warn(`发现 ${overflowData.length} 条越界数据:`)
      overflowData.forEach(item => {
        logger.warn(`  任务 ${item.task_id}: ${item.current_exposure}/${item.max_exposure} (超出 ${item.overflow_amount})`)
      })
    } else {
      logger.info('没有发现越界数据')
    }
    
    // 2. 修复越界数据
    const { data: updateResult, error: updateError } = await supabase
      .rpc('query', {
        sql: `
          UPDATE task_exposure 
          SET 
            current_exposure = max_exposure,
            updated_at = NOW()
          WHERE current_exposure > max_exposure
          RETURNING task_id, current_exposure, max_exposure
        `
      })
    
    if (updateError) {
      logger.error('修复越界数据失败:', updateError.message)
    } else if (updateResult && updateResult.length > 0) {
      logger.info(`成功修复 ${updateResult.length} 条越界数据`)
    }
    
    // 3. 创建触发器（需要在 Supabase 控制台手动执行）
    logger.info('请在 Supabase 控制台执行以下 SQL 创建触发器:')
    logger.info(`
CREATE OR REPLACE FUNCTION check_exposure_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_exposure > NEW.max_exposure THEN
    NEW.current_exposure := NEW.max_exposure;
  END IF;
  IF NEW.current_exposure < 0 THEN
    NEW.current_exposure := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exposure_limit_trigger ON task_exposure;
CREATE TRIGGER exposure_limit_trigger
BEFORE INSERT OR UPDATE OF current_exposure ON task_exposure
FOR EACH ROW
EXECUTE FUNCTION check_exposure_limit();
    `)
    
    // 4. 验证修复结果
    const { data: stats, error: statsError } = await supabase
      .rpc('query', {
        sql: `
          SELECT 
            COUNT(*) as total_tasks,
            COUNT(CASE WHEN current_exposure > max_exposure THEN 1 END) as overflow_tasks,
            COUNT(CASE WHEN current_exposure <= max_exposure THEN 1 END) as normal_tasks
          FROM task_exposure
        `
      })
    
    if (statsError) {
      logger.error('查询统计失败:', statsError.message)
    } else if (stats && stats.length > 0) {
      logger.info('修复结果统计:')
      logger.info(`  总任务数: ${stats[0].total_tasks}`)
      logger.info(`  正常任务数: ${stats[0].normal_tasks}`)
      logger.info(`  越界任务数: ${stats[0].overflow_tasks}`)
    }
    
    logger.info('修复完成！')
    process.exit(0)
  } catch (err) {
    logger.error('修复过程异常:', err)
    process.exit(1)
  }
}

fixExposureOverflow()
