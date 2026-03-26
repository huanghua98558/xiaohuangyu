<template>
  <div class="tutorial">
    <header class="page-header">
      <h1>📚 任务教学</h1>
      <p class="subtitle">新手必看，快速上手赚积分</p>
    </header>

    <!-- 快速入口 -->
    <section class="quick-start">
      <div class="quick-item" @click="scrollToSection('guide')">
        <span class="quick-icon">🎓</span>
        <span>新手指南</span>
      </div>
      <div class="quick-item" @click="scrollToSection('steps')">
        <span class="quick-icon">📝</span>
        <span>操作步骤</span>
      </div>
      <div class="quick-item" @click="scrollToSection('tips')">
        <span class="quick-icon">💡</span>
        <span>注意事项</span>
      </div>
      <div class="quick-item" @click="scrollToSection('faq')">
        <span class="quick-icon">❓</span>
        <span>常见问题</span>
      </div>
    </section>

    <!-- 新手指南 -->
    <section id="guide" class="section">
      <h2 class="section-title">🎓 新手指南</h2>
      <div class="card">
        <h3>什么是小黄鱼任务中心？</h3>
        <p>小黄鱼任务中心是一个众包任务平台，连接企业任务发布方与兼职执行者。您可以通过完成简单的任务，视频体验官观看视频并给出你最真实的评价，赚取积分，积分可以兑换现金提现或兑换商城商品。</p>
      </div>
      <div class="card income-card">
        <h3>💰 我能赚多少钱？</h3>
        <p>每个任务的奖励在 10-100 积分之间，<strong>10积分 = 1元</strong>。只要认真做，收益可观！</p>
        
        <div class="income-levels">
          <div class="level-item beginner">
            <div class="level-header">
              <span class="level-badge">入门</span>
              <span class="level-title">新手起步</span>
            </div>
            <div class="level-points">500-1000 积分/天</div>
            <div class="level-money">≈ ¥50-100/天</div>
            <div class="level-desc">熟悉流程，慢慢积累</div>
          </div>
          
          <div class="level-item normal">
            <div class="level-header">
              <span class="level-badge">一般</span>
              <span class="level-title">稳定收入</span>
            </div>
            <div class="level-points">1000-2000 积分/天</div>
            <div class="level-money">≈ ¥100-200/天</div>
            <div class="level-desc">掌握技巧，效率提升</div>
          </div>
          
          <div class="level-item excellent">
            <div class="level-header">
              <span class="level-badge">优秀</span>
              <span class="level-title">收入达人</span>
            </div>
            <div class="level-points">3000-4000 积分/天</div>
            <div class="level-money">≈ ¥300-400/天</div>
            <div class="level-desc">熟练操作，任务不断</div>
          </div>
        </div>
        
        <div class="income-highlight">
          <div class="highlight-row">
            <span class="highlight-label">月收入预估（一般水平）</span>
            <span class="highlight-value">¥3,000 - ¥6,000</span>
          </div>
          <div class="highlight-row">
            <span class="highlight-label">月收入预估（优秀达人）</span>
            <span class="highlight-value highlight-hot">¥9,000 - ¥12,000</span>
          </div>
        </div>
      </div>
      
      <div class="card motivation-card">
        <h3>🔥 为什么选择小黄鱼？</h3>
        <div class="motivation-grid">
          <div class="motivation-item">
            <span class="motivation-icon">⏰</span>
            <span class="motivation-title">时间自由</span>
            <span class="motivation-desc">随时随地，想赚就赚</span>
          </div>
          <div class="motivation-item">
            <span class="motivation-icon">📱</span>
            <span class="motivation-title">操作简单</span>
            <span class="motivation-desc">看视频写评论，轻松完成</span>
          </div>
          <div class="motivation-item">
            <span class="motivation-icon">💸</span>
            <span class="motivation-title">提现快速</span>
            <span class="motivation-desc">积少成多，随时提现</span>
          </div>
          <div class="motivation-item">
            <span class="motivation-icon">📈</span>
            <span class="motivation-title">上不封顶</span>
            <span class="motivation-desc">多劳多得，收入无上限</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 操作步骤 -->
    <section id="steps" class="section">
      <h2 class="section-title">📝 操作步骤</h2>
      
      <div class="step-card">
        <div class="step-num">1</div>
        <div class="step-content">
          <h3>浏览任务大厅</h3>
          <p>进入"任务"页面，查看可领取的视频评论任务。系统会根据您的位置自动筛选出您可接的任务。</p>
          <div class="tip">💡 任务类型：观看指定视频，提交真实评价截图</div>
        </div>
      </div>

      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-content">
          <h3>领取任务</h3>
          <p>点击感兴趣的任务，查看任务详情。确认后点击"领取任务"按钮。</p>
          <div class="tip">⚠️ 领取后请在规定时间内完成，超时任务将自动失效</div>
        </div>
      </div>

      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-content">
          <h3>观看视频并评论</h3>
          <p>复制任务中的视频链接，在对应平台打开观看视频，然后发表真实的观看感受。</p>
          <ul class="task-examples">
            <li>点击"一键复制链接"按钮</li>
            <li>在抖音/快手/视频号等APP中打开</li>
            <li>认真观看视频内容</li>
            <li>在评论区发表真实的评价</li>
          </ul>
        </div>
      </div>

      <div class="step-card">
        <div class="step-num">4</div>
        <div class="step-content">
          <h3>提交截图凭证</h3>
          <p>评论成功后，截取包含您评论的截图，返回平台提交。</p>
          <div class="screenshot-guide">
            <div class="screenshot-item">
              <span class="screenshot-icon">📸</span>
              <span>确保截图包含视频标题或链接信息</span>
            </div>
            <div class="screenshot-item">
              <span class="screenshot-icon">📸</span>
              <span>确保您的评论内容清晰可见</span>
            </div>
            <div class="screenshot-item">
              <span class="screenshot-icon">📸</span>
              <span>确保您的平台昵称显示在截图中</span>
            </div>
          </div>
        </div>
      </div>

      <div class="step-card">
        <div class="step-num">5</div>
        <div class="step-content">
          <h3>等待审核</h3>
          <p>提交后等待审核员审核。审核通过后积分将自动发放到您的账户。</p>
          <div class="tip">✅ 通常在24小时内完成审核，节假日可能稍有延迟</div>
        </div>
      </div>

      <div class="step-card">
        <div class="step-num">6</div>
        <div class="step-content">
          <h3>提现收益</h3>
          <p>积分累计后，进入"我的"→"提现中心"申请提现，支持微信、支付宝等方式。</p>
          <div class="tip">⚠️ 首次提现需满200积分，后续提现无门槛限制</div>
          <div class="tip" style="margin-top:8px;">💡 10积分 = 1元，提现后1-3个工作日到账</div>
        </div>
      </div>
    </section>

    <!-- 注意事项 -->
    <section id="tips" class="section">
      <h2 class="section-title">💡 注意事项</h2>
      
      <div class="warning-card">
        <h3>🚫 禁止行为</h3>
        <ul>
          <li>禁止使用机器人、脚本等自动化工具</li>
          <li>禁止使用虚假账号或小号</li>
          <li>禁止提交伪造截图或他人截图</li>
          <li>禁止恶意刷单或刷评</li>
          <li>禁止在评论区发布广告或无关内容</li>
        </ul>
        <p class="warning-text">违规行为将导致账号封禁，积分清零，严重者将追究法律责任。</p>
      </div>

      <div class="success-card">
        <h3>✅ 正确做法</h3>
        <ul>
          <li>使用真实账号完成任务</li>
          <li>按照任务要求认真完成</li>
          <li>提交清晰、完整的截图</li>
          <li>在规定时间内完成任务</li>
          <li>有疑问及时联系客服</li>
        </ul>
      </div>

      <div class="card">
        <h3>⏰ 时间限制说明</h3>
        <p>每个任务都有完成时限，请在领取后尽快完成：</p>
        <table class="time-table">
          <tr>
            <th>任务类型</th>
            <th>完成时限</th>
          </tr>
          <tr>
            <td>视频评论任务</td>
            <td>10-30分钟</td>
          </tr>
        </table>
        <p style="margin-top:12px;font-size:13px;color:#666;">建议领取任务后立即完成，避免超时失效。</p>
      </div>
    </section>

    <!-- 常见问题 -->
    <section id="faq" class="section">
      <h2 class="section-title">❓ 常见问题</h2>
      
      <div class="faq-item" v-for="(faq, index) in faqList" :key="index">
        <div class="faq-q" @click="toggleFaq(index)">
          <span class="faq-icon">{{ faq.open ? '▼' : '▶' }}</span>
          <span>{{ faq.question }}</span>
        </div>
        <div class="faq-a" v-show="faq.open">
          <p>{{ faq.answer }}</p>
        </div>
      </div>
    </section>

    <!-- 联系客服 -->
    <section class="section contact">
      <h2 class="section-title">💬 还有疑问？</h2>
      <p class="contact-text">如有其他问题，请联系客服：</p>
      <div class="contact-methods">
        <div class="contact-item">
          <span class="contact-icon">📧</span>
          <span>客服邮箱：support@xiaohuangyu.com</span>
        </div>
        <div class="contact-item">
          <span class="contact-icon">💬</span>
          <span>QQ群：123456789</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const faqList = ref([
  {
    question: '为什么我看不到任务？',
    answer: '任务可能已被其他人领取完毕，或者您的位置不在任务要求的地区范围内。系统会根据您的位置自动筛选可接任务，同城市最多1人、同省份最多4人可以看到同一个任务。',
    open: false
  },
  {
    question: '任务审核多久通过？',
    answer: '一般情况下，任务会在提交后24小时内完成审核。审核结果将通过系统通知告知您。如超过24小时仍未审核，请联系客服。',
    open: false
  },
  {
    question: '任务被拒绝怎么办？',
    answer: '如果任务被拒绝，请查看拒绝原因。常见原因包括：截图不清晰、评论内容与视频不符、未显示平台昵称等。您可以在"我的任务"中查看具体原因并重新提交。',
    open: false
  },
  {
    question: '如何提现？',
    answer: '进入"我的"→"提现中心"，绑定您的收款账号后即可申请提现。首次提现需满200积分，后续提现无门槛限制。提现申请提交后，通常在1-3个工作日内到账。',
    open: false
  },
  {
    question: '积分有什么用？',
    answer: '积分可以直接提现为现金，10积分 = 1元人民币。一般人每天能赚100-200元，优秀达人每天300-400元！',
    open: false
  },
  {
    question: '评论有什么要求？',
    answer: '评论需要是您观看视频后的真实感受，内容要真实、有价值。禁止发布无关内容、广告、或复制粘贴的重复评论。评论审核时会核对截图中的内容。',
    open: false
  },
  {
    question: '如何提高任务通过率？',
    answer: '1. 认真观看视频内容；2. 写出真实的观看感受；3. 确保截图清晰完整，包含评论内容和昵称；4. 截图中要能看出是哪个视频；5. 有疑问先咨询客服。',
    open: false
  }
])

