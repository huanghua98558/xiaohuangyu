<template>
  <div class="yx-page no-tabbar points-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">积分中心</h1>
        <p class="yx-subtitle">积分、兑换、流水和提现余额统一整理，日期展示也按可读格式输出。</p>
      </div>
      <div class="yx-icon-btn">💎</div>
    </header>

    <section class="yx-hero-card">
      <div class="yx-stats-grid two">
        <div class="yx-metric-card"><strong>{{ totalPoints }}</strong><span>总获得积分</span></div>
        <div class="yx-metric-card"><strong>{{ exchangedPoints }}</strong><span>已兑换积分</span></div>
        <div class="yx-metric-card"><strong>{{ points }}</strong><span>可兑换积分</span></div>
        <div class="yx-metric-card"><strong>¥{{ formatBalance }}</strong><span>可提现余额</span></div>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head">
        <div>
          <h3>积分兑换</h3>
          <div class="yx-card-note">10 积分 = 1 元</div>
        </div>
      </div>
      <div class="convert-row">
        <input v-model.number="convertPoints" type="number" placeholder="输入兑换积分（10 的倍数）" />
        <button class="yx-btn" @click="handleConvert" :disabled="converting">
          {{ converting ? '兑换中...' : '兑换' }}
        </button>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head">
        <div>
          <h3>历史兑换记录</h3>
          <div class="yx-card-note" v-if="convertTotal > 0">共 {{ convertTotal }} 条</div>
        </div>
      </div>
      <div class="yx-list" v-if="convertRecords.length">
        <div class="yx-list-item" v-for="r in convertRecords" :key="r.id">
          <div class="yx-list-main">
            <b>{{ r.desc || '积分兑换' }}</b>
            <small>{{ formatTime(r.createdAt) }}</small>
          </div>
          <div class="yx-list-side">
            <div class="expense">-{{ r.points }} 积分</div>
            <div class="income">+¥{{ r.amount }}</div>
          </div>
        </div>
      </div>
      <div class="yx-empty" v-else-if="!loadingConvert">
        <strong>暂无兑换记录</strong>
        <span>积分兑换后，这里会保留完整的兑换留痕。</span>
      </div>
      <div class="yx-empty" v-else>
        <strong>加载中...</strong>
        <span>正在获取兑换记录。</span>
      </div>
      <button class="yx-btn-ghost full" v-if="convertRecords.length > 0 && convertRecords.length < convertTotal" @click="loadMoreConvertRecords">加载更多</button>
    </section>

    <section class="yx-card">
      <div class="yx-card-head">
        <div>
          <h3>积分流水</h3>
          <div class="yx-card-note" v-if="recordsTotal > 0">共 {{ recordsTotal }} 条</div>
        </div>
      </div>

      <div class="yx-segment" style="margin-bottom:12px;">
        <button :class="{ active: recordType === 'all' }" @click="changeRecordType('all')">全部</button>
        <button :class="{ active: recordType === 'income' }" @click="changeRecordType('income')">收入</button>
        <button :class="{ active: recordType === 'expense' }" @click="changeRecordType('expense')">支出</button>
      </div>

      <div class="yx-list" v-if="records.length">
        <div class="yx-list-item" v-for="r in records" :key="r.id">
          <div class="yx-list-main">
            <b>{{ r.desc }}</b>
            <small>{{ getTypeLabel(r) }} · {{ formatTime(r.createdAt) }}</small>
          </div>
          <div class="yx-list-side">
            <div :class="getAmountClass(r)">{{ formatAmount(r) }}</div>
          </div>
        </div>
      </div>

      <div class="yx-empty" v-else-if="!loadingRecords">
        <strong>暂无积分流水</strong>
        <span>任务奖励、签到、推广、排行奖励和兑换记录都会汇总在这里。</span>
      </div>
      <div class="yx-empty" v-else>
        <strong>加载中...</strong>
        <span>正在获取积分流水。</span>
      </div>

      <button class="yx-btn-ghost full" v-if="records.length > 0 && records.length < recordsTotal" @click="loadMoreRecords">加载更多</button>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getWallet, getRecords, convertPoints as apiConvert, getConvertRecords } from '../api/task'

const points = ref(0)
const totalPoints = ref(0)
const exchangedPoints = ref(0)
const balance = ref('0.00')
const formatBalance = computed(() => (parseFloat(balance.value) || 0).toFixed(2))

