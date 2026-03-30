<template>
  <div class="publish-task">
    <header class="page-header">
      <h1>📝 发布任务</h1>
      <p class="subtitle">填写任务信息，发布后用户即可领取</p>
    </header>

    <!-- 模式切换 -->
    <div class="mode-switch">
      <button 
        :class="['mode-btn', { active: !isBatchMode }]" 
        @click="isBatchMode = false"
      >
        单个发布
      </button>
      <button 
        :class="['mode-btn', { active: isBatchMode }]" 
        @click="isBatchMode = true"
      >
        批量发布
      </button>
    </div>

    <!-- 批量发布模式 -->
    <form v-if="isBatchMode" @submit.prevent="handleBatchSubmit" class="task-form">
      <section class="form-section">
        <h2 class="section-title">批量发布任务</h2>
        
        <div class="batch-tips">
          <p class="tips-title">📋 使用说明：</p>
          <ul>
            <li>每个链接单独生成一个任务</li>
            <li>链接格式示例：2.84 复制打开抖音，看看【阿健DL HOPE的作品】现在的老板呐，  https://v.douyin.com/pi_CWztq-ck/ e@O.kP ygb:/ 04/07</li>
            <li>系统将自动从链接中提取【作者名+当前日期】作为任务标题</li>
            <li>其他设置将统一应用到所有任务</li>
          </ul>
        </div>
        
        <div class="form-group">
          <label class="form-label required">任务链接（每行一个）</label>
          <textarea 
            v-model="batchLinks" 
            class="form-textarea batch-textarea" 
            placeholder="粘贴任务链接，每行一个链接..."
            rows="8"
            required
          ></textarea>
          <span class="form-tip">已输入 {{ batchLinks.split('\n').filter(l => l.trim()).length }} 个链接</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">平台</label>
            <select v-model="form.platform" class="form-select" required>
              <option value="douyin">抖音</option>
              <option value="kuaishou">快手</option>
              <option value="xiaohongshu">小红书</option>
              <option value="weibo">视频号</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label required">操作类型</label>
            <select v-model="form.action" class="form-select" required>
              <option value="short_video_research">短视频用户体验调研</option>
            </select>
          </div>
        </div>
      </section>

      <!-- 任务说明 -->
      <section class="form-section">
        <h2 class="section-title">任务说明</h2>
        
        <div class="form-group">
          <label class="form-label required">任务描述</label>
          <textarea 
            v-model="form.description" 
            class="form-textarea" 
            rows="6"
            maxlength="2000"
            required
          ></textarea>
          <span class="form-tip">{{ form.description.length }}/2000</span>
        </div>
      </section>

      <!-- 默认配置操作 -->
      <section class="form-section config-actions-section">
        <h2 class="section-title">配置管理</h2>
        <div class="config-actions">
          <button type="button" class="btn-config load" @click="loadDefaultConfig">
            <span class="btn-icon">📥</span>
            <span>加载默认配置</span>
          </button>
          <button type="button" class="btn-config save" @click="handleSaveDefaultConfig">
            <span class="btn-icon">💾</span>
            <span>保存为默认</span>
          </button>
        </div>
        <p class="config-tip">💡 保存后，下次发布任务可直接加载使用</p>
      </section>
      
      <!-- 奖励设置 -->
      <section class="form-section">
        <h2 class="section-title">奖励设置</h2>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">积分奖励</label>
            <input 
              type="number" 
              v-model.number="form.reward" 
              class="form-input" 
              min="1"
              max="1000"
              required
            />
            <span class="form-tip">100积分 = 1元</span>
          </div>
          
          <div class="form-group">
            <label class="form-label required">名额数量</label>
            <input 
              type="number" 
              v-model.number="form.remain" 
              class="form-input" 
              min="1"
              max="10000"
              required
            />
            <span class="form-tip">可领取的人数</span>
          </div>
        </div>
      </section>

      <!-- 提交按钮 -->
      <div class="form-actions">
        <button type="button" class="btn-cancel" @click="batchLinks = ''">清空</button>
        <button type="submit" class="btn-submit batch-btn" :disabled="batchSubmitting">
          {{ batchSubmitting ? '发布中...' : `批量发布 ${batchLinks.split('\n').filter(l => l.trim()).length} 个任务` }}
        </button>
      </div>
    </form>

    <!-- 单个发布模式 -->
    <form v-else @submit.prevent="handleSubmit" class="task-form">
      <!-- 基本信息 -->
      <section class="form-section">
        <h2 class="section-title">基本信息</h2>
        
        <div class="form-group">
          <label class="form-label required">任务标题</label>
          <input 
            type="text" 
            v-model="form.title" 
            class="form-input" 
            placeholder="填入链接后自动提取标题"
            maxlength="50"
            required
          />
          <span class="form-tip">{{ form.title.length }}/50</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">平台</label>
            <select v-model="form.platform" class="form-select" required>
              <option value="douyin">抖音</option>
              <option value="kuaishou">快手</option>
              <option value="xiaohongshu">小红书</option>
              <option value="weibo">视频号</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label required">操作类型</label>
            <select v-model="form.action" class="form-select" required>
              <option value="short_video_research">短视频用户体验调研</option>
            </select>
          </div>
        </div>
      </section>

      <!-- 视频链接 -->
      <section class="form-section">
        <h2 class="section-title">视频/内容链接</h2>
        
        <div class="form-group">
          <label class="form-label required">链接地址</label>
          <textarea 
            v-model="form.videoUrl" 
            class="form-textarea" 
            placeholder="粘贴完整的视频链接或分享口令，如：&#10;2.84 复制打开抖音，看看【阿健DL HOPE的作品】现在的老板呐，  https://v.douyin.com/pi_CWztq-ck/ e@O.kP ygb:/ 04/07&#10;&#10;填入链接后，系统将自动从【作者名+当前日期】生成标题"
            rows="3"
            @input="handleVideoUrlChange"
            required
          ></textarea>
          <span class="form-tip">填入链接后，系统将自动提取标题</span>
        </div>
      </section>

      <!-- 任务说明 -->
      <section class="form-section">
        <h2 class="section-title">任务说明</h2>
        
        <div class="form-group">
          <label class="form-label required">任务描述</label>
          <textarea 
            v-model="form.description" 
            class="form-textarea" 
            rows="6"
            maxlength="2000"
            required
          ></textarea>
          <span class="form-tip">{{ form.description.length }}/2000</span>
        </div>

        <div class="form-group">
          <label class="form-label">操作步骤</label>
          <div class="requirements-list">
            <div 
              v-for="(req, index) in form.requirements" 
              :key="index" 
              class="requirement-item"
            >
              <span class="req-num">{{ index + 1 }}</span>
              <input 
                type="text" 
                v-model="form.requirements[index]" 
                class="form-input req-input"
                placeholder="输入操作步骤"
              />
              <button 
                type="button" 
                class="remove-btn"
                @click="removeRequirement(index)"
                v-if="form.requirements.length > 1"
              >✕</button>
            </div>
            <button 
              type="button" 
              class="add-btn"
              @click="addRequirement"
            >+ 添加步骤</button>
          </div>
        </div>
      </section>

      <!-- 示范图片 -->
      <section class="form-section">
        <h2 class="section-title">完成示范图片</h2>
        <div class="form-group">
          <div class="example-toggle">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.useDefaultExample" />
              <span>使用系统默认示范图片</span>
            </label>
          </div>
          
          <div v-if="form.useDefaultExample" class="default-images-preview">
            <p class="preview-tip">当前默认示范图片（联系管理员修改默认值）：</p>
            <div class="example-images-grid">
              <div v-for="i in 2" :key="i" class="example-image-item">
                <div v-if="defaultExampleImages[i-1]" class="image-preview default">
                  <img :src="defaultExampleImages[i-1]" :alt="`默认示范图片${i}`" />
                </div>
                <div v-else class="upload-area disabled">
                  <span class="upload-text">暂无图片</span>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="example-images-grid">
            <p class="preview-tip">上传自定义示范图片，仅对当前任务生效：</p>
            <div v-for="i in 2" :key="i" class="example-image-item">
              <input
                :id="`example-image-${i-1}`"
                type="file"
                accept="image/*"
                class="hidden-input"
                @change="(e) => handleImageUpload(e, i - 1)"
              />
              
              <div v-if="form.exampleImages[i-1]" class="image-preview">
                <img :src="form.exampleImages[i-1]" alt="示范图片" />
                <div class="image-actions">
                  <button type="button" class="action-btn" @click="triggerFileInput(i - 1)">更换</button>
                  <button type="button" class="action-btn remove" @click="removeImage(i - 1)">删除</button>
                </div>
              </div>
              
              <div 
                v-else 
                class="upload-area"
                :class="{ uploading: uploadingIndex === i - 1 }"
                @click="triggerFileInput(i - 1)"
              >
                <span v-if="uploadingIndex === i - 1" class="loading-text">上传中...</span>
                <span v-else class="upload-text">+ 图片 {{ i }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 默认配置操作 -->
      <section class="form-section config-actions-section">
        <h2 class="section-title">配置管理</h2>
        <div class="config-actions">
          <button type="button" class="btn-config load" @click="loadDefaultConfig">
            <span class="btn-icon">📥</span>
            <span>加载默认配置</span>
          </button>
          <button type="button" class="btn-config save" @click="handleSaveDefaultConfig">
            <span class="btn-icon">💾</span>
            <span>保存为默认</span>
          </button>
        </div>
        <p class="config-tip">💡 保存后，下次发布任务可直接加载使用</p>
      </section>
      
      <!-- 奖励设置 -->
      <section class="form-section">
        <h2 class="section-title">奖励设置</h2>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">积分奖励</label>
            <input 
              type="number" 
              v-model.number="form.reward" 
              class="form-input" 
              min="1"
              max="1000"
              required
            />
            <span class="form-tip">100积分 = 1元</span>
          </div>
          
          <div class="form-group">
            <label class="form-label required">名额数量</label>
            <input 
              type="number" 
              v-model.number="form.remain" 
              class="form-input" 
              min="1"
              max="10000"
              required
            />
            <span class="form-tip">可领取的人数</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">完成时限（分钟）</label>
            <input 
              type="number" 
              v-model.number="form.timeLimitMinutes" 
              class="form-input" 
              min="5"
              max="1440"
            />
            <span class="form-tip">默认15分钟</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">同城市名额</label>
            <input 
              type="number" 
              v-model.number="form.cityLimit" 
              class="form-input" 
              min="1"
              max="100"
            />
            <span class="form-tip">同一城市最多几人领取</span>
          </div>
          
          <div class="form-group">
            <label class="form-label">同省份名额</label>
            <input 
              type="number" 
              v-model.number="form.provinceLimit" 
              class="form-input" 
              min="1"
              max="100"
            />
            <span class="form-tip">同一省份最多几人领取</span>
          </div>
        </div>
      </section>

      <!-- 提交按钮 -->
      <div class="form-actions">
        <button type="button" class="btn-cancel" @click="resetForm">重置</button>
        <button type="submit" class="btn-submit" :disabled="submitting">
          {{ submitting ? '发布中...' : '发布任务' }}
        </button>
      </div>
    </form>

    <!-- 提示弹窗 -->
    <div class="toast" v-if="toast.show" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../store/auth'
import { createTask, getConfig, getTaskDefaultConfig, saveTaskDefaultConfig } from '../api/task'

const router = useRouter()
const { user, isAdmin, isClient } = useAuth()

const submitting = ref(false)
const batchSubmitting = ref(false)
const isBatchMode = ref(false)
const batchLinks = ref('')
const config = ref({})
const defaultExampleImages = ref([])
const uploadingIndex = ref(null)
const defaultDescription = `任务流程：
1.打开指定视频链接；
2.以正常用户视角真实观看内容；
3.根据真实感受填写内容吸引力、创意度、观看体验等评价；
4.提交反馈即完成任务。

重要说明：
•本任务不涉及任何点赞、关注、评论、收藏、转发等互动行为；
•无需任何额外操作，仅需真实观看与客观反馈；
•所有数据仅用于内容研究与体验分析，不影响平台推荐机制；
•严禁使用脚本、模拟器、批量操作等非正常方式完成任务。

完成真实体验并提交有效评价后，审核通过可获得相应积分奖励。`

const form = reactive({
  title: '',
  platform: 'douyin',
  action: 'short_video_research',
  videoUrl: '',
  description: defaultDescription,
  requirements: ['复制链接并在对应APP打开', '观看视频内容', '发表真实评论', '截图并提交'],
  reward: 30,
  remain: 10,
  timeLimitMinutes: 15,
  cityLimit: 1,
  provinceLimit: 4,
  exampleImages: [],
  useDefaultExample: true
})

const toast = reactive({
  show: false,
  message: '',
  type: 'success'
})

function showToast(message, type = 'success') {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => {
    toast.show = false
  }, 3000)
}

