<template>
  <div class="admin-review">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>任务审核</h1>
    </header>
    
    <div class="loading" v-if="loading">加载中...</div>
    <div class="empty" v-else-if="!list.length">暂无待审核任务</div>
    
    <div class="list" v-else>
      <div 
        class="card" 
        v-for="item in list" 
        :key="item.id"
        @click="openDetail(item)"
      >
        <div class="card-header">
          <div class="title">{{ item.title }}</div>
          <div class="card-arrow">›</div>
        </div>
        <div class="meta">
          <span class="meta-item">
            <span class="meta-icon">👤</span>
            {{ item.platformNickname || '未设置昵称' }}
          </span>
          <span class="meta-item" v-if="item.createdAt">
            <span class="meta-icon">🕐</span>
            {{ formatTime(item.createdAt) }}
          </span>
        </div>
        <div class="screenshots-preview" v-if="item.screenshots && item.screenshots.length">
          <img 
            v-for="(img, i) in item.screenshots.slice(0, 3)" 
            :key="i" 
            :src="img" 
            alt="" 
            class="thumb" 
          />
          <div class="more-count" v-if="item.screenshots.length > 3">
            +{{ item.screenshots.length - 3 }}
          </div>
        </div>
        <div class="card-footer">
          <span class="hint">点击查看详情</span>
          <div class="quick-actions" @click.stop>
            <button class="btn-approve" @click="review(item.id, 'approve')">通过</button>
            <button class="btn-reject" @click="review(item.id, 'reject')">拒绝</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 详情弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div class="detail-overlay" v-if="showDetail" @click.self="closeDetail">
          <div class="detail-modal">
            <div class="detail-header">
              <h3>任务提交详情</h3>
              <button class="close-btn" @click="closeDetail">✕</button>
            </div>
            
            <div class="detail-body" v-if="currentItem">
              <!-- 任务信息 -->
              <div class="detail-section">
                <div class="detail-label">任务标题</div>
                <div class="detail-value">{{ currentItem.title }}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-section half">
                  <div class="detail-label">平台昵称</div>
                  <div class="detail-value">{{ currentItem.platformNickname || '未设置' }}</div>
                </div>
                <div class="detail-section half">
                  <div class="detail-label">提交时间</div>
                  <div class="detail-value">{{ formatTime(currentItem.createdAt) }}</div>
                </div>
              </div>
              
              <div class="detail-section" v-if="currentItem.reward">
                <div class="detail-label">任务积分</div>
                <div class="detail-value reward">+{{ currentItem.reward }} 积分</div>
              </div>
              
              <!-- 提交截图 -->
              <div class="detail-section" v-if="currentItem.screenshots && currentItem.screenshots.length">
                <div class="detail-label">提交截图 ({{ currentItem.screenshots.length }}张)</div>
                <div class="screenshots-grid">
                  <img 
                    v-for="(img, i) in currentItem.screenshots" 
                    :key="i" 
                    :src="img" 
                    alt="" 
                    class="screenshot-img"
                    @click="previewImage(img)"
                  />
                </div>
              </div>
              
              <!-- 备注信息 -->
              <div class="detail-section" v-if="currentItem.remark">
                <div class="detail-label">用户备注</div>
                <div class="detail-value remark">{{ currentItem.remark }}</div>
              </div>
              
              <!-- 用户信息 -->
              <div class="detail-section" v-if="currentItem.user">
                <div class="detail-label">用户信息</div>
                <div class="user-info">
                  <span class="user-avatar">{{ currentItem.user.username?.charAt(0) || '?' }}</span>
                  <span class="user-name">{{ currentItem.user.username }}</span>
                </div>
              </div>
            </div>
            
            <div class="detail-footer">
              <button class="btn-reject-lg" @click="reviewAndClose('reject')">
                <span class="btn-icon">✕</span>
                拒绝
              </button>
              <button class="btn-approve-lg" @click="reviewAndClose('approve')">
                <span class="btn-icon">✓</span>
                通过
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    
    <!-- 图片预览 -->
    <Teleport to="body">
      <Transition name="fade">
        <div class="image-preview-overlay" v-if="previewUrl" @click="previewUrl = ''">
          <img :src="previewUrl" alt="" class="preview-img" @click.stop />
          <button class="preview-close" @click="previewUrl = ''">✕</button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getPendingReview, reviewClaim } from '../api/task'

const loading = ref(true)
const list = ref([])
const showDetail = ref(false)
const currentItem = ref(null)
const previewUrl = ref('')

