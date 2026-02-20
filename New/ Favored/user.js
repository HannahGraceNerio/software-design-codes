import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, signOut, updatePassword 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    collection, getDocs, doc, getDoc, updateDoc, query, where, addDoc, orderBy, onSnapshot, setDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


let userWishlist = new Set();
let currentUser = null;
let currentProduct = null;
window.productsData = {}; // NEW: Stores product data to avoid passing huge strings



// --- AUTH MONITOR ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loadUserProfile(user.uid);
        loadUserOrders(user.uid);
        loadProducts();
        listenForMessages();
    } else {
        window.location.href = "/"; // Redirect if not logged in
    }
});

// --- NAVIGATION ---
window.showSection = (id) => {
    // Hide all sections including hero
    ['hero', 'products', 'account', 'edit-details', 'change-password', 'order', 'wishlist'].forEach(sec => {
        const el = document.getElementById(sec);
        if(el) el.style.display = 'none';
    });
    
    // Show the selected section
    const target = document.getElementById(id);
    if(target) {
        target.style.display = 'block';
        
        // If showing products, load them
        if(id === 'products') {
            loadProducts();
        }
        // If showing wishlist, load it
        if(id === 'wishlist') {
            loadUserWishlist();
        }
    }

    // Update active nav link
    document.querySelectorAll('.nav-center a').forEach(a => a.classList.remove('active'));
    const navLink = document.getElementById('nav-' + id);
    if(navLink) navLink.classList.add('active');
};

window.logoutUser = async () => {
    await signOut(auth);
    window.location.href = "/";
};

// --- PROFILE MANAGEMENT ---
async function loadUserProfile(uid) {
    try {
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const name = data.name || "User";
            
            // Update UI
            if(document.getElementById('welcomeName')) document.getElementById('welcomeName').innerText = name;
            if(document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = name; 
            if(document.getElementById('accountFullname')) document.getElementById('accountFullname').innerText = name;
            if(document.getElementById('accountEmail')) document.getElementById('accountEmail').innerText = data.email || currentUser.email;
            if(document.getElementById('accountPhone')) document.getElementById('accountPhone').innerText = data.phone || "Not Set";

            // Pre-fill Edit Forms
            if(document.getElementById('editFullname')) document.getElementById('editFullname').value = name;
            if(document.getElementById('editPhone')) document.getElementById('editPhone').value = data.phone || "";
        }
    } catch (e) { console.error("Error loading profile:", e); }
}

const editForm = document.getElementById('editDetailsForm');
if(editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                name: document.getElementById('editFullname').value,
                phone: document.getElementById('editPhone').value
            });
            showToast("Profile Updated Successfully!");
            loadUserProfile(currentUser.uid);
            window.showSection('account');
        } catch(e) { showToast("Error updating profile: " + e.message, 'error'); }
    });
}

const passForm = document.getElementById('changePasswordForm');
if(passForm) {
    passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmNewPassword').value;

        if(newPass !== confirm) return showToast("Passwords do not match", 'error');

        try {
            await updatePassword(currentUser, newPass);
            showToast("Password Changed Successfully!");
            window.showSection('account');
            passForm.reset();
        } catch(e) { showToast("Order failed: " + e.message, 'error');}
    });
}

