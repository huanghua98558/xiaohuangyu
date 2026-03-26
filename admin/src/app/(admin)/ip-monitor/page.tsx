'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Network,
  Globe,
  RefreshCw,
  Server,
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  ListOrdered,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface IPStatus {
  mode: string
  available: number
  directFailCount: number
  lastDirectSuccess: string | null
  cooldownRemaining: number
  stats: {
    totalIPs: number
    usedIPs: number
    modeSwitches: number
    captchaHits: number
  }
}

interface BrowserService {
  port: number
  status: string
  version?: string
  healthy: boolean
  error?: string
}

interface QueueItem {
  name: string
  queueName: string
  waiting: number
  active: number
  completed: number
  failed: number
}

export default function IPMonitorPage() {
  const [ipStatus, setIPStatus] = useState<IPStatus | null>(null)
  const [browserServices, setBrowserServices] = useState<BrowserService[]>([])
  const [queues, setQueues] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [switching, setSwitching] = useState(false)

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const headers = { 'Authorization': `Bearer ${token}` }
      
      const [ipRes, browserRes, queueRes] = await Promise.all([
        fetch('/admin/api/ip-monitor/ip-status', { headers }),
        fetch('/admin/api/ip-monitor/browser-status', { headers }),
        fetch('/admin/api/ip-monitor/queue-status', { headers })
      ])
      
      const ipData = await ipRes.json()
      const browserData = await browserRes.json()
      const queueData = await queueRes.json()
      
      if (ipData.code === 200) setIPStatus(ipData.data)
      if (browserData.code === 200) setBrowserServices(browserData.data.services)
      if (queueData.code === 200) setQueues(queueData.data.queues)
    } catch (e) {
      console.error('获取数据失败:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const handleSwitchMode = async (mode: string) => {
    setSwitching(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/admin/api/ip-monitor/switch-mode', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      })
      const data = await res.json()
      if (data.code === 200) {
        fetchData()
      }
    } catch (e) {
      console.error('切换模式失败:', e)
    } finally {
      setSwitching(false)
    }
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'direct': return 'bg-blue-500 text-white'
      case 'proxy': return 'bg-purple-500 text-white'
      case 'auto': return 'bg-green-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'direct': return '直连模式'
      case 'proxy': return '代理模式'
      case 'auto': return '自动模式'
      default: return mode
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IP 池与浏览器监控</h1>
          <p className="text-muted-foreground">实时监控 IP 池状态、浏览器服务和审核队列</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            刷新
          </Button>
        </div>
      </div>

      {/* IP 池状态 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <Network className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">当前模式</p>
                <Badge className={getModeColor(ipStatus?.mode || 'unknown')}>
                  {getModeLabel(ipStatus?.mode || 'unknown')}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">可用 IP</p>
                <p className="text-2xl font-bold">{ipStatus?.available ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">直连失败次数</p>
                <p className="text-2xl font-bold">{ipStatus?.directFailCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
                <ArrowRightLeft className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">模式切换次数</p>
                <p className="text-2xl font-bold">{ipStatus?.stats?.modeSwitches ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* IP 池详情 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              IP 池详情
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">总获取 IP</p>
                <p className="text-xl font-semibold">{ipStatus?.stats?.totalIPs ?? 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">已使用 IP</p>
                <p className="text-xl font-semibold">{ipStatus?.stats?.usedIPs ?? 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">验证码触发</p>
                <p className="text-xl font-semibold">{ipStatus?.stats?.captchaHits ?? 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">冷却剩余</p>
                <p className="text-xl font-semibold">
                  {ipStatus?.cooldownRemaining ? `${Math.round(ipStatus.cooldownRemaining / 1000)}秒` : '无'}
                </p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">手动切换模式</p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant={ipStatus?.mode === 'direct' ? 'default' : 'outline'}
                  onClick={() => handleSwitchMode('direct')}
                  disabled={switching}
                >
                  直连
                </Button>
                <Button 
                  size="sm" 
                  variant={ipStatus?.mode === 'proxy' ? 'default' : 'outline'}
                  onClick={() => handleSwitchMode('proxy')}
                  disabled={switching}
                >
                  代理
                </Button>
                <Button 
                  size="sm" 
                  variant={ipStatus?.mode === 'auto' ? 'default' : 'outline'}
                  onClick={() => handleSwitchMode('auto')}
                  disabled={switching}
                >
                  自动
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 浏览器服务状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              浏览器服务
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {browserServices.map((service) => (
                <div key={service.port} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      service.healthy ? "bg-green-500" : "bg-red-500"
                    )} />
                    <div>
                      <p className="font-medium">端口 {service.port}</p>
                      <p className="text-xs text-muted-foreground">
                        {service.healthy ? `版本 ${service.version || '未知'}` : service.error || '离线'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={service.healthy ? "default" : "destructive"}>
                    {service.healthy ? '在线' : '离线'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 审核队列状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5" />
            审核队列状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queues && queues.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">队列名称</th>
                    <th className="text-center py-3 px-4">等待中</th>
                    <th className="text-center py-3 px-4">处理中</th>
                    <th className="text-center py-3 px-4">已完成</th>
                    <th className="text-center py-3 px-4">失败</th>
                  </tr>
                </thead>
                <tbody>
                  {queues.map((queue, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{queue.name}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="secondary">{queue.waiting}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge className="bg-blue-500">{queue.active}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge className="bg-green-500">{queue.completed}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={queue.failed > 0 ? "destructive" : "secondary"}>
                          {queue.failed}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">暂无队列数据</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
