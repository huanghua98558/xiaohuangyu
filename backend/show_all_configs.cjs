const db = require("./src/config/database.js").default;

async function main() {
  const configs = await db.query("SELECT key, value FROM ai_configs ORDER BY key");
  
  console.log("\n【图片审核配置】");
  configs.filter(c => c.key.startsWith("ocr_") || c.key.startsWith("yolo_") || c.key.startsWith("image_")).forEach(c => console.log(`  ${c.key}: ${c.value}`));
  
  console.log("\n【链接审查配置】");
  configs.filter(c => c.key.startsWith("link_verify_")).forEach(c => console.log(`  ${c.key}: ${c.value}`));
  
  console.log("\n【代理IP配置】");
  configs.filter(c => c.key.startsWith("proxy_")).forEach(c => console.log(`  ${c.key}: ${c.value}`));
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
