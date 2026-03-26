import taskTemplateService from '../services/taskTemplateService.js'
import adminService from '../services/adminService.js'
import { success } from '../utils/response.js'

class TaskTemplateController {
  /**
   * 获取模板列表
   */
  async getTemplates(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      const filters = {
        platform: req.query.platform || null
      }
      
      const result = await taskTemplateService.getTemplates(page, size, filters)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取单个模板
   */
  async getTemplate(req, res, next) {
    try {
      const templateId = parseInt(req.params.id)
      const result = await taskTemplateService.getTemplate(templateId)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 创建模板
   */
  async createTemplate(req, res, next) {
    try {
      const result = await taskTemplateService.createTemplate(req.body)
      success(res, result, '创建成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新模板
   */
  async updateTemplate(req, res, next) {
    try {
      const templateId = parseInt(req.params.id)
      const result = await taskTemplateService.updateTemplate(templateId, req.body)
      success(res, result, '更新成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(req, res, next) {
    try {
      const templateId = parseInt(req.params.id)
      const result = await taskTemplateService.deleteTemplate(templateId)
      success(res, result, '删除成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 使用模板创建任务
   */
  async useTemplate(req, res, next) {
    try {
      const templateId = parseInt(req.params.id)
      const taskData = await taskTemplateService.useTemplate(templateId, req.body)
      const result = await adminService.createTask(taskData)
      success(res, result, '任务创建成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取热门模板
   */
  async getHotTemplates(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 5
      const result = await taskTemplateService.getHotTemplates(limit)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }
}

export default new TaskTemplateController()
