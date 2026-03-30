import supabase from '../utils/supabaseToPrismaAdapter.js'
import pkg from "@prisma/client"; const { PrismaClient } = pkg
import { hashPassword, verifyPassword } from "../utils/password.js"
import { generateToken } from "../utils/jwt.js"
import logger from "../utils/logger.js"
import cache from "../utils/redis.js"
import BusinessError from "../utils/BusinessError.js"
import db from "../config/database.js"
import { publishPointsAwarded } from "../utils/wsEventPublisher.js"
import { notifyPointsAwarded, notifyWelcome } from "./notificationService.js"
import * as registrationCodeService from "./registrationCodeService.js"
import { normalizeLoginKey } from "../utils/loginIdentifier.js"

const prisma = new PrismaClient()

const toIdString = (id) => {
  if (id === null || id === undefined) return id
  if (typeof id === "bigint") return id.toString()
  if (typeof id === "number") return id.toString()
  return String(id)
}

const REGISTER_BONUS_TOTAL = 200
const REGISTER_BONUS_STEPS = [
  {
    step: 1,
    threshold: 1,
    amount: 50,
    unlockDelayDays: 0,
    flagField: "bonus_unlocked_1",
    timeField: "bonus_unlock_1_at",
    label: "完成首个任务"
  },
  {
    step: 2,
    threshold: 10,
    amount: 50,
    unlockDelayDays: 1,
    flagField: "bonus_unlocked_2",
    timeField: "bonus_unlock_2_at",
    label: "累计完成10个任务"
  },
  {
    step: 3,
    threshold: 50,
    amount: 100,
    unlockDelayDays: 2,
    flagField: "bonus_unlocked_3",
    timeField: "bonus_unlock_3_at",
    label: "累计完成50个任务"
  }
]

function isRegisterBonusStepEligible(user, approvedCount, step, now = new Date()) {
  if (!user || user[step.flagField]) return false
  if (approvedCount < step.threshold) return false
  if (!user.created_at) return false

  const unlockTime = new Date(user.created_at)
  unlockTime.setDate(unlockTime.getDate() + step.unlockDelayDays)
  return now >= unlockTime
}