const records = ref([])
const recordsPage = ref(1)
const recordsTotal = ref(0)
const recordType = ref('all')
const loadingRecords = ref(false)

const convertRecords = ref([])
const convertPage = ref(1)
const convertTotal = ref(0)
const loadingConvert = ref(false)

const convertPoints = ref('')
const converting = ref(false)

async function load() {
  await Promise.all([loadWallet(), loadRecords(), loadConvertRecords()])
}

async function loadWallet() {
  try {
    const w = await getWallet()
    points.value = w.points || 0
    totalPoints.value = w.totalPoints || w.points || 0
    exchangedPoints.value = w.exchangedPoints || 0
    balance.value = String(w.balance !== null && w.balance !== undefined ? w.balance : 0)
  } catch (e) {
    points.value = 0
    totalPoints.value = 0
    exchangedPoints.value = 0
    balance.value = '0.00'
  }
}

async function loadRecords(isLoadMore = false) {
  if (loadingRecords.value) return
  loadingRecords.value = true
  try {
    const data = await getRecords(recordsPage.value, 20)
    let filteredList = data.list || []
    if (recordType.value === 'income') filteredList = filteredList.filter(r => r.points > 0)
    else if (recordType.value === 'expense') filteredList = filteredList.filter(r => r.points < 0)
    if (isLoadMore) records.value = [...records.value, ...filteredList]
    else records.value = filteredList
    recordsTotal.value = data.total || 0
  } catch (e) {
    records.value = []
  } finally {
    loadingRecords.value = false
  }
}

async function loadMoreRecords() {
  recordsPage.value++
  await loadRecords(true)
}

function changeRecordType(type) {
  recordType.value = type
  recordsPage.value = 1
  loadRecords()
}

async function loadConvertRecords(isLoadMore = false) {
  if (loadingConvert.value) return
  loadingConvert.value = true
  try {
    const data = await getConvertRecords(convertPage.value, 20)
    if (isLoadMore) convertRecords.value = [...convertRecords.value, ...(data.list || [])]
    else convertRecords.value = data.list || []
    convertTotal.value = data.total || 0
  } catch (e) {} finally {
    loadingConvert.value = false
  }
}

async function loadMoreConvertRecords() {
  convertPage.value++
  await loadConvertRecords(true)
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${min}`
}

function getTypeLabel(r) {
  if (r.type === 'task') return '任务奖励'
  if (r.type === 'convert') return '积分兑换'
  if (r.type === 'withdraw') return r.balance > 0 ? '提现退回' : '提现申请'
  if (r.type === 'promotion_c') return '推广奖励'
  if (r.type === 'reward') return '排行榜奖励'
  if (r.type === 'sign_in') return '签到奖励'
  if (r.type === 'achievement') return '成就奖励'
  if (r.type === 'admin_adjust') return '管理员调整'
  return '其他'
}

function getAmountClass(r) {
  if (r.points > 0 || r.balance > 0) return 'income'
  if (r.points < 0 || r.balance < 0) return 'expense'
  return ''
}

function formatAmount(r) {
  if (r.points && r.points !== 0) return r.points > 0 ? `+${r.points} 积分` : `${r.points} 积分`
  if (r.balance && r.balance !== 0) return r.balance > 0 ? `+¥${Math.abs(r.balance).toFixed(2)}` : `-¥${Math.abs(r.balance).toFixed(2)}`
  return '-'
}

async function handleConvert() {
  const p = parseInt(convertPoints.value) || 0
  if (p < 10) {
    alert('最少兑换 10 积分')
    return
  }
  if (p % 10 !== 0) {
    alert('兑换积分必须是 10 的倍数')
    return
  }
  if (p > points.value) {
    alert('可兑换积分不足')
    return
  }
  converting.value = true
  try {
    await apiConvert(p)
    convertPoints.value = ''
    convertPage.value = 1
    recordsPage.value = 1
    await load()
  } catch (e) {
    alert(e.message || '兑换失败')
  } finally {
    converting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.points-page {
  padding-top: 18px;
}

.convert-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.convert-row input {
  border: 1px solid var(--yx-line);
  background: rgba(255,255,255,0.92);
  border-radius: 16px;
  padding: 13px 14px;
  color: var(--yx-deep);
  font-size: 14px;
}

.income {
  color: #22865b;
  font-weight: 800;
}

.expense {
  color: #cf4a33;
  font-weight: 800;
}
</style>
