<template>
	<view class="login-page">
		<view class="login-shell">
			<view class="brand-section" role="banner">
				<text class="brand-kicker">FIT TRAINING</text>
				<image class="brand-logo" src="/static/logo.png" mode="aspectFit" aria-hidden="true"></image>
				<text class="brand-name">FIT</text>
				<text class="brand-slogan">{{ $t('login.page.entrySlogan') }}</text>
			</view>

			<view class="login-card">
				<view class="login-tabs" role="tablist" :aria-label="$t('login.page.tabsLabel')">
					<view class="login-tab" :class="{ active: activeTab === 'sms' }" role="tab" :aria-selected="activeTab === 'sms'" @click="switchTab('sms')">
						{{ $t('login.page.smsTab') }}
					</view>
					<view class="login-tab" :class="{ active: activeTab === 'pwd' }" role="tab" :aria-selected="activeTab === 'pwd'" @click="switchTab('pwd')">
						{{ $t('login.page.pwdTab') }}
					</view>
				</view>

				<view v-if="activeTab === 'sms'" class="tab-panel">
					<view class="input-box">
						<uni-easyinput
							v-model="smsPhone"
							trim="both"
							maxlength="11"
							type="number"
							:input-border="false"
							:placeholder="$t('login.page.withoutPwd.phonePlaceholder')"
						/>
					</view>
					<uni-id-pages-sms-form
						ref="smsForm"
						v-model="smsCode"
						type="login-by-sms"
						:phone="smsPhone"
						focus-captcha-input
					/>
					<view class="agreements-wrap">
						<uni-id-pages-agreements ref="agreements" scope="login"></uni-id-pages-agreements>
					</view>
					<button class="btn-primary" @click="submitSmsLogin">{{ $t('login.page.loginAction') }}</button>
				</view>

				<view v-else class="tab-panel">
					<view class="input-box">
						<uni-easyinput
							v-model="username"
							trim="both"
							:input-border="false"
							:placeholder="$t('login.page.pwd.usernamePlaceholder')"
						/>
					</view>
					<view class="input-box">
						<uni-easyinput
							v-model="password"
							trim="both"
							type="password"
							:input-border="false"
							:placeholder="$t('login.page.pwd.passwordPlaceholder')"
						/>
					</view>
					<uni-captcha v-if="needPwdCaptcha" ref="pwdCaptcha" scene="login-by-pwd" v-model="pwdCaptcha" />
					<view class="agreements-wrap">
						<uni-id-pages-agreements ref="agreements" scope="login"></uni-id-pages-agreements>
					</view>
					<button class="btn-primary" @click="submitPwdLogin">{{ $t('login.page.loginAction') }}</button>
					<view class="link-row">
						<text class="link-text" @click="openRetrieve">{{ $t('login.page.pwd.retrieve') }}</text>
						<text class="link-text" @click="openRegister">{{ $t('login.page.pwd.register') }}</text>
					</view>
				</view>

				<!-- #ifdef MP-WEIXIN -->
					<button class="btn-wx-login" :loading="wxLoginLoading" :disabled="wxLoginLoading" @click="doWeixinLogin">
						{{ $t('login.page.withoutPwd.weixinPrimary') }}
					</button>
				<!-- #endif -->
			</view>
		</view>

		<uni-popup-captcha ref="smsLoginCaptchaPopup" v-model="smsCaptcha" scene="login-by-sms" @confirm="submitSmsLogin"></uni-popup-captcha>
	</view>
</template>

<script>
import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
import { safeHideLoading } from '@/common/uiLoading.js';
import { getFreshWxCode, getWxCodeDebugInfo } from '@/common/wxSilentLogin.js';
import { useUserStore } from '@/store/user.js';

const uniIdCo = uniCloud.importObject('uni-id-co', {
	customUI: true,
});

