/**
 * Prisma 单例模式实现
 * 
 * 作用：确保整个应用只有一个 PrismaClient 实例
 * 好处：
 * 1. 避免连接池爆炸（之前每个 Service 都创建新实例，导致 174+ 连接）
 * 2. 数据库连接复用
 * 3. 内存优化
 * 4. 避免登录错误等系统问题
 * 
 * 使用方式：
 * import prisma from '../utils/prisma.js'
 */

import pkg from "@prisma/client"; const { PrismaClient } = pkg
import pg from 'pg';
// 确保 pg 驱动 INT8 返回 Number（prisma.$queryRaw 也用 pg）
pg.types.setTypeParser(20, (val) => {
  if (val === null) return null;
  const num = Number(val);
  return Number.isSafeInteger(num) ? num : val;
})

// 使用 globalThis 在开发环境下保持单例
// 生产环境下每次重启都会重新初始化
const globalForPrisma = globalThis || {}

/**
 * @type {PrismaClient}
 */
const prisma = globalForPrisma.prisma || new PrismaClient({
  // 日志配置
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  
  // 数据源配置
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

// 开发环境下保存全局引用
// 这样在热重载时不会创建新实例
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// 优雅关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

export default prisma
