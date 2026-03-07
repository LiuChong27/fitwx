/**
 * StorageService 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import storage, { PREFIX } from '@/common/storage.js';

describe('StorageService', () => {
  beforeEach(() => {
    try { storage.clearAll(); } catch (_) {}
  });

  describe('基础读写', () => {
    it('set / get 常规值', () => {
      storage.set('name', '张三');
      expect(storage.get('name')).toBe('张三');
    });

    it('get 未设置 key 返回默认值', () => {
      expect(storage.get('nonexistent', 'default')).toBe('default');
    });

    it('存储对象', () => {
      const obj = { a: 1, b: [2, 3] };
      storage.set('obj', obj);
      expect(storage.get('obj')).toEqual(obj);
    });

    it('remove 删除值后 get 返回默认值', () => {
      storage.set('temp', 'value');
      expect(storage.get('temp')).toBe('value');
      storage.remove('temp');
      expect(storage.get('temp', null)).toBeNull();
    });
  });

  describe('前缀隔离', () => {
    it('普通 key 自动添加 fit_ 前缀', () => {
      storage.set('user_id', '123');
      const raw = uni.getStorageSync(`${PREFIX}user_id`);
      expect(raw).toBeTruthy();
      expect(raw.v).toBe('123');
    });

    it('RAW_KEYS 不加前缀', () => {
      storage.set('uni_id_token', 'tok_123');
      const raw = uni.getStorageSync('uni_id_token');
      expect(raw).toBeTruthy();
      expect(raw.v).toBe('tok_123');
    });
  });

  describe('TTL 过期', () => {
    it('未过期的值可正常读取', () => {
      storage.set('ttl_key', 'alive', 3600);
      expect(storage.get('ttl_key')).toBe('alive');
    });

    it('已过期的值返回默认值', () => {
      const key = `${PREFIX}expired_key`;
      uni.setStorageSync(key, {
        v: 'stale',
        t: Date.now() - 10000,
        e: Date.now() - 5000,
      });
      expect(storage.get('expired_key', 'gone')).toBe('gone');
    });

    it('过期后 get 返回 null', () => {
      const key = `${PREFIX}exp_has`;
      uni.setStorageSync(key, {
        v: 'data',
        t: Date.now() - 10000,
        e: Date.now() - 1000,
      });
      expect(storage.get('exp_has', null)).toBeNull();
    });
  });

  describe('clearUserScoped', () => {
    it('清理用户级缓存', () => {
      storage.set('userId', 'u1');
      storage.set('token', 'tok');
      storage.set('isLoggedIn', true);

      expect(storage.get('userId')).toBe('u1');

      storage.clearUserScoped();

      expect(storage.get('userId', null)).toBeNull();
      expect(storage.get('token', null)).toBeNull();
    });
  });
});
