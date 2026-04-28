<template>
	<view class="login-page">
		<view class="login-shell">
			<view class="brand-section" role="banner">
				<text class="brand-kicker">{{ $t('login.page.brandKicker') }}</text>
				<image class="brand-logo" src="/static/logo.png" mode="aspectFit" aria-hidden="true"></image>
				<text class="brand-name">FIT</text>
				<text class="brand-slogan">{{ $t('login.page.brandSlogan') }}</text>
			</view>

			<view class="login-section">
				<!-- #ifdef MP-WEIXIN -->
				<view class="wx-login-block">
					<view style="position: relative; width: 100%;">
						<button
							class="btn-wx-login"
							@click="doWeixinLogin"
							:loading="wxLoginLoading"
							:disabled="wxLoginLoading"
						>
							<image
								class="btn-wx-icon"
								src="/uni_modules/uni-id-pages/static/login/uni-fab-login/weixin.png"
								mode="aspectFit"
							></image>
							<text class="btn-wx-text">{{ $t('login.page.withoutPwd.weixinPrimary') }}</text>
						</button>
						<view v-if="needAgreements && !agree" class="agreement-layer" @click="showAgreementModal"></view>
					</view>

					<view class="wx-auth-tip">
						<text class="wx-auth-tip-text">{{ $t('login.page.withoutPwd.weixinAuthTip') }}</text>
					</view>

					<view style="position: relative; width: 100%;">
						<button
							class="btn-wx-secondary"
							open-type="getPhoneNumber"
							@getphonenumber="doWeixinMobileLogin"
							:disabled="wxLoginLoading"
						>
							{{ $t('login.page.withoutPwd.weixinMobileButton') }}
						</button>
						<view v-if="needAgreements && !agree" class="agreement-layer" @click="showAgreementModal"></view>
					</view>
				</view>
				<!-- #endif -->

				<!-- #ifndef MP-WEIXIN -->
				<template v-if="isQuickLoginType">
					<text class="section-tip">{{ $t('login.page.withoutPwd.quickLoginTip') }}</text>
					<view class="quick-login-box">
						<image
							v-if="type !== 'weixinMobile' && type !== 'huaweiMobile'"
							@click="quickLogin"
							:src="imgSrc"
							mode="widthFix"
							class="quick-login-btn"
						></image>
						<view v-else style="position: relative">
							<button
								v-if="type === 'weixinMobile'"
								type="primary"
								open-type="getPhoneNumber"
								@getphonenumber="quickLogin"
								class="btn-primary"
							>
								{{ $t('login.page.withoutPwd.weixinMobileButton') }}
							</button>
							<!-- #ifdef APP-HARMONY -->
							<app-harmony-get-phone-number v-if="type === 'huaweiMobile'" @getphonenumber="quickLogin">
								<button class="quick-login-btn" style="padding: 0; display: flex">
									<image :src="imgSrc" mode="widthFix"></image>
								</button>
							</app-harmony-get-phone-number>
							<!-- #endif -->
							<!-- #ifdef MP-HARMONY -->
							<button
								v-if="type === 'huaweiMobile'"
								open-type="getPhoneNumber"
								@getphonenumber="quickLogin"
								class="quick-login-btn"
								style="padding: 0; display: flex"
							>
								<image :src="imgSrc" mode="widthFix"></image>
							</button>
							<!-- #endif -->
							<view v-if="needAgreements && !agree" class="agreement-layer" @click="showAgreementModal"></view>
						</view>
					</view>
				</template>

				<template v-else>
					<text class="section-tip">{{ $t('login.page.withoutPwd.smsEntryTip') }}</text>
					<view class="phone-input-box">
						<view class="area-code" @click="chooseArea">
							<text class="area-code-text">+86</text>
							<text class="area-arrow">▼</text>
						</view>
						<view class="phone-input-wrap">
							<uni-easyinput
								trim="both"
								:focus="focusPhone"
								@blur="focusPhone = false"
								class="dark-input"
								type="number"
								:inputBorder="false"
								v-model="phone"
								maxlength="11"
								:placeholder="$t('login.page.withoutPwd.phonePlaceholder')"
								:styles="{ backgroundColor: '#132136', color: '#e6edf3', disableColor: '#132136', borderColor: 'transparent' }"
							/>
						</view>
					</view>
					<button class="btn-primary" @click="toSmsPage">{{ $t('login.page.withoutPwd.smsEntryButton') }}</button>
				</template>
				<!-- #endif -->

				<view class="agreements-wrap">
					<uni-id-pages-agreements scope="register" ref="agreements"></uni-id-pages-agreements>
				</view>
			</view>
		</view>

		<!-- #ifndef MP-WEIXIN -->
		<uni-id-pages-fab-login ref="uniFabLogin"></uni-id-pages-fab-login>
		<!-- #endif -->
	</view>
