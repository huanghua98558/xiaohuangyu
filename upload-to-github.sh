#!/bin/bash

# 小黄鱼任务中心 - GitHub 上传脚本

echo "🚀 开始上传代码到 GitHub..."

cd /Users/huanghua/Desktop/App/xiaohuangyu1/github-upload

# 检查 Git 是否已配置
if ! git config user.name > /dev/null 2>&1; then
    echo "⚠️  请配置 Git 用户名和邮箱"
    git config user.name "huanghua98558"
    git config user.email "your-email@example.com"
fi

# 重命名分支
git branch -M main 2>/dev/null || true

# 推送到 GitHub
echo "📤 正在推送到 GitHub..."
echo "💡 提示：请输入 GitHub 用户名和密码（或个人访问令牌）"
echo ""

# 尝试推送
git push -u origin main --force

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 上传成功！"
    echo ""
    echo "📦 仓库地址：https://github.com/huanghua98558/xiaohuangyu"
    echo ""
    echo "📝 下一步："
    echo "1. 访问仓库查看代码"
    echo "2. 更新 README.md 中的联系方式"
    echo "3. 配置 GitHub Actions（可选）"
    echo "4. 添加 .env 配置文件（不要提交敏感信息）"
else
    echo ""
    echo "❌ 推送失败"
    echo ""
    echo "可能的原因："
    echo "1. GitHub 认证失败 - 请使用个人访问令牌代替密码"
    echo "2. 网络问题 - 请检查网络连接"
    echo "3. 仓库不存在 - 请先在 GitHub 创建仓库"
    echo ""
    echo "解决方案："
    echo "1. 创建个人访问令牌：https://github.com/settings/tokens"
    echo "2. 使用令牌推送：git push https://<TOKEN>@github.com/huanghua98558/xiaohuangyu.git main"
fi
