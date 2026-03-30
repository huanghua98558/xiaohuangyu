'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { 
  Send, 
  Sparkles, 
  Plus,
  MessageSquare,
  Settings,
  History,
  FileText,
  Zap,
  Copy,
  Trash2,
  MoreHorizontal,
  Clock,
  ChevronRight,
  Pencil,
  Check,
  X,
  Loader2,
  Search,
  Bot,
  User,
  PanelLeftClose,
  PanelLeft,
  TrendingUp,
  FileCheck,
  Video,
  Music,
  Play,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// API 基础路径
const API_BASE = '/admin/api'
const TOKEN_KEY = 'admin_token'
const USER_KEY = 'admin_user'

// 消息类型
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  status?: 'loading' | 'success' | 'error'
  taskData?: any
}

// 会话类型
interface Conversation {
  id: number
  title: string
  type: string
  status: string
  created_at: string
  updated_at: string
  lastMessage?: {
    content: string
    created_at: string
  }
}

// 快捷模板类型
interface QuickTemplate {
  id: number | string
  name: string
  platform: string
  platformName?: string
  action: string
  reward: number
  remain: number
  desc: string
  timeLimitMinutes: number
  isDefault?: boolean
  canEdit?: boolean
}

// 平台图标映射
const getPlatformIcon = (platform: string) => {
  switch (platform?.toLowerCase()) {
    case '抖音':
    case 'douyin':
      return <Music className="w-4 h-4" />
    case '小红书':
    case 'xiaohongshu':
      return <FileText className="w-4 h-4" />
    case '快手':
    case 'kuaishou':
      return <Video className="w-4 h-4" />
    case 'b站':
    case 'bilibili':
      return <Play className="w-4 h-4" />
    default:
      return <Video className="w-4 h-4" />
  }
}

