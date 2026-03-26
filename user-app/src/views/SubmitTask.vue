<template>
  <div class="submit-task">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>提交任务</h1>
    </header>
    <div class="content" v-if="claim">
      <div class="task-title">{{ claim.title }}</div>
      
      <div class="form">
        <!-- 短视频评价 -->
        <div class="field">
          <label>内容评价 <span class="required">*</span></label>
          <p class="field-tip">请根据您的真实观看体验填写评价</p>
          <div class="evaluation-box">
            <textarea 
              v-model="evaluation" 
              placeholder="请填写您对视频内容的评价..."
              rows="4"
              maxlength="500"
            ></textarea>
            <div class="evaluation-footer">
              <span class="char-count">{{ evaluation.length }}/500</span>
              <button type="button" class="refresh-btn" @click="generateRandomEvaluation" title="随机生成">
                换一个
              </button>
            </div>
          </div>
        </div>
        
        <!-- 评论截图 -->
        <div class="field">
          <label>评论截图 <span class="required">*</span>（需上传2张）</label>
          <p class="field-tip">请上传包含您评论内容的截图，确保截图清晰可见</p>
          <div class="uploads">
            <div v-for="(img, i) in previewImages" :key="i" class="thumb">
              <img :src="img.url" alt="" />
              <span v-if="img.uploading" class="loading">上传中...</span>
              <span v-else class="remove" @click="removeImg(i)">x</span>
            </div>
            <div v-if="screenshots.length < 5" class="upload-area" @click="triggerFile">
              <span class="placeholder">+ 添加截图</span>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" multiple style="display:none" @change="onFileChange" />
        </div>
        <button class="btn-submit" @click="handleSubmit" :disabled="submitting || hasUploading">
          {{ submitting ? '提交中...' : hasUploading ? '请等待图片上传完成' : '提交' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMyClaimDetail, submitTask, uploadFile } from '../api/task'

const route = useRoute()
const router = useRouter()
const claim = ref(null)
const screenshots = ref([])
const previewImages = ref([])
const fileInput = ref(null)
const submitting = ref(false)
const evaluation = ref('')

// 随机生成评价的模板库
const evaluationTemplates = {
  // 开头
  openings: [
    '这个视频整体观感不错，',
    '看完这个视频后，',
    '作为一个普通观众，我觉得',
    '从内容创作的角度来看，',
    '作为一个经常刷短视频的用户，',
    '这个视频给我留下了深刻印象，',
    '从用户视角来看，',
    '作为一个内容消费者，',
  ],
  // 内容吸引力
  attraction: [
    '内容比较有吸引力，能够引起观众的兴趣。',
    '视频内容让人眼前一亮，有独特之处。',
    '内容中规中矩，符合平台用户的观看习惯。',
    '视频主题明确，表达方式比较生动。',
    '内容有一定的新意，能抓住观众的注意力。',
    '视频内容丰富，信息量适中。',
    '内容节奏把握得不错，观感舒适。',
    '视频主题贴近生活，容易产生共鸣。',
  ],
  // 创意度
  creativity: [
    '创意方面有自己的特色，不是千篇一律的内容。',
    '在表现形式上有一定创新，给人耳目一新的感觉。',
    '创意程度中等，但执行得比较到位。',
    '有一些新颖的想法，让内容更具吸引力。',
    '创意点主要体现在内容选题上，比较独特。',
    '表现形式有自己的风格，辨识度较高。',
    '创意性不错，在同类型内容中比较突出。',
    '在内容呈现方式上有一些巧思。',
  ],
  // 观看体验
  experience: [
    '整体观看体验流畅，没有明显的问题。',
    '视频时长适中，节奏把控合理。',
    '观看过程中没有卡顿或不适应的地方。',
    '视频质量清晰，声音画面配合得当。',
    '整体体验良好，是一段轻松的观看时光。',
    '视频节奏明快，不会让人感到拖沓。',
    '观看过程中能够保持专注，不易分心。',
    '视频制作精良，细节处理到位。',
  ],
  // 总结
  conclusions: [
    '总体来说是一次不错的观看体验。',
    '整体评价正面，值得一看。',
    '作为一个普通观众，我的反馈如上。',
    '希望创作者继续保持，做出更好的内容。',
    '期待看到更多类似的内容。',
    '这次观看让我对这类内容有了新的认识。',
    '整体感受是积极正面的。',
    '这是一段有价值的观看时光。',
  ]
}

// 生成随机评价
function generateRandomEvaluation() {
  const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)]
  
  const opening = getRandomItem(evaluationTemplates.openings)
  const attraction = getRandomItem(evaluationTemplates.attraction)
  const creativity = getRandomItem(evaluationTemplates.creativity)
  const experience = getRandomItem(evaluationTemplates.experience)
  const conclusion = getRandomItem(evaluationTemplates.conclusions)
  
  evaluation.value = `${opening}${attraction}${creativity}${experience}${conclusion}`
}

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
  
  // 如果是被拒绝的任务，预填充之前的提交信息
  const existingScreenshots = Array.isArray(found.screenshotUrls) ? found.screenshotUrls : []
  if (existingScreenshots.length) {
    screenshots.value = [...existingScreenshots]
    previewImages.value = existingScreenshots.map(url => ({ url, uploading: false }))
    // 预填充之前的评价
    if (found.evaluation) {
      evaluation.value = found.evaluation
    } else {
      generateRandomEvaluation()
    }
  } else {
    // 自动生成随机评价
    generateRandomEvaluation()
  }
})

