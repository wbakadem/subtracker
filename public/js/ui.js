/**
 * UI Components - SubTracker
 */

const UI = {
    // Show toast notification
    showToast(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconMap = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${iconMap[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
    
    // Show modal
    showModal(title, content, buttons = []) {
        const container = document.getElementById('modal-container');
        
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="UI.closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${buttons.length > 0 ? `
                    <div class="modal-footer">
                        ${buttons.map(btn => `
                            <button class="btn ${btn.class}" ${btn.id ? `id="${btn.id}"` : ''}>
                                ${btn.text}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        
        container.innerHTML = '';
        container.appendChild(modal);
        container.classList.add('active');
        
        // Add button handlers
        buttons.forEach((btn, index) => {
            if (btn.action) {
                const buttonEl = modal.querySelectorAll('.modal-footer .btn')[index];
                buttonEl?.addEventListener('click', btn.action);
            }
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
        
        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    },
    
    // Close modal
    closeModal() {
        const container = document.getElementById('modal-container');
        container.classList.remove('active');
        setTimeout(() => {
            container.innerHTML = '';
        }, 300);
    },
    
    // Update page title
    setPageTitle(title) {
        document.getElementById('page-title').textContent = title;
    },
    
    // Show loading state
    showLoading(element, message = 'Загрузка...') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        
        if (element) {
            element.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    },
    
    // Show skeleton loading
    showSkeleton(element, count = 3) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        
        if (element) {
            element.innerHTML = Array(count).fill(0).map(() => `
                <div class="skeleton-item">
                    <div class="skeleton skeleton-circle" style="width: 48px; height: 48px;"></div>
                    <div class="skeleton-content">
                        <div class="skeleton skeleton-text" style="width: 60%;"></div>
                        <div class="skeleton skeleton-text" style="width: 40%;"></div>
                    </div>
                </div>
            `).join('');
        }
    },
    
    // Create subscription card HTML
    createSubscriptionCard(subscription, options = {}) {
        const { draggable = false, showActions = true, selectable = false } = options;
        
        const isInactive = !subscription.isActive;
        const categoryColor = subscription.category?.color || '#6b7280';
        const categoryName = subscription.category?.name || 'Без категории';
        
        return `
            <div class="subscription-card ${isInactive ? 'inactive' : ''}" 
                 data-id="${subscription.id}"
                 ${draggable ? 'draggable="true"' : ''}
                 ${selectable ? 'onclick="app.toggleCalculatorSelection(this)"' : ''}>
                ${selectable ? `
                    <input type="checkbox" ${subscription.selected ? 'checked' : ''} 
                           onchange="event.stopPropagation()">
                ` : ''}
                <div class="sub-icon" style="background-color: ${subscription.color};">
                    <i class="fas fa-${subscription.icon || 'credit-card'}"></i>
                </div>
                <div class="sub-info">
                    <div class="sub-name">${subscription.name}</div>
                    <div class="sub-meta">
                        <span class="sub-category">
                            <span class="sub-category-dot" style="background-color: ${categoryColor};"></span>
                            ${categoryName}
                        </span>
                        <span>•</span>
                        <span>${this.formatBillingCycle(subscription.billingCycle)}</span>
                    </div>
                </div>
                <div class="sub-cost">
                    <div class="sub-amount">${formatCurrency(subscription.cost, subscription.currency)}</div>
                    <div class="sub-cycle">${formatRelativeDate(subscription.nextPaymentDate)}</div>
                </div>
                ${showActions ? `
                    <div class="sub-actions">
                        <button class="sub-action-btn" onclick="app.editSubscription('${subscription.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="sub-action-btn danger" onclick="app.deleteSubscription('${subscription.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Format billing cycle
    formatBillingCycle(cycle) {
        const map = {
            weekly: 'Неделя',
            monthly: 'Месяц',
            quarterly: 'Квартал',
            yearly: 'Год'
        };
        return map[cycle] || cycle;
    },
    
    // Create upcoming payment item
    createUpcomingItem(payment) {
        const daysClass = payment.daysUntil <= 3 ? 'soon' : '';
        
        return `
            <div class="upcoming-item">
                <div class="upcoming-icon" style="background-color: ${payment.color};">
                    <i class="fas fa-${payment.icon || 'credit-card'}"></i>
                </div>
                <div class="upcoming-info">
                    <div class="upcoming-name">${payment.name}</div>
                    <div class="upcoming-date">${formatDate(payment.date)}</div>
                </div>
                <div class="upcoming-cost">
                    <div>${formatCurrency(payment.cost)}</div>
                    <div class="upcoming-days ${daysClass}">
                        ${payment.daysUntil === 0 ? 'Сегодня' : 
                          payment.daysUntil === 1 ? 'Завтра' : 
                          `Через ${payment.daysUntil} дн.`}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Create timeline item
    createTimelineItem(payment) {
        return `
            <div class="timeline-item">
                <div class="timeline-date">${formatDate(payment.date, { day: 'numeric', month: 'long' })}</div>
                <div class="timeline-content">
                    <div class="subscription-card" style="box-shadow: none;">
                        <div class="sub-icon" style="background-color: ${payment.color}; width: 36px; height: 36px;">
                            <i class="fas fa-${payment.icon || 'credit-card'}"></i>
                        </div>
                        <div class="sub-info">
                            <div class="sub-name">${payment.name}</div>
                        </div>
                        <div class="sub-cost">
                            <div class="sub-amount">${formatCurrency(payment.cost)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Update notification badge
    updateNotificationBadge(count) {
        const badge = document.getElementById('notification-badge');
        const sidebarBadge = document.getElementById('sidebar-sub-count');
        
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
            sidebarBadge.textContent = count;
            sidebarBadge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
            sidebarBadge.classList.add('hidden');
        }
    },
    
    // Toggle theme
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        storage.set('theme', newTheme);
        
        // Update icon
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.innerHTML = `<i class="fas fa-${newTheme === 'dark' ? 'sun' : 'moon'}"></i>`;
        }
    },
    
    // Initialize theme
    initTheme() {
        const savedTheme = storage.get('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        document.documentElement.setAttribute('data-theme', theme);
        
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.innerHTML = `<i class="fas fa-${theme === 'dark' ? 'sun' : 'moon'}"></i>`;
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    },
    
    // Mobile menu toggle
    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('open');
        
        // Create overlay if needed
        let overlay = document.querySelector('.mobile-menu-overlay');
        
        if (sidebar.classList.contains('open')) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'mobile-menu-overlay';
                overlay.addEventListener('click', () => this.toggleMobileMenu());
                document.body.appendChild(overlay);
            }
            setTimeout(() => overlay.classList.add('active'), 10);
        } else {
            overlay?.classList.remove('active');
            setTimeout(() => overlay?.remove(), 300);
        }
    }
};

// Initialize UI on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    UI.initTheme();
    
    // Mobile menu toggle
    document.querySelector('.menu-toggle')?.addEventListener('click', () => {
        UI.toggleMobileMenu();
    });
    
    // Navigation
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            app.navigateTo(page);
            
            // Close mobile menu
            document.querySelector('.sidebar')?.classList.remove('open');
            document.querySelector('.mobile-menu-overlay')?.remove();
        });
    });
});
