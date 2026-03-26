import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '任务规范 - 小黄鱼任务中心',
  description: '小黄鱼任务中心任务规范与操作指南',
}

export default function TaskRulesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* 协议内容 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 md:p-12">
          <h1 className="text-2xl md:text-3xl font-bold text-center mb-2">小黄鱼任务中心任务规范</h1>
          <p className="text-center text-gray-500 mb-8">更新日期：2026年3月15日 | 生效日期：2026年3月15日</p>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <h2>一、任务概述</h2>
            <p>小黄鱼任务中心提供视频评论任务，用户通过观看视频、评论真实的视频观看感受并提交，完成任务后获得积分奖励。本规范详细说明任务的操作要求、审核标准和奖励规则。</p>

            <h2>二、任务类型</h2>
            
            <h3>视频评论任务</h3>
            <p>观看指定视频，评论真实的视频观看感受并提交截图证明。</p>
            <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="border border-gray-300 dark:border-gray-600 p-2">任务步骤</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2">操作说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">第一步</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">观看任务指定的视频内容</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">第二步</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">根据真实观看感受，撰写评论内容</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">第三步</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">提交评论截图和平台昵称</td>
                </tr>
              </tbody>
            </table>

            <h2>三、任务领取规则</h2>

            <h3>3.1 领取条件</h3>
            <ul>
              <li>账号状态正常（未被封禁）</li>
              <li>满足任务的地域限制要求</li>
              <li>满足任务的等级要求</li>
              <li>未超过同时可领取的任务数量上限</li>
              <li>未重复领取同一任务</li>
            </ul>

            <h3>3.2 等级与并发限制</h3>
            <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="border border-gray-300 dark:border-gray-600 p-2">等级</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2">名称</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2">同时可领取任务数</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2">积分系数</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">1级</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">新手体验官</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">1个</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">1.0x</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">2级</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">熟练体验官</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">2个</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">1.05x</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">3级</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">资深体验官</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">3个</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">1.1x</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">4级</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">金牌体验官</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">5个</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">1.2x</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">5级</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">钻石体验官</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">8个</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">1.3x</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">6级</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">王牌体验官</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">10个</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">1.5x</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">7级</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">皇冠体验官</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">15个</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">1.8x</td>
                </tr>
              </tbody>
            </table>

            <h3>3.3 时间限制</h3>
            <ul>
              <li>任务领取后需在规定时间内完成（默认10分钟）</li>
              <li>超时未提交的任务将自动取消</li>
              <li>超时取消的任务不计入违规，但影响信誉评分</li>
            </ul>

            <h2>四、任务提交规范</h2>

            <h3>4.1 截图要求</h3>
            <ul>
              <li><strong>清晰度</strong>：截图必须清晰可辨，无模糊、遮挡</li>
              <li><strong>完整性</strong>：需完整展示评论内容和视频信息</li>
              <li><strong>真实性</strong>：禁止使用P图、伪造截图</li>
              <li><strong>时效性</strong>：截图需为当前任务完成后的截图</li>
            </ul>

            <h3>4.2 平台昵称要求</h3>
            <ul>
              <li>提交时填写的平台昵称需与截图中的昵称一致</li>
              <li>昵称不可频繁更改，建议使用固定昵称</li>
              <li>昵称不能包含违规、广告性质的内容</li>
            </ul>

            <h3>4.3 评论内容要求</h3>
            <ul>
              <li>评论需为真实的视频观看感受，禁止抄袭、灌水</li>
              <li>评论内容需与视频内容相关，禁止无关内容</li>
              <li>评论字数需满足任务要求（如有）</li>
              <li>禁止发布广告、违规、违法内容</li>
            </ul>

            <h2>五、审核标准</h2>

            <h3>5.1 审核时间</h3>
            <ul>
              <li>普通任务：24小时内完成审核</li>
              <li>复杂任务：48小时内完成审核</li>
              <li>节假日可能会有延迟</li>
            </ul>

            <h3>5.2 审核通过标准</h3>
            <ul>
              <li>截图清晰、完整</li>
              <li>平台昵称一致</li>
              <li>评论内容真实、与视频相关</li>
              <li>符合任务具体要求</li>
            </ul>

            <h3>5.3 审核不通过原因</h3>
            <ul>
              <li>截图模糊或不完整</li>
              <li>平台昵称不一致</li>
              <li>评论内容抄袭、灌水或与视频无关</li>
              <li>使用虚假截图</li>
              <li>任务已过期</li>
            </ul>

            <h3>5.4 申诉流程</h3>
            <ul>
              <li>如对审核结果有异议，可在审核页面发起申诉</li>
              <li>申诉需提供补充说明和证明材料</li>
              <li>申诉将在3个工作日内处理</li>
              <li>申诉结果为最终结果</li>
            </ul>

            <h2>六、违规处理</h2>

            <h3>6.1 违规行为</h3>
            <ul>
              <li>提交虚假截图</li>
              <li>使用P图、伪造证明</li>
              <li>评论内容抄袭、灌水</li>
              <li>批量刷单、机器作弊</li>
              <li>利用系统漏洞获取利益</li>
              <li>恶意投诉、骚扰审核人员</li>
            </ul>

            <h3>6.2 处罚措施</h3>
            <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="border border-gray-300 dark:border-gray-600 p-2">违规类型</th>
                  <th className="border border-gray-300 dark:border-gray-600 p-2">处罚措施</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">首次提交虚假截图</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">警告，扣除当次积分</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">多次提交虚假截图</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">封禁7天</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">批量刷单/机器作弊</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">永久封禁，冻结资产</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">利用系统漏洞</td>
                  <td className="border border-gray-300 dark:border-gray-600 p-2">永久封禁，追究法律责任</td>
                </tr>
              </tbody>
            </table>

            <h2>七、积分与奖励</h2>

            <h3>7.1 积分获取</h3>
            <ul>
              <li>完成任务获得基础积分</li>
              <li>等级加成：高等级用户获得积分系数加成</li>
              <li>推广奖励：邀请好友完成任务获得返佣</li>
            </ul>

            <h3>7.2 积分兑换</h3>
            <ul>
              <li>积分可兑换为余额，兑换比例：10积分 = 1元</li>
              <li>兑换后积分清零，余额可用于提现</li>
            </ul>

            <h3>7.3 提现规则</h3>
            <ul>
              <li>最低提现金额：10元</li>
              <li>提现处理时间：1-3个工作日</li>
              <li>提现手续费：无</li>
              <li>提现方式：支付宝/微信（根据实际情况）</li>
            </ul>

            <h2>八、排行榜规则</h2>

            <h3>8.1 周榜</h3>
            <ul>
              <li>统计周期：每周一0点至周日24点</li>
              <li>排名依据：本周完成任务获得的积分</li>
              <li>奖励：前5名获得额外积分奖励</li>
              <li>奖励规则：第1名300积分，第2名100积分，第3-5名各50积分</li>
            </ul>

            <h3>8.2 月榜</h3>
            <ul>
              <li>统计周期：每月1日至月末</li>
              <li>排名依据：本月完成任务获得的积分</li>
              <li>奖励：前5名获得额外积分奖励</li>
              <li>奖励规则：第1名2000积分，第2名1000积分，第3-5名各500积分</li>
            </ul>

            <h2>九、常见问题</h2>

            <h3>Q1: 任务超时了怎么办？</h3>
            <p>任务超时会自动取消，您可以在任务大厅重新领取其他任务。建议在领取任务后尽快完成。</p>

            <h3>Q2: 审核不通过可以重新提交吗？</h3>
            <p>审核不通过的任务无法重新提交，请仔细阅读任务要求后再进行提交。</p>

            <h3>Q3: 为什么我无法领取任务？</h3>
            <p>可能的原因：</p>
            <ul>
              <li>您已达到同时可领取任务数量上限</li>
              <li>任务已被领完</li>
              <li>您不满足任务的地域限制</li>
              <li>您的账号状态异常</li>
            </ul>

            <h3>Q4: 如何提升等级？</h3>
            <p>通过完成任务积累积分和经验，达到等级要求后自动升级。等级越高，积分系数越高，同时可领取的任务数也越多。</p>

            <h3>Q5: 评论有什么要求？</h3>
            <p>评论需为真实的视频观看感受，内容需与视频相关，禁止抄袭、灌水、广告等违规内容。</p>

            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <p className="text-center text-gray-500 text-sm">
                如有疑问请联系：1823985558@qq.com
              </p>
            </div>
          </div>
        </div>

        {/* 底部导航 */}
        <div className="mt-8 flex justify-center gap-8 text-sm text-gray-500">
          <a href="/admin/agreement" className="hover:text-primary">用户协议</a>
          <a href="/admin/privacy" className="hover:text-primary">隐私政策</a>
          <a href="/admin/task-rules" className="hover:text-primary font-medium text-primary">任务规范</a>
        </div>
      </div>
    </div>
  )
}
