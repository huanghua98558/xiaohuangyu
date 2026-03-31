/**
 * PM2 主服务配置
 * 
 * 优化说明：
 * - 添加 restart_delay 防止快速重启
 * - 添加 exp_backoff_restart_delay 指数退避
 * - 添加 kill_timeout 确保进程正常退出
 * - 使用 max_restarts 限制重启次数
 */

module.exports = {
  apps: [
    // ========== 后端服务 (Cluster 模式) ==========
    {
      name: 'xiaohuangyu-backend',
      cwd: '/var/www/xiaohuangyu/backend',
      script: 'src/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      // 重启策略优化
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PADDLE_OCR_URL: 'http://localhost:9001',
        PADDLE_OCR_ENABLED: 'true',
        PADDLE_OCR_TIMEOUT: '120000',
        PORT: 5000
      },
      error_file: '/var/log/xiaohuangyu/backend-error.log',
      out_file: '/var/log/xiaohuangyu/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ========== 管理后台 Next.js（源码在服务器构建：admin 目录 pnpm build 后由本进程托管）==========
    {
      name: 'xiaohuangyu-admin',
      cwd: '/var/www/xiaohuangyu/admin',
      script: 'scripts/start.sh',
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '900M',
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        BACKEND_URL: 'http://127.0.0.1:5000',
        DEPLOY_RUN_PORT: '5001'
      },
      error_file: '/var/log/xiaohuangyu/admin-error.log',
      out_file: '/var/log/xiaohuangyu/admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ========== Xvfb 虚拟显示服务 (必须先启动) ==========
    {
      name: 'xvfb-display',
      cwd: '/var/www/xiaohuangyu',
      script: '/usr/bin/Xvfb',
      args: ':99 -screen 0 1920x1080x24 -ac',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      restart_delay: 5000,
      max_restarts: 5,
      env: {},
      error_file: '/var/log/xiaohuangyu/xvfb-error.log',
      out_file: '/var/log/xiaohuangyu/xvfb-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

    // ========== 浏览器服务实例 1-3 (有头模式) ==========
    {
      name: 'browser-service-1',
      cwd: '/var/www/xiaohuangyu/services/browser_service',
      script: 'app.py',
      interpreter: 'python3',
      args: '8000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // 重启策略优化
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      max_restarts: 5,
      kill_timeout: 10000,
      env: {
        DISPLAY: ':99',
        QT_QPA_PLATFORM: 'offscreen',
        BACKEND_URL: 'http://127.0.0.1:5000',
        BROWSER_POOL_MIN_PAGES: '2',
        BROWSER_POOL_NORMAL_PAGES: '4',
        BROWSER_POOL_MAX_PAGES: '8',
        BROWSER_POOL_SCALE_UP_THRESHOLD: '8',
        BROWSER_POOL_SCALE_DOWN_THRESHOLD: '2',
        BROWSER_POOL_SCALE_DOWN_DELAY_SECONDS: '60',
        BROWSER_POOL_WAIT_TIMEOUT_MS: '6000',
        BROWSER_POOL_WAIT_POLL_MS: '200',
        BROWSER_POOL_MAX_REQUESTS: '300',
        BROWSER_POOL_MAX_AGE_MINUTES: '45',
        BROWSER_PAGE_MAX_REQUESTS: '60',
        BROWSER_PAGE_MAX_AGE_MINUTES: '15'
      },
      error_file: '/var/log/xiaohuangyu/browser-1-error.log',
      out_file: '/var/log/xiaohuangyu/browser-1-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'browser-service-2',
      cwd: '/var/www/xiaohuangyu/services/browser_service',
      script: 'app.py',
      interpreter: 'python3',
      args: '8001',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      max_restarts: 5,
      kill_timeout: 10000,
      env: {
        DISPLAY: ':99',
        QT_QPA_PLATFORM: 'offscreen',
        BACKEND_URL: 'http://127.0.0.1:5000',
        BROWSER_POOL_MIN_PAGES: '2',
        BROWSER_POOL_NORMAL_PAGES: '4',
        BROWSER_POOL_MAX_PAGES: '8',
        BROWSER_POOL_SCALE_UP_THRESHOLD: '8',
        BROWSER_POOL_SCALE_DOWN_THRESHOLD: '2',
        BROWSER_POOL_SCALE_DOWN_DELAY_SECONDS: '60',
        BROWSER_POOL_WAIT_TIMEOUT_MS: '6000',
        BROWSER_POOL_WAIT_POLL_MS: '200',
        BROWSER_POOL_MAX_REQUESTS: '300',
        BROWSER_POOL_MAX_AGE_MINUTES: '45',
        BROWSER_PAGE_MAX_REQUESTS: '60',
        BROWSER_PAGE_MAX_AGE_MINUTES: '15'
      },
      error_file: '/var/log/xiaohuangyu/browser-2-error.log',
      out_file: '/var/log/xiaohuangyu/browser-2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'browser-service-3',
      cwd: '/var/www/xiaohuangyu/services/browser_service',
      script: 'app.py',
      interpreter: 'python3',
      args: '8002',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      max_restarts: 5,
      kill_timeout: 10000,
      env: {
        DISPLAY: ':99',
        QT_QPA_PLATFORM: 'offscreen',
        BACKEND_URL: 'http://127.0.0.1:5000',
        BROWSER_POOL_MIN_PAGES: '2',
        BROWSER_POOL_NORMAL_PAGES: '4',
        BROWSER_POOL_MAX_PAGES: '8',
        BROWSER_POOL_SCALE_UP_THRESHOLD: '8',
        BROWSER_POOL_SCALE_DOWN_THRESHOLD: '2',
        BROWSER_POOL_SCALE_DOWN_DELAY_SECONDS: '60',
        BROWSER_POOL_WAIT_TIMEOUT_MS: '6000',
        BROWSER_POOL_WAIT_POLL_MS: '200',
        BROWSER_POOL_MAX_REQUESTS: '300',
        BROWSER_POOL_MAX_AGE_MINUTES: '45',
        BROWSER_PAGE_MAX_REQUESTS: '60',
        BROWSER_PAGE_MAX_AGE_MINUTES: '15'
      },
      error_file: '/var/log/xiaohuangyu/browser-3-error.log',
      out_file: '/var/log/xiaohuangyu/browser-3-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
