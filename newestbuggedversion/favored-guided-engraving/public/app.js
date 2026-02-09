// public/app.js - Main entry point (short version)
import { 
    // Import everything you need
    GLOBAL_STATE,
    showPage,
    updateNavigation,
    toggleMobileMenu,
    login,
    signup,
    logout,
    showAlert,
    showLoading,
    hideLoading,
    showAuthModal,
    closeAuthModal,
    togglePassword,
    loadProducts,
    filterProducts,
    displayProducts,
    clearFilters,
    viewProductDetails,
    orderProduct,
    getStatusConfig,
    submitOrder,
    loadAccountContent,
    showTab,
    editProfile,
    saveProfile,
    cancelEdit,
    loadAdminContent,
    showAdminTab,
    openChat,
    closeChatModal,
    // Add all other functions you need...
} from '../js/index.js';  // Note the path: ../js/index.js

// Make everything globally available for inline onclick handlers
window.GLOBAL_STATE = GLOBAL_STATE;
window.showPage = showPage;
window.updateNavigation = updateNavigation;
window.toggleMobileMenu = toggleMobileMenu;
window.login = login;
window.signup = signup;
window.logout = logout;
window.showAlert = showAlert;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.togglePassword = togglePassword;
window.loadProducts = loadProducts;
window.filterProducts = filterProducts;
window.displayProducts = displayProducts;
window.clearFilters = clearFilters;
window.viewProductDetails = viewProductDetails;
window.orderProduct = orderProduct;
window.getStatusConfig = getStatusConfig;
window.submitOrder = submitOrder;
window.loadAccountContent = loadAccountContent;
window.showTab = showTab;
window.editProfile = editProfile;
window.saveProfile = saveProfile;
window.cancelEdit = cancelEdit;
window.loadAdminContent = loadAdminContent;
window.showAdminTab = showAdminTab;
window.openChat = openChat;
window.closeChatModal = closeChatModal;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Firebase auth state listener
    const auth = window.firebaseAuth || firebase.auth();
    if (auth) {
        auth.onAuthStateChanged(async (user) => {
            GLOBAL_STATE.currentUser = user;
            if (user) {
                const db = window.firebaseDb || firebase.firestore();
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        GLOBAL_STATE.currentUserRole = userDoc.data().role || 'user';
                    } else {
                        await db.collection('users').doc(user.uid).set({
                            name: user.displayName || user.email.split('@')[0],
                            email: user.email,
                            role: 'user',
                            createdAt: new Date().toISOString(),
                            phone: '',
                            address: '',
                            updatedAt: new Date().toISOString()
                        });
                        GLOBAL_STATE.currentUserRole = 'user';
                    }
                } catch (error) {
                    console.error('Error loading user role:', error);
                    GLOBAL_STATE.currentUserRole = 'user';
                }
                updateNavigation();
            } else {
                GLOBAL_STATE.currentUserRole = 'user';
                updateNavigation();
            }
        });
    }
    
    // Handle page routing from URL hash
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        showPage(hash);
    } else {
        showPage('home');
    }
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Setup all event listeners from original app.js
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
    }
    
    const categoryFilter = document.getElementById('categoryFilter');
    const materialFilter = document.getElementById('materialFilter');
    const priceFilter = document.getElementById('priceFilter');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    
    if (categoryFilter) categoryFilter.addEventListener('change', filterProducts);
    if (materialFilter) materialFilter.addEventListener('change', filterProducts);
    if (priceFilter) priceFilter.addEventListener('change', filterProducts);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', clearFilters);
    
    // Escape key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAuthModal();
            const modals = document.querySelectorAll('.modal.active');
            modals.forEach(modal => {
                if (modal.id === 'productModal') window.closeProductModal();
                if (modal.id === 'customModal') window.closeModal();
                if (modal.id === 'chatModal') closeChatModal();
            });
        }
    });
}

console.log('Favored & Guided Engraving App initialized - Modular Edition');