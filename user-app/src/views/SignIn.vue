<template>
  <div class="signin-page">
    <!-- 页面头部 -->
    <header class="page-header">
      <button class="back-btn" @click="$router.back()">
        <span>←</span>
      </button>
      <h1>每日签到</h1>
      <div style="width: 36px;"></div>
    </header>

    <!-- 签到状态卡片 -->
    <div class="signin-card">
      <div class="signin-header">
        <span class="signin-icon">📅</span>
        <div class="signin-info">
          <h2>{{ hasSignedToday ? '今日已签到' : '今日未签到' }}</h2>
          <p>连续签到 {{ signInStatus.continuousDays }} 天</p>
        </div>
      </div>
      
      <button 
        class="signin-btn" 
        :class="{ signed: hasSignedToday }"
        @click="handleSignIn"
        :disabled="hasSignedToday || signing"
      >
        <span v-if="signing">签到中...</span>
        <span v-else-if="hasSignedToday">✓ 已签到</span>
        <span v-else>立即签到</span>
      </button>
      
      <div class="signin-stats">
        <div class="stat-item">
          <span class="stat-value">{{ signInStatus.totalDays }}</span>
          <span class="stat-label">本月签到</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ signInStatus.totalPoints }}</span>
          <span class="stat-label">累计积分</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ signInStatus.continuousDays }}</span>
          <span class="stat-label">连续天数</span>
        </div>
      </div>
    </div>

    <!-- 签到奖励说明 -->
    <div class="reward-card">
      <h3>签到奖励规则</h3>
      <div class="reward-list">
        <div class="reward-item">
          <span class="reward-days">每日签到</span>
          <span class="reward-points">+3积分</span>
        </div>
        <div class="reward-item">
          <span class="reward-days">连续7天</span>
          <span class="reward-points">+5积分/天</span>
        </div>
        <div class="reward-item">
          <span class="reward-days">连续14天</span>
          <span class="reward-points">+8积分/天</span>
        </div>
        <div class="reward-item">
          <span class="reward-days">连续30天</span>
          <span class="reward-points">+10积分/天</span>
        </div>
      </div>
    </div>

    <!-- 签到日历 -->
    <div class="calendar-card">
      <div class="calendar-header">
        <button class="nav-btn" @click="prevMonth">‹</button>
        <span class="calendar-title">{{ currentYear }}年{{ currentMonth }}月</span>
        <button class="nav-btn" @click="nextMonth">›</button>
      </div>
      <div class="calendar-weekdays">
        <span>日</span>
        <span>一</span>
        <span>二</span>
        <span>三</span>
        <span>四</span>
        <span>五</span>
        <span>六</span>
      </div>
      <div class="calendar-days">
        <div 
          v-for="(day, i) in calendarDays" 
          :key="i"
          class="calendar-day"
          :class="{
            empty: !day.date,
            signed: day.signed,
            today: day.isToday
          }"
        >
          <span v-if="day.date">{{ day.date }}</span>
          <span class="check-mark" v-if="day.signed">✓</span>
        </div>
      </div>
    </div>

    <!-- 签到记录 -->
    <div class="records-card">
      <h3>最近签到记录</h3>
      <div class="records-list">
        <div 
          class="record-item" 
          v-for="record in signInStatus.monthSigns?.slice(0, 10)" 
          :key="record.sign_date"
        >
          <span class="record-date">{{ record.sign_date }}</span>
          <span class="record-days">连续{{ record.continuous_days }}天</span>
          <span class="record-points">+{{ record.points_earned }}</span>
        </div>
        <div class="empty" v-if="!signInStatus.monthSigns?.length">
          暂无签到记录
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { signIn, getSignInStatus, getSignInCalendar } from '../api/signIn'

const signing = ref(false)
const hasSignedToday = ref(false)
const signInStatus = ref({
  hasSignedToday: false,
  continuousDays: 0,
  totalDays: 0,
  totalPoints: 0,
  monthSigns: []
})

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const calendarData = ref([])

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()
  
  const days = []
  
  // 填充空白
  for (let i = 0; i < firstDay; i++) {
    days.push({ date: null })
  }
  
  // 填充日期
  const signedDates = new Set(calendarData.value.map(d => d.sign_date))
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({
      date: i,
      signed: signedDates.has(dateStr),
      isToday: today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === i
    })
  }
  
  return days
})

const loadStatus = async () => {
  try {
    const data = await getSignInStatus()
    signInStatus.value = data
    hasSignedToday.value = data.hasSignedToday
  } catch (e) {
    console.error('加载签到状态失败', e)
  }
}

const loadCalendar = async () => {
  try {
    const data = await getSignInCalendar(currentYear.value, currentMonth.value)
    calendarData.value = data
  } catch (e) {
    console.error('加载日历数据失败', e)
  }
}

const handleSignIn = async () => {
  if (hasSignedToday.value || signing.value) return
  
  signing.value = true
  try {
    const result = await signIn()
    // 签到成功
    hasSignedToday.value = true
    const pointsEarned = result.data?.points_earned || result.points_earned || 10
    alert(`签到成功！获得 ${pointsEarned} 积分`)
    loadStatus()
    loadCalendar()
  } catch (e) {
    alert(e.message || '签到失败，请稍后重试')
  } finally {
    signing.value = false
  }
}

const prevMonth = () => {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadCalendar()
}

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadCalendar()
}

onMounted(() => {
  loadStatus()
  loadCalendar()
})
</script>

<style scoped>
.signin-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f5f5f5;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}

.page-header h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.signin-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin: 16px;
  padding: 20px;
  border-radius: 16px;
  color: #fff;
}

.signin-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.signin-icon {
  font-size: 40px;
}

.signin-info h2 {
  font-size: 20px;
  margin: 0 0 4px 0;
}

.signin-info p {
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
}

.signin-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
  color: #667eea;
}

.signin-btn.signed {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.signin-btn:disabled {
  cursor: not-allowed;
}

.signin-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 20px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
}

.reward-card, .calendar-card, .records-card {
  background: #fff;
  margin: 16px;
  padding: 16px;
  border-radius: 12px;
}

.reward-card h3, .records-card h3 {
  font-size: 16px;
  margin: 0 0 12px 0;
}

.reward-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reward-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.reward-days {
  color: #666;
}

.reward-points {
  color: #ff6b00;
  font-weight: 600;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.calendar-title {
  font-size: 16px;
  font-weight: 600;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #f5f5f5;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: #999;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border-radius: 50%;
  position: relative;
}

.calendar-day.empty {
  visibility: hidden;
}

.calendar-day.today {
  background: #e8f0fe;
  color: #3f51b5;
  font-weight: 600;
}

.calendar-day.signed {
  background: #4caf50;
  color: #fff;
}

.check-mark {
  position: absolute;
  font-size: 10px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 14px;
}

.record-date {
  flex: 1;
  color: #333;
}

.record-days {
  color: #999;
  margin-right: 12px;
}

.record-points {
  color: #4caf50;
  font-weight: 500;
}

.empty {
  text-align: center;
  padding: 20px;
  color: #999;
}
</style>
