# 小黄鱼管理后台

基于 Next.js 16 + React 19 + TypeScript + shadcn/ui 的全栈管理后台应用。

## 架构说明

**部署模式**: Next.js 独立服务模式  
**服务端口**: 5001（内部）  
**访问路径**: `/admin`

### 架构优势

| 特性 | 说明 |
|:-----|:-----|
| SPA 路由 | 页面切换无刷新，体验流畅 |
| 持久连接 | WebSocket 在页面切换时保持连接 |
| 热更新 | 开发环境支持 HMR |
| SEO 友好 | 支持 SSR/SSG |

## 快速开始

### 开发环境

```bash
# 安装依赖
pnpm install

# 启动开发服务器 (端口 5001)
pnpm dev --port 5001 --host
```

访问 http://localhost:5001/admin

### 生产环境

```bash
# 构建
pnpm build

# 启动生产服务
pnpm start --port 5001
```

## 项目结构

```
admin/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (admin)/             # 管理后台路由组
│   │   │   ├── layout.tsx       # 管理后台布局
│   │   │   ├── dashboard/       # 数据中心
│   │   │   ├── tasks/           # 任务管理
│   │   │   ├── users/           # 用户管理
│   │   │   ├── review/          # 审核中心
│   │   │   ├── withdraw/        # 提现管理
│   │   │   └── settings/        # 系统设置
│   │   ├── login/               # 登录页
│   │   └── globals.css          # 全局样式
│   │
│   ├── components/              # React 组件
│   │   ├── ui/                  # shadcn/ui 基础组件
│   │   └── admin/               # 管理后台专用组件
│   │
│   ├── lib/                     # 工具函数
│   │   ├── api.ts               # API 封装
│   │   ├── auth-context.tsx     # 认证上下文
│   │   └── utils.ts             # 工具函数
│   │
│   └── hooks/                   # 自定义 Hooks
│       ├── useWebSocket.ts      # WebSocket Hook
│       └── useAuth.ts           # 认证 Hook
│
├── next.config.ts               # Next.js 配置
├── tailwind.config.ts           # Tailwind 配置
└── .coze                        # 服务配置
```

## 核心功能模块

### 数据中心 (`/admin/dashboard`)
- 统计概览卡片
- 趋势图表
- 实时数据更新

### 任务管理 (`/admin/tasks`)
- 任务列表
- 创建/编辑任务
- 任务上下架

### 用户管理 (`/admin/users`)
- 用户列表
- 用户详情
- 封禁/解封
- 积分调整

### 审核中心 (`/admin/review`)
- 待审核列表
- 任务审核（通过/拒绝）
- 批量操作

### 提现管理 (`/admin/withdraw`)
- 提现申请列表
- 审核提现
- 打款记录

### 系统设置 (`/admin/settings`)
- 系统参数配置
- 角色权限管理

## API 配置

### 开发环境

API 请求通过 Next.js rewrites 代理到后端：

```typescript
// next.config.ts
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:8080/api/:path*',
    },
  ];
}
```

### 生产环境

通过 Nginx 代理，API 地址为相对路径：

```typescript
const API_BASE_URL = '';  // 同源请求
```

## WebSocket 配置

### 连接地址

```typescript
// 开发环境
const WS_URL = 'ws://localhost:8080/ws?type=admin';

// 生产环境
const WS_URL = `wss://${window.location.host}/ws/admin`;
```

### 使用方式

```typescript
import { useWebSocket } from '@/hooks/useWebSocket';

function MyComponent() {
  const { connected, send, subscribe } = useWebSocket();
  
  // 发送消息
  send({ type: 'ping' });
  
  // 订阅消息
  subscribe('task_update', (data) => {
    console.log('任务更新:', data);
  });
}
```

## 组件规范

### 优先使用 shadcn/ui

```tsx
// ✅ 推荐
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// ❌ 避免
<div className="px-4 py-2 bg-blue-500">自定义按钮</div>
```

### 样式开发

使用 Tailwind CSS：

```tsx
<div className="flex items-center gap-4 p-4 rounded-lg bg-background">
  <Button variant="default">主要按钮</Button>
  <Button variant="outline">次要按钮</Button>
</div>
```

## 开发规范

### 依赖管理

```bash
# ✅ 使用 pnpm
pnpm add package-name
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
```

### 路由开发

```bash
# 创建新路由
src/app/(admin)/new-page/page.tsx
```

### API 调用

```typescript
// 使用封装的 API
import { api } from '@/lib/api';

const users = await api.get('/admin/users');
```

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| reviewer | reviewer123 | 审核员 |

> ⚠️ 生产环境请立即修改默认密码！

## 相关文档

- [系统架构设计 v3.0](../docs/系统架构设计-v3.md)
- [部署指南](../docs/DEPLOYMENT.md)
- [后端服务](../backend/README.md)
