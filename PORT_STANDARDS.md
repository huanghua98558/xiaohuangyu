# 小黄鱼系统端口规范

## ⚠️ 重要提示
**端口一旦确定，严禁随意更改！**
**如遇端口冲突，应调整冲突方，而非核心服务！**

## 核心服务端口分配 (不可更改)

| 服务名称 | 端口 | 说明 | 配置文件 |
|---------|------|------|---------|
| xiaohuangyu-backend | **5000** | 后端 API 服务 (核心) | backend/.env |
| xiaohuangyu-admin | **5001** | 管理后台前端 | admin/.env |
| xiaohuangyu-user-app | **5002** | 用户端前端 | user-app/.env |

## 辅助服务端口

| 服务名称 | 端口 | 说明 |
|---------|------|------|
| browser-service | 8000-8002 | 浏览器服务 (3个实例) |
| ocr-service | 9001 | OCR 识别服务 |
| yolo-service | 9002 | YOLO 检测服务 |
| redis | 6379 | Redis 缓存 |

## 数据库连接

| 环境 | 数据库实例 | 连接字符串关键字 |
|-----|----------|----------------|
| 生产环境 | cotton-tern-23589 | cockroachlabs.cloud:26257/xiaohuangyu |

## API 调用关系

```
┌─────────────────┐
│   Admin (5001)  │──┐
└─────────────────┘  │
                     │  /admin/api/* → http://localhost:5000/api/*
┌─────────────────┐  │
│ User-App (5002) │──┤
└─────────────────┘  │
                     ▼
              ┌─────────────┐
              │ Backend     │
              │   (5000)    │
              └─────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ CockroachDB │
              │ cotton-tern │
              └─────────────┘
```

## 配置文件清单

### Backend 配置
- `backend/.env` - 主配置
- `backend/.env.production` - 生产配置
- `ecosystem.config.js` - PM2 配置

### Admin 配置
- `admin/.env` - 主配置
- `admin/.env.production` - 生产配置
- `admin/next.config.ts` - API 代理配置

### User-App 配置
- `user-app/.env` - 主配置
- `user-app/vite.config.js` - 开发代理配置

## 修改记录

| 日期 | 修改内容 | 修改人 |
|-----|---------|-------|
| 2026-03-25 | 创建端口规范文档 | System |
