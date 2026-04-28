<template>
	<view class="notification-page">
		<view class="nav-bar">
			<view class="nav-bar__status" :style="{ height: statusBarHeight + 'px' }"></view>
			<view class="nav-bar__content">
				<view
					v-if="hasLogin && totalUnreadCount > 0"
					class="nav-bar__action"
					role="button"
					aria-label="全部标记为已读"
					@tap="markAllRead"
				>
					<text class="nav-bar__action-text">全部已读</text>
				</view>
			</view>
		</view>

		<view v-if="firstLoading" class="skeleton-wrap">
			<fit-shimmer-stack variant="notification" :count="6" />
		</view>

		<scroll-view
			v-else
			class="notification-list"
			scroll-y
			:style="{ height: scrollHeight + 'px' }"
			refresher-enabled
			:refresher-triggered="refreshing"
			@refresherrefresh="onPullRefresh"
			@scrolltolower="loadMore"
		>
			<view class="notification-overview" :class="{ 'notification-overview--collapsed': overviewCollapsed }">
				<view class="overview-main" role="button" aria-label="展开或收起消息概览" @tap="toggleOverview">
					<view class="overview-copy">
						<text class="overview-title">{{ overviewTitle }}</text>
						<text class="overview-subtitle">{{ overviewSubtitle }}</text>
					</view>
					<view class="overview-side">
						<view class="overview-badge">
							<text class="overview-badge__label">未读</text>
							<text class="overview-badge__value">{{ totalUnreadCount }}</text>
						</view>
						<uni-icons :type="overviewCollapsed ? 'bottom' : 'top'" size="18" color="rgba(255,255,255,0.58)" />
					</view>
				</view>
				<view v-if="!overviewCollapsed" class="overview-stats">
					<view class="overview-stat">
						<text class="overview-stat__label">私信</text>
						<text class="overview-stat__value">{{ conversations.length }}</text>
					</view>
					<view class="overview-stat">
						<text class="overview-stat__label">通知</text>
						<text class="overview-stat__value">{{ list.length }}</text>
					</view>
					<view class="overview-stat overview-stat--wide">
						<text class="overview-stat__label">当前状态</text>
						<text class="overview-stat__value overview-stat__value--text">{{ overviewStatusText }}</text>
					</view>
				</view>
			</view>

			<fit-state-panel
				v-if="!hasLogin"
				scene="inbox"
				title="登录后查看消息"
				description="通知和私信会在这里统一展示。"
				action-text="去登录"
				@action="goLogin"
			/>

			<fit-state-panel
				v-else-if="messageLoadError && !messageCards.length && !anyLoading"
				tone="error"
				scene="inbox"
				kicker="消息同步"
				title="消息暂时未拉取成功"
				:description="messageLoadError"
				action-text="重试"
				@action="bootstrap"
			/>

			<fit-state-panel
				v-else-if="!messageCards.length && !anyLoading"
				scene="inbox"
				title="暂无消息"
				description="私信和通知会按时间出现在这里。"
				action-text="去约练"
				@action="goMeet"
			/>

			<view v-else-if="hasLogin" class="message-flow">
				<view class="message-flow__head">
					<text class="message-flow__title">消息流</text>
					<text class="message-flow__meta">{{ messageCards.length }} 条</text>
				</view>

				<view
					v-for="card in messageCards"
					:key="card.id"
					class="message-card"
					:class="[
						'message-card--' + card.kind,
						{ 'message-card--unread': card.unread > 0 }
					]"
					role="button"
					:aria-label="card.title + ' ' + card.content"
					@tap="handleCardTap(card)"
				>
					<view class="message-card__avatar">
						<image
							v-if="card.kind === 'conversation'"
							class="message-card__image"
							:src="card.avatar || '/static/tabbar/me.png'"
							mode="aspectFill"
						/>
						<view v-else class="type-badge" :class="'type-badge--' + card.type">
							<text class="type-badge-icon">{{ typeIcon(card.type) }}</text>
						</view>
					</view>

					<view class="message-card__body">
						<view class="message-card__top">
							<text class="message-card__title">{{ card.title }}</text>
							<text class="message-card__time">{{ formatTime(card.timestamp) }}</text>
						</view>
						<text class="message-card__content">{{ card.content }}</text>
						<view class="message-card__meta">
							<text class="message-card__label">{{ card.label }}</text>
							<text v-if="card.extra" class="message-card__extra">{{ card.extra }}</text>
						</view>
					</view>

					<view v-if="card.unread > 0" class="message-card__badge">
						{{ card.unread > 99 ? '99+' : card.unread }}
					</view>
				</view>
			</view>

			<view v-if="list.length" class="load-more">
				<text v-if="loading" class="load-more-text">加载中...</text>
				<text v-else-if="noMore" class="load-more-text">没有更多了</text>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import apiService from '@/services/apiService.js';
