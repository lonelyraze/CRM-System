class UserTickets {
    constructor() {
        this.eventSource = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.connectToSSE();
        this.loadSmsTemplates();
        this.setupTicketCards();
    }

    setupEventListeners() {
        const topicSelect = document.getElementById('topic-select');
        if (topicSelect) {
            topicSelect.addEventListener('change', (e) => {
                this.handleTopicChange(e.target.value);
            });
        }

        document.addEventListener('click', (e) => {

            if (e.target.closest('.comments-preview')) {
                const ticketCard = e.target.closest('.user-ticket-card');
                if (ticketCard) {
                    const ticketId = ticketCard.dataset.id;
                    this.toggleComments(ticketId, e);
                }
            }

            if (e.target.closest('.no-comments')) {
                const ticketCard = e.target.closest('.user-ticket-card');
                if (ticketCard) {
                    const ticketId = ticketCard.dataset.id;
                    this.toggleComments(ticketId, e);
                }
            }
        });

        document.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('add-comment-form')) {
                e.preventDefault();
                await this.addComment(e);
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.comments-preview') && 
                !e.target.closest('.no-comments') &&
                !e.target.closest('.comments-dropdown')) {
                this.closeAllDropdowns();
            }
        });
    }

    setupTicketCards() {

        document.querySelectorAll('.user-ticket-card').forEach(card => {
            const ticketId = card.querySelector('.ticket-meta span:nth-child(2)')?.textContent.replace('#', '');
            if (ticketId) {
                card.dataset.id = ticketId;
            }
        });
    }

    handleTopicChange(topic) {
        const telephonyFields = document.getElementById('telephony-fields');
        const smsFields = document.getElementById('sms-fields');
        
        telephonyFields.style.display = 'none';
        smsFields.style.display = 'none';
        
        if (topic === 'telephony') {
            telephonyFields.style.display = 'block';
        } else if (topic === 'sms') {
            smsFields.style.display = 'block';
            this.loadSmsTemplates();
        }
    }

    async loadSmsTemplates() {
        try {
            const response = await fetch("/sms/templates");
            const data = await response.json();
            const select = document.getElementById("smsTemplates");
            
            if (!select) return;
            
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            data.forEach(t => {
                const option = document.createElement("option");
                option.value = t.text;
                option.textContent = t.title;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Ошибка загрузки шаблонов:', error);
        }
    }

    fillTemplate(select) {
        const textarea = document.getElementById("sms_text");
        if (textarea && select.value) {
            textarea.value = select.value;
        }
    }

    toggleComments(ticketId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        const dropdown = document.getElementById('comments-' + ticketId);
        if (!dropdown) return;
        
        const isVisible = dropdown.style.display === 'block';

        this.closeAllDropdowns();
        

        dropdown.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            setTimeout(() => {
                const textarea = dropdown.querySelector('textarea');
                if (textarea) {
                    textarea.focus();
                }
            }, 100);
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.comments-dropdown').forEach(d => {
            d.style.display = 'none';
        });
    }

    async addComment(event) {
        const form = event.target;
        const textarea = form.querySelector('textarea');
        const text = textarea.value.trim();
        const ticketId = form.querySelector('input[name="ticket_id"]').value;
        
        if (!text) {
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
                textarea.value = '';
                this.showNotification('Комментарий добавлен', 'success');
                

                await this.updateTicketComments(ticketId);
            } else {
                this.showNotification('Ошибка добавления комментария', 'error');
            }
        } catch (error) {
            console.error('Ошибка добавления комментария:', error);
            this.showNotification('Ошибка добавления комментария', 'error');
        }
    }

    async updateTicketComments(ticketId) {
        try {
            const response = await fetch(`/tickets/${ticketId}/comments`);
            const comments = await response.json();
            
            const dropdown = document.getElementById('comments-' + ticketId);
            if (!dropdown) return;
            
            const commentsList = dropdown.querySelector('.comments-list');
            const commentsPreview = document.querySelector(`[data-id="${ticketId}"] .comments-preview span`);
            const noComments = document.querySelector(`[data-id="${ticketId}"] .no-comments`);
            
            if (commentsList) {

                commentsList.innerHTML = '';
                
                comments.forEach(c => {
                    const commentItem = document.createElement('div');
                    commentItem.className = 'comment-item';
                    commentItem.innerHTML = `
                        <div class="comment-header">
                            <span class="comment-author ${c.author.includes('admin') ? 'admin' : ''}">
                                <i class="fas fa-user"></i> ${c.author}
                            </span>
                            <span class="comment-time">${c.created_at}</span>
                        </div>
                        <div class="comment-text">${c.text}</div>
                    `;
                    commentsList.appendChild(commentItem);
                });

                const count = comments.length;
                if (count > 0) {
                    if (commentsPreview) {
                        const word = this.getCommentWord(count);
                        commentsPreview.textContent = `${count} ${word}`;
                    }
 
                    if (noComments) {
                        noComments.style.display = 'none';
                    }
                    const preview = document.querySelector(`[data-id="${ticketId}"] .comments-preview`);
                    if (preview) {
                        preview.style.display = 'flex';
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка обновления комментариев:', error);
        }
    }

    getCommentWord(count) {
        if (count === 1) return 'комментарий';
        if (count >= 2 && count <= 4) return 'комментария';
        return 'комментариев';
    }

connectToSSE() {
    if (this.eventSource) {
        this.eventSource.close();
    }
    
    this.eventSource = new EventSource('/events');
    
    this.eventSource.onmessage = async (event) => {
        console.log('SSE received:', event.data);
        
        if (event.data === 'update') {
            await this.updateTicketStatuses();
            this.showNotification('Есть новые обновления!', 'info');
        } else if (event.data.startsWith('delete_ticket:')) {
            // Обработка удаления тикета
            const ticketId = event.data.split(':')[1];
            await this.removeTicket(ticketId);
        }
    };

    this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        setTimeout(() => this.connectToSSE(), 3000);
    };
}

    async removeTicket(ticketId) {
        console.log(`Удаление тикета #${ticketId} в реальном времени`);
        
        // Удаляем карточку тикета из DOM
        const ticketElement = document.querySelector(`[data-id="${ticketId}"]`);
        if (ticketElement) {
            // Анимация удаления
            ticketElement.style.opacity = '0';
            ticketElement.style.transform = 'translateX(-100px)';
            ticketElement.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                ticketElement.remove();
                this.showNotification('Тикет удален', 'info');
                
                // Проверяем, остались ли тикеты
                this.checkIfNoTickets();
            }, 300);
        } else {
            // Если элемент не найден, обновляем всю страницу
            setTimeout(() => location.reload(), 500);
        }
    }

    checkIfNoTickets() {
        const ticketsGrid = document.querySelector('.tickets-grid');
        if (ticketsGrid && ticketsGrid.children.length === 0) {
            ticketsGrid.innerHTML = `
                <div class="no-tickets">
                    <i class="fas fa-inbox"></i>
                    <h3>У вас пока нет тикетов</h3>
                    <p>Создайте первый тикет, чтобы получить помощь</p>
                </div>
            `;
        }
    }

    async updateTicketStatuses() {
        try {
            const response = await fetch('/tickets?partial=1');
            if (!response.ok) {
                location.reload();
                return;
            }
            
            const ticketsData = await response.json();

            ticketsData.forEach(ticket => {
                this.updateTicketCard(ticket);
            });
            
        } catch (error) {
            console.error('Ошибка обновления статусов:', error);
            setTimeout(() => location.reload(), 2000);
        }
    }

    updateTicketCard(ticket) {
        const ticketElement = document.querySelector(`[data-id="${ticket.id}"]`);
        if (!ticketElement) return;

        const statusBadge = ticketElement.querySelector('.ticket-status-badge');
        if (statusBadge) {
            const statusText = this.getStatusText(ticket.status);
            statusBadge.innerHTML = `
                <span class="status-dot ${ticket.status}"></span>
                ${statusText}
            `;
        }

        ticketElement.className = `user-ticket-card ${ticket.status}`;
        const commentsPreview = ticketElement.querySelector('.comments-preview span');
        if (commentsPreview && ticket.comments_count !== undefined) {
            const word = this.getCommentWord(ticket.comments_count);
            commentsPreview.textContent = `${ticket.comments_count} ${word}`;
        }


        ticketElement.classList.add('status-updated');
        setTimeout(() => {
            ticketElement.classList.remove('status-updated');
        }, 1000);
    }

    getStatusText(status) {
        const statusTexts = {
            'opened': 'Открыт',
            'processing': 'В работе', 
            'done': 'Завершен'
        };
        return statusTexts[status] || status;
    }

    showNotification(message, type = 'info') {

        document.querySelectorAll('.user-notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `user-notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'info' ? 'info-circle' : type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
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
    window.userTickets = new UserTickets();
    

    window.fillTemplate = function(select) {
        window.userTickets.fillTemplate(select);
    }
});