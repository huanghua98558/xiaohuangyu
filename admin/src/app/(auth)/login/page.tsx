'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login, user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  
  // 如果已登录，重定向到首页
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = '/admin/'
    }
  }, [authLoading, user])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      await login(username, password)
      // 登录成功后，login 函数内部会处理跳转
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
      setIsLoading(false)
    }
    // 注意：不在这里设置 setIsLoading(false)，因为跳转后页面会重新加载
  }
  
  // 直接显示登录表单，不显示加载状态
  // 因为登录页面是公开的，用户应该能直接看到登录表单
  // 如果已登录，会在 useEffect 中重定向
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">🐟 小黄鱼管理后台</CardTitle>
          <CardDescription>管理员登录入口</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>测试账号：admin / admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
