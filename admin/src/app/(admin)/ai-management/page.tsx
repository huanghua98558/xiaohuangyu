'use client'

import { useState, useEffect } from 'react'
import { TASK_ACTIONS, TASK_ACTION_NAMES, PLATFORMS, PLATFORM_NAMES, getActionName as getActionNameConst, getPlatformName as getPlatformNameConst } from '@/constants/taskActions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Settings,
  Database,
  Activity,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Save,
  TrendingUp,
  Zap,
  DollarSign,
  Bot,
  Shield,
  BarChart3,
  Brain,
  Sparkles,
  Gauge,
  ToggleLeft,
  Globe,
  Eye,
  FileCheck,
  Monitor,
  Loader2,
  Edit3,
  Link2,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  Bell,
  Timer,
  RotateCcw,
  Cpu,
  Key,
  EyeOff,
  Image as ImageIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// 配置项类型
interface ConfigItem {
  key: string
  value: string
  type: string
  description?: string
  category: string
  isEnabled: boolean
  updatedAt?: string
}

// 可用模型类型
interface AvailableModel {
  id: string
  name: string
  description: string
  category: string
  capabilities: string[]
  recommended: string
  requiresThinking?: boolean
  restrictions?: {
    temperature?: { thinking: number; normal: number }
    top_p?: number
    max_tokens?: number
  }
}

// API提供商类型
interface APIProvider {
  id: string
  name: string
  baseUrl: string
  models: string[]
  description: string
  icon?: string
  requiresApiKey: boolean
  isCustom?: boolean
}

// 主流API提供商列表
const API_PROVIDERS: APIProvider[] = [
  {
    id: 'siliconflow',
    name: '硅基流动 (SiliconFlow)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      // 文本模型
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen3-32B',
      'Qwen/Qwen3-14B',
      'Qwen/Qwen2.5-7B-Instruct',
      'Qwen/QwQ-32B',
      'THUDM/GLM-4-32B-0414',
      // 视觉模型
      'THUDM/GLM-4.1V-9B-Thinking',
      'Qwen/Qwen2.5-VL-32B-Instruct',
      'Qwen/Qwen2.5-VL-72B-Instruct',
      'deepseek-ai/DeepSeek-VL2',
      'THUDM/GLM-4V-9B',
    ],
    description: '硅基流动·多模型聚合平台',
    requiresApiKey: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    description: 'OpenAI官方API',
    requiresApiKey: true
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    description: 'DeepSeek深度求索',
    requiresApiKey: true
  },
  {
    id: 'kimi',
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    description: '月之暗面Kimi',
    requiresApiKey: true
  },
  {
    id: 'doubao',
    name: '豆包 (字节跳动)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k', 'doubao-lite-128k'],
    description: '字节跳动豆包大模型',
    requiresApiKey: true
  },
  {
    id: 'zhipu',
    name: '智谱AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-0520', 'glm-4', 'glm-4-air', 'glm-4-airx', 'glm-4-flash'],
    description: '智谱清言GLM系列',
    requiresApiKey: true
  },
  {
    id: 'qwen',
    name: '通义千问 (阿里云)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext', 'qwen-long'],
    description: '阿里云通义千问',
    requiresApiKey: true
  },
  {
    id: 'ernie',
    name: '文心一言 (百度)',
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
    models: ['ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-speed-8k', 'ernie-lite-8k'],
    description: '百度文心一言',
    requiresApiKey: true
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    description: 'Anthropic Claude',
    requiresApiKey: true
  },
  {
    id: 'coze',
    name: '扣子Coze',
    baseUrl: 'https://api.coze.cn/v1',
    models: ['coze-chat', 'coze-chat-v3'],
    description: '字节跳动扣子平台',
    requiresApiKey: true
  },
  {
    id: 'custom',
    name: '自定义API',
    baseUrl: '',
    models: [],
    description: '自定义API地址和模型',
    requiresApiKey: true,
    isCustom: true
  }
]

// 双AI图片审核可用模型
const IMAGE_REVIEW_MODELS = [
  { id: 'gemini', name: 'Gemini 1.5 Flash', provider: 'Google', description: 'Google多模态模型', capabilities: ['图片识别', '文字提取', '内容审核'], maxImageSize: 4000000, recommended: true },
  { id: 'bailian', name: '通义千问 VL', provider: '阿里云', description: '阿里云视觉语言模型', capabilities: ['图片识别', '文字提取', '内容审核'], maxImageSize: 10000000, recommended: false },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', description: 'OpenAI多模态模型', capabilities: ['图片识别', '文字提取', '内容审核'], maxImageSize: 20000000, recommended: false },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', description: 'Anthropic多模态模型', capabilities: ['图片识别', '文字提取', '内容审核'], maxImageSize: 5000000, recommended: false }
]

// 日志项类型
interface LogItem {
  id: number
  userId: number
  type: string
  action: string
  input: any
  output: any
  status: string
  errorMsg?: string
  duration: number
  createdAt: string
}

// 统计数据
interface StatsData {
  total: number
  success: number
  failed: number
  successRate: number
  avgDuration: number
  byType: Array<{ type: string; count: number }>
  byAction: Array<{ action: string; count: number }>
}

// AI使用统计
interface AIUsageStats {
  day: string
  summary: {
    requests: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
    failures: number
  }
  providers: Array<{ name: string; requests?: number; tokens?: number }>
  models: Array<{ name: string; requests?: number; tokens?: number }>
  stages: Array<{ name: string; requests?: number; tokens?: number; promptTokens?: number; completionTokens?: number }>
}

// 审核规则类型
interface ReviewRule {
  id: number
  platform: string
  action: string
  rule_config: {
    checkItems?: string[]
    minScreenshots?: number
  }
  ai_prompt: string
  screenshot_requirements: Array<{ desc: string; required: boolean }>
  link_verify_enabled: boolean
  link_verify_config?: any
  auto_reject_enabled: boolean  // 直接拒绝模式：true=不满足条件直接拒绝，false=转人工审核
  thresholds: {
    approve: number
    reject: number
  }
  is_active: boolean
  created_at: string
  updated_at: string
}

// 浏览器健康状态
interface BrowserHealth {
  status: 'ok' | 'error' | 'initializing'
  chromiumReady: boolean
  memoryUsage?: string
  lastCheck: string
  error?: string
}

