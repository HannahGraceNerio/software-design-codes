import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, onSnapshot, where, getDoc, limit, setDoc } 
from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- GLOBAL VARIABLES (Declared only ONCE) ---
let selectedUserId = null;
let editingProductId = null;
let userMap = new Map();
let onlineUsersMap = new Map(); 
let userSearchTerm = '';
let unsubscribeMessages = null;
let chatFilter = 'all'; 

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            userSearchTerm = e.target.value.toLowerCase();
            renderUserList();
        });
    }
});

// --- AUTH MONITOR ---
onAuthStateChanged(auth, (user) => {
    if (user && user.email === "admin@favored.com") {
        loadInventory();
        loadOrders();
        loadSpotlightInitial();
        updateDashboardStats();
    } else {
        window.location.href = "/"; 
    }
});

// Calculate dashboard stats
function updateDashboardStats() {
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
        
        document.getElementById('totalOrders').textContent = orders.length;
        document.getElementById('pendingOrders').textContent = pendingCount;
        document.getElementById('totalRevenue').textContent = `₱${totalRevenue.toLocaleString()}`;
        document.getElementById('orderGrowth').textContent = '+8%';
    });
    
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

// --- NAVIGATION & MODALS ---
window.showAdminSection = (id) => {
    const sections = ['products', 'orders', 'admin-chat'];
    sections.forEach(sec => {
        const el = document.getElementById(sec);
        if (el) el.style.display = (sec === id) ? 'block' : 'none';
    });
    
    const statsContainer = document.getElementById('stats-container');
    if (statsContainer) {
        statsContainer.style.display = (id === 'products') ? 'grid' : 'none';
    }
    
    if (id === 'admin-chat') {
        loadChatUsers();
    }
    
    document.querySelectorAll('.nav-center a').forEach(a => {
        a.classList.remove('active');
        a.style.color = "rgba(255,255,255,0.8)"; 
    });
    
    const activeNav = document.getElementById(`nav-${id}`);
    if (activeNav) {
        activeNav.classList.add('active');
        activeNav.style.color = "white"; 
    }
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
window.logoutAdmin = () => signOut(auth).then(() => window.location.href = "/");

// =========================================
// SPOTLIGHT ENGINE
// =========================================

async function compressImage(base64Str) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; 
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
    });
}

window.renderSpotlightPreview = (imagesArray) => {
    const previewContainer = document.getElementById('admin-spotlight-preview');
    if (!previewContainer) return;
    if (imagesArray.length === 0) {
        previewContainer.innerHTML = '<p style="color: var(--taupe); padding: 20px;">No photos in showcase.</p>';
        return;
    }
    previewContainer.innerHTML = imagesArray.map((src, index) => `
        <div class="spotlight-preview-item" style="position: relative; width: 120px; height: 120px; animation: fadeInUp 0.3s ease;">
            <img src="${src}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px; border: 2px solid var(--sand);">
            <button onclick="deleteSpotlightPhoto(${index})" 
                style="position: absolute; top: -8px; right: -8px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;">
                <i class="fas fa-times"></i>
            </button>
            <div style="position: absolute; bottom: 5px; left: 5px; background: rgba(0,0,0,0.6); color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px;">#${index + 1}</div>
        </div>
    `).join('');
};

const spotlightInput = document.getElementById('spotlightInput');
if (spotlightInput) {
    spotlightInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        if (totalSize > 10 * 1024 * 1024) {
            showToast("Selection exceeds 10MB limit.", "error");
            e.target.value = ""; return;
        }

        try {
            const docRef = doc(db, "site_settings", "hero_spotlight");
            const docSnap = await getDoc(docRef);
            let existingImages = (docSnap.exists() && docSnap.data().images) ? docSnap.data().images : [];

            if (existingImages.length + files.length > 10) {
                showToast("Maximum 10 photos allowed.", "error");
                e.target.value = ""; return;
            }

            showToast("Compressing & Saving...", "success");

            const processed = [];
            for (let file of files) {
                const base64 = await new Promise(r => {
                    const reader = new FileReader();
                    reader.onload = (ev) => r(ev.target.result);
                    reader.readAsDataURL(file);
                });
                const compressed = await compressImage(base64);
                processed.push(compressed);
            }

            const updatedGallery = [...existingImages, ...processed];
            await setDoc(docRef, { images: updatedGallery, updatedAt: new Date().toISOString() }, { merge: true });
            
            window.renderSpotlightPreview(updatedGallery);
            showToast(`Added ${files.length} photos!`, "success");
            e.target.value = ""; 

        } catch (error) {
            showToast("Error updating gallery.", "error");
        }
    });
}