function getRegisterBonusDescription(step) {
  return `注册奖励解冻 - ${step.label}`
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
  async getUsersColumnSet() {
    if (this.usersColumnSet) {
      return this.usersColumnSet
    }

    try {
      const rows = await db.queryMany(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
        `
      )
      this.usersColumnSet = new Set((rows || []).map((row) => row.column_name))
    } catch (error) {
      logger.warn("读取 users 字段失败，使用基础字段", error?.message || error)
      this.usersColumnSet = new Set([
        "id",
        "username",
        "phone",
        "password_hash",
        "role",
        "level",
        "total_tasks",
        "total_points",
        "pass_rate_30d",
        "invite_code",
        "points",
        "balance",
        "b_promotion_points",
        "status",
        "created_at",
        "updated_at"
      ])
    }

    return this.usersColumnSet
  }

  async getConfiguredRegisterBonus() {
    try {
      const config = await db.queryOne(
        "SELECT value FROM system_configs WHERE key = $1 LIMIT 1",
        ["points_register_bonus"]
      )
      const parsed = Number(config?.value)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : REGISTER_BONUS_TOTAL
    } catch (error) {
      logger.warn("读取注册奖励配置失败，使用默认值", error?.message || error)
      return REGISTER_BONUS_TOTAL
    }
  }

  async getRecordsColumnSet() {
    if (this.recordsColumnSet) {
      return this.recordsColumnSet
    }

    try {
      const rows = await db.queryMany(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'records'
        `
      )
      this.recordsColumnSet = new Set((rows || []).map((row) => row.column_name))
    } catch (error) {
      logger.warn("读取 records 字段失败，使用基础字段", error?.message || error)
      this.recordsColumnSet = new Set([
        "id",
        "user_id",
        "type",
        "points",
        "balance",
        "task_id",
        "desc",
        "created_at"
      ])
    }

    return this.recordsColumnSet
  }

  async register(username, password, phone = "", agreements = {}, options = {}) {
    const registrationCode = options.registrationCode || ""
    const passwordHash = await hashPassword(password)
    const inviteCode = generateInviteCode()
    const registerBonus = await this.getConfiguredRegisterBonus()
    const userColumns = await this.getUsersColumnSet()
    const hasBonusPointsColumn = userColumns.has("bonus_points")
    const phoneNorm = phone ? normalizeLoginKey(phone) : ""

    const { user } = await prisma.$transaction(async (tx) => {
      const regCodeId = await registrationCodeService.lockAndValidateRegistrationCode(tx, registrationCode)

      const existingUsers = await tx.$queryRaw`SELECT id FROM users WHERE username = ${username}`
      if (existingUsers && existingUsers.length > 0) {
        throw new Error("用户名已存在")
      }

      if (phoneNorm) {
        const existingPhones = await tx.$queryRaw`SELECT id FROM users WHERE phone = ${phoneNorm}`
        if (existingPhones && existingPhones.length > 0) {
          throw new Error("该手机号已注册")
        }
      }

      const result = hasBonusPointsColumn
        ? await tx.$queryRaw`
            INSERT INTO users (
              username, password_hash, phone, role, level,
              total_tasks, total_points, pass_rate_30d, invite_code,
              points, balance, b_promotion_points, bonus_points, status, created_at, updated_at
            ) VALUES (
              ${username}, ${passwordHash}, ${phoneNorm ? phoneNorm : null}, ${"part_timer"}, 1,
              0, 0, 100, ${inviteCode},
              0, 0, 0, ${registerBonus}, 1, NOW(), NOW()
            ) RETURNING id, username, phone, role, invite_code
          `
        : await tx.$queryRaw`
            INSERT INTO users (
              username, password_hash, phone, role, level,
              total_tasks, total_points, pass_rate_30d, invite_code,
              points, balance, b_promotion_points, status, created_at, updated_at
            ) VALUES (
              ${username}, ${passwordHash}, ${phoneNorm ? phoneNorm : null}, ${"part_timer"}, 1,
              0, 0, 100, ${inviteCode},
              0, 0, 0, 1, NOW(), NOW()
            ) RETURNING id, username, phone, role, invite_code
          `

      const u = result[0]
      if (regCodeId != null) {
        await registrationCodeService.incrementRegistrationCodeUse(tx, regCodeId)
      }
      return { user: u }
    })

    logger.info("用户注册成功: " + username)

    const token = generateToken({ userId: toIdString(user.id), role: user.role })

    try {
      await notifyWelcome(toIdString(user.id), user.username)
    } catch (notifyErr) {
      logger.warn("发送注册欢迎通知失败: " + (notifyErr?.message || notifyErr))
    }

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
    const key = normalizeLoginKey(username)
    if (!key) {
      throw new BusinessError("请输入用户名或手机号", 400)
    }
    const users = await prisma.$queryRaw`
      SELECT id, username, phone, password_hash, role, invite_code 
      FROM users 
      WHERE username = ${key} OR phone = ${key}
      ORDER BY id DESC
    `

    if (users && users.length > 1) {
      logger.warn(`登录标识命中多条用户记录，已按最近更新取一条: key=${key}, count=${users.length}`)
    }
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

    return {
      id: toIdString(user.id),
      username: user.username,
      phone: user.phone || "",
      role: user.role,
      points: Number(user.points),
      balance: Number(user.balance),
      totalPoints: Number(user.total_points) || Number(user.points),
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

    return {
      points: Number(user.points),
      balance: Number(user.balance),
      totalPoints: Number(user.total_points) || 0
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
    const normalizedUserId = BigInt(userId)
    const userRows = await prisma.$queryRaw`
      SELECT points
      FROM users
      WHERE id = ${normalizedUserId}
      LIMIT 1
    `

    const user = userRows?.[0]
    const userPoints = Number(user?.points || 0)
    if (!user || userPoints <= 0) {
      return { rank: 0, points: 0, total: 0 }
    }

    const rankedRows = await prisma.$queryRaw`
      SELECT id, points
      FROM users
      WHERE points > 0
      ORDER BY points DESC, created_at ASC
    `

    const total = rankedRows?.length || 0
    const index = (rankedRows || []).findIndex((row) => toIdString(row.id) === toIdString(normalizedUserId))

    return {
      rank: index >= 0 ? index + 1 : 0,
      points: userPoints,
      total
    }
  }

  async getUserDailyRank(userId) {
    const normalizedUserId = BigInt(userId)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const records = await prisma.$queryRaw`
      SELECT user_id, points
      FROM records
      WHERE created_at >= ${today}
    `

    const totals = new Map()
    for (const record of records || []) {
      const points = Number(record.points || 0)
      if (points <= 0) continue
      const key = toIdString(record.user_id)
      totals.set(key, (totals.get(key) || 0) + points)
    }

    const ranking = Array.from(totals.entries())
      .map(([id, points]) => ({ id, points }))
      .sort((a, b) => b.points - a.points)

    const key = toIdString(normalizedUserId)
    const index = ranking.findIndex((item) => item.id === key)
    const points = totals.get(key) || 0

    return {
      rank: index >= 0 ? index + 1 : 0,
      points,
      total: ranking.length
    }
  }

  async getDailyPointsRank(limit = 10) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const results = await prisma.$queryRaw`
      SELECT r.user_id, u.username, SUM(r.points) AS daily_points
      FROM records r
      JOIN users u ON r.user_id = u.id
      WHERE r.created_at >= ${today}
      GROUP BY r.user_id, u.username
      HAVING SUM(r.points) > 0
      ORDER BY daily_points DESC, r.user_id ASC
      LIMIT ${limit}
    `

    return (results || []).map((row, index) => ({
      rank: index + 1,
      userId: toIdString(row.user_id),
      username: row.username,
      dailyPoints: Number(row.daily_points || 0)
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
      const normalizedUserId = Number(userId)
      const { data, count, error } = await supabase
        .from('records')
        .select('id, type, desc, points, balance, created_at', { count: 'exact' })
        .eq('user_id', normalizedUserId)
        .order('created_at', { ascending: false })
        .range(offset, offset + size - 1)

      if (error) throw error
      const list = (data || []).map((item) => ({
        id: item.id,
        type: item.type,
        desc: item.desc ?? item.description ?? '',
        points: Number(item.points || 0),
        balance: item.balance !== undefined && item.balance !== null ? Number(item.balance) : 0,
        createdAt: item.createdAt || item.created_at || '',
      }))
      return { list, total: count || 0, page, size }
    } catch (e) {
      return { list: [], total: 0, page, size }
    }
  }

  async updateProfile(userId, { province, city, phone }) {
    const uid = BigInt(userId)
    if (phone !== undefined && phone !== null) {
      const p = normalizeLoginKey(phone)
      if (!/^1[3-9]\d{9}$/.test(p)) {
        throw new Error("手机号格式不正确")
      }
      const dup = await prisma.$queryRaw`
        SELECT id FROM users WHERE phone = ${p} AND id != ${uid} LIMIT 1
      `
      if (dup && dup.length > 0) {
        throw new Error("该手机号已被使用")
      }
      await prisma.$queryRaw`
        UPDATE users SET phone = ${p}, updated_at = NOW() WHERE id = ${uid}
      `
    }
    if (province !== undefined || city !== undefined) {
      const userColumns = await this.getUsersColumnSet()
      if (province !== undefined && userColumns.has("province")) {
        await prisma.$queryRaw`
          UPDATE users SET province = ${String(province)}, updated_at = NOW() WHERE id = ${uid}
        `
      }
      if (city !== undefined && userColumns.has("city")) {
        await prisma.$queryRaw`
          UPDATE users SET city = ${String(city)}, updated_at = NOW() WHERE id = ${uid}
        `
      }
    }
    return this.getUserById(userId)
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    if (!newPassword || String(newPassword).length < 6) {
      throw new Error("新密码至少6位")
    }
    const uid = BigInt(userId)
    const rows = await prisma.$queryRaw`
      SELECT password_hash FROM users WHERE id = ${uid} LIMIT 1
    `
    const row = rows && rows[0]
    if (!row) {
      throw new Error("用户不存在")
    }
    const ok = await verifyPassword(currentPassword, row.password_hash)
    if (!ok) {
      throw new BusinessError("当前密码错误", 400)
    }
    const hash = await hashPassword(newPassword)
    await prisma.$queryRaw`
      UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${uid}
    `
    return { success: true }
  }

  async processScheduledUnlocks(options = {}) {
    const dryRun = Boolean(options?.dryRun)
    const now = new Date()
    const userColumns = await this.getUsersColumnSet()
    const recordColumns = await this.getRecordsColumnSet()
    const hasBonusPointsColumn = userColumns.has("bonus_points")
    const hasRecordDescriptionColumn = recordColumns.has("description")
    const hasRecordDescColumn = recordColumns.has("desc")
    const candidateSelectFields = [
      "u.id",
      "u.created_at",
      "COALESCE(u.points, 0) AS points",
      "COALESCE(u.total_points, 0) AS total_points",
      hasBonusPointsColumn ? "COALESCE(u.bonus_points, 0) AS bonus_points" : "0 AS bonus_points"
    ]

    for (const step of REGISTER_BONUS_STEPS) {
      candidateSelectFields.push(
        userColumns.has(step.flagField)
          ? `COALESCE(u.${step.flagField}, false) AS ${step.flagField}`
          : `false AS ${step.flagField}`
      )
    }

    const candidates = await db.queryMany(
      `
      SELECT
        ${candidateSelectFields.join(",\n        ")},
        COALESCE(approved.approved_count, 0)::int AS approved_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS approved_count
        FROM claims
        WHERE status IN ('approved', 'done')
        GROUP BY user_id
      ) approved ON approved.user_id = u.id
      WHERE COALESCE(u.status, 1) = 1
        AND COALESCE(approved.approved_count, 0) >= 1
      `
    )

    const summary = {
      scanned: candidates.length,
      unlockedUsers: 0,
      unlockedSteps: 0,
      unlockedPoints: 0,
      details: []
    }

    for (const candidate of candidates) {
      const approvedCount = Number(candidate.approved_count || 0)
      const eligibleSteps = REGISTER_BONUS_STEPS.filter((step) =>
        isRegisterBonusStepEligible(candidate, approvedCount, step, now)
      )

      if (eligibleSteps.length === 0) {
        continue
      }

      const userResult = await db.transaction(async (client) => {
        const userSelectFields = [
          "id",
          "created_at",
          "COALESCE(points, 0) AS points",
          "COALESCE(total_points, 0) AS total_points",
          "COALESCE(balance, 0) AS balance",
          hasBonusPointsColumn ? "COALESCE(bonus_points, 0) AS bonus_points" : "0 AS bonus_points"
        ]

        for (const step of REGISTER_BONUS_STEPS) {
          userSelectFields.push(
            userColumns.has(step.flagField)
              ? `COALESCE(${step.flagField}, false) AS ${step.flagField}`
              : `false AS ${step.flagField}`
          )
        }

        const userRes = await client.query(
          `
          SELECT
            ${userSelectFields.join(",\n            ")}
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [candidate.id]
        )

        const user = userRes.rows[0]
        if (!user) {
          return { userId: toIdString(candidate.id), unlocked: [] }
        }

        const approvedRes = await client.query(
          `
          SELECT COUNT(*)::int AS count
          FROM claims
          WHERE user_id = $1
            AND status IN ('approved', 'done')
          `,
          [candidate.id]
        )
        const approvedCountNow = Number(approvedRes.rows[0]?.count || 0)
        const descriptions = REGISTER_BONUS_STEPS.map(getRegisterBonusDescription)
        const recordDescriptionExpr = hasRecordDescriptionColumn && hasRecordDescColumn
          ? 'COALESCE(description, "desc") AS description'
          : hasRecordDescriptionColumn
            ? 'description'
            : '"desc" AS description'
        const recordMatchConditions = []
        if (hasRecordDescriptionColumn) {
          recordMatchConditions.push("description = ANY($2::text[])")
        }
        if (hasRecordDescColumn) {
          recordMatchConditions.push(`"desc" = ANY($2::text[])`)
        }
        const unlockedRecordRes = recordMatchConditions.length > 0
          ? await client.query(
              `
              SELECT ${recordDescriptionExpr}
              FROM records
              WHERE user_id = $1
                AND type = 'bonus'
                AND (${recordMatchConditions.join(" OR ")})
              `,
              [candidate.id, descriptions]
            )
          : { rows: [] }
        const unlockedDescriptions = new Set(
          (unlockedRecordRes.rows || [])
            .map((row) => row.description)
            .filter(Boolean)
        )
        const unlocked = []

        for (const step of REGISTER_BONUS_STEPS) {
          const description = getRegisterBonusDescription(step)
          const alreadyUnlocked =
            Boolean(user[step.flagField]) || unlockedDescriptions.has(description)

          if (alreadyUnlocked) {
            continue
          }

          if (!isRegisterBonusStepEligible(user, approvedCountNow, step, now)) {
            continue
          }

          if (dryRun) {
            unlocked.push({
              step: step.step,
              amount: step.amount,
              reason: description,
              totalPoints: Number(user.total_points || 0),
              remainingLockedBonus: hasBonusPointsColumn ? Number(user.bonus_points || 0) : null
            })
            continue
          }

          const updateClauses = [
            "points = COALESCE(points, 0) + $1",
            "total_points = COALESCE(total_points, 0) + $1",
            "updated_at = NOW()"
          ]
          if (hasBonusPointsColumn) {
            updateClauses.push("bonus_points = GREATEST(COALESCE(bonus_points, 0) - $1, 0)")
          }
          if (userColumns.has(step.flagField)) {
            updateClauses.push(`${step.flagField} = true`)
          }
          if (userColumns.has(step.timeField)) {
            updateClauses.push(`${step.timeField} = NOW()`)
          }

          const updateWhere = ["id = $2"]
          if (userColumns.has(step.flagField)) {
            updateWhere.push(`COALESCE(${step.flagField}, false) = false`)
          }

          const returningFields = [
            "id",
            "points",
            "total_points",
            "COALESCE(balance, 0) AS balance"
          ]
          if (hasBonusPointsColumn) {
            returningFields.push("COALESCE(bonus_points, 0) AS bonus_points")
          }

          const updateRes = await client.query(
            `
            UPDATE users
            SET ${updateClauses.join(",\n                ")}
            WHERE ${updateWhere.join("\n              AND ")}
            RETURNING ${returningFields.join(", ")}
            `,
            [step.amount, candidate.id]
          )

          const updatedUser = updateRes.rows[0]
          if (!updatedUser) {
            continue
          }

          const recordInsertColumns = ["user_id", "type", "points", "balance", "created_at"]
          const recordInsertValues = ["$1", "'bonus'", "$2", "$3", "NOW()"]
          const recordParams = [candidate.id, step.amount, updatedUser.balance || 0]
          if (hasRecordDescriptionColumn) {
            recordInsertColumns.splice(2, 0, "description")
            recordInsertValues.splice(2, 0, "$4")
          }
          if (hasRecordDescColumn) {
            recordInsertColumns.splice(hasRecordDescriptionColumn ? 3 : 2, 0, '"desc"')
            recordInsertValues.splice(hasRecordDescriptionColumn ? 3 : 2, 0, hasRecordDescriptionColumn ? "$5" : "$4")
          }
          if (hasRecordDescriptionColumn && hasRecordDescColumn) {
            recordParams.push(description, description)
          } else if (hasRecordDescriptionColumn || hasRecordDescColumn) {
            recordParams.push(description)
          }

          await client.query(
            `
            INSERT INTO records (${recordInsertColumns.join(", ")})
            VALUES (${recordInsertValues.join(", ")})
            `,
            recordParams
          )

          user[step.flagField] = true
          unlockedDescriptions.add(description)
          if (hasBonusPointsColumn) {
            user.bonus_points = updatedUser.bonus_points
          }
          unlocked.push({
            step: step.step,
            amount: step.amount,
            reason: description,
            totalPoints: Number(updatedUser.total_points || 0),
            remainingLockedBonus: hasBonusPointsColumn ? Number(updatedUser.bonus_points || 0) : null
          })
        }

        return {
          userId: toIdString(candidate.id),
          unlocked
        }
      })

      if (!userResult.unlocked.length) {
        continue
      }

      const totalAwarded = userResult.unlocked.reduce((sum, item) => sum + item.amount, 0)
      summary.unlockedUsers += 1
      summary.unlockedSteps += userResult.unlocked.length
      summary.unlockedPoints += totalAwarded
      summary.details.push(userResult)

      await publishPointsAwarded(userResult.userId, totalAwarded, {
        reason: "注册奖励解冻",
        source: "scheduled_bonus_unlock",
        bonusUnlocks: userResult.unlocked
      })

      try {
        await notifyPointsAwarded(userResult.userId, {
          reason: '注册奖励解冻',
          points: totalAwarded,
          finalPoints: totalAwarded,
          bonusUnlocks: userResult.unlocked,
        })
      } catch (notifyErr) {
        logger.warn("发送注册奖励解冻通知失败: " + (notifyErr?.message || notifyErr))
      }
    }

    if (summary.unlockedUsers > 0) {
      logger.info(
        `${dryRun ? "注册奖励解冻预检" : "注册奖励解冻完成"}: 用户 ${summary.unlockedUsers} 个, 步骤 ${summary.unlockedSteps} 个, 积分 ${summary.unlockedPoints}`
      )
    }

    return summary
  }
}


export default new UserService()
