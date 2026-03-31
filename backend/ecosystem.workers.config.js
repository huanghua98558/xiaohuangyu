module.exports = {
  apps: [
    {
      name: 'image-review-worker',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/workers/imageReviewWorker.js',
      instances: 3,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        LOCAL_STORAGE_DIR: '/data/images/uploads',
        OCR_HOMEPAGE_URLS: 'http://127.0.0.1:9001,http://127.0.0.1:9002',
        OCR_COMMENT_URLS: 'http://127.0.0.1:9101,http://127.0.0.1:9102',
        OCR_ALLOW_CROSS_PROFILE_FALLBACK: 'false'
      },
      error_file: '/var/log/xiaohuangyu/image-review-worker-error.log',
      out_file: '/var/log/xiaohuangyu/image-review-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'homepage-ocr-worker',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/workers/homepageOcrWorker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        LOCAL_STORAGE_DIR: '/data/images/uploads',
        OCR_HOMEPAGE_URLS: 'http://127.0.0.1:9001,http://127.0.0.1:9002',
        OCR_COMMENT_URLS: 'http://127.0.0.1:9101,http://127.0.0.1:9102',
        OCR_ALLOW_CROSS_PROFILE_FALLBACK: 'false'
      },
      error_file: '/var/log/xiaohuangyu/homepage-ocr-worker-error.log',
      out_file: '/var/log/xiaohuangyu/homepage-ocr-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'comment-ocr-worker',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/workers/commentOcrWorker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        LOCAL_STORAGE_DIR: '/data/images/uploads',
        OCR_HOMEPAGE_URLS: 'http://127.0.0.1:9001,http://127.0.0.1:9002',
        OCR_COMMENT_URLS: 'http://127.0.0.1:9101,http://127.0.0.1:9102',
        OCR_ALLOW_CROSS_PROFILE_FALLBACK: 'false'
      },
      error_file: '/var/log/xiaohuangyu/comment-ocr-worker-error.log',
      out_file: '/var/log/xiaohuangyu/comment-ocr-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'image-review-merge-worker',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/workers/imageReviewMergeWorker.js',
      instances: 1,
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
        OCR_HOMEPAGE_URLS: 'http://127.0.0.1:9001,http://127.0.0.1:9002',
        OCR_COMMENT_URLS: 'http://127.0.0.1:9101,http://127.0.0.1:9102',
        OCR_ALLOW_CROSS_PROFILE_FALLBACK: 'false'
      },
      error_file: '/var/log/xiaohuangyu/image-review-merge-worker-error.log',
      out_file: '/var/log/xiaohuangyu/image-review-merge-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'link-verify-worker',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/workers/linkVerifyWorker.js',
      instances: 3,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/xiaohuangyu/link-verify-worker-error.log',
      out_file: '/var/log/xiaohuangyu/link-verify-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'link-verify-scheduler',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/workers/linkVerifyScheduler.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '120M',
      restart_delay: 5000,
      max_restarts: 5,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/xiaohuangyu/link-verify-scheduler-error.log',
      out_file: '/var/log/xiaohuangyu/link-verify-scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
}
