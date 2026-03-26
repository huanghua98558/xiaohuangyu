/**
 * 用户设置路由
 * 包含主题偏好设置等
 */
import { Router } from "express"
import { authMiddleware } from "../middlewares/auth.js"
import prisma from "../utils/prisma.js"
import logger from "../utils/logger.js"
import { success, AppError } from "../middlewares/errorHandler.js"

const router = Router()

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
    const configs = await prisma.$queryRaw`
      SELECT value FROM system_configs WHERE key = 'frontend_theme'
    `
    
    const systemTheme = configs && configs[0]?.value || "professional"
    
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
          ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(50) DEFAULT "professional"
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
    
    const users = await prisma.$queryRaw`
      SELECT theme_preference, notification_enabled, language 
      FROM users WHERE id = ${parseInt(userId, 10)}
    `
    
    const user = users && users[0]
    
    success(res, {
      theme: user?.theme_preference || "professional",
      notificationEnabled: user?.notification_enabled ?? true,
      language: user?.language || "zh-CN"
    })
  } catch (err) {
    next(err)
  }
})

export default router
