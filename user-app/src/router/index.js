import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', component: () => import('../views/Login.vue'), meta: { title: '登录', showTabbar: false, guest: true } },
  { path: '/register', component: () => import('../views/Register.vue'), meta: { title: '注册', showTabbar: false, guest: true } },
  { path: '/', component: () => import('../views/Home.vue'), meta: { title: '首页' } },
  { path: '/rewards', component: () => import('../views/Rewards.vue'), meta: { title: '奖励机制' } },
  { path: '/tasks', component: () => import('../views/TaskList.vue'), meta: { title: '任务大厅' } },
  { path: '/task/:id', component: () => import('../views/TaskDetail.vue'), meta: { title: '任务详情', showTabbar: false, requiresAuth: true } },
  { path: '/my', component: () => import('../views/My.vue'), meta: { title: '我的', requiresAuth: true } },
  { path: '/tutorial', component: () => import('../views/Tutorial.vue'), meta: { title: '任务教学' } },
  { path: '/points', component: () => import('../views/Points.vue'), meta: { title: '积分中心', showTabbar: false, requiresAuth: true } },
  { path: '/invite', component: () => import('../views/Invite.vue'), meta: { title: '推广中心', requiresAuth: true } },
  // 体验官的"我的任务"页面（领取的任务）- 管理员也可以访问
  { path: '/my/tasks', component: () => import('../views/MyTasks.vue'), meta: { title: '我的任务', requiresAuth: true, requiresRole: ['part_timer', 'admin'] } },
  // 发布者/审核员的"任务管理"页面 - 管理员也可以访问（显示底部导航栏）
  { path: '/publisher/tasks', component: () => import('../views/PublisherTasks.vue'), meta: { title: '任务管理', requiresAuth: true, requiresRole: ['admin', 'client', 'reviewer'] } },
  { path: '/my/task/:claimId', component: () => import('../views/MyTaskDetail.vue'), meta: { title: '任务详情', showTabbar: false, requiresAuth: true } },
  { path: '/submit/:claimId', component: () => import('../views/SubmitTask.vue'), meta: { title: '提交任务', showTabbar: false, requiresAuth: true } },
  { path: '/withdraw', component: () => import('../views/Withdraw.vue'), meta: { title: '提现中心', showTabbar: false, requiresAuth: true } },
  { path: '/rank', component: () => import('../views/Rank.vue'), meta: { title: '排行榜', showTabbar: false, requiresAuth: true } },
  { path: '/notifications', component: () => import('../views/Notifications.vue'), meta: { title: '消息中心', showTabbar: false, requiresAuth: true } },
  { path: '/admin/notifications', component: () => import('../views/AdminNotifications.vue'), meta: { title: '管理员通知', showTabbar: false, requiresAuth: true, requiresRole: ['admin'] } },
  { path: '/admin/alerts', component: () => import('../views/AdminAlerts.vue'), meta: { title: '管理员告警', showTabbar: false, requiresAuth: true, requiresRole: ['admin'] } },
  { path: '/notification-settings', component: () => import('../views/NotificationSettings.vue'), meta: { title: '通知设置', requiresAuth: true } },
  { path: '/account-security', component: () => import('../views/AccountSecurity.vue'), meta: { title: '账户安全', showTabbar: false, requiresAuth: true } },
  { path: '/sign-in', component: () => import('../views/SignIn.vue'), meta: { title: '每日签到', requiresAuth: true } },
  { path: '/achievements', component: () => import('../views/Achievements.vue'), meta: { title: '我的成就', requiresAuth: true } },
  { path: '/admin/review', component: () => import('../views/AdminReview.vue'), meta: { title: '任务审核', showTabbar: false, requiresAuth: true, requiresRole: ['admin', 'reviewer'] } },
  // 发布任务（发布者、审核员、管理员可访问）
  { path: '/publish', component: () => import('../views/PublishTask.vue'), meta: { title: '发布任务', showTabbar: false, requiresAuth: true, requiresRole: ['admin', 'client', 'reviewer'] } },
  // 发布者查看领取详情
  { path: '/publisher/claim/:claimId', component: () => import('../views/PublisherClaimDetail.vue'), meta: { title: '领取详情', showTabbar: false, requiresAuth: true, requiresRole: ['admin', 'client', 'reviewer'] } },
  // AI助手（所有登录用户可访问，保留底部导航）
  { path: '/ai-assistant', component: () => import('../views/AIAssistant.vue'), meta: { title: 'AI助手', requiresAuth: true } },
  { path: '/agreement', component: () => import('../views/Agreement.vue'), meta: { title: '用户协议', showTabbar: false } },
  { path: '/privacy', component: () => import('../views/Privacy.vue'), meta: { title: '隐私政策', showTabbar: false } },
  { path: '/pwa-guide', component: () => import('../views/PWAGuide.vue'), meta: { title: '安装指南', showTabbar: false } },
  { path: '/task-rules', component: () => import('../views/TaskRules.vue'), meta: { title: '任务规范', showTabbar: false } },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 小黄鱼任务中心` : '小黄鱼任务中心'
  const token = localStorage.getItem('xiaohuangyu_token')
  const userStr = localStorage.getItem('xiaohuangyu_user')
  const user = userStr ? JSON.parse(userStr) : null

  if (to.meta.requiresAuth && !token) {
    next({ path: '/login', query: { from: to.fullPath } })
    return
  }
  
  // 角色权限检查
  if (to.meta.requiresRole && user) {
    // 如果用户角色不在允许的角色列表中，重定向到对应页面
    if (!to.meta.requiresRole.includes(user.role)) {
      // 对于需要发布者权限的页面，如果用户是体验官，重定向到首页
      if (to.path === '/publish' || to.path === '/publisher/tasks' || to.path.startsWith('/publisher/claim/')) {
        next({ path: '/' })
        return
      }
      // 对于体验官专属页面，如果用户是发布者/审核员（非管理员），重定向到任务管理页面
      // 管理员可以访问所有页面
      if (to.path === '/my/tasks' && ['client', 'reviewer'].includes(user.role)) {
        next({ path: '/publisher/tasks' })
        return
      }
      next({ path: '/' })
      return
    }
  }
  
  if (to.meta.guest && token) {
    next({ path: to.query.from || '/' })
    return
  }
  next()
})

export default router
