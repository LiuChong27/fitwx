<!-- 账号密码登录页 - FIT 深色主题 -->
<template>
	<view class="login-page">
		<view class="login-shell">
			<view class="brand-section" role="banner">
				<text class="brand-kicker">{{ $t('login.page.brandKicker') }}</text>
				<image class="brand-logo" src="/static/logo.png" mode="aspectFit" aria-hidden="true"></image>
				<text class="brand-name">FIT</text>
				<text class="brand-slogan">{{ $t('login.page.brandSlogan') }}</text>
				<text class="page-title">{{ $t('login.page.pwd.title') }}</text>
				<text class="page-tip">{{ $t('login.page.pwd.tip') }}</text>
			</view>

			<view class="form-card">
		<uni-forms class="dark-form">
			<uni-forms-item name="username">
				<view class="dark-input-box">
					<uni-easyinput :focus="focusUsername" @blur="focusUsername = false"
						class="dark-input" :inputBorder="false" v-model="username"
						:placeholder="$t('login.page.pwd.usernamePlaceholder')" trim="all"
						:styles="{ backgroundColor: '#132136', color: '#e6edf3', borderColor: 'transparent' }" />
				</view>
			</uni-forms-item>
			<uni-forms-item name="password">
				<view class="dark-input-box">
					<uni-easyinput :focus="focusPassword" @blur="focusPassword = false"
						class="dark-input" clearable type="password"
						:inputBorder="false" v-model="password"
						:placeholder="$t('login.page.pwd.passwordPlaceholder')" trim="all"
						:styles="{ backgroundColor: '#132136', color: '#e6edf3', borderColor: 'transparent' }" />
				</view>
			</uni-forms-item>
		</uni-forms>

		<uni-captcha v-if="needCaptcha" focus ref="captcha" scene="login-by-pwd" v-model="captcha" />

		<!-- 带选择框的隐私政策协议组件 -->
		<view class="agreements-wrap">
			<uni-id-pages-agreements scope="login" ref="agreements"></uni-id-pages-agreements>
		</view>

		<button class="btn-primary" @click="pwdLogin">{{ $t('login.page.pwd.button') }}</button>

		<!-- 忘记密码 & 注册 -->
		<view class="link-box">
			<view v-if="!config.isAdmin" class="link-left">
				<text class="forget-text">{{ $t('login.page.pwd.forgetHint') }}</text>
				<text class="link-text" @click="toRetrievePwd">{{ $t('login.page.pwd.retrieve') }}</text>
			</view>
			<text class="link-text" @click="toRegister">{{ config.isAdmin ? $t('login.page.pwd.adminRegister') : $t('login.page.pwd.register') }}</text>
		</view>
			</view>
		</view>

		<!-- 悬浮登录方式组件 -->
		<uni-id-pages-fab-login ref="uniFabLogin"></uni-id-pages-fab-login>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	const uniIdCo = uniCloud.importObject("uni-id-co", {
		customUI: true
	})
	export default {
		mixins: [mixin],
		data() {
			return {
				"password": "",
				"username": "",
				"captcha": "",
				"needCaptcha": false,
				"focusUsername": false,
				"focusPassword": false,
				"logo": "/static/logo.png"
			}
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				const e = event || window.event;
				if (e && e.keyCode === 13) {
					this.pwdLogin()
				}
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
			toRetrievePwd() {
				let url = '/uni_modules/uni-id-pages/pages/retrieve/retrieve'
				if (/^1\d{10}$/.test(this.username)) {
					url += `?phoneNumber=${this.username}`
				}
				uni.navigateTo({ url })
			},
			pwdLogin() {
				if (!this.password.length) {
					this.focusPassword = true
					return uni.showToast({ title: this.$t('login.page.pwd.passwordRequired'), icon: 'none', duration: 3000 });
				}
				if (!this.username.length) {
					this.focusUsername = true
					return uni.showToast({ title: this.$t('login.page.pwd.accountRequired'), icon: 'none', duration: 3000 });
				}
				if (this.needCaptcha && this.captcha.length !== 4) {
					this.$refs.captcha.getImageCaptcha()
					return uni.showToast({ title: this.$t('login.page.pwd.captchaRequired'), icon: 'none', duration: 3000 });
				}
				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(this.pwdLogin)
				}

				const data = { "password": this.password, "captcha": this.captcha }
				if (/^1\d{10}$/.test(this.username)) {
					data.mobile = this.username
				} else if (/@/.test(this.username)) {
					data.email = this.username
				} else {
					data.username = this.username
				}

				uniIdCo.login(data).then(e => {
					this.loginSuccess({ ...(e || {}), autoBack: false })
				}).catch(e => {
					const errMsg = (e && (e.message || e.errMsg)) || '';
					if (errMsg.includes('resource exhausted') || errMsg.includes('资源耗尽')) {
						uni.showModal({
							title: this.$t('login.page.busyTitle'),
							content: this.$t('login.page.busyContent'),
							showCancel: false
						});
					} else if (e.errCode === 'uni-id-captcha-required') {
						this.needCaptcha = true
					} else if (this.needCaptcha) {
						this.$refs.captcha.getImageCaptcha()
						this.showLoginFailure(errMsg)
					} else {
						this.showLoginFailure(errMsg)
					}
				})
			},
			toRegister() {
				uni.navigateTo({
					url: this.config.isAdmin ? '/uni_modules/uni-id-pages/pages/register/register-admin' :
						'/uni_modules/uni-id-pages/pages/register/register',
					fail(e) { console.error(e); }
				})
			}
		}
	}
