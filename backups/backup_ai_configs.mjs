import pg from "pg";
import fs from "fs";
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: "postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full&connection_limit=20&pool_timeout=30&connect_timeout=10"
});

async function main() {
  const client = await pool.connect();
  
  // 备份 ai_configs
  const aiConfigs = await client.query("SELECT * FROM ai_configs");
  fs.writeFileSync("/var/www/xiaohuangyu/backups/ai_configs_" + new Date().toISOString().slice(0,10) + ".json", JSON.stringify(aiConfigs.rows, null, 2));
  console.log("ai_configs 备份完成:", aiConfigs.rows.length, "条记录");
  
  // 备份 configs
  const configs = await client.query("SELECT * FROM configs");
  fs.writeFileSync("/var/www/xiaohuangyu/backups/configs_" + new Date().toISOString().slice(0,10) + ".json", JSON.stringify(configs.rows, null, 2));
  console.log("configs 备份完成:", configs.rows.length, "条记录");
  
  client.release();
  await pool.end();
}

main().catch(console.error);
