/**
 * utils.js 单元测试
 */
import {
	debounce,
	throttle,
	timeAgo,
	deepClone,
	formatNumber,
	safeJSONParse,
	uniqueId,
} from '@/common/utils.js';

// ─── debounce ───
describe('debounce', () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it('延迟执行：在 delay 内重复调用只执行最后一次', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 200);

		debounced('a');
		debounced('b');
		debounced('c');
		vi.advanceTimersByTime(200);

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('c');
	});

	it('immediate = true：首次调用立即执行', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 200, true);

		debounced('first');
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('first');

		debounced('second');
		vi.advanceTimersByTime(200);
		// immediate 模式下 delay 结束后不再执行
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('cancel() 可取消待执行的延时', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 200);

		debounced();
		debounced.cancel();
		vi.advanceTimersByTime(300);

		expect(fn).not.toHaveBeenCalled();
	});
});

// ─── throttle ───
describe('throttle', () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it('固定间隔执行：高频触发时按间隔执行', () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 300);

		throttled(); // 立即执行 (leading)
		expect(fn).toHaveBeenCalledTimes(1);

		throttled(); // 被节流
		throttled(); // 被节流
		vi.advanceTimersByTime(300);
		// trailing 执行
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('leading=false：首次不立即执行', () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 300, { leading: false });

		throttled();
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('trailing=false：间隔结束后不补执行', () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 300, { trailing: false });

		throttled(); // leading 执行
		expect(fn).toHaveBeenCalledTimes(1);

		throttled(); // 被节流，且 trailing=false 不会补执行
		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('cancel() 重置节流状态', () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 300);

		throttled();
		throttled.cancel();

		// cancel 后应重置 lastTime，再次调用立即执行
		throttled();
		expect(fn).toHaveBeenCalledTimes(2);
	});
});

// ─── timeAgo ───
describe('timeAgo', () => {
	it('返回"刚刚"当时间差 < 60s', () => {
		expect(timeAgo(Date.now())).toBe('刚刚');
		expect(timeAgo(Date.now() - 30000)).toBe('刚刚');
	});

	it('返回"X分钟前"', () => {
		expect(timeAgo(Date.now() - 5 * 60 * 1000)).toBe('5分钟前');
	});

	it('返回"X小时前"', () => {
		expect(timeAgo(Date.now() - 3 * 3600 * 1000)).toBe('3小时前');
	});

	it('返回"X天前"', () => {
		expect(timeAgo(Date.now() - 2 * 86400 * 1000)).toBe('2天前');
	});

	it('返回"X周前"', () => {
		expect(timeAgo(Date.now() - 14 * 86400 * 1000)).toBe('2周前');
	});

	it('返回"X个月前"', () => {
		expect(timeAgo(Date.now() - 60 * 86400 * 1000)).toBe('2个月前');
	});

	it('返回"X年前"', () => {
		expect(timeAgo(Date.now() - 400 * 86400 * 1000)).toBe('1年前');
	});

	it('未来时间返回"刚刚"', () => {
		expect(timeAgo(Date.now() + 100000)).toBe('刚刚');
	});

	it('支持 Date 对象', () => {
		const d = new Date(Date.now() - 120000);
		expect(timeAgo(d)).toBe('2分钟前');
	});
});

// ─── deepClone ───
describe('deepClone', () => {
	it('深拷贝普通对象', () => {
		const obj = { a: 1, b: { c: 2 } };
		const cloned = deepClone(obj);

		expect(cloned).toEqual(obj);
		expect(cloned).not.toBe(obj);
		expect(cloned.b).not.toBe(obj.b);
	});

	it('深拷贝数组', () => {
		const arr = [1, [2, 3], { x: 4 }];
		const cloned = deepClone(arr);

		expect(cloned).toEqual(arr);
		expect(cloned[1]).not.toBe(arr[1]);
		expect(cloned[2]).not.toBe(arr[2]);
	});

	it('处理 Date 对象', () => {
		const date = new Date('2024-01-01');
		const cloned = deepClone(date);

		expect(cloned).toEqual(date);
		expect(cloned).not.toBe(date);
	});

	it('处理原始值', () => {
		expect(deepClone(null)).toBe(null);
		expect(deepClone(42)).toBe(42);
		expect(deepClone('str')).toBe('str');
		expect(deepClone(undefined)).toBe(undefined);
	});
});

// ─── formatNumber ───
describe('formatNumber', () => {
	it('小于 1000 直接输出', () => {
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(999)).toBe('999');
	});

	it('1000~9999 → Xk / X.Xk', () => {
		expect(formatNumber(1200)).toBe('1.2k');
		expect(formatNumber(1000)).toBe('1k');
		expect(formatNumber(5500)).toBe('5.5k');
	});

	it('10000+ → Xk', () => {
		expect(formatNumber(10000)).toBe('10k');
		expect(formatNumber(123456)).toBe('123k');
	});

	it('100万+ → XM', () => {
		expect(formatNumber(1000000)).toBe('1M');
		expect(formatNumber(1500000)).toBe('1.5M');
	});

	it('非数字返回 "0"', () => {
		expect(formatNumber(NaN)).toBe('0');
		expect(formatNumber('abc')).toBe('0');
	});
});

// ─── safeJSONParse ───
describe('safeJSONParse', () => {
	it('正常解析 JSON', () => {
		expect(safeJSONParse('{"a":1}')).toEqual({ a: 1 });
		expect(safeJSONParse('[1,2,3]')).toEqual([1, 2, 3]);
	});

	it('解析失败返回 fallback', () => {
		expect(safeJSONParse('not json')).toBeNull();
		expect(safeJSONParse('', [])).toEqual([]);
		expect(safeJSONParse(undefined, 'default')).toBe('default');
	});
});

// ─── uniqueId ───
describe('uniqueId', () => {
	it('每次生成唯一值', () => {
		const ids = new Set(Array.from({ length: 100 }, () => uniqueId()));
		expect(ids.size).toBe(100);
	});

	it('支持 prefix', () => {
		const id = uniqueId('msg');
		expect(id.startsWith('msg_')).toBe(true);
	});

	it('无 prefix 不含下划线前缀', () => {
		const id = uniqueId();
		expect(id).not.toContain('_');
	});
});
