// Local storage manager for persisting frequently accessed data
class LocalStorageManager {
    constructor() {
        this.prefix = 'chat_app_';
        this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
    }

    // Set data with TTL
    set(key, value, ttl = this.defaultTTL) {
        try {
            const data = {
                value,
                expiry: Date.now() + ttl,
                timestamp: Date.now()
            };
            localStorage.setItem(this.prefix + key, JSON.stringify(data));
        } catch (error) {
            console.error('Error setting localStorage:', error);
        }
    }

    // Get data with expiry check
    get(key) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            if (!item) return null;

            const data = JSON.parse(item);
            if (Date.now() > data.expiry) {
                this.delete(key);
                return null;
            }

            return data.value;
        } catch (error) {
            console.error('Error getting localStorage:', error);
            this.delete(key);
            return null;
        }
    }

    // Delete data
    delete(key) {
        try {
            localStorage.removeItem(this.prefix + key);
        } catch (error) {
            console.error('Error deleting localStorage:', error);
        }
    }

    // Check if key exists and is valid
    has(key) {
        return this.get(key) !== null;
    }

    // Clear all app data
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    }

    // Clean expired entries
    cleanup() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    const item = localStorage.getItem(key);
                    if (item) {
                        try {
                            const data = JSON.parse(item);
                            if (Date.now() > data.expiry) {
                                localStorage.removeItem(key);
                            }
                        } catch (e) {
                            localStorage.removeItem(key);
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error cleaning localStorage:', error);
        }
    }

    // Get storage usage info
    getStorageInfo() {
        let totalSize = 0;
        let appSize = 0;
        let appItems = 0;

        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage.getItem(key);
                    totalSize += key.length + value.length;

                    if (key.startsWith(this.prefix)) {
                        appSize += key.length + value.length;
                        appItems++;
                    }
                }
            }
        } catch (error) {
            console.error('Error getting storage info:', error);
        }

        return {
            totalSize: totalSize,
            appSize: appSize,
            appItems: appItems,
            totalSizeFormatted: this.formatBytes(totalSize),
            appSizeFormatted: this.formatBytes(appSize)
        };
    }

    // Format bytes to human readable format
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Create global instance
const localStorageManager = new LocalStorageManager();

// Cleanup expired entries every hour
setInterval(() => {
    localStorageManager.cleanup();
}, 60 * 60 * 1000);

export default localStorageManager;
