import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// 引入样式
import './styles/variables.css'  // 主题变量
import './style.css'              // 全局样式
import './styles/redesign.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

// 初始化主题
import { initTheme } from './composables/useTheme.js'
initTheme()

function shouldRegisterServiceWorker() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (!('serviceWorker' in navigator)) return false

  const ua = navigator.userAgent || ''
  const isWeChat = /MicroMessenger/i.test(ua)
  const isAndroid = /Android/i.test(ua)

  // 安卓微信内置 X5/WebView 对 PWA + SW 兼容性差，容易缓存旧入口导致白屏
  if (isWeChat && isAndroid) return false

  return true
}

if (shouldRegisterServiceWorker()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // 进入前台时向服务器拉取最新 SW，避免长期停留在旧 precache
        const pingUpdate = () => {
          reg.update().catch(() => {})
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') pingUpdate()
        })
        // 新 SW 安装完成后主动刷新一次，加载线上最新静态资源
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload()
            }
          })
        })
      })
      .catch((error) => {
        console.warn('[PWA] service worker register failed:', error)
      })
  })
}