import { timeAgo } from '@/common/utils.js';
import tabCacheMixin from '@/common/tabCacheMixin.js';
import FitShimmerStack from '@/components/fit-shimmer-stack.vue';
import FitStatePanel from '@/components/fit-state-panel.vue';
import { ensureLoggedIn } from '@/common/auth.js';
import chatService from '@/services/chatService.js';
import storage from '@/common/storage.js';

const NOTIFICATION_TAB_INDEX = 2;
const OVERVIEW_COLLAPSED_KEY = 'notification_overview_collapsed';

export default {
	mixins: [tabCacheMixin],
	tabCacheKeys: ['list', 'unreadCount', 'conversations', 'chatUnreadCount', 'overviewCollapsed'],
	components: {
		FitShimmerStack,
		FitStatePanel,
	},
	computed: {
		hasLogin() {
			return ensureLoggedIn({ silent: true });
		},
		totalUnreadCount() {
			return Number(this.unreadCount || 0) + Number(this.chatUnreadCount || 0);
		},
		messageCards() {
			const conversationCards = (this.conversations || []).map((conv) => ({
				id: `conversation_${conv.conversationId}`,
				kind: 'conversation',
				title: conv.nickname || '用户',
				content: conv.lastMessage || '暂无消息',
				timestamp: conv.lastMessageDate || 0,
				unread: Number(conv.unread || 0),
				avatar: conv.avatar || '',
				label: '私信',
				extra: conv.unread > 0 ? `${conv.unread} 条未读` : '',
				source: conv,
			}));
			const notificationCards = (this.list || []).map((item) => ({
				id: `notification_${item.id}`,
				kind: 'notification',
				type: item.type || 'system',
				title: item.title || '系统消息',
				content: item.content || '',
				timestamp: item.createdAt || 0,
				unread: item.isRead ? 0 : 1,
				label: this.notificationLabel(item.type),
				extra: item.meetTitle || '',
				source: item,
			}));
			return [...conversationCards, ...notificationCards].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
		},
		overviewTitle() {
			if (this.totalUnreadCount > 0) return `${this.totalUnreadCount} 条未读`;
			return '暂无未读';
		},
		overviewSubtitle() {
			const total = (this.conversations || []).length + (this.list || []).length;
			return total > 0 ? `共 ${total} 条消息，按最新时间排序` : '私信和通知会在这里汇总';
		},
		overviewStatusText() {
			if (this.refreshing) return '刷新中';
			if (this.anyLoading) return '同步中';
			if (this.messageLoadError) return '加载异常';
			if (this.totalUnreadCount > 0) return '有待查看';
			return '已同步';
		},
		messageLoadError() {
			return this.loadError || this.convError;
		},
		anyLoading() {
			return this.loading || this.convLoading;
		},
	},
	data() {
		return {
			list: [],
			page: 1,
			pageSize: 20,
			loading: false,
			firstLoading: true,
			noMore: false,
			refreshing: false,
			unreadCount: 0,
			chatUnreadCount: 0,
			loadError: '',
			conversations: [],
			convLoading: false,
			convError: '',
			overviewCollapsed: false,
			statusBarHeight: 0,
			scrollHeight: 0,
		};
	},
	onLoad() {
		const windowInfo = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
		this.statusBarHeight = windowInfo.statusBarHeight || 0;
		const navHeight = this.statusBarHeight + 44;
		this.scrollHeight = windowInfo.windowHeight - navHeight;
		this.overviewCollapsed = storage.get(OVERVIEW_COLLAPSED_KEY, false) === true;
	},
	onShow() {
		if (!ensureLoggedIn({ silent: true })) {
			this.firstLoading = false;
			this.list = [];
			this.unreadCount = 0;
			this.chatUnreadCount = 0;
			this.conversations = [];
			this.updateTabBadge(0);
			return;
		}
		this.bootstrap();
	},
	methods: {
		async bootstrap() {
			if (!ensureLoggedIn({ silent: true })) return;
			this.firstLoading = !this.messageCards.length;
			await Promise.allSettled([this.loadConversations(), this.resetAndLoad()]);
			this.firstLoading = false;
		},
		async loadConversations() {
			if (!ensureLoggedIn({ silent: true }) || this.convLoading) return;
			this.convLoading = true;
			this.convError = '';
			try {
				const list = await chatService.listConversations(50);
				this.conversations = list || [];
				this.chatUnreadCount = this.conversations.reduce((sum, conv) => sum + Number(conv.unread || 0), 0);
				this.updateTabBadge(this.totalUnreadCount);
			} catch (err) {
				this.convError = err?.message || '私信同步失败';
			} finally {
				this.convLoading = false;
			}
		},
		async syncUnread() {
			if (!ensureLoggedIn({ silent: true })) return;
			try {
				const res = await apiService.getUnreadCount();
				this.unreadCount = res.unreadCount || 0;
				this.updateTabBadge(this.totalUnreadCount);
			} catch (_) {
				// ignore
			}
		},
		resetAndLoad() {
			if (!ensureLoggedIn({ silent: true })) return Promise.resolve();
			this.page = 1;
			this.noMore = false;
			this.list = [];
			return this.loadList(true);
		},
		async loadList(isFirst = false) {
			if (!ensureLoggedIn({ silent: true })) return;
			if (this.loading || this.noMore) return;
			this.loading = true;
			if (isFirst) this.firstLoading = !this.conversations.length;

			try {
				const res = await apiService.getNotifications({ page: this.page, pageSize: this.pageSize });
				const newList = res.list || [];
				this.list = this.page === 1 ? newList : [...this.list, ...newList];
				this.noMore = !res.hasMore;
				if (res.unreadCount !== undefined) {
					this.unreadCount = res.unreadCount;
					this.updateTabBadge(this.totalUnreadCount);
				}
				this.loadError = '';
				this.page += 1;
			} catch (err) {
				this.loadError = '通知加载失败，请稍后重试。';
				uni.showToast({ title: '加载失败', icon: 'none' });
			} finally {
				this.loading = false;
				this.firstLoading = false;
			}
		},
		loadMore() {
			if (!this.loading && !this.noMore) this.loadList();
		},
		async onPullRefresh() {
			if (!ensureLoggedIn({ silent: true })) {
				this.refreshing = false;
				return;
			}
			this.refreshing = true;
			this.page = 1;
			this.noMore = false;
			const notificationRequest = apiService.getNotifications({ page: 1, pageSize: this.pageSize });
			const [notifyResult] = await Promise.allSettled([notificationRequest, this.loadConversations()]);
			if (notifyResult.status === 'fulfilled') {
				const res = notifyResult.value || {};
				this.list = res.list || [];
				this.noMore = !res.hasMore;
				this.page = 2;
				if (res.unreadCount !== undefined) {
					this.unreadCount = res.unreadCount;
				}
				this.loadError = '';
			} else {
				this.loadError = '通知刷新失败，请下拉重试。';
				uni.showToast({ title: '刷新失败', icon: 'none' });
			}
			this.updateTabBadge(this.totalUnreadCount);
			this.refreshing = false;
		},
		handleCardTap(card) {
			if (!card) return;
			if (card.kind === 'conversation') {
				this.openConversation(card.source);
				return;
			}
			this.handleNotificationTap(card.source);
		},
		async handleNotificationTap(item) {
			if (!item) return;
			if (!item.isRead) {
				item.isRead = true;
				this.unreadCount = Math.max(0, this.unreadCount - 1);
				this.updateTabBadge(this.totalUnreadCount);
				try {
					const res = await apiService.readNotifications([item.id]);
					if (res.unreadCount !== undefined) {
						this.unreadCount = res.unreadCount;
						this.updateTabBadge(this.totalUnreadCount);
					}
				} catch (_) {
					item.isRead = false;
					await this.syncUnread();
				}
			}
			if (item.meetId) {
				uni.switchTab({ url: '/pages/meet/meet' });
			}
		},
		async markAllRead() {
			if (!ensureLoggedIn({ silent: true })) return;
			if (this.totalUnreadCount <= 0) return;

			const prevList = this.list.map(item => ({ ...item }));
			const prevConversations = this.conversations.map(item => ({ ...item }));
			const prevNotificationUnread = this.unreadCount;
			const prevChatUnread = this.chatUnreadCount;

			this.list.forEach((i) => {
				i.isRead = true;
			});
			this.conversations = this.conversations.map(conv => ({ ...conv, unread: 0 }));
			this.unreadCount = 0;
			this.chatUnreadCount = 0;
			this.updateTabBadge(0);

			const tasks = [];
			if (prevNotificationUnread > 0) tasks.push(apiService.markAllNotificationsRead());
			if (prevChatUnread > 0) tasks.push(chatService.markAllConversationsRead());
			const results = await Promise.allSettled(tasks);
			const failed = results.some(result => result.status === 'rejected');
			if (failed) {
				this.list = prevList;
				this.conversations = prevConversations;
				this.unreadCount = prevNotificationUnread;
				this.chatUnreadCount = prevChatUnread;
				this.updateTabBadge(this.totalUnreadCount);
				await Promise.allSettled([this.loadConversations(), this.resetAndLoad()]);
				uni.showToast({ title: '同步失败，已重新拉取', icon: 'none' });
			}
		},
		updateTabBadge(count = this.totalUnreadCount) {
			if (count > 0) {
				const text = count > 99 ? '99+' : String(count);
				uni.setTabBarBadge({ index: NOTIFICATION_TAB_INDEX, text, fail() {} });
			} else {
				uni.removeTabBarBadge({ index: NOTIFICATION_TAB_INDEX, fail() {} });
			}
		},
		toggleOverview() {
			this.overviewCollapsed = !this.overviewCollapsed;
			storage.set(OVERVIEW_COLLAPSED_KEY, this.overviewCollapsed);
		},
		goMeet() {
			uni.switchTab({ url: '/pages/meet/meet' });
		},
		goLogin() {
			uni.navigateTo({ url: '/pages/login/login-withoutpwd' });
		},
		openConversation(conv) {
			if (!conv || !conv.targetUserId) return;
			try {
				storage.set(`user_${conv.targetUserId}`, {
					userId: conv.targetUserId,
					nickname: conv.nickname,
					avatar: conv.avatar,
				});
			} catch (_) {
				// ignore
			}
			uni.navigateTo({
				url: `/pages/chat/chat?conversationId=${encodeURIComponent(conv.conversationId)}&userId=${encodeURIComponent(conv.targetUserId)}&nickname=${encodeURIComponent(conv.nickname || '')}`,
			});
		},
		typeIcon(type) {
			const map = { apply: '申', accepted: '通', rejected: '拒', cancelled: '取' };
			return map[type] || '消';
		},
		notificationLabel(type) {
			const map = { apply: '约练申请', accepted: '预约通过', rejected: '预约未通过', cancelled: '预约取消' };
			return map[type] || '系统通知';
		},
		formatTime(ts) {
			if (!ts) return '';
			return timeAgo(ts);
		},
	},
};
</script>

