/**
 * imageOptimizer.js 单元测试
 */
import { supportsWebP, webpUrl, thumbnailUrl, avatarUrl, coverUrl } from '@/common/imageOptimizer.js';

// 重置 _supportsWebP 缓存：利用模块重新导入
// 由于条件编译 (#ifdef) 在 vitest 中不起作用，
// supportsWebP() 会走到最后的 _supportsWebP = true，所以默认返回 true

describe('imageOptimizer', () => {
	// ─── 基本保护 ───
	describe('空值/非法输入', () => {
		it('webpUrl: null / undefined / 空字符串 → 返回空字符串', () => {
			expect(webpUrl(null)).toBe('');
			expect(webpUrl(undefined)).toBe('');
			expect(webpUrl('')).toBe('');
		});

		it('thumbnailUrl: 非法输入 → 返回空字符串', () => {
			expect(thumbnailUrl(null)).toBe('');
			expect(thumbnailUrl('')).toBe('');
		});

		it('avatarUrl: 非法输入 → 返回空字符串', () => {
			expect(avatarUrl(null)).toBe('');
			expect(avatarUrl('')).toBe('');
		});

		it('coverUrl: 非法输入 → 返回空字符串', () => {
			expect(coverUrl(null)).toBe('');
			expect(coverUrl('')).toBe('');
		});
	});

	// ─── 非 OSS URL 原样返回 ───
	describe('非 OSS URL 原样返回', () => {
		const nonOssUrl = 'https://example.com/image.jpg';

		it('webpUrl 不处理非 OSS URL', () => {
			expect(webpUrl(nonOssUrl)).toBe(nonOssUrl);
		});

		it('thumbnailUrl 不处理非 OSS URL', () => {
			expect(thumbnailUrl(nonOssUrl)).toBe(nonOssUrl);
		});

		it('avatarUrl 不处理非 OSS URL', () => {
			expect(avatarUrl(nonOssUrl)).toBe(nonOssUrl);
		});

		it('coverUrl 不处理非 OSS URL', () => {
			expect(coverUrl(nonOssUrl)).toBe(nonOssUrl);
		});
	});

	// ─── OSS URL 识别 ───
	describe('OSS URL 识别', () => {
		const ossUrls = [
			'https://my-bucket.oss-cn-hangzhou.aliyuncs.com/img.jpg',
			'https://vkceyugu.cdn.bspapp.com/xxx/img.png',
			'https://xxx.bspapp.com/yyy/img.jpg',
			'cloud://my-cloud.xxx/img.png',
		];

		ossUrls.forEach((url) => {
			it(`识别 OSS URL: ${url.substring(0, 50)}...`, () => {
				const result = webpUrl(url);
				expect(result).toContain('x-oss-process=image/format,webp');
			});
		});
	});

	// ─── webpUrl ───
	describe('webpUrl', () => {
		const oss = 'https://bucket.oss-cn-hangzhou.aliyuncs.com/photo.jpg';

		it('添加 WebP 处理参数', () => {
			const result = webpUrl(oss);
			expect(result).toBe(oss + '?x-oss-process=image/format,webp');
		});

		it('已有 x-oss-process → 追加 /format,webp', () => {
			const urlWithProcess = oss + '?x-oss-process=image/resize,w_200';
			const result = webpUrl(urlWithProcess);
			expect(result).toBe(urlWithProcess + '/format,webp');
		});

		it('已有 format,webp → 不重复添加', () => {
			const urlWithWebp = oss + '?x-oss-process=image/format,webp';
			expect(webpUrl(urlWithWebp)).toBe(urlWithWebp);
		});
	});

	// ─── thumbnailUrl ───
	describe('thumbnailUrl', () => {
		const oss = 'https://bucket.oss-cn-hangzhou.aliyuncs.com/photo.jpg';

		it('生成带宽度和质量的缩略图 URL', () => {
			const result = thumbnailUrl(oss, 300, 90);
			expect(result).toContain('resize,w_300');
			expect(result).toContain('quality,Q_90');
			expect(result).toContain('format,webp');
		});

		it('默认宽度 200、质量 80', () => {
			const result = thumbnailUrl(oss);
			expect(result).toContain('resize,w_200');
			expect(result).toContain('quality,Q_80');
		});

		it('已有 x-oss-process → 追加参数', () => {
			const urlWithProcess = oss + '?x-oss-process=image/resize,w_100';
			const result = thumbnailUrl(urlWithProcess, 300);
			expect(result).toContain('resize,w_300');
		});
	});

	// ─── avatarUrl ───
	describe('avatarUrl', () => {
		const oss = 'https://bucket.oss-cn-hangzhou.aliyuncs.com/avatar.jpg';

		it('使用 m_fill 裁剪模式，宽=高', () => {
			const result = avatarUrl(oss, 80);
			expect(result).toContain('resize,m_fill,w_80,h_80');
			expect(result).toContain('quality,Q_85');
		});

		it('默认大小 120', () => {
			const result = avatarUrl(oss);
			expect(result).toContain('w_120,h_120');
		});
	});

	// ─── coverUrl ───
	describe('coverUrl', () => {
		const oss = 'https://bucket.oss-cn-hangzhou.aliyuncs.com/cover.jpg';

		it('16:9 裁剪', () => {
			const result = coverUrl(oss, 750);
			const expectedH = Math.round(750 * 9 / 16);
			expect(result).toContain(`resize,m_fill,w_750,h_${expectedH}`);
			expect(result).toContain('quality,Q_80');
		});

		it('默认宽度 750', () => {
			const result = coverUrl(oss);
			expect(result).toContain('w_750');
		});
	});
});
