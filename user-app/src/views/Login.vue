<template>
  <div class="login auth-warm-bg">
    <div class="login-container">
      <header class="header">
        <div class="logo">🐟</div>
        <h1>小黄鱼任务中心</h1>
        <p>做任务 · 赚奖励</p>
      </header>
      
      <!-- 已登录提示 -->
      <div v-if="isLoggedIn" class="logged-in-card">
        <div class="logged-in-icon">✓</div>
        <h2>您已登录</h2>
        <p class="logged-in-user">当前账号：{{ currentUser?.username }}</p>
        <button class="btn btn-warm" @click="goHome">返回首页</button>
        <button class="btn btn-ghost" @click="handleLogout">退出登录</button>
      </div>
      
      <!-- 登录表单 -->
      <div v-else class="form-card">
        <h2>登录账号</h2>
        <div class="field">
          <label>用户名或手机号</label>
          <input v-model="username" type="text" placeholder="用户名或11位手机号" @keyup.enter="handleLogin" />
        </div>
        <div class="field">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="请输入密码" @keyup.enter="handleLogin" />
        </div>
        <div class="field captcha-field">
          <label>数字验证码</label>
          <div class="captcha-row">
            <button type="button" class="captcha-img-wrap" @click="loadCaptcha" :disabled="captchaLoading">
              <span v-if="captchaLoading" class="captcha-placeholder">加载中…</span>
              <img v-else-if="captchaSvg" :src="captchaImgSrc" alt="验证码" class="captcha-img" />
              <span v-else class="captcha-placeholder">点击加载</span>
            </button>
            <input
              v-model="captchaCode"
              type="text"
              inputmode="numeric"
              maxlength="4"
              placeholder="4位数字"
              class="captcha-input"
              @keyup.enter="handleLogin"
            />
          </div>
          <p class="captcha-hint">看不清请点击左侧图片刷新</p>
        </div>
        <button class="btn btn-warm" @click="handleLogin" :disabled="loading || captchaLoading || !captchaId">
          <span v-if="loading" class="loading-dot">登录中...</span>
          <span v-else>登录</span>
        </button>
        <div class="link">
          还没有账号？<a @click="goToRegister" class="register-link">立即注册</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'Login' })
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../store/auth'
import { login, fetchLoginCaptcha } from '../api/task'

const router = useRouter()
const route = useRoute()
const { setAuth, clearAuth } = useAuth()
const username = ref('')
const password = ref('')
const loading = ref(false)
const isLoggedIn = ref(false)
const currentUser = ref(null)
const captchaId = ref('')
const captchaSvg = ref('')
const captchaCode = ref('')
const captchaLoading = ref(true)

