// 后端API地址配置
// v3.0 架构：管理后台独立服务模式
// basePath: /admin，客户端请求需要使用完整路径
const API_BASE = typeof window !== 'undefined' 
  ? '/admin/api'  // 客户端：使用完整路径，由 rewrite 规则代理到后端
  : '/api'  // 服务端：相对路径
const TOKEN_KEY = 'admin_token'
const USER_KEY = 'admin_user'

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface User {
  id: number
  username: string
  phone?: string
  role: string
}

export interface AuthResponse {
  user: User
  token: string
}

// 通用请求方法
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  // 客户端获取token
  let token: string | null = null
  if (typeof window !== 'undefined') {
    token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }
  }
  
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  })
  
  const json: ApiResponse<T> = await res.json()
  
  if (json.code !== 0) {
    // 401 未登录或token过期，清除认证信息并跳转登录页
    if (json.code === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      // 检查是否在登录页（支持 /admin 前缀和 trailingSlash）
      const pathname = window.location.pathname
      const isLoginPage = pathname === '/login' || pathname === '/login/' || 
                          pathname === '/admin/login' || pathname === '/admin/login/'
      if (!isLoginPage) {
        // 根据 basePath 决定跳转路径
        const loginPath = pathname.startsWith('/admin') ? '/admin/login/' : '/login/'
        window.location.href = loginPath
      }
    }
    throw new Error(json.message || '请求失败')
  }
  
  return json.data
}

// ==================== 曝光配置 ====================

export interface ExposureConfig {
  initialCoefficient: number
  initialMinExtra: number
  initialMaxExtra: number
  maxCoefficient: number
  checkIntervalMinutes: number
  addRatioHigh: number
  addRatioMid: number
  addRatioLow: number
  rateThresholdHigh: number
  rateThresholdMid: number
  rateThresholdLow: number
  exposureMode: 'parallel' | 'sequential' | 'priority'
  sequentialThreshold: number
  exposureWindow: number
  // V2.0 新增字段
  cityExposureLimit?: number
  reservedExposureQuota?: number
  heartbeatTimeout?: number
  offlineBufferTime?: number
  exposureAllocationInterval?: number
  priorityMode?: {
    whitelistBonus: number
    blacklistPenalty: number
    activityWeight: number
    speedWeight: number
    completionWeight: number
  }
}

export interface ExposureQueueItem {
  taskId: number
  queuePosition: number
  unlocked: boolean
  unlockedAt: string | null
  needCount: number
  acceptedCount: number
  completionRate: number
  currentExposure: number
  maxExposure: number
  exposureRate: number
  status: string
  task: {
    id: number
    title: string
    platform: string
    action: string
    reward: number
    remain: number
    created_at: string
  }
}

export interface ExposureQueueResponse {
  exposureMode: string
  sequentialThreshold: number
  exposureWindow: number
  queue: ExposureQueueItem[]
}

export async function getExposureConfig(): Promise<ExposureConfig> {
  return request<ExposureConfig>('/exposure/config')
}

