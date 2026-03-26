/**
 * Supabase to Prisma 适配器
 * 提供 Supabase 兼容的 API，底层使用 Prisma 实现
 * 用于平滑迁移，无需一次性修改所有代码
 */

import prisma from './prisma.js'
import logger from './logger.js'

/**
 * 将下划线命名转换为驼峰命名
 * 例如：updated_at -> updatedAt
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
}

/**
 * 将驼峰命名转换为下划线命名
 * 例如：updatedAt -> updated_at
 */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
}

/**
 * 转换对象键名为驼峰命名
 */
function snakeKeysToCamel(obj) {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(snakeKeysToCamel)
  
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = snakeKeysToCamel(value)
  }
  return result
}

/**
 * 转换对象键名为下划线命名
 */
function camelKeysToSnake(obj) {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(camelKeysToSnake)
  
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = camelKeysToSnake(value)
  }
  return result
}

/**
 * 模拟 Supabase 查询构建器
 */
class PrismaQueryBuilder {
  constructor(table) {
    this.table = table
    this.selectFields = '*'
    this.whereConditions = []
    this.orderByFields = []
    this.limitValue = null
    this.rangeFrom = null
    this.rangeTo = null
    this.updateData = null
    this.insertData = null
    this.rpcFunction = null
    this.rpcParams = {}
  }

  /**
   * 模拟 .select()
   */
  select(fields = '*', options = {}) {
    this.selectFields = fields
    this.countMode = options.count || null
    return this
  }

  /**
   * 模拟 .eq()
   */
  eq(field, value) {
    this.whereConditions.push({ type: 'eq', field, value })
    return this
  }

  /**
   * 模拟 .in()
   */
  in(field, values) {
    this.whereConditions.push({ type: 'in', field, values })
    return this
  }

  /**
   * 模拟 .gte()
   */
  gte(field, value) {
    this.whereConditions.push({ type: 'gte', field, value })
    return this
  }

  /**
   * 模拟 .gt()
   */
  gt(field, value) {
    this.whereConditions.push({ type: 'gt', field, value })
    return this
  }

  /**
   * 模拟 .lte()
   */
  lte(field, value) {
    this.whereConditions.push({ type: 'lte', field, value })
    return this
  }

  /**
   * 模拟 .lt()
   */
  lt(field, value) {
    this.whereConditions.push({ type: 'lt', field, value })
    return this
  }

  /**
   * 模拟 .not()
   */
  not(field, operator, value) {
    this.whereConditions.push({ type: 'not', field, operator, value })
    return this
  }

  /**
   * 模拟 .is()
   */
  is(field, value) {
    this.whereConditions.push({ type: 'is', field, value })
    return this
  }

  /**
   * 模拟 .neq()
   */
  neq(field, value) {
    this.whereConditions.push({ type: 'neq', field, value })
    return this
  }

  /**
   * 模拟 .filter()
   */
  filter(field, operator, value) {
    const opMap = {
      'gte': 'gte',
      'gt': 'gt',
      'lte': 'lte',
      'lt': 'lt',
      'eq': 'eq',
      'neq': 'neq',
      'in': 'in',
      'is': 'is'
    }
    const prismaOp = opMap[operator] || operator
    if (prismaOp) {
      this.whereConditions.push({ type: prismaOp, field, value })
    }
    return this
  }

  /**
   * 模拟 .or()
   */
  or(orCondition) {
    // 简单处理：解析 Supabase 的 or 条件字符串
    // 例如："last_check_at.is.null,last_check_at.lt.2024-01-01T00:00:00.000Z"
    if (typeof orCondition === 'string') {
      const conditions = orCondition.split(',')
      for (const cond of conditions) {
        const parts = cond.split('.')
        if (parts.length === 3) {
          const [field, op, value] = parts
          if (op === 'is' && value === 'null') {
            this.whereConditions.push({ type: 'is', field, value: null })
          } else if (op === 'lt') {
            this.whereConditions.push({ type: 'lt', field, value })
          } else if (op === 'gt') {
            this.whereConditions.push({ type: 'gt', field, value })
          } else if (op === 'eq') {
            this.whereConditions.push({ type: 'eq', field, value })
          }
        }
      }
    }
    return this
  }

  /**
   * 模拟 .like() - SQL LIKE 匹配
   */
  like(field, pattern) {
    this.whereConditions.push({ type: 'like', field, value: pattern })
    return this
  }

