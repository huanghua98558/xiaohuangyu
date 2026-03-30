<template>
  <div class="points">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>积分中心</h1>
    </header>
    <div class="cards">
      <div class="card total-card">
        <div class="label">总获得积分</div>
        <div class="value">{{ totalPoints }}</div>
        <p class="tip">累计完成任务获得的积分</p>
      </div>
      <div class="card exchanged-card">
        <div class="label">已兑换积分</div>
        <div class="value">{{ exchangedPoints }}</div>
        <p class="tip">已兑换成现金的积分</p>
      </div>
      <div class="card points-card">
        <div class="label">可兑换积分</div>
        <div class="value">{{ points }}</div>
        <p class="tip">可用于兑换现金的积分</p>
      </div>
      <div class="card balance-card">
        <div class="label">可提现余额</div>
        <div class="value">¥{{ formatBalance }}</div>
        <p class="tip">积分兑换后的现金，可申请提现</p>
      </div>
    </div>
    <section class="convert">
      <h3>积分兑换</h3>
      <p class="rate">10 积分 = 1 元</p>
      <div class="form">
        <input v-model.number="convertPoints" type="number" placeholder="输入兑换积分（10 的倍数）" />
        <button class="btn" @click="handleConvert" :disabled="converting">
          {{ converting ? '兑换中...' : '兑换' }}
        </button>
      </div>
    </section>
    
    <!-- 历史积分兑换记录 -->
    <section class="convert-records">
      <div class="section-header">
        <h3>历史兑换记录</h3>
        <span class="total-count" v-if="convertTotal > 0">共 {{ convertTotal }} 条</span>
      </div>
      <div class="record" v-for="r in convertRecords" :key="r.id">
        <div class="info">
          <span class="desc">{{ r.desc || '积分兑换' }}</span>
          <span class="time">{{ formatTime(r.createdAt) }}</span>
        </div>
        <div class="amount-info">
          <span class="points-cost">-{{ r.points }} 积分</span>
          <span class="amount-gain">+¥{{ r.amount }}</span>
        </div>
      </div>
      <div class="empty" v-if="convertRecords.length === 0 && !loadingConvert">暂无兑换记录</div>
      <div class="load-more" v-if="convertRecords.length > 0 && convertRecords.length < convertTotal" @click="loadMoreConvertRecords">
        加载更多 ({{ convertRecords.length }}/{{ convertTotal }})
      </div>
      <div class="loading" v-if="loadingConvert">
        <span class="loading-text">加载中...</span>
      </div>
    </section>
    
    <!-- 积分流水 -->
    <section class="records">
      <div class="section-header">
        <h3>积分流水</h3>
        <span class="total-count" v-if="recordsTotal > 0">共 {{ recordsTotal }} 条</span>
      </div>
      <div class="tabs">
        <span class="tab" :class="{ active: recordType === 'all' }" @click="changeRecordType('all')">全部</span>
        <span class="tab" :class="{ active: recordType === 'income' }" @click="changeRecordType('income')">收入</span>
        <span class="tab" :class="{ active: recordType === 'expense' }" @click="changeRecordType('expense')">支出</span>
      </div>
      <div class="record" v-for="r in records" :key="r.id">
        <div class="info">
          <div class="desc-row">
            <span class="type-badge" :class="getTypeClass(r)">
              {{ getTypeLabel(r) }}
            </span>
            <span class="desc">{{ r.desc }}</span>
          </div>
          <span class="time">{{ formatTime(r.createdAt) }}</span>
        </div>
        <div class="amount-wrap">
          <span class="amount" :class="getAmountClass(r)">{{ formatAmount(r) }}</span>
          <span class="balance-hint" v-if="r.points !== 0">余额: {{ r.points > 0 ? '+' : '' }}{{ r.points }} 积分</span>
          <span class="balance-hint" v-if="r.balance !== 0 && r.balance">余额: {{ r.balance > 0 ? '+' : '' }}¥{{ Math.abs(r.balance).toFixed(2) }}</span>
        </div>
      </div>
      <div class="empty" v-if="records.length === 0 && !loadingRecords">暂无记录</div>
      <div class="load-more" v-if="records.length > 0 && records.length < recordsTotal" @click="loadMoreRecords">
        加载更多 ({{ records.length }}/{{ recordsTotal }})
      </div>
      <div class="loading" v-if="loadingRecords">
        <span class="loading-text">加载中...</span>
      </div>
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

// 格式化余额显示，保留2位小数
const formatBalance = computed(() => {
  const b = parseFloat(balance.value) || 0
  return b.toFixed(2)
})

// 积分流水
const records = ref([])
const recordsPage = ref(1)
const recordsTotal = ref(0)
const recordType = ref('all') // all, income, expense
const loadingRecords = ref(false)

// 兑换记录
const convertRecords = ref([])
const convertPage = ref(1)
const convertTotal = ref(0)
const loadingConvert = ref(false)

const convertPoints = ref('')
const converting = ref(false)

