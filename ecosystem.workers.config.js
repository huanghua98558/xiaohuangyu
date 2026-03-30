/**
 * PM2 Worker 进程配置 (优化版)
 */

module.exports = {
  apps: [
    // ========== 图片审核 Worker ==========
    {
      name: 'image-review-worker',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/workers/imageReviewWorker.js',
      instances: 3,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        LOCAL_STORAGE_DIR: '/data/images/uploads',
        IMAGE_REVIEW_POLL_INTERVAL_MS: '1500',
        IMAGE_REVIEW_BATCH_SIZE: '5',
        IMAGE_REVIEW_OCR_TIMEOUT_MS: '10000',
        IMAGE_REVIEW_YOLO_TIMEOUT_MS: '5000'
      },
      error_file: '/var/log/xiaohuangyu/image-review-worker-error.log',
      out_file: '/var/log/xiaohuangyu/image-review-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ========== 链接验证 Worker ==========
    {
      name: 'link-verify-worker',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/workers/linkVerifyWorker.js',
      instances: 3,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        LINK_VERIFY_BROWSER_PORTS: '8000,8001,8002',
        LINK_VERIFY_MAX_IP_RETRIES: '3',
        LINK_VERIFY_WORKER_CONCURRENCY: '4',
        LINK_VERIFY_RATE_LIMIT_MAX: '8',
        LINK_VERIFY_RATE_LIMIT_DURATION_MS: '1000'
      },
      error_file: '/var/log/xiaohuangyu/link-verify-worker-error.log',
      out_file: '/var/log/xiaohuangyu/link-verify-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ========== 链接验证调度器 ==========
    {
      name: 'link-verify-scheduler',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/workers/linkVerifyScheduler.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '100M',
      restart_delay: 5000,
      max_restarts: 5,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        LINK_VERIFY_BATCH_SIZE: '12',
        LINK_VERIFY_BATCH_THRESHOLD: '4',
        LINK_VERIFY_TIME_TRIGGER_MINUTES: '5',
        LINK_VERIFY_QUEUE_SOFT_CAPACITY: '24',
        LINK_VERIFY_DELAY_WORKER_CONCURRENCY: '8',
        LINK_VERIFY_DELAY_RATE_LIMIT_MAX: '16',
        LINK_VERIFY_DELAY_RATE_LIMIT_DURATION_MS: '1000'
      },
      error_file: '/var/log/xiaohuangyu/link-verify-scheduler-error.log',
      out_file: '/var/log/xiaohuangyu/link-verify-scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
