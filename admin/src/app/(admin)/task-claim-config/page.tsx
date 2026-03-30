'use client'

import { useEffect, useState, useCallback } from 'react'
import { 
  SystemConfig, 
  LevelConfig, 
  getSystemConfigs, 
  updateSystemConfig, 
  getLevelConfigs, 
  updateLevelConfig,
  ExposureConfig,
  getExposureConfig,
  updateExposureConfig,
  ExposureQueueItem,
  getExposureQueue,
  unlockTaskExposure,
  getSupplyDemandStats,
  getOnlineUserStats,
  getOnlineUserSnapshot,
  updateCityExposureLimit,
  refreshExposureStats,
  triggerExposureCheck,
  triggerOfflineBufferCheck,
  SupplyDemandStats,
  OnlineUserStats,
  OnlineUserInfo,
} from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Save,
  Clock,
  Users,
  Shield,
  Zap,
  Eye,
  Unlock,
  ListOrdered,
  RefreshCw,
  TrendingUp,
  Activity,
  Play,
  BarChart3,
} from 'lucide-react'

// 系统默认配置
const DEFAULT_CONFIG: ExposureConfig = {
  initialCoefficient: 1.0,
  initialMinExtra: 5,
  initialMaxExtra: 10,
  maxCoefficient: 3.0,
  checkIntervalMinutes: 5,
  addRatioHigh: 0.3,
  addRatioMid: 0.5,
  addRatioLow: 1.0,
  rateThresholdHigh: 0.7,
  rateThresholdMid: 0.4,
  rateThresholdLow: 0.2,
  exposureMode: 'priority',
  sequentialThreshold: 0.8,
  exposureWindow: 9999,
  cityExposureLimit: 3,
  provinceExposureLimit: 10,
  reservedExposureQuota: 3,
  heartbeatTimeout: 120,
  offlineBufferTime: 300,
  exposureAllocationInterval: 300,
  priorityMode: {
    whitelistBonus: 100,
    blacklistPenalty: -50,
    activityWeight: 0.4,
    speedWeight: 0.3,
    completionWeight: 0.3,
    freshnessWeight: 1,
    remainWeight: 1,
    cityMatchWeight: 1,
  },
}

// 等级默认配置（7个等级）
const DEFAULT_LEVELS = [
  { level: 1, name: '新手', coefficient: 1.0, concurrentTasks: 2, exposureLimit: 5, regularExposureQuota: 3, levelWeight: 1 },
  { level: 2, name: '初级', coefficient: 1.2, concurrentTasks: 3, exposureLimit: 7, regularExposureQuota: 5, levelWeight: 2 },
  { level: 3, name: '中级', coefficient: 1.5, concurrentTasks: 4, exposureLimit: 10, regularExposureQuota: 7, levelWeight: 3 },
  { level: 4, name: '高级', coefficient: 1.8, concurrentTasks: 5, exposureLimit: 12, regularExposureQuota: 8, levelWeight: 4 },
  { level: 5, name: '资深', coefficient: 2.0, concurrentTasks: 6, exposureLimit: 15, regularExposureQuota: 10, levelWeight: 5 },
  { level: 6, name: '专家', coefficient: 2.5, concurrentTasks: 8, exposureLimit: 18, regularExposureQuota: 12, levelWeight: 6 },
  { level: 7, name: '大师', coefficient: 3.0, concurrentTasks: 10, exposureLimit: 20, regularExposureQuota: 15, levelWeight: 7 },
]

// 完成率颜色
function getCompletionColor(rate: number): string {
  if (rate >= 0.8) return 'text-green-600'
  if (rate >= 0.5) return 'text-yellow-600'
  return 'text-red-600'
}