export async function updateExposureConfig(config: Partial<ExposureConfig>): Promise<ExposureConfig> {
  return request<ExposureConfig>('/exposure/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export async function getExposureQueue(): Promise<ExposureQueueResponse> {
  return request<ExposureQueueResponse>('/exposure/queue')
}

export async function unlockTaskExposure(taskId: number): Promise<{ taskId: number; unlocked: boolean }> {
  return request(`/exposure/tasks/${taskId}/unlock`, {
    method: 'POST',
  })
}

// ==================== V2.0 曝光系统管理API ====================

export interface ExposureQuotaStats {
  currentQuota: number
  maxQuota: number
  usedQuota: number
  pendingRelease: number
  totalEarned: number
  totalConsumed: number
  lastUpdated: string
}

export interface SupplyDemandStats {
  totalOnlineUsers: number
  availableUsers: number
  totalPendingTasks: number
  supplyDemandRatio: number
  avgSelectionScore: number
  onlineByLevel: Record<number, number>
  tasksByStatus: Record<string, number>
}

export interface OnlineUserStats {
  total: number
  byLevel: Record<number, number>
  byCity: Record<string, number>
  byProvince: Record<string, number>
  peakToday: number
  peakTime: string | null
  avgOnlineTime: number
}

export interface OnlineUserSnapshot {
  total: number
  users: OnlineUserInfo[]
}

export interface OnlineUserInfo {
  userId: number
  username: string
  level: number
  city: string
  province: string
  exposureQuota: number
  currentTaskId: number | null
  onlineDuration: number
  lastHeartbeat: string
  deviceId: string | null
}

export interface CityLimitConfig {
  limit: number
  updatedAt: string
}

export interface UserExposureDetail {
  stats: ExposureQuotaStats
  onlineInfo: {
    isOnline: boolean
    onlineDuration: number | null
    currentCity: string | null
    currentTaskId: number | null
    lastHeartbeat: string | null
  }
}

export interface TaskExposureDetail {
  taskId: number
  title: string
  status: string
  needCount: number
  acceptedCount: number
  currentExposure: number
  maxExposure: number
  exposureRate: number
  dynamicCapacity: number
  eligibleUsers: number
  onlineUsers: number
}

export interface TaskDynamicCapacity {
  taskId: number
  baseCapacity: number
  qualityBonus: number
  completionBonus: number
  finalCapacity: number
  eligibleUsers: number
  onlineUsers: number
}

// 获取供需统计
export async function getSupplyDemandStats(): Promise<SupplyDemandStats> {
  return request('/exposure/supply-demand')
}

// 获取在线用户统计
export async function getOnlineUserStats(): Promise<OnlineUserStats> {
  return request('/exposure/online-stats')
}

// 获取在线用户快照
export async function getOnlineUserSnapshot(): Promise<OnlineUserSnapshot> {
  return request('/exposure/online-snapshot')
}

// 趋势数据点类型
export interface TrendDataPoint {
  time: string
  hour: number
  date: string
  onlineUsers: number
  claims: number
  exposures: number
}

// 获取24小时趋势数据
export async function getExposureTrend(): Promise<TrendDataPoint[]> {
  return request('/exposure/trend')
}

// 更新城市曝光限制
export async function updateCityExposureLimit(limit: number): Promise<CityLimitConfig> {
  return request('/exposure/city-limit', {
    method: 'PUT',
    body: JSON.stringify({ limit }),
  })
}

// 获取用户曝光详情
export async function getUserExposureDetail(userId: number): Promise<UserExposureDetail> {
  return request(`/exposure/user/${userId}`)
}

// 获取任务曝光详情
export async function getTaskExposureDetail(taskId: number): Promise<TaskExposureDetail> {
  return request(`/exposure/task/${taskId}`)
}

// 获取任务动态容量
export async function getTaskDynamicCapacity(taskId: number): Promise<TaskDynamicCapacity> {
  return request(`/exposure/task/${taskId}/capacity`)
}

// 刷新统计
export async function refreshExposureStats(): Promise<{ message: string }> {
  return request('/exposure/refresh-stats', {
    method: 'POST',
  })
}

// 触发曝光检查
export async function triggerExposureCheck(): Promise<{ message: string }> {
  return request('/exposure/trigger/check', {
    method: 'POST',
  })
}

// 触发离线缓冲检查
export async function triggerOfflineBufferCheck(): Promise<{ message: string }> {
  return request('/exposure/trigger/offline-buffer', {
    method: 'POST',
  })
}

// 触发质量评分计算
export async function triggerQualityScoreCalculation(): Promise<{ message: string }> {
  return request('/exposure/trigger/quality-score', {
    method: 'POST',
  })
}

// 初始化现有任务曝光记录
export async function initExistingTasksExposure(): Promise<{ count: number; message: string }> {
  return request('/exposure/init-existing-tasks', {
    method: 'POST',
  })
}

// ==================== 认证相关 ====================

export async function login(username: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  
  // 保存token
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  }
  
  return data
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const userStr = localStorage.getItem(USER_KEY)
  return userStr ? JSON.parse(userStr) : null
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}

// ==================== 统计相关 ====================

export interface DashboardStats {
  // 今日核心数据
  todayPublishedTasks: number
  todayPublishedTasksChange: { change: number; trend3d: number[] }
  todayTaskAmount: number
  todayTaskAmountChange: { change: number; trend3d: number[] }
  todayClaims: number
  todayClaimsChange: { change: number; trend3d: number[] }
  todayCompletedClaims: number
  todayCompletedClaimsChange: { change: number; trend3d: number[] }
  // 运营指标
  onlineUsers: number | null  // null表示Redis未启用
  pendingClaims: number
  todayCompletedTasks: number
  todayCompletedTasksChange: { change: number; trend3d: number[] }
  // 积分数据
  todayPointsIssued: number
  todayPointsIssuedChange: { change: number; trend3d: number[] }
  todaySignIns: number
  todaySignInsChange: { change: number; trend3d: number[] }
  todayPointsByType: {
    sign_in: number
    task: number
    promotion_c: number
    reward: number
    bonus: number
    achievement: number
  }
  // 积分奖励中心统计
  weekPointsIssued: number
  weekPointsDeduct: number
  monthPointsIssued: number
  monthPointsDeduct: number
  totalSignIns: number
  weekSignIns: number
  // 累计数据
  totalUsers: number
  totalTasks: number
  totalCompletedClaims: number
  totalPointsIssued: number
  totalClaims: number
}

export async function getStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/admin-v2/stats')
}

// 获取趋势数据
export interface TrendDataPoint {
  date: string
  claims: number
  completions: number
  pointsIssued: number
}

export async function getTrendData(days: number = 7): Promise<TrendDataPoint[]> {
  return request<TrendDataPoint[]>(`/admin-v2/stats/trend?days=${days}`)
}

// ==================== 用户管理 ====================

export interface UserListItem {
  id: number
  username: string
  phone: string | null
  role: string
  level: number
  points: number
  balance: number
  totalTasks: number
  totalPoints: number
  status: number
  createdAt: string
  city?: string | null
  province?: string | null
  isWhitelist?: boolean
  isBlacklist?: boolean
  exposureLevel?: number
  isOnline?: boolean  // 用户在线状态
}

