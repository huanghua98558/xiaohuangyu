'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { 
  Search, ChevronLeft, ChevronRight, UserCheck, UserX,
  Coins, Wallet, Save, KeyRound, Eye, TrendingUp, RefreshCw, Shield, 
  ShieldCheck, ShieldX, MapPin, Monitor, Smartphone, Map, List
} from 'lucide-react'
import { toast } from 'sonner'
import { UserMap } from '@/components/user-map/UserMap'

const TOKEN_KEY = 'admin_token'

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) headers['Authorization'] = 'Bearer ' + token
  }
  return headers
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/admin/api' + url, { ...options, headers: { ...getAuthHeaders(), ...options.headers } })
  const json = await res.json()
  if (json.code !== 0) {
    if (json.code === 401) { localStorage.removeItem(TOKEN_KEY); window.location.href = '/admin/login/' }
    throw new Error(json.message || '请求失败')
  }
  return json.data
}

interface User {
  id: number; username: string; phone: string | null; role: string; level: number
  points: number; balance: number; exchangedPoints: number; availablePoints: number
  totalTasks: number; totalPoints: number; province: string | null; city: string | null
  device: string | null; status: number; createdAt: string
  isWhitelist: boolean; isBlacklist: boolean; exposureLevel: number; isOnline: boolean
}

interface UserDetail {
  user: User
  taskStats: { total: number; pending: number; done: number; rejected: number }
  pointsLogs: Array<{ id: number; points: number; type: string; description: string; created_at: string }>
  balanceLogs: Array<{ id: number; amount: number; type: string; description: string; created_at: string }>
}

