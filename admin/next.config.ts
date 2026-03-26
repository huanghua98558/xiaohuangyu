import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/admin',

  allowedDevOrigins: ['*'],

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },

  async rewrites() {
    const apiUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: apiUrl + '/api/:path*',
      },
    ];
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
};

export default nextConfig;
