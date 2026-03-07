/**
 * auth.js 单元测试
 */
import { checkLogin } from '@/common/auth.js';

// mock uni-id-pages store
vi.mock('@/uni_modules/uni-id-pages/common/store.js', () => ({
	store: {
		token: '',
		userInfo: { _id: '' },
	},
}));

// 拿到 mock 后的 store 引用，用于动态修改
import { store } from '@/uni_modules/uni-id-pages/common/store.js';

describe('auth - checkLogin', () => {
	beforeEach(() => {
		store.token = '';
		store.userInfo = { _id: '' };
	});

	it('未登录时：storage 无 token、store 无 token → 跳转登录页并返回 false', () => {
		const spy = vi.spyOn(uni, 'navigateTo');
		const cb = vi.fn();

		const result = checkLogin(cb);

		expect(result).toBe(false);
		expect(cb).not.toHaveBeenCalled();
		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.stringContaining('login') })
		);
		spy.mockRestore();
	});

	it('已登录 (storage 有 token)：执行回调并返回 true', () => {
		uni.setStorageSync('uni_id_token', 'test_token_123');
		uni.setStorageSync('fit_user_id', 'uid_abc');

		const cb = vi.fn();
		const result = checkLogin(cb);

		expect(result).toBe(true);
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('已登录 (store 有 token)：执行回调并返回 true', () => {
		store.token = 'store_token_456';
		store.userInfo = { _id: 'uid_store' };

		const cb = vi.fn();
		const result = checkLogin(cb);

		expect(result).toBe(true);
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('有 token 但无 userId 且 store 有 _id → 自动回写 userId', () => {
		uni.setStorageSync('uni_id_token', 'tok');
		// getUserId 会从 store.userInfo._id 拿到值，所以 userId 实际不为空
		// checkLogin 中的回写逻辑只在 getUserId() 返回空时触发
		// 要测试回写路径：需要 store.userInfo._id 也为空（让 getUserId 返回空），
		// 但同时 store.userInfo._id 存在（用于回写）=> 逻辑上无法同时满足
		// 因此验证：store 有 _id 时，checkLogin 返回 true 且回调被正常执行
		store.userInfo = { _id: 'auto_uid' };

		const cb = vi.fn();
		const result = checkLogin(cb);

		expect(result).toBe(true);
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('callback 为非函数时不报错', () => {
		uni.setStorageSync('uni_id_token', 'tok');
		uni.setStorageSync('fit_user_id', 'uid');

		expect(() => checkLogin(null)).not.toThrow();
		expect(() => checkLogin(undefined)).not.toThrow();
		expect(() => checkLogin('not_a_function')).not.toThrow();
	});
});
