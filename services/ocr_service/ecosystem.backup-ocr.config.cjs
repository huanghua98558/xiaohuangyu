module.exports = {
  apps: [
    {
      name: 'xhy-ocr-comment-1',
      cwd: '/var/www/xiaohuangyu/services/ocr_service',
      script: 'app.py',
      interpreter: 'python3',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '700M',
      restart_delay: 5000,
      max_restarts: 10,
      kill_timeout: 10000,
      env: {
        PORT: '9001',
        OCR_NODE_ID: 'xhy-backup-comment-1',
        OCR_PROFILE: 'comment',
        OCR_ENFORCE_PROFILE: 'true',
        OCR_MAX_CONCURRENT_REQUESTS: '2'
      },
      error_file: '/var/log/xiaohuangyu/xhy-ocr-comment-1-error.log',
      out_file: '/var/log/xiaohuangyu/xhy-ocr-comment-1-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'xhy-ocr-comment-2',
      cwd: '/var/www/xiaohuangyu/services/ocr_service',
      script: 'app.py',
      interpreter: 'python3',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '700M',
      restart_delay: 5000,
      max_restarts: 10,
      kill_timeout: 10000,
      env: {
        PORT: '9002',
        OCR_NODE_ID: 'xhy-backup-comment-2',
        OCR_PROFILE: 'comment',
        OCR_ENFORCE_PROFILE: 'true',
        OCR_MAX_CONCURRENT_REQUESTS: '2'
      },
      error_file: '/var/log/xiaohuangyu/xhy-ocr-comment-2-error.log',
      out_file: '/var/log/xiaohuangyu/xhy-ocr-comment-2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
}
