'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Settings, Save, RefreshCw, Info } from 'lucide-react'

interface ExposureConfig {
  enabled: boolean
  maxExposurePerHour: number
  minOnlineTime: number
  levelWeight: number
  cityWeight: number
  historyWeight: number
}

export default function ExposureConfigPage() {
  const [config, setConfig] = useState<ExposureConfig>({
    enabled: true,
    maxExposurePerHour: 10,
    minOnlineTime: 30,
    levelWeight: 0.4,
    cityWeight: 0.3,
    historyWeight: 0.3,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/admin/api/admin-v2/exposure/config')
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          setConfig(data.data)
        }
      }
    } catch (error) {
      console.error('获取配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/admin/api/admin-v2/exposure/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: '配置保存成功' })
      } else {
        throw new Error('保存失败')
      }
    } catch (error) {
      setMessage({ type: 'error', text: '配置保存失败' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">曝光配置</h1>
          <p className="text-muted-foreground">配置任务曝光分配策略</p>
        </div>
        <Button onClick={fetchConfig} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            基础配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>启用曝光分配</Label>
              <p className="text-sm text-muted-foreground">开启后系统将自动分配任务曝光</p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>每小时最大曝光次数</Label>
              <Input
                type="number"
                value={config.maxExposurePerHour}
                onChange={(e) => setConfig({ ...config, maxExposurePerHour: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>最小在线时长(分钟)</Label>
              <Input
                type="number"
                value={config.minOnlineTime}
                onChange={(e) => setConfig({ ...config, minOnlineTime: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>权重配置</CardTitle>
          <p className="text-sm text-muted-foreground">调整各因素在曝光分配中的权重</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              权重总和应为1.0，当前总和: {(config.levelWeight + config.cityWeight + config.historyWeight).toFixed(2)}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>等级权重</Label>
                <Badge variant="outline">{config.levelWeight}</Badge>
              </div>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.levelWeight}
                onChange={(e) => setConfig({ ...config, levelWeight: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>城市权重</Label>
                <Badge variant="outline">{config.cityWeight}</Badge>
              </div>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.cityWeight}
                onChange={(e) => setConfig({ ...config, cityWeight: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>历史权重</Label>
                <Badge variant="outline">{config.historyWeight}</Badge>
              </div>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.historyWeight}
                onChange={(e) => setConfig({ ...config, historyWeight: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? '保存中...' : '保存配置'}
        </Button>
      </div>
    </div>
  )
}
