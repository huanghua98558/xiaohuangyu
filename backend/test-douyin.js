const { chromium } = require("playwright");

(async () => {
  console.log("=== 获取抖音评论 ===");
  const browser = await chromium.launch({ 
    headless: true, 
    args: ["--no-sandbox", "--disable-setuid-sandbox"] 
  });
  
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "zh-CN"
  });
  
  // 解析短链接
  console.log("解析短链接...");
  await page.goto("https://v.douyin.com/PZ_c2OBHV-A/", { 
    timeout: 15000,
    waitUntil: "domcontentloaded"
  });
  
  const videoUrl = page.url();
  console.log("视频链接:", videoUrl);
  
  const videoIdMatch = videoUrl.match(/video\/(\d+)/);
  if (videoIdMatch) {
    console.log("视频ID:", videoIdMatch[1]);
  }
  
  // 等待页面加载
  console.log("\n等待页面加载...");
  await page.waitForTimeout(5000);
  
  // 尝试点击评论区
  try {
    const commentBtn = page.locator("text=评论").first();
    if (await commentBtn.isVisible({ timeout: 3000 })) {
      await commentBtn.click();
      console.log("✓ 点击了评论区");
      await page.waitForTimeout(3000);
    }
  } catch (e) {
    console.log("评论区按钮:", e.message);
  }
  
  // 获取评论
  console.log("\n尝试获取评论...");
  
  const selectors = [
    "[class*=\"CommentItem\"]",
    "[class*=\"comment-item\"]",
    ".comment-item",
    "[class*=\"CommentContent\"]",
    "[data-e2e=\"comment-content\"]"
  ];
  
  let found = false;
  for (const sel of selectors) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0) {
        console.log("✓ 使用选择器", sel, "找到", count, "个元素");
        const items = await page.locator(sel).all();
        for (let i = 0; i < Math.min(10, items.length); i++) {
          const text = await items[i].textContent();
          console.log("评论", (i+1), ":", text.substring(0, 150).replace(/\n/g, " "));
        }
        found = true;
        break;
      }
    } catch (e) {}
  }
  
  if (!found) {
    // 滚动查看
    console.log("\n滚动页面...");
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(2000);
    
    // 再次尝试
    for (const sel of selectors) {
      try {
        const count = await page.locator(sel).count();
        if (count > 0) {
          console.log("✓ 滚动后找到", count, "个评论");
          break;
        }
      } catch (e) {}
    }
  }
  
  // 分析页面
  const html = await page.content();
  console.log("\n页面分析:");
  console.log("- 包含评论关键词:", html.includes("评论"));
  
  // 获取页面标题
  const title = await page.title();
  console.log("\n页面标题:", title);
  
  // 截图
  await page.screenshot({ path: "/tmp/douyin-comments.png", fullPage: false });
  console.log("截图已保存: /tmp/douyin-comments.png");
  
  await browser.close();
  console.log("\n=== 完成 ===");
})().catch(e => console.error("错误:", e.message));
