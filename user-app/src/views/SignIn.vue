<template>
  <div class="yx-page signin-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">每日签到</h1>
        <p class="yx-subtitle">签到领积分。</p>
      </div>
      <div class="yx-icon-btn">📅</div>
    </header>

    <section class="yx-hero-card">
      <div class="yx-card-head-bar">
        <h3>{{ signInHeadline }}<span class="yx-card-note signin-sub-positive">{{ signInSubline }}</span></h3>
      </div>
      <div class="yx-summary-grid three">
        <div class="yx-stat-card">
          <strong>{{ signInStatus.totalDays }}</strong>
          <span>本月签到</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ signInStatus.totalPoints }}</strong>
          <span>累计积分</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ signInStatus.continuousDays }}</strong>
          <span>连续天数</span>
        </div>
      </div>
      <div class="yx-actions">
        <button class="yx-btn full" :disabled="hasSignedToday || signing" @click="handleSignIn">
          {{ signing ? '签到中...' : hasSignedToday ? '今日已签到' : '立即签到' }}
        </button>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head-bar">
        <h3>签到奖励规则<span class="yx-card-note">每日奖励</span></h3>
      </div>
      <div class="yx-list">
        <div class="yx-list-item">
          <div class="yx-list-main"><b>每日签到</b><small>基础奖励</small></div>
          <div class="yx-list-side">+3</div>
        </div>
        <div class="yx-list-item">
          <div class="yx-list-main"><b>连续 7 天</b><small>每日按更高奖励计算</small></div>
          <div class="yx-list-side">+5/天</div>
        </div>
        <div class="yx-list-item">
          <div class="yx-list-main"><b>连续 14 天</b><small>额外提升</small></div>
          <div class="yx-list-side">+8/天</div>
        </div>
        <div class="yx-list-item">
          <div class="yx-list-main"><b>连续 30 天</b><small>满月奖励</small></div>
          <div class="yx-list-side">+10/天</div>
        </div>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head-bar calendar-head-bar">
        <h3>签到日历<span class="yx-card-note">{{ currentYear }}年{{ currentMonth }}月</span></h3>
        <div class="calendar-actions">
          <button class="yx-btn-ghost calendar-btn" @click="prevMonth">‹</button>
          <button class="yx-btn-ghost calendar-btn" @click="nextMonth">›</button>
        </div>
      </div>
      <div class="calendar-weekdays">
        <span v-for="w in ['日','一','二','三','四','五','六']" :key="w">{{ w }}</span>
      </div>
      <div class="calendar-days">
        <div
          v-for="(day, i) in calendarDays"
          :key="i"
          class="calendar-day"
          :class="{ empty: !day.date, signed: day.signed, today: day.isToday }"
        >
          <span v-if="day.date">{{ day.date }}</span>
          <small v-if="day.signed">✓</small>
        </div>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head-bar">
        <h3>最近签到记录<span class="yx-card-note">最近 10 条</span></h3>
      </div>
      <div class="yx-list" v-if="signInStatus.monthSigns?.length">
        <div class="yx-list-item" v-for="record in signInStatus.monthSigns.slice(0, 10)" :key="record.sign_date">
          <div class="yx-list-main">
            <b>{{ record.sign_date }}</b>
            <small>连续 {{ record.continuous_days }} 天</small>
          </div>
          <div class="yx-list-side">+{{ record.points_earned }}</div>
        </div>
      </div>
      <div class="yx-empty" v-else>
        <strong>暂无签到记录</strong>
        <span>签到后会自动累计。</span>
      </div>
    </section>
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

function rewardForStreak(day) {
  if (day >= 30) return 10
  if (day >= 14) return 8
  if (day >= 7) return 5
  return 3
}

const signInHeadline = computed(() => {
  if (hasSignedToday.value) {
    return `已连续签到 ${signInStatus.value.continuousDays} 天 🔥`
  }
  return '今日还未签到'
})

const tomorrowRewardPreview = computed(() => {
  const c = Number(signInStatus.value.continuousDays || 0)
  const nextStreak = hasSignedToday.value ? c + 1 : Math.max(1, c + 1)
  return rewardForStreak(nextStreak)
})

const signInSubline = computed(() => {
  const tip = `明日签到预计 +${tomorrowRewardPreview.value} 积分`
  if (hasSignedToday.value) {
    return `太棒了，明天继续打卡 · ${tip}`
  }
  return `坚持有惊喜 · ${tip}`
})

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()
  const days = []

  for (let i = 0; i < firstDay; i++) days.push({ date: null })

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
  } catch (e) {}
}

const loadCalendar = async () => {
  try {
    calendarData.value = await getSignInCalendar(currentYear.value, currentMonth.value)
  } catch (e) {
    calendarData.value = []
  }
}

const handleSignIn = async () => {
  if (hasSignedToday.value || signing.value) return
  signing.value = true
  try {
    const result = await signIn()
    hasSignedToday.value = true
    const pointsEarned = result.data?.points_earned || result.points_earned
    alert(result.message || `签到成功！获得 ${pointsEarned} 积分`)
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
  } else currentMonth.value--
  loadCalendar()
}

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else currentMonth.value++
  loadCalendar()
}

onMounted(() => {
  loadStatus()
  loadCalendar()
})
</script>

<style scoped>
.calendar-head-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.calendar-head-bar h3 {
  margin: 0;
  flex: 1;
  min-width: 0;
}

.signin-page {
  padding-top: 18px;
}

.yx-list-item small {
  line-height: 1.5;
}

.calendar-actions {
  display: flex;
  gap: 8px;
}

.calendar-btn {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 14px;
}

.calendar-weekdays,
.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.calendar-weekdays {
  margin-bottom: 10px;
  color: var(--yx-muted);
  font-size: 11px;
  text-align: center;
  font-weight: 700;
}

.calendar-day {
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  border: 1px solid var(--yx-line);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.88);
  font-size: 12px;
  color: var(--yx-deep);
}

.calendar-day small {
  margin-top: 4px;
  color: var(--yx-coral);
  font-weight: 800;
}

.calendar-day.signed {
  background: rgba(242,106,77,0.08);
  border-color: rgba(242,106,77,0.18);
}

.calendar-day.today {
  box-shadow: inset 0 0 0 2px rgba(241,164,35,0.4);
}

.calendar-day.empty {
  border: none;
  background: transparent;
}

.signin-sub-positive {
  color: #b45309 !important;
  font-weight: 700;
}

</style>
