'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { fetchAdminLoginCaptcha } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaSvg, setCaptchaSvg] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login, user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    setCaptchaCode('')
    try {
      const data = await fetchAdminLoginCaptcha()
      setCaptchaId(data.captchaId)
      setCaptchaSvg(data.svg)
    } catch (e) {
      setCaptchaId('')
      setCaptchaSvg('')
      setError(e instanceof Error ? e.message : '验证码加载失败')
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCaptcha()
  }, [loadCaptcha])
  
  // 如果已登录，重定向到首页
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = '/admin/'
    }
  }, [authLoading, user])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!captchaId) {
      setError('请先加载验证码')
      await loadCaptcha()
      return
    }
    setIsLoading(true)
    
    try {
      await login(username, password, { captchaId, captchaCode: captchaCode.trim() })
      // 登录成功后，login 函数内部会处理跳转
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
      setIsLoading(false)
      await loadCaptcha()
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
          <CardDescription>管理员登录（需数字图形验证码，非短信）</CardDescription>
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

            <div className="space-y-2">
              <Label htmlFor="captcha">数字验证码</Label>
              <div className="flex gap-2 items-center">
                <div className="rounded border bg-white dark:bg-gray-950 overflow-hidden shrink-0 h-11 w-[120px] flex items-center justify-center">
                  {captchaLoading ? (
                    <span className="text-xs text-muted-foreground">加载中…</span>
                  ) : captchaSvg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg)}`}
                      alt="验证码"
                      className="w-[120px] h-11 object-contain cursor-pointer"
                      onClick={() => loadCaptcha()}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">失败</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-11 w-11"
                  onClick={() => loadCaptcha()}
                  disabled={captchaLoading}
                  aria-label="刷新验证码"
                >
                  <RefreshCw className={`h-4 w-4 ${captchaLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Input
                  id="captcha"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="4位数字"
                  maxLength={4}
                  className="flex-1"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">看不清可点击图片或刷新按钮更换</p>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading || captchaLoading || !captchaId}>
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
