import { getOcrServicePools } from '../../utils/ocrServicePools.js';

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

function createServiceHealthState(entry) {
  return {
    ...entry,
    healthy: true,
    lastCheck: 0,
    failCount: 0,
    lastFailureAt: 0,
    lastSuccessAt: 0,
    quarantineUntil: 0,
    restarting: false,
    lastRestartAt: 0,
    restartCount: 0,
  };
}

const OCR_SERVICE_POOLS = getOcrServicePools();
const OCR_ALLOW_CROSS_PROFILE_FALLBACK =
  String(process.env.OCR_ALLOW_CROSS_PROFILE_FALLBACK || 'false').toLowerCase() === 'true';

const LOCAL_OCR_PROCESS_BY_URL = {
  'http://127.0.0.1:9001': 'xhy-ocr-homepage-1',
  'http://127.0.0.1:9002': 'xhy-ocr-homepage-2',
};

const OCR_SERVICES_CONFIG = (OCR_SERVICE_POOLS.entries?.all || []).map(createServiceHealthState);

const YOLO_SERVICE_CONFIG = createServiceHealthState({
  url: 'http://127.0.0.1:8003',
});

const IMAGE_WORKER_CONFIG = {
  pollIntervalMs: readIntegerConfig(process.env.IMAGE_REVIEW_POLL_INTERVAL_MS, 3000, 500),
  batchSize: readIntegerConfig(process.env.IMAGE_REVIEW_BATCH_SIZE, 5, 1),
  ocrTimeoutMs: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_TIMEOUT_MS, 10000, 1000),
  yoloTimeoutMs: readIntegerConfig(process.env.IMAGE_REVIEW_YOLO_TIMEOUT_MS, 5000, 1000),
  healthTimeoutMs: readIntegerConfig(process.env.IMAGE_REVIEW_HEALTH_TIMEOUT_MS, 3000, 500),
};

const TIMEOUTS = {
  OCR: IMAGE_WORKER_CONFIG.ocrTimeoutMs,
  YOLO: IMAGE_WORKER_CONFIG.yoloTimeoutMs,
  HEALTH_CHECK: IMAGE_WORKER_CONFIG.healthTimeoutMs,
};

const HEALTH_CONFIG = {
  CHECK_INTERVAL: readIntegerConfig(process.env.IMAGE_REVIEW_HEALTH_CHECK_INTERVAL_MS, 10000, 1000),
  FAIL_THRESHOLD: 3,
  RECOVERY_THRESHOLD: 1,
  QUARANTINE_MS: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_QUARANTINE_MS, 90000, 5000),
  RESTART_COOLDOWN_MS: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_RESTART_COOLDOWN_MS, 180000, 10000),
  PM2_RESTART_TIMEOUT_MS: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_PM2_RESTART_TIMEOUT_MS, 15000, 2000),
};

const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || '/data/images/uploads';

const REDIS_KEYS = {
  OCR_INDEX_HOMEPAGE: 'image:worker:ocr:index:homepage',
  OCR_INDEX_COMMENT: 'image:worker:ocr:index:comment',
  HEALTH_STATUS: 'image:worker:health:status',
  OCR_RESTART_LOCK_PREFIX: 'image:worker:ocr:restart:lock:',
};

const POLL_INTERVAL = IMAGE_WORKER_CONFIG.pollIntervalMs;
const BATCH_SIZE = IMAGE_WORKER_CONFIG.batchSize;

export {
  BATCH_SIZE,
  HEALTH_CONFIG,
  IMAGE_WORKER_CONFIG,
  LOCAL_OCR_PROCESS_BY_URL,
  LOCAL_STORAGE_DIR,
  OCR_ALLOW_CROSS_PROFILE_FALLBACK,
  OCR_SERVICE_POOLS,
  OCR_SERVICES_CONFIG,
  POLL_INTERVAL,
  REDIS_KEYS,
  TIMEOUTS,
  YOLO_SERVICE_CONFIG,
};

