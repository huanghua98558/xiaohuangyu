<template>
  <div class="rewards">
    <header class="page-header">
      <h1>🎁 奖励机制</h1>
      <p class="subtitle">完成任务奖励丰厚，新人福利多多</p>
    </header>

    <!-- 完成任务奖励 -->
    <section class="section">
      <div class="section-title highlight-title">
        <span class="title-icon">🏆</span>
        <span>完成任务奖励</span>
        <span class="title-badge hot">最高2000积分</span>
      </div>
      
      <div class="reward-card main-card task-card">
        <div class="card-header">
          <span class="header-icon">💰</span>
          <span class="header-text">完成任务最高奖励2000积分</span>
        </div>
        
        <div class="task-reward-content">
          <div class="big-reward">
            <span class="big-num">2000</span>
            <span class="big-unit">积分</span>
          </div>
          <div class="reward-desc">
            <p>积极参与任务，冲刺排行榜！</p>
            <p class="sub-desc">周榜第1名奖励300积分，月榜第1名奖励2000积分</p>
          </div>
        </div>
        
        <div class="card-note">
          <span class="note-icon">💡</span>
          <span>完成任务越多，排名越高，奖励越丰厚</span>
        </div>
      </div>
    </section>

    <!-- 新人注册奖励 -->
    <section class="section">
      <div class="section-title">
        <span class="title-icon">🎉</span>
        <span>新人注册奖励</span>
        <span class="title-badge">200积分</span>
      </div>
      
      <div class="reward-card main-card">
        <div class="card-header">
          <span class="header-icon">🎁</span>
          <span class="header-text">注册即送200积分，完成任务逐步解冻</span>
        </div>
        
        <div class="unlock-steps">
          <div class="unlock-item">
            <div class="unlock-icon">1️⃣</div>
            <div class="unlock-content">
              <div class="unlock-title">完成首个任务</div>
              <div class="unlock-desc">任务审核通过后立即解冻</div>
            </div>
            <div class="unlock-reward">
              <span class="reward-num">50</span>
              <span class="reward-unit">积分</span>
            </div>
          </div>
          
          <div class="unlock-item">
            <div class="unlock-icon">2️⃣</div>
            <div class="unlock-content">
              <div class="unlock-title">累计完成10个任务</div>
              <div class="unlock-desc">第2天自动解冻</div>
            </div>
            <div class="unlock-reward">
              <span class="reward-num">50</span>
              <span class="reward-unit">积分</span>
            </div>
          </div>
          
          <div class="unlock-item">
            <div class="unlock-icon">3️⃣</div>
            <div class="unlock-content">
              <div class="unlock-title">累计完成50个任务</div>
              <div class="unlock-desc">第3天自动解冻</div>
            </div>
            <div class="unlock-reward">
              <span class="reward-num">100</span>
              <span class="reward-unit">积分</span>
            </div>
          </div>
        </div>
        
        <div class="card-note">
          <span class="note-icon">💡</span>
          <span>即使第1天完成100个任务，也需3天才能全部解冻</span>
        </div>
      </div>
    </section>

    <!-- 排行榜奖励 -->
    <section class="section">
      <div class="section-title">
        <span class="title-icon">🏆</span>
        <span>排行榜奖励</span>
      </div>
      
      <!-- 周榜奖励 -->
      <div class="reward-card">
        <div class="card-header weekly">
          <span class="header-icon">📅</span>
          <span class="header-text">周榜奖励</span>
          <span class="header-tip">每周一发放</span>
        </div>
        
        <div class="reward-list">
          <div class="reward-row first">
            <div class="row-left">
              <span class="row-medal">🥇</span>
              <span class="row-rank">第1名</span>
            </div>
            <div class="row-right">
              <span class="row-value">300</span>
              <span class="row-unit">积分</span>
            </div>
          </div>
          <div class="reward-row second">
            <div class="row-left">
              <span class="row-medal">🥈</span>
              <span class="row-rank">第2名</span>
            </div>
            <div class="row-right">
              <span class="row-value">100</span>
              <span class="row-unit">积分</span>
            </div>
          </div>
          <div class="reward-row third">
            <div class="row-left">
              <span class="row-medal">🥉</span>
              <span class="row-rank">第3-5名</span>
            </div>
            <div class="row-right">
              <span class="row-value">50</span>
              <span class="row-unit">积分</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 月榜奖励 -->
      <div class="reward-card">
        <div class="card-header monthly">
          <span class="header-icon">📆</span>
          <span class="header-text">月榜奖励</span>
          <span class="header-tip">每月1日发放</span>
        </div>
        
        <div class="reward-list">
          <div class="reward-row first">
            <div class="row-left">
              <span class="row-medal">🥇</span>
              <span class="row-rank">第1名</span>
            </div>
            <div class="row-right">
              <span class="row-value">2000</span>
              <span class="row-unit">积分</span>
            </div>
          </div>
          <div class="reward-row second">
            <div class="row-left">
              <span class="row-medal">🥈</span>
              <span class="row-rank">第2名</span>
            </div>
            <div class="row-right">
              <span class="row-value">1000</span>
              <span class="row-unit">积分</span>
            </div>
          </div>
          <div class="reward-row third">
            <div class="row-left">
              <span class="row-medal">🥉</span>
              <span class="row-rank">第3-5名</span>
            </div>
            <div class="row-right">
              <span class="row-value">500</span>
              <span class="row-unit">积分</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 提现规则 -->
    <section class="section">
      <div class="section-title">
        <span class="title-icon">💵</span>
        <span>提现规则</span>
      </div>
      
      <div class="reward-card withdraw-card">
        <div class="withdraw-item">
          <div class="withdraw-left">
            <span class="withdraw-icon">🎯</span>
            <span class="withdraw-text">首次提现门槛</span>
          </div>
          <div class="withdraw-right">
            <span class="withdraw-value">200</span>
            <span class="withdraw-unit">积分起提</span>
          </div>
        </div>
        <div class="withdraw-divider"></div>
        <div class="withdraw-item">
          <div class="withdraw-left">
            <span class="withdraw-icon">💸</span>
            <span class="withdraw-text">积分兑换比例</span>
          </div>
          <div class="withdraw-right">
            <span class="withdraw-value">10:1</span>
            <span class="withdraw-unit">（10积分=1元）</span>
          </div>
        </div>
        <div class="withdraw-divider"></div>
        <div class="withdraw-item">
          <div class="withdraw-left">
            <span class="withdraw-icon">⏱️</span>
            <span class="withdraw-text">提现到账时间</span>
          </div>
          <div class="withdraw-right">
            <span class="withdraw-value">1-3</span>
            <span class="withdraw-unit">个工作日</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 温馨提示 -->
    <section class="section tips-section">
      <div class="tips-card">
        <h3>📌 温馨提示</h3>
        <ul>
          <li>新人奖励积分会在满足条件后自动解冻到您的账户</li>
          <li>排行榜奖励会在每周一/每月1日自动发放</li>
          <li>首次提现需满200积分，后续提现无门槛限制</li>
          <li>任务审核通过后积分实时到账</li>
          <li>如有疑问请联系客服</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup>
