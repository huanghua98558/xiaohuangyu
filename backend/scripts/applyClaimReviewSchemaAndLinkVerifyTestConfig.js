import 'dotenv/config'
import { Client } from 'pg'

const DEFAULT_LINK_REVIEW_SETTINGS = {
  basic: {
    batchSize: 10,
    waitTime: 5,
    timeout: 30,
    maxRetries: 3,
    concurrentLimit: 5,
    delayMinutes: 0,
    batchThreshold: 1,
    maxWaitMinutes: 0
  },
  proxy: {
    enabled: true,
    mode: 'auto',
    queueThreshold: 20,
    directFailLimit: 3,
    directCooldown: 30,
    captchaCooldown: 60,
    ipUsageLimit: 200,
    ipTtlMin: 300,
    ipTtlMax: 900
  },
  riskDetection: {
    enabled: true,
    keywords: ['验证码', '访问频繁', '安全验证', '滑动验证'],
    autoSwitchOnCaptcha: true
  },
  browser: {
    browserCount: 3,
    contextsPerBrowser: 10,
    headless: true,
    disableImages: true
  }
}

const LINK_VERIFY_CONFIGS = [
  ['link_verify_delay_minutes', '0'],
  ['link_verify_batch_threshold', '1'],
  ['link_verify_max_wait_minutes', '0'],
  ['link_verify_batch_size', '10'],
  ['link_verify_retry_count', '3'],
  ['link_verify_enabled', 'true']
]

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS evaluation JSONB NULL')
  await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_verified BOOLEAN NULL')
  await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_verify_result JSONB NULL')

  for (const [key, value] of LINK_VERIFY_CONFIGS) {
    await client.query(
      `
      INSERT INTO ai_configs (key, value, type, category, is_enabled, updated_at)
      VALUES ($1, $2, 'text', 'link_review', true, NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW(),
        is_enabled = true
      `,
      [key, value]
    )
  }

  await client.query(
    `
    INSERT INTO system_configs (key, value, description, updated_at)
    VALUES ($1, $2, '链接审核配置', NOW())
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
    `,
    ['link_review_settings', JSON.stringify(DEFAULT_LINK_REVIEW_SETTINGS)]
  )

  const columns = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'claims'
      AND column_name IN ('evaluation', 'link_verified', 'link_verify_result')
    ORDER BY column_name
    `
  )

  const linkVerifyConfig = await client.query(
    `
    SELECT key, value
    FROM ai_configs
    WHERE key LIKE 'link_verify_%'
    ORDER BY key
    `
  )

  console.log(JSON.stringify({
    columns: columns.rows,
    linkVerifyConfig: linkVerifyConfig.rows
  }, null, 2))

  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
