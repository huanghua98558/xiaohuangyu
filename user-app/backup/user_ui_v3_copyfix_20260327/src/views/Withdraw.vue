<template>
  <div class="yx-page no-tabbar withdraw-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">提现中心</h1>
        <p class="yx-subtitle">提现余额、申请入口和历史记录做成同一套账户面板，减少来回切页。</p>
      </div>
      <div class="yx-icon-btn">💵</div>
    </header>

    <section class="yx-soft-card">
      <div class="tip-copy">
        <p>仅可提现「可提现余额」，余额来自积分兑换。</p>
        <p>积分不足？先去 <router-link to="/points">积分中心</router-link> 兑换。</p>
      </div>
    </section>

    <section class="yx-hero-card">
      <div class="yx-card-head">
        <div>
          <h3>当前可提现余额</h3>
          <div class="yx-card-note">提现将在 1-3 个工作日内到账</div>
        </div>
      </div>
      <div class="balance-number">¥{{ balance }}</div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head">
        <div>
          <h3>申请提现</h3>
          <div class="yx-card-note">最低提现 10 元</div>
        </div>
      </div>
      <div class="withdraw-form">
        <label class="yx-field-label">提现金额（元）</label>
        <input v-model="amount" type="number" placeholder="最低 10 元" />
        <label class="yx-field-label">微信号 / 备注（选填）</label>
        <input v-model="wechatInfo" type="text" placeholder="方便联系您打款" />
        <button class="yx-btn full" @click="submit" :disabled="submitting">
          {{ submitting ? '提交中...' : '申请提现' }}
        </button>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head">
        <div>
          <h3>提现记录</h3>
          <div class="yx-card-note">保留审核和打款留痕</div>
        </div>
      </div>
      <div class="yx-list" v-if="records.length">
        <div class="yx-list-item" v-for="record in records" :key="record.id">
          <div class="yx-list-main">
            <b>¥{{ record.amount.toFixed(2) }}</b>
            <small>{{ formatTime(record.createdAt) }}</small>
            <small v-if="record.wechatInfo">{{ record.wechatInfo }}</small>
            <small v-if="record.reviewNote">{{ record.reviewNote }}</small>
          </div>
          <div class="yx-list-side">
            <span class="status-pill" :class="'status-' + record.status">{{ getStatusText(record.status) }}</span>
          </div>
        </div>
      </div>
      <div class="yx-empty" v-else-if="!loadingRecords">
        <strong>暂无提现记录</strong>
        <span>提交提现申请后，这里会保留完整状态。</span>
      </div>
      <div class="yx-empty" v-else>
        <strong>加载中...</strong>
        <span>正在获取提现记录。</span>
      </div>
      <button class="yx-btn-ghost full" v-if="recordsTotal > records.length" @click="loadMoreRecords" :disabled="loadingRecords">
        {{ loadingRecords ? '加载中...' : '加载更多' }}
      </button>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getWallet, withdraw as apiWithdraw, getWithdrawals } from '../api/task'

const balance = ref('0.00')
const amount = ref('')
const wechatInfo = ref('')
const submitting = ref(false)
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
    records.value = []
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
.withdraw-page {
  padding-top: 18px;
}

.tip-copy {
  color: #b14e2d;
  font-size: 13px;
  line-height: 1.8;
}

.tip-copy p {
  margin: 0;
}

.tip-copy p + p {
  margin-top: 6px;
}

.tip-copy a {
  color: var(--yx-deep);
}

.balance-number {
  font-size: 36px;
  line-height: 1;
  letter-spacing: -0.06em;
  font-weight: 800;
}

.withdraw-form {
  display: grid;
  gap: 10px;
}

.withdraw-form input {
  border: 1px solid var(--yx-line);
  background: rgba(255,255,255,0.92);
  border-radius: 16px;
  padding: 13px 14px;
  color: var(--yx-deep);
  font-size: 14px;
}

.status-pill {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
}

.status-pending {
  background: var(--yx-gold-soft);
  color: #986000;
}

.status-approved {
  background: var(--yx-navy-soft);
  color: #31507e;
}

.status-rejected {
  background: var(--yx-coral-soft);
  color: #be4d31;
}

.status-paid {
  background: var(--yx-mint-soft);
  color: #216f59;
}
</style>
