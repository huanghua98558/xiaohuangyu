const db = require("./src/config/database.js").default;

async function main() {
  const configs = await db.query(
    "SELECT key, value FROM ai_configs WHERE key LIKE $1",
    ["link_verify_%"]
  );
  console.log("=== 链接审查配置 ===");
  configs.forEach(c => console.log(`${c.key}: ${c.value}`));
  process.exit(0);
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
