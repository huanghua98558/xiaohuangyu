import alertService from "./alertService.js";
import { publishBroadcast } from "../utils/wsEventPublisher.js";
import logger from "../utils/logger.js";

const ALERT_RULES = [
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

class AlertEngine {
  async evaluate(metrics) {
    const alerts = [];
    for (const rule of ALERT_RULES) {
      try {
        if (!rule.check(metrics)) continue;
        const last = lastAlertTime.get(rule.id) || 0;
        if (Date.now() - last < rule.cooldown) continue;
        lastAlertTime.set(rule.id, Date.now());

        const alert = {
          ruleId: rule.id,
          name: rule.name,
          severity: rule.severity,
          message: rule.message(metrics),
          timestamp: Date.now(),
        };
        alerts.push(alert);

        try {
          await alertService.createAlert({
            type: rule.id,
            severity: rule.severity,
            title: rule.name,
            message: rule.message(metrics),
          });
        } catch (e) {
          logger.error("[告警引擎] 存储告警失败:", e.message);
        }

        try {
          await publishBroadcast("system_alert", alert);
        } catch (e) {}

        logger.warn(
          `[告警] ${rule.severity}: ${rule.name} - ${rule.message(metrics)}`
        );
      } catch (e) {
        logger.error(`[告警引擎] 规则${rule.id}评估失败:`, e.message);
      }
    }
    return alerts;
  }

  getRules() {
    return ALERT_RULES.map((r) => ({
      id: r.id,
      name: r.name,
      severity: r.severity,
      cooldown: r.cooldown,
    }));
  }
}

export default new AlertEngine();