// 无需额外逻辑
</script>

<style scoped>
.rewards {
  padding: 16px;
  padding-bottom: 100px;
  background: #f5f5f5;
  min-height: 100vh;
}

.page-header {
  text-align: center;
  padding: 24px 0;
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
  color: #fff;
  margin: -16px -16px 16px -16px;
  border-radius: 0 0 24px 24px;
}

.page-header h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
}

.page-header .subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
}

/* 区块 */
.section {
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-left: 4px;
}

.title-icon {
  font-size: 20px;
}

.title-badge {
  margin-left: auto;
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
  color: #fff;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 500;
}

.title-badge.hot {
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  color: #5d4037;
  font-weight: 700;
  animation: glow 1.5s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
  50% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.8); }
}

.section-title.highlight-title {
  font-size: 18px;
  color: #ff6b6b;
}

/* 完成任务奖励卡片 */
.reward-card.task-card {
  background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);
  border: 2px solid #ffd700;
}

.task-reward-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 16px;
}

.big-reward {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.big-reward .big-num {
  font-size: 48px;
  font-weight: 800;
  color: #ff6b00;
  text-shadow: 0 2px 8px rgba(255, 107, 0, 0.3);
}

.big-reward .big-unit {
  font-size: 16px;
  color: #ff6b00;
  font-weight: 600;
}

.reward-desc {
  text-align: right;
}

.reward-desc p {
  margin: 0;
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.reward-desc .sub-desc {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  font-weight: 400;
}

/* 奖励卡片 */
.reward-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.reward-card.main-card {
  border: 2px solid #ff6b6b;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #fff5f5 0%, #fff 100%);
  border-bottom: 1px solid #f0f0f0;
}

.card-header.weekly {
  background: linear-gradient(135deg, #e8f5e9 0%, #fff 100%);
}

.card-header.monthly {
  background: linear-gradient(135deg, #e3f2fd 0%, #fff 100%);
}

.header-icon {
  font-size: 24px;
}

.header-text {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.header-tip {
  font-size: 11px;
  color: #999;
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 8px;
}

/* 解冻步骤 */
.unlock-steps {
  padding: 12px 16px;
}

.unlock-item {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  background: #f9f9f9;
  border-radius: 12px;
  margin-bottom: 10px;
  border-left: 4px solid #ff6b6b;
}

.unlock-item:last-child {
  margin-bottom: 0;
}

.unlock-icon {
  font-size: 24px;
  margin-right: 12px;
}

.unlock-content {
  flex: 1;
}

.unlock-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.unlock-desc {
  font-size: 12px;
  color: #999;
}

.unlock-reward {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.unlock-reward .reward-num {
  font-size: 22px;
  font-weight: 700;
  color: #ff6b6b;
}

.unlock-reward .reward-unit {
  font-size: 12px;
  color: #666;
}

.card-note {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: #fffbe6;
  font-size: 12px;
  color: #ad8b00;
}

.note-icon {
  font-size: 14px;
}

/* 奖励列表 */
.reward-list {
  padding: 12px 16px;
}

.reward-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #f9f9f9;
  border-radius: 12px;
  margin-bottom: 8px;
}

.reward-row:last-child {
  margin-bottom: 0;
}

.reward-row.first {
  border-left: 4px solid #ffd700;
}

.reward-row.second {
  border-left: 4px solid #c0c0c0;
}

.reward-row.third {
  border-left: 4px solid #cd7f32;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.row-medal {
  font-size: 20px;
}

.row-rank {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.row-right {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.row-value {
  font-size: 20px;
  font-weight: 700;
  color: #ff6b6b;
}

.row-unit {
  font-size: 12px;
  color: #666;
}

/* 提现卡片 */
.withdraw-card {
  padding: 4px 0;
}

.withdraw-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.withdraw-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.withdraw-icon {
  font-size: 20px;
}

.withdraw-text {
  font-size: 14px;
  color: #333;
}

.withdraw-right {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.withdraw-value {
  font-size: 18px;
  font-weight: 700;
  color: #3f51b5;
}

.withdraw-unit {
  font-size: 12px;
  color: #666;
}

.withdraw-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 0 16px;
}

/* 温馨提示 */
.tips-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.tips-card h3 {
  font-size: 14px;
  color: #333;
  margin: 0 0 12px 0;
}

.tips-card ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}

.tips-card li {
  margin-bottom: 4px;
}
</style>
