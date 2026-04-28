import i18n from '@/lang/i18n'

function getTranslator() {
	if (i18n && i18n.global && typeof i18n.global.t === 'function') {
		return i18n.global.t.bind(i18n.global)
	}
	if (i18n && typeof i18n.t === 'function') {
		return i18n.t.bind(i18n)
	}
	return (key) => key
}

export function authText(pathOrKey, params = {}) {
	const key = pathOrKey.startsWith('login.') ? pathOrKey : `login.page.${pathOrKey}`
	return getTranslator()(key, params)
}

export function showAuthToast(pathOrKey, params = {}, options = {}) {
	uni.showToast({
		title: authText(pathOrKey, params),
		icon: options.icon || 'none',
		duration: options.duration || 1200
	})
}

export function showAuthFailure(message, options = {}) {
	uni.showModal({
		title: options.title || authText('loginFailedTitle'),
		content: message || authText('genericRetry'),
		showCancel: false
	})
}