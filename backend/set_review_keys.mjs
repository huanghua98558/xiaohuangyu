
import fs from 'fs';
import pg from 'pg';
const env = fs.readFileSync('/var/www/xiaohuangyu/backend/.env','utf8');
const line = env.split(/\r?\n/).find(v => v.startsWith('DATABASE_URL='));
const DATABASE_URL = line ? line.slice('DATABASE_URL='.length) : '';
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: true } });
const now = new Date().toISOString();
const updates = [
  ['review_global_check_like', 'true', '图片审核点赞检测开关'],
  ['review_global_check_favorite', 'true', '图片审核收藏检测开关'],
  ['review_global_check_follow', 'false', '图片审核关注检测开关'],
];
for (const [key, value, description] of updates) {
  await pool.query(`
    INSERT INTO ai_configs (key, value, description, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $4)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = EXCLUDED.updated_at
  `, [key, value, description, now]);
}
const res = await pool.query("SELECT key, value FROM ai_configs WHERE key IN ('review_global_check_like','review_global_check_follow','review_global_check_favorite') ORDER BY key");
console.log(JSON.stringify(res.rows));
await pool.end();
process.exit(0);
