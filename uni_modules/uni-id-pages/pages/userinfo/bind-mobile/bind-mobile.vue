<!-- 绑定手机号码页 -->
<template>
	<view class="bind-mobile-page">
		<view class="bind-mobile-shell">
			<view class="bind-header">
				<text class="bind-title">{{ $t('login.page.bindMobile.title') }}</text>
				<text class="bind-desc">{{ $t('login.page.bindMobile.tip') }}</text>
			</view>

			<view class="form-section">
				<uni-easyinput clearable :focus="focusMobile" @blur="focusMobile = false"
					type="number" class="dark-input" :inputBorder="false"
					v-model="formData.mobile" maxlength="11"
					:placeholder="$t('login.page.bindMobile.mobilePlaceholder')"></uni-easyinput>
				<uni-id-pages-sms-form ref="smsForm" type="bind-mobile-by-sms"
					v-model="formData.code" :phone="formData.mobile">
				</uni-id-pages-sms-form>
				<button class="btn-submit" @click="submit" :loading="submitting">{{ $t('login.page.bindMobile.button') }}</button>
			</view>

			<uni-popup-captcha @confirm="submit" v-model="formData.captcha"
				scene="bind-mobile-by-sms" ref="popup">
			</uni-popup-captcha>
		</view>
	</view>
</template>
<script>
	import {
		mutations
	} from '@/uni_modules/uni-id-pages/common/store.js'
	import {showAuthFailure, showAuthToast} from '@/uni_modules/uni-id-pages/common/auth-ui.js'
	export default {
		data() {
			return {
				formData: {
					mobile: "",
					code: "",
					captcha: ""
				},
				focusMobile: true,
				submitting: false
			}
		},
		onLoad(event) {},
		onReady() {},

		methods: {
			onBindSuccess(mobile) {
				// 同步手机号到 store
				mutations.setUserInfo({ mobile, mobile_confirmed: 1 });
				showAuthToast('bindMobile.success');
				uni.navigateBack();
			},

			submit() {
				if (!/^1\d{10}$/.test(this.formData.mobile)) {
					this.focusMobile = true;
					return uni.showToast({
						title: this.$t('login.page.bindMobile.phoneInvalid'),
						icon: 'none',
						duration: 3000
					});
				}
				if (!/^\d{6}$/.test(this.formData.code)) {
					this.$refs.smsForm.focusSmsCodeInput = true;
					return uni.showToast({
						title: this.$t('login.page.bindMobile.codeInvalid'),
						icon: 'none',
						duration: 3000
					});
				}
				if (this.submitting) return;
				this.submitting = true;
				uni.showLoading({ title: this.$t('login.page.bindMobile.loading'), mask: true });

				const uniIdCo = uniCloud.importObject("uni-id-co", { customUI: true });
				uniIdCo.bindMobileBySms(this.formData)
					.then(e => {
						uni.hideLoading();
						this.onBindSuccess(this.formData.mobile);
					})
					.catch(e => {
						uni.hideLoading();
						console.error('短信绑定手机号失败:', e);
						if (e.errCode == 'uni-id-captcha-required') {
							this.$refs.popup.open();
						} else {
							const errMsg = (e && (e.message || e.errMsg)) || this.$t('login.page.bindMobile.failed');
							showAuthFailure(errMsg);
						}
					})
					.finally(() => {
						this.submitting = false;
						this.formData.captcha = "";
					});
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni.scss";

	.bind-mobile-page {
		min-height: 100vh;
		background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 60rpx 40rpx 40rpx;
	}

	.bind-mobile-shell {
		width: 100%;
		max-width: 680rpx;
	}

	.bind-header {
		margin-bottom: 60rpx;
	}

	.bind-title {
		display: block;
		font-size: 48rpx;
		font-weight: 700;
		color: #ffffff;
		margin-bottom: 16rpx;
	}

	.bind-desc {
		display: block;
		font-size: 28rpx;
		color: rgba(255, 255, 255, 0.6);
	}

	/* 表单区 */
	.form-section {
		width: 100%;
	}

	.dark-input {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 16rpx;
		margin-bottom: 24rpx;
		padding: 0 24rpx;
	}

	/* 提交按钮 */
	.btn-submit {
		width: 100%;
		height: 96rpx;
		background: linear-gradient(135deg, #72E4C8 0%, #59d0b0 100%);
		border-radius: 48rpx;
		color: #1a1a2e;
		font-size: 32rpx;
		font-weight: 600;
		margin-top: 40rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
	}

	.btn-submit::after {
		border: none;
	}
</style>