</script>

<style lang="scss" scoped>
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
		color: rgba(255, 255, 255, 0.7);
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
		margin-bottom: 14rpx;
		text-align: center;
		/* #ifndef APP-NVUE */
		display: block;
		/* #endif */
	}

	.page-tip {
		font-size: 24rpx;
		line-height: 1.6;
		color: $text-secondary;
		margin-bottom: 8rpx;
		text-align: center;
		display: block;
	}

	.dark-form {
		margin-bottom: 10rpx;
	}

	.dark-input-box {
		@include fit-input-surface(96rpx, 22rpx);
		/* #ifndef APP-NVUE */
		display: flex;
		box-sizing: border-box;
		/* #endif */
		align-items: center;
		padding: 0 24rpx;
		margin-bottom: 10rpx;
		transition: border-color 0.2s;
	}

	.dark-input { flex: 1; }

	/* #ifndef APP-NVUE */
	.dark-input ::v-deep .uni-easyinput__content {
		background-color: transparent !important;
		border-color: transparent !important;
	}
	.dark-input ::v-deep .uni-easyinput__content-input {
		color: #e6edf3 !important;
	}
	.dark-input ::v-deep .uni-easyinput__placeholder-class {
		color: rgba(255,255,255,0.35) !important;
	}
	.dark-input ::v-deep .is-input-border {
		border-color: transparent !important;
	}
	/* #endif */

	.agreements-wrap {
		margin-bottom: 10rpx;
	}

	/* #ifndef APP-NVUE */
	.agreements-wrap ::v-deep .agreements-box {
		color: $text-muted !important;
	}
	.agreements-wrap ::v-deep .agreements-box .link {
		color: $accent-cyan !important;
	}
	/* #endif */

	.btn-primary {
		width: 100%;
		@include fit-pill-button('primary', 88rpx, 26rpx);
		font-size: 32rpx;
		font-weight: 600;
		color: #08131D;
		margin-top: 10rpx;
	}

	.link-box {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		justify-content: space-between;
		margin-top: 30rpx;
	}

	.link-left {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		align-items: center;
	}

	.forget-text {
		font-size: 24rpx;
		color: $text-muted;
		margin-right: 6rpx;
	}

	.link-text {
		font-size: 24rpx;
		color: $accent-cyan;
		cursor: pointer;
	}
</style>
