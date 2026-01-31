/**
 * Utility Functions - SubTracker
 */

// Format currency
function formatCurrency(amount, currency = 'RUB') {
    const formatter = new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    return formatter.format(amount);
}

// Format date
function formatDate(date, options = {}) {
    const d = new Date(date);
    const defaultOptions = { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        ...options 
    };
    return d.toLocaleDateString('ru-RU', defaultOptions);
}

// Format relative date (e.g., "через 3 дня")
function formatRelativeDate(date) {
    const target = new Date(date);
    const now = new Date();
    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return `Просрочено ${Math.abs(diffDays)} ${pluralize(Math.abs(diffDays), 'день', 'дня', 'дней')}`;
    } else if (diffDays === 0) {
        return 'Сегодня';
    } else if (diffDays === 1) {
        return 'Завтра';
    } else if (diffDays < 7) {
        return `Через ${diffDays} ${pluralize(diffDays, 'день', 'дня', 'дней')}`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `Через ${weeks} ${pluralize(weeks, 'неделю', 'недели', 'недель')}`;
    } else {
        return formatDate(date);
    }
}

// Pluralize helper
function pluralize(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    
    if (mod10 === 1 && mod100 !== 11) {
        return one;
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return few;
    } else {
        return many;
    }
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Generate unique ID
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Deep clone
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// LocalStorage helpers with error handling
const storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.error('Storage clear error:', e);
            return false;
        }
    }
};

// IndexedDB helpers for offline storage
const indexedDB = {
    db: null,
    dbName: 'SubTrackerDB',
    version: 1,
    
    async init() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Subscriptions store
                if (!db.objectStoreNames.contains('subscriptions')) {
                    db.createObjectStore('subscriptions', { keyPath: 'id' });
                }
                
                // Categories store
                if (!db.objectStoreNames.contains('categories')) {
                    db.createObjectStore('categories', { keyPath: 'id' });
                }
                
                // Stats store
                if (!db.objectStoreNames.contains('stats')) {
                    db.createObjectStore('stats', { keyPath: 'id' });
                }
            };
        });
    },
    
    async save(storeName, data) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Add timestamp
            const dataWithTimestamp = {
                ...data,
                _cachedAt: Date.now()
            };
            
            const request = store.put(dataWithTimestamp);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async get(storeName, id) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async getAll(storeName) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async clear(storeName) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// Color utilities
const colorUtils = {
    // Generate random color
    random() {
        const colors = [
            '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
            '#f97316', '#f59e0b', '#84cc16', '#10b981',
            '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    },
    
    // Darken color
    darken(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16).slice(1);
    },
    
    // Lighten color
    lighten(hex, percent) {
        return this.darken(hex, -percent);
    },
    
    // Get contrast color (black or white)
    contrast(hex) {
        const r = parseInt(hex.substr(1, 2), 16);
        const g = parseInt(hex.substr(3, 2), 16);
        const b = parseInt(hex.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? '#000000' : '#ffffff';
    }
};

// Date utilities
const dateUtils = {
    // Add days to date
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },
    
    // Add months to date
    addMonths(date, months) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    },
    
    // Get next payment date based on billing cycle
    getNextPaymentDate(startDate, billingCycle) {
        const now = new Date();
        const start = new Date(startDate);
        
        if (start > now) {
            return start;
        }
        
        let nextDate = new Date(start);
        
        while (nextDate <= now) {
            switch (billingCycle) {
                case 'weekly':
                    nextDate = this.addDays(nextDate, 7);
                    break;
                case 'monthly':
                    nextDate = this.addMonths(nextDate, 1);
                    break;
                case 'quarterly':
                    nextDate = this.addMonths(nextDate, 3);
                    break;
                case 'yearly':
                    nextDate = this.addMonths(nextDate, 12);
                    break;
            }
        }
        
        return nextDate;
    },
    
    // Get days until date
    daysUntil(date) {
        const target = new Date(date);
        const now = new Date();
        const diffTime = target - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },
    
    // Check if date is today
    isToday(date) {
        const d = new Date(date);
        const today = new Date();
        return d.toDateString() === today.toDateString();
    },
    
    // Check if date is in the past
    isPast(date) {
        return new Date(date) < new Date();
    }
};

// Validation utilities
const validators = {
    email(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },
    
    password(password) {
        return password.length >= 8;
    },
    
    required(value) {
        return value !== null && value !== undefined && String(value).trim() !== '';
    },
    
    number(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    },
    
    positive(value) {
        return this.number(value) && parseFloat(value) > 0;
    },
    
    date(value) {
        const d = new Date(value);
        return d instanceof Date && !isNaN(d);
    }
};

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatCurrency,
        formatDate,
        formatRelativeDate,
        pluralize,
        debounce,
        throttle,
        generateId,
        deepClone,
        storage,
        indexedDB,
        colorUtils,
        dateUtils,
        validators
    };
}
