import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'

/**
 * 获取积分配置
 */
async function getPointsConfig() {
  const { data: configs } = await supabase
    .from('system_configs')
    .select('key, value')
    .like('key', 'points_%')
  
  const result = {
    sign_in_base: 3,
    sign_in_7: 5,
    sign_in_14: 8,
    sign_in_30: 10
  }
  
  ;(configs || []).forEach(c => {
    const key = c.key.replace('points_', '')
    if (result.hasOwnProperty(key)) {
      result[key] = parseInt(c.value) || result[key]
    }
  })
  
  return result
}

/**
 * 获取本地日期字符串 (YYYY-MM-DD)
 * 数据库使用的是中国时区 (UTC+8)，需要保持一致
 */
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

class SignInService {
  /**
   * 用户签到
   */
  async signIn(userId) {
    const today = getLocalDateString()
    
    // 检查今天是否已签到
    const { data: existing, error: checkError } = await supabase
      .from('sign_ins')
      .select('*')
      .eq('user_id', userId)
      .eq('sign_date', today)
      .single()

    if (existing) {
      return {
        success: false,
        message: '今天已经签到过了',
        data: existing
      }
    }

    // 获取昨天的签到记录
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = getLocalDateString(yesterday)

    const { data: yesterdaySign } = await supabase
      .from('sign_ins')
      .select('continuous_days')
      .eq('user_id', userId)
      .eq('sign_date', yesterdayStr)
      .single()

    const continuousDays = yesterdaySign ? yesterdaySign.continuous_days + 1 : 1

    // 从配置获取签到积分（连续签到奖励递增）
    const pointsConfig = await getPointsConfig()
    let pointsEarned = pointsConfig.sign_in_base  // 基础签到
    if (continuousDays >= 7) pointsEarned = pointsConfig.sign_in_7
    if (continuousDays >= 14) pointsEarned = pointsConfig.sign_in_14
    if (continuousDays >= 30) pointsEarned = pointsConfig.sign_in_30

    // 创建签到记录
    const { data: signIn, error } = await supabase
      .from('sign_ins')
      .insert({
        user_id: userId,
        sign_date: today,
        points_earned: pointsEarned,
        continuous_days: continuousDays
      })
      .select()
      .single()

    if (error) {
      logger.error('签到失败:', error)
      throw new Error('签到失败')
    }

    // 获取用户当前积分
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      logger.error('获取用户积分失败:', userError)
      throw new Error('获取用户信息失败')
    }

    const oldPoints = user.points || 0
    const newPoints = oldPoints + pointsEarned

    // 更新用户积分
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        points: newPoints,
        total_points: (user.total_points || 0) + pointsEarned
      })
      .eq('id', userId)

    if (updateError) {
      logger.error('更新用户积分失败:', updateError)
      throw new Error('更新积分失败')
    }

    // points_logs 表已迁移为 records 表，跳过旧表写入

    // 同时写入 records 表，供前端积分流水显示
    try {
      const { error: recordError } = await supabase
        .from("records")
        .insert({
          user_id: userId,
          type: "sign_in",
          desc: "签到奖励（连续" + continuousDays + "天）",
          points: pointsEarned,
          balance: newPoints
        })
      if (recordError) {
        logger.error("记录到 records 表失败:", recordError)
      }
    } catch (recErr) {
      logger.error("records 写入异常:", recErr.message)
    }
    // 检查签到成就
    try {
      await this.checkSignInAchievements(userId, continuousDays)
    } catch (achErr) {
      logger.error("签到成就检查异常:", achErr.message)
    }

    logger.info(`用户 ${userId} 签到成功，连续${continuousDays}天，获得${pointsEarned}积分`)

    return {
      success: true,
      message: `签到成功！获得${pointsEarned}积分`,
      data: {
        ...signIn,
        isToday: true
      }
    }
  }

  /**
   * 获取用户签到状态
   */
  async getSignInStatus(userId) {
    const today = getLocalDateString()
    
    // 获取今天的签到记录
    const { data: todaySign } = await supabase
      .from('sign_ins')
      .select('*')
      .eq('user_id', userId)
      .eq('sign_date', today)
      .single()

    // 获取连续签到天数
    const { data: latestSign } = await supabase
      .from('sign_ins')
      .select('continuous_days, sign_date')
      .eq('user_id', userId)
      .order('sign_date', { ascending: false })
      .limit(1)
      .single()

    // 计算实际连续天数（如果不是今天签到的，需要重新计算）
    let continuousDays = 0
    if (todaySign) {
      continuousDays = todaySign.continuous_days
    } else if (latestSign) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = getLocalDateString(yesterday)
      
      if (latestSign.sign_date === yesterdayStr) {
        continuousDays = latestSign.continuous_days
      }
    }

    // 获取本月签到记录
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const { data: monthSigns } = await supabase
      .from('sign_ins')
      .select('sign_date, points_earned, continuous_days')
      .eq('user_id', userId)
      .gte('sign_date', monthStart)

    return {
      hasSignedToday: !!todaySign,
      continuousDays,
      totalDays: monthSigns?.length || 0,
      totalPoints: monthSigns?.reduce((sum, s) => sum + Number(s.points_earned), 0) || 0,
      monthSigns: monthSigns || []
    }
  }

  /**
   * 获取签到日历数据
   */
  async getSignInCalendar(userId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    // 计算月末日期
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data: signs, error } = await supabase
      .from('sign_ins')
      .select('sign_date, points_earned, continuous_days')
      .eq('user_id', userId)
      .gte('sign_date', startDate)
      .lte('sign_date', endDate)
      .order('sign_date', { ascending: true })

    if (error) {
      throw new Error('获取签到日历失败')
    }

    return signs || []
  }

  /**
   * 检查签到成就
   */
  async checkSignInAchievements(userId, continuousDays) {
    const achievementCodes = [
      { days: 7, code: 'sign_7' },
      { days: 30, code: 'sign_30' }
    ]

    for (const { days, code } of achievementCodes) {
      if (continuousDays >= days) {
        // 检查是否已获得该成就
        const { data: achievement } = await supabase
          .from('achievements')
          .select('id')
          .eq('code', code)
          .single()

        if (achievement) {
          const { data: userAchievement } = await supabase
            .from('user_achievements')
            .select('id')
            .eq('user_id', userId)
            .eq('achievement_id', achievement.id)
            .single()

          if (!userAchievement) {
            // 授予成就
            await supabase
              .from('user_achievements')
              .insert({
                user_id: userId,
                achievement_id: achievement.id
              })
            
            logger.info(`用户 ${userId} 获得签到成就: ${code}`)
          }
        }
      }
    }
  }
}

export default new SignInService()
