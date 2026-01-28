// app.js - Complete JavaScript for Favored & Guided Engraving - NEW THEME

// ========== GLOBAL STATE ==========
let currentUser = null;
let currentUserRole = 'user';
let products = [];
let orders = [];
let conversations = [];

// ========== PAGE MANAGEMENT ==========
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
        
        // Update URL hash
        window.location.hash = pageId;
        
        // Update navigation
        updateNavigation();
        
        // Load page-specific content
        loadPageContent(pageId);
    }
}

function loadPageContent(pageId) {
    switch(pageId) {
        case 'home':
            // Home page already loaded
            break;
        case 'products':
            loadProducts();
            break;
        case 'account':
            if (!currentUser) {
                showAuthModal('login');
                return;
            }
            loadAccountContent();
            break;
        case 'admin':
            if (!currentUser || currentUserRole !== 'admin') {
                showAuthModal('login');
                return;
            }
            loadAdminContent();
            break;
        case 'about':
            // About page already loaded
            break;
    }
}

function updateNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPage = window.location.hash.replace('#', '') || 'home';
    
    navLinks.forEach(link => {
        const targetPage = link.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (targetPage === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // Update nav actions based on auth state
    const navActions = document.getElementById('navActions');
    if (!navActions) return;
    
    if (currentUser) {
        const userName = currentUser.email.split('@')[0];
        navActions.innerHTML = `
            <button class="btn btn-outline btn-sm" onclick="showPage('account')">
                <i class="fas fa-user"></i> ${userName}
            </button>
            ${currentUserRole === 'admin' ? `
                <button class="btn btn-gold btn-sm" onclick="showPage('admin')">
                    <i class="fas fa-tachometer-alt"></i> Admin
                </button>
            ` : ''}
            <button class="btn btn-sm" onclick="logout()" style="background: none; border: none; color: var(--brown-dark);">
                <i class="fas fa-sign-out-alt"></i>
            </button>
            <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
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
            <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
                <i class="fas fa-bars"></i>
            </button>
        `;
    }
}

function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

// ========== AUTHENTICATION MODAL ==========
function showAuthModal(type) {
    const modal = document.getElementById('authModal');
    const modalTitle = document.getElementById('authModalTitle');
    const modalBody = document.querySelector('#authModal .modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    if (type === 'login') {
        modalTitle.textContent = 'Welcome Back';
        modalBody.innerHTML = `
            <form id="loginForm" class="space-y-lg">
                <div class="form-group">
                    <label for="loginEmail" class="form-label">Email Address</label>
                    <input type="email" id="loginEmail" class="form-control" placeholder="you@example.com" required>
                </div>

                <div class="form-group">
                    <label for="loginPassword" class="form-label">Password</label>
                    <input type="password" id="loginPassword" class="form-control" placeholder="••••••••" required>
                </div>

                <div class="form-group">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-xs">
                            <input type="checkbox" id="rememberMe" class="form-check-input">
                            <label for="rememberMe" class="form-label" style="margin: 0; font-weight: normal;">Remember me</label>
                        </div>
                        <a href="#" class="text-sm text-gold" onclick="showAuthModal('reset')">Forgot password?</a>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-block">
                    Sign In
                </button>
            </form>


            <div class="mt-lg text-center">
                <p class="text-sm text-brown-medium">
                    Don't have an account?
                    <a href="#" class="text-gold font-medium" onclick="showAuthModal('signup')">
                        Sign up
                    </a>
                </p>
            </div>
        `;
        
        // Add form submit handler
        setTimeout(() => {
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    const email = document.getElementById('loginEmail').value;
                    const password = document.getElementById('loginPassword').value;
                    const success = await login(email, password);
                    if (success) {
                        closeAuthModal();
                    }
                });
            }
        }, 100);
        
    } else if (type === 'signup') {
        modalTitle.textContent = 'Create Account';
        modalBody.innerHTML = `
            <form id="signupForm" class="space-y-lg">
                <div id="signupError" class="alert alert-error hidden"></div>

                <div class="form-group">
                    <label for="signupName" class="form-label">Full Name</label>
                    <input type="text" id="signupName" class="form-control" placeholder="Dela Cruz" required>
                </div>

                <div class="form-group">
                    <label for="signupEmail" class="form-label">Email Address</label>
                    <input type="email" id="signupEmail" class="form-control" placeholder="you@example.com" required>
                </div>

                <div class="form-group">
                    <label for="signupPassword" class="form-label">Password</label>
                    <input type="password" id="signupPassword" class="form-control" placeholder="••••••••" required>
                    <div class="form-text">Must be at least 6 characters</div>
                </div>

                <div class="form-group">
                    <label for="signupConfirmPassword" class="form-label">Confirm Password</label>
                    <input type="password" id="signupConfirmPassword" class="form-control" placeholder="••••••••" required>
                </div>

                <div class="form-group">
                    <div class="flex items-center gap-xs">
                        <input type="checkbox" id="terms" class="form-check-input" required>
                        <label for="terms" class="form-label" style="margin: 0; font-weight: normal;">
                            I agree to the <a href="#" class="text-gold">Terms of Service</a> and <a href="#" class="text-gold">Privacy Policy</a>
                        </label>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-block">
                    Create Account
                </button>
            </form>

            <div class="mt-lg text-center">
                <p class="text-sm text-brown-medium">
                    Already have an account?
                    <a href="#" class="text-gold font-medium" onclick="showAuthModal('login')">
                        Sign in
                    </a>
                </p>
            </div>
        `;
        
        // Add form submit handler
        setTimeout(() => {
            const signupForm = document.getElementById('signupForm');
            if (signupForm) {
                signupForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    const name = document.getElementById('signupName').value;
                    const email = document.getElementById('signupEmail').value;
                    const password = document.getElementById('signupPassword').value;
                    const confirmPassword = document.getElementById('signupConfirmPassword').value;
                    
                    if (password !== confirmPassword) {
                        showAlert('Passwords do not match', 'error');
                        return;
                    }
                    
                    const success = await signup(name, email, password);
                    if (success) {
                        closeAuthModal();
                    }
                });
            }
        }, 100);
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// ========== AUTHENTICATION ==========
async function login(email, password) {
    try {
        const auth = window.firebaseAuth || firebase.auth(); // Fix: Safety fallback
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        const db = window.firebaseDb || firebase.firestore(); // Fix: Safety fallback
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            currentUserRole = userDoc.data().role || 'user';
        }
        
        showAlert('Welcome back! You are now signed in.', 'success');
        
        if (currentUserRole === 'admin') {
            showPage('admin');
        } else {
            showPage('account');
        }
        
        return true;
    } catch (error) {
        showAlert(error.message, 'error');
        return false;
    }
}

