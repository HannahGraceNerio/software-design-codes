import { GLOBAL_STATE } from '../constants/config.js';
import { showAuthModal } from '../features/modals.js';

export function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
        window.location.hash = pageId;
        updateNavigation();
        loadPageContent(pageId);
    }
}

export function updateNavigation() {
    console.log('🔄 updateNavigation called'); // Debug log
    console.log('Current user:', GLOBAL_STATE.currentUser); // Debug log
    console.log('User role:', GLOBAL_STATE.currentUserRole); // Debug log
    
    const navActions = document.getElementById('navActions');
    if (!navActions) {
        console.error('❌ navActions element not found!');
        return;
    }
    
    if (GLOBAL_STATE.currentUser) {
        const userName = GLOBAL_STATE.currentUser.email.split('@')[0];
        navActions.innerHTML = `
            <button class="btn btn-outline btn-sm" onclick="window.showPage('account')">
                <i class="fas fa-user"></i> ${userName}
            </button>
            ${GLOBAL_STATE.currentUserRole === 'admin' ? `
                <button class="btn btn-gold btn-sm" onclick="window.showPage('admin')">
                    <i class="fas fa-tachometer-alt"></i> Admin
                </button>
            ` : ''}
            <button class="btn btn-sm" onclick="window.logout()" style="background: none; border: none; color: var(--brown-dark);">
                <i class="fas fa-sign-out-alt"></i>
            </button>
            <button class="mobile-menu-btn" onclick="window.toggleMobileMenu()">
                <i class="fas fa-bars"></i>
            </button>
        `;
    } else {
        console.log('🔓 No user, showing login buttons'); // Debug log
        navActions.innerHTML = `
            <button class="btn btn-outline btn-sm" onclick="window.showAuthModal('login')">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.showAuthModal('signup')">
                <i class="fas fa-user-plus"></i> Sign Up
            </button>
            <button class="mobile-menu-btn" onclick="window.toggleMobileMenu()">
                <i class="fas fa-bars"></i>
            </button>
        `;
    }
    
    console.log('✅ Navigation updated'); // Debug log
}
    
    const navActions = document.getElementById('navActions');
    if (!navActions) return;
    
    if (GLOBAL_STATE.currentUser) {
        const userName = GLOBAL_STATE.currentUser.email.split('@')[0];
        navActions.innerHTML = `
            <button class="btn btn-outline btn-sm" onclick="window.showPage('account')">
                <i class="fas fa-user"></i> ${userName}
            </button>
            ${GLOBAL_STATE.currentUserRole === 'admin' ? `
                <button class="btn btn-gold btn-sm" onclick="window.showPage('admin')">
                    <i class="fas fa-tachometer-alt"></i> Admin
                </button>
            ` : ''}
            <button class="btn btn-sm" onclick="window.logout()" style="background: none; border: none; color: var(--brown-dark);">
                <i class="fas fa-sign-out-alt"></i>
            </button>
            <button class="mobile-menu-btn" onclick="window.toggleMobileMenu()">
                <i class="fas fa-bars"></i>
            </button>
        `;
    } else {
        navActions.innerHTML = `
            <button class="btn btn-outline btn-sm" onclick="showAuthModal('login')">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
            <button class="btn btn-primary btn-sm" onclick="showAuthModal('signup')">
                <i class="fas fa-user-plus"></i> Sign Up
            </button>
            <button class="mobile-menu-btn" onclick="window.toggleMobileMenu()">
                <i class="fas fa-bars"></i>
            </button>
        `;
    }
    
    // Add floating chat button if not exists
    if (!document.getElementById('floatingChatButton')) {
        initFloatingChat();
    }
}

export function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

function loadPageContent(pageId) {
    switch(pageId) {
        case 'home':
            break;
        case 'products':
            window.loadProducts();
            break;
        case 'account':
            if (!GLOBAL_STATE.currentUser) {
                showAuthModal('login');
                return;
            }
            window.loadAccountContent();
            break;
        case 'admin':
            if (!GLOBAL_STATE.currentUser || GLOBAL_STATE.currentUserRole !== 'admin') {
                showAuthModal('login');
                return;
            }
            window.loadAdminContent();
            break;
        case 'about':
            break;
    }
}

function initFloatingChat() {
    const chatButton = document.createElement('div');
    chatButton.id = 'floatingChatButton';
    chatButton.className = 'floating-chat-button';
    chatButton.innerHTML = '<i class="fas fa-comment"></i>';
    chatButton.onclick = window.openChat;
    document.body.appendChild(chatButton);
}