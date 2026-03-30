<template>
  <div class="privacy-page">
    <!-- 顶部导航 -->
    <header v-if="!embedded" class="page-header">
      <button class="back-btn" @click="goBack">
        <span class="back-icon">←</span>
      </button>
      <h1 class="page-title">隐私政策</h1>
      <div class="header-placeholder"></div>
    </header>

    <!-- 协议内容 -->
    <div class="content-wrapper">
      <div class="privacy-card">
        <h2 class="main-title">小黄鱼任务中心隐私政策</h2>
        <p class="update-date">更新日期：2026年3月15日 | 生效日期：2026年3月15日</p>

        <div class="privacy-content">
          <h3>一、引言</h3>
          <p>小黄鱼任务中心（以下简称"我们"）深知个人信息对您的重要性，我们将按照法律法规要求，采取相应安全保护措施，尽力保护您的个人信息安全可控。</p>
          <p>本隐私政策旨在向您说明我们如何收集、使用、存储、共享和保护您的个人信息，以及您享有的相关权利。请您仔细阅读本隐私政策。</p>

          <h3>二、我们收集的信息</h3>
          <h4>2.1 您主动提供的信息</h4>
          <p>当您注册、使用我们的服务时，您需要向我们提供以下信息：</p>
          <ul>
            <li><strong>账户信息</strong>：用户名、密码、手机号码（可选）</li>
            <li><strong>身份信息</strong>：提现时可能需要实名认证信息</li>
            <li><strong>任务信息</strong>：平台昵称、任务截图等证明材料</li>
            <li><strong>设备信息</strong>：您领取任务时的地理位置信息（城市、省份）</li>
          </ul>

          <h4>2.2 我们自动收集的信息</h4>
          <p>当您使用我们的服务时，我们会自动收集以下信息：</p>
          <ul>
            <li><strong>设备信息</strong>：设备型号、操作系统版本、浏览器类型</li>
            <li><strong>日志信息</strong>：IP地址、访问时间、访问页面、操作记录</li>
            <li><strong>Cookie和类似技术</strong>：用于维持登录状态和优化用户体验</li>
          </ul>

          <h4>2.3 第三方来源的信息</h4>
          <p>我们可能从第三方获取您的以下信息：</p>
          <ul>
            <li>推广关系中，从邀请人处获取的关联信息</li>
            <li>第三方登录授权的基本信息（如使用第三方登录时）</li>
          </ul>

          <h3>三、我们如何使用信息</h3>
          <p>我们收集的信息将用于以下目的：</p>
          <ul>
            <li>创建和管理您的账户</li>
            <li>提供任务发布、领取、审核、结算等核心服务</li>
            <li>计算和发放积分奖励、提现处理</li>
            <li>验证您的身份和账户安全</li>
            <li>处理推广关系和发放推广奖励</li>
            <li>发送服务通知和重要公告</li>
            <li>改进产品功能和用户体验</li>
            <li>防范欺诈和安全风险</li>
            <li>遵守法律法规要求</li>
          </ul>

          <h3>四、信息存储与保护</h3>
          <h4>4.1 信息存储</h4>
          <ul>
            <li>您的个人信息存储在中华人民共和国境内的服务器上</li>
            <li>我们会采取加密等安全措施存储敏感信息</li>
            <li>我们会采取合理措施确保存储期限符合法律要求</li>
          </ul>

          <h4>4.2 安全保护措施</h4>
          <p>我们采取以下措施保护您的个人信息：</p>
          <ul>
            <li>使用bcrypt算法对密码进行加密存储</li>
            <li>使用JWT令牌进行身份认证</li>
            <li>使用HTTPS加密传输数据</li>
            <li>实施访问控制和权限管理</li>
            <li>定期进行安全审计和漏洞检测</li>
            <li>建立数据备份和灾难恢复机制</li>
          </ul>

          <h4>4.3 信息保留期限</h4>
          <ul>
            <li>账户信息：在您使用服务期间及注销后合理期限内保留</li>
            <li>任务记录：保留至任务完成后3年</li>
            <li>财务记录：保留至交易完成后5年</li>
            <li>日志信息：保留1年</li>
          </ul>

          <h3>五、信息共享与披露</h3>
          <h4>5.1 我们不会对外共享的信息</h4>
          <p>除以下情形外，我们不会向第三方共享您的个人信息：</p>
          <ul>
            <li>获得您的明确同意</li>
            <li>法律法规要求或政府机关依法要求</li>
            <li>与我们的关联公司共享（为提供服务所必需）</li>
            <li>与授权合作伙伴共享（如支付服务商、云服务提供商）</li>
          </ul>

          <h4>5.2 我们可能共享的信息类型</h4>
          <ul>
            <li>与任务发布方：任务完成证明材料</li>
            <li>与支付机构：提现所需的身份和账户信息</li>
            <li>与云服务商：为提供云服务所需的必要信息</li>
          </ul>

          <h4>5.3 我们不会公开披露的信息</h4>
          <p>除以下情形外，我们不会公开披露您的个人信息：</p>
          <ul>
            <li>获得您的明确同意</li>
            <li>法律法规要求</li>
            <li>排行榜等公开信息（仅展示用户名和排名，不涉及敏感信息）</li>
          </ul>

          <h3>六、您的权利</h3>
          <h4>6.1 访问权</h4>
          <p>您有权访问我们持有的您的个人信息，可通过"个人中心"查看账户信息、任务记录等。</p>

          <h4>6.2 更正权</h4>
          <p>您有权更正不准确的个人信息，可通过"个人设置"修改可编辑的信息。</p>

          <h4>6.3 删除权</h4>
          <p>在以下情形下，您有权要求我们删除您的个人信息：</p>
          <ul>
            <li>处理目的已实现、无法实现或不再必要</li>
            <li>我们停止提供服务或保存期限已届满</li>
            <li>您撤回同意</li>
            <li>我们违反法律法规处理您的个人信息</li>
          </ul>

          <h4>6.4 注销账户</h4>
          <p>您有权注销您的账户，注销后：</p>
          <ul>
            <li>您的个人信息将被删除或匿名化处理</li>
            <li>您将无法再使用该账户登录</li>
            <li>账户内的积分和余额将被清零且不可恢复</li>
          </ul>

          <h4>6.5 撤回同意</h4>
          <p>您有权撤回之前给予我们的同意，但不影响撤回前基于同意的处理活动的合法性。</p>

          <h3>七、未成年人保护</h3>
          <p>7.1 我们的服务主要面向成年人，不面向14周岁以下的未成年人。</p>
          <p>7.2 如果您是14周岁以上未满18周岁的未成年人，请在监护人的陪同下阅读本政策，并在取得监护人同意后使用我们的服务。</p>
          <p>7.3 如果您是未成年人的监护人，请您关注未成年人的使用行为。如发现未成年人未经授权使用我们的服务，请及时联系我们。</p>

          <h3>八、本政策的更新</h3>
          <p>8.1 我们可能适时修订本隐私政策的内容。</p>
          <p>8.2 未经您明确同意，我们不会削减您依据本隐私政策所享有的权利。</p>
          <p>8.3 对于重大变更，我们会通过站内通知、弹窗等方式告知您。</p>
          <p>8.4 若您在本政策更新后继续使用我们的服务，即表示您已阅读、理解并同意接受更新后的政策。</p>

          <h3>九、如何联系我们</h3>
          <p>如果您对本隐私政策有任何疑问、意见或建议，可通过以下方式联系我们：</p>
          <ul>
            <li>平台客服：通过APP内"我的-帮助与反馈"提交</li>
            <li>邮箱：1823985558@qq.com</li>
          </ul>
          <p>我们将在15个工作日内回复您的请求。</p>

          <h3>十、适用范围</h3>
          <p>本隐私政策适用于小黄鱼任务中心提供的所有服务。但不适用于：</p>
          <ul>
            <li>其他第三方向您提供的服务（如第三方支付）</li>
            <li>本平台中的第三方链接和内容</li>
          </ul>

          <div class="footer-note">
            <p>本隐私政策最终解释权归小黄鱼任务中心所有</p>
          </div>
        </div>
      </div>

      <!-- 底部导航 -->
      <div v-if="!embedded" class="bottom-nav">
        <router-link to="/agreement" class="nav-item">用户协议</router-link>
        <router-link to="/privacy" class="nav-item active">隐私政策</router-link>
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
.privacy-page {
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

.privacy-card {
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

.privacy-content {
  font-size: 14px;
  line-height: 1.8;
  color: #555;
}

.privacy-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 20px 0 12px;
}

.privacy-content h4 {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 16px 0 10px;
}

.privacy-content p {
  margin-bottom: 10px;
  text-align: justify;
}

.privacy-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.privacy-content li {
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
