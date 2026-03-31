-- 步骤 3+4：回填 remain / task_exposure.accepted_count，并添加 CHECK 约束
-- 在 CockroachDB / PostgreSQL 上执行；执行前建议备份。

-- 占用名额的状态（与业务统计一致）
-- doing, submitted, image_reviewing, pending_link, link_reviewing, pending_manual, done, approved

-- 3a) 按领取记录重算活跃任务的 remain
UPDATE tasks t
SET
  remain = GREATEST(
    0,
    t.need_count - COALESCE(
      (
        SELECT COUNT(*)::int
        FROM claims c
        WHERE
          c.task_id = t.id
          AND c.status IN (
            'doing',
            'submitted',
            'image_reviewing',
            'pending_link',
            'link_reviewing',
            'pending_manual',
            'done',
            'approved'
          )
      ),
      0
    )
  ),
  updated_at = NOW()
WHERE
  t.status = 'active';

-- 3b) 同步 task_exposure.accepted_count
UPDATE task_exposure e
SET
  accepted_count = COALESCE(
    (
      SELECT COUNT(*)::int
      FROM claims c
      WHERE
        c.task_id = e.task_id
        AND c.status IN (
          'doing',
          'submitted',
          'image_reviewing',
          'pending_link',
          'link_reviewing',
          'pending_manual',
          'done',
          'approved'
        )
    ),
    0
  ),
  updated_at = NOW();

-- 4) 约束（若已存在同名约束会报错，可先 DROP）
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS chk_tasks_remain_nonneg;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS chk_tasks_remain_lte_need;

ALTER TABLE tasks
  ADD CONSTRAINT chk_tasks_remain_nonneg CHECK (remain >= 0);

ALTER TABLE tasks
  ADD CONSTRAINT chk_tasks_remain_lte_need CHECK (remain <= need_count);
