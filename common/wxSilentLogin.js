/**
 * 微信小程序静默登录 code 预取工具
 * - 启动时预取并缓存 code，4 分钟内可复用
 * - 登录时通过 getFreshWxCode 获取最新 code（过期自动刷新）
 * - 非微信小程序环境返回空字符串
 */

const CODE_TTL = 4 * 60 * 1000;
const DEFAULT_RETRY = 2;

let cachedCode = '';
let expiresAt = 0;
let inflight = null;
let lastWxCodeMeta = {
	platform: '',
	attempt: 0,
	retryBudget: 0,
	codePresent: false,
	codeLength: 0,
	errMsg: '',
	timestamp: 0,
};

function getRuntimePlatform() {
	try {
		const envPlatform = typeof process !== 'undefined' && process.env ? process.env.UNI_PLATFORM || '' : '';
		if (envPlatform) return envPlatform;
		if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
			const info = uni.getSystemInfoSync() || {};
			if (info.uniPlatform) return info.uniPlatform;
			if (info.platform === 'devtools' && hasNativeWxLogin()) return 'mp-weixin';
		}
		if (hasNativeWxLogin()) return 'mp-weixin';
		return 'unknown';
	} catch (_) {
		return hasNativeWxLogin() ? 'mp-weixin' : 'unknown';
	}
}

function isMpWeixinPlatform(platform = '') {
	return platform === 'mp-weixin';
}

function updateWxCodeMeta(payload = {}) {
	lastWxCodeMeta = {
		...lastWxCodeMeta,
		platform: getRuntimePlatform(),
		timestamp: Date.now(),
		...payload,
	};
}

function hasNativeWxLogin() {
	try {
		return typeof wx !== 'undefined' && !!wx && typeof wx.login === 'function';
	} catch (_) {
		return false;
	}
}

function isMpWeixin() {
	try {
		return isMpWeixinPlatform(getRuntimePlatform()) || hasNativeWxLogin();
	} catch (_) {
		return hasNativeWxLogin();
	}
}

function isFresh() {
	return cachedCode && expiresAt - Date.now() > 60 * 1000;
}

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function logWxLogin(event, payload = {}) {
	if (!isMpWeixin()) return;
	const consoleRef = typeof globalThis !== 'undefined' ? globalThis.console : null;
	if (!consoleRef) return;
	const logger = /empty code|failed|unavailable/i.test(String(event))
		? consoleRef.warn
		: (consoleRef.info || consoleRef.log);
	logger.call(consoleRef, `[auth][wx-login] ${event}`, {
		platform: getRuntimePlatform(),
		...payload,
	});
}

function normalizeOptions(forceOrOptions, maybeRetry) {
	if (forceOrOptions && typeof forceOrOptions === 'object') {
		const retry = Number.isInteger(forceOrOptions.retry) ? Math.max(0, forceOrOptions.retry) : DEFAULT_RETRY;
		return {
			force: !!forceOrOptions.force,
			retry,
		};
	}
	return {
		force: !!forceOrOptions,
		retry: Number.isInteger(maybeRetry) ? Math.max(0, maybeRetry) : DEFAULT_RETRY,
	};
}

function requestWxCodeByUni() {
	return new Promise((resolve) => {
		if (typeof uni === 'undefined' || typeof uni.login !== 'function') {
			resolve({
				code: '',
				reason: 'uni.login unavailable',
			});
			return;
		}
		uni.login({
			provider: 'weixin',
			success: (res) => {
				resolve({
					code: (res && res.code) || '',
					reason: (res && res.errMsg) || '',
				});
			},
			fail: (err) => {
				resolve({
					code: '',
					reason: (err && (err.errMsg || err.message)) || '',
				});
			},
		});
	});
}

function requestWxCodeByNative() {
	return new Promise((resolve) => {
		if (!hasNativeWxLogin()) {
			resolve({
				code: '',
				reason: 'wx.login unavailable',
			});
			return;
		}
		wx.login({
			success: (res) => {
				resolve({
					code: (res && res.code) || '',
					reason: (res && res.errMsg) || '',
				});
			},
			fail: (err) => {
				resolve({
					code: '',
					reason: (err && (err.errMsg || err.message)) || '',
				});
			},
		});
	});
}

