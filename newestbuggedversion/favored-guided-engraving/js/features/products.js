import { GLOBAL_STATE, SAMPLE_PRODUCTS } from '../constants/config.js';
import { showAlert } from '../ui/alerts.js';

export async function loadProducts() {
    const container = document.getElementById('productsContainer');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const noProductsMessage = document.getElementById('noProductsMessage');
    
    if (!container) return;
    
    if (loadingSpinner) loadingSpinner.classList.remove('hidden');
    if (noProductsMessage) noProductsMessage.classList.add('hidden');
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        db.collection('products').onSnapshot((snapshot) => {
            if (!snapshot.empty) {
                GLOBAL_STATE.products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } else {
                GLOBAL_STATE.products = SAMPLE_PRODUCTS;
                addSampleProductsToFirestore();
            }
            
            filterProducts();
            
            if (document.getElementById('manage-productsTab')?.classList.contains('active')) {
                window.loadManageProductsTab();
            }
            
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        }, (error) => {
            console.error('Error syncing products:', error);
            GLOBAL_STATE.products = SAMPLE_PRODUCTS;
            filterProducts();
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        });
        
    } catch (error) {
        console.error('Error initiating product load:', error);
        GLOBAL_STATE.products = SAMPLE_PRODUCTS;
        filterProducts();
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
    }
}

export function filterProducts() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const materialFilter = document.getElementById('materialFilter');
    const priceFilter = document.getElementById('priceFilter');
    const container = document.getElementById('productsContainer');
    const noProductsMessage = document.getElementById('noProductsMessage');
    
    if (!container) return;
    
    const searchTerm = searchInput?.value.toLowerCase() || '';
    const category = categoryFilter?.value || '';
    const material = materialFilter?.value || '';
    const priceRange = priceFilter?.value || '';
    
    const filteredProducts = GLOBAL_STATE.products.filter(product => {
        if (!product.isVisible) return false;
        
        const matchesSearch = searchTerm === '' || 
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm);
        
        const matchesCategory = category === '' || product.category === category;
        const matchesMaterial = material === '' || product.material === material;
        
        let matchesPrice = true;
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            if (priceRange.endsWith('+')) {
                matchesPrice = product.basePrice >= 200;
            } else if (max) {
                matchesPrice = product.basePrice >= min && product.basePrice <= max;
            } else {
                matchesPrice = product.basePrice <= min;
            }
        }
        
        return matchesSearch && matchesCategory && matchesMaterial && matchesPrice;
    });
    
    displayProducts(filteredProducts);
    
    if (noProductsMessage) {
        noProductsMessage.classList.toggle('hidden', filteredProducts.length > 0);
    }
}

export function displayProducts(productsToDisplay) {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (productsToDisplay.length === 0) {
        container.innerHTML = '<p class="text-center text-brown-medium">No products found.</p>';
        return;
    }
    
    productsToDisplay.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card card';
        card.style.animationDelay = `${index * 0.05}s`;
        
        card.innerHTML = `
            <div class="product-image-container">
                <img src="${product.image}" alt="${product.name}" class="product-image"
                    onerror="this.src='https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&h=600&q=80'">
                ${product.tags && product.tags.includes('popular') ? 
                    '<span class="product-badge">Popular</span>' : ''}
            </div>
            <div class="card-body">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.25rem; margin: 0;">${product.name}</h3>
                    <div class="price-tag" style="text-align: right;">
                        <div style="font-size: 1.25rem; font-weight: 600; color: var(--wood-dark);">$${product.basePrice.toFixed(2)}</div>
                        <small style="color: var(--brown-light); font-size: 0.875rem;">Base Price</small>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    <span class="badge">${product.category}</span>
                    <span class="badge">${product.material}</span>
                    <span class="badge">${product.dimensions}</span>
                </div>
                
                <p style="color: var(--brown-medium); font-size: 0.875rem; margin-bottom: 1.5rem;">
                    ${product.description.substring(0, 80)}...
                </p>
                
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="window.viewProductDetails('${product.id}')" style="flex: 1;">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn btn-outline" onclick="window.orderProduct('${product.id}')" style="flex: 1;">
                        <i class="fas fa-shopping-cart"></i> Order
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

export function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const materialFilter = document.getElementById('materialFilter');
    const priceFilter = document.getElementById('priceFilter');
    
    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (materialFilter) materialFilter.value = '';
    if (priceFilter) priceFilter.value = '';
    
    filterProducts();
}

export function viewProductDetails(productId) {
    const product = GLOBAL_STATE.products.find(p => p.id === productId);
    if (!product) return;
    
    window.showProductModal(product);
}

export function orderProduct(productId) {
    if (!GLOBAL_STATE.currentUser) {
        window.showAuthModal('login');
        return;
    }
    
    window.showPage('account');
    window.showTab('new-order');
    
    setTimeout(() => {
        GLOBAL_STATE.selectedOrderType = 'pre-listed';
        GLOBAL_STATE.selectedProduct = GLOBAL_STATE.products.find(p => p.id === productId);
        GLOBAL_STATE.currentOrderStep = 1;
        window.initNewOrderForm();
        
        const productSelect = document.getElementById('orderProductSelect');
        if (productSelect) {
            productSelect.value = productId;
        }
    }, 100);
}

async function addSampleProductsToFirestore() {
    try {
        const db = window.firebaseDb || firebase.firestore();
        const batch = db.batch();
        
        GLOBAL_STATE.products.forEach(product => {
            const productRef = db.collection('products').doc(product.id);
            batch.set(productRef, product);
        });
        
        await batch.commit();
        console.log('Sample products added to Firestore');
    } catch (error) {
        console.error('Error adding sample products:', error);
    }
}