</template>

<script>
let currentWebview;
import config from '@/uni_modules/uni-id-pages/config.js';
import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
import { safeHideLoading } from '@/common/uiLoading.js';
import { getFreshWxCode, getWxCodeDebugInfo } from '@/common/wxSilentLogin.js';

export default {
	mixins: [mixin],
	data() {
		return {
			type: '',
			phone: '',
			focusPhone: false,
			wxLoginLoading: false,
		};
	},
	computed: {
		isQuickLoginType() {
			return ['apple', 'weixin', 'weixinMobile', 'huawei', 'huaweiMobile'].includes(this.type);
		},
		isPhone() {
			return /^1\d{10}$/.test(this.phone);
		},
		imgSrc() {
			const images = {
				weixin: '/uni_modules/uni-id-pages/static/login/weixin.png',
				apple: '/uni_modules/uni-id-pages/static/app/apple.png',
				huawei: '/uni_modules/uni-id-pages/static/login/huawei.png',
				huaweiMobile: '/uni_modules/uni-id-pages/static/login/huawei-mobile.png',
			};
			return images[this.type];
		},
	},
	async onLoad(e) {
		if (e.is_weixin_redirect) {
			uni.showLoading({ mask: true });
			if (window && window.location.href.includes('#')) {
				const paramsArr = window.location.href.split('?')[1].split('&');
				paramsArr.forEach((item) => {
					const arr = item.split('=');
					if (arr[0] === 'code') e.code = arr[1];
				});
			}
			this.$nextTick(() => {
				this.$refs.uniFabLogin && this.$refs.uniFabLogin.login({ code: e.code }, 'weixin');
			});
		}

		// #ifndef MP-WEIXIN
		const type = e.type || config.loginTypes[0];
		this.type = type;
		if (type !== 'univerify') {
			this.focusPhone = true;
		}
		this.$nextTick(() => {
			if (['weixin', 'apple', 'huawei', 'huaweiMobile'].includes(type) && this.$refs.uniFabLogin) {
				this.$refs.uniFabLogin.servicesList = this.$refs.uniFabLogin.servicesList.filter((item) => item.id !== type);
			}
		});
		// #endif

		uni.$on('uni-id-pages-setLoginType', (t) => {
			this.type = t;
		});

		// #ifdef MP-WEIXIN
		if (getCurrentPages().length === 1) {
			uni.hideHomeButton();
		}
		// #endif
	},
	onShow() {
		// #ifdef H5
		document.onkeydown = (event) => {
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
					console.warn(err);
					if (config.loginTypes.length > 1) {
						this.$refs.uniFabLogin.login_before(config.loginTypes[1]);
					} else {
						uni.showModal({ content: err.message, showCancel: false });
					}
				},
			});
		}
		// #endif
	},
	methods: {
		setWxLoginLoading(loading) {
			this.wxLoginLoading = loading;
			if (!loading) safeHideLoading();
		},
		startWxLoginLoading(title = this.$t('login.page.loading')) {
			this.wxLoginLoading = true;
			uni.showLoading({ title, mask: true });
		},
		extractFailUrl(errMsg = '') {
			const raw = String(errMsg || '');
			const match = raw.match(/https?:\/\/[^\s"'\]]+/i);
			return match ? match[0] : '';
		},
		buildWhitelistDebugInfo(failUrl) {
			if (failUrl) {
				return this.$t('login.page.whitelistDebugPrefix', { url: failUrl });
			}
			return this.$t('login.page.whitelistDebugFallback');
		},
		tagLoginError(err, stage) {
			if (err && typeof err === 'object') {
				err.__fitLoginStage = stage;
			}
			return err;
		},
		getLoginStageHint(stage) {
			const hints = {
				wxCode: '微信登录凭证获取失败，请检查真机环境、服务空间和当前微信会话。',
				uniIdWeixinLogin: '已获取微信登录凭证，但 uni-id 的 loginByWeixin 调用失败。',
				uniIdWeixinMobileLogin: '已获取手机号授权码，但 uni-id 的 loginByWeixinMobile 调用失败。',
				postLoginUserSync: '登录成功，但登录后 uni-id-users 的 clientDB 同步失败，请检查 schema 同步与权限配置。',
			};
			return hints[stage] || '';
		},
		handleLoginError(err) {
			const errMsg = (err && (err.message || err.errMsg || err.errCode)) || this.$t('login.page.genericRetry');
			const errText = String(errMsg);
			const failUrl = this.extractFailUrl(errText);
			const stageHint = this.getLoginStageHint(err && err.__fitLoginStage);

			if (errText.includes('url not in domain list') || errText.includes('domain list') || errText.includes('白名单')) {
				const debugInfo = this.buildWhitelistDebugInfo(failUrl);
				uni.showModal({
					title: this.$t('login.page.loginFailedTitle'),
					content: this.$t('login.page.whitelistBlockedContent', { debugInfo }),
					showCancel: false,
				});
				return;
			}

			if (errText.includes('resource exhausted') || errText.includes('资源耗尽')) {
				uni.showModal({
					title: this.$t('login.page.busyTitle'),
					content: this.$t('login.page.busyContent'),
					showCancel: false,
				});
				return;
			}

			if (errText.includes('uni-id-get-third-party-account-failed')) {
				uni.showModal({
					title: this.$t('login.page.loginFailedTitle'),
					content: this.$t('login.page.withoutPwd.weixinPhoneAuthFailed'),
					showCancel: false,
				});
				return;
			}

			if (errText.includes('getPhoneNumber') || errText.includes('第三方账号')) {
				uni.showModal({
					title: this.$t('login.page.loginFailedTitle'),
					content: this.$t('login.page.weixinAuthorizeFailed'),
					showCancel: false,
				});
				return;
			}

			uni.showModal({
				title: this.$t('login.page.loginFailedTitle'),
				content: stageHint ? `${stageHint}\n${errText}` : errText,
				showCancel: false,
			});
		},
		showCurrentWebview() {
			currentWebview && currentWebview.setStyle({ top: 0 });
		},
		showAgreementModal() {
			this.$refs.agreements && this.$refs.agreements.popup();
		},
		doWeixinMobileLogin(e) {
			if (this.needAgreements && !this.agree) {
				return this.$refs.agreements.popup(() => this.doWeixinMobileLogin(e));
			}

			const detail = e && e.detail ? e.detail : {};
			if (detail.errMsg && detail.errMsg !== 'getPhoneNumber:ok') {
				if (detail.errMsg.includes('deny') || detail.errMsg.includes('cancel')) {
					uni.showToast({ title: this.$t('login.page.withoutPwd.cancelPhoneAuth'), icon: 'none' });
					return;
				}
				this.handleLoginError(detail);
				return;
			}

			if (!detail.code) {
				uni.showToast({ title: this.$t('login.page.withoutPwd.missingPhoneAuth'), icon: 'none' });
				return;
			}

			this.startWxLoginLoading();
			const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
			uniIdCo
				.loginByWeixinMobile({ phoneCode: detail.code })
				.then((res) => {
					console.warn('[login] loginByWeixinMobile succeeded, awaiting post-login user sync');
					this.loginSuccess({ ...(res || {}), autoBack: false });
				})
				.catch((err) => {
					console.error('[login] loginByWeixinMobile failed', err);
					this.handleLoginError(this.tagLoginError(err, 'uniIdWeixinMobileLogin'));
				})
				.finally(() => {
					this.setWxLoginLoading(false);
				});
		},
		async doWeixinLogin() {
			if (this.needAgreements && !this.agree) {
				return this.$refs.agreements.popup(() => this.doWeixinLogin());
			}
			if (this.wxLoginLoading) return;

			this.startWxLoginLoading();
			try {
				const code = await getFreshWxCode({ force: true, retry: 3 });
				const wxCodeDebug = getWxCodeDebugInfo();
				console.warn('[login] wx code fetch completed', {
					codePresent: !!code,
					codeLength: code ? code.length : 0,
					...wxCodeDebug,
				});
				if (!code) {
					const i18nMsg = this.$t('login.page.withoutPwd.missingWxCode');
					throw this.tagLoginError(
						new Error(i18nMsg && i18nMsg !== 'login.page.withoutPwd.missingWxCode' ? i18nMsg : '未获取到登录凭证，请稍后重试。'),
						'wxCode'
					);
				}

				const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
				let res;
				try {
					res = await uniIdCo.loginByWeixin({ code });
				} catch (err) {
					throw this.tagLoginError(err, 'uniIdWeixinLogin');
				}
				console.warn('[login] loginByWeixin succeeded, awaiting post-login user sync');
				this.loginSuccess({ ...(res || {}), autoBack: false });
			} catch (err) {
				console.error('[login] loginByWeixin failed', err);
				this.handleLoginError(err);
			} finally {
				this.setWxLoginLoading(false);
			}
		},
		switchToPhone() {
			uni.navigateTo({ url: '/pages/login/login-withoutpwd?type=smsCode' });
		},
		switchToAccount() {
			uni.navigateTo({ url: '/pages/login/login-withpwd' });
		},
		quickLogin(e) {
			const options = {};
			if (e.detail?.code) options.phoneNumberCode = e.detail.code;
			if ((this.type === 'weixinMobile' || this.type === 'huaweiMobile') && !e.detail?.code) return;
			this.$refs.uniFabLogin.login_before(this.type, true, options);
		},
		toSmsPage() {
			if (!this.isPhone) {
				this.focusPhone = true;
				return uni.showToast({
					title: this.$t('login.page.withoutPwd.invalidPhone'),
					icon: 'none',
					duration: 3000,
				});
			}
			if (this.needAgreements && !this.agree) {
				return this.$refs.agreements.popup(this.toSmsPage);
			}
			uni.navigateTo({
				url: '/pages/login/login-smscode?phoneNumber=' + this.phone,
			});
		},
		chooseArea() {
			uni.showToast({ title: this.$t('login.page.unsupportedCountry'), icon: 'none', duration: 3000 });
		},
	},
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

$text-primary: #ffffff;
$text-secondary: rgba(255, 255, 255, 0.7);
$text-muted: rgba(255, 255, 255, 0.4);
$accent-cyan: #72e4c8;

.login-page {
	@include fit-page-shell(24rpx 24rpx 24rpx, 24rpx);
	padding-top: calc(16rpx + constant(safe-area-inset-top));
	padding-top: calc(16rpx + env(safe-area-inset-top));
	display: flex;
	flex-direction: column;
}

.login-shell {
	padding: 0;
}

.brand-section {
	@include fit-surface-card(36rpx, 36rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
	padding-top: 48rpx;
	padding-bottom: 52rpx;
	margin-bottom: 24rpx;
}

.brand-kicker {
	font-size: 22rpx;
	letter-spacing: 4rpx;
	text-transform: uppercase;
	color: rgba(114, 228, 200, 0.78);
	margin-bottom: 20rpx;
}

.brand-logo {
	width: 144rpx;
	height: 144rpx;
	border-radius: 40rpx;
	margin-bottom: 28rpx;
}

.brand-name {
	font-size: 56rpx;
	font-weight: 800;
	color: $text-primary;
	letter-spacing: 8rpx;
	margin-bottom: 14rpx;
}

.brand-slogan {
	font-size: 28rpx;
	color: $text-secondary;
	line-height: 1.6;
	text-align: center;
	padding: 0 24rpx;
}

.login-section {
	@include fit-surface-card(36rpx, 36rpx);
}

.section-tip {
	font-size: 26rpx;
	color: $text-muted;
	margin-bottom: 32rpx;
	text-align: center;
	display: block;
}

.wx-login-block {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

.btn-wx-login {
	@include fit-pill-button('primary', 88rpx, 26rpx);
	display: flex;
	box-sizing: border-box;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	width: 100%;
	background: linear-gradient(145deg, #07c160, #06ad56);
	padding: 0 40rpx;
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
	margin-bottom: 28rpx;
}

.wx-auth-tip-text {
	font-size: 24rpx;
	color: $text-muted;
}

.btn-wx-secondary {
	width: 100%;
	height: 88rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.04);
	color: $text-secondary;
	font-size: 28rpx;
	font-weight: 500;
	border: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-wx-secondary::after {
	border: none;
}

.phone-input-box {
	@include fit-input-surface(110rpx, 24rpx);
	display: flex;
	box-sizing: border-box;
	flex-direction: row;
	align-items: center;
	margin-bottom: 40rpx;
	padding: 0 30rpx;
}

.area-code {
	display: flex;
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

.btn-primary {
	width: 100%;
	@include fit-pill-button('primary', 88rpx, 26rpx);
	font-size: 34rpx;
	font-weight: 600;
	color: #0a1628;
}

.quick-login-box {
	display: flex;
	flex-direction: column;
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

.agreements-wrap {
	margin-top: 44rpx;
	padding-bottom: 10rpx;
	display: flex;
	justify-content: center;
}

.agreement-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 10;
}

.dark-input {
	flex: 1;
	height: 100%;
}

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
	color: rgba(255, 255, 255, 0.35) !important;
	font-size: 30rpx !important;
}

.dark-input ::v-deep .is-input-border {
	border-color: transparent !important;
}

.agreements-wrap ::v-deep .agreements-box {
	color: $text-muted !important;
}

.agreements-wrap ::v-deep .agreements-box .link {
	color: $accent-cyan !important;
	text-decoration: underline;
}
</style>
