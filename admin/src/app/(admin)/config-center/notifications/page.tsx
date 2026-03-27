'use client'

import { useEffect, useState } from 'react'
import { Bell, Save, Volume2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  loadAdminNotificationSettings,
  saveAdminNotificationSettings,
  type AdminNotificationSettings,
} from '@/lib/admin-notification-settings'
import { playAdminNotificationSound, registerAdminNotificationSoundUnlock } from '@/lib/notification-sound'

function getHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
    'Content-Type': 'application/json',
  }
}

export default function NotificationConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<AdminNotificationSettings>(loadAdminNotificationSettings())

  const loadConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/admin/api/admin-v2/notification-settings', {
        headers: getHeaders(),
      })
      const data = await response.json()
      if (data.code === 0) {
        const nextForm = saveAdminNotificationSettings(data.data || {})
        setForm(nextForm)
      } else {
        toast.error(data.message || '加载通知设置失败')
      }
    } catch (error) {
      toast.error('加载通知设置失败')
    } finally {
      setLoading(false)
    }
  }

  const updateField = <K extends keyof AdminNotificationSettings>(key: K, value: AdminNotificationSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const response = await fetch('/admin/api/admin-v2/notification-settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (data.code === 0) {
        const nextForm = saveAdminNotificationSettings(data.data || form)
        setForm(nextForm)
        toast.success('通知告警设置已保存')
      } else {
        toast.error(data.message || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    registerAdminNotificationSoundUnlock()
    loadConfig()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">通知设置</h1>
          <p className="text-muted-foreground">通知开关、提醒方式和告警策略的统一配置入口。</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>管理员提醒</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">管理员通知总开关</div>
              <div className="text-sm text-muted-foreground">关闭后不再向管理员端广播新的实时通知。</div>
            </div>
            <Switch checked={form.adminNotificationEnabled} onCheckedChange={(checked) => updateField('adminNotificationEnabled', checked)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">网页端声音提醒</div>
              <div className="text-sm text-muted-foreground">管理员网页收到新通知或告警时播放声音。</div>
            </div>
            <Switch checked={form.adminNotificationSoundEnabled} onCheckedChange={(checked) => updateField('adminNotificationSoundEnabled', checked)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">网页端通知</div>
              <div className="text-sm text-muted-foreground">用于区分网页端展示策略，当前实时广播仍统一走管理员通知。</div>
            </div>
            <Switch checked={form.adminNotificationWebEnabled} onCheckedChange={(checked) => updateField('adminNotificationWebEnabled', checked)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">手机端通知</div>
              <div className="text-sm text-muted-foreground">管理员在用户端手机页面查看通知和告警时使用同一套阈值配置。</div>
            </div>
            <Switch checked={form.adminNotificationMobileEnabled} onCheckedChange={(checked) => updateField('adminNotificationMobileEnabled', checked)} />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => playAdminNotificationSound('notification').catch(() => null)}
          >
            <Volume2 className="mr-2 h-4 w-4" />
            试听提示音
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>业务告警阈值</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="alertCooldownSeconds">告警冷却秒数</Label>
            <Input id="alertCooldownSeconds" type="number" value={form.alertCooldownSeconds} onChange={(e) => updateField('alertCooldownSeconds', Number(e.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manualQueueThreshold">人工列表阈值</Label>
            <Input id="manualQueueThreshold" type="number" value={form.manualQueueThreshold} onChange={(e) => updateField('manualQueueThreshold', Number(e.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staleTaskMinutes">任务超时分钟</Label>
            <Input id="staleTaskMinutes" type="number" value={form.staleTaskMinutes} onChange={(e) => updateField('staleTaskMinutes', Number(e.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pendingPayoutMinutes">待打款分钟</Label>
            <Input id="pendingPayoutMinutes" type="number" value={form.pendingPayoutMinutes} onChange={(e) => updateField('pendingPayoutMinutes', Number(e.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userAnomalyThreshold">用户异常阈值</Label>
            <Input id="userAnomalyThreshold" type="number" value={form.userAnomalyThreshold} onChange={(e) => updateField('userAnomalyThreshold', Number(e.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rewardAnomalyThreshold">奖励异常阈值</Label>
            <Input id="rewardAnomalyThreshold" type="number" value={form.rewardAnomalyThreshold} onChange={(e) => updateField('rewardAnomalyThreshold', Number(e.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rewardAnomalyLookbackMinutes">奖励异常回溯分钟</Label>
            <Input id="rewardAnomalyLookbackMinutes" type="number" value={form.rewardAnomalyLookbackMinutes} onChange={(e) => updateField('rewardAnomalyLookbackMinutes', Number(e.target.value || 0))} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={loading || saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? '保存中...' : '保存设置'}
        </Button>
      </div>
    </div>
  )
}
