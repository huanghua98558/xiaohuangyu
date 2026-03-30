'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useDashboardStats, useTrendData, useTodayRealtimeTrend } from '@/lib/swr-hooks'
import { TrendDataPoint } from '@/lib/api'
import { mutate } from 'swr'
import { DataCard, GaugeChart, RealtimeClock, RollingNumber } from '@/components/data-center/DataCenterCard'
import {
  Users,
  ClipboardList,
  CheckCircle,
  Clock,
  Coins,
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
  Wifi,
  WifiOff,
  Signal,
  Server,
  Package,
  Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataCenterProps {
  onFullscreenChange?: (isFullscreen: boolean) => void
}

type WSStatus = 'connected' | 'disconnected' | 'connecting'
type NetworkStatus = 'idle' | 'low' | 'medium' | 'high' | 'busy'
type TrendRangeTab = 'today' | 3 | 7 | 30

type RealtimeTrendPoint = {
  time?: string
  publishedTasks?: number
  claims?: number
  completions?: number
  pointsIssued?: number
}

type TrendChartPoint = {
  label: string
  publishedTasks: number
  claims: number
  completions: number
  pointsIssued: number
}

const trendLegend = [
  { label: '发布', color: '#a855f7' },
  { label: '领取', color: '#3b82f6' },
  { label: '完成', color: '#22c55e' },
  { label: '积分', color: '#f97316' },
]

export function DataCenter({ onFullscreenChange }: DataCenterProps) {
  const { stats, isLoading, refresh } = useDashboardStats()
  const [trendTab, setTrendTab] = useState<TrendRangeTab>('today')
  const { trendData } = useTrendData(trendTab === 'today' ? null : trendTab)
  const { todayTrend } = useTodayRealtimeTrend(10)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [todayRealtimeData, setTodayRealtimeData] = useState<RealtimeTrendPoint[]>([])

  const [wsStatus, setWsStatus] = useState<WSStatus>('disconnected')
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('idle')
  const [aiTokenStats, setAiTokenStats] = useState<{ totalTokens: number; requests: number }>({
    totalTokens: 0,
    requests: 0,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setWsStatus('connecting')

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

      if (!token) {
        setWsStatus('disconnected')
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket()
        }, 2000)
        return
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      let wsHost = window.location.host
      if (wsHost.includes(':5001')) {
        wsHost = wsHost.replace(':5001', ':5000')
      }

      const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws?token=${encodeURIComponent(token)}`)
      wsRef.current = ws

      ws.onopen = () => {
        setWsStatus('connected')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'stats_update') {
            if (data.data && typeof data.data.onlineUsers === 'number') {
              mutate('/api/admin-v2/stats', (prev) => ({ ...prev, onlineUsers: data.data.onlineUsers }), false)
            }
            refreshRef.current()
            setLastUpdate(new Date())
          } else if (data.type === 'today_realtime_trend') {
            if (data.data && Array.isArray(data.data.data)) {
              setTodayRealtimeData(data.data.data)
              if (data.data.lastUpdated) {
                setLastUpdate(new Date(data.data.lastUpdated))
              }
            }
          } else if (data.type === 'realtime_stats') {
            if (data.data) {
              mutate(
                '/api/admin-v2/stats',
                (prev) => ({
                  ...prev,
                  onlineUsers: data.data.onlineUsers || prev?.onlineUsers,
                }),
                false
              )
            }
            setLastUpdate(new Date())
          } else if (data.type === 'heartbeat_ack') {
            const latency = Date.now() - data.data.timestamp
            if (latency < 100) setNetworkStatus('idle')
            else if (latency < 300) setNetworkStatus('low')
            else if (latency < 500) setNetworkStatus('medium')
            else if (latency < 1000) setNetworkStatus('high')
            else setNetworkStatus('busy')
          }
        } catch (error) {
          console.error('[DataCenter] 解析消息失败:', error)
        }
      }

      ws.onclose = () => {
        setWsStatus('disconnected')
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket()
        }, 5000)
      }

      ws.onerror = () => {
        setWsStatus('disconnected')
        reconnectCountRef.current++
        if (reconnectCountRef.current >= 3) return
        ws.close()
      }
    } catch (error) {
      console.error('[DataCenter] WebSocket 连接失败:', error)
      setWsStatus('disconnected')
    }
  }, [])

  useEffect(() => {
    const fetchTokenStats = async () => {
      try {
        const token = localStorage.getItem('admin_token')
        const res = await fetch('/api/ai/admin/usage-stats', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.code === 200) {
          setAiTokenStats({
            totalTokens: data.data?.summary?.totalTokens || 0,
            requests: data.data?.summary?.requests || 0,
          })
        }
      } catch (error) {
        console.error('获取Token统计失败:', error)
      }
    }

    fetchTokenStats()
    const interval = setInterval(fetchTokenStats, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    connectWebSocket()

    const heartbeatInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', data: { timestamp: Date.now() } }))
      }
    }, 5000)

    const refreshInterval = setInterval(() => {
      refreshRef.current()
      setLastUpdate(new Date())
    }, 60000)

    return () => {
      clearInterval(heartbeatInterval)
      clearInterval(refreshInterval)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connectWebSocket])

  const completionRate = stats?.todayTaskAmount
    ? Math.round((((stats?.todayClaims ?? 0) - (stats?.pendingClaims ?? 0)) / stats.todayTaskAmount) * 100)
    : 0

  const remainTotal = Math.max(0, (stats?.todayTaskAmount ?? 0) - (stats?.todayClaims ?? 0))

  const effectiveTodaySeries = useMemo(
    () => (todayRealtimeData.length > 0 ? todayRealtimeData : todayTrend?.data ?? []),
    [todayRealtimeData, todayTrend?.data]
  )

  const activeTrendData = useMemo<TrendChartPoint[]>(() => {
    if (trendTab === 'today') {
      return effectiveTodaySeries.map((item) => ({
        label: item.time || '--:--',
        publishedTasks: Number(item.publishedTasks || 0),
        claims: Number(item.claims || 0),
        completions: Number(item.completions || 0),
        pointsIssued: Number(item.pointsIssued || 0),
      }))
    }

    return trendData.map((item: TrendDataPoint) => ({
      label: new Date(item.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
      publishedTasks: Number(item.publishedTasks || 0),
      claims: Number(item.claims || 0),
      completions: Number(item.completions || 0),
      pointsIssued: Number(item.pointsIssued || 0),
    }))
  }, [effectiveTodaySeries, trendData, trendTab])

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

  const getWsStatusDisplay = () => {
    if (wsStatus === 'connected') {
      return (
        <div className="flex items-center gap-1.5 text-green-400">
          <Wifi className="w-4 h-4" />
          <span className="text-sm">已连接</span>
        </div>
      )
    }

    if (wsStatus === 'connecting') {
      return (
        <div className="flex items-center gap-1.5 text-yellow-400">
          <Wifi className="w-4 h-4 animate-pulse" />
          <span className="text-sm">连接中...</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-1.5 text-red-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm">已断开</span>
      </div>
    )
  }

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

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-full min-h-0 flex flex-col bg-slate-950 overflow-x-hidden overflow-y-auto',
        isFullscreen && 'fixed inset-0 z-50 h-full max-h-[100dvh]'
      )}
    >
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 p-4 sm:p-6 flex flex-col flex-1 min-h-0 min-w-0">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between mb-6 shrink-0 min-w-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4 min-w-0 flex-1">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white truncate">小黄鱼数据中心</h1>
                <p className="text-xs text-slate-400">实时数据监控大屏</p>
              </div>
            </div>

            <div className="flex flex-wrap items-stretch gap-2 sm:gap-3 min-w-0 lg:ml-0 xl:ml-4">
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 min-w-0">
                <Server className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs sm:text-sm text-slate-300 whitespace-nowrap">系统状态:</span>
                <span
                  className={cn(
                    'text-xs sm:text-sm font-medium truncate',
                    wsStatus === 'connected' ? 'text-green-400' : wsStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
                  )}
                >
                  {wsStatus === 'connected' ? '正常运行' : wsStatus === 'connecting' ? '连接中' : '异常'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 min-w-0">
                <span className="text-xs sm:text-sm text-slate-300 whitespace-nowrap">WebSocket:</span>
                {getWsStatusDisplay()}
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 min-w-0">
                <span className="text-xs sm:text-sm text-slate-300 whitespace-nowrap">网络情况:</span>
                {getNetworkStatusDisplay()}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 xl:justify-end shrink-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
              <span className="whitespace-nowrap">最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
            </div>
            <RealtimeClock />
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors shrink-0"
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
                title="今日完成次数"
                value={stats?.todayCompletedTasks ?? 0}
                icon={<CheckCircle className="w-5 h-5" />}
                trend={stats?.todayCompletedTasksChange?.change}
                trendLabel="较昨日"
                color="green"
                size="large"
              />
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <DataCard title="在线用户" value={stats?.onlineUsers ?? 0} icon={<Radio className="w-4 h-4" />} color="green" />
                <DataCard title="待审核" value={stats?.pendingClaims ?? 0} icon={<Clock className="w-4 h-4" />} color="orange" />
                <DataCard
                  title="今日完成任务"
                  value={stats?.todayCompletedClaims ?? 0}
                  icon={<CheckCircle className="w-4 h-4" />}
                  trend={stats?.todayCompletedClaimsChange?.change}
                  color="blue"
                />
                <DataCard title="剩余名额" value={remainTotal} icon={<Package className="w-4 h-4" />} color="purple" />
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
                <DataCard title="今日封控账号" value={stats?.todayBlockedAccounts ?? 0} icon={<UserCheck className="w-4 h-4" />} color="orange" />
                <DataCard title="今日AI消耗" value={aiTokenStats.totalTokens} icon={<Brain className="w-4 h-4" />} color="purple" />
              </div>

              <div className="col-span-12 xl:col-span-4 bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                <h3 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  系统健康度
                </h3>
                <div className="flex items-center justify-around">
                  <GaugeChart value={completionRate} label="名额完成率" color="#3b82f6" />
                  <GaugeChart
                    value={(stats?.pendingClaims ?? 0) > 100 ? 60 : (stats?.pendingClaims ?? 0) > 50 ? 80 : 95}
                    label="处理效率"
                    color="#22c55e"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 xl:col-span-4 bg-slate-900/50 rounded-xl border border-slate-800 p-4">
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
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-500/10 to-transparent rounded-lg border border-red-500/20">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-slate-300">累计封控账号</span>
                    </div>
                    <RollingNumber value={stats?.blockedAccounts ?? 0} className="text-xl font-bold text-red-400" />
                  </div>
                </div>
              </div>

              <div className="col-span-12 xl:col-span-8 bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
                  <div>
                    <h3 className="text-sm text-slate-400 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-400" />
                      数据趋势
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {trendTab === 'today' ? '今日实时趋势（每 10 分钟更新）' : `近${trendTab}天趋势`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(['today', 3, 7, 30] as const).map((tab) => (
                      <button
                        key={String(tab)}
                        type="button"
                        onClick={() => setTrendTab(tab)}
                        className={cn(
                          'px-3 py-1 text-xs rounded-lg transition-colors',
                          trendTab === tab ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        )}
                      >
                        {tab === 'today' ? '今天' : `${tab}天`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-3">
                  {trendLegend.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-slate-400">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="h-72">
                  {activeTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activeTrendData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#e2e8f0',
                          }}
                        />
                        <Line type="monotone" dataKey="publishedTasks" stroke="#a855f7" strokeWidth={2.5} dot={false} name="发布" />
                        <Line type="monotone" dataKey="claims" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="领取" />
                        <Line type="monotone" dataKey="completions" stroke="#22c55e" strokeWidth={2.5} dot={false} name="完成" />
                        <Line type="monotone" dataKey="pointsIssued" stroke="#f97316" strokeWidth={2.5} dot={false} name="积分" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-slate-500">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">暂无趋势数据</p>
                        <p className="text-xs mt-1">{trendTab === 'today' ? '等待数据推送...' : '当前周期暂无统计数据'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                <Gift className="w-4 h-4" />
                今日积分分布
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
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

      <footer className="relative z-10 text-center py-4 text-xs text-slate-600">
        小黄鱼任务管理平台 · 数据中心 · 实时数据推送
      </footer>
    </div>
  )
}
