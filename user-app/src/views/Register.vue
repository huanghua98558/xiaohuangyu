<template>
  <div class="register auth-warm-bg">
    <div class="register-container">
      <header class="header">
        <div class="logo">🐟</div>
        <h1>小黄鱼任务中心</h1>
        <p>创建账号，开始赚积分</p>
      </header>

      <!-- 注册表单 -->
      <div class="form-card">
        <h2>注册账号</h2>
        <div class="field">
          <label>用户名</label>
          <input v-model="username" type="text" placeholder="请输入用户名（2-20字符）" @keyup.enter="handleRegister" />
        </div>
        <div class="field">
          <label>手机号（必填，登录时用手机号登录）</label>
          <input v-model="phone" type="tel" placeholder="请输入11位手机号" maxlength="11" @keyup.enter="handleRegister" />
        </div>
        <div class="field">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="请输入密码（至少6位）" @keyup.enter="handleRegister" />
        </div>
        <div class="field">
          <label>确认密码</label>
          <input v-model="password2" type="password" placeholder="再次输入密码" @keyup.enter="handleRegister" />
        </div>
        <div class="field" v-if="configLoaded && registrationCodeRequired">
          <label>
            注册码
            <span class="required-tag">（必填）</span>
          </label>
          <input
            v-model="registrationCode"
            type="text"
            placeholder="请输入管理员发放的注册码"
            maxlength="32"
            @keyup.enter="handleRegister"
          />
        </div>
        <div class="field">
          <label>
            推广邀请码
            <span v-if="configLoaded && !inviteRequired" class="optional-tag">（选填，绑定邀请关系）</span>
            <span v-if="configLoaded && inviteRequired" class="required-tag">（必填）</span>
          </label>
          <input 
            v-model="inviteCode" 
            type="text" 
            placeholder="好友邀请码，用于推广绑定" 
            maxlength="20"
            @keyup.enter="handleRegister" 
          />
        </div>
        <button type="button" class="btn btn-warm" :disabled="loading" @click="handleRegister">
          {{ loading ? '注册中...' : '注册账号' }}
        </button>
        <div class="link">
          已有账号？<router-link to="/login">去登录</router-link>
        </div>
      </div>
    </div>

    <!-- 隐私政策弹窗 -->
    <div v-if="showPrivacyModal" class="modal-overlay" @click.self="rejectAndBack">
      <div class="modal-content">
        <div class="modal-header">
          <h3>隐私政策</h3>
          <button class="modal-close" @click="rejectAndBack">×</button>
        </div>
        <div class="modal-body">
          <div class="policy-text" v-html="privacyContent"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-reject" @click="rejectAndBack">不同意</button>
          <button class="btn-agree" @click="agreePrivacy">同意</button>
        </div>
      </div>
    </div>

    <!-- 用户协议弹窗 -->
    <div v-if="showTermsModal" class="modal-overlay" @click.self="rejectAndBack">
      <div class="modal-content">
        <div class="modal-header">
          <h3>用户协议</h3>
          <button class="modal-close" @click="rejectAndBack">×</button>
        </div>
        <div class="modal-body">
          <div class="policy-text" v-html="termsContent"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-reject" @click="rejectAndBack">不同意</button>
          <button class="btn-agree" @click="agreeTerms">同意并继续</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'Register' })
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../store/auth'
import { register, getRegisterConfig } from '../api/task'

const router = useRouter()
const route = useRoute()
const { setAuth } = useAuth()

// 弹窗控制
const showPrivacyModal = ref(false)
const showTermsModal = ref(false)

// 协议同意状态
const agreedPrivacy = ref(false)
const agreedTerms = ref(false)

// 表单数据
const username = ref('')
const phone = ref('')
const password = ref('')
const password2 = ref('')
const inviteCode = ref('')
const loading = ref(false)
const configLoaded = ref(false)
const inviteRequired = ref(false)
const registrationCodeRequired = ref(false)
const registrationCode = ref('')

// 协议内容
const privacyContent = ref('')
const termsContent = ref('')

// 检查URL参数中是否有邀请码
onMounted(async () => {
  // 从URL参数获取邀请码
  if (route.query.invite) {
    inviteCode.value = route.query.invite
  }
  
  // 获取注册配置
  try {
    const config = await getRegisterConfig()
    inviteRequired.value = config?.inviteRequired || false
    registrationCodeRequired.value = config?.registrationCodeRequired || false
    configLoaded.value = true
  } catch (e) {
    console.error('获取注册配置失败', e)
    configLoaded.value = true
  }
  
  // 加载协议内容
  try {
    const [privacyRes, termsRes] = await Promise.all([
      fetch('/privacy.html'),
      fetch('/agreement.html')
    ])
    privacyContent.value = await privacyRes.text()
    termsContent.value = await termsRes.text()
  } catch (e) {
    console.error('加载协议失败', e)
  }
  
  // 检查是否已同意协议（从sessionStorage）
  const sessionAgreed = sessionStorage.getItem('register_agreed')
  if (sessionAgreed === 'true') {
    agreedPrivacy.value = true
    agreedTerms.value = true
  } else {
    // 显示隐私政策弹窗
    showPrivacyModal.value = true
  }
})