<style scoped lang="scss">
@import "@/uni.scss";

.notification-page {
	min-height: 100vh;
	background:
		linear-gradient(180deg, rgba(8, 20, 27, 0.98) 0%, rgba(9, 17, 24, 1) 46%, rgba(7, 12, 17, 1) 100%);
}

.nav-bar {
	background: rgba(8, 18, 26, 0.94);
	backdrop-filter: blur(18px);
	-webkit-backdrop-filter: blur(18px);
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 100;
	border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}

.nav-bar__content {
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	padding: 0 28rpx;
}

.nav-bar__action {
	@include fit-soft-action(60rpx, 20rpx, rgba(114, 228, 200, 0.1), rgba(114, 228, 200, 0.16), #72e4c8);
	padding: 0 22rpx;
}

.nav-bar__action-text {
	font-size: 23rpx;
	color: #72e4c8;
}

.skeleton-wrap {
	padding: 28rpx;
	padding-top: calc(var(--status-bar-height, 25px) + 88rpx + 28rpx);
}

.notification-list {
	padding: 22rpx;
	box-sizing: border-box;
}

.notification-overview {
	margin-top: calc(var(--status-bar-height, 25px) + 88rpx + 10rpx);
	padding: 24rpx;
	border-radius: 16rpx;
	background: linear-gradient(135deg, rgba(22, 39, 44, 0.96), rgba(16, 25, 32, 0.98));
	border: 1rpx solid rgba(255, 255, 255, 0.08);
	box-shadow: 0 12rpx 34rpx rgba(0, 0, 0, 0.22);
}

.notification-overview--collapsed {
	padding: 18rpx 22rpx;
}

.overview-main {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}

.overview-copy {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.overview-title {
	font-size: 38rpx;
	line-height: 1.12;
	font-weight: 700;
	color: #ffffff;
}

.overview-subtitle {
	font-size: 23rpx;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.48);
}

.overview-side {
	display: flex;
	align-items: center;
	gap: 14rpx;
	flex-shrink: 0;
}

.overview-badge {
	min-width: 116rpx;
	padding: 14rpx 16rpx;
	border-radius: 14rpx;
	background: rgba(255, 255, 255, 0.055);
	border: 1rpx solid rgba(255, 255, 255, 0.08);
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.overview-badge__label {
	font-size: 19rpx;
	color: rgba(255, 255, 255, 0.45);
}

.overview-badge__value {
	font-size: 36rpx;
	line-height: 1;
	font-weight: 700;
	color: #72e4c8;
}

.overview-stats {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12rpx;
	margin-top: 18rpx;
}

.overview-stat {
	padding: 16rpx 18rpx;
	border-radius: 14rpx;
	background: rgba(255, 255, 255, 0.04);
	border: 1rpx solid rgba(255, 255, 255, 0.055);
}

.overview-stat--wide {
	grid-column: span 2;
}

.overview-stat__label {
	display: block;
	margin-bottom: 8rpx;
	font-size: 20rpx;
	color: rgba(255, 255, 255, 0.46);
}

.overview-stat__value {
	display: block;
	font-size: 32rpx;
	line-height: 1;
	font-weight: 700;
	color: #ffffff;
}

.overview-stat__value--text {
	font-size: 24rpx;
	line-height: 1.35;
	color: rgba(255, 255, 255, 0.84);
}

.message-flow {
	margin-top: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 14rpx;
}

.message-flow__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 4rpx;
}

.message-flow__title {
	font-size: 28rpx;
	font-weight: 700;
	color: rgba(255, 255, 255, 0.92);
}

.message-flow__meta {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.42);
}

