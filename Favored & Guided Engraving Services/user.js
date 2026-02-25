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
            
            // Set profile avatar
            const avatar = document.getElementById('profileAvatar');
            if (avatar) {
                avatar.innerText = name.charAt(0).toUpperCase();
            }

            // Pre-fill Edit Forms
            if(document.getElementById('editFullname')) document.getElementById('editFullname').value = name;
            if(document.getElementById('editPhone')) document.getElementById('editPhone').value = data.phone || "";
        }
    } catch (e) { console.error("Error loading profile:", e); }
}

// Add password validation hints
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
            
            // Check confirm password match if it has value
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

// --- PROFILE MANAGEMENT ---
const editForm = document.getElementById('editDetailsForm');

if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Grab the button to show a loading spinner
        const submitBtn = editForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
            // 1. Show loading state
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            submitBtn.disabled = true;

            // 2. Grab the new values from your inputs
            const newName = document.getElementById('editFullname').value;
            const newPhone = document.getElementById('editPhone').value;

            // 3. Save directly to Firestore
            await setDoc(doc(db, "users", currentUser.uid), {
                name: newName,
                phone: newPhone
            }, { merge: true });

            // 4. Reload the profile data in the background
            if (typeof loadUserProfile === "function") {
                await loadUserProfile(currentUser.uid);
            }

            // 5. Show the SUCCESS modal immediately
            window.openModal('updateSuccessModal');
            
        } catch (error) {
            console.error("Profile update error:", error);
            if (typeof showToast === "function") {
                showToast("Error updating profile: " + error.message, 'error');
            } else {
                alert("Error updating profile: " + error.message);
            }
        } finally {
            // 6. Restore the button back to normal
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

const passForm = document.getElementById('changePasswordForm');

if (passForm) {
    passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("1. Password update form submitted!");
        
        const newPass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmNewPassword').value;
        const submitBtn = passForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // Validation
        if (newPass.length < 8) {
            alert("Password must be at least 8 characters long"); // Using alert as a safe fallback
            return;
        }

        if (newPass !== confirm) {
            alert("Passwords do not match");
            return;
        }

        try {
            console.log("2. Attempting Firebase update...");
            
            // Show loading state on button
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitBtn.disabled = true;

            // Update in Firebase
            await updatePassword(currentUser, newPass);
            console.log("3. Firebase update successful!");
            
            // Clear the form and trigger the modal
            passForm.reset();
            window.openModal('passwordSuccessModal');
            
        } catch (error) { 
            console.error("Firebase Password Error:", error);
            
            if (error.code === 'auth/requires-recent-login') {
                alert("For security, please log out and log back in to change your password.");
            } else {
                alert("Password update failed: " + error.message);
            }
        } finally {
            // Restore button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
} else {
    console.error("Error: Could not find the form 'changePasswordForm' on the page.");
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
            
            // Define status colors and icons (NEW: Added Cancelled)
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

                        ${o.status === 'Pending' ? `
                        <div class="order-cancel-container">
                            <button class="btn-outline btn-cancel-order" onclick="openCancelModal('${o.id}')">
                                <i class="fas fa-times-circle"></i> Cancel Order
                            </button>
                        </div>
                        ` : ''}

                        <button class="btn-primary" onclick="contactSupport('${o.id}')" style="flex: 1; padding: 10px;">
                                <i class="fas fa-headset"></i> Support
                            </button>
                        </div>
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

// Opens the cancellation modal and stores the order ID
window.openCancelModal = (orderId) => {
    document.getElementById('cancelOrderIdToSubmit').value = orderId;
    document.getElementById('cancelReason').value = ""; // Reset dropdown
    window.openModal('cancelOrderModal');
};

// Submits the cancellation to Firebase
window.submitCancellation = async () => {
    const orderId = document.getElementById('cancelOrderIdToSubmit').value;
    const reason = document.getElementById('cancelReason').value;
    const btn = document.getElementById('confirmCancelBtn');

    if (!reason) {
        if (typeof showToast === 'function') showToast("Please select a reason for cancellation", "error");
        else alert("Please select a reason for cancellation");
        return;
    }

    try {
        // Loading state
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';
        btn.disabled = true;

        // Update the order in Firestore
        await updateDoc(doc(db, "orders", orderId), {
            status: "Cancelled",
            cancelReason: reason,
            cancelledAt: new Date().toISOString()
        });

        if (typeof showToast === 'function') showToast("Order cancelled successfully", "success");
        window.closeModal('cancelOrderModal');
        
        // The real-time onSnapshot listener will automatically refresh the order list!

    } catch (error) {
        console.error("Error cancelling order:", error);
        if (typeof showToast === 'function') showToast("Failed to cancel: " + error.message, "error");
    } finally {
        btn.innerHTML = 'Confirm Cancel';
        btn.disabled = false;
    }
};

// --- NEW CONTACT SUPPORT FUNCTION ---
window.contactSupport = async (orderId) => {
    // 1. Open the chat widget automatically
    const chatBody = document.getElementById('chat-body');
    const chatIcon = document.getElementById('chat-icon');
    if (chatBody && chatBody.style.display === 'none') {
        chatBody.style.display = 'flex';
        chatIcon.className = 'fas fa-chevron-down';
        listenForMessages(); 
    }

    try {
        // 2. FETCH THE ORDER DETAILS FIRST
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        
        let orderData = {};
        if (orderSnap.exists()) {
            orderData = orderSnap.data();
        }

        // 3. Send the automated message containing the image and details!
        await addDoc(collection(db, "chats"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            text: "Hi, I have a question regarding this order.",
            linkedOrderId: orderId,
            linkedOrderName: orderData.productName || "Custom Order", // NEW
            linkedOrderImg: orderData.imageUrl || "assets/logo.png",   // NEW
            linkedOrderStatus: orderData.status || "Pending",          // NEW
            sender: "user",
            timestamp: new Date()
        });
        
        // Scroll to bottom
        const container = document.getElementById('chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
        
    } catch (error) {
        console.error("Error sending order to chat:", error);
        if (typeof showToast === 'function') showToast("Failed to connect to chat", "error");
    }
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
        const isLiked = userWishlist.has(id) ? 'active' : '';
        const stockCount = p.stock !== undefined ? p.stock : 0;

        // Store data globally
        window.productsData[id] = { id: id, ...p };

        container.innerHTML += `
            <div class="product-card">
                <button class="wishlist-btn ${isLiked}" onclick="toggleWishlist('${id}', this)">
                    <i class="fas fa-heart"></i>
                </button>

                <img src="${p.imageUrl}" onclick="openProductDetail('${id}')" style="cursor:pointer; width: 100%; object-fit: cover; border-radius: 8px;">
                
                <h3 style="margin-top: 15px;">${p.name}</h3>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <p class="price" style="margin: 0; font-weight: bold; font-size: 1.1rem;">₱${p.price}</p>
                    <span style="color: var(--taupe); font-size: 0.85rem;"><i class="fas fa-box"></i> Stock: ${stockCount}</span>
                </div>
                
                <button class="btn-primary" onclick="openProductDetail('${id}')" style="width: 100%;">
                    View Details
                </button>
            </div>
        `;
    });
}

// Open Modal using the ID to lookup data
window.openProductDetail = (id) => {
    currentProduct = window.productsData[id]; // Retrieve from global storage
    
    if(!currentProduct) return;

    const stockCount = currentProduct.stock !== undefined ? currentProduct.stock : 0;

    document.getElementById('detailName').innerText = currentProduct.name;
    document.getElementById('detailDesc').innerText = currentProduct.description || "No description available.";
    document.getElementById('detailPrice').innerText = "₱" + currentProduct.price;
    document.getElementById('detailImg').src = currentProduct.imageUrl;
    
    // --- NEW: Display the stock in gray ---
    const stockDisplay = document.getElementById('detailStock');
    if (stockDisplay) {
        stockDisplay.innerHTML = `<i class="fas fa-box"></i> Stock: ${stockCount}`;
        stockDisplay.style.color = "var(--taupe)"; // Standard gray color
    }

    // --- NEW: Lock button and quantity if stock is 0 ---
    const qtyInput = document.getElementById('orderQty');
    const orderBtn = document.querySelector('#productDetailsModal .btn-primary');

    if (stockCount <= 0) {
        // Out of stock behavior
        qtyInput.value = 0;
        qtyInput.disabled = true;
        
        if (orderBtn) {
            orderBtn.innerText = "Out of Stock";
            orderBtn.disabled = true;
            orderBtn.style.background = "var(--sand)";
            orderBtn.style.borderColor = "var(--sand)";
            orderBtn.style.cursor = "not-allowed";
        }
    } else {
        // In stock behavior
        qtyInput.value = 1;
        qtyInput.max = stockCount; // Optional: prevents typing a number higher than stock
        qtyInput.disabled = false;
        
        if (orderBtn) {
            orderBtn.innerText = "Place Order";
            orderBtn.disabled = false;
            orderBtn.style.background = ""; // Resets to your default base.css style
            orderBtn.style.borderColor = "";
            orderBtn.style.cursor = "pointer";
        }
    }
    
    // Reset personalization text
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
            imageUrl: currentProduct.imageUrl, 
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

// Add this helper function
window.goToOrders = () => {
    window.closeModal('orderSuccessModal');
    window.showSection('order');
};

// Update your existing placeOrder function
window.placeOrder = async () => {
    if(!currentProduct) return;

    // Show loading state on the button
    const orderBtn = document.querySelector('#productDetailsModal .btn-primary');
    const originalText = orderBtn.innerText;
    orderBtn.disabled = true;
    orderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';

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
            imageUrl: currentProduct.imageUrl,
            status: "Pending", 
            date: new Date().toISOString()
        });
        
        // 1. Close the product detail modal
        window.closeModal('productDetailsModal');
        
        // 2. Show the SUCCESS confirmation modal
        document.getElementById('orderSuccessModal').style.display = 'flex';
        
    } catch(e) { 
        showToast("Order failed: " + e.message, 'error'); 
    } finally {
        // Reset button state
        orderBtn.disabled = false;
        orderBtn.innerText = originalText;
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
    if (!currentUser) {
        console.warn("Chat: No user logged in. Waiting...");
        return;
    }

    const container = document.getElementById('chat-messages');
    if(!container) return;

    if (chatListener) chatListener();

    const q = query(
        collection(db, "chats"), 
        where("userId", "==", currentUser.uid), 
        orderBy("timestamp", "asc")
    );
    
    chatListener = onSnapshot(q, (snapshot) => {
        container.innerHTML = ""; 
        
        // --- NEW: AUTOMATED GREETING MESSAGE ---
        // This will always show at the top of the chat!
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = `msg-wrapper admin`; 
        
        // Note: I added color: var(--walnut) to make sure the text is readable on the cream background!
        welcomeMsg.innerHTML = `
            <div class="msg admin" style="background: var(--cream); color: var(--walnut); border: 1px solid var(--border-light);">
                <strong>Favored & Guided ✨</strong><br><br>
                Hi there! 👋 Welcome to our shop. How can we help you with your custom engraving today?
            </div>
            <div class="msg-time" style="color: var(--taupe);">Automated</div>
        `;
        container.appendChild(welcomeMsg);

        // --- LOAD REAL MESSAGES ---
        snapshot.forEach(docSnap => {
            const m = docSnap.data();
            const side = m.sender === "user" ? "user" : "admin";
            
            let timeStr = "";
            if (m.timestamp) {
                const dateObj = m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
                timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            
            const msgWrapper = document.createElement('div');
            msgWrapper.className = `msg-wrapper ${side}`;
          
            // --- Create the visually rich Order Card ---
            let orderChipHTML = "";
            if (m.linkedOrderId) {
                const shortId = m.linkedOrderId.slice(-8).toUpperCase();
                const imgUrl = m.linkedOrderImg || "assets/logo.png";
                const pName = m.linkedOrderName || "Order Details";
                const pStatus = m.linkedOrderStatus || "Pending";
                
                // Smart colors so it looks good on both the Blue user bubble and the Cream admin bubble
                const chipBg = side === 'user' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)';
                const dimText = side === 'user' ? 'rgba(255, 255, 255, 0.8)' : 'var(--taupe)';

                orderChipHTML = `
                    <div style="background: ${chipBg}; padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px;">
                        <img src="${imgUrl}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden;">
                            <strong style="font-size: 0.85rem; line-height: 1.2; color: inherit; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${pName}</strong>
                            <span style="font-size: 0.75rem; color: ${dimText}; margin-top: 2px;">#${shortId} &bull; ${pStatus}</span>
                        </div>
                    </div>
                `;
            } 

            msgWrapper.innerHTML = `
                <div class="msg ${side}">
                    ${orderChipHTML}
                    ${escapeHtml(m.text)}
                </div>
                <div class="msg-time">${timeStr}</div>
            `;       
            
            container.appendChild(msgWrapper);
        });

        container.scrollTop = container.scrollHeight;

    }, (error) => {
        console.error("Chat Listener Failed:", error);
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

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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
window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error("Could not find modal with ID:", id);
    }
};

// Password visibility toggle for modern design
window.togglePasswordModern = (inputId, iconElement) => {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.classList.remove('fa-eye');
        iconElement.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        iconElement.classList.remove('fa-eye-slash');
        iconElement.classList.add('fa-eye');
    }
};