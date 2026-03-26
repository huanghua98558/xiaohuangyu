# 小黄鱼系统配置报告

## 生成时间
2026-03-25 00:37

## 一、端口分配规范

### 核心服务端口 (严禁更改)
| 服务 | 端口 | 状态 | 配置文件 |
|-----|------|------|---------|
| xiaohuangyu-backend | **5000** | ✅ 运行中 | backend/.env |
| xiaohuangyu-admin | **5001** | ✅ 运行中 | admin/.env |
| xiaohuangyu-user-app | **5002** | ✅ 运行中 | user-app/.env |

### 辅助服务端口
| 服务 | 端口 | 说明 |
|-----|------|------|
| browser-service | 8000-8002 | 浏览器自动化服务 |
| ocr-service | 9001 | OCR 识别服务 |
| yolo-service | 9002 | YOLO 检测服务 |
| redis | 6379 | 消息队列 |

## 二、数据库配置

### 当前数据库
- **实例名**: cotton-tern-23589
- **类型**: CockroachDB Serverless
- **区域**: aws-ap-southeast-1
- **数据库**: xiaohuangyu

### 连接配置位置
| 文件 | 用途 |
|-----|------|
| backend/.env | Backend 服务 |
| backend/.env.production | Backend 生产环境 |
| admin/.env | Admin SSR |
| admin/.env.production | Admin 生产环境 |
| ecosystem.config.js | PM2 Workers |

## 三、API 调用关系

```
┌─────────────────┐
│   Admin (5001)  │──┐
│  /admin/api/*   │  │
└─────────────────┘  │
                     │  代理转发
┌─────────────────┐  │
│ User-App (5002) │──┤
│    /api/*       │  │
└─────────────────┘  │
                     ▼
              ┌─────────────┐
              │ Backend     │
              │   (5000)    │
              │  /api/*     │
              └─────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ CockroachDB │
              │ cotton-tern │
              └─────────────┘
```

## 四、已修复的问题

### 硬编码端口修复
| 文件 | 原端口 | 修复后 |
|-----|--------|-------|
| backend/src/routes/ipMonitorRoutes.js | 3000 | 5000 |
| backend/src/workers/linkVerifyWorker.js | 3000 | 5000 |
| user-app/server.js | 3000 | 5000 |
| user-app/vite.config.js | 3000 | 5000 |
| admin/next.config.ts | 3000 | 5000 |
| admin/src/app/api/[...slug]/route.ts | 3000 | 5000 |

### 数据库连接统一
所有服务统一连接到 cotton-tern-23589 数据库实例。

## 五、配置文件清单

### Backend 配置
```
backend/
├── .env                 # 主配置 (PORT=5000, DATABASE_URL)
├── .env.production      # 生产配置
├── .env.test           # 测试配置
├── ecosystem.config.js  # PM2 配置
└── prisma/schema.prisma # 数据库 Schema
```

### Admin 配置
```
admin/
├── .env                 # 主配置 (BACKEND_URL, DATABASE_URL)
├── .env.local          # 本地配置
├── .env.production     # 生产配置
├── next.config.ts      # API 代理配置
└── ecosystem.config.js # PM2 配置
```

### User-App 配置
```
user-app/
├── .env               # 主配置 (PORT=5002, BACKEND_URL)
├── server.js          # Express 代理服务器
└── vite.config.js     # Vite 开发代理配置
```

## 六、测试验证

### API 端点测试
| 端点 | 状态 |
|-----|------|
| GET /api/health | ✅ 正常 |
| GET /api/tasks | ✅ 正常 |
| GET /api/internal/ip/status | ✅ 正常 |
| GET /api/internal/queue/status | ✅ 正常 |

### 代理测试
| 代理路径 | 状态 |
|---------|------|
| Admin → Backend | ✅ 正常 |
| User-App → Backend | ✅ 正常 |

### 数据库连接测试
| 表 | 记录数 |
|---|-------|
| tasks | 15 |
| users | 82 |
| claims | 0 |
| configs | 50 |

## 七、注意事项

### ⚠️ 端口规范
1. **严禁随意更改端口**
2. 如遇端口冲突，应调整冲突方，而非核心服务
3. 所有代码中应使用环境变量或默认值 `localhost:5000`

### ⚠️ 数据库规范
1. 所有服务必须使用同一数据库连接
2. 严禁在代码中硬编码数据库连接
3. Schema 变更需要同步更新 Prisma

### ⚠️ API 代理规范
1. Admin 使用 `/admin/api/*` 前缀
2. User-App 使用 `/api/*` 前缀
3. 代理目标统一为 `http://localhost:5000/api/*`
