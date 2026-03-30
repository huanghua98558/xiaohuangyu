<template>
  <div class="yx-page no-tabbar submit-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">提交任务</h1>
        <p class="yx-subtitle">上传流程按你现在的审核链路来设计，重点是别再传反图，别再漏截图。</p>
      </div>
      <div class="yx-icon-btn">📤</div>
    </header>

    <div v-if="claim">
      <section class="yx-hero-card">
        <h2 class="submit-title">{{ claim.title }}</h2>
        <p class="submit-sub">上传 2 张截图后进入图片审核，再进入连接审核，最终通过才到账。</p>
        <div class="submit-steps">
          <div class="submit-step active"><span>1</span><b>上传截图</b></div>
          <div class="submit-step"><span>2</span><b>图片审核</b></div>
          <div class="submit-step"><span>3</span><b>连接审核</b></div>
        </div>
      </section>

      <section class="yx-card">
        <div class="yx-card-head">
          <div>
            <h3>上传规范</h3>
            <div class="yx-card-note">高亮重点，别再把图传反</div>
          </div>
        </div>
        <div class="rule-stack">
          <div class="rule-item">
            请先上传 <span class="flash-text">{{ getScreenshotRoleLabel(0) }}</span>
          </div>
          <div class="rule-item">
            再上传 <span class="flash-text">{{ getScreenshotRoleLabel(1) }}</span>
          </div>
        </div>
        <p class="yx-note" style="margin-top:10px;">系统会按固定顺序审核。传反、漏传、截图不完整，都会直接影响审核结果。</p>
      </section>

      <section class="upload-stack">
        <article v-for="slotIndex in 2" :key="slotIndex - 1" class="yx-card">
          <div class="yx-card-head">
            <div>
              <h3>{{ getScreenshotRoleLabel(slotIndex - 1) }}</h3>
              <div class="yx-card-note">{{ getScreenshotRoleTip(slotIndex - 1) }}</div>
            </div>
            <span class="yx-tag coral">第 {{ slotIndex }} 张</span>
          </div>

          <div class="compare-grid">
            <div class="compare-col">
              <span class="compare-label">示范图片</span>
              <button
                v-if="exampleImages[slotIndex - 1]"
                type="button"
                class="compare-box"
                @click="previewExample(exampleImages[slotIndex - 1])"
              >
                <img :src="exampleImages[slotIndex - 1]" alt="示范图片" />
                <small>点击查看示范图</small>
              </button>
              <div v-else class="compare-box empty">
                <span>暂未配置示范图片</span>
              </div>
            </div>

            <div class="compare-col">
              <span class="compare-label">你的上传</span>
              <div v-if="previewImages[slotIndex - 1]" class="compare-box upload-preview">
                <img :src="previewImages[slotIndex - 1].url" alt="上传预览" />
                <small v-if="previewImages[slotIndex - 1].uploading">上传中...</small>
                <button v-else type="button" class="yx-btn-ghost full compare-btn" @click="removeImg(slotIndex - 1)">重新选择</button>
              </div>
              <button v-else type="button" class="compare-box compare-upload" @click="triggerFile(slotIndex - 1)">
                <b>上传{{ getScreenshotRoleLabel(slotIndex - 1) }}</b>
                <small>点击整块区域开始上传</small>
              </button>
            </div>
          </div>
        </article>
      </section>

      <div class="yx-floating-action">
        <div class="yx-card">
          <button class="yx-btn full" @click="handleSubmit" :disabled="submitting || hasUploading">
            {{ submitting ? '提交中...' : hasUploading ? '请等待图片上传完成' : '提交审核' }}
          </button>
        </div>
      </div>
    </div>

    <div class="yx-modal-preview" v-if="previewUrl" @click="previewUrl = ''">
      <div class="yx-modal-card" @click.stop>
        <img :src="previewUrl" alt="示范图片预览" />
        <button type="button" class="yx-btn yx-modal-close" @click="previewUrl = ''">关闭</button>
      </div>
    </div>

    <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMyClaimDetail, getTaskDetail, submitTask, uploadFile } from '../api/task'

const route = useRoute()
const router = useRouter()
const claim = ref(null)
const screenshots = ref([])
const previewImages = ref([])
const exampleImages = ref([])
const previewUrl = ref('')
const fileInput = ref(null)
const activeUploadIndex = ref(null)
const submitting = ref(false)
const SCREENSHOT_ROLE_LABELS = ['第1张：视频主页图', '第2张：评论截图']
const SCREENSHOT_ROLE_TIPS = [
  '请上传能看到达人主页、视频主体信息的截图',
  '请上传能看到你的评论内容、昵称或评论区域的截图'
]

const hasUploading = computed(() => previewImages.value.some(img => img.uploading))