  /**
   * 模拟 .ilike() - 大小写不敏感 LIKE 匹配
   */
  ilike(field, pattern) {
    this.whereConditions.push({ type: 'ilike', field, value: pattern })
    return this
  }

  /**
   * 模拟 .is() - IS NULL / IS NOT NULL
   */
  is(field, value) {
    this.whereConditions.push({ type: 'is', field, value })
    return this
  }

  /**
   * 模拟 .order()
   */
  order(field, options = { ascending: true }) {
    this.orderByFields.push({ field, asc: options.ascending !== false })
    return this
  }

  /**
   * 模拟 .limit()
   */
  limit(value) {
    this.limitValue = value
    return this
  }

  /**
   * 模拟 .range() - Supabase 分页方法
   */
  range(from, to) {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }

  /**
   * 模拟 .single()
   */
  async single() {
    try {
      const result = await this._executeQuery()
      const data = Array.isArray(result) ? result[0] : result
      return { data: data || null, error: null }
    } catch (error) {
      logger.error(`Prisma adapter single() error: ${error.message}`)
      return { data: null, error }
    }
  }

  /**
   * 模拟 .maybeSingle()
   */
  async maybeSingle() {
    try {
      const result = await this._executeQuery()
      const data = Array.isArray(result) ? result[0] : result
      return { data: data || null, error: null }
    } catch (error) {
      logger.error(`Prisma adapter maybeSingle() error: ${error.message}`)
      return { data: null, error }
    }
  }

  /**
   * 模拟返回 count 的查询
   */
  async then(resolve, reject) {
    try {
      const result = await this._executeQuery()
      
      // 如果需要返回 count
      if (this.countMode) {
        const countResult = await this._executeCount()
        resolve({ data: result, count: countResult, error: null })
      } else {
        resolve({ data: result, error: null })
      }
    } catch (error) {
      logger.error(`Prisma adapter error: ${error.message}`)
      reject(error)
    }
  }