async function requestWxCodeOnce(attempt = 0) {
	const uniResult = await requestWxCodeByUni();
	if (uniResult.code) {
		updateWxCodeMeta({
			attempt: attempt + 1,
			codePresent: true,
			codeLength: uniResult.code.length,
			errMsg: uniResult.reason,
		});
		logWxLogin('uni.login success', {
			attempt: attempt + 1,
			codePresent: true,
			codeLength: uniResult.code.length,
			errMsg: uniResult.reason,
		});
		return uniResult;
	}

	const nativeResult = await requestWxCodeByNative();
	const mergedReason = [uniResult.reason, nativeResult.reason].filter(Boolean).join(' | ');
	const finalResult = nativeResult.code ? nativeResult : { code: '', reason: mergedReason };
	updateWxCodeMeta({
		attempt: attempt + 1,
		codePresent: !!finalResult.code,
		codeLength: finalResult.code ? finalResult.code.length : 0,
		errMsg: finalResult.reason,
	});
	logWxLogin(finalResult.code ? 'wx.login success' : 'wx.login empty code', {
		attempt: attempt + 1,
		codePresent: !!finalResult.code,
		codeLength: finalResult.code ? finalResult.code.length : 0,
		errMsg: finalResult.reason,
	});
	return finalResult;
}

async function fetchWxCodeWithRetry(retry = DEFAULT_RETRY) {
	let lastReason = '';
	for (let attempt = 0; attempt <= retry; attempt += 1) {
		const { code, reason } = await requestWxCodeOnce(attempt);
		if (code) {
			cachedCode = code;
			expiresAt = Date.now() + CODE_TTL;
			updateWxCodeMeta({
				attempt: attempt + 1,
				retryBudget: retry,
				codePresent: true,
				codeLength: code.length,
				errMsg: '',
			});
			logWxLogin('code cached', {
				attempt: attempt + 1,
				retryBudget: retry,
				codePresent: true,
				codeLength: code.length,
			});
			return code;
		}
		lastReason = reason || 'uni.login returned empty code';
		updateWxCodeMeta({
			attempt: attempt + 1,
			retryBudget: retry,
			codePresent: false,
			codeLength: 0,
			errMsg: lastReason,
		});
		logWxLogin('uni.login empty code', {
			attempt: attempt + 1,
			retryBudget: retry,
			codePresent: false,
			codeLength: 0,
			errMsg: lastReason,
		});
		if (attempt < retry) {
			await wait(120 * (attempt + 1));
		}
	}
	clearWxCode();
	console.warn('[auth] failed to get wx login code after retry:', lastReason);
	return '';
}

export function clearWxCode() {
	cachedCode = '';
	expiresAt = 0;
}

export function getWxCodeDebugInfo() {
	return {
		...lastWxCodeMeta,
		hasCachedCode: !!cachedCode,
		cacheExpiresInMs: Math.max(0, expiresAt - Date.now()),
	};
}

export function getCachedWxCode() {
	if (!isFresh()) return '';
	return cachedCode;
}

export function consumeWxCode() {
	if (!cachedCode) return '';
	const code = cachedCode;
	clearWxCode();
	return code;
}

export async function prefetchWxCode(forceOrOptions = false, maybeRetry) {
	if (!isMpWeixin()) return '';
	const { force, retry } = normalizeOptions(forceOrOptions, maybeRetry);
	if (!force && isFresh()) {
		logWxLogin('reuse cached code', {
			codePresent: true,
			codeLength: cachedCode.length,
		});
		return cachedCode;
	}
	if (inflight) {
		logWxLogin('await inflight code request');
		return inflight;
	}

	inflight = fetchWxCodeWithRetry(retry).finally(() => {
		inflight = null;
	});
	return inflight;
}

export async function getFreshWxCode(options) {
	if (!isMpWeixin()) return '';
	const { force, retry } = normalizeOptions(options || {}, DEFAULT_RETRY);
	if (!force && isFresh()) {
		logWxLogin('getFreshWxCode hit cache', {
			codePresent: true,
			codeLength: cachedCode.length,
		});
		return cachedCode;
	}
	await prefetchWxCode({ force: true, retry });
	return cachedCode;
}