async function loadUserOrders(uid) {
    const container = document.getElementById('order-container');
    if(!container) return;

    // Show loading state
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: var(--primary);"></i>
            <p style="margin-top: 20px; color: var(--taupe);">Loading your orders...</p>
        </div>
    `;

    // Listen for Order Updates
    const q = query(collection(db, "orders"), where("userId", "==", uid));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state-orders">
                    <i class="fas fa-shopping-bag"></i>
                    <p>No orders yet</p>
                    <p class="text-muted">Start your spiritual journey with our faith-inspired engravings</p>
                    <button class="btn-primary" onclick="showSection('products')" style="margin-top: 20px;">
                        <i class="fas fa-search" style="margin-right: 8px;"></i> Browse Collection
                    </button>
                </div>
            `;
            
            // Update stats to zero
            updateOrderStats([]);
            return;
        }

        // Sort orders by date (newest first)
        const orders = [];
        snapshot.forEach(doc => orders.push({id: doc.id, ...doc.data()}));
        orders.sort((a,b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = "";
        
        // Update stats
        updateOrderStats(orders);

        orders.forEach((o, index) => {
            const orderDate = new Date(o.date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            // Define status colors and icons
            const statusColors = {
                'Pending': { bg: '#fff3cd', text: '#856404', icon: 'fa-clock', class: 'status-pending' },
                'Preparing': { bg: '#cce5ff', text: '#004085', icon: 'fa-cog fa-spin', class: 'status-preparing' },
                'Ready': { bg: '#d4edda', text: '#155724', icon: 'fa-check-circle', class: 'status-ready' },
                'Completed': { bg: '#d1e7dd', text: '#0f5132', icon: 'fa-check-double', class: 'status-completed' },
                'Rejected': { bg: '#f8d7da', text: '#721c24', icon: 'fa-times-circle', class: 'status-rejected' }
            };

            const statusColor = statusColors[o.status] || statusColors['Pending'];
            const animationDelay = index * 0.1;

            container.innerHTML += `
                <div class="order-card-enhanced" style="animation-delay: ${animationDelay}s;">
                    <div class="order-header">
                        <div class="order-header-top">
                            <span class="order-number">
                                <i class="fas fa-hashtag"></i>
                                Order #${o.id.slice(-8).toUpperCase()}
                            </span>
                            <span class="order-status ${statusColor.class}" style="background: ${statusColor.bg}; color: ${statusColor.text};">
                                <i class="fas ${statusColor.icon}"></i>
                                ${o.status}
                            </span>
                        </div>
                        <div class="order-meta">
                            <span class="order-date">
                                <i class="far fa-calendar-alt"></i>
                                ${orderDate}
                            </span>
                            <span class="order-total">₱${o.totalPrice?.toLocaleString() || '0'}</span>
                        </div>
                    </div>
                    
                    <div class="order-body">
                        <div class="order-product">
                            <img src="${o.imageUrl}" class="order-product-img" onerror="this.src='assets/logo.png'">
                            <div class="order-product-details">
                                <h4 class="order-product-name">${o.productName}</h4>
                                <p class="order-product-qty">
                                    <i class="fas fa-box"></i>
                                    Quantity: ${o.quantity || 1}
                                </p>
                                ${o.personalization ? `
                                <div class="order-personalization">
                                    <i class="fas fa-quote-left"></i>
                                    "${o.personalization}"
                                </div>
                                ` : ''}
                            </div>
                        </div>

                        ${getTrackerHTML(o.status)}
                    </div>
                </div>
            `;
        });
    });
}

function updateOrderStats(orders) {
    const statsContainer = document.getElementById('order-stats');
    if (!statsContainer) return;
    
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'Pending').length;
    const preparingOrders = orders.filter(o => o.status === 'Preparing').length;
    const readyOrders = orders.filter(o => o.status === 'Ready').length;
    const completedOrders = orders.filter(o => o.status === 'Completed').length;
    
    statsContainer.innerHTML = `
        <div class="stat-card-small">
            <div class="stat-value" style="color: var(--primary);">${totalOrders}</div>
            <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card-small">
            <div class="stat-value" style="color: #856404;">${pendingOrders}</div>
            <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card-small">
            <div class="stat-value" style="color: #004085;">${preparingOrders + readyOrders}</div>
            <div class="stat-label">Processing</div>
        </div>
        <div class="stat-card-small">
            <div class="stat-value" style="color: #0f5132;">${completedOrders}</div>
            <div class="stat-label">Completed</div>
        </div>
    `;
}

