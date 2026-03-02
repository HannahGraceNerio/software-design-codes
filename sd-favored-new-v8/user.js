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
window.productsData = {}; 

// --- AUTH MONITOR ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loadUserProfile(user.uid);
        loadUserOrders(user.uid);
        loadProducts();
        listenForMessages();
    } else {
        window.location.href = "/"; 
    }
});

// --- NAVIGATION ---
window.showSection = (id) => {
    ['hero', 'products', 'account', 'edit-details', 'change-password', 'order', 'wishlist', 'about'].forEach(sec => {
        const el = document.getElementById(sec);
        if(el) el.style.display = 'none';
    });
    
    const target = document.getElementById(id);
    if(target) {
        target.style.display = 'block';
        if(id === 'products') loadProducts();
        if(id === 'wishlist') loadUserWishlist();
    }

    document.querySelectorAll('.nav-center a').forEach(a => a.classList.remove('active'));
    const navLink = document.getElementById('nav-' + id);
    if(navLink) navLink.classList.add('active');
};

window.logoutUser = async () => {
    await signOut(auth);
    window.location.href = "/";
};

document.addEventListener('DOMContentLoaded', () => {
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownContent = document.querySelector('.dropdown-content');
    
    if (dropdownToggle && dropdownContent) {
        dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContent.classList.toggle('show');
        });
        
        document.addEventListener('click', (e) => {
            if (!dropdownToggle.contains(e.target) && !dropdownContent.contains(e.target)) {
                dropdownContent.classList.remove('show');
            }
        });
    }
});

// --- PROFILE MANAGEMENT ---
async function loadUserProfile(uid) {
    try {
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const name = data.name || "User";
            
            if(document.getElementById('welcomeName')) document.getElementById('welcomeName').innerText = name;
            if(document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = name; 
            if(document.getElementById('accountFullname')) document.getElementById('accountFullname').innerText = name;
            if(document.getElementById('accountEmail')) document.getElementById('accountEmail').innerText = data.email || currentUser.email;
            if(document.getElementById('accountPhone')) document.getElementById('accountPhone').innerText = data.phone || "Not Set";
            
            const avatar = document.getElementById('profileAvatar');
            if (avatar) avatar.innerText = name.charAt(0).toUpperCase();

            if(document.getElementById('editFullname')) document.getElementById('editFullname').value = name;
            if(document.getElementById('editPhone')) document.getElementById('editPhone').value = data.phone || "";
        }
    } catch (e) { console.error("Error loading profile:", e); }
}

document.addEventListener('DOMContentLoaded', () => {
    const newPassInput = document.getElementById('newPassword');
    const confirmPassInput = document.getElementById('confirmNewPassword');
    const newPassHint = document.getElementById('newPasswordHint');
    const confirmHint = document.getElementById('confirmPasswordHint');
    
    if (newPassInput && newPassHint) {
        newPassInput.addEventListener('input', () => {
            if (newPassInput.value.length >= 8) {
                newPassHint.className = 'password-hint valid';
                newPassHint.innerHTML = '<i class="fas fa-check-circle"></i> Strong enough';
            } else {
                newPassHint.className = 'password-hint invalid';
                newPassHint.innerHTML = '<i class="fas fa-exclamation-circle"></i> Minimum 8 characters';
            }
            
            if (confirmPassInput && confirmPassInput.value) {
                if (newPassInput.value === confirmPassInput.value) {
                    confirmHint.className = 'password-hint valid';
                    confirmHint.innerHTML = '<i class="fas fa-check-circle"></i> Passwords match';
                } else {
                    confirmHint.className = 'password-hint invalid';
                    confirmHint.innerHTML = '<i class="fas fa-exclamation-circle"></i> Passwords do not match';
                }
            }
        });
    }
    
    if (confirmPassInput && confirmHint) {
        confirmPassInput.addEventListener('input', () => {
            if (newPassInput && newPassInput.value === confirmPassInput.value) {
                confirmHint.className = 'password-hint valid';
                confirmHint.innerHTML = '<i class="fas fa-check-circle"></i> Passwords match';
            } else {
                confirmHint.className = 'password-hint invalid';
                confirmHint.innerHTML = '<i class="fas fa-exclamation-circle"></i> Passwords do not match';
            }
        });
    }
});

