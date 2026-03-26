var W=(n,u,a)=>new Promise((x,y)=>{var $=f=>{try{t(a.next(f))}catch(b){y(b)}},k=f=>{try{t(a.throw(f))}catch(b){y(b)}},t=f=>f.done?x(f.value):Promise.resolve(f.value).then($,k);t((a=a.apply(n,u)).next())});import{_ as z,a as l,c as p,A as X,b as s,t as v,h as c,y as F,e as q,R as Y,S as Z,J as w,o as ss,q as es,s as o,x as h,j as d,i as m,k as T,T as ts,U as as,E as ls,V as ns,W as is,r as g,n as os,u as ds}from"./index-DC7KCbpO.js";import{u as cs}from"./auth-CtuJPw5f.js";import{g as rs}from"./signIn--espEW-X.js";import{g as ps}from"./achievement-tP9LH7uq.js";const us={class:"user-profile-card"},vs={class:"user-header"},ms={class:"avatar-wrapper"},fs={class:"avatar"},gs={class:"avatar-emoji"},ks={key:0,class:"level-badge"},hs={class:"level-icon"},ys={class:"user-info"},bs={class:"username"},ws={class:"user-role"},xs={key:0,class:"coefficient-tag"},$s={class:"action-slot"},qs={class:"user-stats"},Is={class:"stat-item"},_s={class:"stat-content"},Ts={class:"stat-value"},Cs={class:"stat-item"},Ls={class:"stat-content"},Ss={class:"stat-value"},Vs={key:0,class:"stat-divider"},Ns={key:1,class:"stat-item"},Ms={class:"stat-content"},js={class:"stat-value"},As={key:0,class:"level-progress"},Bs={class:"progress-header"},Ps={class:"progress-label"},Us={class:"progress-percent"},Es={class:"progress-bar-wrapper"},Os={class:"progress-bar"},Ds={key:1,class:"max-level-badge"},Hs={__name:"UserProfileCard",props:{username:{type:String,default:"未登录"},role:{type:String,default:""},levelInfo:{type:Object,default:()=>null},points:{type:Number,default:0},balance:{type:[String,Number],default:"0.00"},totalTasks:{type:Number,default:0}},setup(n){const u=n,a=w(()=>u.role==="admin"?"管理员":u.role==="reviewer"?"审核员":u.role==="client"?"发布者":u.levelInfo?u.levelInfo.levelName:"体验官"),x=w(()=>u.role==="admin"?"role-admin":u.role==="reviewer"?"role-reviewer":u.role==="client"?"role-client":"role-user"),y=w(()=>u.role==="admin"?"🛡️":u.role==="reviewer"?"✅":u.role==="client"?"💼":"👤"),$=w(()=>(parseFloat(u.balance)||0).toFixed(2));return(k,t)=>(l(),p("div",us,[t[13]||(t[13]=X('<div class="card-decoration" data-v-86083d4a><div class="deco-circle deco-1" data-v-86083d4a></div><div class="deco-circle deco-2" data-v-86083d4a></div><div class="deco-circle deco-3" data-v-86083d4a></div><div class="deco-glow" data-v-86083d4a></div></div>',1)),s("div",vs,[s("div",ms,[t[0]||(t[0]=s("div",{class:"avatar-ring"},null,-1)),s("div",fs,[s("span",gs,v(y.value),1)]),n.levelInfo?(l(),p("div",ks,[s("span",hs,v(n.levelInfo.levelIcon||"⭐"),1)])):c("",!0)]),s("div",ys,[s("div",bs,v(n.username),1),s("div",ws,[s("span",{class:F(["role-tag",x.value])},[t[1]||(t[1]=s("span",{class:"role-dot"},null,-1)),q(" "+v(a.value),1)],2),n.levelInfo&&n.levelInfo.coefficient>1?(l(),p("span",xs,[t[2]||(t[2]=s("span",{class:"coef-icon"},"⚡",-1)),q(" x"+v(n.levelInfo.coefficient),1)])):c("",!0)])]),s("div",$s,[Y(k.$slots,"action",{},void 0)])]),s("div",qs,[s("div",Is,[t[4]||(t[4]=s("div",{class:"stat-icon"},"💎",-1)),s("div",_s,[s("span",Ts,v(n.points),1),t[3]||(t[3]=s("span",{class:"stat-label"},"积分",-1))])]),t[9]||(t[9]=s("div",{class:"stat-divider"},null,-1)),s("div",Cs,[t[6]||(t[6]=s("div",{class:"stat-icon"},"💰",-1)),s("div",Ls,[s("span",Ss,"¥"+v($.value),1),t[5]||(t[5]=s("span",{class:"stat-label"},"余额",-1))])]),n.totalTasks>0?(l(),p("div",Vs)):c("",!0),n.totalTasks>0?(l(),p("div",Ns,[t[8]||(t[8]=s("div",{class:"stat-icon"},"📋",-1)),s("div",Ms,[s("span",js,v(n.totalTasks),1),t[7]||(t[7]=s("span",{class:"stat-label"},"任务",-1))])])):c("",!0)]),n.levelInfo&&n.levelInfo.nextLevel&&n.levelInfo.progress?(l(),p("div",As,[s("div",Bs,[s("span",Ps,[t[10]||(t[10]=s("span",{class:"progress-icon"},"🚀",-1)),q(" 升级到 "+v(n.levelInfo.nextLevel.name),1)]),s("span",Us,v(n.levelInfo.progress.overallPercent||0)+"%",1)]),s("div",Es,[s("div",Os,[s("div",{class:"progress-fill",style:Z({width:(n.levelInfo.progress.overallPercent||0)+"%"})},[...t[11]||(t[11]=[s("div",{class:"progress-shine"},null,-1)])],4)])])])):n.levelInfo&&!n.levelInfo.nextLevel?(l(),p("div",Ds,[...t[12]||(t[12]=[s("span",{class:"max-icon"},"👑",-1),s("span",{class:"max-text"},"已达最高等级",-1),s("span",{class:"max-sparkle"},"✨",-1)])])):c("",!0)]))}},Rs=z(Hs,[["__scopeId","data-v-86083d4a"]]),Ws={class:"my"},zs={class:"card-wrapper"},Fs={key:0,class:"notification-badge"},Gs={key:0,class:"card-wrapper"},Js={class:"user-card"},Ks={key:1,class:"content-area"},Qs={class:"quick-actions"},Xs={class:"quick-cards"},Ys={class:"quick-info"},Zs={key:0,class:"quick-desc"},se={key:1,class:"quick-desc done"},ee={key:0,class:"quick-badge"},te={class:"quick-info"},ae={class:"quick-desc"},le={class:"menu-section"},ne={class:"menu-list"},ie={key:0,class:"menu-section admin-section"},oe={class:"menu-list"},de={class:"legal"},ce={class:"legal-modal"},re={class:"legal-modal-header"},pe={class:"legal-modal-title"},ue={class:"legal-modal-body"},ve=["innerHTML"],me="/admin/login/",fe={__name:"My",setup(n){const u=ds(),{user:a,isAdminOrReviewer:x,isPublisher:y,logout:$}=cs(),k=g(0),t=g("0.00"),f=g(0),b=g(null),I=g(0),_=g(!1),V=g(0),N=g(0),C=g(!1),L=g(""),G=w(()=>({agreement:"用户协议",privacy:"隐私政策","task-rules":"任务规范"})[L.value]||""),J={agreement:`
    <div class="legal-section">
      <h4>小黄鱼任务中心用户协议</h4>
      <p class="update-date">更新日期：2026年3月15日</p>
      <p class="update-date">生效日期：2026年3月15日</p>
    </div>
    <div class="legal-section">
      <h5>一、服务条款的确认和接纳</h5>
      <p>1.1 小黄鱼任务中心的各项服务的所有权和运营权归小黄鱼任务中心所有。</p>
      <p>1.2 用户在使用小黄鱼任务中心提供的各项服务之前，应仔细阅读本服务协议。</p>
      <p>1.3 用户一旦注册使用小黄鱼任务中心的服务，即视为用户已了解并完全同意本服务协议各项内容。</p>
    </div>
    <div class="legal-section">
      <h5>二、用户注册</h5>
      <p>2.1 用户注册成功后，小黄鱼任务中心将给予每个用户一个用户账号及相应的密码，该用户账号和密码由用户负责保管。</p>
      <p>2.2 用户对以其用户账号进行的所有活动和事件负法律责任。</p>
    </div>
    <div class="legal-section">
      <h5>三、使用规则</h5>
      <p>3.1 用户在使用小黄鱼任务中心服务过程中，必须遵循以下原则：</p>
      <p>（1）遵守中国有关的法律和法规；</p>
      <p>（2）不得为任何非法目的而使用网络服务系统；</p>
      <p>（3）遵守所有与网络服务有关的网络协议、规定和程序；</p>
      <p>（4）不得利用小黄鱼任务中心服务进行任何可能对互联网的正常运转造成不利影响的行为；</p>
      <p>（5）不得利用小黄鱼任务中心服务传输任何骚扰性的、中伤他人的、辱骂性的、恐吓性的、庸俗淫秽的或其他任何非法的信息资料。</p>
    </div>
    <div class="legal-section">
      <h5>四、任务规则</h5>
      <p>4.1 用户可通过完成平台发布的任务获取相应积分奖励。</p>
      <p>4.2 任务类型包括：观看视频，评论真实的视频观看感受并提交。</p>
      <p>4.3 用户需按照任务要求真实完成任务，禁止作弊行为。</p>
      <p>4.4 平台有权对用户提交的任务进行审核，审核通过后发放相应积分。</p>
    </div>
    <div class="legal-section">
      <h5>五、积分规则</h5>
      <p>5.1 积分兑换比例：10积分 = 1元人民币。</p>
      <p>5.2 积分可在满足最低提现额度后申请提现。</p>
      <p>5.3 平台有权根据运营情况调整积分规则，调整将提前公告。</p>
    </div>
    <div class="legal-section">
      <h5>六、免责声明</h5>
      <p>6.1 用户明确同意其使用小黄鱼任务中心网络服务所存在的风险将完全由其自己承担。</p>
      <p>6.2 小黄鱼任务中心不担保服务一定能满足用户的要求，也不担保服务不会中断，对服务的及时性、安全性、准确性也都不作担保。</p>
    </div>
    <div class="legal-section">
      <h5>七、联系我们</h5>
      <p>如您对本协议有任何疑问，可通过以下方式联系我们：</p>
      <p>邮箱：1823985558@qq.com</p>
    </div>
  `,privacy:`
    <div class="legal-section">
      <h4>小黄鱼任务中心隐私政策</h4>
      <p class="update-date">更新日期：2026年3月15日</p>
      <p class="update-date">生效日期：2026年3月15日</p>
    </div>
    <div class="legal-section">
      <h5>引言</h5>
      <p>小黄鱼任务中心（以下简称"我们"）非常重视用户的隐私和个人信息保护。本隐私政策将向您说明我们如何收集、使用、存储、共享和保护您的个人信息。</p>
    </div>
    <div class="legal-section">
      <h5>一、我们收集的信息</h5>
      <p>1.1 您注册账户时提供的信息：用户名、密码、手机号码等。</p>
      <p>1.2 您使用服务时产生的信息：任务完成记录、积分记录、提现记录等。</p>
      <p>1.3 设备信息：包括设备型号、操作系统版本、唯一设备标识符等。</p>
    </div>
    <div class="legal-section">
      <h5>二、我们如何使用收集的信息</h5>
      <p>2.1 为您提供、维护、改进我们的服务。</p>
      <p>2.2 用于身份验证、账户安全保护。</p>
      <p>2.3 用于向您发送服务通知和营销信息。</p>
      <p>2.4 用于数据分析研究，改进我们的产品和服务。</p>
    </div>
    <div class="legal-section">
      <h5>三、信息的共享</h5>
      <p>3.1 我们不会向第三方出售您的个人信息。</p>
      <p>3.2 我们仅在以下情况下才会共享您的个人信息：</p>
      <p>（1）获得您的明确同意后；</p>
      <p>（2）根据法律法规的要求；</p>
      <p>（3）根据政府主管部门的强制性要求。</p>
    </div>
    <div class="legal-section">
      <h5>四、信息存储与保护</h5>
      <p>4.1 我们将采取合理的安全措施保护您的个人信息。</p>
      <p>4.2 您的个人信息将被存储在中华人民共和国境内的服务器。</p>
      <p>4.3 我们会在实现您个人信息主体权益所必需的最短时间内保留您的个人信息。</p>
    </div>
    <div class="legal-section">
      <h5>五、您的权利</h5>
      <p>5.1 您有权访问、更正您的个人信息。</p>
      <p>5.2 您有权删除您的账户及相关信息。</p>
      <p>5.3 您有权撤回对个人信息处理的同意。</p>
    </div>
    <div class="legal-section">
      <h5>六、联系我们</h5>
      <p>如您对本隐私政策有任何疑问，可通过以下方式联系我们：</p>
      <p>邮箱：1823985558@qq.com</p>
    </div>
  `,"task-rules":`
    <div class="legal-section">
      <h4>小黄鱼任务中心任务规范</h4>
      <p class="update-date">更新日期：2026年3月15日</p>
      <p class="update-date">生效日期：2026年3月15日</p>
    </div>
    <div class="legal-section">
      <h5>一、任务类型</h5>
      <p>目前平台支持的任务类型包括：</p>
      <p>1.1 观看视频任务：观看视频，评论真实的视频观看感受并提交。</p>
      <p>任务完成后需提交真实的观看感受和评论，禁止提交虚假内容。</p>
    </div>
    <div class="legal-section">
      <h5>二、任务流程</h5>
      <p>2.1 用户可在任务大厅浏览可领取的任务。</p>
      <p>2.2 选择合适的任务进行领取。</p>
      <p>2.3 按照任务要求完成任务内容。</p>
      <p>2.4 提交任务完成证明材料。</p>
      <p>2.5 等待平台审核。</p>
      <p>2.6 审核通过后获得相应积分奖励。</p>
    </div>
    <div class="legal-section">
      <h5>三、积分规则</h5>
      <p>3.1 积分兑换比例：10积分 = 1元人民币。</p>
      <p>3.2 不同任务完成后可获得不同数量的积分。</p>
      <p>3.3 积分可通过提现功能兑换为现金。</p>
      <p>3.4 最低提现额度以平台公告为准。</p>
    </div>
    <div class="legal-section">
      <h5>四、用户等级制度</h5>
      <p>4.1 平台实行用户等级制度，等级越高享受的权益越多。</p>
      <p>4.2 当前等级配置（从低到高）：</p>
      <p>• 新手体验官（LV1）：完成任务获得基础积分</p>
      <p>• 青铜体验官（LV2）：完成任务获得基础积分×1.05倍</p>
      <p>• 白银体验官（LV3）：完成任务获得基础积分×1.10倍</p>
      <p>• 黄金体验官（LV4）：完成任务获得基础积分×1.20倍</p>
      <p>• 钻石体验官（LV5）：完成任务获得基础积分×1.35倍</p>
      <p>• 至尊体验官（LV6）：完成任务获得基础积分×1.55倍</p>
      <p>• 皇冠体验官（LV7）：完成任务获得基础积分×1.80倍</p>
      <p>4.3 用户通过完成积累任务数量提升等级。</p>
    </div>
    <div class="legal-section">
      <h5>五、违规处理</h5>
      <p>5.1 以下行为将被视为违规：</p>
      <p>（1）提交虚假任务完成证明；</p>
      <p>（2）使用自动化工具刷任务；</p>
      <p>（3）恶意注册多个账户；</p>
      <p>（4）其他违反平台规则的行为。</p>
      <p>5.2 违规处理措施：</p>
      <p>（1）警告；</p>
      <p>（2）扣除积分；</p>
      <p>（3）封禁账户。</p>
    </div>
    <div class="legal-section">
      <h5>六、联系我们</h5>
      <p>如您对任务规范有任何疑问，可通过以下方式联系我们：</p>
      <p>邮箱：1823985558@qq.com</p>
    </div>
  `},K=w(()=>J[L.value]||"");function S(i){L.value=i,C.value=!0,document.body.style.overflow="hidden"}function M(){C.value=!1,document.body.style.overflow=""}function j(){return W(this,null,function*(){try{const i=yield ls();k.value=i.points||0,t.value=String(i.balance!==null&&i.balance!==void 0?i.balance:0)}catch(i){k.value=0,t.value="0.00"}if(a.value){try{const i=yield ns();b.value=i,f.value=i.totalTasks||0}catch(i){console.error("获取等级信息失败",i)}try{I.value=yield is()}catch(i){}try{const i=yield rs();_.value=i.hasSignedToday}catch(i){}try{const i=yield ps();V.value=i.achieved,N.value=i.total}catch(i){}}})}function Q(){$(),u.push("/login")}return ss(j),es(j),(i,e)=>{var A,B,P,U,E,O,D,H;const r=os("router-link");return l(),p("div",Ws,[s("div",zs,[o(a)?(l(),h(Rs,{key:0,username:o(a).username,role:o(a).role,levelInfo:b.value,points:k.value,balance:t.value,totalTasks:f.value},{action:d(()=>[m(r,{to:"/notifications",class:"notification-btn"},{default:d(()=>[e[3]||(e[3]=s("span",{class:"notification-icon"},"🔔",-1)),I.value>0?(l(),p("span",Fs,v(I.value>99?"99+":I.value),1)):c("",!0)]),_:1})]),_:1},8,["username","role","levelInfo","points","balance","totalTasks"])):c("",!0)]),o(a)?c("",!0):(l(),p("div",Gs,[s("header",Js,[e[5]||(e[5]=s("div",{class:"avatar"},"👤",-1)),e[6]||(e[6]=s("div",{class:"info"},[s("div",{class:"name"},"未登录"),s("div",{class:"level"},"请登录以查看更多信息")],-1)),m(r,{to:"/login",class:"login-btn"},{default:d(()=>[...e[4]||(e[4]=[q("登录",-1)])]),_:1})])])),o(a)?(l(),p("div",Ks,[s("section",Qs,[e[13]||(e[13]=s("div",{class:"section-title"},"快捷功能",-1)),s("div",Xs,[m(r,{to:"/invite",class:"quick-item promote-item"},{default:d(()=>[...e[7]||(e[7]=[s("div",{class:"quick-icon promote-icon"},"🎁",-1),s("div",{class:"quick-info"},[s("span",{class:"quick-name"},"推广中心"),s("span",{class:"quick-desc promote-desc"},"邀请好友赚积分")],-1),s("div",{class:"promote-badge"},"HOT",-1)])]),_:1}),m(r,{to:"/sign-in",class:F(["quick-item",{"has-badge":!_.value}])},{default:d(()=>[e[9]||(e[9]=s("div",{class:"quick-icon"},"📅",-1)),s("div",Ys,[e[8]||(e[8]=s("span",{class:"quick-name"},"每日签到",-1)),_.value?(l(),p("span",se,"已签到")):(l(),p("span",Zs,"+3积分"))]),_.value?c("",!0):(l(),p("div",ee,"GO"))]),_:1},8,["class"]),m(r,{to:"/achievements",class:"quick-item"},{default:d(()=>[e[11]||(e[11]=s("div",{class:"quick-icon"},"🏆",-1)),s("div",te,[e[10]||(e[10]=s("span",{class:"quick-name"},"我的成就",-1)),s("span",ae,v(V.value)+"/"+v(N.value)+" 已解锁",1)]),e[12]||(e[12]=s("div",{class:"quick-arrow"},"›",-1))]),_:1})])]),s("section",le,[e[21]||(e[21]=s("div",{class:"section-title"},"我的服务",-1)),s("div",ne,[((A=o(a))==null?void 0:A.role)==="part_timer"||((B=o(a))==null?void 0:B.role)==="admin"?(l(),h(r,{key:0,to:"/my/tasks",class:"menu-item"},{default:d(()=>[...e[14]||(e[14]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"📋"),s("span",{class:"menu-text"},"我的任务")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1})):c("",!0),((P=o(a))==null?void 0:P.role)==="admin"||((U=o(a))==null?void 0:U.role)==="client"||((E=o(a))==null?void 0:E.role)==="reviewer"?(l(),h(r,{key:1,to:"/publisher/tasks",class:"menu-item"},{default:d(()=>[...e[15]||(e[15]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"📁"),s("span",{class:"menu-text"},"任务管理")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1})):c("",!0),m(r,{to:"/points",class:"menu-item"},{default:d(()=>[...e[16]||(e[16]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"💰"),s("span",{class:"menu-text"},"积分明细")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1}),m(r,{to:"/notification-settings",class:"menu-item"},{default:d(()=>[...e[17]||(e[17]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"🔔"),s("span",{class:"menu-text"},"通知设置")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1}),m(r,{to:"/withdraw",class:"menu-item"},{default:d(()=>[...e[18]||(e[18]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"💵"),s("span",{class:"menu-text"},"提现中心")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1}),m(r,{to:"/rank",class:"menu-item"},{default:d(()=>[...e[19]||(e[19]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"📊"),s("span",{class:"menu-text"},"排行榜")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1}),((O=o(a))==null?void 0:O.role)==="admin"||((D=o(a))==null?void 0:D.role)==="client"||((H=o(a))==null?void 0:H.role)==="reviewer"?(l(),h(r,{key:2,to:"/ai-assistant",class:"menu-item ai-item"},{default:d(()=>[...e[20]||(e[20]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"🤖"),s("span",{class:"menu-text"},"AI助手")],-1),s("span",{class:"menu-badge"},"NEW",-1)])]),_:1})):c("",!0)])]),o(y)?(l(),p("section",ie,[e[27]||(e[27]=s("div",{class:"section-title"},"管理功能",-1)),s("div",oe,[m(r,{to:"/publish",class:"menu-item highlight"},{default:d(()=>[...e[22]||(e[22]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"📝"),s("span",{class:"menu-text"},"发布任务")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1}),o(x)?(l(),h(r,{key:0,to:"/admin/review",class:"menu-item highlight"},{default:d(()=>[...e[23]||(e[23]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"🔐"),s("span",{class:"menu-text"},"审核入口")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1})):c("",!0),o(a)&&o(a).role==="admin"?(l(),h(r,{key:1,to:"/admin/notifications",class:"menu-item highlight"},{default:d(()=>[...e[24]||(e[24]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"🔔"),s("span",{class:"menu-text"},"管理员通知")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1})):c("",!0),o(a)&&o(a).role==="admin"?(l(),h(r,{key:2,to:"/admin/alerts",class:"menu-item highlight"},{default:d(()=>[...e[25]||(e[25]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"🚨"),s("span",{class:"menu-text"},"管理员告警")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1})):c("",!0),o(a)&&o(a).role==="admin"?(l(),p("a",{key:3,href:me,class:"menu-item highlight"},[...e[26]||(e[26]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"🎛️"),s("span",{class:"menu-text"},"管理后台")],-1),s("span",{class:"menu-arrow"},"›",-1)])])):c("",!0)])])):c("",!0),s("section",de,[s("a",{href:"javascript:void(0)",onClick:e[0]||(e[0]=T(R=>S("agreement"),["prevent"]))},"用户协议"),e[29]||(e[29]=s("span",{class:"divider"},"|",-1)),s("a",{href:"javascript:void(0)",onClick:e[1]||(e[1]=T(R=>S("privacy"),["prevent"]))},"隐私政策"),e[30]||(e[30]=s("span",{class:"divider"},"|",-1)),s("a",{href:"javascript:void(0)",onClick:e[2]||(e[2]=T(R=>S("task-rules"),["prevent"]))},"任务规范"),e[31]||(e[31]=s("span",{class:"divider"},"|",-1)),m(r,{to:"/pwa-guide"},{default:d(()=>[...e[28]||(e[28]=[q("安装指南",-1)])]),_:1})]),s("div",{class:"logout-section"},[s("button",{type:"button",class:"btn-logout",onClick:Q},"退出登录")])])):c("",!0),(l(),h(as,{to:"body"},[m(ts,{name:"modal"},{default:d(()=>[C.value?(l(),p("div",{key:0,class:"legal-modal-overlay",onClick:T(M,["self"])},[s("div",ce,[s("div",re,[s("h3",pe,v(G.value),1),s("button",{class:"legal-modal-close",onClick:M},"✕")]),s("div",ue,[s("div",{class:"legal-content",innerHTML:K.value},null,8,ve)])])])):c("",!0)]),_:1})]))])}}},we=z(fe,[["__scopeId","data-v-7ce66eec"]]);export{we as default};
