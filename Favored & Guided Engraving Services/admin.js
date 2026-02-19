import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let selectedUserId = null;
let editingProductId = null;
let userMap = new Map();
let userSearchTerm = '';

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            userSearchTerm = e.target.value.toLowerCase();
            renderUserList();
        });
    }
});

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const chatInput = document.getElementById('adminChatInput');
        if (document.activeElement === chatInput) {
            window.sendAdminMessage();
        }
    }
});

// --- AUTH MONITOR ---
onAuthStateChanged(auth, (user) => {
    if (user && user.email === "admin@favored.com") {
        loadInventory();
        loadOrders();
    } else {
        window.location.href = "/"; 
    }
});

// Calculate dashboard stats
function updateDashboardStats() {
    // Get all orders
    const ordersRef = collection(db, "orders");
    onSnapshot(ordersRef, (snapshot) => {
        const orders = [];
        let totalRevenue = 0;
        let pendingCount = 0;
        
        snapshot.forEach(doc => {
            const order = doc.data();
            orders.push(order);
            if (order.status === "Pending") pendingCount++;
            if (order.status === "Completed") {
                totalRevenue += order.totalPrice || 0;
            }
        });
        
        // Update stats
        document.getElementById('totalOrders').textContent = orders.length;
        document.getElementById('pendingOrders').textContent = pendingCount;
        document.getElementById('totalRevenue').textContent = `₱${totalRevenue.toLocaleString()}`;
        
        // Calculate growth (mock data for now)
        document.getElementById('orderGrowth').textContent = '+8%';
    });
    
    // Get products for low stock count
    const productsRef = collection(db, "products");
    onSnapshot(productsRef, (snapshot) => {
        let lowStock = 0;
        snapshot.forEach(doc => {
            const product = doc.data();
            if (product.stock < 5) lowStock++;
        });
        
        document.getElementById('totalProducts').textContent = snapshot.size;
        document.getElementById('lowStock').textContent = `${lowStock} low stock`;
    });
}

// Call it after auth check
onAuthStateChanged(auth, (user) => {
    if (user && user.email === "admin@favored.com") {
        loadInventory();
        loadOrders();
        updateDashboardStats(); // Add this line
    } else {
        window.location.href = "/"; 
    }
});

// --- NAVIGATION & MODALS ---
window.showAdminSection = (id) => {
    // 1. Hide all main sections
    const sections = ['products', 'orders', 'admin-chat'];
    sections.forEach(sec => {
        const el = document.getElementById(sec);
        if (el) el.style.display = (sec === id) ? 'block' : 'none';
    });
    
    // 2. Handle the stats container visibility
    const statsContainer = document.getElementById('stats-container');
    if (statsContainer) {
        // Only show stats when on the products management page
        statsContainer.style.display = (id === 'products') ? 'grid' : 'none';
    }
    
    // 3. Load specific data for the chat section
    if (id === 'admin-chat') {
        loadChatUsers();
    }
    
    // 4. Update the Active state of the navigation links
    document.querySelectorAll('.nav-center a').forEach(a => {
        a.classList.remove('active');
        a.style.color = "rgba(255,255,255,0.8)"; // Reset to dim white
    });
    
    const activeNav = document.getElementById(`nav-${id}`);
    if (activeNav) {
        activeNav.classList.add('active');
        activeNav.style.color = "white"; // Highlight active link
    }
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = (id) => document.getElementById(id).style.display = 'none';

window.logoutAdmin = () => signOut(auth).then(() => window.location.href = "/");

// --- INVENTORY MANAGEMENT ---
async function loadInventory() {
    const container = document.getElementById('adminProducts');
    const template = document.getElementById('product-template');
    if(!container || !template) return;
    
    onSnapshot(collection(db, "products"), (snapshot) => {
        container.innerHTML = "";
        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            const id = docSnap.id;
            const clone = template.content.cloneNode(true);

            clone.querySelector('.p-img').src = p.imageUrl;
            clone.querySelector('.p-name').textContent = p.name;
            clone.querySelector('.p-price').textContent = `₱${p.price}`;
            
            const stockEl = clone.querySelector('.p-stock');
            stockEl.textContent = p.stock > 0 ? `${p.stock} in stock` : "Out of Stock";
            stockEl.style.color = p.stock > 0 ? 'green' : 'red';

            clone.querySelector('.btn-plus').onclick = () => updateStock(id, p.stock + 1);
            clone.querySelector('.btn-minus').onclick = () => updateStock(id, p.stock - 1);
            clone.querySelector('.btn-edit').onclick = () => openEditProductModal(id, p.name, p.price, p.stock);
            clone.querySelector('.btn-delete').onclick = () => deleteProduct(id);

            container.appendChild(clone);
        });
    });
}

