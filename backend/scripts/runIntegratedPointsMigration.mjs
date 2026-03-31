import 'dotenv/config'
import db from '../src/config/database.js'

async function getColumnType(tableName, columnName) {
  const rows = await db.queryMany(`SHOW COLUMNS FROM ${tableName}`)
  const column = (rows || []).find((row) => row.column_name === columnName)
  return String(column?.data_type || '').toUpperCase()
}

async function ensureClaimColumns() {
  await db.query(`
    ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS night_coefficient DECIMAL(10, 2)
  `)
  await db.query(`
    ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS online_users BIGINT
  `)
  await db.query(`
    ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS final_points DECIMAL(12, 2)
  `)
  await db.query(`
    ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS bonus_points DECIMAL(12, 2)
  `)
  await db.query(`
    ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS publish_time_snapshot TIMESTAMP
  `)
  await db.query(`
    ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS config_snapshot JSONB
  `)
  await db.query(`
    ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS settlement_snapshot JSONB
  `)
}

async function ensureIndex(indexName, tableName, expression) {
  await db.query(`
    CREATE INDEX IF NOT EXISTS ${indexName}
    ON ${tableName}(${expression})
  `)
}

async function migrateIntColumnToDecimal(tableName, columnName, tempColumnName) {
  const currentType = await getColumnType(tableName, columnName)
  if (currentType.includes('DECIMAL')) {
    console.log(`[migration] ${tableName}.${columnName} 已是 ${currentType}，跳过`)
    return
  }

  console.log(`[migration] 转换 ${tableName}.${columnName}: ${currentType} -> DECIMAL(12,2)`)

  await db.transaction(async (client) => {
    await client.query(`
      ALTER TABLE ${tableName}
      ADD COLUMN IF NOT EXISTS ${tempColumnName} DECIMAL(12, 2)
    `)

    await client.query(`
      UPDATE ${tableName}
      SET ${tempColumnName} = ${columnName}::DECIMAL(12, 2)
      WHERE ${tempColumnName} IS NULL
    `)

    await client.query(`
      ALTER TABLE ${tableName}
      ALTER COLUMN ${tempColumnName} SET DEFAULT 0
    `)

    await client.query(`
      ALTER TABLE ${tableName}
      DROP COLUMN ${columnName}
    `)

    await client.query(`
      ALTER TABLE ${tableName}
      RENAME COLUMN ${tempColumnName} TO ${columnName}
    `)
  })
}

async function main() {
  console.log('[migration] 开始执行积分联动迁移')

  await ensureClaimColumns()
  await migrateIntColumnToDecimal('claims', 'final_points', 'final_points_decimal_tmp')
  await migrateIntColumnToDecimal('claims', 'bonus_points', 'bonus_points_decimal_tmp')
  await migrateIntColumnToDecimal('records', 'points', 'points_decimal_tmp')
  await migrateIntColumnToDecimal('users', 'points', 'points_decimal_tmp')
  await migrateIntColumnToDecimal('users', 'total_points', 'total_points_decimal_tmp')

  await ensureIndex('idx_claims_publish_time_snapshot', 'claims', 'publish_time_snapshot')
  await ensureIndex('idx_claims_night_coefficient', 'claims', 'night_coefficient')
  await ensureIndex('idx_records_task_id', 'records', 'task_id')

  console.log('[migration] 积分联动迁移完成')
  process.exit(0)
}

main().catch((error) => {
  console.error('[migration] 失败:', error)
  process.exit(1)
})
