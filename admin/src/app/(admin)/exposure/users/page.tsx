'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Star,
  Shield,
  Ban,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getUsers,
  getUserExposureDetail,
  type UserListItem,
  type UserExposureDetail,
} from '@/lib/api'

export default function UserExposurePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [users, setUsers] = useState<UserListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [searchKeyword, setSearchKeyword] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [onlineFilter, setOnlineFilter] = useState<string>('all')
  
  const pageSize = 20

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getUsers({
        page,
        size: pageSize,
        search: searchKeyword || undefined,
        level: levelFilter && levelFilter !== 'all' ? parseInt(levelFilter) : undefined,
        isOnline: onlineFilter === 'online' ? true : onlineFilter === 'offline' ? false : undefined,
      })
      setUsers(result.list)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }, [page, searchKeyword, levelFilter, onlineFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchUsers()
    setTimeout(() => setRefreshing(false), 500)
  }

  const handleSearch = () => {
    setPage(1)
    fetchUsers()
  }

  const totalPages = Math.ceil(total / pageSize)

  const getLevelBadge = (level: number) => {
    const colors: Record<number, string> = {
      1: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
      2: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      3: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      4: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      5: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    }
    return (
      <Badge className={colors[level] || colors[1]}>
        Lv.{level}
      </Badge>
    )
  }

  const getOnlineBadge = (isOnline?: boolean) => {
    if (isOnline === undefined) return null
    return isOnline ? (
      <Badge variant="default" className="bg-green-500">在线</Badge>
    ) : (
      <Badge variant="secondary">离线</Badge>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">用户曝光详情</h1>
          <p className="text-muted-foreground">
            查看用户曝光额度、等级、选择分数等详细信息
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户名或手机号..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="等级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部等级</SelectItem>
                {[1, 2, 3, 4, 5].map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    Lv.{level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={onlineFilter} onValueChange={setOnlineFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="online">在线</SelectItem>
                <SelectItem value="offline">离线</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Filter className="mr-2 h-4 w-4" />
              筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">在线用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {users.filter((u) => u.isOnline).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">白名单用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {users.filter((u) => u.isWhitelist).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">黑名单用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {users.filter((u) => u.isBlacklist).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 用户列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户ID</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>曝光等级</TableHead>
                  <TableHead>城市</TableHead>
                  <TableHead>积分</TableHead>
                  <TableHead>完成任务</TableHead>
                  <TableHead>标签</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono">{user.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{user.username}</div>
                            {user.phone && (
                              <div className="text-xs text-muted-foreground">{user.phone}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getLevelBadge(user.level)}</TableCell>
                      <TableCell>{getOnlineBadge(user.isOnline)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          曝光 Lv.{user.exposureLevel ?? user.level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.city ? (
                          <span>{user.province} {user.city}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{user.points.toLocaleString()}</TableCell>
                      <TableCell>{user.totalTasks}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {user.isWhitelist && (
                            <Badge variant="default" className="bg-blue-500">
                              <Shield className="h-3 w-3 mr-1" />
                              白名单
                            </Badge>
                          )}
                          {user.isBlacklist && (
                            <Badge variant="destructive">
                              <Ban className="h-3 w-3 mr-1" />
                              黑名单
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>操作</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push(`/users/${user.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Star className="mr-2 h-4 w-4" />
                              设置曝光等级
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Shield className="mr-2 h-4 w-4" />
                              加入白名单
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Ban className="mr-2 h-4 w-4" />
                              加入黑名单
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {total} 条记录，第 {page}/{totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
