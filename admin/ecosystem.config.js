module.exports = {
  apps: [{
    name: 'xiaohuangyu-admin',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 5001',
    cwd: '/var/www/xiaohuangyu/admin',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      HOSTNAME: '0.0.0.0',
      PORT: '5001'
    },
    max_memory_restart: '500M',
    error_file: '/var/log/xiaohuangyu/admin-error.log',
    out_file: '/var/log/xiaohuangyu/admin-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    autorestart: true,
    watch: false
  }]
};