window.filterUserOrders = (status) => {
    // Update active button state
    document.querySelectorAll('#order-filters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.target.classList.add('active');
    
    // Filter order cards
    const orderCards = document.querySelectorAll('#order-container .order-card-enhanced');
    orderCards.forEach(card => {
        if (status === 'all') {
            card.style.display = 'block';
        } else {
            const statusElement = card.querySelector('.order-status');
            if (statusElement) {
                const orderStatus = statusElement.textContent.trim().toLowerCase();
                card.style.display = orderStatus.includes(status) ? 'block' : 'none';
            }
        }
    });
};

window.contactSupport = (orderId) => {
    showToast('Connecting you to support...', 'success');
    setTimeout(() => {
        window.toggleChat();
    }, 1000);
};

window.reorderItem = (productId) => {
    if (window.productsData && window.productsData[productId]) {
        window.openProductDetail(productId);
    } else {
        showToast('Product not available', 'error');
    }
};

// Enhanced Wishlist Functions
let wishlistItems = [];
let wishlistSortBy = 'date-desc';
let wishlistFilter = 'all';

// Enhanced loadUserWishlist function (replace the existing one)
async function loadUserWishlist() {
    const container = document.getElementById('wishlist-container');
    if (!container || !currentUser) return;

    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: var(--primary);"></i>
            <p style="margin-top: 20px; color: var(--taupe);">Loading your wishlist...</p>
        </div>
    `;

    try {
        const wishSnap = await getDocs(collection(db, "users", currentUser.uid, "wishlist"));
        
        if (wishSnap.empty) {
            showEnhancedEmptyState(container);
            updateWishlistStats([]);
            return;
        }

        // Store items with their data
        wishlistItems = [];
        let totalValue = 0;
        
        wishSnap.forEach(docSnap => {
            const item = docSnap.data();
            const id = docSnap.id;
            
            // Get full product data if available
            const productData = window.productsData[id] || item;
            
            // Check stock status
            const stock = productData.stock || 10; // Default if not set
            const stockStatus = stock > 5 ? 'in-stock' : (stock > 0 ? 'low-stock' : 'out-of-stock');
            
            wishlistItems.push({
                id: id,
                ...productData,
                addedAt: item.addedAt?.toDate?.() || new Date(item.addedAt) || new Date(),
                stockStatus: stockStatus,
                stock: stock
            });
            
            totalValue += (productData.price || 0);
        });

        // Sort and filter items
        const filteredItems = filterWishlistItems(wishlistItems, wishlistFilter);
        const sortedItems = sortWishlistItems(filteredItems, wishlistSortBy);
        
        // Render items
        renderWishlistItems(sortedItems, container);
        
        // Update stats
        updateWishlistStats(wishlistItems);
        
    } catch (e) {
        console.error("Wishlist Error:", e);
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading wishlist</p>
                <button class="btn-primary" onclick="loadUserWishlist()">Try Again</button>
            </div>
        `;
    }
}

