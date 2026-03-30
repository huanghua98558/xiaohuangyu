#!/usr/bin/env python3
"""Complete pending UX patches on /var/www/xiaohuangyu"""
import re
from pathlib import Path

ROOT = Path("/var/www/xiaohuangyu")

# 标准：仅含 h3 + yx-card-note，无兄弟节点（不含日历右侧按钮）
HEAD_PAT = re.compile(
    r'<div class="yx-card-head">\s*<div>\s*<h3>([\s\S]*?)</h3>\s*'
    r'<div (class="yx-card-note[^"]*")>([\s\S]*?)</div>\s*</div>\s*</div>',
    re.MULTILINE,
)


def flex_card_heads(html: str) -> str:
    def repl(m):
        h3 = m.group(1).strip()
        cls = m.group(2)
        note = m.group(3).strip()
        return (
            f'<div class="yx-card-head-bar">\n        '
            f'<h3>{h3}<span {cls}>{note}</span></h3>\n      </div>'
        )

    prev = None
    while prev != html:
        prev = html
        html = HEAD_PAT.sub(repl, html, count=1)
    return html


def patch_home_notify():
    p = ROOT / "user-app/src/views/Home.vue"
    t = p.read_text(encoding="utf-8")
    if "import { fetchUnreadCount }" not in t:
        t = t.replace(
            "import { getTasks, getTotalRank, getDailyPointsRank, getWallet, getMyRank, getTodayStats } from '../api/task'",
            "import { getTasks, getTotalRank, getDailyPointsRank, getWallet, getMyRank, getTodayStats } from '../api/task'\nimport { fetchUnreadCount } from '../api/notification'",
            1,
        )
    if "unreadBadgeText" not in t:
        t = t.replace(
            "const unreadNotifyCount = ref(0)\n",
            "const unreadNotifyCount = ref(0)\n\nconst unreadBadgeText = computed(() => {\n  const n = unreadNotifyCount.value\n  if (n > 99) return '99+'\n  return String(n)\n})\n",
            1,
        )
    p.write_text(t, encoding="utf-8")
    print("Home.vue OK")


def patch_task_detail_bonus():
    p = ROOT / "user-app/src/views/TaskDetail.vue"
    t = p.read_text(encoding="utf-8")
    old = """const getBonusReward = (tk) => {
  const base = getBaseReward(tk)
  const c = Number(tk?.nightCoefficient || 1)
  if (c <= 1) return 0
  return Math.ceil(base * (c - 1))
}"""
    new = """const getBonusReward = (tk) => {
  const apiBonus = Number(tk?.nightBonusPoints)
  if (tk?.isNightBonusTask && Number.isFinite(apiBonus) && apiBonus > 0) {
    return Math.round(apiBonus * 10) / 10
  }
  const base = Number(tk?.reward || tk?.base_reward || 0)
  const c = Number(tk?.nightCoefficient || 1)
  if (c <= 1) return 0
  return Math.round(Math.max(0, base * (c - 1)) * 10) / 10
}"""
    if old in t:
        t = t.replace(old, new, 1)
    elif "nightBonusPoints" not in t:
        raise SystemExit("TaskDetail: unexpected getBonusReward")
    p.write_text(t, encoding="utf-8")
    print("TaskDetail.vue OK")


def patch_signin_cards():
    p = ROOT / "user-app/src/views/SignIn.vue"
    t = p.read_text(encoding="utf-8")
    hero_old = """      <div class="yx-card-head">
        <div>
          <h3>{{ signInHeadline }}</h3>
          <div class="yx-card-note signin-sub-positive">{{ signInSubline }}</div>
        </div>
      </div>"""
    hero_new = """      <div class="yx-card-head-bar">
        <h3>{{ signInHeadline }}<span class="yx-card-note signin-sub-positive">{{ signInSubline }}</span></h3>
      </div>"""
    if hero_old in t:
        t = t.replace(hero_old, hero_new, 1)
    cal_old = """      <div class="yx-card-head">
        <div>
          <h3>签到日历</h3>
          <div class="yx-card-note">{{ currentYear }}年{{ currentMonth }}月</div>
        </div>
        <div class="calendar-actions">
          <button class="yx-btn-ghost calendar-btn" @click="prevMonth">‹</button>
          <button class="yx-btn-ghost calendar-btn" @click="nextMonth">›</button>
        </div>
      </div>"""
    cal_new = """      <div class="yx-card-head-bar calendar-head-bar">
        <h3>签到日历<span class="yx-card-note">{{ currentYear }}年{{ currentMonth }}月</span></h3>
        <div class="calendar-actions">
          <button class="yx-btn-ghost calendar-btn" @click="prevMonth">‹</button>
          <button class="yx-btn-ghost calendar-btn" @click="nextMonth">›</button>
        </div>
      </div>"""
    if cal_old in t:
        t = t.replace(cal_old, cal_new, 1)
    t = flex_card_heads(t)
    if ".calendar-head-bar" not in t:
        t = t.replace(
            "<style scoped>",
            """<style scoped>
.calendar-head-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.calendar-head-bar h3 {
  margin: 0;
  flex: 1;
  min-width: 0;
}
""",
            1,
        )
    p.write_text(t, encoding="utf-8")
    print("SignIn.vue OK")


