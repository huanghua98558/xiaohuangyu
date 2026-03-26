'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Search, History, GitCompare, Shield, Clock, User, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface TraceRecord {
  operation_type: string
  operator_id: number
  operator_name: string
  operator_role: string
  target_type: string
  target_id: number
  before_data: any
  after_data: any
  ip_address: string
  location: string
  user_agent: string
  created_at: string
  hash: string
  prev_hash: string
}

interface Snapshot {
  id: number
  task_id: number
  version: number
  change_type: string
  changed_fields: string[]
  before_data: any
  after_data: any
  changed_by: number
  changed_by_name: string
  ip_address: string
  location: string
  created_at: string
}

export default function TracePage() {
  const [activeTab, setActiveTab] = useState('task')
  const [loading, setLoading] = useState(false)
  
  // 任务追溯
  const [taskId, setTaskId] = useState('')
  const [taskTrace, setTaskTrace] = useState<TraceRecord[]>([])
  
  // 快照历史
  const [snapshotTaskId, setSnapshotTaskId] = useState('')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  
  // 时间线
  const [timelineTaskId, setTimelineTaskId] = useState('')
  const [timeline, setTimeline] = useState<any[]>([])
  
  // 版本对比
  const [compareTaskId, setCompareTaskId] = useState('')
  const [versionFrom, setVersionFrom] = useState('')
  const [versionTo, setVersionTo] = useState('')
  const [compareResult, setCompareResult] = useState<any>(null)
  
  // 日志链验证
  const [verifyTaskId, setVerifyTaskId] = useState('')
  const [verifyResult, setVerifyResult] = useState<any>(null)

  // 查询任务完整追溯
  const searchTaskTrace = async () => {
    if (!taskId.trim()) {
      toast.error('请输入任务ID或任务编号')
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/admin/api/admin-v2/trace/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setTaskTrace(data.data || [])
        if (data.data.length === 0) {
          toast.warning('未找到相关操作记录')
        }
      } else {
        toast.error(data.error || '查询失败')
      }
    } catch (error) {
      toast.error('查询失败')
    } finally {
      setLoading(false)
    }
  }

  // 查询任务快照历史
  const searchSnapshots = async () => {
    if (!snapshotTaskId.trim()) {
      toast.error('请输入任务ID或任务编号')
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/admin/api/admin-v2/trace/snapshots/${snapshotTaskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setSnapshots(data.data || [])
        if (data.data.length === 0) {
          toast.warning('未找到快照记录')
        }
      } else {
        toast.error(data.error || '查询失败')
      }
    } catch (error) {
      toast.error('查询失败')
    } finally {
      setLoading(false)
    }
  }

  // 查询任务时间线
  const searchTimeline = async () => {
    if (!timelineTaskId.trim()) {
      toast.error('请输入任务ID或任务编号')
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/admin/api/admin-v2/trace/timeline/${timelineTaskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setTimeline(data.data || [])
        if (data.data.length === 0) {
          toast.warning('未找到时间线记录')
        }
      } else {
        toast.error(data.error || '查询失败')
      }
    } catch (error) {
      toast.error('查询失败')
    } finally {
      setLoading(false)
    }
  }

  // 版本对比
  const compareVersions = async () => {
    if (!compareTaskId.trim() || !versionFrom || !versionTo) {
      toast.error('请填写完整的对比参数')
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/admin/api/admin-v2/trace/compare/${compareTaskId}?from=${versionFrom}&to=${versionTo}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setCompareResult(data.data)
      } else {
        toast.error(data.error || '对比失败')
      }
    } catch (error) {
      toast.error('对比失败')
    } finally {
      setLoading(false)
    }
  }

  // 验证日志链完整性
  const verifyLogChain = async () => {
    if (!verifyTaskId.trim()) {
      toast.error('请输入任务ID或任务编号')
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/admin/api/admin-v2/trace/verify/${verifyTaskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setVerifyResult(data.data)
        if (data.data.valid) {
          toast.success('日志链验证通过，数据完整无损')
        } else {
          toast.error('日志链验证失败，数据可能被篡改')
        }
      } else {
        toast.error(data.error || '验证失败')
      }
    } catch (error) {
      toast.error('验证失败')
    } finally {
      setLoading(false)
    }
  }

  // 格式化时间
  const formatTime = (time: string) => {
    if (!time) return '-'
    return new Date(time).toLocaleString('zh-CN')
  }

  // 格式化操作类型
  const formatOperationType = (type: string) => {
    const map: Record<string, string> = {
      'create_task': '创建任务',
      'update_task': '更新任务',
      'delete_task': '删除任务',
      'claim_task': '领取任务',
      'submit_task': '提交任务',
      'approve_task': '审核通过',
      'reject_task': '审核拒绝',
      'login': '登录',
      'logout': '登出'
    }
    return map[type] || type
  }

  // 格式化变更类型
  const formatChangeType = (type: string) => {
    const map: Record<string, string> = {
      'create': '创建',
      'update': '更新',
      'delete': '删除',
      'status_change': '状态变更',
      'pause': '暂停',
      'resume': '恢复'
    }
    return map[type] || type
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">查询任务的完整操作历史和数据变更追溯</p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="task">任务追溯</TabsTrigger>
          <TabsTrigger value="snapshots">快照历史</TabsTrigger>
          <TabsTrigger value="timeline">时间线</TabsTrigger>
          <TabsTrigger value="compare">版本对比</TabsTrigger>
          <TabsTrigger value="verify">完整性验证</TabsTrigger>
        </TabsList>

        {/* 任务追溯 */}
        <TabsContent value="task" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                任务完整追溯
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="输入任务ID或任务编号（如：TASK-20240101-0001）"
                    value={taskId}
                    onChange={e => setTaskId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchTaskTrace()}
                  />
                </div>
                <Button onClick={searchTaskTrace} disabled={loading}>
                  查询
                </Button>
              </div>

              {taskTrace.length > 0 && (
                <div className="space-y-4">
                  {taskTrace.map((record, index) => (
                    <Card key={index} className="overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Badge>{formatOperationType(record.operation_type)}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatTime(record.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4" />
                            <span>{record.operator_name}</span>
                            <Badge variant="outline">{record.operator_role}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{record.location || '未知'}</span>
                          </div>
                          <span className="text-muted-foreground">IP: {record.ip_address}</span>
                        </div>
                        {record.before_data && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">变更前: </span>
                            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                              {JSON.stringify(record.before_data).slice(0, 100)}...
                            </code>
                          </div>
                        )}
                        {record.after_data && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">变更后: </span>
                            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                              {JSON.stringify(record.after_data).slice(0, 100)}...
                            </code>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Hash: {record.hash?.slice(0, 16)}...</span>
                          <span>Prev: {record.prev_hash?.slice(0, 16) || 'Genesis'}...</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 快照历史 */}
        <TabsContent value="snapshots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                任务快照历史
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="输入任务ID或任务编号"
                    value={snapshotTaskId}
                    onChange={e => setSnapshotTaskId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchSnapshots()}
                  />
                </div>
                <Button onClick={searchSnapshots} disabled={loading}>
                  查询
                </Button>
              </div>

              {snapshots.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>版本</TableHead>
                      <TableHead>变更类型</TableHead>
                      <TableHead>变更字段</TableHead>
                      <TableHead>操作人</TableHead>
                      <TableHead>位置</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((snapshot) => (
                      <TableRow key={snapshot.id}>
                        <TableCell>v{snapshot.version}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatChangeType(snapshot.change_type)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {snapshot.changed_fields?.map((field, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{field}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{snapshot.changed_by_name}</TableCell>
                        <TableCell className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {snapshot.location}
                        </TableCell>
                        <TableCell>{formatTime(snapshot.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 时间线 */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                任务时间线
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="输入任务ID或任务编号"
                    value={timelineTaskId}
                    onChange={e => setTimelineTaskId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchTimeline()}
                  />
                </div>
                <Button onClick={searchTimeline} disabled={loading}>
                  查询
                </Button>
              </div>

              {timeline.length > 0 && (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                  <div className="space-y-4">
                    {timeline.map((item, index) => (
                      <div key={index} className="relative pl-10">
                        <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-primary" />
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge>{formatOperationType(item.event_type)}</Badge>
                            <span className="text-sm text-muted-foreground">{formatTime(item.event_time)}</span>
                          </div>
                          <p className="text-sm">{item.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>操作人: {item.operator_name}</span>
                            <span>位置: {item.location}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 版本对比 */}
        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                版本对比
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>任务ID/编号</Label>
                  <Input
                    placeholder="任务ID或编号"
                    value={compareTaskId}
                    onChange={e => setCompareTaskId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>起始版本</Label>
                  <Input
                    type="number"
                    placeholder="版本号"
                    value={versionFrom}
                    onChange={e => setVersionFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>目标版本</Label>
                  <Input
                    type="number"
                    placeholder="版本号"
                    value={versionTo}
                    onChange={e => setVersionTo(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={compareVersions} disabled={loading}>
                开始对比
              </Button>

              {compareResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">版本 {versionFrom}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs overflow-auto max-h-60 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          {JSON.stringify(compareResult.from_data, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">版本 {versionTo}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs overflow-auto max-h-60 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          {JSON.stringify(compareResult.to_data, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                  {compareResult.differences && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">差异字段</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(compareResult.differences).map(([field, diff]: [string, any]) => (
                            <div key={field} className="text-sm">
                              <span className="font-medium">{field}: </span>
                              <span className="text-red-500">{diff.from}</span>
                              <span className="mx-2">→</span>
                              <span className="text-green-500">{diff.to}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 完整性验证 */}
        <TabsContent value="verify" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                日志链完整性验证
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                验证操作日志的区块链式哈希链是否完整，确保数据未被篡改。
              </p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="输入任务ID或任务编号"
                    value={verifyTaskId}
                    onChange={e => setVerifyTaskId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && verifyLogChain()}
                  />
                </div>
                <Button onClick={verifyLogChain} disabled={loading}>
                  验证
                </Button>
              </div>

              {verifyResult && (
                <Card className={verifyResult.valid ? 'border-green-500' : 'border-red-500'}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        verifyResult.valid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        <Shield className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {verifyResult.valid ? '验证通过' : '验证失败'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          共检查 {verifyResult.total_records} 条记录，发现 {verifyResult.invalid_count || 0} 处异常
                        </p>
                      </div>
                    </div>
                    {verifyResult.details && verifyResult.details.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {verifyResult.details.map((detail: string, i: number) => (
                          <div key={i} className="text-sm text-red-500">{detail}</div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
