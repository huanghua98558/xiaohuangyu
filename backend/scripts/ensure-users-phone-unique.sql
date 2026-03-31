-- 手机号唯一（排除空）：上线前请先处理重复数据，否则会建索引失败。
-- 查重示例：
--   SELECT phone, COUNT(*) FROM users WHERE phone IS NOT NULL AND TRIM(phone) <> '' GROUP BY phone HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
  ON users (phone)
  WHERE phone IS NOT NULL AND TRIM(phone) <> '';
