<template>
	<view class="content">
		<!-- Feature List -->
		<uni-list class="mt10" :border="false">
			<uni-list-item :title="$t('settings.userInfo')" to="/uni_modules/uni-id-pages/pages/userinfo/userinfo" link="navigateTo"></uni-list-item>
			<uni-list-item v-if="userInfo.mobile" :title="$t('settings.changePassword')" :to="'/pages/ucenter/login-page/pwd-retrieve/pwd-retrieve?phoneNumber='+ userInfo.mobile" link="navigateTo"></uni-list-item>
		</uni-list>
		<uni-list class="mt10" :border="false">
		<!-- #ifndef H5 -->
			<!-- #ifdef APP-PLUS -->
			<!-- Hide push settings until push flow is ready -->
			<uni-list-item :title="$t('settings.clearTmp')" @click="clearTmp" link></uni-list-item>
			<uni-list-item v-show="pushIsOn !== 'wait'" :title="$t('settings.pushServer')" @click="pushIsOn?pushServer.off():pushServer.on()"  showSwitch :switchChecked="pushIsOn"></uni-list-item>
			<!-- #endif -->
			<uni-list-item v-if="supportMode.includes('fingerPrint')" :title="$t('settings.fingerPrint')" @click="startSoterAuthentication('fingerPrint')" link></uni-list-item>
			<uni-list-item v-if="supportMode.includes('facial')" :title="$t('settings.facial')" @click="startSoterAuthentication('facial')" link></uni-list-item>
		<!-- #endif -->
			<uni-list-item v-if="i18nEnable" :title="$t('settings.changeLanguage')" @click="changeLanguage" :rightText="currentLanguage" link></uni-list-item>
		</uni-list>
		<uni-list class="mt10" :border="false" v-if="isAdmin">
			<uni-list-item title="管理员面板" to="/pages/admin/index" link="navigateTo"></uni-list-item>
		</uni-list>
		
		<!-- Logout Button -->
		<view class="bottom-back" role="button" :aria-label="hasLogin ? $t('settings.logOut') : $t('settings.login')" @click="changeLoginState">
			<text class="bottom-back-text" v-if="hasLogin">{{$t('settings.logOut')}}</text>
			<text class="bottom-back-text" v-else>{{$t('settings.login')}}</text>
		</view>
	</view>
</template>

