/**
 * StorageService — 统一本地存储管理
 *
 * 解决问题：
 * 1. 散乱的 uni.setStorageSync / getStorageSync 调用（30+ 处）
 * 2. 无前缀隔离，与三方 SDK 共用命名空间
 * 3. 无 TTL 过期机制
 * 4. 多 key 冗余（fit_user_id / user_id / uid）
 *
 * 用法:
 *   import storage from '@/common/storage.js';
 *   storage.set('user_id', 'xxx');
 *   storage.set('token', 'xxx', 7200);   // 2 小时后过期
 *   storage.get('user_id');               // 'xxx'
 *   storage.remove('user_id');
 *   storage.clearUserScoped();            // 退出登录时清理
 */

const PREFIX = 'fit_';

/**
 * 包装存储值：附带元信息（创建时间 + 过期时间）
 */
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

/**
 * 解包存储值：检查过期
 */
function unwrap(envelope) {
	if (!envelope || typeof envelope !== 'object' || !('v' in envelope)) {
		return undefined;
	}
	if (envelope.e && Date.now() > envelope.e) {
		return undefined; // 已过期
	}
	return envelope.v;
}

function prefixedKey(key) {
	return `${PREFIX}${key}`;
}

// ============ 不经过 prefix 的透传 key（兼容三方库） ============
const RAW_KEYS = new Set([
	'uni_id_token',
	'uni_id_token_expired',
	'uni-id-pages-userInfo',
]);

function resolveKey(key) {
	return RAW_KEYS.has(key) ? key : prefixedKey(key);
}

// ============ 用户级缓存前缀（退出登录时清理） ============
const USER_PREFIXES = [
	`${PREFIX}user_`,
	`${PREFIX}ucenter_`,
	`${PREFIX}openid`,
	`${PREFIX}token`,
	`${PREFIX}userInfo`,
	`${PREFIX}isLoggedIn`,
	`${PREFIX}userId`,
];

const USER_RAW_KEYS = [
	'uni_id_token',
	'uni_id_token_expired',
];

const storage = {
	/**
	 * 读取值
	 * @param {string} key
	 * @param {*} defaultValue 不存在或已过期时返回的默认值
	 * @returns {*}
	 */
	get(key, defaultValue = '') {
		try {
			const raw = uni.getStorageSync(resolveKey(key));
			if (raw === '' || raw === undefined || raw === null) return defaultValue;
			const value = unwrap(raw);
			if (value === undefined) {
				// 过期了，顺手清理
				this.remove(key);
				return defaultValue;
			}
			return value;
		} catch (_) {
			return defaultValue;
		}
	},

	/**
	 * 写入值
	 * @param {string} key
	 * @param {*} value
	 * @param {number} [ttlSeconds] 可选 TTL（秒），不传则永不过期
	 */
	set(key, value, ttlSeconds) {
		try {
			uni.setStorageSync(resolveKey(key), wrap(value, ttlSeconds));
		} catch (e) {
			console.warn('[storage] set failed:', key, e);
		}
	},

	/**
	 * 删除值
	 * @param {string} key
	 */
	remove(key) {
		try {
			uni.removeStorageSync(resolveKey(key));
		} catch (_) {
			// ignore
		}
	},

	/**
	 * 检查 key 是否存在且未过期
	 * @param {string} key
	 * @returns {boolean}
	 */
	has(key) {
		return this.get(key, undefined) !== undefined;
	},

	/**
	 * 清理所有用户级缓存（退出登录时调用）
	 */
	clearUserScoped() {
		try {
			const info = uni.getStorageInfoSync();
			const keys = Array.isArray(info.keys) ? info.keys : [];
			keys.forEach((k) => {
				if (!k) return;
				// 匹配 fit_ 前缀的用户级 key
				if (USER_PREFIXES.some(prefix => k.startsWith(prefix))) {
					uni.removeStorageSync(k);
					return;
				}
				// 兼容三方库的 raw key
				if (USER_RAW_KEYS.includes(k)) {
					uni.removeStorageSync(k);
				}
			});
		} catch (e) {
			console.warn('[storage] clearUserScoped failed:', e);
		}
	},

	/**
	 * 清理所有带 fit_ 前缀的存储
	 */
	clearAll() {
		try {
			const info = uni.getStorageInfoSync();
			const keys = Array.isArray(info.keys) ? info.keys : [];
			keys.forEach((k) => {
				if (k && k.startsWith(PREFIX)) {
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