// 配置项显示名称映射
const CONFIG_LABELS: Record<string, string> = {
  // 通用配置
  'llm_model': 'LLM 模型',
  'llm_temperature': '温度参数',
  'max_conversation_history': '会话历史数',
  // 发布助手
  'publisher_model': '发布助手模型',
  'publisher_system_prompt': '系统提示词',
  'publisher_temperature': '温度参数',
  'default_task_reward': '默认积分奖励',
  'default_task_remain': '默认任务名额',
  'default_task_time_limit': '默认时效(分钟)',
  // 审核助手
  'reviewer_model': '审核助手模型',
  'reviewer_system_prompt': '系统提示词',
  'reviewer_temperature': '温度参数',
  'ai_review_enabled': 'AI审核开关',
  'ai_review_mode': '审核模式',
  'ai_approve_threshold': '自动通过阈值',
  'ai_reject_threshold': '自动拒绝阈值',
  'random_check_rate': '随机抽查率',
  'fingerprint_check_enabled': '指纹去重',
  'credit_check_enabled': '信用分检查',
  'ai_review_auto_approve': '允许自动通过',
  'ai_review_auto_reject': '允许自动拒绝',
  'ai_review_manual_fallback': '转人工审核',
  'ai_review_max_retry': '最大重试次数',
  'ai_review_timeout': '审核超时时间(秒)',
  // 队列配置
  'queue_batch_size': '批量处理数',
  'queue_poll_interval': '轮询间隔(ms)',
  // 用户助手
  'user_assistant_system_prompt': '系统提示词',
  // 联动配置
  'ai_review_trigger_mode': '触发模式',
  'ai_review_schedule_interval': '定时轮询间隔(秒)',
  'ai_review_callback_enabled': '回调通知开关',
  'ai_review_callback_url': '回调URL',
  'ai_review_notify_user': '用户通知开关',
  'browser_automation_enabled': '浏览器自动化',
  'browser_automation_timeout': '浏览器超时(秒)',
}