function getExposureModeSummary(mode: ExposureConfig['exposureMode']) {
  switch (mode) {
    case 'priority':
      return {
        title: '优先级曝光',
        description: '当前模式会先按用户优先级、曝光额度、城市曝光上限与并发条件筛选，再决定任务大厅里每个用户看到哪些任务与先后顺序；任务自己的城市/省份名额在领取时再校验。',
      }
    case 'parallel':
      return {
        title: '并行曝光',
        description: '所有满足基础条件的任务同时曝光，不按前序任务完成率逐个解锁，适合任务量不大或希望同时放量的场景。',
      }
    case 'sequential':
      return {
        title: '顺序曝光',
        description: '任务按曝光队列逐步解锁，前一个任务达到完成率阈值后，后续任务才会继续放开。',
      }
    default:
      return {
        title: '曝光模式',
        description: '系统按当前后台配置执行曝光分配。',
      }
  }
}

function getExposureModeRecommendation(mode: ExposureConfig['exposureMode']) {
  switch (mode) {
    case 'priority':
      return {
        useFor: '任务量较大、用户层级差异明显、希望系统自动按优先级分发时使用。',
        avoidFor: '如果你要严格控制“前一个任务完成后才放下一个任务”，就不适合继续用这个模式。',
      }
    case 'sequential':
      return {
        useFor: '需要严格控节奏、按队列逐步放量、避免多个任务同时抢量时使用。',
        avoidFor: '任务量大且希望快速铺量时，不建议用过窄的顺序曝光。',
      }
    case 'parallel':
      return {
        useFor: '任务量较少，或者你希望所有可做任务同时放开时使用。',
        avoidFor: '想精细控量、控顺序、控用户优先级时，不建议长期使用。',
      }
    default:
      return {
        useFor: '按当前后台策略执行。',
        avoidFor: '如需更强的控量，请明确选择一种曝光模式。',
      }
  }
}

// 系统配置默认值
const SYSTEM_DEFAULTS: Record<string, string> = {
  task_timeout_minutes: '30',
  max_time_limit_minutes: '60',
  max_concurrent_per_user: '3',
  city_limit_per_task: '3',
  province_limit_per_task: '10',
}