window.deleteSpotlightPhoto = async (index) => {
    if (!confirm("Remove this order from the showcase?")) return;
    try {
        const docRef = doc(db, "site_settings", "hero_spotlight");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            let images = docSnap.data().images || [];
            images.splice(index, 1);
            await setDoc(docRef, { images: images }, { merge: true });
            window.renderSpotlightPreview(images);
            showToast("Photo removed", "success");
        }
    } catch (err) { showToast("Delete failed", "error"); }
};

async function loadSpotlightInitial() {
    try {
        const docSnap = await getDoc(doc(db, "site_settings", "hero_spotlight"));
        if (docSnap.exists()) window.renderSpotlightPreview(docSnap.data().images || []);
    } catch (err) { console.error(err); }
}

// --- INVENTORY MANAGEMENT ---
async function loadInventory() {
    const container = document.getElementById('adminProducts');
    const template = document.getElementById('product-template');
    if(!container || !template) return;
    
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
            clone.querySelector('.btn-edit').onclick = () => openEditProductModal(id, p.name, p.price, p.stock, p.description);
            clone.querySelector('.btn-delete').onclick = () => deleteProduct(id);

            container.appendChild(clone);
        });
    });
}

window.updateStock = async (id, newStock) => {
    if (newStock < 0) return;
    await updateDoc(doc(db, "products", id), { stock: newStock });
};

// --- STOCK DEDUCTION FUNCTION ---
window.updateOrderStatus = async (id, status, productId, quantity) => {
    // 1. Update the order status first
    await updateDoc(doc(db, "orders", id), { status });
    
    // 2. If the order is marked as 'Completed', deduct the stock!
    if (status === 'Completed') {
        if (!productId || !quantity) {
            console.error("Cannot deduct stock: Missing productId or quantity in this order.");
            if (typeof showToast === 'function') showToast("Status updated, but could not deduct stock (Old Order Data).", "error");
            return;
        }

        try {
            const productRef = doc(db, "products", productId);
            const productSnap = await getDoc(productRef);
            
            if (productSnap.exists()) {
                let currentStock = Number(productSnap.data().stock) || 0;
                let newStock = currentStock - Number(quantity);
                
                // Prevent stock from going into negative numbers
                if (newStock < 0) newStock = 0; 
                
                await updateDoc(productRef, { stock: newStock });
            }
        } catch (error) {
            console.error("Failed to update product stock:", error);
        }
    }
};

