import db from "../config/database.js";
import alertService from "./alertService.js";
import { publishBroadcast } from "../utils/wsEventPublisher.js";
import logger from "../utils/logger.js";
import { sendAdminNotification } from "./notificationService.js";
import { getConfigValues } from "./systemConfigService.js";

const INFRA_ALERT_RULES = [
  {
    id: "cpu_high",
    name: "CPU使用率过高",
    check: (m) => m.cpu > 85,
    severity: "high",
    message: (m) => `CPU使用率 ${m.cpu}% 超过85%阈值`,
    cooldown: 300000,
  },
  {
    id: "memory_high",
    name: "内存使用率过高",
    check: (m) => m.memory > 90,
    severity: "high",
    message: (m) => `内存使用率 ${m.memory}% 超过90%阈值`,
    cooldown: 300000,
  },
  {
    id: "disk_high",
    name: "磁盘使用率过高",
    check: (m) => m.disk > 85,
    severity: "medium",
    message: (m) => `磁盘使用率 ${m.disk}% 超过85%阈值`,
    cooldown: 600000,
  },
  {
    id: "ocr_down",
    name: "OCR服务不可用",
    check: (m) => m.services && m.services.ocr === false,
    severity: "high",
    message: () => "全部OCR服务不可用",
    cooldown: 180000,
  },
  {
    id: "yolo_down",
    name: "YOLO服务不可用",
    check: (m) => m.services && m.services.yolo === false,
    severity: "high",
    message: () => "YOLO服务不可用",
    cooldown: 180000,
  },
  {
    id: "browser_down",
    name: "Browser服务不可用",
    check: (m) => m.services && m.services.browser === false,
    severity: "high",
    message: () => "Browser Service全部不可用",
    cooldown: 180000,
  },
  {
    id: "queue_backlog",
    name: "审核队列积压",
    check: (m) => m.queueSize > 100,
    severity: "medium",
    message: (m) => `审核队列积压 ${m.queueSize} 项`,
    cooldown: 600000,
  },
  {
    id: "redis_down",
    name: "Redis不可用",
    check: (m) => m.services && m.services.redis === false,
    severity: "high",
    message: () => "Redis服务不可用",
    cooldown: 180000,
  },
];

const lastAlertTime = new Map();
const DEFAULT_CONFIG = {
  cooldownSeconds: 300,
  manualQueueThreshold: 5,
  staleTaskMinutes: 120,
  pendingPayoutMinutes: 30,
  userAnomalyThreshold: 3,
  rewardAnomalyThreshold: 1,
  rewardAnomalyLookbackMinutes: 120,
};

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

class AlertEngine {
  async getRuntimeConfig() {
    const configKeys = [
      "notification_alert_cooldown_seconds",
      "notification_alert_manual_queue_threshold",
      "notification_alert_stale_task_minutes",
      "notification_alert_pending_payout_minutes",
      "notification_alert_user_anomaly_threshold",
      "notification_alert_reward_anomaly_threshold",
      "notification_alert_reward_lookback_minutes",
    ];

    const map = await getConfigValues(configKeys);
    return {
      cooldownMs: toNumber(map.notification_alert_cooldown_seconds, DEFAULT_CONFIG.cooldownSeconds) * 1000,
      manualQueueThreshold: toNumber(map.notification_alert_manual_queue_threshold, DEFAULT_CONFIG.manualQueueThreshold),
      staleTaskMinutes: toNumber(map.notification_alert_stale_task_minutes, DEFAULT_CONFIG.staleTaskMinutes),
      pendingPayoutMinutes: toNumber(map.notification_alert_pending_payout_minutes, DEFAULT_CONFIG.pendingPayoutMinutes),
      userAnomalyThreshold: toNumber(map.notification_alert_user_anomaly_threshold, DEFAULT_CONFIG.userAnomalyThreshold),
      rewardAnomalyThreshold: toNumber(map.notification_alert_reward_anomaly_threshold, DEFAULT_CONFIG.rewardAnomalyThreshold),
      rewardAnomalyLookbackMinutes: toNumber(map.notification_alert_reward_lookback_minutes, DEFAULT_CONFIG.rewardAnomalyLookbackMinutes),
    };
  }

