<!-- 账号密码登录页 - FIT 深色主题 -->
<template>
	<view class="login-page">
		<!-- 品牌小标 -->
		<view class="mini-brand">
			<image class="mini-logo" src="/static/logo.png" mode="aspectFit"></image>
			<text class="mini-name">FIT</text>
		</view>

		<!-- 顶部文字 -->
		<text class="page-title">账号密码登录</text>

		<uni-forms class="dark-form">
			<uni-forms-item name="username">
				<view class="dark-input-box">
					<uni-easyinput :focus="focusUsername" @blur="focusUsername = false"
						class="dark-input" :inputBorder="false" v-model="username"
						placeholder="请输入手机号/用户名/邮箱" trim="all"
						:styles="{ backgroundColor: '#132136', color: '#e6edf3', borderColor: 'transparent' }" />
				</view>
			</uni-forms-item>
			<uni-forms-item name="password">
				<view class="dark-input-box">
					<uni-easyinput :focus="focusPassword" @blur="focusPassword = false"
						class="dark-input" clearable type="password"
						:inputBorder="false" v-model="password"
						placeholder="请输入密码" trim="all"
						:styles="{ backgroundColor: '#132136', color: '#e6edf3', borderColor: 'transparent' }" />
				</view>
			</uni-forms-item>
		</uni-forms>

		<uni-captcha v-if="needCaptcha" focus ref="captcha" scene="login-by-pwd" v-model="captcha" />

		<!-- 带选择框的隐私政策协议组件 -->
		<view class="agreements-wrap">
			<uni-id-pages-agreements scope="login" ref="agreements"></uni-id-pages-agreements>
		</view>

		<button class="btn-primary" @click="pwdLogin">登 录</button>

		<!-- 忘记密码 & 注册 -->
		<view class="link-box">
			<view v-if="!config.isAdmin" class="link-left">
				<text class="forget-text">忘记了？</text>
				<text class="link-text" @click="toRetrievePwd">找回密码</text>
			</view>
			<text class="link-text" @click="toRegister">{{config.isAdmin ? '注册管理员账号' : '注册账号'}}</text>
		</view>

		<!-- 悬浮登录方式组件 -->
		<uni-id-pages-fab-login ref="uniFabLogin"></uni-id-pages-fab-login>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	const uniIdCo = uniCloud.importObject("uni-id-co", {
		errorOptions: {
			type: 'toast'
		}
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
				var e = event || window.event;
				if (e && e.keyCode == 13) {
					this.pwdLogin()
				}
			};
			// #endif
		},
		methods: {
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
					return uni.showToast({ title: '请输入密码', icon: 'none', duration: 3000 });
				}
				if (!this.username.length) {
					this.focusUsername = true
					return uni.showToast({ title: '请输入手机号/用户名/邮箱', icon: 'none', duration: 3000 });
				}
				if (this.needCaptcha && this.captcha.length != 4) {
					this.$refs.captcha.getImageCaptcha()
					return uni.showToast({ title: '请输入验证码', icon: 'none', duration: 3000 });
				}
				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(this.pwdLogin)
				}

				let data = { "password": this.password, "captcha": this.captcha }
				if (/^1\d{10}$/.test(this.username)) {
					data.mobile = this.username
				} else if (/@/.test(this.username)) {
					data.email = this.username
				} else {
					data.username = this.username
				}

				uniIdCo.login(data).then(e => {
					this.loginSuccess(e)
				}).catch(e => {
					const errMsg = (e && (e.message || e.errMsg)) || '';
					if (errMsg.includes('resource exhausted') || errMsg.includes('资源耗尽')) {
						uni.showModal({
							title: '服务繁忙',
							content: '数据库资源已达上限，请稍后再试或联系管理员升级云服务。',
							showCancel: false
						});
					} else if (e.errCode == 'uni-id-captcha-required') {
						this.needCaptcha = true
					} else if (this.needCaptcha) {
						this.$refs.captcha.getImageCaptcha()
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
		padding: 0 60rpx;
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		/* #endif */
	}

	.mini-brand {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		align-items: center;
		padding-top: 40rpx;
		margin-bottom: 60rpx;
	}

	.mini-logo {
		width: 60rpx;
		height: 60rpx;
		border-radius: 12rpx;
		margin-right: 16rpx;
	}

	.mini-name {
		font-size: 32rpx;
		font-weight: 700;
		color: $text-primary;
		letter-spacing: 4rpx;
	}

	.page-title {
		font-size: 44rpx;
		font-weight: 800;
		color: $text-primary;
		margin-bottom: 50rpx;
		/* #ifndef APP-NVUE */
		display: block;
		/* #endif */
	}

	.dark-form {
		margin-bottom: 10rpx;
	}

	.dark-input-box {
		height: 96rpx;
		background-color: $bg-card;
		border-radius: 16rpx;
		border: 2rpx solid $border-color;
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
		margin-top: 10rpx;
		box-shadow: 0 4rpx 20rpx rgba(0,229,255,0.3);

		&::after { border: none; }
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