  /**
   * 执行查询
   */
  async _executeQuery() {
    const where = this._buildWhere()
    const model = this._getModel()

    // 如果 Prisma 模型不存在，使用原始 SQL
    if (!model) {
      return this._executeRawSQL()
    }

    // 检测 BigInt 范围值 - CockroachDB 用 INT8 但 Prisma 模型声明为 Int
    const hasBigIntValue = this.whereConditions.some(c => {
      if (typeof c.value === 'string' && /^\d+$/.test(c.value)) {
        const num = Number(c.value)
        return num > 2147483647 || num < -2147483648
      }
      return false
    })
    const insertHasBigInt = this.insertData && Object.values(
      typeof this.insertData === 'object' && !Array.isArray(this.insertData) ? this.insertData : {}
    ).some(v => typeof v === 'string' && /^\d{10,}$/.test(v) && Number(v) > 2147483647)

    if (hasBigIntValue || insertHasBigInt) {
      return this._executeRawSQL()
    }

    // SELECT 查询
    if (!this.updateData && !this.insertData && !this.rpcFunction && !this.deleteMode) {
      const args = { where }

      // 处理 select 字段
      if (this.selectFields !== '*') {
        const fields = this.selectFields.split(',').map(f => f.trim())
        args.select = {}
        fields.forEach(f => {
          // 处理关联查询 (tasks!inner(created_at))
          if (f.includes('!')) {
            const [rel, cols] = f.split('!')
            const cleanCols = cols.replace(/[()]/g, '')
            args.select[rel] = {
              select: cleanCols.split(',').reduce((acc, col) => {
                // Prisma 使用下划线命名，保持原样
                acc[col.trim()] = true
                return acc
              }, {})
            }
          } else {
            // Prisma 使用下划线命名，保持原样
            args.select[f] = true
          }
        })
      }

      // 处理 orderBy (支持多字段)
      if (this.orderByFields.length > 0) {
        args.orderBy = this.orderByFields.map(o => {
          if (o.field.includes('.')) {
            const [rel, field] = o.field.split('.')
            return { [rel]: { [field]: o.asc ? 'asc' : 'desc' } }
          }
          return { [o.field]: o.asc ? 'asc' : 'desc' }
        })
      }

      // 处理 limit
      if (this.limitValue) {
        args.take = this.limitValue
      }

      // 处理 range (Supabase 分页方式)
      if (this.rangeFrom !== null && this.rangeTo !== null) {
        args.skip = this.rangeFrom
        args.take = this.rangeTo - this.rangeFrom + 1
      }

      try {
        const result = await model.findMany(args)
        return result
      } catch (findErr) {
        if (findErr.message && (findErr.message.includes('Expected Int') || findErr.message.includes('Invalid value') || findErr.message.includes('Unknown'))) {
          return this._executeRawSQL()
        }
        throw findErr
      }
    }

    // UPDATE 查询
    if (this.updateData) {
      // Prisma 使用下划线命名，保持原样
      
      // 执行更新
      try {
        await model.updateMany({
          where,
          data: this.updateData
        })
        const updatedRecords = await model.findMany({ where })
        return updatedRecords
      } catch (updateErr) {
        if (updateErr.message && (updateErr.message.includes('Expected Int') || updateErr.message.includes('Invalid value') || updateErr.message.includes('Unknown'))) {
          return this._executeRawSQL()
        }
        throw updateErr
      }
    }

    // INSERT 查询
    if (this.insertData) {
      // Prisma 使用下划线命名，保持原样
      const now = new Date()
      
      if (Array.isArray(this.insertData)) {
        // 批量插入
        const dataWithTimestamps = this.insertData.map(item => ({
          ...item,
          created_at: item.created_at || now,
          updated_at: item.updated_at || now
        }))
        const result = await model.createMany({
          data: dataWithTimestamps
        })
        return { count: result.count }
      } else {
        // 单条插入 - 自动添加时间戳 + 类型转换
        const dataWithTimestamps = {
          ...this.insertData,
          created_at: this.insertData.created_at || now,
          updated_at: this.insertData.updated_at || now
        }
        for (const key of Object.keys(dataWithTimestamps)) {
          dataWithTimestamps[key] = this._convertValue(key, dataWithTimestamps[key])
        }
        try {
          const result = await model.create({
            data: dataWithTimestamps
          })
          return result
        } catch (prismaErr) {
          if (prismaErr.message && (
            prismaErr.message.includes('Invalid value') || 
            prismaErr.message.includes('Expected Int') || 
            prismaErr.message.includes('Expected BigInt') || 
            prismaErr.message.includes('Unknown argument') ||
            prismaErr.message.includes('Unknown field') ||
            prismaErr.code === 'P2009' ||
            prismaErr.code === 'P2012'
          )) {
            // Remove fields that don't exist in the table
            const cleanData = { ...this.insertData }
            delete cleanData.updated_at
            this.insertData = cleanData
            return this._executeRawSQL()
          }
          throw prismaErr
        }
      }
    }

    // DELETE 查询
    if (this.deleteMode) {
      // 先查询要删除的记录（用于返回）
      const recordsToDelete = await model.findMany({ where })
      
      
      
      // 执行删除
      const deleteResult = await model.deleteMany({
        where
      })
      
      
      
      return recordsToDelete
    }

    // RPC 调用
    if (this.rpcFunction) {
      const result = await prisma.$queryRaw`
        SELECT ${prisma.raw(this.rpcFunction)}(${this._buildRpcParams()})
      `
      return result
    }

    // DELETE 查询
    if (this.deleteMode) {
      const mutation = `DELETE FROM ${tableName} ${whereSQL}`
      logger.debug(`[DELETE SQL] ${mutation}`, params)
      await this._executeRawMutation(mutation, params)
      return { success: true }
    }
    
    return null
  }