export interface UserListResponse {
  list: UserListItem[]
  total: number
  page: number
  size: number
}

export async function getUsers(params: {
  page?: number
  size?: number
  role?: string
  level?: number
  search?: string
  isOnline?: boolean
}): Promise<UserListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.role) query.set('role', params.role)
  if (params.level) query.set('level', String(params.level))
  if (params.search) query.set('search', params.search)
  if (params.isOnline !== undefined) query.set('isOnline', String(params.isOnline))
  
  return request<UserListResponse>(`/admin-v2/users?${query.toString()}`)
}

export async function updateUserStatus(userId: number, status: boolean): Promise<UserListItem> {
  return request<UserListItem>(`/admin-v2/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export async function updateUserLevel(userId: number, level: number): Promise<UserListItem> {
  return request<UserListItem>(`/admin-v2/users/${userId}/level`, {
    method: 'PUT',
    body: JSON.stringify({ level }),
  })
}

export async function updateUserRole(userId: number, role: string): Promise<UserListItem> {
  return request<UserListItem>(`/admin-v2/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  })
}

export interface PointsUpdateResult {
  id: number
  username: string
  oldPoints: number
  newPoints: number
  change: number
}

export interface BalanceUpdateResult {
  id: number
  username: string
  oldBalance: number
  newBalance: number
  change: number
}

// 调整用户积分（amount为变化量，正数增加，负数减少）
export async function updateUserPoints(userId: number, amount: number, reason?: string): Promise<PointsUpdateResult> {
  return request<PointsUpdateResult>(`/admin-v2/users/${userId}/points`, {
    method: 'PUT',
    body: JSON.stringify({ amount, reason }),
  })
}

// 调整用户余额（amount为变化量，正数增加，负数减少）
export async function updateUserBalance(userId: number, amount: number, reason?: string): Promise<BalanceUpdateResult> {
  return request<BalanceUpdateResult>(`/admin-v2/users/${userId}/balance`, {
    method: 'PUT',
    body: JSON.stringify({ amount, reason }),
  })
}

// 更新用户信息
export async function updateUserInfo(userId: number, data: {
  username?: string
  phone?: string
  province?: string
  city?: string
}): Promise<UserListItem> {
  return request<UserListItem>(`/admin-v2/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// 修改用户密码
export async function updateUserPassword(userId: number, password: string): Promise<UserListItem> {
  return request<UserListItem>(`/admin-v2/users/${userId}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  })
}

// ==================== 角色管理 ====================

export interface Role {
  id: number
  code: string
  name: string
  roleType: string
  canBPromotion: boolean
  description: string
  permissions: string
}

export async function getRoles(): Promise<Role[]> {
  return request<Role[]>('/admin-v2/roles')
}

// ==================== 系统配置 ====================

export interface SystemConfig {
  key: string
  value: string
  description: string | null
}

export async function getSystemConfigs(): Promise<SystemConfig[]> {
  return request<SystemConfig[]>('/admin-v2/configs')
}

export async function updateSystemConfig(key: string, value: string): Promise<SystemConfig> {
  return request<SystemConfig>(`/admin-v2/configs/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
}

// ==================== 任务管理 ====================

export interface Task {
  id: string
  title: string
  taskCode: string | null
  platform: string
  action: string
  videoUrl: string | null
  description: string
  templateImages: string
  exampleImages: string[]
  requirements: string
  reward: number
  remain: number
  timeLimitMinutes: number
  cityLimit: number
  provinceLimit: number
  status: string
  createdAt: string
}

export interface TaskListResponse {
  list: Task[]
  total: number
  page: number
  size: number
}

export async function getTasks(params: {
  page?: number
  size?: number
  status?: string
  platform?: string
}): Promise<TaskListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.status) query.set('status', params.status)
  if (params.platform) query.set('platform', params.platform)
  
  return request<TaskListResponse>(`/admin-v2/tasks?${query.toString()}`)
}

export async function createTask(data: Partial<Task>): Promise<Task> {
  return request<Task>('/admin-v2/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTask(id: string | number, data: Partial<Task>): Promise<Task> {
  return request<Task>(`/admin-v2/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteTask(id: string | number): Promise<void> {
  return request<void>(`/admin-v2/tasks/${id}`, {
    method: 'DELETE',
  })
}

// 任务统计概览
export interface TasksOverview {
  totalTasks: number
  activeTasks: number
  inactiveTasks: number
  totalClaims: number
  uniqueClaimUsers: number
  totalSubmitted: number
  totalCompleted: number
  totalPending: number
}

export async function getTasksOverview(params?: {
  startDate?: string
  endDate?: string
  status?: string
  platform?: string
  completionStatus?: string
}): Promise<TasksOverview> {
  const query = new URLSearchParams()
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  if (params?.status) query.set('status', params.status)
  if (params?.platform) query.set('platform', params.platform)
  if (params?.completionStatus) query.set('completionStatus', params.completionStatus)
  const queryString = query.toString()
  return request<TasksOverview>(`/admin-v2/tasks/overview${queryString ? '?' + queryString : ''}`)
}

// 今日统计数据
export interface TodayStats {
  todayPublishedTasks: number    // 今日已发布任务数
  todayTotalAmount: number       // 今日任务总量
  todayCompleted: number         // 今日已完成数量
  remainTotal: number            // 剩余任务总量
  todayClaims: number            // 今日领取数量
  todayCompletedFromTodayTasks: number // 今日任务已完成数
}

export async function getTodayStats(): Promise<TodayStats> {
  return request<TodayStats>('/admin-v2/tasks/today-stats')
}

// 带统计的任务项
export interface TaskWithStats extends Task {
  stats: {
    totalClaims: number
    submittedCount: number
    pendingCount: number
    doneCount: number
    rejectedCount: number
    expiredCount: number
    doingCount: number
    completedRate: number
  }
}

export interface TaskWithStatsListResponse {
  list: TaskWithStats[]
  total: number
  page: number
  size: number
}

export async function getTasksWithStats(params: {
  page?: number
  size?: number
  status?: string
  platform?: string
  sortField?: string
  sortOrder?: string
  completionStatus?: string
  startDate?: string
  endDate?: string
}): Promise<TaskWithStatsListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.status) query.set('status', params.status)
  if (params.platform) query.set('platform', params.platform)
  if (params.sortField) query.set('sortField', params.sortField)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  if (params.completionStatus) query.set('completionStatus', params.completionStatus)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  
  return request<TaskWithStatsListResponse>(`/admin-v2/tasks/with-stats?${query.toString()}`)
}

