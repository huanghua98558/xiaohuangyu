const WebSocket = require("ws");

const token = process.argv[2] || "";
const wsUrl = "ws://localhost:5000/ws?token=" + encodeURIComponent(token);

console.log("====== WebSocket 实时性测试 ======\n");
console.log("连接地址:", wsUrl.substring(0, 50) + "...");

const ws = new WebSocket(wsUrl);
const latencies = [];
let msgCount = 0;
let startTime = Date.now();

ws.on("open", () => {
  console.log("\n[连接成功] WebSocket 已连接");
  console.log("--- 开始延迟测试 (5次心跳) ---\n");
  
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const ts = Date.now();
      ws.send(JSON.stringify({ type: "ping", data: { timestamp: ts, seq: i + 1 } }));
    }, i * 1000);
  }
  
  setTimeout(() => {
    console.log("\n--- 测试结果 ---");
    if (latencies.length > 0) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const min = Math.min(...latencies);
      const max = Math.max(...latencies);
      console.log("心跳延迟测试 (" + latencies.length + "次):");
      console.log("  平均延迟:", avg.toFixed(1), "ms");
      console.log("  最小延迟:", min, "ms");
      console.log("  最大延迟:", max, "ms");
      console.log("  延迟列表:", latencies.join("ms, ") + "ms");
    }
    console.log("\n接收消息总数:", msgCount, "条");
    console.log("测试时长:", ((Date.now() - startTime) / 1000).toFixed(1), "秒");
    
    ws.close();
    setTimeout(() => process.exit(0), 500);
  }, 8000);
});

ws.on("message", (data) => {
  msgCount++;
  try {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === "heartbeat_ack") {
      const latency = Date.now() - msg.data.timestamp;
      latencies.push(latency);
      console.log("[延迟测试] 第" + (msg.data.seq || msgCount) + "次: " + latency + "ms");
    } else if (msg.type === "stats_update") {
      console.log("[实时推送] 收到统计数据更新:", JSON.stringify(msg.data).substring(0, 100));
    } else {
      console.log("[消息] 类型:", msg.type);
    }
  } catch (e) {
    console.log("[消息] 原始数据:", data.toString().substring(0, 100));
  }
});

ws.on("error", (err) => {
  console.error("\n[错误] WebSocket连接失败:", err.message);
  process.exit(1);
});

ws.on("close", () => {
  console.log("\n[断开] WebSocket连接已关闭");
});
