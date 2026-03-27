import db from '../config/database.js'
import logger from '../utils/logger.js'

const tableColumnCache = new Map()

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function parseDetail(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

async function getTableColumnSet(tableName) {
  if (tableColumnCache.has(tableName)) {
    return tableColumnCache.get(tableName)
  }

  const result = await db.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  )

  const set = new Set((result.rows || []).map((row) => row.column_name))
  tableColumnCache.set(tableName, set)
  return set
}

function buildInsertSql(tableName, payload) {
  const keys = Object.keys(payload)
  const placeholders = keys.map((_, index) => `$${index + 1}`)
  return {
    text: `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values: keys.map((key) => payload[key]),
  }
}

function normalizeAlert(row) {
  if (!row) return null
  const detail = parseDetail(row.alert_detail)
  const derivedStatus = row.status
    || detail.status
    || (row.is_resolved ? (detail.handle_action === 'ignore' ? 'ignored' : 'resolved') : 'pending')

  return {
    id: row.id != null ? String(row.id) : row.id,
    alert_type: row.alert_type || detail.alert_type || 'system',
    severity: row.severity || row.alert_level || detail.severity || 'medium',
    title: row.title || detail.title || '系统告警',
    description: row.message || detail.message || '',
    source: row.source || detail.source || 'system',
    related_entity_type: row.related_type || detail.related_type || null,
    related_entity_id: row.related_id != null ? String(row.related_id) : (detail.related_id != null ? String(detail.related_id) : null),
    metadata: detail,
    status: derivedStatus,
    handler_id: row.handled_by != null ? String(row.handled_by) : (detail.handler_id != null ? String(detail.handler_id) : null),
    handler_name: detail.handler_name || null,
    handled_at: row.handled_at || detail.handled_at || null,
    handle_note: detail.handle_note || null,
    created_at: row.created_at,
    is_resolved: Boolean(row.is_resolved),
  }
}

class AlertService {
  async createAlert({
    type,
    severity = 'medium',
    title,
    message,
    source = 'system',
    relatedId = null,
    relatedType = null,
    metadata = {},
  }) {
    try {
      const columns = await getTableColumnSet('audit_alerts')
      const detail = {
        title: title || '系统告警',
        message: message || '',
        source,
        related_id: relatedId,
        related_type: relatedType,
        severity,
        status: 'pending',
        ...metadata,
      }

      const payload = {}
      if (columns.has('alert_type')) payload.alert_type = type || 'system_alert'
      if (columns.has('severity')) payload.severity = severity
      if (columns.has('title')) payload.title = title || '系统告警'
      if (columns.has('message')) payload.message = message || ''
      if (columns.has('source')) payload.source = source
      if (columns.has('related_id')) payload.related_id = relatedId
      if (columns.has('related_type')) payload.related_type = relatedType
      if (columns.has('status')) payload.status = 'pending'
      if (columns.has('alert_level')) payload.alert_level = severity
      if (columns.has('alert_detail')) payload.alert_detail = JSON.stringify(detail)
      if (columns.has('is_resolved')) payload.is_resolved = false
      if (columns.has('created_at')) payload.created_at = new Date()

      const { text, values } = buildInsertSql('audit_alerts', payload)
      const result = await db.query(text, values)
      return normalizeAlert(result.rows?.[0] || null)
    } catch (error) {
      logger.error('创建告警失败:', error)
      return null
    }
  }

  async getUnhandledCount() {
    const result = await db.query(
      `
      SELECT COUNT(*)::int AS count
      FROM audit_alerts
      WHERE COALESCE(is_resolved, false) = false
      `
    )

    return toNumber(result.rows?.[0]?.count, 0)
  }

  async getAlerts(page = 1, size = 20, filters = {}) {
    const columns = await getTableColumnSet('audit_alerts')
    const limit = Math.max(1, toNumber(size, 20))
    const offset = Math.max(0, (Math.max(1, toNumber(page, 1)) - 1) * limit)

    const clauses = []
    const values = []
    const severityExpr = columns.has('severity')
      ? `COALESCE(severity, alert_level)`
      : columns.has('alert_level')
        ? 'alert_level'
        : `'medium'`

    if (filters.status) {
      if (columns.has('status')) {
        values.push(filters.status)
        clauses.push(`status = $${values.length}`)
      } else if (['resolved', 'ignored'].includes(filters.status)) {
        clauses.push(`COALESCE(is_resolved, false) = true`)
      } else {
        clauses.push(`COALESCE(is_resolved, false) = false`)
      }
    }

    if (filters.severity) {
      values.push(filters.severity)
      clauses.push(`${severityExpr} = $${values.length}`)
    }

    if (filters.alertType) {
      values.push(filters.alertType)
      clauses.push(`alert_type = $${values.length}`)
    }

    if (filters.isHandled !== undefined) {
      clauses.push(filters.isHandled
        ? `COALESCE(is_resolved, false) = true`
        : `COALESCE(is_resolved, false) = false`)
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const [countRes, listRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM audit_alerts ${where}`, values),
      db.query(
        `
        SELECT *
        FROM audit_alerts
        ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
        `,
        [...values, limit, offset]
      ),
    ])

    return {
      list: (listRes.rows || []).map(normalizeAlert),
      total: toNumber(countRes.rows?.[0]?.count, 0),
      page: Math.max(1, toNumber(page, 1)),
      size: limit,
    }
  }

  async getStats() {
    const columns = await getTableColumnSet('audit_alerts')
    const severityExpr = columns.has('severity')
      ? `COALESCE(severity, alert_level)`
      : columns.has('alert_level')
        ? 'alert_level'
        : `'medium'`

    const statusSelect = columns.has('status')
      ? `
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'handling')::int AS handling,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
      `
      : `
        COUNT(*) FILTER (WHERE COALESCE(is_resolved, false) = false)::int AS pending,
        0::int AS handling,
        COUNT(*) FILTER (WHERE COALESCE(is_resolved, false) = true)::int AS resolved,
      `

    const result = await db.query(
      `
      SELECT
        COUNT(*)::int AS total,
        ${statusSelect}
        COUNT(*) FILTER (WHERE ${severityExpr} = 'critical')::int AS critical
      FROM audit_alerts
      `
    )

    return result.rows?.[0] || {
      total: 0,
      pending: 0,
      handling: 0,
      resolved: 0,
      critical: 0,
    }
  }

  async handleAlert(alertId, handlerId, action = 'resolve', note = '') {
    const columns = await getTableColumnSet('audit_alerts')
    const nextStatus = action === 'ignore' ? 'ignored' : action === 'handling' ? 'handling' : 'resolved'
    const isResolved = nextStatus === 'resolved' || nextStatus === 'ignored'

    const existing = columns.has('alert_detail')
      ? await db.queryOne('SELECT alert_detail FROM audit_alerts WHERE id = $1', [alertId])
      : null
    const detail = parseDetail(existing?.alert_detail)
    detail.status = nextStatus
    detail.handle_note = note
    detail.handler_id = String(handlerId)
    detail.handler_name = detail.handler_name || `admin_${handlerId}`
    detail.handle_action = action
    detail.handled_at = new Date().toISOString()

    const setClauses = []
    const values = []
    const pushSet = (clause, value) => {
      values.push(value)
      setClauses.push(`${clause} = $${values.length}`)
    }

    if (columns.has('status')) pushSet('status', nextStatus)
    if (columns.has('handled_by')) pushSet('handled_by', handlerId)
    if (columns.has('handled_at')) setClauses.push('handled_at = NOW()')
    if (columns.has('is_resolved')) pushSet('is_resolved', isResolved)
    if (columns.has('resolved_by') && isResolved) pushSet('resolved_by', handlerId)
    if (columns.has('resolved_at') && isResolved) setClauses.push('resolved_at = NOW()')
    if (columns.has('alert_detail')) pushSet('alert_detail', JSON.stringify(detail))

    values.push(alertId)
    const result = await db.query(
      `
      UPDATE audit_alerts
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
      `,
      values
    )

    return {
      success: true,
      alert: normalizeAlert(result.rows?.[0] || null),
    }
  }
}

export default new AlertService()