// 单个任务详细统计
export interface TaskDetailStats {
  task: Task
  stats: {
    totalClaims: number
    uniqueUsers: number
    submittedCount: number
    pendingCount: number
    doneCount: number
    rejectedCount: number
    expiredCount: number
    doingCount: number
    completedRate: number
    submittedRate: number
  }
}

export async function getTaskStats(taskId: string | number): Promise<TaskDetailStats> {
  return request<TaskDetailStats>(`/admin-v2/tasks/${taskId}/stats`)
}

// 获取任务的领取列表
export interface TaskClaimItem {
  id: number
  userId: number
  username: string
  phone: string
  status: string
  reward: number
  city: string | null
  province: string | null
  claimedAt: string
  submittedAt: string | null
  expiresAt: string
  reviewedAt: string | null
  reviewNote: string | null
  // 图片审核字段
  image_review_status?: string
  image_reviewed_at?: string | null
  image_review_reason?: string | null
  // 链接审查字段
  link_review_status?: string
  link_reviewed_at?: string | null
  link_review_reason?: string | null
  isExpired: boolean
  timeSpent: number | null // 分钟
}

export interface TaskClaimsResponse {
  list: TaskClaimItem[]
  total: number
  page: number
  size: number
  taskTitle: string
}

// 获取任务的领取列表（用于任务详情页）
export async function getTaskClaimsList(taskId: string | number, params?: {
  page?: number
  size?: number
  status?: string
}): Promise<TaskClaimsResponse> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.size) query.set('size', String(params.size))
  if (params?.status) query.set('status', params.status)
  
  return request<TaskClaimsResponse>(`/admin-v2/tasks/${taskId}/claims?${query.toString()}`)
}

// 强制释放任务名额
export async function forceReleaseClaim(claimId: number, note?: string): Promise<{
  success: boolean
  message: string
  taskId: number
  userId: number
}> {
  return request(`/admin-v2/claims/${claimId}/force-release`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

// ==================== 审核管理 ====================

export interface ClaimItem {
  id: number
  userId: number
  taskId: number
  title: string
  platform: string
  action: string
  reward: number
  status: string
  city: string | null
  province: string | null
  platformNickname: string | null
  screenshots: string           // JSON 字符串，存储对象存储 key
  screenshotUrls?: string[]     // 签名 URL 数组，用于显示图片
  claimedAt: string
  submittedAt: string | null
  reviewedAt: string | null
  reviewerId: number | null
  reviewNote: string | null
  // 图片审核字段
  image_review_status?: string
  image_reviewed_at?: string | null
  image_review_reason?: string | null
  // 链接审查字段
  link_review_status?: string
  link_reviewed_at?: string | null
  link_review_reason?: string | null
  user?: { id: number; username: string }
}

export interface ClaimListResponse {
  list: ClaimItem[]
  total: number
  page: number
  size: number
}

export async function getPendingClaims(params: {
  page?: number
  size?: number
}): Promise<ClaimListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  
  return request<ClaimListResponse>(`/admin-v2/review/all?${query.toString()}`)
}

export async function reviewClaim(claimId: number, action: 'approve' | 'reject', note?: string): Promise<{ message: string }> {
  return request(`/publisher/review/${claimId}`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  })
}

// ==================== 等级配置 ====================

export interface LevelConfig {
  level: number
  name: string
  coefficient: number
  minTasks: number
  minPoints: number
  minPassRate: number
  concurrentTasks: number
  prioritySupport: boolean
  icon: string
  isEnabled: boolean
  // V2.0 曝光系统新增字段
  exposureLimit?: number
  regularExposureQuota?: number
  levelWeight?: number
}