export default function AIManagementPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([])
  const [logs, setLogs] = useState<LogItem[]>([])
  const [stats, setStats] = useState<StatsData>({
    total: 0, success: 0, failed: 0, successRate: 0, avgDuration: 0, byType: [], byAction: []
  })
  const [reviewRules, setReviewRules] = useState<ReviewRule[]>([])
  const [browserHealth, setBrowserHealth] = useState<BrowserHealth>({
    status: 'initializing',
    chromiumReady: false,
    lastCheck: ''
  })
  const [editingRule, setEditingRule] = useState<ReviewRule | null>(null)
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [logFilter, setLogFilter] = useState({ type: '', status: '' })
  const [activeConfigSection, setActiveConfigSection] = useState<string>('model')
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  const [manualReviewQueue, setManualReviewQueue] = useState<any[]>([])
  const [manualReviewLoading, setManualReviewLoading] = useState(false)
  const [queueStats, setQueueStats] = useState<{ pending: number; manual: number; aiApproved: number; aiRejected: number }>({ pending: 0, manual: 0, aiApproved: 0, aiRejected: 0 })
  const [aiUsageStats, setAIUsageStats] = useState<AIUsageStats>({
    day: "",
    summary: { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, failures: 0 },
    providers: [],
    models: [],
    stages: []
  })

  // 获取认证头
  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  }

  // 加载配置
  const loadConfigs = async () => {
    try {
      const res = await fetch('/admin/api/ai/admin/configs', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.code === 200) {
        setConfigs(data.data?.list || data.data || [])
      } else if (data.code === 401) {
        toast.error('请先登录')
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      toast.error('加载配置失败')
    }
  }

  // 加载日志
  const loadLogs = async () => {
    try {
      const params = new URLSearchParams()
      if (logFilter.type) params.append('type', logFilter.type)
      if (logFilter.status) params.append('status', logFilter.status)
      const res = await fetch(`/admin/api/ai/admin/logs?${params}`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.code === 200) setLogs(data.data?.list || data.data || [])
    } catch (error) {
      console.error('加载日志失败:', error)
    }
  }

  // 加载统计
  const loadStats = async () => {
    try {
      const res = await fetch('/admin/api/ai/admin/stats', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.code === 200) setStats(data.data || stats)
    } catch (error) {
      console.error("加载统计失败:", error)
    }
  }

  // 加载AI使用统计
  const loadAIUsageStats = async () => {
    try {
      const res = await fetch("/admin/api/ai/admin/usage-stats", { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.code === 200) setAIUsageStats(data.data)
    } catch (error) {
      console.error("加载AI使用统计失败:", error)
    }
  }

  // 加载审核规则
  const loadReviewRules = async () => {
    try {
      const res = await fetch('/admin/api/ai/admin/review-rules', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.code === 200) setReviewRules(data.data || [])
    } catch (error) {
      console.error('加载审核规则失败:', error)
    }
  }

  // 加载待人工审核队列
  const loadManualReviewQueue = async () => {
    setManualReviewLoading(true)
    try {
      const res = await fetch('/admin/api/ai/reviewer/queue?status=manual&page=1&pageSize=10', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.code === 200) {
        setManualReviewQueue(data.data?.list || data.data || [])
      }
    } catch (error) {
      console.error('加载待人工审核队列失败:', error)
    } finally {
      setManualReviewLoading(false)
    }
  }

  // 加载队列统计
  const loadQueueStats = async () => {
    try {
      const res = await fetch('/admin/api/ai/reviewer/stats', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.code === 200) {
        setQueueStats(data.data || { pending: 0, manual: 0, aiApproved: 0, aiRejected: 0 })
      }
    } catch (error) {
      console.error('加载队列统计失败:', error)
    }
  }

  // 人工审核操作
  const handleManualReview = async (claimId: number, action: 'approve' | 'reject', note?: string) => {
    try {
      const res = await fetch('/admin/api/ai/reviewer/manual', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ claimId, action, note })
      })
      const data = await res.json()
      if (data.code === 200) {
        toast.success(action === 'approve' ? '已通过' : '已拒绝')
        loadManualReviewQueue()
      } else {
        throw new Error(data.message)
      }
    } catch (error: any) {
      toast.error('操作失败：' + error.message)
    }
  }

  // 加载浏览器健康状态
  const loadBrowserHealth = async () => {
    try {
      const res = await fetch('/admin/api/ai/admin/browser-health', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.code === 200) setBrowserHealth(data.data || browserHealth)
    } catch (error) {
      console.error('加载浏览器健康状态失败:', error)
      setBrowserHealth(prev => ({ ...prev, status: 'error', error: '连接失败' }))
    }
  }

  // 加载可用模型列表
  const loadAvailableModels = async () => {
    try {
      const res = await fetch('/admin/api/ai/admin/models', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.code === 200) setAvailableModels(data.data || [])
    } catch (error) {
      console.error('加载模型列表失败:', error)
    }
  }

  // 更新审核规则
  const updateReviewRule = async (ruleId: number, updates: Partial<ReviewRule>) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/admin/api/ai/admin/review-rules/${ruleId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      })
      const data = await res.json()
      if (data.code === 200) {
        toast.success('规则已更新')
        loadReviewRules()
      } else {
        throw new Error(data.message)
      }
    } catch (error: any) {
      toast.error('更新失败：' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
    loadLogs()
    loadStats()
    loadAIUsageStats()
    loadReviewRules()
    loadBrowserHealth()
    loadAvailableModels()
    loadManualReviewQueue()
    loadQueueStats()
  }, [logFilter])

  // 更新配置
  const updateConfig = async (key: string, value: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/admin/api/ai/admin/configs', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ key, value })
      })
      const data = await res.json()
      if (data.code === 200) {
        toast.success('配置已保存')
        loadConfigs()
      } else {
        throw new Error(data.message)
      }
    } catch (error: any) {
      toast.error('保存失败：' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 格式化日志类型
  const getLogTypeLabel = (type: string) => ({
    publisher: '发布助手', reviewer: '审核助手', admin: '管理命令', llm: '大语言模型'
  }[type] || type)

  // 格式化日志操作
  const getLogActionLabel = (action: string) => ({
    chat: '对话', publish: '发布任务', publish_task: '发布任务',
    auto_review: '自动审核', manual_review: '人工审核', direct_review: '直接审核',
    comprehensive_review: '综合审核', query: '查询', notify: '通知'
  }[action] || action)

  // 按分类分组配置
  const getConfigsByCategory = (category: string) => configs.filter(c => c.category === category)

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 顶部栏 */}
      <div className="bg-white dark:bg-gray-800 border-b px-3 md:px-6 py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">配置模型参数 · 监控运行状态</p>
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 text-xs hidden sm:flex">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              服务正常
            </Badge>
            <Button variant="outline" size="sm" className="h-8" onClick={() => { loadConfigs(); loadLogs(); loadStats(); }}>
              <RefreshCw className="w-3.5 h-3.5 md:mr-1.5" />
              <span className="hidden md:inline">刷新</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 统计卡片 - 响应式网格 */}
      <div className="px-3 md:px-6 py-3 bg-white dark:bg-gray-800 border-b shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <div className="p-1.5 md:p-2 rounded-lg bg-blue-100 dark:bg-blue-800 shrink-0">
              <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground">总调用</p>
              <p className="text-base md:text-lg font-bold">{stats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="p-1.5 md:p-2 rounded-lg bg-green-100 dark:bg-green-800 shrink-0">
              <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground">成功率</p>
              <p className="text-base md:text-lg font-bold text-green-600">{stats.successRate || 0}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <div className="p-1.5 md:p-2 rounded-lg bg-amber-100 dark:bg-amber-800 shrink-0">
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground">平均耗时</p>
              <p className="text-base md:text-lg font-bold">{(stats.avgDuration / 1000).toFixed(2)}s</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="p-1.5 md:p-2 rounded-lg bg-red-100 dark:bg-red-800 shrink-0">
              <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground">失败次数</p>
              <p className="text-base md:text-lg font-bold text-red-600">{stats.failed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="configs" className="h-full flex flex-col">
          {/* 双AI Token消耗统计 - 两个卡片并排 */}
          <div className="px-3 md:px-6 py-2 md:py-3 bg-white dark:bg-gray-800 border-b shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {/* 图片复审AI统计 */}
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">图片复审AI</span>
                  </div>
                  <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs">
                    百炼视觉
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">请求次数</p>
                    <p className="text-base font-bold">{aiUsageStats.stages?.find(s => s.name === "image_review")?.requests || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">输入Token</p>
                    <p className="text-base font-bold text-blue-600">{aiUsageStats.stages?.find(s => s.name === "image_review")?.promptTokens || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">输出Token</p>
                    <p className="text-base font-bold text-green-600">{aiUsageStats.stages?.find(s => s.name === "image_review")?.completionTokens || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">总Token</p>
                    <p className="text-base font-bold text-purple-600">{aiUsageStats.stages?.find(s => s.name === "image_review")?.tokens || 0}</p>
                  </div>
                </div>
              </div>
              
              {/* 评论审查AI统计 */}
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/20 dark:border-emerald-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium">评论审查AI</span>
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-xs">
                    qwen-plus
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">请求次数</p>
                    <p className="text-base font-bold">{aiUsageStats.stages?.find(s => s.name === "semantic_analysis")?.requests || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">输入Token</p>
                    <p className="text-base font-bold text-blue-600">{aiUsageStats.stages?.find(s => s.name === "semantic_analysis")?.promptTokens || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">输出Token</p>
                    <p className="text-base font-bold text-green-600">{aiUsageStats.stages?.find(s => s.name === "semantic_analysis")?.completionTokens || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">总Token</p>
                    <p className="text-base font-bold text-purple-600">{aiUsageStats.stages?.find(s => s.name === "semantic_analysis")?.tokens || 0}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 总计行 */}
            <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>今日总计: {aiUsageStats.summary?.requests || 0} 次请求</span>
              <span>总Token: {aiUsageStats.summary?.totalTokens || 0} | 失败: {aiUsageStats.summary?.failures || 0}</span>
            </div>
          </div>
          
          <div className="px-3 md:px-6 py-2 bg-white dark:bg-gray-800 border-b shrink-0 overflow-x-auto">
            <TabsList className="bg-transparent p-0 h-auto gap-2 md:gap-4 flex-nowrap">
              <TabsTrigger value="configs" className="gap-1 md:gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white text-xs md:text-sm shrink-0">
                <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">配置</span>管理
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-1 md:gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white text-xs md:text-sm shrink-0">
                <FileCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
                审核规则
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1 md:gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white text-xs md:text-sm shrink-0">
                <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />
                操作日志
              </TabsTrigger>
              <TabsTrigger value="monitor" className="gap-1 md:gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white text-xs md:text-sm shrink-0">
                <Activity className="w-3.5 h-3.5 md:w-4 md:h-4" />
                运行监控
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 配置管理 - 卡片导航模式 */}
          <TabsContent value="configs" className="flex-1 overflow-auto m-0 p-3 md:p-6">
            <div className="space-y-4 md:space-y-6">
              {/* 配置卡片网格 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {/* 发布助手卡片 */}
                <ConfigCard
                  icon={Zap}
                  iconColor="text-amber-500"
                  iconBg="bg-amber-100 dark:bg-amber-900/30"
                  title="发布助手"
                  description="任务发布设置、默认积分、时效配置"
                  isActive={activeConfigSection === 'publisher'}
                  onClick={() => setActiveConfigSection(activeConfigSection === 'publisher' ? '' : 'publisher')}
                  configCount={getConfigsByCategory('publisher').length}
                />
                
                {/* 审核助手卡片 */}
                <ConfigCard
                  icon={Shield}
                  iconColor="text-emerald-500"
                  iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                  title="审核助手"
                  description="AI审核开关、置信度阈值、审核策略"
                  isActive={activeConfigSection === 'reviewer'}
                  onClick={() => setActiveConfigSection(activeConfigSection === 'reviewer' ? '' : 'reviewer')}
                  configCount={getConfigsByCategory('reviewer').length}
                />
                
                {/* 用户助手卡片 */}
                <ConfigCard
                  icon={Bot}
                  iconColor="text-blue-500"
                  iconBg="bg-blue-100 dark:bg-blue-900/30"
                  title="用户助手"
                  description="用户服务设置、提示词配置"
                  isActive={activeConfigSection === 'user'}
                  onClick={() => setActiveConfigSection(activeConfigSection === 'user' ? '' : 'user')}
                  configCount={getConfigsByCategory('user').length}
                />
                
                {/* 队列配置卡片 */}
                <ConfigCard
                  icon={Database}
                  iconColor="text-slate-500"
                  iconBg="bg-slate-100 dark:bg-slate-900/30"
                  title="队列配置"
                  description="批量处理数、轮询间隔、队列管理"
                  isActive={activeConfigSection === 'queue'}
                  onClick={() => setActiveConfigSection(activeConfigSection === 'queue' ? '' : 'queue')}
                  configCount={getConfigsByCategory('queue').length}
                />
                
                {/* 联动配置卡片 - 新增 */}
                <ConfigCard
                  icon={Link2}
                  iconColor="text-pink-500"
                  iconBg="bg-pink-100 dark:bg-pink-900/30"
                  title="联动配置"
                  description="触发机制、回调通知、系统集成"
                  isActive={activeConfigSection === 'integration'}
                  onClick={() => setActiveConfigSection(activeConfigSection === 'integration' ? '' : 'integration')}
                  configCount={getConfigsByCategory('integration').length}
                  isNew
                />
              </div>

              {/* 配置详情面板 */}
              {activeConfigSection && (
                <Card className="border-2 shadow-sm">
                  <CardHeader className="py-4 px-6 border-b bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {activeConfigSection === 'publisher' && (
                          <>
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                              <Zap className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                              <CardTitle className="text-base">发布助手配置</CardTitle>
                              <p className="text-sm text-muted-foreground">任务发布相关设置</p>
                            </div>
                          </>
                        )}
                        {activeConfigSection === 'reviewer' && (
                          <>
                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                              <Shield className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                              <CardTitle className="text-base">审核助手配置</CardTitle>
                              <p className="text-sm text-muted-foreground">AI审核策略设置</p>
                            </div>
                          </>
                        )}
                        {activeConfigSection === 'user' && (
                          <>
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Bot className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                              <CardTitle className="text-base">用户助手配置</CardTitle>
                              <p className="text-sm text-muted-foreground">用户服务相关设置</p>
                            </div>
                          </>
                        )}
                        {activeConfigSection === 'queue' && (
                          <>
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900/30">
                              <Database className="w-5 h-5 text-slate-500" />
                            </div>
                            <div>
                              <CardTitle className="text-base">队列配置</CardTitle>
                              <p className="text-sm text-muted-foreground">审核队列管理</p>
                            </div>
                          </>
                        )}
                        {activeConfigSection === 'integration' && (
                          <>
                            <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                              <Link2 className="w-5 h-5 text-pink-500" />
                            </div>
                            <div>
                              <CardTitle className="text-base">联动配置</CardTitle>
                              <p className="text-sm text-muted-foreground">AI与任务中心联动设置</p>
                            </div>
                          </>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setActiveConfigSection('')}>
                        收起
                        <ChevronDown className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* 发布助手模型配置 */}
                    {activeConfigSection === 'publisher' && (
                      <ModelConfigCard 
                        type="publisher" 
                        title="发布助手模型配置"
                        description="配置发布助手使用的API提供商和模型"
                        onConfigChange={() => loadConfigs()}
                      />
                    )}
                    {/* 审核助手模型配置 */}
                    {activeConfigSection === 'reviewer' && (
                      <ModelConfigCard 
                        type="reviewer" 
                        title="审核助手模型配置"
                        description="配置审核助手使用的API提供商和模型（建议使用视觉模型）"
                        onConfigChange={() => loadConfigs()}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                      {activeConfigSection === 'publisher' && getConfigsByCategory('publisher')
                        .filter(cfg => ![
                          'publisher_model', // 已在模型配置区域管理
                          'publisher_api_provider', 'publisher_api_provider_name', 
                          'publisher_api_base_url', 'publisher_api_key' // 已在模型配置区域显示
                        ].includes(cfg.key))
                        .map(cfg => (
                          <ConfigItem key={cfg.key} config={cfg} onSave={updateConfig} disabled={isLoading} availableModels={availableModels} />
                        ))}
                      {activeConfigSection === 'reviewer' && (
                        <>
                          {getConfigsByCategory('reviewer')
                            .filter(cfg => ![
                              'reviewer_model', // 已在模型配置区域管理
                              'reviewer_api_provider', 'reviewer_api_provider_name',
                              'reviewer_api_base_url', 'reviewer_api_key' // 已在模型配置区域显示
                            ].includes(cfg.key))
                            .map(cfg => (
                              <ConfigItem key={cfg.key} config={cfg} onSave={updateConfig} disabled={isLoading} availableModels={availableModels} />
                            ))}
                          {/* 双AI图片审核配置 */}
                          <div className="col-span-2 mb-4 p-4 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center gap-2 mb-3">
                              <ImageIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                              <p className="font-medium text-purple-700 dark:text-purple-300">三级图片审核配置</p>
                              <Badge variant="outline" className="ml-2 text-xs border-purple-300 text-purple-600">双AI架构</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">图片审核开关</span>
                                  <Switch checked={configs.find(c => c.key === "image_review_enabled")?.value === "true"} onCheckedChange={(checked) => updateConfig("image_review_enabled", checked ? "true" : "false")} />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">启用兜底机制</span>
                                  <Switch checked={configs.find(c => c.key === "image_review_fallback_enabled")?.value !== "false"} onCheckedChange={(checked) => updateConfig("image_review_fallback_enabled", checked ? "true" : "false")} />
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <span className="text-sm text-muted-foreground block mb-1">主力审核模型</span>
                                  <Select value={configs.find(c => c.key === "image_review_primary_model")?.value || "gemini"} onValueChange={(v) => updateConfig("image_review_primary_model", v)}>
                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {IMAGE_REVIEW_MODELS.map(m => (<SelectItem key={m.id} value={m.id}>{m.name} {m.recommended && "(推荐)"}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <span className="text-sm text-muted-foreground block mb-1">兜底审核模型</span>
                                  <Select value={configs.find(c => c.key === "image_review_fallback_model")?.value || "bailian"} onValueChange={(v) => updateConfig("image_review_fallback_model", v)}>
                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {IMAGE_REVIEW_MODELS.map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                              <div>
                                <span className="text-xs text-muted-foreground">图片压缩阈值(KB)</span>
                                <Input type="number" className="h-7 mt-1" value={configs.find(c => c.key === "image_review_compression_threshold")?.value || "500"} onChange={(e) => updateConfig("image_review_compression_threshold", e.target.value)} />
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">审核失败重试次数</span>
                                <Input type="number" className="h-7 mt-1" value={configs.find(c => c.key === "image_review_max_retry")?.value || "3"} onChange={(e) => updateConfig("image_review_max_retry", e.target.value)} />
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">API超时时间(秒)</span>
                                <Input type="number" className="h-7 mt-1" value={configs.find(c => c.key === "image_review_api_timeout")?.value || "30"} onChange={(e) => updateConfig("image_review_api_timeout", e.target.value)} />
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                              <p className="text-xs text-muted-foreground mb-2">审核流程</p>
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border"><ImageIcon className="w-3 h-3 text-purple-500" />图片上传</div>
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200"><Cpu className="w-3 h-3 text-blue-500" />主力模型审核</div>
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/30 border border-amber-200"><RotateCcw className="w-3 h-3 text-amber-500" />失败则兜底</div>
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-50 dark:bg-green-900/30 border border-green-200"><CheckCircle className="w-3 h-3 text-green-500" />返回结果</div>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">多维度审核权重</p>
                            <div className="grid grid-cols-4 gap-2 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <span className="text-blue-600 dark:text-blue-400">截图分析 40%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="text-green-600 dark:text-green-400">链接验证 30%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <span className="text-amber-600 dark:text-amber-400">评论语义 20%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500" />
                                <span className="text-purple-600 dark:text-purple-400">用户行为 10%</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {activeConfigSection === 'user' && getConfigsByCategory('user').map(cfg => (
                        <ConfigItem key={cfg.key} config={cfg} onSave={updateConfig} disabled={isLoading} availableModels={availableModels} />
                      ))}
                      {activeConfigSection === 'queue' && getConfigsByCategory('queue').map(cfg => (
                        <ConfigItem key={cfg.key} config={cfg} onSave={updateConfig} disabled={isLoading} availableModels={availableModels} />
                      ))}
                      {activeConfigSection === 'integration' && (
                        <>
                          {getConfigsByCategory('integration').map(cfg => (
                            <ConfigItem key={cfg.key} config={cfg} onSave={updateConfig} disabled={isLoading} availableModels={availableModels} />
                          ))}
                          <div className="col-span-2 mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                            <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-3">联动流程说明</p>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border">
                                <Play className="w-3 h-3 text-green-500" />
                                任务提交
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              <div className="flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border">
                                <Zap className="w-3 h-3 text-amber-500" />
                                触发AI审核
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              <div className="flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border">
                                <Shield className="w-3 h-3 text-emerald-500" />
                                AI分析
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              <div className="flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-gray-800 border">
                                <CheckCircle className="w-3 h-3 text-blue-500" />
                                返回结果
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* 审核规则管理 */}
          <TabsContent value="rules" className="flex-1 overflow-auto p-3 md:p-4 m-0">
            <div className="space-y-4">
              {/* 规则列表 - 卡片式布局 */}
              {reviewRules.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>暂无审核规则</p>
                    <p className="text-xs mt-1">审核规则由系统自动初始化</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {reviewRules.map((rule) => (
                    <Card key={rule.id} className="overflow-hidden">
                      <div className="flex items-stretch">
                        {/* 左侧平台标识 */}
                        <div className="w-32 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4 border-r">
                          <PlatformBadge platform={rule.platform} />
                          <div className="mt-2 flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            <span className="text-xs text-muted-foreground">{rule.is_active ? '已启用' : '已禁用'}</span>
                          </div>
                        </div>
                        
                        {/* 中间内容区 */}
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-medium text-sm">短视频用户体验调研</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                最后更新: {new Date(rule.updated_at).toLocaleString('zh-CN')}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => { setEditingRule(rule); setShowRuleDialog(true) }}
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              编辑
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4 mb-3">
                            {/* 通过阈值 */}
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">通过阈值</p>
                              <p className="text-lg font-bold text-green-600">{(rule.thresholds.approve * 100).toFixed(0)}%</p>
                              <p className="text-[10px] text-muted-foreground">置信度 ≥ 此值自动通过</p>
                            </div>
                            
                            {/* 直接拒绝模式 */}
                            <div className={`rounded-lg p-3 ${rule.auto_reject_enabled ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-muted-foreground">拒绝模式</p>
                                <Switch
                                  checked={rule.auto_reject_enabled ?? false}
                                  onCheckedChange={(checked) => updateReviewRule(rule.id, { auto_reject_enabled: checked })}
                                  disabled={isLoading}
                                  className="scale-75"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                {rule.auto_reject_enabled ? (
                                  <>
                                    <Zap className="w-4 h-4 text-red-500" />
                                    <span className="text-sm font-bold text-red-600">直接拒绝</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-4 h-4 text-amber-500" />
                                    <span className="text-sm font-bold text-amber-600">人工复核</span>
                                  </>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {rule.auto_reject_enabled ? '不通过→自动拒绝' : '不通过→转人工'}
                              </p>
                            </div>
                            
                            {/* 链接验证 */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">链接验证</p>
                              <div className="flex items-center gap-2">
                                {rule.link_verify_enabled ? (
                                  <>
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <span className="text-sm font-medium text-green-600">已启用</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-5 h-5 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-500">已禁用</span>
                                  </>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">自动验证评论真实性</p>
                            </div>
                            
                            {/* 规则状态 */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 flex flex-col justify-center">
                              <p className="text-xs text-muted-foreground mb-1">规则状态</p>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={rule.is_active}
                                  onCheckedChange={(checked) => updateReviewRule(rule.id, { is_active: checked })}
                                  disabled={isLoading}
                                />
                                <span className={`text-sm font-medium ${rule.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                                  {rule.is_active ? '已启用' : '已禁用'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* AI提示词预览 */}
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-medium text-muted-foreground">AI 审核提示词</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => { setEditingRule(rule); setShowRuleDialog(true) }}
                              >
                                <Edit3 className="w-3 h-3 mr-1" />
                                编辑
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2" title={rule.ai_prompt}>
                              {rule.ai_prompt || '暂无提示词'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* 规则说明 */}
              <Card>
                <CardHeader className="py-3 px-4 border-b bg-gray-50/50">
                  <CardTitle className="text-sm font-medium">审核流程说明</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* 审核维度 */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">审核维度权重</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center text-purple-600 font-bold">40%</div>
                        <div>
                          <p className="font-medium">截图分析</p>
                          <p className="text-xs text-muted-foreground">识别点赞、评论等状态</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 font-bold">30%</div>
                        <div>
                          <p className="font-medium">链接验证</p>
                          <p className="text-xs text-muted-foreground">Playwright验证评论</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center text-green-600 font-bold">20%</div>
                        <div>
                          <p className="font-medium">评论语义</p>
                          <p className="text-xs text-muted-foreground">内容正向性分析</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-800 flex items-center justify-center text-orange-600 font-bold">10%</div>
                        <div>
                          <p className="font-medium">用户行为</p>
                          <p className="text-xs text-muted-foreground">历史通过率评估</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 拒绝模式说明 */}
                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">拒绝模式对比</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-5 h-5 text-red-500" />
                          <span className="font-medium text-red-700 dark:text-red-400">直接拒绝模式</span>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• 截图审核通过 → 自动通过</li>
                          <li>• 截图审核不通过 → <strong className="text-red-600">自动拒绝</strong></li>
                          <li>• 无需人工介入，效率最高</li>
                          <li>• 适合标准化任务</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className="w-5 h-5 text-amber-500" />
                          <span className="font-medium text-amber-700 dark:text-amber-400">人工复核模式</span>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• 截图审核通过 → 自动通过</li>
                          <li>• 截图审核不通过 → <strong className="text-amber-600">转人工审核</strong></li>
                          <li>• 边界情况人工把关</li>
                          <li>• 适合高价值任务</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 操作日志 */}
          <TabsContent value="logs" className="flex-1 overflow-hidden flex flex-col m-0">
            <div className="p-3 bg-white dark:bg-gray-800 border-b flex items-center gap-3 shrink-0">
              <Select value={logFilter.type} onValueChange={(v) => setLogFilter(f => ({ ...f, type: v }))}>
                <SelectTrigger className="w-28 h-8">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="publisher">发布助手</SelectItem>
                  <SelectItem value="reviewer">审核助手</SelectItem>
                  <SelectItem value="admin">管理命令</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logFilter.status} onValueChange={(v) => setLogFilter(f => ({ ...f, status: v }))}>
                <SelectTrigger className="w-28 h-8">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="success">成功</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={loadLogs}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                刷新
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3">
                {logs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">暂无操作日志</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="pb-2 font-medium">时间</th>
                        <th className="pb-2 font-medium">类型</th>
                        <th className="pb-2 font-medium">操作</th>
                        <th className="pb-2 font-medium">状态</th>
                        <th className="pb-2 font-medium">耗时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0">
                          <td className="py-2.5 text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5">
                            <Badge variant="outline" className="font-normal">{getLogTypeLabel(log.type)}</Badge>
                          </td>
                          <td className="py-2.5">{getLogActionLabel(log.action)}</td>
                          <td className="py-2.5">
                            {log.status === 'success' ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {(log.duration / 1000).toFixed(2)}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* 运行监控 */}
          <TabsContent value="monitor" className="flex-1 overflow-auto p-3 md:p-4 m-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
              {/* 服务状态 */}
              <Card>
                <CardHeader className="py-3 px-4 border-b bg-gray-50/50">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    服务状态
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {[
                      { name: 'API 连接', status: 'ok' },
                      { name: '数据库', status: 'ok' },
                      { name: '模型服务', status: 'ok' },
                      { name: '消息队列', status: 'ok' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <span className="text-sm">{item.name}</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          正常
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 浏览器自动化健康检查 */}
              <Card>
                <CardHeader className="py-3 px-4 border-b bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-500" />
                      浏览器自动化
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={loadBrowserHealth}>
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <span className="text-sm">Chromium 状态</span>
                      {browserHealth.chromiumReady ? (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          就绪
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200">
                          <Clock className="w-3 h-3 mr-1" />
                          {browserHealth.status === 'initializing' ? '初始化中' : '未就绪'}
                        </Badge>
                      )}
                    </div>
                    {browserHealth.memoryUsage && (
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <span className="text-sm">内存占用</span>
                        <span className="text-sm text-muted-foreground">{browserHealth.memoryUsage}</span>
                      </div>
                    )}
                    {browserHealth.error && (
                      <div className="py-2 px-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                        <p className="text-sm text-red-600">{browserHealth.error}</p>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground pt-2">
                      上次检查: {browserHealth.lastCheck ? new Date(browserHealth.lastCheck).toLocaleString() : '-'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 审核队列统计 */}
              <Card className="col-span-2">
                <CardHeader className="py-2 px-4 border-b bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-500" />
                      审核队列
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      {/* 统计标签 */}
                      <div className="flex items-center gap-3 text-xs">
                        <button 
                          onClick={() => loadManualReviewQueue()} 
                          className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                          title="点击查看待处理列表"
                        >
                          <span className="text-muted-foreground">待处理</span>
                          <Badge variant="secondary" className="h-5 px-1.5 text-xs">{queueStats.pending}</Badge>
                        </button>
                        <button 
                          onClick={() => loadManualReviewQueue()} 
                          className="flex items-center gap-1 hover:text-amber-600 transition-colors cursor-pointer"
                          title="点击查看待人工列表"
                        >
                          <span className="text-muted-foreground">待人工</span>
                          <Badge variant="outline" className="h-5 px-1.5 text-xs border-amber-300 text-amber-700">{queueStats.manual}</Badge>
                        </button>
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground">已处理</span>
                          <Badge variant="outline" className="h-5 px-1.5 text-xs border-green-300 text-green-700">{queueStats.aiApproved + queueStats.aiRejected}</Badge>
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { loadManualReviewQueue(); loadQueueStats(); }} disabled={manualReviewLoading}>
                        <RefreshCw className={cn("w-3.5 h-3.5", manualReviewLoading && "animate-spin")} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  {manualReviewQueue.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">暂无待人工审核任务</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {manualReviewQueue.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded border bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs truncate">{item.claim?.task?.title || '未知任务'}</p>
                            <p className="text-[10px] text-muted-foreground">
                              用户{item.user_id} | {item.claim?.task?.platform || '-'}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px] h-5 px-1 border-amber-300 text-amber-700">
                            {((item.ai_confidence || 0) * 100).toFixed(0)}%
                          </Badge>
                          <div className="flex gap-1 shrink-0">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleManualReview(item.claim_id, 'approve')}
                              title="通过"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleManualReview(item.claim_id, 'reject')}
                              title="拒绝"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                const screenshots = JSON.parse(item.screenshots || '[]')
                                if (screenshots.length > 0) {
                                  window.open(screenshots[0], '_blank')
                                }
                              }}
                              title="查看截图"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 调用分布 */}
              <Card>
                <CardHeader className="py-3 px-4 border-b bg-gray-50/50">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-500" />
                    调用分布
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {stats.byType?.length > 0 ? stats.byType.map(item => (
                      <div key={item.type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{getLogTypeLabel(item.type)}</span>
                          <span className="text-muted-foreground">{item.count}</span>
                        </div>
                        <Progress value={(item.count / stats.total) * 100} className="h-1.5" />
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 最近24小时 */}
              <Card className="col-span-2">
                <CardHeader className="py-3 px-4 border-b bg-gray-50/50">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    最近24小时趋势
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-40 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">图表功能开发中</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 审核规则编辑对话框 */}
      <RuleEditDialog
        rule={editingRule}
        open={showRuleDialog}
        onClose={() => { setShowRuleDialog(false); setEditingRule(null) }}
        onSave={(id, updates) => {
          updateReviewRule(id, updates)
          setShowRuleDialog(false)
          setEditingRule(null)
        }}
      />
    </div>
  )
}

// 配置卡片组件 - 大卡片导航样式
function ConfigCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  isActive,
  onClick,
  configCount,
  isNew
}: {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  title: string
  description: string
  isActive: boolean
  onClick: () => void
  configCount: number
  isNew?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full p-5 rounded-xl border-2 transition-all duration-200 text-left",
        "hover:shadow-lg hover:scale-[1.02]",
        isActive 
          ? "border-primary bg-primary/5 shadow-md" 
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
      )}
    >
      {isNew && (
        <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400">
          NEW
        </span>
      )}
      <div className="flex items-start gap-4">
        <div className={cn("p-3 rounded-xl shrink-0", iconBg)}>
          <Icon className={cn("w-6 h-6", iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="secondary" className="text-xs">
              {configCount} 项配置
            </Badge>
            {isActive && (
              <Badge variant="outline" className="text-xs text-primary border-primary">
                展开中
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// 平台Badge组件
function PlatformBadge({ platform }: { platform: string }) {
  const config: Record<string, string> = {
    '抖音': 'bg-black text-white',
    '小红书': 'bg-red-500 text-white',
    '快手': 'bg-orange-500 text-white',
    '视频号': 'bg-green-600 text-white',
    // 兼容旧数据
    douyin: 'bg-black text-white',
    xiaohongshu: 'bg-red-500 text-white',
    kuaishou: 'bg-orange-500 text-white',
    weibo: 'bg-green-600 text-white',
    shipinhao: 'bg-green-600 text-white',
  }
  const className = config[platform] || 'bg-gray-500 text-white'
  // 使用常量获取中文名称，兼容旧数据
  const label = getPlatformNameConst(platform)
  return <Badge className={className}>{label}</Badge>
}

// 动作Badge组件
function ActionBadge({ action }: { action: string }) {
  const label = getActionNameConst(action)
  const variant = action === TASK_ACTIONS.SHORT_VIDEO_RESEARCH ? 'default' : 'secondary'
  return <Badge variant={variant}>{label}</Badge>
}

// 审核规则编辑对话框
function RuleEditDialog({
  rule,
  open,
  onClose,
  onSave
}: {
  rule: ReviewRule | null
  open: boolean
  onClose: () => void
  onSave: (id: number, updates: Partial<ReviewRule>) => void
}) {
  const [formData, setFormData] = useState<Partial<ReviewRule>>({})

  useEffect(() => {
    if (rule) {
      setFormData({
        ai_prompt: rule.ai_prompt,
        link_verify_enabled: rule.link_verify_enabled,
        thresholds: { ...rule.thresholds }
      })
    }
  }, [rule])

  if (!rule) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            编辑审核规则 - <PlatformBadge platform={rule.platform} /> <ActionBadge action={rule.action} />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">AI 提示词</label>
            <Textarea
              value={formData.ai_prompt || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, ai_prompt: e.target.value }))}
              className="min-h-[100px]"
              placeholder="输入AI审核提示词..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">通过阈值</label>
              <Input
                type="number"
                value={formData.thresholds?.approve || 0}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  thresholds: { ...prev.thresholds!, approve: parseFloat(e.target.value) }
                }))}
                step="0.05"
                min="0"
                max="1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">拒绝阈值</label>
              <Input
                type="number"
                value={formData.thresholds?.reject || 0}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  thresholds: { ...prev.thresholds!, reject: parseFloat(e.target.value) }
                }))}
                step="0.05"
                min="0"
                max="1"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">启用链接验证</label>
            <Switch
              checked={formData.link_verify_enabled || false}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, link_verify_enabled: checked }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSave(rule.id, formData)}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 模型配置卡片组件
function ModelConfigCard({ 
  type, 
  title, 
  description, 
  onConfigChange 
}: { 
  type: 'publisher' | 'reviewer'
  title: string
  description: string
  onConfigChange?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [showApiKey, setShowApiKey] = useState(false)
  
  const [config, setConfig] = useState({
    provider: '',
    providerName: '',
    apiBaseUrl: '',
    apiKey: '',
    model: '',
    hasApiKey: false
  })
  const [customModel, setCustomModel] = useState('')

  useEffect(() => {
    loadConfig()
  }, [type])

  const loadConfig = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/admin/api/ai/config/${type}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await res.json()
      if (data.code === 200 && data.data?.config) {
        setConfig({
          provider: data.data.config.provider || '',
          providerName: data.data.config.providerName || '',
          apiBaseUrl: data.data.config.apiBaseUrl || '',
          apiKey: '',
          model: data.data.config.model || '',
          hasApiKey: data.data.config.hasApiKey || false
        })
      }
    } catch (error) {
      console.error('加载模型配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProviderChange = (providerId: string) => {
    const provider = API_PROVIDERS.find(p => p.id === providerId)
    if (provider) {
      setConfig(prev => ({
        ...prev,
        provider: providerId,
        providerName: provider.name,
        apiBaseUrl: provider.baseUrl,
        model: provider.models[0] || ''
      }))
    }
  }

  const handleSave = async () => {
    if (!config.provider) {
      toast.error('请选择API提供商')
      return
    }
    if (!config.apiKey && !config.hasApiKey) {
      toast.error('请输入API Key')
      return
    }
    if (!config.model && !customModel && config.provider !== 'custom') {
      toast.error('请选择模型')
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/admin/api/ai/config/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          provider: config.provider,
          providerName: config.providerName,
          apiBaseUrl: config.apiBaseUrl,
          apiKey: config.apiKey || undefined,
          model: config.provider === 'custom' ? customModel : config.model
        })
      })
      const data = await res.json()
      if (data.code === 200) {
        toast.success('模型配置已保存')
        onConfigChange?.()
        if (config.apiKey) {
          setConfig(prev => ({ ...prev, hasApiKey: true, apiKey: '' }))
        }
      } else {
        toast.error(data.message || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!config.apiBaseUrl || (!config.apiKey && !config.hasApiKey)) {
      toast.error('请先完成配置')
      return
    }

    setTesting(true)
    setTestResult('idle')
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/admin/api/ai/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          apiBaseUrl: config.apiBaseUrl,
          apiKey: config.apiKey || 'test',
          model: config.provider === 'custom' ? customModel : config.model
        })
      })
      const data = await res.json()
      if (data.code === 200 && data.data?.success) {
        setTestResult('success')
        toast.success('API连接测试通过')
      } else {
        setTestResult('error')
        toast.error(data.data?.error || '连接失败')
      }
    } catch (error) {
      setTestResult('error')
      toast.error('连接测试失败')
    } finally {
      setTesting(false)
    }
  }

  const selectedProvider = API_PROVIDERS.find(p => p.id === config.provider)

  if (loading) {
    return (
      <div className="mb-6 p-4 rounded-lg border bg-muted/30 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mb-6 p-4 rounded-lg border-2 border-dashed border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-5 h-5 text-primary" />
        <h4 className="font-medium">{title}</h4>
        {config.hasApiKey && (
          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
            已配置
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      
      <div className="grid grid-cols-2 gap-4">
        {/* API提供商选择 */}
        <div className="space-y-1.5">
          <Label className="text-xs">API提供商</Label>
          <Select value={config.provider} onValueChange={handleProviderChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="选择API提供商" />
            </SelectTrigger>
            <SelectContent>
              {API_PROVIDERS.map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">{provider.name}</span>
                    {provider.description && (
                      <span className="text-xs text-muted-foreground">{provider.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 自定义API地址 */}
        {config.provider === 'custom' && (
          <div className="space-y-1.5">
            <Label className="text-xs">API地址</Label>
            <Input
              placeholder="https://api.example.com/v1"
              value={config.apiBaseUrl}
              onChange={e => setConfig(prev => ({ ...prev, apiBaseUrl: e.target.value }))}
              className="h-9"
            />
          </div>
        )}

        {/* API Key */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            API Key
            {config.hasApiKey && <span className="text-green-600 ml-1">(已设置)</span>}
          </Label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              placeholder={config.hasApiKey ? '输入新Key可覆盖' : '输入API Key'}
              value={config.apiKey}
              onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              className="h-9 pr-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-2"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* 模型选择 */}
        <div className="space-y-1.5">
          <Label className="text-xs">模型</Label>
          {config.provider === 'custom' ? (
            <Input
              placeholder="输入模型名称"
              value={customModel}
              onChange={e => setCustomModel(e.target.value)}
              className="h-9"
            />
          ) : (
            <Select 
              value={config.model} 
              onValueChange={value => setConfig(prev => ({ ...prev, model: value }))}
              disabled={!selectedProvider?.models.length}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {selectedProvider?.models.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mt-4">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-1" />
              保存配置
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
          {testing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              测试中...
            </>
          ) : testResult === 'success' ? (
            <>
              <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-500" />
              测试通过
            </>
          ) : testResult === 'error' ? (
            <>
              <XCircle className="w-3.5 h-3.5 mr-1 text-red-500" />
              测试失败
            </>
          ) : (
            <>
              <Globe className="w-3.5 h-3.5 mr-1" />
              测试连接
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// 配置项组件 - 更紧凑的设计
function ConfigItem({ config, onSave, disabled, availableModels }: { 
  config: ConfigItem; 
  onSave: (key: string, value: string) => void; 
  disabled: boolean;
  availableModels?: AvailableModel[];
}) {
  const [value, setValue] = useState(config.value)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => { setValue(config.value) }, [config.value])

  const handleSave = () => { onSave(config.key, value); setIsEditing(false) }
  const handleCancel = () => { setValue(config.value); setIsEditing(false) }

  const label = CONFIG_LABELS[config.key] || config.key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const isBoolean = config.type === 'boolean'
  const isNumber = config.type === 'number'
  const isLongText = config.type === 'text' && config.value.length > 80
  const isModelSelect = config.key.endsWith('_model') || config.key === 'llm_model'

  // 模型选择 - 下拉框
  if (isModelSelect && availableModels && availableModels.length > 0) {
    const selectedModel = availableModels.find(m => m.id === value)
    return (
      <div className="space-y-1.5 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
        </div>
        <Select value={value} onValueChange={(v) => { setValue(v); onSave(config.key, v) }}>
          <SelectTrigger className="w-full h-9">
            <SelectValue placeholder="选择模型">
              {selectedModel && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedModel.name}</span>
                  <Badge variant="outline" className="text-xs">{selectedModel.category}</Badge>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {availableModels.map(model => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col gap-0.5 py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    {model.requiresThinking && (
                      <Badge variant="secondary" className="text-xs">Thinking</Badge>
                    )}
                    {model.category === 'vision' && (
                      <Badge variant="outline" className="text-xs">Vision</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedModel && (
          <p className="text-xs text-muted-foreground">推荐: {selectedModel.recommended}</p>
        )}
      </div>
    )
  }

  // 布尔值 - 开关样式
  if (isBoolean) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-sm">{label}</span>
        <Switch
          checked={value === 'true'}
          onCheckedChange={(checked) => { setValue(checked ? 'true' : 'false'); onSave(config.key, checked ? 'true' : 'false') }}
          disabled={disabled}
        />
      </div>
    )
  }

  // 数字 - 小型输入框
  if (isNumber) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-sm shrink-0">{label}</span>
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="number"
            className="w-20 h-7 text-sm text-right"
            disabled={disabled || !isEditing}
          />
          {!isEditing ? (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsEditing(true)}>
              <Settings className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <>
              <Button size="sm" className="h-7 px-2" onClick={handleSave} disabled={disabled}>
                <Save className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCancel}>✕</Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // 长文本 - 文本框
  if (isLongText) {
    return (
      <div className="space-y-1.5 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm">{label}</span>
          {!isEditing ? (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setIsEditing(true)}>
              编辑
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button size="sm" className="h-6 px-2 text-xs" onClick={handleSave} disabled={disabled}>保存</Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleCancel}>取消</Button>
            </div>
          )}
        </div>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[60px] text-xs resize-none"
          disabled={disabled || !isEditing}
        />
      </div>
    )
  }

  // 短文本 - 单行输入
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 max-w-[200px]">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 text-sm"
          disabled={disabled || !isEditing}
        />
        {!isEditing ? (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsEditing(true)}>
            <Settings className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <>
            <Button size="sm" className="h-7 px-2" onClick={handleSave} disabled={disabled}>
              <Save className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCancel}>✕</Button>
          </>
        )}
      </div>
    </div>
  )
}
