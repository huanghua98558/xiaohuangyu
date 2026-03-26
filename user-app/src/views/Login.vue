<template>
  <div class="login">
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
        <button class="btn btn-primary" @click="goHome">返回首页</button>
        <button class="btn btn-secondary" @click="handleLogout">退出登录</button>
      </div>
      
      <!-- 登录表单 -->
      <div v-else class="form-card">
        <h2>登录账号</h2>
        <div class="field">
          <label>用户名</label>
          <input v-model="username" type="text" placeholder="请输入用户名" @keyup.enter="handleLogin" />
        </div>
        <div class="field">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="请输入密码" @keyup.enter="handleLogin" />
        </div>
        <button class="btn btn-primary" @click="handleLogin" :disabled="loading">
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
import { login } from '../api/task'

const router = useRouter()
const route = useRoute()
const { setAuth, clearAuth } = useAuth()
const username = ref('')
const password = ref('')
const loading = ref(false)
const isLoggedIn = ref(false)
const currentUser = ref(null)

onMounted(() => {
  // 检查登录状态
  const token = localStorage.getItem('xiaohuangyu_token')
  const userStr = localStorage.getItem('xiaohuangyu_user')
  if (token && userStr) {
    isLoggedIn.value = true
    currentUser.value = JSON.parse(userStr)
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
  if (!username.value.trim()) { alert('请输入用户名'); return }
  if (!password.value) { alert('请输入密码'); return }
  loading.value = true
  try {
    const { data } = await login(username.value.trim(), password.value)
    setAuth(data.token, data.user)
    const from = route.query.from || '/'
    router.replace(from)
  } catch (e) {
    alert(e.message || '登录失败')
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-container {
  width: 100%;
  max-width: 400px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  font-size: 48px;
  margin-bottom: 12px;
}

.header h1 {
  font-size: 24px;
  color: #fff;
  margin-bottom: 8px;
  font-weight: 600;
}

.header p {
  font-size: 14px;
  color: rgba(255,255,255,0.8);
}

/* 已登录卡片 */
.logged-in-card {
  background: #fff;
  padding: 32px 28px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  text-align: center;
}

.logged-in-icon {
  width: 60px;
  height: 60px;
  background: #e8f5e9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  font-size: 28px;
  color: #4caf50;
}

.logged-in-card h2 {
  font-size: 20px;
  color: #333;
  margin-bottom: 8px;
}

.logged-in-user {
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
}

/* 表单卡片 */
.form-card {
  background: #fff;
  padding: 28px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.form-card h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #333;
  text-align: center;
}

.field {
  margin-bottom: 20px;
}

.field label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.field input {
  width: 100%;
  height: 44px;
  padding: 0 16px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  outline: none;
}

.field input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.field input::placeholder {
  color: #bbb;
}

.btn {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #f5f5f5;
  color: #666;
  margin-top: 10px;
}

.btn-secondary:hover {
  background: #eee;
}

.loading-dot {
  display: inline-block;
}

.link {
  margin-top: 20px;
  text-align: center;
  font-size: 14px;
  color: #666;
}

.register-link {
  color: #667eea;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.register-link:hover {
  text-decoration: underline;
}
</style>