export async function getLevelConfigs(): Promise<LevelConfig[]> {
  return request<LevelConfig[]>('/level/configs')
}

export async function updateLevelConfig(level: number, data: Partial<LevelConfig>): Promise<LevelConfig> {
  return request<LevelConfig>(`/level/configs/${level}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ==================== 排行榜快照 ====================

export interface LeaderboardSnapshot {
  id: number
  type: 'weekly' | 'monthly'
  periodKey: string
  startDate: string
  endDate: string
  totalParticipants: number
  createdAt: string
}

export interface SnapshotListResponse {
  list: LeaderboardSnapshot[]
  total: number
  page: number
  size: number
}

export async function getSnapshots(params: {
  type?: 'weekly' | 'monthly'
  page?: number
  size?: number
}): Promise<SnapshotListResponse> {
  const query = new URLSearchParams()
  if (params.type) query.set('type', params.type)
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  
  return request<SnapshotListResponse>(`/leaderboard/snapshots?${query.toString()}`)
}

export async function triggerWeeklySnapshot(): Promise<LeaderboardSnapshot> {
  return request<LeaderboardSnapshot>('/leaderboard/snapshots/trigger/weekly', {
    method: 'POST',
  })
}

export async function triggerMonthlySnapshot(): Promise<LeaderboardSnapshot> {
  return request<LeaderboardSnapshot>('/leaderboard/snapshots/trigger/monthly', {
    method: 'POST',
  })
}

// ==================== 提现审核 ====================

export interface WithdrawalItem {
  id: number
  userId: number
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  wechatInfo: string | null
  reviewerId: number | null
  reviewNote: string | null
  // 图片审核字段
  image_review_status?: string
  image_reviewed_at?: string | null
  image_review_reason?: string | null
  // 链接审查字段
  link_review_status?: string
  link_reviewed_at?: string | null
  link_review_reason?: string | null
  reviewedAt: string | null
  paidAt: string | null
  createdAt: string
  user?: {
    id: number
    username: string
    phone: string | null
  }
}

export interface WithdrawalListResponse {
  list: WithdrawalItem[]
  total: number
  page: number
  size: number
}

export async function getPendingWithdrawals(params: {
  page?: number
  size?: number
}): Promise<WithdrawalListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  
  return request<WithdrawalListResponse>(`/wallet/admin/pending?${query.toString()}`)
}

export async function processWithdrawal(
  withdrawalId: number,
  action: 'approve' | 'reject' | 'manual' | 'paid',
  note?: string
): Promise<{ message: string }> {
  return request(`/wallet/admin/withdrawal/${withdrawalId}`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  })
}

// ==================== 审核管理增强 ====================

// 任务审核统计
export interface TaskReviewStats {
  pendingCount: number
  todayReviewedCount: number
  todayPointsIssued: number
  tasksWithPendingCount: number
}

export async function getTaskReviewStats(): Promise<TaskReviewStats> {
  return request<TaskReviewStats>('/admin-v2/review/stats')
}

// 按任务分组的待审核列表
export interface TaskWithPending {
  task: Task
  stats: {
    total: number
    pending: number
    done: number
    rejected: number
  }
}

export interface GroupedReviewResponse {
  list: TaskWithPending[]
  total: number
  page: number
  size: number
}

export async function getPendingReviewGrouped(params: {
  page?: number
  size?: number
}): Promise<GroupedReviewResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  
  return request<GroupedReviewResponse>(`/admin-v2/review/grouped?${query.toString()}`)
}

// 获取某个任务的所有提交
export async function getTaskClaims(taskId: number, params: {
  page?: number
  size?: number
  status?: string
}): Promise<ClaimListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.status) query.set('status', params.status)
  
  return request<ClaimListResponse>(`/admin-v2/review/task/${taskId}/claims?${query.toString()}`)
}

// 获取所有审核记录（支持按状态筛选）
export interface ReviewClaimItem extends ClaimItem {
  task?: {
    id: number
    title: string
    platform: string
    action: string
  }
}

export interface ReviewClaimListResponse {
  list: ReviewClaimItem[]
  total: number
  page: number
  size: number
}

export async function getAllReviewClaims(params: {
  page?: number
  size?: number
  status?: string
  taskId?: number
}): Promise<ReviewClaimListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.status) query.set('status', params.status)
  if (params.taskId) query.set('taskId', String(params.taskId))
  
  return request<ReviewClaimListResponse>(`/admin-v2/review/all?${query.toString()}`)
}

// 批量审核通过
export interface BatchApproveResult {
  message: string
  approvedCount: number
  errors?: Array<{ claimId: number; error: string }>
}

export async function batchApproveTask(taskId: number, note?: string): Promise<BatchApproveResult> {
  return request<BatchApproveResult>(`/admin-v2/review/task/${taskId}/batch-approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

// 审核记录
export interface ReviewLog {
  id: number
  claimId: number
  taskId: number
  reviewerId: number
  reviewerName: string
  action: 'approve' | 'reject' | 'manual'
  note: string | null
  createdAt: string
}

export async function getClaimReviewLogs(claimId: number): Promise<ReviewLog[]> {
  return request<ReviewLog[]>(`/admin-v2/review/claim/${claimId}/logs`)
}

// 获取单个提交详情
export interface ClaimDetail {
  id: number
  taskId: number
  userId: number
  status: string
  platform: string
  platformNickname: string | null
  reward: number
  screenshotUrls: string[]
  province: string | null
  city: string | null
  claimedAt: string
  submittedAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
  // 图片审核字段
  image_review_status?: string
  image_reviewed_at?: string | null
  image_review_reason?: string | null
  // 链接审查字段
  link_review_status?: string
  link_reviewed_at?: string | null
  link_review_reason?: string | null
  // 封控状态字段
  block_status?: string
  // 审核历史字段
  reject_count?: number
  review_history?: Array<{ action: string; data: any; timestamp: string }> | null
  createdAt: string
  user: {
    id: number
    username: string
    phone: string | null
  } | null
  task: {
    id: number
    title: string
    platform: string
    action: string
  } | null
}

export async function getClaimById(claimId: number): Promise<ClaimDetail> {
  return request<ClaimDetail>(`/admin-v2/review/claim/${claimId}`)
}

// 审核记录列表
export interface ReviewLogItem {
  id: number | string
  claimId: number
  taskId: number
  taskCode: string | null
  taskTitle: string
  reviewerId: number
  reviewerName: string
  userId: number
  userName: string
  action: 'approve' | 'reject' | 'manual'
  note: string | null
  createdAt: string
  reviewedAt: string | null
  isAiReview?: boolean
  aiConfidence?: number
  status: string
  // 审核历史字段
  image_review_status?: string
  image_review_reason?: string
  link_review_status?: string
  link_review_reason?: string
  reject_count?: number
  review_history?: Array<{ action: string; data: any; timestamp: string }>
  screenshots?: string
}

export interface ReviewLogListResponse {
  list: ReviewLogItem[]
  total: number
  page: number
  size: number
}

export async function getTaskReviewLogs(params: {
  page?: number
  size?: number
  taskId?: number
  claimId?: number
  reviewerId?: number
  action?: string
}): Promise<ReviewLogListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.taskId) query.set('taskId', String(params.taskId))
  if (params.claimId) query.set('claimId', String(params.claimId))
  if (params.reviewerId) query.set('reviewerId', String(params.reviewerId))
  if (params.action) query.set('action', params.action)
  
  return request<ReviewLogListResponse>(`/admin-v2/review/logs?${query.toString()}`)
}

