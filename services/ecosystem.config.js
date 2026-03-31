module.exports = {
  apps: [
    {
      name: 'ocr-service-1',
      cwd: '/var/www/xiaohuangyu/services/ocr_service',
      script: 'app.py',
      interpreter: 'python3',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 8001
      }
    },
    {
      name: 'ocr-service-2',
      cwd: '/var/www/xiaohuangyu/services/ocr_service',
      script: 'app.py',
      interpreter: 'python3',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 8002
      }
    },
    {
      name: 'yolo-service',
      cwd: '/var/www/xiaohuangyu/services/yolo_service',
      script: 'app.py',
      interpreter: 'python3',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 8003
      }
    },
    {
      name: 'browser-service',
      cwd: '/var/www/xiaohuangyu/services/browser_service',
      script: 'app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
