# 消息中心页 + TabBar 红点 + 分页接口（前端草稿）

面向已有 uni-app 小程序，新增消息中心页面、TabBar 红点提醒、通知分页接口约定。默认每页 20 条，按时间倒序。保持现有登录/鉴权逻辑，写操作需依赖云端校验。

## 页面与路由
- 页面路径：`/pages/notification/index`
- 推荐在 `pages.json` 中新增页面声明与 TabBar 项（示例）：
  - `"pagePath": "pages/notification/index"`
  - 图标占位：`static/tabbar/notice.png` / `static/tabbar/notice_active.png`
  - 文案：`"Message"` 或 `"消息"`
- 进入页面需登录，未登录跳转现有登录页（沿用 `checkLogin` 逻辑）。

## 数据结构（前端展示字段）
```js
NotificationItem {
  id: string;           // 通知 ID
  toUserId: string;     // 接收者
  type: 'apply' | 'accepted' | 'rejected';
  title: string;        // 列表主标题
  content: string;      // 说明文案
  meetId: string;       // 关联约练 ID，用于跳转
  meetTitle?: string;   // 约练标题/摘要（可选）
  isRead: boolean;
  createdAt: number;    // 时间戳（ms）
}
```

## 前端 API 契约（云函数/HTTP 均可，命名示例）
- `notifications/list`
  - 请求：`{ page: number, pageSize: number, lastId?: string }`
  - 响应：`{ list: NotificationItem[], hasMore: boolean, unreadCount: number }`
  - 说明：按 `createdAt` 倒序；`lastId` 便于游标分页（可选）。
- `notifications/read`
  - 请求：`{ ids: string[] }`
  - 响应：`{ success: true, unreadCount: number }`
  - 说明：批量标记已读，返回最新未读数供红点同步。
- `notifications/unread-count`
  - 请求：空
  - 响应：`{ unreadCount: number }`
  - 说明：启动/回到前台时拉取，驱动 TabBar 红点。

> 若沿用 `callFunctionWithToken`，可在 `services/apiService.js` 添加同名包装函数；若直接 HTTP，请保持统一的返回格式以复用 `parseList` 风格。

## `apiService` 建议新增的包装函数（前端草稿）
```js
// services/apiService.js（示例签名，需与云端对应）
export const apiService = {
  // ...existing
  getNotifications: (payload) => callFunctionWithToken('notifications/list', payload),
  readNotifications: (ids) => callFunctionWithToken('notifications/read', { ids }),
  getUnreadCount: () => callFunctionWithToken('notifications/unread-count'),
};
```

## 消息中心页面组件草稿
- 布局：
  - 顶部标题栏（可复用自定义导航）
  - 列表项：头像（系统/约练发布者头像）、标题、内容摘要、时间、未读红点
  - 骨架屏：首屏 6~8 行矩形条
  - 空态：展示插画+“暂无消息”按钮（返回首页/Meet）
- 状态：`list`, `page`, `pageSize=20`, `loading`, `noMore`, `unreadCount`
- 交互：
  1) 进入页：`checkLogin` → 拉取 `unreadCount` → 拉取列表第一页
  2) 点击通知：
     - 先本地置 `isRead=true`，同步 `readNotifications([id])`
     - 跳转到约练详情页（占位路径示例：`/pages/meet/detail?meetId=xxx`），未实现可先 Toast
  3) 下拉刷新：重置分页，重新拉取
  4) 触底：若 `!loading && !noMore` 则 `page++` 拉取下一页

### 页面核心伪代码（节选）
```js
onShow() {
  this.bootstrap();
}
async bootstrap() {
  if (!checkLogin()) return;
  await this.syncUnread();
  this.resetAndLoad();
}
async syncUnread() {
  const { unreadCount } = await apiService.getUnreadCount();
  this.unreadCount = unreadCount;
  this.updateTabBadge(unreadCount);
}
async loadList() {
  if (this.loading || this.noMore) return;
  this.loading = true;
  const { list, hasMore, unreadCount } = await apiService.getNotifications({ page: this.page, pageSize: this.pageSize });
  this.list = this.page === 1 ? list : [...this.list, ...list];
  this.noMore = !hasMore;
  this.unreadCount = unreadCount ?? this.unreadCount;
  this.updateTabBadge(this.unreadCount);
  this.loading = false;
}
async handleTap(item) {
  if (!item.isRead) {
    item.isRead = true;
    const { unreadCount } = await apiService.readNotifications([item.id]);
    this.unreadCount = unreadCount;
    this.updateTabBadge(unreadCount);
  }
  this.navToDetail(item.meetId);
}
updateTabBadge(count) {
  if (count > 0) {
    const text = count > 99 ? '99+' : String(count);
    uni.setTabBarBadge({ index: <tab-index>, text });
  } else {
    uni.removeTabBarBadge({ index: <tab-index> });
  }
}
```
`<tab-index>` 请替换为 TabBar 中消息入口的索引（按实际顺序调整）。

## TabBar 红点/角标策略
- 启动、`onShow`、收到实时推送（若有）时调用 `getUnreadCount`
- 未读数为 0：`uni.removeTabBarBadge`
- 未读数 1~99：`uni.setTabBarBadge({ text: 'N' })`
- 未读数 >99：`uni.setTabBarBadge({ text: '99+' })`
- 如需仅显示红点可选 `uni.showTabBarRedDot`/`hideTabBarRedDot`

## 导航占位
- 详情跳转路径待后端/页面定义，可占位为：`/pages/meet/detail?meetId=...`
- 未实现详情页时应 Toast “约练详情开发中” 避免空跳转

## 资源与样式占位
- 图标占位：`static/tabbar/notice.png`、`static/tabbar/notice_active.png`
- 系统通知头像占位：`/static/app/notice-avatar.png`（可新增）
- 列表样式可复用现有暗色/玻璃风格，保持 44rpx 行高、12rpx 内间距，未读行背景略高亮
