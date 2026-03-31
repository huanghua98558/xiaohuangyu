import "dotenv/config"
import db from "../src/config/database.js"

const stmts = [
  `UPDATE tasks t
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
            'doing', 'submitted', 'image_reviewing', 'pending_link', 'link_reviewing',
            'pending_manual', 'done', 'approved'
          )
      ),
      0
    )
  ),
  updated_at = NOW()
WHERE
  t.status = 'active'`,

  `UPDATE task_exposure e
SET
  accepted_count = COALESCE(
    (
      SELECT COUNT(*)::int
      FROM claims c
      WHERE
        c.task_id = e.task_id
        AND c.status IN (
          'doing', 'submitted', 'image_reviewing', 'pending_link', 'link_reviewing',
          'pending_manual', 'done', 'approved'
        )
    ),
    0
  ),
  updated_at = NOW()`,

  `ALTER TABLE tasks DROP CONSTRAINT IF EXISTS chk_tasks_remain_nonneg`,
  `ALTER TABLE tasks DROP CONSTRAINT IF EXISTS chk_tasks_remain_lte_need`,
  `ALTER TABLE tasks ADD CONSTRAINT chk_tasks_remain_nonneg CHECK (remain >= 0)`,
  `ALTER TABLE tasks ADD CONSTRAINT chk_tasks_remain_lte_need CHECK (remain <= need_count)`
]

for (let i = 0; i < stmts.length; i++) {
  const r = await db.query(stmts[i])
  console.log("OK step", i + 1, "rowCount", r.rowCount ?? "-")
}

const accStatuses = [
  "doing",
  "submitted",
  "image_reviewing",
  "pending_link",
  "link_reviewing",
  "pending_manual",
  "done",
  "approved"
]

const check = await db.queryMany(
  `SELECT t.id::text, t.need_count::text, t.remain::text,
    (SELECT COUNT(*)::text FROM claims c WHERE c.task_id = t.id AND c.status = ANY($1)) AS acc
   FROM tasks t WHERE t.status = $2 ORDER BY t.id`,
  [accStatuses, "active"]
)
let bad = 0
for (const r of check) {
  const exp = Number(r.need_count) - Number(r.acc)
  if (Number(r.remain) !== exp) {
    bad++
    console.log(
      "REMAIN_MISMATCH",
      r.id,
      "need",
      r.need_count,
      "acc",
      r.acc,
      "remain",
      r.remain,
      "expected",
      exp
    )
  }
}
console.log("remain_verify_bad_rows:", bad)

const expc = await db.queryMany(
  `SELECT e.task_id::text, e.accepted_count::text,
    (SELECT COUNT(*)::text FROM claims c WHERE c.task_id = e.task_id AND c.status = ANY($1)) AS cnt
   FROM task_exposure e ORDER BY e.task_id`,
  [accStatuses]
)
let eb = 0
for (const r of expc) {
  if (Number(r.accepted_count) !== Number(r.cnt)) {
    eb++
    console.log("ACCEPTED_MISMATCH", r.task_id, r.accepted_count, r.cnt)
  }
}
console.log("accepted_verify_bad_rows:", eb)

await db.pool.end()
