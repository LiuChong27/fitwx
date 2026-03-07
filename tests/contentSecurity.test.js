/**
 * contentSecurity.js 单元测试
 */
import {
	validateText,
	validateImageFile,
	hasSensitiveWord,
	ContentType,
	LENGTH_LIMITS,
	IMAGE_MAX_SIZE_MB,
	IMAGE_MAX_SIZE_BYTES,
	IMAGE_ALLOWED_EXTENSIONS,
} from '@/common/contentSecurity.js';

// ─── validateText ───
describe('validateText', () => {
	describe('基本校验', () => {
		it('非字符串 → 无效', () => {
			expect(validateText(null).valid).toBe(false);
			expect(validateText(123).valid).toBe(false);
			expect(validateText(undefined).valid).toBe(false);
		});

		it('空字符串 → 无效 (min > 0 的类型)', () => {
			expect(validateText('', ContentType.CHAT).valid).toBe(false);
			expect(validateText('   ', ContentType.CHAT).valid).toBe(false);
		});

		it('BIO 允许空字符串 (min = 0)', () => {
			expect(validateText('', ContentType.BIO).valid).toBe(true);
		});

		it('正常文本 → 有效，返回 sanitized（trim 后）', () => {
			const r = validateText('  你好世界  ', ContentType.CHAT);
			expect(r.valid).toBe(true);
			expect(r.sanitized).toBe('你好世界');
		});
	});

	describe('各类型长度限制', () => {
		it('CHAT 超过 2000 字 → 无效', () => {
			const long = 'a'.repeat(2001);
			expect(validateText(long, ContentType.CHAT).valid).toBe(false);
		});

		it('FEED 超过 5000 字 → 无效', () => {
			const long = 'a'.repeat(5001);
			expect(validateText(long, ContentType.FEED).valid).toBe(false);
		});

		it('COMMENT 超过 500 字 → 无效', () => {
			const long = 'a'.repeat(501);
			expect(validateText(long, ContentType.COMMENT).valid).toBe(false);
		});

		it('INVITE 超过 500 字 → 无效', () => {
			const long = 'a'.repeat(501);
			expect(validateText(long, ContentType.INVITE).valid).toBe(false);
		});

		it('BIO 超过 200 字 → 无效', () => {
			const long = 'a'.repeat(201);
			expect(validateText(long, ContentType.BIO).valid).toBe(false);
		});

		it('恰好等于上限 → 有效', () => {
			const exact = 'a'.repeat(2000);
			expect(validateText(exact, ContentType.CHAT).valid).toBe(true);
		});
	});

	describe('敏感词检测', () => {
		const sensitiveWords = [
			'赌博', '色情', '冰毒', '刷单', '稳赚不赔',
			'加微信', '加QQ', '翻墙', 'VPN', '傻逼',
		];

		sensitiveWords.forEach(word => {
			it(`包含"${word}" → 无效`, () => {
				const r = validateText(`这是一条包含${word}的消息`, ContentType.CHAT);
				expect(r.valid).toBe(false);
				expect(r.reason).toContain('违规');
			});
		});

		it('正常文本不触发敏感词', () => {
			expect(validateText('今天去健身房做了深蹲训练', ContentType.CHAT).valid).toBe(true);
			expect(validateText('明天上午约练瑜伽吗？', ContentType.INVITE).valid).toBe(true);
		});
	});
});

// ─── hasSensitiveWord ───
describe('hasSensitiveWord', () => {
	it('有敏感词返回 true', () => {
		expect(hasSensitiveWord('来赌博吧')).toBe(true);
		expect(hasSensitiveWord('加微信私聊')).toBe(true);
	});

	it('无敏感词返回 false', () => {
		expect(hasSensitiveWord('一起去跑步吧')).toBe(false);
	});

	it('空字符串 / 非字符串 → false', () => {
		expect(hasSensitiveWord('')).toBe(false);
		expect(hasSensitiveWord(null)).toBe(false);
		expect(hasSensitiveWord(123)).toBe(false);
	});
});

// ─── validateImageFile ───
describe('validateImageFile', () => {
	it('合法图片路径 → 有效', () => {
		expect(validateImageFile('/tmp/photo.jpg').valid).toBe(true);
		expect(validateImageFile('/tmp/photo.png').valid).toBe(true);
		expect(validateImageFile('/tmp/photo.webp').valid).toBe(true);
		expect(validateImageFile('/tmp/photo.gif').valid).toBe(true);
		expect(validateImageFile('/tmp/photo.heic').valid).toBe(true);
	});

	it('不支持的格式 → 无效', () => {
		expect(validateImageFile('/tmp/doc.pdf').valid).toBe(false);
		expect(validateImageFile('/tmp/video.mp4').valid).toBe(false);
		expect(validateImageFile('/tmp/file.exe').valid).toBe(false);
	});

	it('文件过大 → 无效', () => {
		const tooBig = IMAGE_MAX_SIZE_BYTES + 1;
		expect(validateImageFile('/tmp/big.jpg', tooBig).valid).toBe(false);
	});

	it('文件大小在限制内 → 有效', () => {
		expect(validateImageFile('/tmp/ok.jpg', 5 * 1024 * 1024).valid).toBe(true);
	});

	it('不传 fileSize → 跳过大小检查', () => {
		expect(validateImageFile('/tmp/photo.jpg').valid).toBe(true);
	});

	it('无效路径 → 无效', () => {
		expect(validateImageFile(null).valid).toBe(false);
		expect(validateImageFile('').valid).toBe(false);
		expect(validateImageFile(123).valid).toBe(false);
	});
});

// ─── 导出常量检查 ───
describe('exported constants', () => {
	it('ContentType 枚举完整', () => {
		expect(ContentType.CHAT).toBe('chat');
		expect(ContentType.FEED).toBe('feed');
		expect(ContentType.COMMENT).toBe('comment');
		expect(ContentType.INVITE).toBe('invite');
		expect(ContentType.BIO).toBe('bio');
	});

	it('LENGTH_LIMITS 为每个类型都有定义', () => {
		Object.values(ContentType).forEach(type => {
			expect(LENGTH_LIMITS[type]).toBeDefined();
			expect(LENGTH_LIMITS[type].max).toBeGreaterThan(0);
		});
	});

	it('IMAGE_MAX_SIZE_MB = 10', () => {
		expect(IMAGE_MAX_SIZE_MB).toBe(10);
	});

	it('IMAGE_ALLOWED_EXTENSIONS 包含常见格式', () => {
		expect(IMAGE_ALLOWED_EXTENSIONS).toContain('jpg');
		expect(IMAGE_ALLOWED_EXTENSIONS).toContain('png');
		expect(IMAGE_ALLOWED_EXTENSIONS).toContain('webp');
	});
});
