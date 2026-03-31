'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Settings, Image as ImageIcon, Bot, MessageSquare, FileText, Activity,
  CheckCircle, XCircle, Clock, RefreshCw, ChevronRight, Zap, 
  TrendingUp, AlertTriangle, Eye, Link2, Cpu, Database, Users,
  ClipboardList, Trophy
} from 'lucide-react'
import { toast } from 'sonner'

// 系统统计数据类型
interface SystemStats {
  totalUsers: number
  totalTasks: number
  totalClaims: number
  todayPublishedTasks: number
  todayClaims: number
  todayCompletedClaims: number
  pendingClaims: number
  onlineUsers: number
}

// 队列统计类型
interface QueueStats {
  pending: number
  imageReviewing: number
  linkReviewing: number
  manual: number
  aiApproved: number
  aiRejected: number
  approved: number
  rejected: number
  todayApproved: number
  todayRejected: number
  todayReviewed: number
}

// 系统状态类型
interface SystemStatus {
  redis: boolean
  database: boolean
  workers: { name: string; status: string }[]
}

export default function ConfigCenterPage() {
  const [loading, setLoading] = useState(true)
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    totalTasks: 0,
    totalClaims: 0,
    todayPublishedTasks: 0,
    todayClaims: 0,
    todayCompletedClaims: 0,
    pendingClaims: 0,
    onlineUsers: 0
  })
  const [queueStats, setQueueStats] = useState<QueueStats>({ 
    pending: 0, 
    imageReviewing: 0, 
    linkReviewing: 0, 
    manual: 0, 
    aiApproved: 0, 
    aiRejected: 0,
    approved: 0,
    rejected: 0,
    todayApproved: 0,
    todayRejected: 0,
    todayReviewed: 0
  })
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ redis: false, database: false, workers: [] })

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    return { 'Authorization': `Bearer ${token}` }
  }

  const loadData = async () => {
    try {
      const headers = getAuthHeaders()
      
      // 并行加载多个数据
      const [statsRes, queueRes] = await Promise.all([
        fetch('/admin/api/admin-v2/stats', { headers }).catch(() => null),
        fetch('/admin/api/ai/reviewer/stats', { headers }).catch(() => null)
      ])
      
      if (statsRes) {
        const data = await statsRes.json()
        if (data.code === 0 || data.code === 200) {
          setSystemStats({
            totalUsers: data.data?.totalUsers || 0,
            totalTasks: data.data?.totalTasks || 0,
            totalClaims: data.data?.totalClaims || 0,
            todayPublishedTasks: data.data?.todayPublishedTasks || 0,
            todayClaims: data.data?.todayClaims || 0,
            todayCompletedClaims: data.data?.todayCompletedClaims || 0,
            pendingClaims: data.data?.pendingClaims || 0,
            onlineUsers: data.data?.onlineUsers || 0
          })
        }
      }
      
      if (queueRes) {
        const data = await queueRes.json()
        if (data.code === 200) {
          setQueueStats(data.data || queueStats)
        }
      }
      
      // 模拟系统状态（实际应该从后端获取）
      setSystemStatus({
        redis: true,
        database: true,
        workers: [
          { name: 'image-review-worker', status: 'online' },
          { name: 'link-verify-worker', status: 'online' }
        ]
      })
      
    } catch (e) {
      console.error('加载数据失败:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // 每30秒刷新一次
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  // 快捷入口配置
  const quickLinks = [
    { 
      href: '/admin/config-center/image-review', 
      icon: ImageIcon, 
      title: '图片审核设置',
      desc: '配置OCR、YOLO检测项和阈值',
      color: 'text-blue-500'
    },
    { 
      href: '/admin/config-center/semantic', 
      icon: Bot, 
      title: '语义检测设置',
      desc: '配置AI模型和语义识别规则',
      color: 'text-purple-500'
    },
    { 
      href: '/admin/config-center/assistant', 
      icon: MessageSquare, 
      title: 'AI发布助手',
      desc: '配置任务模板和默认说明',
      color: 'text-green-500'
    },
    { 
      href: '/admin/config-center/logs', 
      icon: FileText, 
      title: '操作日志',
      desc: '查看配置变更和审核记录',
      color: 'text-orange-500'
    },
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">配置中心</h1>
          <p className="text-muted-foreground mt-1">审核系统配置和监控</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 监控面板 - 第一排：审核队列 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">待审核</p>
                <p className="text-2xl font-bold">{queueStats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">图片处理中</p>
                <p className="text-2xl font-bold">{queueStats.imageReviewing}</p>
              </div>
              <ImageIcon className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">链接验证中</p>
                <p className="text-2xl font-bold">{queueStats.linkReviewing}</p>
              </div>
              <Link2 className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">人工审核</p>
                <p className="text-2xl font-bold">{queueStats.manual}</p>
              </div>
              <Eye className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 监控面板 - 第二排：今日统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日发布任务</p>
                <p className="text-2xl font-bold">{systemStats.todayPublishedTasks}</p>
              </div>
              <ClipboardList className="w-8 h-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日认领</p>
                <p className="text-2xl font-bold">{systemStats.todayClaims}</p>
              </div>
              <Trophy className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日审核通过</p>
                <p className="text-2xl font-bold text-green-600">{queueStats.todayApproved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日审核拒绝</p>
                <p className="text-2xl font-bold text-red-600">{queueStats.todayRejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 监控面板 - 第三排：系统总量 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总用户数</p>
                <p className="text-2xl font-bold">{systemStats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总任务数</p>
                <p className="text-2xl font-bold">{systemStats.totalTasks}</p>
              </div>
              <ClipboardList className="w-8 h-8 text-teal-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总认领数</p>
                <p className="text-2xl font-bold">{systemStats.totalClaims}</p>
              </div>
              <Trophy className="w-8 h-8 text-pink-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI自动通过</p>
                <p className="text-2xl font-bold text-blue-600">{queueStats.aiApproved}</p>
              </div>
              <Zap className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 审核统计进度 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">今日审核统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>审核通过率</span>
                <span className="font-medium">
                  {queueStats.todayReviewed > 0 
                    ? ((queueStats.todayApproved / queueStats.todayReviewed) * 100).toFixed(1) 
                    : '0.0'}%
                </span>
              </div>
              <Progress 
                value={queueStats.todayReviewed > 0 
                  ? (queueStats.todayApproved / queueStats.todayReviewed) * 100 
                  : 0} 
              />
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>通过: {queueStats.todayApproved}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>拒绝: {queueStats.todayRejected}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>待处理: {queueStats.pending}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">系统状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${systemStatus.database ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">数据库</span>
              {systemStatus.database ? (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">正常</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">异常</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${systemStatus.redis ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">Redis</span>
              {systemStatus.redis ? (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">正常</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">异常</Badge>
              )}
            </div>
            
            {systemStatus.workers.map((worker) => (
              <div key={worker.name} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${worker.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{worker.name}</span>
                <Badge variant="secondary" className={`text-xs ${worker.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {worker.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 快捷入口 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">快捷设置</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.href} href={link.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-muted ${link.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">{link.title}</h3>
                          <p className="text-sm text-muted-foreground">{link.desc}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