interface LevelConfig { level: number; name: string; icon: string; coefficient: number }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [levels, setLevels] = useState<LevelConfig[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('online_first')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pointsLogOpen, setPointsLogOpen] = useState(false)
  const [pointsLogs, setPointsLogs] = useState<UserDetail['pointsLogs']>([])
  const [editFormData, setEditFormData] = useState({ username: '', phone: '', province: '', city: '' })
  const [newPassword, setNewPassword] = useState('')
  const [pointsAmount, setPointsAmount] = useState('')
  const [pointsReason, setPointsReason] = useState('')
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceReason, setBalanceReason] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page)); params.set('size', String(pageSize))
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      if (levelFilter) params.set('level', levelFilter)
      params.set('sortBy', sortBy); params.set('sortOrder', sortOrder)
      const data = await request<{ list: User[]; total: number }>('/admin-v2/users?' + params)
      setUsers(data.list || []); setTotal(data.total || 0)
      if (levels.length === 0) {
        const levelData = await request<LevelConfig[]>('/admin-v2/levels')
        setLevels(levelData || [])
      }
    } catch (err) { console.error('加载失败', err); toast.error('加载用户列表失败') }
    finally { setIsLoading(false) }
  }, [page, search, roleFilter, levelFilter, sortBy, sortOrder, levels.length])

  useEffect(() => { loadData() }, [loadData])

  const openUserDetail = async (user: User) => {
    setSelectedUser(user); setDetailOpen(true); setDetailLoading(true)
    setEditFormData({ username: user.username, phone: user.phone || '', province: user.province || '', city: user.city || '' })
    try {
      const detail = await request<UserDetail>('/admin-v2/users/' + user.id)
      setUserDetail(detail); setPointsLogs(detail.pointsLogs || [])
    } catch (err) { console.error('加载详情失败', err) }
    finally { setDetailLoading(false) }
  }

  const handleStatusChange = async (userId: number, status: boolean) => {
    setIsUpdating(true)
    try {
      await request('/admin-v2/users/' + userId + '/status', { method: 'PUT', body: JSON.stringify({ status }) })
      toast.success('状态更新成功'); loadData()
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, status: status ? 1 : 0 } : null)
    } catch (err) { toast.error('操作失败') }
    finally { setIsUpdating(false) }
  }

  const handleLevelChange = async (userId: number, newLevel: number) => {
    setIsUpdating(true)
    try {
      await request('/admin-v2/users/' + userId + '/level', { method: 'PUT', body: JSON.stringify({ level: newLevel }) })
      toast.success('等级更新成功'); loadData()
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, level: newLevel } : null)
    } catch (err) { toast.error('操作失败') }
    finally { setIsUpdating(false) }
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    setIsUpdating(true)
    try {
      await request('/admin-v2/users/' + userId + '/role', { method: 'PUT', body: JSON.stringify({ role: newRole }) })
      toast.success('角色更新成功'); loadData()
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, role: newRole } : null)
    } catch (err) { toast.error('操作失败') }
    finally { setIsUpdating(false) }
  }

  const handlePointsUpdate = async () => {
    if (!selectedUser || !pointsAmount) return
    const amount = parseInt(pointsAmount)
    if (isNaN(amount)) { toast.error('请输入有效数字'); return }
    setIsUpdating(true)
    try {
      await request('/admin-v2/users/' + selectedUser.id + '/points', { method: 'PUT', body: JSON.stringify({ amount, reason: pointsReason }) })
      toast.success('积分调整成功'); setPointsAmount(''); setPointsReason(''); loadData(); openUserDetail(selectedUser)
    } catch (err) { toast.error('操作失败') }
    finally { setIsUpdating(false) }
  }

  const handleBalanceUpdate = async () => {
    if (!selectedUser || !balanceAmount) return
    const amount = parseFloat(balanceAmount)
    if (isNaN(amount)) { toast.error('请输入有效数字'); return }
    setIsUpdating(true)
    try {
      await request('/admin-v2/users/' + selectedUser.id + '/balance', { method: 'PUT', body: JSON.stringify({ amount, reason: balanceReason }) })
      toast.success('余额调整成功'); setBalanceAmount(''); setBalanceReason(''); loadData(); openUserDetail(selectedUser)
    } catch (err) { toast.error('操作失败') }
    finally { setIsUpdating(false) }
  }

  const handleUpdateInfo = async () => {
    if (!selectedUser) return
    setIsUpdating(true)
    try {
      await request('/admin-v2/users/' + selectedUser.id, { method: 'PUT', body: JSON.stringify(editFormData) })
      toast.success('信息更新成功'); loadData()
    } catch (err) { toast.error('更新失败') }
    finally { setIsUpdating(false) }
  }

  const handlePasswordUpdate = async () => {
    if (!selectedUser || !newPassword || newPassword.length < 6) { toast.error('密码长度至少6位'); return }
    setIsUpdating(true)
    try {
      await request('/admin-v2/users/' + selectedUser.id + '/password', { method: 'PUT', body: JSON.stringify({ password: newPassword }) })
      toast.success('密码修改成功'); setNewPassword('')
    } catch (err) { toast.error('修改失败') }
    finally { setIsUpdating(false) }
  }

  const handleWhitelist = async (userId: number, isWhitelist: boolean) => {
    setIsUpdating(true)
    try {
      await request('/admin-v2/users/' + userId + '/whitelist', { method: 'POST', body: JSON.stringify({ isWhitelist }) })
      toast.success(isWhitelist ? '已加入白名单' : '已移出白名单'); loadData()
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, isWhitelist } : null)
    } catch (err) { toast.error('操作失败') }
    finally { setIsUpdating(false) }
  }

  const handleBlacklist = async (userId: number, isBlacklist: boolean) => {
    setIsUpdating(true)
    try {
      await request('/admin-v2/users/' + userId + '/blacklist', { method: 'POST', body: JSON.stringify({ isBlacklist }) })
      toast.success(isBlacklist ? '已加入黑名单' : '已移出黑名单'); loadData()
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, isBlacklist } : null)
    } catch (err) { toast.error('操作失败') }
    finally { setIsUpdating(false) }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const formatDateShort = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const getRoleName = (role: string) => {
    const map: Record<string, string> = { admin: '管理员', reviewer: '审核员', client: '发布者', part_timer: '体验官', user: '体验官' }
    return map[role] || role
  }

  const getRoleBadge = (role: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      admin: { label: '管理员', variant: 'destructive' },
      reviewer: { label: '审核员', variant: 'secondary' },
      client: { label: '发布者', variant: 'default' },
      part_timer: { label: '体验官', variant: 'outline' },
      user: { label: '体验官', variant: 'outline' }
    }
    return config[role] || { label: role, variant: 'outline' }
  }

  const getLevelName = (level: number) => {
    const info = levels.find(l => l.level === level)
    return info ? info.icon + ' Lv.' + level : 'Lv.' + level
  }

  const getLocation = (user: User) => {
    if (user.province && user.city) return user.province + " " + user.city  // 显示省份和城市
    if (user.city) return user.city
    if (user.province) return user.province
    return '-'
  }

  const getDeviceIcon = (device: string | null) => {
    if (!device) return <Monitor className="h-4 w-4 text-muted-foreground" />
    const d = device.toLowerCase()
    if (d.includes('mobile') || d.includes('android') || d.includes('iphone')) return <Smartphone className="h-4 w-4 text-blue-500" />
    return <Monitor className="h-4 w-4 text-green-500" />
  }

  const getDeviceName = (device: string | null) => {
    if (!device) return '-'
    const d = device.toLowerCase()
    if (d.includes('iphone')) return 'iPhone'
    if (d.includes('android')) return 'Android'
    if (d.includes('windows')) return 'Windows'
    if (d.includes('mac')) return 'Mac'
    if (d.includes('linux')) return 'Linux'
    return device.length > 10 ? device.substring(0, 10) + '..' : device
  }

  const getDeviceDisplay = (user: User) => {
    const devices = []
    if (user.device) {
      devices.push(user.device)
    }
    const text = devices.length > 0 ? devices.join("/" ) : "-"
    const icons = getDeviceIcon(user.device)
    return { text, icons }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">用户管理</h1>
          <Badge variant="secondary" className="text-sm">共 {total} 个用户</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-md p-1 bg-background">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-3"
            >
              <List className="h-4 w-4 mr-1" />
              列表
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
              className="h-8 px-3"
            >
              <Map className="h-4 w-4 mr-1" />
              地图
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={'h-4 w-4 mr-2' + (isLoading ? ' animate-spin' : '')} />刷新
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="用户名/手机号..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9 h-9" />
            </div>
            <Select value={roleFilter || 'all'} onValueChange={(v) => { setRoleFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-[110px] h-9"><SelectValue placeholder="角色" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="part_timer">体验官</SelectItem>
                <SelectItem value="client">发布者</SelectItem>
                <SelectItem value="reviewer">审核员</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter || 'all'} onValueChange={(v) => { setLevelFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-[110px] h-9"><SelectValue placeholder="等级" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部等级</SelectItem>
                {levels.map(l => (<SelectItem key={l.level} value={String(l.level)}>{l.icon} Lv.{l.level}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online_first">在线优先</SelectItem>
                <SelectItem value="created_at">注册时间</SelectItem>
                <SelectItem value="username">用户名</SelectItem>
                <SelectItem value="points">积分</SelectItem>
                <SelectItem value="balance">余额</SelectItem>
                <SelectItem value="level">等级</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
              <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">降序</SelectItem>
                <SelectItem value="asc">升序</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'map' ? (
        isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center h-[600px]">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <UserMap users={users} />
        )
      ) : (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">ID</TableHead>
                      <TableHead className="w-[130px]">用户信息</TableHead>
                      <TableHead className="w-[60px]">在线</TableHead>
                      <TableHead className="w-[70px]">角色</TableHead>
                      <TableHead className="w-[60px]">状态</TableHead>
                      <TableHead className="w-[120px]">地址</TableHead>
                      <TableHead className="w-[100px]">注册时间</TableHead>
                      <TableHead className="text-right w-[70px]">积分</TableHead>
                      <TableHead className="text-right w-[75px]">剩余积分</TableHead>
                      <TableHead className="text-right w-[65px]">余额</TableHead>
                      <TableHead className="w-[65px]">等级</TableHead>
                      <TableHead className="w-[70px]">设备</TableHead>
                      <TableHead className="text-center w-[60px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const roleInfo = getRoleBadge(user.role)
                      return (
                        <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openUserDetail(user)}>
                          <TableCell className="font-mono text-sm">{user.id}</TableCell>
                          <TableCell><div className="font-medium">{user.username}</div><div className="text-xs text-muted-foreground">{user.phone || '-'}</div></TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center">
                              {user.isOnline ? <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white text-xs px-1.5 py-0">在线</Badge> : <span className="text-xs text-muted-foreground">离线</span>}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant={roleInfo.variant} className="text-xs">{roleInfo.label}</Badge></TableCell>
                          <TableCell><Badge variant={user.status === 1 ? 'default' : 'destructive'} className="text-xs">{user.status === 1 ? '正常' : '冻结'}</Badge></TableCell>
                          <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-xs cursor-help">
                                <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="truncate max-w-[80px]">{getLocation(user)}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{user.province || ''}{user.city ? ' ' + user.city : ''}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateShort(user.createdAt)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{(user.points ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-green-600">{(user.availablePoints ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{"\u00a5"}{(user.balance ?? 0).toFixed(2)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{getLevelName(user.level)}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1" title={getDeviceDisplay(user).text}>
                              {getDeviceDisplay(user).icons}
                              <span className="text-xs truncate max-w-[60px]">{getDeviceDisplay(user).text}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openUserDetail(user)} title="查看详情"><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(user); setPointsLogOpen(true); }} title="积分流水"><TrendingUp className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {users.length === 0 && (<TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">暂无数据</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">用户详情{selectedUser?.isOnline && <Badge className="bg-green-500">在线</Badge>}</DialogTitle>
            <DialogDescription>{selectedUser?.username} (ID: {selectedUser?.id})</DialogDescription>
          </DialogHeader>
          {detailLoading ? (<div className="py-8 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></div>) : selectedUser && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">基本信息</TabsTrigger>
                <TabsTrigger value="role">角色等级</TabsTrigger>
                <TabsTrigger value="points">积分余额</TabsTrigger>
                <TabsTrigger value="settings">更多设置</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between p-2 bg-muted/50 rounded"><span className="text-muted-foreground">用户ID</span><span className="font-mono">{selectedUser.id}</span></div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded"><span className="text-muted-foreground">角色</span><span>{getRoleName(selectedUser.role)}</span></div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded"><span className="text-muted-foreground">等级</span><span>{getLevelName(selectedUser.level)}</span></div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded"><span className="text-muted-foreground">账号状态</span><Badge variant={selectedUser.status === 1 ? 'default' : 'destructive'}>{selectedUser.status === 1 ? '正常' : '冻结'}</Badge></div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded"><span className="text-muted-foreground">积分</span><span className="font-mono">{(selectedUser?.points ?? 0).toLocaleString()}</span></div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded"><span className="text-muted-foreground">剩余积分</span><span className="font-mono text-green-600">{(selectedUser?.availablePoints ?? 0).toLocaleString()}</span></div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded"><span className="text-muted-foreground">余额</span><span className="font-mono">{"\u00a5"}{(selectedUser?.balance ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded"><span className="text-muted-foreground">任务数</span><span>{selectedUser.totalTasks}</span></div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded"><span className="text-muted-foreground">地址</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{getLocation(selectedUser)}</span></div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                          <span className="text-muted-foreground">登录设备</span>
                          <span className="flex items-center gap-1">
                            {getDeviceDisplay(selectedUser).icons}
                            <span>{getDeviceDisplay(selectedUser).text}</span>
                          </span>
                        </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded col-span-2"><span className="text-muted-foreground">注册时间</span><span>{formatDate(selectedUser.createdAt)}</span></div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">编辑信息</h4>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">用户名</Label><Input value={editFormData.username} onChange={(e) => setEditFormData(prev => ({ ...prev, username: e.target.value }))} /></div>
                      <div><Label className="text-xs">手机号</Label><Input value={editFormData.phone} onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">省份</Label><Input value={editFormData.province} onChange={(e) => setEditFormData(prev => ({ ...prev, province: e.target.value }))} /></div>
                      <div><Label className="text-xs">城市</Label><Input value={editFormData.city} onChange={(e) => setEditFormData(prev => ({ ...prev, city: e.target.value }))} /></div>
                    </div>
                    <Button onClick={handleUpdateInfo} disabled={isUpdating} className="w-full"><Save className="h-4 w-4 mr-2" />{isUpdating ? '保存中...' : '保存修改'}</Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="role" className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">修改角色</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ value: 'part_timer', label: '体验官' }, { value: 'client', label: '发布者' }, { value: 'reviewer', label: '审核员' }, { value: 'admin', label: '管理员' }].map(r => (
                      <Button key={r.value} variant={selectedUser.role === r.value ? 'default' : 'outline'} size="sm" onClick={() => handleRoleChange(selectedUser.id, r.value)} disabled={isUpdating}>{r.label}</Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">修改等级</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {levels.map(l => (<Button key={l.level} variant={selectedUser.level === l.level ? 'default' : 'outline'} size="sm" onClick={() => handleLevelChange(selectedUser.id, l.level)} disabled={isUpdating}>{l.icon} Lv.{l.level}</Button>))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">账号状态</Label>
                  <div className="flex gap-2">
                    <Button variant={selectedUser.status === 1 ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange(selectedUser.id, true)} disabled={isUpdating}><UserCheck className="h-4 w-4 mr-1" />正常</Button>
                    <Button variant={selectedUser.status !== 1 ? 'destructive' : 'outline'} size="sm" onClick={() => handleStatusChange(selectedUser.id, false)} disabled={isUpdating}><UserX className="h-4 w-4 mr-1" />冻结</Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="points" className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">调整积分</Label>
                  <div className="text-xs text-muted-foreground mb-2">当前积分: <span className="font-mono">{(selectedUser?.points ?? 0).toLocaleString()}</span></div>
                  <div className="flex gap-2 mb-2">
                    <Button variant="outline" size="sm" onClick={() => setPointsAmount(String((parseInt(pointsAmount) || 0) - 100))}>-100</Button>
                    <Button variant="outline" size="sm" onClick={() => setPointsAmount(String((parseInt(pointsAmount) || 0) - 10))}>-10</Button>
                    <Input type="number" value={pointsAmount} onChange={(e) => setPointsAmount(e.target.value)} placeholder="正数增加，负数减少" className="flex-1 text-center" />
                    <Button variant="outline" size="sm" onClick={() => setPointsAmount(String((parseInt(pointsAmount) || 0) + 10))}>+10</Button>
                    <Button variant="outline" size="sm" onClick={() => setPointsAmount(String((parseInt(pointsAmount) || 0) + 100))}>+100</Button>
                  </div>
                  <Textarea value={pointsReason} onChange={(e) => setPointsReason(e.target.value)} placeholder="调整原因（可选）" rows={2} />
                  <Button onClick={handlePointsUpdate} disabled={isUpdating || !pointsAmount} className="w-full mt-2"><Coins className="h-4 w-4 mr-2" />确认调整</Button>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-2 block">调整余额</Label>
                  <div className="text-xs text-muted-foreground mb-2">当前余额: <span className="font-mono">{"\u00a5"}{(selectedUser?.balance ?? 0).toFixed(2)}</span></div>
                  <div className="flex gap-2 mb-2">
                    <Button variant="outline" size="sm" onClick={() => setBalanceAmount(String((parseFloat(balanceAmount) || 0) - 10))}>-10</Button>
                    <Input type="number" step="0.01" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="正数增加，负数减少" className="flex-1 text-center" />
                    <Button variant="outline" size="sm" onClick={() => setBalanceAmount(String((parseFloat(balanceAmount) || 0) + 10))}>+10</Button>
                  </div>
                  <Textarea value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)} placeholder="调整原因（可选）" rows={2} />
                  <Button onClick={handleBalanceUpdate} disabled={isUpdating || !balanceAmount} className="w-full mt-2"><Wallet className="h-4 w-4 mr-2" />确认调整</Button>
                </div>
              </TabsContent>
              <TabsContent value="settings" className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">白名单设置</Label>
                  <div className="flex gap-2">
                    <Button variant={selectedUser.isWhitelist ? 'default' : 'outline'} size="sm" onClick={() => handleWhitelist(selectedUser.id, true)} disabled={isUpdating}><ShieldCheck className="h-4 w-4 mr-1" />加入白名单</Button>
                    <Button variant={!selectedUser.isWhitelist ? 'destructive' : 'outline'} size="sm" onClick={() => handleWhitelist(selectedUser.id, false)} disabled={isUpdating}><Shield className="h-4 w-4 mr-1" />移出白名单</Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">黑名单设置</Label>
                  <div className="flex gap-2">
                    <Button variant={selectedUser.isBlacklist ? 'destructive' : 'outline'} size="sm" onClick={() => handleBlacklist(selectedUser.id, true)} disabled={isUpdating}><ShieldX className="h-4 w-4 mr-1" />加入黑名单</Button>
                    <Button variant={!selectedUser.isBlacklist ? 'default' : 'outline'} size="sm" onClick={() => handleBlacklist(selectedUser.id, false)} disabled={isUpdating}><Shield className="h-4 w-4 mr-1" />移出黑名单</Button>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-2 block">修改密码</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="新密码（至少6位）" />
                  <Button onClick={handlePasswordUpdate} disabled={isUpdating || newPassword.length < 6} className="w-full mt-2"><KeyRound className="h-4 w-4 mr-2" />修改密码</Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pointsLogOpen} onOpenChange={setPointsLogOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>积分流水</DialogTitle>
            <DialogDescription>{selectedUser?.username} 的积分变动记录</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {pointsLogs.length === 0 ? (<div className="text-center py-8 text-muted-foreground">暂无积分流水记录</div>) : (
              pointsLogs.map((log) => (
                <div key={log.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div><div className="text-sm">{log.description || log.type}</div><div className="text-xs text-muted-foreground">{formatDate(log.created_at)}</div></div>
                  <span className={'font-mono font-medium ' + (log.points > 0 ? 'text-green-600' : 'text-red-600')}>{log.points > 0 ? '+' : ''}{log.points}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