  async emitAlert({
    id,
    name,
    severity = "medium",
    message,
    metadata = {},
    cooldownMs = DEFAULT_CONFIG.cooldownSeconds * 1000,
    source = "system",
    relatedId = null,
    relatedType = null,
  }) {
    const last = lastAlertTime.get(id) || 0;
    if (Date.now() - last < cooldownMs) {
      return null;
    }
    lastAlertTime.set(id, Date.now());

    const alert = {
      ruleId: id,
      name,
      severity,
      message,
      metadata,
      timestamp: Date.now(),
    };

    try {
      await alertService.createAlert({
        type: id,
        severity,
        title: name,
        message,
        source,
        relatedId,
        relatedType,
        metadata,
      });
    } catch (e) {
      logger.error("[告警引擎] 存储告警失败:", e.message);
    }

    try {
      await sendAdminNotification({
        type: 'system_alert',
        title: name,
        content: message,
        data: {
          ruleId: id,
          severity,
          ...metadata,
        },
        priority: severity === 'high' || severity === 'critical' ? 'high' : 'normal',
      });
    } catch (e) {
      logger.error("[告警引擎] 发送管理员通知失败:", e.message);
    }

    try {
      await publishBroadcast("system_alert", alert);
    } catch (e) {}

    logger.warn(`[告警] ${severity}: ${name} - ${message}`);
    return alert;
  }

  async evaluate(metrics) {
    const alerts = [];
    const runtime = await this.getRuntimeConfig();
    for (const rule of INFRA_ALERT_RULES) {
      try {
        if (!rule.check(metrics)) continue;
        const alert = await this.emitAlert({
          id: rule.id,
          name: rule.name,
          severity: rule.severity,
          message: rule.message(metrics),
          metadata: { metrics },
          cooldownMs: Math.max(rule.cooldown, runtime.cooldownMs),
        });
        if (alert) alerts.push(alert);
      } catch (e) {
        logger.error(`[告警引擎] 规则${rule.id}评估失败:`, e.message);
      }
    }
    return alerts;
  }

