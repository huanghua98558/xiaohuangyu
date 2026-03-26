'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Settings, Palette, TrendingUp
} from 'lucide-react'

const navItems = [
  { href: '/settings', label: '系统配置', icon: Settings, exact: true },
  { href: '/settings/ui-theme', label: '主题设置', icon: Palette },
  { href: '/settings/level-config', label: '等级配置', icon: TrendingUp },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  return (
    <div className="space-y-6">
      {/* 二级导航 */}
      <div className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10 -mx-6 px-6 py-3">
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
