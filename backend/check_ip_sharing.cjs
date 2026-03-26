const { createClient } = require("redis");

async function main() {
  const client = createClient({
    url: "redis://localhost:6379",
    password: "XHY_Redis_20260317184224"
  });
  
  await client.connect();
  
  console.log("=== 代理IP池共享状态 ===");
  console.log("Redis Key: proxy:pool:available");
  console.log("池大小:", await client.lLen("proxy:pool:available"));
  
  // 模拟多实例取IP
  console.log("\n=== 模拟多实例取IP ===");
  const poolSize = await client.lLen("proxy:pool:available");
  console.log("当前池中有", poolSize, "个IP");
  
  // 查看模式
  const mode = await client.get("proxy:mode");
  console.log("当前模式:", mode || "direct");
  
  // 直连失败计数
  const failCount = await client.get("proxy:direct:failCount");
  console.log("直连连续失败:", failCount || 0, "次");
  
  await client.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