export default {
	mixins: [mixin],
	data() {
		return {
			activeTab: 'sms',
			smsPhone: '',
			smsCode: '',
			smsCaptcha: '',
			username: '',
			password: '',
			pwdCaptcha: '',
			needPwdCaptcha: false,
			wxLoginLoading: false,
		};
	},
	onLoad(options = {}) {
		const tab = String(options.tab || '').toLowerCase();
		if (tab === 'pwd' || tab === 'password') {
			this.activeTab = 'pwd';
		}
		if (tab === 'sms') {
			this.activeTab = 'sms';
		}
		if (options.phoneNumber) {
			this.smsPhone = String(options.phoneNumber);
		}
	},
	onShow() {
		// #ifdef H5
		document.onkeydown = (event) => {
			const e = event || window.event;
			if (e && e.keyCode === 13) {
				if (this.activeTab === 'sms') {
					this.submitSmsLogin();
				} else {
					this.submitPwdLogin();
				}
			}
		};
		// #endif
	},
	methods: {
		switchTab(tab) {
			if (tab !== 'sms' && tab !== 'pwd') return;
			this.activeTab = tab;
		},
		ensureAgreement(callback) {
			if (this.needAgreements && !this.agree) {
				this.$refs.agreements && this.$refs.agreements.popup(callback);
				return false;
			}
			return true;
		},
		showLoginFailure(message) {
			uni.showModal({
				title: this.$t('login.page.loginFailedTitle'),
				content: message || this.$t('login.page.genericRetry'),
				showCancel: false,
			});
		},
		async submitSmsLogin() {
			if (!/^1\d{10}$/.test(this.smsPhone)) {
				uni.showToast({ title: this.$t('login.page.withoutPwd.invalidPhone'), icon: 'none' });
				return;
			}
			if (String(this.smsCode || '').length !== 6) {
				uni.showToast({ title: this.$t('login.page.sms.codeRequired'), icon: 'none' });
				return;
			}
			if (!this.ensureAgreement(this.submitSmsLogin)) return;
			try {
				const res = await uniIdCo.loginBySms({
					mobile: this.smsPhone,
					code: this.smsCode,
					captcha: this.smsCaptcha,
				});
				this.loginSuccess({ ...(res || {}), autoBack: false });
			} catch (error) {
				if (error && error.errCode === 'uni-id-captcha-required') {
					this.$refs.smsLoginCaptchaPopup && this.$refs.smsLoginCaptchaPopup.open();
					return;
				}
				this.showLoginFailure((error && (error.message || error.errMsg)) || this.$t('login.page.genericRetry'));
			} finally {
				this.smsCaptcha = '';
			}
		},
		buildPwdLoginPayload() {
			const payload = {
				password: this.password,
				captcha: this.pwdCaptcha,
			};
			if (/^1\d{10}$/.test(this.username)) {
				payload.mobile = this.username;
			} else if (/@/.test(this.username)) {
				payload.email = this.username;
			} else {
				payload.username = this.username;
			}
			return payload;
		},
		async submitPwdLogin() {
			if (!this.username) {
				uni.showToast({ title: this.$t('login.page.pwd.accountRequired'), icon: 'none' });
				return;
			}
			if (!this.password) {
				uni.showToast({ title: this.$t('login.page.pwd.passwordRequired'), icon: 'none' });
				return;
			}
			if (this.needPwdCaptcha && String(this.pwdCaptcha || '').length !== 4) {
				this.$refs.pwdCaptcha && this.$refs.pwdCaptcha.getImageCaptcha();
				uni.showToast({ title: this.$t('login.page.pwd.imageCaptchaRequired'), icon: 'none' });
				return;
			}
			if (!this.ensureAgreement(this.submitPwdLogin)) return;
			try {
				const res = await uniIdCo.login(this.buildPwdLoginPayload());
				this.loginSuccess({ ...(res || {}), autoBack: false });
			} catch (error) {
				if (error && error.errCode === 'uni-id-captcha-required') {
					this.needPwdCaptcha = true;
					this.$nextTick(() => {
						this.$refs.pwdCaptcha && this.$refs.pwdCaptcha.getImageCaptcha();
					});
					return;
				}
				if (this.needPwdCaptcha && this.$refs.pwdCaptcha) {
					this.$refs.pwdCaptcha.getImageCaptcha();
				}
				this.showLoginFailure((error && (error.message || error.errMsg)) || '密码登录失败');
			}
		},
		async doWeixinLogin() {
			if (!this.ensureAgreement(this.doWeixinLogin)) return;
			if (this.wxLoginLoading) return;
			this.wxLoginLoading = true;
			uni.showLoading({ title: this.$t('login.page.loading'), mask: true });
			try {
				const code = await getFreshWxCode({ force: true, retry: 3 });
				const wxCodeDebug = getWxCodeDebugInfo();
				console.warn('[login] wx code fetch completed', {
					codePresent: !!code,
					codeLength: code ? code.length : 0,
					...wxCodeDebug,
				});
				if (!code) throw new Error(this.$t('login.page.withoutPwd.missingWxCode'));
				const res = await uniIdCo.loginByWeixin({ code });
				this.loginSuccess({ ...(res || {}), autoBack: false });
				const userStore = useUserStore();
				userStore.syncFromLogin();
			} catch (error) {
				uni.showModal({
					title: this.$t('login.page.loginFailedTitle'),
					content: (error && (error.message || error.errMsg)) || this.$t('login.page.genericRetry'),
					showCancel: false,
				});
			} finally {
				await safeHideLoading();
				this.wxLoginLoading = false;
			}
		},
		openRegister() {
			uni.navigateTo({ url: '/uni_modules/uni-id-pages/pages/register/register' });
		},
		openRetrieve() {
			let url = '/uni_modules/uni-id-pages/pages/retrieve/retrieve';
			if (/^1\d{10}$/.test(this.username)) {
				url += `?phoneNumber=${this.username}`;
			}
			uni.navigateTo({ url });
		},
	},
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

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
	margin-bottom: 24rpx;
}

