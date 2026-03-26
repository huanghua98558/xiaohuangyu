本目录归档了 2026-03-26 从主源码目录移出的旧审核链路文件。

归档原因：
- 图片审核主链已收敛到 `ai_review_queue + imageReviewWorker`
- 连接审核主链已收敛到 `link-delay-queue + linkVerifyScheduler + linkVerifyWorker`
- 旧的 `linkVerificationService.js` 与多份 `.bak` 审核链路文件继续留在 `src/` 下容易误导排查和维护

本次归档范围：
- 旧 `aiRoutes` 备份文件
- 旧 `cronService` 审核链路备份文件
- 旧 `imageReviewService` 备份文件
- 旧 `imageReviewWorker` / `linkVerifyWorker` 备份文件
- 已无活跃引用的 `services/ai/linkVerificationService.js`
- 历史 OCR 备份模块

注意：
- 这些文件是历史参考，不应再被主流程直接引用
- 如需恢复，请先确认当前 BullMQ 主链路与数据库状态机兼容