// 从链接中提取标题（名字+当前日期）
function extractTitleFromLink(link) {
  // 匹配 【xxx的作品】 格式
  const nameMatch = link.match(/【(.+?)的作品】/)
  const name = nameMatch ? nameMatch[1] : ''
  
  // 使用当前日期
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const date = `${month}${day}`
  
  if (name) {
    return `${name}${date}`
  }
  return ''
}

// 处理链接变化，自动提取标题
function handleVideoUrlChange() {
  // 如果标题为空，自动提取标题
  if (!form.title && form.videoUrl) {
    const extractedTitle = extractTitleFromLink(form.videoUrl)
    if (extractedTitle) {
      form.title = extractedTitle
    }
  }
}

function addRequirement() {
  form.requirements.push('')
}

function removeRequirement(index) {
  form.requirements.splice(index, 1)
}

// 示范图片上传
function triggerFileInput(index) {
  const input = document.getElementById(`example-image-${index}`)
  if (input) input.click()
}

async function handleImageUpload(e, index) {
  const file = e.target.files?.[0]
  if (!file) return
  
  uploadingIndex.value = index
  try {
    const { uploadFile } = await import('../api/task')
    const result = await uploadFile(file)
    form.exampleImages[index] = result.url
    form.useDefaultExample = false
  } catch (err) {
    console.error('上传失败', err)
    showToast('上传失败', 'error')
  } finally {
    uploadingIndex.value = null
  }
}

