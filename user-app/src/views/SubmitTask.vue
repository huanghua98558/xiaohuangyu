<template>
  <div class="submit-task">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>提交任务</h1>
    </header>
    <div class="content" v-if="claim">
      <div class="task-title">{{ claim.title }}</div>
      <div class="submit-steps">
        <div class="submit-step active">
          <span class="submit-step-icon">1</span>
          <span>上传截图</span>
        </div>
        <span class="submit-step-arrow">→</span>
        <div class="submit-step">
          <span class="submit-step-icon">2</span>
          <span>客服核对</span>
        </div>
        <span class="submit-step-arrow">→</span>
        <div class="submit-step">
          <span class="submit-step-icon">3</span>
          <span>奖励到账</span>
        </div>
      </div>
      
      <div class="form">
        <!-- 评论截图 -->
        <div class="field">
          <label>评论截图 <span class="required">*</span>（需上传2张）</label>
          <div class="upload-notice">
            <div class="upload-notice-title">请严格按顺序上传，传反会直接影响审核</div>
            <div class="upload-notice-version">新版上传区：左边示范图，右边上传入口</div>
            <div class="upload-notice-grid">
              <div class="upload-notice-item">
                <div class="upload-notice-text">请先上传 <span class="text-flash">第1张：视频主页截图</span></div>
              </div>
              <div class="upload-notice-item">
                <div class="upload-notice-text">再上传 <span class="text-flash">第2张：评论截图</span></div>
              </div>
            </div>
            <div class="upload-notice-subline">系统会按固定顺序审核。传反、漏传、截图不完整，都会直接影响审核结果；请先上传主页图，再上传评论图。</div>
          </div>
          <div class="upload-slots">
            <div v-for="slotIndex in 2" :key="slotIndex - 1" class="upload-slot">
              <div class="upload-slot-header">
                <span class="upload-slot-badge">{{ slotIndex }}</span>
                <div>
                  <div class="upload-slot-title">
                    请上传 <span class="text-flash">{{ getScreenshotRoleLabel(slotIndex - 1) }}</span>
                  </div>
                  <div class="upload-slot-tip">{{ getScreenshotRoleTip(slotIndex - 1) }}</div>
                </div>
              </div>

              <div class="slot-compare">
                <div class="slot-side">
                  <div class="slot-side-label">示范图片</div>
                  <button
                    v-if="exampleImages[slotIndex - 1]"
                    type="button"
                    class="example-card"
                    @click="previewExample(exampleImages[slotIndex - 1])"
                  >
                    <img :src="exampleImages[slotIndex - 1]" alt="示范图片" />
                    <span class="example-card-label">点击查看示范图</span>
                  </button>
                  <div v-else class="example-empty">暂未配置示范图片</div>
                </div>

                <div class="slot-side">
                  <div class="slot-side-label">你的上传</div>
                  <div v-if="previewImages[slotIndex - 1]" class="slot-preview">
                    <img :src="previewImages[slotIndex - 1].url" alt="" />
                    <span v-if="previewImages[slotIndex - 1].uploading" class="loading">上传中...</span>
                    <button
                      v-else
                      type="button"
                      class="slot-remove"
                      @click="removeImg(slotIndex - 1)"
                    >
                      重新选择
                    </button>
                  </div>

                  <button
                    v-else
                    type="button"
                    class="slot-upload-btn"
                    @click="triggerFile(slotIndex - 1)"
                  >
                    上传{{ getScreenshotRoleLabel(slotIndex - 1) }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />
        </div>
        <button class="btn-submit" @click="handleSubmit" :disabled="submitting || hasUploading">
          {{ submitting ? '提交中...' : hasUploading ? '请等待图片上传完成' : '提交' }}
        </button>
      </div>
    </div>

    <div class="image-preview" v-if="previewUrl" @click="previewUrl = ''">
      <button type="button" class="preview-close" @click.stop="previewUrl = ''">关闭</button>
      <div class="preview-stage" @click.stop>
        <img :src="previewUrl" alt="示范图片预览" />
      </div>
    </div>
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
  const claimId = route.params.claimId  // 保持字符串类型
  const found = await getMyClaimDetail(claimId).catch(() => null)

  if (!found) {
    alert('任务不存在')
    router.push('/my/tasks')
    return
  }
  
  console.log('[SubmitTask] found task:', found.id, 'status:', found.status, 'isRejected:', found.isRejected)
  
  // 允许 doing 状态的任务提交（包括被拒绝的任务）
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
  
  // 如果是被拒绝的任务，预填充之前的提交信息
  const existingScreenshots = Array.isArray(found.screenshotUrls) ? found.screenshotUrls : []
  if (existingScreenshots.length) {
    const normalizedScreenshots = existingScreenshots.slice(0, 2)
    screenshots.value = [...normalizedScreenshots]
    previewImages.value = normalizedScreenshots.map(url => ({ url, uploading: false }))
  }
})

function triggerFile(index) {
  activeUploadIndex.value = index
  if (fileInput.value) fileInput.value.click()
}

