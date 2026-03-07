/**
 * cloudCall 重试与 Token 刷新单元测试
 */
import { describe, it, expect, beforeEach, vi as vitest } from 'vitest';

// Mock errorMonitor
vi.mock('@/common/errorMonitor.js', () => ({
	reportError: vi.fn(),
}));

// Mock uni-id-pages store
vi.mock('@/uni_modules/uni-id-pages/common/store.js', () => ({
	store: {
		token: 'initial_token',
	},
}));

import { callFunctionWithToken } from '@/services/cloudCall.js';

describe('cloudCall', () => {
	beforeEach(() => {
		uni.setStorageSync('uni_id_token', 'test_token');
		uniCloud.callFunction.mockReset();
		uniCloud.callFunction.mockResolvedValue({ result: { code: 0, data: { ok: true } } });
	});

	describe('正常请求', () => {
		it('成功调用云函数', async () => {
			const result = await callFunctionWithToken({
				name: 'fit-discover-api',
				data: { action: 'list' },
			});

			expect(uniCloud.callFunction).toHaveBeenCalledOnce();
			expect(result.result.data.ok).toBe(true);
		});

		it('自动注入 token', async () => {
			await callFunctionWithToken({
				name: 'fit-discover-api',
				data: { action: 'list' },
			});

			const callArgs = uniCloud.callFunction.mock.calls[0][0];
			expect(callArgs.data.uniIdToken).toBe('test_token');
			expect(callArgs.data.token).toBe('test_token');
		});
	});

	describe('网络错误重试', () => {
		it('网络错误后自动重试', async () => {
			uniCloud.callFunction
				.mockRejectedValueOnce(new Error('request:fail timeout'))
				.mockResolvedValueOnce({ result: { code: 0 } });

			const result = await callFunctionWithToken({
				name: 'test-api',
				data: {},
				timeout: 30000,
			});

			expect(uniCloud.callFunction).toHaveBeenCalledTimes(2);
			expect(result.result.code).toBe(0);
		});

		it('超过最大重试次数后抛出错误', async () => {
			uniCloud.callFunction.mockRejectedValue(new Error('request:fail network'));

			await expect(
				callFunctionWithToken({
					name: 'test-api',
					data: {},
					timeout: 30000,
				})
			).rejects.toThrow('request:fail network');

			// 1 初始 + 3 重试 = 4
			expect(uniCloud.callFunction).toHaveBeenCalledTimes(4);
		}, 30000);
	});

	describe('Token 过期处理', () => {
		it('token 过期 → 刷新 → 重放请求', async () => {
			uniCloud.callFunction
				.mockResolvedValueOnce({ result: { errCode: 'TOKEN_INVALID', errMsg: 'token invalid' } })
				.mockResolvedValueOnce({ result: { code: 0, data: { ok: true } } });

			const result = await callFunctionWithToken({
				name: 'test-api',
				data: {},
			});

			expect(uniCloud.callFunction).toHaveBeenCalledTimes(2);
			expect(result.result.data.ok).toBe(true);
		});
	});

	describe('超时保护', () => {
		it('请求超时抛出错误', async () => {
			uniCloud.callFunction.mockImplementation(
				() => new Promise((resolve) => setTimeout(resolve, 5000))
			);

			await expect(
				callFunctionWithToken({
					name: 'test-api',
					data: {},
					timeout: 100, // 100ms 超时
				})
			).rejects.toThrow('timeout');
		}, 10000);
	});
});