window.openEditProductModal = (id, name, price, stock, description) => {
    editingProductId = id;
    document.getElementById('editName').value = name;
    document.getElementById('editDescription').value = description;
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
    const description = document.getElementById('editDescription').value;
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
            description: description,
            stock: stock
        };

        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = async (e) => {
                updateData.imageUrl = e.target.result; 
                await updateDoc(doc(db, "products", editingProductId), updateData);
                finishEdit(saveBtn, originalText);
            };
        } else {
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

function finishEdit(btn, text) {
    btn.innerHTML = text;
    btn.disabled = false;
    const fileInput = document.getElementById('editImageFile');
    if(fileInput) fileInput.value = '';
    const display = document.getElementById('editFileNameDisplay');
    if(display) display.textContent = "Click to change image";
    
    showToast("Product updated successfully!", 'success');
    window.closeModal('editProductModal');
}

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

window.addProduct = async () => {
    const name = document.getElementById('addName').value.trim();
    const price = document.getElementById('addPrice').value.trim();
    const stock = document.getElementById('addStock').value.trim();
    const file = document.getElementById('addImageFile').files[0];
    const description = document.getElementById('addDescription').value.trim();

    if (!name || !price || !stock || !file || !description) {
        showToast("Please fill all fields (name, price, stock, image, description)", 'error');
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
                    description: description,
                    price: priceNum,
                    stock: stockNum,
                    imageUrl: e.target.result,
                    date: new Date().toISOString()
                });

                document.getElementById('addName').value = '';
                document.getElementById('addDescription').value = '';
                document.getElementById('addPrice').value = '';
                document.getElementById('addStock').value = '10'; 
                document.getElementById('addImageFile').value = ''; 
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

            clone.querySelector('.order-id').textContent = `#${id.slice(-8).toUpperCase()}`;
            clone.querySelector('.order-date').textContent = new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            clone.querySelector('.order-img').src = o.imageUrl || 'assets/logo.png';
            clone.querySelector('.order-product-name').textContent = o.productName;
            clone.querySelector('.order-email').textContent = o.userEmail || o.userEmailAddress || "Customer";
            clone.querySelector('.order-total').textContent = `₱${o.totalPrice?.toLocaleString() || '0'}`;

            const designBtn = clone.querySelector('.view-design-btn');
            
            if (((o.elements && o.elements.length > 0) || o.posX !== undefined) && designBtn) {
                designBtn.style.display = 'block'; 
            
                designBtn.onclick = () => {
                    const imgElement = document.getElementById('adminPreviewImg');
                    if (imgElement) imgElement.src = o.imageUrl;
                    
                    const wrapper = document.getElementById('adminCanvas');
                    if(!wrapper) return;
                    
                    // CLEAN FIX: Remove all old text elements, but keep the image!
                    Array.from(wrapper.children).forEach(child => {
                        if (child.id !== 'adminPreviewImg') child.remove();
                    }); 

                    if (o.elements && Array.isArray(o.elements)) {
                        o.elements.forEach(item => {
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
                                    el.style.fontFamily = `"${item.font}", sans-serif`;
                                } else {
                                    el.style.fontFamily = "Arial, sans-serif";
                                }
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
                        div.style.fontSize = (o.engravingSize || 30) + "px";
                        div.style.transform = `translate(calc(-50% + ${o.posX}px), calc(-50% + ${o.posY}px)) rotate(${o.engravingRotation || 0}deg)`;
                        div.style.fontFamily = `"${o.engravingFont || "Arial"}", sans-serif`;
                        wrapper.appendChild(div);
                    }
                    openModal('adminPreviewModal');
                };
            }

            if (o.status === 'Cancelled') {
                const popoverWrapper = clone.querySelector('.cancel-popover-wrapper');
                const cancelBtn = clone.querySelector('.view-cancel-btn');
                const reasonMenu = clone.querySelector('.cancel-reason-menu');
                const reasonText = clone.querySelector('.cancel-reason-text');
                const cardElement = clone.querySelector('.order-card-admin');
                
                if (popoverWrapper && cancelBtn) {
                    popoverWrapper.style.display = 'block'; 
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

            const select = clone.querySelector('.status-select');
            
            if (o.status === 'Cancelled' || o.status === 'Rejected' || o.status === 'Completed') {
                const opt = document.createElement('option');
                opt.value = o.status; 
                opt.textContent = o.status;
                opt.selected = true;
                select.appendChild(opt);
                
                select.disabled = true; 
                select.style.cursor = 'not-allowed';
                select.style.opacity = '0.9';
                
                if (o.status === 'Completed') {
                    select.style.backgroundColor = '#d1e7dd';
                    select.style.color = '#0f5132';
                    select.style.borderColor = '#0f5132';
                } else {
                    select.style.backgroundColor = '#ffebee';
                    select.style.color = '#c62828';
                    select.style.borderColor = '#e74c3c';
                }
            } else {
                const progressionStages = ["Pending", "Preparing", "Ready", "Completed"];
                const currentIndex = progressionStages.indexOf(o.status);
                let allowedStatuses = [];

                if (currentIndex !== -1) {
                    allowedStatuses = progressionStages.slice(currentIndex);
                } else {
                    allowedStatuses = progressionStages;
                }

                allowedStatuses.push("Rejected");
                
                allowedStatuses.forEach(stat => {
                    const opt = document.createElement('option');
                    opt.value = stat; 
                    opt.textContent = stat;
                    if(o.status === stat) opt.selected = true;
                    select.appendChild(opt);
                });
                
                select.onchange = async (e) => {
                    const newStatus = e.target.value;
                    const oldStatus = o.status; 

                    const isConfirmed = confirm(`Are you sure you want to move this order forward to "${newStatus}"?`);
                    
                    if (isConfirmed) {
                        await updateOrderStatus(id, newStatus, o.productId, o.quantity);
                        
                        if (newStatus === 'Rejected') {
                            if (typeof showToast === 'function') showToast("Order rejected and locked.", "error");
                        } else if (newStatus === 'Completed') {
                            if (typeof showToast === 'function') showToast("Order completed! Stock deducted.", "success");
                        } else {
                            if (typeof showToast === 'function') showToast("Order progressed to " + newStatus, "success");
                        }
                    } else {
                        e.target.value = oldStatus; 
                    }
                };
            }

            const card = clone.querySelector('.order-card-admin');
            if(card) card.setAttribute('data-status', o.status.toLowerCase());

            container.appendChild(clone);
        });
    });
};

