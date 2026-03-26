import { pgTable, serial, varchar, text, integer, float, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ==================== 系统健康检查表 ====================
export const healthCheck = pgTable("health_check", {
  id: serial("id").primaryKey(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
})

// ==================== 角色表 ====================
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  roleType: varchar("role_type", { length: 50 }).notNull(),
  canBPromotion: boolean("can_b_promotion").default(false).notNull(),
  description: text("description"),
  permissions: text("permissions").default("[]").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

// ==================== 用户表 ====================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("part_timer").notNull(),
  // 等级相关
  level: integer("level").default(1).notNull(),
  totalTasks: integer("total_tasks").default(0).notNull(),
  totalPoints: integer("total_points").default(0).notNull(),
  passRate30d: float("pass_rate_30d").default(100).notNull(),
  lastTaskDate: timestamp("last_task_date", { withTimezone: true, mode: 'string' }),
  // 账户
  points: integer("points").default(0).notNull(),
  balance: float("balance").default(0).notNull(),
  bPromotionPoints: integer("b_promotion_points").default(0).notNull(),
  // 推广关系
  inviteCode: varchar("invite_code", { length: 20 }).notNull().unique(),
  invitedBy: integer("invited_by"),
  cParentId: integer("c_parent_id"),
  cGrandId: integer("c_grand_id"),
  bInviterId: integer("b_inviter_id"),
  // 状态
  status: integer("status").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("users_username_idx").on(table.username),
  index("users_role_idx").on(table.role),
  index("users_level_idx").on(table.level),
  index("users_c_parent_id_idx").on(table.cParentId),
  index("users_b_inviter_id_idx").on(table.bInviterId),
])

// ==================== 等级配置表 ====================
export const levelConfigs = pgTable("level_configs", {
  level: integer("level").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  coefficient: float("coefficient").default(1.0).notNull(),
  minTasks: integer("min_tasks").default(0).notNull(),
  minPoints: integer("min_points").default(0).notNull(),
  minPassRate: float("min_pass_rate").default(0).notNull(),
  concurrentTasks: integer("concurrent_tasks").default(1).notNull(),
  prioritySupport: boolean("priority_support").default(false).notNull(),
  icon: varchar("icon", { length: 50 }).default("").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

// ==================== 任务表 ====================
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  videoUrl: text("video_url"),
  description: text("description").notNull(),
  templateImages: text("template_images").default("[]").notNull(),
  requirements: text("requirements").default("[]").notNull(),
  baseReward: integer("base_reward").default(0).notNull(),
  reward: integer("reward").default(0).notNull(),
  remain: integer("remain").default(0).notNull(),
  timeLimitMinutes: integer("time_limit_minutes").default(10).notNull(),
  cityLimit: integer("city_limit").default(1).notNull(),
  provinceLimit: integer("province_limit").default(4).notNull(),
  // 发布者信息
  publisherType: varchar("publisher_type", { length: 50 }).default("official").notNull(),
  publisherId: integer("publisher_id"),
  platformFeeRate: float("platform_fee_rate").default(0).notNull(),
  // 限制
  limitCities: text("limit_cities").default("[]").notNull(),
  dailyLimit: integer("daily_limit").default(0).notNull(),
  // 有效期
  startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
  endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
  // 状态
  status: varchar("status", { length: 50 }).default("pending_audit").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("tasks_platform_idx").on(table.platform),
  index("tasks_status_idx").on(table.status),
  index("tasks_publisher_type_idx").on(table.publisherType),
])

// ==================== 任务领取记录表 ====================
export const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  taskId: integer("task_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  baseReward: integer("base_reward").default(0).notNull(),
  reward: integer("reward").default(0).notNull(),
  levelCoefficient: float("level_coefficient").default(1.0).notNull(),
  status: varchar("status", { length: 50 }).default("doing").notNull(),
  city: varchar("city", { length: 100 }),
  province: varchar("province", { length: 100 }),
  platformNickname: varchar("platform_nickname", { length: 100 }),
  screenshots: text("screenshots").default("[]").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
  reviewerId: integer("reviewer_id"),
  reviewNote: text("review_note"),
}, (table) => [
  index("claims_user_id_idx").on(table.userId),
  index("claims_task_id_idx").on(table.taskId),
  index("claims_status_idx").on(table.status),
])