const editForm = document.getElementById('editDetailsForm');
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = editForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            submitBtn.disabled = true;

            const newName = document.getElementById('editFullname').value;
            const newPhone = document.getElementById('editPhone').value;

            await setDoc(doc(db, "users", currentUser.uid), {
                name: newName,
                phone: newPhone
            }, { merge: true });

            if (typeof loadUserProfile === "function") await loadUserProfile(currentUser.uid);
            window.openModal('updateSuccessModal');
            
        } catch (error) {
            console.error("Profile update error:", error);
            if (typeof showToast === "function") showToast("Error updating profile: " + error.message, 'error');
            else alert("Error updating profile: " + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

const passForm = document.getElementById('changePasswordForm');
if (passForm) {
    passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmNewPassword').value;
        const submitBtn = passForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        if (newPass.length < 8) return alert("Password must be at least 8 characters long");
        if (newPass !== confirm) return alert("Passwords do not match");

        try {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitBtn.disabled = true;
            await updatePassword(currentUser, newPass);
            passForm.reset();
            window.openModal('passwordSuccessModal');
        } catch (error) { 
            if (error.code === 'auth/requires-recent-login') alert("For security, please log out and log back in to change your password.");
            else alert("Password update failed: " + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

async function loadUserOrders(uid) {
    const container = document.getElementById('order-container');
    if(!container) return;

    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 40px; color: var(--primary);"></i><p style="margin-top: 20px; color: var(--taupe);">Loading your orders...</p></div>`;

    const q = query(collection(db, "orders"), where("userId", "==", uid));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = `<div class="empty-state-orders"><i class="fas fa-shopping-bag"></i><p>No orders yet</p><p class="text-muted">Start your spiritual journey with our faith-inspired engravings</p><button class="btn-primary" onclick="showSection('products')" style="margin-top: 20px;"><i class="fas fa-search" style="margin-right: 8px;"></i> Browse Collection</button></div>`;
            updateOrderStats([]);
            return;
        }

        const orders = [];
        snapshot.forEach(doc => orders.push({id: doc.id, ...doc.data()}));
        
        // FIX 1: Safely handle Firebase Timestamps during sorting!
        orders.sort((a, b) => {
            const timeA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
            const timeB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
            return timeB - timeA; 
        });

        container.innerHTML = "";
        updateOrderStats(orders);

        orders.forEach((o, index) => {
            const rawDate = o.date?.toDate ? o.date.toDate() : new Date(o.date);
            const orderDate = rawDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            
            const statusColors = {
                'Pending': { bg: '#fff3cd', text: '#856404', icon: 'fa-clock', class: 'status-pending' },
                'Preparing': { bg: '#cce5ff', text: '#004085', icon: 'fa-cog fa-spin', class: 'status-preparing' },
                'Ready': { bg: '#d4edda', text: '#155724', icon: 'fa-check-circle', class: 'status-ready' },
                'Completed': { bg: '#d1e7dd', text: '#0f5132', icon: 'fa-check-double', class: 'status-completed' },
                'Rejected': { bg: '#f8d7da', text: '#721c24', icon: 'fa-times-circle', class: 'status-rejected' },
                'Cancelled': { bg: '#ffebee', text: '#c62828', icon: 'fa-ban', class: 'status-rejected' }
            };

            const statusColor = statusColors[o.status] || statusColors['Pending'];
            const animationDelay = index * 0.1;

            container.innerHTML += `
                <div class="order-card-enhanced" style="animation-delay: ${animationDelay}s;">
                    <div class="order-header">
                        <div class="order-header-top">
                            <span class="order-number" style="background: var(--cream); padding: 5px 15px; border-radius: 30px; font-weight: 700; color: var(--primary);"><i class="fas fa-hashtag"></i>${o.id.slice(-8).toUpperCase()}</span>
                            <span class="order-status ${statusColor.class}" style="background: ${statusColor.bg}; color: ${statusColor.text};"><i class="fas ${statusColor.icon}"></i> ${o.status}</span>
                        </div>
                        <div class="order-meta">
                            <span class="order-date"><i class="far fa-calendar-alt"></i> <span class="order-date-value">${orderDate}</span></span>
                            <span class="order-total">₱${o.totalPrice?.toLocaleString() || '0'}</span>
                        </div>
                    </div>
                    <div class="order-body">
                        <div class="order-product">
                            <img src="${o.imageUrl}" class="order-product-img" onerror="this.src='assets/logo.png'">
                            <div class="order-product-details">
                                <h4 class="order-product-name">${o.productName}</h4>
                                ${o.personalization ? `<div class="order-personalization"><i class="fas fa-quote-left"></i> "${o.personalization}"</div>` : ''}
                            </div>
                        </div>
                        ${typeof getTrackerHTML === 'function' ? getTrackerHTML(o.status) : ''}
                        <div class="order-actions-container">
                            <button class="btn-primary" onclick="contactSupport('${o.id}')"><i class="fas fa-headset"></i> Support</button>
                            ${(o.elements && o.elements.length > 0) || o.posX !== undefined ? `<button class="btn-outline" onclick="viewMyDesign('${o.id}')"><i class="fas fa-eye"></i> View My Design</button>` : ''}
                        </div>
                        ${o.status === 'Pending' ? `<div class="order-cancel-container"><button class="btn-outline btn-cancel-order" onclick="openCancelModal('${o.id}')"><i class="fas fa-times-circle"></i> Cancel Order</button></div>` : ''}
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
        <div class="stat-card-small"><div class="stat-value" style="color: var(--primary);">${totalOrders}</div><div class="stat-label">Total Orders</div></div>
        <div class="stat-card-small"><div class="stat-value" style="color: #856404;">${pendingOrders}</div><div class="stat-label">Pending</div></div>
        <div class="stat-card-small"><div class="stat-value" style="color: #004085;">${preparingOrders + readyOrders}</div><div class="stat-label">Processing</div></div>
        <div class="stat-card-small"><div class="stat-value" style="color: #0f5132;">${completedOrders}</div><div class="stat-label">Completed</div></div>
    `;
}

window.filterUserOrders = (status) => {
    document.querySelectorAll('#order-filters .filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    const orderCards = document.querySelectorAll('#order-container .order-card-enhanced');
    orderCards.forEach(card => {
        if (status === 'all') card.style.display = 'block';
        else {
            const statusElement = card.querySelector('.order-status');
            if (statusElement) card.style.display = statusElement.textContent.trim().toLowerCase().includes(status) ? 'block' : 'none';
        }
    });
};


// --- DATE FILTER LOGIC FOR USER ---
window.filterUserBySpecificDate = (selectedDate) => {
    const orderCards = document.querySelectorAll('.order-card-enhanced');
    
    // FIX 3: If the user clears the date, show all orders again instead of freezing!
    if (!selectedDate) {
        orderCards.forEach(card => card.style.display = "block");
        return;
    }

    let foundCount = 0;

    orderCards.forEach(card => {
        const dateEl = card.querySelector('.order-date-value');       
        if (dateEl) {
            // Clean the text just in case it grabs an icon by accident
            const dateText = dateEl.innerText.replace(/[^a-zA-Z0-9\s,]/g, '').trim(); 
            const d = new Date(dateText);
            
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const formattedCardDate = `${year}-${month}-${day}`;

                if (formattedCardDate === selectedDate) {
                    card.style.display = "block";
                    foundCount++;
                } else {
                    card.style.display = "none";
                }
            }
        }
    });
    
    if (foundCount === 0) {
        if (typeof showToast === 'function') showToast("No orders found for this date", "error");
        else alert("No orders found for this date");
        
        const dateInput = document.getElementById('userDateFilter');
        if(dateInput) dateInput.value = "";
        orderCards.forEach(card => card.style.display = "block");
    }
};


window.openCancelModal = (orderId) => {
    document.getElementById('cancelOrderIdToSubmit').value = orderId;
    document.getElementById('cancelReason').value = ""; 
    window.openModal('cancelOrderModal');
};

window.submitCancellation = async () => {
    const orderId = document.getElementById('cancelOrderIdToSubmit').value;
    const reason = document.getElementById('cancelReason').value;
    const btn = document.getElementById('confirmCancelBtn');

    if (!reason) return alert("Please select a reason for cancellation");

    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';
        btn.disabled = true;
        await updateDoc(doc(db, "orders", orderId), { status: "Cancelled", cancelReason: reason, cancelledAt: new Date().toISOString() });
        if (typeof showToast === 'function') showToast("Order cancelled successfully", "success");
        window.closeModal('cancelOrderModal');
    } catch (error) { console.error("Error cancelling order:", error); } 
    finally { btn.innerHTML = 'Confirm Cancel'; btn.disabled = false; }
};

window.contactSupport = async (orderId) => {
    const chatBody = document.getElementById('chat-body');
    const chatIcon = document.getElementById('chat-icon');
    if (chatBody && chatBody.style.display === 'none') {
        chatBody.style.display = 'flex'; chatIcon.className = 'fas fa-chevron-down'; listenForMessages(); 
    }

    try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        let orderData = orderSnap.exists() ? orderSnap.data() : {};

        await addDoc(collection(db, "chats"), {
            userId: currentUser.uid, userEmail: currentUser.email,
            text: "Hi, I have a question regarding this order.",
            linkedOrderId: orderId, linkedOrderName: orderData.productName || "Custom Order", 
            linkedOrderImg: orderData.imageUrl || "assets/logo.png", linkedOrderStatus: orderData.status || "Pending",          
            sender: "user", timestamp: new Date()
        });
        
        const container = document.getElementById('chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
    } catch (error) { console.error("Error sending order to chat:", error); }
};

// --- WISHLIST SYSTEM ---
let wishlistItems = [];
let wishlistSortBy = 'date-desc';
let wishlistFilter = 'all';

async function loadUserWishlist() {
    const container = document.getElementById('wishlist-container');
    if (!container || !currentUser) return;

    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 40px; color: var(--primary);"></i><p style="margin-top: 20px; color: var(--taupe);">Loading your wishlist...</p></div>`;

    try {
        const wishSnap = await getDocs(collection(db, "users", currentUser.uid, "wishlist"));
        if (wishSnap.empty) { showEnhancedEmptyState(container); updateWishlistStats([]); return; }

        wishlistItems = [];
        let totalValue = 0;
        
        wishSnap.forEach(docSnap => {
            const item = docSnap.data();
            const id = docSnap.id;
            const productData = window.productsData[id] || item;
            const stock = productData.stock || 10; 
            const stockStatus = stock > 5 ? 'in-stock' : (stock > 0 ? 'low-stock' : 'out-of-stock');
            
            wishlistItems.push({ id: id, ...productData, addedAt: item.addedAt?.toDate?.() || new Date(item.addedAt) || new Date(), stockStatus: stockStatus, stock: stock });
            totalValue += (productData.price || 0);
        });

        const filteredItems = filterWishlistItems(wishlistItems, wishlistFilter);
        renderWishlistItems(sortWishlistItems(filteredItems, wishlistSortBy), container);
        updateWishlistStats(wishlistItems);
    } catch (e) { container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><p>Error loading wishlist</p></div>`; }
}

function showEnhancedEmptyState(container) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-heart" style="color: #e74c3c;"></i><h3>Your wishlist is empty</h3><p>Browse our collection and heart the items you love</p><div class="empty-state-actions"><button class="btn-primary" onclick="showSection('products')"><i class="fas fa-search"></i> Browse Products</button></div></div>`;
}

function renderWishlistItems(items, container) {
    if (items.length === 0) return container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>No items match your filter</h3></div>`;
    container.innerHTML = "";
    items.forEach((item, index) => {
        const stockStatusClass = {'in-stock': 'in-stock', 'low-stock': 'low-stock', 'out-of-stock': 'out-of-stock'}[item.stockStatus] || '';
        const stockStatusText = {'in-stock': '✓ In Stock', 'low-stock': '⚠ Low Stock', 'out-of-stock': '✗ Out of Stock'}[item.stockStatus] || 'Unknown';
        
        container.innerHTML += `
            <div class="product-card" style="animation-delay: ${index * 0.1}s;">
                <span class="price-badge">₱${item.price}</span>
                <button class="wishlist-btn active" onclick="toggleWishlist('${item.id}', this); loadUserWishlist();"><i class="fas fa-heart"></i></button>
                <img src="${item.imageUrl}" alt="${item.name}" onclick="openProductDetail('${item.id}')">
                <div class="product-info">
                    <span class="product-category">Faith Collection</span>
                    <h3>${item.name}</h3>
                    <div class="stock-indicator ${stockStatusClass}"><span>${stockStatusText}</span></div>
                </div>
                <div class="product-actions">
                    <button class="btn-add-to-cart" onclick="quickOrder('${item.id}')" ${item.stockStatus === 'out-of-stock' ? 'disabled' : ''}><i class="fas fa-shopping-cart"></i> Add to Cart</button>
                    <button class="btn-remove" onclick="removeFromWishlist('${item.id}')"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
    });
}

function filterWishlistItems(items, filter) {
    if (filter === 'in-stock') return items.filter(item => item.stockStatus === 'in-stock');
    if (filter === 'low-stock') return items.filter(item => item.stockStatus === 'low-stock');
    return items;
}

function sortWishlistItems(items, sortBy) {
    const sorted = [...items];
    if (sortBy === 'price-asc') return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sortBy === 'price-desc') return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sortBy === 'name-asc') return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

function updateWishlistStats(items) {
    if (document.getElementById('wishlist-count')) document.getElementById('wishlist-count').textContent = items.length;
    if (document.getElementById('wishlist-total') && items.length > 0) document.getElementById('wishlist-total').textContent = `₱${items.reduce((sum, item) => sum + (item.price || 0), 0).toLocaleString()}`;
}

window.filterWishlist = (filter) => {
    wishlistFilter = filter;
    document.querySelectorAll('.wishlist-filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderWishlistItems(sortWishlistItems(filterWishlistItems(wishlistItems, filter), wishlistSortBy), document.getElementById('wishlist-container'));
};

window.sortWishlist = (sortBy) => {
    wishlistSortBy = sortBy;
    renderWishlistItems(sortWishlistItems(filterWishlistItems(wishlistItems, wishlistFilter), sortBy), document.getElementById('wishlist-container'));
};

window.clearWishlistFilters = () => {
    wishlistFilter = 'all'; wishlistSortBy = 'date-desc';
    document.querySelectorAll('.wishlist-filter-btn').forEach(btn => { btn.classList.remove('active'); if (btn.textContent.includes('All')) btn.classList.add('active'); });
    document.getElementById('wishlist-sort').value = 'date-desc';
    renderWishlistItems(sortWishlistItems(wishlistItems, 'date-desc'), document.getElementById('wishlist-container'));
};

window.quickOrder = (productId) => {
    if (window.productsData[productId]) openProductDetail(productId);
};

window.removeFromWishlist = async (productId) => {
    if (!confirm('Remove this item from your wishlist?')) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "wishlist", productId));
        userWishlist.delete(productId);
        wishlistItems = wishlistItems.filter(item => item.id !== productId);
        renderWishlistItems(sortWishlistItems(filterWishlistItems(wishlistItems, wishlistFilter), wishlistSortBy), document.getElementById('wishlist-container'));
        updateWishlistStats(wishlistItems);
    } catch (e) { console.error("Remove error:", e); }
};

window.toggleWishlist = async (productId, btnElement) => {
    if (!currentUser) return alert("Please log in to save items to your wishlist!");
    const isActive = btnElement.classList.contains('active');
    if (isActive) {
        btnElement.classList.remove('active');
        try { await deleteDoc(doc(db, "users", currentUser.uid, "wishlist", productId)); userWishlist.delete(productId); } catch(e) { btnElement.classList.add('active'); }
    } else {
        btnElement.classList.add('active');
        try {
            const product = window.productsData[productId];
            await setDoc(doc(db, "users", currentUser.uid, "wishlist", productId), { name: product.name, price: product.price, imageUrl: product.imageUrl, addedAt: new Date() });
            userWishlist.add(productId);
        } catch(e) { btnElement.classList.remove('active'); }
    }
};

function getTrackerHTML(status) {
    if (status === 'Rejected') return `<div class="order-rejected"><i class="fas fa-exclamation-triangle"></i><strong>Order Rejected</strong></div>`;
    const stages = ["Pending", "Preparing", "Ready", "Completed"];
    let currentStepIndex = stages.indexOf(status);
    if (status === 'Accepted') currentStepIndex = 0; 
    if (currentStepIndex === -1) currentStepIndex = 0;

    let stepsHTML = '';
    stages.forEach((stage, index) => {
        const isCompleted = index <= currentStepIndex;
        const isActive = index === currentStepIndex;
        let label = stage === 'Pending' ? 'Placed' : (stage === 'Ready' ? 'Pick Up' : stage);
        const icons = {'Pending': 'fa-clipboard-list', 'Preparing': 'fa-cog', 'Ready': 'fa-store', 'Completed': 'fa-check-circle'};
        stepsHTML += `<div class="tracker-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}"><div class="step-icon"><i class="fas ${icons[stage]}"></i></div><div class="step-label">${label}</div></div>`;
    });
    return `<div class="order-tracker"><div class="tracker-steps">${stepsHTML}</div></div>`;
}

// --- PRODUCT CATALOG ---
async function loadProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;

    container.innerHTML = Array(4).fill(0).map(() => `
        <div class="product-card">
            <div class="skeleton-loader skeleton-product"></div>
            <div class="skeleton-loader skeleton-text"></div>
            <div class="skeleton-loader skeleton-text short"></div>
        </div>
    `).join('');
    
    if(currentUser) {
        const wishSnap = await getDocs(collection(db, "users", currentUser.uid, "wishlist"));
        userWishlist = new Set(wishSnap.docs.map(doc => doc.id));
    }

    const snapshot = await getDocs(collection(db, "products"));
    container.innerHTML = "";
    
    snapshot.forEach((docSnap) => {
        const p = docSnap.data();
        const id = docSnap.id;
        const isLiked = userWishlist.has(id) ? 'active' : '';
        const stockCount = p.stock !== undefined ? p.stock : 0;

        window.productsData[id] = { id: id, ...p };

        container.innerHTML += `
            <div class="product-card">
                <button class="wishlist-btn ${isLiked}" onclick="toggleWishlist('${id}', this)"><i class="fas fa-heart"></i></button>
                <img src="${p.imageUrl}" onclick="openProductDetail('${id}')" style="cursor:pointer; width: 100%; object-fit: cover; border-radius: 8px;">
                <h3 style="margin-top: 15px; text-align: center;">${p.name}</h3>
                
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 0px;">
                    <p class="price" style="margin: 0; font-weight: bold; font-size: 1.1rem;">₱${p.price}</p>
                </div>

                <span style="color: var(--taupe); font-size: 0.85rem;"><i class="fas fa-box"></i> Stock: ${stockCount}</span>
                <button class="btn-primary" onclick="openProductDetail('${id}')" style="width: 100%;">View Details</button>
            </div>
        `;      
    });
}


