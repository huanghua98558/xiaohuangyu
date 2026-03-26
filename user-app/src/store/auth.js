import { ref, computed } from 'vue'

const TOKEN_KEY = 'xiaohuangyu_token'
const USER_KEY = 'xiaohuangyu_user'

const token = ref(localStorage.getItem(TOKEN_KEY) || '')
const user = ref(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))

export function useAuth() {
  const isLoggedIn = computed(() => !!token.value)
  const isAdminOrReviewer = computed(() => user.value && (user.value.role === 'admin' || user.value.role === 'reviewer'))
  const isAdmin = computed(() => user.value && user.value.role === 'admin')
  const isClient = computed(() => user.value && user.value.role === 'client')
  const isPartTimer = computed(() => user.value && user.value.role === 'part_timer')
  // 发布者权限：管理员、发布者、审核员都可以发布任务
  const isPublisher = computed(() => user.value && (user.value.role === 'admin' || user.value.role === 'client' || user.value.role === 'reviewer'))
  // 兼容旧代码：isAdminOrClient 现在也包含 reviewer
  const isAdminOrClient = computed(() => user.value && (user.value.role === 'admin' || user.value.role === 'client' || user.value.role === 'reviewer'))

  function setAuth(t, u) {
    token.value = t || ''
    user.value = u || null
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
    else localStorage.removeItem(USER_KEY)
  }

  function logout() {
    setAuth('', null)
  }

  function getToken() {
    return token.value
  }

  return { token, user, isLoggedIn, isAdminOrReviewer, isAdmin, isClient, isPartTimer, isPublisher, isAdminOrClient, setAuth, logout, getToken }
}
