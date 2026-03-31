'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { User, login as apiLogin, logout as apiLogout, getStoredUser, getStoredToken, isAdmin } from '@/lib/api'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdminUser: boolean
  login: (username: string, password: string, captcha: { captchaId: string; captchaCode: string }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()
  
  // 初始化时检查登录状态
  useEffect(() => {
    const storedUser = getStoredUser()
    const storedToken = getStoredToken()
    
    if (storedUser && storedToken) {
      setUser(storedUser)
      setToken(storedToken)
    }
    
    setIsLoading(false)
  }, [])
  
  // 登录
  const login = async (
    username: string,
    password: string,
    captcha: { captchaId: string; captchaCode: string }
  ) => {
    const data = await apiLogin(username, password, captcha)
    
    // 检查是否是管理员
    if (data.user.role !== 'admin') {
      apiLogout()
      throw new Error('无权限访问管理后台')
    }
    
    // 保存到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', data.token)
      localStorage.setItem('admin_user', JSON.stringify(data.user))
    }
    
    // 跳转到管理后台首页
    window.location.href = '/admin/'
  }
  
  // 登出
  const logout = () => {
    apiLogout()
    setUser(null)
    setToken(null)
    window.location.href = '/admin/login/'
  }
  
  // 检查是否是登录页 (pathname 不包含 basePath)
  const isLoginPage = pathname === '/login' || pathname === '/login/'
  
  // 检查是否是公开页面
  const publicPages = ['/agreement', '/privacy', '/task-rules']
  const isPublicPage = publicPages.some(p => pathname === p || pathname.startsWith(p + '/'))
  
  // 权限检查 - 只在非登录页和非公开页检查
  useEffect(() => {
    // 跳过登录页和公开页面
    if (isLoginPage || isPublicPage) return
    
    // 等待加载完成
    if (isLoading) return
    
    // 未登录用户跳转到登录页
    if (!user) {
      window.location.href = '/admin/login/'
      return
    }
    
    // 非管理员跳转
    if (!isAdmin(user)) {
      logout()
    }
  }, [isLoading, user, isLoginPage, isPublicPage])
  
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isAdminUser: isAdmin(user),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
