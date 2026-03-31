module.exports = {
  apps: [
    {
      name: 'ocr-comment-tunnel-1',
      script: '/usr/bin/ssh',
      args: [
        '-N',
        '-i', '/home/ubuntu/.ssh/ocr_spare_ed25519',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ServerAliveCountMax=3',
        '-o', 'ExitOnForwardFailure=yes',
        '-L', '127.0.0.1:9101:127.0.0.1:9001',
        'ubuntu@10.5.0.10'
      ],
      autorestart: true,
      watch: false,
      max_restarts: 20
    },
    {
      name: 'ocr-comment-tunnel-2',
      script: '/usr/bin/ssh',
      args: [
        '-N',
        '-i', '/home/ubuntu/.ssh/ocr_spare_ed25519',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ServerAliveCountMax=3',
        '-o', 'ExitOnForwardFailure=yes',
        '-L', '127.0.0.1:9102:127.0.0.1:9002',
        'ubuntu@10.5.0.10'
      ],
      autorestart: true,
      watch: false,
      max_restarts: 20
    }
  ]
}
