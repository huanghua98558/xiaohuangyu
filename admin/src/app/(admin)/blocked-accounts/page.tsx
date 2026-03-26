'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter,
  Eye,
  UserX,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

// 封控状态配置
const BLOCK_STATUS_CONFIG = {
  none: { label: '正常', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  suspected: { label: '疑似封控', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  confirmed: { label: '已确认封控', color: 'bg-red-100 text-red-800', icon: XCircle },
  false_positive: { label: '误报', color: 'bg-blue-100 text-blue-800', icon: CheckCircle }
}

interface BlockedAccount {
  id: string
  user_id: string
  claim_id: number
  platform: string
  platform_user_id: string
  platform_username: string
  status: keyof typeof BLOCK_STATUS_CONFIG
  detection_source: string
  detection_reason: string
  evidence: any
  detection_count: number
  confirmed_at?: string
  confirmed_by?: string
  resolved_at?: string
  resolved_by?: string
  admin_notes?: string
  created_at: string
  updated_at: string
  users?: {
    phone: string
    nickname: string
  }
}

export default function BlockedAccountsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<BlockedAccount[]>([])
  const [stats, setStats] = useState<any>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  
  // 筛选条件
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') || 'all'
  )
  const [platformFilter, setPlatformFilter] = useState<string>(
    searchParams.get('platform') || 'all'
  )
  const [searchQuery, setSearchQuery] = useState('')

  // 获取封控账号列表
  const fetchBlockedAccounts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (platformFilter !== 'all') params.append('platform', platformFilter)
      params.append('page', String(page))
      params.append('pageSize', String(pageSize))

      const response = await fetch('/admin/api/blocked-accounts?' + params.toString())
      const data = await response.json()
      
      if (data.success) {
        setAccounts(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('获取封控账号失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const response = await fetch('/admin/api/blocked-accounts/stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.data || {})
      }
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }

  useEffect(() => {
    fetchBlockedAccounts()
    fetchStats()
  }, [statusFilter, platformFilter, page])

  // 确认封控
  const handleConfirm = async (id: string) => {
    if (!confirm('确认该账号为封控状态？')) return
    
    try {
      const response = await fetch('/admin/api/blocked-accounts/' + id + '/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminId: 'admin', // TODO: 从认证获取
          notes: '管理员确认' 
        })
      })
      
      const data = await response.json()
      if (data.success) {
        fetchBlockedAccounts()
        fetchStats()
      } else {
        alert('操作失败: ' + data.error)
      }
    } catch (error) {
      console.error('确认封控失败:', error)
    }
  }

  // 标记误报
  const handleFalsePositive = async (id: string) => {
    if (!confirm('确认标记为误报？')) return
    
    try {
      const response = await fetch('/admin/api/blocked-accounts/' + id + '/false-positive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminId: 'admin',
          notes: '管理员标记误报' 
        })
      })
      
      const data = await response.json()
      if (data.success) {
        fetchBlockedAccounts()
        fetchStats()
      } else {
        alert('操作失败: ' + data.error)
      }
    } catch (error) {
      console.error('标记误报失败:', error)
    }
  }

  const getStatusBadge = (status: keyof typeof BLOCK_STATUS_CONFIG) => {
    const config = BLOCK_STATUS_CONFIG[status] || BLOCK_STATUS_CONFIG.none
    const Icon = config.icon
    
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">封控账号管理</h1>
          <p className="text-muted-foreground">
            检测和管理疑似封控账号
          </p>
        </div>
        <Button variant="outline" onClick={() => { fetchBlockedAccounts(); fetchStats(); }}>
          <RefreshCw className="w-4 h-4 mr-2 "/>
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总计</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>疑似封控</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.byStatus?.suspected || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已确认</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.byStatus?.confirmed || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>误报</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.byStatus?.false_positive || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground "/>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="suspected">疑似封控</SelectItem>
                  <SelectItem value="confirmed">已确认</SelectItem>
                  <SelectItem value="false_positive">误报</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="平台筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  <SelectItem value="抖音">抖音</SelectItem>
                  <SelectItem value="小红书">小红书</SelectItem>
                  <SelectItem value="快手">快手</SelectItem>
                  <SelectItem value="视频号">视频号</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-muted-foreground "/>
              <Input
                placeholder="搜索用户名或ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无封控账号记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>平台用户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>检测原因</TableHead>
                  <TableHead>检测次数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {account.users?.nickname || account.users?.phone || '-'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {account.user_id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{account.platform}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{account.platform_username || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {account.platform_user_id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(account.status)}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={account.detection_reason}>
                        {account.detection_reason || '-'}
                      </div>
                    </TableCell>
                    <TableCell>{account.detection_count}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(account.created_at), 'MM-dd HH:mm', { locale: zhCN })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {account.status === 'suspected' && (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleConfirm(account.id)}
                            >
                              <UserX className="w-3 h-3 mr-1" />
                              确认封控
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFalsePositive(account.id)}
                            >
                              误报
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push('/review?claimId=' + account.claim_id)}
                        >
                          <Eye className="w-3 h-3 "/>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* 分页 */}
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                共 {total} 条记录
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage(p => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