window.updateStock = async (id, newStock) => {
    if (newStock < 0) return;
    await updateDoc(doc(db, "products", id), { stock: newStock });
};

window.openEditProductModal = (id, name, price, stock) => {
    editingProductId = id;
    document.getElementById('editName').value = name;
    document.getElementById('editPrice').value = price;
    document.getElementById('editStock').value = stock;
    window.openModal('editProductModal');
};

window.updateEditFileName = (input) => {
    const display = document.getElementById('editFileNameDisplay');
    if (input.files && input.files[0]) {
        const fileName = input.files[0].name;
        display.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 30px; color: #4caf50; margin-bottom: 10px; display: block;"></i>
            <span style="color: var(--walnut); font-weight: 600;">${fileName}</span>
        `;
    }
};

window.saveProductEdit = async () => {
    const name = document.getElementById('editName').value;
    const price = Number(document.getElementById('editPrice').value);
    const stock = Number(document.getElementById('editStock').value);
    const fileInput = document.getElementById('editImageFile');
    const file = fileInput ? fileInput.files[0] : null;

    const saveBtn = document.querySelector('#editProductModal .btn-primary');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    saveBtn.disabled = true;

    try {
        const updateData = {
            name: name,
            price: price,
            stock: stock
        };

        // If a new image was selected, process it
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = async (e) => {
                updateData.imageUrl = e.target.result; // Update the image URL
                await updateDoc(doc(db, "products", editingProductId), updateData);
                finishEdit(saveBtn, originalText);
            };
        } else {
            // If no new image, just update the text fields
            await updateDoc(doc(db, "products", editingProductId), updateData);
            finishEdit(saveBtn, originalText);
        }
    } catch (error) {
        console.error("Update Error:", error);
        showToast("Failed to update product", 'error');
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
};

// Helper to clean up after editing
function finishEdit(btn, text) {
    btn.innerHTML = text;
    btn.disabled = false;
    // Reset file input and display
    const fileInput = document.getElementById('editImageFile');
    if(fileInput) fileInput.value = '';
    const display = document.getElementById('editFileNameDisplay');
    if(display) display.textContent = "Click to change image";
    
    showToast("Product updated successfully!", 'success');
    window.closeModal('editProductModal');
}

// =========================================
// TOAST NOTIFICATION (copy from app.js)
// =========================================
window.showToast = (message, type = 'success') => {
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// =========================================
// ADD PRODUCT (FIXED)
// =========================================
window.addProduct = async () => {
    const name = document.getElementById('addName').value.trim();
    const price = document.getElementById('addPrice').value.trim();
    const stock = document.getElementById('addStock').value.trim();
    const file = document.getElementById('addImageFile').files[0];

    // Validate inputs
    if (!name || !price || !stock || !file) {
        showToast("Please fill all fields (name, price, stock, image)", 'error');
        return;
    }

    const priceNum = Number(price);
    const stockNum = Number(stock);
    if (isNaN(priceNum) || priceNum <= 0) {
        showToast("Please enter a valid price", 'error');
        return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
        showToast("Please enter a valid stock quantity", 'error');
        return;
    }

    // Show loading state on button (optional)
    const saveBtn = document.querySelector('#addProductModal .btn-primary');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = async (e) => {
            try {
                await addDoc(collection(db, "products"), {
                    name: name,
                    price: priceNum,
                    stock: stockNum,
                    imageUrl: e.target.result,
                    date: new Date().toISOString()
                });

                // Reset form
                document.getElementById('addName').value = '';
                document.getElementById('addPrice').value = '';
                document.getElementById('addStock').value = '10'; // default
                document.getElementById('addImageFile').value = ''; // clear file input
                // Reset the custom file upload preview if any
                const uploadArea = document.querySelector('#addProductModal .modal-box > div:nth-child(5) > div');
                if (uploadArea) {
                    uploadArea.innerHTML = `
                        <i class="fas fa-cloud-upload-alt" style="font-size: 40px; color: var(--primary); margin-bottom: 10px; display: block;"></i>
                        <p style="color: var(--taupe);">Click to upload or drag and drop</p>
                        <p style="font-size: 0.8rem; color: var(--sand);">PNG, JPG up to 5MB</p>
                    `;
                }

                showToast("Product added successfully!", 'success');
                window.closeModal('addProductModal');
            } catch (firestoreError) {
                console.error("Firestore error:", firestoreError);
                showToast("Failed to save product: " + firestoreError.message, 'error');
            } finally {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        };

        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            showToast("Failed to read image file", 'error');
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        };

    } catch (error) {
        console.error("Unexpected error:", error);
        showToast("An unexpected error occurred", 'error');
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
};

window.deleteProduct = async (id) => { if(confirm("Remove item?")) await deleteDoc(doc(db, "products", id)); };

// Add this for file upload feedback
window.updateFileName = (input) => {
    if (input.files.length > 0) {
        const fileName = input.files[0].name;
        const uploadArea = input.previousElementSibling;
        uploadArea.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 40px; color: #4caf50; margin-bottom: 10px; display: block;"></i>
            <p style="color: var(--walnut);">${fileName}</p>
            <p style="font-size: 0.8rem; color: var(--taupe);">Click to change</p>
        `;
    }
};

