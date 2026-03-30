<template>
  <div class="pwa-guide-page">
    <header class="page-header">
      <button class="back-btn" @click="goBack">←</button>
      <h1>安装指南</h1>
      <div class="header-right"></div>
    </header>
    
    <div class="guide-content">
      <!-- 什么是PWA -->
      <section class="guide-section">
        <div class="section-icon">📱</div>
        <h2>什么是APP模式？</h2>
        <p class="section-desc">
          将小黄鱼添加到手机主屏幕后，即可像原生APP一样使用：
        </p>
        <ul class="feature-list">
          <li>✅ 全屏显示，无浏览器地址栏</li>
          <li>✅ 更流畅的操作体验</li>
          <li>✅ 支持离线访问部分功能</li>
          <li>✅ 消息推送更及时</li>
        </ul>
      </section>
      
      <!-- Android安装 -->
      <section class="guide-section android">
        <div class="section-icon">🤖</div>
        <h2>Android 安装步骤</h2>
        <div class="steps">
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-content">
              <div class="step-title">打开Chrome浏览器</div>
              <div class="step-desc">使用Chrome浏览器访问本网站</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-content">
              <div class="step-title">点击首页安装提示</div>
              <div class="step-desc">首页会显示紫色"添加到桌面"卡片，点击安装按钮</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-content">
              <div class="step-title">或使用浏览器菜单</div>
              <div class="step-desc">点击右上角 ⋮ 菜单 → 选择"添加到主屏幕"</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num">4</div>
            <div class="step-content">
              <div class="step-title">从主屏幕启动</div>
              <div class="step-desc">安装后，桌面会出现小黄鱼图标，点击即可使用</div>
            </div>
          </div>
        </div>
      </section>
      
      <!-- iOS安装 -->
      <section class="guide-section ios">
        <div class="section-icon">🍎</div>
        <h2>iOS (iPhone/iPad) 安装步骤</h2>
        <div class="important-notice">
          ⚠️ 必须使用 Safari 浏览器，Chrome 不支持安装
        </div>
        <div class="steps">
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-content">
              <div class="step-title">使用Safari打开网站</div>
              <div class="step-desc">请务必使用iPhone自带的Safari浏览器</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-content">
              <div class="step-title">点击分享按钮</div>
              <div class="step-desc">
                点击底部工具栏的 <span class="share-icon">⬆️</span> 分享按钮
              </div>
            </div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-content">
              <div class="step-title">选择"添加到主屏幕"</div>
              <div class="step-desc">在弹出的菜单中向下滚动，找到并点击"添加到主屏幕"</div>
            </div>
          </div>
          <div class="step">
            <div class="step-num">4</div>
            <div class="step-content">
              <div class="step-title">点击"添加"完成</div>
              <div class="step-desc">右上角点击"添加"，桌面会出现小黄鱼图标</div>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 常见问题 -->
      <section class="guide-section faq">
        <div class="section-icon">❓</div>
        <h2>常见问题</h2>
        <div class="faq-list">
          <div class="faq-item">
            <div class="faq-q">Q: 为什么我看不到安装提示？</div>
            <div class="faq-a">A: 请确保使用Chrome(Android)或Safari(iOS)浏览器，并且已经访问过网站几次。</div>
          </div>
          <div class="faq-item">
            <div class="faq-q">Q: 安装后如何更新？</div>
            <div class="faq-a">A: 应用会自动更新，或者您可以删除后重新安装。</div>
          </div>
          <div class="faq-item">
            <div class="faq-q">Q: 安装后还需要网络吗？</div>
            <div class="faq-a">A: 大部分功能需要网络，但已访问过的页面可以离线查看。</div>
          </div>
        </div>
      </section>
      
      <!-- 检测当前状态 -->
      <section class="guide-section status" v-if="isInstalled">
        <div class="installed-badge">
          <span class="badge-icon">✅</span>
          <span class="badge-text">您已安装APP模式</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePWAInstall } from '../utils/pwa'

const router = useRouter()
const { isInstalled } = usePWAInstall()

function goBack() {
  router.back()
}
</script>

<style scoped>
.pwa-guide-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f5f7fa 0%, #e8ecf1 100%);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}

.page-header h1 {
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  width: 36px;
}

.guide-content {
  padding: 20px;
}

.guide-section {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}

.section-icon {
  font-size: 40px;
  text-align: center;
  margin-bottom: 12px;
}

.guide-section h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  text-align: center;
  margin-bottom: 12px;
}

.section-desc {
  font-size: 14px;
  color: #666;
  text-align: center;
  margin-bottom: 16px;
}

.feature-list {
  list-style: none;
  padding: 0;
}

.feature-list li {
  padding: 10px 0;
  font-size: 14px;
  color: #333;
  border-bottom: 1px solid #f0f0f0;
}

.feature-list li:last-child {
  border-bottom: none;
}

.steps {
  margin-top: 16px;
}

.step {
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
}

.step:last-child {
  border-bottom: none;
}

.step-num {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.step-desc {
  font-size: 13px;
  color: #666;
}

.important-notice {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: #856404;
  margin-bottom: 16px;
  text-align: center;
}

.share-icon {
  display: inline-block;
  background: #007aff;
  color: #fff;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  border-radius: 4px;
  font-size: 14px;
  vertical-align: middle;
}

.android .step-num {
  background: linear-gradient(135deg, #34a853 0%, #4caf50 100%);
}

.ios .step-num {
  background: linear-gradient(135deg, #007aff 0%, #5ac8fa 100%);
}

.faq-list {
  margin-top: 12px;
}

.faq-item {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.faq-item:last-child {
  border-bottom: none;
}

.faq-q {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
}

.faq-a {
  font-size: 13px;
  color: #666;
  padding-left: 20px;
}

.installed-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  border-radius: 12px;
}

.badge-icon {
  font-size: 24px;
}

.badge-text {
  font-size: 16px;
  font-weight: 600;
  color: #2e7d32;
}
</style>
