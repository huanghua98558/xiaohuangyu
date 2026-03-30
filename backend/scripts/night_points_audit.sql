-- 夜间积分机制核验 SQL（手工执行）

-- 1) 核验核心表是否存在
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'claims',
    'records',
    'tasks',
    'night_point_config',
    'online_user_coefficient_map',
    'night_task_points_log'
  )
ORDER BY table_name;

-- 2) 核验 claims 关键字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'claims'
  AND column_name IN (
    'reward',
    'base_reward',
    'night_coefficient',
    'online_users',
    'final_points',
    'bonus_points',
    'publish_time_snapshot',
    'config_snapshot',
    'settlement_snapshot',
    'review_history'
  )
ORDER BY column_name;

-- 3) 核验 records 可追溯字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'records'
  AND column_name IN ('user_id', 'task_id', 'type', 'points', 'desc', 'extra_data', 'created_at')
ORDER BY column_name;

-- 4) 最近100条任务积分发放记录
SELECT id, user_id, task_id, points, "desc", created_at, extra_data
FROM records
WHERE type = 'task'
ORDER BY created_at DESC
LIMIT 100;

-- 5) 检查同 claim 是否重复发放
WITH reward_records AS (
  SELECT
    id,
    created_at,
    COALESCE(
      NULLIF(substring(extra_data FROM '\"claimId\"\\s*:\\s*\"?([0-9]+)\"?'), ''),
      NULLIF(split_part(split_part("desc", 'claim:', 2), ')', 1), '')
    ) AS claim_id_text
  FROM records
  WHERE type = 'task'
    AND (
      "desc" LIKE '%claim:%'
      OR extra_data LIKE '%\"claimId\"%'
    )
)
SELECT claim_id_text, COUNT(*) AS cnt, MIN(created_at) AS first_at, MAX(created_at) AS last_at
FROM reward_records
WHERE claim_id_text <> ''
GROUP BY claim_id_text
HAVING COUNT(*) > 1
ORDER BY cnt DESC, last_at DESC;

-- 6) 检查已完成 claim 的发放一致性（claim.reward vs 任务记录points）
WITH latest_record AS (
  SELECT
    COALESCE(
      NULLIF(substring(extra_data FROM '\"claimId\"\\s*:\\s*\"?([0-9]+)\"?'), ''),
      NULLIF(split_part(split_part("desc", 'claim:', 2), ')', 1), '')
    ) AS claim_id_text,
    MAX(created_at) AS last_created_at
  FROM records
  WHERE type = 'task'
    AND (
      "desc" LIKE '%claim:%'
      OR extra_data LIKE '%\"claimId\"%'
    )
  GROUP BY COALESCE(
    NULLIF(substring(extra_data FROM '\"claimId\"\\s*:\\s*\"?([0-9]+)\"?'), ''),
    NULLIF(split_part(split_part("desc", 'claim:', 2), ')', 1), '')
  )
),
record_points AS (
  SELECT
    COALESCE(
      NULLIF(substring(r.extra_data FROM '\"claimId\"\\s*:\\s*\"?([0-9]+)\"?'), ''),
      NULLIF(split_part(split_part(r."desc", 'claim:', 2), ')', 1), '')
    ) AS claim_id_text,
    r.points
  FROM records r
  JOIN latest_record lr
    ON COALESCE(
         NULLIF(substring(r.extra_data FROM '\"claimId\"\\s*:\\s*\"?([0-9]+)\"?'), ''),
         NULLIF(split_part(split_part(r."desc", 'claim:', 2), ')', 1), '')
       ) = lr.claim_id_text
   AND r.created_at = lr.last_created_at
)
SELECT
  c.id AS claim_id,
  c.status,
  c.reward AS claim_reward,
  rp.points AS record_points,
  c.night_coefficient,
  c.online_users,
  c.reviewed_at
FROM claims c
LEFT JOIN record_points rp ON rp.claim_id_text = c.id::text
WHERE c.status IN ('done', 'approved')
ORDER BY c.reviewed_at DESC
LIMIT 100;
