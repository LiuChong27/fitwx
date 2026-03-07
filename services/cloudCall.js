import { store } from '@/uni_modules/uni-id-pages/common/store.js';
import { reportError } from '@/common/errorMonitor.js';

// ====== 重试与超时配置 ======
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1s → 2s → 4s
const REQUEST_TIMEOUT = 15000; // 15 秒超时
const TOKEN_EXPIRED_CODES = [
	'TOKEN_INVALID',
	'uni-id-token-expired',
	'uni-id-check-token-failed',
	10001, 10002, 10003, // uni-id 常见 token 失效码
];

const getUniIdToken = () => {
	try {
		const token = uni.getStorageSync('uni_id_token');
		if (token) return token;
	} catch (_) {
		// ignore
	}
	return store.token || '';
};

// ====== Token 刷新互斥锁 ======
let _refreshPromise = null;

/**
 * 尝试刷新 token（带互斥锁）
 * 多个请求同时触发 401 时，只有第一个会真正执行刷新，
 * 其余请求等待同一个 Promise 结果。
 * @returns {boolean} 是否刷新成功
 */
async function tryRefreshToken() {
	// 如果已有刷新请求在执行，直接等待其结果
	if (_refreshPromise) {
		return _refreshPromise;
	}

	_refreshPromise = _doRefreshToken();
	try {
		return await _refreshPromise;
	} finally {
		_refreshPromise = null;
	}
}

/** 实际执行 token 刷新（内部方法，不要直接调用） */
async function _doRefreshToken() {
	try {
		const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
		const res = await uniIdCo.refreshToken();
		if (res && res.newToken) {
			uni.setStorageSync('uni_id_token', res.newToken.token);
			uni.setStorageSync('uni_id_token_expired', res.newToken.tokenExpired);
			store.token = res.newToken.token;
			return true;
		}
	} catch (e) {
		console.warn('[cloudCall] refreshToken failed:', e);
		reportError(e, { action: 'refreshToken' });
	}
	return false;
}

/**
 * 判断错误是否为 token 失效
 */
function isTokenExpiredError(result) {
	if (!result) return false;
	const code = result.errCode || result.code;
	const msg = result.errMsg || result.message || '';
	if (TOKEN_EXPIRED_CODES.includes(code)) return true;
	if (typeof msg === 'string' && /token.*(expired|invalid|失效)/i.test(msg)) return true;
	return false;
}

/**
 * 延迟函数（指数退避）
 */
function delay(attempt) {
	const ms = BASE_DELAY * Math.pow(2, attempt);
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带超时的 Promise
 */
function withTimeout(promise, ms) {
	let timer;
	const timeout = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(`cloudCall timeout (${ms}ms)`)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * 统一云函数调用封装
 * - 显式注入 token
 * - Token 失效自动刷新 + 重放
 * - 指数退避重试（网络错误）
 * - 请求超时保护
 */
export const callFunctionWithToken = async ({ name, data = {}, timeout = REQUEST_TIMEOUT }) => {
	let lastError;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			const token = getUniIdToken();
			const payload = { ...(data || {}) };
			if (token) {
				if (!payload.uniIdToken) payload.uniIdToken = token;
				if (!payload.token) payload.token = token;
				if (payload.params && typeof payload.params === 'object') {
					if (!payload.params.uniIdToken) payload.params.uniIdToken = token;
					if (!payload.params.token) payload.params.token = token;
				}
			}

			const result = await withTimeout(
				uniCloud.callFunction({ name, data: payload }),
				timeout
			);

			// 检查 token 过期
			const resData = result?.result || result;
			if (isTokenExpiredError(resData) && attempt < MAX_RETRIES) {
				console.warn(`[cloudCall] token expired, refreshing... (attempt ${attempt + 1})`);
				const refreshed = await tryRefreshToken();
				if (refreshed) {
					continue; // 刷新成功 → 重放请求
				}
				// 刷新失败 → 踢回登录页
				uni.$emit('uni-id-pages-logout');
				uni.reLaunch({ url: '/pages/login/login-withoutpwd' });
				throw new Error('Token expired & refresh failed');
			}

			return result;
		} catch (e) {
			lastError = e;
			const isNetworkError = /timeout|network|abort|ECONNRESET|request:fail/i.test(e.message || '');

			if (isNetworkError && attempt < MAX_RETRIES) {
				console.warn(`[cloudCall] retry ${attempt + 1}/${MAX_RETRIES}:`, e.message);
				await delay(attempt);
				continue;
			}

			// 非网络错误或已耗尽重试次数
			reportError(e, { cloudFunction: name, attempt });
			throw e;
		}
	}

	throw lastError;
};