// Show enhanced empty state
function showEnhancedEmptyState(container) {
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-heart" style="color: #e74c3c;"></i>
            <h3>Your wishlist is empty</h3>
            <p>Browse our collection and heart the items you love</p>
            <div class="empty-state-actions">
                <button class="btn-primary" onclick="showSection('products')">
                    <i class="fas fa-search"></i> Browse Products
                </button>
                <button class="btn-outline" onclick="showSection('order')">
                    <i class="fas fa-shopping-bag"></i> My Orders
                </button>
            </div>
        </div>
    `;
}

// Render wishlist items with enhanced UI
function renderWishlistItems(items, container) {
    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-filter"></i>
                <h3>No items match your filter</h3>
                <p>Try changing your filter or clear it to see all items</p>
                <button class="btn-outline" onclick="clearWishlistFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }

    container.innerHTML = "";
    
    items.forEach((item, index) => {
        const addedDate = item.addedAt instanceof Date ? 
            item.addedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) :
            'Recently added';
        
        const stockStatusClass = {
            'in-stock': 'in-stock',
            'low-stock': 'low-stock',
            'out-of-stock': 'out-of-stock'
        }[item.stockStatus] || '';
        
        const stockStatusText = {
            'in-stock': '✓ In Stock',
            'low-stock': '⚠ Low Stock',
            'out-of-stock': '✗ Out of Stock'
        }[item.stockStatus] || 'Unknown';
        
        const stockIcon = {
            'in-stock': 'fa-check-circle',
            'low-stock': 'fa-exclamation-triangle',
            'out-of-stock': 'fa-times-circle'
        }[item.stockStatus] || 'fa-circle';
        
        container.innerHTML += `
            <div class="product-card" style="animation-delay: ${index * 0.1}s;">
                <span class="price-badge">₱${item.price}</span>
                
                <button class="wishlist-btn active" onclick="toggleWishlist('${item.id}', this); loadUserWishlist();">
                    <i class="fas fa-heart"></i>
                </button>
                
                <img src="${item.imageUrl}" alt="${item.name}" onclick="openProductDetail('${item.id}')">
                
                <div class="product-info">
                    <span class="product-category">Faith Collection</span>
                    <h3>${item.name}</h3>
                    
                    <div class="stock-indicator ${stockStatusClass}">
                        <i class="fas ${stockIcon}"></i>
                        <span>${stockStatusText}</span>
                    </div>
                    
                    <div class="added-date">
                        <i class="far fa-calendar-alt"></i>
                        Added: ${addedDate}
                    </div>
                </div>
                
                <div class="product-actions">
                    <button class="btn-add-to-cart" 
                            onclick="quickOrder('${item.id}')"
                            ${item.stockStatus === 'out-of-stock' ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart"></i>
                        ${item.stockStatus === 'out-of-stock' ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                    <button class="btn-remove" onclick="removeFromWishlist('${item.id}')" title="Remove">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

// Filter wishlist items
function filterWishlistItems(items, filter) {
    switch(filter) {
        case 'in-stock':
            return items.filter(item => item.stockStatus === 'in-stock');
        case 'low-stock':
            return items.filter(item => item.stockStatus === 'low-stock');
        default:
            return items;
    }
}

// Sort wishlist items
function sortWishlistItems(items, sortBy) {
    const sorted = [...items];
    
    switch(sortBy) {
        case 'price-asc':
            return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
        case 'price-desc':
            return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
        case 'name-asc':
            return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        case 'date-desc':
        default:
            return sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }
}

// Update wishlist stats
function updateWishlistStats(items) {
    const countEl = document.getElementById('wishlist-count');
    const totalEl = document.getElementById('wishlist-total');
    
    if (countEl) {
        countEl.textContent = items.length;
    }
    
    if (totalEl && items.length > 0) {
        const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
        totalEl.textContent = `₱${total.toLocaleString()}`;
    } else if (totalEl) {
        totalEl.textContent = '₱0';
    }
}

// Filter wishlist by button
window.filterWishlist = (filter) => {
    wishlistFilter = filter;
    
    // Update active button
    document.querySelectorAll('.wishlist-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Re-render with filter
    const filtered = filterWishlistItems(wishlistItems, filter);
    const sorted = sortWishlistItems(filtered, wishlistSortBy);
    const container = document.getElementById('wishlist-container');
    renderWishlistItems(sorted, container);
};

// Sort wishlist
window.sortWishlist = (sortBy) => {
    wishlistSortBy = sortBy;
    
    // Re-render with new sort
    const filtered = filterWishlistItems(wishlistItems, wishlistFilter);
    const sorted = sortWishlistItems(filtered, sortBy);
    const container = document.getElementById('wishlist-container');
    renderWishlistItems(sorted, container);
};

// Clear filters
window.clearWishlistFilters = () => {
    wishlistFilter = 'all';
    wishlistSortBy = 'date-desc';
    
    // Reset UI
    document.querySelectorAll('.wishlist-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes('All')) {
            btn.classList.add('active');
        }
    });
    
    document.getElementById('wishlist-sort').value = 'date-desc';
    
    // Re-render
    const sorted = sortWishlistItems(wishlistItems, 'date-desc');
    const container = document.getElementById('wishlist-container');
    renderWishlistItems(sorted, container);
};

// Quick order from wishlist
window.quickOrder = (productId) => {
    const product = window.productsData[productId] || wishlistItems.find(item => item.id === productId);
    if (product) {
        openProductDetail(productId);
    } else {
        showToast('Product details not available', 'error');
    }
};

// Remove from wishlist with confirmation
window.removeFromWishlist = async (productId) => {
    if (!confirm('Remove this item from your wishlist?')) return;
    
    const btn = document.querySelector(`.btn-remove[onclick*="'${productId}'"]`);
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }
    
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "wishlist", productId));
        userWishlist.delete(productId);
        
        // Remove from local array
        wishlistItems = wishlistItems.filter(item => item.id !== productId);
        
        // Re-render
        const filtered = filterWishlistItems(wishlistItems, wishlistFilter);
        const sorted = sortWishlistItems(filtered, wishlistSortBy);
        const container = document.getElementById('wishlist-container');
        renderWishlistItems(sorted, container);
        
        // Update stats
        updateWishlistStats(wishlistItems);
        
        showToast('Item removed from wishlist', 'success');
    } catch (e) {
        console.error("Remove error:", e);
        showToast('Failed to remove item', 'error');
        
        if (btn) {
            btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            btn.disabled = false;
        }
    }
};