  async evaluateBusinessAlerts() {
    const runtime = await this.getRuntimeConfig();
    const alerts = [];

    try {
      const manualQueue = await db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM claims
        WHERE status = 'pending_manual'
           OR ai_review_status = 'manual'
        `
      );
      const manualCount = toNumber(manualQueue.rows?.[0]?.count, 0);
      if (manualCount >= runtime.manualQueueThreshold) {
        const alert = await this.emitAlert({
          id: "manual_queue_backlog",
          name: "人工检查列表积压",
          severity: "high",
          message: `人工检查列表已有 ${manualCount} 条待处理，超过阈值 ${runtime.manualQueueThreshold}。`,
          metadata: {
            manualQueueCount: manualCount,
            threshold: runtime.manualQueueThreshold,
          },
          cooldownMs: runtime.cooldownMs,
          source: "review_center",
        });
        if (alert) alerts.push(alert);
      }
    } catch (e) {
      logger.error("[告警引擎] 评估人工队列告警失败:", e.message);
    }

    try {
      const staleCutoff = new Date(Date.now() - runtime.staleTaskMinutes * 60 * 1000);
      const staleTasks = await db.query(
        `
        SELECT COUNT(*)::int AS count, MIN(created_at) AS oldest_created_at
        FROM tasks
        WHERE status = 'active'
          AND COALESCE(remain, 0) > 0
          AND created_at <= $1
        `,
        [staleCutoff]
      );
      const staleCount = toNumber(staleTasks.rows?.[0]?.count, 0);
      if (staleCount > 0) {
        const alert = await this.emitAlert({
          id: "stale_active_tasks",
          name: "任务长时间未完成",
          severity: "medium",
          message: `已有 ${staleCount} 个进行中任务超过 ${runtime.staleTaskMinutes} 分钟仍未完成。`,
          metadata: {
            staleTaskCount: staleCount,
            thresholdMinutes: runtime.staleTaskMinutes,
            oldestCreatedAt: staleTasks.rows?.[0]?.oldest_created_at || null,
          },
          cooldownMs: runtime.cooldownMs,
          source: "task_center",
        });
        if (alert) alerts.push(alert);
      }
    } catch (e) {
      logger.error("[告警引擎] 评估任务超时告警失败:", e.message);
    }

    try {
      const payoutCutoff = new Date(Date.now() - runtime.pendingPayoutMinutes * 60 * 1000);
      const pendingPayouts = await db.query(
        `
        SELECT COUNT(*)::int AS count, MIN(reviewed_at) AS oldest_reviewed_at
        FROM withdrawals
        WHERE status = 'approved'
          AND reviewed_at IS NOT NULL
          AND reviewed_at <= $1
        `,
        [payoutCutoff]
      );
      const payoutCount = toNumber(pendingPayouts.rows?.[0]?.count, 0);
      if (payoutCount > 0) {
        const alert = await this.emitAlert({
          id: "withdraw_payout_pending",
          name: "提现待打款提醒",
          severity: "high",
          message: `当前有 ${payoutCount} 条提现审核通过后待打款，已超过 ${runtime.pendingPayoutMinutes} 分钟。`,
          metadata: {
            pendingPayoutCount: payoutCount,
            thresholdMinutes: runtime.pendingPayoutMinutes,
            oldestReviewedAt: pendingPayouts.rows?.[0]?.oldest_reviewed_at || null,
          },
          cooldownMs: runtime.cooldownMs,
          source: "wallet",
        });
        if (alert) alerts.push(alert);
      }
    } catch (e) {
      logger.error("[告警引擎] 评估提现待打款告警失败:", e.message);
    }

    try {
      const recentBlockedAt = new Date(Date.now() - 60 * 60 * 1000);
      const anomalyUsers = await db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM blocked_accounts
        WHERE detected_at >= $1
        `,
        [recentBlockedAt]
      );
      const anomalyCount = toNumber(anomalyUsers.rows?.[0]?.count, 0);
      if (anomalyCount >= runtime.userAnomalyThreshold) {
        const alert = await this.emitAlert({
          id: "user_anomaly_spike",
          name: "用户异常增长告警",
          severity: "high",
          message: `最近 1 小时检测到 ${anomalyCount} 条疑似封控/异常用户记录，超过阈值 ${runtime.userAnomalyThreshold}。`,
          metadata: {
            anomalyCount,
            threshold: runtime.userAnomalyThreshold,
            windowMinutes: 60,
          },
          cooldownMs: runtime.cooldownMs,
          source: "risk_control",
        });
        if (alert) alerts.push(alert);
      }
    } catch (e) {
      logger.error("[告警引擎] 评估用户异常告警失败:", e.message);
    }

    try {
      const rewardLookback = new Date(Date.now() - runtime.rewardAnomalyLookbackMinutes * 60 * 1000);
      const rewardAnomaly = await db.query(
        `
        SELECT COUNT(*)::int AS count, MIN(reviewed_at) AS oldest_reviewed_at
        FROM claims
        WHERE status IN ('approved', 'done')
          AND reviewed_at >= $1
          AND COALESCE(reward, 0) = 0
        `,
        [rewardLookback]
      );
      const rewardCount = toNumber(rewardAnomaly.rows?.[0]?.count, 0);
      if (rewardCount >= runtime.rewardAnomalyThreshold) {
        const alert = await this.emitAlert({
          id: "reward_settlement_anomaly",
          name: "任务完成奖励异常",
          severity: "critical",
          message: `最近 ${runtime.rewardAnomalyLookbackMinutes} 分钟内检测到 ${rewardCount} 条通过任务奖励异常，请立即排查积分发放。`,
          metadata: {
            rewardAnomalyCount: rewardCount,
            threshold: runtime.rewardAnomalyThreshold,
            lookbackMinutes: runtime.rewardAnomalyLookbackMinutes,
            oldestReviewedAt: rewardAnomaly.rows?.[0]?.oldest_reviewed_at || null,
          },
          cooldownMs: runtime.cooldownMs,
          source: "points_settlement",
        });
        if (alert) alerts.push(alert);
      }
    } catch (e) {
      logger.error("[告警引擎] 评估奖励异常告警失败:", e.message);
    }

    return alerts;
  }

  getRules() {
    return INFRA_ALERT_RULES.map((r) => ({
      id: r.id,
      name: r.name,
      severity: r.severity,
      cooldown: r.cooldown,
    }));
  }
}

export default new AlertEngine();
