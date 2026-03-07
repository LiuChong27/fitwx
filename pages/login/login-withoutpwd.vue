<!-- 免密登录页 - FIT 深色主题 -->
<template>
	<view class="login-page">
		<!-- 状态栏占位 -->
		<view :style="{ height: statusBarHeight + 'px' }"></view>

		<!-- 品牌区域 -->
		<view class="brand-section" role="banner">
			<image class="brand-logo" src="/static/logo.png" mode="aspectFit" aria-hidden="true"></image>
			<text class="brand-name">FIT</text>
			<text class="brand-slogan">遇见更好的自己</text>
		</view>

		<!-- 登录区域 -->
		<view class="login-section">
			<!-- ====== 微信小程序：微信一键登录为主 ====== -->
			<!-- #ifdef MP-WEIXIN -->
			<view class="wx-login-block">
				<view style="position: relative;">
					<button class="btn-wx-login" open-type="getPhoneNumber"
						@getphonenumber="onWxPhoneLogin">
						<image class="btn-wx-icon"
							src="/uni_modules/uni-id-pages/static/login/uni-fab-login/weixin.png"
							mode="aspectFit"></image>
						<text class="btn-wx-text">微信一键登录</text>
					</button>
					<view v-if="needAgreements && !agree"
						class="agreement-layer" @click="showAgreementModal"></view>
				</view>
				<view class="wx-auth-tip">
					<text class="wx-auth-tip-text">将获取你的微信头像、昵称及手机号</text>
				</view>
				<!-- 分割线 -->
				<view class="divider-row">
					<view class="divider-line"></view>
					<text class="divider-text">其他登录方式</text>
					<view class="divider-line"></view>
				</view>
				<!-- 微信授权登录（仅openid，不需手机号） -->
				<view class="alt-login-row">
					<view class="alt-login-item" role="button" aria-label="微信授权登录" @click="doWeixinLogin">
						<image class="alt-login-icon"
							src="/uni_modules/uni-id-pages/static/login/uni-fab-login/weixin.png"
							mode="aspectFit" aria-hidden="true"></image>
						<text class="alt-login-label">微信授权</text>
					</view>
					<view class="alt-login-item" role="button" aria-label="手机号登录"
						@click="switchToPhone">
						<image class="alt-login-icon"
							src="/uni_modules/uni-id-pages/static/login/uni-fab-login/sms.png"
							mode="aspectFit" aria-hidden="true"></image>
						<text class="alt-login-label">手机号</text>
					</view>
					<view class="alt-login-item" role="button" aria-label="账号密码登录"
						@click="switchToAccount">
						<image class="alt-login-icon"
							src="/uni_modules/uni-id-pages/static/login/uni-fab-login/user.png"
							mode="aspectFit" aria-hidden="true"></image>
						<text class="alt-login-label">账号密码</text>
					</view>
				</view>
			</view>
			<!-- #endif -->

			<!-- ====== 非微信小程序：快捷登录或手机号登录 ====== -->
			<!-- #ifndef MP-WEIXIN -->
			<!-- 快捷登录模式（URL 携带 type 参数时） -->
			<template v-if="isQuickLoginType">
				<text class="section-tip">将根据第三方账号服务平台的授权范围获取你的信息</text>
				<view class="quick-login-box">
					<image v-if="type !== 'weixinMobile' && type !== 'huaweiMobile'"
						@click="quickLogin" :src="imgSrc" mode="widthFix"
						class="quick-login-btn"></image>
					<view v-else style="position: relative">
						<button v-if="type === 'weixinMobile'" type="primary"
							open-type="getPhoneNumber" @getphonenumber="quickLogin"
							class="btn-primary">微信授权手机号登录</button>
						<!-- #ifdef APP-HARMONY -->
						<app-harmony-get-phone-number
							v-if="type === 'huaweiMobile'"
							@getphonenumber="quickLogin">
							<button class="quick-login-btn" style="padding: 0; display: flex">
								<image :src="imgSrc" mode="widthFix"></image>
							</button>
						</app-harmony-get-phone-number>
						<!-- #endif -->
						<!-- #ifdef MP-HARMONY -->
						<button v-if="type === 'huaweiMobile'" open-type="getPhoneNumber"
							@getphonenumber="quickLogin"
							class="quick-login-btn" style="padding: 0; display: flex">
							<image :src="imgSrc" mode="widthFix"></image>
						</button>
						<!-- #endif -->
						<view v-if="needAgreements && !agree"
							class="agreement-layer" @click="showAgreementModal"></view>
					</view>
				</view>
			</template>

			<!-- 手机号登录模式 -->
			<template v-else>
				<text class="section-tip">未注册的账号验证通过后将自动注册</text>
				<view class="phone-input-box">
					<view class="area-code" @click="chooseArea">
						<text class="area-code-text">+86</text>
						<text class="area-arrow">▾</text>
					</view>
					<view class="phone-input-wrap">
						<uni-easyinput trim="both" :focus="focusPhone"
							@blur="focusPhone = false" class="dark-input" type="number"
							:inputBorder="false" v-model="phone" maxlength="11"
							placeholder="请输入手机号"
							:styles="{ backgroundColor: '#132136', color: '#e6edf3', disableColor: '#132136', borderColor: 'transparent' }" />
					</view>
				</view>
				<button class="btn-primary" @click="toSmsPage">获取验证码</button>
			</template>
			<!-- #endif -->

			<!-- 协议组件 -->
			<view class="agreements-wrap">
				<uni-id-pages-agreements scope="register" ref="agreements"></uni-id-pages-agreements>
			</view>
		</view>

		<!-- 底部快捷登录（非微信小程序端） -->
		<!-- #ifndef MP-WEIXIN -->
		<uni-id-pages-fab-login ref="uniFabLogin"></uni-id-pages-fab-login>
		<!-- #endif -->
	</view>
