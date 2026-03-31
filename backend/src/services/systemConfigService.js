import db from '../config/database.js'
import logger from '../utils/logger.js'

const CONFIG_CACHE_TTL = 5 * 60 * 1000
const tableColumnCache = new Map()
const configCache = new Map()

const CONFIG_TABLES = [
  {
    name: 'configs',
    descriptionColumn: 'desc',
    kind: 'string',
  },
  {
    name: 'system_configs',
    descriptionColumn: 'description',
    kind: 'string',
  },
  {
    name: 'system_config',
    descriptionColumn: 'description',
    kind: 'json',
  },
]

function normalizeStoredValue(value, parseJson = false) {
  if (value === undefined || value === null) return null
  if (parseJson) {
    if (typeof value === 'object') return value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value
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

async function getAvailableTables() {
  const states = await Promise.all(
    CONFIG_TABLES.map(async (table) => ({
      ...table,
      columns: await getTableColumnSet(table.name),
    }))
  )

  return states.filter((table) => table.columns.size > 0)
}

function getCacheKey(key, parseJson) {
  return `${key}:${parseJson ? 'json' : 'string'}`
}

export async function getConfigValues(keys = [], options = {}) {
  const { parseJson = false } = options
  const now = Date.now()
  const result = {}
  const missingKeys = []

  for (const key of keys) {
    const cacheKey = getCacheKey(key, parseJson)
    const cached = configCache.get(cacheKey)
    if (cached && now - cached.updatedAt < CONFIG_CACHE_TTL) {
      result[key] = cached.value
    } else {
      missingKeys.push(key)
    }
  }

  if (missingKeys.length === 0) {
    return result
  }

  const availableTables = await getAvailableTables()
  const remainingKeys = new Set(missingKeys)

  for (const table of availableTables) {
    if (remainingKeys.size === 0) break

    const tableKeys = Array.from(remainingKeys)
    const rows = await db.query(
      `
      SELECT key, value
      FROM ${table.name}
      WHERE key = ANY($1)
      `,
      [tableKeys]
    )

    for (const row of rows.rows || []) {
      if (!(row.key in result)) {
        result[row.key] = normalizeStoredValue(row.value, parseJson)
        remainingKeys.delete(row.key)
      }
    }
  }

  for (const key of missingKeys) {
    const value = key in result ? result[key] : null
    configCache.set(getCacheKey(key, parseJson), {
      value,
      updatedAt: now,
    })
  }

  return result
}

export async function getConfigValue(key, fallback = null, options = {}) {
  const values = await getConfigValues([key], options)
  const value = values[key]
  return value === null || value === undefined ? fallback : value
}

function invalidateConfigCache(key) {
  configCache.delete(getCacheKey(key, false))
  configCache.delete(getCacheKey(key, true))
}

export async function setConfigValue(key, value, options = {}) {
  const { description = null } = options
  const availableTables = await getAvailableTables()
  const existingTargets = availableTables.filter((table) => table.columns.has('key') && table.columns.has('value'))
  const targets = existingTargets.length > 0
    ? existingTargets
    : CONFIG_TABLES.filter((table) => table.name === 'system_configs')

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
  const jsonValue = JSON.stringify(value)

  for (const table of targets) {
    try {
      if (table.name === 'configs') {
        await db.query(
          `
          INSERT INTO configs (key, value, "desc")
          VALUES ($1, $2, $3)
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value, "desc" = COALESCE(EXCLUDED."desc", configs."desc")
          `,
          [key, stringValue, description]
        )
      } else if (table.name === 'system_configs') {
        await db.query(
          `
          INSERT INTO system_configs (key, value, description, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value, description = COALESCE(EXCLUDED.description, system_configs.description), updated_at = NOW()
          `,
          [key, stringValue, description]
        )
      } else if (table.name === 'system_config') {
        await db.query(
          `
          INSERT INTO system_config (key, value, description, created_at, updated_at)
          VALUES ($1, $2::jsonb, $3, NOW(), NOW())
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value, description = COALESCE(EXCLUDED.description, system_config.description), updated_at = NOW()
          `,
          [key, jsonValue, description]
        )
      }
    } catch (error) {
      logger.warn(`[SystemConfig] 写入 ${table.name} 失败: ${error.message}`)
    }
  }

  invalidateConfigCache(key)
  return true
}

export function clearSystemConfigCache(key = null) {
  if (key) {
    invalidateConfigCache(key)
    return
  }
  configCache.clear()
}

export default {
  getConfigValue,
  getConfigValues,
  setConfigValue,
  clearSystemConfigCache,
}
