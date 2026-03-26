var z=(i,r,l)=>new Promise(($,h)=>{var q=f=>{try{t(l.next(f))}catch(y){h(y)}},k=f=>{try{t(l.throw(f))}catch(y){h(y)}},t=f=>f.done?$(f.value):Promise.resolve(f.value).then(q,k);t((l=l.apply(i,r)).next())});import{_ as F,a as n,c,A as X,b as s,t as u,h as d,y as W,e as x,P as Y,Q as Z,J as w,o as ss,q as es,s as o,x as b,j as p,i as m,k as T,T as ts,R as as,E as ls,S as ns,U as is,r as g,n as os,u as ds}from"./index-zX9359Ag.js";import{u as cs}from"./auth-CXUnnn3D.js";import{g as rs}from"./signIn--espEW-X.js";import{g as ps}from"./achievement-tP9LH7uq.js";const vs={class:"user-profile-card"},us={class:"user-header"},ms={class:"avatar-wrapper"},fs={class:"avatar"},gs={class:"avatar-emoji"},ks={key:0,class:"level-badge"},hs={class:"level-icon"},ys={class:"user-info"},bs={class:"username"},ws={class:"user-role"},$s={key:0,class:"coefficient-tag"},qs={class:"action-slot"},xs={class:"user-stats"},_s={class:"stat-item"},Is={class:"stat-content"},Ts={class:"stat-value"},Cs={class:"stat-item"},Ls={class:"stat-content"},Ss={class:"stat-value"},Vs={key:0,class:"stat-divider"},Ns={key:1,class:"stat-item"},Ms={class:"stat-content"},js={class:"stat-value"},As={key:0,class:"level-progress"},Ps={class:"progress-header"},Bs={class:"progress-label"},Us={class:"progress-percent"},Es={class:"progress-bar-wrapper"},Os={class:"progress-bar"},Ds={key:1,class:"max-level-badge"},Hs={__name:"UserProfileCard",props:{username:{type:String,default:"未登录"},role:{type:String,default:""},levelInfo:{type:Object,default:()=>null},points:{type:Number,default:0},balance:{type:[String,Number],default:"0.00"},totalTasks:{type:Number,default:0}},setup(i){const r=i,l=w(()=>r.role==="admin"?"管理员":r.role==="reviewer"?"审核员":r.role==="client"?"发布者":r.levelInfo?r.levelInfo.levelName:"体验官"),$=w(()=>r.role==="admin"?"role-admin":r.role==="reviewer"?"role-reviewer":r.role==="client"?"role-client":"role-user"),h=w(()=>r.role==="admin"?"🛡️":r.role==="reviewer"?"✅":r.role==="client"?"💼":"👤"),q=w(()=>(parseFloat(r.balance)||0).toFixed(2));return(k,t)=>(n(),c("div",vs,[t[13]||(t[13]=X('<div class="card-decoration" data-v-86083d4a><div class="deco-circle deco-1" data-v-86083d4a></div><div class="deco-circle deco-2" data-v-86083d4a></div><div class="deco-circle deco-3" data-v-86083d4a></div><div class="deco-glow" data-v-86083d4a></div></div>',1)),s("div",us,[s("div",ms,[t[0]||(t[0]=s("div",{class:"avatar-ring"},null,-1)),s("div",fs,[s("span",gs,u(h.value),1)]),i.levelInfo?(n(),c("div",ks,[s("span",hs,u(i.levelInfo.levelIcon||"⭐"),1)])):d("",!0)]),s("div",ys,[s("div",bs,u(i.username),1),s("div",ws,[s("span",{class:W(["role-tag",$.value])},[t[1]||(t[1]=s("span",{class:"role-dot"},null,-1)),x(" "+u(l.value),1)],2),i.levelInfo&&i.levelInfo.coefficient>1?(n(),c("span",$s,[t[2]||(t[2]=s("span",{class:"coef-icon"},"⚡",-1)),x(" x"+u(i.levelInfo.coefficient),1)])):d("",!0)])]),s("div",qs,[Y(k.$slots,"action",{},void 0)])]),s("div",xs,[s("div",_s,[t[4]||(t[4]=s("div",{class:"stat-icon"},"💎",-1)),s("div",Is,[s("span",Ts,u(i.points),1),t[3]||(t[3]=s("span",{class:"stat-label"},"积分",-1))])]),t[9]||(t[9]=s("div",{class:"stat-divider"},null,-1)),s("div",Cs,[t[6]||(t[6]=s("div",{class:"stat-icon"},"💰",-1)),s("div",Ls,[s("span",Ss,"¥"+u(q.value),1),t[5]||(t[5]=s("span",{class:"stat-label"},"余额",-1))])]),i.totalTasks>0?(n(),c("div",Vs)):d("",!0),i.totalTasks>0?(n(),c("div",Ns,[t[8]||(t[8]=s("div",{class:"stat-icon"},"📋",-1)),s("div",Ms,[s("span",js,u(i.totalTasks),1),t[7]||(t[7]=s("span",{class:"stat-label"},"任务",-1))])])):d("",!0)]),i.levelInfo&&i.levelInfo.nextLevel&&i.levelInfo.progress?(n(),c("div",As,[s("div",Ps,[s("span",Bs,[t[10]||(t[10]=s("span",{class:"progress-icon"},"🚀",-1)),x(" 升级到 "+u(i.levelInfo.nextLevel.name),1)]),s("span",Us,u(i.levelInfo.progress.overallPercent||0)+"%",1)]),s("div",Es,[s("div",Os,[s("div",{class:"progress-fill",style:Z({width:(i.levelInfo.progress.overallPercent||0)+"%"})},[...t[11]||(t[11]=[s("div",{class:"progress-shine"},null,-1)])],4)])])])):i.levelInfo&&!i.levelInfo.nextLevel?(n(),c("div",Ds,[...t[12]||(t[12]=[s("span",{class:"max-icon"},"👑",-1),s("span",{class:"max-text"},"已达最高等级",-1),s("span",{class:"max-sparkle"},"✨",-1)])])):d("",!0)]))}},Rs=F(Hs,[["__scopeId","data-v-86083d4a"]]),zs={class:"my"},Fs={class:"card-wrapper"},Ws={key:0,class:"notification-badge"},Gs={key:0,class:"card-wrapper"},Js={class:"user-card"},Qs={key:1,class:"content-area"},Ks={class:"quick-actions"},Xs={class:"quick-cards"},Ys={class:"quick-info"},Zs={key:0,class:"quick-desc"},se={key:1,class:"quick-desc done"},ee={key:0,class:"quick-badge"},te={class:"quick-info"},ae={class:"quick-desc"},le={class:"menu-section"},ne={class:"menu-list"},ie={key:0,class:"menu-section admin-section"},oe={class:"menu-list"},de={class:"legal"},ce={class:"legal-modal"},re={class:"legal-modal-header"},pe={class:"legal-modal-title"},ve={class:"legal-modal-body"},ue=["innerHTML"],me="/admin/login/",fe={__name:"My",setup(i){const r=ds(),{user:l,isAdminOrReviewer:$,isPublisher:h,logout:q}=cs(),k=g(0),t=g("0.00"),f=g(0),y=g(null),_=g(0),I=g(!1),V=g(0),N=g(0),C=g(!1),L=g(""),G=w(()=>({agreement:"用户协议",privacy:"隐私政策","task-rules":"任务规范"})[L.value]||""),J={agreement:`
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
  `},Q=w(()=>J[L.value]||"");function S(a){L.value=a,C.value=!0,document.body.style.overflow="hidden"}function M(){C.value=!1,document.body.style.overflow=""}function j(){return z(this,null,function*(){try{const a=yield ls();k.value=a.points||0,t.value=String(a.balance!==null&&a.balance!==void 0?a.balance:0)}catch(a){k.value=0,t.value="0.00"}if(l.value){try{const a=yield ns();y.value=a,f.value=a.totalTasks||0}catch(a){console.error("获取等级信息失败",a)}try{const a=yield is();_.value=a.count}catch(a){}try{const a=yield rs();I.value=a.hasSignedToday}catch(a){}try{const a=yield ps();V.value=a.achieved,N.value=a.total}catch(a){}}})}function K(){q(),r.push("/login")}return ss(j),es(j),(a,e)=>{var A,P,B,U,E,O,D,H;const v=os("router-link");return n(),c("div",zs,[s("div",Fs,[o(l)?(n(),b(Rs,{key:0,username:o(l).username,role:o(l).role,levelInfo:y.value,points:k.value,balance:t.value,totalTasks:f.value},{action:p(()=>[m(v,{to:"/notifications",class:"notification-btn"},{default:p(()=>[e[3]||(e[3]=s("span",{class:"notification-icon"},"🔔",-1)),_.value>0?(n(),c("span",Ws,u(_.value>99?"99+":_.value),1)):d("",!0)]),_:1})]),_:1},8,["username","role","levelInfo","points","balance","totalTasks"])):d("",!0)]),o(l)?d("",!0):(n(),c("div",Gs,[s("header",Js,[e[5]||(e[5]=s("div",{class:"avatar"},"👤",-1)),e[6]||(e[6]=s("div",{class:"info"},[s("div",{class:"name"},"未登录"),s("div",{class:"level"},"请登录以查看更多信息")],-1)),m(v,{to:"/login",class:"login-btn"},{default:p(()=>[...e[4]||(e[4]=[x("登录",-1)])]),_:1})])])),o(l)?(n(),c("div",Qs,[s("section",Ks,[e[13]||(e[13]=s("div",{class:"section-title"},"快捷功能",-1)),s("div",Xs,[m(v,{to:"/invite",class:"quick-item promote-item"},{default:p(()=>[...e[7]||(e[7]=[s("div",{class:"quick-icon promote-icon"},"🎁",-1),s("div",{class:"quick-info"},[s("span",{class:"quick-name"},"推广中心"),s("span",{class:"quick-desc promote-desc"},"邀请好友赚积分")],-1),s("div",{class:"promote-badge"},"HOT",-1)])]),_:1}),m(v,{to:"/sign-in",class:W(["quick-item",{"has-badge":!I.value}])},{default:p(()=>[e[9]||(e[9]=s("div",{class:"quick-icon"},"📅",-1)),s("div",Ys,[e[8]||(e[8]=s("span",{class:"quick-name"},"每日签到",-1)),I.value?(n(),c("span",se,"已签到")):(n(),c("span",Zs,"+3积分"))]),I.value?d("",!0):(n(),c("div",ee,"GO"))]),_:1},8,["class"]),m(v,{to:"/achievements",class:"quick-item"},{default:p(()=>[e[11]||(e[11]=s("div",{class:"quick-icon"},"🏆",-1)),s("div",te,[e[10]||(e[10]=s("span",{class:"quick-name"},"我的成就",-1)),s("span",ae,u(V.value)+"/"+u(N.value)+" 已解锁",1)]),e[12]||(e[12]=s("div",{class:"quick-arrow"},"›",-1))]),_:1})])]),s("section",le,[e[20]||(e[20]=s("div",{class:"section-title"},"我的服务",-1)),s("div",ne,[((A=o(l))==null?void 0:A.role)==="part_timer"||((P=o(l))==null?void 0:P.role)==="admin"?(n(),b(v,{key:0,to:"/my/tasks",class:"menu-item"},{default:p(()=>[...e[14]||(e[14]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"📋"),s("span",{class:"menu-text"},"我的任务")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1})):d("",!0),((B=o(l))==null?void 0:B.role)==="admin"||((U=o(l))==null?void 0:U.role)==="client"||((E=o(l))==null?void 0:E.role)==="reviewer"?(n(),b(v,{key:1,to:"/publisher/tasks",class:"menu-item"},{default:p(()=>[...e[15]||(e[15]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"📁"),s("span",{class:"menu-text"},"任务管理")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1})):d("",!0),m(v,{to:"/points",class:"menu-item"},{default:p(()=>[...e[16]||(e[16]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"💰"),s("span",{class:"menu-text"},"积分明细")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1}),m(v,{to:"/withdraw",class:"menu-item"},{default:p(()=>[...e[17]||(e[17]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"💵"),s("span",{class:"menu-text"},"提现中心")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1}),m(v,{to:"/rank",class:"menu-item"},{default:p(()=>[...e[18]||(e[18]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"📊"),s("span",{class:"menu-text"},"排行榜")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1}),((O=o(l))==null?void 0:O.role)==="admin"||((D=o(l))==null?void 0:D.role)==="client"||((H=o(l))==null?void 0:H.role)==="reviewer"?(n(),b(v,{key:2,to:"/ai-assistant",class:"menu-item ai-item"},{default:p(()=>[...e[19]||(e[19]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"🤖"),s("span",{class:"menu-text"},"AI助手")],-1),s("span",{class:"menu-badge"},"NEW",-1)])]),_:1})):d("",!0)])]),o(h)?(n(),c("section",ie,[e[24]||(e[24]=s("div",{class:"section-title"},"管理功能",-1)),s("div",oe,[m(v,{to:"/publish",class:"menu-item highlight"},{default:p(()=>[...e[21]||(e[21]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"📝"),s("span",{class:"menu-text"},"发布任务")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1}),o($)?(n(),b(v,{key:0,to:"/admin/review",class:"menu-item highlight"},{default:p(()=>[...e[22]||(e[22]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"🔐"),s("span",{class:"menu-text"},"审核入口")],-1),s("span",{class:"menu-arrow"},"›",-1)])]),_:1})):d("",!0),o(l)&&o(l).role==="admin"?(n(),c("a",{key:1,href:me,class:"menu-item highlight"},[...e[23]||(e[23]=[s("div",{class:"menu-left"},[s("span",{class:"menu-icon"},"🎛️"),s("span",{class:"menu-text"},"管理后台")],-1),s("span",{class:"menu-arrow"},"›",-1)])])):d("",!0)])])):d("",!0),s("section",de,[s("a",{href:"javascript:void(0)",onClick:e[0]||(e[0]=T(R=>S("agreement"),["prevent"]))},"用户协议"),e[26]||(e[26]=s("span",{class:"divider"},"|",-1)),s("a",{href:"javascript:void(0)",onClick:e[1]||(e[1]=T(R=>S("privacy"),["prevent"]))},"隐私政策"),e[27]||(e[27]=s("span",{class:"divider"},"|",-1)),s("a",{href:"javascript:void(0)",onClick:e[2]||(e[2]=T(R=>S("task-rules"),["prevent"]))},"任务规范"),e[28]||(e[28]=s("span",{class:"divider"},"|",-1)),m(v,{to:"/pwa-guide"},{default:p(()=>[...e[25]||(e[25]=[x("安装指南",-1)])]),_:1})]),s("div",{class:"logout-section"},[s("button",{type:"button",class:"btn-logout",onClick:K},"退出登录")])])):d("",!0),(n(),b(as,{to:"body"},[m(ts,{name:"modal"},{default:p(()=>[C.value?(n(),c("div",{key:0,class:"legal-modal-overlay",onClick:T(M,["self"])},[s("div",ce,[s("div",re,[s("h3",pe,u(G.value),1),s("button",{class:"legal-modal-close",onClick:M},"✕")]),s("div",ve,[s("div",{class:"legal-content",innerHTML:Q.value},null,8,ue)])])])):d("",!0)]),_:1})]))])}}},we=F(fe,[["__scopeId","data-v-a46f4dca"]]);export{we as default};
