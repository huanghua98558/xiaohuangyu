'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Users,
  ClipboardList,
  TrendingUp,
  MapPin,
  RefreshCw,
  Settings,
  Clock,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import {
  getSupplyDemandStats,
  getOnlineUserStats,
  getExposureConfig,
  getExposureTrend,
  type SupplyDemandStats,
  type OnlineUserStats,
  type ExposureConfig,
  type TrendDataPoint,
} from '@/lib/api'

// 城市热力图数据类型  
interface CityHeatmapData {
  city: string
  users: number
  color: string
}

// 默认数据，确保页面立即有内容显示
const DEFAULT_SUPPLY_STATS: SupplyDemandStats = {
  totalOnlineUsers: 0,
  availableUsers: 0,
  totalPendingTasks: 0,
  supplyDemandRatio: 0,
  avgSelectionScore: 50,
  onlineByLevel: {},
  tasksByStatus: {},
}

const DEFAULT_ONLINE_STATS: OnlineUserStats = {
  total: 0,
  byLevel: {},
  byCity: {},
  byProvince: {},
  peakToday: 0,
  peakTime: null,
  avgOnlineTime: 0,
}

export default function ExposureOverviewPage() {
  // 使用默认值初始化，确保页面立即有内容
  const [supplyDemandStats, setSupplyDemandStats] = useState<SupplyDemandStats>(DEFAULT_SUPPLY_STATS)
  const [onlineStats, setOnlineStats] = useState<OnlineUserStats>(DEFAULT_ONLINE_STATS)
  const [config, setConfig] = useState<ExposureConfig | null>(null)
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [cityHeatmap, setCityHeatmap] = useState<CityHeatmapData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  
  const isFirstLoad = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 从统计数据生成城市热力图
  const updateCityHeatmap = useCallback((stats: OnlineUserStats) => {
    if (!stats?.byCity) {
      setCityHeatmap([])
      return
    }
    
    const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9']
    const entries = Object.entries(stats.byCity)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    
    setCityHeatmap(entries.map(([city, users], index) => ({
      city,
      users,
      color: colors[index % colors.length]
    })))
  }, [])

  // 数据获取（无感刷新）
  const fetchData = useCallback(async (isManualRefresh = false) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    
    // 只有手动刷新才显示刷新状态
    if (isManualRefresh) {
      setIsRefreshing(true)
    }
    
    try {
      // 并行请求所有数据
      const [supplyDemand, online, cfg, trend] = await Promise.all([
        getSupplyDemandStats().catch(() => null),
        getOnlineUserStats().catch(() => null),
        getExposureConfig().catch(() => null),
        getExposureTrend().catch(() => []),
      ])
      
      // 检查是否被取消
      if (abortControllerRef.current?.signal.aborted) return
      
      // 更新数据（React会智能diff，只更新变化的部分）
      if (supplyDemand) setSupplyDemandStats(supplyDemand)
      if (online) {
        setOnlineStats(online)
        updateCityHeatmap(online)
      }
      if (cfg) setConfig(cfg)
      if (trend && trend.length > 0) setTrendData(trend)
      
      setLastUpdate(new Date())
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      console.error('Failed to fetch exposure data:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
      isFirstLoad.current = false
    }
  }, [updateCityHeatmap])

  // 初始化
  useEffect(() => {
    fetchData()
    
    // 30秒自动刷新（无感）
    const interval = setInterval(() => {
      fetchData(false)
    }, 30000)
    
    return () => {
      clearInterval(interval)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData])

  // 手动刷新
  const handleRefresh = () => {
    fetchData(true)
  }

  // 获取曝光模式显示名称
  const getExposureModeName = (mode?: string) => {
    const modeMap: Record<string, string> = {
      'parallel': '并行分配',
      'sequential': '顺序分配',
      'priority': '优先级分配',
      'global_pool': '全局池',
      'city_pool': '城市池',
    }
    return modeMap[mode || ''] || mode || '智能分配'
  }

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">曝光总览</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            实时监控任务曝光分配系统运行状态
            {lastUpdate && !isFirstLoad.current && (
              <span className="text-xs text-muted-foreground/60">
                更新于 {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            {isRefreshing && (
              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">在线用户</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {onlineStats?.total ?? supplyDemandStats?.totalOnlineUsers ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              当前活跃用户数
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待分配任务</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {supplyDemandStats?.totalPendingTasks ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              等待领取的任务
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">供需比例</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {supplyDemandStats?.supplyDemandRatio?.toFixed(2) ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              用户/任务比率
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">曝光模式</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {getExposureModeName(config?.exposureMode)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              点击配置更改模式
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 趋势图表和城市分布 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 24小时趋势 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              24小时趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="onlineUsers" 
                    stackId="1"
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                    name="在线用户" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="claims" 
                    stackId="2"
                    stroke="#22c55e" 
                    fill="#22c55e" 
                    fillOpacity={0.3}
                    name="任务领取" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {isLoading ? '加载中...' : '暂无趋势数据'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 城市分布热力图 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              用户城市分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cityHeatmap.length > 0 ? (
              <div className="space-y-3">
                {cityHeatmap.map((item) => (
                  <div key={item.city} className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="w-16 text-sm flex-shrink-0">{item.city}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 min-w-[60px]">
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.max(5, Math.min(100, (item.users / Math.max(1, Math.max(...cityHeatmap.map(c => c.users)))) * 100))}%`,
                          backgroundColor: item.color 
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right flex-shrink-0">
                      {item.users}人
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {isLoading ? '加载中...' : '暂无城市分布数据'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/exposure/tasks">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-blue-500" />
                <span className="font-medium">任务曝光队列</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/admin/exposure/users">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-green-500" />
                <span className="font-medium">用户曝光详情</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/admin/settings">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-purple-500" />
                <span className="font-medium">曝光配置</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
