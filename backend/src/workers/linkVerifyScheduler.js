/**
 * 链接验证智能调度器
 * 功能：
 * 1. 每 5 分钟检查一次延迟队列
 * 2. 智能批量（时间 + 数量 + IP 有效期三重触发）
 * 3. 按需获取代理 IP
 */

import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../config/queue.js';
import db from '../config/database.js';
import logger from '../utils/logger.js'
import {
  buildLinkDelayJobId,
  buildLinkVerifyJobId,
  normalizeSubmissionVersion,
} from '../utils/reviewQueueIds.js'

// 平台延迟配置（毫秒）
const PLATFORM_DELAY = {
  douyin: 15 * 60 * 1000,      // 抖音：15 分钟
  xiaohongshu: 30 * 60 * 1000, // 小红书：30 分钟
  kuaishou: 20 * 60 * 1000,    // 快手：20 分钟
  default: 20 * 60 * 1000      // 默认：20 分钟
};

// 批量触发配置
const BATCH_CONFIG = {
  maxBatchSize: readIntegerConfig(process.env.LINK_VERIFY_BATCH_SIZE, 10, 1),
  timeTriggerMinutes: readIntegerConfig(process.env.LINK_VERIFY_TIME_TRIGGER_MINUTES, 10, 1),
  minBatchSize: readIntegerConfig(process.env.LINK_VERIFY_BATCH_THRESHOLD, 3, 1),
  ipExpiryMinutes: readIntegerConfig(process.env.LINK_VERIFY_IP_EXPIRY_MINUTES, 30, 1),
  retryCount: readIntegerConfig(process.env.LINK_VERIFY_RETRY_COUNT, 3, 1),
  schedulerIntervalMs: readIntegerConfig(process.env.LINK_VERIFY_SCHEDULER_INTERVAL_MS, 60000, 5000),
  delayWorkerConcurrency: readIntegerConfig(process.env.LINK_VERIFY_DELAY_WORKER_CONCURRENCY, 5, 1),
  delayWorkerLimiterMax: readIntegerConfig(process.env.LINK_VERIFY_DELAY_RATE_LIMIT_MAX, 10, 1),
  delayWorkerLimiterDurationMs: readIntegerConfig(process.env.LINK_VERIFY_DELAY_RATE_LIMIT_DURATION_MS, 1000, 100),
  queueSoftCapacity: readIntegerConfig(process.env.LINK_VERIFY_QUEUE_SOFT_CAPACITY, 20, 1)
};

// 链接验证队列
const linkVerifyQueue = new Queue('link-verify-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000
    }
  }
});

// 延迟队列（存储待处理的链接审核）
const delayQueue = new Queue('link-delay-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000
  }
});

// 调度器状态
let schedulerRunning = false;
let lastRunTime = Date.now();
let processedCount = 0;

function readIntegerConfig(value, fallback, minimum = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (minimum !== null) {
    return Math.max(minimum, parsed);
  }

  return parsed;
}

async function getRuntimeBatchConfig() {
  const config = { ...BATCH_CONFIG };

  try {
    const rows = await db.queryMany(
      "SELECT key, value FROM ai_configs WHERE key IN ('link_verify_batch_size', 'link_verify_batch_threshold', 'link_verify_retry_count', 'link_verify_time_trigger_minutes')"
    );

    for (const row of rows) {
      if (row.key === 'link_verify_batch_size') {
        config.maxBatchSize = readIntegerConfig(row.value, config.maxBatchSize, 1);
      }
      if (row.key === 'link_verify_batch_threshold') {
        config.minBatchSize = readIntegerConfig(row.value, config.minBatchSize, 1);
      }
      if (row.key === 'link_verify_retry_count') {
        config.retryCount = readIntegerConfig(row.value, config.retryCount, 1);
      }
      if (row.key === 'link_verify_time_trigger_minutes') {
        config.timeTriggerMinutes = readIntegerConfig(row.value, config.timeTriggerMinutes, 1);
      }
    }
  } catch (error) {
    logger.warn(`读取连接审核批量配置失败，使用默认值: ${error.message}`);
  }

  config.queueSoftCapacity = Math.max(config.queueSoftCapacity, config.maxBatchSize * 2);
  return config;
}

/**
 * 智能批量检查逻辑
 */
async function shouldProcessBatch() {
  const runtimeConfig = await getRuntimeBatchConfig();
  const now = Date.now();
  const timeSinceLastRun = now - lastRunTime;
  
  // 获取等待中的任务数量
  const waitingJobs = await linkVerifyQueue.getWaitingCount();
  
  // 触发条件 1: 达到最大批量
  if (waitingJobs >= runtimeConfig.maxBatchSize) {
    logger.info(`🚀 触发批量：达到最大批量 (${waitingJobs}/${runtimeConfig.maxBatchSize})`);
    return true;
  }
  
  // 触发条件 2: 时间到期且达到最小批量
  if (timeSinceLastRun >= runtimeConfig.timeTriggerMinutes * 60 * 1000) {
    if (waitingJobs >= runtimeConfig.minBatchSize) {
      logger.info(`⏰ 触发批量：时间到期 (${waitingJobs}/${runtimeConfig.minBatchSize})`);
      return true;
    } else if (waitingJobs > 0) {
      logger.info(`⏰ 触发批量：时间到期（强制，${waitingJobs}个）`);
      return true;
    }
  }
  
  return false;
}

/**
 * 处理批量链接验证
 */
