# 两机 OCR 真实部署文档

更新时间：2026-03-31

本文档是当前两机 OCR 部署的唯一真相，用于指导主机与备机的实际上线。

适用范围：

- 主机 OCR homepage profile（主页图规则档）
- 备机 OCR comment profile（评论图规则档）
- `backend` 对 OCR 池的调用配置
- `PM2` 服务命名、端口、验证与回滚

不包含内容：

- 数据库密码、API key、代理账号密码等敏感信息
- 旧版单机 OCR 部署方式
- 已归档的历史审核链路

## 1. 部署目标

当前目标不是“所有 OCR 混跑”，而是“按图片角色做硬分工”：

- 主机只承载 `homepage` OCR
- 备机只承载 `comment` OCR
- `backend` 按 profile（规则档）区分 OCR 池

这样做的原因：

- 降低不同截图类型混跑带来的误判
- 让主机与备机职责更清晰
- 为后续 `image router / image merger` 拆分做准备

## 2. 机器角色

### 2.1 主机

机器：

- `43.161.224.174`

职责：

- `backend`
- `Redis`
- `BullMQ`
- `browser-service`
- `YOLO`
- `homepage OCR`
- 文件主存储

### 2.2 备机

机器：

- `43.161.232.26`

职责：

- `comment OCR`

说明：

- 备机当前只承担评论截图 OCR 计算
- 不部署主 `backend`
- 不部署主队列消费链路

## 3. 当前真实 PM2 服务名

### 3.1 主机 OCR

配置文件：

- `services/ocr_service/ecosystem.main-ocr.config.cjs`

服务列表：

| 服务名 | 端口 | OCR_PROFILE | OCR_NODE_ID |
| --- | --- | --- | --- |
| `xhy-ocr-homepage-1` | `9001` | `homepage` | `xhy-main-homepage-1` |
| `xhy-ocr-homepage-2` | `9002` | `homepage` | `xhy-main-homepage-2` |

注意：

- 端口由 `env.PORT` 显式提供
- 不再依赖 `args`

### 3.2 备机 OCR

配置文件：

- `services/ocr_service/ecosystem.backup-ocr.config.cjs`

服务列表：

| 服务名 | 端口 | OCR_PROFILE | OCR_NODE_ID |
| --- | --- | --- | --- |
| `xhy-ocr-comment-1` | `9001` | `comment` | `xhy-backup-comment-1` |
| `xhy-ocr-comment-2` | `9002` | `comment` | `xhy-backup-comment-2` |

说明：

- 如果后续扩到 `comment-3/4`，必须继续显式声明 `PORT`
- 不允许多个实例共用默认端口

## 4. backend 当前 OCR 池配置

配置来源：

- `backend/.env`
- `backend/src/utils/ocrServicePools.js`

当前逻辑：

- `OCR_HOMEPAGE_URLS` 优先
- 兼容 `IMAGE_REVIEW_OCR_HOMEPAGE_URLS`
- `OCR_COMMENT_URLS` 优先
- 兼容 `IMAGE_REVIEW_OCR_COMMENT_URLS`

当前默认池：

- homepage pool:
  - `http://127.0.0.1:9001`
  - `http://127.0.0.1:9002`
- comment pool:
  - `http://127.0.0.1:9101`
  - `http://127.0.0.1:9102`

说明：

- homepage pool 指向主机本地 OCR
- comment pool 当前仍是 tunnel（隧道）接入方式
- `backend` 已能区分 `homepage` / `comment` profile

## 5. OCR 服务约束

OCR 服务代码：

- `services/ocr_service/app.py`

当前已支持的运行时能力：

- `OCR_PROFILE=homepage|comment|mixed`
- `OCR_ENFORCE_PROFILE=true|false`
- `/` 健康检查
- `/health` 健康检查
- 健康检查返回：
  - `status`
  - `node`
  - `profile`
  - `enforce_profile`
  - `in_flight`
  - `max_concurrency`

上线要求：

- 主机实例必须使用 `OCR_PROFILE=homepage`
- 备机实例必须使用 `OCR_PROFILE=comment`
- 生产环境建议 `OCR_ENFORCE_PROFILE=true`

## 6. 图片审核链路当前真实状态

当前图片审核主链已经切为：

- `claims`
- `ai_review_queue`
- `imageReviewWorker`
- `homepageOcrWorker`
- `commentOcrWorker`
- `imageReviewMergeWorker`

当前职责边界：

- `imageReviewWorker` 只负责截图预判、route plan 落库、OCR job 拆分
- `homepageOcrWorker / commentOcrWorker` 负责按 profile 轮询消费 OCR jobs
- `imageReviewMergeWorker` 负责在 `merge_ready` 后重组 `combinedEvidence`，并执行最终图片审核判定与落库

当前已落地的点：