let currentDesignData = null; 

window.openProductDetail = (id) => {
    currentProduct = window.productsData[id];
    if(!currentProduct) return;
    currentDesignData = null; 
    document.getElementById('detailName').innerText = currentProduct.name;
    document.getElementById('detailDesc').innerText = currentProduct.description || "No description available.";
    document.getElementById('detailPrice').innerText = "₱" + currentProduct.price;
    document.getElementById('detailImg').src = currentProduct.imageUrl;
    document.getElementById('orderQty').value = 1;
    
    document.getElementById('productDetailsModal').style.display = 'flex';
};

// ==========================================
// CLEAN MULTI-ITEM DESIGN STUDIO ENGINE
// ==========================================
let designItems = []; 
let selectedItemId = null;
let studioDragging = false;
let initialX, initialY;

window.incrementSize = (delta) => {
    if (!selectedItemId) return;
    const item = designItems.find(i => i.id === selectedItemId);
    if (!item) return;
    const slider = document.getElementById('studioSizeSlider');
    let newSize = item.size + delta;
    newSize = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), newSize));
    item.size = newSize;
    renderCanvas();
};

window.incrementRotate = (delta) => {
    if (!selectedItemId) return;
    const item = designItems.find(i => i.id === selectedItemId);
    if (!item) return;
    const slider = document.getElementById('studioRotateSlider');
    let newRotate = item.rotation + delta;
    newRotate = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), newRotate));
    item.rotation = newRotate;
    renderCanvas();
};

