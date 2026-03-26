# 小黄鱼任务中心 - 完整源代码

这是一个完整的任务管理平台，包括后端 API、用户端前端和管理后台。

## 📁 项目结构

```
xiaohuangyu/
├── backend/              # 后端 Node.js 服务
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── services/        # 业务逻辑
│   │   ├── routes/          # 路由
│   │   ├── middlewares/     # 中间件
│   │   ├── utils/           # 工具函数
│   │   ├── config/          # 配置
│   │   └── app.js           # 应用入口
│   ├── package.json
│   └── .env.example         # 环境变量示例
├── user-app/             # 用户端前端 (Vue 3)
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── components/    # 通用组件
│   │   ├── api/           # API 调用
│   │   ├── store/         # 状态管理
│   │   ├── router/        # 路由
│   │   └── utils/         # 工具函数
│   ├── package.json
│   └── .env.example       # 环境变量示例
├── admin/                # 管理后台前端 (Next.js)
│   ├── src/
│   │   ├── app/           # 页面
│   │   ├── components/    # 组件
│   │   └── utils/         # 工具
│   └── package.json
├── ecosystem.config.js        # PM2 主配置
├── ecosystem.workers.config.js # PM2 Worker 配置
└── services-ecosystem.config.js # 服务配置
```

## 🚀 快速开始

### 后端部署

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件配置数据库等

# 启动服务
pm2 start ecosystem.config.js
```

### 用户端前端部署

```bash
cd user-app

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 开发模式
npm run dev

# 生产构建
npm run build
pm2 start server.js
```

### 管理后台部署

```bash
cd admin

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
pm2 start ecosystem.config.js
```

## 🔧 PM2 配置

### 启动所有服务

```bash
# 启动后端
pm2 start ecosystem.config.js

# 启动后端 worker
pm2 start ecosystem.workers.config.js

# 启动服务
pm2 start services-ecosystem.config.js

# 查看所有服务
pm2 status
```

## 📋 主要功能

### 用户端
- ✅ 任务浏览和领取
- ✅ 任务提交和审核
- ✅ 积分系统
- ✅ 签到系统
- ✅ 排行榜
- ✅ 个人中心
- ✅ 邀请系统
- ✅ PWA 支持

### 管理后台
- ✅ 任务审核
- ✅ 用户管理
- ✅ 数据统计
- ✅ 系统配置
- ✅ 积分管理
- ✅ 审核日志

### 后端服务
- ✅ RESTful API
- ✅ WebSocket 实时通信
- ✅ 定时任务
- ✅ 队列系统
- ✅ 图片审核
- ✅ 链接验证
- ✅ 暴露窗口系统
- ✅ 夜间积分加成

## 🛠️ 技术栈

### 后端
- Node.js + Express
- PostgreSQL / CockroachDB
- Prisma ORM
- Redis
- Bull 队列
- JWT 认证
- WebSocket

### 用户端前端
- Vue 3
- Vite
- Vue Router
- Pinia
- Axios
- PWA

### 管理后台
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS

## 📝 环境变量配置

### 后端 .env 示例

```env
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/xiaohuangyu
DIRECT_DATABASE_URL=postgresql://user:password@localhost:5432/xiaohuangyu

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-secret-key

# 服务端口
PORT=3001

# 其他配置
NODE_ENV=production
```

### 前端 .env 示例

```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

## 📊 数据库初始化

```bash
# 后端目录执行
cd backend
npx prisma generate
npx prisma db push

# 或者运行迁移
npx prisma migrate dev
```

## 🔐 安全说明

1. **不要提交敏感信息**
   - `.env` 文件已加入 gitignore
   - 使用 `.env.example` 作为模板
   
2. **生产环境配置**
   - 使用强密码
   - 启用 HTTPS
   - 配置防火墙
   - 定期备份数据库

## 📖 文档

- [开发计划文档](./开发计划文档 0323-0717.md)
- [系统配置报告](./SYSTEM_CONFIG_REPORT.md)
- [端口标准文档](./PORT_STANDARDS.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📞 联系方式

- GitHub Issues
- Email: [your-email@example.com]
