/**
 * StorageService - 统一本地存储管理
 */

const PREFIX = 'fit_';
const RETRYABLE_STORAGE_ERROR_MARKERS = ['jsapi has no permission', 'invalid running state', 'setStorageSync:fail'];
const RETRY_DELAYS_MS = [120, 320, 800, 1600, 3200];
const memoryFallback = new Map();
const deferredWrites = new Map();

function wrap(value, ttlSeconds) {
	const envelope = {
		v: value,
		t: Date.now(),
	};
	if (ttlSeconds && ttlSeconds > 0) {
		envelope.e = Date.now() + ttlSeconds * 1000;
	}
	return envelope;
}

function unwrap(envelope) {
	if (!envelope || typeof envelope !== 'object' || !('v' in envelope)) {
		return undefined;
	}
	if (envelope.e && Date.now() > envelope.e) {
		return undefined;
	}
	return envelope.v;
}

function prefixedKey(key) {
	return `${PREFIX}${key}`;
}

const RAW_KEYS = new Set(['uni_id_token', 'uni_id_token_expired', 'uni-id-pages-userInfo']);

function resolveKey(key) {
	return RAW_KEYS.has(key) ? key : prefixedKey(key);
}

const USER_PREFIXES = [
	`${PREFIX}user_`,
	`${PREFIX}ucenter_`,
	`${PREFIX}openid`,
	`${PREFIX}token`,
	`${PREFIX}userInfo`,
	`${PREFIX}isLoggedIn`,
	`${PREFIX}userId`,
];

const USER_RAW_KEYS = ['uni_id_token', 'uni_id_token_expired'];

function getErrorMessage(error) {
	return String((error && (error.errMsg || error.message)) || '');
}

function isRetryableStorageError(error) {
	const errMsg = getErrorMessage(error);
	return RETRYABLE_STORAGE_ERROR_MARKERS.some((marker) => errMsg.includes(marker));
}

function clearDeferredWrite(storageKey) {
	const entry = deferredWrites.get(storageKey);
	if (entry && entry.timer) {
		clearTimeout(entry.timer);
	}
	deferredWrites.delete(storageKey);
}

function clearDeferredWriteByResolvedKey(storageKey) {
	clearDeferredWrite(storageKey);
	memoryFallback.delete(storageKey);
}

function persistEnvelope(storageKey, envelope) {
	uni.setStorageSync(storageKey, envelope);
	memoryFallback.delete(storageKey);
	clearDeferredWrite(storageKey);
}

function scheduleDeferredWrite(storageKey, envelope, attempt = 0) {
	const existing = deferredWrites.get(storageKey);
	if (existing && existing.timer) {
		clearTimeout(existing.timer);
	}

	const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
	const timer = setTimeout(() => {
		try {
			persistEnvelope(storageKey, envelope);
		} catch (error) {
			if (isRetryableStorageError(error) && attempt + 1 < RETRY_DELAYS_MS.length) {
				scheduleDeferredWrite(storageKey, envelope, attempt + 1);
				return;
			}
			console.warn('[storage] deferred persist failed:', storageKey, error);
			deferredWrites.delete(storageKey);
		}
	}, delay);

	deferredWrites.set(storageKey, {
		envelope,
		attempt,
		timer,
	});
}

function rememberDeferredWrite(storageKey, envelope, error) {
	memoryFallback.set(storageKey, envelope);
	scheduleDeferredWrite(storageKey, envelope, 0);
	console.warn('[storage] set deferred until runtime is writable:', storageKey, error);
}

export function flushDeferredStorageWrites() {
	for (const [storageKey, entry] of deferredWrites.entries()) {
		if (entry && entry.timer) {
			clearTimeout(entry.timer);
		}
		try {
			persistEnvelope(storageKey, entry.envelope);
		} catch (error) {
			if (isRetryableStorageError(error)) {
				scheduleDeferredWrite(storageKey, entry.envelope, (entry.attempt || 0) + 1);
				continue;
			}
			console.warn('[storage] flush deferred write failed:', storageKey, error);
			deferredWrites.delete(storageKey);
		}
	}
}

const storage = {
	get(key, defaultValue = '') {
		const storageKey = resolveKey(key);
		try {
			const raw = uni.getStorageSync(storageKey);
			if (raw !== '' && raw !== undefined && raw !== null) {
				const value = unwrap(raw);
				if (value !== undefined) {
					return value;
				}
				this.remove(key);
				return defaultValue;
			}
		} catch (_) {
			// ignore and continue to memory fallback
		}

		const pending = memoryFallback.get(storageKey);
		if (!pending) return defaultValue;
		const value = unwrap(pending);
		if (value === undefined) {
			clearDeferredWriteByResolvedKey(storageKey);
			return defaultValue;
		}
		return value;
	},

	set(key, value, ttlSeconds) {
		const storageKey = resolveKey(key);
		const envelope = wrap(value, ttlSeconds);
		try {
			persistEnvelope(storageKey, envelope);
		} catch (error) {
			if (isRetryableStorageError(error)) {
				rememberDeferredWrite(storageKey, envelope, error);
				return;
			}
			console.warn('[storage] set failed:', key, error);
		}
	},

	remove(key) {
		const storageKey = resolveKey(key);
		clearDeferredWriteByResolvedKey(storageKey);
		try {
			uni.removeStorageSync(storageKey);
		} catch (_) {
			// ignore
		}
	},

	has(key) {
		return this.get(key, undefined) !== undefined;
	},

	clearUserScoped() {
		try {
			const info = uni.getStorageInfoSync();
			const keys = Array.isArray(info.keys) ? info.keys : [];
			keys.forEach((k) => {
				if (!k) return;
				if (USER_PREFIXES.some((prefix) => k.startsWith(prefix))) {
					clearDeferredWriteByResolvedKey(k);
					uni.removeStorageSync(k);
					return;
				}
				if (USER_RAW_KEYS.includes(k)) {
					clearDeferredWriteByResolvedKey(k);
					uni.removeStorageSync(k);
				}
			});
		} catch (e) {
			console.warn('[storage] clearUserScoped failed:', e);
		}
	},

	clearAll() {
		try {
			const info = uni.getStorageInfoSync();
			const keys = Array.isArray(info.keys) ? info.keys : [];
			keys.forEach((k) => {
				if (k && k.startsWith(PREFIX)) {
					clearDeferredWriteByResolvedKey(k);
					uni.removeStorageSync(k);
				}
			});
		} catch (e) {
			console.warn('[storage] clearAll failed:', e);
		}
	},
};

export { storage, PREFIX };
export default storage;