window.filterAdminByDate = (selectedDate) => {
    if (!selectedDate) {
        document.querySelectorAll('.order-card-admin, .order-card-enhanced').forEach(card => {
            card.style.display = "block";
        });
        return;
    }

    const orderCards = document.querySelectorAll('.order-card-admin, .order-card-enhanced');
    let foundCount = 0;

    orderCards.forEach(card => {
        const dateEl = card.querySelector('.order-date-value') || card.querySelector('.order-date');
        
        if (dateEl) {
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
        const dateInput = document.getElementById('adminDateFilter');
        if(dateInput) dateInput.value = "";
        orderCards.forEach(card => card.style.display = "block");
    }   
};

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
// CHAT SYSTEM 
// ==========================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const chatInput = document.getElementById('adminChatInput');
        if (chatInput) chatInput.value = '';
    }
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

// SINGLE GLOBAL CLICK LISTENER (Handles cancel reasons & chat menus)
document.addEventListener('click', (e) => {
    if (!e.target.closest('.cancel-popover-wrapper')) {
        document.querySelectorAll('.cancel-reason-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }

    if (!e.target.closest('.msg-menu-wrapper')) {
        document.querySelectorAll('.msg-dropdown').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

window.filterChatUsers = (filter) => {
    chatFilter = filter;
    
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.style.background = 'var(--cream)';
        btn.style.color = 'var(--walnut)';
        
        if (btn.getAttribute('onclick').includes(filter)) {
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';
        }
    });
    
    renderUserList();
};

function loadChatUsers() {
    const list = document.getElementById('adminChatUserList');
    if (!list) return;
    
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
            
            if (!msgText || msgText.trim() === "") return; 
            
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
    }, (error) => {
        console.error("Error loading chat users:", error);
    });

    onSnapshot(collection(db, "presence"), (snapshot) => {
        onlineUsersMap.clear();
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status === "online") {
                onlineUsersMap.set(docSnap.id, {
                    email: data.email || "Unknown User",
                    lastActive: data.lastActive
                });
            }
        });
        if (chatFilter === 'online') {
            renderUserList();
        }
    });
}

