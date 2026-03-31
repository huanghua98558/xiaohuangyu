'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Server, 
  Database, 
  Globe,
  Wifi,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  Zap,
  Clock,
  Scan
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'

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
    processUptime: { seconds: number; formatted: string }
  }
  disk: {
    total: string
    used: string
    available: string
    percent: number
    status: string
  }
  network: {
    interface: string
    rxMB: number
    txMB: number
  }
  pm2: Array<{
    name: string
    pmId: number
    status: string
    cpu: number
    memory: number
    uptime: number
    restarts: number
    version: string
    mode: string
  }>
  nginx: {
    status: string
    active: boolean
  }
  redis: {
    status: string
    connected: boolean
    version?: string
    usedMemory?: string
    connectedClients?: number
    latency?: number
    error?: string
  }
  database: {
    status: string
    connected: boolean
    latency?: number
    type?: string
    error?: string
  }
  websocket: {
    onlineUsers: number
    connections: number
    cityCount: number
  }
  health: {
    score: number
    status: string
    issues: string[]
  }
  alerts: {
    total: number
    pending: number
    critical: number
  }
}

export default function MonitorPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/admin/api/monitor/metrics', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.code === 0) {
        setMetrics(data.data)
      }
    } catch (e) {
      console.error('获取监控数据失败:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  // WebSocket real-time metrics
  useAdminWebSocket(
    ['system_metrics', 'service_health'],
    (data: any) => {
      if (data?.cpu !== undefined) {
        setMetrics((prev: any) => prev ? {
          ...prev,
          system: {
            ...prev.system,
            memoryUsagePercent: data.memory || prev.system?.memoryUsagePercent,
          },
          health: { ...prev.health, score: Math.max(0, 100 - (data.cpu > 80 ? 20 : 0) - (data.memory > 90 ? 20 : 0)) }
        } : prev)
      }
    }
  )

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(fetchMetrics, 60000)
    return () => clearInterval(timer)
  }, [autoRefresh])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchMetrics()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
      case 'running':
      case 'connected':
      case 'online':
        return 'text-green-500'
      case 'warning':
        return 'text-yellow-500'
      case 'critical':
      case 'error':
      case 'stopped':
      case 'disconnected':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
      case 'running':
      case 'connected':
      case 'online':
        return <Badge className="bg-green-500 text-white hover:bg-green-600">正常</Badge>
      case 'warning':
        return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">警告</Badge>
      case 'critical':
      case 'error':
      case 'stopped':
      case 'disconnected':
        return <Badge variant="destructive">异常</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  // 翻译PM2模式为中文
  const translateMode = (mode: string) => {
    switch (mode) {
      case 'fork_mode':
        return '单进程'
      case 'cluster_mode':
        return '集群'
      default:
        return mode || '-'
    }
  }

  // 格式化版本号显示
  const formatVersion = (version: string) => {
    if (!version || version === 'N/A') {
      return '-'
    }
    return version
  }

  // 获取OCR服务状态
  const getOcrServices = () => {
    if (!metrics?.pm2) return []
    return metrics.pm2.filter(p => p.name.toLowerCase().includes('ocr'))
  }

  // 计算健康度各分项得分
  const getHealthDetails = () => {
    if (!metrics) return null
    
    const details = {
      cpu: { score: 100, status: 'ok', value: '' },
      memory: { score: 100, status: 'ok', value: '' },
      disk: { score: 100, status: 'ok', value: '' },
      services: { score: 100, status: 'ok', value: '' }
    }

    // CPU 评分 (负载超过核数则扣分)
    const cpuLoadPercent = Math.round((metrics.system.loadAverage['1m'] / metrics.system.cpus) * 100)
    details.cpu.value = `${cpuLoadPercent}% (${metrics.system.loadAverage['1m']})`
    if (cpuLoadPercent > 100) {
      details.cpu.score = 60
      details.cpu.status = 'warning'
    } else if (cpuLoadPercent > 80) {
      details.cpu.score = 80
      details.cpu.status = 'warning'
    }

    // 内存评分
    details.memory.value = `${metrics.system.memoryUsagePercent}%`
    if (metrics.system.memoryUsagePercent > 90) {
      details.memory.score = 50
      details.memory.status = 'critical'
    } else if (metrics.system.memoryUsagePercent > 80) {
      details.memory.score = 75
      details.memory.status = 'warning'
    }

    // 磁盘评分
    details.disk.value = `${metrics.disk.percent}%`
    if (metrics.disk.percent > 90) {
      details.disk.score = 50
      details.disk.status = 'critical'
    } else if (metrics.disk.percent > 80) {
      details.disk.score = 75
      details.disk.status = 'warning'
    }

    // 服务评分
    let serviceScore = 100
    let serviceIssues: string[] = []
    if (!metrics.nginx.active) {
      serviceScore -= 25
      serviceIssues.push('Nginx')
    }
    if (!metrics.redis.connected && metrics.redis.status !== 'disabled') {
      serviceScore -= 25
      serviceIssues.push('Redis')
    }
    if (!metrics.database.connected) {
      serviceScore -= 30
      serviceIssues.push('数据库')
    }
    details.services.score = Math.max(0, serviceScore)
    details.services.status = serviceScore >= 80 ? 'ok' : serviceScore >= 50 ? 'warning' : 'critical'
    details.services.value = serviceIssues.length > 0 ? `${serviceIssues.join('/')}异常` : '全部正常'

    return details
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">无法加载监控数据</p>
      </div>
    )
  }

  const healthDetails = getHealthDetails()
  const ocrServices = getOcrServices()

  return (
    <div className="space-y-6 p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统监控中心</h1>
          <p className="text-muted-foreground">实时监控系统运行状态</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            上次更新: {new Date(metrics.timestamp).toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '暂停刷新' : '自动刷新'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            刷新
          </Button>
        </div>
      </div>

      {/* 系统健康度和Nginx状态 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 系统健康度 */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("text-5xl font-bold", getStatusColor(metrics.health.status))}>
                  {metrics.health.score}
                </div>
                <div>
                  <div className="text-lg font-medium">系统健康度</div>
                  <div className="flex items-center gap-2 mt-1">
                    {metrics.health.status === 'healthy' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : metrics.health.status === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span>
                      {metrics.health.status === 'healthy' ? '健康' : 
                       metrics.health.status === 'warning' ? '警告' : '异常'}
                    </span>
                  </div>
                </div>
              </div>
              {/* 健康度评判标准 */}
              {healthDetails && (
                <div className="text-sm space-y-1.5 bg-white/50 dark:bg-black/20 rounded-lg p-3 min-w-[180px]">
                  <div className="font-medium text-muted-foreground mb-2">评判标准</div>
                  <div className="flex justify-between items-center">
                    <span>CPU负载</span>
                    <span className={cn(
                      "font-medium",
                      healthDetails.cpu.status === 'ok' ? 'text-green-600' : 
                      healthDetails.cpu.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {healthDetails.cpu.value}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>内存使用</span>
                    <span className={cn(
                      "font-medium",
                      healthDetails.memory.status === 'ok' ? 'text-green-600' : 
                      healthDetails.memory.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {healthDetails.memory.value}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>磁盘空间</span>
                    <span className={cn(
                      "font-medium",
                      healthDetails.disk.status === 'ok' ? 'text-green-600' : 
                      healthDetails.disk.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {healthDetails.disk.value}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>核心服务</span>
                    <span className={cn(
                      "font-medium",
                      healthDetails.services.status === 'ok' ? 'text-green-600' : 
                      healthDetails.services.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {healthDetails.services.value}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {metrics.health.issues.length > 0 && (
              <div className="mt-4 text-sm">
                <div className="font-medium text-yellow-600 dark:text-yellow-400 mb-1">待处理问题:</div>
                <div className="flex flex-wrap gap-2">
                  {metrics.health.issues.map((issue, i) => (
                    <Badge key={i} variant="outline" className="text-yellow-600 border-yellow-300">
                      {issue}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nginx Web服务器 */}
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Globe className={cn("w-12 h-12", getStatusColor(metrics.nginx.status))} />
                <div>
                  <div className="text-xl font-medium">Nginx</div>
                  <div className="text-sm text-muted-foreground">Web服务器</div>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(metrics.nginx.status)}
                    <span className="text-sm text-muted-foreground">
                      {metrics.nginx.active ? '运行中' : '已停止'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">负载均衡</div>
                <div className="text-2xl font-bold text-green-600">
                  {metrics.pm2.filter(p => p.name.includes('xiaohuangyu-backend') || p.name.includes('xiaohuangyu-api')).length} 实例
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  API集群节点
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 资源监控 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">CPU</CardTitle>
            <Cpu className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.system.cpus} 核</div>
            <Progress 
              value={Math.min(100, (metrics.system.loadAverage['1m'] / metrics.system.cpus) * 100)} 
              className="mt-2"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              负载: {metrics.system.loadAverage['1m']} / {metrics.system.loadAverage['5m']} / {metrics.system.loadAverage['15m']}
            </div>
          </CardContent>
        </Card>

        {/* 内存 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">内存</CardTitle>
            <MemoryStick className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.system.memoryUsagePercent}%</div>
            <Progress value={metrics.system.memoryUsagePercent} className="mt-2" />
            <div className="mt-2 text-xs text-muted-foreground">
              {metrics.system.usedMemory}GB / {metrics.system.totalMemory}GB
            </div>
          </CardContent>
        </Card>

        {/* 磁盘 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">磁盘</CardTitle>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.disk.percent}%</div>
            <Progress value={metrics.disk.percent} className="mt-2" />
            <div className="mt-2 text-xs text-muted-foreground">
              {metrics.disk.used} / {metrics.disk.total} (可用 {metrics.disk.available})
            </div>
          </CardContent>
        </Card>

        {/* 网络 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">网络流量</CardTitle>
            <Wifi className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.network.rxMB + metrics.network.txMB} MB</div>
            <div className="mt-2 text-xs text-muted-foreground">
              入站: {metrics.network.rxMB}MB / 出站: {metrics.network.txMB}MB
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 服务状态 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* OCR服务 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scan className={cn("w-8 h-8", ocrServices.length > 0 ? "text-green-500" : "text-red-500")} />
                <div>
                  <div className="font-medium">OCR服务</div>
                  <div className="text-sm text-muted-foreground">
                    {ocrServices.length > 0 ? `${ocrServices.length}个进程` : '未运行'}
                  </div>
                </div>
              </div>
              {ocrServices.length > 0 ? (
                <Badge className="bg-green-500 text-white hover:bg-green-600">正常</Badge>
              ) : (
                <Badge variant="destructive">异常</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Redis */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className={cn("w-8 h-8", getStatusColor(metrics.redis.status))} />
                <div>
                  <div className="font-medium">Redis</div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.redis.connected 
                      ? `${metrics.redis.connectedClients || 0} 连接` 
                      : metrics.redis.status === 'disabled' ? '未启用' : '未连接'}
                  </div>
                </div>
              </div>
              {getStatusBadge(metrics.redis.status)}
            </div>
          </CardContent>
        </Card>

        {/* 数据库 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className={cn("w-8 h-8", getStatusColor(metrics.database.status))} />
                <div>
                  <div className="font-medium">数据库</div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.database.connected 
                      ? `${metrics.database.latency}ms` 
                      : '未连接'}
                  </div>
                </div>
              </div>
              {getStatusBadge(metrics.database.status)}
            </div>
          </CardContent>
        </Card>

        {/* WebSocket */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <div className="font-medium">WebSocket</div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.websocket.onlineUsers} 在线用户
                  </div>
                </div>
              </div>
              <Badge className="bg-blue-500 text-white hover:bg-blue-600">
                {metrics.websocket.connections} 连接
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PM2进程 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            PM2 进程管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">服务名称</th>
                  <th className="text-left py-3 px-2">状态</th>
                  <th className="text-left py-3 px-2">CPU</th>
                  <th className="text-left py-3 px-2">内存</th>
                  <th className="text-left py-3 px-2">重启次数</th>
                  <th className="text-left py-3 px-2">版本</th>
                  <th className="text-left py-3 px-2">模式</th>
                </tr>
              </thead>
              <tbody>
                {metrics.pm2.map((process, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-3 px-2 font-medium">{process.name}</td>
                    <td className="py-3 px-2">{getStatusBadge(process.status)}</td>
                    <td className="py-3 px-2">{process.cpu}%</td>
                    <td className="py-3 px-2">{process.memory}MB</td>
                    <td className="py-3 px-2">{process.restarts}</td>
                    <td className="py-3 px-2">{formatVersion(process.version)}</td>
                    <td className="py-3 px-2">
                      <Badge variant="outline">{translateMode(process.mode)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 系统信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              运行时间
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">服务器运行</span>
              <span className="font-medium">{metrics.system.uptime.formatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">进程运行</span>
              <span className="font-medium">{metrics.system.processUptime.formatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">主机名</span>
              <span className="font-medium">{metrics.system.hostname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CPU型号</span>
              <span className="font-medium text-xs">{metrics.system.cpuModel}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              告警状态
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">待处理告警</span>
              <Badge className={cn(
                metrics.alerts.pending > 0 ? "bg-yellow-500 text-white" : "bg-green-500 text-white"
              )}>
                {metrics.alerts.pending}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">严重告警</span>
              <Badge variant={metrics.alerts.critical > 0 ? "destructive" : "default"}>
                {metrics.alerts.critical}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">总告警数</span>
              <span className="font-medium">{metrics.alerts.total}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
