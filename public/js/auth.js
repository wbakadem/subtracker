/**
 * Authentication Module - SubTracker
 */

const auth = {
    user: null,
    categories: [],
    
    // Initialize auth state
    async init() {
        const token = storage.get('accessToken');
        
        if (token) {
            try {
                // Verify token by fetching profile
                const profile = await API.user.getProfile();
                this.user = profile.user;
                
                // Load categories
                const categoriesData = await API.categories.getAll();
                this.categories = categoriesData.categories;
                
                return true;
            } catch (error) {
                console.error('Auth init error:', error);
                this.clearAuth();
                return false;
            }
        }
        
        return false;
    },
    
    // Register new user
    async register(email, password) {
        try {
            const response = await API.auth.register(email, password);
            
            this.setAuth(response);
            
            UI.showToast('Регистрация успешна!', 'success');
            return true;
        } catch (error) {
            UI.showToast(error.message || 'Ошибка регистрации', 'error');
            return false;
        }
    },
    
    // Login user
    async login(email, password) {
        try {
            const response = await API.auth.login(email, password);
            
            this.setAuth(response);
            
            UI.showToast('Добро пожаловать!', 'success');
            return true;
        } catch (error) {
            UI.showToast(error.message || 'Неверный email или пароль', 'error');
            return false;
        }
    },
    
    // Logout user
    async logout() {
        try {
            await API.auth.logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        this.clearAuth();
        
        // Clear app data
        app.subscriptions = [];
        app.stats = null;
        
        UI.showToast('Вы вышли из системы', 'info');
    },
    
    // Set authentication data
    setAuth(response) {
        if (response.tokens) {
            storage.set('accessToken', response.tokens.accessToken);
            storage.set('refreshToken', response.tokens.refreshToken);
        }
        
        this.user = response.user;
        
        if (response.categories) {
            this.categories = response.categories;
        }
    },
    
    // Clear authentication data
    clearAuth() {
        storage.remove('accessToken');
        storage.remove('refreshToken');
        this.user = null;
        this.categories = [];
    },
    
    // Check if user is authenticated
    isAuthenticated() {
        return !!this.user;
    },
    
    // Check if user has premium
    isPremium() {
        return this.user?.isPremium || false;
    },
    
    // Get user info
    getUser() {
        return this.user;
    },
    
    // Get categories
    getCategories() {
        return this.categories;
    },
    
    // Update categories
    setCategories(categories) {
        this.categories = categories;
    },
    
    // Activate premium
    async activatePremium(paymentUid) {
        try {
            const response = await API.premium.verify(paymentUid);
            
            if (response.user) {
                this.user = response.user;
                
                // Update tokens
                if (response.tokens) {
                    storage.set('accessToken', response.tokens.accessToken);
                    storage.set('refreshToken', response.tokens.refreshToken);
                }
                
                UI.showToast('Premium активирован!', 'success');
                return true;
            }
        } catch (error) {
            UI.showToast(error.message || 'Ошибка активации Premium', 'error');
        }
        
        return false;
    },
    
    // Change password
    async changePassword(currentPassword, newPassword) {
        try {
            await API.user.changePassword(currentPassword, newPassword);
            UI.showToast('Пароль изменен успешно', 'success');
            return true;
        } catch (error) {
            UI.showToast(error.message || 'Ошибка смены пароля', 'error');
            return false;
        }
    },
    
    // Delete account
    async deleteAccount(password) {
        try {
            await API.user.deleteAccount(password);
            this.clearAuth();
            UI.showToast('Аккаунт удален', 'info');
            return true;
        } catch (error) {
            UI.showToast(error.message || 'Ошибка удаления аккаунта', 'error');
            return false;
        }
    }
};

// Auth UI handlers
document.addEventListener('DOMContentLoaded', () => {
    // Auth tabs
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (targetTab === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
            }
        });
    });
    
    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
    
    // Login form
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        
        const success = await auth.login(email, password);
        
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        
        if (success) {
            app.showApp();
        }
    });
    
    // Register form
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-password-confirm').value;
        
        // Validate
        if (!validators.email(email)) {
            UI.showToast('Введите корректный email', 'error');
            return;
        }
        
        if (!validators.password(password)) {
            UI.showToast('Пароль должен быть не менее 8 символов', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            UI.showToast('Пароли не совпадают', 'error');
            return;
        }
        
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        
        const success = await auth.register(email, password);
        
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        
        if (success) {
            app.showApp();
        }
    });
    
    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await auth.logout();
        app.showAuth();
    });
    
    // Change password button
    document.getElementById('change-password-btn')?.addEventListener('click', () => {
        UI.showModal('Смена пароля', `
            <form id="change-password-form">
                <div class="form-group">
                    <label>Текущий пароль</label>
                    <input type="password" id="current-password" required>
                </div>
                <div class="form-group">
                    <label>Новый пароль</label>
                    <input type="password" id="new-password" required minlength="8">
                </div>
                <div class="form-group">
                    <label>Подтвердите новый пароль</label>
                    <input type="password" id="confirm-new-password" required>
                </div>
            </form>
        `, [
            { text: 'Отмена', class: 'btn-secondary', action: () => UI.closeModal() },
            { 
                text: 'Сменить пароль', 
                class: 'btn-primary', 
                action: async () => {
                    const current = document.getElementById('current-password').value;
                    const newPass = document.getElementById('new-password').value;
                    const confirm = document.getElementById('confirm-new-password').value;
                    
                    if (newPass !== confirm) {
                        UI.showToast('Пароли не совпадают', 'error');
                        return;
                    }
                    
                    const success = await auth.changePassword(current, newPass);
                    if (success) {
                        UI.closeModal();
                    }
                }
            }
        ]);
    });
    
    // Delete account button
    document.getElementById('delete-account-btn')?.addEventListener('click', () => {
        UI.showModal('Удаление аккаунта', `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Внимание! Это действие нельзя отменить. Ваши данные будут удалены через 30 дней.</p>
            </div>
            <form id="delete-account-form">
                <div class="form-group">
                    <label>Введите пароль для подтверждения</label>
                    <input type="password" id="delete-password" required>
                </div>
            </form>
        `, [
            { text: 'Отмена', class: 'btn-secondary', action: () => UI.closeModal() },
            { 
                text: 'Удалить аккаунт', 
                class: 'btn-danger', 
                action: async () => {
                    const password = document.getElementById('delete-password').value;
                    const success = await auth.deleteAccount(password);
                    if (success) {
                        UI.closeModal();
                        app.showAuth();
                    }
                }
            }
        ]);
    });
});
