import { Cache } from '../src/cache';
import { Flags } from '../src/types';

describe('Cache', () => {
  let cache: Cache;
  
  beforeEach(() => {
    cache = new Cache();
    jest.clearAllMocks();
  });

  describe('Basic operations', () => {
    it('should store and retrieve cache entries', () => {
      const testData: Flags = {
        testFlag: {
          enabled: true,
          details: { name: 'testFlag', id: '123' }
        }
      };
      const ttl = 5000; // 5 seconds

      cache.setCacheEntry('test-key', testData, ttl);
      const retrieved = cache.getCacheEntry('test-key');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.data).toEqual(testData);
      expect(retrieved?.ttl).toBe(ttl);
      expect(retrieved?.timestamp).toBeDefined();
    });

    it('should return null for non-existent keys', () => {
      const result = cache.getCacheEntry('non-existent');
      expect(result).toBeNull();
    });

    it('should overwrite existing entries', () => {
      const data1: Flags = {
        flag1: { enabled: true, details: { name: 'flag1', id: '1' } }
      };
      const data2: Flags = {
        flag2: { enabled: false, details: { name: 'flag2', id: '2' } }
      };

      cache.setCacheEntry('key', data1, 1000);
      cache.setCacheEntry('key', data2, 2000);

      const retrieved = cache.getCacheEntry('key');
      expect(retrieved?.data).toEqual(data2);
      expect(retrieved?.ttl).toBe(2000);
    });

    it('should handle empty flags object', () => {
      const emptyData: Flags = {};
      
      cache.setCacheEntry('empty', emptyData, 1000);
      const retrieved = cache.getCacheEntry('empty');

      expect(retrieved?.data).toEqual({});
    });
  });

  describe('TTL and expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return null for expired entries', () => {
      const testData: Flags = {
        testFlag: { enabled: true, details: { name: 'testFlag', id: '123' } }
      };

      cache.setCacheEntry('expiring', testData, 1000); // 1 second TTL

      // Entry should exist initially
      expect(cache.getCacheEntry('expiring')).not.toBeNull();

      // Advance time by 1.5 seconds
      jest.advanceTimersByTime(1500);

      // Entry should be expired and removed
      expect(cache.getCacheEntry('expiring')).toBeNull();
    });

    it('should remove expired entry from cache when accessed', () => {
      const testData: Flags = {
        testFlag: { enabled: true, details: { name: 'testFlag', id: '123' } }
      };

      cache.setCacheEntry('test', testData, 1000);
      
      // Advance time past TTL
      jest.advanceTimersByTime(2000);
      
      // Access the expired entry
      cache.getCacheEntry('test');
      
      // Try to access again - should still be null (confirming deletion)
      expect(cache.getCacheEntry('test')).toBeNull();
    });

    it('should handle zero TTL', () => {
      const testData: Flags = {
        testFlag: { enabled: true, details: { name: 'testFlag', id: '123' } }
      };

      cache.setCacheEntry('zero-ttl', testData, 0);

      // Should be immediately expired
      jest.advanceTimersByTime(1);
      expect(cache.getCacheEntry('zero-ttl')).toBeNull();
    });

    it('should handle very large TTL values', () => {
      const testData: Flags = {
        testFlag: { enabled: true, details: { name: 'testFlag', id: '123' } }
      };
      const largeTTL = Number.MAX_SAFE_INTEGER;

      cache.setCacheEntry('large-ttl', testData, largeTTL);
      
      // Advance time significantly
      jest.advanceTimersByTime(1000000);
      
      // Should still be valid
      expect(cache.getCacheEntry('large-ttl')).not.toBeNull();
    });
  });

  describe('clearExpiredCacheEntries', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should remove all expired entries', () => {
      const data1: Flags = { flag1: { enabled: true, details: { name: 'flag1', id: '1' } } };
      const data2: Flags = { flag2: { enabled: true, details: { name: 'flag2', id: '2' } } };
      const data3: Flags = { flag3: { enabled: true, details: { name: 'flag3', id: '3' } } };

      cache.setCacheEntry('short', data1, 1000);  // 1 second
      cache.setCacheEntry('medium', data2, 5000); // 5 seconds
      cache.setCacheEntry('long', data3, 10000);  // 10 seconds

      // Advance time by 3 seconds
      jest.advanceTimersByTime(3000);

      cache.clearExpiredCacheEntries();

      // Only 'short' should be expired
      expect(cache.getCacheEntry('short')).toBeNull();
      expect(cache.getCacheEntry('medium')).not.toBeNull();
      expect(cache.getCacheEntry('long')).not.toBeNull();
    });

    it('should handle empty cache', () => {
      // Should not throw
      expect(() => cache.clearExpiredCacheEntries()).not.toThrow();
    });

    it('should clear multiple expired entries', () => {
      for (let i = 0; i < 5; i++) {
        cache.setCacheEntry(`key-${i}`, {}, 1000);
      }

      jest.advanceTimersByTime(2000);
      cache.clearExpiredCacheEntries();

      for (let i = 0; i < 5; i++) {
        expect(cache.getCacheEntry(`key-${i}`)).toBeNull();
      }
    });
  });

  describe('Multiple cache instances', () => {
    it('should maintain separate storage for different instances', () => {
      const cache1 = new Cache();
      const cache2 = new Cache();

      const data1: Flags = { flag1: { enabled: true, details: { name: 'flag1', id: '1' } } };
      const data2: Flags = { flag2: { enabled: false, details: { name: 'flag2', id: '2' } } };

      cache1.setCacheEntry('shared-key', data1, 5000);
      cache2.setCacheEntry('shared-key', data2, 5000);

      expect(cache1.getCacheEntry('shared-key')?.data).toEqual(data1);
      expect(cache2.getCacheEntry('shared-key')?.data).toEqual(data2);
    });
  });

  describe('Complex flag structures', () => {
    it('should handle flags with nested properties', () => {
      const complexFlags: Flags = {
        feature1: {
          enabled: true,
          details: {
            name: 'feature1',
            id: 'complex-1',
            // Additional properties that might exist
            description: 'A complex feature' as any,
            metadata: { version: 1 } as any
          }
        },
        feature2: {
          enabled: false,
          details: {
            name: 'feature2',
            id: 'complex-2'
          }
        }
      };

      cache.setCacheEntry('complex', complexFlags, 5000);
      const retrieved = cache.getCacheEntry('complex');

      expect(retrieved?.data).toEqual(complexFlags);
    });

    it('should handle large numbers of flags', () => {
      const manyFlags: Flags = {};
      for (let i = 0; i < 1000; i++) {
        manyFlags[`flag${i}`] = {
          enabled: i % 2 === 0,
          details: { name: `flag${i}`, id: `id-${i}` }
        };
      }

      cache.setCacheEntry('many-flags', manyFlags, 5000);
      const retrieved = cache.getCacheEntry('many-flags');

      expect(retrieved?.data).toEqual(manyFlags);
      expect(Object.keys(retrieved?.data || {}).length).toBe(1000);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in cache keys', () => {
      const testData: Flags = {
        test: { enabled: true, details: { name: 'test', id: '1' } }
      };

      const specialKeys = [
        'key-with-spaces and chars',
        'key/with/slashes',
        'key@with#special$chars',
        'key[with]brackets{and}braces',
        '🚀emoji-key🎉',
        'very-long-key-'.repeat(20)
      ];

      specialKeys.forEach(key => {
        cache.setCacheEntry(key, testData, 5000);
        expect(cache.getCacheEntry(key)).not.toBeNull();
      });
    });

    it('should handle concurrent operations', () => {
      const data: Flags = {
        flag: { enabled: true, details: { name: 'flag', id: '1' } }
      };

      // Simulate concurrent writes
      for (let i = 0; i < 100; i++) {
        cache.setCacheEntry(`concurrent-${i}`, data, 5000);
      }

      // Simulate concurrent reads
      for (let i = 0; i < 100; i++) {
        const result = cache.getCacheEntry(`concurrent-${i}`);
        expect(result).not.toBeNull();
      }
    });

    it('should handle updating timestamp correctly', () => {
      jest.useFakeTimers();
      const startTime = Date.now();
      jest.setSystemTime(startTime);

      const data: Flags = {
        flag: { enabled: true, details: { name: 'flag', id: '1' } }
      };

      cache.setCacheEntry('timestamp-test', data, 5000);
      const entry1 = cache.getCacheEntry('timestamp-test');
      expect(entry1?.timestamp).toBe(startTime);

      // Advance time and update
      jest.advanceTimersByTime(1000);
      cache.setCacheEntry('timestamp-test', data, 5000);
      const entry2 = cache.getCacheEntry('timestamp-test');
      expect(entry2?.timestamp).toBe(startTime + 1000);

      jest.useRealTimers();
    });
  });
});