function renderUserList() {
    const list = document.getElementById('adminChatUserList');
    if (!list) return;
    
    list.innerHTML = "";

    if (chatFilter === 'online') {
        if (onlineUsersMap.size === 0) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-users"><\/i><p>No users currently online<\/p><\/div>';
            return;
        }

        onlineUsersMap.forEach((info, uid) => {
            if (userSearchTerm && !info.email.toLowerCase().includes(userSearchTerm)) return;
            list.appendChild(createOnlineUserTabElement(uid, info.email));
        });
        return; 
    }

    if (userMap.size === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-comments"><\/i><p>No conversations yet<\/p><small>Customers will appear here when they message<\/small><\/div>';
        return;
    }

    const sortedUsers = Array.from(userMap.entries())
        .filter(([uid, info]) => {
            if (userSearchTerm && !info.displayName.toLowerCase().includes(userSearchTerm)) {
                return false;
            }
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
    const unreadBadge = info.unread > 0 ? `<span class="unread-badge">${info.unread}<\/span>` : '';

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

function createOnlineUserTabElement(uid, email) {
    const userDiv = document.createElement('div');
    userDiv.className = `user-tab`;
    userDiv.style.cursor = 'default'; 
    
    const firstLetter = email.charAt(0).toUpperCase();

    userDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
            <div style="position:relative;">
                <div class="user-avatar" style="background: var(--primary);">${firstLetter}</div>
            </div>
            <div class="user-info">
                <div class="user-name">
                    <span class="user-name-text">${email}</span>
                </div>
                <div class="user-last-msg" style="color: var(--taupe); font-style: italic;">
                    Browsing the site...
                </div>
            </div>
        </div>
    `;
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
            const m = { id: docSnap.id, ...docSnap.data() };
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
        // Only show the three dots if the Admin sent this specific image
        const isMyMessage = message.sender === 'admin';
        
        const menuBtn = isMyMessage ? `
            <div style="position: relative;" class="msg-menu-wrapper">
                <button onclick="toggleMsgMenu('menu-${message.id}')" style="background: none; border: none; color: inherit; cursor: pointer; padding: 5px; opacity: 0.8; font-size: 1.1rem;">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div id="menu-${message.id}" class="msg-dropdown" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid var(--border-light); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; min-width: 120px; overflow: hidden;">
                    <button onclick="deleteChatMessage('${message.id}')" style="width: 100%; text-align: left; padding: 10px 15px; background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 0.9rem; font-family: inherit; transition: background 0.2s;" onmouseover="this.style.background='#ffebee'" onmouseout="this.style.background='none'">
                        <i class="fas fa-trash-alt" style="margin-right: 8px;"></i> Delete
                    </button>
                </div>
            </div>
        ` : "";

        uploadedImageHTML = `
            <div style="display: flex; align-items: flex-start; gap: 5px; margin-top: 5px; margin-bottom: 5px;">
                <img src="${message.imageBase64}" style="max-width: calc(100% - 24px); max-height: 200px; border-radius: 8px; cursor: pointer; border: 1px solid rgba(0,0,0,0.1);" onclick="window.open('${message.imageBase64}', '_blank')">
                ${menuBtn}
            </div>
        `;
        if (message.text === "📷 Sent an image" || message.text === "Sent an image") message.text = ""; 
    }

    let orderChipHTML = "";
    if (message.linkedOrderId) {
        const shortId = message.linkedOrderId.slice(-8).toUpperCase();
        const imgUrl = message.linkedOrderImg || "assets/logo.png"; 
        const pName = message.linkedOrderName || "Order #" + shortId;
        
        orderChipHTML = `
            <div onclick="openAdminOrderView('${message.linkedOrderId}')" 
                 style="cursor: pointer; background: white; border: 1px solid var(--sand); padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; transition: transform 0.2s;">
                <img src="${imgUrl}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px;">
                <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden;">
                    <strong style="font-size: 0.85rem; color: var(--walnut); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${pName}</strong>
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

window.toggleMsgMenu = (menuId) => {
    const menu = document.getElementById(menuId);
    if(!menu) return;
    const isVisible = menu.style.display === 'block';
    
    document.querySelectorAll('.msg-dropdown').forEach(m => m.style.display = 'none');
    
    if (!isVisible) {
        menu.style.display = 'block';
    }
};

window.deleteChatMessage = async (messageId) => {
    if (!messageId || messageId === 'undefined') return;
    if (confirm("Are you sure you want to delete this photo?")) {
        try {
            await deleteDoc(doc(db, "chats", messageId));
            if (typeof showToast === 'function') showToast("Photo deleted successfully", "success");
        } catch (error) {
            console.error("Error deleting message:", error);
            if (typeof showToast === 'function') showToast("Failed to delete photo", "error");
        }
    }
};

window.openAdminOrderView = async (orderId) => {
    showAdminSection('orders');
    
    setTimeout(() => {
        const orderCard = Array.from(document.querySelectorAll('.order-card-admin')).find(card => {
            return card.innerText.includes(orderId.slice(-8).toUpperCase());
        });

        if (orderCard) {
            orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            orderCard.style.transition = "box-shadow 0.3s, transform 0.3s";
            orderCard.style.boxShadow = "0 0 0 4px rgba(231, 76, 60, 0.4)";
            orderCard.style.transform = "scale(1.02)";
            
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
        const q = query(
            collection(db, "chats"),
            where("userId", "==", uid)
        );
        
        const snapshot = await getDocs(q);
        snapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            
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
        // We removed orderBy and limit here to avoid the Firebase Index Error
        const q = query(
            collection(db, "orders"),
            where("userId", "==", uid)
        );
        
        const snapshot = await getDocs(q);
        container.innerHTML = "";
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="color: var(--taupe); font-size: 0.9rem;">No orders yet</p>';
            return;
        }
        
        const userOrders = [];
        snapshot.forEach(docSnap => userOrders.push(docSnap.data()));  
        userOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        const top3Orders = userOrders.slice(0, 3);
        
        top3Orders.forEach(order => {
            container.innerHTML += `
                <div class="order-preview-item">
                    <img src="${order.imageUrl || 'assets/logo.png'}" class="order-preview-img" alt="">
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

window.loadFullCustomerHistory = async () => {
    if (!selectedUserId) return;
    
    const container = document.getElementById('customerHistoryContainer');
    const modalTitle = document.getElementById('historyModalTitle');
    
    if (!container || !modalTitle) {
        console.error("Modal HTML is missing from admin.html!");
        return;
    }

    const activeTab = document.querySelector('.user-tab.active');
    const customerName = activeTab ? activeTab.querySelector('.user-name span').textContent : "Customer";
    
    modalTitle.textContent = `${customerName}'s Orders`;
    
    container.innerHTML = `
        <div style="text-align:center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 30px; color: var(--primary);"></i>
            <p style="color: var(--taupe); margin-top: 15px;">Fetching order history...</p>
        </div>
    `;
    
    window.openModal('customerHistoryModal');
    
    try {
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
        
        const userOrders = [];
        snapshot.forEach(docSnap => {
            userOrders.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        userOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        
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

    if (!selectedUserId) {
        showToast("Please select a customer from the left sidebar first.", 'error');
        return;
    }

    const inputField = document.getElementById('adminChatInput');
    const originalPlaceholder = inputField.placeholder;
    
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
                    await addDoc(collection(db, "chats"), {
                        userId: selectedUserId,
                        userEmail: customerName,
                        userName: customerName,
                        text: "Sent an image", 
                        imageBase64: base64String, 
                        sender: "admin", 
                        timestamp: new Date(),
                        readByUser: false 
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

const originalShowAdminSection = window.showAdminSection;

window.showAdminSection = function(id) {
    if (originalShowAdminSection) {
        originalShowAdminSection(id);
    }
    updateAdminMobileNavActiveState(id);
    closeAdminMobileMenu();
};

function updateAdminMobileNavActiveState(sectionId) {
    const mobileNavLinks = document.querySelectorAll('.mobile-nav a');
    
    mobileNavLinks.forEach(link => {
        link.classList.remove('active');
        link.style.background = '';
        link.style.borderColor = '';
        link.style.color = '';
    });
    
    mobileNavLinks.forEach(link => {
        const onclickAttr = link.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${sectionId}'`)) {
            link.classList.add('active');
            link.style.background = 'rgba(212, 165, 95, 0.2)';
            link.style.borderColor = 'rgba(212, 165, 95, 0.4)';
            link.style.color = 'white !important';
        }
    });
}

function closeAdminMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (hamburgerBtn && mobileMenu && menuOverlay) {
        hamburgerBtn.classList.remove('active');
        mobileMenu.classList.remove('open');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function getCurrentAdminSection() {
    const sections = ['products', 'orders', 'admin-chat'];
    
    for (let section of sections) {
        const element = document.getElementById(section);
        if (element && element.style.display !== 'none') {
            return section;
        }
    }
    return 'products'; 
}

document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (hamburgerBtn && mobileMenu && closeMenuBtn && menuOverlay) {
        hamburgerBtn.addEventListener('click', function() {
            this.classList.toggle('active');
            mobileMenu.classList.toggle('open');
            menuOverlay.classList.toggle('active');
            document.body.style.overflow = 'hidden';
            
            const currentSection = getCurrentAdminSection();
            updateAdminMobileNavActiveState(currentSection);
        });
        
        closeMenuBtn.addEventListener('click', function() {
            hamburgerBtn.classList.remove('active');
            mobileMenu.classList.remove('open');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
        
        menuOverlay.addEventListener('click', function() {
            hamburgerBtn.classList.remove('active');
            mobileMenu.classList.remove('open');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
        
        mobileMenu.querySelectorAll('.mobile-nav a').forEach(link => {
            link.addEventListener('click', function(e) {
                const onclickAttr = this.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/'([^']+)'/);
                    if (match && match[1]) {
                        updateAdminMobileNavActiveState(match[1]);
                    }
                }
            });
        });
    }
});