function removeImage(index) {
  form.exampleImages.splice(index, 1)
  if (form.exampleImages.length === 0) {
    form.useDefaultExample = true
  }
}

function resetForm() {
  form.title = ''
  form.platform = 'douyin'
  form.action = 'short_video_research'
  form.videoUrl = ''
  form.description = defaultDescription
  form.requirements = ['复制链接并在对应APP打开', '观看视频内容', '发表真实评论', '截图并提交']
  form.reward = 30
  form.remain = 10
  form.timeLimitMinutes = config.value.defaultTimeLimitMinutes || 15
  form.cityLimit = config.value.cityLimitPerTask || 1
  form.provinceLimit = config.value.provinceLimitPerTask || 4
  form.exampleImages = []
  form.useDefaultExample = true
}

// 加载默认配置
async function loadDefaultConfig() {
  try {
    const defaultConfig = await getTaskDefaultConfig()
    if (defaultConfig) {
      if (defaultConfig.description) form.description = defaultConfig.description
      if (defaultConfig.requirements?.length) form.requirements = [...defaultConfig.requirements]
      if (defaultConfig.reward) form.reward = defaultConfig.reward
      if (defaultConfig.remain) form.remain = defaultConfig.remain
      if (defaultConfig.timeLimitMinutes) form.timeLimitMinutes = defaultConfig.timeLimitMinutes
      if (defaultConfig.cityLimit) form.cityLimit = defaultConfig.cityLimit
      if (defaultConfig.provinceLimit) form.provinceLimit = defaultConfig.provinceLimit
      if (defaultConfig.platform) form.platform = defaultConfig.platform
      showToast('已加载默认配置')
    }
  } catch (e) {
    showToast('加载默认配置失败', 'error')
  }
}

