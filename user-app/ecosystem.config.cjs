module.exports = {
  apps: [{
    name: 'xiaohuangyu-user-app',
    cwd: '/var/www/xiaohuangyu/user-app',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 5002
    },
    error_file: '/var/log/xiaohuangyu/user-app-error.log',
    out_file: '/var/log/xiaohuangyu/user-app-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
