#!/bin/bash

# 快速上传截图到 OCR 服务目录

UPLOAD_DIR="/var/www/xiaohuangyu/uploads/images"

echo "=================================================="
echo "📸 上传截图到 OCR 服务目录"
echo "=================================================="
echo ""

# 检查参数
if [ $# -eq 0 ]; then
    echo "❌ 请提供截图文件路径"
    echo ""
    echo "用法："
    echo "  ./upload-to-ocr.sh screenshot1.jpg screenshot2.jpg"
    echo ""
    echo "或者指定完整路径："
    echo "  ./upload-to-ocr.sh ~/Downloads/screenshot1.jpg ~/Downloads/screenshot2.jpg"
    echo ""
    exit 1
fi

# 检查目录是否存在
if [ ! -d "$UPLOAD_DIR" ]; then
    echo "❌ 上传目录不存在：$UPLOAD_DIR"
    echo "正在创建目录..."
    sudo mkdir -p "$UPLOAD_DIR"
    sudo chmod 755 "$UPLOAD_DIR"
fi

echo "✅ 上传目录：$UPLOAD_DIR"
echo ""

# 上传文件
for file in "$@"; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "📤 上传：$filename"
        
        # 复制到上传目录
        sudo cp "$file" "$UPLOAD_DIR/"
        
        # 设置权限
        sudo chown huanghua:staff "$UPLOAD_DIR/$filename"
        sudo chmod 644 "$UPLOAD_DIR/$filename"
        
        echo "   ✅ 上传成功：$UPLOAD_DIR/$filename"
    else
        echo "   ❌ 文件不存在：$file"
    fi
done

echo ""
echo "=================================================="
echo "✅ 上传完成！"
echo "=================================================="
echo ""
echo "验证上传："
echo "  ls -la $UPLOAD_DIR"
echo ""
echo "运行测试："
echo "  cd /Users/huanghua/Desktop/App/xiaohuangyu1/backend"
echo "  NODE_TLS_REJECT_UNAUTHORIZED=0 node test-full-audit-flow.js"
echo ""
