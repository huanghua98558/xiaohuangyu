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
        <p>每个任务的奖励在 1-200 积分之间，<strong>10积分 = 1元</strong>。只要认真做，收益可观！</p>
        
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
      
      
      <!-- 夜间加成说明 -->
      <div class="card night-bonus-card">
        <h3>🌙 夜间加成福利</h3>
        <p>在 <strong>00:00 - 06:00</strong> 夜间时段领取任务，可享受额外的积分加成！</p>
        <div class="bonus-info">
          <div class="bonus-item">
            <span class="bonus-icon">✨</span>
            <span class="bonus-text">基础加成：<strong>1.4 倍</strong></span>
          </div>
          <div class="bonus-item">
            <span class="bonus-icon">🔥</span>
            <span class="bonus-text">最高可达：<strong>1.8 倍</strong>（在线人少时）</span>
          </div>
        </div>
        <div class="bonus-example">
          <p><strong>示例：</strong>基础 10 积分的任务，夜间领取最高可得 18 积分！</p>
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
            <span class="motivation-title">夜间加成</span>
            <span class="motivation-desc">熬夜赚钱，奖励翻倍</span>
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
          <li>禁止使用虚假账号</li>
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

            <!-- 封控账号说明 -->
      <div class="warning-card block-card">
        <h3>🔒 什么是账号封控？</h3>
        <p class="block-intro">当您在抖音等平台的评论账号出现异常时，系统会检测到并提醒您。</p>
        <ul>
          <li><strong>疑似封控</strong>：系统检测到您的评论可能未被平台正常展示</li>
          <li><strong>已确认封控</strong>：您的账号在该平台已被限制评论功能</li>
        </ul>
        <div class="block-check">
          <h4>🔍 如何检查是否被封控？</h4>
          <ol>
            <li>在抖音APP中找到您刚才评论的视频</li>
            <li>查看评论区是否能找到您的评论</li>
            <li>如果找不到，可能已被平台隐藏或删除</li>
            <li>尝试用其他账号查看同一视频的评论区</li>
          </ol>
        </div>
        <div class="block-solution">
          <h4>💡 解决方法</h4>
          <ul>
            <li>更换一个正常的抖音账号继续做任务</li>
            <li>等待平台解封后再使用原账号</li>
            <li>避免发布敏感或违规内容</li>
          </ul>
        </div>
      </div>

      <!-- 系统规则说明 -->
      <div class="card rules-card">
        <h3>📋 系统规则说明</h3>
        
        <div class="rule-group">
          <h4>⏰ 任务时间限制</h4>
          <ul>
            <li><strong>任务完成时限</strong>：领取任务后需在 <strong>15分钟内</strong> 完成并提交</li>
            <li><strong>超时后果</strong>：超时未提交的任务将自动失效，需重新领取</li>
            <li><strong>时间计算</strong>：从点击"领取任务"开始计时</li>
          </ul>
        </div>
        
        <div class="rule-group">
          <h4>🔄 重试与失败规则</h4>
          <ul>
            <li><strong>审核失败</strong>：每次审核不通过会记录失败次数</li>
            <li><strong>重试次数</strong>：每个任务最多可重试 <strong>3次</strong></li>
            <li><strong>3次失败后</strong>：任务将自动释放，需重新领取新任务</li>
            <li><strong>失败原因</strong>：可在任务详情中查看具体失败原因</li>
          </ul>
        </div>
        
        <div class="rule-group">
          <h4>📦 任务数量限制</h4>
          <ul>
            <li><strong>同时进行</strong>：根据等级可同时持有 <strong>3-20个</strong> 进行中任务</li>
            <li><strong>等级限制</strong>：
              <ul>
                <li>1级新手：3个任务</li>
                <li>2级熟练：5个任务</li>
                <li>3级资深：8个任务</li>
                <li>4级金牌：10个任务</li>
                <li>5级钻石：13个任务</li>
                <li>6级王牌：16个任务</li>
                <li>7级皇冠：20个任务</li>
              </ul>
            </li>
          </ul>
          <p class="rule-tip">💡 提升等级可以增加同时进行的任务数量，提高收益效率！</p>
        </div>
        
        <div class="rule-group">
          <h4>⭐ 信用分系统</h4>
          <ul>
            <li><strong>优秀 (90-100分)</strong>：审核优先通过，享受更多权益</li>
            <li><strong>良好 (70-89分)</strong>：正常审核流程</li>
            <li><strong>一般 (50-69分)</strong>：加强审核，建议提升任务质量</li>
            <li><strong>风险 (0-49分)</strong>：需人工审核，多次作弊可能封号</li>
          </ul>
          <p class="rule-tip">💡 保持高通过率可提升信用分，享受更快审核</p>
        </div>
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
      <h2 class="section-title">📞 联系我们</h2>
      <p class="contact-text">如有任何问题，欢迎加入QQ群或联系客服</p>
      <div class="contact-methods">
        <div class="contact-item qq-group" @click="copyQQGroup">
          <span class="contact-icon">👥</span>
          <div class="contact-info">
            <span class="contact-label">QQ群</span>
            <span class="contact-value">1041381597</span>
            <span class="contact-tip">点击复制群号</span>
          </div>
        </div>
        <div class="contact-item">
          <span class="contact-icon">📧</span>
          <div class="contact-info">
            <span class="contact-label">反馈邮箱</span>
            <span class="contact-value">1823985558@qq.com</span>
          </div>
        </div>
      </div>
      <div class="qq-qr-tip">
        <img src="/qq-group-qr.jpg" alt="QQ群二维码" class="qq-qr-img" />
        <p class="qr-title">扫码加入QQ群</p>
        <p class="qr-desc">获取最新任务通知和活动福利</p>
        <p class="qr-note">QQ群号：1041381597</p>
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
  padding: 20px 0 14px;
  background: transparent;
  margin: 0 0 18px;
  border-radius: 0;
  box-shadow: none;
}

