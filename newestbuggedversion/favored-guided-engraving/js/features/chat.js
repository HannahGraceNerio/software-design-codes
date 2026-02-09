import { GLOBAL_STATE } from '../constants/config.js';
import { showAlert } from '../ui/alerts.js';

export function openChat() {
    if (!GLOBAL_STATE.currentUser) {
        window.showAuthModal('login');
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'chatModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; height: 80vh;">
            <div class="modal-header">
                <h3>
                    <i class="fas fa-comments mr-sm"></i>
                    ${GLOBAL_STATE.currentUserRole === 'admin' ? 'Customer Support' : 'Support Chat'}
                </h3>
                <button class="btn btn-sm" onclick="window.closeChatModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="modal-body" style="padding: 0; display: flex; flex-direction: column; height: calc(100% - 60px);">
                ${GLOBAL_STATE.currentUserRole === 'admin' ? renderAdminChat() : renderUserChat()}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    if (GLOBAL_STATE.currentUserRole === 'admin') {
        loadAdminConversations();
    } else {
        loadUserChat();
    }
}

export function closeChatModal() {
    const modal = document.getElementById('chatModal');
    if (modal) {
        modal.remove();
    }
}

function renderAdminChat() {
    return `
        <div style="display: flex; height: 100%;">
            <div class="chat-sidebar">
                <div class="p-md border-b border-wood-medium">
                    <h4 class="mb-sm">Conversations</h4>
                    <input type="text" id="chatSearch" class="form-control form-control-sm" placeholder="Search...">
                </div>
                <div id="chatConversations" class="p-sm" style="overflow-y: auto; height: calc(100% - 100px);">
                    <!-- Conversations will load here -->
                </div>
            </div>
            <div class="chat-main" style="flex: 1; display: flex; flex-direction: column;">
                <div id="chatMessages" class="chat-messages" style="flex: 1; overflow-y: auto;"></div>
                <div class="chat-input">
                    <div class="flex gap-sm">
                        <input type="text" id="chatInput" class="form-control" placeholder="Type your message..." 
                               onkeypress="if(event.key === 'Enter') window.sendAdminMessage()">
                        <button class="btn btn-primary" onclick="window.sendAdminMessage()">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ... CONTINUE with all chat functions