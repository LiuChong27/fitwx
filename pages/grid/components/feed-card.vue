<template>
	<view class="feed-card" :style="{ '--enter-index': index }" role="article" :aria-label="item.nickname + '的训练笔记'" @click="onBgClick">
		<view v-if="showCoverPlaceholder" class="feed-cover-placeholder" :class="{ 'feed-cover-placeholder--loading': showCoverLoading }" aria-hidden="true">
			<fit-shimmer-block v-if="showCoverLoading" width="100%" height="100%" radius="0" />
			<view v-else class="feed-cover-fallback">
				<uni-icons type="image" size="32" color="rgba(255,255,255,0.2)" />
			</view>
		</view>
		<image v-if="displayCover && !coverFailed" class="feed-cover" :class="{ 'feed-cover--ready': coverLoaded }" :src="displayCover" :mode="coverMode" aria-hidden="true" @load="handleCoverLoad" @error="handleCoverError" />
		<view class="feed-overlay"></view>

		<view class="feed-badge">{{ item.isMine ? (item.statusLabel || '我的笔记') : formatDistance(item.distanceKm) }}</view>

		<view class="feed-content-panel">
			<view class="feed-author" role="button" @click.stop="$emit('goProfile')">
				<image v-if="displayAvatar" class="feed-avatar" :src="displayAvatar" mode="aspectFill" aria-hidden="true" />
				<view v-else class="feed-avatar feed-avatar--empty" aria-hidden="true">
					<uni-icons type="person-filled" size="18" color="rgba(255,255,255,0.42)" />
				</view>
				<view class="feed-author__text">
					<text class="feed-name">{{ item.nickname || '用户' }}</text>
					<text class="feed-meta">{{ item.location || '附近训练' }} · {{ formatDistance(item.distanceKm) }}</text>
				</view>
			</view>

			<view class="feed-excerpt" v-if="item.content">
				<text>{{ item.content }}</text>
			</view>
			<view v-if="item.tags && item.tags.length" class="feed-tags">
				<text v-for="tag in item.tags.slice(0, 3)" :key="tag" class="feed-tag">#{{ tag }}</text>
			</view>
		</view>

		<view class="feed-sidebar-col">
			<view class="sidebar-item" role="button" :aria-label="item.liked ? '取消点赞' : '点赞'" @click.stop="$emit('like')">
				<uni-icons :type="item.liked ? 'heart-filled' : 'heart'" size="32" :color="item.liked ? '#FF7A7A' : '#72E4C8'" />
				<text class="sidebar-value">{{ formatCount(item.likeCount) }}</text>
			</view>
			<view class="sidebar-item" role="button" aria-label="评论" @click.stop="$emit('comment')">
				<uni-icons type="chatbubble" size="32" color="#BCEBDD" />
				<text class="sidebar-value">{{ formatCount(item.commentCount) }}</text>
			</view>

			<template v-if="item.isMine && item.status !== 2">
				<view class="sidebar-item" role="button" aria-label="编辑" @click.stop="$emit('edit')">
					<uni-icons type="compose" size="32" color="rgba(255, 255, 255, 0.82)" />
					<text class="sidebar-value">编辑</text>
				</view>
				<view class="sidebar-item" role="button" aria-label="删除" @click.stop="$emit('delete')">
					<uni-icons type="trash" size="32" color="#FF8F8F" />
					<text class="sidebar-value danger">删除</text>
				</view>
			</template>
			<template v-else-if="item.isMine">
				<view class="sidebar-item" aria-label="已删除笔记">
					<uni-icons type="info" size="32" color="rgba(255, 255, 255, 0.58)" />
					<text class="sidebar-value">已删除</text>
				</view>
			</template>
			<template v-else>
				<view class="sidebar-item" role="button" aria-label="私信" @click.stop="$emit('chat')">
					<uni-icons type="chatboxes" size="32" color="rgba(255, 255, 255, 0.82)" />
					<text class="sidebar-value">私信</text>
				</view>
				<view v-if="canInvite" class="sidebar-item" role="button" aria-label="约练" @click.stop="$emit('invite')">
					<uni-icons type="flag" size="32" color="#72E4C8" />
					<text class="sidebar-value primary">约练</text>
				</view>
			</template>
		</view>
	</view>
</template>