const captchaImgSrc = computed(() =>
  captchaSvg.value ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg.value)}` : ''
)

async function loadCaptcha() {
  captchaLoading.value = true
  captchaCode.value = ''
  try {
    const data = await fetchLoginCaptcha()
    captchaId.value = data.captchaId
    captchaSvg.value = data.svg
  } catch (e) {
    captchaId.value = ''
    captchaSvg.value = ''
    alert(e.message || '验证码加载失败')
  } finally {
    captchaLoading.value = false
  }
}

onMounted(() => {
  const token = localStorage.getItem('xiaohuangyu_token')
  const userStr = localStorage.getItem('xiaohuangyu_user')
  if (token && userStr) {
    isLoggedIn.value = true
    currentUser.value = JSON.parse(userStr)
  } else {
    loadCaptcha()
  }
})

function goHome() {
  router.replace('/')
}

function handleLogout() {
  clearAuth()
  isLoggedIn.value = false
  currentUser.value = null
}

function goToRegister() {
  router.push('/register')
}

async function handleLogin() {
  if (!username.value.trim()) { alert('请输入用户名或手机号'); return }
  if (!password.value) { alert('请输入密码'); return }
  if (!captchaId.value) { alert('请先加载验证码'); await loadCaptcha(); return }
  const digits = captchaCode.value.replace(/\D/g, '')
  if (digits.length !== 4) { alert('请输入4位数字验证码'); return }
  loading.value = true
  try {
    const { data } = await login(username.value.trim(), password.value, {
      captchaId: captchaId.value,
      captchaCode: digits
    })
    setAuth(data.token, data.user)
    const from = route.query.from || '/'
    router.replace(from)
  } catch (e) {
    alert(e.message || '登录失败')
    await loadCaptcha()
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(180deg, #f8f1e7 0%, #f3efe9 38%, #eef3fb 100%);
}

.login-container {
  width: 100%;
  max-width: 400px;
}

.header {
  text-align: center;
  margin-bottom: 28px;
}

.logo {
  font-size: 48px;
  margin-bottom: 10px;
}

.header h1 {
  font-size: 26px;
  color: #1e2940;
  margin-bottom: 6px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.header p {
  font-size: 14px;
  color: #6e788c;
}

/* 已登录卡片 */
.logged-in-card {
  background: #fff;
  padding: 28px 24px;
  border-radius: 24px;
  box-shadow: 0 18px 42px rgba(29, 39, 58, 0.1);
  text-align: center;
  border: 1px solid rgba(31, 42, 65, 0.08);
}

.logged-in-icon {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #22c55e 0%, #10b981 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  font-size: 24px;
  color: #fff;
}

.logged-in-card h2 {
  font-size: 20px;
  color: #1e2940;
  margin-bottom: 6px;
}

.logged-in-user {
  font-size: 14px;
  color: #6e788c;
  margin-bottom: 20px;
}

/* 表单卡片 */
.form-card {
  background: #fff;
  padding: 24px;
  border-radius: 24px;
  box-shadow: 0 18px 42px rgba(29, 39, 58, 0.1);
  border: 1px solid rgba(31, 42, 65, 0.08);
}

.form-card h2 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 20px;
  color: #1e2940;
  text-align: center;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #1e2940;
  font-weight: 600;
}

.field input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border: 1px solid rgba(31, 42, 65, 0.12);
  border-radius: 14px;
  font-size: 15px;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  outline: none;
  background: rgba(255, 255, 255, 0.92);
}

.field input:focus {
  border-color: #f26a4d;
  box-shadow: 0 0 0 3px rgba(242, 106, 77, 0.12);
}

.field input::placeholder {
  color: #a0aec0;
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.captcha-img-wrap {
  flex-shrink: 0;
  width: 120px;
  height: 46px;
  padding: 0;
  border: 1px solid rgba(31, 42, 65, 0.12);
  border-radius: 14px;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.captcha-img-wrap:disabled {
  opacity: 0.7;
  cursor: wait;
}

.captcha-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.captcha-placeholder {
  font-size: 12px;
  color: #a0aec0;
}

.captcha-input {
  flex: 1;
  min-width: 0;
  height: 46px;
  padding: 0 14px;
  border: 1px solid rgba(31, 42, 65, 0.12);
  border-radius: 14px;
  font-size: 15px;
  box-sizing: border-box;
  outline: none;
}

.captcha-input:focus {
  border-color: #f26a4d;
  box-shadow: 0 0 0 3px rgba(242, 106, 77, 0.12);
}

.captcha-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6e788c;
}

.btn {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-warm {
  background: linear-gradient(135deg, #f26a4d 0%, #e55436 100%);
  color: #fff;
  box-shadow: 0 8px 20px rgba(242, 106, 77, 0.25);
}

.btn-warm:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(242, 106, 77, 0.35);
}

.btn-warm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-ghost {
  background: rgba(31, 42, 65, 0.06);
  color: #223351;
  margin-top: 10px;
  box-shadow: none;
}

.btn-ghost:hover {
  background: rgba(31, 42, 65, 0.1);
}

.loading-dot {
  display: inline-block;
}

.link {
  margin-top: 18px;
  text-align: center;
  font-size: 14px;
  color: #6e788c;
}

.register-link {
  color: #f26a4d;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.register-link:hover {
  text-decoration: underline;
}
</style>
