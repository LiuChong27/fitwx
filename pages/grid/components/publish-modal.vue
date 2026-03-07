<template>
	<uni-popup ref="popup" type="bottom" @change="onChange">
		<view class="publish-sheet">
			<view class="sheet-header">
				<text class="sheet-title">记录训练时刻</text>
				<view class="close-btn" @click="close">
					<uni-icons type="closeempty" size="24" color="#fff" />
				</view>
			</view>
			
			<view class="sheet-body">
				<textarea
					class="content-input"
					v-model="form.content"
					placeholder="这一刻的想法... #今日训练"
					placeholder-class="placeholder"
					:maxlength="500"
					:adjust-position="true"
				/>
				
				<view class="media-upload" @click="chooseImage">
					<image v-if="form.photo" :src="form.photo" mode="aspectFill" class="preview-img" />
					<view class="upload-btn" v-else>
						<uni-icons type="camera-filled" size="32" color="#666" />
						<text class="upload-text">添加照片</text>
					</view>
				</view>
				
				<view class="options-list">
					<view class="option-item">
						<uni-icons type="paperplane" size="20" color="#888" />
						<picker class="picker-flex" mode="selector" :range="types" range-key="label" @change="onTypeChange">
							<view class="picker-val">{{ currentTypeLabel }}</view>
						</picker>
						<uni-icons type="right" size="14" color="#444" />
					</view>
					
					<view class="option-item location-option" @click="chooseLocation">
						<uni-icons type="location" size="20" :color="form.location ? '#FF5F6D' : '#888'" />
						<view class="location-content">
							<text :class="['location-name', { 'has-location': form.location }]">{{ form.location || '添加位置...' }}</text>
							<text class="location-address" v-if="form.address">{{ form.address }}</text>
						</view>
						<view class="location-action">
							<text v-if="form.location" class="location-clear" @click.stop="clearLocation">✕</text>
							<uni-icons v-else type="right" size="14" color="#444" />
						</view>
					</view>
				</view>
			</view>
			
			<view class="sheet-footer">
				<button class="submit-btn" :loading="loading" :disabled="loading || !form.content" @click="submit">
					{{ loading ? '发布中' : '发布动态' }}
				</button>
			</view>
		</view>
	</uni-popup>
</template>

<script>
	export default {
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
				loading: false
			}
		},
		computed: {
			currentTypeLabel() {
				const found = this.types.find(t => t.value === this.form.type);
				return found ? found.label : '选择分类';
			}
		},
		methods: {
			open(initialForm = null) {
				this.reset();
				if (initialForm && typeof initialForm === 'object') {
					this.form = { ...this.form, ...initialForm };
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
			},
			onTypeChange(e) {
				const index = e.detail.value;
				if (this.types[index]) {
					this.form.type = this.types[index].value;
				}
			},
			chooseImage() {
				uni.chooseImage({
					count: 1,
					success: (res) => {
						if (res.tempFilePaths.length > 0) {
							// In a real app, upload here
							this.form.photo = res.tempFilePaths[0]; // Local preview
						}
					}
				});
			},
			chooseLocation() {
				uni.chooseLocation({
					success: (res) => {
						console.log('[publish-modal] Choose location success:', res);
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
				// 直接传递给父组件处理，去掉原来的 setTimeout 模拟
				this.$emit('submit', { ...this.form });
			},
			// 父组件处理完后调用此方法结束 loading 和关闭弹窗
			submitDone() {
				this.loading = false;
				this.close();
			},
			submitFail() {
				this.loading = false;
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni.scss";

	.publish-sheet {
		background: $sl-surface;
		border-radius: 24rpx 24rpx 0 0;
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		padding-bottom: env(safe-area-inset-bottom);
		border-top: 1px solid rgba(0, 229, 255, 0.15);
	}
	
	.sheet-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 32rpx;
		border-bottom: 1px solid $glass-border;
	}
	
	.sheet-title {
		font-size: 34rpx;
		font-weight: 700;
		color: #fff;
	}
	
	.close-btn {
		padding: 8rpx;
	}
	
	.sheet-body {
		padding: 32rpx;
		flex: 1;
		overflow-y: auto;
	}
	
	.content-input {
		width: 100%;
		height: 240rpx;
		font-size: 30rpx;
		line-height: 1.5;
		color: #fff;
		margin-bottom: 32rpx;
	}
	
	.media-upload {
		width: 180rpx;
		height: 180rpx;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 16rpx;
		overflow: hidden;
		margin-bottom: 40rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed rgba(0, 229, 255, 0.2);
	}
	
	.preview-img {
		width: 100%;
		height: 100%;
	}
	
	.upload-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8rpx;
	}
	
	.upload-text {
		font-size: 22rpx;
		color: rgba(255,255,255,0.4);
	}
	
	.options-list {
		border-top: 1px solid $glass-border;
	}
	
	.option-item {
		display: flex;
		align-items: center;
		padding: 24rpx 0;
		border-bottom: 1px solid $glass-border;
		gap: 20rpx;
		
		&:last-child {
			border-bottom: none;
		}
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
		color: rgba(255,255,255,0.35);
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
		color: rgba(255,255,255,0.4);
		font-size: 28rpx;
		padding: 8rpx 12rpx;
	}
	
	.placeholder, .placeholder-sm {
		color: rgba(255,255,255,0.3);
	}
	
	.sheet-footer {
		padding: 20rpx 32rpx;
		border-top: 1px solid $glass-border;
	}
	
	.submit-btn {
		background: $sl-gradient-primary;
		color: #0A1628;
		border-radius: 100rpx;
		font-size: 30rpx;
		font-weight: 700;
		height: 88rpx;
		line-height: 88rpx;
		border: none;
		box-shadow: 0 6rpx 24rpx rgba(0, 229, 255, 0.3);
		
		&::after { border: none; }
		
		&[disabled] {
			opacity: 0.4;
			background: rgba(255,255,255,0.08);
			color: rgba(255,255,255,0.3);
			box-shadow: none;
		}
	}
</style>