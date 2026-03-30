<template>
  <div class="ai-assistant">
    <!-- 头部 -->
    <div class="header">
      <h1 class="title">
        <span class="title-icon">🤖</span>
        {{ isAdminOrReviewer && showReviewMode ? 'AI审核助手' : 'AI助手' }}
      </h1>
      <div class="header-actions">
        <!-- 管理员/审核员切换模式 -->
        <button 
          v-if="isAdminOrReviewer" 
          class="action-btn mode-btn" 
          :class="{ active: showReviewMode }"
          @click="toggleReviewMode"
          :title="showReviewMode ? '切换到发布模式' : '切换到审核模式'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path v-if="showReviewMode" d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            <path v-else d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="action-btn" @click="showHistory = !showHistory" :class="{ active: showHistory }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </button>
        <button class="action-btn" @click="newConversation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="main-content">
      <!-- 历史会话列表 -->
      <Transition name="slide">
        <div v-if="showHistory" class="history-panel">
          <div class="history-header">
            <span>历史对话</span>
            <button class="close-btn" @click="showHistory = false">✕</button>
          </div>
          <div class="history-list">
            <div 
              v-for="conv in filteredConversations" 
              :key="conv.id" 
              class="history-item"
              :class="{ active: currentConversationId === conv.id }"
              @click="selectConversation(conv.id)"
            >
              <div class="history-icon">{{ conv.type === 'reviewer' ? '🔍' : '💬' }}</div>
              <div class="history-info">
                <div class="history-title">{{ conv.title }}</div>
                <div class="history-time">{{ formatDate(conv.updatedAt) }}</div>
              </div>
            </div>
            <div v-if="filteredConversations.length === 0" class="no-history">
              暂无历史对话
            </div>
          </div>
        </div>
      </Transition>

      <!-- 消息区域 -->
      <div class="messages" ref="messagesRef">
        <!-- 快捷模板板块（置顶显示，仅发布者/管理员显示，非审核模式） -->
        <div v-if="canPublish && !showReviewMode && templates.length > 0" class="quick-templates-top">
          <div class="templates-header">
            <span class="templates-title">📋 快捷模板</span>
            <button class="templates-refresh" @click="loadTemplates" title="刷新模板">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
            </button>
          </div>
          <div class="templates-scroll">
            <div class="templates-row">
              <button 
                v-for="template in templates" 
                :key="template.id" 
                class="template-chip"
                @click="useTemplate(template)"
              >
                <span class="chip-icon">{{ getTemplateIcon(template.platform) }}</span>
                <span class="chip-name">{{ template.name }}</span>
                <span class="chip-reward">{{ template.reward }}积分</span>
              </button>
            </div>
          </div>
        </div>
        
        <!-- 欢迎信息 -->
        <div v-if="messages.length === 0" class="welcome">
          <div class="welcome-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#gradient)"/>
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#8B5CF6"/>
                  <stop offset="100%" stop-color="#3B82F6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2>{{ showReviewMode ? 'AI审核助手' : 'AI助手' }}</h2>
          <p>{{ showReviewMode ? '智能审核任务提交，提高审核效率' : '我可以帮助您解答问题、查询任务信息' }}</p>
          
          <!-- 快捷问题 -->
          <div class="quick-questions">
            <button 
              v-for="q in quickQuestions" 
              :key="q.id" 
              class="quick-btn"
              @click="sendQuickQuestion(q.text)"
            >
              <span class="quick-icon">{{ q.icon }}</span>
              {{ q.text }}
            </button>
          </div>
        </div>

        <!-- 消息列表 -->
        <div v-for="msg in messages" :key="msg.id" class="message" :class="msg.role">
          <div class="avatar">
            <span v-if="msg.role === 'user'">我</span>
            <svg v-else viewBox="0 0 24 24" fill="none">
              <path d="M12 2a4 4 0 014 4v1a4 4 0 01-8 0V6a4 4 0 014-4zm0 12c4.418 0 8 1.79 8 4v2H4v-2c0-2.21 3.582-4 8-4z" fill="url(#gradient2)"/>
              <defs>
                <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#8B5CF6"/>
                  <stop offset="100%" stop-color="#3B82F6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="content">
            <div class="text" v-html="formatContent(msg.content)"></div>
            <div class="msg-footer">
              <span class="time">{{ formatTime(msg.timestamp) }}</span>
              <button v-if="msg.role === 'assistant' && msg.content" class="copy-btn" @click="copyContent(msg.content)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 加载指示器 -->
        <div v-if="isLoading && messages.length > 0 && !messages[messages.length - 1].content" class="message assistant">
          <div class="avatar">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2a4 4 0 014 4v1a4 4 0 01-8 0V6a4 4 0 014-4zm0 12c4.418 0 8 1.79 8 4v2H4v-2c0-2.21 3.582-4 8-4z" fill="url(#gradient3)"/>
            </svg>
          </div>
          <div class="content">
            <div class="typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷模板栏（在输入框上方，可折叠） -->
    <Transition name="slide-up">
      <div v-if="showTemplatesBar && canPublish && !showReviewMode" class="templates-bar">
        <div class="templates-bar-header">
          <span class="templates-bar-title">📋 快捷模板</span>
          <button class="templates-bar-close" @click="showTemplatesBar = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="templates-bar-content">
          <button 
            v-for="template in templates" 
            :key="template.id" 
            class="template-chip"
            @click="useTemplate(template)"
          >
            <span class="chip-icon">{{ template.icon }}</span>
            <span class="chip-name">{{ template.name }}</span>
            <span class="chip-reward">{{ template.reward }}积分</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- 输入区域 -->
    <div class="input-area">
      <!-- 快捷操作栏（有消息时显示） -->
      <div v-if="messages.length > 0 && canPublish && !showReviewMode" class="quick-actions">
        <button class="action-item" :class="{ active: showTemplatesBar }" @click="showTemplatesBar = !showTemplatesBar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
          <span>模板</span>
        </button>
        <button class="action-item" @click="sendQuickQuestion('查询今日发布统计')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          <span>统计</span>
        </button>
      </div>
      
      <div class="input-wrapper">
        <textarea
          ref="inputRef"
          v-model="input"
          :placeholder="showReviewMode ? '输入审核指令或问题...' : '输入您的问题或粘贴任务链接...'"
          :disabled="isLoading"
          rows="1"
          @keydown.enter.exact.prevent="sendMessage"
          @input="autoResize"
        ></textarea>
        <button class="send-btn" :disabled="!input.trim() || isLoading" @click="sendMessage">
          <svg v-if="isLoading" class="loading" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../store/auth'

const router = useRouter()
const { user } = useAuth()

const messages = ref([])
const input = ref('')
const isLoading = ref(false)
const messagesRef = ref(null)
const inputRef = ref(null)
const currentConversationId = ref(null)
const conversations = ref([])
const showHistory = ref(false)
const showReviewMode = ref(false)
const showTemplatesBar = ref(false)

// 平台名称映射
const PLATFORM_NAMES = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  weibo: '微博',
  bilibili: 'B站'
}

