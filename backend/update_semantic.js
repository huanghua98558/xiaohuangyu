const { Pool } = require("pg");

const pool = new Pool({ 
  connectionString: "postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full&connection_limit=20&pool_timeout=30&connect_timeout=10"
});

async function main() {
  const client = await pool.connect();
  
  const configs = [
    ["semantic_ai_provider", "bailian", "semantic"],
    ["semantic_ai_model", "qwen-plus", "semantic"],
    ["semantic_ai_api_key", "sk-92b0cec5b87c4c739794c2b767685cc1", "semantic"],
    ["semantic_ai_temperature", "0.5", "semantic"],
    ["semantic_ai_max_tokens", "2000", "semantic"]
  ];
  
  for (const cfg of configs) {
    const key = cfg[0];
    const value = cfg[1];
    const category = cfg[2];
    const sql = "INSERT INTO ai_configs (key, value, category, updated_at) VALUES ('" + key + "', '" + value + "', '" + category + "', NOW()) ON CONFLICT (key) DO UPDATE SET value = '" + value + "', updated_at = NOW()";
    await client.query(sql);
    console.log("Updated:", key, "=", value);
  }
  
  client.release();
  await pool.end();
  console.log("Done!");
}

main().catch(console.error);
