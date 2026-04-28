import config from '@/uni_modules/uni-id-pages/config.js'
import { authText } from '@/uni_modules/uni-id-pages/common/auth-ui.js'

const PASSWORD_RULES = {
	super: /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[~!@#$%^&*_\-+=`|\\(){}[\]:;"'<>,.?/])[0-9a-zA-Z~!@#$%^&*_\-+=`|\\(){}[\]:;"'<>,.?/]{8,16}$/,
	strong: /^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[~!@#$%^&*_\-+=`|\\(){}[\]:;"'<>,.?/])[0-9a-zA-Z~!@#$%^&*_\-+=`|\\(){}[\]:;"'<>,.?/]{8,16}$/,
	medium: /^(?![0-9]+$)(?![a-zA-Z]+$)(?![~!@#$%^&*_\-+=`|\\(){}[\]:;"'<>,.?/]+$)[0-9a-zA-Z~!@#$%^&*_\-+=`|\\(){}[\]:;"'<>,.?/]{8,16}$/,
	weak: /^(?=.*[0-9])(?=.*[a-zA-Z])[0-9a-zA-Z~!@#$%^&*_\-+=`|\\(){}[\]:;"'<>,.?/]{6,16}$/
}

function validatePassword(value, callback) {
	if (!value) {
		callback(authText('password.noPwd'))
		return false
	}

	const strength = config.passwordStrength
	if (strength && PASSWORD_RULES[strength] && !PASSWORD_RULES[strength].test(value)) {
		callback(authText(`password.strength.${strength}`))
		return false
	}

	return true
}

function validatePasswordConfirm(passwordKey, value, data, callback) {
	if (!value) {
		callback(authText('password.noRePwd'))
		return false
	}

	if (data[passwordKey] !== value) {
		callback(authText('password.rePwdErr'))
		return false
	}

	return true
}

function getPwdRules(passwordKey = 'password', confirmKey = 'password2') {
	return {
		[passwordKey]: {
			rules: [{
				required: true,
				errorMessage: authText('password.noPwd')
			}, {
				validateFunction(rule, value, data, callback) {
					return validatePassword(value, callback)
				}
			}]
		},
		[confirmKey]: {
			rules: [{
				required: true,
				errorMessage: authText('password.noRePwd')
			}, {
				validateFunction(rule, value, data, callback) {
					return validatePasswordConfirm(passwordKey, value, data, callback)
				}
			}]
		}
	}
}

export default {
	getPwdRules
}
