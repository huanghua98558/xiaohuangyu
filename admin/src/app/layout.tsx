import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: '小黄鱼管理后台',
    template: '%s | 小黄鱼管理后台',
  },
  description: '小黄鱼任务中心管理后台，提供用户管理、任务管理、审核管理等功能',
  keywords: ['小黄鱼', '任务中心', '管理后台'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 修复 Tailwind v4 静态导出时响应式断点媒体查询缺失的问题 */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media (min-width: 1024px) {
            .lg\\:translate-x-0 { transform: translateX(0) !important; }
            .lg\\:pl-72 { padding-left: 18rem !important; }
            .lg\\:hidden { display: none !important; }
            .lg\\:px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
            .lg\\:p-6 { padding: 1.5rem !important; }
          }
        `}} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
