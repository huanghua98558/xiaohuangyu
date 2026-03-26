# 📸 上传截图到 OCR 服务目录

## ✅ 目录已创建

**OCR 服务期望的图片路径**:
```
/var/www/xiaohuangyu/uploads/images/
```

## 📋 上传方法

### 方法 1: 使用 SCP（推荐）

在您的电脑上执行：

```bash
# 上传截图 1（视频播放页）
scp /path/to/screenshot1.jpg huanghua@192.168.2.78:/var/www/xiaohuangyu/uploads/images/screenshot1.jpg

# 上传截图 2（评论区）
scp /path/to/screenshot2.jpg huanghua@192.168.2.78:/var/www/xiaohuangyu/uploads/images/screenshot2.jpg
```

**需要输入密码**：您的 Mac 用户密码

---

### 方法 2: 使用 AirDrop 或文件共享

1. 将截图发送到 Mac
2. 移动到下载文件夹
3. 使用命令行复制：

```bash
sudo cp ~/Downloads/screenshot1.jpg /var/www/xiaohuangyu/uploads/images/
sudo cp ~/Downloads/screenshot2.jpg /var/www/xiaohuangyu/uploads/images/
sudo chown huanghua:staff /var/www/xiaohuangyu/uploads/images/*.jpg
```

---

### 方法 3: 直接拖放到 Finder

1. 打开 Finder
2. 按 `Cmd + Shift + G`
3. 输入：`/var/www/xiaohuangyu/uploads/images`
4. 将截图拖放到此文件夹

---

## ✅ 验证上传成功

运行以下命令：

```bash
ls -la /var/www/xiaohuangyu/uploads/images/
```

**预期输出**：
```
total 8
drwxr-xr-x  2 root  wheel  64  3 21 16:13 .
drwxr-xr-x  5 root  wheel  160  3 21 16:13 ..
-rw-r--r--  1 root  wheel  123456  3 21 16:14 screenshot1.jpg
-rw-r--r--  1 root  wheel  234567  3 21 16:14 screenshot2.jpg
```

---

## 🚀 运行测试

上传完成后，运行完整测试：

```bash
cd /Users/huanghua/Desktop/App/xiaohuangyu1/backend

# 方法 1: 使用上传的图片运行完整测试
NODE_TLS_REJECT_UNAUTHORIZED=0 node test-full-audit-flow.js

# 方法 2: 运行简化测试
NODE_TLS_REJECT_UNAUTHORIZED=0 node test-with-mock-data.js
```

---

## 📝 图片路径格式

测试脚本中使用的路径格式：

```javascript
const testConfig = {
  screenshots: [
    '/var/www/xiaohuangyu/uploads/images/screenshot1.jpg',
    '/var/www/xiaohuangyu/uploads/images/screenshot2.jpg'
  ]
}
```

或者使用 URL 格式：

```javascript
const testConfig = {
  screenshots: [
    'http://localhost:8080/uploads/images/screenshot1.jpg',
    'http://localhost:8080/uploads/images/screenshot2.jpg'
  ]
}
```

---

## 💡 提示

- 文件名可以是任意名称，只要以 `.jpg` 或 `.png` 结尾
- 图片大小建议不超过 5MB
- 确保截图清晰，文字可读

---

## 🔍 故障排查

### 权限问题

```bash
# 修改所有者
sudo chown -R huanghua:staff /var/www/xiaohuangyu/uploads/images/

# 修改权限
sudo chmod 755 /var/www/xiaohuangyu/uploads/images/
```

### 文件不存在

```bash
# 检查文件
ls -la /var/www/xiaohuangyu/uploads/images/

# 如果不存在，请重新上传
```

---

**现在请将截图上传到 `/var/www/xiaohuangyu/uploads/images/` 目录！** 📸
