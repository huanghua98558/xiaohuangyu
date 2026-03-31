import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import path from 'path'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5002,
    allowedHosts: ['www.web3alpha.cn', 'web3alpha.cn'],
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true }
    },
    
  },
  build: {
    target: 'es2015',
    outDir: path.resolve(__dirname, '../backend/public/user'),
    emptyOutDir: true
  },
  esbuild: {
    target: 'es2015'
  },
  plugins: [
    legacy({
      targets: ['defaults', 'Android >= 7', 'iOS >= 12'],
      renderLegacyChunks: true,
      modernPolyfills: true
    }),
    vue(),
    VitePWA({
      manifestFilename: 'manifest.json',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '小黄鱼任务中心',
        short_name: '小黄鱼',
        description: '做任务 · 赚积分 · 兑好礼',
        start_url: '/',
        display: 'standalone',
        background_color: '#1A237E',
        theme_color: '#3f51b5',
        orientation: 'portrait',
        scope: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['utilities', 'finance'],
        shortcuts: [
          {
            name: '任务大厅',
            short_name: '任务',
            url: '/tasks',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          },
          {
            name: '我的任务',
            short_name: '我的',
            url: '/my/tasks',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        // 不把 index.html 打进 precache，避免用户长期命中旧壳；导航走下方 NetworkFirst + navigateFallback 回源
        globIgnores: ['**/index.html'],
        globPatterns: ['**/*.{js,css,png,svg,ico,woff2}'],
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/admin/],
        runtimeCaching: [
          // 页面导航：网络优先，确保以线上最新 index.html / 路由壳为准，缓存仅作短时离线兜底
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-network-first',
              expiration: {
                maxEntries: 40,
                maxAgeSeconds: 60 * 5
              },
              networkTimeoutSeconds: 8
            }
          },
          // API请求 - 网络优先，离线时使用缓存
          {
            urlPattern: /^https?.+\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5分钟
              },
              networkTimeoutSeconds: 10
            }
          },
          // 图片资源 - 缓存优先
          {
            urlPattern: /^https?.+\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7天
              }
            }
          }
        ]
      }
    })
  ]
})