  /**
   * 使用原始 SQL 执行查询（当 Prisma 模型不存在时）
   */
    async _executeCount() {
    const tableName = this.table
    const whereClauses = []
    const params = []
    
    for (const cond of this.whereConditions) {
      if (cond.type === 'eq') {
        const intFields = ['id', 'user_id', 'task_id', 'claim_id', 'reviewer_id', 'invited_by', 'c_parent_id', 'c_grand_id'];
        if (intFields.includes(cond.field) && typeof cond.value === 'string' && /^\d+$/.test(cond.value)) {
          whereClauses.push(`"${cond.field}" = $${params.length + 1}::INT8`)
          params.push(cond.value)
        } else {
          whereClauses.push(`"${cond.field}" = $${params.length + 1}`)
          const isDateField = cond.field.endsWith('_at') || cond.field === 'created_at' || cond.field === 'updated_at' || cond.field === 'expires_at' || cond.field === 'reviewed_at' || cond.field === 'submitted_at' || cond.field === 'claimed_at';
          const isDateValue = cond.value instanceof Date || (typeof cond.value === 'string' && cond.value.match(/^\d{4}-\d{2}-\d{2}/));
          if (isDateField && isDateValue && typeof cond.value === 'string') {
            params.push(new Date(cond.value))
          } else {
            params.push(cond.value)
          }
        }
      } else if (cond.type === 'in') {
        const placeholders = cond.values.map((_, i) => `$${params.length + i + 1}`).join(', ')
        whereClauses.push(`"${cond.field}" IN (${placeholders})`)
        params.push(...cond.values)
      } else if (['gte', 'gt', 'lte', 'lt'].includes(cond.type)) {
        const op = cond.type === 'gte' ? '>=' : cond.type === 'gt' ? '>' : cond.type === 'lte' ? '<=' : '<';
        whereClauses.push(`"${cond.field}" ${op} $${params.length + 1}`)
        // 检测日期字段并转换
        // 只检测真正的 timestamp 类型字段（以 _at 结尾）
        const isDateField = cond.field.endsWith('_at') || cond.field === 'created_at' || cond.field === 'updated_at' || cond.field === 'expires_at' || cond.field === 'reviewed_at' || cond.field === 'submitted_at' || cond.field === 'claimed_at';
        // 排除纯文本日期字段如 sign_date
        const isDateValue = cond.value instanceof Date || (typeof cond.value === 'string' && cond.value.match(/^\d{4}-\d{2}-\d{2}/));
        if (isDateField && isDateValue && typeof cond.value === 'string') {
          params.push(new Date(cond.value))
        } else {
          params.push(cond.value)
        }
      } else if (cond.type === 'is') {
        if (cond.value === null) {
          whereClauses.push(`"${cond.field}" IS NULL`)
        } else {
          whereClauses.push(`"${cond.field}" = $${params.length + 1}`)
          params.push(cond.value)
        }
      }
    }
    
    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const query = `SELECT COUNT(*) as count FROM ${tableName} ${whereSQL}`
    
    try {
      const result = await prisma.$queryRawUnsafe(query, ...params)
      // 将 BigInt 转换为普通数字
      const count = result[0]?.count
      return typeof count === 'bigint' ? Number(count) : (count || 0)
    } catch (error) {
      logger.error(`Prisma adapter count error: ${error.message}`)
      return 0
    }
  }

