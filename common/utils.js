/**
 * 通用工具函数模块
 */

export function debounce(fn, delay = 300, immediate = false) {
	let timer = null;
	const debounced = function (...args) {
		const context = this;
		if (timer) clearTimeout(timer);
		if (immediate && !timer) {
			fn.apply(context, args);
		}
		timer = setTimeout(() => {
			timer = null;
			if (!immediate) fn.apply(context, args);
		}, delay);
	};
	debounced.cancel = () => {
		clearTimeout(timer);
		timer = null;
	};
	return debounced;
}

export function throttle(fn, interval = 300, { leading = true, trailing = true } = {}) {
	let timer = null;
	let lastTime = 0;
	const throttled = function (...args) {
		const context = this;
		const now = Date.now();
		if (!leading && lastTime === 0) lastTime = now;
		const remaining = interval - (now - lastTime);
		if (remaining <= 0 || remaining > interval) {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			lastTime = now;
			fn.apply(context, args);
		} else if (!timer && trailing) {
			timer = setTimeout(() => {
				lastTime = leading ? Date.now() : 0;
				timer = null;
				fn.apply(context, args);
			}, remaining);
		}
	};
	throttled.cancel = () => {
		clearTimeout(timer);
		timer = null;
		lastTime = 0;
	};
	return throttled;
}

export function timeAgo(timestamp) {
	const now = Date.now();
	const date = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
	const diff = now - date;
	if (diff < 0) return '刚刚';
	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return '刚刚';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}小时前`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}天前`;
	if (days < 30) return `${Math.floor(days / 7)}周前`;
	if (days < 365) return `${Math.floor(days / 30)}个月前`;
	return `${Math.floor(days / 365)}年前`;
}

export function deepClone(obj) {
	if (obj === null || typeof obj !== 'object') return obj;
	if (obj instanceof Date) return new Date(obj.getTime());
	if (Array.isArray(obj)) return obj.map((item) => deepClone(item));
	const result = {};
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			result[key] = deepClone(obj[key]);
		}
	}
	return result;
}

export function formatNumber(num) {
	if (typeof num !== 'number' || Number.isNaN(num)) return '0';
	if (num < 1000) return String(num);
	if (num < 10000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
	if (num < 1000000) return Math.floor(num / 1000) + 'k';
	return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

export function safeJSONParse(str, fallback = null) {
	try {
		return JSON.parse(str);
	} catch {
		return fallback;
	}
}

export function uniqueId(prefix = '') {
	const ts = Date.now().toString(36);
	const rand = Math.random().toString(36).substring(2, 8);
	return prefix ? `${prefix}_${ts}${rand}` : `${ts}${rand}`;
}
