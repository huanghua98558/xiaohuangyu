
import fs from 'fs';
import pg from 'pg';
const env = fs.readFileSync('/var/www/xiaohuangyu/backend/.env','utf8');
const line = env.split(/\r?\n/).find(v => v.startsWith('DATABASE_URL='));
const DATABASE_URL = line ? line.slice('DATABASE_URL='.length) : '';
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: true } });
const res = await pool.query("SELECT key, value FROM ai_configs WHERE key IN ('review_global_check_like','review_global_check_follow','review_global_check_favorite') ORDER BY key");
console.log(JSON.stringify(res.rows));
await pool.end();
process.exit(0);