// --- ORDER MANAGEMENT ---
window.loadOrders = () => {
    const container = document.getElementById('admin-orders-container');
    const template = document.getElementById('order-template');
    if(!container || !template) return;

    onSnapshot(query(collection(db, "orders"), orderBy("date", "desc")), (snapshot) => {
        container.innerHTML = "";
        snapshot.forEach(docSnap => {
            const o = docSnap.data();
            const id = docSnap.id;
            const clone = template.content.cloneNode(true);

            clone.querySelector('.order-id').textContent = `#${id.slice(0,6)}`;
            clone.querySelector('.order-date').textContent = new Date(o.date).toLocaleDateString();
            clone.querySelector('.order-img').src = o.imageUrl;
            clone.querySelector('.order-product-name').textContent = o.productName;
            clone.querySelector('.order-email').textContent = o.userEmail;
            clone.querySelector('.order-total').textContent = `₱${o.totalPrice}`;
            clone.querySelector('.order-note').textContent = `Note: ${o.personalization || "None"}`;

            const select = clone.querySelector('.status-select');
            ["Pending", "Preparing", "Ready", "Completed", "Rejected"].forEach(stat => {
                const opt = document.createElement('option');
                opt.value = stat; opt.textContent = stat;
                if(o.status === stat) opt.selected = true;
                select.appendChild(opt);
            });
            select.onchange = (e) => updateOrderStatus(id, e.target.value);
            container.appendChild(clone);
        });
    });
};

window.updateOrderStatus = async (id, status) => await updateDoc(doc(db, "orders", id), { status });

// Order filter function
window.filterOrders = (status) => {
    // Update active button state
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'white';
        btn.style.color = 'var(--text-body)';
    });
    
    const activeBtn = event.target;
    activeBtn.classList.add('active');
    activeBtn.style.background = 'var(--primary)';
    activeBtn.style.color = 'white';
    
    // Filter orders
    const orderCards = document.querySelectorAll('.order-card-admin');
    orderCards.forEach(card => {
        if (status === 'all') {
            card.style.display = 'block';
        } else {
            const orderStatus = card.querySelector('.status-select')?.value?.toLowerCase();
            if (orderStatus === status) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
};

// ==========================================
// 5. CHAT SYSTEM 
// ==========================================

let unsubscribeMessages = null;
let chatFilter = 'all'; // 'all', 'unread', 'online'

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            userSearchTerm = e.target.value.toLowerCase();
            renderUserList();
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('adminChatInput').value = '';
        }
    });
});

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const chatInput = document.getElementById('adminChatInput');
        if (document.activeElement === chatInput && !e.shiftKey) {
            e.preventDefault();
            sendAdminMessage();
        }
    }
});

// Filter functions
window.filterChatUsers = (filter) => {
    chatFilter = filter;
    
    // Update active state of filter buttons
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.style.background = 'var(--cream)';
        btn.style.color = 'var(--walnut)';
    });
    
    event.target.style.background = 'var(--primary)';
    event.target.style.color = 'white';
    
    renderUserList();
};

