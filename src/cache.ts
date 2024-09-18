import {type CacheEntry} from './types'

class Cache {
  private readonly cache: Record<string, CacheEntry>;

  constructor() {
    this.cache = {}
  }

  getCacheEntry(key: string): CacheEntry | null {
    const entry = this.cache[key]
    if (entry) {
      const currentTime = Date.now()
      if (currentTime - entry.timestamp < entry.ttl) {
        return entry
      } else {
        delete this.cache[key]
      }
    }
    return null
  }

  setCacheEntry(key: string, data: never, ttl: number): void {
    const currentTime = Date.now();
    this.cache[key] = {
      data: data,
      timestamp: currentTime,
      ttl: ttl
    }
  }

  clearExpiredCacheEntries(): void {
    const currentTime = Date.now()
    Object.keys(this.cache).forEach(key => {
      if (currentTime - this.cache[key].timestamp >= this.cache[key].ttl) {
        delete this.cache[key]
      }
    })
  }
}

export {
  Cache
}

