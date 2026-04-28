<!-- 短信验证码登录页 - FIT 深色主题 -->
<template>
	<view class="login-page">
		<view class="login-shell">
			<view class="brand-section" role="banner">
				<text class="brand-kicker">{{ $t('login.page.brandKicker') }}</text>
				<image class="brand-logo" src="/static/logo.png" mode="aspectFit" aria-hidden="true"></image>
				<text class="brand-name">FIT</text>
				<text class="brand-slogan">{{ $t('login.page.brandSlogan') }}</text>
				<text class="page-title">{{ $t('login.page.sms.title') }}</text>
				<text class="page-tip">{{ $t('login.page.sms.tip', { phone }) }}</text>
			</view>

			<view class="form-card">
		<uni-forms class="dark-form">
			<uni-id-pages-sms-form focusCaptchaInput v-model="code" type="login-by-sms" ref="smsCode" :phone="phone">
			</uni-id-pages-sms-form>
			<button class="btn-primary" @click="submit">{{ $t('login.page.sms.button') }}</button>
		</uni-forms>
			</view>
		</view>
		<uni-popup-captcha @confirm="submit" v-model="captcha" scene="login-by-sms" ref="popup"></uni-popup-captcha>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	export default {
		mixins: [mixin],
		data() {
			return {
				code: '',
				phone: '',
				captcha: '',
				logo: '/static/logo.png'
			}
		},
		onLoad({ phoneNumber }) {
			this.phone = phoneNumber;
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				const e = event || window.event;
				if (e && e.keyCode === 13) this.submit();
			};
			// #endif
		},
		methods: {
			showLoginFailure(message) {
				uni.showModal({
					title: this.$t('login.page.loginFailedTitle'),
					content: message || this.$t('login.page.genericRetry'),
					showCancel: false
				});
			},
			submit() {
				const uniIdCo = uniCloud.importObject('uni-id-co', {
					customUI: true
				});
				if (this.code.length !== 6) {
					this.$refs.smsCode.focusSmsCodeInput = true;
					return uni.showToast({
							title: this.$t('login.page.sms.codeRequired'),
						icon: 'none',
						duration: 3000
					});
				}
				uniIdCo.loginBySms({
					mobile: this.phone,
					code: this.code,
					captcha: this.captcha
				}).then(e => {
					this.loginSuccess({ ...(e || {}), autoBack: false });
				}).catch(e => {
					if (e.errCode === 'uni-id-captcha-required') {
						this.$refs.popup.open();
					} else {
							this.showLoginFailure((e && (e.message || e.errMsg)) || '');
					}
				}).finally(() => {
					this.captcha = '';
				});
			}
		}
	}
</script>

<style scoped lang="scss">
	@import "@/uni.scss";

	$bg-primary: #08131D;
	$bg-card: #10202D;
	$border-color: $glass-border;
	$text-primary: #e6edf3;
	$text-secondary: rgba(255,255,255,0.6);
	$text-muted: rgba(255,255,255,0.4);
	$accent-cyan: #72E4C8;

	.login-page {
		@include fit-page-shell(24rpx 24rpx 24rpx, 24rpx);
		padding-top: calc(16rpx + constant(safe-area-inset-top));
		padding-top: calc(16rpx + env(safe-area-inset-top));
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		/* #endif */
	}

	.login-shell {
		padding: 0;
	}

	.brand-kicker {
		font-size: 22rpx;
		letter-spacing: 4rpx;
		text-transform: uppercase;
		color: rgba(114, 228, 200, 0.78);
		margin-bottom: 20rpx;
	}

	.brand-section {
		@include fit-surface-card(36rpx, 36rpx);
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		/* #endif */
		align-items: center;
		padding-top: 48rpx;
		padding-bottom: 52rpx;
		margin-bottom: 24rpx;
	}

	.brand-logo {
		width: 144rpx;
		height: 144rpx;
		border-radius: 40rpx;
		margin-bottom: 28rpx;
		box-shadow: 0 10rpx 30rpx rgba(0,0,0,0.3), 0 0 30rpx rgba(114,228,200,0.12);
		border: 1px solid rgba(114,228,200,0.15);
		animation: logoEntrance 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
	}

	@keyframes logoEntrance {
		from { opacity: 0; transform: scale(0.8) translateY(20rpx); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.brand-name {
		font-size: 56rpx;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: 8rpx;
		margin-bottom: 14rpx;
		text-shadow: 0 2rpx 10rpx rgba(0,0,0,0.3);
		animation: logoEntrance 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
	}

	.brand-slogan {
		font-size: 28rpx;
		color: $text-secondary;
		line-height: 1.6;
		text-align: center;
		padding: 0 24rpx;
		font-weight: 400;
		margin-bottom: 28rpx;
		animation: logoEntrance 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both;
	}

	.form-card {
		@include fit-surface-card(32rpx, 34rpx);
	}

	.page-title {
		font-size: 44rpx;
		font-weight: 800;
		color: $text-primary;
		margin-bottom: 16rpx;
		text-align: center;
		/* #ifndef APP-NVUE */
		display: block;
		/* #endif */
	}

	.page-tip {
		font-size: 24rpx;
		line-height: 1.6;
		color: $text-secondary;
		margin-bottom: 0;
		text-align: center;
		/* #ifndef APP-NVUE */
		display: block;
		/* #endif */
	}

	.dark-form {
		margin-bottom: 20rpx;
	}

	.btn-primary {
		width: 100%;
		@include fit-pill-button('primary', 88rpx, 26rpx);
		font-size: 32rpx;
		font-weight: 600;
		color: #08131D;
		margin-top: 30rpx;
	}

	/* ====== 覆盖短信表单组件深色 ====== */
	/* #ifndef APP-NVUE */
	.dark-form ::v-deep .uni-easyinput__content {
		background-color: $bg-card !important;
		border-color: $border-color !important;
	}
	.dark-form ::v-deep .uni-easyinput__content-input {
		color: $text-primary !important;
	}
	.dark-form ::v-deep .uni-easyinput__placeholder-class {
		color: $text-muted !important;
	}
	.dark-form ::v-deep .is-input-border {
		border-color: $border-color !important;
	}
	/* #endif */

	.popup-captcha {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		padding: 20rpx;
		background-color: $bg-card;
		border-radius: 16rpx;
		flex-direction: column;
		position: relative;
	}

	.popup-captcha .title {
		font-weight: normal;
		padding: 0;
		padding-bottom: 15px;
		color: $text-secondary;
	}
</style>
