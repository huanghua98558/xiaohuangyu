<template>
  <div class="task-rules-page">
    <!-- 顶部导航 -->
    <header v-if="!embedded" class="page-header">
      <button class="back-btn" @click="goBack">
        <span class="back-icon">←</span>
      </button>
      <h1 class="page-title">任务规范</h1>
      <div class="header-placeholder"></div>
    </header>

    <!-- 协议内容 -->
    <div class="content-wrapper">
      <div class="rules-card">
        <h2 class="main-title">小黄鱼任务中心任务规范</h2>
        <p class="update-date">更新日期：2026年3月15日 | 生效日期：2026年3月15日</p>

        <div class="rules-content">
          <h3>一、任务概述</h3>
          <p>小黄鱼任务中心提供视频评论任务，用户通过观看视频、评论真实的视频观看感受并提交，完成任务后获得积分奖励。本规范详细说明任务的操作要求、审核标准和奖励规则。</p>

          <h3>二、任务类型</h3>
          <h4>视频评论任务</h4>
          <p>观看指定视频，评论真实的视频观看感受并提交截图证明。</p>
          <table class="rules-table">
            <thead>
              <tr>
                <th>任务步骤</th>
                <th>操作说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>第一步</td>
                <td>观看任务指定的视频内容</td>
              </tr>
              <tr>
                <td>第二步</td>
                <td>根据真实观看感受，撰写评论内容</td>
              </tr>
              <tr>
                <td>第三步</td>
                <td>提交评论截图和平台昵称</td>
              </tr>
            </tbody>
          </table>

          <h3>三、任务领取规则</h3>
          <h4>3.1 领取条件</h4>
          <ul>
            <li>账号状态正常（未被封禁）</li>
            <li>满足任务的地域限制要求</li>
            <li>满足任务的等级要求</li>
            <li>未超过同时可领取的任务数量上限</li>
            <li>未重复领取同一任务</li>
          </ul>

          <h4>3.2 等级与并发限制</h4>
          <table class="rules-table">
            <thead>
              <tr>
                <th>等级</th>
                <th>名称</th>
                <th>同时可领取任务数</th>
                <th>积分系数</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1级</td>
                <td>新手体验官</td>
                <td>3个</td>
                <td>1.0x</td>
              </tr>
              <tr>
                <td>2级</td>
                <td>熟练体验官</td>
                <td>5个</td>
                <td>1.05x</td>
              </tr>
              <tr>
                <td>3级</td>
                <td>资深体验官</td>
                <td>8个</td>
                <td>1.1x</td>
              </tr>
              <tr>
                <td>4级</td>
                <td>金牌体验官</td>
                <td>10个</td>
                <td>1.2x</td>
              </tr>
              <tr>
                <td>5级</td>
                <td>钻石体验官</td>
                <td>13个</td>
                <td>1.3x</td>
              </tr>
              <tr>
                <td>6级</td>
                <td>王牌体验官</td>
                <td>16个</td>
                <td>1.5x</td>
              </tr>
              <tr>
                <td>7级</td>
                <td>皇冠体验官</td>
                <td>20个</td>
                <td>1.8x</td>
              </tr>
            </tbody>
          </table>

          <h4>3.3 时间限制</h4>
          <ul>
            <li>任务领取后需在规定时间内完成（默认15分钟）</li>
            <li>超时未提交的任务将自动取消</li>
            <li>超时取消的任务不计入违规，但影响信誉评分</li>
          </ul>

          <h3>四、任务提交规范</h3>
          <h4>4.1 截图要求</h4>
          <ul>
            <li><strong>清晰度</strong>：截图必须清晰可辨，无模糊、遮挡</li>
            <li><strong>完整性</strong>：需完整展示评论内容和视频信息</li>
            <li><strong>真实性</strong>：禁止使用P图、伪造截图</li>
            <li><strong>时效性</strong>：截图需为当前任务完成后的截图</li>
          </ul>

          <h4>4.2 平台昵称要求</h4>
          <ul>
            <li>提交时填写的平台昵称需与截图中的昵称一致</li>
            <li>昵称不可频繁更改，建议使用固定昵称</li>
            <li>昵称不能包含违规、广告性质的内容</li>
          </ul>

          <h4>4.3 评论内容要求</h4>
          <ul>
            <li>评论需为真实的视频观看感受，禁止抄袭、灌水</li>
            <li>评论内容需与视频内容相关，禁止无关内容</li>
            <li>评论字数需满足任务要求（如有）</li>
            <li>禁止发布广告、违规、违法内容</li>
          </ul>

          <h3>五、审核标准</h3>
          <h4>5.1 审核时间</h4>
          <ul>
            <li>普通任务：24小时内完成审核</li>
            <li>复杂任务：48小时内完成审核</li>
            <li>节假日可能会有延迟</li>
          </ul>

          <h4>5.2 审核通过标准</h4>
          <ul>
            <li>截图清晰、完整</li>
            <li>平台昵称一致</li>
            <li>评论内容真实、与视频相关</li>
            <li>符合任务具体要求</li>
          </ul>

          <h4>5.3 审核不通过原因</h4>
          <ul>
            <li>截图模糊或不完整</li>
            <li>平台昵称不一致</li>
            <li>评论内容抄袭、灌水或与视频无关</li>
            <li>使用虚假截图</li>
            <li>任务已过期</li>
          </ul>

          <h4>5.4 申诉流程</h4>
          <ul>
            <li>如对审核结果有异议，可在审核页面发起申诉</li>
            <li>申诉需提供补充说明和证明材料</li>
            <li>申诉将在3个工作日内处理</li>
            <li>申诉结果为最终结果</li>
          </ul>

          <h3>六、违规处理</h3>
          <h4>6.1 违规行为</h4>
          <ul>
            <li>提交虚假截图</li>
            <li>使用P图、伪造证明</li>
            <li>评论内容抄袭、灌水</li>
            <li>批量刷单、机器作弊</li>
            <li>利用系统漏洞获取利益</li>
            <li>恶意投诉、骚扰审核人员</li>
          </ul>

          <h4>6.2 处罚措施</h4>
          <table class="rules-table">
            <thead>
              <tr>
                <th>违规类型</th>
                <th>处罚措施</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>首次提交虚假截图</td>
                <td>警告，扣除当次积分</td>
              </tr>
              <tr>
                <td>多次提交虚假截图</td>
                <td>封禁7天</td>
              </tr>
              <tr>
                <td>批量刷单/机器作弊</td>
                <td>永久封禁，冻结资产</td>
              </tr>
              <tr>
                <td>利用系统漏洞</td>
                <td>永久封禁，追究法律责任</td>
              </tr>
            </tbody>
          </table>

          <h3>七、积分与奖励</h3>
          <h4>7.1 积分获取</h4>
          <ul>
            <li>完成任务获得基础积分</li>
            <li>等级加成：高等级用户获得积分系数加成</li>
            <li>推广奖励：邀请好友完成任务获得返佣</li>
          </ul>

          <h4>7.2 积分兑换</h4>
          <ul>
            <li>积分可兑换为余额，兑换比例：10积分 = 1元</li>
            <li>兑换后积分清零，余额可用于提现</li>
          </ul>

          <h4>7.3 提现规则</h4>
          <ul>
            <li>最低提现金额：10元</li>
            <li>提现处理时间：1-3个工作日</li>
            <li>提现手续费：无</li>
            <li>提现方式：支付宝/微信（根据实际情况）</li>
          </ul>

          <h3>八、排行榜规则</h3>
          <h4>8.1 周榜</h4>
          <ul>
            <li>统计周期：每周一0点至周日24点</li>
            <li>排名依据：本周完成任务获得的积分</li>
            <li>奖励：前10名获得额外积分奖励</li>
          </ul>

          <h4>8.2 月榜</h4>
          <ul>
            <li>统计周期：每月1日至月末</li>
            <li>排名依据：本月完成任务获得的积分</li>
            <li>奖励：前50名获得额外积分奖励</li>
          </ul>

          <h3>九、常见问题</h3>
          <h4>Q1: 任务超时了怎么办？</h4>
          <p>任务超时会自动取消，您可以在任务大厅重新领取其他任务。建议在领取任务后尽快完成。</p>

          <h4>Q2: 审核不通过可以重新提交吗？</h4>
          <p>审核不通过的任务无法重新提交，请仔细阅读任务要求后再进行提交。</p>

          <h4>Q3: 为什么我无法领取任务？</h4>
          <p>可能的原因：</p>
          <ul>
            <li>您已达到同时可领取任务数量上限</li>
            <li>任务已被领完</li>
            <li>您不满足任务的地域限制</li>
            <li>您的账号状态异常</li>
          </ul>

          <h4>Q4: 如何提升等级？</h4>
          <p>通过完成任务积累积分和经验，达到等级要求后自动升级。等级越高，积分系数越高，同时可领取的任务数也越多。</p>

          <h4>Q5: 评论有什么要求？</h4>
          <p>评论需为真实的视频观看感受，内容需与视频相关，禁止抄袭、灌水、广告等违规内容。</p>

          <div class="footer-note">
            <p>如有疑问请联系：1823985558@qq.com</p>
          </div>
        </div>
      </div>

      <!-- 底部导航 -->
      <div v-if="!embedded" class="bottom-nav">
        <router-link to="/agreement" class="nav-item">用户协议</router-link>
        <router-link to="/privacy" class="nav-item">隐私政策</router-link>
        <router-link to="/task-rules" class="nav-item active">任务规范</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  embedded: { type: Boolean, default: false },
})

