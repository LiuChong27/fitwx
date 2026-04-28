import passwordMod from '@/uni_modules/uni-id-pages/pages/common/password.js'
import {
	authText
} from '@/uni_modules/uni-id-pages/common/auth-ui.js'
export default {
	"username": {
		"rules": [{
				required: true,
				errorMessage: authText('register.rules.usernameRequired'),
			},
			{
				minLength: 3,
				maxLength: 32,
				errorMessage: authText('register.rules.usernameLength'),
			},
			{
				validateFunction: function(rule, value, data, callback) {
					// console.log(value);
					if (/^1\d{10}$/.test(value) || /^(\w-*\.*)+@(\w-?)+(\.\w{2,})+$/.test(value)) {
						callback(authText('register.rules.usernameNoPhoneOrEmail'))
					};
					if (/^\d+$/.test(value)) {
						callback(authText('register.rules.usernameNoNumber'))
					};
					if(/[\u4E00-\u9FA5\uF900-\uFA2D]{1,}/.test(value)){
						callback(authText('register.rules.usernameNoChinese'))
					}
					return true
				}
			}
		],
		"label": authText('register.rules.usernameLabel')
	},
	"nickname": {
		"rules": [{
				minLength: 3,
				maxLength: 32,
				errorMessage: authText('register.rules.nicknameLength'),
			},
			{
				validateFunction: function(rule, value, data, callback) {
					// console.log(value);
					if (/^1\d{10}$/.test(value) || /^(\w-*\.*)+@(\w-?)+(\.\w{2,})+$/.test(value)) {
						callback(authText('register.rules.nicknameNoPhoneOrEmail'))
					};
					if (/^\d+$/.test(value)) {
						callback(authText('register.rules.nicknameNoNumber'))
					};
					if(/[\u4E00-\u9FA5\uF900-\uFA2D]{1,}/.test(value)){
						callback(authText('register.rules.nicknameNoChinese'))
					}
					return true
				}
			}
		],
		"label": authText('register.rules.nicknameLabel')
	},
	...passwordMod.getPwdRules()
}
