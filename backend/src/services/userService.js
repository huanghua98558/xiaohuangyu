import supabase from '../utils/supabaseToPrismaAdapter.js'
import pkg from "@prisma/client"; const { PrismaClient } = pkg
import { hashPassword, verifyPassword } from "../utils/password.js"
import { generateToken } from "../utils/jwt.js"
import logger from "../utils/logger.js"
import cache from "../utils/redis.js"
import BusinessError from "../utils/BusinessError.js"

const prisma = new PrismaClient()

const toIdString = (id) => {
  if (id === null || id === undefined) return id
  if (typeof id === "bigint") return id.toString()
  if (typeof id === "number") return id.toString()
  return String(id)
}

function generateInviteCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

class UserService {
  async register(username, password, phone = "", agreements = {}) {
    const existingUsers = await prisma.$queryRaw`SELECT id FROM users WHERE username = ${username}`
    
    if (existingUsers && existingUsers.length > 0) {
      throw new Error("用户名已存在")
    }

    if (phone) {
      const existingPhones = await prisma.$queryRaw`SELECT id FROM users WHERE phone = ${phone}`
      if (existingPhones && existingPhones.length > 0) {
        throw new Error("该手机号已注册")
      }
    }

    const passwordHash = await hashPassword(password)
    const inviteCode = generateInviteCode()

    const result = await prisma.$queryRaw`
      INSERT INTO users (
        username, password_hash, phone, role, level,
        total_tasks, total_points, pass_rate_30d, invite_code,
        points, balance, b_promotion_points, status, created_at, updated_at
      ) VALUES (
        ${username}, ${passwordHash}, ${phone || null}, ${"part_timer"}, 1,
        0, 0, 100, ${inviteCode},
        0, 0, 0, 1, NOW(), NOW()
      ) RETURNING id, username, phone, role, invite_code
    `
    
    const user = result[0]
    logger.info("用户注册成功: " + username)

    const token = generateToken({ userId: toIdString(user.id), role: user.role })

    return {
      user: {
        id: toIdString(user.id),
        username: user.username,
        phone: user.phone || "",
        role: user.role,
        inviteCode: user.invite_code
      },
      token
    }
  }

  async login(username, password) {
    const users = await prisma.$queryRaw`
      SELECT id, username, phone, password_hash, role, invite_code 
      FROM users 
      WHERE username = ${username} OR phone = ${username}
    `

    const user = users && users[0]

    if (!user) {
      throw new BusinessError("用户名/手机号或密码错误", 401)
    }

    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      throw new BusinessError("用户名/手机号或密码错误", 401)
    }

    logger.info("用户登录成功: " + user.username)

    const token = generateToken({ userId: toIdString(user.id), role: user.role })

    return {
      user: {
        id: toIdString(user.id),
        username: user.username,
        phone: user.phone || "",
        role: user.role,
        inviteCode: user.invite_code
      },
      token
    }
  }

  async getUserById(userId) {
    const users = await prisma.$queryRaw`
      SELECT id, username, phone, role, points, balance, total_points, invite_code, created_at
      FROM users WHERE id = ${BigInt(userId)}
    `
    
    const user = users && users[0]

    if (!user) {
      throw new Error("用户不存在")
    }

    const pts = Number(user.points)
    const totalPts = Number(user.total_points) || pts
    return {
      id: toIdString(user.id),
      username: user.username,
      phone: user.phone || "",
      role: user.role,
      points: pts,
      balance: Number(user.balance),
      totalPoints: totalPts,
      exchangedPoints: Math.max(0, totalPts - pts),
      inviteCode: user.invite_code,
      createdAt: user.created_at
    }
  }

  async getWallet(userId) {
    const users = await prisma.$queryRaw`
      SELECT points, balance, total_points FROM users WHERE id = ${BigInt(userId)}
    `
    
    const user = users && users[0]

    if (!user) {
      throw new Error("用户不存在")
    }

    const pts = Number(user.points)
    const totalPts = Number(user.total_points) || 0
    return {
      points: pts,
      balance: Number(user.balance),
      totalPoints: totalPts,
      exchangedPoints: Math.max(0, totalPts - pts)
    }
  }

  async getPointsRank(limit = 10) {
    const users = await prisma.$queryRaw`
      SELECT id, username, points, level
      FROM users WHERE status = 1
      ORDER BY points DESC
      LIMIT ${limit}
    `

    return (users || []).map((u, i) => ({
      rank: i + 1,
      userId: toIdString(u.id),
      username: u.username,
      points: Number(u.points),
      level: Number(u.level)
    }))
  }

  async getUserRank(userId) {
    // 获取用户总积分排名
    const result = await prisma.$queryRaw`
      SELECT rank FROM (
        SELECT id, RANK() OVER (ORDER BY points DESC) as rank
        FROM users WHERE status = 1
      ) ranked
      WHERE id = ${BigInt(userId)}
    `
    return result && result[0] ? result[0].rank : null
  }

  async getUserDailyRank(userId) {
    // 获取用户今日积分排名
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const result = await prisma.$queryRaw`
      SELECT rank FROM (
        SELECT user_id, RANK() OVER (ORDER BY SUM(points) DESC) as rank
        FROM records
        WHERE created_at >= ${today}
        GROUP BY user_id
      ) ranked
      WHERE user_id = ${BigInt(userId)}
    `
    return result && result[0] ? result[0].rank : null
  }

  async getDailyPointsRank(limit = 10) {
    // 获取今日积分排行榜
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const results = await prisma.$queryRaw`
      SELECT r.user_id, u.username, SUM(r.points) as daily_points
      FROM records r
      JOIN users u ON r.user_id = u.id
      WHERE r.created_at >= ${today}
      GROUP BY r.user_id, u.username
      ORDER BY daily_points DESC
      LIMIT ${limit}
    `
    
    return (results || []).map((r, i) => ({
      rank: i + 1,
      userId: toIdString(r.user_id),
      username: r.username,
      dailyPoints: Number(r.daily_points)
    }))
  }

  async clearUserData(userId) {
    await prisma.$queryRaw`DELETE FROM records WHERE user_id = ${BigInt(userId)}`
    logger.info("用户数据已清空: " + userId)
    return { success: true }
  }

  async getRecords(userId, page = 1, size = 20) {
    try {
      const offset = (page - 1) * size
      const { data, count, error } = await supabase
        .from('records')
        .select('id, type, desc, points, balance, created_at', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + size - 1)

      if (error) throw error

      
      // 映射字段名为驼峰格式
      const list = (data || []).map(r => ({
        id: r.id,
        type: r.type,
        desc: r.desc,
        points: r.points,
        balance: r.balance,
        createdAt: r.created_at
      }))
      
      return { list, total: count || 0, page, size }
    } catch (e) {
      return { list: [], total: 0, page, size }
    }
  }
}


export default new UserService()
