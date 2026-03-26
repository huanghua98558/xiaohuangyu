const { createClient } = require("redis");

async function main() {
  const client = createClient({
    url: "redis://localhost:6379",
    password: "XHY_Redis_20260317184224"
  });
  
  await client.connect();
  
  console.log("【Redis 代理IP池】");
  const poolSize = await client.lLen("proxy:pool:available");
  console.log("  可用IP数量:", poolSize);
  
  const mode = await client.get("proxy:mode");
  console.log("  当前模式:", mode || "direct");
  
  const failCount = await client.get("proxy:direct:failCount");
  console.log("  直连连续失败:", failCount || 0, "次");
  
  const lastSuccess = await client.get("proxy:direct:lastSuccess");
  if (lastSuccess) {
    const timeSince = Math.round((Date.now() - parseInt(lastSuccess)) / 1000);
    console.log("  上次直连成功:", timeSince, "秒前");
  }
  
  // 统计信息
  const stats = await client.hGetAll("proxy:stats");
  console.log("  统计信息:", stats);
  
  await client.disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
