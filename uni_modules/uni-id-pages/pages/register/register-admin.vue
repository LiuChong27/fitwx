<!-- 创建超级管理员 -->
<template>
	<view class="uni-content">
		<match-media :min-width="690">
			<view class="login-logo">
				<image :src="logo"></image>
			</view>
			<!-- 顶部文字 -->
			<text class="title title-box">{{ $t('login.page.register.admin.title') }}</text>
			<text class="tip">{{ $t('login.page.register.admin.tip') }}</text>
		</match-media>
		<uni-forms ref="form" :value="formData" :rules="rules" validate-trigger="submit" err-show-type="toast">
			<uni-forms-item name="username" required>
				<uni-easyinput :inputBorder="false" :focus="focusUsername" @blur="focusUsername = false"
					class="input-box" :placeholder="$t('login.page.register.common.usernamePlaceholder')" v-model="formData.username" trim="both" />
			</uni-forms-item>
			<uni-forms-item name="nickname">
				<uni-easyinput :inputBorder="false" :focus="focusNickname" @blur="focusNickname = false" class="input-box" :placeholder="$t('login.page.register.common.nicknamePlaceholder')" v-model="formData.nickname"
					trim="both" />
			</uni-forms-item>
			<uni-forms-item name="password" v-model="formData.password" required>
				<uni-easyinput :inputBorder="false" :focus="focusPassword" @blur="focusPassword = false"
					class="input-box" maxlength="20" :placeholder="$t('login.page.register.common.passwordPlaceholder', { min: config.passwordStrength == 'weak' ? '6' : '8' })" type="password"
					v-model="formData.password" trim="both" />
			</uni-forms-item>
			<uni-forms-item name="password2" v-model="formData.password2" required>
				<uni-easyinput :inputBorder="false" :focus="focusPassword2" @blur="focusPassword2 =false"
					class="input-box" :placeholder="$t('login.page.register.common.passwordAgainPlaceholder')" maxlength="20" type="password" v-model="formData.password2"
					trim="both" />
			</uni-forms-item>
<!--			<uni-forms-item>-->
<!--				<uni-captcha ref="captcha" scene="register" v-model="formData.captcha" />-->
<!--			</uni-forms-item>-->
			<uni-id-pages-agreements scope="register" ref="agreements" ></uni-id-pages-agreements>
			<button class="uni-btn" type="primary" @click="submit">{{ $t('login.page.register.admin.button') }}</button>
			<button @click="navigateBack" class="register-back">{{ $t('login.page.register.common.back') }}</button>
			<match-media :min-width="690">
				<view class="link-box">
					<text class="link" @click="toLogin">{{ $t('login.page.register.common.toLogin') }}</text>
				</view>
			</match-media>
		</uni-forms>
	</view>
</template>

<script>
	import rules from './validator.js';
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	import config from '@/uni_modules/uni-id-pages/config.js'
	import {showAuthFailure, showAuthToast} from '@/uni_modules/uni-id-pages/common/auth-ui.js'
	const uniIdCo = uniCloud.importObject("uni-id-co", {customUI: true})
	export default {
		mixins: [mixin],
		data() {
			return {
				formData: {
					username: "",
					nickname: "",
					password: "",
					password2: "",
					captcha: ""
				},
				rules,
				focusUsername:false,
				focusNickname:false,
				focusPassword:false,
				focusPassword2:false,
				logo: "/static/logo.png"
			}
		},
		onReady() {
			this.$refs.form.setRules(this.rules)
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				var e = event || window.event;
				if (e && e.keyCode == 13) { //回车键的键值为13
					this.submit()
				}
			};
			// #endif
		},
		methods: {
			/**
			 * 触发表单提交
			 */
			submit() {
				this.$refs.form.validate().then((res) => {
					// if(this.formData.captcha.length != 4){
					// 	this.$refs.captcha.focusCaptchaInput = true
					// 	return uni.showToast({
					// 		title: '请输入验证码',
					// 		icon: 'none',
					// 		duration: 3000
					// 	});
					// }
					if (this.needAgreements && !this.agree) {
						return this.$refs.agreements.popup(()=>{
							this.submitForm(res)
						})
					}
					this.submitForm(res)
				}).catch((errors) => {
					let key = errors[0].key
					key = key.replace(key[0], key[0].toUpperCase())
					// console.log(key);
					this['focus'+key] = true
				})
			},
			submitForm(params) {
				uniIdCo.registerAdmin(this.formData).then(e => {
					showAuthToast('register.admin.success')
					uni.navigateBack()
				})
				.catch(e => {
					showAuthFailure((e && (e.message || e.errMsg)) || `创建失败: ${e.errCode}`)
				})
			},
			navigateBack() {
				uni.navigateBack()
			},
			toLogin() {
				uni.navigateTo({
					url: '/pages/login/login-withpwd'
				})
			},
			registerByEmail() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/register/register-by-email'
				})
			}
		}
	}
</script>

<style lang="scss">
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";

	@media screen and (max-width: 690px) {
		.uni-content{
			margin-top: 15px;
			height: 100%;
			background-color: #fff;
		}
	}
	@media screen and (min-width: 690px) {
		.uni-content{
			padding: 30px 40px 60px;
			max-height: 520px;
		}

		.link-box {
			/* #ifndef APP-NVUE */
			display: flex;
			/* #endif */
			flex-direction: row;
			justify-content: space-between;
			margin-top: 10px;
		}

		.link {
			font-size: 12px;
		}
	}

	.uni-content ::v-deep .uni-forms-item__label {
		position: absolute;
		left: -15px;
	}

	button {
		margin-top: 15px;
	}
</style>
