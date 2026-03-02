import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, onSnapshot, where, getDoc, limit } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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
    
    // Show skeleton loading for admin product list
    container.innerHTML = Array(4).fill(0).map(() => `
        <div class="product-card">
            <div class="skeleton-loader skeleton-product"></div>
            <div class="skeleton-loader skeleton-text"></div>
            <div class="skeleton-loader skeleton-text short"></div>
        </div>
    `).join('');
    
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
    
    // Show skeleton loading for admin orders
    container.innerHTML = Array(3).fill(0).map(() => `
        <div class="order-card-admin">
            <div class="skeleton-loader" style="height: 20px; width: 30%; margin-bottom: 15px;"></div>
            <div style="display: flex; gap: 15px;">
                <div class="skeleton-loader" style="width: 80px; height: 80px; border-radius: 15px;"></div>
                <div style="flex: 1;">
                    <div class="skeleton-loader skeleton-text"></div>
                    <div class="skeleton-loader skeleton-text" style="width: 60%;"></div>
                    <div class="skeleton-loader skeleton-text" style="width: 40%;"></div>
                </div>
            </div>
        </div>
    `).join('');

    onSnapshot(query(collection(db, "orders"), orderBy("date", "desc")), (snapshot) => {
        container.innerHTML = "";
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align: center; color: var(--taupe); width: 100%; padding: 40px;">No orders found.</p>';
            return;
        }

        const orders = [];
        snapshot.forEach(doc => orders.push({id: doc.id, ...doc.data()}));
        
        orders.sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            return timeB - timeA; 
        });

        snapshot.forEach(docSnap => {
            const o = docSnap.data();
            const id = docSnap.id;
            const clone = template.content.cloneNode(true);    

            // Populate basic data
            clone.querySelector('.order-id').textContent = `#${id.slice(-8).toUpperCase()}`;
            clone.querySelector('.order-date').textContent = new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            clone.querySelector('.order-img').src = o.imageUrl || 'assets/logo.png';
            clone.querySelector('.order-product-name').textContent = o.productName;
            clone.querySelector('.order-email').textContent = o.userEmail;
            clone.querySelector('.order-total').textContent = `₱${o.totalPrice?.toLocaleString() || '0'}`;

            const designBtn = clone.querySelector('.view-design-btn');
            
            // 1. UPDATED CONDITION: Check for new 'elements' array OR old 'posX'
            if (((o.elements && o.elements.length > 0) || o.posX !== undefined) && designBtn) {
                designBtn.style.display = 'block'; // Show the button
            
                designBtn.onclick = () => {
                    // Set the background image
                    document.getElementById('adminPreviewImg').src = o.imageUrl;
                    
                    // Find the Admin Canvas container
                    const wrapper = document.getElementById('adminCanvas');
                    if(!wrapper) {
                        console.error("Could not find adminCanvas in HTML!");
                        return;
                    }
                    
                    // Clear out any old text/designs from the previous order you viewed
                    Array.from(wrapper.children).forEach(child => {
                        if (child.tagName !== 'IMG') child.remove();
                    });

                    // --- 2A. RENDER NEW MULTI-ITEM CANVAS DESIGNS ---
// --- 2A. RENDER NEW MULTI-ITEM CANVAS DESIGNS ---
                    if (o.elements && Array.isArray(o.elements)) {
                        o.elements.forEach(item => {
                            let el;
                            
                            // BULLETPROOF CHECK: Is this an image?
                            const isImage = item.type === 'image' || (typeof item.content === 'string' && item.content.startsWith('data:image'));
                            
                            if (isImage) {
                                // RENDER AS IMAGE
                                el = document.createElement('img');
                                el.src = item.content;
                                el.style.width = item.size + "px"; 
                                el.style.height = "auto";
                                el.style.display = "block"; // CRITICAL FIX: Forces the image to actually claim space
                                el.draggable = false;
                            } else {
                                // RENDER AS TEXT / BORDER
                                el = document.createElement('div');
                                el.innerText = item.content;
                                el.style.color = '#2c1a0e';
                                el.style.textAlign = 'center';
                                el.style.whiteSpace = 'pre-wrap';
                                el.style.lineHeight = item.type === 'text' ? '1.2' : '1';
                                el.style.fontSize = item.size + "px"; 
                                
                                if(item.font && item.font.toLowerCase() !== "arial") {
                                    el.style.fontFamily = `"${item.font}", sans-serif`;
                                    let linkId = 'admin-font-' + item.font.replace(/\s+/g, '');
                                    if(!document.getElementById(linkId)) {
                                        let link = document.createElement('link'); link.id = linkId; link.rel = 'stylesheet';
                                        link.href = `https://fonts.googleapis.com/css2?family=${item.font.replace(/\s+/g, '+')}&display=swap`;
                                        document.head.appendChild(link);
                                    }
                                } else {
                                    el.style.fontFamily = "Arial, sans-serif";
                                }
                            }
                            
                            // SHARED STYLING (Applies to both Text and Images)
                            el.style.position = 'absolute';
                            el.style.top = '50%';
                            el.style.left = '50%';
                            el.style.mixBlendMode = 'multiply';
                            el.style.pointerEvents = 'none';
                            el.style.transform = `translate(calc(-50% + ${item.x}px), calc(-50% + ${item.y}px)) rotate(${item.rotation}deg)`;
                            
                            wrapper.appendChild(el);
                        });
                    }

                    // --- 2B. FALLBACK FOR OLD SINGLE-TEXT DESIGNS ---
                    else if (o.posX !== undefined) {
                        const div = document.createElement('div');
                        div.innerText = o.personalization || o.engravingText || "No text";
                        div.style.position = 'absolute';
                        div.style.top = '50%';
                        div.style.left = '50%';
                        div.style.color = '#2c1a0e';
                        div.style.mixBlendMode = 'multiply';
                        div.style.textAlign = 'center';
                        div.style.whiteSpace = 'pre-wrap';
                        div.style.pointerEvents = 'none';

                        const rot = o.engravingRotation || 0;
                        div.style.fontSize = (o.engravingSize || 30) + "px";
                        div.style.transform = `translate(calc(-50% + ${o.posX}px), calc(-50% + ${o.posY}px)) rotate(${rot}deg)`;
                        
                        const font = o.engravingFont || "Arial";
                        div.style.fontFamily = `"${font}", sans-serif`;

                        if (font !== "Arial") {
                            let linkId = 'admin-font-' + font.replace(/\s+/g, '');
                            if(!document.getElementById(linkId)) {
                                let link = document.createElement('link'); link.id = linkId; link.rel = 'stylesheet';
                                link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/\s+/g, '+')}&display=swap`;
                                document.head.appendChild(link);
                            }
                        }
                        wrapper.appendChild(div);
                    }

                    openModal('adminPreviewModal');
                };
            }
            // --- DISPLAY CANCEL REASON (FLOATING MENU) ---
            if (o.status === 'Cancelled') {
                const popoverWrapper = clone.querySelector('.cancel-popover-wrapper');
                const cancelBtn = clone.querySelector('.view-cancel-btn');
                const reasonMenu = clone.querySelector('.cancel-reason-menu');
                const reasonText = clone.querySelector('.cancel-reason-text');
                const cardElement = clone.querySelector('.order-card-admin');
                
                if (popoverWrapper && cancelBtn) {
                    popoverWrapper.style.display = 'block'; // Shows the pill button inline
                    reasonText.textContent = o.cancelReason || 'No reason provided';
                    
                    cancelBtn.onclick = (e) => {
                        e.stopPropagation(); 
                        document.querySelectorAll('.cancel-reason-menu').forEach(menu => {
                            if(menu !== reasonMenu) menu.style.display = 'none';
                        });
                        reasonMenu.style.display = reasonMenu.style.display === 'none' ? 'block' : 'none';
                    };
                }

                if(cardElement) cardElement.style.borderColor = '#e74c3c';
            }

            // --- STRICT DROPDOWN LOGIC ---
            const select = clone.querySelector('.status-select');
            
            if (o.status === 'Cancelled') {
                // 1. If already cancelled, LOCK the dropdown.
                const opt = document.createElement('option');
                opt.value = 'Cancelled'; 
                opt.textContent = 'Cancelled';
                opt.selected = true;
                select.appendChild(opt);
                
                // Disable the select box so the admin cannot change it!
                select.disabled = true; 
                select.style.backgroundColor = '#ffebee';
                select.style.color = '#c62828';
                select.style.borderColor = '#e74c3c';
                select.style.cursor = 'not-allowed';
                select.style.opacity = '0.8';
                
            } else {
                // 2. If it's a normal order, show standard options (Removed 'Cancelled' from this list)
                ["Pending", "Preparing", "Ready", "Completed", "Rejected"].forEach(stat => {
                    const opt = document.createElement('option');
                    opt.value = stat; 
                    opt.textContent = stat;
                    if(o.status === stat) opt.selected = true;
                    select.appendChild(opt);
                });
                
                // Only allow changes if it's not locked
                select.onchange = (e) => updateOrderStatus(id, e.target.value);
            }

            // Add an attribute so your filter buttons still work perfectly
            const card = clone.querySelector('.order-card-admin');
            if(card) card.setAttribute('data-status', o.status.toLowerCase());

            container.appendChild(clone);
        });
    });
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.cancel-popover-wrapper')) {
        document.querySelectorAll('.cancel-reason-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

window.updateOrderStatus = async (id, status) => await updateDoc(doc(db, "orders", id), { status });

window.filterAdminByDate = (selectedDate) => {
    // 1. If the user clears the date input, show all orders again
    if (!selectedDate) {
        document.querySelectorAll('.order-card-admin, .order-card-enhanced').forEach(card => {
            card.style.display = "block";
        });
        return;
    }

    const orderCards = document.querySelectorAll('.order-card-admin, .order-card-enhanced');
    let foundCount = 0;

    orderCards.forEach(card => {
        // Look for the date text
        const dateEl = card.querySelector('.order-date-value') || card.querySelector('.order-date');
        
        if (dateEl) {
            // Clean up text in case it has icons or "Date:" attached
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
        showToast("No orders found for this date", "error");
        
        // Auto-reset if nothing is found
        const dateInput = document.getElementById('adminDateFilter');
        if(dateInput) dateInput.value = "";
        orderCards.forEach(card => card.style.display = "block");
    }   
};


// Order filter function (Status)
window.filterOrders = (status) => {
    const dateInput = document.getElementById('adminDateFilter');
    if (dateInput) dateInput.value = "";

    const activeBtn = event.target.closest('.filter-btn') || event.target;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'white';
        
        if (btn.textContent.trim() === 'Cancelled') {
            btn.style.color = '#e74c3c';
            btn.style.borderColor = '#e74c3c';
        } else {
            btn.style.color = 'var(--text-body)';
            btn.style.borderColor = 'var(--sand)';
        }
    });
    
    activeBtn.classList.add('active');
    activeBtn.style.color = 'white';
    
    if (status === 'cancelled') {
        activeBtn.style.background = '#e74c3c'; 
        activeBtn.style.borderColor = '#e74c3c';
    } else {
        activeBtn.style.background = 'var(--primary)'; 
        activeBtn.style.borderColor = 'var(--primary)';
    }
    
    const orderCards = document.querySelectorAll('.order-card-admin, .order-card-enhanced');
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
            const chatInput = document.getElementById('adminChatInput');
            if (chatInput) chatInput.value = '';
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

// FIX #2: Safely target the button even if the icon is clicked
window.filterChatUsers = (filter) => {
    chatFilter = filter;
    
    // 1. Reset all buttons to the default cream/brown styling
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.style.background = 'var(--cream)';
        btn.style.color = 'var(--walnut)';
        
        // 2. If this button's HTML onclick matches our current filter, highlight it!
        if (btn.getAttribute('onclick').includes(filter)) {
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';
        }
    });
    
    // 3. Re-draw the list
    renderUserList();
};

function loadChatUsers() {
    const list = document.getElementById('adminChatUserList');
    if (!list) return;
    
    // Show skeleton loading for chat users list
    list.innerHTML = Array(4).fill(0).map(() => `
        <div class="user-tab" style="display: flex; align-items: center; gap: 12px; padding: 15px;">
            <div class="skeleton-loader" style="width: 48px; height: 48px; border-radius: 50%;"></div>
            <div style="flex: 1;">
                <div class="skeleton-loader skeleton-text" style="width: 60%;"></div>
                <div class="skeleton-loader skeleton-text" style="width: 40%;"></div>
            </div>
        </div>
    `).join('');

    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        userMap.clear();
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const uid = data.userId;
            const displayName = data.userName || data.userEmail || "Anonymous Customer";
            const msgText = data.text;
            
            // FIX #3: Safely handle missing timestamps to prevent sorting crashes
            let msgTime = new Date();
            if (data.timestamp) {
                msgTime = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
            }

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
    }, (error) => {
        console.error("Error loading chat users:", error);
    });
}

function checkIsOnline(lastMessageTime) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return lastMessageTime >= tenMinutesAgo;
}

function renderUserList() {
    const list = document.getElementById('adminChatUserList');
    if (!list) return;
    
    list.innerHTML = "";
    
    if (userMap.size === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>No conversations yet</p><small>Customers will appear here when they message</small></div>';
        return;
    }

    const sortedUsers = Array.from(userMap.entries())
        .filter(([uid, info]) => {
            // 1. Search Filter
            if (userSearchTerm && !info.displayName.toLowerCase().includes(userSearchTerm)) {
                return false;
            }
            // 2. Unread Filter
            if (chatFilter === 'unread' && info.unread === 0) {
                return false;
            }
            // 3. NEW: Online Filter!
            if (chatFilter === 'online') {
                if (!checkIsOnline(info.lastTime)) {
                    return false; // Hide them if they aren't online
                }
            }
            return true;
        })
        .sort((a, b) => b[1].lastTime - a[1].lastTime);

    sortedUsers.forEach(([uid, info]) => {
        const userDiv = createUserTabElement(uid, info);
        list.appendChild(userDiv);
    });
    
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
                    <span class="user-name-text">${info.displayName}</span>
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
    
    document.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.user-tab[data-userid="${uid}"]`);
    if (activeTab) activeTab.classList.add('active');
    
    document.getElementById('selectedCustomerName').textContent = info.displayName;
    document.getElementById('selectedUserAvatar').textContent = info.displayName.charAt(0).toUpperCase();
    
    markMessagesAsRead(uid);
    loadUserMessages(uid);
    loadCustomerInfo(uid);

    const chatContainer = document.querySelector('.chat-container-admin');
    if (chatContainer && window.innerWidth <= 768) {
        chatContainer.classList.add('mobile-chat-active');
    }
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
        
        setTimeout(() => {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
        
        markMessagesAsRead(uid);
        
        const chatInput = document.getElementById('adminChatInput');
        if (chatInput) chatInput.focus();
    }, (error) => {
        console.error("Error loading messages:", error);
    });
}

function createMessageElement(message) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${message.sender === 'admin' ? 'admin' : 'customer'}`;
    
    const senderLabel = message.sender === 'admin' ? 'You (Admin)' : (message.userName || message.userEmail || 'Customer');
    
    let timeStr = "";
    if (message.timestamp) {
        const dateObj = message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp);
        timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    let uploadedImageHTML = "";
    if (message.imageBase64) {
        uploadedImageHTML = `
            <div style="margin-top: 5px; margin-bottom: 5px;">
                <img src="${message.imageBase64}" style="max-width: 100%; max-height: 200px; border-radius: 8px; cursor: pointer; border: 1px solid rgba(0,0,0,0.1);" onclick="window.open('${message.imageBase64}', '_blank')">
            </div>
        `;
        if (message.text === "📷 Sent an image") message.text = ""; // Hide fallback text
    }

    // --- NEW: RICH ORDER CARD WITH CLICK EVENT ---
    let orderChipHTML = "";
    if (message.linkedOrderId) {
        const shortId = message.linkedOrderId.slice(-8).toUpperCase();
        // Fallbacks in case the old messages didn't have these new fields yet
        const imgUrl = message.linkedOrderImg || "assets/logo.png"; 
        const pName = message.linkedOrderName || "Order #" + shortId;
        const pStatus = message.linkedOrderStatus || "View Details";
        
        // This entire block is now clickable!
        // It calls a helper function 'openAdminOrderView' which we will define below
        orderChipHTML = `
            <div onclick="openAdminOrderView('${message.linkedOrderId}')" 
                 style="cursor: pointer; background: white; border: 1px solid var(--sand); padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; transition: transform 0.2s;">
                
                <img src="${imgUrl}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px;">
                
                <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden;">
                    <strong style="font-size: 0.85rem; color: var(--walnut); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                        ${pName}
                    </strong>
                    <span style="font-size: 0.75rem; color: var(--primary); font-weight: 600;">
                        <i class="fas fa-external-link-alt" style="font-size: 0.7rem; margin-right: 3px;"></i> View Order #${shortId}
                    </span>
                </div>
            </div>
        `;
    }
    
    wrapper.innerHTML = `
        <div class="message-sender">${senderLabel}</div>
        <div class="message-bubble">
            ${orderChipHTML}
            ${uploadedImageHTML}
            ${escapeHtml(message.text || "")}
        </div>
        <div class="message-time">${timeStr}</div>
    `;
    
    return wrapper;
}

// --- NEW HELPER FUNCTION TO OPEN THE ORDER ---
window.openAdminOrderView = async (orderId) => {
    // 1. Switch to the Orders tab
    showAdminSection('orders');
    
    // 2. Wait a split second for the orders to load/render
    setTimeout(() => {
        // 3. Try to find the order card in the list
        const orderCard = Array.from(document.querySelectorAll('.order-card-admin')).find(card => {
            return card.innerText.includes(orderId.slice(-8).toUpperCase());
        });

        if (orderCard) {
            // Scroll to it and highlight it flash
            orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            orderCard.style.transition = "box-shadow 0.3s, transform 0.3s";
            orderCard.style.boxShadow = "0 0 0 4px rgba(231, 76, 60, 0.4)";
            orderCard.style.transform = "scale(1.02)";
            
            // Remove highlight after 2 seconds
            setTimeout(() => {
                orderCard.style.boxShadow = "";
                orderCard.style.transform = "";
            }, 2000);
        } else {
            showToast("Order not found in current list (check filters)", "error");
        }
    }, 500);
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

async function markMessagesAsRead(uid) {
    try {
        // We only query by userId so we don't trigger Firebase Index Errors
        // and so we catch messages that completely lack the 'readByAdmin' field!
        const q = query(
            collection(db, "chats"),
            where("userId", "==", uid)
        );
        
        const snapshot = await getDocs(q);
        snapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            
            // Only update messages sent by the user that aren't already marked as read
            if (data.sender === "user" && data.readByAdmin !== true) {
                await updateDoc(doc(db, "chats", docSnap.id), {
                    readByAdmin: true
                });
            }
        });
    } catch (error) {
        console.error("Error marking as read:", error);
    }
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
            
            const ordersSnap = await getDocs(query(collection(db, "orders"), where("userId", "==", uid)));
            document.getElementById('infoOrders').textContent = ordersSnap.size;
            
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
    
    try {
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
    } catch (error) {
        console.error("Failed to load recent orders preview:", error);
    }
}

window.toggleCustomerInfo = () => {
    const panel = document.getElementById('customerInfoPanel');
    if (panel) panel.classList.toggle('show');
};

window.refreshChat = () => {
    if (selectedUserId) {
        loadUserMessages(selectedUserId);
        showToast('Chat refreshed', 'success');
    }
};

window.loadFullCustomerHistory = () => {
    if (!selectedUserId) return;
    showAdminSection('orders');
};

window.loadFullCustomerHistory = async () => {
    if (!selectedUserId) return;
    
    const container = document.getElementById('customerHistoryContainer');
    const modalTitle = document.getElementById('historyModalTitle');
    
    if (!container || !modalTitle) {
        console.error("Modal HTML is missing from admin.html!");
        return;
    }

    // Get the customer's name from the active chat tab
    const activeTab = document.querySelector('.user-tab.active');
    const customerName = activeTab ? activeTab.querySelector('.user-name span').textContent : "Customer";
    
    modalTitle.textContent = `${customerName}'s Orders`;
    
    // Show loading spinner
    container.innerHTML = `
        <div style="text-align:center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 30px; color: var(--primary);"></i>
            <p style="color: var(--taupe); margin-top: 15px;">Fetching order history...</p>
        </div>
    `;
    
    // Open the modal
    window.openModal('customerHistoryModal');
    
    try {
        // FIX: We removed orderBy("date") from the Firebase query to avoid the Index Error.
        const q = query(
            collection(db, "orders"),
            where("userId", "==", selectedUserId)
        );
        
        const snapshot = await getDocs(q);
        container.innerHTML = "";
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--taupe);">
                    <i class="fas fa-shopping-bag" style="font-size: 40px; color: var(--sand); margin-bottom: 15px;"></i>
                    <p>No orders found for this customer yet.</p>
                </div>
            `;
            return;
        }
        
        // 1. Put all orders into a Javascript Array
        const userOrders = [];
        snapshot.forEach(docSnap => {
            userOrders.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        // 2. Sort the array newest to oldest using Javascript (Bypasses Firebase Index limit)
        userOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 3. Render the cards
        userOrders.forEach(o => {
            const orderDate = new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            const statusColors = {
                'Pending': { bg: '#fff3cd', text: '#856404' },
                'Preparing': { bg: '#cce5ff', text: '#004085' },
                'Ready': { bg: '#d4edda', text: '#155724' },
                'Completed': { bg: '#d1e7dd', text: '#0f5132' },
                'Cancelled': { bg: '#ffebee', text: '#c62828' }
            };
            const sColor = statusColors[o.status] || statusColors['Pending'];

            container.innerHTML += `
                <div style="background: white; border: 1px solid var(--border-light); border-radius: 12px; padding: 15px; margin-bottom: 15px; display: flex; gap: 15px; align-items: start; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
                    <img src="${o.imageUrl || 'assets/logo.png'}" style="width: 70px; height: 70px; border-radius: 8px; object-fit: cover; border: 1px solid var(--sand);">
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <strong style="color: var(--walnut); font-size: 1.05rem;">${o.productName}</strong>
                            <span style="background: ${sColor.bg}; color: ${sColor.text}; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${o.status}</span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--taupe); display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>#${o.id.slice(-8).toUpperCase()}</span>
                            <span>${orderDate}</span>
                        </div>
                        <div style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">
                            ₱${o.totalPrice?.toLocaleString() || '0'} <span style="font-weight: normal; font-size: 0.8rem; color: var(--taupe);">x${o.quantity}</span>
                        </div>
                        ${o.personalization ? `
                            <div style="margin-top: 8px; font-size: 0.8rem; background: var(--cream); padding: 8px 10px; border-radius: 6px; color: var(--walnut); border-left: 3px solid var(--primary);">
                                <strong>Text:</strong> "${o.personalization}"
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
    } catch (error) {
        console.error("Error loading customer history:", error);
        container.innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 20px;">Failed to load order history. Check console for details.</p>';
    }
};

window.sendBase64Image = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 1. Ensure an admin has selected a customer to chat with!
    if (!selectedUserId) {
        showToast("Please select a customer from the left sidebar first.", 'error');
        return;
    }

    // 2. Target the correct Admin input box
    const inputField = document.getElementById('adminChatInput');
    const originalPlaceholder = inputField.placeholder;
    
    // Grab the customer name for the database record
    const activeTab = document.querySelector('.user-tab.active');
    const customerName = activeTab ? activeTab.querySelector('.user-name span').textContent : "Customer";
    
    try {
        inputField.placeholder = "Compressing & sending image...";
        inputField.disabled = true;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; 
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const base64String = canvas.toDataURL('image/jpeg', 0.7);

                try {
                    // 3. Send as Admin to the specific Customer
                    await addDoc(collection(db, "chats"), {
                        userId: selectedUserId,
                        userEmail: customerName,
                        userName: customerName,
                        text: "Sent an image", 
                        imageBase64: base64String, 
                        sender: "admin", // Sent by Admin!
                        timestamp: new Date(),
                        readByUser: false // Customer hasn't read it yet
                    });
                } catch (dbError) {
                    console.error("Firestore error:", dbError);
                    showToast("Failed to send image.", 'error');
                }
            };
        };
    } catch (error) {
        console.error("Image processing failed:", error);
    } finally {
        inputField.placeholder = originalPlaceholder;
        inputField.disabled = false;
        event.target.value = ""; 
    }
};

window.backToChatList = () => {
    const chatContainer = document.querySelector('.chat-container-admin');
    if (chatContainer) {
        chatContainer.classList.remove('mobile-chat-active');
    }
};