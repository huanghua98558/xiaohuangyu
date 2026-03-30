'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LogIn, LogOut, AlertTriangle, Users, MapPin, Monitor } from 'lucide-react'
import { toast } from 'sonner'

interface LoginLog {
  id: number
  user_id: number
  username: string
  login_type: 'login' | 'logout'
  ip_address: string
  location: string
  user_agent: string
  device_info: string
  is_anomaly: boolean
  anomaly_reason: string | null
  created_at: string
}

interface LoginStats {
  total_logins: number
  today_logins: number
  unique_users: number
  anomaly_count: number
}

interface UserLoginStats {
  user_id: number
  username: string
  login_count: number
  last_login: string
  last_location: string
  device_count: number
}

export default function LoginLogsPage() {
  const [activeTab, setActiveTab] = useState('logs')
  const [loading, setLoading] = useState(false)
  
  // 登录日志
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  
  // 查询参数
  const [filterUsername, setFilterUsername] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterAnomaly, setFilterAnomaly] = useState('all')
  
  // 统计数据
  const [stats, setStats] = useState<LoginStats>({
    total_logins: 0,
    today_logins: 0,
    unique_users: 0,
    anomaly_count: 0
  })
  
  // 用户登录统计
  const [userStats, setUserStats] = useState<UserLoginStats[]>([])
  const [userStatsPage, setUserStatsPage] = useState(1)
  const [userStatsTotal, setUserStatsTotal] = useState(0)

  // 加载统计
  useEffect(() => {
    loadStats()
  }, [])

  // 加载登录日志
  const loadLogs = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('pageSize', pageSize.toString())
      if (filterUsername) params.append('username', filterUsername)
      if (filterType !== 'all') params.append('loginType', filterType)
      if (filterAnomaly !== 'all') params.append('isAnomaly', filterAnomaly)

      const response = await fetch(`/admin/api/admin-v2/login-logs?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.code === 200) {
        setLogs(data.data?.list || [])
        setTotal(data.data?.total || 0)
      } else {
        toast.error(data.message || '加载失败')
      }
    } catch (error) {
      toast.error('加载登录日志失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载统计
  const loadStats = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/admin/api/admin-v2/login-logs/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.code === 200) {
        setStats(data.data || stats)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  // 加载用户登录统计
  const loadUserStats = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const params = new URLSearchParams()
      params.append('page', userStatsPage.toString())
      params.append('pageSize', pageSize.toString())

      const response = await fetch(`/admin/api/admin-v2/login-logs/user-stats?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.code === 200) {
        setUserStats(data.data?.list || [])
        setUserStatsTotal(data.data?.total || 0)
      } else {
        toast.error(data.message || '加载失败')
      }
    } catch (error) {
      toast.error('加载用户统计失败')
    } finally {
      setLoading(false)
    }
  }

  // 切换Tab时加载数据
  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs()
    } else if (activeTab === 'user-stats') {
      loadUserStats()
    }
  }, [activeTab, page, userStatsPage])

  // 搜索日志
  const searchLogs = () => {
    setPage(1)
    loadLogs()
  }

  // 格式化时间
  const formatTime = (time: string) => {
    if (!time) return '-'
    return new Date(time).toLocaleString('zh-CN')
  }

  // 解析User-Agent
  const parseUserAgent = (ua: string) => {
    if (!ua) return '-'
    // 简单解析浏览器和操作系统
    let browser = '未知浏览器'
    let os = '未知系统'
    
    if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Safari')) browser = 'Safari'
    else if (ua.includes('Edge')) browser = 'Edge'
    
    if (ua.includes('Windows')) os = 'Windows'
    else if (ua.includes('Mac')) os = 'MacOS'
    else if (ua.includes('Linux')) os = 'Linux'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
    
    return `${os} / ${browser}`
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">用户登录记录与异常登录监控</p>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总登录次数</CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_logins.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日登录</CardTitle>
            <LogIn className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.today_logins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.unique_users}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">异常登录</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.anomaly_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* 分Tab展示 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logs">登录日志</TabsTrigger>
          <TabsTrigger value="user-stats">用户登录统计</TabsTrigger>
        </TabsList>

        {/* 登录日志 */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>登录记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 筛选条件 */}
              <div className="flex flex-wrap gap-4">
                <div className="w-48">
                  <Input
                    placeholder="用户名"
                    value={filterUsername}
                    onChange={e => setFilterUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchLogs()}
                  />
                </div>
                <div className="w-48">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="登录类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      <SelectItem value="login">登录</SelectItem>
                      <SelectItem value="logout">登出</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Select value={filterAnomaly} onValueChange={setFilterAnomaly}>
                    <SelectTrigger>
                      <SelectValue placeholder="异常状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="true">仅异常</SelectItem>
                      <SelectItem value="false">仅正常</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={searchLogs}>搜索</Button>
              </div>

              {/* 表格 */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>IP地址</TableHead>
                    <TableHead>位置</TableHead>
                    <TableHead>设备</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        暂无登录记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id} className={log.is_anomaly ? 'bg-red-50 dark:bg-red-950' : ''}>
                        <TableCell>
                          {log.login_type === 'login' ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <LogIn className="h-4 w-4" />
                              登录
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-600">
                              <LogOut className="h-4 w-4" />
                              登出
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{log.username}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                            {log.ip_address}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {log.location || '未知'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Monitor className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{parseUserAgent(log.user_agent)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.is_anomaly ? (
                            <div>
                              <Badge variant="destructive">异常</Badge>
                              <p className="text-xs text-red-500 mt-1">{log.anomaly_reason}</p>
                            </div>
                          ) : (
                            <Badge variant="outline">正常</Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatTime(log.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* 分页 */}
              {total > pageSize && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </Button>
                  <span className="py-2 px-4 text-sm">
                    {page} / {Math.ceil(total / pageSize)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(total / pageSize)}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 用户登录统计 */}
        <TabsContent value="user-stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>用户登录统计</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead className="text-right">登录次数</TableHead>
                    <TableHead>最后登录时间</TableHead>
                    <TableHead>最后登录位置</TableHead>
                    <TableHead className="text-right">使用设备数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    userStats.map((stat) => (
                      <TableRow key={stat.user_id}>
                        <TableCell className="font-medium">{stat.username}</TableCell>
                        <TableCell className="text-right">{stat.login_count}</TableCell>
                        <TableCell>{formatTime(stat.last_login)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {stat.last_location || '未知'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{stat.device_count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* 分页 */}
              {userStatsTotal > pageSize && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userStatsPage <= 1}
                    onClick={() => setUserStatsPage(userStatsPage - 1)}
                  >
                    上一页
                  </Button>
                  <span className="py-2 px-4 text-sm">
                    {userStatsPage} / {Math.ceil(userStatsTotal / pageSize)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userStatsPage >= Math.ceil(userStatsTotal / pageSize)}
                    onClick={() => setUserStatsPage(userStatsPage + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
