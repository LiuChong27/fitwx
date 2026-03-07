import { store } from '@/uni_modules/uni-id-pages/common/store.js';

const getToken = () => {
	try {
		return (
			uni.getStorageSync('uni_id_token') ||
			store.token ||
			''
		);
	} catch (_) {
		return store.token || '';
	}
};

const getUserId = () => {
	try {
		const uid =
			uni.getStorageSync('fit_user_id') ||
			uni.getStorageSync('user_id') ||
			(store.userInfo && store.userInfo._id) ||
			'';
		return uid;
	} catch (_) {
		return (store.userInfo && store.userInfo._id) || '';
	}
};

/**
 * 统一登录校验：只判断 token + userId 是否存在。
 * - 已登录：直接执行 callback（不做任何跳转）
 * - 未登录：跳转登录页
 */
export function checkLogin(callback) {
	const token = getToken();
	const userId = getUserId();

	// token 即视为有权限调用后端，uid 可由后端通过 token 解析；本地缺 uid 时尝试回写，避免误判未登录
	if (token) {
		if (!userId && store.userInfo && store.userInfo._id) {
			try {
				uni.setStorageSync('fit_user_id', store.userInfo._id);
				uni.setStorageSync('user_id', store.userInfo._id);
			} catch (_) {
				// ignore storage failures
			}
		}
		if (typeof callback === 'function') callback();
		return true;
	}

	uni.navigateTo({ url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd' });
	return false;
}
