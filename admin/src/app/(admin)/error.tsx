'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 将错误记录到控制台便于调试
    console.error('页面错误:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">页面出错了</h2>
        <p className="text-gray-500 mb-4">{error.message || '发生了未知错误'}</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => reset()}>重试</Button>
          <Button variant="outline" onClick={() => window.location.href = '/login'}>
            返回登录
          </Button>
        </div>
      </div>
    </div>
  )
}
