#!/usr/bin/env python3
"""
在服务器执行：统一首页定位加载逻辑，避免因只读缓存分支与 getLocation 不一致导致「不自动出地址」。

sudo python3 /var/www/xiaohuangyu/server_scripts/patch_home_location_load.py

然后：
  cd /var/www/xiaohuangyu/user-app && npm run build
  cd /var/www/xiaohuangyu/admin && npm run build
  pm2 restart xiaohuangyu-backend xiaohuangyu-admin
"""
from pathlib import Path

HOME = Path("/var/www/xiaohuangyu/user-app/src/views/Home.vue")


def main():
    if not HOME.exists():
        print("SKIP: Home.vue not found")
        return
    t = HOME.read_text(encoding="utf-8")
    old = """async function loadLocationFromCache() {
  locationLoading.value = true
  locationError.value = ''
  try {
    const cached = getSavedLocation()
    if (cached) {
      userLocation.value = cached
    } else {
      userLocation.value = await getLocation()
    }
  } catch (e) {
    locationError.value = e.message || '定位失败'
  } finally {
    locationLoading.value = false
  }
}"""
    new = """async function loadLocationFromCache() {
  locationLoading.value = true
  locationError.value = ''
  try {
    // 始终走 getLocation：内部会优先用未过期且完整的缓存，并统一走 GPS 配额 / IP 兜底
    userLocation.value = await getLocation()
  } catch (e) {
    locationError.value = e.message || '定位失败'
  } finally {
    locationLoading.value = false
  }
}"""
    if old in t:
        HOME.write_text(t.replace(old, new), encoding="utf-8")
        print("Home.vue: loadLocationFromCache patched")
    elif "userLocation.value = await getLocation()" in t and "const cached = getSavedLocation()" not in t.split("loadLocationFromCache")[1].split("function")[0]:
        print("Home.vue: already using getLocation-only path")
    else:
        print("Home.vue: pattern not matched, check manually")


if __name__ == "__main__":
    main()
