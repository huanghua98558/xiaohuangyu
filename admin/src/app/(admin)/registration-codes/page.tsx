'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { KeyRound, RefreshCw, Plus } from 'lucide-react'

async function apiV2<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : ''
  const res = await fetch('/admin/api/admin-v2' + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      ...(init?.headers || {}),
    },
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.message || '请求失败')
  return json.data as T
}

interface RegRow {
  id: string
  code: string
  note: string
  maxUses: number
  usedCount: number
  expiresAt: string | null
  disabled: boolean
  createdBy: string
  createdAt: string
}

export default function RegistrationCodesPage() {
  const [required, setRequired] = useState(false)
  const [inviteRequired, setInviteRequired] = useState(false)
  const [policyLoading, setPolicyLoading] = useState(true)
  const [list, setList] = useState<RegRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [genCount, setGenCount] = useState(5)
  const [maxUses, setMaxUses] = useState(1)
  const [note, setNote] = useState('')
  const [generating, setGenerating] = useState(false)

  const loadPolicy = useCallback(async () => {
    setPolicyLoading(true)
    try {
      const data = await apiV2<{ required: boolean; inviteRequired?: boolean }>('/registration-codes/policy')
      setRequired(!!data.required)
      setInviteRequired(!!data.inviteRequired)
    } catch (e) {
      console.error(e)
    } finally {
      setPolicyLoading(false)
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiV2<{ list: RegRow[]; total: number; page: number; size: number }>(
        `/registration-codes?page=${page}&size=20`
      )
      setList(data.list || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    loadPolicy()
  }, [loadPolicy])

  useEffect(() => {
    loadList()
  }, [loadList])

  const toggleRegistrationCodePolicy = async (v: boolean) => {
    try {
      await apiV2('/registration-codes/policy', {
        method: 'PUT',
        body: JSON.stringify({ required: v }),
      })
      setRequired(v)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '保存失败')
    }
  }

  const toggleInviteRequiredPolicy = async (v: boolean) => {
    try {
      await apiV2('/registration-codes/policy', {
        method: 'PUT',
        body: JSON.stringify({ inviteRequired: v }),
      })
      setInviteRequired(v)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '保存失败')
    }
  }

  const generate = async () => {
    setGenerating(true)
    try {
      await apiV2('/registration-codes', {
        method: 'POST',
        body: JSON.stringify({
          count: Math.min(50, Math.max(1, genCount)),
          maxUses: Math.max(1, maxUses),
          note: note.slice(0, 200),
        }),
      })
      await loadList()
      alert('已生成注册码')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const disableRow = async (id: string) => {
    if (!confirm('确定作废该注册码？')) return
    try {
      await apiV2(`/registration-codes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled: true }),
      })
      await loadList()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '操作失败')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <KeyRound className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">注册码管理</h1>
          <p className="text-muted-foreground text-sm">
            注册码用于渠道管控（无有效注册码不可注册）；推广邀请码用于绑定上下级关系，可单独要求必填。
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>注册策略</CardTitle>
          <CardDescription>控制用户端注册页上「注册码」与「推广邀请码」是否必填（两项互相独立）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium">必须凭注册码注册</p>
              <p className="text-sm text-muted-foreground">关闭时注册页不显示注册码输入框。</p>
            </div>
            {policyLoading ? (
              <span className="text-sm text-muted-foreground">加载中…</span>
            ) : (
              <Switch checked={required} onCheckedChange={toggleRegistrationCodePolicy} />
            )}
          </div>
          <div className="border-t pt-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium">推广邀请码必填</p>
              <p className="text-sm text-muted-foreground">
                开启后用户注册必须填写邀请码（用于绑定推广关系）；关闭则为选填。
              </p>
            </div>
            {policyLoading ? (
              <span className="text-sm text-muted-foreground">加载中…</span>
            ) : (
              <Switch checked={inviteRequired} onCheckedChange={toggleInviteRequiredPolicy} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>批量发放</CardTitle>
          <CardDescription>生成随机大写字母与数字组合的注册码（不含易混淆字符）。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>生成数量</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={genCount}
              onChange={(e) => setGenCount(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div>
            <Label>每码可用次数</Label>
            <Input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>备注（可选）</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：2026春季渠道" />
          </div>
          <div className="md:col-span-4 flex gap-2">
            <Button onClick={generate} disabled={generating}>
              <Plus className="h-4 w-4 mr-2" />
              {generating ? '生成中…' : '生成注册码'}
            </Button>
            <Button variant="outline" onClick={() => loadList()} type="button">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新列表
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>注册码列表</CardTitle>
            <CardDescription>共 {total} 条</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>注册码</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>用量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-medium">{row.code}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{row.note || '—'}</TableCell>
                    <TableCell>
                      {row.usedCount}/{row.maxUses}
                    </TableCell>
                    <TableCell>
                      {row.disabled ? (
                        <Badge variant="secondary">已作废</Badge>
                      ) : row.usedCount >= row.maxUses ? (
                        <Badge>已用尽</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          有效
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.createdBy && <span>{row.createdBy} · </span>}
                      {row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {!row.disabled && row.usedCount < row.maxUses ? (
                        <Button variant="ghost" size="sm" onClick={() => disableRow(row.id)}>
                          作废
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {total > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                上一页
              </Button>
              <span className="text-sm py-2">第 {page} 页</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
