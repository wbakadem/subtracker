/**
 * API Client - SubTracker
 */

const API = {
    baseUrl: '/api',
    
    // Get auth token
    getToken() {
        return storage.get('accessToken');
    },
    
    // Set auth token
    setToken(token) {
        storage.set('accessToken', token);
    },
    
    // Clear auth tokens
    clearTokens() {
        storage.remove('accessToken');
        storage.remove('refreshToken');
    },
    
    // Make API request
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        // Add auth token
        const token = this.getToken();
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Add body
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            const response = await fetch(url, config);
            const data = await response.json().catch(() => null);
            
            // Handle token expiration
            if (response.status === 401 && data?.error?.includes('expired')) {
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    return this.request(endpoint, options);
                } else {
                    // Token refresh failed, logout
                    auth.logout();
                    throw new Error('Session expired. Please login again.');
                }
            }
            
            if (!response.ok) {
                throw new Error(data?.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    },
    
    // Refresh token
    async refreshToken() {
        const refreshToken = storage.get('refreshToken');
        if (!refreshToken) return false;
        
        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            
            const data = await response.json();
            
            if (response.ok && data.tokens) {
                storage.set('accessToken', data.tokens.accessToken);
                storage.set('refreshToken', data.tokens.refreshToken);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        }
    },
    
    // Auth endpoints
    auth: {
        async register(email, password) {
            return API.request('/auth/register', {
                method: 'POST',
                body: { email, password }
            });
        },
        
        async login(email, password) {
            return API.request('/auth/login', {
                method: 'POST',
                body: { email, password }
            });
        },
        
        async logout() {
            return API.request('/auth/logout', {
                method: 'POST'
            });
        },
        
        async refresh() {
            return API.refreshToken();
        }
    },
    
    // Subscriptions endpoints
    subscriptions: {
        async getAll() {
            return API.request('/subscriptions');
        },
        
        async create(subscription) {
            return API.request('/subscriptions', {
                method: 'POST',
                body: subscription
            });
        },
        
        async update(id, updates) {
            return API.request(`/subscriptions/${id}`, {
                method: 'PUT',
                body: updates
            });
        },
        
        async delete(id) {
            return API.request(`/subscriptions/${id}`, {
                method: 'DELETE'
            });
        },
        
        async reorder(id, newIndex) {
            return API.request(`/subscriptions/${id}/reorder`, {
                method: 'PUT',
                body: { newIndex }
            });
        }
    },
    
    // Categories endpoints
    categories: {
        async getAll() {
            return API.request('/categories');
        },
        
        async create(category) {
            return API.request('/categories', {
                method: 'POST',
                body: category
            });
        },
        
        async update(id, updates) {
            return API.request(`/categories/${id}`, {
                method: 'PUT',
                body: updates
            });
        },
        
        async delete(id) {
            return API.request(`/categories/${id}`, {
                method: 'DELETE'
            });
        }
    },
    
    // User endpoints
    user: {
        async getProfile() {
            return API.request('/user/profile');
        },
        
        async changePassword(currentPassword, newPassword) {
            return API.request('/user/change-password', {
                method: 'PUT',
                body: { currentPassword, newPassword }
            });
        },
        
        async deleteAccount(password) {
            return API.request('/user/delete-account', {
                method: 'DELETE',
                body: password ? { password } : {}
            });
        }
    },
    
    // Premium endpoints
    premium: {
        async generate() {
            return API.request('/premium/generate', {
                method: 'POST'
            });
        },
        
        async verify(paymentUid) {
            return API.request('/premium/verify', {
                method: 'POST',
                body: { paymentUid }
            });
        }
    },
    
    // Export endpoints
    export: {
        async csv() {
            const token = API.getToken();
            const response = await fetch(`${API.baseUrl}/export/csv`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Export failed');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `subtracker-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            return { success: true };
        }
    },
    
    // Stats endpoints
    stats: {
        async get() {
            return API.request('/stats');
        }
    }
};

// Offline queue for pending requests
const offlineQueue = {
    queue: storage.get('offlineQueue', []),
    
    add(request) {
        this.queue.push({
            ...request,
            timestamp: Date.now()
        });
        this.save();
    },
    
    remove(index) {
        this.queue.splice(index, 1);
        this.save();
    },
    
    clear() {
        this.queue = [];
        this.save();
    },
    
    save() {
        storage.set('offlineQueue', this.queue);
    },
    
    async process() {
        if (!navigator.onLine || this.queue.length === 0) return;
        
        const processed = [];
        
        for (let i = 0; i < this.queue.length; i++) {
            const request = this.queue[i];
            try {
                await API.request(request.endpoint, {
                    method: request.method,
                    body: request.body
                });
                processed.push(i);
            } catch (error) {
                console.error('Failed to process queued request:', error);
            }
        }
        
        // Remove processed requests (in reverse order)
        processed.reverse().forEach(i => this.remove(i));
    }
};

// Process offline queue when coming back online
window.addEventListener('online', () => {
    offlineQueue.process();
    UI.showToast('Соединение восстановлено', 'success');
});

window.addEventListener('offline', () => {
    UI.showToast('Нет соединения. Данные будут синхронизированы позже.', 'warning');
});
