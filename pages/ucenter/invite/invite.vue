<template>
	<view class="about">
		<view class="box">
			<image class="logoImg" :src="about.logo"></image>
			<text class="tip appName">{{about.appName}}</text>
			<text class="tip">{{about.slogan}}</text>
			<view @click="download" id="download">
				<image v-if="isIos" class="icon" src="@/static/h5/download-app/ios.png" mode="widthFix"></image>
				<image v-else class="icon" src="@/static/h5/download-app/android.png" mode="widthFix"></image>
				<text class="download-text">{{$t('invite.download')}}</text>
			</view>
			<text class="tip">version {{about.version}}</text>
		</view>
		<view class="copyright">
			<text class="hint">{{about.company}}</text>
		</view>
		<view class="mask" v-if="showMask">
			<image src="../../../static/h5/download-app/openImg.png" mode="widthFix"></image>
		</view>
	</view>
</template>
<script>
	export default {
		computed: {
			uniStarterConfig() {
				return getApp().globalData.config
			}
		},
		data() {
			return {
				about: {},
				code: "",
				isIos: "",
				showMask: false,
				downloadUrl: {
					"ios": "",
					"android": ""
				}
			};
		},
		created() {
			this.about = this.uniStarterConfig.about
			this.downloadUrl = this.uniStarterConfig.download
			this.year = (new Date).getFullYear()

			//判断是否在微信中打开
			var userAgent = navigator.userAgent;
			var ua = userAgent.toLowerCase();
			this.isWeixin = ua.indexOf('micromessenger') != -1;
			//判断是否在ios或者安卓打开
			this.isIos = !!userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/);
		},
		onLoad({
			code
		}) {
			this.code = code
			document.getElementById("openApp").style.display = 'none'
			document.getElementsByTagName("body")[0].style = ""
		},
		methods: {
			download() {
				if (this.code) {
					uni.setClipboardData({
						data: this.code,
						complete: (e) => {
							console.log(e);
							uni.hideToast()
							/* 以下临时解决setClipboardData h5端样式和键盘弹出端错误解决方案，后续会直接内置*/
							document.getElementById("#clipboard").style.top = '-999px';
							uni.hideKeyboard()
						}
					})
				}

				if (this.isIos) {
					window.location.href = this.downloadUrl.ios
				} else {
					if (this.isWeixin) {
						//显示浮层
						this.showMask = true
					} else {
						window.location.href = this.downloadUrl.android
					}
				}
			}
		}
	}
</script>
<style lang="scss">
	@import "@/uni.scss";

	/* #ifndef APP-NVUE */
	view {
		display: flex;
		box-sizing: border-box;
		flex-direction: column;
	}

	/* #endif */
	.about {
		width: 750rpx;
		flex-direction: column;
		background: $neu-dark-bg;
		min-height: 100vh;
	}

	.box {
		margin-top: 100px;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.logoImg {
		margin-bottom: 10upx;
		width: 160upx;
		height: 160upx;
		border-radius: 24rpx;
		border: 1px solid $glass-border;
		box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.3);
	}

	.tip {
		font-size: 24rpx;
		margin-top: 10px;
		color: rgba(255,255,255,0.55);
	}

	.appName {
		margin-top: 20px;
		font-size: 42rpx;
		font-weight: 600;
		color: #fff;
	}

	.copyright {
		width: 750upx;
		font-size: 32rpx;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		bottom: 20px;
		left: 0;
		position: fixed;
	}

	.hint {
		color: rgba(255,255,255,0.4);
		font-size: 26rpx;
	}

	.icon {
		width: 34rpx;
	}

	#download {
		background: linear-gradient(135deg, #00E5FF 0%, #00B0FF 100%);
		color: #0A1628;
		margin: 55rpx;
		padding: 5px;
		height: 30px;
		width: 160rpx;
		border-radius: 100px;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		box-shadow: 0 6rpx 24rpx rgba(0, 229, 255, 0.3);
	}

	.download-text {
		font-size: 32rpx;
		color: #0A1628;
		font-weight: 700;
	}

	.mask {
		position: fixed;
		top: 0;
		left: 0;
		width: 750rpx;
		height: 100vh;
		flex-direction: row;
		justify-content: flex-end;
		background-color: rgba(5, 10, 20, 0.8);
	}

	.mask image {
		width: 600rpx;
	}
</style>