window.handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) return alert("File is too large! Please select an image under 5MB.");

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Img = e.target.result;
        
        // Push the image to the design items array
        const newItem = {
            id: Date.now(),
            type: 'image', 
            content: base64Img,
            font: 'Arial', 
            size: 150, 
            rotation: 0,
            x: 0, y: 0
        };
        
        designItems.push(newItem);
        selectedItemId = newItem.id;
        renderCanvas();
    };
    reader.readAsDataURL(file);
    setTimeout(() => { const input = document.getElementById('imageUploadInput'); if (input) input.value = ""; }, 100);
};

window.openDesignStudio = () => {
    if(!currentProduct) return;
    window.closeModal('productDetailsModal');
    window.openModal('designStudioModal');
    
    document.getElementById('studioImg').src = currentProduct.imageUrl;
    document.getElementById('studioTextAdd').value = "";
    document.getElementById('studioFont').value = "Arial";
    
    if (!currentDesignData || !currentDesignData.elements) {
        designItems = [];
    } else {
        designItems = JSON.parse(JSON.stringify(currentDesignData.elements)); 
    }
    
    selectedItemId = null;
    renderCanvas();
};

window.addTextToCanvas = () => {
    const textVal = document.getElementById('studioTextAdd').value.trim();
    if (!textVal) return alert("Please type some text first!");
    designItems.push({ id: Date.now(), type: 'text', content: textVal, font: 'Arial', size: 30, rotation: 0, x: 0, y: 0 });
    selectedItemId = designItems[designItems.length-1].id;
    document.getElementById('studioTextAdd').value = ""; 
    renderCanvas();
};