// --- HELPER: Generates the Step Tracker HTML ---
function getTrackerHTML(status) {
    // If rejected, show a simple red badge instead of the tracker
    if (status === 'Rejected') {
        return `
            <div class="order-rejected">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="rejected-text">
                    <strong>Order Rejected</strong>
                    <p>Please contact support for assistance</p>
                </div>
            </div>
        `;
    }

    // Define the stages
    const stages = ["Pending", "Preparing", "Ready", "Completed"];
    
    // Find which step we are on
    let currentStepIndex = stages.indexOf(status);
    if (status === 'Accepted') currentStepIndex = 0; 
    if (currentStepIndex === -1) currentStepIndex = 0;

    // Generate the tracker steps
    let stepsHTML = '';
    stages.forEach((stage, index) => {
        const isCompleted = index <= currentStepIndex;
        const isActive = index === currentStepIndex;
        
        // Map stage to display labels
        let label = stage;
        if (stage === 'Pending') label = 'Placed';
        if (stage === 'Ready') label = 'Pick Up';
        
        // Map stage to icons
        const icons = {
            'Pending': 'fa-clipboard-list',
            'Preparing': 'fa-cog',
            'Ready': 'fa-store',
            'Completed': 'fa-check-circle'
        };
        
        stepsHTML += `
            <div class="tracker-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}">
                <div class="step-icon">
                    <i class="fas ${icons[stage]}"></i>
                </div>
                <div class="step-label">
                    ${label}
                    <span class="step-desc">${getStepDescription(stage)}</span>
                </div>
            </div>
        `;
    });

    return `
        <div class="order-tracker">
            <div class="tracker-steps">
                ${stepsHTML}
            </div>
        </div>
    `;
}
// Helper function for step descriptions
function getStepDescription(stage) {
    const descriptions = {
        'Pending': 'Order received',
        'Preparing': 'Being crafted',
        'Ready': 'Ready for pickup',
        'Completed': 'Order completed'
    };
    return descriptions[stage] || '';
}

// Helper for estimated completion
function getEstimatedCompletion(status) {
    const now = new Date();
    switch(status) {
        case 'Pending':
            now.setHours(now.getHours() + 24);
            return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
        case 'Preparing':
            now.setHours(now.getHours() + 12);
            return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
        case 'Ready':
            return 'Ready now for pickup';
        default:
            return 'Processing';
    }
}

// --- PRODUCT CATALOG (FIXED FOR BASE64 IMAGES) ---
async function loadProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;

    // Load user's wishlist if logged in
    if(currentUser) {
        const wishSnap = await getDocs(collection(db, "users", currentUser.uid, "wishlist"));
        userWishlist = new Set(wishSnap.docs.map(doc => doc.id));
    }

    const snapshot = await getDocs(collection(db, "products"));
    container.innerHTML = "";
    
    snapshot.forEach((docSnap) => {
        const p = docSnap.data();
        const id = docSnap.id;
        
        // Check if this product is in the wishlist
        const isLiked = userWishlist.has(id) ? 'active' : '';

        // Store data globally
        window.productsData[id] = { id: id, ...p };

        container.innerHTML += `
            <div class="product-card">
                <button class="wishlist-btn ${isLiked}" onclick="toggleWishlist('${id}', this)">
                    <i class="fas fa-heart"></i>
                </button>

                <img src="${p.imageUrl}" onclick="openProductDetail('${id}')" style="cursor:pointer;">
                
                <h3>${p.name}</h3>
                <p class="price">₱${p.price}</p>
                <button class="btn-primary" onclick="openProductDetail('${id}')">View Details</button>
            </div>
        `;
    });
}

// Open Modal using the ID to lookup data
window.openProductDetail = (id) => {
    currentProduct = window.productsData[id]; // Retrieve from global storage
    
    if(!currentProduct) return;

    document.getElementById('detailName').innerText = currentProduct.name;
    document.getElementById('detailDesc').innerText = currentProduct.description || "No description available.";
    document.getElementById('detailPrice').innerText = "₱" + currentProduct.price;
    document.getElementById('detailImg').src = currentProduct.imageUrl;
    
    // Reset inputs
    document.getElementById('orderQty').value = 1;
    document.getElementById('engravingText').value = "";
    
    document.getElementById('productDetailsModal').style.display = 'flex';
};

