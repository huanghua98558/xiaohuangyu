#!/bin/bash

# 小黄鱼任务中心 3.0 版本备份脚本 - 简化版
echo "🚀 开始同步服务器代码到 GitHub (v3.0)..."

LOCAL_DIR="/Users/huanghua/Desktop/App/xiaohuangyu1/github-upload"

cd $LOCAL_DIR

echo "📦 从服务器拉取最新代码..."

# 使用 rsync 从服务器同步
rsync -avz --progress \
  -e "ssh -o StrictHostKeyChecking=no" \
  ubuntu@43.161.224.174:/var/www/xiaohuangyu/backend/src/ \
  ./backend/src/

rsync -avz --progress \
  -e "ssh -o StrictHostKeyChecking=no" \
  ubuntu@43.161.224.174:/var/www/xiaohuangyu/backend/prisma/ \
  ./backend/prisma/

rsync -avz --progress \
  -e "ssh -o StrictHostKeyChecking=no" \
  ubuntu@43.161.224.174:/var/www/xiaohuangyu/user-app/src/ \
  ./user-app/src/

rsync -avz --progress \
  -e "ssh -o StrictHostKeyChecking=no" \
  ubuntu@43.161.224.174:/var/www/xiaohuangyu/admin/src/ \
  ./admin/src/

echo ""
echo "📝 提交更改到 Git..."

git add -A

if git diff --staged --quiet; then
    echo "✅ 没有更改，代码已是最新"
else
    git commit -m "chore: 同步服务器最新代码 - v3.0 版本发布"
    
    echo "🏷️  创建 v3.0.0 标签..."
    git tag -a "v3.0.0" -m "小黄鱼任务中心 v3.0.0 - CockroachDB 全面迁移完成"
    
    echo "📤 推送到 GitHub..."
    git push origin main
    git push origin v3.0.0
    
    echo "✅ 成功推送到 GitHub！"
fi

echo ""
echo "🎉 v3.0 版本备份完成！"
echo ""
