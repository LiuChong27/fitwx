/**
 * cacheManager.js 单元测试
 */
import cache from '@/common/cacheManager.js';

describe('cacheManager', () => {
	beforeEach(() => {
		cache.clear();
	});

	// ─── 基本 CRUD ───
	describe('get / set / remove', () => {
		it('set 后 get 返回数据', () => {
			cache.set('key1', { name: 'test' });
			expect(cache.get('key1')).toEqual({ name: 'test' });
		});

		it('未设置的 key 返回 null', () => {
			expect(cache.get('nonexistent')).toBeNull();
		});

		it('remove 后 get 返回 null', () => {
			cache.set('key1', 'val');
			cache.remove('key1');
			expect(cache.get('key1')).toBeNull();
		});

		it('clear 清空所有缓存', () => {
			cache.set('a', 1);
			cache.set('b', 2);
			cache.clear();
			expect(cache.get('a')).toBeNull();
			expect(cache.get('b')).toBeNull();
		});
	});

	// ─── TTL 过期 ───
	describe('TTL 过期', () => {
		it('超过 TTL 后 get 返回 null', () => {
			vi.useFakeTimers();
			cache.set('ttl_key', 'value', 1); // 1 秒 TTL
			vi.advanceTimersByTime(1100); // 超过 1 秒
			expect(cache.get('ttl_key')).toBeNull();
			vi.useRealTimers();
		});

		it('TTL 内 get 返回数据', () => {
			vi.useFakeTimers();
			cache.set('ttl_key', 'value', 5);
			vi.advanceTimersByTime(3000); // 3 秒，未超过 5 秒
			expect(cache.get('ttl_key')).toBe('value');
			vi.useRealTimers();
		});
	});

	// ─── getOrFetch (SWR) ───
	describe('getOrFetch', () => {
		it('无缓存时调用 fetcher 并缓存结果', async () => {
			const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
			const result = await cache.getOrFetch('swr_key', fetcher);
			expect(result).toEqual({ data: 'fresh' });
			expect(fetcher).toHaveBeenCalledTimes(1);
			// 验证已缓存
			expect(cache.get('swr_key')).toEqual({ data: 'fresh' });
		});

		it('有缓存时立即返回缓存，后台静默刷新', async () => {
			cache.set('swr_key', { data: 'stale' }, 300);

			let resolveRefresh;
			const fetcher = vi.fn().mockReturnValue(
				new Promise(r => { resolveRefresh = r; })
			);

			const result = await cache.getOrFetch('swr_key', fetcher);
			// 立即返回旧数据
			expect(result).toEqual({ data: 'stale' });
			// fetcher 被后台调用
			expect(fetcher).toHaveBeenCalledTimes(1);

			// 完成后台刷新
			resolveRefresh({ data: 'refreshed' });
			// 等待微任务完成
			await new Promise(r => setTimeout(r, 10));
			expect(cache.get('swr_key')).toEqual({ data: 'refreshed' });
		});

		it('forceRefresh = true 时强制调用 fetcher', async () => {
			cache.set('swr_key', { data: 'old' }, 300);
			const fetcher = vi.fn().mockResolvedValue({ data: 'new' });

			const result = await cache.getOrFetch('swr_key', fetcher, { forceRefresh: true });
			expect(result).toEqual({ data: 'new' });
		});
	});

	// ─── optimisticUpdate ───
	describe('optimisticUpdate', () => {
		it('成功：缓存更新为 newData', async () => {
			cache.set('opt_key', 'old_data');
			const updater = vi.fn().mockResolvedValue(undefined);

			await cache.optimisticUpdate('opt_key', 'new_data', updater);
			expect(cache.get('opt_key')).toBe('new_data');
			expect(updater).toHaveBeenCalledTimes(1);
		});

		it('失败：回滚到 oldData', async () => {
			cache.set('opt_key', 'old_data');
			const updater = vi.fn().mockRejectedValue(new Error('network'));

			await expect(
				cache.optimisticUpdate('opt_key', 'new_data', updater)
			).rejects.toThrow('network');

			expect(cache.get('opt_key')).toBe('old_data');
		});

		it('失败且无旧数据：删除缓存', async () => {
			const updater = vi.fn().mockRejectedValue(new Error('fail'));

			await expect(
				cache.optimisticUpdate('no_old', 'new_val', updater)
			).rejects.toThrow('fail');

			expect(cache.get('no_old')).toBeNull();
		});
	});

	// ─── 内存缓存上限 ───
	describe('MAX_MEM_CACHE_SIZE 淘汰', () => {
		it('超过 100 条时淘汰最旧的条目', () => {
			// 填满 100 条
			for (let i = 0; i < 100; i++) {
				cache.set(`item_${i}`, i);
			}
			// 第 1 条还在
			expect(cache.get('item_0')).toBe(0);

			// 第 101 条导致淘汰
			cache.set('item_100', 100);
			// 内存缓存中 item_0 被淘汰（但可能从 storage 回读）
			// 验证：直接检查内存缓存
			expect(cache._memCache.has('item_0')).toBe(false);
			expect(cache._memCache.has('item_100')).toBe(true);
		});
	});
});
