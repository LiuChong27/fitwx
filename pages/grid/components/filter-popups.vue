<template>
	<view>
		<uni-popup ref="genderPopup" type="bottom">
			<view class="picker-sheet popup-shell">
				<view class="picker-header popup-head">
					<view class="picker-header__copy popup-head__copy">
						<text class="picker-kicker popup-kicker">动态筛选</text>
						<text class="picker-title popup-title">选择性别</text>
					</view>
					<view class="picker-close" role="button" aria-label="关闭性别筛选" @click="close('gender')">
						<uni-icons type="closeempty" size="24" color="#FFFFFF" />
					</view>
				</view>
				<view class="picker-content popup-content">
					<fit-state-panel
						v-if="!genderOptions.length"
						compact
						scene="discover"
						:kicker="$t('state.filter.empty.kicker')"
						:title="$t('state.filter.empty.genderTitle')"
						:description="$t('state.filter.empty.genderDesc')"
					/>
					<view class="picker-option" 
						v-else
						v-for="opt in genderOptions" 
						:key="opt.value" 
						:class="{ active: filters.gender === opt.value }"
						@click="select('gender', opt.value)">
						<view class="opt-left">
							<text class="opt-label">{{ opt.label }}</text>
							<text class="opt-badge" v-if="opt.single">单身认证</text>
						</view>
						<uni-icons v-if="filters.gender === opt.value" type="checkmarkempty" size="20" color="#72E4C8" />
					</view>
				</view>
			</view>
		</uni-popup>

		<uni-popup ref="distancePopup" type="bottom">
			<view class="picker-sheet popup-shell">
				<view class="picker-header popup-head">
					<view class="picker-header__copy popup-head__copy">
						<text class="picker-kicker popup-kicker">动态筛选</text>
						<text class="picker-title popup-title">选择距离</text>
					</view>
					<view class="picker-close" role="button" aria-label="关闭距离筛选" @click="close('distance')">
						<uni-icons type="closeempty" size="24" color="#FFFFFF" />
					</view>
				</view>
				<view class="picker-content popup-content">
					<fit-state-panel
						v-if="!distanceOptions.length"
						compact
						scene="discover"
						:kicker="$t('state.filter.empty.kicker')"
						:title="$t('state.filter.empty.distanceTitle')"
						:description="$t('state.filter.empty.distanceDesc')"
					/>
					<view class="picker-option" 
						v-else
						v-for="opt in distanceOptions" 
						:key="opt.value" 
						:class="{ active: filters.distance === opt.value }"
						@click="select('distance', opt.value)">
						<text class="opt-label">{{ opt.label }}</text>
						<uni-icons v-if="filters.distance === opt.value" type="checkmarkempty" size="20" color="#72E4C8" />
					</view>
				</view>
			</view>
		</uni-popup>

		<uni-popup ref="typePopup" type="bottom">
			<view class="picker-sheet popup-shell">
				<view class="picker-header popup-head">
					<view class="picker-header__copy popup-head__copy">
						<text class="picker-kicker popup-kicker">动态筛选</text>
						<text class="picker-title popup-title">健身类型</text>
					</view>
					<view class="picker-close" role="button" aria-label="关闭项目筛选" @click="close('type')">
						<uni-icons type="closeempty" size="24" color="#FFFFFF" />
					</view>
				</view>
				<view class="picker-content popup-content">
					<fit-state-panel
						v-if="!typeOptions.length"
						compact
						scene="discover"
						:kicker="$t('state.filter.empty.kicker')"
						:title="$t('state.filter.empty.typeTitle')"
						:description="$t('state.filter.empty.typeDesc')"
					/>
					<view class="picker-option" 
						v-else
						v-for="opt in typeOptions" 
						:key="opt.value" 
						:class="{ active: filters.type === opt.value }"
						@click="select('type', opt.value)">
						<text class="opt-label">{{ opt.label }}</text>
						<uni-icons v-if="filters.type === opt.value" type="checkmarkempty" size="20" color="#72E4C8" />
					</view>
				</view>
			</view>
		</uni-popup>

		<uni-popup ref="levelPopup" type="bottom">
			<view class="picker-sheet popup-shell">
				<view class="picker-header popup-head">
					<view class="picker-header__copy popup-head__copy">
						<text class="picker-kicker popup-kicker">动态筛选</text>
						<text class="picker-title popup-title">训练等级</text>
					</view>
					<view class="picker-close" role="button" aria-label="关闭等级筛选" @click="close('level')">
						<uni-icons type="closeempty" size="24" color="#FFFFFF" />
					</view>
				</view>
				<view class="picker-content popup-content">
					<fit-state-panel
						v-if="!levelOptions.length"
						compact
						scene="discover"
						:kicker="$t('state.filter.empty.kicker')"
						:title="$t('state.filter.empty.levelTitle')"
						:description="$t('state.filter.empty.levelDesc')"
					/>
					<view class="picker-option" 
						v-else
						v-for="opt in levelOptions" 
						:key="opt.value" 
						:class="{ active: filters.level === opt.value }"
						@click="select('level', opt.value)">
						<text class="opt-label">{{ opt.label }}</text>
						<uni-icons v-if="filters.level === opt.value" type="checkmarkempty" size="20" color="#72E4C8" />
					</view>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
	import FitStatePanel from '@/components/fit-state-panel.vue'

	export default {
		components: {
			FitStatePanel
		},
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

	.popup-shell {
		position: relative;
		overflow: hidden;
	}

	.popup-shell::before {
		content: '';
		position: absolute;
		inset: 0 0 auto 0;
		height: 180rpx;
		background: linear-gradient(180deg, rgba(114, 228, 200, 0.08), rgba(114, 228, 200, 0));
		pointer-events: none;
	}

	.picker-sheet {
		@include fit-bottom-sheet(30rpx);
		position: relative;
		padding-bottom: env(safe-area-inset-bottom);
		overflow: hidden;
	}
	
	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 32rpx;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		position: relative;
		z-index: 1;
	}

	.picker-header__copy {
		display: flex;
		flex-direction: column;
		gap: 8rpx;
	}

	.popup-head__copy {
		flex: 1;
		min-width: 0;
	}

	.picker-kicker {
		font-size: 20rpx;
		letter-spacing: 4rpx;
		text-transform: uppercase;
		color: rgba(141, 232, 213, 0.72);
	}
	
	.picker-title {
		font-size: 30rpx;
		font-weight: 650;
		color: #fff;
	}

	.picker-close {
		@include fit-icon-button(68rpx);
	}
	
	.picker-content {
		max-height: 60vh;
		overflow-y: auto;
		padding: 18rpx 18rpx 26rpx;
		display: flex;
		flex-direction: column;
		gap: 12rpx;
		position: relative;
		z-index: 1;
	}
	
	.picker-option {
		@include fit-form-panel(22rpx, 24rpx);
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 100rpx;
		box-sizing: border-box;
		transition: background 0.2s, border-color 0.2s, transform 0.2s;
		background: rgba(255, 255, 255, 0.035);
		border: 1rpx solid rgba(255, 255, 255, 0.06);
		
		&:active {
			background: rgba(114, 228, 200, 0.08);
			transform: scale(0.985);
		}
		
		&.active {
			background: rgba(114, 228, 200, 0.10);
			border-color: rgba(114, 228, 200, 0.22);
			.opt-label {
				color: #8DE8D5;
				font-weight: 650;
			}
		}
	}
	
	.opt-left {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}
	
	.opt-label {
		font-size: 28rpx;
		color: rgba(255, 255, 255, 0.84);
	}
	
	.opt-badge {
		font-size: 20rpx;
		padding: 4rpx 12rpx;
		border-radius: 8rpx;
		background: rgba(114, 228, 200, 0.08);
		color: #8DE8D5;
	}
</style>
