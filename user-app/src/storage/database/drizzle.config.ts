import { defineConfig } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// 从环境变量获取 Supabase 凭据
const getSupabaseCredentials = () => {
  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('COZE_SUPABASE_URL and COZE_SUPABASE_ANON_KEY must be set');
  }

  // 解析 Supabase URL 获取数据库连接信息
  // URL 格式: https://<project-ref>.supabase.co
  const urlObj = new URL(url);
  const host = urlObj.hostname;
  const projectRef = host.split('.')[0];

  return {
    host,
    projectRef,
    anonKey,
  };
};

const { host, projectRef } = getSupabaseCredentials();

// Supabase 使用连接池端口 6543 (pgBouncer)
// 直连端口 5432 用于迁移
export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: host,
    port: 5432,
    user: 'postgres',
    password: process.env.COZE_SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD || '',
    database: 'postgres',
    ssl: true,
  },
  verbose: true,
  strict: true,
});