const router = useRouter()

const goBack = () => {
  if (props.embedded) return
  router.back()
}
</script>

<style scoped>
.task-rules-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  font-size: 20px;
  color: #333;
  cursor: pointer;
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.header-placeholder {
  width: 36px;
}

.content-wrapper {
  height: calc(100vh - 60px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px;
  padding-bottom: 80px;
}

.rules-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.main-title {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  color: #333;
  margin-bottom: 8px;
}

.update-date {
  text-align: center;
  color: #999;
  font-size: 13px;
  margin-bottom: 24px;
}

.rules-content {
  font-size: 14px;
  line-height: 1.8;
  color: #555;
}

.rules-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 20px 0 12px;
}

.rules-content h4 {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 16px 0 10px;
}

.rules-content p {
  margin-bottom: 10px;
  text-align: justify;
}

.rules-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.rules-content li {
  margin-bottom: 6px;
  list-style-type: disc;
}

.rules-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 13px;
}

.rules-table th,
.rules-table td {
  border: 1px solid #e0e0e0;
  padding: 8px 10px;
  text-align: left;
}

.rules-table th {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
}

.rules-table td {
  color: #555;
}

.footer-note {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #eee;
  text-align: center;
}

.footer-note p {
  font-size: 12px;
  color: #999;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 16px;
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 100;
}

.nav-item {
  font-size: 14px;
  color: #666;
  text-decoration: none;
}

.nav-item.active {
  color: #7c6aef;
  font-weight: 500;
}
</style>
