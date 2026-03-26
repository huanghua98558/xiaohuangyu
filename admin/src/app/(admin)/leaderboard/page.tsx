'use client'

import { useEffect, useState, useCallback } from 'react'
import { LeaderboardSnapshot, getSnapshots, triggerWeeklySnapshot, triggerMonthlySnapshot } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Trophy,
  Calendar,
  Users,
  Gift,
  Play,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

export default function LeaderboardPage() {
  const [snapshots, setSnapshots] = useState<LeaderboardSnapshot[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [isTriggering, setIsTriggering] = useState(false)
  
  const pageSize = 20
  
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getSnapshots({
        type: typeFilter as 'weekly' | 'monthly' || undefined,
        page,
        size: pageSize,
      })
      setSnapshots(data.list)
      setTotal(data.total)
    } catch (err) {
      console.error('加载快照列表失败', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, typeFilter])
  
  useEffect(() => {
    loadData()
  }, [loadData])
  
  const totalPages = Math.ceil(total / pageSize)
  
  // 手动触发周榜快照
  const handleTriggerWeekly = async () => {
    if (!confirm('确定要手动生成上周周榜快照吗？')) return
    
    setIsTriggering(true)
    try {
      await triggerWeeklySnapshot()
      alert('周榜快照生成成功')
      loadData()
    } catch (err) {
      console.error('生成失败', err)
      alert('生成失败')
    } finally {
      setIsTriggering(false)
    }
  }
  
  // 手动触发月榜快照
  const handleTriggerMonthly = async () => {
    if (!confirm('确定要手动生成上月月榜快照吗？')) return
    
    setIsTriggering(true)
    try {
      await triggerMonthlySnapshot()
      alert('月榜快照生成成功')
      loadData()
    } catch (err) {
      console.error('生成失败', err)
      alert('生成失败')
    } finally {
      setIsTriggering(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">定时任务</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <p>周榜快照: <Badge variant="outline">每周一 00:05</Badge></p>
              <p>月榜快照: <Badge variant="outline">每月1日 00:10</Badge></p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">奖励规则</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <p>周榜: 第1名300分, 第2名100分, 第3-5名50分</p>
              <p>月榜: 第1名2000分, 第2名1000分, 第3-5名500分</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">手动生成</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerWeekly}
                disabled={isTriggering}
              >
                生成周榜
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerMonthly}
                disabled={isTriggering}
              >
                生成月榜
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 快照列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>排行榜快照</CardTitle>
              <CardDescription>历史快照记录，含奖励发放信息</CardDescription>
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v === 'all' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="类型筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="weekly">周榜</SelectItem>
                <SelectItem value="monthly">月榜</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>周期</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>时间范围</TableHead>
                  <TableHead className="text-right">参与人数</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">{snapshot.periodKey}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={snapshot.type === 'monthly' ? 'default' : 'secondary'}>
                        {snapshot.type === 'weekly' ? '周榜' : '月榜'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(snapshot.startDate).toLocaleDateString()} - {new Date(snapshot.endDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        {snapshot.totalParticipants}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                
                {snapshots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      暂无快照记录，系统将在每周一/每月1日自动生成
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            共 {total} 条记录，第 {page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
