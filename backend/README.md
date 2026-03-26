# 小黄鱼任务中心 - 后端服务

## 架构说明

**部署模式**: Express 独立服务  
**服务端口**: 8080（内部）  
**访问方式**: 通过 Nginx 代理

### 服务职责

- RESTful API 提供者
- WebSocket 服务（用户端 + 管理后台）
- 文件上传处理
- 定时任务调度
- AI 智能审核

## 技术栈

| 技术 | 版本 | 说明 |
|:-----|:-----|:-----|
| Node.js | 24.x | 运行环境 |
| Express | ^4.18.2 | Web 框架 |
| Prisma | - | ORM（Supabase） |
| WebSocket | ws | 实时通信 |
| bcrypt | - | 密码哈希 |
| JWT | - | 身份认证 |
| Zod | - | 输入验证 |
| Winston | - | 日志系统 |
| Multer | - | 文件上传 |

## 项目结构

```
backend/
├── src/
│   ├── app.js                 # 应用入口
│   ├── routes/                # API 路由
│   │   ├── userRoutes.js      # 用户路由
│   │   ├── taskRoutes.js      # 任务路由
│   │   ├── reviewRoutes.js    # 审核路由
│   │   ├── walletRoutes.js    # 钱包路由
│   │   ├── uploadRoutes.js    # 上传路由
│   │   ├── adminRoutes.js     # 管理路由
│   │   └── aiRoutes.js        # AI 路由
│   │
│   ├── controllers/           # 控制器层
│   ├── services/              # 业务逻辑层
│   │   ├── webSocketService.js    # WebSocket 服务
│   │   ├── onlineUserService.js   # 在线用户服务
│   │   ├── cronService.js         # 定时任务服务
│   │   └── ai/                    # AI 服务模块
│   │
│   ├── middlewares/           # 中间件
│   │   ├── authMiddleware.js  # 认证中间件
│   │   └── errorHandler.js    # 错误处理
│   │
│   └── utils/                 # 工具函数
│       ├── logger.js          # 日志工具
│       ├── supabase.js        # 数据库连接
│       └── redis.js           # Redis 连接
│
├── public/                    # 静态文件
│   ├── user/                  # 用户端构建产物
│   └── defaults/              # 默认资源
│
├── uploads/                   # 上传文件目录
├── logs/                      # 日志目录
├── scripts/                   # 构建脚本
├── package.json
└── .coze                      # 服务配置
```

## 快速开始

### 开发环境

```bash
# 安装依赖
pnpm install

# 启动开发服务 (端口 8080)
pnpm dev
```

### 生产环境

```bash
# 启动生产服务
pnpm start

# 或使用 PM2
pm2 start src/app.js --name xiaohuangyu-api
```

## API 接口

### 认证相关

| 方法 | 路径 | 说明 |
|:-----|:-----|:-----|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/me` | 获取当前用户 |

### 任务相关

| 方法 | 路径 | 说明 |
|:-----|:-----|:-----|
| GET | `/api/tasks` | 任务列表 |
| GET | `/api/tasks/:id` | 任务详情 |
| POST | `/api/tasks/:id/claim` | 领取任务 |
| GET | `/api/tasks/my/all` | 我的任务 |
| POST | `/api/tasks/my/:claimId/submit` | 提交任务 |

### 管理相关

| 方法 | 路径 | 说明 |
|:-----|:-----|:-----|
| GET | `/api/admin/pending` | 待审核列表 |
| POST | `/api/admin/review/:claimId` | 审核任务 |
| GET | `/api/admin/users` | 用户列表 |
| POST | `/api/admin/tasks` | 创建任务 |

### 文件上传

| 方法 | 路径 | 说明 |
|:-----|:-----|:-----|
| POST | `/api/upload/single` | 单文件上传 |
| POST | `/api/upload/multiple` | 多文件上传 |

## WebSocket 服务

### 连接方式

```
ws://localhost:8080/ws?token=xxx&type=user|admin
```

### 参数说明

| 参数 | 说明 |
|:-----|:-----|
| token | JWT 认证令牌 |
| type | 客户端类型：user（用户端）或 admin（管理后台） |

### 消息类型

```javascript
// 心跳
{ type: 'heartbeat', data: { currentPage: '/tasks' } }

// 心跳响应
{ type: 'heartbeat_ack', data: { timestamp: 1234567890, onlineCount: 100 } }

// 任务更新推送
{ type: 'task_update', data: { taskId: 1, status: 'completed' } }

// 系统通知
{ type: 'system_notice', data: { title: '通知', content: '...' } }
```

## 环境变量

```bash
# 必需
NODE_ENV=production
JWT_SECRET=your-jwt-secret-at-least-32-chars
JWT_EXPIRES_IN=7d

# Supabase（平台自动注入）
COZE_SUPABASE_URL=xxx
COZE_SUPABASE_ANON_KEY=xxx

# 可选
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
MAX_FILE_SIZE=10485760
```

## 开发命令

```bash
pnpm dev          # 开发模式（热更新）
pnpm start        # 生产模式
pnpm db:generate  # 生成 Prisma Client
pnpm db:push      # 同步数据库结构
pnpm db:seed      # 初始化种子数据
```

## 定时任务

| 任务 | 频率 | 说明 |
|:-----|:-----|:-----|
| 清理过期任务 | 每小时 | 自动关闭超时任务 |
| 计算排行榜 | 每天 0 点 | 生成日/周/月排行 |
| 清理离线用户 | 每分钟 | 更新用户在线状态 |
| 夜间积分计算 | 每小时 | 夜间活跃用户奖励 |

## 安全特性

| 特性 | 实现 |
|:-----|:-----|
| 密码安全 | bcrypt 哈希 |
| JWT 认证 | RS256 签名 |
| 输入验证 | Zod Schema |
| 请求限流 | express-rate-limit |
| 权限控制 | 角色中间件 |
| 文件上传 | 类型检查、大小限制 |

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| reviewer | reviewer123 | 审核员 |
| client | client123 | 任务发布者 |
| test | test123 | 普通用户 |

> ⚠️ 生产环境请立即修改默认密码！

## 相关文档

- [系统架构设计 v3.0](../docs/系统架构设计-v3.md)
- [部署指南](../docs/DEPLOYMENT.md)
- [管理后台](../admin/README.md)
