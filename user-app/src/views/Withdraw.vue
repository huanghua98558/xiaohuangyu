<template>
  <div class="withdraw">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>提现中心</h1>
    </header>
    <div class="tip-card">
      <p>仅可提现「可提现余额」，余额由积分兑换获得。</p>
      <p>积分不足？先去 <router-link to="/points">积分中心</router-link> 兑换</p>
    </div>
    <div class="balance">可提现余额：¥{{ balance }}</div>
    <div class="form">
      <div class="field">
        <label>提现金额（元）</label>
        <input v-model="amount" type="number" placeholder="最低 10 元" />
      </div>
      <div class="field">
        <label>微信号/备注（选填）</label>
        <input v-model="wechatInfo" type="text" placeholder="方便联系您打款" />
      </div>
      <button class="btn" @click="submit" :disabled="submitting">
        {{ submitting ? '提交中...' : '申请提现' }}
      </button>
    </div>

    <!-- 提现记录 -->
    <div class="records-section">
      <h3 class="section-title">提现记录</h3>
      <div v-if="loadingRecords" class="loading">加载中...</div>
      <div v-else-if="records.length === 0" class="empty">暂无提现记录</div>
      <div v-else class="records-list">
        <div v-for="record in records" :key="record.id" class="record-item">
          <div class="record-main">
            <div class="record-amount">¥{{ record.amount.toFixed(2) }}</div>
            <div class="record-status" :class="'status-' + record.status">
              {{ getStatusText(record.status) }}
            </div>
          </div>
          <div class="record-info">
            <span class="record-time">{{ formatTime(record.createdAt) }}</span>
            <span v-if="record.wechatInfo" class="record-wechat">{{ record.wechatInfo }}</span>
            <span v-if="record.reviewNote" class="record-note">{{ record.reviewNote }}</span>
          </div>
        </div>
      </div>
      <div v-if="recordsTotal > records.length" class="load-more">
        <button @click="loadMoreRecords" :disabled="loadingRecords">
          {{ loadingRecords ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>

    <div class="tips">提现将在 1-3 个工作日内到账</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getWallet, withdraw as apiWithdraw, getWithdrawals } from '../api/task'

const balance = ref('0.00')
const amount = ref('')
const wechatInfo = ref('')
const submitting = ref(false)

// 提现记录
const records = ref([])
const recordsTotal = ref(0)
const recordsPage = ref(1)
const loadingRecords = ref(false)

async function load() {
  try {
    const w = await getWallet()
    balance.value = String(w.balance !== null && w.balance !== undefined ? w.balance : 0)
  } catch (e) {
    balance.value = '0.00'
  }
}

async function loadRecords() {
  loadingRecords.value = true
  try {
    const data = await getWithdrawals(recordsPage.value, 20)
    records.value = recordsPage.value === 1 ? data.list : [...records.value, ...data.list]
    recordsTotal.value = data.total
  } catch (e) {
    console.error('加载提现记录失败', e)
  } finally {
    loadingRecords.value = false
  }
}

async function loadMoreRecords() {
  recordsPage.value++
  await loadRecords()
}

async function submit() {
  const a = parseFloat(amount.value) || 0
  if (a < 10) {
    alert('最低提现 10 元')
    return
  }
  if (a > parseFloat(balance.value)) {
    alert('余额不足')
    return
  }
  submitting.value = true
  try {
    await apiWithdraw(a, wechatInfo.value)
    amount.value = ''
    wechatInfo.value = ''
    await load()
    recordsPage.value = 1
    await loadRecords()
    alert('提现申请已提交')
  } catch (e) {
    alert(e.message || '提现失败')
  } finally {
    submitting.value = false
  }
}

function getStatusText(status) {
  const statusMap = {
    pending: '待审核',
    approved: '已结算',
    rejected: '已拒绝',
    paid: '已打款'
  }
  return statusMap[status] || status
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const d = new Date(timeStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

onMounted(() => {
  load()
  loadRecords()
})
</script>

<style scoped>
.withdraw { min-height: 100vh; background: #f5f5f5; }
.header {
  background: #3f51b5;
  color: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.back { cursor: pointer; }
.tip-card {
  margin: 16px;
  padding: 12px 16px;
  background: #fff3e0;
  border-radius: 8px;
  font-size: 13px;
  color: #e65100;
}
.tip-card a { color: #3f51b5; }
.balance { padding: 0 16px 16px; font-size: 18px; font-weight: 500; }
.form { padding: 0 16px; }
.field { margin-bottom: 16px; }
.field label { display: block; margin-bottom: 8px; font-size: 14px; }
.field input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box;
}
.btn {
  width: 100%;
  padding: 14px;
  background: #3f51b5;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* 提现记录样式 */
.records-section {
  margin: 20px 16px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}
.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
}
.loading, .empty {
  text-align: center;
  padding: 20px;
  color: #999;
}
.records-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.record-item {
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}
.record-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.record-amount {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}
.record-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}
.status-pending {
  background: #fff3e0;
  color: #e65100;
}
.status-approved {
  background: #e3f2fd;
  color: #1976d2;
}
.status-rejected {
  background: #ffebee;
  color: #c62828;
}
.status-paid {
  background: #e8f5e9;
  color: #2e7d32;
}
.record-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #999;
}
.record-wechat, .record-note {
  color: #666;
}
.load-more {
  margin-top: 12px;
  text-align: center;
}
.load-more button {
  padding: 8px 24px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
}
.load-more button:disabled {
  opacity: 0.6;
}

.tips { padding: 20px; font-size: 13px; color: #999; text-align: center; }
</style>