async function load() {
  await Promise.all([
    loadWallet(),
    loadRecords(),
    loadConvertRecords()
  ])
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
    // 根据类型筛选
    if (recordType.value === 'income') {
      filteredList = filteredList.filter(r => r.points > 0)
    } else if (recordType.value === 'expense') {
      filteredList = filteredList.filter(r => r.points < 0)
    }
    
    if (isLoadMore) {
      records.value = [...records.value, ...filteredList]
    } else {
      records.value = filteredList
    }
    recordsTotal.value = data.total || 0
  } catch (e) {
    console.error('加载记录失败', e)
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
    if (isLoadMore) {
      convertRecords.value = [...convertRecords.value, ...(data.list || [])]
    } else {
      convertRecords.value = data.list || []
    }
    convertTotal.value = data.total || 0
  } catch (e) {
    console.error('加载兑换记录失败', e)
  } finally {
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

// 获取记录类型标签
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

// 获取记录类型样式类
function getTypeClass(r) {
  if (r.type === 'task') return 'type-task'
  if (r.type === 'convert') return 'type-convert'
  if (r.type === 'withdraw') return r.balance > 0 ? 'type-income' : 'type-withdraw'
  if (r.type === 'promotion_c') return 'type-promotion'
  if (r.type === 'reward') return 'type-reward'
  if (r.type === 'sign_in') return 'type-signin'
  if (r.type === 'achievement') return 'type-achievement'
  if (r.type === 'admin_adjust') return 'type-admin'
  return 'type-other'
}

// 获取金额样式类
function getAmountClass(r) {
  if (r.points > 0) return 'income'
  if (r.points < 0) return 'expense'
  if (r.balance > 0) return 'income'
  if (r.balance < 0) return 'expense'
  return ''
}

// 格式化金额显示
function formatAmount(r) {
  if (r.points && r.points !== 0) {
    return r.points > 0 ? `+${r.points} 积分` : `${r.points} 积分`
  }
  if (r.balance && r.balance !== 0) {
    return r.balance > 0 ? `+¥${Math.abs(r.balance).toFixed(2)}` : `-¥${Math.abs(r.balance).toFixed(2)}`
  }
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
.points { min-height: 100vh; background: #f5f5f5; padding-bottom: 20px; }
.header {
  background: #3f51b5;
  color: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.back { cursor: pointer; }
.cards { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.card {
  padding: 20px;
  border-radius: 12px;
  color: #fff;
}
.total-card { background: linear-gradient(135deg, #ff9800, #ffb74d); }
.exchanged-card { background: linear-gradient(135deg, #9c27b0, #ba68c8); }
.points-card { background: linear-gradient(135deg, #3f51b5, #5c6bc0); }
.balance-card { background: linear-gradient(135deg, #4caf50, #66bb6a); }
.card .label { font-size: 14px; opacity: 0.9; }
.card .value { font-size: 28px; font-weight: 600; margin: 8px 0; }
.card .tip { font-size: 12px; opacity: 0.85; }
.convert, .convert-records, .records {
  margin: 0 16px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 12px;
}
.convert h3, .convert-records h3, .records h3 { font-size: 16px; margin-bottom: 12px; }
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-header h3 {
  margin-bottom: 0;
}
.total-count {
  font-size: 12px;
  color: #999;
}
.rate { font-size: 13px; color: #666; margin-bottom: 12px; }
.form { display: flex; gap: 8px; }
.form input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}
.form .btn {
  padding: 12px 24px;
  background: #3f51b5;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.form .btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 记录列表样式 */
.record {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.record:last-child {
  border-bottom: none;
}
.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.desc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.type-task { background: #e3f2fd; color: #1976d2; }
.type-convert { background: #fff3e0; color: #f57c00; }
.type-withdraw { background: #fce4ec; color: #c2185b; }
.type-promotion { background: #f3e5f5; color: #7b1fa2; }
.type-reward { background: #e8f5e9; color: #388e3c; }
.type-income { background: #e8f5e9; color: #388e3c; }
.type-other { background: #f5f5f5; color: #666; }
.desc {
  font-size: 14px;
  color: #333;
}
.time {
  font-size: 12px;
  color: #999;
}
.amount-wrap {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.amount {
  font-size: 15px;
  font-weight: 600;
}
.amount.income { color: #4caf50; }
.amount.expense { color: #f44336; }
.balance-hint {
  font-size: 11px;
  color: #999;
}
.amount-info {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.points-cost {
  font-size: 14px;
  color: #f44336;
  font-weight: 500;
}
.amount-gain {
  font-size: 14px;
  color: #4caf50;
  font-weight: 500;
}

/* 标签页样式 */
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.tab {
  padding: 6px 16px;
  border-radius: 16px;
  font-size: 13px;
  background: #f5f5f5;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}
.tab.active {
  background: #3f51b5;
  color: #fff;
}

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 12px;
  color: #3f51b5;
  font-size: 14px;
  cursor: pointer;
}
.load-more:hover {
  background: #f5f5f5;
}
.empty {
  text-align: center;
  padding: 24px;
  color: #999;
  font-size: 14px;
}
.loading {
  text-align: center;
  padding: 12px;
}
.loading-text {
  color: #999;
  font-size: 14px;
}
</style>
