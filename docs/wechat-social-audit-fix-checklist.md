# 微信社交类目整改清单

## 当前结论

- 你的小程序现在不是纯约练工具，代码里已经包含公开笔记、评论、举报、私聊等用户生成内容能力。
- 这种形态更接近微信定义的 `社交-笔记`。
- 如果不补类目，就需要下线公开发布、公开可见、评论、私聊等整条社交链路，改动会很大。

## 我已经替你处理的代码

- `discover` 发布时，如果文本安全接口异常，不再直接把前台发布打死，而是进入人工审核状态。
- 带图片的训练笔记，先统一进入审核状态，避免“发出去但审核不认可”的冲突。
- 前端发布成功提示已区分“直接发布成功”和“已提交审核”。

## 你接下来要做的事

1. 微信后台补充服务类目 `社交-笔记`
2. 提审说明里明确写：
   - 用户可发布训练笔记
   - 平台支持评论、举报、私信
   - 文本内容已接入内容安全检查
   - 图片内容进入审核队列
   - 后台有人工审核与举报处理机制
3. 云端补齐官方图片安全能力
   - 目标接口：`/wxa/media_check_async`
   - 官方文档：
     - `https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sec-check/security.msgSecCheck.html`
     - `https://doc.dcloud.net.cn/uniCloud/uni-sec-check.html`
4. 完成一次真机自测
   - 发纯文字笔记
   - 发带图片笔记
   - 查看“我的笔记”是否能看到待审核状态
   - 后台是否能审核通过/驳回

## 最省钱路线

- 现在最便宜的方案不是重做产品，而是按 `社交-笔记` 去提审。
- 等审核稳定后，再决定要不要把“约练”作为主卖点继续强化。

## 提审前自测清单（可直接执行）

### A. 配置检查（发布前必须完成）

1. `fit-content-security` 配置已填写 `mediaCheck.notifyUrl`，且可公网访问。
2. `mediaCheck.notifyUrl` 包含回调 action 参数，示例：
   - `https://<your-domain>/<your-cloud-path>/fit-discover-api?action=handleImageAuditCallback`
3. `callback.token` 与微信后台回调 token 保持一致。
4. `uni-open-bridge` 微信小程序凭据可正常换取 `access_token`。

### B. 发布链路检查（入队是否成功）

1. 发布纯文本动态：
   - 预期：可直接发布或进入文本审核（依内容而定）。
2. 发布带图片动态：
   - 预期：`fit-feeds` 新增记录，字段满足：
   - `image_moderation_status = pending`
   - `status = 0`
   - `image_audit_trace_id` 有值
   - `image_audit_requested_at` 有值

### C. 回调链路检查（验签 + 落库）

1. 回调 URL 验证（GET）：
   - 微信侧会发起签名校验请求。
   - 预期：服务返回 `echostr` 原文。
2. 审核结果回调（POST）：
   - 预期：服务返回 `success`。
   - 预期：按 `image_audit_trace_id` 命中对应 feed 并更新：
   - `image_moderation_status`
   - `image_moderation_reason`
   - `image_audit_callback_at`
   - `image_audit_err_code / image_audit_err_msg`
   - `image_audit_suggest / image_audit_label`
   - `image_audit_raw`

### D. 状态回写规则检查（核心）

1. 图片审核 `pass`：
   - 若文本审核 `pass`，预期 `moderation_status = pass`，`status = 1`（自动公开）。
2. 图片审核 `review` 或 `error`：
   - 预期 `moderation_status = review`，`status = 0`（继续待审）。
3. 图片审核 `block`：
   - 预期 `moderation_status = block`，`status = 0`（不公开）。
4. 文本与图片结果冲突时：
   - 预期按更严格结果生效（`block > review > pass`）。

### E. 管理端与用户端可见性检查

1. 用户“我的动态”可看到待审核内容（`status=0`）。
2. 公共列表只展示 `status=1` 的内容。
3. 管理端待审核列表可拉到 `status=0` 的动态并执行人工处置。

### F. 回归测试（避免新增回归）

1. 点赞、评论、收藏、送礼流程不受回调改造影响。
2. 动态编辑后重新带图送审可再次生成新 trace 并正确回写。
3. 重复回调（同 trace 多次）不会引发数据错乱（幂等可接受）。

### G. 提审材料建议（可直接写进说明）

1. 说明“文本 + 图片双通道安全策略”：
   - 文本：发布前审查。
   - 图片：异步审核回调后自动更新可见性。
2. 说明“自动 + 人工”两级机制：
   - 自动：审核结果驱动 `status` 与 `moderation_status`。
   - 人工：后台对待审/举报内容二次处置。
3. 准备 3 条演示数据：
   - 正常通过样例
   - 待复核样例
   - 拦截样例
