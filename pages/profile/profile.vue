<template>
	<view class="page">
		<uni-nav-bar
			fixed
			:status-bar="true"
			title="主页"
			:border="false"
			backgroundColor="#0D1B2A"
			color="#ffffff"
			@back="onBack"
		/>

		<!-- 封面区 -->
		<view class="cover-area">
			<image v-if="profile.coverUrl" class="cover-img" :src="optimizedCoverUrl" mode="aspectFill" aria-hidden="true" />
			<view v-else class="cover-img cover-placeholder"></view>
			<view class="cover-mask"></view>
		</view>

		<!-- 用户信息卡片 -->
		<view class="profile-card">
			<view class="header">
				<view class="avatar-ring">
					<image v-if="profile.avatarUrl" class="avatar" :src="optimizedAvatarUrl" mode="aspectFill" :aria-label="(profile.nickname || '用户') + '的头像'" />
					<view v-else class="avatar default-avatar" aria-label="默认头像">
						<uni-icons type="person-filled" size="46" color="rgba(255,255,255,0.3)" />
					</view>
					<view class="online-dot" v-if="isOnline" role="status" aria-label="在线"></view>
				</view>
				<view class="meta">
					<text class="name">{{ profile.nickname || '用户' }}</text>
					<text class="sub" v-if="profile.gender || profile.age">
						{{ profile.gender }}{{ profile.gender && profile.age ? ' · ' : '' }}{{ profile.age ? profile.age + '岁' : '' }}
					</text>
				</view>
			</view>

			<!-- 健身房标签 -->
			<view class="card-section" v-if="profile.gyms && profile.gyms.length">
				<view class="section-divider"></view>
				<text class="card-title">🏋️ 常去健身房</text>
				<view class="tag-row">
					<text class="tag" v-for="(g, i) in profile.gyms" :key="i">{{ g }}</text>
				</view>
			</view>

			<!-- 简介 -->
			<view class="card-section" v-if="profile.bio">
				<view class="section-divider"></view>
				<text class="card-title">📝 简介</text>
				<text class="bio">{{ profile.bio }}</text>
			</view>
		</view>

		<!-- 操作按钮 -->
		<view class="actions">
			<button class="btn-chat" aria-label="发起私信" @click="startChat">
				<uni-icons type="chatbubble-filled" size="18" color="#0A1628" />
				<text class="btn-text">发起私信</text>
			</button>
		</view>
	</view>
</template>

<script>
import apiService from '@/services/apiService.js';
import { coverUrl, avatarUrl as optimizedAvatar } from '@/common/imageOptimizer.js';

