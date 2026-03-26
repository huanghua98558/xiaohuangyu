import pg from "pg";
import "dotenv/config";
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});
async function test() {
  try {
    const result = await pool.query("SELECT 1 as test");
    console.log("数据库连接成功:", result.rows);
    
    const tableCheck = await pool.query("SELECT COUNT(*) as count FROM ai_review_queue");
    console.log("ai_review_queue 记录数:", tableCheck.rows);
    
    const claimsCheck = await pool.query("SELECT COUNT(*) as count FROM claims");
    console.log("claims 记录数:", claimsCheck.rows);
  } catch (e) {
    console.error("错误:", e.message);
  } finally {
    await pool.end();
  }
}
test();