function formatTime(time) {
  if (!time) return '-'
  const date = new Date(time)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

function openDetail(item) {
  currentItem.value = item
  showDetail.value = true
  document.body.style.overflow = 'hidden'
}

function closeDetail() {
  showDetail.value = false
  document.body.style.overflow = ''
}

function previewImage(url) {
  previewUrl.value = url
}

async function load() {
  loading.value = true
  try {
    list.value = await getPendingReview()
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function review(claimId, action) {
  try {
    await reviewClaim(claimId, action)
    await load()
  } catch (e) {
    alert(e.message || '操作失败')
  }
}

async function reviewAndClose(action) {
  if (!currentItem.value) return
  try {
    await reviewClaim(currentItem.value.id, action)
    closeDetail()
    await load()
  } catch (e) {
    alert(e.message || '操作失败')
  }
}

onMounted(load)
</script>

<style scoped>
.admin-review { 
  min-height: 100vh; 
  background: #f5f5f5; 
  padding-bottom: 24px; 
}

.header { 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff; 
  padding: 16px; 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  position: sticky;
  top: 0;
  z-index: 10;
}

.header h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.back { 
  cursor: pointer; 
  font-size: 14px;
  opacity: 0.9;
}

.loading, .empty { 
  padding: 60px 40px; 
  text-align: center; 
  color: #666; 
  font-size: 15px;
}

.list { 
  padding: 12px; 
}

.card { 
  background: #fff; 
  padding: 16px; 
  border-radius: 12px; 
  margin-bottom: 12px; 
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: all 0.2s;
}

.card:active {
  transform: scale(0.99);
  background: #fafafa;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.card .title { 
  font-size: 16px; 
  font-weight: 600;
  color: #333;
  flex: 1;
}

.card-arrow {
  color: #ccc;
  font-size: 20px;
  font-weight: 300;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #666;
}

.meta-icon {
  font-size: 12px;
}

.screenshots-preview { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 8px; 
  margin-bottom: 12px; 
}

.thumb { 
  width: 64px; 
  height: 64px; 
  object-fit: cover; 
  border-radius: 8px; 
  border: 1px solid #eee; 
}

.more-count {
  width: 64px;
  height: 64px;
  background: rgba(0,0,0,0.5);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.hint {
  font-size: 12px;
  color: #999;
}

.quick-actions { 
  display: flex; 
  gap: 10px; 
}

.btn-approve { 
  padding: 6px 16px; 
  background: #4caf50; 
  color: #fff; 
  border: none; 
  border-radius: 6px; 
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-approve:active {
  background: #45a049;
  transform: scale(0.95);
}

.btn-reject { 
  padding: 6px 16px; 
  background: #f44336; 
  color: #fff; 
  border: none; 
  border-radius: 6px; 
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-reject:active {
  background: #da190b;
  transform: scale(0.95);
}

/* 详情弹窗 */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

.detail-modal {
  background: #fff;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.detail-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  width: 32px;
  height: 32px;
  background: #f5f5f5;
  border: none;
  border-radius: 50%;
  font-size: 16px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:active {
  background: #eee;
  transform: scale(0.95);
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section.half {
  flex: 1;
  margin-bottom: 0;
}

.detail-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.detail-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.detail-value {
  font-size: 15px;
  color: #333;
  line-height: 1.5;
}

.detail-value.reward {
  color: #ff9800;
  font-weight: 600;
  font-size: 18px;
}

.detail-value.remark {
  background: #f9f9f9;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
}

.screenshots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.screenshot-img {
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #eee;
  cursor: pointer;
  transition: transform 0.2s;
}

.screenshot-img:active {
  transform: scale(0.95);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f9f9f9;
  padding: 12px;
  border-radius: 8px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.user-name {
  font-size: 15px;
  color: #333;
}

.detail-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}

.btn-reject-lg,
.btn-approve-lg {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.btn-reject-lg {
  background: #fff;
  color: #f44336;
  border: 1px solid #f44336;
}

.btn-reject-lg:active {
  background: #fff5f5;
  transform: scale(0.98);
}

.btn-approve-lg {
  background: #4caf50;
  color: #fff;
}

.btn-approve-lg:active {
  background: #45a049;
  transform: scale(0.98);
}

.btn-icon {
  font-size: 16px;
}

/* 图片预览 */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 20px;
}

.preview-img {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
}

.preview-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .detail-modal,
.modal-leave-active .detail-modal {
  transition: transform 0.3s ease;
}

.modal-enter-from .detail-modal,
.modal-leave-to .detail-modal {
  transform: translateY(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
