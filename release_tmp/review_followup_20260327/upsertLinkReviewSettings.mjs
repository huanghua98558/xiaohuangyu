const { default: db } = await import('/var/www/xiaohuangyu/backend/src/config/database.js')
const { default: reviewConfig } = await import('/var/www/xiaohuangyu/backend/src/services/ai/reviewConfigService.js')
const { getRedisClient } = await import('/var/www/xiaohuangyu/backend/src/utils/redis.js')

const config = await reviewConfig.getConfig()
const client = await getRedisClient()
const proxyMode = client ? (await client.get('proxy:mode')) : null

const payload = {
  basic: {
    batchSize: config.linkVerify.batchSize,
    waitTime: 5,
    timeout: 30,
    maxRetries: config.linkVerify.retryCount,
    concurrentLimit: 5,
    delayMinutes: config.linkVerify.delayMinutes,
    batchThreshold: config.linkVerify.batchThreshold,
    maxWaitMinutes: config.linkVerify.maxWaitMinutes
  },
  proxy: {
    enabled: true,
    mode: proxyMode || 'auto',
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

await db.query(
  `
  INSERT INTO system_configs (key, value, description, updated_at)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (key)
  DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at
  `,
  ['link_review_settings', JSON.stringify(payload), '链接审核配置', new Date().toISOString()]
)

const saved = await db.queryOne(
  `SELECT value FROM system_configs WHERE key = $1`,
  ['link_review_settings']
)

console.log(
  JSON.stringify(
    {
      saved: Boolean(saved),
      basic: saved?.value?.basic || payload.basic,
      proxyMode: saved?.value?.proxy?.mode || payload.proxy.mode
    },
    null,
    2
  )
)

if (client) {
  await client.quit()
}

process.exit(0)
