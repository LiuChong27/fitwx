<template>
	<view class="tiktok-card" role="article" :aria-label="item.nickname + '的动态'">
		<!-- Full Screen Background -->
		<image 
			class="tiktok-bg" 
			:src="optimizedCover" 
			mode="aspectFill" 
			aria-hidden="true"
			@click="onBgClick"
		/>
		
		<!-- Gradient Overlay -->
		<view class="tiktok-overlay"></view>

		<!-- Right Side Actions -->
		<view class="tiktok-actions">
			<view class="action-item" role="button" aria-label="查看用户资料" @click.stop="$emit('goProfile')">
				<image class="action-avatar" :src="optimizedAvatar" mode="aspectFill" aria-hidden="true" />
				<view class="action-add" v-if="!item.followed" aria-hidden="true">
					<uni-icons type="plusempty" size="12" color="#fff" />
				</view>
			</view>
			
			<view class="action-item" role="button" :aria-label="item.liked ? '取消点赞' : '点赞'" @click.stop="$emit('like')">
				<uni-icons :type="item.liked ? 'heart-filled' : 'heart'" size="35" :color="item.liked ? '#f85149' : '#fff'" />
				<text class="action-text">{{ formatCount(item.likeCount) }}</text>
			</view>
			
			<view class="action-item" role="button" aria-label="评论" @click.stop="$emit('comment')">
				<uni-icons type="chatbubble-filled" size="32" color="#fff" />
				<text class="action-text">{{ formatCount(item.commentCount) }}</text>
			</view>


			<!-- 本人发布：编辑/删除；他人发布：约练/私信/关注 -->
			<template v-if="item.isMine">
				<view class="action-item" @click.stop="$emit('edit')">
					<uni-icons type="compose" size="32" color="#fff" />
					<text class="action-text">编辑</text>
				</view>
				<view class="action-item" @click.stop="$emit('delete')">
					<uni-icons type="trash" size="32" color="#fff" />
					<text class="action-text">删除</text>
				</view>
			</template>
			<template v-else>
				<view class="action-item" @click.stop="$emit('invite')">
					<view class="icon-circle btn-meet">
						<uni-icons type="paperplane-filled" size="20" color="#fff" />
					</view>
					<text class="action-text">约练</text>
				</view>
				
				<view class="action-item" @click.stop="$emit('chat')">
					<uni-icons type="chatbubbles-filled" size="32" color="#fff" />
					<text class="action-text">私信</text>
				</view>
			</template>
		</view>

		<!-- Bottom Info -->
		<view class="tiktok-info">
			<view class="info-user" @click.stop="$emit('goProfile')">
				<text class="info-nickname">@{{ item.nickname }}</text>
			</view>
			
			<view class="info-content-box">
				<text class="info-content">{{ item.content }}</text>
			</view>
			
			<view class="info-tags" v-if="item.tags && item.tags.length">
				<text class="info-tag" v-for="(tag, i) in item.tags" :key="i">#{{ tag }}</text>
			</view>
			
			<view class="info-location" v-if="item.distanceKm || item.location">
				<uni-icons type="location-filled" size="14" color="rgba(255,255,255,0.8)" />
				<text class="location-text">
					{{ item.location || '未知位置' }} · {{ formatDistance(item.distanceKm) }}
				</text>
			</view>
		</view>
	</view>
</template>

