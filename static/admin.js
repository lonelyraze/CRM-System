class AdminPanel {
    constructor() {
        console.log('AdminPanel конструктор вызван');
        this.tickets = [];
        this.users = [];
        this.smsTemplates = [];
        this.allComments = [];
        this.currentTab = 'tickets';
        this.eventSource = null;
        this.init();
    }

    async init() {
        console.log('AdminPanel init начат');
        this.setupEventListeners();
        this.connectToSSE();
        this.showTab('tickets');
        console.log('AdminPanel init завершен');
    }

    async loadTickets() {
        console.log('Загрузка тикетов...');
        try {
            const response = await fetch('/admin/api/tickets');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.tickets = await response.json();
            console.log(`Загружено ${this.tickets.length} тикетов`);
            
            if (this.currentTab === 'tickets') {
                this.renderTickets();
                this.updateStats();
            }
        } catch (error) {
            console.error('Ошибка загрузки тикетов:', error);
            this.showNotification('Ошибка загрузки тикетов', 'error');
        }
    }

    async loadUsers() {
        console.log('Загрузка пользователей...');
        try {
            const response = await fetch('/admin/api/users');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.users = await response.json();
            console.log(`Загружено ${this.users.length} пользователей`);
            
            if (this.currentTab === 'users') {
                this.renderUsers();
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            this.showNotification('Ошибка загрузки пользователей', 'error');
        }
    }

    async loadSmsTemplates() {
        console.log('Загрузка SMS шаблонов...');
        try {
            const response = await fetch('/sms/templates');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.smsTemplates = await response.json();
            console.log(`Загружено ${this.smsTemplates.length} SMS шаблонов`);
            
            if (this.currentTab === 'sms-templates') {
                this.renderSmsTemplates();
            }
        } catch (error) {
            console.error('Ошибка загрузки SMS шаблонов:', error);
            this.showNotification('Ошибка загрузки SMS шаблонов', 'error');
        }
    }

    async loadAllComments() {
        console.log('Загрузка всех комментариев...');
        try {
            const response = await fetch('/admin/api/comments');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.allComments = await response.json();
            console.log(`Загружено ${this.allComments.length} комментариев`);
            
            if (this.currentTab === 'comments') {
                this.renderAllComments();
            }
        } catch (error) {
            console.error('Ошибка загрузки комментариев:', error);
            this.showNotification('Ошибка загрузки комментариев', 'error');
        }
    }

    showTab(tabName) {
        console.log(`Переключение на вкладку: ${tabName}`);
        
        // Скрыть все вкладки
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        // Убрать активный класс со всех кнопок меню
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Показать выбранную вкладку
        const tabElement = document.getElementById(tabName + '-tab');
        if (tabElement) {
            tabElement.style.display = 'block';
            console.log(`Вкладка ${tabName} показана`);
        } else {
            console.error(`Вкладка ${tabName} не найдена!`);
        }
        
        // Активировать кнопку меню
        const menuButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (menuButton) {
            menuButton.classList.add('active');
        } else {
            console.error(`Кнопка меню для вкладки ${tabName} не найдена!`);
        }
        
        this.currentTab = tabName;
        
        // Загрузить данные для вкладки
        switch(tabName) {
            case 'tickets':
                this.loadTickets();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'sms-templates':
                this.loadSmsTemplates();
                break;
            case 'comments':
                this.loadAllComments();
                break;
            case 'settings':
                this.renderSettings();
                break;
            default:
                console.error(`Неизвестная вкладка: ${tabName}`);
        }
    }

    renderTickets() {
        console.log('Рендеринг тикетов...');
        const container = document.getElementById('tickets-list');
        if (!container) {
            console.error('Контейнер tickets-list не найден!');
            return;
        }

        if (!this.tickets || this.tickets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>Тикетов пока нет</h3>
                    <p>Нет активных заявок от пользователей</p>
                </div>
            `;
            return;
        }

        let filteredTickets = [...this.tickets];
        const statusFilter = document.getElementById('filter-status');
        const topicFilter = document.getElementById('filter-topic');

        if (statusFilter && statusFilter.value !== 'all') {
            filteredTickets = filteredTickets.filter(t => t.status === statusFilter.value);
        }

        if (topicFilter && topicFilter.value !== 'all') {
            filteredTickets = filteredTickets.filter(t => t.topic === topicFilter.value);
        }

        const ticketsHtml = filteredTickets.map(ticket => this.createTicketHtml(ticket)).join('');
        container.innerHTML = ticketsHtml;
        
        const ticketCountElement = document.getElementById('ticket-count');
        if (ticketCountElement) {
            ticketCountElement.textContent = this.tickets.length;
        }
        
        console.log(`Отрендерено ${filteredTickets.length} тикетов`);
    }

    createTicketHtml(ticket) {
        const statusIcons = {
            'opened': 'fas fa-clock',
            'processing': 'fas fa-cogs',
            'done': 'fas fa-check-circle'
        };

        const statusColors = {
            'opened': 'open',
            'processing': 'processing',
            'done': 'done'
        };

        const topicIcons = {
            'telephony': 'fas fa-phone',
            'sms': 'fas fa-sms'
        };

        return `
            <div class="ticket-card ${statusColors[ticket.status]}" data-id="${ticket.id}">
                <div class="ticket-header">
                    <div class="ticket-info">
                        <span class="ticket-id">#${ticket.id}</span>
                        <span class="ticket-topic">
                            <i class="${topicIcons[ticket.topic] || 'fas fa-question'}"></i>
                            ${ticket.topic === 'telephony' ? 'Телефония' : 'SMS'}
                        </span>
                        <span class="ticket-owner">
                            <i class="fas fa-user"></i> ${ticket.owner}
                        </span>
                        <span class="ticket-time">
                            <i class="far fa-clock"></i> ${ticket.created_at || 'Только что'}
                        </span>
                    </div>
                    <div class="ticket-actions">
                        <button class="btn-icon view-comments" title="Комментарии" onclick="adminPanel.showComments(${ticket.id})">
                            <i class="fas fa-comments"></i>
                            <span class="comment-count">${ticket.comments_count || 0}</span>
                        </button>
                        <button class="btn-icon delete-ticket" title="Удалить тикет" onclick="adminPanel.deleteTicket(${ticket.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="ticket-body">
                    ${ticket.error_text ? `
                        <div class="ticket-field">
                            <label>Ошибка:</label>
                            <p>${ticket.error_text}</p>
                        </div>
                    ` : ''}
                    
                    ${ticket.sip_number ? `
                        <div class="ticket-field">
                            <label>SIP номер:</label>
                            <p>${ticket.sip_number}</p>
                        </div>
                    ` : ''}
                    
                    ${ticket.phone_number ? `
                        <div class="ticket-field">
                            <label>Телефон:</label>
                            <p>${ticket.phone_number}</p>
                        </div>
                    ` : ''}
                    
                    ${ticket.sms_text ? `
                        <div class="ticket-field">
                            <label>SMS текст:</label>
                            <p>${ticket.sms_text}</p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="ticket-footer">
                    <div class="status-selector">
                        <select class="status-select" data-ticket-id="${ticket.id}" onchange="adminPanel.updateStatus(${ticket.id}, this.value)">
                            <option value="opened" ${ticket.status === 'opened' ? 'selected' : ''}>Открыт</option>
                            <option value="processing" ${ticket.status === 'processing' ? 'selected' : ''}>В работе</option>
                            <option value="done" ${ticket.status === 'done' ? 'selected' : ''}>Завершен</option>
                        </select>
                    </div>
                    
                    <div class="status-indicator ${statusColors[ticket.status]}">
                        <i class="${statusIcons[ticket.status]}"></i>
                        ${ticket.status === 'opened' ? 'Открыт' : 
                          ticket.status === 'processing' ? 'В работе' : 'Завершен'}
                    </div>
                </div>
            </div>
        `;
    }

    updateStats() {
        const openCount = this.tickets.filter(t => t.status === 'opened').length;
        const processingCount = this.tickets.filter(t => t.status === 'processing').length;
        const doneCount = this.tickets.filter(t => t.status === 'done').length;

        const openCountElement = document.getElementById('open-count');
        const processingCountElement = document.getElementById('processing-count');
        const doneCountElement = document.getElementById('done-count');
        
        if (openCountElement) openCountElement.textContent = openCount;
        if (processingCountElement) processingCountElement.textContent = processingCount;
        if (doneCountElement) doneCountElement.textContent = doneCount;
        
        console.log(`Статистика: Открыто=${openCount}, В работе=${processingCount}, Завершено=${doneCount}`);
    }

    async updateStatus(ticketId, status) {
        try {
            console.log(`Обновление статуса тикета ${ticketId} на ${status}`);
            const formData = new FormData();
            formData.append('ticket_id', ticketId);
            formData.append('status', status);

            const response = await fetch('/admin/status', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                const ticket = this.tickets.find(t => t.id == ticketId);
                if (ticket) {
                    ticket.status = status;
                    this.renderTickets();
                    this.updateStats();
                    
                    const ticketElement = document.querySelector(`[data-id="${ticketId}"]`);
                    if (ticketElement) {
                        ticketElement.classList.add('status-updated');
                        setTimeout(() => {
                            ticketElement.classList.remove('status-updated');
                        }, 1000);
                    }
                }
                this.showNotification('Статус обновлен');
            } else {
                this.showNotification('Ошибка обновления статуса', 'error');
            }
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            this.showNotification('Ошибка обновления статуса', 'error');
        }
    }

    async showComments(ticketId) {
        try {
            console.log(`Показать комментарии для тикета ${ticketId}`);
            const response = await fetch(`/tickets/${ticketId}/comments`);
            const comments = await response.json();
            
            document.getElementById('modal-ticket-id').textContent = ticketId;
            document.getElementById('comment-ticket-id').value = ticketId;
            
            const commentsHtml = comments.length > 0 ? 
                comments.map(c => `
                    <div class="comment-item">
                        <div class="comment-header">
                            <span class="comment-author ${c.author.includes('admin') ? 'admin' : ''}">
                                <i class="fas fa-user"></i> ${c.author}
                            </span>
                            <span class="comment-time">${c.created_at}</span>
                        </div>
                        <div class="comment-text">${c.text}</div>
                    </div>
                `).join('') :
                '<div class="no-comments">Пока нет комментариев</div>';
            
            document.getElementById('comments-list').innerHTML = commentsHtml;
            document.getElementById('comment-modal').classList.add('show');
        } catch (error) {
            console.error('Ошибка загрузки комментариев:', error);
            this.showNotification('Ошибка загрузки комментариев', 'error');
        }
    }

    async addComment() {
        const ticketId = document.getElementById('comment-ticket-id').value;
        const text = document.getElementById('comment-text').value;

        if (!text.trim()) {
            this.showNotification('Введите текст комментария', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('ticket_id', ticketId);
            formData.append('text', text);

            const response = await fetch('/tickets/comment', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                document.getElementById('comment-text').value = '';
                this.showComments(ticketId);
                this.showNotification('Комментарий добавлен');
            }
        } catch (error) {
            console.error('Ошибка добавления комментария:', error);
            this.showNotification('Ошибка добавления комментария', 'error');
        }
    }

    renderUsers() {
        const container = document.getElementById('users-list');
        if (!container) {
            console.error('Контейнер users-list не найден!');
            return;
        }

        if (!this.users || this.users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Пользователей пока нет</h3>
                    <p>Добавьте первого пользователя</p>
                </div>
            `;
            return;
        }

        const usersHtml = this.users.map(user => this.createUserHtml(user)).join('');
        container.innerHTML = usersHtml;
    }

    createUserHtml(user) {
        return `
            <div class="user-card" data-id="${user.id}">
                <div class="user-header">
                    <div class="user-info">
                        <div class="user-avatar ${user.is_admin ? 'admin' : 'user'}">
                            <i class="fas fa-${user.is_admin ? 'user-shield' : 'user'}"></i>
                        </div>
                        <div class="user-details">
                            <h3>${user.username}</h3>
                            <div class="user-meta">
                                <span class="user-role ${user.is_admin ? 'admin' : ''}">
                                    <i class="fas fa-user-tag"></i>
                                    ${user.role} ${user.is_admin ? '(Админ)' : ''}
                                </span>
                                <span class="user-id">
                                    <i class="fas fa-hashtag"></i> ID: ${user.id}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="btn-icon edit-user" title="Редактировать" onclick="adminPanel.editUser(${user.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-user" title="Удалить" onclick="adminPanel.deleteUser(${user.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="user-password">
                    <label>Пароль:</label>
                    <div class="password-field">
                        <input type="password" value="${user.password || ''}" readonly id="password-${user.id}">
                        <button class="btn-icon show-password" title="Показать пароль" onclick="adminPanel.togglePassword(${user.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon copy-password" title="Копировать пароль" onclick="adminPanel.copyPassword('${user.password || ''}')">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-icon reset-password" title="Сменить пароль" onclick="adminPanel.resetPassword(${user.id})">
                            <i class="fas fa-key"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    togglePassword(userId) {
        const input = document.getElementById(`password-${userId}`);
        const button = input.nextElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            button.innerHTML = '<i class="fas fa-eye-slash"></i>';
            button.title = 'Скрыть пароль';
        } else {
            input.type = 'password';
            button.innerHTML = '<i class="fas fa-eye"></i>';
            button.title = 'Показать пароль';
        }
    }

    copyPassword(password) {
        navigator.clipboard.writeText(password)
            .then(() => this.showNotification('Пароль скопирован в буфер обмена'))
            .catch(err => {
                console.error('Ошибка копирования:', err);
                this.showNotification('Ошибка копирования пароля', 'error');
            });
    }

    showAddUserModal() {
        const modal = document.getElementById('add-user-modal');
        if (!modal) {
            console.error('Модальное окно add-user-modal не найдено!');
            return;
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-plus"></i> Добавить пользователя</h3>
                    <button class="close-modal" onclick="adminPanel.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="create-user-form" class="modal-form">
                        <div class="form-group">
                            <label><i class="fas fa-user"></i> Имя пользователя:</label>
                            <input type="text" id="new-username" required placeholder="Введите имя пользователя">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-key"></i> Пароль:</label>
                            <input type="password" id="new-password" required placeholder="Введите пароль">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-user-tag"></i> Роль:</label>
                            <select id="new-role">
                                <option value="user">Пользователь</option>
                                <option value="admin">Администратор</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="new-is-admin">
                                <span>Администратор системы</span>
                            </label>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-user-plus"></i> Создать пользователя
                            </button>
                            <button type="button" class="btn-secondary" onclick="adminPanel.closeModal()">
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        modal.classList.add('show');
        
        const form = document.getElementById('create-user-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createUser();
        });
    }

    async createUser() {
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;
        const isAdmin = document.getElementById('new-is-admin').checked;

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);
            formData.append('role', role);
            formData.append('is_admin', isAdmin);

            const response = await fetch('/admin/user', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('Пользователь создан');
                this.closeModal();
                this.loadUsers();
            } else {
                this.showNotification(result.error || 'Ошибка создания пользователя', 'error');
            }
        } catch (error) {
            console.error('Ошибка создания пользователя:', error);
            this.showNotification('Ошибка создания пользователя', 'error');
        }
    }

    async editUser(userId) {
        const user = this.users.find(u => u.id == userId);
        if (!user) return;

        const modal = document.getElementById('add-user-modal');
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Редактировать пользователя</h3>
                    <button class="close-modal" onclick="adminPanel.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="edit-user-form" class="modal-form">
                        <input type="hidden" id="edit-user-id" value="${user.id}">
                        <div class="form-group">
                            <label><i class="fas fa-user"></i> Имя пользователя:</label>
                            <input type="text" id="edit-username" value="${user.username}" required>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-key"></i> Новый пароль (оставьте пустым, чтобы не менять):</label>
                            <input type="password" id="edit-password" placeholder="Новый пароль">
                            <small class="form-text">Если не хотите менять пароль, оставьте поле пустым</small>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-user-tag"></i> Роль:</label>
                            <select id="edit-role">
                                <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="edit-is-admin" ${user.is_admin ? 'checked' : ''}>
                                <span>Администратор системы</span>
                            </label>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Сохранить изменения
                            </button>
                            <button type="button" class="btn-secondary" onclick="adminPanel.closeModal()">
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        modal.classList.add('show');
        
        const form = document.getElementById('edit-user-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateUser(userId);
        });
    }

    async updateUser(userId) {
        const username = document.getElementById('edit-username').value;
        const password = document.getElementById('edit-password').value;
        const role = document.getElementById('edit-role').value;
        const isAdmin = document.getElementById('edit-is-admin').checked;

        try {
            const formData = new FormData();
            formData.append('username', username);
            if (password) {
                formData.append('password', password);
            }
            formData.append('role', role);
            formData.append('is_admin', isAdmin);

            const response = await fetch(`/admin/user/${userId}`, {
                method: 'PUT',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('Пользователь обновлен');
                this.closeModal();
                this.loadUsers();
            } else {
                this.showNotification(result.error || 'Ошибка обновления пользователя', 'error');
            }
        } catch (error) {
            console.error('Ошибка обновления пользователя:', error);
            this.showNotification('Ошибка обновления пользователя', 'error');
        }
    }

    async resetPassword(userId) {
        const newPassword = prompt('Введите новый пароль для пользователя:');
        if (newPassword && newPassword.trim()) {
            try {
                const formData = new FormData();
                formData.append('password', newPassword.trim());

                const response = await fetch(`/admin/user/${userId}`, {
                    method: 'PUT',
                    body: formData
                });

                const result = await response.json();
                
                if (result.status === 'success') {
                    this.showNotification('Пароль обновлен');
                    this.loadUsers();
                }
            } catch (error) {
                console.error('Ошибка смены пароля:', error);
                this.showNotification('Ошибка смены пароля', 'error');
            }
        }
    }

    async deleteUser(userId) {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?\nВсе его тикеты будут сохранены.')) {
            return;
        }

        try {
            const response = await fetch(`/admin/user/${userId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('Пользователь удален');
                this.loadUsers();
            }
        } catch (error) {
            console.error('Ошибка удаления пользователя:', error);
            this.showNotification('Ошибка удаления пользователя', 'error');
        }
    }

    async deleteTicket(ticketId) {
    if (!confirm('Вы уверены, что хотите удалить этот тикет?\nВсе комментарии к тикету также будут удалены.')) {
        return;
    }

    try {
        const response = await fetch(`/admin/ticket/${ticketId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            this.showNotification('Тикет удален');
            
            // Удаляем тикет из локального массива
            this.tickets = this.tickets.filter(t => t.id != ticketId);
            
            // Обновляем интерфейс
            this.renderTickets();
            this.updateStats();
            
            // Также обновляем список комментариев
            this.loadAllComments();
        } else {
            this.showNotification(result.error || 'Ошибка удаления тикета', 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления тикета:', error);
        this.showNotification('Ошибка удаления тикета', 'error');
    }
}

    async deleteComment(commentId) {
        if (!confirm('Вы уверены, что хотите удалить этот комментарий?')) {
            return;
        }

        try {
            const response = await fetch(`/admin/comment/${commentId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('Комментарий удален');
                this.loadAllComments();
                this.loadTickets();
            } else {
                this.showNotification(result.error || 'Ошибка удаления комментария', 'error');
            }
        } catch (error) {
            console.error('Ошибка удаления комментария:', error);
            this.showNotification('Ошибка удаления комментария', 'error');
        }
    }

    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    renderAllComments() {
        console.log('Рендеринг всех комментариев...');
        const container = document.getElementById('comments-list-tab');
        if (!container) {
            console.error('Контейнер comments-list-tab не найден!');
            return;
        }

        if (!this.allComments || this.allComments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>Комментариев пока нет</h3>
                    <p>Комментарии появятся здесь</p>
                </div>
            `;
            return;
        }

        let html = '<div class="comments-admin-list">';
        
        this.allComments.forEach(comment => {
            html += `
                <div class="comment-card" data-id="${comment.id}">
                    <div class="comment-header">
                        <div class="comment-info">
                            <span class="comment-id">#${comment.id}</span>
                            <span class="comment-ticket">
                                <i class="fas fa-ticket-alt"></i>
                                Тикет #${comment.ticket_id} (${comment.ticket_topic || 'Неизвестно'})
                            </span>
                            <span class="comment-author">
                                <i class="fas fa-user"></i> ${comment.author}
                            </span>
                            <span class="comment-time">
                                <i class="far fa-clock"></i> ${comment.created_at}
                            </span>
                        </div>
                        <div class="comment-actions">
                            <button class="btn-icon delete-comment" title="Удалить" onclick="adminPanel.deleteComment(${comment.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="comment-body">
                        <p>${comment.text}</p>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        console.log(`Отрендерено ${this.allComments.length} комментариев`);
    }

    renderSmsTemplates() {
        const container = document.getElementById('sms-templates-list');
        if (!container) {
            console.error('Контейнер sms-templates-list не найден!');
            return;
        }

        if (!this.smsTemplates || this.smsTemplates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sms"></i>
                    <h3>SMS шаблонов пока нет</h3>
                    <p>Добавьте первый шаблон</p>
                </div>
            `;
            return;
        }

        const templatesHtml = this.smsTemplates.map(template => this.createSmsTemplateHtml(template)).join('');
        container.innerHTML = templatesHtml;
    }

    createSmsTemplateHtml(template) {
        return `
            <div class="sms-template-card" data-id="${template.id}">
                <div class="sms-template-header">
                    <h3>${template.title}</h3>
                    <div class="sms-template-actions">
                        <button class="btn-icon edit-template" title="Редактировать" onclick="adminPanel.editSmsTemplate(${template.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-template" title="Удалить" onclick="adminPanel.deleteSmsTemplate(${template.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="sms-template-content">
                    <p>${template.text}</p>
                </div>
                <div class="sms-template-footer">
                    <div class="template-actions">
                        <button class="btn-sm copy-template" onclick="adminPanel.copyTemplateText('${template.text.replace(/'/g, "\\'")}')">
                            <i class="fas fa-copy"></i> Копировать текст
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    showAddSmsTemplateModal() {
        const modal = document.getElementById('add-sms-template-modal');
        if (!modal) {
            console.error('Модальное окно add-sms-template-modal не найдено!');
            return;
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-plus"></i> Добавить SMS шаблон</h3>
                    <button class="close-modal" onclick="adminPanel.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="create-sms-template-form" class="modal-form">
                        <div class="form-group">
                            <label><i class="fas fa-heading"></i> Название шаблона:</label>
                            <input type="text" id="new-template-title" required placeholder="Введите название шаблона">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-sms"></i> Текст шаблона:</label>
                            <textarea id="new-template-text" required placeholder="Введите текст SMS шаблона..." rows="4"></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-plus"></i> Создать шаблон
                            </button>
                            <button type="button" class="btn-secondary" onclick="adminPanel.closeModal()">
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        modal.classList.add('show');
        
        const form = document.getElementById('create-sms-template-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createSmsTemplate();
        });
    }

    async createSmsTemplate() {
        const title = document.getElementById('new-template-title').value;
        const text = document.getElementById('new-template-text').value;

        if (!title.trim() || !text.trim()) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('text', text);

            const response = await fetch('/admin/sms-template', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('SMS шаблон создан');
                this.closeModal();
                this.loadSmsTemplates();
            } else {
                this.showNotification('Ошибка создания шаблона', 'error');
            }
        } catch (error) {
            console.error('Ошибка создания SMS шаблона:', error);
            this.showNotification('Ошибка создания SMS шаблона', 'error');
        }
    }

    async editSmsTemplate(templateId) {
        const template = this.smsTemplates.find(t => t.id == templateId);
        if (!template) return;

        const modal = document.getElementById('add-sms-template-modal');
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Редактировать SMS шаблон</h3>
                    <button class="close-modal" onclick="adminPanel.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="edit-sms-template-form" class="modal-form">
                        <input type="hidden" id="edit-template-id" value="${template.id}">
                        <div class="form-group">
                            <label><i class="fas fa-heading"></i> Название шаблона:</label>
                            <input type="text" id="edit-template-title" value="${template.title}" required>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-sms"></i> Текст шаблона:</label>
                            <textarea id="edit-template-text" required rows="4">${template.text}</textarea>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Сохранить изменения
                            </button>
                            <button type="button" class="btn-secondary" onclick="adminPanel.closeModal()">
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        modal.classList.add('show');
        
        const form = document.getElementById('edit-sms-template-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateSmsTemplate(templateId);
        });
    }

    async updateSmsTemplate(templateId) {
        const title = document.getElementById('edit-template-title').value;
        const text = document.getElementById('edit-template-text').value;

        if (!title.trim() || !text.trim()) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('text', text);

            const response = await fetch(`/admin/sms-template/${templateId}`, {
                method: 'PUT',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('SMS шаблон обновлен');
                this.closeModal();
                this.loadSmsTemplates();
            } else {
                this.showNotification('Ошибка обновления шаблона', 'error');
            }
        } catch (error) {
            console.error('Ошибка обновления SMS шаблона:', error);
            this.showNotification('Ошибка обновления SMS шаблона', 'error');
        }
    }

    async deleteSmsTemplate(templateId) {
        if (!confirm('Вы уверены, что хотите удалить этот SMS шаблон?')) {
            return;
        }

        try {
            const response = await fetch(`/admin/sms-template/${templateId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('SMS шаблон удален');
                this.loadSmsTemplates();
            }
        } catch (error) {
            console.error('Ошибка удаления SMS шаблона:', error);
            this.showNotification('Ошибка удаления SMS шаблона', 'error');
        }
    }

    copyTemplateText(text) {
        navigator.clipboard.writeText(text)
            .then(() => this.showNotification('Текст скопирован в буфер обмена'))
            .catch(err => {
                console.error('Ошибка копирования:', err);
                this.showNotification('Ошибка копирования текста', 'error');
            });
    }

    renderSettings() {
        console.log('Рендеринг настроек...');
        const container = document.getElementById('settings-content');
        if (!container) {
            console.error('Контейнер settings-content не найден!');
            return;
        }

        container.innerHTML = `
            <div class="settings-section">
                <h2><i class="fas fa-trash"></i> Очистка данных</h2>
                <div class="settings-form">
                    <div class="form-group">
                        <h3>Удаление тикетов</h3>
                        <p>Удалить все завершенные тикеты старше:</p>
                        <select id="delete-old-tickets" class="filter-select">
                            <option value="">Не удалять</option>
                            <option value="7">7 дней</option>
                            <option value="30">30 дней</option>
                            <option value="90">90 дней</option>
                            <option value="all">Все завершенные</option>
                        </select>
                        <button class="btn-danger" onclick="adminPanel.deleteOldTickets()">
                            <i class="fas fa-trash"></i> Удалить выбранные тикеты
                        </button>
                    </div>
                    
                    <div class="form-group">
                        <h3>Удаление комментариев</h3>
                        <p>Удалить все комментарии старше:</p>
                        <select id="delete-old-comments" class="filter-select">
                            <option value="">Не удалять</option>
                            <option value="30">30 дней</option>
                            <option value="90">90 дней</option>
                            <option value="180">180 дней</option>
                            <option value="all">Все комментарии</option>
                        </select>
                        <button class="btn-danger" onclick="adminPanel.deleteOldComments()">
                            <i class="fas fa-trash"></i> Удалить выбранные комментарии
                        </button>
                    </div>
                    
                    <div class="form-group">
                        <h3>Быстрые действия</h3>
                        <div class="quick-actions">
                            <button class="btn-danger" onclick="adminPanel.deleteAllTickets()">
                                <i class="fas fa-trash-alt"></i> Удалить ВСЕ тикеты
                            </button>
                            <button class="btn-danger" onclick="adminPanel.deleteAllComments()">
                                <i class="fas fa-comment-slash"></i> Удалить ВСЕ комментарии
                            </button>
                        </div>
                        <small class="form-text">Внимание: Эти действия нельзя отменить!</small>
                    </div>
                </div>
            </div>
        `;
        console.log('Настройки отрендерены');
    }

    async deleteOldTickets() {
        const days = document.getElementById('delete-old-tickets').value;
        if (!days) return;

        const message = days === 'all' 
            ? 'Вы уверены, что хотите удалить ВСЕ завершенные тикеты?'
            : `Вы уверены, что хотите удалить завершенные тикеты старше ${days} дней?`;

        if (!confirm(message)) return;

        try {
            const formData = new FormData();
            formData.append('days', days);
            formData.append('type', 'tickets');

            const response = await fetch('/admin/cleanup', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification(`Удалено ${result.deleted_count} тикетов`);
                this.loadTickets();
            }
        } catch (error) {
            console.error('Ошибка удаления тикетов:', error);
            this.showNotification('Ошибка удаления тикетов', 'error');
        }
    }

    async deleteOldComments() {
        const days = document.getElementById('delete-old-comments').value;
        if (!days) return;

        const message = days === 'all'
            ? 'Вы уверены, что хотите удалить ВСЕ комментарии?'
            : `Вы уверены, что хотите удалить комментарии старше ${days} дней?`;

        if (!confirm(message)) return;

        try {
            const formData = new FormData();
            formData.append('days', days);
            formData.append('type', 'comments');

            const response = await fetch('/admin/cleanup', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification(`Удалено ${result.deleted_count} комментариев`);
                this.loadAllComments();
            }
        } catch (error) {
            console.error('Ошибка удаления комментариев:', error);
            this.showNotification('Ошибка удаления комментариев', 'error');
        }
    }

    async deleteAllTickets() {
        if (!confirm('ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕ тикеты?\nЭто действие нельзя отменить!')) {
            return;
        }

        try {
            const response = await fetch('/admin/cleanup/all-tickets', {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification(`Удалено ${result.deleted_count} тикетов`);
                this.loadTickets();
            }
        } catch (error) {
            console.error('Ошибка удаления всех тикетов:', error);
            this.showNotification('Ошибка удаления всех тикетов', 'error');
        }
    }
    renderSettings() {
        console.log('Рендеринг настроек...');
        const container = document.getElementById('settings-content');
        if (!container) {
            console.error('Контейнер settings-content не найден!');
            return;
        }

        container.innerHTML = `
            <div class="settings-section">
                <h2><i class="fas fa-trash"></i> Очистка данных</h2>
                <div class="settings-form">
                    <div class="form-group">
                        <h3>Удаление тикетов</h3>
                        <p>Удалить все завершенные тикеты старше:</p>
                        <select id="delete-old-tickets" class="filter-select">
                            <option value="">Не удалять</option>
                            <option value="7">7 дней</option>
                            <option value="30">30 дней</option>
                            <option value="90">90 дней</option>
                            <option value="all">Все завершенные</option>
                        </select>
                        <button class="btn-danger" onclick="adminPanel.deleteOldTickets()">
                            <i class="fas fa-trash"></i> Удалить выбранные тикеты
                        </button>
                    </div>
                    
                    <div class="form-group">
                        <h3>Удаление комментариев</h3>
                        <p>Удалить все комментарии старше:</p>
                        <select id="delete-old-comments" class="filter-select">
                            <option value="">Не удалять</option>
                            <option value="30">30 дней</option>
                            <option value="90">90 дней</option>
                            <option value="180">180 дней</option>
                            <option value="all">Все комментарии</option>
                        </select>
                        <button class="btn-danger" onclick="adminPanel.deleteOldComments()">
                            <i class="fas fa-trash"></i> Удалить выбранные комментарии
                        </button>
                    </div>
                    
                    <div class="form-group">
                        <h3>Быстрые действия</h3>
                        <div class="quick-actions">
                            <button class="btn-danger" onclick="adminPanel.deleteAllTickets()">
                                <i class="fas fa-trash-alt"></i> Удалить ВСЕ тикеты
                            </button>
                            <button class="btn-danger" onclick="adminPanel.deleteAllComments()">
                                <i class="fas fa-comment-slash"></i> Удалить ВСЕ комментарии
                            </button>
                        </div>
                        <small class="form-text">Внимание: Эти действия нельзя отменить!</small>
                    </div>
                </div>
            </div>
        `;
        console.log('Настройки отрендерены');
    }

    async deleteOldTickets() {
    const days = document.getElementById('delete-old-tickets').value;
    if (!days) return;

    const message = days === 'all' 
        ? 'Вы уверены, что хотите удалить ВСЕ завершенные тикеты?'
        : `Вы уверены, что хотите удалить завершенные тикеты старше ${days} дней?`;

    if (!confirm(message)) return;

    try {
        const formData = new FormData();
        formData.append('days', days);
        formData.append('type', 'tickets');

        const response = await fetch('/admin/cleanup', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            this.showNotification(`Удалено ${result.deleted_count} тикетов`);
            this.loadTickets();
        }
    } catch (error) {
        console.error('Ошибка удаления тикетов:', error);
        this.showNotification('Ошибка удаления тикетов', 'error');
    }
    }

    async deleteOldComments() {
        const days = document.getElementById('delete-old-comments').value;
        if (!days) return;

        const message = days === 'all'
            ? 'Вы уверены, что хотите удалить ВСЕ комментарии?'
            : `Вы уверены, что хотите удалить комментарии старше ${days} дней?`;

        if (!confirm(message)) return;

        try {
            const formData = new FormData();
            formData.append('days', days);
            formData.append('type', 'comments');

            const response = await fetch('/admin/cleanup', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification(`Удалено ${result.deleted_count} комментариев`);
                this.loadAllComments();
            }
        } catch (error) {
            console.error('Ошибка удаления комментариев:', error);
            this.showNotification('Ошибка удаления комментариев', 'error');
        }
    }

    async deleteAllTickets() {
        if (!confirm('ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕ тикеты?\nЭто действие нельзя отменить!')) {
            return;
        }

        try {
            const response = await fetch('/admin/cleanup/all-tickets', {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification(`Удалено ${result.deleted_count} тикетов`);
                this.loadTickets();
            }
        } catch (error) {
            console.error('Ошибка удаления всех тикетов:', error);
            this.showNotification('Ошибка удаления всех тикетов', 'error');
        }
    }

    async deleteAllComments() {
        if (!confirm('ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕ комментарии?\nЭто действие нельзя отменить!')) {
            return;
        }

        try {
            const response = await fetch('/admin/cleanup/all-comments', {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification(`Удалено ${result.deleted_count} комментариев`);
                this.loadAllComments();
            }
        } catch (error) {
            console.error('Ошибка удаления всех комментариев:', error);
            this.showNotification('Ошибка удаления всех комментариев', 'error');
        }
    }

    async deleteAllComments() {
        if (!confirm('ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕ комментарии?\nЭто действие нельзя отменить!')) {
            return;
        }

        try {
            const response = await fetch('/admin/cleanup/all-comments', {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification(`Удалено ${result.deleted_count} комментариев`);
                this.loadAllComments();
            }
        } catch (error) {
            console.error('Ошибка удаления всех комментариев:', error);
            this.showNotification('Ошибка удаления всех комментариев', 'error');
        }
    }

    setupEventListeners() {
        console.log('Настройка обработчиков событий...');
        
        // Переключение вкладок
        document.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem && menuItem.dataset.tab) {
                e.preventDefault();
                console.log(`Клик по меню: ${menuItem.dataset.tab}`);
                this.showTab(menuItem.dataset.tab);
            }
        });

        // Кнопка добавления пользователя
        document.addEventListener('click', (e) => {
            if (e.target.closest('#add-user-btn')) {
                console.log('Клик по кнопке добавления пользователя');
                this.showAddUserModal();
            }
            
            // Кнопка добавления SMS шаблона
            if (e.target.closest('#add-sms-template-btn')) {
                console.log('Клик по кнопке добавления SMS шаблона');
                this.showAddSmsTemplateModal();
            }
        });

        // Фильтры тикетов
        const statusFilter = document.getElementById('filter-status');
        const topicFilter = document.getElementById('filter-topic');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                console.log('Изменен фильтр статуса');
                this.renderTickets();
            });
        } else {
            console.warn('Фильтр статуса не найден');
        }
        
        if (topicFilter) {
            topicFilter.addEventListener('change', () => {
                console.log('Изменен фильтр темы');
                this.renderTickets();
            });
        } else {
            console.warn('Фильтр темы не найден');
        }

        // Добавление комментария
        const addCommentForm = document.getElementById('add-comment-form');
        if (addCommentForm) {
            addCommentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.addComment();
            });
        }

        // Клик вне модального окна
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });

        // Закрытие модалок по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
        
        console.log('Обработчики событий настроены');
    }

    connectToSSE() {
        console.log('Подключение к SSE...');
        this.eventSource = new EventSource('/events');
        
        this.eventSource.onmessage = (event) => {
            console.log('SSE сообщение:', event.data);
            if (event.data === 'update') {
                this.loadTickets();
                this.loadAllComments();
                this.showNotification('Есть новые обновления в системе!');
            }
        };

        this.eventSource.onerror = () => {
            console.log('SSE connection error, reconnecting...');
            this.eventSource.close();
            setTimeout(() => this.connectToSSE(), 3000);
        };
    }

    showNotification(message, type = 'success') {
        // Удаляем старые уведомления
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}
    
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, инициализация AdminPanel...');
    window.adminPanel = new AdminPanel();
    console.log('AdminPanel инициализирован');
});