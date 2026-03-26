import { WebSocket } from "ws";

const token = process.argv[2];
const wsHost = process.argv[3] || "localhost:3000";

if (!token) {
  console.error("Usage: node ws-test-push.mjs <token> [wsHost]");
  process.exit(1);
}

const useSSL = wsHost.includes(".");
const wsUrl = useSSL 
  ? `wss://${wsHost}/ws?token=${encodeURIComponent(token)}`
  : `ws://${wsHost}/ws?token=${encodeURIComponent(token)}`;

console.log(`[${new Date().toISOString()}] 🔌 连接 WebSocket...`);
console.log(`URL: ${wsUrl}`);
console.log(`等待服务器推送 stats_update (每10秒一次)...\n`);

const ws = new WebSocket(wsUrl, useSSL ? { rejectUnauthorized: false } : {});

const startTime = Date.now();
let statsUpdates = [];
let heartbeatLatencies = [];

ws.on("open", () => {
  const connectTime = Date.now() - startTime;
  console.log(`[${new Date().toISOString()}] ✅ 已连接 (耗时: ${connectTime}ms)\n`);
  
  // 定期发送心跳
  setInterval(() => {
    ws.send(JSON.stringify({ type: "heartbeat", data: { timestamp: Date.now() } }));
  }, 5000);
});

ws.on("message", (data) => {
  const now = Date.now();
  
  try {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === "heartbeat_ack") {
      const latency = now - msg.data.timestamp;
      heartbeatLatencies.push(latency);
    } else if (msg.type === "stats_update") {
      const delay = now - msg.timestamp;
      statsUpdates.push({ received: now, delay, data: msg.data });
      console.log(`[${new Date().toISOString()}] 📊 数据推送 #${statsUpdates.length}`);
      console.log(`    - 推送延迟: ${delay}ms`);
      console.log(`    - 今日任务: ${msg.data.todayTasks}`);
      console.log(`    - 今日领取: ${msg.data.todayClaims}`);
      console.log(`    - 服务器时间: ${new Date(msg.timestamp).toISOString()}\n`);
    } else if (msg.type === "connected") {
      console.log(`[${new Date().toISOString()}] 🎉 连接确认: userId=${msg.data.userId}\n`);
    } else if (msg.type === "user_status_change") {
      console.log(`[${new Date().toISOString()}] 👤 用户状态变更\n`);
    }
  } catch (e) {}
});

ws.on("error", (err) => {
  console.error(`❌ 错误: ${err.message}`);
});

ws.on("close", () => {
  console.log(`\n========== 测试报告 ==========`);
  console.log(`测试时长: ${((Date.now() - startTime) / 1000).toFixed(1)}秒`);
  console.log(`\n📊 实时数据推送:`);
  console.log(`  收到推送次数: ${statsUpdates.length}`);
  
  if (statsUpdates.length > 0) {
    const avgDelay = statsUpdates.reduce((a, b) => a + b.delay, 0) / statsUpdates.length;
    const intervals = [];
    for (let i = 1; i < statsUpdates.length; i++) {
      intervals.push(statsUpdates[i].received - statsUpdates[i-1].received);
    }
    const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    
    console.log(`  平均推送延迟: ${avgDelay.toFixed(1)}ms`);
    console.log(`  平均推送间隔: ${(avgInterval / 1000).toFixed(1)}秒`);
    console.log(`  预期间隔: 10秒`);
  }
  
  if (heartbeatLatencies.length > 0) {
    const avg = heartbeatLatencies.reduce((a, b) => a + b, 0) / heartbeatLatencies.length;
    console.log(`\n💓 心跳延迟: 平均 ${avg.toFixed(1)}ms`);
  }
  
  process.exit(0);
});

// 35秒后结束测试（至少收到3次推送）
setTimeout(() => {
  ws.close();
}, 35000);
