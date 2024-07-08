declare class Cache {
    private readonly cache;
    constructor();
    getCacheEntry(key: string): any;
    setCacheEntry(key: string, data: any, ttl: number): void;
    clearExpiredCacheEntries(): void;
}
export { Cache };