// ==================== 提现管理增强 ====================

// 提现统计
export interface WithdrawalStats {
  pendingCount: number
  approvedCount: number
  paidCount: number
  paidAmount: number
  rejectedCount: number
  rejectedAmount: number
}

export async function getWithdrawalStats(): Promise<WithdrawalStats> {
  return request<WithdrawalStats>('/admin-v2/withdrawal/stats')
}

// 获取所有提现记录（支持筛选）
export async function getAllWithdrawals(params: {
  page?: number
  size?: number
  status?: string
  startDate?: string
  endDate?: string
}): Promise<WithdrawalListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.status) query.set('status', params.status)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  
  return request<WithdrawalListResponse>(`/admin-v2/withdrawal/list?${query.toString()}`)
}

// 提现审核记录
export interface WithdrawalReviewLog {
  id: number
  withdrawalId: number
  reviewerId: number
  reviewerName: string
  action: 'approve' | 'reject' | 'paid'
  note: string | null
  createdAt: string
}

export async function getWithdrawalReviewLogs(withdrawalId: number): Promise<WithdrawalReviewLog[]> {
  return request<WithdrawalReviewLog[]>(`/admin-v2/withdrawal/${withdrawalId}/logs`)
}

// ==================== 用户详情 ====================

export interface UserDetail {
  user: {
    id: number
    username: string
    phone: string | null
    avatar: string | null
    role: string
    level: number
    points: number
    balance: number
    totalTasks: number
    totalPoints: number
    status: number
    createdAt: string
    lastLoginAt: string | null
  }
  taskStats: {
    total: number
    pending: number
    done: number
    rejected: number
  }
  pointsLogs: Array<{
    id: number
    old_points: number
    new_points: number
    change: number
    type: string
    description: string
    created_at: string
  }>
  balanceLogs: Array<{
    id: number
    old_balance: number
    new_balance: number
    change: number
    type: string
    description: string
    created_at: string
  }>
  signInStats: {
    total: number
    records: Array<{
      sign_date: string
      points_earned: number
      continuous_days: number
    }>
  }
  achievements: Array<{
    achieved_at: string
    achievements: {
      id: number
      code: string
      name: string
      description: string
      icon: string
    }
  }>
  withdrawals: Array<{
    id: number
    amount: number
    status: string
    created_at: string
  }>
}

export async function getUserDetail(userId: number): Promise<UserDetail> {
  return request<UserDetail>(`/admin-v2/users/${userId}`)
}

