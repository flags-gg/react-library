import {CacheEntry} from './types.d'

class Cache {
  private cache: Record<string, CacheEntry>;
  
  constructor() {
    this.cache = {}
  }

  getCacheEntry(key: string): any {
    const entry = this.cache[key]
    if (entry) {
      const currentTime = Date.now()
      if (currentTime - entry.timestamp < entry.ttl) {
        return entry.data
      } else {
        delete this.cache[key]
      }
    }
    return null
  }

  setCacheEntry(key: string, data: any, ttl: number): void {
    const currentTime = Date.now();
    this.cache[key] = {
      data,
      timestamp: currentTime,
      ttl
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

