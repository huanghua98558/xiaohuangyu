const WebSocket = require("ws");

const token = process.argv[2];
if (!token) {
  console.error("Usage: node ws-test.js <token>");
  process.exit(1);
}

const wsUrl = `ws://localhost:5000/ws?token=${encodeURIComponent(token)}`;
console.log(`[${new Date().toISOString()}] 连接 WebSocket...`);

const ws = new WebSocket(wsUrl);
const startTime = Date.now();
let messageCount = 0;
let latencies = [];

ws.on("open", () => {
  const connectTime = Date.now() - startTime;
  console.log(`[${new Date().toISOString()}] ✅ WebSocket 已连接 (耗时: ${connectTime}ms)`);
  
  // 发送心跳测试延迟
  setInterval(() => {
    const pingTime = Date.now();
    ws.send(JSON.stringify({ type: "ping", data: { timestamp: pingTime } }));
  }, 5000);
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
      console.log(`[${new Date().toISOString()}] 🎉 连接确认: userId=${msg.data.userId}, level=${msg.data.level}`);
    } else if (msg.type === "stats_update") {
      console.log(`[${new Date().toISOString()}] 📊 数据更新推送收到`);
    } else if (msg.type === "user_status_change") {
      console.log(`[${new Date().toISOString()}] 👤 用户状态变更: userId=${msg.data.userId}`);
    } else {
      console.log(`[${new Date().toISOString()}] 📨 消息#${messageCount}: type=${msg.type}`);
    }
  } catch (e) {
    console.log(`[${new Date().toISOString()}] 📨 原始消息: ${data.toString().substring(0, 100)}`);
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
    console.log(`\n=== 延迟统计 ===`);
    console.log(`平均: ${avg.toFixed(1)}ms, 最小: ${min}ms, 最大: ${max}ms`);
  }
  
  process.exit(0);
});

setTimeout(() => {
  console.log(`\n=== 测试结束 (30秒) ===`);
  console.log(`总消息数: ${messageCount}`);
  
  if (latencies.length > 0) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    console.log(`延迟统计: 平均 ${avg.toFixed(1)}ms, 最小 ${min}ms, 最大 ${max}ms`);
  }
  
  ws.close();
}, 30000);
