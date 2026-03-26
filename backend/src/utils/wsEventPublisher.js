/**
 * WebSocket 事件发布器
 * Worker 进程通过 Redis Pub/Sub 发布事件给 WebSocket 服务
 */
import dotenv from "dotenv";
dotenv.config();

let publisher = null;
const WS_BROADCAST_CHANNEL = "ws:broadcast";
const WS_CHANNEL = "ws:notify";

async function getPublisher() {
  if (publisher && publisher.isOpen) return publisher;

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT || 6379;
  const password = process.env.REDIS_PASSWORD;

  if (!host) return null;

  try {
    const { createClient } = await import("redis");
    publisher = createClient({
      url: `redis://${host}:${port}`,
      password: password || undefined,
    });
    publisher.on("error", (err) =>
      console.error("[WS Publisher] Redis error:", err.message)
    );
    await publisher.connect();
    console.log("[WS Publisher] Redis 连接成功");
    return publisher;
  } catch (e) {
    console.error("[WS Publisher] Redis 连接失败:", e.message);
    return null;
  }
}

export async function publishBroadcast(type, data) {
  const client = await getPublisher();
  if (!client) return;
  try {
    await client.publish(
      WS_BROADCAST_CHANNEL,
      JSON.stringify({ type, data, timestamp: Date.now() })
    );
  } catch (e) {
    console.error("[WS Publisher] 广播失败:", e.message);
  }
}

export async function publishToUser(userId, type, data) {
  const client = await getPublisher();
  if (!client) return;
  try {
    await client.publish(
      WS_CHANNEL,
      JSON.stringify({
        userId: String(userId),
        data: { type, data, timestamp: Date.now() },
      })
    );
  } catch (e) {
    console.error("[WS Publisher] 发送用户消息失败:", e.message);
  }
}

export async function publishImageReviewComplete(
  claimId,
  userId,
  passed,
  reason
) {
  await publishBroadcast("ai_review_update", {
    event: "image_review_complete",
    claimId,
    userId,
    passed,
    reason,
    timestamp: Date.now(),
  });
  await publishToUser(userId, "review_result", {
    claimId,
    stage: "image_review",
    passed,
    reason,
  });
}

export async function publishLinkVerifyComplete(
  claimId,
  userId,
  passed,
  details
) {
  await publishBroadcast("ai_review_update", {
    event: "link_verify_complete",
    claimId,
    userId,
    passed,
    ...details,
    timestamp: Date.now(),
  });
  await publishToUser(userId, "review_result", {
    claimId,
    stage: "link_verify",
    passed,
    ...details,
  });
}

export async function publishPointsAwarded(userId, points, reasonOrDetail) {
  const isObjectDetail =
    reasonOrDetail &&
    typeof reasonOrDetail === "object" &&
    !Array.isArray(reasonOrDetail);

  const detail = isObjectDetail ? reasonOrDetail : { reason: reasonOrDetail };

  await publishToUser(userId, "points_update", {
    points,
    reason: detail.reason || "积分发放",
    ...detail,
    timestamp: Date.now(),
  });
}

export async function publishAlert(alert) {
  await publishBroadcast("system_alert", alert);
}

export async function publishSystemMetrics(metrics) {
  await publishBroadcast("system_metrics", metrics);
}

export async function publishServiceHealth(health) {
  await publishBroadcast("service_health", health);
}

export default {
  publishBroadcast,
  publishToUser,
  publishImageReviewComplete,
  publishLinkVerifyComplete,
  publishPointsAwarded,
  publishAlert,
  publishSystemMetrics,
  publishServiceHealth,
};
