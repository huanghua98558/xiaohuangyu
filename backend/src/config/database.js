/**
 * CockroachDB 数据库连接配置
 */

import pg from 'pg';
const { Pool } = pg;

// 数据库连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

const RETRYABLE_TRANSACTION_CODES = new Set(['40001']);
const DEFAULT_TRANSACTION_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableTransactionError(error) {
  if (!error) return false;
  if (RETRYABLE_TRANSACTION_CODES.has(error.code)) return true;

  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('restart transaction') ||
    message.includes('retry transaction') ||
    message.includes('serialization failure')
  );
}

// 连接事件
pool.on('connect', () => {
  console.log('[DB] CockroachDB 连接成功');
});

pool.on('error', (err) => {
  console.error('[DB] CockroachDB 连接错误:', err.message);
});

/**
 * 执行查询
 */
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (duration > 1000) {
    console.log(`[DB] 慢查询 (${duration}ms): ${text.substring(0, 100)}...`);
  }
  
  return res;
}

/**
 * 获取单行结果
 */
export async function queryOne(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

/**
 * 获取多行结果
 */
export async function queryMany(text, params) {
  const res = await query(text, params);
  return res.rows;
}

/**
 * 事务执行
 */
export async function transaction(callback) {
  let attempt = 0;

  while (attempt <= DEFAULT_TRANSACTION_RETRIES) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[DB] 事务回滚失败:', rollbackError.message);
      }

      if (!isRetryableTransactionError(e) || attempt >= DEFAULT_TRANSACTION_RETRIES) {
        throw e;
      }

      const backoffMs = 50 * (2 ** attempt);
      console.warn(
        `[DB] 事务冲突，准备重试 (${attempt + 1}/${DEFAULT_TRANSACTION_RETRIES})，原因: ${e.message}`
      );
      attempt += 1;
      await sleep(backoffMs);
    } finally {
      client.release();
    }
  }
}

export default {
  query,
  queryOne,
  queryMany,
  transaction,
  pool
};
