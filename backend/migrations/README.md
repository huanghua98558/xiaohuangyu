# 数据库迁移说明

## 执行方式

由于服务器无法直接连接Supabase数据库（IPv6问题），请通过以下方式执行迁移：

### 方式1: Supabase控制台 SQL Editor

1. 登录 Supabase 控制台: https://supabase.com/dashboard
2. 选择项目: uupwoghhivtfapbntxzs
3. 进入 SQL Editor
4. 复制 `backend/migrations/18_18_upgrade.sql` 的内容
5. 执行SQL

### 方式2: 本地psql

```bash
# 在本地电脑执行
export PGPASSWORD="n9PMo08FHepPLg4W"
psql -h db.uupwoghhivtfapbntxzs.supabase.co -U postgres.uupwoghhivtfapbntxzs -d postgres -f backend/migrations/18_18_upgrade.sql
```

## 迁移内容

1. 创建 `review_rules` 表 - 审核规则配置
2. 创建 `review_reports` 表 - 审核报告
3. 添加 `suspicious_users.suspicion_type` 列
4. 插入PaddleOCR相关配置

## 验证

执行后运行以下SQL验证:
```sql
SELECT * FROM review_rules LIMIT 5;
SELECT * FROM ai_configs WHERE key LIKE '%paddle%';
```

