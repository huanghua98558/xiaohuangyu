<template>
  <div class="yx-page account-security-page">
    <header class="yx-header">
      <button type="button" class="yx-icon-btn" @click="router.back()" aria-label="返回">‹</button>
      <div class="yx-header-main">
        <h1 class="yx-title">账户安全</h1>
        <p class="yx-subtitle">修改手机号与登录密码</p>
      </div>
    </header>

    <section class="yx-card">
      <div class="yx-card-head-bar">
        <h3>手机号</h3>
      </div>
      <div class="field">
        <label>新手机号</label>
        <input v-model="phone" type="tel" maxlength="11" placeholder="11位手机号" />
      </div>
      <button type="button" class="yx-btn full" :disabled="phoneLoading" @click="savePhone">
        {{ phoneLoading ? '保存中…' : '保存手机号' }}
      </button>
    </section>

    <section class="yx-card" style="margin-top:14px;">
      <div class="yx-card-head-bar">
        <h3>登录密码</h3>
      </div>
      <div class="field">
        <label>当前密码</label>
        <input v-model="currentPassword" type="password" autocomplete="current-password" placeholder="请输入当前密码" />
      </div>
      <div class="field">
        <label>新密码</label>
        <input v-model="newPassword" type="password" autocomplete="new-password" placeholder="至少6位" />
      </div>
      <div class="field">
        <label>确认新密码</label>
        <input v-model="newPassword2" type="password" autocomplete="new-password" placeholder="再次输入新密码" />
      </div>
      <button type="button" class="yx-btn full" :disabled="pwdLoading" @click="savePassword">
        {{ pwdLoading ? '更新中…' : '更新密码' }}
      </button>
    </section>
  </div>
</template>

<script setup>
defineOptions({ name: 'AccountSecurity' })
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../store/auth'
import { getMe, updateUserProfile, changeUserPassword } from '../api/task'

const router = useRouter()
const { user, mergeUser } = useAuth()

const phone = ref('')
const phoneLoading = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const newPassword2 = ref('')
const pwdLoading = ref(false)

onMounted(async () => {
  phone.value = user.value?.phone || ''
  try {
    const me = await getMe()
    if (me?.phone) phone.value = me.phone
  } catch (_) {}
})

function validPhone(v) {
  return /^1[3-9]\d{9}$/.test(String(v).trim())
}

async function savePhone() {
  if (!validPhone(phone.value)) {
    alert('请输入正确的11位手机号')
    return
  }
  phoneLoading.value = true
  try {
    const { data } = await updateUserProfile({ phone: phone.value.trim() })
    if (data?.phone != null) mergeUser({ phone: data.phone })
    alert('手机号已更新')
  } catch (e) {
    alert(e.message || '保存失败')
  } finally {
    phoneLoading.value = false
  }
}

async function savePassword() {
  if (!currentPassword.value) {
    alert('请输入当前密码')
    return
  }
  if (!newPassword.value || newPassword.value.length < 6) {
    alert('新密码至少6位')
    return
  }
  if (newPassword.value !== newPassword2.value) {
    alert('两次新密码不一致')
    return
  }
  pwdLoading.value = true
  try {
    await changeUserPassword(currentPassword.value, newPassword.value)
    alert('密码已更新，请牢记新密码')
    currentPassword.value = ''
    newPassword.value = ''
    newPassword2.value = ''
  } catch (e) {
    alert(e.message || '修改失败')
  } finally {
    pwdLoading.value = false
  }
}
</script>

<style scoped>
.account-security-page .field {
  margin-bottom: 12px;
}
.account-security-page .field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--yx-text, #1e2940);
}
.account-security-page .field input {
  width: 100%;
  box-sizing: border-box;
  height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(31, 42, 65, 0.12);
  font-size: 15px;
}
</style>