function loadChatUsers() {
    const list = document.getElementById('adminChatUserList');
    if (!list) return;

    // Listen to all chats, order by timestamp descending
    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        userMap.clear();
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const uid = data.userId;
            const displayName = data.userName || data.userEmail || "Anonymous Customer";
            const msgText = data.text;
            const msgTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
            const isFromUser = data.sender !== 'admin';
            const readByAdmin = data.readByAdmin || false;

            if (!userMap.has(uid)) {
                userMap.set(uid, {
                    displayName,
                    lastMsg: msgText,
                    lastTime: msgTime,
                    unread: (isFromUser && !readByAdmin) ? 1 : 0,
                    lastSeen: new Date(),
                    email: data.userEmail || displayName
                });
            } else {
                const existing = userMap.get(uid);
                if (isFromUser && !readByAdmin) {
                    existing.unread += 1;
                }
                if (msgTime > existing.lastTime) {
                    existing.lastMsg = msgText;
                    existing.lastTime = msgTime;
                }
            }
        });
        
        renderUserList();
        updateUnreadBadgeTotal();
    });
}

function renderUserList() {
    const list = document.getElementById('adminChatUserList');
    if (!list) return;
    
    list.innerHTML = "";
    
    if (userMap.size === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>No conversations yet</p><small>Customers will appear here when they message</small></div>';
        return;
    }

    // Convert map to array and sort by lastTime (most recent first)
    const sortedUsers = Array.from(userMap.entries())
        .filter(([uid, info]) => {
            // Apply search filter
            if (userSearchTerm && !info.displayName.toLowerCase().includes(userSearchTerm)) {
                return false;
            }
            
            // Apply chat filter
            if (chatFilter === 'unread' && info.unread === 0) {
                return false;
            }
            
            return true;
        })
        .sort((a, b) => b[1].lastTime - a[1].lastTime);

    sortedUsers.forEach(([uid, info]) => {
        const userDiv = createUserTabElement(uid, info);
        list.appendChild(userDiv);
    });
    
    // If there's a selected user but it's not in the filtered list, clear selection
    if (selectedUserId && !document.querySelector(`.user-tab[data-userid="${selectedUserId}"]`)) {
        clearSelectedChat();
    }
}

function createUserTabElement(uid, info) {
    const userDiv = document.createElement('div');
    userDiv.className = `user-tab ${selectedUserId === uid ? 'active' : ''}`;
    userDiv.setAttribute('data-userid', uid);
    
    const firstLetter = info.displayName.charAt(0).toUpperCase();
    const timeStr = info.lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const unreadBadge = info.unread > 0 ? `<span class="unread-badge">${info.unread}</span>` : '';

    userDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
            <div style="position:relative;">
                <div class="user-avatar">
                    ${firstLetter}
                    ${unreadBadge}
                </div>
            </div>
            <div class="user-info">
                <div class="user-name">
                    <span>${info.displayName}</span>
                    <span class="user-time">${timeStr}</span>
                </div>
                <div class="user-last-msg">
                    ${info.lastMsg}
                </div>
            </div>
        </div>
    `;
    
    userDiv.onclick = () => {
        selectUserChat(uid, info);
    };
    
    return userDiv;
}

function selectUserChat(uid, info) {
    selectedUserId = uid;
    
    // Update active state
    document.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.user-tab[data-userid="${uid}"]`);
    if (activeTab) activeTab.classList.add('active');
    
    // Update header
    document.getElementById('selectedCustomerName').textContent = info.displayName;
    document.getElementById('selectedUserAvatar').textContent = info.displayName.charAt(0).toUpperCase();
    
    // Mark messages as read
    markMessagesAsRead(uid);
    
    // Load messages
    loadUserMessages(uid);
    
    // Load customer info
    loadCustomerInfo(uid);
}

function clearSelectedChat() {
    selectedUserId = null;
    document.getElementById('selectedCustomerName').textContent = 'Select a conversation';
    document.getElementById('selectedUserAvatar').textContent = 'A';
    document.getElementById('adminChatMessages').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-comments"></i>
            <p>Select a conversation to start replying</p>
            <small>Choose a customer from the left sidebar</small>
        </div>
    `;
    
    if (unsubscribeMessages) unsubscribeMessages();
}

function loadUserMessages(uid) {
    const container = document.getElementById('adminChatMessages');
    if (!container) return;

    if (unsubscribeMessages) unsubscribeMessages();

    const q = query(
        collection(db, "chats"), 
        where("userId", "==", uid), 
        orderBy("timestamp", "asc")
    );

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        container.innerHTML = "";
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment-dots"></i>
                    <p>No messages yet</p>
                    <small>Send a message to start the conversation</small>
                </div>`;
            return;
        }
        
        snapshot.forEach(docSnap => {
            const m = docSnap.data();
            const messageEl = createMessageElement(m);
            container.appendChild(messageEl);
        });
        
        // Auto-scroll to bottom
        setTimeout(() => {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
        
        // Mark messages as read
        markMessagesAsRead(uid);
        
        // Focus input
        document.getElementById('adminChatInput')?.focus();
    });
}

