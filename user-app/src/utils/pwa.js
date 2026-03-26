// PWA 安装功能
import { ref, onMounted, onUnmounted } from 'vue'

// 全局状态
const deferredPrompt = ref(null)
const isInstallable = ref(false)
const isInstalled = ref(false)

// 监听 beforeinstallprompt 事件
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
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

  // 检测是否在 standalone 模式下运行
  if (window.matchMedia('(display-mode: standalone)').matches) {
    isInstalled.value = true
  }

  // iOS Safari 检测
  if (window.navigator.standalone === true) {
    isInstalled.value = true
  }
}

/**
 * PWA 安装 Hook
 */
export function usePWAInstall() {
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
      return true
    } else {
      console.log('用户拒绝安装')
      return false
    }
  }

  return {
    isInstallable,
    isInstalled,
    showInstallPrompt
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

/**
 * 获取安装提示文案
 */
export function getInstallTip() {
  if (isIOS()) {
    return '点击下方分享按钮，然后选择"添加到主屏幕"'
  }
  if (isAndroid()) {
    return '点击"安装"将应用添加到主屏幕'
  }
  return '将应用添加到桌面，方便随时使用'
}