<script>
	export default {
		props: {
			item: {
				type: Object,
				default: () => ({})
			}
		},		computed: {
			optimizedCover() {
				const { coverUrl: cvUrl } = require('@/common/imageOptimizer.js');
				return this.item.cover ? cvUrl(this.item.cover) : '';
			},
			optimizedAvatar() {
				const { avatarUrl: avUrl } = require('@/common/imageOptimizer.js');
				return this.item.avatar ? avUrl(this.item.avatar) : '';
			},
		},		methods: {
			formatCount(num) {
				if (!num) return '0';
				return num > 999 ? (num / 1000).toFixed(1) + 'k' : num;
			},
			formatDistance(km) {
				if (!km) return '';
				return km < 1 ? '<1km' : `${km}km`;
			},
			onBgClick() {
				// Double tap logic could go here
				this.$emit('cardClick');
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni.scss";

	.tiktok-card {
		position: relative;
		width: 100%;
		height: 100%;
		background: $neu-dark-bg;
		overflow: hidden;
	}

	.tiktok-bg {
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.tiktok-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 55%;
		background: linear-gradient(
			to top,
			rgba(10,22,40,0.95) 0%,
			rgba(10,22,40,0.6) 40%,
			rgba(10,22,40,0) 100%
		);
		pointer-events: none;
	}

	.tiktok-actions {
		position: absolute;
		right: 16rpx;
		bottom: 120rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 28rpx;
		z-index: 10;
	}

	.action-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
		transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		
		&:active {
			transform: scale(0.88);
		}
	}

	.action-avatar {
		width: 92rpx;
		height: 92rpx;
		border-radius: 50%;
		border: 3rpx solid rgba(0, 229, 255, 0.5);
		margin-bottom: 10rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 229, 255, 0.15);
		transition: border-color 0.3s;
	}
	
	.action-add {
		position: absolute;
		bottom: 10rpx;
		left: 50%;
		transform: translateX(-50%);
		width: 34rpx;
		height: 34rpx;
		background: linear-gradient(135deg, #00E5FF, #00B0FF);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4rpx 12rpx rgba(0, 229, 255, 0.4);
		animation: addBounce 2s ease-in-out infinite;
	}
	@keyframes addBounce {
		0%, 100% { transform: translateX(-50%) scale(1); }
		50% { transform: translateX(-50%) scale(1.15); }
	}
	
	.icon-circle {
		width: 82rpx;
		height: 82rpx;
		border-radius: 50%;
		background: rgba(255,255,255,0.12);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 6rpx;
		backdrop-filter: blur(8px);
		border: 1rpx solid rgba(255,255,255,0.1);
		transition: all 0.25s;
		
		&.btn-meet {
			background: $sl-gradient-primary;
			box-shadow: 0 4rpx 20rpx rgba(0, 229, 255, 0.4);
			border: none;
			animation: meetGlow 2.5s ease-in-out infinite;
		}
	}
	@keyframes meetGlow {
		0%, 100% { box-shadow: 0 4rpx 20rpx rgba(0, 229, 255, 0.35); }
		50% { box-shadow: 0 4rpx 32rpx rgba(0, 229, 255, 0.55); }
	}

	.action-text {
		color: #fff;
		font-size: 22rpx;
		text-shadow: 0 2rpx 6rpx rgba(0,0,0,0.6);
		font-weight: 500;
		letter-spacing: 0.5px;
	}

	.tiktok-info {
		position: absolute;
		left: 28rpx;
		bottom: 120rpx;
		right: 160rpx;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.info-nickname {
		font-size: 36rpx;
		font-weight: 700;
		color: #fff;
		text-shadow: 0 2rpx 8rpx rgba(0,0,0,0.6);
	}

	.info-content-box {
		max-height: 120rpx;
		overflow: hidden;
	}

	.info-content {
		font-size: 28rpx;
		color: rgba(255,255,255,0.92);
		line-height: 1.55;
		text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.5);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	
	.info-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
	}
	
	.info-tag {
		font-size: 26rpx;
		color: #00E5FF;
		font-weight: 600;
		text-shadow: 0 0 12rpx rgba(0, 229, 255, 0.3);
	}
	
	.info-location {
		display: flex;
		align-items: center;
		gap: 8rpx;
		background: rgba(0, 229, 255, 0.1);
		padding: 8rpx 18rpx;
		border-radius: 20rpx;
		align-self: flex-start;
		backdrop-filter: blur(6px);
		border: 1px solid rgba(0, 229, 255, 0.12);
	}
	
	.location-text {
		font-size: 24rpx;
		color: rgba(255,255,255,0.9);
	}
</style>