// ==================== 用户积分/余额记录表 ====================
export const records = pgTable("records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  desc: varchar("desc", { length: 255 }).notNull(),
  points: integer("points").default(0).notNull(),
  balance: float("balance").default(0).notNull(),
  extraData: text("extra_data"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("records_user_id_idx").on(table.userId),
  index("records_type_idx").on(table.type),
])

// ==================== 推广关系表 ====================
export const promotionRelations = pgTable("promotion_relations", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 10 }).notNull(),
  parentId: integer("parent_id").notNull(),
  childId: integer("child_id").notNull(),
  level: integer("level").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("promotion_relations_unique_idx").on(table.type, table.parentId, table.childId),
  index("promotion_relations_type_parent_idx").on(table.type, table.parentId),
  index("promotion_relations_type_child_idx").on(table.type, table.childId),
])

// ==================== 推广收益记录表 ====================
export const promotionEarnings = pgTable("promotion_earnings", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 10 }).notNull(),
  userId: integer("user_id").notNull(),
  fromUserId: integer("from_user_id").notNull(),
  fromClaimId: integer("from_claim_id"),
  level: integer("level").default(1).notNull(),
  points: integer("points").default(0).notNull(),
  sourcePoints: integer("source_points").default(0).notNull(),
  rate: float("rate").default(0).notNull(),
  status: varchar("status", { length: 50 }).default("settled").notNull(),
  settledAt: timestamp("settled_at", { withTimezone: true, mode: 'string' }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("promotion_earnings_type_user_status_idx").on(table.type, table.userId, table.status),
  index("promotion_earnings_from_user_idx").on(table.fromUserId),
])

// ==================== 排行榜快照表 ====================
export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(),
  statDate: timestamp("stat_date", { withTimezone: true, mode: 'string' }).notNull(),
  userId: integer("user_id").notNull(),
  rankNo: integer("rank_no").notNull(),
  points: integer("points").default(0).notNull(),
  taskCount: integer("task_count").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("leaderboard_snapshots_unique_idx").on(table.type, table.statDate, table.rankNo),
  index("leaderboard_snapshots_type_user_date_idx").on(table.type, table.userId, table.statDate),
])

// ==================== 排行榜奖励记录表 ====================
export const leaderboardRewards = pgTable("leaderboard_rewards", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(),
  statDate: timestamp("stat_date", { withTimezone: true, mode: 'string' }).notNull(),
  userId: integer("user_id").notNull(),
  rankNo: integer("rank_no").notNull(),
  points: integer("points").default(0).notNull(),
  title: varchar("title", { length: 100 }),
  extraPrivileges: text("extra_privileges"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("leaderboard_rewards_unique_idx").on(table.type, table.statDate, table.userId),
  index("leaderboard_rewards_type_date_status_idx").on(table.type, table.statDate, table.status),
])

// ==================== 系统配置表 ====================
export const systemConfigs = pgTable("system_configs", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
})

// ==================== 提现记录表 ====================
export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 50 }).default("part_time").notNull(),
  amount: float("amount").notNull(),
  points: integer("points").default(0).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  wechatInfo: text("wechat_info"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
  reviewerId: integer("reviewer_id"),
  reviewNote: text("review_note"),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index("withdrawals_user_id_idx").on(table.userId),
  index("withdrawals_status_idx").on(table.status),
  index("withdrawals_type_idx").on(table.type),
])

// ==================== 兼容旧配置表 ====================
export const configs = pgTable("configs", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  desc: text("desc"),
})

// ==================== TypeScript 类型导出 ====================
export type User = typeof users.$inferSelect
export type Task = typeof tasks.$inferSelect
export type Claim = typeof claims.$inferSelect
export type Record = typeof records.$inferSelect
export type Role = typeof roles.$inferSelect
export type LevelConfig = typeof levelConfigs.$inferSelect
export type SystemConfig = typeof systemConfigs.$inferSelect
export type Withdrawal = typeof withdrawals.$inferSelect
export type PromotionRelation = typeof promotionRelations.$inferSelect
export type PromotionEarning = typeof promotionEarnings.$inferSelect
export type LeaderboardSnapshot = typeof leaderboardSnapshots.$inferSelect
export type LeaderboardReward = typeof leaderboardRewards.$inferSelect