</template>

<script>
	let currentWebview;
	import config from '@/uni_modules/uni-id-pages/config.js'
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';

	export default {
		mixins: [mixin],
		data() {
			return {
				type: '',
				phone: '',
				focusPhone: false,
				statusBarHeight: 0,
				wxLoginLoading: false
			}
		},
		computed: {
			isQuickLoginType() {
				return ['apple', 'weixin', 'weixinMobile', 'huawei', 'huaweiMobile'].includes(this.type)
			},
			isPhone() {
				return /^1\d{10}$/.test(this.phone);
			},
			imgSrc() {
				const images = {
					weixin: '/uni_modules/uni-id-pages/static/login/weixin.png',
					apple: '/uni_modules/uni-id-pages/static/app/apple.png',
					huawei: '/uni_modules/uni-id-pages/static/login/huawei.png',
					huaweiMobile: '/uni_modules/uni-id-pages/static/login/huawei-mobile.png'
				}
				return images[this.type]
			}
		},
		async onLoad(e) {
			// 获取状态栏高度
			const sysInfo = uni.getSystemInfoSync();
			this.statusBarHeight = sysInfo.statusBarHeight || 0;

			if (e.is_weixin_redirect) {
				uni.showLoading({ mask: true });
				if (window && window.location.href.includes('#')) {
					const paramsArr = window.location.href.split('?')[1].split('&');
					paramsArr.forEach(item => {
						const arr = item.split('=');
						if (arr[0] === 'code') e.code = arr[1];
					});
				}
				this.$nextTick(() => {
					this.$refs.uniFabLogin && this.$refs.uniFabLogin.login({ code: e.code }, 'weixin');
				});
			}

			// #ifndef MP-WEIXIN
			let type = e.type || config.loginTypes[0];
			this.type = type;
			if (type !== 'univerify') {
				this.focusPhone = true;
			}
			this.$nextTick(() => {
				if (['weixin', 'apple', 'huawei', 'huaweiMobile'].includes(type) && this.$refs.uniFabLogin) {
					this.$refs.uniFabLogin.servicesList = this.$refs.uniFabLogin.servicesList.filter(
						item => item.id !== type
					);
				}
			});
			// #endif

			uni.$on('uni-id-pages-setLoginType', t => { this.type = t; });

			// #ifdef MP-WEIXIN
			if (getCurrentPages().length === 1) {
				uni.hideHomeButton();
			}
			// #endif
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				const e = event || window.event;
				if (e && e.keyCode === 13) this.toSmsPage();
			};
			// #endif
		},
		onUnload() {
			uni.$off('uni-id-pages-setLoginType');
		},
		onReady() {
			// #ifdef APP-PLUS
			if (config.loginTypes.includes('univerify') && this.type === 'univerify') {
				uni.preLogin({
					provider: 'univerify',
					success: () => {
						const pages = getCurrentPages();
						currentWebview = pages[pages.length - 1].$getAppWebview();
						currentWebview.setStyle({ top: '2000px' });
						this.$refs.uniFabLogin.login_before('univerify');
					},
					fail: (err) => {
						console.log(err);
						if (config.loginTypes.length > 1) {
							this.$refs.uniFabLogin.login_before(config.loginTypes[1]);
						} else {
							uni.showModal({ content: err.message, showCancel: false });
						}
					}
				});
			}
			// #endif
		},
		methods: {
			showCurrentWebview() {
				currentWebview && currentWebview.setStyle({ top: 0 });
			},
			showAgreementModal() {
				this.$refs.agreements && this.$refs.agreements.popup();
			},

			/* ========== 微信小程序专用方法 ========== */
			// 微信手机号一键登录
			onWxPhoneLogin(e) {
				if (!e.detail || !e.detail.code) {
					// 用户拒绝授权
					return;
				}
				if (this.wxLoginLoading) return;
				this.wxLoginLoading = true;

				if (this.needAgreements && !this.agree) {
					this.wxLoginLoading = false;
					return this.$refs.agreements.popup(() => this.onWxPhoneLogin(e));
				}

				const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
				uni.showLoading({ title: '登录中...', mask: true });

				uniIdCo.loginByWeixinMobile({ phoneCode: e.detail.code })
					.then(res => {
						uni.showToast({ title: '登录成功', icon: 'none', duration: 2000 });
						this.loginSuccess(res);
					})
					.catch(err => {
						console.error('微信手机号登录失败:', err);
						const errMsg = (err && (err.message || err.errMsg)) || '请稍后重试';
						if (errMsg.includes('resource exhausted') || errMsg.includes('资源耗尽')) {
							uni.showModal({
								title: '服务繁忙',
								content: '数据库资源已达上限，请稍后再试或联系管理员升级云服务。',
								showCancel: false
							});
						} else if (errMsg.includes('第三方账号') || errMsg.includes('获取')) {
							uni.showModal({
								title: '登录失败',
								content: '微信授权失败，请在真机上重试或使用其他登录方式。',
								showCancel: false
							});
						} else {
							uni.showModal({
								title: '登录失败',
								content: errMsg,
								showCancel: false
							});
						}
					})
					.finally(() => {
						this.wxLoginLoading = false;
						uni.hideLoading();
					});
			},

			// 微信授权登录（仅 openid）
			doWeixinLogin() {
				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(() => this.doWeixinLogin());
				}
				uni.showLoading({ title: '登录中...', mask: true });
				uni.login({
					provider: 'weixin',
					success: (loginRes) => {
						const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
						uniIdCo.loginByWeixin({ code: loginRes.code })
							.then(res => {
								uni.showToast({ title: '登录成功', icon: 'none', duration: 2000 });
								this.loginSuccess(res);
							})
							.catch(err => {
								console.error('微信登录失败:', err);
								const errMsg = (err && (err.message || err.errMsg)) || '请稍后重试';
								if (errMsg.includes('resource exhausted') || errMsg.includes('资源耗尽')) {
									uni.showModal({
										title: '服务繁忙',
										content: '数据库资源已达上限，请稍后再试或联系管理员升级云服务。',
										showCancel: false
									});
								} else {
									uni.showModal({
										title: '登录失败',
										content: errMsg,
										showCancel: false
									});
								}
							})
							.finally(() => uni.hideLoading());
					},
					fail: (err) => {
						uni.hideLoading();
						console.error('uni.login 失败:', err);
						uni.showToast({ title: '微信登录失败', icon: 'none' });
					}
				});
			},

			// 切换到手机号登录
			switchToPhone() {
				uni.navigateTo({
					url: '/pages/login/login-withoutpwd?type=smsCode'
				});
			},
			// 切换到账号密码登录
			switchToAccount() {
				uni.navigateTo({
					url: '/pages/login/login-withpwd'
				});
			},

			/* ========== 通用方法 ========== */
			quickLogin(e) {
				let options = {};
				if (e.detail?.code) {
					options.phoneNumberCode = e.detail.code;
				}
				if ((this.type === 'weixinMobile' || this.type === 'huaweiMobile') && !e.detail?.code) return;
				this.$refs.uniFabLogin.login_before(this.type, true, options);
			},
			toSmsPage() {
				if (!this.isPhone) {
					this.focusPhone = true;
					return uni.showToast({
						title: '手机号码格式不正确',
						icon: 'none',
						duration: 3000
					});
				}
				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(this.toSmsPage);
				}
				uni.navigateTo({
					url: '/pages/login/login-smscode?phoneNumber=' + this.phone
				});
			},
			chooseArea() {
				uni.showToast({ title: '暂不支持其他国家', icon: 'none', duration: 3000 });
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni.scss";

	/* ====== Local Variables for Login Page ====== */
	$text-primary: #ffffff;
	$text-secondary: rgba(255, 255, 255, 0.7);
	$text-muted: rgba(255, 255, 255, 0.4);
	$accent-cyan: #00E5FF;
	$wx-green: #07c160;

	.login-page {
		min-height: 100vh;
		background-color: $neu-dark-bg;
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		/* #endif */
		padding-bottom: constant(safe-area-inset-bottom);
		padding-bottom: env(safe-area-inset-bottom);
	}

	/* ====== 品牌区域 ====== */
	.brand-section {
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		/* #endif */
		align-items: center;
		padding-top: 140rpx;
		padding-bottom: 80rpx;
	}

	.brand-logo {
		width: 160rpx;
		height: 160rpx;
		border-radius: 40rpx;
		margin-bottom: 32rpx;
		box-shadow: 0 10rpx 30rpx rgba(0,0,0,0.3), 0 0 40rpx rgba(0,229,255,0.1);
		border: 1px solid rgba(0,229,255,0.15);
		animation: logoEntrance 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
	}
	@keyframes logoEntrance {
		from { opacity: 0; transform: scale(0.8) translateY(20rpx); }
		to   { opacity: 1; transform: scale(1) translateY(0); }
	}

	.brand-name {
		font-size: 56rpx;
		font-weight: 800;
		color: $text-primary;
		letter-spacing: 8rpx;
		margin-bottom: 16rpx;
		text-shadow: 0 2rpx 10rpx rgba(0,0,0,0.3);
		animation: logoEntrance 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
	}

	.brand-slogan {
		font-size: 28rpx;
		color: $text-secondary;
		letter-spacing: 4rpx;
		font-weight: 300;
		animation: logoEntrance 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both;
	}

	/* ====== 登录区域 ====== */
	.login-section {
		padding: 0 64rpx;
		flex: 1;
		width: 100%;
		box-sizing: border-box;
		animation: sectionFadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both;
	}
	@keyframes sectionFadeUp {
		from { opacity: 0; transform: translateY(30rpx); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.section-tip {
		font-size: 26rpx;
		color: $text-muted;
		margin-bottom: 40rpx;
		text-align: center;
		/* #ifndef APP-NVUE */
		display: block;
		/* #endif */
	}

	/* ====== 微信一键登录按钮 ====== */
	.wx-login-block {
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		/* #endif */
		align-items: center;
		width: 100%;
	}

	.btn-wx-login {
		/* #ifndef APP-NVUE */
		display: flex;
		box-sizing: border-box;
		/* #endif */
		flex-direction: row;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100rpx;
		border-radius: 50rpx;
		background: linear-gradient(145deg, #07c160, #06ad56);
		box-shadow: 0 4rpx 24rpx rgba(7,193,96,0.35);
		border: none;
		padding: 0 40rpx;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

		&::after { border: none; }
	}
	.btn-wx-login:active {
		transform: scale(0.97);
		box-shadow: 0 2rpx 12rpx rgba(7,193,96,0.2);
	}

	.btn-wx-icon {
		width: 48rpx;
		height: 48rpx;
		margin-right: 20rpx;
	}

	.btn-wx-text {
		font-size: 34rpx;
		font-weight: 600;
		color: #ffffff;
	}

	.wx-auth-tip {
		margin-top: 24rpx;
		margin-bottom: 60rpx;
	}

	.wx-auth-tip-text {
		font-size: 24rpx;
		color: $text-muted;
	}

	/* ====== 分割线 ====== */
	.divider-row {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		align-items: center;
		margin-bottom: 60rpx;
		width: 100%;
	}

	.divider-line {
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, $glass-border, transparent);
	}

	.divider-text {
		font-size: 24rpx;
		color: $text-muted;
		padding: 0 30rpx;
	}

	/* ====== 其他登录方式行 ====== */
	.alt-login-row {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		justify-content: center;
		gap: 60rpx;
	}

	.alt-login-item {
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		/* #endif */
		align-items: center;
		cursor: pointer;
	}

	.alt-login-icon {
		width: 90rpx;
		height: 90rpx;
		border-radius: 50%;
		border: 1px solid rgba(0,229,255,0.12);
		margin-bottom: 16rpx;
		@include neu-btn;
		padding: 20rpx;
		/* #ifndef APP-NVUE */
		box-sizing: border-box;
		/* #endif */
		transition: transform 0.2s ease, border-color 0.2s ease;
	}
	.alt-login-item:active .alt-login-icon {
		transform: scale(0.9);
		border-color: rgba(0,229,255,0.3);
	}

	.alt-login-label {
		font-size: 24rpx;
		color: $text-secondary;
	}

	/* ====== 手机号输入区 ====== */
	.phone-input-box {
		/* #ifndef APP-NVUE */
		display: flex;
		box-sizing: border-box;
		/* #endif */
		flex-direction: row;
		align-items: center;
		height: 110rpx;
		@include neu-pressed;
		border-radius: 20rpx;
		border: 1px solid transparent;
		margin-bottom: 40rpx;
		padding: 0 30rpx;
		transition: border-color 0.3s ease, box-shadow 0.3s ease;
	}

	.area-code {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		align-items: center;
		padding-right: 24rpx;
		border-right: 1px solid $glass-border;
		margin-right: 24rpx;
		height: 60%;
	}

	.area-code-text {
		font-size: 32rpx;
		color: $text-primary;
		font-weight: 500;
	}

	.area-arrow {
		font-size: 24rpx;
		color: $text-muted;
		margin-left: 8rpx;
	}

	.phone-input-wrap {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: center;
	}

	/* ====== 通用按钮 ====== */
	.btn-primary {
		/* #ifndef APP-NVUE */
		display: flex;
		box-sizing: border-box;
		/* #endif */
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100rpx;
		border-radius: 50rpx;
		@include sl-btn-primary;
		border: none;
		font-size: 34rpx;
		font-weight: 600;
		color: #0A1628;
		transition: transform 0.1s;

		&::after { border: none; }
	}
	.btn-primary:active {
		transform: scale(0.98);
	}

	/* ====== 快捷登录 ====== */
	.quick-login-box {
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		/* #endif */
		align-items: center;
		justify-content: center;
		padding: 60rpx 0;
	}

	.quick-login-btn {
		width: 400rpx;
		background-color: transparent;
		border: none;
		box-shadow: none;
		height: 82rpx;
	}

	/* ====== 协议 ====== */
	.agreements-wrap {
		margin-top: 60rpx;
		padding-bottom: 40rpx;
		display: flex;
		justify-content: center;
	}

	/* 阻挡层（未勾选协议时覆盖按钮） */
	.agreement-layer {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 10;
	}

	/* ====== 深色覆盖 uni-easyinput ====== */
	.dark-input {
		flex: 1;
		height: 100%;
	}
	/* #ifndef APP-NVUE */
	.dark-input ::v-deep .uni-easyinput__content {
		background-color: transparent !important;
		border-color: transparent !important;
		min-height: auto !important;
		height: 100% !important;
	}
	.dark-input ::v-deep .uni-easyinput__content-input {
		color: #ffffff !important;
		font-size: 32rpx !important;
		height: 100% !important;
	}
	.dark-input ::v-deep .uni-easyinput__placeholder-class {
		color: rgba(255,255,255,0.35) !important;
		font-size: 30rpx !important;
	}
	.dark-input ::v-deep .is-input-border {
		border-color: transparent !important;
	}
	/* #endif */

	/* ====== 覆盖协议组件样式 ====== */
	/* #ifndef APP-NVUE */
	.agreements-wrap ::v-deep .agreements-box {
		color: $text-muted !important;
	}
	.agreements-wrap ::v-deep .agreements-box .link {
		color: $accent-cyan !important;
		text-decoration: underline;
	}
	/* #endif */
</style>