// 保存为默认配置
async function handleSaveDefaultConfig() {
  try {
    const configData = {
      description: form.description,
      requirements: form.requirements.filter(r => r.trim()),
      reward: form.reward,
      remain: form.remain,
      timeLimitMinutes: form.timeLimitMinutes,
      cityLimit: form.cityLimit,
      provinceLimit: form.provinceLimit,
      platform: form.platform
    }
    await saveTaskDefaultConfig(configData)
    showToast('默认配置保存成功！')
  } catch (e) {
    showToast('保存失败：' + (e.message || '未知错误'), 'error')
  }
}

async function loadConfig() {
  try {
    config.value = await getConfig()
    form.timeLimitMinutes = config.value.defaultTimeLimitMinutes || 15
    form.cityLimit = config.value.cityLimitPerTask || 1
    form.provinceLimit = config.value.provinceLimitPerTask || 4
    // 加载默认示范图片
    if (config.value.exampleImages && config.value.exampleImages.length) {
      defaultExampleImages.value = config.value.exampleImages
    }
  } catch (e) {
    // 使用默认值
  }
}

// 单个任务提交
async function handleSubmit() {
  // 验证必填项
  if (!form.title.trim()) {
    showToast('请输入任务标题', 'error')
    return
  }
  if (!form.platform) {
    showToast('请选择平台', 'error')
    return
  }
  if (!form.action) {
    showToast('请选择操作类型', 'error')
    return
  }
  if (!form.videoUrl.trim()) {
    showToast('请输入视频链接', 'error')
    return
  }
  if (!form.description.trim()) {
    showToast('请输入任务描述', 'error')
    return
  }
  if (form.reward < 1) {
    showToast('积分奖励至少为1', 'error')
    return
  }
  if (form.remain < 1) {
    showToast('名额数量至少为1', 'error')
    return
  }

  // 过滤空的操作步骤
  const requirements = form.requirements.filter(r => r.trim())
  
  submitting.value = true
  try {
    const taskData = {
      title: form.title.trim(),
      platform: form.platform,
      action: form.action,
      videoUrl: form.videoUrl.trim(),
      description: form.description.trim(),
      requirements: JSON.stringify(requirements),
      templateImages: '[]',
      exampleImages: form.useDefaultExample ? [] : form.exampleImages.filter(Boolean),
      reward: form.reward,
      remain: form.remain,
      timeLimitMinutes: form.timeLimitMinutes,
      cityLimit: form.cityLimit,
      provinceLimit: form.provinceLimit
    }
    
    await createTask(taskData)
    showToast('任务发布成功！')
    
    // 延迟跳转到任务列表
    setTimeout(() => {
      router.push('/tasks')
    }, 1500)
  } catch (e) {
    showToast(e.message || '发布失败，请重试', 'error')
  } finally {
    submitting.value = false
  }
}

