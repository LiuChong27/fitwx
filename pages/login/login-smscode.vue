<!-- 短信验证码登录页 - FIT 深色主题 -->
<template>
	<view class="login-page">
		<!-- 顶部文字 -->
		<text class="page-title">请输入验证码</text>
		<text class="page-tip">验证码已通过短信发送至 {{ phone }}</text>

		<uni-forms class="dark-form">
			<uni-id-pages-sms-form focusCaptchaInput v-model="code" type="login-by-sms" ref="smsCode" :phone="phone">
			</uni-id-pages-sms-form>
			<button class="btn-primary" @click="submit">登 录</button>
		</uni-forms>
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
			submit() {
				const uniIdCo = uniCloud.importObject('uni-id-co', {
					errorOptions: { type: 'toast' }
				});
				if (this.code.length !== 6) {
					this.$refs.smsCode.focusSmsCodeInput = true;
					return uni.showToast({
						title: '验证码不能为空',
						icon: 'none',
						duration: 3000
					});
				}
				uniIdCo.loginBySms({
					mobile: this.phone,
					code: this.code,
					captcha: this.captcha
				}).then(e => {
					this.loginSuccess(e);
				}).catch(e => {
					if (e.errCode === 'uni-id-captcha-required') {
						this.$refs.popup.open();
					} else {
						console.log(e.errMsg);
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

	$bg-primary: #0A1628;
	$bg-card: #132136;
	$border-color: $glass-border;
	$text-primary: #e6edf3;
	$text-secondary: rgba(255,255,255,0.6);
	$text-muted: rgba(255,255,255,0.4);
	$accent-cyan: #00E5FF;

	.login-page {
		min-height: 100vh;
		background-color: $bg-primary;
		padding: 40rpx 60rpx;
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		/* #endif */
	}

	.page-title {
		font-size: 44rpx;
		font-weight: 800;
		color: $text-primary;
		margin-bottom: 16rpx;
		/* #ifndef APP-NVUE */
		display: block;
		/* #endif */
	}

	.page-tip {
		font-size: 24rpx;
		color: $text-muted;
		margin-bottom: 40rpx;
		/* #ifndef APP-NVUE */
		display: block;
		/* #endif */
	}

	.dark-form {
		margin-bottom: 20rpx;
	}

	.btn-primary {
		/* #ifndef APP-NVUE */
		display: flex;
		box-sizing: border-box;
		/* #endif */
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 96rpx;
		border-radius: 48rpx;
		background: $sl-gradient-primary;
		border: none;
		font-size: 32rpx;
		font-weight: 600;
		color: #0A1628;
		margin-top: 30rpx;
		box-shadow: 0 4rpx 20rpx rgba(0,229,255,0.3);

		&::after { border: none; }
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