// 快捷模板（从 API 加载）
const templates = ref([])

// 加载模板
const loadTemplates = async () => {
  if (!canPublish.value) return
  
  try {
    const token = localStorage.getItem('xiaohuangyu_token')
    const response = await fetch('/api/ai/templates', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await response.json()
    if (data.code === 200 && data.data) {
      templates.value = data.data.map(t => ({
        id: t.id,
        name: t.name,
        icon: getTemplateIcon(t.platform),
        platform: t.platform,
        platformName: t.platformName,
        action: t.action,
        reward: t.reward,
        remain: t.remain,
        timeLimit: t.timeLimitMinutes,
        isDefault: t.isDefault,
        canEdit: t.canEdit
      }))
    }
  } catch (error) {
    console.error('加载模板失败:', error)
  }
}

// 获取模板图标
const getTemplateIcon = (platform) => {
  const icons = {
    douyin: '🎵',
    xiaohongshu: '📕',
    kuaishou: '⚡',
    weibo: '📱',
    bilibili: '📺'
  }
  return icons[platform] || '📋'
}

// 是否是管理员或审核员
const isAdminOrReviewer = computed(() => {
  return user.value?.role === 'admin' || user.value?.role === 'reviewer'
})

// 是否可以发布任务
const canPublish = computed(() => {
  return user.value?.role === 'admin' || user.value?.role === 'client' || user.value?.role === 'reviewer'
})

// 过滤会话列表
const filteredConversations = computed(() => {
  if (showReviewMode.value) {
    return conversations.value.filter(c => c.type === 'reviewer')
  }
  return conversations.value.filter(c => c.type !== 'reviewer')
})

// 快捷问题
const quickQuestions = computed(() => {
  if (showReviewMode.value) {
    return [
      { id: 1, icon: '🔍', text: '查看待审核任务' },
      { id: 2, icon: '📊', text: '今日审核统计' },
      { id: 3, icon: '⚠️', text: '可疑任务预警' },
      { id: 4, icon: '📈', text: 'AI审核准确率' }
    ]
  }
  
  const baseQuestions = [
    { id: 1, icon: '📋', text: '如何做任务赚钱？' },
    { id: 2, icon: '💰', text: '积分怎么提现？' },
    { id: 3, icon: '⚡', text: '任务审核要多久？' },
    { id: 4, icon: '🎯', text: '如何提升等级？' }
  ]
  
  // 根据用户角色添加特定问题
  if (canPublish.value) {
    baseQuestions.push({ id: 5, icon: '📝', text: '如何发布任务？' })
    baseQuestions.push({ id: 6, icon: '📊', text: '我的任务数据统计' })
  }
  
  return baseQuestions
})

// 切换审核模式
const toggleReviewMode = () => {
  showReviewMode.value = !showReviewMode.value
  newConversation()
}

// 使用模板
const useTemplate = (template) => {
  input.value = `使用模板发布任务：
平台：${template.platformName}
操作类型：短视频内容体验调研
奖励积分：${template.reward}
需要人数：${template.remain}
任务时长：${template.timeLimit || template.timeLimitMinutes}分钟

请提供任务链接：`
  inputRef.value?.focus()
}

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const formatDate = (date) => {
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  
  if (diff < 86400000) { // 24小时内
    return formatTime(date)
  } else if (diff < 604800000) { // 一周内
    return `${Math.floor(diff / 86400000)}天前`
  } else {
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

const formatContent = (content) => {
  if (!content) return ''
  // 简单的格式化：换行转br，链接识别
  return content
    .replace(/\n/g, '<br>')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const autoResize = () => {
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
    inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 100) + 'px'
  }
}

const copyContent = (content) => {
  navigator.clipboard.writeText(content)
}

const sendQuickQuestion = (text) => {
  input.value = text
  sendMessage()
}

const loadConversations = async () => {
  try {
    const token = localStorage.getItem('xiaohuangyu_token')
    const response = await fetch('/api/ai/conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await response.json()
    if (data.code === 200) {
      conversations.value = data.data.list || []
    }
  } catch (error) {
    console.error('加载会话列表失败:', error)
  }
}

const selectConversation = async (conversationId) => {
  try {
    const token = localStorage.getItem('xiaohuangyu_token')
    const response = await fetch(`/api/ai/conversations/${conversationId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await response.json()
    if (data.code === 200) {
      currentConversationId.value = conversationId
      messages.value = data.data.messages?.map(msg => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.createdAt)
      })) || []
      // 根据会话类型设置模式
      if (data.data.conversation?.type === 'reviewer') {
        showReviewMode.value = true
      }
      showHistory.value = false
      scrollToBottom()
    }
  } catch (error) {
    console.error('加载会话失败:', error)
  }
}

const sendMessage = async () => {
  if (!input.value.trim() || isLoading.value) return

  const userMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: input.value.trim(),
    timestamp: new Date()
  }

  messages.value.push(userMessage)
  const userInput = input.value
  input.value = ''
  isLoading.value = true
  scrollToBottom()
  
  // 重置输入框高度
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }

  // 创建AI消息占位
  const aiMessageId = (Date.now() + 1).toString()
  messages.value.push({
    id: aiMessageId,
    role: 'assistant',
    content: '',
    timestamp: new Date()
  })
  scrollToBottom()

  try {
    const token = localStorage.getItem('xiaohuangyu_token')
    // 根据模式选择不同的API端点
    const apiEndpoint = showReviewMode.value ? '/api/ai/reviewer/chat' : '/api/ai/publisher/chat'
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: userInput,
        conversationId: currentConversationId.value
      })
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (reader) {
      let fullContent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullContent += parsed.content
                const aiMsg = messages.value.find(m => m.id === aiMessageId)
                if (aiMsg) {
                  aiMsg.content = fullContent
                }
                scrollToBottom()
              }
              if (parsed.conversationId) {
                currentConversationId.value = parsed.conversationId
              }
              if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
      
      // 刷新会话列表
      loadConversations()
    }
  } catch (error) {
    console.error('发送消息失败:', error)
    const aiMsg = messages.value.find(m => m.id === aiMessageId)
    if (aiMsg) {
      aiMsg.content = '抱歉，发生了错误，请稍后重试。'
    }
  } finally {
    isLoading.value = false
  }
}

const newConversation = () => {
  messages.value = []
  currentConversationId.value = null
  showHistory.value = false
  inputRef.value?.focus()
}

onMounted(() => {
  loadConversations()
  loadTemplates()
  inputRef.value?.focus()
})
</script>

<style scoped>
.ai-assistant {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 75px - env(safe-area-inset-bottom, 0px));
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* 头部 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 10;
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.title-icon {
  font-size: 22px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f1f5f9;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn svg {
  width: 18px;
  height: 18px;
  color: #64748b;
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.active {
  background: linear-gradient(135deg, #8B5CF6, #3B82F6);
}

.action-btn.active svg {
  color: white;
}

.mode-btn {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
}

.mode-btn svg {
  color: #16a34a;
}

.mode-btn.active {
  background: linear-gradient(135deg, #16a34a, #15803d);
}

.mode-btn.active svg {
  color: white;
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* 历史面板 */
.history-panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 280px;
  background: white;
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 20;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.05);
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  font-weight: 600;
  color: #1e293b;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #f1f5f9;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #64748b;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.history-item:active {
  background: #f1f5f9;
}

.history-item.active {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
}

.history-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-title {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-time {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.no-history {
  text-align: center;
  padding: 24px;
  color: #94a3b8;
  font-size: 14px;
}

/* 消息区域 */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scroll-behavior: smooth;
}

/* 欢迎信息 */
.welcome {
  text-align: center;
  padding: 20px 16px;
}

.welcome-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 12px;
}

.welcome-icon svg {
  width: 100%;
  height: 100%;
}

.welcome h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.welcome p {
  color: #64748b;
  font-size: 13px;
  margin-bottom: 16px;
}

.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 16px;
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 20px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:active {
  transform: scale(0.98);
  background: #f8fafc;
}

.quick-icon {
  font-size: 16px;
}

/* 置顶快捷模板板块 */
.quick-templates-top {
  background: white;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.templates-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.templates-header .templates-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0;
}

.templates-refresh {
  width: 28px;
  height: 28px;
  border: none;
  background: #f1f5f9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.templates-refresh svg {
  width: 14px;
  height: 14px;
  color: #64748b;
}

.templates-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.templates-row {
  display: flex;
  gap: 8px;
  padding-bottom: 4px;
}

.template-chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-chip:active {
  transform: scale(0.98);
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
}

.chip-icon {
  font-size: 14px;
}

.chip-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
}

.chip-reward {
  font-size: 11px;
  color: #f59e0b;
  font-weight: 600;
}

/* 原有的快捷模板板块样式（保留用于编辑对话框等） */
.quick-templates {
  margin-top: 16px;
  text-align: left;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.templates-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 10px;
  justify-content: center;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.template-card {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.template-card:active {
  transform: scale(0.98);
  background: #f8fafc;
}

.template-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.template-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.template-reward {
  font-size: 12px;
  color: #f59e0b;
  font-weight: 600;
}

.template-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.template-platform {
  padding: 2px 8px;
  background: #f1f5f9;
  border-radius: 4px;
}

.template-count {
  color: #64748b;
}

/* 消息 */
.message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .avatar {
  background: linear-gradient(135deg, #3B82F6, #2563EB);
  color: white;
  font-size: 13px;
  font-weight: 600;
}

.message.assistant .avatar {
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
}

.message.assistant .avatar svg {
  width: 20px;
  height: 20px;
}

.content {
  max-width: 75%;
}

.text {
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.message.user .text {
  background: linear-gradient(135deg, #3B82F6, #2563EB);
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .text {
  background: white;
  color: #334155;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.message.assistant .text :deep(a) {
  color: #3B82F6;
  text-decoration: none;
}

.msg-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 0 4px;
}

.time {
  font-size: 11px;
  color: #94a3b8;
}

.copy-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-btn svg {
  width: 14px;
  height: 14px;
  color: #64748b;
}

.copy-btn:active {
  opacity: 1;
}

/* 打字动画 */
.typing {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: white;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.typing span {
  width: 6px;
  height: 6px;
  background: #94a3b8;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing span:nth-child(1) { animation-delay: -0.32s; }
.typing span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 输入区域 */
.input-area {
  padding: 12px 16px;
  background: white;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.quick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.quick-actions::-webkit-scrollbar {
  display: none;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f8fafc;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.action-item svg {
  width: 14px;
  height: 14px;
}

.action-item:active {
  background: #f1f5f9;
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  background: #f8fafc;
  border-radius: 24px;
  padding: 8px 8px 8px 16px;
}

.input-wrapper textarea {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  color: #1e293b;
  resize: none;
  outline: none;
  min-height: 24px;
  max-height: 100px;
  line-height: 1.5;
}

.input-wrapper textarea::placeholder {
  color: #94a3b8;
}

.send-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: linear-gradient(135deg, #8B5CF6, #3B82F6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn svg {
  width: 18px;
  height: 18px;
  color: white;
}

.send-btn .loading {
  width: 20px;
  height: 20px;
}

/* 过渡动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 模板栏样式 */
.templates-bar {
  background: white;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding: 12px 16px;
  max-height: 200px;
  overflow-y: auto;
}

.templates-bar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.templates-bar-title {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.templates-bar-close {
  width: 24px;
  height: 24px;
  border: none;
  background: #f1f5f9;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.templates-bar-close svg {
  width: 14px;
  height: 14px;
  color: #94a3b8;
}

.templates-bar-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-chip:active {
  transform: scale(0.98);
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
}

.chip-icon {
  font-size: 16px;
}

.chip-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
}

.chip-reward {
  font-size: 11px;
  color: #f59e0b;
  font-weight: 600;
}

/* 模板栏滑入动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* action-item active状态 */
.action-item.active {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
  border-color: rgba(139, 92, 246, 0.3);
  color: #8B5CF6;
}

.action-item.active svg {
  color: #8B5CF6;
}

/* 滚动条样式 */
.messages::-webkit-scrollbar {
  width: 4px;
}

.messages::-webkit-scrollbar-track {
  background: transparent;
}

.messages::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 4px;
}

/* 响应式 */
@media (min-width: 768px) {
  .welcome {
    padding: 60px 40px;
  }
  
  .quick-templates {
    max-width: 400px;
  }
  
  .templates-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}
</style>
