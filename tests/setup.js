/**
 * 全局 mock：模拟小程序 uni / uniCloud 环境
 * vitest setup file
 */

// -------- uni 全局对象 --------
const _storage = new Map();

globalThis.uni = {
	getStorageSync(key) {
		return _storage.get(key) ?? '';
	},
	setStorageSync(key, value) {
		_storage.set(key, value);
	},
	removeStorageSync(key) {
		_storage.delete(key);
	},
	getStorageInfoSync() {
		return { keys: Array.from(_storage.keys()) };
	},
	showToast() {},
	showLoading() {},
	hideLoading() {},
	showModal() {},
	reLaunch() {},
	switchTab() {},
	navigateTo() {},
	navigateBack() {},
	$on() {},
	$off() {},
	$emit() {},
	onError() {},
	getSystemInfoSync() {
		return { platform: 'test', model: 'vitest', system: 'test', version: '1.0', SDKVersion: '1.0' };
	},
};

// -------- uniCloud 全局对象 --------
globalThis.uniCloud = {
	callFunction: vi.fn().mockResolvedValue({ result: { code: 0, data: {} } }),
	importObject: vi.fn().mockReturnValue({
		refreshToken: vi.fn().mockResolvedValue({ newToken: { token: 'new_token', tokenExpired: Date.now() + 7200000 } }),
	}),
	getCurrentUserInfo: vi.fn().mockReturnValue({ uid: 'test_uid' }),
};

// -------- getCurrentPages --------
globalThis.getCurrentPages = () => [{ route: 'pages/test/test' }];

// -------- process.env --------
process.env.NODE_ENV = 'test';

// -------- 每个测试后重置 storage --------
afterEach(() => {
	_storage.clear();
});
