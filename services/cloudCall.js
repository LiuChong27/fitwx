import { store } from '@/uni_modules/uni-id-pages/common/store.js';
import { reportError } from '@/common/errorMonitor.js';

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1s -> 2s -> 4s
const REQUEST_TIMEOUT = 15000;

const TOKEN_EXPIRED_CODES = [
	'TOKEN_INVALID',
	'uni-id-token-expired',
	'uni-id-check-token-failed',
	10001,
	10002,
	10003,
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

let refreshPromise = null;

async function doRefreshToken() {
	try {
		const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
		const res = await uniIdCo.refreshToken();
		if (res && res.newToken) {
			uni.setStorageSync('uni_id_token', res.newToken.token);
			uni.setStorageSync('uni_id_token_expired', res.newToken.tokenExpired);
			store.token = res.newToken.token;
			return true;
		}
	} catch (error) {
		console.warn('[cloudCall] refreshToken failed:', error);
		reportError(error, { action: 'refreshToken' });
	}
	return false;
}

async function tryRefreshToken() {
	if (refreshPromise) {
		return refreshPromise;
	}
	refreshPromise = doRefreshToken();
	try {
		return await refreshPromise;
	} finally {
		refreshPromise = null;
	}
}

function isTokenExpiredError(result) {
	if (!result) return false;
	const code = result.errCode || result.code;
	const msg = String(result.errMsg || result.message || '');
	if (TOKEN_EXPIRED_CODES.includes(code)) return true;
	return /token.*(expired|invalid|失效)/i.test(msg);
}

function delay(attempt) {
	const ms = BASE_DELAY * Math.pow(2, attempt);
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms) {
	let timer;
	const timeout = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(`请求超时（${ms}ms）`)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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

			const resData = result?.result || result;
			if (isTokenExpiredError(resData) && attempt < MAX_RETRIES) {
				console.warn(`[cloudCall] token expired, refreshing... (attempt ${attempt + 1})`);
				const refreshed = await tryRefreshToken();
				if (refreshed) {
					continue;
				}
				uni.$emit('uni-id-pages-logout');
				uni.reLaunch({ url: '/pages/login/login' });
				throw new Error('登录状态已过期，请重新登录');
			}

			return result;
		} catch (error) {
			lastError = error;
			const isNetworkError = /timeout|network|abort|ECONNRESET|request:fail/i.test(String(error?.message || ''));
			if (isNetworkError && attempt < MAX_RETRIES) {
				console.warn(`[cloudCall] retry ${attempt + 1}/${MAX_RETRIES}:`, error?.message || error);
				await delay(attempt);
				continue;
			}
			reportError(error, { cloudFunction: name, attempt });
			throw error;
		}
	}

	throw lastError;
};
