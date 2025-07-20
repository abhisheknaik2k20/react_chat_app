// Cache utility for reducing redundant Firestore operations
class FirestoreCache {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
    }

    // Set cache with TTL
    set(key, value, ttl = this.defaultTTL) {
        this.cache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + ttl);
    }

    // Get from cache
    get(key) {
        const expiry = this.cacheExpiry.get(key);
        if (expiry && Date.now() > expiry) {
            // Cache expired
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
            return null;
        }
        return this.cache.get(key) || null;
    }

    // Check if key exists and is valid
    has(key) {
        const expiry = this.cacheExpiry.get(key);
        if (expiry && Date.now() > expiry) {
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
            return false;
        }
        return this.cache.has(key);
    }

    // Delete from cache
    delete(key) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
    }

    // Clear all cache
    clear() {
        this.cache.clear();
        this.cacheExpiry.clear();
    }

    // Get cache size
    size() {
        return this.cache.size;
    }

    // Clean expired entries
    cleanup() {
        const now = Date.now();
        for (const [key, expiry] of this.cacheExpiry.entries()) {
            if (expiry <= now) {
                this.cache.delete(key);
                this.cacheExpiry.delete(key);
            }
        }
    }
}

// Create global cache instance
const firestoreCache = new FirestoreCache();

setInterval(() => {
    firestoreCache.cleanup();
}, 5 * 60 * 1000);

export default firestoreCache;