- `imageReviewWorker` 会按截图角色选择 OCR profile
- `imageReviewWorker` 已不再同步执行整条 OCR + merge 后半链路
- `imageReviewMergeWorker` 已接管 `combinedEvidence -> evaluateResult -> persistence`
- `backend/src/workers/imageReviewWorker.js` 已使用新的本地 OCR PM2 服务名：
  - `xhy-ocr-homepage-1`
  - `xhy-ocr-homepage-2`

当前 `YOLO` 的职责边界：

- `YOLO` 只用于主页类截图的互动按钮识别
- 当前实际识别项是：
  - `点赞`
  - `收藏`
  - `关注`
- `YOLO` 不负责评论正文识别
- `YOLO` 不负责评论人昵称识别
- `YOLO` 不负责达人名字识别
- 这些文字类识别都由 `OCR` 负责
- 当前流程里，只有图片被判断为主页类截图时，才会调用 `YOLO`

当前未完成的点：

- comment OCR 仍主要通过 tunnel 池访问
- 最终仍需补充生产级监控、报警和故障切回预案

## 7. submissionVersion 当前真实状态

本轮已补齐：

- `claims.submission_version`
- `ai_review_queue.submission_version`

对应迁移文件：

- `backend/migrations/20260331_submission_version_support.sql`

当前作用：

- 每次提交写入新的 `submissionVersion`
- 图片审核队列持久化对应版本
- `imageReviewWorker` 优先读取 `submission_version`
- 链接审核 `jobId` 已使用 `claimId + submissionVersion`

上线前必须确认：

- 数据库已执行该 migration（迁移）

## 8. 上线顺序

推荐按以下顺序上线，避免配置和代码不一致：

1. 部署代码到主机和备机
2. 在数据库执行 `backend/migrations/20260331_submission_version_support.sql`
3. 在备机启动 comment OCR
4. 在主机启动 homepage OCR
5. 确认 tunnel 或网络转发可达
6. 更新主机 `backend/.env` 的 OCR 池配置
7. 重启主机 `backend` 和 `image-review-worker`
8. 验证健康检查和图片审核链路

不要反过来做：

- 先重启 `backend`，再补 OCR 配置
- 先启动多个 OCR 实例，但不显式声明 `PORT`

## 9. 主机上线检查清单

- `services/ocr_service/ecosystem.main-ocr.config.cjs` 已使用新版本
- 主机 OCR 服务名为：
  - `xhy-ocr-homepage-1`
  - `xhy-ocr-homepage-2`
- 主机 OCR 端口：
  - `9001`
  - `9002`
- `backend/.env` 中 homepage pool 指向 `9001,9002`
- `imageReviewWorker` 代码已使用新的 PM2 服务名

验证项：

- `http://127.0.0.1:9001/health`
- `http://127.0.0.1:9002/health`

预期返回：

- `profile=homepage`
- `status=ok`

## 10. 备机上线检查清单

- `services/ocr_service/ecosystem.backup-ocr.config.cjs` 已使用新版本
- 备机 OCR 服务名为：
  - `xhy-ocr-comment-1`
  - `xhy-ocr-comment-2`
- 备机 OCR 端口：
  - `9001`
  - `9002`
- `OCR_PROFILE=comment`
- `OCR_ENFORCE_PROFILE=true`

验证项：

- `http://127.0.0.1:9001/health`
- `http://127.0.0.1:9002/health`

预期返回：

- `profile=comment`
- `status=ok`

## 11. backend 配置要求

`backend/.env` 中至少应满足：

```bash
# 主页图 OCR 池
OCR_HOMEPAGE_URLS=http://127.0.0.1:9001,http://127.0.0.1:9002

# 评论图 OCR 池
OCR_COMMENT_URLS=http://127.0.0.1:9101,http://127.0.0.1:9102

# 禁止跨 profile 兜底
OCR_ALLOW_CROSS_PROFILE_FALLBACK=false
```

说明：

- 如果暂时还未切换到 `OCR_HOMEPAGE_URLS/OCR_COMMENT_URLS`，旧变量名仍兼容
- 但后续应统一迁移到新变量名，避免语义混乱

## 12. 回滚原则

如果上线后 OCR 异常，按以下顺序回滚：

1. 回滚 `backend` 的 OCR 池配置
2. 回滚 PM2 OCR 配置文件到上一个稳定版本
3. 只保留单实例 OCR 验证基础可用性
4. 不要在故障状态下继续扩实例数

注意：

- 不要回滚数据库迁移中的 `submission_version` 字段
- 字段保留不会影响旧逻辑读取

## 13. 已废弃或不可信文档

以下内容只能当历史参考，不能作为本次上线依据：

- 旧的系统分析报告中的 OCR 进程命名
- 旧的单机 OCR 文档
- 与当前端口不一致的后端 README

原则：

- 以本文件 + 当前代码 + 当前 PM2 配置为准

## 14. 下一步建议

本文件解决的是“怎么正确上线”。  
下一步还需要继续解决“图片审核怎么进一步拆分”：

- 抽 `ocrRouteService`
- 抽 `ocrResultNormalizer`
- 再拆 `imageReviewWorker`

在那之前，不要再新增新的旧式部署说明。
