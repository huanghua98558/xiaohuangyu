import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: "postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full&connection_limit=20&pool_timeout=30&connect_timeout=10"
});

async function main() {
  const client = await pool.connect();
  
  const configs = [
    ["semantic_ai_provider", "bailian", "语义检测AI提供商"],
    ["semantic_ai_model", "qwen-plus", "语义检测AI模型"],
    ["semantic_ai_api_key", "sk-92b0cec5b87c4c739794c2b767685cc1", "语义检测API密钥"],
    ["semantic_ai_temperature", "0.5", "语义检测温度"],
    ["semantic_ai_max_tokens", "2000", "语义检测最大token"]
  ];
  
  for (const cfg of configs) {
    const key = cfg[0];
    const value = cfg[1];
    const desc = cfg[2];
    const sql = "INSERT INTO configs (key, value, desc) VALUES (" + " + key + " + ", " + " + value + " + ", " + " + desc + " + ") ON CONFLICT (key) DO UPDATE SET value = " + " + value + ";
    await client.query(sql);
    console.log("Updated:", key);
  }
  
  client.release();
  await pool.end();
  console.log("Done!");
}

main().catch(console.error);
