import db from '../config/database.js'
import logger from '../utils/logger.js'

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

function normalizeAlert(row) {
  if (!row) return null
  const detail = parseDetail(row.alert_detail)
  return {
    id: row.id != null ? String(row.id) : row.id,
    alert_type: row.alert_type || 'system',
    severity: row.severity || row.alert_level || 'medium',
    title: row.title || detail.title || '系统告警',
    description: row.message || detail.message || '',
    source: row.source || detail.source || 'system',
    related_entity_type: row.related_type || null,
    related_entity_id: row.related_id != null ? String(row.related_id) : null,
    metadata: detail,
    status: row.status || 'pending',
    handler_id: row.handled_by != null ? String(row.handled_by) : null,
    handler_name: detail.handler_name || null,
    handled_at: row.handled_at || null,
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
      const detail = JSON.stringify({
        title,
        message,
        source,
        ...metadata,
      })

      const result = await db.query(
        `
        INSERT INTO audit_alerts (
          alert_type,
          severity,
          title,
          message,
          source,
          related_id,
          related_type,
          status,
          alert_level,
          alert_detail,
          is_resolved,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $2, $8, false, NOW())
        RETURNING *
        `,
        [
          type || 'system_alert',
          severity,
          title || '系统告警',
          message || '',
          source,
          relatedId,
          relatedType,
          detail,
        ]
      )

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
      WHERE status IN ('pending', 'handling')
        AND COALESCE(is_resolved, false) = false
      `
    )

    return toNumber(result.rows?.[0]?.count, 0)
  }

  async getAlerts(page = 1, size = 20, filters = {}) {
    const limit = Math.max(1, toNumber(size, 20))
    const offset = Math.max(0, (Math.max(1, toNumber(page, 1)) - 1) * limit)

    const clauses = []
    const values = []

    if (filters.status) {
      values.push(filters.status)
      clauses.push(`status = $${values.length}`)
    }

    if (filters.severity) {
      values.push(filters.severity)
      clauses.push(`COALESCE(severity, alert_level) = $${values.length}`)
    }

    if (filters.alertType) {
      values.push(filters.alertType)
      clauses.push(`alert_type = $${values.length}`)
    }

    if (filters.isHandled !== undefined) {
      if (filters.isHandled) {
        clauses.push(`status IN ('resolved', 'ignored')`)
      } else {
        clauses.push(`status NOT IN ('resolved', 'ignored')`)
      }
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
    const result = await db.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'handling')::int AS handling,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE COALESCE(severity, alert_level) = 'critical')::int AS critical
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
    const nextStatus = action === 'ignore' ? 'ignored' : action === 'handling' ? 'handling' : 'resolved'
    const isResolved = nextStatus === 'resolved'

    const existing = await db.queryOne('SELECT alert_detail FROM audit_alerts WHERE id = $1', [alertId])
    const detail = parseDetail(existing?.alert_detail)
    detail.handle_note = note
    detail.handler_name = detail.handler_name || `admin_${handlerId}`
    detail.handle_action = action

    const result = await db.query(
      `
      UPDATE audit_alerts
      SET status = $1,
          handled_by = $2,
          handled_at = NOW(),
          is_resolved = $3,
          resolved_by = CASE WHEN $3 THEN $2 ELSE resolved_by END,
          resolved_at = CASE WHEN $3 THEN NOW() ELSE resolved_at END,
          alert_detail = $4
      WHERE id = $5
      RETURNING *
      `,
      [nextStatus, handlerId, isResolved, JSON.stringify(detail), alertId]
    )

    return {
      success: true,
      alert: normalizeAlert(result.rows?.[0] || null),
    }
  }
}

export default new AlertService()