export default {
	data() {
		return {
			userId: '',
			loading: false,
			isOnline: false,
			profile: {
				userId: '',
				nickname: '',
				avatarUrl: '',
				coverUrl: '',
				bio: '',
				gyms: [],
				gender: '',
				age: null,
			},
		};
	},
	computed: {
		optimizedCoverUrl() {
			return this.profile.coverUrl ? coverUrl(this.profile.coverUrl) : '';
		},
		optimizedAvatarUrl() {
			return this.profile.avatarUrl ? optimizedAvatar(this.profile.avatarUrl) : '';
		},
	},
	onLoad(query) {
		this.userId = query.userId || '';
		if (!this.userId) {
			uni.showToast({ title: '用户ID缺失', icon: 'none' });
			return;
		}
		this.loadProfile();
	},
	methods: {
		onBack() {
			uni.navigateBack();
		},
		async loadProfile() {
			this.loading = true;
			try {
				const data = await apiService.getPublicProfile(this.userId);
				this.profile = {
					...this.profile,
					...data,
				};
			} catch (e) {
				console.error('[profile] loadProfile failed:', e);
				uni.showToast({ title: '加载失败', icon: 'none' });
			} finally {
				this.loading = false;
			}
		},
		startChat() {
			if (!this.userId) return;
			// 给 chat 页写入用户快照（与 discover 同一策略）
			try {
				const storageModule = require('@/common/storage.js');
				storageModule.default.set(`user_${this.userId}`, {
					nickname: this.profile.nickname,
					avatar: this.profile.avatarUrl,
				});
			} catch (_) {
				// ignore
			}
			uni.navigateTo({ url: `/pages/chat/chat?userId=${encodeURIComponent(this.userId)}&nickname=${encodeURIComponent(this.profile.nickname || '')}` });
		},
	},
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.page {
	min-height: 100vh;
	background: $neu-dark-bg;
	padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

/* 封面区域 */
.cover-area {
	position: relative;
	width: 100%;
	height: 320rpx;
	overflow: hidden;
}
.cover-img {
	width: 100%;
	height: 100%;
	display: block;
}
.cover-placeholder {
	background: linear-gradient(135deg, #0D1B2A 0%, #132136 60%, rgba(0,229,255,0.08) 100%);
}
.cover-mask {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 60%;
	background: linear-gradient(to top, $neu-dark-bg, transparent);
	pointer-events: none;
}

/* 用户信息卡片 */
.profile-card {
	margin: -60rpx 24rpx 0;
	@include sl-card;
	padding: 32rpx;
	position: relative;
	z-index: 2;
	animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.header {
	display: flex;
	gap: 24rpx;
	align-items: center;
}
.avatar-ring {
	position: relative;
	flex-shrink: 0;
}
.avatar {
	width: 128rpx;
	height: 128rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.05);
	border: 4rpx solid rgba(0, 229, 255, 0.2);
	box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.4);
}
.default-avatar {
	display: flex;
	justify-content: center;
	align-items: center;
}
.online-dot {
	position: absolute;
	right: 6rpx;
	bottom: 6rpx;
	width: 24rpx;
	height: 24rpx;
	border-radius: 50%;
	background: #00E676;
	border: 4rpx solid $neu-dark-bg;
	animation: breathe 2s ease-in-out infinite;
}
.meta {
	flex: 1;
}
.name {
	font-size: 36rpx;
	font-weight: 700;
	color: #ffffff;
	display: block;
	text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.5);
}
.sub {
	margin-top: 8rpx;
	font-size: 26rpx;
	color: rgba(255,255,255,0.6);
	display: block;
}

/* 内容区段 */
.card-section {
	margin-top: 24rpx;
}
.section-divider {
	height: 1rpx;
	background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.15), transparent);
	margin-bottom: 24rpx;
}
.card-title {
	font-size: 28rpx;
	font-weight: 600;
	color: rgba(255, 255, 255, 0.85);
	margin-bottom: 16rpx;
	display: block;
}
.tag-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}
.tag {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.9);
	background: rgba(0, 229, 255, 0.1);
	padding: 8rpx 20rpx;
	border-radius: 24rpx;
	border: 1rpx solid rgba(0, 229, 255, 0.18);
}
.bio {
	font-size: 28rpx;
	color: rgba(255,255,255,0.75);
	line-height: 1.7;
	padding: 16rpx 20rpx;
	background: rgba(0, 229, 255, 0.04);
	border-radius: 16rpx;
	border: 1rpx solid rgba(0, 229, 255, 0.06);
}

/* 操作按钮 */
.actions {
	margin: 32rpx 24rpx 0;
	animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.15s both;
}
.btn-chat {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	@include sl-btn-primary;
	height: 96rpx;
	line-height: 96rpx;
	font-size: 30rpx;
}
.btn-text {
	color: #0A1628;
	font-weight: 700;
	font-size: 30rpx;
}

/* 动画 keyframes */
@keyframes fadeInUp {
	from { opacity: 0; transform: translateY(24rpx); }
	to   { opacity: 1; transform: translateY(0); }
}
@keyframes breathe {
	0%, 100% { box-shadow: 0 0 6rpx rgba(0, 230, 118, 0.3); }
	50%      { box-shadow: 0 0 16rpx rgba(0, 230, 118, 0.6); }
}
</style>
