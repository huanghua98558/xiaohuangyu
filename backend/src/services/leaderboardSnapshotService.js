import db from '../config/database.js'
import logger from '../utils/logger.js'
import pointsRewardService from './pointsRewardService.js'
import { notifyLeaderboardReward } from './notificationService.js'

const SNAPSHOT_LIMIT = 100
const REWARD_LIMIT = 5
const APPROVED_STATUSES = ['approved', 'done']

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

function buildPeriodMeta(type, statDateInput) {
  const statDate = new Date(statDateInput)

  if (type === 'monthly') {
    const startDate = new Date(statDate.getFullYear(), statDate.getMonth(), 1, 0, 0, 0, 0)
    const endDate = new Date(statDate.getFullYear(), statDate.getMonth() + 1, 0, 23, 59, 59, 999)
    const periodKey = `${startDate.getFullYear()}-M${String(startDate.getMonth() + 1).padStart(2, '0')}`
    return { type, statDate: startDate, startDate, endDate, periodKey }
  }

  const startDate = new Date(statDate)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)
  endDate.setHours(23, 59, 59, 999)
  const weekNumber = getWeekNumber(startDate)
  const periodKey = `${startDate.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
  return { type: 'weekly', statDate: startDate, startDate, endDate, periodKey }
}

function getPreviousPeriod(type, now = new Date()) {
  if (type === 'monthly') {
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    return buildPeriodMeta('monthly', startDate)
  }

  const dayOfWeek = now.getDay() || 7
  const lastWeekEnd = new Date(now)
  lastWeekEnd.setDate(now.getDate() - dayOfWeek)
  lastWeekEnd.setHours(23, 59, 59, 999)

  const lastWeekStart = new Date(lastWeekEnd)
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6)
  lastWeekStart.setHours(0, 0, 0, 0)

  return buildPeriodMeta('weekly', lastWeekStart)
}

async function loadRankings(startDate, endDate) {
  const result = await db.query(
    `
    SELECT
      user_id,
      COALESCE(SUM(reward), 0)::int AS total_points,
      COUNT(*)::int AS task_count
    FROM claims
    WHERE status = ANY($1)
      AND reviewed_at >= $2
      AND reviewed_at <= $3
    GROUP BY user_id
    ORDER BY total_points DESC, task_count DESC, user_id ASC
    LIMIT ${SNAPSHOT_LIMIT}
    `,
    [APPROVED_STATUSES, startDate, endDate]
  )

  return (result.rows || []).map((row) => ({
    userId: toNumber(row.user_id),
    totalPoints: toNumber(row.total_points),
    taskCount: toNumber(row.task_count),
  }))
}

async function loadUserMeta(userIds = []) {
  if (userIds.length === 0) {
    return new Map()
  }

  const result = await db.query(
    `
    SELECT id, username, COALESCE(level, 1) AS level, COALESCE(is_whitelist, false) AS is_verified
    FROM users
    WHERE id = ANY($1)
    `,
    [userIds]
  )

  return new Map(
    (result.rows || []).map((row) => [
      toNumber(row.id),
      {
        username: row.username || '未知用户',
        level: toNumber(row.level, 1),
        isVerified: Boolean(row.is_verified),
      },
    ])
  )
}

function getRewardConfig(type, configs) {
  if (type === 'monthly') {
    return {
      1: toNumber(configs.rank_monthly_top1, 2000),
      2: toNumber(configs.rank_monthly_top2, 1000),
      3: toNumber(configs.rank_monthly_top3, 500),
    }
  }

  return {
    1: toNumber(configs.rank_weekly_top1, 300),
    2: toNumber(configs.rank_weekly_top2, 100),
    3: toNumber(configs.rank_weekly_top3, 50),
  }
}

function getRewardPointsByRank(rank, rewardConfig) {
  if (rank > REWARD_LIMIT) return 0
  if (rank <= 2) return toNumber(rewardConfig[rank], 0)
  return toNumber(rewardConfig[3], 0)
}

async function loadGroupedSnapshots(type, page, size) {
  const limit = Math.max(1, toNumber(size, 20))
  const offset = Math.max(0, (Math.max(1, toNumber(page, 1)) - 1) * limit)
  const values = []
  let where = ''

  if (type) {
    values.push(type)
    where = `WHERE type = $${values.length}`
  }

  const [countResult, listResult] = await Promise.all([
    db.query(
      `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT 1
        FROM leaderboard_snapshots
        ${where}
        GROUP BY type, stat_date
      ) grouped
      `,
      values
    ),
    db.query(
      `
      SELECT
        MIN(id)::int AS id,
        type,
        stat_date,
        COUNT(*)::int AS total_participants,
        MAX(created_at) AS created_at
      FROM leaderboard_snapshots
      ${where}
      GROUP BY type, stat_date
      ORDER BY stat_date DESC, type ASC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      [...values, limit, offset]
    ),
  ])

  return {
    total: toNumber(countResult.rows?.[0]?.count, 0),
    list: (listResult.rows || []).map((row) => {
      const meta = buildPeriodMeta(row.type, row.stat_date)
      return {
        id: row.id,
        type: row.type,
        periodKey: meta.periodKey,
        startDate: meta.startDate,
        endDate: meta.endDate,
        totalParticipants: toNumber(row.total_participants, 0),
        createdAt: row.created_at,
      }
    }),
  }
}