async function onFileChange(e) {
  const files = e.target.files
  console.log('[文件选择] files:', files?.length)
  if (!files || !files.length) return

  const targetIndex = activeUploadIndex.value
  const file = files[0]
  if (targetIndex === null || targetIndex === undefined) {
    e.target.value = ''
    activeUploadIndex.value = null
    return
  }

  console.log('[处理文件]', file?.name, file?.type, file?.size, 'targetIndex:', targetIndex)
  if (!file || !file.type.startsWith('image/')) {
    e.target.value = ''
    activeUploadIndex.value = null
    return
  }

  const previousPreview = previewImages.value[targetIndex]
  if (previousPreview?.url?.startsWith('blob:')) {
    URL.revokeObjectURL(previousPreview.url)
  }

  const previewUrl = URL.createObjectURL(file)
  previewImages.value[targetIndex] = { url: previewUrl, uploading: true }

  try {
    const result = await uploadFile(file)
    console.log('[上传成功]', result)
    screenshots.value[targetIndex] = result.url
    previewImages.value[targetIndex] = { url: result.url, uploading: false }
    console.log('[上传状态更新]', {
      uploading: false,
      hasUploading: hasUploading.value,
      previewImages: previewImages.value.map(p => p?.uploading)
    })
  } catch (err) {
    console.error('[上传失败]', err)
    previewImages.value[targetIndex] = null
    screenshots.value[targetIndex] = null
    URL.revokeObjectURL(previewUrl)
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
  if (current?.url?.startsWith('blob:')) {
    URL.revokeObjectURL(current.url)
  }
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
.submit-task { min-height: 100vh; background: linear-gradient(180deg, #eef3ff 0%, #f7f8fc 180px, #f5f5f5 100%); padding-bottom: 24px; }
.header { background: #3f51b5; color: #fff; padding: 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 6px 16px rgba(63, 81, 181, 0.18); }
.back { cursor: pointer; }
.content { padding: 16px; }
.task-title { font-size: 16px; margin-bottom: 16px; font-weight: 500; }
.submit-steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
  padding: 14px 12px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 8px 20px rgba(31, 41, 55, 0.05);
}
.submit-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #7b8193;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}
.submit-step.active {
  color: #3547a6;
}
.submit-step-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e6ebff;
  color: #3547a6;
  font-size: 13px;
  font-weight: 700;
}
.submit-step.active .submit-step-icon {
  background: #3547a6;
  color: #fff;
}
.submit-step-arrow {
  color: #a7b0cf;
  font-size: 14px;
  font-weight: 700;
}

.form .field { margin-bottom: 20px; background: #fff; padding: 16px; border-radius: 12px; }
.form label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; }
.required { color: #f44336; }
.upload-notice {
  margin-bottom: 14px;
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fff4dd 0%, #ffe7c2 100%);
  border: 2px solid #ffb35c;
  box-shadow: 0 10px 24px rgba(255, 149, 67, 0.16);
}
.upload-notice-title {
  font-size: 16px;
  font-weight: 700;
  color: #9a4700;
  margin-bottom: 10px;
  line-height: 1.5;
}
.upload-notice-version {
  display: inline-flex;
  align-items: center;
  margin-bottom: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #c0392b;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.upload-notice-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 10px;
}
.upload-notice-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.82);
}
.upload-notice-text {
  font-size: 14px;
  font-weight: 700;
  color: #7a3900;
}
.upload-notice-subline {
  font-size: 12px;
  color: #915314;
  line-height: 1.5;
  font-weight: 600;
}
.upload-slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.upload-slot {
  border: 1px solid #dde4fb;
  border-radius: 16px;
  padding: 14px;
  background: #ffffff;
  box-shadow: 0 10px 22px rgba(63, 81, 181, 0.05);
}
.slot-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.slot-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.slot-side-label {
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
}
.upload-slot-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}
.upload-slot-badge {
  min-width: 54px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #3f51b5;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.upload-slot-title {
  font-size: 14px;
  font-weight: 700;
  color: #222;
  margin-bottom: 4px;
}
.text-flash {
  display: inline-block;
  color: #ff6b3d;
  animation: textFlash 1.2s ease-in-out infinite;
}
.upload-slot-tip {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
.slot-preview {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #e0e7ff;
  background: #fff;
}
.slot-preview img {
  display: block;
  width: 100%;
  height: 210px;
  object-fit: cover;
}
.example-card {
  width: 100%;
  border: none;
  background: #fff;
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 6px 14px rgba(63, 81, 181, 0.08);
  cursor: pointer;
  text-align: left;
  min-height: 210px;
}
.example-card img {
  width: 100%;
  height: 210px;
  object-fit: cover;
  border-radius: 10px;
  display: block;
  margin-bottom: 8px;
}
.example-card-label {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
}
.example-empty {
  height: 210px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px dashed #d1d5db;
  background: #f9fafb;
  color: #9ca3af;
  font-size: 12px;
}
.loading {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.slot-remove,
.slot-upload-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.slot-upload-btn {
  background: linear-gradient(180deg, #f6f8ff 0%, #edf2ff 100%);
  color: #3547a6;
  border: 1px dashed #8fa0ff;
  height: 210px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.slot-remove {
  background: #f3f4f6;
  color: #374151;
}
.slot-upload-btn:active,
.slot-remove:active {
  opacity: 0.9;
}
.btn-submit {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #ff8f6b 0%, #ff7651 100%);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 8px;
  box-shadow: 0 10px 22px rgba(255, 118, 81, 0.28);
}
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-submit:active:not(:disabled) { opacity: 0.9; }

.image-preview {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.62);
  padding: 24px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-stage {
  width: min(78vw, 520px);
  max-width: 520px;
  max-height: min(60vh, 560px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
}
.preview-stage img {
  width: 100%;
  max-height: min(52vh, 500px);
  object-fit: contain;
  border-radius: 12px;
}
.preview-close {
  position: absolute;
  top: calc(50% - min(30vh, 280px) - 52px);
  right: calc(50% - min(25vw, 260px));
  z-index: 1001;
  min-width: 64px;
  height: 36px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.78);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

@keyframes textFlash {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.06);
    opacity: 0.92;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
