# 报名 / 通知云端设计草稿

适配 uni-app + uniCloud（或自有 Node 云函数）场景，定义集合结构、索引、接口契约与事务流程。按需调整到具体云厂商 SDK。

## 集合与索引

### meets
- 字段：`_id`, `publisherId`, `title`, `content`, `time`, `place`, `city`, `district`, `status` (open/closed/cancelled), `createdAt`, `updatedAt`。
- 索引：
  - `city + status + createdAt`（降序，Meet 城市筛选/分页）
  - `publisherId + createdAt`（个人管理页）

### applications（报名表）
- 字段：`_id`, `meetId`, `publisherId`(冗余 meet.publisherId), `applicantId`, `note`, `status` (pending/accepted/rejected), `createdAt`, `updatedAt`。
- 索引：
  - `meetId + applicantId`（唯一约束/重复报名校验）
  - `publisherId + status + createdAt`（发布者管理页）
  - `applicantId + status + createdAt`（我的报名）

### notifications（站内通知）
- 字段：`_id`, `toUserId`, `fromUserId`, `type` (apply/accepted/rejected), `meetId`, `payload`(title/place/time 等), `isRead` (bool), `createdAt`。
- 索引：
  - `toUserId + isRead + createdAt`（列表/未读）
  - `toUserId + createdAt`（分页）

> 建议所有时间字段用毫秒时间戳，便于前端排序；写操作统一走服务端鉴权（校验当前用户与 token 绑定）。

## 云函数接口契约（示例命名）

| 函数 | 说明 |
|---|---|
| `applications/apply` | 发起报名（需登录）|
| `applications/accept` | 发布者接受某报名（需登录&权限校验）|
| `applications/reject` | 发布者拒绝某报名（需登录&权限校验）|
| `applications/listByMeet` | 发布者查看某场约练的全部报名（分页）|
| `applications/listMy` | 我报名的列表（分页）|
| `notifications/list` | 通知列表（分页）|
| `notifications/read` | 批量标记已读 |
| `notifications/unread-count` | 未读数 |

### 通用分页请求
```json
{ "page": 1, "pageSize": 20, "lastId": "可选游标" }
```
返回：`{ list: [...], hasMore: boolean, unreadCount?: number }`

## 重复报名校验
- 在 `applications/apply` 中：
  1. 校验 meet 存在且 `status == open`。
  2. 查询 `meet.publisherId == currentUserId` 时拒绝自报。
  3. 依赖唯一索引 `meetId + applicantId`，插入前查询 pending/accepted 记录；若已存在：
     - 若 pending：直接返回成功（幂等）。
     - 若 accepted/rejected：返回对应状态，提示前端不可重复报名。
  4. 插入新记录 `status=pending`。
  5. 同步写一条通知给 `publisherId`，`type=apply`。

> 若使用数据库唯一索引，捕获唯一键冲突后按“幂等返回”处理。

## 事务 / 原子性
- 接受或拒绝必须在同一事务/批处理内：
  1. 读取 `application` by `_id`，校验 `publisherId == currentUserId`，`status == pending`。
  2. 更新 `status` → `accepted` 或 `rejected`，`updatedAt=now`。
  3. 写入 `notifications`：
     - `toUserId = applicantId`
     - `type = accepted / rejected`
     - `payload` 携带 meet 时间/地点/标题
  4. 可选：写入审计日志 / 触发订阅消息。

- 若有报名人数上限，可在事务中计数后决定是否允许接受。

## 接口入参/出参示例

### `applications/apply`
请求：`{ meetId, note }`
返回：`{ applicationId, status: 'pending' }`

### `applications/accept` / `reject`
请求：`{ applicationId }`
返回：`{ status: 'accepted' | 'rejected' }`

### `applications/listByMeet`
请求：`{ meetId, page, pageSize }`
返回：`{ list: [ { _id, applicantId, avatar, nickname, note, status, createdAt } ], hasMore: true }`

### `notifications/list`
请求：`{ page, pageSize, lastId? }`
返回：`{ list: NotificationItem[], hasMore, unreadCount }`

### `notifications/read`
请求：`{ ids: string[] }`
返回：`{ success: true, unreadCount }`

### `notifications/unread-count`
请求：`{}`
返回：`{ unreadCount }`

## 鉴权与校验
- 所有写接口必须读取服务端上下文的 `uid`，不信任前端传递的用户。
- `accept/reject/listByMeet` 必须校验 `application.publisherId` 或 `meet.publisherId` == `uid`。
- `listMy` 过滤 `applicantId == uid`。
- `notifications/*` 过滤 `toUserId == uid`。

## 订阅消息触发点（可选）
- 在事务成功后（accept/reject/apply）追加异步任务：
  - 校验用户是否授权订阅模板；未授权则跳过。
  - 触发微信订阅消息（需配置 `templateId`）。
  - 失败不影响主流程，可记录告警。

## 性能与限制
- 分页 pageSize 建议 15~20；列表按 `createdAt desc`。
- 所有查询走索引字段过滤；避免全表扫描。
- 未读计数：
  - 简单实现：`count({ toUserId, isRead:false })`（有索引即可）。
  - 若数据量巨大，可做每日预聚合或维护计数器字段（写时增减）。

## 幂等与并发
- apply：依赖唯一键幂等。
- accept/reject：只允许从 pending 迁移；重复调用返回当前状态，不重复写通知。
- read：批量更新已读，幂等。

## 错误码建议（示例）
- `MEET_NOT_FOUND`
- `MEET_CLOSED`
- `SELF_APPLY_NOT_ALLOWED`
- `APPLICATION_EXISTS`
- `APPLICATION_NOT_FOUND`
- `APPLICATION_ALREADY_DECIDED`
- `FORBIDDEN`