// 批量任务提交
async function handleBatchSubmit() {
  const links = batchLinks.value.split('\n').map(l => l.trim()).filter(l => l)
  if (links.length === 0) {
    showToast('请输入至少一个任务链接', 'error')
    return
  }

  batchSubmitting.value = true
  let successCount = 0
  let failCount = 0

  for (const link of links) {
    try {
      // 从链接提取标题
      const title = extractTitleFromLink(link) || `任务_${Date.now()}`
      
      const taskData = {
        title,
        platform: form.platform,
        action: form.action,
        videoUrl: link,
        description: form.description,
        requirements: JSON.stringify(form.requirements.filter(r => r.trim())),
        templateImages: '[]',
        reward: form.reward,
        remain: form.remain,
        timeLimitMinutes: form.timeLimitMinutes,
        cityLimit: form.cityLimit,
        provinceLimit: form.provinceLimit
      }
      
      await createTask(taskData)
      successCount++
    } catch (e) {
      console.error('创建任务失败:', link, e)
      failCount++
    }
  }

  batchSubmitting.value = false
  showToast(`批量创建完成！成功: ${successCount}，失败: ${failCount}`)
  
  if (successCount > 0) {
    setTimeout(() => {
      router.push('/tasks')
    }, 1500)
  }
}

onMounted(() => {
  // 检查权限
  if (!isAdmin.value && !isClient.value) {
    router.replace('/')
    return
  }
  loadConfig()
})
</script>

