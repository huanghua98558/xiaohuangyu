import WebSocket from "ws";

const token = process.argv[2] || "";
const wsUrl = "ws://localhost:3000/ws?token=" + encodeURIComponent(token);

console.log("====== WebSocket 实时性延迟测试 ======\n");
console.log("连接地址:", wsUrl.substring(0, 50) + "...");

const ws = new WebSocket(wsUrl);
const latencies = [];
const pingTimestamps = new Map();
let msgCount = 0;
let startTime = Date.now();

ws.on("open", () => {
  console.log("\n[连接成功] WebSocket 已连接");
  console.log("--- 开始延迟测试 (5次ping) ---\n");
  
  // 发送5次ping测试延迟
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const ts = Date.now();
      const seq = i + 1;
      pingTimestamps.set(seq, ts);
      ws.send(JSON.stringify({ type: "ping", data: { timestamp: ts, seq: seq } }));
      console.log();
    }, i * 1500);
  }
  
  // 10秒后输出结果
  setTimeout(() => {
    console.log("\n--- 测试结果 ---");
    if (latencies.length > 0) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const min = Math.min(...latencies);
      const max = Math.max(...latencies);
      console.log("Ping-Pong 延迟测试 (" + latencies.length + "次):");
      console.log("  平均延迟:", avg.toFixed(1), "ms");
      console.log("  最小延迟:", min, "ms");
      console.log("  最大延迟:", max, "ms");
      console.log("  延迟列表:", latencies.join("ms, ") + "ms");
      
      // 评估实时性
      console.log("\n--- 实时性评估 ---");
      if (avg < 10) {
        console.log("  评级: 优秀 (平均延迟 < 10ms)");
      } else if (avg < 50) {
        console.log("  评级: 良好 (平均延迟 < 50ms)");
      } else if (avg < 100) {
        console.log("  评级: 一般 (平均延迟 < 100ms)");
      } else {
        console.log("  评级: 较慢 (平均延迟 >= 100ms)");
      }
    }
    console.log("\n接收消息总数:", msgCount, "条");
    console.log("测试时长:", ((Date.now() - startTime) / 1000).toFixed(1), "秒");
    
    ws.close();
    setTimeout(() => process.exit(0), 500);
  }, 10000);
});

ws.on("message", (data) => {
  msgCount++;
  try {
    const msg = JSON.parse(data.toString());
    const now = Date.now();
    
    if (msg.type === "pong") {
      // 使用服务器返回的时间戳计算延迟
      const serverTs = msg.data?.timestamp;
      if (serverTs) {
        // 找到对应的ping时间戳
        for (const [seq, ts] of pingTimestamps) {
          if (now - ts < 5000) { // 5秒内的ping
            const latency = now - ts;
            latencies.push(latency);
            pingTimestamps.delete(seq);
            console.log();
            break;
          }
        }
      }
    } else if (msg.type === "stats_update") {
      console.log("[实时推送] 收到统计数据更新:", JSON.stringify(msg.data).substring(0, 100));
    } else if (msg.type === "user_status_change") {
      console.log("[状态变化] 用户状态更新");
    } else if (msg.type === "connected") {
      console.log("[系统消息] 连接确认");
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
