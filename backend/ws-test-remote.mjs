import { WebSocket } from "ws";

const token = process.argv[2];
const wsHost = process.argv[3] || "localhost:3000";

if (!token) {
  console.error("Usage: node ws-test-remote.mjs <token> [wsHost]");
  process.exit(1);
}

const wsUrl = `wss://${wsHost}/ws?token=${encodeURIComponent(token)}`;
console.log(`[${new Date().toISOString()}] 🔌 连接 WebSocket: wss://${wsHost}/ws...`);

const ws = new WebSocket(wsUrl, {
  rejectUnauthorized: false // 允许自签名证书
});

const startTime = Date.now();
let messageCount = 0;
let latencies = [];

ws.on("open", () => {
  const connectTime = Date.now() - startTime;
  console.log(`[${new Date().toISOString()}] ✅ WebSocket 已连接 (连接耗时: ${connectTime}ms)`);
  
  // 每3秒发送心跳测试延迟
  setInterval(() => {
    const pingTime = Date.now();
    ws.send(JSON.stringify({ type: "heartbeat", data: { timestamp: pingTime } }));
  }, 3000);
});

ws.on("message", (data) => {
  messageCount++;
  const now = Date.now();
  
  try {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === "heartbeat_ack") {
      const latency = now - msg.data.timestamp;
      latencies.push(latency);
      console.log(`[${new Date().toISOString()}] 💓 心跳响应: 延迟 ${latency}ms`);
    } else if (msg.type === "connected") {
      console.log(`[${new Date().toISOString()}] 🎉 连接确认: userId=${msg.data.userId}`);
    } else if (msg.type === "stats_update") {
      console.log(`[${new Date().toISOString()}] 📊 数据更新推送`);
    } else if (msg.type === "user_status_change") {
      console.log(`[${new Date().toISOString()}] 👤 用户状态变更`);
    } else {
      console.log(`[${new Date().toISOString()}] 📨 消息#${messageCount}: type=${msg.type}`);
    }
  } catch (e) {
    console.log(`[${new Date().toISOString()}] 📨 原始消息`);
  }
});

ws.on("error", (err) => {
  console.error(`[${new Date().toISOString()}] ❌ 错误: ${err.message}`);
});

ws.on("close", (code, reason) => {
  console.log(`[${new Date().toISOString()}] 🔌 连接关闭: code=${code}`);
  
  if (latencies.length > 0) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    console.log(`\n========== 延迟统计 ==========`);
    console.log(`样本数: ${latencies.length}`);
    console.log(`平均延迟: ${avg.toFixed(2)}ms`);
    console.log(`最小延迟: ${min}ms`);
    console.log(`最大延迟: ${max}ms`);
  }
  
  process.exit(0);
});

setTimeout(() => {
  console.log(`\n========== 测试结束 ==========`);
  console.log(`总消息数: ${messageCount}`);
  
  if (latencies.length > 0) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    console.log(`平均延迟: ${avg.toFixed(2)}ms, 范围: ${min}-${max}ms`);
  }
  
  ws.close();
}, 20000);
