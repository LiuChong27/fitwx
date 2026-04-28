# 旧会话未读计数重建

用于给历史会话补齐 `fit-conversations.unread_count_map`，与新的聊天未读统计逻辑对齐。

## 前提

- 已部署 `fit-maintenance-api` 云函数
- 执行账号必须拥有 `admin` 角色
- 已同步最新 `fit-conversations` / `fit-messages` schema

## 调用方式

在管理端、开发者工具控制台或临时页面中调用：

```js
await uniCloud.callFunction({
  name: 'fit-maintenance-api',
  data: {
    action: 'rebuildConversationUnreadMap',
    params: {
      offset: 0,
      batchSize: 100,
      dryRun: false,
    },
  },
})
```

## 参数

- `offset`: 从第几条会话开始处理，默认 `0`
- `batchSize`: 单次处理数量，默认 `50`，最大 `200`
- `dryRun`: 仅预览结果，不写库

## 返回示例

```json
{
  "code": 0,
  "data": {
    "offset": 0,
    "batchSize": 100,
    "processed": 100,
    "updated": 34,
    "unchanged": 66,
    "skipped": 0,
    "dryRun": false,
    "hasMore": true,
    "nextOffset": 100
  }
}
```

## 建议执行顺序

1. 先用 `dryRun: true` 跑一批，确认返回结果正常
2. 再用 `dryRun: false` 正式写入
3. 如果 `hasMore` 为 `true`，继续用返回的 `nextOffset` 调下一批
4. 全部跑完后，抽查几个旧会话的未读数是否与实际一致

## 注意事项

- 该脚本按会话逐条重建，适合一次性修复存量数据
- 执行期间如果仍有新消息写入，可在低峰期再补跑一轮
- 该脚本可重复执行，结果是幂等的