function createMessageElement(message) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${message.sender === 'admin' ? 'admin' : 'customer'}`;
    
    const senderLabel = message.sender === 'admin' ? 'You (Admin)' : (message.userEmail || 'Customer');
    const dateObj = message.timestamp?.toDate ? message.timestamp.toDate() : new Date(message.timestamp);
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    wrapper.innerHTML = `
        <div class="message-sender">${senderLabel}</div>
        <div class="message-bubble">${escapeHtml(message.text)}</div>
        <div class="message-time">${timeStr}</div>
    `;
    
    return wrapper;
}

// Helper to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function markMessagesAsRead(uid) {
    const q = query(
        collection(db, "chats"),
        where("userId", "==", uid),
        where("sender", "==", "user"),
        where("readByAdmin", "==", false)
    );
    
    const snapshot = await getDocs(q);
    snapshot.forEach(async (docSnap) => {
        await updateDoc(doc(db, "chats", docSnap.id), {
            readByAdmin: true
        });
    });
}

window.sendAdminMessage = async () => {
    const input = document.getElementById('adminChatInput');
    if (!input) return;

    const messageText = input.value.trim();
    if (!messageText) return;

    if (!selectedUserId) {
        showToast("Please select a customer from the left sidebar first.", 'error');
        return;
    }

    const activeTab = document.querySelector('.user-tab.active');
    const customerName = activeTab ? activeTab.querySelector('.user-name span').textContent : "Customer";

    try {
        await addDoc(collection(db, "chats"), {
            userId: selectedUserId,
            userEmail: customerName,
            userName: customerName,
            text: messageText,
            sender: "admin",
            timestamp: new Date(),
            readByUser: false
        });

        input.value = "";
        input.focus();

    } catch (e) {
        console.error("Send Error:", e);
        showToast("Failed to send: " + e.message, 'error');
    }
};

async function loadCustomerInfo(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            document.getElementById('infoName').textContent = data.name || 'N/A';
            document.getElementById('infoEmail').textContent = data.email || 'N/A';
            document.getElementById('infoPhone').textContent = data.phone || 'Not set';
            
            // Count orders for this user
            const ordersSnap = await getDocs(query(collection(db, "orders"), where("userId", "==", uid)));
            document.getElementById('infoOrders').textContent = ordersSnap.size;
            
            // Load recent orders preview
            loadRecentOrdersPreview(uid);
        } else {
            document.getElementById('infoName').textContent = 'No profile';
        }
    } catch (e) {
        console.error("Error loading customer info:", e);
    }
}

async function loadRecentOrdersPreview(uid) {
    const container = document.getElementById('recentOrdersList');
    if (!container) return;
    
    const q = query(
        collection(db, "orders"),
        where("userId", "==", uid),
        orderBy("date", "desc"),
        limit(3)
    );
    
    const snapshot = await getDocs(q);
    container.innerHTML = "";
    
    if (snapshot.empty) {
        container.innerHTML = '<p style="color: var(--taupe); font-size: 0.9rem;">No orders yet</p>';
        return;
    }
    
    snapshot.forEach(docSnap => {
        const order = docSnap.data();
        container.innerHTML += `
            <div class="order-preview-item">
                <img src="${order.imageUrl}" class="order-preview-img" alt="">
                <div class="order-preview-details">
                    <div class="order-preview-name">${order.productName}</div>
                    <div class="order-preview-status">${order.status || 'Pending'}</div>
                </div>
            </div>
        `;
    });
}

window.toggleCustomerInfo = () => {
    const panel = document.getElementById('customerInfoPanel');
    panel.classList.toggle('show');
};

window.refreshChat = () => {
    if (selectedUserId) {
        loadUserMessages(selectedUserId);
        showToast('Chat refreshed', 'success');
    }
};

window.loadFullCustomerHistory = () => {
    if (!selectedUserId) return;
    // Switch to orders tab and filter for this customer
    showAdminSection('orders');
    // You could add a filter here to show only this customer's orders
};

function updateUnreadBadgeTotal() {
    let totalUnread = 0;
    userMap.forEach(info => {
        totalUnread += info.unread;
    });
    
    // Update browser tab title if there are unread messages
    if (totalUnread > 0) {
        document.title = `(${totalUnread}) Admin Dashboard`;
    } else {
        document.title = 'Admin Dashboard';
    }
}