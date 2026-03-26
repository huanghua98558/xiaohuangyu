import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: "postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full&connection_limit=20&pool_timeout=30&connect_timeout=10"
});

async function main() {
  const client = await pool.connect();
  
  // 检查语义AI配置
  const semanticConfigs = await client.query("SELECT key, value FROM ai_configs WHERE key LIKE \"semantic_%\"");
  console.log("\n--- 评论审查AI配置 ---");
  semanticConfigs.rows.forEach(r => console.log(r.key + " = " + r.value));
  
  // 检查图片审核AI配置
  const imageConfigs = await client.query("SELECT key, value FROM ai_configs WHERE key LIKE \"image_ai%\" OR key LIKE \"bailian%\"");
  console.log("\n--- 图片复审AI配置 ---");
  if (imageConfigs.rows.length === 0) {
    console.log("(无数据库配置，使用环境变量)");
  } else {
    imageConfigs.rows.forEach(r => console.log(r.key + " = " + r.value));
  }
  
  client.release();
  await pool.end();
}

main().catch(console.error);