onMounted(async () => {
  const claimId = route.params.claimId
  const found = await getMyClaimDetail(claimId).catch(() => null)
  if (!found) {
    alert('任务不存在')
    router.push('/my/tasks')
    return
  }
  if (found.status !== 'doing' && !found.canResubmit) {
    alert('该任务已提交或已完成')
    router.push('/my/tasks')
    return
  }
  claim.value = found

  const taskId = found.taskId || found.task?.id
  if (taskId) {
    const taskDetail = await getTaskDetail(taskId).catch(() => null)
    const rawExamples = taskDetail?.exampleImages
    exampleImages.value = Array.isArray(rawExamples) ? rawExamples.filter(Boolean).slice(0, 2) : []
  }

  const existingScreenshots = Array.isArray(found.screenshotUrls) ? found.screenshotUrls : []
  if (existingScreenshots.length) {
    const normalizedScreenshots = existingScreenshots.slice(0, 2)
    screenshots.value = [...normalizedScreenshots]
    previewImages.value = normalizedScreenshots.map(url => ({ url, uploading: false }))
  }
})

function triggerFile(index) {
  activeUploadIndex.value = index
  fileInput.value?.click()
}

async function onFileChange(e) {
  const files = e.target.files
  if (!files || !files.length) return
  const targetIndex = activeUploadIndex.value
  const file = files[0]
  if (targetIndex === null || targetIndex === undefined) {
    e.target.value = ''
    activeUploadIndex.value = null
    return
  }
  if (!file || !file.type.startsWith('image/')) {
    e.target.value = ''
    activeUploadIndex.value = null
    return
  }

  const previousPreview = previewImages.value[targetIndex]
  if (previousPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(previousPreview.url)

  const objectUrl = URL.createObjectURL(file)
  previewImages.value[targetIndex] = { url: objectUrl, uploading: true }

  try {
    const result = await uploadFile(file)
    screenshots.value[targetIndex] = result.url
    previewImages.value[targetIndex] = { url: result.url, uploading: false }
  } catch (err) {
    previewImages.value[targetIndex] = null
    screenshots.value[targetIndex] = null
    URL.revokeObjectURL(objectUrl)
    alert(err.message || '图片上传失败')
  } finally {
    activeUploadIndex.value = null
  }
  e.target.value = ''
}

function getScreenshotRoleLabel(index) {
  return SCREENSHOT_ROLE_LABELS[index] || `补充截图 ${index + 1}`
}

function getScreenshotRoleTip(index) {
  return SCREENSHOT_ROLE_TIPS[index] || '请上传清晰完整的截图'
}

function previewExample(url) {
  previewUrl.value = url
}

function removeImg(i) {
  const current = previewImages.value[i]
  if (current?.url?.startsWith('blob:')) URL.revokeObjectURL(current.url)
  previewImages.value[i] = null
  screenshots.value[i] = null
}

async function handleSubmit() {
  const validScreenshots = screenshots.value.filter(Boolean)
  if (validScreenshots.length < 2) {
    alert('请按顺序上传2张截图')
    return
  }
  if (hasUploading.value) {
    alert('请等待图片上传完成')
    return
  }

  submitting.value = true
  try {
    const roleMappedScreenshots = screenshots.value.slice(0, 2).map((url, index) => ({
      url,
      role: index === 0 ? 'homepage' : 'comment',
      sortOrder: index
    }))
    await submitTask(claim.value.id, {
      platformNickname: '',
      screenshots: roleMappedScreenshots,
      evaluation: '',
    })
    alert('提交成功，等待审核')
    router.push('/my/tasks')
  } catch (e) {
    alert(e.message || '提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.submit-page {
  padding-top: 18px;
}

.submit-title {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.04em;
}

.submit-sub {
  margin: 10px 0 0;
  color: var(--yx-muted);
  line-height: 1.7;
  font-size: 13px;
}

.submit-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 14px;
}

.submit-step {
  padding: 12px 10px;
  border-radius: 18px;
  background: rgba(255,255,255,0.76);
  border: 1px solid rgba(33,48,75,0.06);
  text-align: center;
}

.submit-step span {
  width: 26px;
  height: 26px;
  margin: 0 auto 6px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(33,48,75,0.06);
  color: var(--yx-deep);
  font-size: 12px;
  font-weight: 800;
}

.submit-step.active span {
  background: var(--yx-coral);
  color: #fff;
}

.submit-step b {
  display: block;
  font-size: 12px;
}

.rule-stack {
  display: grid;
  gap: 10px;
}

.rule-item {
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(33,48,75,0.04);
  border: 1px solid rgba(33,48,75,0.06);
  font-size: 14px;
  font-weight: 700;
}

.flash-text {
  color: #d5532a;
  font-weight: 900;
  animation: pulse 1.2s ease-in-out infinite;
}

.upload-stack {
  display: grid;
  gap: 12px;
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.compare-col {
  display: grid;
  gap: 8px;
}

.compare-label {
  color: var(--yx-muted);
  font-size: 12px;
  font-weight: 700;
}

.compare-box {
  min-height: 172px;
  border-radius: 18px;
  border: 1px solid rgba(33,48,75,0.08);
  background: rgba(255,255,255,0.84);
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.compare-box img {
  width: 100%;
  height: 116px;
  object-fit: cover;
  border-radius: 14px;
  margin-bottom: 10px;
}

.compare-box small {
  color: var(--yx-muted);
  line-height: 1.6;
  font-size: 12px;
}

.compare-box.empty {
  color: var(--yx-muted);
}

.compare-upload b {
  margin-bottom: 8px;
  color: var(--yx-deep);
  font-size: 14px;
}

.compare-btn {
  margin-top: auto;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: translateY(0); }
  50% { opacity: 0.62; transform: translateY(-1px); }
}
</style>