  async _executeRawSQL() {
    const tableName = this.table
    
    // 构建 WHERE 子句
    const whereClauses = []
    const params = []
    const intFields = ['id', 'user_id', 'task_id', 'claim_id', 'reviewer_id', 'invited_by', 'c_parent_id', 'c_grand_id', 'points', 'points_earned', 'continuous_days'];
    
    for (const cond of this.whereConditions) {
      if (cond.type === 'eq') {
        if (intFields.includes(cond.field) && typeof cond.value === 'string' && /^\d+$/.test(cond.value)) {
          whereClauses.push(`"${cond.field}" = $${params.length + 1}::INT8`)
          params.push(cond.value)
        } else {
          whereClauses.push(`"${cond.field}" = $${params.length + 1}`)
          const isDateField = cond.field.endsWith('_at') || cond.field === 'created_at' || cond.field === 'updated_at' || cond.field === 'expires_at' || cond.field === 'reviewed_at' || cond.field === 'submitted_at' || cond.field === 'claimed_at';
          const isDateValue = cond.value instanceof Date || (typeof cond.value === 'string' && cond.value.match(/^\d{4}-\d{2}-\d{2}/));
          if (isDateField && isDateValue && typeof cond.value === 'string') {
            params.push(new Date(cond.value))
          } else {
            params.push(cond.value)
          }
        }
      } else if (cond.type === 'in') {
        const placeholders = cond.values.map((_, i) => `$${params.length + i + 1}`).join(', ')
        whereClauses.push(`"${cond.field}" IN (${placeholders})`)
        params.push(...cond.values)
      } else if (['gte', 'gt', 'lte', 'lt'].includes(cond.type)) {
        const op = cond.type === 'gte' ? '>=' : cond.type === 'gt' ? '>' : cond.type === 'lte' ? '<=' : '<';
        // 检测是否是日期字段（包含 _at, created, updated, expires 等）
        const isDateField = cond.field.includes('_at') || cond.field.includes('created') || cond.field.includes('updated') || cond.field.includes('expires') || cond.field.includes('time');
        // 检测值是否是日期字符串或 Date 对象
        const isDateValue = cond.value instanceof Date || (typeof cond.value === 'string' && cond.value.match(/^\d{4}-\d{2}-\d{2}/));
        
        if (isDateField && isDateValue && typeof cond.value === 'string') {
          // 使用 CAST 显式转换类型
          whereClauses.push(`"${cond.field}" ${op} $${params.length + 1}`);
        } else {
          whereClauses.push(`"${cond.field}" ${op} $${params.length + 1}`);
        }
        // 如果是字符串类型的日期，转换为 Date 对象让 Prisma 正确处理
        if (isDateField && isDateValue && typeof cond.value === "string") {
          params.push(new Date(cond.value));
        } else {
          params.push(cond.value);
        }
      } else if (cond.type === 'is') {
        if (cond.value === null) {
          whereClauses.push(`"${cond.field}" IS NULL`)
        } else {
          whereClauses.push(`"${cond.field}" = $${params.length + 1}`)
          params.push(cond.value)
        }
      }
    }
    
    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    
    // SELECT 查询
    if (!this.updateData && !this.insertData && !this.deleteMode) {
      const selectFields = this.selectFields === '*' ? '*' : this.selectFields.split(',').map(f => `"${f.trim()}"`).join(', ')
      const orderBySQL = this.orderByFields.length > 0 ? 'ORDER BY ' + this.orderByFields.map(o => `"${o.field}" ${o.asc ? 'ASC' : 'DESC'}`).join(', ') : ''
      const limitSQL = this.limitValue ? `LIMIT ${this.limitValue}` : ''
      
      const query = `SELECT ${selectFields} FROM ${tableName} ${whereSQL} ${orderBySQL} ${limitSQL}`
      const result = await this._executeRawQuery(query, params)
      
      // 将结果转换为驼峰命名
      if (Array.isArray(result)) {
        return result.map(snakeKeysToCamel)
      } else if (result && typeof result === 'object') {
        return snakeKeysToCamel(result)
      }
      return result
    }
    
    // UPDATE 查询
    if (this.updateData) {
      const setClauses = []
      const updateParams = []
      let paramOffset = params.length
      
      // 将驼峰字段名转换为下划线
      const snakeUpdateData = camelKeysToSnake(this.updateData)
      
      for (const [key, value] of Object.entries(snakeUpdateData)) {
        setClauses.push(`"${key}" = $${++paramOffset}`)
        updateParams.push(value)
      }
      
      const setSQL = setClauses.join(', ')
      const mutation = `UPDATE ${tableName} SET ${setSQL} ${whereSQL}`
      await this._executeRawMutation(mutation, [...params, ...updateParams])
      
      // 查询并返回更新后的数据
      const selectSQL = `SELECT * FROM ${tableName} ${whereSQL}`
      const updatedRecords = await this._executeRawQuery(selectSQL, params)
      return updatedRecords
    }
    
    // INSERT 查询
    if (this.insertData) {
      if (Array.isArray(this.insertData)) {
        // 批量插入 - 将驼峰字段名转换为下划线
        const snakeData = this.insertData.map(camelKeysToSnake)
        const values = []
        const allParams = []
        let paramIndex = 0
        
        for (const row of snakeData) {
          const keys = Object.keys(row)
          const rowValues = []
          for (const key of keys) {
            rowValues.push(`$${++paramIndex}`)
            allParams.push(row[key])
          }
          values.push(`(${rowValues.join(', ')})`)
        }
        
        const keys = Object.keys(snakeData[0]).join(', ')
        const mutation = `INSERT INTO ${tableName} (${keys.split(', ').map(k => `"${k}"`).join(', ')}) VALUES ${values.join(', ')}`
        await this._executeRawMutation(mutation, allParams)
        return { count: snakeData.length }
      } else {
        // 单条插入 - 将驼峰字段名转换为下划线
        const snakeData = camelKeysToSnake(this.insertData)
        const keys = Object.keys(snakeData)
        const values = keys.map((_, i) => `$${i + 1}`)
        const mutation = `INSERT INTO ${tableName} (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${values.join(', ')}) RETURNING *`
        const insertResult = await this._executeRawQuery(mutation, Object.values(snakeData))
        return insertResult && insertResult.length > 0 ? snakeKeysToCamel(insertResult[0]) : snakeData
      }
    }
    
    // DELETE 查询
    if (this.deleteMode) {
      const mutation = `DELETE FROM ${tableName} ${whereSQL}`
      logger.debug(`[DELETE SQL] ${mutation}`, params)
      await this._executeRawMutation(mutation, params)
      return { success: true }
    }
    
    return null
  }