async function signup(name, email, password) {
    try {
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        
        const auth = window.firebaseAuth || firebase.auth(); // Fix: Safety fallback
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        const db = window.firebaseDb || firebase.firestore(); // Fix: Safety fallback
        await db.collection('users').doc(currentUser.uid).set({
            name: name,
            email: email,
            role: 'user',
            createdAt: new Date().toISOString(),
            phone: '',
            address: ''
        });
        
        currentUserRole = 'user';
        showAlert('Account created successfully! Welcome to Favored & Guided.', 'success');
        showPage('account');
        
        return true;
    } catch (error) {
        showAlert(error.message, 'error');
        return false;
    }
}

async function logout() {
    try {
        const auth = window.firebaseAuth || firebase.auth(); // Fix: Safety fallback
        await auth.signOut();
        currentUser = null;
        currentUserRole = 'user';
        
        showAlert('You have been signed out. Come back soon!', 'info');
        showPage('home');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// ========== PRODUCTS MANAGEMENT ==========
async function loadProducts() {
    const container = document.getElementById('productsContainer');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const noProductsMessage = document.getElementById('noProductsMessage');
    
    if (!container) return;
    
    if (loadingSpinner) loadingSpinner.classList.remove('hidden');
    if (noProductsMessage) noProductsMessage.classList.add('hidden');
    
    try {
        const db = window.firebaseDb || firebase.firestore(); // Fix: Safety fallback
        // Use real-time sync for products
        db.collection('products').onSnapshot((snapshot) => {
            if (!snapshot.empty) {
                products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } else {
                products = getSampleProducts();
            }
            
            filterProducts();

            if (document.getElementById('manage-productsTab')?.classList.contains('active')) {
                loadManageProductsTab();
            }
            
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        }, (error) => {
            console.error('Error syncing products:', error);
            products = getSampleProducts();
            filterProducts();
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        });
        
    } catch (error) {
        console.error('Error initiating product load:', error);
        products = getSampleProducts();
        filterProducts();
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
    }
}

function getSampleProducts() {
    return [
        {
            id: '1',
            name: 'Custom Trophy',
            category: 'Awards',
            material: 'Metal',
            basePrice: 89.99,
            dimensions: '10" x 6"',
            image: 'https://images.unsplash.com/photo-1580831800257-f83135932664?auto=format&fit=crop&w=600&h=600&q=80',
            description: 'Premium metal trophy with custom engraving. Perfect for corporate events, sports achievements, and special recognitions.',
            sku: 'TRP-001',
            tags: ['popular', 'award']
        },
        {
            id: '2',
            name: 'Personalized Jewelry',
            category: 'Gifts',
            material: 'Metal',
            basePrice: 49.99,
            dimensions: 'Various',
            image: 'https://images.unsplash.com/photo-1761210875101-1273b9ae5600?auto=format&fit=crop&w=600&h=600&q=80',
            description: 'Elegant personalized jewelry pieces with delicate engraving. Choose from necklaces, bracelets, and rings.',
            sku: 'JWL-001',
            tags: ['gift', 'jewelry']
        },
        {
            id: '3',
            name: 'Commemorative Plaque',
            category: 'Awards',
            material: 'Wood',
            basePrice: 129.99,
            dimensions: '12" x 9"',
            image: 'https://images.unsplash.com/photo-1763299358440-45e620ac18b6?auto=format&fit=crop&w=600&h=600&q=80',
            description: 'Professional commemorative plaque with premium finish. Ideal for dedications, memorials, and corporate recognition.',
            sku: 'PLQ-001',
            tags: ['wood', 'professional']
        },
        {
            id: '4',
            name: 'Engraved Keychain',
            category: 'Gifts',
            material: 'Metal',
            basePrice: 19.99,
            dimensions: '2" x 1"',
            image: 'https://images.unsplash.com/photo-1619892203894-b8c313da1af2?auto=format&fit=crop&w=600&h=600&q=80',
            description: 'Durable metal keychain with custom engraving. Perfect for promotional items or personalized gifts.',
            sku: 'KEY-001',
            tags: ['gift', 'keychain']
        },
        {
            id: '5',
            name: 'Wooden Cutting Board',
            category: 'Home',
            material: 'Wood',
            basePrice: 59.99,
            dimensions: '14" x 10"',
            image: 'https://images.unsplash.com/photo-1666013942797-9daa4b8b3b4f?auto=format&fit=crop&w=600&h=600&q=80',
            description: 'Premium hardwood cutting board with personalized engraving. A timeless kitchen essential and gift.',
            sku: 'WCB-001',
            tags: ['home', 'kitchen', 'wood']
        },
        {
            id: '6',
            name: 'Glass Award',
            category: 'Awards',
            material: 'Glass',
            basePrice: 149.99,
            dimensions: '8" x 10"',
            image: 'https://images.unsplash.com/photo-1764874299025-d8b2251f307d?auto=format&fit=crop&w=600&h=600&q=80',
            description: 'Elegant glass award with precision laser engraving. Sophisticated recognition for achievements and milestones.',
            sku: 'GLA-001',
            tags: ['glass', 'elegant', 'award']
        }
    ];
}

async function addSampleProductsToFirestore() {
    try {
        const db = window.firebaseDb || firebase.firestore();
        const batch = db.batch();
        
        products.forEach(product => {
            const productRef = db.collection('products').doc(product.id);
            batch.set(productRef, product);
        });
        
        await batch.commit();
        console.log('Sample products added to Firestore');
    } catch (error) {
        console.error('Error adding sample products:', error);
    }
}

function filterProducts() {
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
    
    const filteredProducts = products.filter(product => {
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
        if (filteredProducts.length === 0 && products.length > 0) {
            noProductsMessage.classList.remove('hidden');
            container.innerHTML = '';
        } else {
            noProductsMessage.classList.add('hidden');
        }
    }
}

function displayProducts(productsToDisplay) {
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
            <div style="position: relative;">
                <img src="${product.image}" alt="${product.name}" class="product-image"
                     onerror="this.src='https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&h=600&q=80'">
                ${product.tags && product.tags.includes('popular') ? 
                    '<span class="badge badge-gold" style="position: absolute; top: 12px; left: 12px;">Popular</span>' : ''}
            </div>
            <div class="card-body">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.25rem; margin: 0;">${product.name}</h3>
                    <div style="text-align: right;">
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
                    <button class="btn btn-primary" onclick="viewProductDetails('${product.id}')" style="flex: 1;">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn btn-outline" onclick="orderProduct('${product.id}')" style="flex: 1;">
                        <i class="fas fa-shopping-cart"></i> Order
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function clearFilters() {
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

function viewProductDetails(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const modal = document.getElementById('productModal');
    const modalName = document.getElementById('modalProductName');
    const modalContent = document.getElementById('modalProductContent');
    
    if (!modal || !modalName || !modalContent) return;
    
    modalName.textContent = product.name;
    
    modalContent.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <div>
                <img src="${product.image}" alt="${product.name}" 
                     style="width: 100%; border-radius: var(--radius-lg); margin-bottom: 1rem;"
                     onerror="this.src='https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&h=800&q=80'">
                
                <div style="display: flex; gap: 1rem;">
                    <div style="flex: 1; text-align: center; padding: 1rem; background: var(--wood-light); border-radius: var(--radius-md);">
                        <div style="font-size: 0.875rem; color: var(--brown-medium);">Category</div>
                        <div style="font-weight: 600;">${product.category}</div>
                    </div>
                    <div style="flex: 1; text-align: center; padding: 1rem; background: var(--wood-light); border-radius: var(--radius-md);">
                        <div style="font-size: 0.875rem; color: var(--brown-medium);">Material</div>
                        <div style="font-weight: 600;">${product.material}</div>
                    </div>
                    <div style="flex: 1; text-align: center; padding: 1rem; background: var(--wood-light); border-radius: var(--radius-md);">
                        <div style="font-size: 0.875rem; color: var(--brown-medium);">SKU</div>
                        <div style="font-weight: 600;">${product.sku}</div>
                    </div>
                </div>
            </div>
            
            <div>
                <div style="margin-bottom: 2rem;">
                    <h2 style="margin-bottom: 1rem;">${product.name}</h2>
                    <div style="font-size: 2rem; color: var(--wood-dark); font-weight: 700; margin-bottom: 1.5rem;">
                        $${product.basePrice.toFixed(2)}
                    </div>
                    <p style="color: var(--brown-medium); line-height: 1.6;">
                        ${product.description}
                    </p>
                </div>
                
                <div style="margin-bottom: 2rem;">
                    <h4 style="margin-bottom: 1rem;">Specifications</h4>
                    <div style="display: grid; gap: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--wood-light);">
                            <span style="color: var(--brown-medium);">Dimensions</span>
                            <span style="font-weight: 600;">${product.dimensions}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--wood-light);">
                            <span style="color: var(--brown-medium);">Material</span>
                            <span style="font-weight: 600;">${product.material}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--wood-light);">
                            <span style="color: var(--brown-medium);">Category</span>
                            <span style="font-weight: 600;">${product.category}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--wood-light);">
                            <span style="color: var(--brown-medium);">SKU</span>
                            <span style="font-weight: 600;">${product.sku}</span>
                        </div>
                    </div>
                </div>
                
                <div style="background: var(--gold-fade); border: 1px solid var(--gold); border-radius: var(--radius-md); padding: 1.5rem;">
                    <h5 style="color: var(--gold); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-info-circle"></i> Order Information
                    </h5>
                    <p style="color: var(--brown-medium); font-size: 0.875rem; margin: 0;">
                        Price shown is the base price. Final cost may vary based on engraving complexity and customization.
                        All orders require admin approval before production begins.
                    </p>
                </div>
            </div>
        </div>
    `;
    
    const orderBtn = document.getElementById('orderProductBtn');
    if (orderBtn) {
        orderBtn.onclick = () => {
            closeProductModal();
            orderProduct(productId);
        };
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function orderProduct(productId) {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    showPage('account');
    showTab('new-order');
    
    setTimeout(() => {
        const orderForm = document.getElementById('newOrderForm');
        if (orderForm) {
            const productSelect = orderForm.querySelector('#orderProductSelect');
            if (productSelect) {
                productSelect.value = productId;
            }
        }
    }, 100);
}

// ========== ACCOUNT MANAGEMENT ==========
async function loadAccountContent() {
    if (currentUser) {
        try {
            const db = window.firebaseDb || firebase.firestore();
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                document.getElementById('profileView').innerHTML = `
                    <div>
                        <label class="form-label">Full Name</label>
                        <div class="p-md bg-wood-light rounded-md">${userData.name || 'Not set'}</div>
                    </div>
                    <div>
                        <label class="form-label">Email Address</label>
                        <div class="p-md bg-wood-light rounded-md">${userData.email || currentUser.email}</div>
                    </div>
                    <div>
                        <label class="form-label">Phone Number</label>
                        <div class="p-md bg-wood-light rounded-md">${userData.phone || 'Not provided'}</div>
                    </div>
                    <div>
                        <label class="form-label">Address</label>
                        <div class="p-md bg-wood-light rounded-md">${userData.address || 'Not provided'}</div>
                    </div>
                `;
                
                document.getElementById('editName').value = userData.name || '';
                document.getElementById('editEmail').value = userData.email || currentUser.email;
                document.getElementById('editPhone').value = userData.phone || '';
                document.getElementById('editAddress').value = userData.address || '';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    loadUserOrders();
    initNewOrderForm();
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const tab = document.getElementById(tabId + 'Tab');
    if (tab) {
        tab.classList.add('active');
    }
    
    const tabBtn = Array.from(document.querySelectorAll('.tab')).find(btn => 
        btn.textContent.toLowerCase().includes(tabId.toLowerCase())
    );
    if (tabBtn) {
        tabBtn.classList.add('active');
    }
}

function editProfile() {
    document.getElementById('profileView').classList.add('hidden');
    document.getElementById('profileEditForm').classList.remove('hidden');
}

async function saveProfile() {
    const name = document.getElementById('editName').value;
    const phone = document.getElementById('editPhone').value;
    const address = document.getElementById('editAddress').value;
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        await db.collection('users').doc(currentUser.uid).update({
            name: name,
            phone: phone,
            address: address,
            updatedAt: new Date().toISOString()
        });
        
        showAlert('Profile updated successfully!', 'success');
        cancelEdit();
        loadAccountContent();
    } catch (error) {
        showAlert('Error updating profile: ' + error.message, 'error');
    }
}

function cancelEdit() {
    document.getElementById('profileView').classList.remove('hidden');
    document.getElementById('profileEditForm').classList.add('hidden');
}

async function loadUserOrders() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    
    const db = window.firebaseDb || firebase.firestore();
    db.collection('orders')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            ordersList.innerHTML = '';

            if (snapshot.empty) {
                ordersList.innerHTML = `
                    <div class="text-center p-xl">
                        <i class="fas fa-box-open text-4xl text-wood-light mb-lg"></i>
                        <h3 class="text-brown-dark mb-sm">No orders yet</h3>
                        <p class="text-brown-medium mb-lg">Your order history will appear here once you place your first order</p>
                        <button class="btn btn-primary" onclick="showTab('new-order')">
                            Place Your First Order
                        </button>
                    </div>`;
                return;
            }

            snapshot.forEach(doc => {
                const order = doc.data();
                const statusClass = order.status === 'completed' ? 'badge-success' : 
                                  order.status === 'approved' ? 'badge-primary' : 
                                  order.status === 'pending' ? 'badge-warning' : 'badge-error';
                
                const orderElement = document.createElement('div');
                orderElement.className = 'border border-wood-medium rounded-lg p-lg mb-md';
                orderElement.innerHTML = `
                    <div class="flex justify-between items-start mb-md">
                        <div>
                            <h4 class="font-semibold">${doc.id.substring(0,8)}...</h4>
                            <p class="text-sm text-brown-light">${new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div class="text-right">
                            <span class="badge ${statusClass}">${order.status.toUpperCase()}</span>
                            <div class="font-bold text-lg mt-xs">$${(order.totalAmount || 0).toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="flex justify-between items-center">
                        <p class="font-medium">${order.productName || 'Custom Request'}</p>
                        <button class="btn btn-outline btn-sm">Details</button>
                    </div>`;
                ordersList.appendChild(orderElement);
            });
        }, (error) => {
            console.error("Listener failed: ", error);
        });
}

// ========== ADMIN DASHBOARD ==========
async function loadAdminContent() {
    await loadAdminOrders();
    loadAdminStats();
    showAdminTab('overview');
}

function showAdminTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const tab = document.getElementById(tabId + 'Tab');
    if (tab) {
        tab.classList.add('active');
    }
    
    const tabBtn = Array.from(document.querySelectorAll('.tab')).find(btn => 
        btn.textContent.toLowerCase().includes(tabId.toLowerCase())
    );
    if (tabBtn) {
        tabBtn.classList.add('active');
    }
    
    switch(tabId) {
        case 'overview':
            loadOverviewTab();
            break;
        case 'orders':
            loadOrdersTab();
            break;
        case 'manage-products':
            loadManageProductsTab();
            break;
        case 'messages':
            loadMessagesTab();
            break;
        case 'users':
            loadUsersTab();
            break;
        case 'analytics':
            loadAnalyticsTab();
            break;
    // ... existing hide/active logic ...
    
    switch(tabId) {
        case 'overview':
            loadOverviewTab();
            break;
        case 'orders':
            loadOrdersTab();
            break;
        case 'manage-products': // ADD THIS CASE
            loadManageProductsTab();
            break;
        case 'messages':
            loadMessagesTab();
            break;
        // ... rest of cases ...
    }
}
}

async function loadAdminOrders() {
    const db = window.firebaseDb || firebase.firestore();
    db.collection('orders')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            loadAdminStats();
            
            const adminPage = document.getElementById('admin');
            if (adminPage && adminPage.classList.contains('active')) {
                const activeTab = document.querySelector('#admin .tab.active');
                if (activeTab) {
                    const tabName = activeTab.textContent.toLowerCase();
                    if (tabName.includes('overview')) loadOverviewTab();
                    if (tabName.includes('orders')) displayAdminOrders(orders);
                }
            }
        }, (error) => {
            console.error("Admin listener failed: ", error);
        });
}

function loadAdminStats() {
    const stats = {
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        totalRevenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        totalUsers: 0
    };
    
    window.adminStats = stats;
}

function loadOverviewTab() {
    const tab = document.getElementById('overviewTab');
    if (!tab || !window.adminStats) return;
    
    const stats = window.adminStats;
    
    tab.innerHTML = `
        <div class="space-y-lg">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
                <div class="card p-lg">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-brown-light text-sm mb-xs">Total Orders</p>
                            <p class="text-3xl font-bold">${stats.totalOrders}</p>
                        </div>
                        <div class="w-12 h-12 bg-wood-light rounded-lg flex items-center justify-center">
                            <i class="fas fa-shopping-cart text-wood-dark text-xl"></i>
                        </div>
                    </div>
                </div>
                
                <div class="card p-lg">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-brown-light text-sm mb-xs">Pending Orders</p>
                            <p class="text-3xl font-bold">${stats.pendingOrders}</p>
                        </div>
                        <div class="w-12 h-12 bg-gold-fade rounded-lg flex items-center justify-center">
                            <i class="fas fa-clock text-gold text-xl"></i>
                        </div>
                    </div>
                </div>
                
                <div class="card p-lg">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-brown-light text-sm mb-xs">Total Revenue</p>
                            <p class="text-3xl font-bold">$${stats.totalRevenue.toFixed(2)}</p>
                        </div>
                        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-dollar-sign text-green-600 text-xl"></i>
                        </div>
                    </div>
                </div>
                
                <div class="card p-lg">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-brown-light text-sm mb-xs">Total Users</p>
                            <p class="text-3xl font-bold">${stats.totalUsers}</p>
                        </div>
                        <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-users text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card p-lg">
                <h3 class="mb-md">Recent Orders</h3>
                <div class="space-y-md">
                    ${orders.slice(0, 5).map(order => `
                        <div class="flex justify-between items-center p-md bg-wood-light rounded-lg border border-wood-medium">
                            <div class="flex-1">
                                <div class="flex items-center gap-sm mb-xs">
                                    <p class="font-medium">${order.id || 'N/A'}</p>
                                    <span class="badge ${order.status === 'completed' ? 'badge-success' : 
                                                     order.status === 'approved' ? 'badge-primary' : 
                                                     order.status === 'pending' ? 'badge-warning' : 'badge-error'}">
                                        ${order.status || 'pending'}
                                    </span>
                                </div>
                                <p class="text-sm text-brown-medium">
                                    ${order.userName || 'Customer'} • ${order.productName || 'Custom Order'}
                                </p>
                            </div>
                            <p class="font-bold">$${(order.totalAmount || 0).toFixed(2)}</p>
                        </div>
                    `).join('')}
                    
                    ${orders.length === 0 ? `
                        <div class="text-center p-lg">
                            <p class="text-brown-medium">No orders yet</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function loadManageProductsTab() {
    const listContainer = document.getElementById('adminProductList');
    if (!listContainer) return;

    listContainer.innerHTML = products.map(p => `
        <div class="card p-md border border-wood-medium flex justify-between items-center mb-sm">
            <div class="flex items-center gap-md">
                <img src="${p.image || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">
                <div>
                    <h4 class="font-bold">${p.name}</h4>
                    <p class="text-sm text-brown-medium">${p.category} | $${p.basePrice}</p>
                </div>
            </div>
            <button class="btn btn-error btn-sm" onclick="deleteProduct('${p.id}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `).join('');

    const form = document.getElementById('addProductForm');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const newProd = {
                name: document.getElementById('prodName').value,
                basePrice: parseFloat(document.getElementById('prodPrice').value),
                category: document.getElementById('prodCategory').value,
                material: document.getElementById('prodMaterial').value,
                sku: document.getElementById('prodSKU').value,
                dimensions: document.getElementById('prodDim').value,
                description: document.getElementById('prodDesc').value,
                image: document.getElementById('prodImage').value || 'https://via.placeholder.com/300',
                createdAt: new Date().toISOString()
            };

            try {
                const db = window.firebaseDb || firebase.firestore();
                await db.collection('products').add(newProd);
                showAlert("Product added to catalog!", "success");
                e.target.reset();
            } catch (err) {
                showAlert("Error: " + err.message, "error");
            }
        };
    }
}

async function deleteProduct(id) {
    if (confirm("Permanently delete this product from the store?")) {
        try {
            const db = window.firebaseDb || firebase.firestore();
            await db.collection('products').doc(id).delete();
            showAlert("Product removed.", "info");
        } catch (err) {
            showAlert("Error: " + err.message, "error");
        }
    }
}

// ========== UTILITY FUNCTIONS ==========
function showAlert(message, type = 'info') {
    const existingAlert = document.querySelector('.global-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alert = document.createElement('div');
    alert.className = `global-alert alert alert-${type}`;
    alert.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    alert.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ${message}
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    const auth = window.firebaseAuth || firebase.auth();
    if (auth) {
        auth.onAuthStateChanged((user) => {
            currentUser = user;
            if (user) {
                const db = window.firebaseDb || firebase.firestore();
                db.collection('users').doc(user.uid).get()
                    .then(doc => {
                        if (doc.exists) {
                            currentUserRole = doc.data().role || 'user';
                        }
                        updateNavigation();
                    })
                    .catch(() => {
                        currentUserRole = 'user';
                        updateNavigation();
                    });
            } else {
                currentUserRole = 'user';
                updateNavigation();
            }
        });
    }
    
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        showPage(hash);
    } else {
        showPage('home');
    }
    
    setupEventListeners();
});

function setupEventListeners() {
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
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeProductModal();
            closeAuthModal();
        }
    });
    
    document.getElementById('productModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            closeProductModal();
        }
    });
    
    document.getElementById('authModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            closeAuthModal();
        }
    });
}

// ========== GLOBAL EXPORTS ==========
window.showPage = showPage;
window.showTab = showTab;
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.editProfile = editProfile;
window.saveProfile = saveProfile;
window.cancelEdit = cancelEdit;
window.viewProductDetails = viewProductDetails;
window.closeProductModal = closeProductModal;
window.orderProduct = orderProduct;
window.clearFilters = clearFilters;
window.logout = logout;
window.toggleMobileMenu = toggleMobileMenu;
window.showAdminTab = showAdminTab;
window.deleteProduct = deleteProduct;

console.log('Favored & Guided Engraving App initialized - New Theme');