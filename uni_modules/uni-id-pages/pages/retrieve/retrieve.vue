<!-- 找回密码页 -->
<template>
	<view class="uni-content">
		<match-media :min-width="690">
		<view class="login-logo">
			<image :src="logo"></image>
		</view>
		<!-- 顶部文字 -->
		<text class="title title-box">{{ $t('login.page.retrieve.sms.title') }}</text>
		<text class="tip">{{ $t('login.page.retrieve.sms.tip') }}</text>
		</match-media>
		<uni-forms ref="form" :value="formData" err-show-type="toast">
			<uni-forms-item name="phone">
				<uni-easyinput :focus="focusPhone" @blur="focusPhone = false" class="input-box" :disabled="lock" type="number" :inputBorder="false" trim="both"
					v-model="formData.phone" maxlength="11" :placeholder="$t('login.page.retrieve.sms.phonePlaceholder')">
				</uni-easyinput>
			</uni-forms-item>
			<uni-forms-item name="code">
				<uni-id-pages-sms-form ref="shortCode" :phone="formData.phone" type="reset-pwd-by-sms" v-model="formData.code">
				</uni-id-pages-sms-form>
			</uni-forms-item>
			<uni-forms-item name="password">
				<uni-easyinput :focus="focusPassword" @blur="focusPassword = false" class="input-box" type="password" :inputBorder="false" v-model="formData.password" trim="both"
					:placeholder="$t('login.page.retrieve.common.newPasswordPlaceholder')"></uni-easyinput>
			</uni-forms-item>
			<uni-forms-item name="password2">
				<uni-easyinput :focus="focusPassword2" @blur="focusPassword2 = false" class="input-box" type="password" :inputBorder="false" v-model="formData.password2" trim="both"
					:placeholder="$t('login.page.retrieve.common.passwordAgainPlaceholder')"></uni-easyinput>
			</uni-forms-item>
			<button class="uni-btn send-btn-box" type="primary" @click="submit">{{ $t('login.page.retrieve.sms.button') }}</button>
			<match-media :min-width="690">
				<view class="link-box">
					<text class="link" @click="retrieveByEmail">{{ $t('login.page.retrieve.sms.emailSwitch') }}</text>
					<view></view>
					<text class="link" @click="backLogin">{{ $t('login.page.retrieve.common.backLogin') }}</text>
        </view>
			</match-media>
		</uni-forms>
		<uni-popup-captcha @confirm="submit" v-model="formData.captcha" scene="reset-pwd-by-sms" ref="popup"></uni-popup-captcha>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	import passwordMod from '@/uni_modules/uni-id-pages/pages/common/password.js'
	import {authText, showAuthFailure, showAuthToast} from '@/uni_modules/uni-id-pages/common/auth-ui.js'
	const uniIdCo = uniCloud.importObject("uni-id-co",{
		customUI: true
	})
	export default {
		mixins: [mixin],
		data() {
			return {
				lock: false,
				focusPhone:true,
				focusPassword:false,
				focusPassword2:false,
				formData: {
					"phone": "",
					"code": "",
					'password': '',
					'password2': '',
					"captcha": ""
				},
				rules: {
					phone: {
						rules: [{
								required: true,
								errorMessage: authText('retrieve.sms.phoneRequired'),
							},
							{
								pattern: /^1\d{10}$/,
								errorMessage: authText('retrieve.sms.phoneInvalid'),
							}
						]
					},
			code: {
				rules: [{
						required: true,
						errorMessage: authText('retrieve.sms.smsCodeRequired'),
					},
							{
								pattern: /^.{6}$/,
						errorMessage: authText('retrieve.sms.smsCodeInvalid'),
					}
				]
			},
			...passwordMod.getPwdRules()
		},
		logo: "/static/logo.png"
	}
		},
		computed: {
			isPhone() {
				let reg_phone = /^1\d{10}$/;
				let isPhone = reg_phone.test(this.formData.phone);
				return isPhone;
			},
			isPwd() {
				let reg_pwd = /^.{6,20}$/;
				let isPwd = reg_pwd.test(this.formData.password);
				return isPwd;
			},
			isCode() {
				let reg_code = /^\d{6}$/;
				let isCode = reg_code.test(this.formData.code);
				return isCode;
			}
		},
		onLoad(event) {
			if (event && event.phoneNumber) {
				this.formData.phone = event.phoneNumber;
				if(event.lock){
					this.lock = event.lock //如果是已经登录的账号，点击找回密码就锁定指定的账号绑定的手机号码
					this.focusPhone = true
				}
			}
		},
		onReady() {
			if (this.formData.phone) {
				this.$refs.shortCode.start();
			}
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
			 * 完成并提交
			 */
			submit() {
				this.$refs.form.validate()
					.then(res => {
						let {
							"phone": mobile,
							"password": password,
							captcha,
							code
						} = this.formData
						uniIdCo.resetPwdBySms({
								mobile,
								code,
								password,
								captcha
							}).then(e => {
								showAuthToast('retrieve.common.success')
								uni.redirectTo({ url: '/pages/login/login-withpwd' })
							})
							.catch(e => {
								if (e.errCode == 'uni-id-captcha-required') {
									this.$refs.popup.open()
								} else {
									showAuthFailure((e && (e.message || e.errMsg)) || '')
								}
							}).finally(e => {
								this.formData.captcha = ""
							})
					}).catch(errors=>{
						let key = errors[0].key
						if(key == 'code'){
							return this.$refs.shortCode.focusSmsCodeInput = true
						}
						key = key.replace(key[0], key[0].toUpperCase())
						this['focus'+key] = true
					})
			},
			retrieveByEmail() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/retrieve/retrieve-by-email'
				})
			},
			backLogin () {
				uni.redirectTo({
					url: '/pages/login/login-withpwd'
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
		}
	}
	@media screen and (min-width: 690px) {
		.uni-content{
			padding: 30px 40px 40px;
			max-height: 650px;
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
</style>
