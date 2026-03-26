import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'

class TaskTemplateService {
  /**
   * 获取任务模板列表
   */
  async getTemplates(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size

    let query = supabase
      .from('task_templates')
      .select('*', { count: 'exact' })
      .eq('is_active', true)

    if (filters.platform) {
      query = query.eq('platform', filters.platform)
    }

    const { data: templates, count, error } = await query
      .order('use_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    if (error) {
      throw new Error('获取任务模板列表失败')
    }

    return {
      list: templates || [],
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取单个模板
   */
  async getTemplate(templateId) {
    const { data: template, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (error) {
      throw new Error('获取任务模板失败')
    }

    return template
  }

  /**
   * 创建任务模板
   */
  async createTemplate(data) {
    const { data: template, error } = await supabase
      .from('task_templates')
      .insert({
        name: data.name,
        description: data.description,
        platform: data.platform,
        action: data.action,
        reward: data.reward || 30,
        time_limit_minutes: data.timeLimitMinutes || 15,
        city_limit: data.cityLimit || 1,
        province_limit: data.provinceLimit || 4,
        template_images: data.templateImages || [],
        requirements: data.requirements || []
      })
      .select()
      .single()

    if (error) {
      logger.error('创建任务模板失败:', error)
      throw new Error('创建任务模板失败')
    }

    logger.info(`创建任务模板: ${template.id} - ${template.name}`)
    return template
  }

  /**
   * 更新任务模板
   */
  async updateTemplate(templateId, data) {
    const updateData = { updated_at: new Date().toISOString() }
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.platform !== undefined) updateData.platform = data.platform
    if (data.action !== undefined) updateData.action = data.action
    if (data.reward !== undefined) updateData.reward = data.reward
    if (data.timeLimitMinutes !== undefined) updateData.time_limit_minutes = data.timeLimitMinutes
    if (data.cityLimit !== undefined) updateData.city_limit = data.cityLimit
    if (data.provinceLimit !== undefined) updateData.province_limit = data.provinceLimit
    if (data.templateImages !== undefined) updateData.template_images = data.templateImages
    if (data.requirements !== undefined) updateData.requirements = data.requirements

    const { data: template, error } = await supabase
      .from('task_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single()

    if (error) {
      throw new Error('更新任务模板失败')
    }

    return template
  }

  /**
   * 删除任务模板
   */
  async deleteTemplate(templateId) {
    const { error } = await supabase
      .from('task_templates')
      .update({ is_active: false })
      .eq('id', templateId)

    if (error) {
      throw new Error('删除任务模板失败')
    }

    return { success: true }
  }

  /**
   * 使用模板创建任务
   */
  async useTemplate(templateId, overrides = {}) {
    const template = await this.getTemplate(templateId)

    // 增加使用次数
    await supabase
      .from('task_templates')
      .update({ use_count: template.use_count + 1 })
      .eq('id', templateId)

    // 返回任务数据结构
    return {
      title: overrides.title || template.name,
      platform: overrides.platform || template.platform,
      action: overrides.action || template.action,
      videoUrl: overrides.videoUrl || null,
      description: overrides.description || template.description,
      templateImages: overrides.templateImages || template.template_images,
      requirements: overrides.requirements || template.requirements,
      reward: overrides.reward || template.reward,
      timeLimitMinutes: overrides.timeLimitMinutes || template.time_limit_minutes,
      cityLimit: overrides.cityLimit || template.city_limit,
      provinceLimit: overrides.provinceLimit || template.province_limit,
      status: overrides.status || 'active',
      remain: overrides.remain || 100
    }
  }

  /**
   * 使用模板创建任务（直接保存到数据库）
   */
  async useTemplateToCreateTask(templateId, overrides = {}) {
    const template = await this.getTemplate(templateId)
    const needCount = overrides.remain || 100

    // 创建任务
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: overrides.title || template.name,
        platform: template.platform,
        action: template.action,
        video_url: overrides.videoUrl || null,
        description: template.description,
        template_images: JSON.stringify(template.template_images || []),
        requirements: JSON.stringify(template.requirements || []),
        reward: template.reward,
        remain: needCount,
        need_count: needCount,
        time_limit_minutes: template.time_limit_minutes,
        city_limit: template.city_limit,
        province_limit: template.province_limit,
        exposure_enabled: true,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      logger.error('使用模板创建任务失败:', error)
      throw new Error('创建任务失败')
    }

    // 增加模板使用次数
    await supabase
      .from('task_templates')
      .update({ use_count: template.use_count + 1 })
      .eq('id', templateId)

    logger.info(`使用模板 ${templateId} 创建任务: ${task.id} - ${task.title}`)
    return task
  }

  /**
   * 获取热门模板
   */
  async getHotTemplates(limit = 5) {
    const { data: templates, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('is_active', true)
      .order('use_count', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error('获取热门模板失败')
    }

    return templates || []
  }
}

export default new TaskTemplateService()