async function processBatch() {
  try {
    const runtimeConfig = await getRuntimeBatchConfig();
    const shouldProcess = await shouldProcessBatch();
    if (!shouldProcess) {
      return;
    }
    
    // 获取等待中的任务
    const waitingJobs = await linkVerifyQueue.getWaiting();
    const batchSize = Math.min(
      waitingJobs.length,
      runtimeConfig.maxBatchSize
    );
    
    logger.info(`📦 开始处理批量链接验证，批次大小：${batchSize}`);
    
    // 批量处理（这里只是标记，实际由 Worker 处理）
    // Worker 会复用浏览器和 IP
    lastRunTime = Date.now();
    processedCount += batchSize;
    
    logger.info(`✅ 批量处理完成，已处理：${processedCount}个链接`);
    
  } catch (error) {
    logger.error('批量处理失败:', error);
  }
}

/**
 * 启动调度器
 */
function startScheduler() {
  if (schedulerRunning) {
    logger.warn('调度器已在运行中');
    return;
  }
  
  schedulerRunning = true;
  logger.info('🚀 链接验证智能调度器已启动');
  getRuntimeBatchConfig().then((runtimeConfig) => {
    logger.info(`配置：最大批量=${runtimeConfig.maxBatchSize}, ` +
                `时间触发=${runtimeConfig.timeTriggerMinutes}分钟，` +
                `最小批量=${runtimeConfig.minBatchSize}`);
  }).catch(() => {});
  
  // 按配置检查
  const checkInterval = setInterval(async () => {
    try {
      await processBatch();
    } catch (error) {
      logger.error('调度器检查失败:', error);
    }
  }, BATCH_CONFIG.schedulerIntervalMs);
  
  // 优雅关闭
  process.on('SIGINT', () => {
    clearInterval(checkInterval);
    schedulerRunning = false;
    logger.info('调度器已停止');
  });
  
  process.on('SIGTERM', () => {
    clearInterval(checkInterval);
    schedulerRunning = false;
    logger.info('调度器已停止');
  });
}

// 消费延迟队列，将到期的任务加入链接验证队列
const delayWorker = new Worker('link-delay-queue', async (job) => {
  const {
    claimId,
    userId,
    taskId,
    links,
    platform,
    taskContext,
    readyAt,
    enqueuedAt,
    batchThreshold,
    maxWaitMinutes,
    submissionVersion
  } = job.data;
  const normalizedSubmissionVersion = normalizeSubmissionVersion(submissionVersion, readyAt || Date.now());
  
  logger.info(`⏱️ 延迟任务到期：claimId=${claimId}, platform=${platform}`);

  const runtimeConfig = await getRuntimeBatchConfig();
  const [waitingCount, activeCount] = await Promise.all([
    linkVerifyQueue.getWaitingCount(),
    linkVerifyQueue.getActiveCount()
  ]);
  const currentDepth = waitingCount + activeCount;

  if (currentDepth >= runtimeConfig.queueSoftCapacity) {
    logger.info(`⏳ 连接审核队列已满，延后重新调度：claimId=${claimId}, depth=${currentDepth}/${runtimeConfig.queueSoftCapacity}`);
    await delayQueue.add('link-delay', {
      ...job.data,
      submissionVersion: normalizedSubmissionVersion,
      retryCount: job.data.retryCount || runtimeConfig.retryCount,
      batchSize: job.data.batchSize || runtimeConfig.maxBatchSize
    }, {
      delay: 60000,
      attempts: Math.max(1, Number(job.data.retryCount || runtimeConfig.retryCount) || 1),
      jobId: `${buildLinkDelayJobId({
        claimId,
        submissionVersion: normalizedSubmissionVersion,
      })}:defer:${Date.now()}`
    });
    return { deferred: true, reason: 'link-verify-queue-full', claimId };
  }
  
  // 添加到链接验证队列
  await linkVerifyQueue.add('link-verify', {
    claimId,
    userId,
    taskId,
    links,
    platform,
    taskContext,
    readyAt: readyAt || Date.now(),
    enqueuedAt: enqueuedAt || Date.now(),
    submissionVersion: normalizedSubmissionVersion,
    batchThreshold,
    maxWaitMinutes,
    batchSize: job.data.batchSize || runtimeConfig.maxBatchSize,
    retryCount: job.data.retryCount || runtimeConfig.retryCount,
    scheduledAt: Date.now()
  }, {
    priority: 10,  // 到期任务优先级较高
    attempts: Math.max(1, Number(job.data.retryCount || runtimeConfig.retryCount) || 1),
    jobId: buildLinkVerifyJobId({
      claimId,
      submissionVersion: normalizedSubmissionVersion,
    })
  });
  
}, {
  connection: redisConnection,
  concurrency: BATCH_CONFIG.delayWorkerConcurrency,
  limiter: {
    max: BATCH_CONFIG.delayWorkerLimiterMax,
    duration: BATCH_CONFIG.delayWorkerLimiterDurationMs
  }
});

delayWorker.on('completed', (job) => {
  logger.info(`✅ 延迟任务处理完成：${job.id}`);
});

delayWorker.on('failed', (job, err) => {
  logger.error(`❌ 延迟任务失败：${job.id}`, err);
});

// 启动调度器
startScheduler();

logger.info(
  `✅ Link Verify Scheduler 已启动: batch=${BATCH_CONFIG.maxBatchSize}, threshold=${BATCH_CONFIG.minBatchSize}, interval=${BATCH_CONFIG.schedulerIntervalMs}ms, queueSoftCapacity=${BATCH_CONFIG.queueSoftCapacity}`
);

export { linkVerifyQueue, delayQueue, PLATFORM_DELAY };
