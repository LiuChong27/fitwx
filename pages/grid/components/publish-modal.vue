<template>
	<uni-popup ref="popup" type="bottom" @change="onChange">
		<view class="publish-sheet popup-shell">
			<view class="sheet-header popup-head fit-popup-enter fit-popup-enter--1">
				<view class="sheet-header__copy popup-head__copy">
					<text class="sheet-kicker popup-kicker">内容审核</text>
					<text class="sheet-title popup-title">提交训练笔记</text>
				</view>
				<view class="close-btn" @click="close">
					<uni-icons type="closeempty" size="24" color="#fff" />
				</view>
			</view>

			<view class="sheet-body popup-content">
				<view class="compose-panel compose-panel--content fit-popup-enter fit-popup-enter--2">
					<text class="compose-label">笔记内容</text>
					<textarea
						class="content-input"
						v-model="form.content"
						placeholder="这一刻的想法... #今日训练"
						placeholder-class="placeholder"
						:maxlength="500"
						:adjust-position="true"
					/>
				</view>

				<view class="compose-panel compose-panel--media fit-popup-enter fit-popup-enter--3">
					<view class="compose-panel__head">
						<text class="compose-label">封面图片</text>
						<text class="compose-hint">可选，增强卡片展示</text>
					</view>
					<view class="media-upload" @click="chooseImage">
						<image v-if="form.photo" :src="form.photo" mode="aspectFill" class="preview-img" />
						<fit-state-panel
							v-else
							class="upload-state"
							compact
							scene="profile"
							:kicker="$t('state.discover.publishCover.kicker')"
							:title="$t('state.discover.publishCover.title')"
							:description="$t('state.discover.publishCover.description')"
						/>
					</view>
					<text v-if="uploadError" class="upload-error">{{ uploadError }}</text>
				</view>

				<view class="options-list fit-popup-enter fit-popup-enter--4">
					<view class="option-item">
						<uni-icons type="paperplane" size="20" color="#888" />
						<view class="option-body">
							<text class="option-label">标签</text>
							<picker class="picker-flex" mode="selector" :range="types" range-key="label" @change="onTypeChange">
								<view class="picker-val">{{ currentTypeLabel }}</view>
							</picker>
						</view>
						<uni-icons type="right" size="14" color="#444" />
					</view>

					<view class="option-item location-option" @click="chooseLocation">
						<uni-icons type="location" size="20" :color="form.location ? '#FF5F6D' : '#888'" />
						<view class="location-content">
							<text class="option-label">地点</text>
							<text :class="['location-name', { 'has-location': form.location }]">
								{{ form.location || '青岛大学（浮山校区）' }}
							</text>
							<text class="location-address">
								{{ form.address || '山东省青岛市崂山区宁夏路308号' }}
							</text>
						</view>
						<view class="location-action">
							<text v-if="form.location" class="location-clear" @click.stop="clearLocation">✕</text>
							<uni-icons v-else type="right" size="14" color="#444" />
						</view>
					</view>
				</view>
			</view>

			<view class="sheet-footer fit-popup-enter fit-popup-enter--5">
				<button class="submit-btn" :loading="loading" :disabled="loading || !form.content" @click="submit">
					{{ loading ? '提交中' : '提交审核' }}
				</button>
			</view>
		</view>
	</uni-popup>
</template>