window.addBorderToCanvas = () => {
    const borderVal = document.getElementById('studioBorderAdd').value;
    designItems.push({ id: Date.now(), type: 'border', content: borderVal, font: 'Arial', size: 40, rotation: 0, x: 0, y: 0 });
    selectedItemId = designItems[designItems.length-1].id;
    renderCanvas();
};

window.renderCanvas = () => {
    const wrapper = document.getElementById('canvasItemsWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = ""; 
    
    designItems.forEach(item => {
        let el;
        const isImage = item.type === 'image' || (typeof item.content === 'string' && item.content.startsWith('data:image'));
        
        if (isImage) {
            el = document.createElement('img');
            el.src = item.content;
            el.style.width = item.size + "px"; 
            el.style.height = "auto";
            el.style.display = "block"; 
            el.draggable = false; 
        } else {
            el = document.createElement('div');
            el.innerText = item.content;
            el.style.color = '#2c1a0e';
            el.style.textAlign = 'center';
            el.style.whiteSpace = 'pre-wrap';
            el.style.lineHeight = item.type === 'text' ? '1.2' : '1';
            el.style.fontSize = item.size + "px"; 
            
            if(item.font && item.font.toLowerCase() !== "arial") {
                let linkId = 'font-' + item.font.replace(/\s+/g, '');
                if(!document.getElementById(linkId)) {
                    let link = document.createElement('link'); 
                    link.id = linkId; 
                    link.rel = 'stylesheet';
                    link.href = `https://fonts.googleapis.com/css2?family=${item.font.replace(/\s+/g, '+')}&display=swap`;
                    document.head.appendChild(link);
                }
                el.style.fontFamily = `"${item.font}", sans-serif`;
            } else {
                el.style.fontFamily = "Arial, sans-serif";
            }
        }
        
        el.className = "canvas-item";
        el.setAttribute('data-id', item.id);
        el.style.position = 'absolute';
        el.style.top = '50%';
        el.style.left = '50%';
        el.style.cursor = 'move';
        el.style.mixBlendMode = 'multiply'; 
        el.style.pointerEvents = 'auto'; 
        
        el.style.zIndex = item.id === selectedItemId ? '30' : '20';
        el.style.transform = `translate(calc(-50% + ${item.x}px), calc(-50% + ${item.y}px)) rotate(${item.rotation}deg)`;
        
        if (item.id === selectedItemId) {
            el.style.outline = "2px dashed #f39c12";
            el.style.outlineOffset = "4px";
        }
        wrapper.appendChild(el);
    });
    updatePropertiesPanel();
};

function updatePropertiesPanel() {
    const panel = document.getElementById('editPropertiesPanel');
    const item = designItems.find(i => i.id === selectedItemId);
    
    if (item) {
        panel.style.opacity = "1";
        panel.style.pointerEvents = "auto";
        
        document.getElementById('studioFont').value = item.font || "Arial";
        document.getElementById('studioSizeSlider').value = item.size;
        if(document.getElementById('studioSizeLabel')) document.getElementById('studioSizeLabel').innerText = item.size + "px";
        const mSize = document.getElementById('manualSizeInput');
        if (mSize) mSize.value = item.size + "px";
        
        document.getElementById('studioRotateSlider').value = item.rotation;
        if(document.getElementById('studioRotateLabel')) document.getElementById('studioRotateLabel').innerText = item.rotation + "°";
        const mRot = document.getElementById('manualRotateInput');
        if (mRot) mRot.value = item.rotation + "°";
    } else {
        panel.style.opacity = "0.4";
        panel.style.pointerEvents = "none";
    }
}

window.updateSelectedItem = () => {
    if (!selectedItemId) return;
    const item = designItems.find(i => i.id === selectedItemId);
    if (!item) return;
    
    item.font = document.getElementById('studioFont').value || "Arial";
    
    const manualSizeInput = document.getElementById('manualSizeInput');
    const manualRotateInput = document.getElementById('manualRotateInput');

    if (manualSizeInput && document.activeElement === manualSizeInput) {
        let val = parseInt(manualSizeInput.value.replace('px', ''));
        if(!isNaN(val)) item.size = val;
    } else {
        item.size = parseInt(document.getElementById('studioSizeSlider').value);
    }

    if (manualRotateInput && document.activeElement === manualRotateInput) {
        let val = parseInt(manualRotateInput.value.replace('°', ''));
        if(!isNaN(val)) item.rotation = val;
    } else {
        item.rotation = parseInt(document.getElementById('studioRotateSlider').value);
    }
    
    renderCanvas();
};

window.deleteSelectedItem = () => {
    if (!selectedItemId) return;
    designItems = designItems.filter(i => i.id !== selectedItemId);
    selectedItemId = null;
    renderCanvas();
};

window.saveStudioDesign = () => {
    if (designItems.length === 0) return alert("Please add at least one text, border, or image to your design!");
    currentDesignData = { elements: JSON.parse(JSON.stringify(designItems)) };
    window.closeModal('designStudioModal');
    window.openModal('productDetailsModal');
    const pBtn = document.getElementById('personalizeBtn');
    if (pBtn) { pBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Re-customize'; pBtn.style.background = "#6d4c41"; }
};

window.addEventListener("mousedown", dragStart);
window.addEventListener("touchstart", dragStart, { passive: false });
window.addEventListener("mouseup", dragEnd);
window.addEventListener("touchend", dragEnd);
window.addEventListener("mousemove", dragMove);
window.addEventListener("touchmove", dragMove, { passive: false });

function dragStart(e) {
    const target = e.target.closest('.canvas-item');
    if (target) {
        selectedItemId = parseInt(target.getAttribute('data-id'));
        renderCanvas(); 
        const item = designItems.find(i => i.id === selectedItemId);
        if(!item) return;
        const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
        initialX = clientX - item.x;
        initialY = clientY - item.y;
        studioDragging = true;
    } else if (e.target.id === "canvasContainer" || e.target.id === "studioImg") {
        selectedItemId = null;
        renderCanvas();
    }
}
function dragEnd() { studioDragging = false; }
function dragMove(e) {
    if (!studioDragging || !selectedItemId) return;
    e.preventDefault(); 
    const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
    const item = designItems.find(i => i.id === selectedItemId);
    if(item) {
        item.x = clientX - initialX;
        item.y = clientY - initialY;
        renderCanvas(); 
    }
}

// --- USER VISUAL DESIGN PROOF ---
window.viewMyDesign = async (orderId) => {
    try {
        const orderSnap = await getDoc(doc(db, "orders", orderId));
        if (!orderSnap.exists()) return;
        const data = orderSnap.data();

        document.getElementById('userPreviewImg').src = data.imageUrl;
        const wrapper = document.getElementById('userCanvas'); 
        if(!wrapper) return;
        
        Array.from(wrapper.children).forEach(child => {
            if (child.tagName !== 'IMG') child.remove();
        });

        if (data.elements && Array.isArray(data.elements)) {
            data.elements.forEach(item => {
                let el;
                const isImage = item.type === 'image' || (typeof item.content === 'string' && item.content.startsWith('data:image'));
                
                if (isImage) {
                    el = document.createElement('img');
                    el.src = item.content;
                    el.style.width = item.size + "px";
                    el.style.height = "auto";
                    el.style.display = "block";
                } else {
                    el = document.createElement('div');
                    el.innerText = item.content;
                    el.style.color = '#2c1a0e';
                    el.style.textAlign = 'center';
                    el.style.whiteSpace = 'pre-wrap';
                    el.style.lineHeight = item.type === 'text' ? '1.2' : '1';
                    el.style.fontSize = item.size + "px";
                    
                    if(item.font && item.font.toLowerCase() !== "arial") {
                        el.style.fontFamily = `"${item.font}", sans-serif`;
                        let linkId = 'preview-font-' + item.font.replace(/\s+/g, '');
                        if(!document.getElementById(linkId)) {
                            let link = document.createElement('link'); link.id = linkId; link.rel = 'stylesheet';
                            link.href = `https://fonts.googleapis.com/css2?family=${item.font.replace(/\s+/g, '+')}&display=swap`;
                            document.head.appendChild(link);
                        }
                    } else { el.style.fontFamily = "Arial, sans-serif"; }
                }
                
                el.style.position = 'absolute';
                el.style.top = '50%';
                el.style.left = '50%';
                el.style.mixBlendMode = 'multiply';
                el.style.pointerEvents = 'none';
                el.style.transform = `translate(calc(-50% + ${item.x}px), calc(-50% + ${item.y}px)) rotate(${item.rotation}deg)`;
                
                wrapper.appendChild(el);
            });
        } 
        window.openModal('userPreviewModal');
    } catch (error) { console.error("Error loading design preview:", error); }
};

window.placeOrder = async () => {
    if(!currentProduct || !currentUser) return;
    if (!currentDesignData) return alert("Please click 'Customize & Design' to create your engraving layout before placing an order.");

    const qtyInput = document.getElementById('orderQty');
    if (!qtyInput) return;
    const qty = qtyInput.value;

    const orderBtn = document.querySelector('#productDetailsModal .btn-primary:last-of-type');
    
    try {
        orderBtn.disabled = true; 
        await addDoc(collection(db, "orders"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            productName: currentProduct.name,
            productId: currentProduct.id,
            price: Number(currentProduct.price),
            quantity: Number(qty),
            totalPrice: Number(currentProduct.price) * Number(qty),
            ...currentDesignData, 
            imageUrl: currentProduct.imageUrl,
            status: "Pending", 
            date: new Date().toISOString()
        });
        
        currentDesignData = null; 
        const personalizeBtn = document.getElementById('personalizeBtn');
        if (personalizeBtn) {
            personalizeBtn.innerHTML = '<i class="fas fa-magic"></i> Customize & Design';
            personalizeBtn.style.background = "var(--walnut)"; 
        }
        window.closeModal('productDetailsModal');
        document.getElementById('orderSuccessModal').style.display = 'flex';
        
    } catch(e) { 
        alert("Order failed. Please try again.");
    } finally {
        orderBtn.disabled = false;
    }
};

window.toggleChat = () => {
    const body = document.getElementById('chat-body');
    const icon = document.getElementById('chat-icon');
    if (body.style.display === 'none') {
        body.style.display = 'flex'; icon.className = 'fas fa-chevron-down'; listenForMessages();
    } else {
        body.style.display = 'none'; icon.className = 'fas fa-chevron-up';
    }
};

window.toggleFAQ = () => {
    const faqContainer = document.getElementById('faq-buttons-container');
    const faqIcon = document.getElementById('faq-icon');
    if (faqContainer.style.display === 'none') {
        faqContainer.style.display = 'flex'; faqIcon.className = 'fas fa-chevron-down';
    } else {
        faqContainer.style.display = 'none'; faqIcon.className = 'fas fa-chevron-up';
    }
};

let chatListener = null; 
function listenForMessages() {
    if (!currentUser) return;
    const container = document.getElementById('chat-messages');
    if(!container) return;
    if (chatListener) chatListener();

    const q = query(collection(db, "chats"), where("userId", "==", currentUser.uid), orderBy("timestamp", "asc"));
    
    chatListener = onSnapshot(q, (snapshot) => {
        container.innerHTML = `<div class="msg-wrapper admin"><div class="msg admin" style="background: var(--cream); color: var(--walnut); border: 1px solid var(--border-light);"><strong>Favored & Guided ✨</strong><br><br>Hi there! 👋 Welcome to our shop. How can we help you with your custom engraving today?</div><div class="msg-time" style="color: var(--taupe);">Automated</div></div>`;
        
        snapshot.forEach(docSnap => {
            const m = docSnap.data();
            const side = m.sender === "user" ? "user" : "admin";
            let timeStr = m.timestamp ? (m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
            
            let orderChipHTML = m.linkedOrderId ? `<div style="background: ${side === 'user' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)'}; padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px;"><img src="${m.linkedOrderImg || "assets/logo.png"}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><div style="display: flex; flex-direction: column; text-align: left; overflow: hidden;"><strong style="font-size: 0.85rem; line-height: 1.2; color: inherit; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${m.linkedOrderName || "Order Details"}</strong><span style="font-size: 0.75rem; color: ${side === 'user' ? 'rgba(255, 255, 255, 0.8)' : 'var(--taupe)'}; margin-top: 2px;">#${m.linkedOrderId.slice(-8).toUpperCase()} &bull; ${m.linkedOrderStatus || "Pending"}</span></div></div>` : "";
            let uploadedImageHTML = m.imageBase64 ? `<div style="margin-top: 5px; margin-bottom: 5px;"><img src="${m.imageBase64}" style="max-width: 100%; max-height: 200px; border-radius: 8px; cursor: pointer; border: 1px solid rgba(0,0,0,0.1);" onclick="window.open('${m.imageBase64}', '_blank')"></div>` : "";
            if (m.imageBase64 && m.text === "📷 Sent an image") m.text = ""; 

            container.innerHTML += `<div class="msg-wrapper ${side}"><div class="msg ${side}">${orderChipHTML}${uploadedImageHTML}${escapeHtml(m.text)}</div><div class="msg-time">${timeStr}</div></div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    if (!input.value.trim() || !currentUser) return;
    await addDoc(collection(db, "chats"), { userId: currentUser.uid, userEmail: currentUser.email, text: input.value, sender: "user", timestamp: new Date() });
    input.value = "";
};

window.sendBase64Image = async (event) => {
    const file = event.target.files[0];
    if (!file || !currentUser) return;
    const inputField = document.getElementById('chatInput');
    const originalPlaceholder = inputField.placeholder;
    try {
        inputField.placeholder = "Compressing & sending..."; inputField.disabled = true;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                if (width > height) { if (width > 800) { height *= 800 / width; width = 800; } } else { if (height > 800) { width *= 800 / height; height = 800; } }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                try { await addDoc(collection(db, "chats"), { userId: currentUser.uid, userEmail: currentUser.email, text: "Sent an image", imageBase64: canvas.toDataURL('image/jpeg', 0.7), sender: "user", timestamp: new Date() }); } 
                catch (err) { console.error("Firestore error:", err); }
            };
        };
        reader.readAsDataURL(file);
    } finally { inputField.placeholder = originalPlaceholder; inputField.disabled = false; event.target.value = ""; }
};

function escapeHtml(unsafe) { return (!unsafe) ? "" : unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

window.sendFAQ = async (questionText, answerText) => {
    if (!currentUser) return;
    try {
        await addDoc(collection(db, "chats"), { userId: currentUser.uid, userEmail: currentUser.email, text: questionText, sender: "user", timestamp: new Date() });
        setTimeout(async () => {
            await addDoc(collection(db, "chats"), { userId: currentUser.uid, userEmail: currentUser.email, userName: currentUser.email, text: answerText, sender: "admin", timestamp: new Date() });
            const container = document.getElementById('chat-messages'); if (container) container.scrollTop = container.scrollHeight;
        }, 600);
    } catch (error) { console.error("FAQ Error:", error); }
};

window.closeModal = (id) => document.getElementById(id).style.display = 'none';
window.openModal = (id) => { const modal = document.getElementById(id); if (modal) modal.style.display = 'flex'; };

window.togglePasswordModern = (inputId, iconElement) => {
    const input = document.getElementById(inputId);
    if (input.type === 'password') { input.type = 'text'; iconElement.classList.remove('fa-eye-slash'); iconElement.classList.add('fa-eye'); } 
    else { input.type = 'password'; iconElement.classList.remove('fa-eye'); iconElement.classList.add('fa-eye-slash'); }
};