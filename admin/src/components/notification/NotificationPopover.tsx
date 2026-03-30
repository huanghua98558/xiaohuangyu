'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import {
  Bell,
  Check,
  CheckCheck,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { playAdminNotificationSound, registerAdminNotificationSoundUnlock } from '@/lib/notification-sound'
import { getAdminNotificationHref } from '@/lib/notification-target'

interface Notification {
  id: number
  type: string
  title: string
  content: string
  is_read: boolean
  created_at: string
  data?: Record<string, unknown>
}

interface NotificationResponse {
  list: Notification[]
  total: number
  unreadCount: number
}

function getAdminAuthHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
  }
}

// 类型配置
const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  system: { icon: Info, color: 'text-blue-500' },
  task: { icon: CheckCircle, color: 'text-green-500' },
  review: { icon: AlertCircle, color: 'text-purple-500' },
  manual_review: { icon: AlertTriangle, color: 'text-orange-500' },
  withdrawal: { icon: AlertTriangle, color: 'text-amber-500' },
  user: { icon: Info, color: 'text-pink-500' },
  alert: { icon: AlertCircle, color: 'text-red-500' },
}

// 格式化时间（修复时区问题）
function formatTime(dateStr: string): string {
  // 处理 ISO 时间字符串，确保正确解析 UTC 时间
  let date: Date;
  if (dateStr.endsWith('Z')) {
    // 已经是 UTC 时间，直接解析
    date = new Date(dateStr);
  } else {
    // 假设是 UTC 时间，添加 Z 后缀
    date = new Date(dateStr + 'Z');
  }
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // 如果 diff 为负数，说明时间在未来，显示刚刚
  if (diff < 0) return '刚刚';
  
  const minutes = Math.floor(diff / 1000 / 60);
  const hours = Math.floor(diff / 1000 / 60 / 60);
  const days = Math.floor(diff / 1000 / 60 / 60 / 24);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return `${days}天前`;
}

export function NotificationPopover() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  // 获取未读数
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/admin/api/admin-v2/admin-notifications/unread-count', {
        headers: getAdminAuthHeaders(),
      })
      const data = await res.json()
      if (data.code === 0) {
        setUnreadCount(Number(data.data?.count || 0))
      }
    } catch (e) {
      console.warn('获取未读数失败', e)
    }
  }, [])

  useAdminWebSocket(['admin_notification'], () => {
    playAdminNotificationSound('notification').catch(() => null)
    fetchUnreadCount()
    if (open) fetchNotifications()
  })

  // 获取通知列表
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/admin/api/admin-v2/admin-notifications?page=1&size=10', {
        headers: getAdminAuthHeaders(),
      })
      const data = await res.json()
      if (data.code === 0) {
        setNotifications(data.data?.list || [])
        setUnreadCount(Number(data.data?.unreadCount || 0))
      }
    } catch (e) {
      console.warn('获取通知列表失败', e)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 标记已读
  const markAsRead = async (id: number) => {
    try {
      await fetch(`/admin/api/admin-v2/admin-notifications/${id}/read`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
      })
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) {
      // 本地更新
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  const openNotification = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }

    const target = getAdminNotificationHref(notification)
    if (target) {
      window.location.href = target
    }
  }

  // 全部已读
  const markAllAsRead = async () => {
    try {
      await fetch('/admin/api/admin-v2/admin-notifications/read-all', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (e) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    }
  }

  // 初始化和定时刷新
  useEffect(() => {
    registerAdminNotificationSoundUnlock()
    fetchUnreadCount()
    // 每30秒刷新未读数
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // 打开时加载通知
  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open, fetchNotifications])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">通知中心</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs h-7"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                全部已读
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-80">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无通知</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type] || typeConfig.system
                const Icon = config.icon
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-3 cursor-pointer hover:bg-muted/50 transition-colors',
                      !notification.is_read && 'bg-blue-50/50 dark:bg-blue-950/20'
                    )}
                    onClick={() => openNotification(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('mt-0.5', config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-sm font-medium truncate',
                            !notification.is_read && 'text-primary'
                          )}>
                            {notification.title}
                          </span>
                          {!notification.is_read && (
                            <span className="h-2 w-2 bg-red-500 rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.content}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false)
              window.location.href = '/admin/notifications'
            }}
          >
            查看全部通知
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