.message-card {
	position: relative;
	display: flex;
	gap: 20rpx;
	padding: 22rpx;
	border-radius: 16rpx;
	background: rgba(255, 255, 255, 0.045);
	border: 1rpx solid rgba(255, 255, 255, 0.07);
	box-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.16);
}

.message-card--unread {
	background: linear-gradient(135deg, rgba(114, 228, 200, 0.105), rgba(255, 255, 255, 0.045));
	border-color: rgba(114, 228, 200, 0.18);
}

.message-card--notification {
	background: rgba(255, 255, 255, 0.04);
}

.message-card__avatar {
	width: 78rpx;
	height: 78rpx;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.message-card__image {
	width: 78rpx;
	height: 78rpx;
	border-radius: 50%;
}

.message-card__body {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	padding-right: 10rpx;
}

.message-card__top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}

.message-card__title {
	flex: 1;
	min-width: 0;
	font-size: 29rpx;
	line-height: 1.25;
	font-weight: 700;
	color: #ffffff;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.message-card__time {
	flex-shrink: 0;
	font-size: 21rpx;
	color: rgba(255, 255, 255, 0.34);
}

.message-card__content {
	font-size: 25rpx;
	line-height: 1.42;
	color: rgba(255, 255, 255, 0.6);
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.message-card__meta {
	display: flex;
	align-items: center;
	gap: 12rpx;
	flex-wrap: wrap;
}

.message-card__label,
.message-card__extra {
	font-size: 21rpx;
	color: rgba(114, 228, 200, 0.7);
}

.message-card__extra {
	color: rgba(255, 255, 255, 0.38);
	max-width: 360rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.message-card__badge {
	position: absolute;
	right: 18rpx;
	bottom: 18rpx;
	min-width: 34rpx;
	padding: 4rpx 10rpx;
	border-radius: 999rpx;
	background: #ff6b6b;
	color: #ffffff;
	font-size: 20rpx;
	line-height: 1.2;
	text-align: center;
}

.type-badge {
	width: 68rpx;
	height: 68rpx;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(114, 228, 200, 0.1);
	border: 1rpx solid rgba(114, 228, 200, 0.12);
}

.type-badge--apply {
	background: rgba(0, 229, 255, 0.1);
	border-color: rgba(0, 229, 255, 0.16);
}

.type-badge--accepted {
	background: rgba(114, 228, 200, 0.12);
	border-color: rgba(114, 228, 200, 0.18);
}

.type-badge--rejected,
.type-badge--cancelled {
	background: rgba(255, 125, 125, 0.1);
	border-color: rgba(255, 125, 125, 0.14);
}

.type-badge-icon {
	font-size: 28rpx;
	color: #ffffff;
}

.load-more {
	padding: 32rpx 0;
	text-align: center;
}

.load-more-text {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.3);
}

@media (max-width: 420px) {
	.overview-main {
		align-items: flex-start;
	}

	.overview-side {
		flex-direction: column;
		align-items: flex-end;
	}

	.overview-stats {
		grid-template-columns: 1fr;
	}

	.overview-stat--wide {
		grid-column: span 1;
	}
}
</style>
