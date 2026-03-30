'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Check, CheckCheck, Filter } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'

interface Notification {
  id: string
  type: string
  title: string
  content: string
  is_read: boolean
  created_at: string
  data?: Record<string, unknown>
}

const typeConfig: Record<string, { label: string; color: string }> = {
  system: { label: '系统', color: 'bg-blue-500' },
  task: { label: '任务', color: 'bg-green-500' },
  review: { label: '审核', color: 'bg-purple-500' },
  withdrawal: { label: '提现', color: 'bg-amber-500' },
  user: { label: '用户', color: 'bg-pink-500' },
  manual_review: { label: '人工', color: 'bg-orange-500' },
}

function getHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 1000 / 60)
  const hours = Math.floor(diff / 1000 / 60 / 60)
  const days = Math.floor(diff / 1000 / 60 / 60 / 24)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  return `${days} 天前`
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/admin/api/admin-v2/admin-notifications?page=1&size=100', {
        headers: getHeaders(),
      })
      const data = await response.json()
      if (data.code === 0) {
        setNotifications(data.data?.list || [])
      } else {
        setNotifications([])
      }
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useAdminWebSocket(['admin_notification'], () => {
    loadNotifications()
  })

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  )

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (filter === 'all') return true
      if (filter === 'unread') return !item.is_read
      return item.type === filter
    })
  }, [filter, notifications])

  const handleMarkAsRead = async (id: string) => {
    await fetch(`/admin/api/admin-v2/admin-notifications/${id}/read`, {
      method: 'POST',
      headers: getHeaders(),
    }).catch(() => null)

    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
    )
  }

  const handleMarkAllAsRead = async () => {
    await fetch('/admin/api/admin-v2/admin-notifications/read-all', {
      method: 'POST',
      headers: getHeaders(),
    }).catch(() => null)

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold tracking-tight">通知中心</h1>
          {unreadCount > 0 && <Badge variant="destructive">{unreadCount} 条未读</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
          <CheckCheck className="h-4 w-4 mr-2" />
          全部已读
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部通知</SelectItem>
            <SelectItem value="unread">未读通知</SelectItem>
            <SelectItem value="system">系统通知</SelectItem>
            <SelectItem value="task">任务通知</SelectItem>
            <SelectItem value="review">审核通知</SelectItem>
            <SelectItem value="withdrawal">提现通知</SelectItem>
            <SelectItem value="manual_review">人工通知</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无通知</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => {
            const config = typeConfig[notification.type] || typeConfig.system
            return (
              <Card
                key={notification.id}
                className={notification.is_read ? 'opacity-70' : 'border-l-4 border-l-primary'}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Badge className={`${config.color} text-white`}>{config.label}</Badge>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{notification.title}</h3>
                          {!notification.is_read && <span className="h-2 w-2 bg-primary rounded-full" />}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notification.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">{formatTime(notification.created_at)}</p>
                      </div>
                    </div>
                    {!notification.is_read && (
                      <Button variant="ghost" size="icon" onClick={() => handleMarkAsRead(notification.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
