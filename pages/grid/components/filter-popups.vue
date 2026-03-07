<template>
	<view>
		<uni-popup ref="genderPopup" type="bottom">
			<view class="picker-sheet">
				<view class="picker-header">
					<text class="picker-title">选择性别</text>
					<uni-icons type="closeempty" size="24" color="#666" @click="close('gender')" />
				</view>
				<view class="picker-content">
					<view class="picker-option" 
						v-for="opt in genderOptions" 
						:key="opt.value" 
						:class="{ active: filters.gender === opt.value }"
						@click="select('gender', opt.value)">
						<view class="opt-left">
							<text class="opt-label">{{ opt.label }}</text>
							<text class="opt-badge" v-if="opt.single">单身认证</text>
						</view>
						<uni-icons v-if="filters.gender === opt.value" type="checkmarkempty" size="20" color="#00E5FF" />
					</view>
				</view>
			</view>
		</uni-popup>

		<uni-popup ref="distancePopup" type="bottom">
			<view class="picker-sheet">
				<view class="picker-header">
					<text class="picker-title">选择距离</text>
					<uni-icons type="closeempty" size="24" color="#666" @click="close('distance')" />
				</view>
				<view class="picker-content">
					<view class="picker-option" 
						v-for="opt in distanceOptions" 
						:key="opt.value" 
						:class="{ active: filters.distance === opt.value }"
						@click="select('distance', opt.value)">
						<text class="opt-label">{{ opt.label }}</text>
						<uni-icons v-if="filters.distance === opt.value" type="checkmarkempty" size="20" color="#00E5FF" />
					</view>
				</view>
			</view>
		</uni-popup>

		<uni-popup ref="typePopup" type="bottom">
			<view class="picker-sheet">
				<view class="picker-header">
					<text class="picker-title">健身类型</text>
					<uni-icons type="closeempty" size="24" color="#666" @click="close('type')" />
				</view>
				<view class="picker-content">
					<view class="picker-option" 
						v-for="opt in typeOptions" 
						:key="opt.value" 
						:class="{ active: filters.type === opt.value }"
						@click="select('type', opt.value)">
						<text class="opt-label">{{ opt.label }}</text>
						<uni-icons v-if="filters.type === opt.value" type="checkmarkempty" size="20" color="#00E5FF" />
					</view>
				</view>
			</view>
		</uni-popup>

		<uni-popup ref="levelPopup" type="bottom">
			<view class="picker-sheet">
				<view class="picker-header">
					<text class="picker-title">训练等级</text>
					<uni-icons type="closeempty" size="24" color="#666" @click="close('level')" />
				</view>
				<view class="picker-content">
					<view class="picker-option" 
						v-for="opt in levelOptions" 
						:key="opt.value" 
						:class="{ active: filters.level === opt.value }"
						@click="select('level', opt.value)">
						<text class="opt-label">{{ opt.label }}</text>
						<uni-icons v-if="filters.level === opt.value" type="checkmarkempty" size="20" color="#00E5FF" />
					</view>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
	export default {
		props: {
			filters: {
				type: Object,
				default: () => ({})
			},
			genderOptions: { type: Array, default: () => [] },
			distanceOptions: { type: Array, default: () => [] },
			typeOptions: { type: Array, default: () => [] },
			levelOptions: { type: Array, default: () => [] }
		},
		methods: {
			open(key) {
				const method = this.$refs[`${key}Popup`] ? 'open' : '';
				if (method) {
					this.$refs[`${key}Popup`].open();
				} else {
					console.warn(`Popup ref ${key}Popup not found`);
				}
			},
			close(key) {
				const method = this.$refs[`${key}Popup`] ? 'close' : '';
				if (method) {
					this.$refs[`${key}Popup`].close();
				}
			},
			select(key, value) {
				this.$emit('change', { key, value });
				this.close(key);
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni.scss";

	.picker-sheet {
		background: $sl-surface;
		border-radius: 24rpx 24rpx 0 0;
		padding-bottom: env(safe-area-inset-bottom);
		overflow: hidden;
		border-top: 1px solid rgba(0, 229, 255, 0.15);
	}
	
	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 32rpx;
		border-bottom: 1px solid $glass-border;
	}
	
	.picker-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #fff;
	}
	
	.picker-content {
		max-height: 60vh;
		overflow-y: auto;
		padding: 16rpx 0;
	}
	
	.picker-option {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24rpx 32rpx;
		transition: background 0.2s;
		
		&:active {
			background: rgba(0, 229, 255, 0.06);
		}
		
		&.active {
			.opt-label {
				color: #00E5FF;
				font-weight: 600;
			}
		}
	}
	
	.opt-left {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}
	
	.opt-label {
		font-size: 30rpx;
		color: rgba(255, 255, 255, 0.8);
	}
	
	.opt-badge {
		font-size: 20rpx;
		padding: 4rpx 12rpx;
		border-radius: 8rpx;
		background: rgba(0, 229, 255, 0.12);
		color: #00E5FF;
	}
</style>