.brand-name {
	font-size: 56rpx;
	font-weight: 800;
	color: #ffffff;
	letter-spacing: 8rpx;
	margin-bottom: 14rpx;
}

.brand-slogan {
	font-size: 28rpx;
	color: rgba(255, 255, 255, 0.7);
	line-height: 1.6;
	text-align: center;
	padding: 0 24rpx;
}

.login-card {
	@include fit-surface-card(32rpx, 34rpx);
}

.login-tabs {
	display: flex;
	gap: 12rpx;
	margin-bottom: 24rpx;
	padding: 8rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.08);
}

.login-tab {
	flex: 1;
	height: 74rpx;
	line-height: 74rpx;
	border-radius: 999rpx;
	text-align: center;
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.62);
}

.login-tab.active {
	background: rgba(114, 228, 200, 0.18);
	color: #72e4c8;
	font-weight: 600;
}

.tab-panel {
	display: flex;
	flex-direction: column;
}

.input-box {
	@include fit-input-surface(96rpx, 22rpx);
	display: flex;
	align-items: center;
	padding: 0 24rpx;
	margin-bottom: 16rpx;
}

.input-box ::v-deep .uni-easyinput__content {
	background-color: transparent !important;
	border-color: transparent !important;
}

.input-box ::v-deep .uni-easyinput__content-input {
	color: #e6edf3 !important;
}

.input-box ::v-deep .uni-easyinput__placeholder-class {
	color: rgba(255, 255, 255, 0.35) !important;
}

.agreements-wrap {
	margin: 14rpx 0 8rpx;
}

	.btn-primary {
		width: 100%;
		@include fit-pill-button('primary', 88rpx, 26rpx);
		font-size: 32rpx;
		font-weight: 600;
		color: #08131d;
		margin-top: 8rpx;
	}

	.btn-wx-login {
		width: 100%;
		@include fit-pill-button('primary', 88rpx, 26rpx);
		font-size: 32rpx;
		font-weight: 600;
		color: #08131d;
		margin-top: 18rpx;
		background: linear-gradient(145deg, #07c160, #06ad56);
	}

.link-row {
	margin-top: 24rpx;
	display: flex;
	justify-content: space-between;
}

.link-text {
	font-size: 24rpx;
	color: #72e4c8;
}

.tab-panel ::v-deep .uni-easyinput__content {
	background-color: transparent !important;
	border-color: rgba(255, 255, 255, 0.08) !important;
}

.tab-panel ::v-deep .inner-text {
	color: rgba(255, 255, 255, 0.52) !important;
}

.tab-panel ::v-deep .inner-text-active {
	color: #72e4c8 !important;
}

.tab-panel ::v-deep .agreements-box {
	color: rgba(255, 255, 255, 0.45) !important;
}

.tab-panel ::v-deep .agreements-box .link {
	color: #72e4c8 !important;
}
</style>

