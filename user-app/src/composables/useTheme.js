/**
 * 主题切换组合式函数
 * 支持5套主题：professional / glassmorphism / dark-tech / soft-cure / minimal
 */
import { ref, watch, onMounted } from 'vue'

// 主题配置
export const THEMES = {
  professional: {
    id: 'professional',
    name: '专业蓝',
    description: '高效、信任、专业',
    icon: '💼',
    preview: {
      primary: '#2563EB',
      bg: '#F8FAFC'
    }
  },
  glassmorphism: {
    id: 'glassmorphism',
    name: '玻璃拟态',
    description: '现代、透明、层次感',
    icon: '🔮',
    preview: {
      primary: '#818CF8',
      bg: 'linear-gradient(135deg, #667EEA, #764BA2)'
    }
  },
  'dark-tech': {
    id: 'dark-tech',
    name: '暗黑科技',
    description: '酷炫、科技感、沉浸式',
    icon: '🌙',
    preview: {
      primary: '#00FFFF',
      bg: '#000000'
    }
  },
  'soft-cure': {
    id: 'soft-cure',
    name: '柔和治愈',
    description: '舒适、友好、无压力',
    icon: '🌸',
    preview: {
      primary: '#87CEEB',
      bg: '#FAFAFA'
    }
  },
  minimal: {
    id: 'minimal',
    name: '极简扁平',
    description: '快速、清晰、无干扰',
    icon: '⚡',
    preview: {
      primary: '#1E293B',
      bg: '#FFFFFF'
    }
  }
}

// 当前主题
const currentTheme = ref('professional')

// 本地存储键名
const THEME_STORAGE_KEY = 'xiaohuangyu_theme'

/**
 * 获取主题列表
 */
export function getThemeList() {
  return Object.values(THEMES)
}

/**
 * 获取当前主题
 */
export function getCurrentTheme() {
  return currentTheme.value
}

/**
 * 获取当前主题配置
 */
export function getCurrentThemeConfig() {
  return THEMES[currentTheme.value] || THEMES.professional
}

/**
 * 设置主题
 */
export function setTheme(themeId) {
  if (!THEMES[themeId]) {
    console.warn(`[Theme] Unknown theme: ${themeId}, fallback to professional`)
    themeId = 'professional'
  }
  
  currentTheme.value = themeId
  document.documentElement.setAttribute('data-theme', themeId)
  
  // 保存到本地存储
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId)
  } catch (e) {
    console.warn('[Theme] Failed to save theme to localStorage', e)
  }
  
  console.log(`[Theme] Theme changed to: ${themeId}`)
}

/**
 * 初始化主题（从本地存储或API加载）
 */
export async function initTheme() {
  let themeId = 'professional'
  
  // 1. 尝试从本地存储读取
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (savedTheme && THEMES[savedTheme]) {
      themeId = savedTheme
    }
  } catch (e) {
    console.warn('[Theme] Failed to read theme from localStorage', e)
  }
  
  // 2. 尝试从后端获取用户偏好（可选，需要登录）
  try {
    const token = localStorage.getItem('token')
    if (token) {
      const response = await fetch('/api/settings/theme', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        if (data.code === 0 && data.data && THEMES[data.data.theme]) {
          themeId = data.data.theme
        }
      }
    }
  } catch (e) {
    // 忽略错误，使用本地存储的主题
  }
  
  // 3. 应用主题
  setTheme(themeId)
}

/**
 * 保存主题到后端
 */
export async function saveThemeToBackend(themeId) {
  try {
    const token = localStorage.getItem('token')
    if (!token) {
      console.log('[Theme] User not logged in, skip saving to backend')
      return
    }
    
    const response = await fetch('/api/settings/theme', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ theme: themeId })
    })
    
    if (response.ok) {
      console.log(`[Theme] Theme saved to backend: ${themeId}`)
    }
  } catch (e) {
    console.warn('[Theme] Failed to save theme to backend', e)
  }
}

/**
 * 主题切换组合式函数
 */
export function useTheme() {
  onMounted(() => {
    initTheme()
  })
  
  // 监听主题变化
  watch(currentTheme, (newTheme) => {
    saveThemeToBackend(newTheme)
  })
  
  return {
    currentTheme,
    themes: THEMES,
    themeList: getThemeList(),
    setTheme,
    initTheme,
    getCurrentThemeConfig
  }
}

// 默认导出
export default useTheme
