// 全局 BigInt 序列化处理
BigInt.prototype.toJSON = function() { return this.toString(); }
import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'

/**
 * 任务快照服务
 * 记录任务变更历史，支持版本回溯
 */
class TaskSnapshotService {
  
  /**
   * 创建任务快照
   * @param {number} taskId - 任务ID
   * @param {string} reason - 快照原因 (create/update/delete/status_change)
   * @param {Object} operator - 操作者信息
   */
  async createSnapshot(taskId, reason, operator = {}) {
    try {
      // 获取任务完整数据
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()

      if (taskError || !task) {
        logger.error('获取任务数据失败:', taskError)
        return null
      }

      const { data, error } = await supabase
        .from('task_snapshots')
        .insert({
          task_id: taskId,
          task_code: task.task_code,
          snapshot_data: task,
          snapshot_reason: reason,
          operator_id: operator.id,
          operator_name: operator.name,
          operator_role: operator.role,
          ip_address: operator.ip,
          location: operator.location
        })
        .select()
        .single()

      if (error) {
        logger.error('创建任务快照失败:', error)
        return null
      }

      logger.info(`任务快照已创建: 任务${taskId}, 原因:${reason}`)
      return data
    } catch (err) {
      logger.error('创建任务快照异常:', err)
      return null
    }
  }

  /**
   * 获取任务快照历史
   */
  async getTaskSnapshots(taskId, page = 1, size = 20) {
    const offset = (page - 1) * size

    const { data: snapshots, count, error } = await supabase
      .from('task_snapshots')
      .select('*', { count: 'exact' })
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    if (error) {
      throw new Error('获取任务快照失败')
    }

    return {
      list: snapshots || [],
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取指定版本快照
   */
  async getSnapshotByVersion(taskId, version) {
    const { data, error } = await supabase
      .from('task_snapshots')
      .select('*')
      .eq('task_id', taskId)
      .eq('id', version)
      .single()

    if (error) {
      throw new Error('获取指定版本快照失败')
    }

    return data
  }

  /**
   * 对比两个版本的快照
   */
  async compareSnapshots(taskId, version1, version2) {
    const [snapshot1, snapshot2] = await Promise.all([
      this.getSnapshotByVersion(taskId, version1),
      this.getSnapshotByVersion(taskId, version2)
    ])

    const data1 = snapshot1.snapshot_data
    const data2 = snapshot2.snapshot_data

    const changes = []
    const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)])

    for (const key of allKeys) {
      if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
        changes.push({
          field: key,
          oldValue: data1[key],
          newValue: data2[key]
        })
      }
    }

    return {
      version1: {
        id: snapshot1.id,
        time: snapshot1.created_at,
        operator: snapshot1.operator_name,
        reason: snapshot1.snapshot_reason
      },
      version2: {
        id: snapshot2.id,
        time: snapshot2.created_at,
        operator: snapshot2.operator_name,
        reason: snapshot2.snapshot_reason
      },
      changes
    }
  }

  /**
   * 恢复到指定版本（软恢复，创建新快照）
   */
  async restoreToVersion(taskId, version, operator = {}) {
    const snapshot = await this.getSnapshotByVersion(taskId, version)
    
    if (!snapshot) {
      throw new Error('快照不存在')
    }

    const data = snapshot.snapshot_data
    
    // 移除不可更新的字段
    delete data.id
    delete data.created_at
    delete data.updated_at

    // 更新任务
    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single()

    if (error) {
      throw new Error('恢复任务失败')
    }

    // 创建恢复快照
    await this.createSnapshot(taskId, 'restore', {
      ...operator,
      detail: `从版本${version}恢复`
    })

    return updatedTask
  }

  /**
   * 获取任务变更时间线
   */
  async getTaskTimeline(taskId) {
    const { data: snapshots, error } = await supabase
      .from('task_snapshots')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error('获取任务时间线失败')
    }

    return (snapshots || []).map(s => ({
      id: s.id,
      time: s.created_at,
      reason: s.snapshot_reason,
      operator: {
        id: s.operator_id,
        name: s.operator_name,
        role: s.operator_role
      },
      ip: s.ip_address,
      location: s.location,
      summary: this.summarizeChange(s.snapshot_data, s.snapshot_reason)
    }))
  }

  /**
   * 生成变更摘要
   */
  summarizeChange(data, reason) {
    const reasonMap = {
      'create': `创建任务: ${data.title}`,
      'update': `更新任务: ${data.title}`,
      'delete': `删除任务: ${data.title}`,
      'status_change': `状态变更为: ${data.status}`,
      'restore': '恢复任务'
    }
    return reasonMap[reason] || `操作: ${reason}`
  }
}

export default new TaskSnapshotService()