window.placeOrder = async () => {
    if(!currentProduct) return;

    const qty = document.getElementById('orderQty').value;
    const note = document.getElementById('engravingText').value;

    try {
        await addDoc(collection(db, "orders"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            productName: currentProduct.name,
            productId: currentProduct.id,
            price: Number(currentProduct.price),
            quantity: Number(qty),
            totalPrice: Number(currentProduct.price) * Number(qty),
            personalization: note,
            imageUrl: currentProduct.imageUrl, // IMPORTANT: Save image for order history
            status: "Pending", 
            date: new Date().toISOString()
        });
        
        showToast("Order Placed Successfully!");
        window.closeModal('productDetailsModal');
        window.showSection('order'); // Auto-redirect to My Orders page
    } catch(e) { 
        showToast("Order failed: " + e.message, 'error'); 
    }
};

// --- CHAT SYSTEM ---
window.toggleChat = () => {
    const body = document.getElementById('chat-body');
    const icon = document.getElementById('chat-icon');
    if (body.style.display === 'none') {
        body.style.display = 'flex';
        icon.className = 'fas fa-chevron-down';
        listenForMessages();
    } else {
        body.style.display = 'none';
        icon.className = 'fas fa-chevron-up';
    }
};

let chatListener = null; 

function listenForMessages() {
    // 1. Ensure user is logged in
    if (!currentUser) {
        console.warn("Chat: No user logged in. Waiting...");
        return;
    }

    const container = document.getElementById('chat-messages');
    if(!container) return;

    // 2. Stop any old listener to prevent double-loading
    if (chatListener) chatListener();

    console.log("Chat: Listening for messages for UID:", currentUser.uid);

    // 3. Setup the Query
    const q = query(
        collection(db, "chats"), 
        where("userId", "==", currentUser.uid), 
        orderBy("timestamp", "asc")
    );
    
    // 4. Start the Real-time Listener
    chatListener = onSnapshot(q, (snapshot) => {
        container.innerHTML = ""; // Clear current messages
        
        if (snapshot.empty) {
            showEmptyState(container, 'orders');
            return;
        }

        snapshot.forEach(docSnap => {
            const m = docSnap.data();
            // sender "user" goes on right, sender "admin" goes on left
            const side = m.sender === "user" ? "user" : "admin";
            
            const msgDiv = document.createElement('div');
            msgDiv.className = `msg ${side}`;
            msgDiv.textContent = m.text;
            container.appendChild(msgDiv);
        });

        // Auto-scroll to the bottom so newest messages are visible
        container.scrollTop = container.scrollHeight;

    }, (error) => {
        console.error("Chat Listener Failed:", error);
        // If you see a "Missing Index" error in the console, click the link provided there!
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    if (!input.value.trim() || !currentUser) return;

    await addDoc(collection(db, "chats"), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        text: input.value,
        sender: "user",
        timestamp: new Date()
    });
    input.value = "";
};

// --- WISHLIST TOGGLE ---
window.toggleWishlist = async (productId, btnElement) => {
    // 1. Check Login
    if (!currentUser) {
        showToast("Please log in to save items to your wishlist!", 'error');
        return;
    }

    // 2. Toggle the Visuals immediately (for speed)
    const isActive = btnElement.classList.contains('active');
    
    if (isActive) {
        // REMOVE from Wishlist
        btnElement.classList.remove('active');
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "wishlist", productId));
            userWishlist.delete(productId);
        } catch(e) { 
            console.error(e); 
            btnElement.classList.add('active'); // Revert if error
        }
    } else {
        // ADD to Wishlist
        btnElement.classList.add('active');
        try {
            // We save the ID and the Name so we can display a list later if needed
            const product = window.productsData[productId];
            await setDoc(doc(db, "users", currentUser.uid, "wishlist", productId), {
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrl,
                addedAt: new Date()
            });
            userWishlist.add(productId);
        } catch(e) { 
            console.error(e); 
            btnElement.classList.remove('active'); // Revert if error
        }
    }
};

window.closeModal = (id) => document.getElementById(id).style.display = 'none';

