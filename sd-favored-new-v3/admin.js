import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let selectedUserId = null;
let editingProductId = null;



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
// 5. CHAT SYSTEM (Improved)
// ==========================================
function loadChatUsers() {
    const list = document.getElementById('adminChatUserList');
    if(!list) return;

    // Listen to all chats
    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const users = {};
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            // MATCHING YOUR DOC: We look for userName first, then userEmail
            const identifier = data.userName || data.userEmail || "Anonymous Customer";
            
            // Only store/update if we haven't found a better name for this UID yet
            if (!users[data.userId] || users[data.userId] === "Anonymous Customer") {
                users[data.userId] = identifier;
            }
        });
        
        list.innerHTML = ""; 
        const activeUids = Object.keys(users);

        if (activeUids.length === 0) {
            list.innerHTML = '<div class="empty-state" style="padding: 30px;"><p>No conversations yet</p></div>';
            return;
        }
        
        activeUids.forEach(uid => {
            const userDiv = document.createElement('div');
            userDiv.className = `user-tab ${selectedUserId === uid ? 'active' : ''}`;
            
            const displayName = users[uid];
            const firstLetter = displayName.charAt(0).toUpperCase();
            
            userDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                    <div style="width: 35px; height: 35px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                        ${firstLetter}
                    </div>
                    <div style="flex: 1;">
                        <div class="user-name-text" style="font-weight: 600; color: var(--walnut); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">
                            ${displayName}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--taupe);">Click to chat</div>
                    </div>
                </div>
            `;
            
            userDiv.onclick = () => {
                document.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
                userDiv.classList.add('active');
                selectUserChat(uid); 
            };
            
            list.appendChild(userDiv);
        });
    });
}


// Global variable to hold the unsubscribe function for the message listener
let unsubscribeMessages = null;

window.selectUserChat = (uid) => {
    selectedUserId = uid;
    const container = document.getElementById('adminChatMessages');
    if (!container) return;


    // 2. Clear previous listener to prevent message duplication
    if (unsubscribeMessages) unsubscribeMessages();

    // 3. Define the Query (Requires composite index: userId ASC, timestamp ASC)
    const q = query(
        collection(db, "chats"), 
        where("userId", "==", uid), 
        orderBy("timestamp", "asc")
    );

    // 4. Start the Real-time Listener
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        container.innerHTML = ""; // Clear current messages for fresh render
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state" style="border: none; background: transparent; padding-top: 50px; text-align: center;">
                    <i class="fas fa-comments" style="font-size: 50px; color: var(--sand);"></i>
                    <p style="color: var(--taupe); margin-top: 15px;">No conversation history found.</p>
                </div>`;
            return;
        }
        
        snapshot.forEach(docSnap => {
            const m = docSnap.data();
            
            // Create a wrapper for the entire message block (Name + Bubble + Time)
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.marginBottom = '20px';
            wrapper.style.width = '100%';
            wrapper.style.alignItems = m.sender === 'admin' ? 'flex-end' : 'flex-start';

            // Create Name Label (Shown above the bubble)
            const nameLabel = document.createElement('span');
            nameLabel.style.fontSize = '0.7rem';
            nameLabel.style.fontWeight = '700';
            nameLabel.style.marginBottom = '4px';
            nameLabel.style.color = 'var(--walnut)';
            nameLabel.textContent = m.sender === 'admin' ? 'You (Admin)' : (m.userEmail || 'Customer');

            // Create the Message Bubble
            const msgDiv = document.createElement('div');
            msgDiv.className = `msg ${m.sender === 'admin' ? 'admin' : 'user'}`;
            msgDiv.textContent = m.text;
            
            // Create the Timestamp
            const timeDiv = document.createElement('div');
            timeDiv.style.fontSize = '0.65rem';
            timeDiv.style.color = 'var(--taupe)';
            timeDiv.style.marginTop = '4px';
            
            const dateObj = m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
            timeDiv.textContent = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Assemble the block
            wrapper.appendChild(nameLabel);
            wrapper.appendChild(msgDiv);
            wrapper.appendChild(timeDiv);
            container.appendChild(wrapper);
        });
        
        // 5. Auto-scroll to the latest message
        setTimeout(() => {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
            // Focus on the input box so you can start typing immediately
            document.getElementById('adminChatInput')?.focus();
        }, 100);

    }, (error) => {
        console.error("Chat Listener Error:", error);
    });
};

window.sendAdminMessage = async () => {
    const input = document.getElementById('adminChatInput');
    if (!input) return console.error("Could not find input field 'adminChatInput'");

    const messageText = input.value.trim();
    if (!messageText) return;

    if (!selectedUserId) {
        showToast("Please select a customer from the left sidebar first.", 'error');
        return;
    }

    // NEW: Get the customer's name/email from the active sidebar tab
    // This ensures the "Guest User" issue is fixed by keeping the data consistent
    const activeTab = document.querySelector('.user-tab.active');
    const customerName = activeTab ? activeTab.querySelector('.user-name-text').textContent : "Customer";

    try {
        await addDoc(collection(db, "chats"), {
            userId: selectedUserId,
            userEmail: customerName, // Echo the email back
            userName: customerName,  // Echo the name back
            text: messageText,
            sender: "admin", 
            timestamp: new Date()
        });

        input.value = "";
        console.log("Message sent to:", customerName);

        // Auto-focus back to input for quick typing
        input.focus();

    } catch (e) {
        console.error("Send Error:", e);
        showToast("Failed to send: " + e.message, 'error');
    }
};