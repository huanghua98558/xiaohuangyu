'use client'

import { ReactNode, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { prefetchStats, prefetchTasks, prefetchUsers } from '@/lib/swr-hooks'
import { NotificationPopover } from '@/components/notification/NotificationPopover'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CheckSquare,
  Settings,
  Trophy,
  LogOut, LogIn,
  Menu,
  X,
  ChevronRight,
  Wallet,
  FileText,
  Moon,
  History,
  FilePlus,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Briefcase,
  UserCircle,
  Cog,
  Bot,
  Sparkles,
  Monitor,
  Eye,
  Bell,
  Activity,
  Link2,
  AlertTriangle,
} from 'lucide-react'

// 导航分组配置
const navGroups = [
  {
    title: '数据中心',
    icon: BarChart3,
    items: [
      { href: '/data-center', icon: Monitor, label: '指挥中心', prefetch: prefetchStats },
      { href: '/monitor', icon: Activity, label: '系统监控', prefetch: prefetchStats },
      { href: '/exposure', icon: Eye, label: '曝光总览', prefetch: prefetchStats },
      { href: '/', icon: LayoutDashboard, label: '数据看板', prefetch: prefetchStats },
    ]
  },
  {
    title: '发布和审核',
    icon: Bot,
    items: [
      { href: '/ai-assistant', icon: Sparkles, label: 'AI发布助手' },
      { href: '/ai-review-center', icon: CheckSquare, label: 'AI审核中心' },
      { href: '/review', icon: CheckSquare, label: '审核管理', prefetch: prefetchTasks },
      { href: '/review-logs', icon: FileText, label: '审核记录' },
      { href: '/tasks', icon: ClipboardList, label: '任务管理', prefetch: prefetchTasks },
      { href: '/config-center', icon: Settings, label: '配置中心' },
    ]
  },
  {
    title: '用户中心',
    icon: UserCircle,
    items: [
      { href: '/points-rewards', icon: Trophy, label: '积分奖励', prefetch: prefetchStats },
      { href: '/users', icon: Users, label: '用户管理', prefetch: prefetchUsers },
      { href: '/withdrawals', icon: Wallet, label: '提现审核' },
      { href: '/leaderboard', icon: Trophy, label: '排行榜管理' },
    ]
  },
  {
    title: '安全中心',
    icon: Cog,
    items: [
      { href: '/blocked-accounts', icon: AlertTriangle, label: '封控账号管理' },
      { href: '/ip-monitor', icon: Link2, label: 'IP池监控' },
      { href: '/alerts', icon: FileText, label: '告警管理' },
      { href: '/system-logs', icon: History, label: '系统日志', prefetch: prefetchStats },
    ]
  },
  {
    title: '设置',
    icon: Settings,
    items: [
      { href: '/task-claim-config', icon: Settings, label: '任务领取配置' },
      { href: '/night-points', icon: Moon, label: '夜间积分' },
      { href: '/config-center/notifications', icon: Bell, label: '通知设置' },
      { href: '/settings', icon: Cog, label: '系统配置' },
    ]
  },
]

// 获取当前页面标题
function getPageTitle(pathname: string): string {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.href === pathname) {
        return item.label
      }
    }
  }
  return '管理后台'
}

// 导航链接组件
function NavLink({ 
  href, 
  icon: Icon, 
  label, 
  isActive,
  prefetch,
}: { 
  href: string
  icon: React.ElementType
  label: string
  isActive: boolean
  prefetch?: () => Promise<unknown>
}) {
  // 鼠标悬停时预加载数据
  const handleMouseEnter = useCallback(() => {
    if (prefetch && !isActive) {
      prefetch()
    }
  }, [prefetch, isActive])

  return (
    <Link
      href={href}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleMouseEnter}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
      {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
    </Link>
  )
}

// 导航分组组件
function NavGroup({ 
  group, 
  pathname, 
  isExpanded, 
  onToggle,
}: { 
  group: typeof navGroups[0]
  pathname: string
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasActiveItem = group.items.some(item => item.href === pathname)

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors duration-150',
          hasActiveItem 
            ? 'text-primary bg-primary/10' 
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        )}
      >
        <group.icon className="h-4 w-4" />
        <span className="flex-1 text-left">{group.title}</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      
      <div 
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="mt-1 space-y-0.5 py-1">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.href}
              prefetch={item.prefetch}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// 主布局内容
function AdminLayoutContent({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    // 初始化时展开包含当前页面的分组
    const initial: Record<string, boolean> = {}
    navGroups.forEach(group => {
      if (group.items.some(item => item.href === pathname)) {
        initial[group.title] = true
      }
    })
    return initial
  })

  // 切换分组展开状态
  const toggleGroup = useCallback((title: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [title]: !prev[title]
    }))
  }, [])

  // 检查分组是否展开
  const isGroupExpanded = useCallback((title: string) => {
    return expandedGroups[title] ?? false
  }, [expandedGroups])

  // 当路由变化时，展开对应的分组
  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some(item => item.href === pathname)) {
        if (!expandedGroups[group.title]) {
          setExpandedGroups(prev => ({
            ...prev,
            [group.title]: true
          }))
        }
        break
      }
    }
  }, [pathname, expandedGroups])

  // 关闭移动端侧边栏
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-lg mb-4">请先登录</p>
          <Link href="/login">
            <Button>
              <LogIn className="h-4 w-4 mr-2" />
              去登录
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* 侧边栏 */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col',
          'transition-transform duration-300 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐟</span>
            <span className="font-bold text-lg">小黄鱼后台</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* 导航菜单 */}
        <nav className="flex-1 overflow-y-auto p-3">
          {navGroups.map((group) => (
            <NavGroup
              key={group.title}
              group={group}
              pathname={pathname}
              isExpanded={isGroupExpanded(group.title)}
              onToggle={() => toggleGroup(group.title)}
            />
          ))}
        </nav>
        
        {/* 用户信息 */}
        <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{user?.username}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>
      
      {/* 主内容区 */}
      <div className="lg:pl-64">
        {/* 顶部栏 */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-6 sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden mr-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1">
            {getPageTitle(pathname)}
          </h1>
          
          {/* 通知入口 */}
          <NotificationPopover />
        </header>
        
        {/* 页面内容 */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

// 导出包装组件
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutContent>{children}</AdminLayoutContent>
}
