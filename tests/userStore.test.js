/**
 * Pinia User Store 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock uni-id-pages store
vi.mock('@/uni_modules/uni-id-pages/common/store.js', () => ({
	store: {
		hasLogin: true,
		token: 'mock_token',
		userInfo: {
			_id: 'uid_001',
			nickname: '测试用户',
			avatar_file: { url: 'https://example.com/avatar.png' },
			wx_openid: { 'mp-weixin': 'openid_001' },
		},
	},
}));

import { useUserStore } from '@/store/user.js';

describe('User Store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		// 模拟 uni-id-pages 写入的 userInfo
		uni.setStorageSync('uni-id-pages-userInfo', {
			_id: 'uid_001',
			nickname: '测试用户',
			avatar_file: { url: 'https://example.com/avatar.png' },
			wx_openid: { 'mp-weixin': 'openid_001' },
		});
		uni.setStorageSync('uni_id_token', 'mock_token');
	});

	describe('syncFromLogin', () => {
		it('从 uni-id 同步用户状态', () => {
			const store = useUserStore();
			store.syncFromLogin();

			expect(store.userId).toBe('uid_001');
			expect(store.nickname).toBe('测试用户');
			expect(store.openid).toBe('openid_001');
			expect(store.token).toBe('mock_token');
			expect(store.isLoggedIn).toBe(true);
			expect(store.hasLogin).toBe(true);
		});

		it('同步后持久化到 storage', () => {
			const store = useUserStore();
			store.syncFromLogin();

			// 通过 storage 的 prefix 验证持久化
			const raw = uni.getStorageSync('fit_userId');
			expect(raw).toBeTruthy();
			expect(raw.v).toBe('uid_001');
		});
	});

	describe('restoreFromStorage', () => {
		it('从 storage 恢复用户状态', () => {
			const store = useUserStore();
			// 先同步写入
			store.syncFromLogin();
			
			// 创建新 store 实例模拟冷启动
			const freshStore = useUserStore();
			freshStore.$reset();
			freshStore.restoreFromStorage();

			expect(freshStore.userId).toBe('uid_001');
			expect(freshStore.isLoggedIn).toBe(true);
		});
	});

	describe('updateProfile', () => {
		it('部分更新用户资料', () => {
			const store = useUserStore();
			store.syncFromLogin();
			store.updateProfile({ nickname: '新昵称' });

			expect(store.nickname).toBe('新昵称');
			expect(store.userId).toBe('uid_001'); // 不变
		});
	});

	describe('logout', () => {
		it('清理所有用户状态', () => {
			const store = useUserStore();
			store.syncFromLogin();
			expect(store.hasLogin).toBe(true);

			store.logout();

			expect(store.userId).toBe('');
			expect(store.token).toBe('');
			expect(store.isLoggedIn).toBe(false);
			expect(store.hasLogin).toBe(false);
			expect(store.profile).toBeNull();
		});
	});
});
