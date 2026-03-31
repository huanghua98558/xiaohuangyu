import adminService from '../services/adminService.js'
import operationLogService from '../services/operationLogService.js'
import { success } from '../utils/response.js'
import { getRequestLocation } from '../utils/ipLocation.js'

class AdminController {
  /**
   * 获取统计数据
   */
  async getStats(req, res, next) {
    try {
      const stats = await adminService.getStats()
      success(res, stats)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户列表
   */
  async getUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      const filters = {
        role: req.query.role,
        level: req.query.level,
        search: req.query.search,
        isOnline: req.query.isOnline === 'true' ? true : req.query.isOnline === 'false' ? false : undefined,
        sortBy: req.query.sortBy || 'online_first',
        sortOrder: req.query.sortOrder || 'desc'
      }
      const result = await adminService.getUsersWithOnlineStatus(page, size, filters)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const { status } = req.body
      const user = await adminService.updateUserStatus(userId, status)
      success(res, user, '更新成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新用户等级
   */
  async updateUserLevel(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const { level } = req.body
      const user = await adminService.updateUserLevel(userId, level)
      success(res, user, '更新成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新用户角色
   */
  async updateUserRole(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const { role } = req.body
      const user = await adminService.updateUserRole(userId, role)
      success(res, user, '更新成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 调整用户积分（仅管理员）
   */
  async updateUserPoints(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const { amount, reason } = req.body
      const adminId = req.userId
      
      if (typeof amount !== 'number') {
        return res.status(400).json({ code: 400, message: '积分变化值必须为数字', data: null })
      }
      
      const result = await adminService.updateUserPoints(userId, amount, reason, adminId)
      success(res, result, '积分调整成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 调整用户余额（仅管理员）
   */
  async updateUserBalance(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const { amount, reason } = req.body
      const adminId = req.userId
      
      if (typeof amount !== 'number') {
        return res.status(400).json({ code: 400, message: '余额变化值必须为数字', data: null })
      }
      
      const result = await adminService.updateUserBalance(userId, amount, reason, adminId)
      success(res, result, '余额调整成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取角色列表
   */
  async getRoles(req, res, next) {
    try {
      const roles = await adminService.getRoles()
      success(res, roles)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取系统配置
   */
  async getSystemConfigs(req, res, next) {
    try {
      const configs = await adminService.getSystemConfigs()
      success(res, configs)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新系统配置
   */
  async updateSystemConfig(req, res, next) {
    try {
      const { key } = req.params
      const { value } = req.body
      const config = await adminService.updateSystemConfig(key, value)

      let adminName = 'admin'
      if (req.userId) {
        try {
          const u = await adminService.getAdminById(req.userId)
          adminName = u?.username || adminName
        } catch (_) {}
      }
      await operationLogService.logAdmin({
        adminId: req.userId,
        adminName,
        action: 'update_config',
        targetType: 'config',
        targetId: null,
        targetName: String(key),
        oldValue: null,
        newValue: value,
        description: `更新系统配置: ${key}`,
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
      })

      success(res, config, '更新成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取任务列表
   */
  async getTasks(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      const filters = {
        status: req.query.status,
        platform: req.query.platform
      }
      const result = await adminService.getTasks(page, size, filters)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 创建任务（带追溯）
   */
  async createTask(req, res, next) {
    try {
      // 获取操作者信息
      const locationInfo = await getRequestLocation(req)
      const operator = {
        id: req.userId,
        name: req.user?.username || 'unknown',
        role: req.userRole,
        ip: locationInfo.ip,
        location: locationInfo.location,
        userAgent: req.headers['user-agent']
      }
      
      const task = await adminService.createTask(req.body, req.userId, operator)
      success(res, task, '创建成功', 201)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新任务（带追溯）
   */
  async updateTask(req, res, next) {
    try {
      const taskId = BigInt(req.params.id)
      
      // 获取操作者信息
      const locationInfo = await getRequestLocation(req)
      const operator = {
        id: req.userId,
        name: req.user?.username || 'unknown',
        role: req.userRole,
        ip: locationInfo.ip,
        location: locationInfo.location,
        userAgent: req.headers['user-agent']
      }
      
      const task = await adminService.updateTask(taskId, req.body, operator)
      success(res, task, '更新成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 删除任务
   */
  /**
   * 删除任务（带追溯）
   */
  async deleteTask(req, res, next) {
    try {
      const taskId = BigInt(req.params.id)
      
      // 获取操作者信息
      const locationInfo = await getRequestLocation(req)
      const operator = {
        id: req.userId,
        name: req.user?.username || 'unknown',
        role: req.userRole,
        ip: locationInfo.ip,
        location: locationInfo.location,
        userAgent: req.headers['user-agent']
      }
      
      await adminService.deleteTask(taskId, operator)
      success(res, { success: true }, '删除成功')
    } catch (err) {
      next(err)
    }
  }
}

export default new AdminController()
