import { store as uniIdStore } from '@/uni_modules/uni-id-pages/common/store.js';
import { prefetchWxCode } from '@/common/wxSilentLogin.js';
import storage from '@/common/storage.js';

const LOGIN_PAGE_URL = '/pages/login/login';
const POST_LOGIN_TARGET_KEY = 'post_login_target';

function normalizeRoutePath(route = '') {
	if (!route) return '';
	const cleanRoute = String(route).split('?')[0].split('#')[0];
	if (!cleanRoute) return '';
	return cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`;
}

function safeDecode(value = '') {
	try {
		return decodeURIComponent(value);
	} catch (_) {
		return value;
	}
}

function normalizeRedirectTarget(target = '') {
	if (!target) return '';
	let raw = safeDecode(String(target).trim());
	if (!raw) return '';
	if (/^[a-z]+:\/\//i.test(raw)) return '';
	if (raw.startsWith('#')) return '';
	if (!raw.startsWith('/')) {
		raw = `/${raw}`;
	}
	const [pathPart = '', queryPart = ''] = raw.split('?');
	const path = normalizeRoutePath(pathPart);
	if (!path) return '';
	return queryPart ? `${path}?${queryPart}` : path;
}

function stringifyQuery(options = {}) {
	if (!options || typeof options !== 'object') return '';
	const entries = Object.entries(options).filter(([key, value]) => key && value !== undefined && value !== null && value !== '');
	if (!entries.length) return '';
	return entries
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
		.join('&');
}

function getCurrentRoutePath(withQuery = false) {
	try {
		const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
		if (!Array.isArray(pages) || !pages.length) return '';
		const current = pages[pages.length - 1] || {};
		const path = normalizeRoutePath(current.route || '');
		if (!withQuery || !path) return path;
		const query = stringifyQuery(current.options || {});
		return query ? `${path}?${query}` : path;
	} catch (_) {
		return '';
	}
}

function isLoginRoute(route = '') {
	return normalizeRoutePath(route).startsWith('/pages/login/');
}

function shouldPersistPostLoginTarget(route = '') {
	const target = normalizeRedirectTarget(route);
	if (!target) return false;
	if (isLoginRoute(target)) return false;
	return true;
}

function buildLoginUrl(target = '') {
	const redirect = normalizeRedirectTarget(target);
	if (!redirect) return LOGIN_PAGE_URL;
	return `${LOGIN_PAGE_URL}?redirect=${encodeURIComponent(redirect)}`;
}

export function setPostLoginTarget(route = '') {
	const target = normalizeRedirectTarget(route);
	if (!target || !shouldPersistPostLoginTarget(target)) {
		storage.remove(POST_LOGIN_TARGET_KEY);
		return;
	}
	storage.set(POST_LOGIN_TARGET_KEY, target);
}

export function consumePostLoginTarget() {
	const target = normalizeRedirectTarget(storage.get(POST_LOGIN_TARGET_KEY, ''));
	storage.remove(POST_LOGIN_TARGET_KEY);
	if (!shouldPersistPostLoginTarget(target)) return '';
	return target;
}

function safeGetCurrentUserInfo() {
	try {
		return uniCloud.getCurrentUserInfo ? uniCloud.getCurrentUserInfo() || {} : {};
	} catch (_) {
		return {};
	}
}

function getRawUniIdUserInfo() {
	try {
		return uni.getStorageSync('uni-id-pages-userInfo') || {};
	} catch (_) {
		return {};
	}
}

function normalizeOpenid(userInfo = {}) {
	const wxOpenid = userInfo.wx_openid || {};
	return wxOpenid['mp-weixin'] || wxOpenid.mp || userInfo.openid || '';
}

export function getResolvedUserId() {
	const rawUniIdUserInfo = getRawUniIdUserInfo();
	const rawStoreUserInfo = (uniIdStore && uniIdStore.userInfo) || {};
	const persistedUserInfo = storage.get('userInfo', null) || {};
	const currentUserInfo = safeGetCurrentUserInfo();

	return (
		rawUniIdUserInfo._id ||
		rawStoreUserInfo._id ||
		storage.get('userId', '') ||
		uni.getStorageSync('fit_user_id') ||
		uni.getStorageSync('user_id') ||
		persistedUserInfo._id ||
		currentUserInfo.uid ||
		''
	);
}

export function getResolvedUserInfo() {
	const rawUniIdUserInfo = getRawUniIdUserInfo();
	const rawStoreUserInfo = (uniIdStore && uniIdStore.userInfo) || {};
	const persistedUserInfo = storage.get('userInfo', null) || {};
	const merged = {
		...persistedUserInfo,
		...rawUniIdUserInfo,
		...rawStoreUserInfo,
	};
	const userId = merged._id || getResolvedUserId();
	if (userId) {
		merged._id = userId;
	}
	const openid = normalizeOpenid(merged);
	if (openid && !merged.openid) {
		merged.openid = openid;
	}
	return merged;
}

export const getToken = () => {
	try {
		return (
			uni.getStorageSync('uni_id_token') ||
			storage.get('token', '') ||
			uni.getStorageSync('token') ||
			uni.getStorageSync('fit_token') ||
			uniIdStore.token ||
			''
		);
	} catch (_) {
		return storage.get('token', '') || uniIdStore.token || '';
	}
};

export const getUserId = () => {
	return getResolvedUserId();
};

export function getAuthSnapshot() {
	const token = getToken();
	const userInfo = getResolvedUserInfo();
	const userId = userInfo._id || getResolvedUserId();
	const hasLogin = !!(token && userId);

	if (hasLogin) {
		try {
			uni.setStorageSync('fit_user_id', userId);
			uni.setStorageSync('user_id', userId);
		} catch (_) {
			// ignore
		}
	}

	return {
		hasLogin,
		token,
		userId,
		userInfo,
	};
}

export function isLoggedIn() {
	return getAuthSnapshot().hasLogin;
}

export function redirectToLogin(options = {}) {
	const { from = '', redirect = '' } = options;
	const currentRoute = getCurrentRoutePath(true);
	const redirectSource = normalizeRedirectTarget(redirect || from) || normalizeRedirectTarget(currentRoute);
	if (shouldPersistPostLoginTarget(redirectSource)) {
		setPostLoginTarget(redirectSource);
	}
	try {
		prefetchWxCode();
	} catch (_) {
		// ignore
	}
	uni.navigateTo({ url: buildLoginUrl(redirectSource) });
}

export function requireLogin(options = {}) {
	const { message = '请先登录后继续', from = '' } = options;
	if (isLoggedIn()) return true;
	const content = String(message || '').trim() || '请先登录后继续';
	uni.showModal({
		title: '需要登录',
		content,
		confirmText: '去登录',
		success: (res) => {
			if (res.confirm) {
				redirectToLogin({ from });
			}
		},
	});
	return false;
}

export function ensureLoggedIn(options = {}) {
	const { silent = false, toast = '请先登录', from = '' } = options;
	if (isLoggedIn()) return true;

	if (!silent) {
		if (toast) {
			uni.showToast({ title: toast, icon: 'none' });
		}
		redirectToLogin({ from });
	}
	return false;
}

export function checkLogin(callback, options = {}) {
	const ok = requireLogin(options);
	if (!ok) return false;
	if (typeof callback === 'function') callback();
	return true;
}

export function checkMobileBind(callback) {
	if (!requireLogin()) return false;

	const { userInfo } = getAuthSnapshot();
	const mobile = userInfo && userInfo.mobile;
	if (mobile) {
		if (typeof callback === 'function') callback();
		return true;
	}

	uni.showModal({
		title: '请先绑定手机号',
		content: '该操作需要先绑定手机号。',
		success: (res) => {
			if (res.confirm) {
				uni.navigateTo({ url: '/uni_modules/uni-id-pages/pages/userinfo/bind-mobile/bind-mobile' });
			}
		},
	});
	return false;
}