  /**
   * 构建 WHERE 条件
   */
  /**
   * 转换值为正确的类型
   * 对于 ID 字段，将字符串转换为数字
   */
  _convertValue(field, value) {
    // 定义需要转换为整数的字段
    const intFields = ['id', 'user_id', 'task_id', 'claim_id', 'reviewer_id', 'invited_by', 'c_parent_id', 'c_grand_id', 'b_inviter_id', 'level', 'status', 'total_tasks', 'total_points', 'points', 'b_promotion_points'];
    
    // 定义日期时间字段（以 _at 结尾的字段，注意：sign_date 是字符串类型，不需要转换）
    // 只有真正的时间戳字段才需要转换
    const timestampFields = ['claimed_at', 'created_at', 'updated_at', 'reviewed_at', 'submitted_at', 'expires_at', 'paid_at', 'processed_at', 'detected_at', 'blocked_at', 'last_blocked_at', 'resolved_at'];
    
    if (intFields.includes(field)) {
      if (typeof value === 'string') {
        // 对于 BigInt 类型的 ID，使用 BigInt 而不是 parseInt
        try {
          const bigIntValue = BigInt(value);
          return bigIntValue;
        } catch (e) {
          return value;
        }
        // 旧代码: const num = parseInt(value, 10);
      }
    }
    
    // 处理日期时间戳字段：将日期字符串转换为 Date 对象
    // 注意：sign_date 是字符串字段，不在转换列表中
    if (timestampFields.includes(field) || (field.endsWith('_at') && field !== 'sign_date')) {
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        return new Date(value);
      }
    }
    
