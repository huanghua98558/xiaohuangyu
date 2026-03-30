'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Moon,
  Sun,
  Users,
  Save,
  RefreshCw,
  Activity,
} from 'lucide-react'

// API 基础路径 - 运行时动态获取（不依赖构建时环境变量）
const getApiBase = (): string => {
  if (typeof window === 'undefined') return '/admin/api'
  
  const { hostname } = window.location
  // 本地开发环境：直接访问后端 5000 端口
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000'
  }
  // 远程/沙盒环境：使用相对路径，由代理转发到后端
  return '/admin/api'
}

let API_BASE = ''
if (typeof window !== 'undefined') {
  API_BASE = getApiBase()
}

// 类型定义
interface NightPointConfig {
  time_start: number
  time_end: number
  base_coefficient: number
  max_coefficient: number
  no_accept_bonus: number
  is_active: boolean
}

interface CoefficientMap {
  id: number
  online_users_max: number
  coefficient: number
  description: string
  sort_order: number
}

interface OnlineStats {
  total: number
  active5min: number
  byLevel: Record<number, number>
  timestamp: string
}

interface CurrentCoefficient {
  isNight: boolean
  onlineUsers: number
  coefficient: number
  basePoints: number
  displayPoints: number
  desc: string
}

// API 调用函数
async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('admin_token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options?.headers,
    },
  })
  
  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`)
  }
  
  const data = await res.json()
  return data.data
}

export default function NightPointsPage() {
  const [config, setConfig] = useState<NightPointConfig | null>(null)
  const [coefficientMap, setCoefficientMap] = useState<CoefficientMap[]>([])
  const [onlineStats, setOnlineStats] = useState<OnlineStats | null>(null)
  const [currentCoefficient, setCurrentCoefficient] = useState<CurrentCoefficient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  
  // 编辑中的配置
  const [editedConfig, setEditedConfig] = useState<Partial<NightPointConfig>>({})
  const [editedCoefficients, setEditedCoefficients] = useState<Record<number, Partial<CoefficientMap>>>({})

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [configData, mapData, statsData, currentData] = await Promise.all([
        fetchAPI<NightPointConfig>('/night-points/config'),
        fetchAPI<CoefficientMap[]>('/night-points/coefficient-map'),
        fetchAPI<OnlineStats>('/night-points/online-stats'),
        fetchAPI<CurrentCoefficient>('/night-points/current-coefficient?basePoints=100'),
      ])
      setConfig(configData)
      setCoefficientMap(mapData)
      setOnlineStats(statsData)
      setCurrentCoefficient(currentData)
    } catch (err) {
      console.error('加载数据失败', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    
    // 每30秒刷新一次在线统计
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  // 保存配置
  const handleSaveConfig = async () => {
    setIsSaving('config')
    try {
      await fetchAPI('/night-points/config', {
        method: 'PUT',
        body: JSON.stringify(editedConfig),
      })
      await loadData()
      setEditedConfig({})
    } catch (err) {
      console.error('保存失败', err)
      alert('保存失败')
    } finally {
      setIsSaving(null)
    }
  }

  // 保存系数映射
  const handleSaveCoefficient = async (id: number) => {
    const patch = editedCoefficients[id]
    if (!patch || Object.keys(patch).length === 0) return
    
    setIsSaving(`map-${id}`)
    try {
      await fetchAPI(`/night-points/coefficient-map/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      })
      await loadData()
      const newEdited = { ...editedCoefficients }
      delete newEdited[id]
      setEditedCoefficients(newEdited)
    } catch (err) {
      console.error('保存失败', err)
      alert('保存失败')
    } finally {
      setIsSaving(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const isNight = currentCoefficient?.isNight

  return (
    <div className="space-y-6">
      {/* 当前状态 */}
      <Card className={isNight ? 'border-blue-500 bg-blue-50/10' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isNight ? (
              <>
                <Moon className="h-5 w-5 text-blue-500" />
                夜间时段
              </>
            ) : (
              <>
                <Sun className="h-5 w-5 text-yellow-500" />
                白天时段
              </>
            )}
          </CardTitle>
          <CardDescription>
            当前在线用户数和积分系数
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">在线用户</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                {onlineStats?.total || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">5分钟活跃</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {onlineStats?.active5min || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">当前系数</p>
              <p className="text-2xl font-bold">
                <Badge variant={isNight ? 'default' : 'secondary'} className="text-lg">
                  x{currentCoefficient?.coefficient || 1.0}
                </Badge>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">示例积分</p>
              <p className="text-2xl font-bold">
                {currentCoefficient?.displayPoints || 100}
                <span className="text-sm text-gray-500 ml-1">分</span>
              </p>
            </div>
          </div>
          {currentCoefficient?.desc && (
            <p className="text-sm text-gray-500 mt-4">{currentCoefficient.desc}</p>
          )}
        </CardContent>
      </Card>

      {/* 基础配置 */}
      <Card>
        <CardHeader>
          <CardTitle>夜间积分基础配置</CardTitle>
          <CardDescription>
            夜间时段定义和基础系数设置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>启用夜间积分</Label>
              <div className="flex h-10 items-center gap-3 rounded-md border px-3">
                <Switch
                  checked={editedConfig.is_active ?? config?.is_active ?? true}
                  onCheckedChange={(checked) => setEditedConfig({
                    ...editedConfig,
                    is_active: checked
                  })}
                />
                <span className="text-sm text-gray-600">
                  {editedConfig.is_active ?? config?.is_active ?? true ? '已启用' : '已停用'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>开始时间（小时）</Label>
              <Input
                type="number"
                value={editedConfig.time_start ?? config?.time_start ?? 0}
                onChange={(e) => setEditedConfig({
                  ...editedConfig,
                  time_start: parseInt(e.target.value)
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>结束时间（小时）</Label>
              <Input
                type="number"
                value={editedConfig.time_end ?? config?.time_end ?? 6}
                onChange={(e) => setEditedConfig({
                  ...editedConfig,
                  time_end: parseInt(e.target.value)
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>基础系数</Label>
              <Input
                type="number"
                step="0.1"
                value={editedConfig.base_coefficient ?? config?.base_coefficient ?? 1.4}
                onChange={(e) => setEditedConfig({
                  ...editedConfig,
                  base_coefficient: parseFloat(e.target.value)
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>最高系数</Label>
              <Input
                type="number"
                step="0.1"
                value={editedConfig.max_coefficient ?? config?.max_coefficient ?? 1.8}
                onChange={(e) => setEditedConfig({
                  ...editedConfig,
                  max_coefficient: parseFloat(e.target.value)
                })}
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>无人领取加成</Label>
            <Input
              type="number"
              step="0.05"
              className="w-32"
              value={editedConfig.no_accept_bonus ?? config?.no_accept_bonus ?? 0.1}
              onChange={(e) => setEditedConfig({
                ...editedConfig,
                no_accept_bonus: parseFloat(e.target.value)
              })}
            />
            <p className="text-xs text-gray-500">完全无人领取的任务额外增加的系数</p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleSaveConfig}
              disabled={isSaving === 'config' || Object.keys(editedConfig).length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 在线用户-系数映射 */}
      <Card>
        <CardHeader>
          <CardTitle>在线用户-系数映射</CardTitle>
          <CardDescription>
            根据在线用户数动态调整积分系数
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>在线用户上限</TableHead>
                <TableHead>积分系数</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>排序</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coefficientMap.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      className="w-28"
                      value={editedCoefficients[item.id]?.online_users_max ?? item.online_users_max}
                      onChange={(e) => setEditedCoefficients({
                        ...editedCoefficients,
                        [item.id]: {
                          ...editedCoefficients[item.id],
                          online_users_max: Number(e.target.value),
                        }
                      })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.05"
                        min="1"
                        max="2"
                        className="w-24"
                        value={editedCoefficients[item.id]?.coefficient ?? item.coefficient}
                        onChange={(e) => setEditedCoefficients({
                          ...editedCoefficients,
                          [item.id]: {
                            ...editedCoefficients[item.id],
                            coefficient: parseFloat(e.target.value)
                          }
                        })}
                      />
                      <Badge variant="outline">
                        x{editedCoefficients[item.id]?.coefficient ?? item.coefficient}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editedCoefficients[item.id]?.description ?? item.description}
                      onChange={(e) => setEditedCoefficients({
                        ...editedCoefficients,
                        [item.id]: {
                          ...editedCoefficients[item.id],
                          description: e.target.value
                        }
                      })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      className="w-20"
                      value={editedCoefficients[item.id]?.sort_order ?? item.sort_order}
                      onChange={(e) => setEditedCoefficients({
                        ...editedCoefficients,
                        [item.id]: {
                          ...editedCoefficients[item.id],
                          sort_order: Number(e.target.value)
                        }
                      })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveCoefficient(item.id)}
                      disabled={isSaving === `map-${item.id}` || editedCoefficients[item.id] === undefined}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 等级在线分布 */}
      {onlineStats?.byLevel && Object.keys(onlineStats.byLevel).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>在线用户等级分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
              {Object.entries(onlineStats.byLevel).map(([level, count]) => (
                <div key={level} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Lv.{level}</p>
                  <p className="text-xl font-bold">{count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 刷新按钮 */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新数据
        </Button>
      </div>
    </div>
  )
}

