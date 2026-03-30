
import fs from 'fs';
import pg from 'pg';
const env = fs.readFileSync('/var/www/xiaohuangyu/backend/.env','utf8');
const line = env.split(/\r?\n/).find(v => v.startsWith('DATABASE_URL='));
const DATABASE_URL = line ? line.slice('DATABASE_URL='.length) : '';
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: true } });
const now = new Date().toISOString();
for (const [key, value] of [
  ['review_global_check_like', 'true'],
  ['review_global_check_favorite', 'true'],
  ['review_global_check_follow', 'false'],
]) {
  await pool.query(`
    INSERT INTO ai_configs (key, value, type, category, is_enabled, updated_at)
    VALUES ($1, $2, 'text', 'review', true, $3)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `, [key, value, now]);
}
const res = await pool.query("SELECT key, value FROM ai_configs WHERE key IN ('review_global_check_like','review_global_check_follow','review_global_check_favorite') ORDER BY key");
console.log(JSON.stringify(res.rows));
await pool.end();
process.exit(0);