function triggerFile() {
  if (fileInput.value) fileInput.value.click()
}

async function onFileChange(e) {
  const files = e.target.files
  console.log('[文件选择] files:', files?.length)
  if (!files || !files.length) return
  
  for (let i = 0; i < files.length && screenshots.value.length < 5; i++) {
    const file = files[i]
    console.log('[处理文件]', file.name, file.type, file.size)
    if (!file.type.startsWith('image/')) continue
    
    // 创建预览
    const previewUrl = URL.createObjectURL(file)
    const previewObj = { url: previewUrl, uploading: true }
    previewImages.value.push(previewObj)
    
    try {
      // 上传文件
      const result = await uploadFile(file)
      console.log('[上传成功]', result)
      screenshots.value.push(result.url)
      // 使用索引直接修改数组元素，确保响应性更新
      const idx = previewImages.value.indexOf(previewObj)
      if (idx > -1) {
        previewImages.value[idx] = { url: result.url, uploading: false }
      }
      console.log('[上传状态更新]', { uploading: false, hasUploading: hasUploading.value, previewImages: previewImages.value.map(p => p.uploading) })
    } catch (err) {
      console.error('[上传失败]', err)
      // 上传失败，移除预览
      const idx = previewImages.value.indexOf(previewObj)
      if (idx > -1) previewImages.value.splice(idx, 1)
      URL.revokeObjectURL(previewUrl)
      alert(err.message || '图片上传失败')
    }
  }
  
  e.target.value = ''
}

function removeImg(i) {
  URL.revokeObjectURL(previewImages.value[i].url)
  previewImages.value.splice(i, 1)
  screenshots.value.splice(i, 1)
}

async function handleSubmit() {
  if (!evaluation.value.trim()) {
    alert('请填写内容评价')
    return
  }
  if (screenshots.value.length < 2) {
    alert('请上传至少2张截图')
    return
  }
  if (hasUploading.value) {
    alert('请等待图片上传完成')
    return
  }
  
  submitting.value = true
  try {
    await submitTask(claim.value.id, {
      platformNickname: '',
      screenshots: screenshots.value,
      evaluation: evaluation.value.trim(),
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
.submit-task { min-height: 100vh; background: #f5f5f5; padding-bottom: 24px; }
.header { background: #3f51b5; color: #fff; padding: 16px; display: flex; align-items: center; gap: 12px; }
.back { cursor: pointer; }
.content { padding: 16px; }
.task-title { font-size: 16px; margin-bottom: 16px; font-weight: 500; }

.form .field { margin-bottom: 20px; background: #fff; padding: 16px; border-radius: 12px; }
.form label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; }
.required { color: #f44336; }
.field-tip {
  font-size: 12px;
  color: #999;
  margin: 0 0 12px 0;
}

/* 评价框样式 */
.evaluation-box {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}
.evaluation-box textarea {
  width: 100%;
  padding: 12px;
  border: none;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  box-sizing: border-box;
}
.evaluation-box textarea:focus {
  outline: none;
}
.evaluation-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}
.char-count {
  font-size: 12px;
  color: #999;
}
.refresh-btn {
  padding: 4px 12px;
  background: #3f51b5;
  color: #fff;
  border: none;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
}
.refresh-btn:active {
  opacity: 0.8;
}

.uploads { display: flex; flex-wrap: wrap; gap: 10px; }
.thumb { position: relative; width: 80px; height: 80px; }
.thumb img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #eee; }
.thumb .remove { position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; background: #f44336; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; line-height: 1; }
.thumb .loading { position: absolute; inset: 0; background: rgba(0,0,0,0.5); color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
.upload-area {
  width: 80px; height: 80px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.upload-area:hover { border-color: #3f51b5; }
.placeholder { color: #999; font-size: 13px; }
.btn-submit {
  width: 100%;
  padding: 14px;
  background: #3f51b5;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 8px;
}
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-submit:active:not(:disabled) { opacity: 0.9; }
</style>