<script>
	import FitShimmerBlock from '@/components/fit-shimmer-block.vue';
	import { webpUrl as imgUrl, avatarUrl as avUrl } from '@/common/imageOptimizer.js';

	export default {
		components: {
			FitShimmerBlock
		},
		data() {
			return {
				coverLoaded: false,
				coverFailed: false,
				coverRatio: 0
			};
		},
		props: {
			item: {
				type: Object,
				default: () => ({})
			},
			index: {
				type: Number,
				default: 0
			}
		},
		computed: {
			defaultCover() {
				return '';
			},
			displayCover() {
				return this.optimizedCover || this.defaultCover;
			},
			optimizedCover() {
				const coverSource = this.pickImageUrl(
					this.item.cover ||
					this.item.photo ||
					this.item.image ||
					this.item.coverUrl ||
					this.item.images ||
					this.item.photos ||
					this.item.media
				);
				return coverSource ? imgUrl(coverSource) : '';
			},
			displayAvatar() {
				return this.item.avatar ? avUrl(this.item.avatar) : '';
			},
			coverMode() {
				return this.coverRatio > 0 && this.coverRatio < 0.78 ? 'aspectFit' : 'aspectFill';
			},
			canInvite() {
				const distance = Number(this.item.distanceKm);
				return Number.isFinite(distance) && distance <= 10;
			},
			showCoverLoading() {
				return !!this.displayCover && !this.coverLoaded && !this.coverFailed;
			},
			showCoverPlaceholder() {
				return !this.displayCover || this.coverFailed || this.showCoverLoading;
			}
		},
		watch: {
			'item.id'() {
				this.resetImageState();
			},
			displayCover() {
				this.coverLoaded = false;
				this.coverFailed = false;
				this.coverRatio = 0;
			}
		},
		methods: {
			resetImageState() {
				this.coverLoaded = false;
				this.coverFailed = false;
				this.coverRatio = 0;
			},
			pickImageUrl(source) {
				if (!source) return '';
				if (typeof source === 'string') return source;
				if (Array.isArray(source)) {
					for (const item of source) {
						const url = this.pickImageUrl(item);
						if (url) return url;
					}
					return '';
				}
				if (typeof source === 'object') {
					return source.url || source.path || source.fileID || source.fileId || source.src || '';
				}
				return '';
			},
			formatCount(num) {
				if (!num) return '0';
				return num > 999 ? (num / 1000).toFixed(1) + 'k' : num;
			},
			formatDistance(km) {
				if (!km) return '附近';
				return km < 1 ? '1km内' : `${Number(km).toFixed(1)}km`;
			},
			handleCoverLoad(e) {
				this.coverLoaded = true;
				const width = Number(e?.detail?.width || 0);
				const height = Number(e?.detail?.height || 0);
				this.coverRatio = width > 0 && height > 0 ? width / height : 0;
			},
			handleCoverError() {
				this.coverFailed = true;
				this.coverLoaded = false;
			},
			onBgClick() {
				this.$emit('cardClick');
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni.scss";

	.feed-card {
		position: relative;
		width: 100%;
		height: 520rpx;
		border-radius: 24rpx;
		background: linear-gradient(135deg, rgba(14, 25, 35, 0.94), rgba(8, 19, 29, 0.98));
		border: 1rpx solid rgba(255, 255, 255, 0.07);
		overflow: hidden;
		box-shadow: 0 14rpx 40rpx rgba(0, 0, 0, 0.20);
		animation: feedCardReveal 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: calc(var(--enter-index, 0) * 70ms);
		transform-origin: center bottom;
		margin-bottom: 20rpx;
	}

	.feed-cover-placeholder {
		position: absolute;
		inset: 0;
	}

	.feed-cover-placeholder--loading {
		background: rgba(255, 255, 255, 0.04);
	}

	.feed-cover-fallback {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.feed-cover {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		opacity: 0;
		transition: opacity 0.3s ease;
		background: rgba(8, 19, 29, 0.62);
	}

	.feed-cover--ready {
		opacity: 1;
		transform: scale(1);
	}

	.feed-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(6, 12, 18, 0.02) 0%, rgba(6, 12, 18, 0.0) 40%, rgba(6, 12, 18, 0.62) 100%);
		pointer-events: none;
	}

	.feed-badge {
		position: absolute;
		left: 24rpx;
		top: 24rpx;
		padding: 12rpx 22rpx;
		border-radius: 999rpx;
		background: rgba(8, 19, 29, 0.68);
		border: 1rpx solid rgba(255, 255, 255, 0.07);
		font-size: 24rpx;
		font-weight: 650;
		color: #F2FFFB;
		z-index: 10;
	}

	.feed-content-panel {
		position: absolute;
		left: 24rpx;
		right: 132rpx;
		bottom: 28rpx;
		z-index: 10;
		padding: 20rpx 20rpx 18rpx;
		border-radius: 26rpx;
		background: rgba(7, 16, 25, 0.48);
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		box-shadow: 0 16rpx 34rpx rgba(0, 0, 0, 0.18);
	}

	.feed-author {
		display: flex;
		align-items: center;
		gap: 14rpx;
	}

	.feed-avatar {
		width: 64rpx;
		height: 64rpx;
		border-radius: 50%;
		flex-shrink: 0;
		border: 1rpx solid rgba(114, 228, 200, 0.18);
	}

	.feed-avatar--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.05);
	}

	.feed-author__text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4rpx;
	}

	.feed-name {
		font-size: 28rpx;
		font-weight: 650;
		color: #FFFFFF;
	}

	.feed-meta {
		font-size: 20rpx;
		color: rgba(255, 255, 255, 0.56);
	}

	.feed-excerpt {
		margin-top: 14rpx;
		font-size: 26rpx;
		line-height: 1.55;
		color: rgba(255, 255, 255, 0.92);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.feed-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 10rpx;
		margin-top: 14rpx;
	}

	.feed-tag {
		padding: 6rpx 14rpx;
		border-radius: 999rpx;
		background: rgba(114, 228, 200, 0.10);
		border: 1rpx solid rgba(114, 228, 200, 0.14);
		color: #8DE8D5;
		font-size: 20rpx;
	}

	.feed-sidebar-col {
		position: absolute;
		right: 24rpx;
		bottom: 62rpx;
		z-index: 10;
		width: 88rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 30rpx;
	}

	.sidebar-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8rpx;
	}

	.sidebar-value {
		font-size: 22rpx;
		font-weight: 650;
		color: rgba(255, 255, 255, 0.92);
		line-height: 1;
		text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.45);

		&.danger {
			color: #FF8F8F;
		}

		&.primary {
			color: #72E4C8;
		}
	}

	@keyframes feedCardReveal {
		from {
			opacity: 0;
			transform: translateY(28rpx) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