class LeaderboardSnapshotService {
  async generateWeeklySnapshot() {
    return this.generateSnapshot('weekly')
  }

  async generateMonthlySnapshot() {
    return this.generateSnapshot('monthly')
  }

  async generateSnapshot(type) {
    const meta = getPreviousPeriod(type)
    logger.info(`开始生成${type === 'monthly' ? '月榜' : '周榜'}快照: ${meta.periodKey}`)

    const rankings = await loadRankings(meta.startDate, meta.endDate)
    if (rankings.length === 0) {
      logger.info(`${type === 'monthly' ? '月榜' : '周榜'}快照 ${meta.periodKey} 无数据`)
      return null
    }

    const userMeta = await loadUserMeta(rankings.map((item) => item.userId))
    const rewardConfig = getRewardConfig(type, await pointsRewardService.getConfigs())
    const settledRewards = []

    await db.transaction(async (client) => {
      await client.query(
        `DELETE FROM leaderboard_snapshots WHERE type = $1 AND stat_date = $2`,
        [type, meta.statDate]
      )

      for (let i = 0; i < rankings.length; i += 1) {
        const rank = i + 1
        const row = rankings[i]
        const user = userMeta.get(row.userId) || { level: 1, isVerified: false }

        await client.query(
          `
          INSERT INTO leaderboard_snapshots
            (type, stat_date, user_id, rank_no, points, task_count, level, is_verified, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `,
          [
            type,
            meta.statDate,
            row.userId,
            rank,
            row.totalPoints,
            row.taskCount,
            toNumber(user.level, 1),
            Boolean(user.isVerified),
          ]
        )
      }

      const rewardExists = await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM leaderboard_rewards
        WHERE type = $1
          AND stat_date = $2
        `,
        [type, meta.statDate]
      )

      if (toNumber(rewardExists.rows?.[0]?.count, 0) > 0) {
        logger.warn(`${type === 'monthly' ? '月榜' : '周榜'} ${meta.periodKey} 奖励已存在，跳过重复发放`)
        return
      }

      for (let i = 0; i < Math.min(rankings.length, REWARD_LIMIT); i += 1) {
        const rank = i + 1
        const userId = rankings[i].userId
        const points = getRewardPointsByRank(rank, rewardConfig)
        if (points <= 0) continue

        const label = type === 'monthly' ? '月榜' : '周榜'
        const rewardTitle = `${label}第${rank}名奖励`

        const rewardResult = await client.query(
          `
          INSERT INTO leaderboard_rewards
            (type, stat_date, user_id, rank_no, points, title, status, issued_at, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'settled', NOW(), NOW())
          RETURNING id
          `,
          [type, meta.statDate, userId, rank, points, rewardTitle]
        )

        const rewardId = rewardResult.rows?.[0]?.id || null

        await client.query(
          `
          UPDATE users
          SET points = COALESCE(points, 0) + $1,
              total_points = COALESCE(total_points, 0) + $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [points, userId]
        )

        await client.query(
          `
          INSERT INTO points_logs (user_id, change, type, description, related_id, created_at)
          VALUES ($1, $2, 'reward', $3, $4, NOW())
          `,
          [userId, points, rewardTitle, rewardId]
        )

        await client.query(
          `
          INSERT INTO records (user_id, type, desc, points, balance, extra_data, created_at)
          VALUES ($1, 'reward', $2, $3, 0, $4, NOW())
          `,
          [userId, rewardTitle, points, JSON.stringify({ leaderboardType: type, rank, periodKey: meta.periodKey })]
        )

        settledRewards.push({ userId, rank, points })
      }
    })

    for (const reward of settledRewards) {
      try {
        await notifyLeaderboardReward(reward.userId, {
          type,
          rank: reward.rank,
          points: reward.points,
          periodKey: meta.periodKey,
        })
      } catch (notifyError) {
        logger.error(`发送排行榜奖励通知失败: 用户${reward.userId}`, notifyError)
      }
    }

    logger.info(`${type === 'monthly' ? '月榜' : '周榜'}快照 ${meta.periodKey} 生成成功，共 ${rankings.length} 人`)

    const snapshots = await loadGroupedSnapshots(type, 1, 1)
    const created = snapshots.list.find((item) => item.periodKey === meta.periodKey) || null
    return created
  }

  async getSnapshots(type, page = 1, size = 20) {
    const result = await loadGroupedSnapshots(type, page, size)
    return {
      list: result.list,
      total: result.total,
      page,
      size,
    }
  }

  async getSnapshotDetail(snapshotId) {
    const anchorResult = await db.query(
      `
      SELECT id, type, stat_date
      FROM leaderboard_snapshots
      WHERE id = $1
      LIMIT 1
      `,
      [snapshotId]
    )

    const anchor = anchorResult.rows?.[0]
    if (!anchor) {
      throw new Error('快照不存在')
    }

    const meta = buildPeriodMeta(anchor.type, anchor.stat_date)

    const [rankingsResult, rewardsResult] = await Promise.all([
      db.query(
        `
        SELECT
          s.id,
          s.user_id,
          s.rank_no,
          s.points,
          s.task_count,
          s.level,
          s.is_verified,
          s.created_at,
          u.username
        FROM leaderboard_snapshots s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.type = $1
          AND s.stat_date = $2
        ORDER BY s.rank_no ASC, s.id ASC
        `,
        [anchor.type, anchor.stat_date]
      ),
      db.query(
        `
        SELECT user_id, rank_no, points
        FROM leaderboard_rewards
        WHERE type = $1
          AND stat_date = $2
        `,
        [anchor.type, anchor.stat_date]
      ),
    ])

    const rewardMap = new Map(
      (rewardsResult.rows || []).map((row) => [`${row.user_id}-${row.rank_no}`, toNumber(row.points, 0)])
    )

    const rankings = (rankingsResult.rows || []).map((row) => ({
      rank: toNumber(row.rank_no, 0),
      userId: toNumber(row.user_id, 0),
      points: toNumber(row.points, 0),
      taskCount: toNumber(row.task_count, 0),
      level: toNumber(row.level, 1),
      isVerified: Boolean(row.is_verified),
      username: row.username || '未知用户',
      rewardPoints: rewardMap.get(`${row.user_id}-${row.rank_no}`) || 0,
    }))

    return {
      id: toNumber(anchor.id, 0),
      type: anchor.type,
      periodKey: meta.periodKey,
      startDate: meta.startDate,
      endDate: meta.endDate,
      totalParticipants: rankings.length,
      createdAt: rankingsResult.rows?.[0]?.created_at || null,
      rankings,
    }
  }

  async getUserRewards(userId, page = 1, size = 20) {
    const limit = Math.max(1, toNumber(size, 20))
    const offset = Math.max(0, (Math.max(1, toNumber(page, 1)) - 1) * limit)

    const [countResult, listResult] = await Promise.all([
      db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM leaderboard_rewards
        WHERE user_id = $1
        `,
        [userId]
      ),
      db.query(
        `
        SELECT id, type, stat_date, rank_no, points, status, created_at, issued_at
        FROM leaderboard_rewards
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
        OFFSET $3
        `,
        [userId, limit, offset]
      ),
    ])

    return {
      list: (listResult.rows || []).map((row) => {
        const meta = buildPeriodMeta(row.type, row.stat_date)
        return {
          id: toNumber(row.id, 0),
          type: row.type,
          periodKey: meta.periodKey,
          rank: toNumber(row.rank_no, 0),
          points: toNumber(row.points, 0),
          status: row.status,
          createdAt: row.created_at || row.issued_at,
        }
      }),
      total: toNumber(countResult.rows?.[0]?.count, 0),
      page,
      size: limit,
    }
  }
}

export default new LeaderboardSnapshotService()