// 同意隐私政策
function agreePrivacy() {
  agreedPrivacy.value = true
  showPrivacyModal.value = false
  // 显示用户协议弹窗
  showTermsModal.value = true
}

// 同意用户协议
function agreeTerms() {
  agreedTerms.value = true
  showTermsModal.value = false
  // 保存同意状态到sessionStorage
  sessionStorage.setItem('register_agreed', 'true')
}

// 拒绝，返回登录页
function rejectAndBack() {
  router.replace('/login')
}

function isValidPhone(v) {
  return /^1\d{10}$/.test(String(v).trim())
}

async function handleRegister() {
  // 检查是否已同意协议
  if (!agreedPrivacy.value || !agreedTerms.value) {
    showPrivacyModal.value = true
    return
  }
  
  if (!username.value.trim()) { alert('请输入用户名'); return }
  if (username.value.trim().length < 2 || username.value.trim().length > 20) {
    alert('用户名长度为2-20个字符')
    return
  }
  if (!isValidPhone(phone.value)) {
    alert('请输入正确的11位手机号')
    return
  }
  if (password.value.length < 6) { alert('密码至少6位'); return }
  if (password.value !== password2.value) { alert('两次密码不一致'); return }
  
  if (registrationCodeRequired.value && !registrationCode.value.trim()) {
    alert('请输入注册码')
    return
  }
  if (inviteRequired.value && !inviteCode.value.trim()) {
    alert('请输入推广邀请码')
    return
  }
  
  if (loading.value) return
  loading.value = true
  try {
    const res = await register(
      username.value.trim(), 
      password.value, 
      phone.value.trim(), 
      inviteCode.value.trim(),
      registrationCode.value.trim(),
      agreedPrivacy.value,
      agreedTerms.value
    )
    const data = res && res.data
    if (!data || !data.token || !data.user) {
      alert('注册失败：返回数据异常')
      return
    }
    // 清除sessionStorage中的同意状态
    sessionStorage.removeItem('register_agreed')
    setAuth(data.token, data.user)
    router.replace('/')
  } catch (e) {
    alert(e.message || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(180deg, #f8f1e7 0%, #f3efe9 38%, #eef3fb 100%);
}

.register-container {
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
  margin-bottom: 14px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #1e2940;
  font-weight: 600;
}

.optional-tag {
  color: #6e788c;
  font-size: 12px;
  font-weight: 400;
}

.required-tag {
  color: #f26a4d;
  font-size: 12px;
  font-weight: 400;
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

.link {
  margin-top: 18px;
  text-align: center;
  font-size: 14px;
  color: #6e788c;
}

.link a {
  color: #f26a4d;
  font-weight: 600;
  text-decoration: none;
}

.link a:hover {
  text-decoration: underline;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(30, 41, 64, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: #fff;
  border-radius: 24px;
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
  overflow: hidden;
}

.modal-header {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(31, 42, 65, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.modal-header h3 {
  font-size: 17px;
  font-weight: 700;
  color: #1e2940;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(31, 42, 65, 0.06);
  border-radius: 12px;
  font-size: 20px;
  color: #6e788c;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close:hover {
  background: rgba(31, 42, 65, 0.1);
}

.modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1;
}

.policy-text {
  font-size: 13px;
  color: #6e788c;
  line-height: 1.8;
}

.policy-text :deep(h1) {
  font-size: 15px;
  color: #1e2940;
  margin-bottom: 10px;
  margin-top: 0;
}

.policy-text :deep(h2) {
  font-size: 14px;
  color: #1e2940;
  margin-bottom: 8px;
  margin-top: 14px;
}

.policy-text :deep(p) {
  margin-bottom: 8px;
}

.policy-text :deep(ul) {
  padding-left: 18px;
  margin-bottom: 8px;
}

.policy-text :deep(li) {
  margin-bottom: 4px;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid rgba(31, 42, 65, 0.08);
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.btn-reject {
  flex: 1;
  height: 44px;
  border: 1px solid rgba(31, 42, 65, 0.12);
  background: #fff;
  border-radius: 14px;
  font-size: 14px;
  color: #6e788c;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reject:hover {
  background: rgba(31, 42, 65, 0.04);
}

.btn-agree {
  flex: 1;
  height: 44px;
  border: none;
  background: linear-gradient(135deg, #f26a4d 0%, #e55436 100%);
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-agree:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(242, 106, 77, 0.3);
}
</style>