<script>
	// #ifdef APP-PLUS
	import pushServer from './dc-push/push.js';
	// #endif
	import {
		store,
		mutations
	} from '@/uni_modules/uni-id-pages/common/store.js'
	export default {
		data() {
			return {
				// #ifdef APP-PLUS
				pushServer:pushServer,
				// #endif
				supportMode:[],
				pushIsOn:"wait",
				currentLanguage:""
			}
		},
		computed: {
			userInfo(){
				return store.userInfo || {}
			},
			isAdmin(){
				const roleList = this.userInfo.role || this.userInfo.roles || []
				return Array.isArray(roleList) && roleList.includes('admin')
			},
			hasLogin(){
				return store.hasLogin
			},
			i18nEnable(){
				return !!getApp().globalData.config?.i18n?.enable
			}
		},
		onLoad() {
			this.currentLanguage = uni.getStorageSync('CURRENT_LANG') === 'en' ? 'English' : '简体中文'
			
			uni.setNavigationBarTitle({
				title: this.$t('settings.navigationBarTitle')
			})
			// #ifdef APP || MP-WEIXIN || (APP-HARMONY && uniVersion > 4.31)
			uni.checkIsSupportSoterAuthentication({
				success: (res) => {
					this.supportMode = res.supportMode
				},
				fail: () => undefined
			})
			// #endif
		},
		onShow() {
			// Check push status on app side
			//#ifdef APP-PLUS
			setTimeout(()=>{
				this.pushIsOn = pushServer.isOn();
			},300)
			//#endif
		},
		methods: {
			async changeLoginState(){
				if(this.hasLogin){
					await mutations.logout()
				}else{
					uni.redirectTo({
						url: '/pages/login/login',
					});
				}
			},
			/**
			 * Start biometric authentication
			 */
			startSoterAuthentication(checkAuthMode) {
				const title = {"fingerPrint":this.$t('settings.fingerPrint'),"facial":this.$t('settings.facial')}[checkAuthMode]
				// Ensure biometric data is enrolled
				this.checkIsSoterEnrolledInDevice({checkAuthMode,title})
					.then(() => {
						// Start authentication
						uni.startSoterAuthentication({
							requestAuthModes: [checkAuthMode],
							challenge: '123456', // WeChat challenge factor
							authContent: this.$t('settings.please')+ " " + `${title}`,
							complete: () => undefined,
							success: (res) => {
								if (res.errCode === 0) {
									/**
									 * Continue your own business flow after auth success.
									 *
									 * On App, this callback can be treated as success.
									 *
									 * On WeChat Mini Program, verify resultJSON/resultJSONSignature on server side.
									 */
									return uni.showToast({
										title: `${title}`+this.$t('settings.successText'),
										icon: 'none'
									});
								}
								uni.showToast({
									title:this.$t('settings.failTip'),
									icon: 'none'
								});
							},
							fail: (_err) => {
								uni.showToast({
									title:this.$t('settings.authFailed'),
									// title: `认证失败`,
									icon: 'none'
								});
							}
						})
					})
			},
			checkIsSoterEnrolledInDevice({checkAuthMode,title}) {
				return new Promise((resolve, reject) => {
					uni.checkIsSoterEnrolledInDevice({
						checkAuthMode,
						success: (res) => {
							if (res.isEnrolled) {
								return resolve(res);
							}
							uni.showToast({
								title: this.$t('settings.deviceNoOpen')+ `${title}`,
								icon: 'none'
							});
							reject(res);
						},
						fail: (err) => {
							uni.showToast({
								title: `${title}` + this.$t('settings.fail'),
								icon: 'none'
							});
							reject(err);
						}
					})
				})
			},
			clearTmp() {
				uni.showLoading({
					title: this.$t('settings.clearing'),
					mask: true
				});
				/*
				Temporary data that does not affect core business flow can be treated as cache.
				Cache typically includes:	
					Native layer (webview, media player, third-party SDK, map components, etc.)
					Front-end framework layer (usually cleared after restart)
					Business layer data (for example:)
						APK package downloaded by update-check feature;
						other cache policies should be designed per business needs;
						chat history can be included or separated by product decision.
					
				*/
				uni.getSavedFileList({
					success:res=>{
						if (res.fileList.length > 0) {
							uni.removeSavedFile({
								filePath: res.fileList[0].filePath,
								complete:()=>{
									uni.hideLoading()
									uni.showToast({
										title: this.$t('settings.clearedSuccessed'),
										icon: 'none'
									});
								}
							});
						}else{
							uni.hideLoading()
							uni.showToast({
								title: this.$t('settings.clearedSuccessed'),
								icon: 'none'
							});
						}
					},
					complete: () => undefined
				});
			},
			changeLanguage(){
				uni.showActionSheet({
					itemList: ['English', '简体中文'],
					success: res => {
						let language = uni.getStorageSync('CURRENT_LANG')
						const sameSelection =
							(!res.tapIndex && language === 'zh-Hans') ||
							(res.tapIndex && language === 'en');
						if (sameSelection) {
							const globalData = getApp().globalData
							if (language === 'en') {
								language = globalData.locale = 'zh-Hans'
							} else {
								language = globalData.locale = 'en'
							}
							uni.setStorageSync('CURRENT_LANG', language)
							getApp().globalData.$i18n.locale = language
							this.currentLanguage = res.tapIndex ? '简体中文' : 'English'
							if(uni.setLocale){
								uni.setLocale(language)
							}
							uni.reLaunch({
								url: '/pages/grid/discover',
								complete: () => {
									uni.$emit("changeLanguage",language)
								}
							})
						}
					},
					fail: () => undefined,
					complete: () => undefined
				});
			}
		}
	}
</script>

<style lang="scss">
	@import "@/uni.scss";

	/* #ifndef APP-NVUE */
	page {
		flex: 1;
		width: 100%;
		height: 100%;
		background-color: $neu-dark-bg;
	}

	uni-button:after {
		border: none;
		border-radius: 0;
	}
	/* #endif */
	.content {
		/* #ifndef APP-NVUE */
		display: flex;
		width: 100%;
		height: 100vh;
		/* #endif */
		flex-direction: column;
		flex: 1;
		background-color: $neu-dark-bg;
	}

	.bottom-back {
    flex-direction: column;
    justify-content: center;
    align-items: center;
		margin-top: 10px;
		width: 750rpx;
		height: 44px;
		/* #ifndef APP-NVUE */
		display: flex;
    width: 100%;
    border: none;
		/* #endif */
		border-width: 0;
		border-radius: 28rpx;
		margin: 20px 0;
		background-color: $sl-card-bg-solid;
		border: 1px solid $glass-border;
	}

	.bottom-back-text {
		font-size: 33rpx;
		color: #FF5252;
	}

	.mt10 {
		margin-top: 10px;
	}
	/* #ifndef APP-NVUE  || VUE3 */
	.content ::v-deep .uni-list {
		background-color: $neu-dark-bg;
	}
	.content ::v-deep .uni-list-item--disabled,.list-item {
		height: 50px;
		margin-bottom: 1px;
	}
	.content ::v-deep .uni-list-item {
		background-color: $sl-card-bg-solid !important;
	}
	.content ::v-deep .uni-list-item__content-title {
		color: rgba(255,255,255,0.85) !important;
	}
	.content ::v-deep .uni-list-item__extra-text {
		color: rgba(255,255,255,0.5) !important;
	}
	.content ::v-deep .uni-list-item__icon {
		color: rgba(255,255,255,0.5) !important;
	}
	/* #endif */

</style>
