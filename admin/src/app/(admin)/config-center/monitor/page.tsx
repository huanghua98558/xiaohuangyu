'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { 
  Activity, Cpu, HardDrive, MemoryStick, Server, Database,
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock
} from 'lucide-react'

interface Metrics {
  timestamp: string
  system: {
    hostname: string
    cpus: number
    cpuModel: string
    totalMemory: number
    usedMemory: number
    freeMemory: number
    memoryUsagePercent: number
    loadAverage: { '1m': number; '5m': number; '15m': number }
    uptime: { seconds: number; formatted: string }
  }
  disk: {
    total: string
    used: string
    available: string
    percent: number
  }
  pm2: Array<{
    name: string
    pmId: number
    status: string
    cpu: number
    memory: number
    uptime: number
    restarts: number
  }>
  redis: {
    status: string
    connected: boolean
    usedMemory?: string
    connectedClients?: number
    latency?: number
  }
  database: {
    status: string
    connected: boolean
    latency?: number
  }
  health: {
    score: number
    status: string
    issues: string[]
  }
}

export default function MonitorPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  const loadMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/admin/api/monitor/metrics', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (data.code === 200) {
        setMetrics(data.data)
      } else {
        setError(data.message || '获取监控数据失败')
      }
    } catch (e: any) {
      setError(e.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMetrics()
    const interval = setInterval(loadMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusColor = (status: string) => {
    if (status === 'online' || status === 'connected' || status === 'ok') return 'bg-green-500'
    if (status === 'stopped' || status === 'disconnected') return 'bg-red-500'
    return 'bg-yellow-500'
  }

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <XCircle className="w-12 h-12 text-red-500" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={loadMetrics}>重试</Button>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            运行监控
          </h1>
          <p className="text-muted-foreground mt-1">系统资源和进程状态</p>
        </div>
        <Button variant="outline" onClick={loadMetrics} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 健康状态 */}
      <Card className={`border-l-4 ${metrics.health.score >= 90 ? 'border-l-green-500' : metrics.health.score >= 70 ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {metrics.health.score >= 90 ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : metrics.health.score >= 70 ? (
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
              <div>
                <h3 className="font-medium">系统健康度：{metrics.health.score}分</h3>
                <p className="text-sm text-muted-foreground">
                  {metrics.health.issues.length > 0 
                    ? metrics.health.issues.join(', ') 
                    : '所有服务运行正常'}
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                运行时间：metrics.system.uptime?.formatted || 'N/A'
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统资源 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CPU */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              CPU
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>负载 (1m/5m/15m)</span>
                <span className="font-mono">
                  {metrics.system.loadAverage?.['1m']?.toFixed(2) || 'N/A'} / 
                  {metrics.system.loadAverage?.['5m']?.toFixed(2) || 'N/A'} / 
                  {metrics.system.loadAverage?.['15m']?.toFixed(2) || 'N/A'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {metrics.system.cpus} 核 / {metrics.system.cpuModel?.split(' ')[0] || 'Unknown'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 内存 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MemoryStick className="w-4 h-4" />
              内存
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>使用率</span>
                <span className="font-mono">{metrics.system.memoryUsagePercent?.toFixed(1) || 'N/A'}%</span>
              </div>
              <Progress value={metrics.system.memoryUsagePercent || 0} className="h-2" />
              <div className="text-sm text-muted-foreground">
                {formatBytes(metrics.system.usedMemory || 0)} / {formatBytes(metrics.system.totalMemory || 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 磁盘 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              磁盘
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>使用率</span>
                <span className="font-mono">{metrics.disk?.percent || 0}%</span>
              </div>
              <Progress value={metrics.disk?.percent || 0} className="h-2" />
              <div className="text-sm text-muted-foreground">
                {metrics.disk?.used || 'N/A'} / {metrics.disk?.total || 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 服务状态 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Redis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="w-4 h-4" />
              Redis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(metrics.redis?.status || 'unknown')}`} />
                <span>{metrics.redis?.connected ? '已连接' : '未连接'}</span>
              </div>
              {metrics.redis?.connected && (
                <div className="text-sm text-muted-foreground">
                  内存: {metrics.redis.usedMemory} | 客户端: {metrics.redis.connectedClients}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(metrics.database?.status || 'unknown')}`} />
                <span>{metrics.database?.connected ? '已连接' : '未连接'}</span>
              </div>
              {metrics.database?.connected && metrics.database?.latency && (
                <div className="text-sm text-muted-foreground">
                  延迟: {metrics.database.latency}ms
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PM2 进程 */}
      {metrics.pm2 && metrics.pm2.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PM2 进程</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.pm2.map((process) => (
                <div key={process.pmId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(process.status)}`} />
                    <span className="font-medium">{process.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {process.cpu}%
                    </div>
                    <div className="flex items-center gap-1">
                      <MemoryStick className="w-3 h-3" />
                      {formatBytes(process.memory)}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      重启: {process.restarts}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
