// PWA 安装功能
import { computed, ref } from 'vue'

// 全局状态
const deferredPrompt = ref(null)
const isInstallable = ref(false)
const isInstalled = ref(false)
const installDismissed = ref(false)

/**
 * 从运行环境同步「是否已像独立 App 一样打开」（主屏图标 / standalone），避免仅依赖一次性的 matchMedia
 */
function syncInstalledFromEnvironment() {
  if (typeof window === 'undefined') return
  let installed = false
  // Capacitor App 视为已安装
  if (window.Capacitor || import.meta.env.VITE_PLATFORM === 'android') installed = true
  // iOS 添加到主屏幕
  if (window.navigator.standalone === true) installed = true
  // 安卓 PWA：检测地址栏不可见（standalone 模式特征）
  if (!installed && window.innerHeight > window.screen.height * 0.9 && !document.referrer) installed = true
  if (!installed) {
    try {
      installed =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches
    } catch (_) {
      /* 忽略 */
    }
  }
  if (installed) {
    isInstalled.value = true
    isInstallable.value = false
    deferredPrompt.value = null
  }
}

// 监听 beforeinstallprompt 事件
if (typeof window !== 'undefined') {
  syncInstalledFromEnvironment()

  window.addEventListener('beforeinstallprompt', (e) => {
    syncInstalledFromEnvironment()
    e.preventDefault()
    // 已通过主屏以独立窗口打开：不记录 deferredPrompt，避免误显安装条
    if (isInstalled.value) return
    deferredPrompt.value = e
    isInstallable.value = true
    console.log('PWA 可安装')
  })

  // 检测是否已安装
  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    isInstallable.value = false
    isInstalled.value = true
    console.log('PWA 已安装')
  })

  // display-mode 可能在首帧后才稳定，监听变化与 bfcache 恢复
  try {
    const mqStandalone = window.matchMedia('(display-mode: standalone)')
    const mqFullscreen = window.matchMedia('(display-mode: fullscreen)')
    mqStandalone.addEventListener('change', syncInstalledFromEnvironment)
    mqFullscreen.addEventListener('change', syncInstalledFromEnvironment)
  } catch (_) {
    /* 忽略 */
  }
  window.addEventListener('pageshow', (e) => {
    syncInstalledFromEnvironment()
    if (e.persisted) syncInstalledFromEnvironment()
  })

  // 部分安卓 WebView 首帧时 display-mode 尚未就绪，延迟再判一次
  queueMicrotask(() => syncInstalledFromEnvironment())
  setTimeout(syncInstalledFromEnvironment, 300)
  setTimeout(syncInstalledFromEnvironment, 1000)
  setTimeout(syncInstalledFromEnvironment, 3000)
}

/**
 * PWA 安装 Hook
 */
export function usePWAInstall() {
  const showInstallBanner = computed(() => {
    if (installDismissed.value || isInstalled.value) return false
    if (isBuiltInBrowser()) return false
    return isInstallable.value || isIOS() || isAndroid()
  })

  const showInstallPrompt = async () => {
    if (!deferredPrompt.value) {
      // iOS Safari 不支持 beforeinstallprompt，显示手动安装提示
      if (isIOS()) {
        alert('请点击浏览器菜单中的"添加到主屏幕"来安装应用')
        return false
      }
      return false
    }

    // 显示安装提示
    deferredPrompt.value.prompt()

    // 等待用户响应
    const { outcome } = await deferredPrompt.value.userChoice
    
    if (outcome === 'accepted') {
      console.log('用户接受安装')
      deferredPrompt.value = null
      isInstallable.value = false
      installDismissed.value = true
      return true
    } else {
      console.log('用户拒绝安装')
      return false
    }
  }

  const dismissInstall = () => {
    installDismissed.value = true
  }

  return {
    isInstallable,
    isInstalled,
    showInstallPrompt,
    showInstallBanner,
    dismissInstall
  }
}

/**
 * 检测是否是 iOS 设备
 */
export function isIOS() {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

/**
 * 检测是否是 Android 设备
 */
export function isAndroid() {
  if (typeof window === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

export function isWeChat() {
  if (typeof window === 'undefined') return false
  return /MicroMessenger/i.test(window.navigator.userAgent)
}

export function isQQBrowser() {
  if (typeof window === 'undefined') return false
  return /QQBrowser/i.test(window.navigator.userAgent)
}

export function isBuiltInBrowser() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent || ''
  return (
    isWeChat() ||
    /QQ\//i.test(ua) ||
    /Weibo/i.test(ua) ||
    /AlipayClient/i.test(ua)
  )
}

export function canNativeInstall() {
  if (typeof window === 'undefined') return false
  if (isInstalled.value || isBuiltInBrowser() || isIOS()) return false
  return Boolean(deferredPrompt.value || isInstallable.value)
}

/**
 * 获取安装提示文案
 */
export function getInstallTip() {
  if (isIOS()) {
    return '点击下方分享按钮，然后选择"添加到主屏幕"'
  }
  if (isBuiltInBrowser()) {
    if (isWeChat()) return '请点击右上角菜单，选择在系统浏览器中打开后再安装'
    if (isQQBrowser()) return '请切换到系统浏览器后再安装'
    return '请在系统浏览器中打开后再安装到桌面'
  }
  if (isAndroid()) {
    return '点击"安装"将应用添加到主屏幕'
  }
  return '将应用添加到桌面，方便随时使用'
}
