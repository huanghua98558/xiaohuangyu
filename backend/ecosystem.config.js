module.exports = {
  apps: [
    {
      name: 'xiaohuangyu-backend',
      script: 'src/app.js',
      interpreter: '/usr/bin/node',
      cwd: '/var/www/xiaohuangyu/backend',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PADDLE_OCR_URL: 'http://localhost:8088',
        PADDLE_OCR_TIMEOUT: '120000',
        PADDLE_OCR_ENABLED: 'true',
        PADDLE_OCR_QUEUE_MODE: 'false'
      },
      error_file: '/var/log/xiaohuangyu/backend-error.log',
      out_file: '/var/log/xiaohuangyu/backend-out.log',
      time: true,
      merge_logs: true
    }
  ]
};
