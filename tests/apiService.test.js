/**
 * apiService.js 单元测试
 * 重点测试纯逻辑函数及内容安全校验集成
 */
import { describe, it, expect, vi } from 'vitest';
import { apiService } from '@/services/apiService.js';

// mock 依赖
vi.mock('@/uni_modules/uni-id-pages/common/store.js', () => ({
	store: { token: 'mock_token', userInfo: { _id: 'mock_uid' } },
}));

vi.mock('@/services/cloudCall.js', () => ({
	callFunctionWithToken: vi.fn().mockResolvedValue({
		result: { code: 0, data: { list: [] } },
	}),
}));

vi.mock('@/common/perfMonitor.js', () => ({
	default: {
		markApiStart: vi.fn(),
		markApiEnd: vi.fn(),
	},
}));

vi.mock('@/common/cacheManager.js', () => ({
	default: {
		getOrFetch: vi.fn((key, fetcher) => fetcher()),
		optimisticUpdate: vi.fn((key, data, updater) => updater()),
	},
}));

describe('apiService', () => {
	// ─── isProfileComplete ───
	describe('isProfileComplete', () => {
		const complete = {
			nickname: '小明',
			avatarUrl: 'https://img.com/a.jpg',
			gender: '男',
			age: 25,
			gyms: ['力量训练'],
			bio: '热爱健身',
		};

		it('完整资料 → true', () => {
			expect(apiService.isProfileComplete(complete)).toBe(true);
		});

		it('缺少 nickname → false', () => {
			expect(apiService.isProfileComplete({ ...complete, nickname: '' })).toBe(false);
		});

		it('缺少 avatarUrl → false', () => {
			expect(apiService.isProfileComplete({ ...complete, avatarUrl: '' })).toBe(false);
		});

		it('缺少 gender → false', () => {
			expect(apiService.isProfileComplete({ ...complete, gender: '' })).toBe(false);
		});

		it('age <= 0 → false', () => {
			expect(apiService.isProfileComplete({ ...complete, age: 0 })).toBe(false);
			expect(apiService.isProfileComplete({ ...complete, age: -1 })).toBe(false);
		});

		it('age 非数字 → false', () => {
			expect(apiService.isProfileComplete({ ...complete, age: 'abc' })).toBe(false);
		});

		it('gyms 为空数组 → false', () => {
			expect(apiService.isProfileComplete({ ...complete, gyms: [] })).toBe(false);
		});

		it('缺少 bio → false', () => {
			expect(apiService.isProfileComplete({ ...complete, bio: '' })).toBe(false);
		});

		it('空对象 → false', () => {
			expect(apiService.isProfileComplete({})).toBe(false);
		});

		it('无参数 → false', () => {
			expect(apiService.isProfileComplete()).toBe(false);
		});
	});

	// ─── parseList ───
	describe('parseList', () => {
		it('null / undefined → 空数组', () => {
			expect(apiService.parseList(null)).toEqual([]);
			expect(apiService.parseList(undefined)).toEqual([]);
		});

		it('直接是数组 → 原样返回', () => {
			const arr = [1, 2, 3];
			expect(apiService.parseList(arr)).toBe(arr);
		});

		it('{ list: [...] } → 取 list', () => {
			expect(apiService.parseList({ list: [1] })).toEqual([1]);
		});

		it('{ data: [...] } → 取 data', () => {
			expect(apiService.parseList({ data: [2] })).toEqual([2]);
		});

		it('{ records: [...] } → 取 records', () => {
			expect(apiService.parseList({ records: [3] })).toEqual([3]);
		});

		it('优先级：直接数组 > list > data > records', () => {
			// { list, data } → 取 list
			expect(apiService.parseList({ list: ['l'], data: ['d'] })).toEqual(['l']);
		});

		it('无法识别的格式 → 空数组', () => {
			expect(apiService.parseList({ foo: 'bar' })).toEqual([]);
		});
	});

	// ─── 发布内容校验集成 ───
	describe('publishFeed 内容校验', () => {
		it('包含敏感词 → 抛出错误', async () => {
			await expect(
				apiService.publishFeed({ content: '来赌博吧' })
			).rejects.toThrow();
		});

		it('内容超长 → 抛出错误', async () => {
			await expect(
				apiService.publishFeed({ content: 'x'.repeat(5001) })
			).rejects.toThrow();
		});
	});

	describe('commentFeed 内容校验', () => {
		it('包含敏感词 → 抛出错误', async () => {
			await expect(
				apiService.commentFeed('feedId', '加微信私聊')
			).rejects.toThrow();
		});

		it('空评论 → 抛出错误', async () => {
			await expect(
				apiService.commentFeed('feedId', '')
			).rejects.toThrow();
		});
	});

	describe('sendInvite 内容校验', () => {
		it('邀约消息包含敏感词 → 抛出错误', async () => {
			await expect(
				apiService.sendInvite('userId', {
					message: '免费领取大奖',
					date: '2024-01-01',
					place: '健身房',
				})
			).rejects.toThrow();
		});
	});

	// ─── uploadImage 校验 ───
	describe('uploadImage 文件校验', () => {
		it('不支持的文件格式 → 抛出错误', async () => {
			await expect(
				apiService.uploadImage('/tmp/doc.pdf')
			).rejects.toThrow();
		});

		it('无效路径 → 抛出错误', async () => {
			await expect(
				apiService.uploadImage('')
			).rejects.toThrow();
		});
	});
});