    return value;
  }

  /**
   * 构建 WHERE 条件
   */
  _buildWhere() {
    if (this.whereConditions.length === 0) {
      return undefined
    }

    const where = {}
    for (const cond of this.whereConditions) {
      // 使用原始字段名（Prisma schema 使用下划线命名）
      const field = cond.field
      
      switch (cond.type) {
        case 'eq':
          where[field] = this._convertValue(field, cond.value)
          break
        case 'in':
          where[field] = { in: cond.values?.map(v => this._convertValue(field, v)) }
          break
        case 'gte':
          where[field] = { gte: this._convertValue(field, cond.value) }
          break
        case 'gt':
          where[field] = { gt: this._convertValue(field, cond.value) }
          break
        case 'lte':
          where[field] = { lte: this._convertValue(field, cond.value) }
          break
        case 'lt':
          where[field] = { lt: this._convertValue(field, cond.value) }
          break
        case 'is':
          // 处理 IS NULL 或 IS NOT NULL
          if (cond.value === null) {
            where[field] = null
          } else {
            where[field] = this._convertValue(field, cond.value)
          }
          break
        case 'neq':
          where[field] = { not: this._convertValue(field, cond.value) }
          break
        case 'like': {
          const likeVal = cond.value
          if (likeVal.endsWith('%') && !likeVal.startsWith('%')) {
            where[field] = { startsWith: likeVal.slice(0, -1) }
          } else if (likeVal.startsWith('%') && !likeVal.endsWith('%')) {
            where[field] = { endsWith: likeVal.slice(1) }
          } else if (likeVal.startsWith('%') && likeVal.endsWith('%')) {
            where[field] = { contains: likeVal.slice(1, -1) }
          } else {
            where[field] = likeVal
          }
          break
        }
        case 'ilike': {
          const ilikeVal = cond.value
          if (ilikeVal.endsWith('%') && !ilikeVal.startsWith('%')) {
            where[field] = { startsWith: ilikeVal.slice(0, -1), mode: 'insensitive' }
          } else if (ilikeVal.startsWith('%') && !ilikeVal.endsWith('%')) {
            where[field] = { endsWith: ilikeVal.slice(1), mode: 'insensitive' }
          } else if (ilikeVal.startsWith('%') && ilikeVal.endsWith('%')) {
            where[field] = { contains: ilikeVal.slice(1, -1), mode: 'insensitive' }
          } else {
            where[field] = ilikeVal
          }
          break
        }
        case 'not':
          // 处理 .not(field, operator, value) 形式
          // 例如 .not('screenshots', 'is', null) 表示 screenshots IS NOT NULL
          if (cond.operator === 'is' && cond.value === null) {
            // 对于 NOT NULL，使用 isSet 或排除 null
            // 由于 Prisma 对 null 检查的限制，我们使用 { not: null } 形式
            where[field] = { not: null }
          } else if (cond.operator === 'eq') {
            where[field] = { not: this._convertValue(field, cond.value) }
          } else if (cond.operator === 'in') {
            where[field] = { notIn: cond.value?.map(v => this._convertValue(field, v)) }
          }
          break
      }
    }
    return where
  }

  /**
   * 获取 Prisma 模型
   */
  _getModel() {
    // 首先尝试原始表名（Prisma schema 中的模型名可能就是表名）
    if (prisma[this.table]) {
      return prisma[this.table]
    }
    
    // 尝试转换后的模型名（单数驼峰）
    const modelName = this._tableNameToModelName(this.table)
    if (prisma[modelName]) {
      return prisma[modelName]
    }
    
    // 尝试首字母大写的模型名
    const capitalizedName = this.table.charAt(0).toUpperCase() + this.table.slice(1)
    if (prisma[capitalizedName]) {
      return prisma[capitalizedName]
    }
    
    return null
  }

  /**
   * 将表名转换为 Prisma 模型名
   */
  _tableNameToModelName(tableName) {
    // 处理下划线分隔的表名，转换为大驼峰命名
    // users -> User
    // task_exposures -> TaskExposure
    // exposure_config -> ExposureConfig
    const parts = tableName.split('_')
    const modelName = parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
    
    // 移除复数后缀（简单的规则）
    const singularName = modelName.replace(/s$/, '')
    
    return singularName
  }

  /**
   * 使用原始 SQL 查询（当 Prisma 模型不存在时）
   */
  async _executeRawQuery(query, params = []) {
    try {
      logger.debug("[SQL] Query:", query.substring(0, 300))
      logger.debug("[SQL] Params:", params)
      return await prisma.$queryRawUnsafe(query, ...params)
    } catch (error) {
      logger.error(`Raw SQL query error: ${error.message}`)
      throw error
    }
  }

  /**
   * 使用原始 SQL 执行（当 Prisma 模型不存在时）
   */
  async _executeRawMutation(mutation, params = []) {
    try {
      return await prisma.$executeRawUnsafe(mutation, ...params)
    } catch (error) {
      logger.error(`Raw SQL mutation error: ${error.message}`)
      throw error
    }
  }

  /**
   * 构建 RPC 参数
   */
  _buildRpcParams() {
    const params = Object.entries(this.rpcParams)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key} := '${value}'`
        }
        return `${key} := ${value}`
      })
      .join(', ')
    return params
  }

  /**
   * 模拟 .update()
   */
  update(data) {
    this.updateData = data
    return this
  }

  /**
   * 模拟 .insert()
   */
  insert(data) {
    this.insertData = data
    return this
  }

  /**
   * 模拟 .delete() - 删除记录
   */
  delete() {
    this.deleteMode = true
    return this
  }

  /**
   * 模拟 .rpc()
   */
  rpc(funcName, params = {}) {
    this.rpcFunction = funcName
    this.rpcParams = params
    return this
  }

  /**
   * 模拟 .upsert() - Postgres 的 upsert 操作
   */
  async upsert(data, options = {}) {
    try {
      const model = this._getModel()
      if (!model) {
        throw new Error(`Unknown table: ${this.table}`)
      }

      // 构建 where 条件
      const where = this._buildWhere()
      
      // 如果有 onConflict 选项，使用 upsert
      if (options.onConflict) {
        // 尝试先查找是否存在
        const existing = await model.findFirst({
          where: where || { [options.onConflict]: data[options.onConflict] }
        })

        if (existing) {
          // 更新现有记录
          const result = await model.update({
            where: { [options.onConflict]: existing[options.onConflict] },
            data: data
          })
          return { data: result, error: null }
        } else {
          // 创建新记录
          const result = await model.create({
            data: data
          })
          return { data: result, error: null }
        }
      }

      // 默认使用 upsert（如果 Prisma 支持）
      try {
        const result = await model.upsert({
          where: where || { id: data.id },
          create: data,
          update: data
        })
        return { data: result, error: null }
      } catch (upsertError) {
        // 如果不支持 upsert，回退到先查后更新
        const existing = await model.findFirst({ where })
        if (existing) {
          const result = await model.update({ where: { id: existing.id }, data })
          return { data: result, error: null }
        } else {
          const result = await model.create({ data })
          return { data: result, error: null }
        }
      }
    } catch (error) {
      logger.error(`Prisma adapter upsert() error: ${error.message}`)
      return { data: null, error }
    }
  }
}

/**
 * 模拟 Supabase 客户端
 */
const supabaseToPrisma = {
  from(table) {
    return new PrismaQueryBuilder(table)
  },

  /**
   * RPC 函数调用（模拟 Supabase 的 rpc 方法）
   */
  async rpc(funcName, params = {}) {
    try {
      // 处理常见的 RPC 函数
      if (funcName === 'increment_task_remain') {
        // 直接使用 SQL 更新任务剩余名额
        const taskId = params.task_id || params.p_task_id
        const increment = params.increment_by || params.increment || 1
        
        await prisma.$executeRaw`
          UPDATE tasks 
          SET remain = remain + ${increment} 
          WHERE id = ${BigInt(taskId)}
        `
        return { data: { success: true }, error: null }
      }
      
      if (funcName === 'increment_user_points') {
        const userId = params.user_id
        const points = params.points || 0
        
        await prisma.$executeRaw`
          UPDATE users 
          SET points = points + ${points} 
          WHERE id = ${userId}
        `
        return { data: { success: true }, error: null }
      }
      
      if (funcName === 'decrement_task_exposure') {
        const taskId = params.task_id || params.p_task_id
        const decrement = params.decrement_by || params.decrement || 1
        
        await prisma.$executeRaw`
          UPDATE tasks 
          SET current_exposure = GREATEST(current_exposure - ${decrement}, 0) 
          WHERE id = ${BigInt(taskId)}
        `
        return { data: { success: true }, error: null }
      }
      
      if (funcName === 'increment_exposure') {
        const taskId = params.task_id || params.p_task_id
        const increment = params.increment || 1
        
        await prisma.$executeRaw`
          UPDATE tasks 
          SET current_exposure = current_exposure + ${increment} 
          WHERE id = ${BigInt(taskId)}
        `
        return { data: { success: true }, error: null }
      }
      
      if (funcName === 'update_user_exposure_quota') {
        const userId = params.user_id
        const quota = params.quota || 0
        
        await prisma.$executeRaw`
          UPDATE users 
          SET daily_exposure_quota = ${quota} 
          WHERE id = ${userId}
        `
        return { data: { success: true }, error: null }
      }
      
      if (funcName === 'increment_night_active') {
        const userId = params.user_id
        
        await prisma.$executeRaw`
          UPDATE users 
          SET night_active_count = night_active_count + 1 
          WHERE id = ${userId}
        `
        return { data: { success: true }, error: null }
      }
      
      // 默认：尝试调用 SQL 函数
      const paramKeys = Object.keys(params)
      const paramValues = Object.values(params)
      
      if (paramKeys.length > 0) {
        const placeholders = paramKeys.map((_, i) => `$${i + 1}`).join(', ')
        const query = `SELECT ${funcName}(${placeholders})`
        const result = await prisma.$queryRawUnsafe(query, ...paramValues)
        return { data: result, error: null }
      } else {
        const query = `SELECT ${funcName}()`
        const result = await prisma.$queryRawUnsafe(query)
        return { data: result, error: null }
      }
    } catch (error) {
      logger.error(`Prisma adapter rpc() error: ${error.message}`)
      return { data: null, error }
    }
  },

  /**
   * 事务支持
   */
  async transaction(fn) {
    try {
      return await prisma.$transaction(fn)
    } catch (error) {
      logger.error(`Prisma transaction error: ${error.message}`)
      throw error
    }
  }
}

export default supabaseToPrisma