<script>
	import FitStatePanel from '@/components/fit-state-panel.vue'

	export default {
		components: {
			FitStatePanel
		},
		props: {
			types: {
				type: Array,
				default: () => []
			}
		},
		data() {
			return {
				form: {
					content: '',
					type: 'gym',
					location: '',
					address: '',
					latitude: null,
					longitude: null,
					photo: ''
				},
				loading: false,
				uploadError: ''
			}
		},
		computed: {
			currentTypeLabel() {
				const found = this.types.find(t => t.value === this.form.type);
				return found ? found.label : '格斗';
			}
		},
		methods: {
			open(initialForm = null) {
				this.reset();
				if (initialForm && typeof initialForm === 'object') {
					const { uploadError, ...formData } = initialForm;
					this.form = { ...this.form, ...formData };
					if (uploadError) {
						this.uploadError = uploadError;
					}
				}
				this.$refs.popup.open();
			},
			close() {
				this.$refs.popup.close();
			},
			onChange(e) {
				if (!e.show) {
					uni.hideKeyboard();
				}
			},
			reset() {
				this.form = {
					content: '',
					type: this.types[0]?.value || 'gym',
					location: '',
					address: '',
					latitude: null,
					longitude: null,
					photo: ''
				};
				this.loading = false;
				this.uploadError = '';
			},
			onTypeChange(e) {
				const index = e.detail.value;
				if (this.types[index]) {
					this.form.type = this.types[index].value;
				}
			},
			chooseImage() {
				this.uploadError = '';
				uni.chooseImage({
					count: 1,
					success: (res) => {
						if (res.tempFilePaths.length > 0) {
							this.form.photo = res.tempFilePaths[0];
						}
					}
				});
			},
			chooseLocation() {
				uni.chooseLocation({
					success: (res) => {
						const locationName = res.name || res.address || '已选位置';
						this.form.location = locationName;
						this.form.address = res.address || '';
						this.form.latitude = res.latitude;
						this.form.longitude = res.longitude;
					},
					fail: (err) => {
						console.error('[publish-modal] Choose location failed:', err);
						const errMsg = err.errMsg || '';
						if (errMsg.includes('cancel')) return;

						let content = '无法打开地图选择。';
						// #ifdef H5
						if (errMsg.includes('key')) {
							content += '请检查 manifest.json 中 H5 地图配置的 Key 是否正确。';
						} else if (errMsg.includes('referer') || errMsg.includes('security')) {
							content += '请检查 Key 的安全域名设置是否包含当前域名。';
						}
						// #endif

						uni.showModal({
							title: '地图错误',
							content: content + '\n详细信息: ' + errMsg,
							showCancel: false
						});
					}
				});
			},
			clearLocation() {
				this.form.location = '';
				this.form.address = '';
				this.form.latitude = null;
				this.form.longitude = null;
			},
			submit() {
				if (!this.form.content.trim()) return;
				this.loading = true;
				this.$emit('submit', { ...this.form });
			},
			submitDone() {
				this.loading = false;
				this.close();
			},
			submitFail() {
				this.loading = false;
			},
			setUploadError(message) {
				this.uploadError = message || '';
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni.scss";

	@include fit-popup-enter-classes(5);

	.popup-shell {
		position: relative;
		overflow: hidden;
	}

	.popup-shell::before {
		content: '';
		position: absolute;
		inset: 0 0 auto 0;
		height: 180rpx;
		background: linear-gradient(180deg, rgba(114, 228, 200, 0.10), rgba(114, 228, 200, 0));
		pointer-events: none;
	}

	.publish-sheet {
		@include fit-bottom-sheet(30rpx);
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		position: relative;
		padding-bottom: env(safe-area-inset-bottom);
	}

	.sheet-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 32rpx;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		position: relative;
		z-index: 1;
	}

	.sheet-header__copy {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8rpx;
	}

	.sheet-kicker {
		font-size: 20rpx;
		letter-spacing: 4rpx;
		text-transform: uppercase;
		color: rgba(114, 228, 200, 0.72);
	}

	.sheet-title {
		font-size: 34rpx;
		font-weight: 700;
		color: #fff;
	}

	.close-btn {
		@include fit-icon-button(68rpx);
		padding: 8rpx;
	}

	.sheet-body {
		padding: 32rpx;
		flex: 1;
		overflow-y: auto;
		position: relative;
		z-index: 1;
	}

	.compose-panel {
		@include fit-form-panel(24rpx, 28rpx);
		margin-bottom: 28rpx;
	}

	.compose-panel__head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16rpx;
		margin-bottom: 18rpx;
	}

	.compose-label {
		font-size: 24rpx;
		font-weight: 700;
		color: rgba(255,255,255,0.78);
	}

	.compose-hint {
		font-size: 22rpx;
		color: rgba(255,255,255,0.42);
	}

	.upload-error {
		margin-top: 14rpx;
		font-size: 22rpx;
		color: rgba(255, 140, 140, 0.9);
		line-height: 1.4;
	}

	.content-input {
		@include fit-form-surface(26rpx, 28rpx);
		width: 100%;
		height: 240rpx;
		font-size: 30rpx;
		line-height: 1.5;
		color: #fff;
		margin-bottom: 0;
	}

	.media-upload {
		width: 100%;
		height: 220rpx;
		border-radius: 24rpx;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.04);
		border: 1px dashed rgba(114, 228, 200, 0.22);
		@include fit-press-feedback(0.985, 0);
	}

	.upload-state {
		width: 100%;
		padding-left: 20rpx;
		padding-right: 20rpx;
	}

	.preview-img {
		width: 100%;
		height: 100%;
	}

	.options-list {
		display: flex;
		flex-direction: column;
		gap: 18rpx;
	}

	.option-item {
		@include fit-form-panel(24rpx, 24rpx);
		display: flex;
		align-items: center;
		gap: 20rpx;
		min-height: 104rpx;
		box-sizing: border-box;
	}

	.option-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6rpx;
		min-width: 0;
	}

	.option-label {
		font-size: 22rpx;
		color: rgba(255,255,255,0.5);
	}

	.picker-flex {
		flex: 1;
	}

	.picker-val {
		font-size: 28rpx;
		color: #fff;
	}

	.location-option {
		cursor: pointer;
	}

	.location-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4rpx;
		overflow: hidden;
	}

	.location-name {
		font-size: 28rpx;
		color: rgba(255,255,255,0.42);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		&.has-location {
			color: #fff;
		}
	}

	.location-address {
		font-size: 22rpx;
		color: rgba(255,255,255,0.4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.location-action {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.location-clear {
		color: rgba(114,228,200,0.72);
		font-size: 28rpx;
		padding: 8rpx 12rpx;
		@include fit-press-feedback(0.96, 0);
	}

	.placeholder, .placeholder-sm {
		color: rgba(255,255,255,0.3);
	}

	.sheet-footer {
		padding: 20rpx 32rpx;
		border-top: 1px solid rgba(255,255,255,0.06);
		position: relative;
		z-index: 1;
	}

	.submit-btn {
		@include fit-pill-button('primary', 88rpx, 26rpx);
		color: #08131D;
		font-size: 30rpx;
		font-weight: 700;

		&[disabled] {
			opacity: 0.4;
			background: rgba(255,255,255,0.08);
			color: rgba(255,255,255,0.3);
			border-color: transparent;
			box-shadow: none;
		}
	}
</style>