function toggleFaq(index) {
  faqList.value[index].open = !faqList.value[index].open
}

function scrollToSection(id) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<style scoped>
.tutorial {
  padding: 16px;
  padding-bottom: 100px;
  background: #f5f5f5;
}

.page-header {
  text-align: center;
  padding: 20px 0;
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
  margin: -16px -16px 16px -16px;
  border-radius: 0 0 20px 20px;
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

/* 快速入口 */
.quick-start {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.quick-item {
  background: #fff;
  padding: 12px 8px;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.quick-item:active {
  transform: scale(0.95);
}

.quick-icon {
  display: block;
  font-size: 24px;
  margin-bottom: 4px;
}

.quick-item span:last-child {
  font-size: 11px;
  color: #666;
}

/* 区块 */
.section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px 0;
  padding-left: 8px;
  border-left: 3px solid #3f51b5;
}

/* 卡片 */
.card {
  background: #fff;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.card h3 {
  font-size: 15px;
  color: #333;
  margin: 0 0 8px 0;
}

.card p {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin: 0;
}

.highlight {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background: #fff8e1;
  border-radius: 8px;
  font-size: 13px;
  color: #f57c00;
}

/* 收益卡片样式 */
.income-card {
  background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);
  border: 2px solid #ffd700;
}

.income-card h3 {
  color: #f57c00;
  font-size: 16px;
}

.income-levels {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}

.level-item {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  overflow: hidden;
}

.level-item.beginner {
  border-left: 4px solid #4caf50;
}

.level-item.normal {
  border-left: 4px solid #2196f3;
}

.level-item.excellent {
  border-left: 4px solid #ff9800;
  background: linear-gradient(135deg, #fff 0%, #fff8e1 100%);
}

.level-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.level-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.level-item.beginner .level-badge {
  background: #e8f5e9;
  color: #2e7d32;
}

.level-item.normal .level-badge {
  background: #e3f2fd;
  color: #1565c0;
}

.level-item.excellent .level-badge {
  background: #fff3e0;
  color: #e65100;
}

.level-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.level-points {
  font-size: 12px;
  color: #666;
}

.level-money {
  font-size: 18px;
  font-weight: 700;
  color: #f57c00;
}

.level-item.excellent .level-money {
  color: #e65100;
  font-size: 20px;
}

.level-desc {
  font-size: 11px;
  color: #999;
}

.income-highlight {
  margin-top: 16px;
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  border-radius: 12px;
  padding: 16px;
}

.highlight-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.highlight-row:first-child {
  border-bottom: 1px solid rgba(255,255,255,0.2);
}

.highlight-label {
  font-size: 13px;
  color: rgba(255,255,255,0.9);
}

.highlight-value {
  font-size: 18px;
  font-weight: 700;
  color: #ffd700;
}

.highlight-value.highlight-hot {
  font-size: 20px;
  color: #ffeb3b;
  text-shadow: 0 0 10px rgba(255,235,59,0.5);
}

/* 激励卡片样式 */
.motivation-card {
  background: linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%);
  border: none;
}

.motivation-card h3 {
  color: #3f51b5;
  font-size: 16px;
}

.motivation-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.motivation-item {
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.motivation-icon {
  font-size: 24px;
}

.motivation-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.motivation-desc {
  font-size: 11px;
  color: #666;
}

/* 步骤卡片 */
.step-card {
  display: flex;
  gap: 12px;
  background: #fff;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.step-num {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-content h3 {
  font-size: 15px;
  color: #333;
  margin: 0 0 6px 0;
}

.step-content p {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
  margin: 0 0 8px 0;
}

.tip {
  font-size: 12px;
  color: #3f51b5;
  background: #e8eaf6;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 8px;
}

.task-examples {
  margin: 8px 0 0 0;
  padding-left: 20px;
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}

.screenshot-guide {
  margin-top: 10px;
}

.screenshot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  color: #666;
  border-bottom: 1px solid #f0f0f0;
}

.screenshot-item:last-child {
  border-bottom: none;
}

.screenshot-icon {
  font-size: 16px;
}

/* 警告卡片 */
.warning-card {
  background: #ffebee;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  border-left: 4px solid #f44336;
}

.warning-card h3 {
  font-size: 15px;
  color: #c62828;
  margin: 0 0 8px 0;
}

.warning-card ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}

.warning-text {
  font-size: 12px;
  color: #c62828;
  margin-top: 10px;
  font-weight: 500;
}

/* 成功卡片 */
.success-card {
  background: #e8f5e9;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  border-left: 4px solid #4caf50;
}

.success-card h3 {
  font-size: 15px;
  color: #2e7d32;
  margin: 0 0 8px 0;
}

.success-card ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}

/* 时间表格 */
.time-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 13px;
}

.time-table th,
.time-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.time-table th {
  color: #333;
  font-weight: 500;
}

.time-table td {
  color: #666;
}

/* FAQ */
.faq-item {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.faq-q {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.faq-icon {
  font-size: 12px;
  color: #3f51b5;
}

.faq-a {
  padding: 0 16px 14px 36px;
}

.faq-a p {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin: 0;
}

/* 联系方式 */
.contact {
  text-align: center;
}

.contact-text {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
}

.contact-methods {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contact-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #fff;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 14px;
  color: #333;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.contact-icon {
  font-size: 20px;
}
</style>
