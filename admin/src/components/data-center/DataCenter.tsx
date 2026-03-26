'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useDashboardStats, useTrendData, swrConfig } from '@/lib/swr-hooks'
import { TrendDataPoint } from '@/lib/api'
import { mutate } from 'swr'
import { 
  DataCard, 
  AnimatedCounter, 
  GaugeChart, 
  RealtimeClock, 
  MiniTrend,
  RollingNumber 
} from '@/components/data-center/DataCenterCard'
import { 
  Users, 
  ClipboardList, 
  CheckCircle, 
  Clock, 
  Coins,
  TrendingUp,
  Activity,
  Radio,
  Gift,
  Calendar,
  Zap,
  Maximize2,
  Minimize2,
  FilePlus,
  UserCheck,
  Target,
  Award,
  Wifi,
  WifiOff,
  Signal,
  Server,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'

interface DataCenterProps {
  onFullscreenChange?: (isFullscreen: boolean) => void
}

// WebSocket 连接状态类型
type WSStatus = 'connected' | 'disconnected' | 'connecting'

// 网络状态类型
type NetworkStatus = 'idle' | 'low' | 'medium' | 'high' | 'busy'

export function DataCenter({ onFullscreenChange }: DataCenterProps) {
  const { stats, isLoading, refresh } = useDashboardStats()
  const [trendDays, setTrendDays] = useState<3 | 7 | 30>(7)
  const { trendData } = useTrendData(trendDays)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // WebSocket 状态
  const [wsStatus, setWsStatus] = useState<WSStatus>('disconnected')
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('idle')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)

  // 使用 ref 存储 refresh 函数，避免 WebSocket 重复连接
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  // WebSocket 连接
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    
    setWsStatus('connecting')
    
    try {
      // 获取 token
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
      
      if (!token) {
        console.warn('[DataCenter] 未找到admin_token，延迟重试')
        setWsStatus('disconnected')
        // 延迟重试，等待登录状态初始化
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current)
        }
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket()
        }, 2000)
        return
      }
      
      // 构建 WebSocket URL
      // 沙盒环境：管理后台在 5001，后端 WebSocket 在 5000
      // 生产环境：通过 Nginx 代理，使用相同域名
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      let wsHost = window.location.host
      
      // 沙盒环境检测：如果当前是 5001 端口，WebSocket 应连接到 5000 端口
      if (wsHost.includes(':5001')) {
        wsHost = wsHost.replace(':5001', ':5000')
      }
      
      const wsUrl = `${wsProtocol}//${wsHost}/ws?token=${encodeURIComponent(token)}`
      
      console.log('[DataCenter] WebSocket 连接:', wsUrl.substring(0, 50) + '...')
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      
      ws.onopen = () => {
        setWsStatus('connected')
        console.log('[DataCenter] WebSocket 已连接')
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // 处理不同类型的消息
          if (data.type === 'stats_update') {
            // 直接使用广播数据中的在线用户数（实时更新）
            if (data.data && typeof data.data.onlineUsers === 'number') {
              mutate('/api/admin-v2/stats', (prev) => ({...prev, onlineUsers: data.data.onlineUsers}), false)
            }
            refreshRef.current()
            setLastUpdate(new Date())
          } else if (data.type === 'heartbeat_ack') {
            // 心跳响应，更新网络状态
            const latency = Date.now() - data.data.timestamp
            if (latency < 100) setNetworkStatus('idle')
            else if (latency < 300) setNetworkStatus('low')
            else if (latency < 500) setNetworkStatus('medium')
            else if (latency < 1000) setNetworkStatus('high')
            else setNetworkStatus('busy')
          }
        } catch (e) {
          console.error('[DataCenter] 解析消息失败:', e)
        }
      }
      
      ws.onclose = () => {
        setWsStatus('disconnected')
        console.log('[DataCenter] WebSocket 已断开')
        
        // 5秒后重连
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current)
        }
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket()
        }, 5000)
      }
      
      ws.onerror = (event) => {
        console.warn('[DataCenter] WebSocket 连接异常，将自动重连...', event.type)
        setWsStatus('disconnected')
        // 清理连接
        reconnectCountRef.current++
        if (reconnectCountRef.current >= 3) {
          console.log('[DataCenter] WebSocket 连接失败3次，停止重连，使用轮询模式')
          return
        }
        ws.close()
      }
      
    } catch (error) {
      console.error('[DataCenter] WebSocket 连接失败:', error)
      setWsStatus('disconnected')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 空依赖数组，只在组件挂载时创建一次

  // 初始化 WebSocket 连接
  useEffect(() => {
    connectWebSocket()
    
    // 定时发送心跳以检测网络状态
    const heartbeatInterval = setInterval(() => {
      // WebSocket断开时使用更短的轮询间隔
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', data: { timestamp: Date.now() } }))
      }
    }, 5000)
    
    // 定时刷新数据（WebSocket断开时10秒，连接时60秒）
    const refreshInterval = setInterval(() => {
      // WebSocket断开时使用更短的轮询间隔
      refreshRef.current()
      setLastUpdate(new Date())
    }, 60000)
    
    return () => {
      clearInterval(heartbeatInterval)
      clearInterval(refreshInterval)
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      wsRef.current?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 空依赖数组，只在组件挂载时执行一次

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
      onFullscreenChange?.(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
      onFullscreenChange?.(false)
    }
  }, [onFullscreenChange])

  // 获取网络状态显示
  const getNetworkStatusDisplay = () => {
    const statusMap = {
      idle: { text: '空闲', color: 'text-green-400', icon: Signal },
      low: { text: '良好', color: 'text-green-400', icon: Signal },
      medium: { text: '一般', color: 'text-yellow-400', icon: Signal },
      high: { text: '繁忙', color: 'text-orange-400', icon: Signal },
      busy: { text: '拥挤', color: 'text-red-400', icon: Signal },
    }
    const status = statusMap[networkStatus]
    const Icon = status.icon
    return (
      <div className={cn('flex items-center gap-1.5', status.color)}>
        <Icon className="w-4 h-4" />
        <span className="text-sm">{status.text}</span>
      </div>
    )
  }

  // 获取 WebSocket 状态显示
  const getWsStatusDisplay = () => {
    if (wsStatus === 'connected') {
      return (
        <div className="flex items-center gap-1.5 text-green-400">
          <Wifi className="w-4 h-4" />
          <span className="text-sm">已连接</span>
        </div>
      )
    } else if (wsStatus === 'connecting') {
      return (
        <div className="flex items-center gap-1.5 text-yellow-400">
          <Wifi className="w-4 h-4 animate-pulse" />
          <span className="text-sm">连接中...</span>
        </div>
      )
    } else {
      return (
        <div className="flex items-center gap-1.5 text-red-400">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm">已断开</span>
        </div>
      )
    }
  }

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px] bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
          <span className="text-slate-400">加载数据中...</span>
        </div>
      </div>
    )
  }

  // 计算完成率
  const completionRate = stats?.todayClaims ? 
    Math.round(((stats?.todayCompletedClaims ?? 0) / (stats?.todayClaims ?? 1)) * 100) : 0

  // 计算剩余名额
  const remainTotal = stats?.todayTaskAmount && stats?.todayClaims 
    ? (stats?.todayTaskAmount ?? 0) - (stats?.todayClaims ?? 0) 
    : 0

  // 趋势数据
  const claimsTrend = trendData.map((d: TrendDataPoint) => d.claims)
  const completionsTrend = trendData.map((d: TrendDataPoint) => d.completions)
  const pointsTrend = trendData.map((d: TrendDataPoint) => d.pointsIssued)

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative min-h-full bg-slate-950 overflow-hidden",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* 背景网格 */}
      <div className="absolute inset-0 opacity-20">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 p-6">
        {/* 顶部栏 */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">小黄鱼数据中心</h1>
                <p className="text-xs text-slate-400">实时数据监控大屏</p>
              </div>
            </div>
            
            {/* 系统状态 - 文字显示 */}
            <div className="flex items-center gap-4 ml-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700">
                <Server className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">系统状态:</span>
                <span className={cn(
                  'text-sm font-medium',
                  wsStatus === 'connected' ? 'text-green-400' : 
                  wsStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
                )}>
                  {wsStatus === 'connected' ? '正常运行' : wsStatus === 'connecting' ? '连接中' : '异常'}
                </span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700">
                <span className="text-sm text-slate-300">WebSocket:</span>
                {getWsStatusDisplay()}
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700">
                <span className="text-sm text-slate-300">网络情况:</span>
                {getNetworkStatusDisplay()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
            </div>
            <RealtimeClock />
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              title={isFullscreen ? '退出全屏 (F11)' : '全屏显示 (F11)'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-slate-300" />
              ) : (
                <Maximize2 className="w-5 h-5 text-slate-300" />
              )}
            </button>
          </div>
        </header>

        {stats && (
          <div className="space-y-4">
            {/* 核心数据行 */}
            <div className="grid grid-cols-4 gap-4">
              <DataCard
                title="今日发布任务"
                value={stats?.todayPublishedTasks ?? 0}
                icon={<FilePlus className="w-5 h-5" />}
                trend={stats?.todayPublishedTasksChange?.change ?? undefined}
                trendLabel="较昨日"
                color="blue"
                size="large"
              />
              <DataCard
                title="今日任务名额"
                value={stats?.todayTaskAmount ?? 0}
                icon={<Target className="w-5 h-5" />}
                trend={stats?.todayTaskAmountChange?.change}
                trendLabel="较昨日"
                color="purple"
                size="large"
              />
              <DataCard
                title="今日领取次数"
                value={stats?.todayClaims ?? 0}
                icon={<ClipboardList className="w-5 h-5" />}
                trend={stats?.todayClaimsChange?.change}
                trendLabel="较昨日"
                color="cyan"
                size="large"
              />
              <DataCard
                title="今日完成任务"
                value={stats?.todayCompletedClaims ?? 0}
                icon={<CheckCircle className="w-5 h-5" />}
                trend={stats?.todayCompletedClaimsChange?.change}
                trendLabel="较昨日"
                color="green"
                size="large"
              />
            </div>

            {/* 运营指标 + 仪表盘 */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8 grid grid-cols-4 gap-4">
                <DataCard
                  title="在线用户"
                  value={stats?.onlineUsers ?? 0}
                  icon={<Radio className="w-4 h-4" />}
                  color="green"
                />
                <DataCard
                  title="待审核"
                  value={stats?.pendingClaims ?? 0}
                  icon={<Clock className="w-4 h-4" />}
                  color="orange"
                />
                <DataCard
                  title="今日完成次数"
                  value={stats?.todayCompletedTasks ?? 0}
                  icon={<CheckCircle className="w-4 h-4" />}
                  trend={stats?.todayCompletedTasksChange?.change}
                  color="blue"
                />
                <DataCard
                  title="剩余名额"
                  value={remainTotal}
                  icon={<Package className="w-4 h-4" />}
                  color="purple"
                />
                <DataCard
                  title="今日签到"
                  value={stats?.todaySignIns ?? 0}
                  icon={<Calendar className="w-4 h-4" />}
                  trend={stats?.todaySignInsChange?.change}
                  color="cyan"
                />
                <DataCard
                  title="今日积分发放"
                  value={stats?.todayPointsIssued ?? 0}
                  icon={<Coins className="w-4 h-4" />}
                  trend={stats?.todayPointsIssuedChange?.change}
                  color="orange"
                />
                <DataCard
                  title="完成率"
                  value={completionRate}
                  icon={<TrendingUp className="w-4 h-4" />}
                  suffix="%"
                  color="green"
                />
                <DataCard
                  title="本周签到次数"
                  value={stats?.weekSignIns ?? 0}
                  icon={<UserCheck className="w-4 h-4" />}
                  color="blue"
                />
              </div>

              <div className="col-span-4 bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                <h3 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                  <Zap className="w-4 w-4 text-yellow-500" />
                  系统健康度
                </h3>
                <div className="flex items-center justify-around">
                  <GaugeChart
                    value={completionRate}
                    label="任务完成率"
                    color="#3b82f6"
                  />
                  <GaugeChart
                    value={(stats?.pendingClaims ?? 0) > 100 ? 60 : (stats?.pendingClaims ?? 0) > 50 ? 80 : 95}
                    label="处理效率"
                    color="#22c55e"
                  />
                </div>
              </div>
            </div>

            {/* 累计数据 + 趋势图 */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-3 bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                <h3 className="text-sm text-slate-400 mb-4">累计数据</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-500/10 to-transparent rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-slate-300">总用户</span>
                    </div>
                    <RollingNumber value={stats?.totalUsers ?? 0} className="text-xl font-bold text-blue-400" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-transparent rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-slate-300">总任务</span>
                    </div>
                    <RollingNumber value={stats?.totalTasks ?? 0} className="text-xl font-bold text-purple-400" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-500/10 to-transparent rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-slate-300">总完成</span>
                    </div>
                    <RollingNumber value={stats?.totalCompletedClaims ?? 0} className="text-xl font-bold text-green-400" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-500/10 to-transparent rounded-lg border border-orange-500/20">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-slate-300">总积分发放</span>
                    </div>
                    <RollingNumber value={stats?.totalPointsIssued ?? 0} className="text-xl font-bold text-orange-400" />
                  </div>
                </div>
              </div>

              <div className="col-span-9 bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-slate-400 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    数据趋势
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTrendDays(3)}
                      className={cn(
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        trendDays === 3 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      )}
                    >
                      近3天
                    </button>
                    <button
                      onClick={() => setTrendDays(7)}
                      className={cn(
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        trendDays === 7 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      )}
                    >
                      近7天
                    </button>
                    <button
                      onClick={() => setTrendDays(30)}
                      className={cn(
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        trendDays === 30 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      )}
                    >
                      近30天
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">领取趋势</span>
                      <span className="text-xs text-blue-400">
                        {claimsTrend[claimsTrend.length - 1] || 0}
                      </span>
                    </div>
                    <MiniTrend data={claimsTrend} color="#3b82f6" height={60} animated />
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">完成趋势</span>
                      <span className="text-xs text-green-400">
                        {completionsTrend[completionsTrend.length - 1] || 0}
                      </span>
                    </div>
                    <MiniTrend data={completionsTrend} color="#22c55e" height={60} animated />
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">积分发放</span>
                      <span className="text-xs text-orange-400">
                        {pointsTrend[pointsTrend.length - 1] || 0}
                      </span>
                    </div>
                    <MiniTrend data={pointsTrend} color="#f97316" height={60} animated />
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 px-2">日期</th>
                        {trendData.slice().reverse().map((d: TrendDataPoint) => (
                          <th key={d.date} className="text-center py-2 px-2 text-slate-500">
                            {new Date(d.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-800">
                        <td className="py-2 px-2 text-slate-400">领取数</td>
                        {trendData.slice().reverse().map((d: TrendDataPoint) => (
                          <td key={d.date} className="text-center py-2 px-2 text-blue-400 font-mono">
                            <RollingNumber value={d.claims} />
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-800">
                        <td className="py-2 px-2 text-slate-400">完成数</td>
                        {trendData.slice().reverse().map((d: TrendDataPoint) => (
                          <td key={d.date} className="text-center py-2 px-2 text-green-400 font-mono">
                            <RollingNumber value={d.completions} />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-slate-400">积分发放</td>
                        {trendData.slice().reverse().map((d: TrendDataPoint) => (
                          <td key={d.date} className="text-center py-2 px-2 text-orange-400 font-mono">
                            <RollingNumber value={d.pointsIssued} />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 积分分布 */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                <Gift className="w-4 h-4" />
                今日积分分布
              </h3>
              <div className="grid grid-cols-6 gap-3">
                <div className="bg-gradient-to-br from-cyan-500/10 to-transparent rounded-lg border border-cyan-500/20 p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">签到奖励</div>
                  <div className="text-lg font-bold text-cyan-400">
                    <RollingNumber value={stats?.todayPointsByType?.sign_in || 0} />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-transparent rounded-lg border border-blue-500/20 p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">任务奖励</div>
                  <div className="text-lg font-bold text-blue-400">
                    <RollingNumber value={stats?.todayPointsByType?.task || 0} />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-lg border border-purple-500/20 p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">推广奖励</div>
                  <div className="text-lg font-bold text-purple-400">
                    <RollingNumber value={stats?.todayPointsByType?.promotion_c || 0} />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-500/10 to-transparent rounded-lg border border-green-500/20 p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">额外奖励</div>
                  <div className="text-lg font-bold text-green-400">
                    <RollingNumber value={stats?.todayPointsByType?.reward || 0} />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-yellow-500/10 to-transparent rounded-lg border border-yellow-500/20 p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">活动奖励</div>
                  <div className="text-lg font-bold text-yellow-400">
                    <RollingNumber value={stats?.todayPointsByType?.bonus || 0} />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-pink-500/10 to-transparent rounded-lg border border-pink-500/20 p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">成就奖励</div>
                  <div className="text-lg font-bold text-pink-400">
                    <RollingNumber value={stats?.todayPointsByType?.achievement || 0} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部版权 */}
      <footer className="relative z-10 text-center py-4 text-xs text-slate-600">
        小黄鱼任务管理平台 · 数据中心 · 实时数据推送
      </footer>
    </div>
  )
}
