import WebSocket from "ws";

const token = process.argv[2] || "";
const wsUrl = "ws://localhost:3000/ws?token=" + encodeURIComponent(token);

console.log("====== WebSocket 实时推送测试 ======\n");

const ws = new WebSocket(wsUrl);
let msgCount = 0;
let startTime = Date.now();

ws.on("open", async () => {
  console.log("[连接成功] WebSocket 已连接\n");
  
  // 订阅统计数据频道
  ws.send(JSON.stringify({ 
    type: "subscribe", 
    data: { channel: "stats" } 
  }));
  
  console.log("[订阅] 订阅统计数据频道");
  console.log("\n等待实时推送消息... (15秒)\n");
  
  // 设置测试超时
  setTimeout(() => {
    console.log("\n--- 测试结果 ---");
    console.log("接收消息总数:", msgCount, "条");
    console.log("测试时长:", ((Date.now() - startTime) / 1000).toFixed(1), "秒");
    
    ws.close();
    setTimeout(() => process.exit(0), 500);
  }, 15000);
});

ws.on("message", (data) => {
  msgCount++;
  try {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === "stats_update") {
      console.log("[" + msgCount + "] 实时推送 - 统计数据更新");
    } else if (msg.type === "user_status_change") {
      console.log("[" + msgCount + "] 状态变化");
    } else if (msg.type === "connected") {
      console.log("[" + msgCount + "] 连接确认");
    } else {
      console.log("[" + msgCount + "] 消息类型:", msg.type);
    }
  } catch (e) {
    console.log("[" + msgCount + "] 原始数据");
  }
});

ws.on("error", (err) => {
  console.error("[错误]", err.message);
  process.exit(1);
});

ws.on("close", () => {
  console.log("\n[断开] WebSocket已关闭");
});
