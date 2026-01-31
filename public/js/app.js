/**
 * Main Application - SubTracker
 */

const app = {
    currentPage: 'dashboard',
    subscriptions: [],
    categories: [],
    stats: null,
    calculatorSelections: new Set(),
    notifications: [],
    
    // Initialize app
    async init() {
        // Show loading screen
        const loadingScreen = document.getElementById('loading-screen');
        
        // Check auth
        const isAuth = await auth.init();
        
        if (isAuth) {
            this.showApp();
            await this.loadData();
        } else {
            this.showAuth();
        }
        
        // Hide loading screen
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 500);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check for notifications
        this.checkNotifications();
        
        // Setup periodic refresh
        setInterval(() => this.checkNotifications(), 60000); // Every minute
    },
    
    // Show auth screen
    showAuth() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    },
    
    // Show main app
    showApp() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        // Update profile info
        this.updateProfileInfo();
    },
    
    // Load all data
    async loadData() {
        try {
            // Load subscriptions
            const subsData = await API.subscriptions.getAll();
            this.subscriptions = subsData.subscriptions || [];
            
            // Load categories
            const catsData = await API.categories.getAll();
            this.categories = catsData.categories || [];
            auth.setCategories(this.categories);
            
            // Load stats
            const statsData = await API.stats.get();
            this.stats = statsData;
            
            // Update UI
            this.updateDashboard();
            this.updateSubscriptionsList();
            this.updateTimeline();
            this.updateCalculator();
            
        } catch (error) {
            console.error('Load data error:', error);
            UI.showToast('Ошибка загрузки данных', 'error');
        }
    },
    
    // Update profile info
    updateProfileInfo() {
        const user = auth.getUser();
        if (!user) return;
        
        document.getElementById('profile-email').textContent = user.email;
        
        const statusBadge = document.getElementById('profile-status');
        if (user.isPremium) {
            statusBadge.textContent = 'Premium';
            statusBadge.className = 'status-badge premium';
            document.getElementById('premium-active')?.classList.remove('hidden');
            document.getElementById('buy-premium-btn')?.classList.add('hidden');
            document.getElementById('export-csv-btn')?.removeAttribute('disabled');
            
            if (user.premiumPurchasedAt) {
                document.getElementById('premium-date').textContent = 
                    `Активирован: ${formatDate(user.premiumPurchasedAt)}`;
            }
        } else {
            statusBadge.textContent = 'Free';
            statusBadge.className = 'status-badge free';
            document.getElementById('premium-active')?.classList.add('hidden');
            document.getElementById('buy-premium-btn')?.classList.remove('hidden');
            document.getElementById('export-csv-btn')?.setAttribute('disabled', 'true');
        }
    },
    
    // Update dashboard
    updateDashboard() {
        if (!this.stats) return;
        
        const { summary, categoryBreakdown, upcomingPayments, monthlyTrend } = this.stats;
        
        // Update stat cards
        document.getElementById('monthly-total').textContent = formatCurrency(summary.monthlyCost);
        document.getElementById('yearly-total').textContent = formatCurrency(summary.yearlyCost);
        document.getElementById('sub-count').textContent = summary.activeSubscriptions;
        document.getElementById('upcoming-count').textContent = upcomingPayments.length;
        
        // Update sidebar count
        document.getElementById('sidebar-sub-count').textContent = summary.activeSubscriptions;
        
        // Update category chart
        Charts.updateCategoryChart(categoryBreakdown);
        
        // Update trend chart
        Charts.updateTrendChart(monthlyTrend);
        
        // Update upcoming payments list
        const upcomingList = document.getElementById('upcoming-payments');
        if (upcomingPayments.length > 0) {
            upcomingList.innerHTML = upcomingPayments.map(p => UI.createUpcomingItem(p)).join('');
        } else {
            upcomingList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <p>Нет ближайших списаний</p>
                </div>
            `;
        }
        
        // Update notification badge
        const urgentCount = upcomingPayments.filter(p => p.daysUntil <= 3).length;
        UI.updateNotificationBadge(urgentCount);
    },
    
    // Update subscriptions list
    updateSubscriptionsList(filter = 'all') {
        const list = document.getElementById('subscriptions-list');
        
        let filtered = this.subscriptions;
        if (filter === 'active') {
            filtered = this.subscriptions.filter(s => s.isActive);
        } else if (filter === 'inactive') {
            filtered = this.subscriptions.filter(s => !s.isActive);
        }
        
        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-credit-card"></i>
                    <h3>${filter === 'all' ? 'Нет подписок' : 'Нет подписок в этой категории'}</h3>
                    <p>Добавьте свою первую подписку, чтобы начать отслеживание</p>
                    <button class="btn btn-primary" onclick="app.openAddSubscriptionModal()">
                        <i class="fas fa-plus"></i>
                        Добавить подписку
                    </button>
                </div>
            `;
            return;
        }
        
        list.innerHTML = filtered.map((sub, index) => 
            UI.createSubscriptionCard(sub, { draggable: true })
        ).join('');
        
        // Setup drag and drop
        this.setupDragAndDrop();
    },
    
    // Update timeline
    updateTimeline() {
        const timeline = document.getElementById('timeline');
        
        // Get upcoming payments from all subscriptions
        const upcoming = [];
        const today = new Date();
        const sixMonthsLater = new Date();
        sixMonthsLater.setMonth(today.getMonth() + 6);
        
        this.subscriptions.forEach(sub => {
            if (!sub.isActive) return;
            
            let paymentDate = new Date(sub.nextPaymentDate);
            
            // Add multiple occurrences
            for (let i = 0; i < 12; i++) {
                if (paymentDate > sixMonthsLater) break;
                
                upcoming.push({
                    name: sub.name,
                    cost: sub.cost,
                    date: new Date(paymentDate),
                    color: sub.color,
                    icon: sub.icon
                });
                
                // Calculate next date
                switch (sub.billingCycle) {
                    case 'weekly':
                        paymentDate.setDate(paymentDate.getDate() + 7);
                        break;
                    case 'monthly':
                        paymentDate.setMonth(paymentDate.getMonth() + 1);
                        break;
                    case 'quarterly':
                        paymentDate.setMonth(paymentDate.getMonth() + 3);
                        break;
                    case 'yearly':
                        paymentDate.setFullYear(paymentDate.getFullYear() + 1);
                        break;
                }
            }
        });
        
        // Sort by date
        upcoming.sort((a, b) => a.date - b.date);
        
        // Group by month
        const grouped = {};
        upcoming.forEach(p => {
            const monthKey = p.date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
            if (!grouped[monthKey]) grouped[monthKey] = [];
            grouped[monthKey].push(p);
        });
        
        // Render timeline
        if (upcoming.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-alt"></i>
                    <h3>Таймлайн пуст</h3>
                    <p>Добавьте подписки, чтобы увидеть график списаний</p>
                </div>
            `;
            return;
        }
        
        timeline.innerHTML = Object.entries(grouped).map(([month, payments]) => `
            <div class="timeline-month">
                <div class="timeline-month-header">${month}</div>
                ${payments.map(p => `
                    <div class="timeline-item">
                        <div class="timeline-date">${p.date.getDate()} ${p.date.toLocaleString('ru-RU', { month: 'short' })}</div>
                        <div class="timeline-content">
                            <div class="subscription-card" style="box-shadow: none; padding: 0;">
                                <div class="sub-icon" style="background-color: ${p.color}; width: 36px; height: 36px;">
                                    <i class="fas fa-${p.icon || 'credit-card'}"></i>
                                </div>
                                <div class="sub-info">
                                    <div class="sub-name">${p.name}</div>
                                </div>
                                <div class="sub-cost">
                                    <div class="sub-amount">${formatCurrency(p.cost)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    },
    
    // Update calculator
    updateCalculator() {
        const container = document.getElementById('calculator-subs');
        
        if (this.subscriptions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calculator"></i>
                    <h3>Нет данных для расчета</h3>
                    <p>Добавьте подписки, чтобы использовать калькулятор</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.subscriptions
            .filter(s => s.isActive)
            .map(sub => `
                <div class="calculator-sub-item" data-id="${sub.id}" onclick="app.toggleCalculatorItem('${sub.id}')">
                    <input type="checkbox" ${this.calculatorSelections.has(sub.id) ? 'checked' : ''} 
                           onchange="event.stopPropagation(); app.toggleCalculatorItem('${sub.id}')">
                    <div class="sub-icon" style="background-color: ${sub.color}; width: 36px; height: 36px;">
                        <i class="fas fa-${sub.icon || 'credit-card'}"></i>
                    </div>
                    <div class="sub-info" style="flex: 1;">
                        <div class="sub-name">${sub.name}</div>
                        <div class="sub-meta">${formatCurrency(sub.cost)} / ${UI.formatBillingCycle(sub.billingCycle)}</div>
                    </div>
                </div>
            `).join('');
        
        this.updateSavingsCalculation();
    },
    
    // Toggle calculator item
    toggleCalculatorItem(id) {
        if (this.calculatorSelections.has(id)) {
            this.calculatorSelections.delete(id);
        } else {
            this.calculatorSelections.add(id);
        }
        
        // Update checkbox visual
        const item = document.querySelector(`.calculator-sub-item[data-id="${id}"]`);
        if (item) {
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.checked = this.calculatorSelections.has(id);
            item.classList.toggle('selected', this.calculatorSelections.has(id));
        }
        
        this.updateSavingsCalculation();
    },
    
    // Update savings calculation
    updateSavingsCalculation() {
        const resultDiv = document.getElementById('savings-result');
        
        if (this.calculatorSelections.size === 0) {
            resultDiv.classList.add('hidden');
            return;
        }
        
        const cycleMultipliers = {
            weekly: 4.33,
            monthly: 1,
            quarterly: 1 / 3,
            yearly: 1 / 12
        };
        
        let monthlySavings = 0;
        
        this.subscriptions
            .filter(s => this.calculatorSelections.has(s.id))
            .forEach(sub => {
                monthlySavings += sub.cost * cycleMultipliers[sub.billingCycle];
            });
        
        const yearlySavings = monthlySavings * 12;
        const fiveYearSavings = yearlySavings * 5;
        
        document.getElementById('savings-monthly').textContent = formatCurrency(monthlySavings);
        document.getElementById('savings-yearly').textContent = formatCurrency(yearlySavings);
        document.getElementById('savings-5years').textContent = formatCurrency(fiveYearSavings);
        
        resultDiv.classList.remove('hidden');
    },
    
    // Navigate to page
    navigateTo(page) {
        this.currentPage = page;
        
        // Update nav items
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        
        // Show page
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `${page}-page`);
        });
        
        // Update page title
        const titles = {
            dashboard: 'Дашборд',
            subscriptions: 'Подписки',
            timeline: 'Таймлайн',
            calculator: 'Калькулятор экономии',
            premium: 'Premium',
            profile: 'Профиль'
        };
        UI.setPageTitle(titles[page] || page);
        
        // Refresh data if needed
        if (page === 'dashboard') {
            this.updateDashboard();
        } else if (page === 'subscriptions') {
            this.updateSubscriptionsList();
        } else if (page === 'timeline') {
            this.updateTimeline();
        } else if (page === 'calculator') {
            this.updateCalculator();
        }
    },
    
    // Open add subscription modal
    openAddSubscriptionModal() {
        const isPremium = auth.isPremium();
        const subCount = this.subscriptions.filter(s => s.isActive).length;
        
        if (!isPremium && subCount >= 5) {
            UI.showToast('Достигнут лимит бесплатного тарифа. Получите Premium для неограниченных подписок.', 'warning');
            this.navigateTo('premium');
            return;
        }
        
        const categories = auth.getCategories();
        
        UI.showModal('Добавить подписку', `
            <form id="add-sub-form">
                <div class="form-group">
                    <label>Название</label>
                    <input type="text" id="sub-name" required placeholder="Например, Netflix">
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Стоимость</label>
                        <input type="number" id="sub-cost" required min="0" step="0.01" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label>Валюта</label>
                        <select id="sub-currency">
                            <option value="RUB">₽ RUB</option>
                            <option value="USD">$ USD</option>
                            <option value="EUR">€ EUR</option>
                        </select>
                    </div>
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Периодичность</label>
                        <select id="sub-cycle">
                            <option value="weekly">Неделя</option>
                            <option value="monthly" selected>Месяц</option>
                            <option value="quarterly">Квартал</option>
                            <option value="yearly">Год</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Следующее списание</label>
                        <input type="date" id="sub-next-date" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Категория</label>
                    <select id="sub-category">
                        <option value="">Без категории</option>
                        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Цвет</label>
                    <input type="color" id="sub-color" value="${colorUtils.random()}">
                </div>
                <div class="form-group">
                    <label>Заметки</label>
                    <textarea id="sub-notes" rows="2" placeholder="Дополнительная информация..."></textarea>
                </div>
            </form>
        `, [
            { text: 'Отмена', class: 'btn-secondary', action: () => UI.closeModal() },
            { 
                text: 'Добавить', 
                class: 'btn-primary', 
                action: async () => {
                    const form = document.getElementById('add-sub-form');
                    if (!form.checkValidity()) {
                        form.reportValidity();
                        return;
                    }
                    
                    const subscription = {
                        name: document.getElementById('sub-name').value,
                        cost: parseFloat(document.getElementById('sub-cost').value),
                        currency: document.getElementById('sub-currency').value,
                        billing_cycle: document.getElementById('sub-cycle').value,
                        next_payment_date: document.getElementById('sub-next-date').value,
                        category_id: document.getElementById('sub-category').value || null,
                        color: document.getElementById('sub-color').value,
                        notes: document.getElementById('sub-notes').value
                    };
                    
                    try {
                        await API.subscriptions.create(subscription);
                        UI.closeModal();
                        UI.showToast('Подписка добавлена!', 'success');
                        await this.loadData();
                    } catch (error) {
                        UI.showToast(error.message || 'Ошибка добавления подписки', 'error');
                    }
                }
            }
        ]);
        
        // Set default date to today
        document.getElementById('sub-next-date').valueAsDate = new Date();
    },
    
    // Edit subscription
    async editSubscription(id) {
        const sub = this.subscriptions.find(s => s.id === id);
        if (!sub) return;
        
        const categories = auth.getCategories();
        
        UI.showModal('Редактировать подписку', `
            <form id="edit-sub-form">
                <div class="form-group">
                    <label>Название</label>
                    <input type="text" id="edit-sub-name" required value="${sub.name}">
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Стоимость</label>
                        <input type="number" id="edit-sub-cost" required min="0" step="0.01" value="${sub.cost}">
                    </div>
                    <div class="form-group">
                        <label>Валюта</label>
                        <select id="edit-sub-currency">
                            <option value="RUB" ${sub.currency === 'RUB' ? 'selected' : ''}>₽ RUB</option>
                            <option value="USD" ${sub.currency === 'USD' ? 'selected' : ''}>$ USD</option>
                            <option value="EUR" ${sub.currency === 'EUR' ? 'selected' : ''}>€ EUR</option>
                        </select>
                    </div>
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Периодичность</label>
                        <select id="edit-sub-cycle">
                            <option value="weekly" ${sub.billingCycle === 'weekly' ? 'selected' : ''}>Неделя</option>
                            <option value="monthly" ${sub.billingCycle === 'monthly' ? 'selected' : ''}>Месяц</option>
                            <option value="quarterly" ${sub.billingCycle === 'quarterly' ? 'selected' : ''}>Квартал</option>
                            <option value="yearly" ${sub.billingCycle === 'yearly' ? 'selected' : ''}>Год</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Следующее списание</label>
                        <input type="date" id="edit-sub-next-date" required value="${sub.nextPaymentDate}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Категория</label>
                    <select id="edit-sub-category">
                        <option value="">Без категории</option>
                        ${categories.map(c => `<option value="${c.id}" ${sub.category?.id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Цвет</label>
                    <input type="color" id="edit-sub-color" value="${sub.color}">
                </div>
                <div class="form-group">
                    <label>Заметки</label>
                    <textarea id="edit-sub-notes" rows="2">${sub.notes || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="edit-sub-active" ${sub.isActive ? 'checked' : ''}>
                        Активная подписка
                    </label>
                </div>
            </form>
        `, [
            { text: 'Отмена', class: 'btn-secondary', action: () => UI.closeModal() },
            { 
                text: 'Сохранить', 
                class: 'btn-primary', 
                action: async () => {
                    const form = document.getElementById('edit-sub-form');
                    if (!form.checkValidity()) {
                        form.reportValidity();
                        return;
                    }
                    
                    const updates = {
                        name: document.getElementById('edit-sub-name').value,
                        cost: parseFloat(document.getElementById('edit-sub-cost').value),
                        currency: document.getElementById('edit-sub-currency').value,
                        billing_cycle: document.getElementById('edit-sub-cycle').value,
                        next_payment_date: document.getElementById('edit-sub-next-date').value,
                        category_id: document.getElementById('edit-sub-category').value || null,
                        color: document.getElementById('edit-sub-color').value,
                        notes: document.getElementById('edit-sub-notes').value,
                        is_active: document.getElementById('edit-sub-active').checked
                    };
                    
                    try {
                        await API.subscriptions.update(id, updates);
                        UI.closeModal();
                        UI.showToast('Подписка обновлена!', 'success');
                        await this.loadData();
                    } catch (error) {
                        UI.showToast(error.message || 'Ошибка обновления подписки', 'error');
                    }
                }
            }
        ]);
    },
    
    // Delete subscription
    async deleteSubscription(id) {
        UI.showModal('Удалить подписку', `
            <p>Вы уверены, что хотите удалить эту подписку? Это действие нельзя отменить.</p>
        `, [
            { text: 'Отмена', class: 'btn-secondary', action: () => UI.closeModal() },
            { 
                text: 'Удалить', 
                class: 'btn-danger', 
                action: async () => {
                    try {
                        await API.subscriptions.delete(id);
                        UI.closeModal();
                        UI.showToast('Подписка удалена', 'success');
                        await this.loadData();
                    } catch (error) {
                        UI.showToast(error.message || 'Ошибка удаления подписки', 'error');
                    }
                }
            }
        ]);
    },
    
    // Setup drag and drop
    setupDragAndDrop() {
        const list = document.getElementById('subscriptions-list');
        if (!list) return;
        
        let draggedItem = null;
        
        list.querySelectorAll('.subscription-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedItem = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedItem = null;
                
                // Save new order
                this.saveOrder();
            });
            
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem === card) return;
                
                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                
                if (e.clientY < midY) {
                    card.parentNode.insertBefore(draggedItem, card);
                } else {
                    card.parentNode.insertBefore(draggedItem, card.nextSibling);
                }
            });
        });
    },
    
    // Save subscription order
    async saveOrder() {
        const cards = document.querySelectorAll('.subscription-card');
        const ids = Array.from(cards).map(card => card.dataset.id);
        
        // Update local order
        this.subscriptions.sort((a, b) => {
            const indexA = ids.indexOf(a.id);
            const indexB = ids.indexOf(b.id);
            return indexA - indexB;
        });
        
        // Save to server (if premium)
        if (auth.isPremium()) {
            try {
                for (let i = 0; i < ids.length; i++) {
                    await API.subscriptions.reorder(ids[i], i);
                }
            } catch (error) {
                console.error('Save order error:', error);
            }
        }
    },
    
    // Check notifications
    checkNotifications() {
        const notifications = [];
        
        this.subscriptions.forEach(sub => {
            if (!sub.isActive) return;
            
            const daysUntil = dateUtils.daysUntil(sub.nextPaymentDate);
            
            if (daysUntil === 3 || daysUntil === 1 || daysUntil === 0) {
                const key = `notified_${sub.id}_${sub.nextPaymentDate}`;
                const alreadyNotified = storage.get(key, false);
                
                if (!alreadyNotified) {
                    notifications.push({
                        id: sub.id,
                        name: sub.name,
                        daysUntil,
                        date: sub.nextPaymentDate,
                        cost: sub.cost
                    });
                    
                    storage.set(key, true);
                }
            }
        });
        
        this.notifications = notifications;
        
        // Show notification badge
        const urgentCount = notifications.filter(n => n.daysUntil <= 1).length;
        UI.updateNotificationBadge(urgentCount);
        
        // Show toast for new notifications
        notifications.forEach(n => {
            const message = n.daysUntil === 0 
                ? `Сегодня списание за ${n.name}: ${formatCurrency(n.cost)}`
                : `Через ${n.daysUntil} ${pluralize(n.daysUntil, 'день', 'дня', 'дней')} списание за ${n.name}`;
            
            UI.showToast(message, 'warning', 8000);
        });
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.updateSubscriptionsList(tab.dataset.filter);
            });
        });
        
        // Add subscription button
        document.getElementById('add-sub-btn')?.addEventListener('click', () => {
            this.openAddSubscriptionModal();
        });
        
        // Export CSV button
        document.getElementById('export-csv-btn')?.addEventListener('click', async () => {
            if (!auth.isPremium()) {
                UI.showToast('Экспорт доступен только для Premium пользователей', 'warning');
                return;
            }
            
            try {
                await API.export.csv();
                UI.showToast('Экспорт завершен!', 'success');
            } catch (error) {
                UI.showToast(error.message || 'Ошибка экспорта', 'error');
            }
        });
        
        // Buy premium button
        document.getElementById('buy-premium-btn')?.addEventListener('click', async () => {
            try {
                const response = await API.premium.generate();
                
                UI.showModal('Оплата Premium', `
                    <div class="qr-container">
                        <div class="payment-id">
                            ${response.payment.uid}
                            <button class="copy-btn" onclick="navigator.clipboard.writeText('${response.payment.uid}'); UI.showToast('Скопировано!', 'success');">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <div class="qr-code">
                            <img src="${response.payment.staticQrUrl}" alt="QR Code" style="max-width: 100%;">
                        </div>
                        <p style="margin-bottom: 1rem;">Сумма: <strong>${response.payment.amount} ${response.payment.currency}</strong></p>
                        <ol class="qr-instructions">
                            ${response.payment.instructions.map(i => `<li>${i}</li>`).join('')}
                        </ol>
                        <div class="form-group" style="margin-top: 1rem;">
                            <label>Введите ID платежа для подтверждения:</label>
                            <input type="text" id="verify-payment-id" placeholder="ST-XXXXXXXX" value="${response.payment.uid}">
                        </div>
                    </div>
                `, [
                    { text: 'Отмена', class: 'btn-secondary', action: () => UI.closeModal() },
                    { 
                        text: 'Подтвердить оплату', 
                        class: 'btn-primary', 
                        action: async () => {
                            const paymentId = document.getElementById('verify-payment-id').value.trim();
                            if (!paymentId) {
                                UI.showToast('Введите ID платежа', 'error');
                                return;
                            }
                            
                            const success = await auth.activatePremium(paymentId);
                            if (success) {
                                UI.closeModal();
                                this.updateProfileInfo();
                            }
                        }
                    }
                ]);
            } catch (error) {
                UI.showToast(error.message || 'Ошибка генерации платежа', 'error');
            }
        });
        
        // Notifications button
        document.getElementById('notifications-btn')?.addEventListener('click', () => {
            if (this.notifications.length === 0) {
                UI.showToast('Нет новых уведомлений', 'info');
                return;
            }
            
            UI.showModal('Уведомления', `
                <div class="notifications-list">
                    ${this.notifications.map(n => `
                        <div class="notification-item ${n.daysUntil <= 1 ? 'urgent' : ''}">
                            <div class="notification-icon">
                                <i class="fas fa-${n.daysUntil === 0 ? 'exclamation-circle' : 'bell'}"></i>
                            </div>
                            <div class="notification-content">
                                <div class="notification-title">${n.name}</div>
                                <div class="notification-text">
                                    ${n.daysUntil === 0 
                                        ? 'Списание сегодня' 
                                        : `Через ${n.daysUntil} ${pluralize(n.daysUntil, 'день', 'дня', 'дней')}`}
                                    : ${formatCurrency(n.cost)}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `, [
                { text: 'Закрыть', class: 'btn-secondary', action: () => UI.closeModal() }
            ]);
        });
    }
};

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
