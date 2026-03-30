<template>
  <div class="agreement-page">
    <!-- 顶部导航 -->
    <header v-if="!embedded" class="page-header">
      <button class="back-btn" @click="goBack">
        <span class="back-icon">←</span>
      </button>
      <h1 class="page-title">用户协议</h1>
      <div class="header-placeholder"></div>
    </header>

    <!-- 协议内容 -->
    <div class="content-wrapper">
      <div class="agreement-card">
        <h2 class="main-title">小黄鱼任务中心用户服务协议</h2>
        <p class="update-date">更新日期：2026年3月15日 | 生效日期：2026年3月15日</p>

        <div class="agreement-content">
          <h3>一、总则</h3>
          <p>1.1 欢迎您使用小黄鱼任务中心（以下简称"本平台"）。为使用本平台服务，您应当阅读并遵守《小黄鱼任务中心用户服务协议》（以下简称"本协议"）。请您务必审慎阅读、充分理解各条款内容，特别是免除或限制责任的相应条款。</p>
          <p>1.2 除非您已阅读并接受本协议所有条款，否则您无权使用本平台服务。您点击"同意"或实际使用本平台服务，即视为您已阅读并同意本协议的约束。</p>
          <p>1.3 本平台有权在必要时修改本协议条款，并在本平台公布，不再单独通知您。变更后的协议一经公布即生效，并取代原协议。您可以在本平台查阅最新版本的协议条款。</p>

          <h3>二、服务内容</h3>
          <p>2.1 本平台是一个众包任务平台，连接任务发布方与兼职执行者，提供以下服务：</p>
          <ul>
            <li>任务发布与领取服务</li>
            <li>任务审核与结算服务</li>
            <li>积分奖励与提现服务</li>
            <li>推广返佣服务</li>
            <li>排行榜与等级系统</li>
          </ul>
          <p>2.2 本平台提供的任务类型为：观看视频，评论真实的视频观看感受并提交。</p>
          <p>2.3 本平台保留随时变更、中断或终止部分或全部服务的权利。</p>

          <h3>三、账号注册与使用</h3>
          <p>3.1 用户注册时，应按照注册页面提示填写真实、准确、完整的个人资料。</p>
          <p>3.2 用户应妥善保管账号及密码，因账号密码泄露造成的损失由用户自行承担。</p>
          <p>3.3 用户不得将账号转让、出借给他人使用。因账号转让、出借造成的损失，由用户自行承担。</p>
          <p>3.4 如发现账号被盗用或存在安全漏洞，应立即通知本平台。</p>

          <h4>3.5 禁止行为</h4>
          <p>用户在使用本平台服务时，不得从事以下行为：</p>
          <ul>
            <li>使用虚假身份信息注册账号</li>
            <li>冒充他人身份进行活动</li>
            <li>发布违法、虚假、欺诈性信息</li>
            <li>利用技术手段刷单、作弊、套取奖励</li>
            <li>恶意攻击平台系统或干扰正常运营</li>
            <li>传播病毒、木马或其他恶意程序</li>
            <li>侵犯他人知识产权或其他合法权益</li>
            <li>违反国家法律法规的其他行为</li>
          </ul>

          <h3>四、任务规则</h3>
          <p>4.1 任务领取规则：</p>
          <ul>
            <li>用户需满足任务的领取条件（如地域限制、等级要求等）方可领取任务</li>
            <li>同一用户对同一任务只能领取一次</li>
            <li>任务领取后有规定的时间限制，超时未提交将自动取消</li>
            <li>用户同时可领取的任务数量受等级限制</li>
          </ul>
          <p>4.2 任务提交规则：</p>
          <ul>
            <li>用户需按照任务要求完成任务并提供真实有效的证明材料</li>
            <li>提交的截图需清晰显示任务完成情况</li>
            <li>平台昵称需与提交时填写的昵称一致</li>
          </ul>
          <p>4.3 任务审核规则：</p>
          <ul>
            <li>平台将在规定时间内完成审核</li>
            <li>审核通过后积分将自动发放到用户账户</li>
            <li>审核不通过将说明原因，用户可查看审核意见</li>
          </ul>

          <h3>五、积分与提现</h3>
          <p>5.1 积分获取：</p>
          <ul>
            <li>完成任务可获得积分奖励</li>
            <li>推广新用户可获得推广积分</li>
            <li>参与平台活动可获得额外奖励</li>
          </ul>
          <p>5.2 积分使用：</p>
          <ul>
            <li>积分可兑换为余额用于提现</li>
            <li>积分兑换比例由平台设定并公布</li>
            <li>积分不可转让给其他用户</li>
          </ul>
          <p>5.3 提现规则：</p>
          <ul>
            <li>最低提现金额为10元</li>
            <li>提现申请将在1-3个工作日内处理</li>
            <li>提现可能需要支付一定手续费</li>
          </ul>

          <h3>六、推广规则</h3>
          <p>6.1 推广奖励：</p>
          <ul>
            <li>C端推广：邀请好友注册并完成任务，可获得好友任务收益的一定比例作为奖励</li>
            <li>B端推广：邀请新发布者入驻，可获得其发布任务收益的一定比例作为奖励</li>
          </ul>
          <p>6.2 推广限制：</p>
          <ul>
            <li>禁止通过虚假方式获取推广奖励</li>
            <li>禁止使用机器刷量、刷注册等作弊行为</li>
            <li>发现作弊行为将取消推广奖励并可能封禁账号</li>
          </ul>

          <h3>七、知识产权</h3>
          <p>7.1 本平台的logo、"小黄鱼"名称、界面设计等元素均为本平台所有，未经授权不得使用。</p>
          <p>7.2 用户上传的内容（如任务截图）仅用于任务审核，平台不会用于其他商业用途。</p>
          <p>7.3 用户提交的任务证明材料需确保不侵犯他人知识产权，因侵权造成的法律责任由用户自行承担。</p>

          <h3>八、免责声明</h3>
          <p>8.1 本平台不对以下情况承担责任：</p>
          <ul>
            <li>因不可抗力导致的服务中断或数据丢失</li>
            <li>因用户自身原因导致的账号损失</li>
            <li>因第三方原因导致的服务异常</li>
            <li>因用户违反协议导致的任何损失</li>
          </ul>
          <p>8.2 本平台不对任务的合法性、真实性做保证，用户需自行判断任务是否符合法律法规要求。</p>

          <h3>九、违约处理</h3>
          <p>9.1 如用户违反本协议约定，本平台有权采取以下措施：</p>
          <ul>
            <li>警告提醒</li>
            <li>限制账号功能</li>
            <li>冻结账号积分和余额</li>
            <li>封禁账号</li>
            <li>追究法律责任</li>
          </ul>
          <p>9.2 如用户行为涉嫌违法犯罪，本平台将配合司法机关进行调查。</p>

          <h3>十、协议终止</h3>
          <p>10.1 用户有权随时注销账号，注销后账号数据将被清除且无法恢复。</p>
          <p>10.2 如用户严重违反本协议，本平台有权单方面终止服务并封禁账号。</p>
          <p>10.3 协议终止后，本协议关于免责、责任限制等条款仍然有效。</p>

          <h3>十一、争议解决</h3>
          <p>11.1 本协议的解释、效力及纠纷解决，均适用中华人民共和国法律。</p>
          <p>11.2 如因本协议或本平台服务产生的任何争议，双方应友好协商解决；协商不成的，任何一方有权向本平台所在地人民法院提起诉讼。</p>

          <h3>十二、联系我们</h3>
          <p>如您对本协议有任何疑问，可通过以下方式联系我们：</p>
          <ul>
            <li>平台客服：通过APP内"我的-帮助与反馈"提交</li>
            <li>邮箱：1823985558@qq.com</li>
          </ul>

          <div class="footer-note">
            <p>本协议最终解释权归小黄鱼任务中心所有</p>
          </div>
        </div>
      </div>

      <!-- 底部导航 -->
      <div v-if="!embedded" class="bottom-nav">
        <router-link to="/agreement" class="nav-item active">用户协议</router-link>
        <router-link to="/privacy" class="nav-item">隐私政策</router-link>
        <router-link to="/task-rules" class="nav-item">任务规范</router-link>
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
.agreement-page {
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

.agreement-card {
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

.agreement-content {
  font-size: 14px;
  line-height: 1.8;
  color: #555;
}

.agreement-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 20px 0 12px;
}

.agreement-content h4 {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 16px 0 10px;
}

.agreement-content p {
  margin-bottom: 10px;
  text-align: justify;
}

.agreement-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.agreement-content li {
  margin-bottom: 6px;
  list-style-type: disc;
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
