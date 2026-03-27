/**
 * 用户设置路由
 * 包含主题偏好设置等
 */
import { Router } from "express"
import { authMiddleware } from "../middlewares/auth.js"
import prisma from "../utils/prisma.js"
import logger from "../utils/logger.js"
import { success, AppError } from "../middlewares/errorHandler.js"
import { getConfigValue } from "../services/systemConfigService.js"

const router = Router()
let notificationColumnsReady = false
let notificationColumnsPromise = null

async function ensureNotificationColumns() {
  if (notificationColumnsReady) return
  if (notificationColumnsPromise) {
    await notificationColumnsPromise
    return
  }

  notificationColumnsPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS notification_enabled BOOL DEFAULT true
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOL DEFAULT true
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS review_notification_enabled BOOL DEFAULT true
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS points_notification_enabled BOOL DEFAULT true
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS withdraw_notification_enabled BOOL DEFAULT true
    `)
    notificationColumnsReady = true
  })()

  try {
    await notificationColumnsPromise
  } finally {
    notificationColumnsPromise = null
  }
}

// 所有路由需要认证
router.use(authMiddleware)

/**
 * 获取用户主题设置
 */
router.get("/theme", async (req, res, next) => {
  try {
    const userId = req.userId
    
    // 从用户表获取主题偏好
    const users = await prisma.$queryRaw`
      SELECT theme_preference FROM users WHERE id = ${parseInt(userId, 10)}
    `
    
    const user = users && users[0]
    
    // 获取系统默认主题
    const systemTheme = await getConfigValue('frontend_theme', 'professional')
    
    success(res, {
      theme: user?.theme_preference || systemTheme,
      systemTheme
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 保存用户主题设置
 */
router.put("/theme", async (req, res, next) => {
  try {
    const userId = req.userId
    const { theme } = req.body
    
    // 验证主题值
    const validThemes = ["professional", "glassmorphism", "dark-tech", "soft-cure", "minimal"]
    if (!validThemes.includes(theme)) {
      throw new AppError("无效的主题值", 400, "INVALID_THEME")
    }
    
    // 检查用户表是否有theme_preference字段，没有则添加
    try {
      await prisma.$queryRaw`
        UPDATE users SET theme_preference = ${theme} WHERE id = ${parseInt(userId, 10)}
      `
    } catch (updateErr) {
      // 如果字段不存在，尝试添加字段
      if (updateErr.code === "42703") {
        logger.info("[Theme] Adding theme_preference column to users table")
        await prisma.$queryRaw`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(50) DEFAULT 'professional'
        `
        await prisma.$queryRaw`
          UPDATE users SET theme_preference = ${theme} WHERE id = ${parseInt(userId, 10)}
        `
      } else {
        throw updateErr
      }
    }
    
    success(res, { theme }, "主题设置保存成功")
  } catch (err) {
    next(err)
  }
})

/**
 * 获取所有用户设置
 */
router.get("/", async (req, res, next) => {
  try {
    const userId = req.userId
    await ensureNotificationColumns()
    
    const users = await prisma.$queryRaw`
      SELECT theme_preference, notification_enabled, notification_sound_enabled,
             review_notification_enabled, points_notification_enabled, withdraw_notification_enabled,
             language 
      FROM users WHERE id = ${parseInt(userId, 10)}
    `
    
    const user = users && users[0]
    
    success(res, {
      theme: user?.theme_preference || "professional",
      notificationEnabled: user?.notification_enabled ?? true,
      notificationSoundEnabled: user?.notification_sound_enabled ?? true,
      reviewNotificationEnabled: user?.review_notification_enabled ?? true,
      pointsNotificationEnabled: user?.points_notification_enabled ?? true,
      withdrawNotificationEnabled: user?.withdraw_notification_enabled ?? true,
      language: user?.language || "zh-CN"
    })
  } catch (err) {
    next(err)
  }
})

router.get("/notifications", async (req, res, next) => {
  try {
    const userId = req.userId
    await ensureNotificationColumns()

    const users = await prisma.$queryRaw`
      SELECT notification_enabled, notification_sound_enabled,
             review_notification_enabled, points_notification_enabled, withdraw_notification_enabled
      FROM users
      WHERE id = ${parseInt(userId, 10)}
    `

    const user = users && users[0]
    success(res, {
      notificationEnabled: user?.notification_enabled ?? true,
      notificationSoundEnabled: user?.notification_sound_enabled ?? true,
      reviewNotificationEnabled: user?.review_notification_enabled ?? true,
      pointsNotificationEnabled: user?.points_notification_enabled ?? true,
      withdrawNotificationEnabled: user?.withdraw_notification_enabled ?? true,
    })
  } catch (err) {
    next(err)
  }
})

router.put("/notifications", async (req, res, next) => {
  try {
    const userId = req.userId
    const {
      notificationEnabled = true,
      notificationSoundEnabled = true,
      reviewNotificationEnabled = true,
      pointsNotificationEnabled = true,
      withdrawNotificationEnabled = true,
    } = req.body || {}

    await ensureNotificationColumns()

    await prisma.$executeRawUnsafe(
      `
      UPDATE users
      SET notification_enabled = $1,
          notification_sound_enabled = $2,
          review_notification_enabled = $3,
          points_notification_enabled = $4,
          withdraw_notification_enabled = $5
      WHERE id = $6
      `,
      Boolean(notificationEnabled),
      Boolean(notificationSoundEnabled),
      Boolean(reviewNotificationEnabled),
      Boolean(pointsNotificationEnabled),
      Boolean(withdrawNotificationEnabled),
      parseInt(userId, 10)
    )

    success(res, {
      notificationEnabled: Boolean(notificationEnabled),
      notificationSoundEnabled: Boolean(notificationSoundEnabled),
      reviewNotificationEnabled: Boolean(reviewNotificationEnabled),
      pointsNotificationEnabled: Boolean(pointsNotificationEnabled),
      withdrawNotificationEnabled: Boolean(withdrawNotificationEnabled),
    }, "通知设置保存成功")
  } catch (err) {
    next(err)
  }
})

export default router