export default function TaskClaimConfigPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [levels, setLevels] = useState<LevelConfig[]>([])
  const [exposureConfig, setExposureConfig] = useState<ExposureConfig>(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('basic')
  
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  const [editedLevels, setEditedLevels] = useState<Record<number, Partial<LevelConfig>>>({})
  const [editedExposure, setEditedExposure] = useState<Partial<ExposureConfig>>({})
  
  const [queue, setQueue] = useState<ExposureQueueItem[]>([])
  const [supplyDemandStats, setSupplyDemandStats] = useState<SupplyDemandStats | null>(null)
  const [onlineStats, setOnlineStats] = useState<OnlineUserStats | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserInfo[]>([])
  const [showOnlineUsersDialog, setShowOnlineUsersDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [configData, levelData, exposureData, queueData, supplyDemand, online, onlineSnapshot] = await Promise.all([
        getSystemConfigs(),
        getLevelConfigs(),
        getExposureConfig(),
        getExposureQueue().catch(() => ({ queue: [] })),
        getSupplyDemandStats().catch(() => null),
        getOnlineUserStats().catch(() => null),
        getOnlineUserSnapshot().catch(() => null),
      ])
      setConfigs(configData)
      setLevels(levelData.length > 0 ? levelData : DEFAULT_LEVELS as unknown as LevelConfig[])
      setExposureConfig({ ...DEFAULT_CONFIG, ...exposureData })
      setQueue(queueData.queue || [])
      setSupplyDemandStats(supplyDemand)
      setOnlineStats(online)
      setOnlineUsers(onlineSnapshot?.users || [])
    } catch (err) {
      console.error('加载配置失败', err)
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      Promise.all([
        getOnlineUserStats().catch(() => null),
        getSupplyDemandStats().catch(() => null),
      ]).then(([online, supply]) => {
        if (online) setOnlineStats(online)
        if (supply) setSupplyDemandStats(supply)
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleSaveConfig = async (key: string) => {
    const newValue = editedValues[key]
    if (newValue === undefined) return
    setIsSaving(key)
    try {
      await updateSystemConfig(key, newValue)
      setConfigs(configs.map(c => c.key === key ? { ...c, value: newValue } : c))
      setEditedValues(prev => { const n = { ...prev }; delete n[key]; return n })
    } catch (err) {
      console.error('保存失败', err)
      alert('保存失败')
    } finally {
      setIsSaving(null)
    }
  }
  
  const handleSaveAllLevels = async () => {
    setIsSaving('all-levels')
    try {
      for (const level of Object.keys(editedLevels)) {
        const levelNum = parseInt(level)
        const newValues = editedLevels[levelNum]
        if (newValues) {
          const updated = await updateLevelConfig(levelNum, newValues)
          setLevels(prev => prev.map(l => l.level === levelNum ? updated : l))
        }
      }
      setEditedLevels({})
      alert('保存成功')
    } catch (err) {
      console.error('保存失败', err)
      alert('保存失败')
    } finally {
      setIsSaving(null)
    }
  }
  
  const handleSaveExposure = async () => {
    if (Object.keys(editedExposure).length === 0) return
    setIsSaving('exposure')
    try {
      const updated = await updateExposureConfig(editedExposure)
      setExposureConfig({ ...DEFAULT_CONFIG, ...updated })
      setEditedExposure({})
      alert('保存成功')
    } catch (err) {
      console.error('保存失败', err)
      alert('保存失败')
    } finally {
      setIsSaving(null)
    }
  }
  
  const handleUnlock = async (taskId: number) => {
    try {
      await unlockTaskExposure(taskId)
      const queueData = await getExposureQueue()
      setQueue(queueData.queue)
    } catch (err) {
      console.error('解锁失败', err)
      alert('解锁失败')
    }
  }
  
  const handleRefresh = async () => {
    try {
      const [queueData, supplyDemand, online] = await Promise.all([
        getExposureQueue(),
        getSupplyDemandStats().catch(() => null),
        getOnlineUserStats().catch(() => null),
      ])
      setQueue(queueData.queue)
      if (supplyDemand) setSupplyDemandStats(supplyDemand)
      if (online) setOnlineStats(online)
    } catch (err) {
      console.error('刷新失败', err)
    }
  }
  
  const handleAction = async (action: string) => {
    setActionLoading(action)
    try {
      switch (action) {
        case 'refresh': await refreshExposureStats(); break
        case 'check': await triggerExposureCheck(); break
        case 'offlineBuffer': await triggerOfflineBufferCheck(); break
        case 'cityLimit':
          const cityLimit = (editedExposure.cityExposureLimit ?? exposureConfig.cityExposureLimit) || 3
          await updateCityExposureLimit(cityLimit)
          break
      }
      await handleRefresh()
      alert('操作执行成功')
    } catch (err) {
      console.error('操作失败', err)
      alert('操作失败')
    } finally {
      setActionLoading(null)
    }
  }
  
  const getConfigValue = (key: string): string => {
    return editedValues[key] ?? configs.find(c => c.key === key)?.value ?? SYSTEM_DEFAULTS[key] ?? ''
  }
  
  const getLevelValue = <K extends keyof LevelConfig>(level: number, field: K): LevelConfig[K] => {
    const defaultLevel = DEFAULT_LEVELS.find(l => l.level === level)
    return editedLevels[level]?.[field] ?? levels.find(l => l.level === level)?.[field] ?? (defaultLevel?.[field as keyof typeof defaultLevel] ?? 0) as LevelConfig[K]
  }
  
  const getExposureValue = <K extends keyof ExposureConfig>(field: K): ExposureConfig[K] => {
    return editedExposure[field] ?? exposureConfig[field] ?? DEFAULT_CONFIG[field]
  }
  
  const getPriorityValue = (field: keyof NonNullable<ExposureConfig['priorityMode']>): number => {
    const priorityMode = editedExposure.priorityMode ?? exposureConfig.priorityMode ?? DEFAULT_CONFIG.priorityMode!
    return priorityMode[field] ?? DEFAULT_CONFIG.priorityMode![field]
  }
  
  // 更新优先级模式
  const updatePriorityMode = (field: keyof NonNullable<ExposureConfig['priorityMode']>, value: number) => {
    setEditedExposure(prev => ({
      ...prev,
      priorityMode: {
        ...prev.priorityMode,
        ...exposureConfig.priorityMode,
        [field]: value,
      } as NonNullable<ExposureConfig['priorityMode']>
    }))
  }

  const currentExposureMode = getExposureValue('exposureMode')
  const exposureModeSummary = getExposureModeSummary(currentExposureMode)
  const exposureModeRecommendation = getExposureModeRecommendation(currentExposureMode)

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">任务领取配置</h1>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>
      
      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">在线用户</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">可用: {supplyDemandStats?.availableUsers || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">供需比</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supplyDemandStats?.supplyDemandRatio?.toFixed(2) || '-'}</div>
            <Progress value={Math.min((supplyDemandStats?.supplyDemandRatio || 0) * 50, 100)} className="mt-2 h-1" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理任务</CardTitle>
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queue.length}</div>
            <p className="text-xs text-muted-foreground">曝光队列</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">曝光模式</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getExposureValue('exposureMode') === 'priority' ? '优先级' : getExposureValue('exposureMode') === 'sequential' ? '顺序' : '并行'}
            </div>
            <p className="text-xs text-muted-foreground">城市限制: {getExposureValue('cityExposureLimit')}人 / 省份限制: {getExposureValue('provinceExposureLimit')}人</p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic"><Clock className="h-4 w-4 mr-2" />基础配置</TabsTrigger>
          <TabsTrigger value="level"><Users className="h-4 w-4 mr-2" />等级权益</TabsTrigger>
          <TabsTrigger value="exposure"><Eye className="h-4 w-4 mr-2" />曝光策略</TabsTrigger>
          <TabsTrigger value="system"><Zap className="h-4 w-4 mr-2" />系统操作</TabsTrigger>
        </TabsList>

        {/* 基础配置 */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />时间限制</CardTitle>
              <CardDescription>任务领取后的完成时间限制</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>领取默认超时（分钟）</Label>
                <div className="flex gap-2">
                  <Input type="number" min="1" max="60" value={getConfigValue('task_timeout_minutes')} 
                    onChange={e => setEditedValues(prev => ({ ...prev, task_timeout_minutes: e.target.value }))} />
                  <Button size="sm" variant="outline" onClick={() => handleSaveConfig('task_timeout_minutes')} 
                    disabled={isSaving === 'task_timeout_minutes'}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">领取任务后默认完成时限；系统实际联动到运行时默认超时。默认: {SYSTEM_DEFAULTS.task_timeout_minutes}分钟</p>
              </div>
              <div className="space-y-2">
                <Label>发布默认时限（分钟）</Label>
                <div className="flex gap-2">
                  <Input type="number" min="5" max="120" value={getConfigValue('max_time_limit_minutes')} 
                    onChange={e => setEditedValues(prev => ({ ...prev, max_time_limit_minutes: e.target.value }))} />
                  <Button size="sm" variant="outline" onClick={() => handleSaveConfig('max_time_limit_minutes')} 
                    disabled={isSaving === 'max_time_limit_minutes'}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">用于任务发布表单默认时长。默认: {SYSTEM_DEFAULTS.max_time_limit_minutes}分钟</p>
              </div>
              <div className="space-y-2">
                <Label>心跳超时（秒）</Label>
                <div className="flex gap-2">
                  <Input type="number" min="30" max="300" value={getExposureValue('heartbeatTimeout')} 
                    onChange={e => setEditedExposure(prev => ({ ...prev, heartbeatTimeout: parseInt(e.target.value) }))} />
                  <Button size="sm" variant="outline" onClick={handleSaveExposure} disabled={isSaving === 'exposure'}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">默认: {DEFAULT_CONFIG.heartbeatTimeout}秒</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />领取限制</CardTitle>
              <CardDescription>用户领取任务的数量限制</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>全局默认并发任务数</Label>
                <div className="flex gap-2">
                  <Input type="number" min="1" max="20" value={getConfigValue('max_concurrent_per_user')} 
                    onChange={e => setEditedValues(prev => ({ ...prev, max_concurrent_per_user: e.target.value }))} />
                  <Button size="sm" variant="outline" onClick={() => handleSaveConfig('max_concurrent_per_user')} 
                    disabled={isSaving === 'max_concurrent_per_user'}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">等级配置优先；当等级未配置并发时，用这个值兜底。默认: {SYSTEM_DEFAULTS.max_concurrent_per_user}</p>
              </div>
              <div className="space-y-2">
                <Label>发布默认每城市限制人数</Label>
                <div className="flex gap-2">
                  <Input type="number" min="1" max="20" value={getConfigValue('city_limit_per_task')} 
                    onChange={e => setEditedValues(prev => ({ ...prev, city_limit_per_task: e.target.value }))} />
                  <Button size="sm" variant="outline" onClick={() => handleSaveConfig('city_limit_per_task')} 
                    disabled={isSaving === 'city_limit_per_task'}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">用于新建任务时的默认城市领取限制。默认: {SYSTEM_DEFAULTS.city_limit_per_task}</p>
              </div>
              <div className="space-y-2">
                <Label>发布默认每省份限制人数</Label>
                <div className="flex gap-2">
                  <Input type="number" min="1" max="50" value={getConfigValue('province_limit_per_task')} 
                    onChange={e => setEditedValues(prev => ({ ...prev, province_limit_per_task: e.target.value }))} />
                  <Button size="sm" variant="outline" onClick={() => handleSaveConfig('province_limit_per_task')} 
                    disabled={isSaving === 'province_limit_per_task'}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">用于新建任务时的默认省份领取限制。默认: {SYSTEM_DEFAULTS.province_limit_per_task}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 等级权益 */}
        <TabsContent value="level" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />等级权益配置</CardTitle>
                <CardDescription>7个等级的任务领取权益配置</CardDescription>
              </div>
              <Button onClick={handleSaveAllLevels} disabled={isSaving === 'all-levels' || Object.keys(editedLevels).length === 0}>
                <Save className="h-4 w-4 mr-2" />{isSaving === 'all-levels' ? '保存中...' : '保存所有'}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>等级</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>收益系数</TableHead>
                    <TableHead>并发任务</TableHead>
                    <TableHead>曝光上限</TableHead>
                    <TableHead>常规额度</TableHead>
                    <TableHead>权重</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1,2,3,4,5,6,7].map(level => (
                    <TableRow key={level}>
                      <TableCell><Badge>Lv.{level}</Badge></TableCell>
                      <TableCell>
                        <Input className="w-20 h-8" value={getLevelValue(level, 'name') as string} 
                          onChange={e => setEditedLevels(prev => ({ ...prev, [level]: { ...prev[level], name: e.target.value } }))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.1" className="w-16 h-8" value={getLevelValue(level, 'coefficient')} 
                          onChange={e => setEditedLevels(prev => ({ ...prev, [level]: { ...prev[level], coefficient: parseFloat(e.target.value) } }))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" max="20" className="w-16 h-8" value={getLevelValue(level, 'concurrentTasks')} 
                          onChange={e => setEditedLevels(prev => ({ ...prev, [level]: { ...prev[level], concurrentTasks: parseInt(e.target.value) } }))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" max="30" className="w-16 h-8" value={getLevelValue(level, 'exposureLimit')} 
                          onChange={e => setEditedLevels(prev => ({ ...prev, [level]: { ...prev[level], exposureLimit: parseInt(e.target.value) } }))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" max="20" className="w-16 h-8" value={getLevelValue(level, 'regularExposureQuota')} 
                          onChange={e => setEditedLevels(prev => ({ ...prev, [level]: { ...prev[level], regularExposureQuota: parseInt(e.target.value) } }))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" max="10" className="w-16 h-8" value={getLevelValue(level, 'levelWeight')} 
                          onChange={e => setEditedLevels(prev => ({ ...prev, [level]: { ...prev[level], levelWeight: parseInt(e.target.value) } }))} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 曝光策略 */}
        <TabsContent value="exposure" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />曝光模式配置</CardTitle>
              <CardDescription>选择任务曝光策略</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>曝光模式</Label>
                  <Select value={getExposureValue('exposureMode')} onValueChange={v => setEditedExposure(prev => ({ ...prev, exposureMode: v as ExposureConfig['exposureMode'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">优先级曝光</SelectItem>
                      <SelectItem value="parallel">并行曝光</SelectItem>
                      <SelectItem value="sequential">顺序曝光</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">优先级：按用户优先级分配 | 并行：所有任务同时曝光 | 顺序：按完成率解锁</p>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="text-sm font-medium">{exposureModeSummary.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{exposureModeSummary.description}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">当前生效模式：{currentExposureMode}</Badge>
                      <Badge variant="outline">共享参数始终生效</Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div>适合：{exposureModeRecommendation.useFor}</div>
                      <div>不适合：{exposureModeRecommendation.avoidFor}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>城市曝光限制</Label>
                  <div className="flex gap-2">
                    <Input type="number" min="1" max="10" value={getExposureValue('cityExposureLimit')} 
                      onChange={e => setEditedExposure(prev => ({ ...prev, cityExposureLimit: parseInt(e.target.value) }))} />
                    <Button size="sm" variant="outline" onClick={() => handleAction('cityLimit')} disabled={actionLoading === 'cityLimit'}>应用</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">同一城市最多可曝光人数，默认: {DEFAULT_CONFIG.cityExposureLimit}</p>
                </div>
                <div className="space-y-2">
                  <Label>省份曝光限制</Label>
                  <Input type="number" min="1" max="50" value={getExposureValue('provinceExposureLimit')}
                    onChange={e => setEditedExposure(prev => ({ ...prev, provinceExposureLimit: parseInt(e.target.value) }))} />
                  <p className="text-xs text-muted-foreground">同一省份最多可曝光人数，默认: {DEFAULT_CONFIG.provinceExposureLimit}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />共享曝光参数</CardTitle>
              <CardDescription>这些参数不管选哪种曝光模式都会影响曝光容量或分配节奏</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>高完成率阈值</Label>
                <Input type="number" step="0.1" min="0" max="1" value={getExposureValue('rateThresholdHigh')} 
                  onChange={e => setEditedExposure(prev => ({ ...prev, rateThresholdHigh: parseFloat(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">高于该完成率时，系统倾向于不再追加曝光</p>
              </div>
              <div className="space-y-2">
                <Label>中完成率阈值</Label>
                <Input type="number" step="0.1" min="0" max="1" value={getExposureValue('rateThresholdMid')} 
                  onChange={e => setEditedExposure(prev => ({ ...prev, rateThresholdMid: parseFloat(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">中等完成率时，按较低比例追加曝光</p>
              </div>
              <div className="space-y-2">
                <Label>低完成率阈值</Label>
                <Input type="number" step="0.1" min="0" max="1" value={getExposureValue('rateThresholdLow')} 
                  onChange={e => setEditedExposure(prev => ({ ...prev, rateThresholdLow: parseFloat(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">低于该阈值时，系统会更积极追加曝光</p>
              </div>
            </CardContent>
          </Card>
          
          {currentExposureMode === 'priority' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />优先级权重配置</CardTitle>
              <CardDescription>仅在优先级曝光模式下生效，用于决定用户看到任务的先后顺序</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>活跃权重</Label>
                <Input type="number" step="0.1" min="0" max="1" value={getPriorityValue('activityWeight')} 
                  onChange={e => updatePriorityMode('activityWeight', parseFloat(e.target.value))} />
                <p className="text-xs text-muted-foreground">默认: {DEFAULT_CONFIG.priorityMode!.activityWeight}</p>
              </div>
              <div className="space-y-2">
                <Label>速度权重</Label>
                <Input type="number" step="0.1" min="0" max="1" value={getPriorityValue('speedWeight')} 
                  onChange={e => updatePriorityMode('speedWeight', parseFloat(e.target.value))} />
                <p className="text-xs text-muted-foreground">默认: {DEFAULT_CONFIG.priorityMode!.speedWeight}</p>
              </div>
              <div className="space-y-2">
                <Label>完成率权重</Label>
                <Input type="number" step="0.1" min="0" max="1" value={getPriorityValue('completionWeight')} 
                  onChange={e => updatePriorityMode('completionWeight', parseFloat(e.target.value))} />
                <p className="text-xs text-muted-foreground">默认: {DEFAULT_CONFIG.priorityMode!.completionWeight}</p>
              </div>
              <div className="space-y-2">
                <Label>任务新鲜度权重</Label>
                <Input type="number" step="0.1" min="0" max="5" value={getPriorityValue('freshnessWeight')}
                  onChange={e => updatePriorityMode('freshnessWeight', parseFloat(e.target.value))} />
                <p className="text-xs text-muted-foreground">控制新任务加权和老任务降权幅度，默认: {DEFAULT_CONFIG.priorityMode!.freshnessWeight}</p>
              </div>
              <div className="space-y-2">
                <Label>剩余名额权重</Label>
                <Input type="number" step="0.1" min="0" max="5" value={getPriorityValue('remainWeight')}
                  onChange={e => updatePriorityMode('remainWeight', parseFloat(e.target.value))} />
                <p className="text-xs text-muted-foreground">控制剩余名额多寡对排序的影响，默认: {DEFAULT_CONFIG.priorityMode!.remainWeight}</p>
              </div>
              <div className="space-y-2">
                <Label>城市匹配权重</Label>
                <Input type="number" step="0.1" min="0" max="5" value={getPriorityValue('cityMatchWeight')}
                  onChange={e => updatePriorityMode('cityMatchWeight', parseFloat(e.target.value))} />
                <p className="text-xs text-muted-foreground">控制同城/同省任务对用户的优先展示力度，默认: {DEFAULT_CONFIG.priorityMode!.cityMatchWeight}</p>
              </div>
            </CardContent>
          </Card>
          )}
          
          {currentExposureMode === 'sequential' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5" />顺序曝光参数</CardTitle>
              <CardDescription>仅在顺序曝光模式下生效，用于控制任务解锁节奏</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>顺序解锁阈值</Label>
                <Input type="number" step="0.05" min="0" max="1" value={getExposureValue('sequentialThreshold')}
                  onChange={e => setEditedExposure(prev => ({ ...prev, sequentialThreshold: parseFloat(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">前一个任务达到该完成率后，后续任务才会解锁。腾讯云当前值：0.8。</p>
              </div>
              <div className="space-y-2">
                <Label>曝光窗口</Label>
                <Input type="number" min="1" max="9999" value={getExposureValue('exposureWindow')}
                  onChange={e => setEditedExposure(prev => ({ ...prev, exposureWindow: parseInt(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">同一时刻最多允许多少个顺序任务处于可曝光窗口。值越小，节奏越严格。</p>
              </div>
            </CardContent>
          </Card>
          )}

          {currentExposureMode === 'parallel' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />并行曝光说明</CardTitle>
              <CardDescription>并行模式下不会按顺序阈值解锁任务，更多依赖共享参数、地域限制和基础曝光容量</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>曝光窗口</Label>
                <Input type="number" min="1" max="9999" value={getExposureValue('exposureWindow')}
                  onChange={e => setEditedExposure(prev => ({ ...prev, exposureWindow: parseInt(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">并行模式下一般不需要把窗口收得太小，否则会失去“同时放开”的意义。</p>
              </div>
              <div className="space-y-2">
                <Label>分配检查间隔（秒）</Label>
                <Input type="number" min="30" max="3600" value={getExposureValue('exposureAllocationInterval')}
                  onChange={e => setEditedExposure(prev => ({ ...prev, exposureAllocationInterval: parseInt(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">值越小，系统越频繁检查和补充曝光；值越大，节奏越平缓。</p>
              </div>
            </CardContent>
          </Card>
          )}
          
          <div className="flex justify-end">
            <Button onClick={handleSaveExposure} disabled={isSaving === 'exposure' || Object.keys(editedExposure).length === 0}>
              <Save className="h-4 w-4 mr-2" />{isSaving === 'exposure' ? '保存中...' : '保存曝光配置'}
            </Button>
          </div>
        </TabsContent>

        {/* 系统操作 */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />快捷操作</CardTitle>
              <CardDescription>执行系统管理操作</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" onClick={() => handleAction('refresh')} disabled={actionLoading === 'refresh'}>
                <RefreshCw className={'h-4 w-4 mr-2' + (actionLoading === 'refresh' ? ' animate-spin' : '')} />刷新统计
              </Button>
              <Button variant="outline" onClick={() => handleAction('check')} disabled={actionLoading === 'check'}>
                <Play className="h-4 w-4 mr-2" />触发曝光检查
              </Button>
              <Button variant="outline" onClick={() => handleAction('offlineBuffer')} disabled={actionLoading === 'offlineBuffer'}>
                <Activity className="h-4 w-4 mr-2" />检查离线缓冲
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />在线用户监控</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>当前在线: <span className="font-bold text-green-600">{onlineStats?.total || 0}</span> 人</div>
                <Button variant="outline" size="sm" onClick={() => setShowOnlineUsersDialog(true)}>查看详情</Button>
              </div>
              {onlineStats && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">按等级分布</p>
                    <div className="mt-2 space-y-1">
                      {Object.entries(onlineStats.byLevel || {}).map(([level, count]) => (
                        <div key={level} className="flex justify-between text-sm"><span>Lv.{level}</span><Badge variant="secondary">{count}</Badge></div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">按省份 TOP5</p>
                    <div className="mt-2 space-y-1">
                      {Object.entries(onlineStats.byProvince || {}).slice(0, 5).map(([province, count]) => (
                        <div key={province} className="flex justify-between text-sm"><span>{province}</span><Badge variant="secondary">{count}</Badge></div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">按城市 TOP5</p>
                    <div className="mt-2 space-y-1">
                      {Object.entries(onlineStats.byCity || {}).slice(0, 5).map(([city, count]) => (
                        <div key={city} className="flex justify-between text-sm"><span>{city}</span><Badge variant="secondary">{count}</Badge></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5" />曝光队列</CardTitle>
            </CardHeader>
            <CardContent>
              {queue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暂无待处理任务</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务ID</TableHead>
                      <TableHead>标题</TableHead>
                      <TableHead>完成率</TableHead>
                      <TableHead>曝光率</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.slice(0, 10).map(item => (
                      <TableRow key={item.taskId}>
                        <TableCell>{item.taskId}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.task?.title}</TableCell>
                        <TableCell className={getCompletionColor(item.completionRate)}>{(item.completionRate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(item.exposureRate * 100).toFixed(1)}%</TableCell>
                        <TableCell>
                          <Badge variant={item.unlocked ? 'default' : 'secondary'}>{item.unlocked ? '已解锁' : '锁定'}</Badge>
                        </TableCell>
                        <TableCell>
                          {!item.unlocked && (
                            <Button size="sm" variant="ghost" onClick={() => handleUnlock(item.taskId)}><Unlock className="h-4 w-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog open={showOnlineUsersDialog} onOpenChange={setShowOnlineUsersDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>在线用户详情</DialogTitle>
            <DialogDescription>共 {onlineUsers.length} 人在线</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>用户</TableHead><TableHead>等级</TableHead><TableHead>城市</TableHead><TableHead>在线时长</TableHead></TableRow></TableHeader>
              <TableBody>
                {onlineUsers.slice(0, 50).map(user => (
                  <TableRow key={user.userId}>
                    <TableCell>{user.username}</TableCell>
                    <TableCell><Badge>Lv.{user.level}</Badge></TableCell>
                    <TableCell>{user.city || '-'}</TableCell>
                    <TableCell>{Math.floor(user.onlineDuration / 60)}分钟</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
