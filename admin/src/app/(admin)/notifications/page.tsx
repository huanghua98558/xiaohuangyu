'use client'

import { useEffect, useState } from 'react'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

// 通知类型
interface Notification {
  id: number
  type: 'system' | 'task' | 'review' | 'withdrawal' | 'user'
  title: string
  content: string
  isRead: boolean
  createdAt: string
  data?: Record<string, unknown>
}

// 模拟通知数据
const mockNotifications: Notification[] = [
  {
    id: 1,
    type: 'system',
    title: '系统维护通知',
    content: '系统将于今晚 22:00 进行例行维护，预计持续 1 小时。',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 2,
    type: 'task',
    title: '新任务待审核',
    content: '有 15 个新任务提交等待审核，请及时处理。',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 3,
    type: 'withdrawal',
    title: '提现申请待处理',
    content: '有 3 笔提现申请等待审批，总金额 ¥1,500.00。',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 4,
    type: 'user',
    title: '用户投诉',
    content: '用户 user_123 对任务 task_456 提出了投诉，请尽快处理。',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 5,
    type: 'review',
    title: 'AI审核异常',
    content: 'AI审核服务出现异常，已自动切换到人工审核模式。',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
]

const typeConfig = {
  system: { label: '系统', color: 'bg-blue-500' },
  task: { label: '任务', color: 'bg-green-500' },
  review: { label: '审核', color: 'bg-purple-500' },
  withdrawal: { label: '提现', color: 'bg-amber-500' },
  user: { label: '用户', color: 'bg-pink-500' },
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    // 模拟加载
    setTimeout(() => {
      setNotifications(mockNotifications)
      setLoading(false)
    }, 500)
  }, [])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true
    if (filter === 'unread') return !n.isRead
    return n.type === filter
  })

  const handleMarkAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
  }

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  const handleDelete = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 1000 / 60)
    const hours = Math.floor(diff / 1000 / 60 / 60)
    const days = Math.floor(diff / 1000 / 60 / 60 / 24)

    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    return `${days} 天前`
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold tracking-tight">通知中心</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} 条未读</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            全部已读
          </Button>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
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
            <SelectItem value="user">用户通知</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 通知列表 */}
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
          filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={notification.isRead ? 'opacity-60' : 'border-l-4 border-l-primary'}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Badge
                      className={`${typeConfig[notification.type].color} text-white`}
                    >
                      {typeConfig[notification.type].label}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{notification.title}</h3>
                        {!notification.isRead && (
                          <span className="h-2 w-2 bg-primary rounded-full" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMarkAsRead(notification.id)}
                        title="标记已读"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(notification.id)}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