export interface UserTaskItem {
  id: number
  task_id: number
  status: string
  claimed_at: string
  submitted_at: string | null
  reviewed_at: string | null
  tasks: {
    id: number
    title: string
    platform: string
    action: string
    reward: number
  }
}

export async function getUserTasks(userId: number, params: {
  page?: number
  size?: number
  status?: string
}): Promise<{ list: UserTaskItem[]; total: number; page: number; size: number }> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.status) query.set('status', params.status)
  
  return request(`/admin-v2/users/${userId}/tasks?${query.toString()}`)
}

export async function getUserPointsLogs(userId: number, params: {
  page?: number
  size?: number
}): Promise<{ list: unknown[]; total: number; page: number; size: number }> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  
  return request(`/admin-v2/users/${userId}/points-logs?${query.toString()}`)
}

export async function getUserBalanceLogs(userId: number, params: {
  page?: number
  size?: number
}): Promise<{ list: unknown[]; total: number; page: number; size: number }> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  
  return request(`/admin-v2/users/${userId}/balance-logs?${query.toString()}`)
}

export async function getUserActivity(userId: number, days?: number): Promise<{
  dailyTasks: Record<string, number>
  signIns: unknown[]
  period: number
}> {
  const query = new URLSearchParams()
  if (days) query.set('days', String(days))
  
  return request(`/admin-v2/users/${userId}/activity?${query.toString()}`)
}

// 批量操作
export async function batchUpdateUsers(userIds: number[], updates: {
  level?: number
  status?: boolean
  role?: string
}): Promise<UserListItem[]> {
  return request<UserListItem[]>('/admin-v2/users/batch-update', {
    method: 'POST',
    body: JSON.stringify({ userIds, updates }),
  })
}

export async function batchGrantPoints(userIds: number[], amount: number, reason?: string): Promise<Array<{
  userId: number
  success: boolean
  error?: string
}>> {
  return request('/admin-v2/users/batch-grant-points', {
    method: 'POST',
    body: JSON.stringify({ userIds, amount, reason }),
  })
}

// ==================== 操作日志 ====================

export interface OperationLog {
  id: number
  admin_id: number
  admin_name: string
  action: string
  target_type: string
  target_id: number | null
  target_name: string | null
  old_value: unknown
  new_value: unknown
  description: string | null
  ip_address: string | null
  created_at: string
}

export async function getOperationLogs(params: {
  page?: number
  size?: number
  adminId?: number
  action?: string
  targetType?: string
  startDate?: string
  endDate?: string
}): Promise<{ list: OperationLog[]; total: number; page: number; size: number }> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.adminId) query.set('adminId', String(params.adminId))
  if (params.action) query.set('action', params.action)
  if (params.targetType) query.set('targetType', params.targetType)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  
  return request(`/admin-v2/operation-logs?${query.toString()}`)
}

export async function getTargetLogs(targetType: string, targetId: number, params?: {
  page?: number
  size?: number
}): Promise<{ list: OperationLog[]; total: number; page: number; size: number }> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.size) query.set('size', String(params.size))
  
  return request(`/admin-v2/operation-logs/${targetType}/${targetId}?${query.toString()}`)
}

export async function getOperationStats(days?: number): Promise<Record<string, number>> {
  const query = new URLSearchParams()
  if (days) query.set('days', String(days))
  
  return request(`/admin-v2/operation-logs/stats?${query.toString()}`)
}

// ==================== 任务模板 ====================

export interface TaskTemplate {
  id: number
  name: string
  description: string | null
  platform: string
  action: string
  reward: number
  time_limit_minutes: number
  city_limit: number
  province_limit: number
  template_images: string[]
  requirements: unknown[]
  use_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getTaskTemplates(params: {
  page?: number
  size?: number
  platform?: string
}): Promise<{ list: TaskTemplate[]; total: number; page: number; size: number }> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.platform) query.set('platform', params.platform)
  
  return request(`/admin-v2/templates?${query.toString()}`)
}

export async function getTaskTemplate(templateId: number): Promise<TaskTemplate> {
  return request(`/admin-v2/templates/${templateId}`)
}

