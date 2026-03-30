'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Settings, Image as ImageIcon, Bot, MessageSquare, 
  FileText, Activity, Link2
} from 'lucide-react'

const navItems = [
  { href: '/config-center', label: '概览', icon: Settings, exact: true },
  { href: '/config-center/image-review', label: '图片审核', icon: ImageIcon },
  { href: '/config-center/link-review', label: '链接审查', icon: Link2 },
  { href: '/config-center/semantic', label: '语义检测', icon: Bot },
  { href: '/config-center/assistant', label: 'AI发布助手', icon: MessageSquare },
  { href: '/config-center/logs', label: '操作日志', icon: FileText },
  { href: '/config-center/monitor', label: '运行监控', icon: Activity },
]

export default function ConfigCenterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  return (
    <div className="space-y-6">
      {/* 子导航 */}
      <div className="bg-white border-b sticky top-0 z-10 -mx-6 px-6 py-3">
        <nav className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = item.exact 
              ? pathname === item.href 
              : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
      
      {/* 页面内容 */}
      {children}
    </div>
  )
}