<style scoped>
.publish-task {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  text-align: center;
  margin-bottom: 16px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 14px;
  color: #6b7280;
}

/* 模式切换 */
.mode-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 8px;
}

.mode-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #6b7280;
  transition: all 0.2s;
}

.mode-btn.active {
  background: white;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 批量提示 */
.batch-tips {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.tips-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 8px;
}

.batch-tips ul {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: #3b82f6;
}

.batch-tips li {
  margin-bottom: 4px;
}

.batch-textarea {
  min-height: 150px;
}

.batch-btn {
  background: #8b5cf6 !important;
}

.batch-btn:hover {
  background: #7c3aed !important;
}

.task-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.form-group {
  margin-bottom: 12px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-tip {
  display: block;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.requirements-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.req-num {
  width: 24px;
  height: 24px;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.req-input {
  flex: 1;
}

.remove-btn {
  width: 24px;
  height: 24px;
  background: #fee2e2;
  color: #ef4444;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.add-btn {
  background: none;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  padding: 10px;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-submit {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.btn-submit {
  background: #3b82f6;
  border: none;
  color: white;
}

.btn-submit:hover {
  background: #2563eb;
}

.btn-submit:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  color: white;
  z-index: 1000;
  animation: slideUp 0.3s ease;
}

.toast.success {
  background: #10b981;
}

.toast.error {
  background: #ef4444;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 示范图片上传 */
.example-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.example-images-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.example-image-item {
  position: relative;
}

.hidden-input {
  display: none;
}

.upload-area {
  aspect-ratio: 9/16;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #f9fafb;
}

.upload-area:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.upload-area.uploading {
  border-color: #3b82f6;
  background: #eff6ff;
  cursor: not-allowed;
}

.upload-text {
  color: #6b7280;
  font-size: 14px;
}

.loading-text {
  color: #3b82f6;
  font-size: 14px;
}

.image-preview {
  position: relative;
  aspect-ratio: 9/16;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
}

.image-preview:hover .image-actions {
  opacity: 1;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: white;
  color: #374151;
}

.action-btn.remove {
  background: #ef4444;
  color: white;
}

.default-tip {
  padding: 12px;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
}

.default-images-preview {
  width: 100%;
}

.preview-tip {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.image-preview.default {
  cursor: default;
}

.image-preview.default .image-actions {
  display: none;
}

.upload-area.disabled {
  cursor: default;
  background: #f3f4f6;
}
.config-actions-section {
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
}

.config-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.btn-config {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-config.load {
  background: #fff;
  color: #3f51b5;
  border: 2px solid #3f51b5;
}

.btn-config.load:active {
  background: #e8eaf6;
}

.btn-config.save {
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
}

.btn-config.save:active {
  opacity: 0.9;
}

.btn-icon {
  font-size: 16px;
}

.config-tip {
  font-size: 12px;
  color: #888;
  text-align: center;
  margin: 0;
}
</style>
