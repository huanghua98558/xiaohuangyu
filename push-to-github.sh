#!/bin/bash
echo "🚀 开始推送到 GitHub..."
echo ""
echo "💡 请在下方输入你的 GitHub 个人访问令牌"
echo "   获取令牌：https://github.com/settings/tokens"
echo ""
read -p "GitHub Token: " -s GITHUB_TOKEN
echo ""
echo ""
echo "📤 正在推送..."
git push https://huanghua98558:$GITHUB_TOKEN@github.com/huanghua98558/xiaohuangyu.git main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 推送成功！"
    echo ""
    echo "🔗 查看仓库：https://github.com/huanghua98558/xiaohuangyu"
else
    echo ""
    echo "❌ 推送失败，请检查令牌是否正确"
fi
