#!/usr/bin/env python3
"""Apply on server: sudo python3 /var/www/xiaohuangyu/server_patch_ui_mar28.py"""
from pathlib import Path


def main():
    hp = Path("/var/www/xiaohuangyu/user-app/src/views/Home.vue")
    t = hp.read_text(encoding="utf-8")
    old = """function scheduleDeferredHomeLoad() {
  const run = async () => {
    try {
      await loadLocationFromCache()
      await loadRecommendTasks()
    } catch (e) {}
  }
  if (typeof requestIdleCallback !== undefined) {
    requestIdleCallback(() => { run() }, { timeout: 2200 })
  } else {
    setTimeout(run, 16)
  }
}"""
    new = """function scheduleDeferredHomeLoad() {
  const run = async () => {
    try {
      await loadLocationFromCache()
      await loadRecommendTasks()
    } catch (e) {}
  }
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(() => { run() }, { timeout: 2200 })
  } else {
    setTimeout(run, 300)
  }
}"""
    if old in t:
        hp.write_text(t.replace(old, new), encoding="utf-8")
        print("Home.vue OK")
    else:
        print("Home.vue skip")

    pp = Path("/var/www/xiaohuangyu/user-app/src/views/Points.vue")
    t2 = pp.read_text(encoding="utf-8")
    o1 = """      <div class="yx-card-head">
        <div>
          <h3>历史兑换记录</h3>
          <div class="yx-card-note" v-if="convertTotal > 0">共 {{ convertTotal }} 条</div>
        </div>
      </div>"""
    n1 = """      <div class="yx-card-head-bar">
        <h3>历史兑换记录<span class="yx-card-note" v-if="convertTotal > 0">共 {{ convertTotal }} 条</span></h3>
      </div>"""
    o2 = """      <div class="yx-card-head">
        <div>
          <h3>积分流水</h3>
          <div class="yx-card-note" v-if="recordsTotal > 0">共 {{ recordsTotal }} 条</div>
        </div>
      </div>"""
    n2 = """      <div class="yx-card-head-bar">
        <h3>积分流水<span class="yx-card-note" v-if="recordsTotal > 0">共 {{ recordsTotal }} 条</span></h3>
      </div>"""
    if o1 in t2:
        t2 = t2.replace(o1, n1)
    if o2 in t2:
        t2 = t2.replace(o2, n2)
    pp.write_text(t2, encoding="utf-8")
    print("Points.vue done")

    np = Path("/var/www/xiaohuangyu/user-app/src/views/NotificationSettings.vue")
    n = np.read_text(encoding="utf-8")
    if ".ns-toggle {" in n and "pointer-events: auto" not in n:
        n = n.replace(
            ".ns-toggle {",
            ".ns-toggle {\n  pointer-events: auto;",
            1,
        )
        np.write_text(n, encoding="utf-8")
        print("NotificationSettings OK")

    ip = Path("/var/www/xiaohuangyu/admin/src/app/(admin)/ip-monitor/page.tsx")
    if ip.exists():
        s = ip.read_text(encoding="utf-8")
        if "function apiOk" not in s:
            s = s.replace(
                "  const fetchData = async () => {",
                "  const apiOk = (c: unknown) => c === 0 || c === 200\n\n  const fetchData = async () => {",
            )
            s = s.replace(
                "if (ipData.code === 200) setIPStatus(ipData.data)",
                "if (apiOk(ipData.code)) setIPStatus(ipData.data)",
            )
            s = s.replace(
                "if (browserData.code === 200) setBrowserServices(browserData.data.services)",
                "if (apiOk(browserData.code)) setBrowserServices(browserData.data.services)",
            )
            s = s.replace(
                "if (queueData.code === 200) setQueues(queueData.data.queues)",
                "if (apiOk(queueData.code)) setQueues(queueData.data.queues)",
            )
            s = s.replace(
                "if (data.code === 200) {",
                "if (apiOk(data.code)) {",
            )
            ip.write_text(s, encoding="utf-8")
            print("ip-monitor OK")

    ap = Path("/var/www/xiaohuangyu/admin/src/app/(admin)/ai-assistant/page.tsx")
    if ap.exists():
        s = ap.read_text(encoding="utf-8")
        s2 = s.replace("data.code === 200", "data.code === 0 || data.code === 200")
        if s2 != s:
            ap.write_text(s2, encoding="utf-8")
            print("ai-assistant OK")

    sp = Path("/var/www/xiaohuangyu/admin/src/app/(admin)/system-logs/page.tsx")
    if sp.exists():
        s = sp.read_text(encoding="utf-8")
        if "const API_BASE = '/api'" in s:
            s = s.replace("const API_BASE = '/api'", "const API_BASE = '/admin/api'")
            sp.write_text(s, encoding="utf-8")
            print("system-logs API_BASE OK")

    al = Path("/var/www/xiaohuangyu/admin/src/app/(admin)/alerts/page.tsx")
    if al.exists():
        s = al.read_text(encoding="utf-8")
        s = s.replace(
            '<Button variant="outline" onClick={() => setHandleDialogOpen(false)}>\n              取消\n            </Button>',
            '<Button type="button" variant="outline" onClick={() => setHandleDialogOpen(false)}>\n              取消\n            </Button>',
        )
        s = s.replace(
            '<Button onClick={handleAlert}>\n                确认处理\n              </Button>',
            '<Button type="button" onClick={handleAlert}>\n                确认处理\n              </Button>',
        )
        al.write_text(s, encoding="utf-8")
        print("alerts OK")


if __name__ == "__main__":
    main()