export async function createTaskTemplate(data: Partial<TaskTemplate>): Promise<TaskTemplate> {
  return request('/admin-v2/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTaskTemplate(templateId: number, data: Partial<TaskTemplate>): Promise<TaskTemplate> {
  return request(`/admin-v2/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteTaskTemplate(templateId: number): Promise<void> {
  return request(`/admin-v2/templates/${templateId}`, {
    method: 'DELETE',
  })
}

export async function useTemplateToCreateTask(templateId: number, overrides?: Partial<Task>): Promise<Task> {
  return request(`/admin-v2/templates/${templateId}/use`, {
    method: 'POST',
    body: JSON.stringify(overrides || {}),
  })
}

export async function getHotTemplates(limit?: number): Promise<TaskTemplate[]> {
  const query = new URLSearchParams()
  if (limit) query.set('limit', String(limit))
  
  return request(`/admin-v2/templates/hot?${query.toString()}`)
}

// ==================== 消息通知（管理员端） ====================

export async function sendAnnouncement(title: string, content: string, userIds?: number[]): Promise<void> {
  return request('/notifications/announcement', {
    method: 'POST',
    body: JSON.stringify({ title, content, userIds }),
  })
}

// ==================== 数据导出 ====================

export interface ExportParams {
  role?: string
  level?: number
  status?: string
  platform?: string
  startDate?: string
  endDate?: string
}

export async function exportUsers(params?: ExportParams): Promise<void> {
  const query = new URLSearchParams()
  if (params?.role) query.set('role', params.role)
  if (params?.level) query.set('level', String(params.level))
  if (params?.status) query.set('status', params.status)
  
  const response = await fetch(`${API_BASE}/admin-v2/export/users?${query.toString()}`, {
    headers: {
      'Authorization': `Bearer ${getStoredToken()}`
    }
  })
  
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `users_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  window.URL.revokeObjectURL(url)
}

export async function exportTasks(params?: ExportParams): Promise<void> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.platform) query.set('platform', params.platform)
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  
  const response = await fetch(`${API_BASE}/admin-v2/export/tasks?${query.toString()}`, {
    headers: {
      'Authorization': `Bearer ${getStoredToken()}`
    }
  })
  
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `tasks_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  window.URL.revokeObjectURL(url)
}

export async function exportReviews(params?: ExportParams): Promise<void> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  
  const response = await fetch(`${API_BASE}/admin-v2/export/reviews?${query.toString()}`, {
    headers: {
      'Authorization': `Bearer ${getStoredToken()}`
    }
  })
  
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `reviews_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  window.URL.revokeObjectURL(url)
}

// ==================== 图片上传 ====================

export interface UploadResponse {
  key: string
  url: string
}

export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('image', file)
  
  const response = await fetch(`${API_BASE}/upload/example-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getStoredToken()}`
    },
    body: formData
  })
  
  const json = await response.json()
  
  if (json.code !== 0) {
    throw new Error(json.message || '上传失败')
  }
  
  return json.data
}

// ==================== 用户曝光管理 ====================

// 白名单用户
export interface WhitelistUser {
  id: number
  username: string
  phone: string | null
  exposure_level: number
  exposure_priority: number
  total_tasks: number
  total_approved_tasks: number
  created_at: string
}

// 黑名单用户
export interface BlacklistUser {
  id: number
  username: string
  phone: string | null
  exposure_level: number
  exposure_priority: number
  total_tasks: number
  total_approved_tasks: number
  created_at: string
}

// 用户优先级详情
export interface UserPriorityDetail {
  id: number
  username: string
  total_tasks: number
  total_approved_tasks: number
  exposure_level: number
  exposure_priority: number
  is_whitelist: boolean
  is_blacklist: boolean
  avg_submit_time: number
  last_task_date: string | null
  created_at: string
  calculatedPriority: number
  concurrencyLimit: number
  completionRate: string
  levelName: string
}

// 曝光等级统计
export interface ExposureLevelStats {
  total: number
  whitelist: number
  blacklist: number
  levels: {
    1: number
    2: number
    3: number
    4: number
  }
}

// 设置用户白名单
export async function setUserWhitelist(userId: number, isWhitelist: boolean): Promise<{ userId: number; isWhitelist: boolean }> {
  return request(`/admin-v2/users/${userId}/whitelist`, {
    method: 'POST',
    body: JSON.stringify({ isWhitelist }),
  })
}

// 设置用户黑名单
export async function setUserBlacklist(userId: number, isBlacklist: boolean): Promise<{ userId: number; isBlacklist: boolean }> {
  return request(`/admin-v2/users/${userId}/blacklist`, {
    method: 'POST',
    body: JSON.stringify({ isBlacklist }),
  })
}

// 获取白名单列表
export async function getWhitelist(params?: { page?: number; size?: number }): Promise<{
  list: WhitelistUser[]
  total: number
  page: number
  size: number
}> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', params.page.toString())
  if (params?.size) query.set('size', params.size.toString())
  return request(`/admin-v2/whitelist?${query.toString()}`)
}

// 获取黑名单列表
export async function getBlacklist(params?: { page?: number; size?: number }): Promise<{
  list: BlacklistUser[]
  total: number
  page: number
  size: number
}> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', params.page.toString())
  if (params?.size) query.set('size', params.size.toString())
  return request(`/admin-v2/blacklist?${query.toString()}`)
}

// 获取用户曝光等级统计
export async function getExposureLevelStats(): Promise<ExposureLevelStats> {
  return request('/admin-v2/users/exposure-level/stats')
}

// 批量设置用户曝光等级
export async function batchUpdateExposureLevel(userIds: number[], exposureLevel: number): Promise<{
  count: number
  users: { id: number; username: string; exposure_level: number }[]
}> {
  return request('/admin-v2/users/exposure-level/batch', {
    method: 'POST',
    body: JSON.stringify({ userIds, exposureLevel }),
  })
}

// 获取用户优先级详情
export async function getUserPriority(userId: number): Promise<UserPriorityDetail> {
  return request(`/admin-v2/users/${userId}/priority`)
}