.page-header h1 {
  font-size: 24px;
  margin: 0 0 4px 0;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #1a2332;
}

.page-header .subtitle {
  font-size: 12px;
  opacity: 0.85;
  margin: 0;
  font-weight: 500;
  color: #8b95a5;
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
  font-size: 15px;
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
  font-size: 15px;
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
  font-size: 15px;
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

.highlight-time {
  color: #ef4444;
  font-size: 15px;
}

.time-section {
  margin-bottom: 16px;
}

.time-section:last-child {
  margin-bottom: 0;
}

.time-section h4 {
  font-size: 13px;
  color: #374151;
  margin: 0 0 8px 0;
}

.time-warning {
  font-size: 11px;
  color: #dc2626;
  background: #fef2f2;
  padding: 8px 10px;
  border-radius: 6px;
  margin: 10px 0 0 0;
}

.review-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
  font-size: 12px;
  color: #4b5563;
  line-height: 2;
}

.review-list li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-pass {
  color: #059669;
  font-weight: 500;
}

.status-fail {
  color: #dc2626;
  font-weight: 500;
}

.status-pending {
  color: #d97706;
  font-weight: 500;
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
  font-size: 15px;
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
  font-size: 15px;
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
  font-size: 15px;
  color: #333;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.contact-icon {
  font-size: 24px;
}

.contact-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.contact-label {
  font-size: 12px;
  color: #999;
}

.contact-value {
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.contact-tip {
  font-size: 10px;
  color: #3f51b5;
}

.qq-group {
  cursor: pointer;
  transition: all 0.2s;
}

.qq-group:active {
  transform: scale(0.98);
  background: #e3f2fd;
}

.qq-qr-tip {
  margin-top: 20px;
  padding: 20px 16px;
  background: #fff;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.qq-qr-img {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  border: 3px solid #f0f0f0;
}

.qr-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0 0 6px 0;
}

.qr-desc {
  font-size: 13px;
  color: #666;
  margin: 0 0 10px 0;
}

.qr-note {
  font-size: 15px;
  color: #3f51b5;
  font-weight: 600;
  background: #e8eaf6;
  padding: 8px 16px;
  border-radius: 20px;
  display: inline-block;
  margin: 0;
}

/* 夜间加成卡片 */
.night-bonus-card {
  background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%);
  color: #fff;
}

.night-bonus-card h3 {
  color: #fff;
}

.night-bonus-card p {
  color: rgba(255, 255, 255, 0.9);
}

.bonus-info {
  display: flex;
  gap: 16px;
  margin: 12px 0;
}

.bonus-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bonus-icon {
  font-size: 16px;
}

.bonus-text {
  font-size: 13px;
}

.bonus-example {
  background: rgba(255, 255, 255, 0.1);
  padding: 10px 12px;
  border-radius: 8px;
  margin-top: 12px;
}

.bonus-example p {
  font-size: 12px;
  color: #ffd54f;
  margin: 0;
}

/* 封控卡片 */
.block-card {
  background: #fff3e0;
  border-left-color: #ff9800;
}

.block-card h3 {
  color: #e65100;
}

.block-card h4 {
  font-size: 13px;
  color: #e65100;
  margin: 12px 0 6px 0;
}

.block-intro {
  color: #666;
  margin-bottom: 8px;
}

.block-check ol,
.block-solution ul {
  margin: 6px 0 0 0;
  padding-left: 20px;
  font-size: 12px;
  color: #666;
  line-height: 1.8;
}

/* 系统规则卡片 */
.rules-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ed 100%);
  border: 1px solid #d1d5db;
}

.rules-card h3 {
  color: #1f2937;
  font-size: 16px;
  margin-bottom: 16px;
}

.rule-group {
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
}

.rule-group:last-child {
  margin-bottom: 0;
}

.rule-group h4 {
  font-size: 15px;
  color: #374151;
  margin: 0 0 8px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
}

.rule-group ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #4b5563;
  line-height: 1.8;
}

.rule-group li {
  margin-bottom: 4px;
}

.rule-tip {
  margin: 8px 0 0 0;
  padding: 8px 10px;
  background: #ecfdf5;
  border-radius: 6px;
  font-size: 11px;
  color: #059669;
}
</style>