def patch_file_simple_heads(name):
    p = ROOT / "user-app/src/views" / name
    t = p.read_text(encoding="utf-8")
    p.write_text(flex_card_heads(t), encoding="utf-8")
    print(f"{name} OK")


def patch_task_list_limit():
    p = ROOT / "user-app/src/views/TaskList.vue"
    t = p.read_text(encoding="utf-8")
    if "getTasks({ limit:" not in t:
        t = t.replace(
            "const data = await getTasks()",
            "const data = await getTasks({ limit: 48 })",
            1,
        )
    p.write_text(t, encoding="utf-8")
    print("TaskList.vue OK")


def patch_notification_settings():
    p = ROOT / "user-app/src/views/NotificationSettings.vue"
    t = p.read_text(encoding="utf-8")
    if "notification-settings-page" in t:
        print("NotificationSettings skip")
        return
    new_tpl = '''<template>
  <div class="yx-page notification-settings-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">通知设置</h1>
        <p class="yx-subtitle">控制站内提醒与提示音，保存后立即生效。</p>
      </div>
      <div class="yx-icon-btn" aria-hidden="true">🔔</div>
    </header>

    <section class="yx-card" v-if="!loading">
      <div class="yx-card-head-bar">
        <h3>提醒开关<span class="yx-card-note">按需关闭某类消息</span></h3>
      </div>
      <div class="ns-list">
        <label class="ns-row">
          <div class="ns-text">
            <b>总开关 · 系统通知</b>
            <small>关闭后不再接收站内通知（仍可在通知中心查看历史）</small>
          </div>
          <input v-model="form.notificationEnabled" type="checkbox" class="ns-toggle" />
        </label>
        <label class="ns-row">
          <div class="ns-text">
            <b>声音提醒</b>
            <small>新消息到达时播放提示音（受总开关影响）</small>
          </div>
          <input v-model="form.notificationSoundEnabled" type="checkbox" class="ns-toggle" />
        </label>
        <label class="ns-row">
          <div class="ns-text">
            <b>审核结果</b>
            <small>任务拒绝、人工复核、退回重做等</small>
          </div>
          <input v-model="form.reviewNotificationEnabled" type="checkbox" class="ns-toggle" />
        </label>
        <label class="ns-row">
          <div class="ns-text">
            <b>积分与奖励</b>
            <small>到账、排行奖励、注册奖励解冻等</small>
          </div>
          <input v-model="form.pointsNotificationEnabled" type="checkbox" class="ns-toggle" />
        </label>
        <label class="ns-row">
          <div class="ns-text">
            <b>提现相关</b>
            <small>提交、审核、打款、拒绝等</small>
          </div>
          <input v-model="form.withdrawNotificationEnabled" type="checkbox" class="ns-toggle" />
        </label>
      </div>
      <button class="yx-btn full" style="margin-top:16px" :disabled="saving" @click="handleSave">
        {{ saving ? '保存中...' : '保存设置' }}
      </button>
    </section>

    <div class="yx-empty" v-else>
      <strong>加载中...</strong>
      <span>正在读取你的偏好</span>
    </div>
  </div>
</template>
'''
    t = re.sub(r"<template>[\s\S]*?</template>", new_tpl, t, count=1)
    if ".ns-row" not in t:
        t = t.replace(
            "</style>",
            """
.notification-settings-page .ns-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.ns-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(31, 42, 65, 0.08);
  cursor: pointer;
}
.ns-row:last-of-type {
  border-bottom: none;
}
.ns-text b {
  display: block;
  font-size: 15px;
  color: #1a2332;
  margin-bottom: 4px;
}
.ns-text small {
  display: block;
  font-size: 12px;
  color: var(--yx-muted, #64748b);
  line-height: 1.45;
}
.ns-toggle {
  width: 22px;
  height: 22px;
  accent-color: #f26a4d;
  flex-shrink: 0;
}
</style>
""",
            1,
        )
    p.write_text(t, encoding="utf-8")
    print("NotificationSettings.vue OK")


def main():
    patch_home_notify()
    patch_task_detail_bonus()
    patch_signin_cards()
    for f in ("Invite.vue", "Points.vue", "Withdraw.vue"):
        patch_file_simple_heads(f)
    patch_task_list_limit()
    patch_notification_settings()


if __name__ == "__main__":
    main()