export default function AIPublisherPage() {
  const router = useRouter()
  
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [templates, setTemplates] = useState<QuickTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [showTemplateEditDialog, setShowTemplateEditDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<QuickTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState<Partial<QuickTemplate>>({})
  const [deleteConversationId, setDeleteConversationId] = useState<number | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true)
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_BASE}/ai/templates`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await res.json()
      if (data.code === 0 || data.code === 200 && data.data) {
        setTemplates(data.data.map((t: any) => ({
          id: t.id,
          name: t.name,
          platform: t.platform,
          platformName: t.platformName,
          action: t.action,
          reward: t.reward,
          remain: t.remain,
          desc: t.description || '',
          timeLimitMinutes: t.timeLimitMinutes,
          isDefault: t.isDefault,
          canEdit: t.canEdit
        })))
      }
    } catch (error) {
      console.error('加载模板失败:', error)
    } finally {
      setIsLoadingTemplates(false)
    }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_BASE}/ai/conversations?type=publisher&pageSize=50`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await res.json()
      if (data.code === 0 || data.code === 200 && data.data?.list) {
        setConversations(data.data.list)
      }
    } catch (error) {
      console.error('加载会话列表失败:', error)
    }
  }, [])

  useEffect(() => {
    loadConversations()
    loadTemplates()
  }, [loadConversations, loadTemplates])

  useEffect(() => {
    if (messages.length === 0 && !currentConversation) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `👋 **欢迎使用 AI 发布助手！**

我可以帮你快速发布任务、查询统计数据。直接粘贴链接或输入指令即可：

📎 **粘贴链接** → 自动解析并发布任务
📊 **查询统计** → 输入"查询"或"我的任务"
⏳ **待审核** → 输入"查询待审核任务"

**支持的链接格式**：
- 抖音：\`https://v.douyin.com/xxx\`
- 小红书：\`https://www.xiaohongshu.com/xxx\`
- 快手：\`https://v.kuaishou.com/xxx\``,
        timestamp: new Date(),
        status: 'success'
      }])
    }
  }, [currentConversation, messages.length])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'loading'
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const response = await fetch(`${API_BASE}/ai/publisher/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId: currentConversation?.id
        })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk
          
          // 按双换行符分割SSE消息
          const parts = buffer.split('\n\n')
          buffer = parts.pop() || ''
          const lines = parts.join('\n').split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                break
              }
              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  fullContent += parsed.content
                  setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id 
                      ? { ...m, content: fullContent, status: 'success' }
                      : m
                  ))
                }
              } catch (e) {
              }
            }
          }
        }
      }

      if (!fullContent) {
        setMessages(prev => prev.map(m => 
          m.id === assistantMessage.id 
            ? { ...m, content: '抱歉，处理请求时出现问题。请稍后重试。', status: 'error' }
            : m
        ))
      }

    } catch (error) {
      console.error('发送消息失败:', error)
      setMessages(prev => prev.map(m => 
        m.id === assistantMessage.id 
          ? { ...m, content: '网络错误，请检查连接后重试。', status: 'error' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('已复制到剪贴板')
  }

  const deleteConversation = async (id: number) => {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      await fetch(`${API_BASE}/ai/conversations/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      setConversations(prev => prev.filter(c => c.id !== id))
      if (currentConversation?.id === id) {
        setCurrentConversation(null)
        setMessages([])
      }
      toast.success('会话已删除')
    } catch (error) {
      toast.error('删除失败')
    }
    setDeleteConversationId(null)
  }

  const createNewConversation = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_BASE}/ai/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ type: 'publisher' })
      })
      const data = await res.json()
      if (data.code === 0 || data.code === 200 && data.data) {
        setCurrentConversation(data.data)
        setMessages([])
        loadConversations()
      }
    } catch (error) {
      toast.error('创建会话失败')
    }
  }

  const quickCommands = [
    { label: '今日统计', icon: <TrendingUp className="w-4 h-4" />, action: () => { setInput('查询我的任务'); setTimeout(() => sendMessage(), 100) } },
    { label: '待审核', icon: <FileCheck className="w-4 h-4" />, action: () => { setInput('查询待审核任务'); setTimeout(() => sendMessage(), 100) } },
  ]

  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.platform) {
      toast.error('请填写完整信息')
      return
    }
    
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const url = editingTemplate 
        ? `${API_BASE}/ai/templates/${editingTemplate.id}`
        : `${API_BASE}/ai/templates`
      const method = editingTemplate ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(templateForm)
      })
      
      const data = await res.json()
      if (data.code === 0 || data.code === 200) {
        toast.success(editingTemplate ? '模板已更新' : '模板已创建')
        loadTemplates()
        setShowTemplateEditDialog(false)
        setEditingTemplate(null)
        setTemplateForm({})
      }
    } catch (error) {
      toast.error('保存失败')
    }
  }

  const filteredConversations = conversations.filter(c => 
    c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <aside className={`
        ${sidebarOpen ? 'w-64' : 'w-0'} 
        transition-all duration-300 ease-in-out
        border-r border-slate-200/60 dark:border-slate-800/60
        bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm
        flex flex-col
      `}>
        {sidebarOpen && (
          <>
            <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60">
              <Button 
                onClick={createNewConversation}
                className="w-full justify-start gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25"
              >
                <Plus className="w-4 h-4" />
                新建会话
              </Button>
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="搜索会话..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-slate-100/50 dark:bg-slate-800/50 border-0 focus-visible:ring-1"
                />
              </div>
            </div>
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-1">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`
                      group relative p-3 rounded-xl cursor-pointer
                      transition-all duration-200
                      ${currentConversation?.id === conv.id 
                        ? 'bg-blue-50 dark:bg-blue-950/50 border border-blue-200/50 dark:border-blue-800/50' 
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                      }
                    `}
                    onClick={() => setCurrentConversation(conv)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-slate-700 dark:text-slate-200">
                          {conv.title || '新会话'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConversationId(conv.id)
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-4 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-800 dark:text-slate-100">AI 发布助手</h1>
              </div>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`
                    max-w-[85%] rounded-2xl px-4 py-3 shadow-sm
                    ${message.role === 'user' 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-md shadow-blue-500/25' 
                      : 'bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-tl-md'
                    }
                  `}
                >
                  <div className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'assistant' ? 'text-slate-700 dark:text-slate-200' : ''
                  }`}>
                    {message.content || (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-slate-400">思考中...</span>
                      </div>
                    )}
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shrink-0 shadow-lg">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 mb-3">
              {quickCommands.map((cmd, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={cmd.action}
                  className="h-8 gap-1.5 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {cmd.icon}
                  <span className="text-xs">{cmd.label}</span>
                </Button>
              ))}
            </div>
            <div className="relative">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="粘贴链接或输入指令... (Shift+Enter 换行)"
                className="min-h-[52px] max-h-[200px] pr-12 resize-none bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="absolute right-2 bottom-2 h-9 w-9 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>

      <aside className="w-72 border-l border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col">
        <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              快捷模板
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => {
                setEditingTemplate(null)
                setTemplateForm({})
                setShowTemplateEditDialog(true)
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              新建
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无模板</p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="group p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    setInput(`使用模板: ${template.name}`)
                    inputRef.current?.focus()
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                          {getPlatformIcon(template.platform)}
                        </div>
                        <span className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate">
                          {template.name}
                        </span>
                      </div>
                      {/* 操作居中显示 */}
                      {template.action && (
                        <div className="mt-1.5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                            {template.action === 'short_video_research' ? '短视频调研' : 
                             template.action === 'follow_account' ? '关注账号' :
                             template.action === 'like_video' ? '点赞视频' :
                             template.action === 'comment' ? '评论' :
                             template.action === 'share' ? '分享' :
                             template.action === 'collect' ? '收藏' : template.action}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          {template.reward} 积分
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-blue-500" />
                          {template.remain} 人
                        </span>
                        {template.timeLimitMinutes > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-green-500" />
                            {template.timeLimitMinutes} 分钟
                          </span>
                        )}
                      </div>
                      {/* 状态标签 */}
                      <div className="mt-2 flex justify-end">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                          已上线
                        </span>
                      </div>
                    </div>
                    {template.canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTemplate(template)
                          setTemplateForm(template)
                          setShowTemplateEditDialog(true)
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/50 border border-blue-200/50 dark:border-blue-800/50">
              <p className="text-xs text-blue-600 dark:text-blue-400">今日发布</p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300">--</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/50 border border-emerald-200/50 dark:border-emerald-800/50">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">总任务</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{templates.length}</p>
            </div>
          </div>
        </div>
      </aside>

      <Dialog open={showTemplateEditDialog} onOpenChange={setShowTemplateEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '编辑模板' : '新建模板'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>模板名称</Label>
              <Input
                value={templateForm.name || ''}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：抖音视频调研"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>平台</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={templateForm.platform || ''}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, platform: e.target.value }))}
                >
                  <option value="">选择平台</option>
                  <option value="douyin">抖音</option>
                  <option value="xiaohongshu">小红书</option>
                  <option value="kuaishou">快手</option>
                  <option value="bilibili">B站</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>操作类型</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={templateForm.action || ''}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, action: e.target.value }))}
                >
                  <option value="">选择操作</option>
                  <option value="short_video_research">短视频调研</option>
                  <option value="follow_account">关注账号</option>
                  <option value="like_video">点赞视频</option>
                  <option value="comment">评论</option>
                  <option value="share">分享</option>
                  <option value="collect">收藏</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>奖励积分</Label>
                <Input
                  type="number"
                  value={templateForm.reward ?? 3}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, reward: parseInt(e.target.value) || 0 }))}
                  placeholder="3"
                />
              </div>
              <div className="space-y-2">
                <Label>任务名额</Label>
                <Input
                  type="number"
                  value={templateForm.remain ?? 10}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, remain: parseInt(e.target.value) || 10 }))}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label>限时(分钟)</Label>
                <Input
                  type="number"
                  value={templateForm.timeLimitMinutes ?? 10}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, timeLimitMinutes: parseInt(e.target.value) || 10 }))}
                  placeholder="10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>任务描述</Label>
              <Textarea
                value={templateForm.desc || ''}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, desc: e.target.value }))}
                placeholder="任务描述信息"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateEditDialog(false)}>取消</Button>
            <Button onClick={saveTemplate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConversationId} onOpenChange={() => setDeleteConversationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除会话</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个会话吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteConversationId && deleteConversation(deleteConversationId)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Users({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
