'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

// 主题配置 - 使用标准CSS颜色格式
const THEMES = {
  professional: {
    name: '专业蓝',
    primary: '#2563EB',
    primaryForeground: '#ffffff',
    accent: '#dbeafe',
    ring: '#2563EB',
  },
  glassmorphism: {
    name: '玻璃拟态',
    primary: '#818CF8',
    primaryForeground: '#ffffff',
    accent: '#ede9fe',
    ring: '#818CF8',
  },
  'dark-tech': {
    name: '暗黑科技',
    primary: '#00FFFF',
    primaryForeground: '#000000',
    accent: '#0d3d3d',
    ring: '#00FFFF',
  },
  'soft-cure': {
    name: '柔和治愈',
    primary: '#87CEEB',
    primaryForeground: '#1e3a5f',
    accent: '#e0f2fe',
    ring: '#87CEEB',
  },
  minimal: {
    name: '极简扁平',
    primary: '#374151',
    primaryForeground: '#ffffff',
    accent: '#f3f4f6',
    ring: '#374151',
  },
}

type ThemeId = keyof typeof THEMES

interface ThemeContextType {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'minimal',
  setTheme: () => {},
  isLoading: true,
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('minimal' as ThemeId)
  const [isLoading, setIsLoading] = useState(true)

  // 应用主题到CSS变量
  const applyTheme = useCallback((themeId: ThemeId) => {
    const themeConfig = THEMES[themeId]
    if (!themeConfig) return

    const root = document.documentElement
    
    root.style.setProperty('--primary', themeConfig.primary)
    root.style.setProperty('--primary-foreground', themeConfig.primaryForeground)
    root.style.setProperty('--accent', themeConfig.accent)
    root.style.setProperty('--ring', themeConfig.ring)
    
    root.style.setProperty('--color-primary', themeConfig.primary)
    root.style.setProperty('--color-primary-foreground', themeConfig.primaryForeground)
    root.style.setProperty('--color-accent', themeConfig.accent)
    root.style.setProperty('--color-ring', themeConfig.ring)
    
    root.style.setProperty('--sidebar-primary', themeConfig.primary)
    root.style.setProperty('--sidebar-primary-foreground', themeConfig.primaryForeground)
    root.style.setProperty('--sidebar-accent', themeConfig.accent)
    root.style.setProperty('--color-sidebar-primary', themeConfig.primary)
    root.style.setProperty('--color-sidebar-primary-foreground', themeConfig.primaryForeground)
    root.style.setProperty('--color-sidebar-accent', themeConfig.accent)
    
    console.log('[Theme] Applied theme:', themeId, themeConfig)
  }, [])

  // 设置主题 - 使用useCallback稳定函数引用
  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    localStorage.setItem('admin_theme', newTheme)
  }, [applyTheme])

  // 初始化加载主题
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = localStorage.getItem('admin_theme') as ThemeId
        if (savedTheme && THEMES[savedTheme]) {
          setThemeState(savedTheme)
          applyTheme(savedTheme)
          setIsLoading(false)
          return
        }

        const token = localStorage.getItem('admin_token')
        if (token) {
          const response = await fetch('/admin/api/admin-v2/ui-theme', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (response.ok) {
            const data = await response.json()
            if (data.code === 0 && data.data?.adminTheme) {
              const apiTheme = data.data.adminTheme as ThemeId
              if (THEMES[apiTheme]) {
                setThemeState(apiTheme)
                applyTheme(apiTheme)
                localStorage.setItem('admin_theme', apiTheme)
              }
            }
          }
        }
      } catch (err) {
        console.error('加载主题失败:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadTheme()
  }, [applyTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  )
}

export { THEMES }
export type { ThemeId }
