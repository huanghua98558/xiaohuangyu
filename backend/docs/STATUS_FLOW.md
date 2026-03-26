# 任务状态流转文档

## 概述
本文档描述小黄鱼任务管理平台的任务状态流转规则。

## 状态定义

### 主状态 (claims.status)
| 状态值 | 说明 | 可转换状态 |
|--------|------|-----------|
| `doing` | 进行中（已领取未提交） | `submitted`, `expired`, `abandoned` |
| `submitted` | 已提交（等待审核） | `image_reviewing`, `doing`（撤回） |
| `image_reviewing` | 图片审核中 | `approved`, `image_rejected`, `link_reviewing` |
| `link_reviewing` | 链接审核中 | `approved`, `link_rejected` |
| `pending_manual` | 待人工审核 | `approved`, `rejected` |
| `approved` | 已完成（审核通过） | 终态 |
| `image_rejected` | 图片审核拒绝（可重提） | `submitted`（重提） |
| `link_rejected` | 链接审核拒绝（可重提） | `submitted`（重提） |
| `rejected` | 已拒绝（不可重提） | 终态 |
| `expired` | 已过期 | 终态 |
| `abandoned` | 已放弃 | 终态 |

### 图片审核状态 (claims.image_review_status)
| 状态值 | 说明 |
|--------|------|
| `pending` | 待审核 |
| `reviewing` | 审核中 |
| `approved` | 审核通过 |
| `rejected` | 审核失败 |

### 链接审核状态 (claims.link_review_status)
| 状态值 | 说明 |
|--------|------|
| `pending` | 待审核 |
| `reviewing` | 审核中 |
| `approved` | 审核通过 |
| `rejected` | 审核失败 |

## 状态流转流程

### 正常流程
```
doing → submitted → image_reviewing → link_reviewing → approved
                    ↓                  ↓
                 (图片通过)         (链接通过)
```

### 失败重提流程
```
doing → submitted → image_reviewing → image_rejected → submitted (重提)
                                      ↓
                                   (图片拒绝，可重提)

doing → submitted → image_reviewing → link_reviewing → link_rejected → submitted (重提)
                                                          ↓
                                                       (链接拒绝，可重提)
```

### 过期/放弃流程
```
doing → expired (超时未提交)
doing → abandoned (用户主动放弃)
```

## 状态兼容性说明

### 数据库兼容
由于历史数据使用不同的状态名称，代码同时支持以下兼容状态：
- 完成状态：`done` 和 `approved` 均视为完成
- 图片审核通过：`passed` 和 `approved` 均视为通过
- 图片审核失败：`failed` 和 `rejected` 均视为失败
- 链接审核同理

### 前端状态判断
前端判断状态时应使用辅助函数，而非直接比较字符串：

```javascript
// 正确做法
import { isCompleted, isFailed, canSubmit } from '@/lib/status'

if (isCompleted(status)) { /* 已完成 */ }
if (isFailed(status)) { /* 失败，可重提 */ }
if (canSubmit(status)) { /* 可以提交 */ }

// 错误做法（不推荐）
if (status === 'done') { /* 可能遗漏 approved */ }
```

## 修复历史

### 2026-03-24 状态一致性修复
**问题**：
1. 代码定义状态与数据库实际状态不一致
2. 审核失败后主状态未正确更新
3. 前端状态判断遗漏兼容状态

**修复**：
1. 统一状态常量定义，添加数据库兼容状态
2. 修复审核服务状态更新逻辑
3. 修复前端状态判断逻辑
4. 创建状态流转文档
