// app.js - COMPLETE JavaScript for Favored & Guided Engraving

// ========== GLOBAL STATE ==========
let currentUser = null;
let currentUserRole = 'user';
let products = [];
let orders = [];
let conversations = [];
let currentConversationId = null;
let currentOrderStep = 1;
let selectedProduct = null;
let selectedOrderType = 'pre-listed';
let selectedOrdersForBulkAction = new Set();

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
    
    // Add floating chat button if not exists
    if (!document.getElementById('floatingChatButton')) {
        initFloatingChat();
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
                <div id="loginError" class="alert alert-error hidden"></div>
                
                <div class="form-group">
                    <label for="loginEmail" class="form-label">Email Address</label>
                    <input type="email" id="loginEmail" class="form-control" placeholder="you@example.com" required>
                </div>

                <div class="form-group">
                    <label for="loginPassword" class="form-label">Password</label>
                    <div class="password-input">
                        <input type="password" id="loginPassword" class="form-control" placeholder="••••••••" required>
                        <button type="button" class="password-toggle" onclick="togglePassword('loginPassword')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
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
                
                <div class="or-divider">
                    <span>or continue with</span>
                </div>
                
                <div class="social-login-buttons">
                    <button type="button" class="btn-social btn-google" onclick="signInWithGoogle()">
                        <i class="fab fa-google"></i> Google
                    </button>
                    <button type="button" class="btn-social btn-facebook" onclick="signInWithFacebook()">
                        <i class="fab fa-facebook-f"></i> Facebook
                    </button>
                </div>
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
                    <label for="signupName" class="form-label">Full Name *</label>
                    <input type="text" id="signupName" class="form-control" placeholder="Dela Cruz" required>
                </div>

                <div class="form-group">
                    <label for="signupEmail" class="form-label">Email Address *</label>
                    <input type="email" id="signupEmail" class="form-control" placeholder="you@example.com" required>
                </div>

                <div class="form-group">
                    <label for="signupPassword" class="form-label">Password *</label>
                    <div class="password-input">
                        <input type="password" id="signupPassword" class="form-control" placeholder="••••••••" required>
                        <button type="button" class="password-toggle" onclick="togglePassword('signupPassword')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                    <div class="form-text">Must be at least 6 characters</div>
                </div>

                <div class="form-group">
                    <label for="signupConfirmPassword" class="form-label">Confirm Password *</label>
                    <div class="password-input">
                        <input type="password" id="signupConfirmPassword" class="form-control" placeholder="••••••••" required>
                        <button type="button" class="password-toggle" onclick="togglePassword('signupConfirmPassword')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
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
                
                <div class="or-divider">
                    <span>or continue with</span>
                </div>
                
                <div class="social-login-buttons">
                    <button type="button" class="btn-social btn-google" onclick="signInWithGoogle()">
                        <i class="fab fa-google"></i> Google
                    </button>
                    <button type="button" class="btn-social btn-facebook" onclick="signInWithFacebook()">
                        <i class="fab fa-facebook-f"></i> Facebook
                    </button>
                </div>
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
        
        setTimeout(() => {
            const signupForm = document.getElementById('signupForm');
            if (signupForm) {
                signupForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    const name = document.getElementById('signupName').value;
                    const email = document.getElementById('signupEmail').value;
                    const password = document.getElementById('signupPassword').value;
                    const confirmPassword = document.getElementById('signupConfirmPassword').value;
                    
                    // Validation
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        showAlert('Please enter a valid email address', 'error');
                        return;
                    }
                    
                    if (password.length < 6) {
                        showAlert('Password must be at least 6 characters', 'error');
                        return;
                    }
                    
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
    } else if (type === 'reset') {
        modalTitle.textContent = 'Reset Password';
        modalBody.innerHTML = `
            <form id="resetForm" class="space-y-lg">
                <div id="resetError" class="alert alert-error hidden"></div>
                
                <div class="form-group">
                    <label for="resetEmail" class="form-label">Email Address</label>
                    <input type="email" id="resetEmail" class="form-control" placeholder="you@example.com" required>
                </div>

                <button type="submit" class="btn btn-primary btn-block">
                    Send Reset Link
                </button>
            </form>

            <div class="mt-lg text-center">
                <p class="text-sm text-brown-medium">
                    Remember your password?
                    <a href="#" class="text-gold font-medium" onclick="showAuthModal('login')">
                        Back to login
                    </a>
                </p>
            </div>
        `;
        
        setTimeout(() => {
            const resetForm = document.getElementById('resetForm');
            if (resetForm) {
                resetForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    const email = document.getElementById('resetEmail').value;
                    await resetPassword(email);
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

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggleBtn = input.parentElement.querySelector('.password-toggle i');
    
    if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.classList.remove('fa-eye');
        toggleBtn.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        toggleBtn.classList.remove('fa-eye-slash');
        toggleBtn.classList.add('fa-eye');
    }
}

// ========== AUTHENTICATION ==========
async function login(email, password) {
    try {
        showLoading();
        const auth = window.firebaseAuth || firebase.auth();
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        const db = window.firebaseDb || firebase.firestore();
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            currentUserRole = userDoc.data().role || 'user';
        } else {
            // Create user document if it doesn't exist
            await db.collection('users').doc(currentUser.uid).set({
                name: currentUser.displayName || email.split('@')[0],
                email: email,
                role: 'user',
                createdAt: new Date().toISOString(),
                phone: '',
                address: ''
            });
            currentUserRole = 'user';
        }
        
        hideLoading();
        showAlert('Welcome back! You are now signed in.', 'success');
        
        // Special handling for admin login
        if (email === 'admin@favoredandguided.com') {
            await db.collection('users').doc(currentUser.uid).update({
                role: 'admin'
            });
            currentUserRole = 'admin';
        }
        
        if (currentUserRole === 'admin') {
            showPage('admin');
        } else {
            showPage('account');
        }
        
        return true;
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
        return false;
    }
}

async function signup(name, email, password) {
    try {
        showLoading();
        const auth = window.firebaseAuth || firebase.auth();
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        const db = window.firebaseDb || firebase.firestore();
        await db.collection('users').doc(currentUser.uid).set({
            name: name,
            email: email,
            role: 'user',
            createdAt: new Date().toISOString(),
            phone: '',
            address: '',
            updatedAt: new Date().toISOString()
        });
        
        // Update user profile
        await currentUser.updateProfile({
            displayName: name
        });
        
        currentUserRole = 'user';
        hideLoading();
        showAlert('Account created successfully! Welcome to Favored & Guided.', 'success');
        showPage('account');
        
        return true;
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
        return false;
    }
}

async function resetPassword(email) {
    try {
        showLoading();
        const auth = window.firebaseAuth || firebase.auth();
        await auth.sendPasswordResetEmail(email);
        hideLoading();
        showAlert('Password reset email sent! Check your inbox.', 'success');
        showAuthModal('login');
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
    }
}

async function logout() {
    try {
        const auth = window.firebaseAuth || firebase.auth();
        await auth.signOut();
        currentUser = null;
        currentUserRole = 'user';
        selectedOrdersForBulkAction.clear();
        
        showAlert('You have been signed out. Come back soon!', 'info');
        showPage('home');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// ========== SOCIAL LOGIN ==========
async function signInWithGoogle() {
    try {
        showLoading();
        const provider = new firebase.auth.GoogleAuthProvider();
        const auth = window.firebaseAuth || firebase.auth();
        const result = await auth.signInWithPopup(provider);
        
        const user = result.user;
        const db = window.firebaseDb || firebase.firestore();
        
        // Check if user exists
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            // Create new user
            await db.collection('users').doc(user.uid).set({
                name: user.displayName,
                email: user.email,
                role: 'user',
                createdAt: new Date().toISOString(),
                phone: '',
                address: '',
                updatedAt: new Date().toISOString()
            });
        }
        
        currentUser = user;
        currentUserRole = userDoc.exists ? userDoc.data().role : 'user';
        
        hideLoading();
        showAlert('Signed in with Google successfully!', 'success');
        closeAuthModal();
        
        if (currentUserRole === 'admin') {
            showPage('admin');
        } else {
            showPage('account');
        }
        
    } catch (error) {
        hideLoading();
        showAlert('Google sign-in failed: ' + error.message, 'error');
    }
}

async function signInWithFacebook() {
    try {
        showLoading();
        const provider = new firebase.auth.FacebookAuthProvider();
        provider.addScope('email');
        
        const auth = window.firebaseAuth || firebase.auth();
        const result = await auth.signInWithPopup(provider);
        
        const user = result.user;
        const db = window.firebaseDb || firebase.firestore();
        
        // Check if user exists
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            // Create new user
            await db.collection('users').doc(user.uid).set({
                name: user.displayName,
                email: user.email,
                role: 'user',
                createdAt: new Date().toISOString(),
                phone: '',
                address: '',
                updatedAt: new Date().toISOString()
            });
        }
        
        currentUser = user;
        currentUserRole = userDoc.exists ? userDoc.data().role : 'user';
        
        hideLoading();
        showAlert('Signed in with Facebook successfully!', 'success');
        closeAuthModal();
        
        if (currentUserRole === 'admin') {
            showPage('admin');
        } else {
            showPage('account');
        }
        
    } catch (error) {
        hideLoading();
        showAlert('Facebook sign-in failed: ' + error.message, 'error');
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
        const db = window.firebaseDb || firebase.firestore();
        // Use real-time sync for products
        db.collection('products').onSnapshot((snapshot) => {
            if (!snapshot.empty) {
                products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } else {
                products = getSampleProducts();
                // Add sample products to Firestore if empty
                addSampleProductsToFirestore();
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
            tags: ['popular', 'award'],
            isVisible: true
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
            tags: ['gift', 'jewelry'],
            isVisible: true
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
            tags: ['wood', 'professional'],
            isVisible: true
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
            tags: ['gift', 'keychain'],
            isVisible: true
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
            tags: ['home', 'kitchen', 'wood'],
            isVisible: true
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
            tags: ['glass', 'elegant', 'award'],
            isVisible: true
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
            <div class="product-image-container">
                <img src="${product.image}" alt="${product.name}" class="product-image"
                    onerror="this.src='https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&h=600&q=80'">
                ${product.tags && product.tags.includes('popular') ? 
                    '<span class="product-badge">Popular</span>' : ''}
                <button class="quick-view-btn" onclick="viewProductDetails('${product.id}')">
                    <i class="fas fa-eye mr-xs"></i> Quick View
                </button>
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
                        <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--wood-light);">
                            <span style="color: var(--brown-medium);">Status</span>
                            <span class="badge ${product.isVisible ? 'badge-success' : 'badge-error'}">
                                ${product.isVisible ? 'Visible' : 'Hidden'}
                            </span>
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
        selectedOrderType = 'pre-listed';
        selectedProduct = products.find(p => p.id === productId);
        currentOrderStep = 1;
        initNewOrderForm();
        
        // Auto-select the product
        const productSelect = document.getElementById('orderProductSelect');
        if (productSelect) {
            productSelect.value = productId;
        }
    }, 100);
}

// ========== ACCOUNT MANAGEMENT ==========
async function loadAccountContent() {
    showTab('profile');
    
    if (currentUser) {
        try {
            const db = window.firebaseDb || firebase.firestore();
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                document.getElementById('profileView').innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
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
                    </div>
                    <div class="mt-lg">
                        <label class="form-label">Account Created</label>
                        <div class="p-md bg-wood-light rounded-md">
                            ${userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            }) : 'Not available'}
                        </div>
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
    loadChatTab();
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
    
    // Load tab content if needed
    if (tabId === 'orders') {
        loadUserOrders();
    } else if (tabId === 'new-order') {
        initNewOrderForm();
    } else if (tabId === 'chat') {
        loadChatTab();
    }
}

function editProfile() {
    document.getElementById('profileView').classList.add('hidden');
    document.getElementById('profileEditForm').classList.remove('hidden');
}

async function saveProfile() {
    const name = document.getElementById('editName').value;
    const email = document.getElementById('editEmail').value;
    const phone = document.getElementById('editPhone').value;
    const address = document.getElementById('editAddress').value;
    
    if (!name.trim()) {
        showAlert('Name is required', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        showLoading();
        const db = window.firebaseDb || firebase.firestore();
        await db.collection('users').doc(currentUser.uid).update({
            name: name,
            email: email,
            phone: phone,
            address: address,
            updatedAt: new Date().toISOString()
        });
        
        // Update auth email if changed
        if (email !== currentUser.email) {
            await currentUser.updateEmail(email);
        }
        
        // Update profile name
        await currentUser.updateProfile({
            displayName: name
        });
        
        hideLoading();
        showAlert('Profile updated successfully!', 'success');
        cancelEdit();
        loadAccountContent();
    } catch (error) {
        hideLoading();
        showAlert('Error updating profile: ' + error.message, 'error');
    }
}

function cancelEdit() {
    document.getElementById('profileView').classList.remove('hidden');
    document.getElementById('profileEditForm').classList.add('hidden');
}

// ========== NEW ORDER SYSTEM ==========
function initNewOrderForm() {
    const newOrderTab = document.getElementById('newOrderTab');
    if (!newOrderTab) return;
    
    newOrderTab.innerHTML = `
        <div class="card p-xl">
            <h2 class="mb-lg">Place New Order</h2>
            <div id="newOrderFormContent">
                ${renderOrderStepper()}
                ${renderOrderStep()}
            </div>
        </div>
    `;
    
    if (currentOrderStep === 2) {
        loadProductSelect();
    }
}

function renderOrderStepper() {
    return `
        <div class="order-stepper">
            <div class="stepper">
                <div class="stepper-step ${currentOrderStep >= 1 ? 'active' : ''}">
                    <div class="stepper-number">1</div>
                    <div class="stepper-label">Order Type</div>
                </div>
                <div class="stepper-line"></div>
                <div class="stepper-step ${currentOrderStep >= 2 ? 'active' : ''}">
                    <div class="stepper-number">2</div>
                    <div class="stepper-label">Details</div>
                </div>
                <div class="stepper-line"></div>
                <div class="stepper-step ${currentOrderStep >= 3 ? 'active' : ''}">
                    <div class="stepper-number">3</div>
                    <div class="stepper-label">Review</div>
                </div>
                <div class="stepper-line"></div>
                <div class="stepper-step ${currentOrderStep >= 4 ? 'active' : ''}">
                    <div class="stepper-number">4</div>
                    <div class="stepper-label">Submit</div>
                </div>
            </div>
        </div>
    `;
}

function renderOrderStep() {
    switch(currentOrderStep) {
        case 1:
            return renderStep1();
        case 2:
            return renderStep2();
        case 3:
            return renderStep3();
        case 4:
            return renderStep4();
        default:
            return renderStep1();
    }
}

function renderStep1() {
    return `
        <div id="orderStep1" class="order-step active">
            <h3 class="mb-md">Select Order Type</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-md mb-lg">
                <div class="order-type-card ${selectedOrderType === 'pre-listed' ? 'selected' : ''}" 
                     onclick="selectOrderType('pre-listed')">
                    <div class="order-type-icon">
                        <i class="fas fa-list"></i>
                    </div>
                    <h4>Pre-Listed Item</h4>
                    <p class="text-sm text-brown-medium">Choose from our catalog of premium items</p>
                    <ul class="text-xs text-brown-light mt-sm">
                        <li>• Fast ordering process</li>
                        <li>• Pre-defined pricing</li>
                        <li>• Quality guaranteed</li>
                    </ul>
                </div>
                
                <div class="order-type-card ${selectedOrderType === 'custom' ? 'selected' : ''}"
                     onclick="selectOrderType('custom')">
                    <div class="order-type-icon">
                        <i class="fas fa-pencil-ruler"></i>
                    </div>
                    <h4>Custom Request</h4>
                    <p class="text-sm text-brown-medium">Design your own unique item</p>
                    <ul class="text-xs text-brown-light mt-sm">
                        <li>• Fully customizable</li>
                        <li>• Personal consultation</li>
                        <li>• Unique designs</li>
                    </ul>
                </div>
            </div>
            
            <div class="flex justify-end">
                <button class="btn btn-primary" onclick="nextOrderStep()">
                    Next <i class="fas fa-arrow-right ml-sm"></i>
                </button>
            </div>
        </div>
    `;
}

function renderStep2() {
    if (selectedOrderType === 'pre-listed') {
        return `
            <div id="orderStep2" class="order-step active">
                <h3 class="mb-md">Order Details</h3>
                <form id="orderDetailsForm" class="space-y-md">
                    <div class="form-group">
                        <label class="form-label">Select Product *</label>
                        <select id="orderProductSelect" class="form-control" required>
                            <option value="">Choose a product...</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Engraving Text *</label>
                        <textarea id="engravingText" class="form-control" rows="2" 
                                  placeholder="Enter text to engrave (required)" required></textarea>
                        <div class="form-text">Maximum 100 characters</div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Additional Notes (Optional)</label>
                        <textarea id="orderNotes" class="form-control" rows="3" 
                                  placeholder="Any special instructions, font preferences, or design requests..."></textarea>
                    </div>
                </form>
                
                <div class="flex justify-between mt-lg">
                    <button class="btn btn-outline" onclick="prevOrderStep()">
                        <i class="fas fa-arrow-left mr-sm"></i> Back
                    </button>
                    <button class="btn btn-primary" onclick="nextOrderStep()">
                        Review Order <i class="fas fa-arrow-right ml-sm"></i>
                    </button>
                </div>
            </div>
        `;
    } else {
        return `
            <div id="orderStep2" class="order-step active">
                <h3 class="mb-md">Custom Request Details</h3>
                <form id="orderDetailsForm" class="space-y-md">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
                        <div class="form-group">
                            <label class="form-label">Description *</label>
                            <textarea id="customDescription" class="form-control" rows="3" 
                                      placeholder="Describe what you want created..." required></textarea>
                            <div class="form-text">Be as detailed as possible</div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Material *</label>
                            <select id="customMaterial" class="form-control" required>
                                <option value="">Select material...</option>
                                <option value="Wood">Wood</option>
                                <option value="Metal">Metal</option>
                                <option value="Glass">Glass</option>
                                <option value="Stone">Stone</option>
                                <option value="Acrylic">Acrylic</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
                        <div class="form-group">
                            <label class="form-label">Dimensions (Optional)</label>
                            <input type="text" id="customDimensions" class="form-control" 
                                   placeholder="e.g., 10&quot; x 8&quot; x 2&quot;">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Engraving Text (Optional)</label>
                            <input type="text" id="customEngraving" class="form-control" 
                                   placeholder="Text to engrave (if any)">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Additional Notes</label>
                        <textarea id="customNotes" class="form-control" rows="2" 
                                  placeholder="Any special requirements, design ideas, or reference images description..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Reference Image (Optional)</label>
                        <div class="file-upload">
                            <input type="file" id="customImage" class="form-control" accept="image/*" 
                                   onchange="previewImage(this)">
                            <div class="form-text">Upload an image for reference (Max 5MB, JPG/PNG)</div>
                            <div id="imagePreview" class="mt-sm hidden"></div>
                        </div>
                    </div>
                </form>
                
                <div class="flex justify-between mt-lg">
                    <button class="btn btn-outline" onclick="prevOrderStep()">
                        <i class="fas fa-arrow-left mr-sm"></i> Back
                    </button>
                    <button class="btn btn-primary" onclick="nextOrderStep()">
                        Review Order <i class="fas fa-arrow-right ml-sm"></i>
                    </button>
                </div>
            </div>
        `;
    }
}

function renderStep3() {
    return `
        <div id="orderStep3" class="order-step active">
            <h3 class="mb-md">Review Order</h3>
            <div id="orderSummary" class="card p-lg mb-lg">
                <!-- Order summary will be dynamically filled -->
            </div>
            
            <div class="bg-gold-fade p-md rounded-md border border-gold mb-lg">
                <h5 class="mb-sm"><i class="fas fa-info-circle mr-sm"></i> Important Information</h5>
                <p class="text-sm text-brown-medium mb-xs">
                    • All orders require admin approval before production begins
                </p>
                <p class="text-sm text-brown-medium mb-xs">
                    • You'll receive notifications about your order status
                </p>
                <p class="text-sm text-brown-medium">
                    • Contact support if you need to make changes after submission
                </p>
            </div>
            
            <div class="flex justify-between">
                <button class="btn btn-outline" onclick="prevOrderStep()">
                    <i class="fas fa-arrow-left mr-sm"></i> Back
                </button>
                <button class="btn btn-gold" onclick="submitOrder()">
                    <i class="fas fa-check-circle mr-sm"></i> Submit for Approval
                </button>
            </div>
        </div>
    `;
}

function renderStep4() {
    return `
        <div id="orderStep4" class="order-step active">
            <div class="text-center p-xl">
                <div class="success-icon mb-lg">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h3 class="mb-md">Order Submitted Successfully!</h3>
                <p class="text-brown-medium mb-lg">
                    Your order has been submitted for admin approval. 
                    You'll receive a notification once it's reviewed.
                </p>
                <div class="badge badge-warning mb-lg">Status: Pending Approval</div>
                <p class="text-sm text-brown-light mb-lg">
                    Order ID: <span id="submittedOrderId"></span>
                </p>
                <div class="flex justify-center gap-sm">
                    <button class="btn btn-outline" onclick="resetOrderForm()">
                        Place Another Order
                    </button>
                    <button class="btn btn-primary" onclick="showTab('orders')">
                        View Order History
                    </button>
                </div>
            </div>
        </div>
    `;
}

function selectOrderType(type) {
    selectedOrderType = type;
    selectedProduct = null;
    initNewOrderForm();
}

function loadProductSelect() {
    const select = document.getElementById('orderProductSelect');
    if (!select) return;
    
    // Filter only visible products
    const visibleProducts = products.filter(p => p.isVisible);
    
    select.innerHTML = '<option value="">Choose a product...</option>' +
        visibleProducts.map(p => 
            `<option value="${p.id}" ${selectedProduct?.id === p.id ? 'selected' : ''}>
                ${p.name} - $${p.basePrice.toFixed(2)}
            </option>`
        ).join('');
    
    select.addEventListener('change', function() {
        const productId = this.value;
        if (productId) {
            selectedProduct = products.find(p => p.id === productId);
        } else {
            selectedProduct = null;
        }
    });
}

function previewImage(input) {
    const preview = document.getElementById('imagePreview');
    if (!preview) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            showAlert('File size must be less than 5MB', 'error');
            input.value = '';
            preview.classList.add('hidden');
            return;
        }
        
        // Validate file type
        if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
            showAlert('Only JPG and PNG images are allowed', 'error');
            input.value = '';
            preview.classList.add('hidden');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <div class="image-preview-container">
                    <img src="${e.target.result}" alt="Preview" class="image-preview">
                    <button type="button" class="btn btn-error btn-xs" onclick="removeImagePreview()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function removeImagePreview() {
    const input = document.getElementById('customImage');
    const preview = document.getElementById('imagePreview');
    
    if (input) input.value = '';
    if (preview) {
        preview.innerHTML = '';
        preview.classList.add('hidden');
    }
}

function nextOrderStep() {
    if (currentOrderStep === 1) {
        if (!selectedOrderType) {
            showAlert('Please select an order type', 'error');
            return;
        }
        currentOrderStep++;
        initNewOrderForm();
        
    } else if (currentOrderStep === 2) {
        // Validate step 2
        if (selectedOrderType === 'pre-listed') {
            const productSelect = document.getElementById('orderProductSelect');
            const engravingText = document.getElementById('engravingText');
            
            if (!productSelect?.value) {
                showAlert('Please select a product', 'error');
                return;
            }
            if (!engravingText?.value.trim()) {
                showAlert('Engraving text is required', 'error');
                return;
            }
            if (engravingText.value.length > 100) {
                showAlert('Engraving text must be 100 characters or less', 'error');
                return;
            }
            
            selectedProduct = products.find(p => p.id === productSelect.value);
            
        } else {
            const description = document.getElementById('customDescription');
            const material = document.getElementById('customMaterial');
            
            if (!description?.value.trim()) {
                showAlert('Description is required', 'error');
                return;
            }
            if (!material?.value) {
                showAlert('Material selection is required', 'error');
                return;
            }
        }
        
        currentOrderStep++;
        initNewOrderForm();
        updateOrderSummary();
        
    } else if (currentOrderStep === 3) {
        // Submit will be handled by submitOrder()
        return;
    }
}

function prevOrderStep() {
    if (currentOrderStep > 1) {
        currentOrderStep--;
        initNewOrderForm();
    }
}

function updateOrderSummary() {
    const summaryDiv = document.getElementById('orderSummary');
    if (!summaryDiv) return;
    
    let summaryHTML = '<div class="space-y-md">';
    
    if (selectedOrderType === 'pre-listed' && selectedProduct) {
        const engravingText = document.getElementById('engravingText')?.value || '';
        const notes = document.getElementById('orderNotes')?.value || '';
        
        summaryHTML += `
            <div class="flex justify-between items-center mb-md">
                <div>
                    <h4 class="font-bold">${selectedProduct.name}</h4>
                    <p class="text-sm text-brown-medium">${selectedProduct.category} • ${selectedProduct.material}</p>
                </div>
                <div class="text-right">
                    <div class="text-xl font-bold text-wood-dark">$${selectedProduct.basePrice.toFixed(2)}</div>
                    <div class="text-sm text-brown-light">Base Price</div>
                </div>
            </div>
            
            <div class="border-t border-wood-medium pt-md space-y-sm">
                <div>
                    <strong>Order Type:</strong>
                    <span class="badge badge-primary ml-sm">Pre-Listed Item</span>
                </div>
                <div>
                    <strong>Engraving Text:</strong>
                    <p class="mt-xs italic bg-wood-light p-sm rounded">"${engravingText}"</p>
                </div>
                ${notes ? `
                    <div>
                        <strong>Additional Notes:</strong>
                        <p class="mt-xs bg-wood-light p-sm rounded">${notes}</p>
                    </div>
                ` : ''}
            </div>
            
            <div class="bg-gold-fade p-md rounded-md border border-gold mt-md">
                <div class="flex justify-between items-center">
                    <span class="font-bold">Estimated Total:</span>
                    <span class="text-xl font-bold">$${(selectedProduct.basePrice).toFixed(2)}</span>
                </div>
                <p class="text-xs text-brown-light mt-xs">* Final price may vary based on engraving complexity</p>
            </div>
        `;
    } else {
        const description = document.getElementById('customDescription')?.value || '';
        const material = document.getElementById('customMaterial')?.value || '';
        const dimensions = document.getElementById('customDimensions')?.value || '';
        const engraving = document.getElementById('customEngraving')?.value || '';
        const notes = document.getElementById('customNotes')?.value || '';
        
        summaryHTML += `
            <div class="mb-md">
                <h4 class="font-bold">Custom Request</h4>
                <span class="badge badge-gold mt-xs">Custom Design</span>
            </div>
            
            <div class="border-t border-wood-medium pt-md space-y-sm">
                <div>
                    <strong>Description:</strong>
                    <p class="mt-xs bg-wood-light p-sm rounded">${description}</p>
                </div>
                <div>
                    <strong>Material:</strong>
                    <p class="mt-xs">${material}</p>
                </div>
                ${dimensions ? `
                    <div>
                        <strong>Dimensions:</strong>
                        <p class="mt-xs">${dimensions}</p>
                    </div>
                ` : ''}
                ${engraving ? `
                    <div>
                        <strong>Engraving Text:</strong>
                        <p class="mt-xs italic bg-wood-light p-sm rounded">"${engraving}"</p>
                    </div>
                ` : ''}
                ${notes ? `
                    <div>
                        <strong>Additional Notes:</strong>
                        <p class="mt-xs bg-wood-light p-sm rounded">${notes}</p>
                    </div>
                ` : ''}
            </div>
            
            <div class="bg-gold-fade p-md rounded-md border border-gold mt-md">
                <div class="flex justify-between items-center">
                    <span class="font-bold">Price Estimate:</span>
                    <span class="text-xl font-bold">Custom Quote Required</span>
                </div>
                <p class="text-xs text-brown-light mt-xs">* Admin will provide a quote after reviewing your request</p>
            </div>
        `;
    }
    
    summaryHTML += '</div>';
    summaryDiv.innerHTML = summaryHTML;
}

async function submitOrder() {
    try {
        if (!currentUser) {
            showAlert('Please login to place an order', 'error');
            showAuthModal('login');
            return;
        }
        
        showLoading();
        const db = window.firebaseDb || firebase.firestore();
        
        // Generate order ID
        const timestamp = new Date();
        const year = timestamp.getFullYear();
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const orderCount = await getOrderCount();
        const orderId = `ORD-${year}${month}-${String(orderCount + 1).padStart(3, '0')}`;
        
        let orderData = {
            orderId: orderId,
            userId: currentUser.uid,
            userName: currentUser.displayName || (await getUserName()),
            userEmail: currentUser.email,
            status: 'pending',
            createdAt: timestamp.toISOString(),
            updatedAt: timestamp.toISOString(),
            orderType: selectedOrderType
        };
        
        if (selectedOrderType === 'pre-listed' && selectedProduct) {
            orderData.productId = selectedProduct.id;
            orderData.productName = selectedProduct.name;
            orderData.basePrice = selectedProduct.basePrice;
            orderData.engravingText = document.getElementById('engravingText')?.value || '';
            orderData.notes = document.getElementById('orderNotes')?.value || '';
            orderData.totalAmount = selectedProduct.basePrice;
            orderData.category = selectedProduct.category;
            orderData.material = selectedProduct.material;
            orderData.dimensions = selectedProduct.dimensions;
            orderData.imageUrl = selectedProduct.image;
        } else {
            orderData.description = document.getElementById('customDescription')?.value || '';
            orderData.material = document.getElementById('customMaterial')?.value || '';
            orderData.dimensions = document.getElementById('customDimensions')?.value || '';
            orderData.engravingText = document.getElementById('customEngraving')?.value || '';
            orderData.notes = document.getElementById('customNotes')?.value || '';
            orderData.productName = 'Custom Request';
            orderData.totalAmount = 0; // To be quoted by admin
            orderData.category = 'Custom';
            
            // Handle file upload
            const fileInput = document.getElementById('customImage');
            if (fileInput?.files[0]) {
                const file = fileInput.files[0];
                const storage = window.firebaseStorage || firebase.storage();
                const storageRef = storage.ref();
                const fileRef = storageRef.child(`order-images/${orderId}/${file.name}`);
                
                await fileRef.put(file);
                const downloadURL = await fileRef.getDownloadURL();
                orderData.imageUrl = downloadURL;
            }
        }
        
        // Save to Firestore
        await db.collection('orders').doc(orderId).set(orderData);
        
        // Show confirmation
        currentOrderStep = 4;
        initNewOrderForm();
        document.getElementById('submittedOrderId').textContent = orderId;
        
        hideLoading();
        showAlert('Order submitted successfully! It is now pending admin approval.', 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Error submitting order:', error);
        showAlert('Failed to submit order: ' + error.message, 'error');
    }
}

async function getOrderCount() {
    try {
        const db = window.firebaseDb || firebase.firestore();
        const snapshot = await db.collection('orders').count().get();
        return snapshot.data().count;
    } catch (error) {
        console.error('Error getting order count:', error);
        return 0;
    }
}

async function getUserName() {
    try {
        const db = window.firebaseDb || firebase.firestore();
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        return userDoc.exists ? userDoc.data().name : currentUser.email.split('@')[0];
    } catch {
        return currentUser.email.split('@')[0];
    }
}

function resetOrderForm() {
    currentOrderStep = 1;
    selectedProduct = null;
    selectedOrderType = 'pre-listed';
    initNewOrderForm();
}

// ========== ORDER HISTORY ==========
async function loadUserOrders() {
    const ordersTab = document.getElementById('ordersTab');
    if (!ordersTab) return;
    
    ordersTab.innerHTML = `
        <div class="card p-xl">
            <div class="flex justify-between items-center mb-lg">
                <h2>Order History</h2>
                <div class="flex gap-sm">
                    <select id="orderStatusFilter" class="form-control form-control-sm" onchange="filterUserOrders()">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="in-progress">In Progress</option>
                        <option value="needs-clarification">Needs Clarification</option>
                        <option value="rejected">Rejected</option>
                        <option value="completed">Completed</option>
                    </select>
                    <input type="text" id="orderSearch" class="form-control form-control-sm" 
                           placeholder="Search orders..." oninput="filterUserOrders()">
                </div>
            </div>
            <div id="ordersListContent" class="space-y-md"></div>
        </div>
    `;
    
    filterUserOrders();
}

async function filterUserOrders() {
    const statusFilter = document.getElementById('orderStatusFilter')?.value || '';
    const searchTerm = document.getElementById('orderSearch')?.value.toLowerCase() || '';
    const container = document.getElementById('ordersListContent');
    
    if (!container) return;
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        let query = db.collection('orders').where('userId', '==', currentUser.uid);
        
        if (statusFilter) {
            query = query.where('status', '==', statusFilter);
        }
        
        query = query.orderBy('createdAt', 'desc');
        
        const snapshot = await query.get();
        
        let orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Apply search filter
        if (searchTerm) {
            orders = orders.filter(order =>
                order.orderId.toLowerCase().includes(searchTerm) ||
                order.productName.toLowerCase().includes(searchTerm) ||
                (order.engravingText && order.engravingText.toLowerCase().includes(searchTerm))
            );
        }
        
        displayUserOrders(orders);
        
    } catch (error) {
        console.error('Error loading orders:', error);
        container.innerHTML = `
            <div class="text-center p-xl">
                <i class="fas fa-exclamation-triangle text-4xl text-wood-light mb-lg"></i>
                <h3 class="text-brown-dark mb-sm">Error Loading Orders</h3>
                <p class="text-brown-medium mb-lg">${error.message}</p>
            </div>`;
    }
}

function displayUserOrders(orders) {
    const container = document.getElementById('ordersListContent');
    if (!container) return;
    
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center p-xl">
                <i class="fas fa-box-open text-4xl text-wood-light mb-lg"></i>
                <h3 class="text-brown-dark mb-sm">No orders found</h3>
                <p class="text-brown-medium mb-lg">${document.getElementById('orderStatusFilter')?.value || document.getElementById('orderSearch')?.value ? 
                    'Try adjusting your filters' : 
                    'Your order history will appear here once you place your first order'}</p>
                ${!document.getElementById('orderStatusFilter')?.value && !document.getElementById('orderSearch')?.value ? `
                    <button class="btn btn-primary" onclick="showTab('new-order')">
                        Place Your First Order
                    </button>
                ` : ''}
            </div>`;
        return;
    }
    
    container.innerHTML = orders.map(order => {
        const statusConfig = getStatusConfig(order.status);
        const date = new Date(order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        return `
            <div class="card border border-wood-medium p-md hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-md">
                    <div>
                        <div class="flex items-center gap-sm mb-xs">
                            <h4 class="mb-0 font-mono">${order.orderId}</h4>
                            <span class="status-badge ${statusConfig.class}">
                                <i class="fas ${statusConfig.icon} mr-xs"></i> ${order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('-', ' ')}
                            </span>
                        </div>
                        <p class="text-sm text-brown-light">
                            <i class="far fa-calendar mr-xs"></i>Placed on ${date}
                        </p>
                        ${order.estimatedCompletion ? 
                            `<p class="text-sm text-gold mt-xs">
                                <i class="far fa-calendar-check mr-xs"></i> 
                                Estimated completion: ${new Date(order.estimatedCompletion).toLocaleDateString()}
                            </p>` : ''
                        }
                    </div>
                    <div class="text-right">
                        <div class="text-xl font-bold text-wood-dark">
                            ${order.totalAmount > 0 ? '$' + order.totalAmount.toFixed(2) : 'Quote Required'}
                        </div>
                        <div class="text-sm text-brown-light">
                            ${order.orderType === 'pre-listed' ? 'Catalog Item' : 'Custom Request'}
                        </div>
                    </div>
                </div>
                
                <div class="mb-md">
                    <p class="font-medium mb-xs">
                        <i class="fas ${order.orderType === 'pre-listed' ? 'fa-box' : 'fa-pencil-ruler'} mr-xs"></i>
                        ${order.productName}
                    </p>
                    ${order.engravingText ? `
                        <p class="text-sm text-brown-medium italic mt-xs">
                            <i class="fas fa-quote-left mr-xs"></i>
                            "${order.engravingText.substring(0, 80)}${order.engravingText.length > 80 ? '...' : ''}"
                        </p>
                    ` : ''}
                    ${order.description ? `
                        <p class="text-sm text-brown-medium mt-xs">
                            ${order.description.substring(0, 100)}${order.description.length > 100 ? '...' : ''}
                        </p>
                    ` : ''}
                </div>
                
                <div class="flex justify-between items-center pt-md border-t border-wood-light">
                    <div>
                        ${statusConfig.message ? `
                            <p class="text-sm text-brown-medium">
                                <i class="fas fa-info-circle mr-xs"></i>
                                ${statusConfig.message}
                            </p>
                        ` : ''}
                    </div>
                    <div class="flex gap-xs">
                        ${order.status === 'needs-clarification' ? `
                            <button class="btn btn-gold btn-sm" onclick="openChatForOrder('${order.id}')">
                                <i class="fas fa-comment mr-xs"></i> Respond
                            </button>
                        ` : ''}
                        <button class="btn btn-outline btn-sm" onclick="viewOrderDetails('${order.id}', true)">
                            <i class="fas fa-eye mr-xs"></i> Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusConfig(status) {
    const configs = {
        'pending': {
            class: 'status-pending',
            icon: 'fa-clock',
            message: 'Your order is currently under review by our team.'
        },
        'approved': {
            class: 'status-approved',
            icon: 'fa-check-circle',
            message: 'Your order has been approved and will start production soon.'
        },
        'in-progress': {
            class: 'status-in-progress',
            icon: 'fa-tools',
            message: 'Your order is currently being crafted.'
        },
        'needs-clarification': {
            class: 'status-needs-clarification',
            icon: 'fa-exclamation-circle',
            message: 'We need additional information. Please respond to the message.'
        },
        'rejected': {
            class: 'status-rejected',
            icon: 'fa-times-circle',
            message: 'This order could not be processed. Contact support for details.'
        },
        'completed': {
            class: 'status-completed',
            icon: 'fa-check-circle',
            message: 'Your order has been completed and is ready for pickup/delivery.'
        }
    };
    
    return configs[status] || configs.pending;
}

async function viewOrderDetails(orderId, isUser = false) {
    try {
        const db = window.firebaseDb || firebase.firestore();
        const orderDoc = await db.collection('orders').doc(orderId).get();
        
        if (!orderDoc.exists) {
            showAlert('Order not found', 'error');
            return;
        }
        
        const order = orderDoc.data();
        const statusConfig = getStatusConfig(order.status);
        
        let modalContent = `
            <div class="space-y-lg">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="mb-sm">Order Details</h3>
                        <p class="text-brown-medium">${order.orderId}</p>
                    </div>
                    <div class="text-right">
                        <span class="status-badge ${statusConfig.class}">
                            <i class="fas ${statusConfig.icon}"></i> ${order.status}
                        </span>
                        <div class="text-xl font-bold text-wood-dark mt-xs">
                            ${order.totalAmount > 0 ? '$' + order.totalAmount.toFixed(2) : 'Quote Required'}
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
                    <div>
                        <h4 class="mb-sm">Order Information</h4>
                        <div class="space-y-sm">
                            <div>
                                <strong>Order Type:</strong>
                                <span class="badge ${order.orderType === 'pre-listed' ? 'badge-primary' : 'badge-gold'} ml-sm">
                                    ${order.orderType === 'pre-listed' ? 'Pre-Listed Item' : 'Custom Request'}
                                </span>
                            </div>
                            <div>
                                <strong>Product:</strong>
                                <p class="mt-xs">${order.productName}</p>
                            </div>
                            <div>
                                <strong>Ordered On:</strong>
                                <p class="mt-xs">${new Date(order.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}</p>
                            </div>
                            ${order.estimatedCompletion ? `
                                <div>
                                    <strong>Estimated Completion:</strong>
                                    <p class="mt-xs text-gold">${new Date(order.estimatedCompletion).toLocaleDateString()}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="mb-sm">Customer Information</h4>
                        <div class="space-y-sm">
                            <div>
                                <strong>Name:</strong>
                                <p class="mt-xs">${order.userName}</p>
                            </div>
                            <div>
                                <strong>Email:</strong>
                                <p class="mt-xs">${order.userEmail}</p>
                            </div>
                        </div>
                    </div>
                </div>
        `;
        
        if (order.engravingText) {
            modalContent += `
                <div>
                    <h4 class="mb-sm">Engraving Details</h4>
                    <div class="bg-wood-light p-md rounded-md">
                        <p class="italic">"${order.engravingText}"</p>
                    </div>
                </div>
            `;
        }
        
        if (order.description || order.material || order.dimensions) {
            modalContent += `
                <div>
                    <h4 class="mb-sm">Product Specifications</h4>
                    <div class="space-y-sm">
                        ${order.description ? `
                            <div>
                                <strong>Description:</strong>
                                <p class="mt-xs">${order.description}</p>
                            </div>
                        ` : ''}
                        ${order.material ? `
                            <div>
                                <strong>Material:</strong>
                                <p class="mt-xs">${order.material}</p>
                            </div>
                        ` : ''}
                        ${order.dimensions ? `
                            <div>
                                <strong>Dimensions:</strong>
                                <p class="mt-xs">${order.dimensions}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        if (order.notes) {
            modalContent += `
                <div>
                    <h4 class="mb-sm">Additional Notes</h4>
                    <div class="bg-wood-light p-md rounded-md">
                        <p>${order.notes}</p>
                    </div>
                </div>
            `;
        }
        
        if (order.imageUrl && order.imageUrl !== selectedProduct?.image) {
            modalContent += `
                <div>
                    <h4 class="mb-sm">Reference Image</h4>
                    <img src="${order.imageUrl}" alt="Reference Image" class="w-full rounded-md">
                </div>
            `;
        }
        
        modalContent += `
                <div class="flex justify-end gap-sm">
                    ${isUser && order.status === 'needs-clarification' ? `
                        <button class="btn btn-gold" onclick="openChatForOrder('${orderId}')">
                            <i class="fas fa-comment mr-sm"></i> Respond
                        </button>
                    ` : ''}
                    ${!isUser && currentUserRole === 'admin' ? `
                        <div class="flex gap-sm">
                            <button class="btn btn-outline" onclick="updateOrderStatus('${orderId}', 'approved')">
                                Approve
                            </button>
                            <button class="btn btn-outline" onclick="updateOrderStatus('${orderId}', 'rejected')">
                                Reject
                            </button>
                            <button class="btn btn-outline" onclick="updateOrderStatus('${orderId}', 'needs-clarification')">
                                Needs Info
                            </button>
                        </div>
                    ` : ''}
                    <button class="btn btn-primary" onclick="closeModal()">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        showCustomModal('Order Details', modalContent);
        
    } catch (error) {
        console.error('Error loading order details:', error);
        showAlert('Error loading order details: ' + error.message, 'error');
    }
}

// ========== CHAT SYSTEM ==========
function initFloatingChat() {
    const chatButton = document.createElement('div');
    chatButton.id = 'floatingChatButton';
    chatButton.className = 'floating-chat-button';
    chatButton.innerHTML = '<i class="fas fa-comment"></i>';
    chatButton.onclick = openChat;
    document.body.appendChild(chatButton);
}

function openChat() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'chatModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; height: 80vh;">
            <div class="modal-header">
                <h3>
                    <i class="fas fa-comments mr-sm"></i>
                    ${currentUserRole === 'admin' ? 'Customer Support' : 'Support Chat'}
                </h3>
                <button class="btn btn-sm" onclick="closeChatModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="modal-body" style="padding: 0; display: flex; flex-direction: column; height: calc(100% - 60px);">
                ${currentUserRole === 'admin' ? renderAdminChat() : renderUserChat()}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    if (currentUserRole === 'admin') {
        loadAdminConversations();
    } else {
        loadUserChat();
    }
}

function renderAdminChat() {
    return `
        <div style="display: flex; height: 100%;">
            <div class="chat-sidebar">
                <div class="p-md border-b border-wood-medium">
                    <h4 class="mb-sm">Conversations</h4>
                    <input type="text" id="chatSearch" class="form-control form-control-sm" placeholder="Search...">
                </div>
                <div id="chatConversations" class="p-sm" style="overflow-y: auto; height: calc(100% - 100px);">
                    <!-- Conversations will load here -->
                </div>
            </div>
            <div class="chat-main" style="flex: 1; display: flex; flex-direction: column;">
                <div id="chatMessages" class="chat-messages" style="flex: 1; overflow-y: auto;"></div>
                <div class="chat-input">
                    <div class="flex gap-sm">
                        <input type="text" id="chatInput" class="form-control" placeholder="Type your message..." 
                               onkeypress="if(event.key === 'Enter') sendAdminMessage()">
                        <button class="btn btn-primary" onclick="sendAdminMessage()">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderUserChat() {
    return `
        <div style="display: flex; flex-direction: column; height: 100%;">
            <div class="tabs" style="margin: 0;">
                <ul class="tab-list">
                    <li><button class="tab active" onclick="switchChatTab('faq')">FAQ</button></li>
                    <li><button class="tab" onclick="switchChatTab('chat')">Live Chat</button></li>
                </ul>
            </div>
            
            <div id="faqTab" class="tab-content active" style="flex: 1; overflow-y: auto; padding: var(--space-lg);">
                <div class="space-y-md">
                    <div class="faq-item">
                        <h4>How long does an order take?</h4>
                        <p class="text-brown-medium">Pre-listed items: 3-5 business days. Custom requests: 7-14 business days depending on complexity.</p>
                    </div>
                    <div class="faq-item">
                        <h4>Can I change my order after submission?</h4>
                        <p class="text-brown-medium">Changes can be made within 24 hours of submission if production hasn't started. Contact support immediately.</p>
                    </div>
                    <div class="faq-item">
                        <h4>What payment methods do you accept?</h4>
                        <p class="text-brown-medium">We accept credit cards, PayPal, and bank transfers. Payment is required after order approval.</p>
                    </div>
                    <div class="faq-item">
                        <h4>Do you offer refunds?</h4>
                        <p class="text-brown-medium">Refunds are available for unstarted orders. Custom items may have restocking fees. See our refund policy for details.</p>
                    </div>
                    <div class="faq-item">
                        <h4>How do I track my order status?</h4>
                        <p class="text-brown-medium">Check your order history in the account section. You'll receive email notifications for status updates.</p>
                    </div>
                    <div class="faq-item">
                        <h4>Can I request a custom design?</h4>
                        <p class="text-brown-medium">Yes! Select "Custom Request" when placing an order and provide as many details as possible.</p>
                    </div>
                </div>
            </div>
            
            <div id="chatTab" class="tab-content" style="display: none; flex: 1; flex-direction: column;">
                <div id="userChatMessages" class="chat-messages" style="flex: 1; overflow-y: auto;"></div>
                <div class="chat-input">
                    <div class="flex gap-sm">
                        <input type="text" id="userChatInput" class="form-control" placeholder="Type your message..."
                               onkeypress="if(event.key === 'Enter') sendUserMessage()">
                        <button class="btn btn-primary" onclick="sendUserMessage()">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function closeChatModal() {
    const modal = document.getElementById('chatModal');
    if (modal) {
        modal.remove();
    }
}

function switchChatTab(tabId) {
    document.querySelectorAll('#chatModal .tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });
    
    document.querySelectorAll('#chatModal .tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const tab = document.getElementById(tabId + 'Tab');
    const tabBtn = Array.from(document.querySelectorAll('#chatModal .tab')).find(btn => 
        btn.textContent.toLowerCase().includes(tabId.toLowerCase())
    );
    
    if (tab) {
        tab.classList.add('active');
        tab.style.display = 'flex';
    }
    
    if (tabBtn) {
        tabBtn.classList.add('active');
    }
    
    if (tabId === 'chat') {
        loadUserChat();
    }
}

async function loadAdminConversations() {
    const db = window.firebaseDb || firebase.firestore();
    const conversationsRef = db.collection('conversations');
    
    conversationsRef.orderBy('lastUpdated', 'desc').onSnapshot(async (snapshot) => {
        const conversationsDiv = document.getElementById('chatConversations');
        if (!conversationsDiv) return;
        
        conversationsDiv.innerHTML = '';
        
        for (const doc of snapshot.docs) {
            const conv = doc.data();
            const userDoc = await db.collection('users').doc(conv.userId).get();
            const userName = userDoc.exists ? userDoc.data().name : 'Customer';
            
            conversationsDiv.innerHTML += `
                <div class="conversation-item ${currentConversationId === doc.id ? 'active' : ''}"
                     onclick="loadConversation('${doc.id}', '${conv.userId}')">
                    <div class="flex justify-between items-center">
                        <div class="font-medium truncate" style="max-width: 150px;">${userName}</div>
                        <div class="text-xs text-brown-light">
                            ${new Date(conv.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                    <p class="text-sm text-brown-medium truncate" style="max-width: 200px;">
                        ${conv.lastMessage || 'No messages yet'}
                    </p>
                    ${conv.unreadCount > 0 ? 
                        `<span class="badge badge-error badge-xs">${conv.unreadCount}</span>` : ''}
                </div>
            `;
        }
    });
}

async function loadConversation(conversationId, userId) {
    currentConversationId = conversationId;
    
    const db = window.firebaseDb || firebase.firestore();
    const messagesRef = db.collection('messages')
        .where('conversationId', '==', conversationId)
        .orderBy('timestamp', 'asc');
    
    messagesRef.onSnapshot((snapshot) => {
        const messagesDiv = document.getElementById('chatMessages');
        if (!messagesDiv) return;
        
        messagesDiv.innerHTML = '';
        
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isAdmin = msg.senderId === 'admin';
            const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            messagesDiv.innerHTML += `
                <div class="message ${isAdmin ? 'message-admin' : 'message-user'}">
                    <div class="flex justify-between items-start mb-xs">
                        <div class="font-medium">${isAdmin ? 'You' : 'Customer'}</div>
                        <div class="text-xs text-brown-light">${time}</div>
                    </div>
                    <p>${msg.text}</p>
                </div>
            `;
        });
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
    
    // Mark as read
    await db.collection('conversations').doc(conversationId).update({
        unreadCount: 0
    });
}

async function sendAdminMessage() {
    const input = document.getElementById('chatInput');
    const text = input?.value.trim();
    
    if (!text || !currentConversationId) {
        showAlert('Please select a conversation first', 'warning');
        return;
    }
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        
        await db.collection('messages').add({
            conversationId: currentConversationId,
            senderId: 'admin',
            text: text,
            timestamp: new Date().toISOString()
        });
        
        await db.collection('conversations').doc(currentConversationId).update({
            lastMessage: text,
            lastUpdated: new Date().toISOString(),
            unreadCount: firebase.firestore.FieldValue.increment(1)
        });
        
        input.value = '';
        
    } catch (error) {
        console.error('Error sending message:', error);
        showAlert('Failed to send message: ' + error.message, 'error');
    }
}

async function loadUserChat() {
    const messagesDiv = document.getElementById('userChatMessages');
    if (!messagesDiv) return;
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        
        // Find or create conversation
        let conversationQuery = await db.collection('conversations')
            .where('userId', '==', currentUser.uid)
            .limit(1)
            .get();
        
        let conversationId;
        
        if (conversationQuery.empty) {
            const convRef = await db.collection('conversations').add({
                userId: currentUser.uid,
                lastMessage: '',
                lastUpdated: new Date().toISOString(),
                unreadCount: 0
            });
            conversationId = convRef.id;
        } else {
            conversationId = conversationQuery.docs[0].id;
        }
        
        currentConversationId = conversationId;
        
        // Load messages
        const messagesRef = db.collection('messages')
            .where('conversationId', '==', conversationId)
            .orderBy('timestamp', 'asc');
        
        messagesRef.onSnapshot((snapshot) => {
            messagesDiv.innerHTML = '';
            
            if (snapshot.empty) {
                messagesDiv.innerHTML = `
                    <div class="text-center p-lg">
                        <i class="fas fa-comments text-3xl text-wood-light mb-sm"></i>
                        <p class="text-brown-medium">Start a conversation with our support team</p>
                    </div>
                `;
                return;
            }
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                const isUser = msg.senderId !== 'admin';
                const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                messagesDiv.innerHTML += `
                    <div class="message ${isUser ? 'message-user' : 'message-admin'}">
                        <div class="flex justify-between items-start mb-xs">
                            <div class="font-medium">${isUser ? 'You' : 'Support Agent'}</div>
                            <div class="text-xs text-brown-light">${time}</div>
                        </div>
                        <p>${msg.text}</p>
                    </div>
                `;
            });
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
        
    } catch (error) {
        console.error('Error loading chat:', error);
        messagesDiv.innerHTML = `
            <div class="text-center p-lg">
                <i class="fas fa-exclamation-triangle text-3xl text-wood-light mb-sm"></i>
                <p class="text-brown-medium">Error loading chat: ${error.message}</p>
            </div>
        `;
    }
}

async function sendUserMessage() {
    const input = document.getElementById('userChatInput');
    const text = input?.value.trim();
    
    if (!text) return;
    
    if (!currentConversationId) {
        showAlert('Please wait while we set up your chat', 'warning');
        return;
    }
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        
        await db.collection('messages').add({
            conversationId: currentConversationId,
            senderId: currentUser.uid,
            text: text,
            timestamp: new Date().toISOString()
        });
        
        await db.collection('conversations').doc(currentConversationId).update({
            lastMessage: text,
            lastUpdated: new Date().toISOString(),
            unreadCount: firebase.firestore.FieldValue.increment(1)
        });
        
        input.value = '';
        
    } catch (error) {
        console.error('Error sending message:', error);
        showAlert('Failed to send message: ' + error.message, 'error');
    }
}

function openChatForOrder(orderId) {
    openChat();
    
    // Set a timeout to ensure chat is loaded
    setTimeout(() => {
        const input = document.getElementById('userChatInput');
        if (input) {
            input.value = `Regarding order ${orderId}: `;
            input.focus();
        }
    }, 500);
}

// ========== ADMIN DASHBOARD ==========
async function loadAdminContent() {
    showAdminTab('overview');
}

function showAdminTab(tabId) {
    document.querySelectorAll('#admin .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('#admin .tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const tab = document.getElementById(tabId + 'Tab');
    if (tab) {
        tab.classList.add('active');
    }
    
    const tabBtn = Array.from(document.querySelectorAll('#admin .tab')).find(btn => 
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
    }
}

async function loadOverviewTab() {
    const tab = document.getElementById('overviewTab');
    if (!tab) return;
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        
        // Get stats
        const ordersSnapshot = await db.collection('orders').get();
        const usersSnapshot = await db.collection('users').get();
        
        const orders = ordersSnapshot.docs.map(doc => doc.data());
        const users = usersSnapshot.docs.map(doc => doc.data());
        
        const stats = {
            totalOrders: orders.length,
            pendingOrders: orders.filter(o => o.status === 'pending').length,
            totalRevenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
            totalUsers: users.length,
            completedOrders: orders.filter(o => o.status === 'completed').length,
            inProgressOrders: orders.filter(o => o.status === 'in-progress').length
        };
        
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
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg">
                    <div class="card p-lg">
                        <h3 class="mb-md">Recent Orders</h3>
                        <div class="space-y-md" style="max-height: 400px; overflow-y: auto;">
                            ${orders.slice(0, 10).map(order => `
                                <div class="flex justify-between items-center p-md bg-wood-light rounded-lg border border-wood-medium hover:shadow-sm transition-shadow">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-sm mb-xs">
                                            <p class="font-medium font-mono">${order.orderId}</p>
                                            <span class="status-badge ${getStatusConfig(order.status).class}">
                                                ${order.status}
                                            </span>
                                        </div>
                                        <p class="text-sm text-brown-medium truncate">
                                            ${order.userName} • ${order.productName}
                                        </p>
                                    </div>
                                    <div class="text-right">
                                        <p class="font-bold">$${(order.totalAmount || 0).toFixed(2)}</p>
                                        <p class="text-xs text-brown-light">
                                            ${new Date(order.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            `).join('')}
                            
                            ${orders.length === 0 ? `
                                <div class="text-center p-lg">
                                    <p class="text-brown-medium">No orders yet</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="card p-lg">
                        <h3 class="mb-md">Quick Actions</h3>
                        <div class="space-y-sm">
                            <button class="btn btn-primary btn-block" onclick="showAdminTab('orders')">
                                <i class="fas fa-clipboard-list mr-sm"></i> Manage Orders
                            </button>
                            <button class="btn btn-outline btn-block" onclick="showAdminTab('manage-products')">
                                <i class="fas fa-boxes mr-sm"></i> Manage Products
                            </button>
                            <button class="btn btn-outline btn-block" onclick="showAdminTab('messages')">
                                <i class="fas fa-comments mr-sm"></i> View Messages
                            </button>
                            <button class="btn btn-outline btn-block" onclick="showAdminTab('users')">
                                <i class="fas fa-users mr-sm"></i> Manage Users
                            </button>
                        </div>
                        
                        <div class="mt-lg">
                            <h4 class="mb-sm">Order Status Distribution</h4>
                            <div class="space-y-xs">
                                <div class="flex justify-between">
                                    <span>Pending</span>
                                    <span class="font-bold">${stats.pendingOrders}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>In Progress</span>
                                    <span class="font-bold">${stats.inProgressOrders}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Completed</span>
                                    <span class="font-bold">${stats.completedOrders}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading overview:', error);
        tab.innerHTML = `
            <div class="text-center p-xl">
                <i class="fas fa-exclamation-triangle text-4xl text-wood-light mb-lg"></i>
                <h3 class="text-brown-dark mb-sm">Error Loading Dashboard</h3>
                <p class="text-brown-medium">${error.message}</p>
            </div>
        `;
    }
}

async function loadOrdersTab() {
    const tab = document.getElementById('ordersTabAdmin');
    if (!tab) return;
    
    tab.innerHTML = `
        <div class="card p-lg">
            <div class="flex justify-between items-center mb-lg">
                <h2>Order Management</h2>
                <div class="flex gap-sm">
                    <select id="adminOrderFilter" class="form-control form-control-sm" onchange="filterAdminOrders()">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="in-progress">In Progress</option>
                        <option value="needs-clarification">Needs Clarification</option>
                        <option value="rejected">Rejected</option>
                        <option value="completed">Completed</option>
                    </select>
                    <input type="text" id="adminOrderSearch" class="form-control form-control-sm" 
                           placeholder="Search by ID, name, email..." oninput="filterAdminOrders()">
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="selectAllOrders" onchange="toggleAllOrders(this.checked)"></th>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Product</th>
                            <th>Engraving</th>
                            <th>Type</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="adminOrdersTable">
                        <!-- Orders will be populated here -->
                    </tbody>
                </table>
            </div>
            
            <div class="flex justify-between items-center mt-lg">
                <div id="selectedCount" class="text-sm text-brown-medium">0 orders selected</div>
                <div class="flex gap-sm">
                    <select id="bulkAction" class="form-control form-control-sm">
                        <option value="">Bulk Action</option>
                        <option value="approve">Approve Selected</option>
                        <option value="reject">Reject Selected</option>
                        <option value="start-work">Start Work</option>
                        <option value="complete">Mark Complete</option>
                        <option value="needs-clarification">Needs Clarification</option>
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="applyBulkAction()">
                        Apply
                    </button>
                </div>
            </div>
        </div>
    `;
    
    filterAdminOrders();
}

async function filterAdminOrders() {
    const statusFilter = document.getElementById('adminOrderFilter')?.value || '';
    const searchTerm = document.getElementById('adminOrderSearch')?.value.toLowerCase() || '';
    const tbody = document.getElementById('adminOrdersTable');
    
    if (!tbody) return;
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        let query = db.collection('orders');
        
        if (statusFilter) {
            query = query.where('status', '==', statusFilter);
        }
        
        query = query.orderBy('createdAt', 'desc');
        
        const snapshot = await query.get();
        
        let orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Apply search filter
        if (searchTerm) {
            orders = orders.filter(order =>
                order.orderId.toLowerCase().includes(searchTerm) ||
                order.userName.toLowerCase().includes(searchTerm) ||
                order.userEmail.toLowerCase().includes(searchTerm) ||
                order.productName.toLowerCase().includes(searchTerm)
            );
        }
        
        displayAdminOrders(orders);
        
    } catch (error) {
        console.error('Error loading admin orders:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center p-lg">
                    <p class="text-brown-medium">Error loading orders: ${error.message}</p>
                </td>
            </tr>
        `;
    }
}

function displayAdminOrders(orders) {
    const tbody = document.getElementById('adminOrdersTable');
    if (!tbody) return;
    
    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center p-lg">
                    <i class="fas fa-box-open text-3xl text-wood-light mb-sm"></i>
                    <p class="text-brown-medium">No orders found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = orders.map(order => {
        const statusConfig = getStatusConfig(order.status);
        const date = new Date(order.createdAt).toLocaleDateString();
        const isSelected = selectedOrdersForBulkAction.has(order.id);
        
        return `
            <tr data-order-id="${order.id}" class="${isSelected ? 'bg-gold-fade' : ''}">
                <td>
                    <input type="checkbox" class="order-checkbox" value="${order.id}" 
                           ${isSelected ? 'checked' : ''} onchange="toggleOrderSelection('${order.id}', this.checked)">
                </td>
                <td><strong class="font-mono">${order.orderId}</strong></td>
                <td>
                    <div class="text-sm font-medium">${order.userName}</div>
                    <div class="text-xs text-brown-light">${order.userEmail}</div>
                </td>
                <td>
                    <div>${order.productName}</div>
                    <div class="text-xs text-brown-light">${order.category || order.material || ''}</div>
                </td>
                <td>
                    ${order.engravingText ? 
                        `<span class="italic text-sm truncate" style="max-width: 150px; display: inline-block;" 
                              title="${order.engravingText}">"${order.engravingText.substring(0, 20)}${order.engravingText.length > 20 ? '...' : ''}"</span>` : 
                        '<span class="text-brown-light">-</span>'
                    }
                </td>
                <td>
                    <span class="badge ${order.orderType === 'pre-listed' ? 'badge-primary' : 'badge-gold'}">
                        ${order.orderType === 'pre-listed' ? 'Catalog' : 'Custom'}
                    </span>
                </td>
                <td>${date}</td>
                <td>
                    <div class="font-bold">${order.totalAmount ? '$' + order.totalAmount.toFixed(2) : 'Quote'}</div>
                </td>
                <td>
                    <span class="status-badge ${statusConfig.class}">
                        <i class="fas ${statusConfig.icon}"></i> ${order.status}
                    </span>
                </td>
                <td>
                    <div class="flex gap-xs flex-wrap">
                        ${order.status === 'pending' ? `
                            <button class="btn btn-success btn-xs" onclick="updateOrderStatus('${order.id}', 'approved')" title="Approve">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-warning btn-xs" onclick="updateOrderStatus('${order.id}', 'in-progress')" title="Start Work">
                                <i class="fas fa-tools"></i>
                            </button>
                            <button class="btn btn-error btn-xs" onclick="updateOrderStatus('${order.id}', 'rejected')" title="Reject">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                        
                        ${order.status === 'approved' ? `
                            <button class="btn btn-warning btn-xs" onclick="updateOrderStatus('${order.id}', 'in-progress')" title="Start Work">
                                <i class="fas fa-tools"></i>
                            </button>
                        ` : ''}
                        
                        ${order.status === 'in-progress' ? `
                            <button class="btn btn-success btn-xs" onclick="updateOrderStatus('${order.id}', 'completed')" title="Mark Complete">
                                <i class="fas fa-check-double"></i>
                            </button>
                        ` : ''}
                        
                        ${order.status === 'needs-clarification' ? `
                            <button class="btn btn-gold btn-xs" onclick="openChatForOrder('${order.id}')" title="Chat with Customer">
                                <i class="fas fa-comment"></i>
                            </button>
                        ` : ''}
                        
                        <button class="btn btn-outline btn-xs" onclick="viewOrderDetails('${order.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    updateSelectedCount();
}

function toggleOrderSelection(orderId, isSelected) {
    if (isSelected) {
        selectedOrdersForBulkAction.add(orderId);
    } else {
        selectedOrdersForBulkAction.delete(orderId);
    }
    updateSelectedCount();
}

function toggleAllOrders(isSelected) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        const orderId = cb.value;
        cb.checked = isSelected;
        
        if (isSelected) {
            selectedOrdersForBulkAction.add(orderId);
        } else {
            selectedOrdersForBulkAction.delete(orderId);
        }
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const countDiv = document.getElementById('selectedCount');
    if (countDiv) {
        countDiv.textContent = `${selectedOrdersForBulkAction.size} order${selectedOrdersForBulkAction.size !== 1 ? 's' : ''} selected`;
    }
}

async function applyBulkAction() {
    const action = document.getElementById('bulkAction')?.value;
    
    if (!action || selectedOrdersForBulkAction.size === 0) {
        showAlert('Please select an action and at least one order', 'warning');
        return;
    }
    
    if (!confirm(`Apply "${action}" to ${selectedOrdersForBulkAction.size} order(s)?`)) {
        return;
    }
    
    try {
        showLoading();
        const db = window.firebaseDb || firebase.firestore();
        const batch = db.batch();
        
        const newStatus = getBulkActionStatus(action);
        
        selectedOrdersForBulkAction.forEach(orderId => {
            const orderRef = db.collection('orders').doc(orderId);
            batch.update(orderRef, {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
        });
        
        await batch.commit();
        
        // Clear selection
        selectedOrdersForBulkAction.clear();
        document.getElementById('selectAllOrders').checked = false;
        updateSelectedCount();
        
        hideLoading();
        showAlert(`Updated ${selectedOrdersForBulkAction.size} order(s) to ${newStatus}`, 'success');
        
        // Refresh the table
        filterAdminOrders();
        
    } catch (error) {
        hideLoading();
        showAlert('Error updating orders: ' + error.message, 'error');
    }
}

function getBulkActionStatus(action) {
    const map = {
        'approve': 'approved',
        'reject': 'rejected',
        'start-work': 'in-progress',
        'complete': 'completed',
        'needs-clarification': 'needs-clarification'
    };
    return map[action] || 'pending';
}

async function updateOrderStatus(orderId, status) {
    if (!confirm(`Change order status to "${status}"?`)) {
        return;
    }
    
    try {
        showLoading();
        const db = window.firebaseDb || firebase.firestore();
        
        const updateData = {
            status: status,
            updatedAt: new Date().toISOString()
        };
        
        // Add estimated completion date for in-progress orders
        if (status === 'in-progress') {
            const completionDate = new Date();
            completionDate.setDate(completionDate.getDate() + 7); // 7 days from now
            updateData.estimatedCompletion = completionDate.toISOString();
        }
        
        await db.collection('orders').doc(orderId).update(updateData);
        
        hideLoading();
        showAlert(`Order status updated to ${status}`, 'success');
        
        // If status is needs-clarification, suggest opening chat
        if (status === 'needs-clarification') {
            setTimeout(() => {
                if (confirm('Would you like to message the customer about what clarification is needed?')) {
                    openChatForOrder(orderId);
                }
            }, 500);
        }
        
    } catch (error) {
        hideLoading();
        showAlert('Error updating order: ' + error.message, 'error');
    }
}

// ========== PRODUCT MANAGEMENT ==========
function loadManageProductsTab() {
    const tab = document.getElementById('manage-productsTab');
    if (!tab) return;
    
    tab.innerHTML = `
        <div class="card p-xl">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-xl">
                <div>
                    <h3 class="mb-lg">Add New Product</h3>
                    <form id="addProductForm" class="space-y-md">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
                            <div class="form-group">
                                <label class="form-label">Product Name *</label>
                                <input type="text" id="prodName" class="form-control" placeholder="e.g. Oak Award" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Base Price ($) *</label>
                                <input type="number" id="prodPrice" class="form-control" step="0.01" min="0" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Category *</label>
                                <select id="prodCategory" class="form-control" required>
                                    <option value="">Select category...</option>
                                    <option value="Awards">Awards</option>
                                    <option value="Gifts">Gifts</option>
                                    <option value="Home">Home</option>
                                    <option value="Corporate">Corporate</option>
                                    <option value="Jewelry">Jewelry</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Material *</label>
                                <select id="prodMaterial" class="form-control" required>
                                    <option value="">Select material...</option>
                                    <option value="Wood">Wood</option>
                                    <option value="Metal">Metal</option>
                                    <option value="Glass">Glass</option>
                                    <option value="Stone">Stone</option>
                                    <option value="Acrylic">Acrylic</option>
                                    <option value="Composite">Composite</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">SKU *</label>
                                <input type="text" id="prodSKU" class="form-control" required placeholder="e.g., TRP-001">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Dimensions</label>
                                <input type="text" id="prodDim" class="form-control" placeholder="e.g., 10&quot; x 8&quot;">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Description *</label>
                            <textarea id="prodDesc" class="form-control" rows="3" required></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Image URL *</label>
                            <input type="url" id="prodImage" class="form-control" placeholder="https://example.com/image.jpg" required>
                            <div class="form-text">Use a high-quality image (600x600px recommended)</div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Tags (comma separated)</label>
                            <input type="text" id="prodTags" class="form-control" placeholder="popular, award, gift">
                        </div>
                        
                        <div class="form-group">
                            <div class="flex items-center gap-xs">
                                <input type="checkbox" id="prodVisible" class="form-check-input" checked>
                                <label for="prodVisible" class="form-label" style="margin: 0; font-weight: normal;">
                                    Visible in store
                                </label>
                            </div>
                        </div>
                        
                        <button type="submit" class="btn btn-primary btn-block">
                            <i class="fas fa-plus mr-sm"></i> Add Product
                        </button>
                    </form>
                </div>
                
                <div>
                    <div class="flex justify-between items-center mb-lg">
                        <h3>Product Catalog</h3>
                        <input type="text" id="productSearch" class="form-control form-control-sm" 
                               placeholder="Search products..." style="width: 200px;" oninput="searchProducts()">
                    </div>
                    
                    <div id="adminProductList" class="space-y-md" style="max-height: 600px; overflow-y: auto;">
                        <!-- Products will be loaded here -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Set up form submission
    const form = document.getElementById('addProductForm');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await addProduct();
        };
    }
    
    loadAdminProductList();
}

async function addProduct() {
    try {
        const name = document.getElementById('prodName').value;
        const price = parseFloat(document.getElementById('prodPrice').value);
        const category = document.getElementById('prodCategory').value;
        const material = document.getElementById('prodMaterial').value;
        const sku = document.getElementById('prodSKU').value;
        const dimensions = document.getElementById('prodDim').value;
        const description = document.getElementById('prodDesc').value;
        const image = document.getElementById('prodImage').value;
        const tags = document.getElementById('prodTags').value;
        const isVisible = document.getElementById('prodVisible').checked;
        
        if (!name || !price || !category || !material || !sku || !description || !image) {
            showAlert('Please fill in all required fields', 'error');
            return;
        }
        
        if (price < 0) {
            showAlert('Price must be positive', 'error');
            return;
        }
        
        showLoading();
        const db = window.firebaseDb || firebase.firestore();
        
        const productData = {
            name: name,
            basePrice: price,
            category: category,
            material: material,
            sku: sku,
            dimensions: dimensions,
            description: description,
            image: image,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            isVisible: isVisible,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await db.collection('products').add(productData);
        
        // Reset form
        document.getElementById('addProductForm').reset();
        document.getElementById('prodVisible').checked = true;
        
        hideLoading();
        showAlert('Product added successfully!', 'success');
        
        // Refresh product list
        loadAdminProductList();
        loadProducts(); // Refresh customer view
        
    } catch (error) {
        hideLoading();
        showAlert('Error adding product: ' + error.message, 'error');
    }
}

async function loadAdminProductList() {
    const listContainer = document.getElementById('adminProductList');
    if (!listContainer) return;
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            listContainer.innerHTML = `
                <div class="text-center p-lg">
                    <i class="fas fa-box-open text-3xl text-wood-light mb-sm"></i>
                    <p class="text-brown-medium">No products found</p>
                </div>
            `;
            return;
        }
        
        listContainer.innerHTML = snapshot.docs.map(doc => {
            const product = doc.data();
            return `
                <div class="card p-md border border-wood-medium">
                    <div class="flex justify-between items-start mb-sm">
                        <div class="flex items-center gap-md flex-1">
                            <img src="${product.image || 'https://via.placeholder.com/50'}" 
                                 style="width:60px; height:60px; object-fit:cover; border-radius:var(--radius-sm);">
                            <div class="flex-1">
                                <h4 class="font-bold mb-xs">${product.name}</h4>
                                <div class="flex items-center gap-sm">
                                    <span class="badge ${product.isVisible ? 'badge-success' : 'badge-error'}">
                                        ${product.isVisible ? 'Visible' : 'Hidden'}
                                    </span>
                                    <span class="badge">${product.category}</span>
                                    <span class="badge">${product.material}</span>
                                    <span class="text-sm text-brown-light">$${product.basePrice.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-xs">
                            <button class="btn btn-outline btn-xs" onclick="editProduct('${doc.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-error btn-xs" onclick="deleteProduct('${doc.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-sm text-brown-medium mb-sm">${product.description.substring(0, 100)}...</p>
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-brown-light">SKU: ${product.sku}</div>
                        <div class="text-sm text-brown-light">${product.dimensions || 'No dimensions'}</div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading products:', error);
        listContainer.innerHTML = `
            <div class="text-center p-lg">
                <i class="fas fa-exclamation-triangle text-3xl text-wood-light mb-sm"></i>
                <p class="text-brown-medium">Error loading products: ${error.message}</p>
            </div>
        `;
    }
}

function searchProducts() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const productCards = document.querySelectorAll('#adminProductList .card');
    
    productCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function editProduct(productId) {
    try {
        const db = window.firebaseDb || firebase.firestore();
        const productDoc = await db.collection('products').doc(productId).get();
        
        if (!productDoc.exists) {
            showAlert('Product not found', 'error');
            return;
        }
        
        const product = productDoc.data();
        
        // Populate form with product data
        document.getElementById('prodName').value = product.name;
        document.getElementById('prodPrice').value = product.basePrice;
        document.getElementById('prodCategory').value = product.category;
        document.getElementById('prodMaterial').value = product.material;
        document.getElementById('prodSKU').value = product.sku;
        document.getElementById('prodDim').value = product.dimensions || '';
        document.getElementById('prodDesc').value = product.description;
        document.getElementById('prodImage').value = product.image;
        document.getElementById('prodTags').value = product.tags?.join(', ') || '';
        document.getElementById('prodVisible').checked = product.isVisible !== false;
        
        // Change form to update mode
        const form = document.getElementById('addProductForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        // Store product ID for update
        form.dataset.editingProductId = productId;
        submitBtn.innerHTML = '<i class="fas fa-save mr-sm"></i> Update Product';
        submitBtn.onclick = async (e) => {
            e.preventDefault();
            await updateProduct(productId);
        };
        
        // Scroll to form
        document.getElementById('addProductForm').scrollIntoView({ behavior: 'smooth' });
        
        showAlert('Product loaded for editing. Make changes and click "Update Product".', 'info');
        
    } catch (error) {
        showAlert('Error loading product: ' + error.message, 'error');
    }
}

async function updateProduct(productId) {
    try {
        const name = document.getElementById('prodName').value;
        const price = parseFloat(document.getElementById('prodPrice').value);
        const category = document.getElementById('prodCategory').value;
        const material = document.getElementById('prodMaterial').value;
        const sku = document.getElementById('prodSKU').value;
        const dimensions = document.getElementById('prodDim').value;
        const description = document.getElementById('prodDesc').value;
        const image = document.getElementById('prodImage').value;
        const tags = document.getElementById('prodTags').value;
        const isVisible = document.getElementById('prodVisible').checked;
        
        if (!name || !price || !category || !material || !sku || !description || !image) {
            showAlert('Please fill in all required fields', 'error');
            return;
        }
        
        if (price < 0) {
            showAlert('Price must be positive', 'error');
            return;
        }
        
        showLoading();
        const db = window.firebaseDb || firebase.firestore();
        
        const productData = {
            name: name,
            basePrice: price,
            category: category,
            material: material,
            sku: sku,
            dimensions: dimensions,
            description: description,
            image: image,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            isVisible: isVisible,
            updatedAt: new Date().toISOString()
        };
        
        await db.collection('products').doc(productId).update(productData);
        
        // Reset form to add mode
        const form = document.getElementById('addProductForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        form.reset();
        delete form.dataset.editingProductId;
        submitBtn.innerHTML = '<i class="fas fa-plus mr-sm"></i> Add Product';
        submitBtn.onclick = async (e) => {
            e.preventDefault();
            await addProduct();
        };
        
        hideLoading();
        showAlert('Product updated successfully!', 'success');
        
        // Refresh product lists
        loadAdminProductList();
        loadProducts();
        
    } catch (error) {
        hideLoading();
        showAlert('Error updating product: ' + error.message, 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading();
        const db = window.firebaseDb || firebase.firestore();
        
        await db.collection('products').doc(productId).delete();
        
        hideLoading();
        showAlert('Product deleted successfully!', 'success');
        
        // Refresh product lists
        loadAdminProductList();
        loadProducts();
        
    } catch (error) {
        hideLoading();
        showAlert('Error deleting product: ' + error.message, 'error');
    }
}

// ========== MESSAGES TAB ==========
function loadMessagesTab() {
    const tab = document.getElementById('messagesTab');
    if (!tab) return;
    
    tab.innerHTML = `
        <div class="card p-xl">
            <h2 class="mb-lg">Customer Messages</h2>
            <div id="messagesList" class="space-y-md">
                <div class="text-center p-lg">
                    <div class="loading-spinner"></div>
                    <p class="mt-md text-brown-medium">Loading messages...</p>
                </div>
            </div>
        </div>
    `;
    
    loadMessagesList();
}

async function loadMessagesList() {
    const listContainer = document.getElementById('messagesList');
    if (!listContainer) return;
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        const conversationsRef = db.collection('conversations');
        
        conversationsRef.orderBy('lastUpdated', 'desc').onSnapshot(async (snapshot) => {
            if (snapshot.empty) {
                listContainer.innerHTML = `
                    <div class="text-center p-xl">
                        <i class="fas fa-comments text-4xl text-wood-light mb-lg"></i>
                        <h3 class="text-brown-dark mb-sm">No Messages Yet</h3>
                        <p class="text-brown-medium">Customer messages will appear here</p>
                    </div>
                `;
                return;
            }
            
            let conversationsHTML = '';
            
            for (const doc of snapshot.docs) {
                const conv = doc.data();
                const userDoc = await db.collection('users').doc(conv.userId).get();
                const userName = userDoc.exists ? userDoc.data().name : 'Customer';
                const userEmail = userDoc.exists ? userDoc.data().email : 'No email';
                
                // Get last message
                const messagesQuery = await db.collection('messages')
                    .where('conversationId', '==', doc.id)
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();
                
                let lastMessage = 'No messages yet';
                if (!messagesQuery.empty) {
                    lastMessage = messagesQuery.docs[0].data().text;
                }
                
                const timeAgo = getTimeAgo(new Date(conv.lastUpdated));
                
                conversationsHTML += `
                    <div class="card border border-wood-medium p-md hover:shadow-md transition-shadow cursor-pointer"
                         onclick="openChatForConversation('${doc.id}', '${conv.userId}')">
                        <div class="flex justify-between items-start mb-sm">
                            <div>
                                <h4 class="font-medium mb-xs">${userName}</h4>
                                <p class="text-sm text-brown-light">${userEmail}</p>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-brown-light mb-xs">${timeAgo}</div>
                                ${conv.unreadCount > 0 ? 
                                    `<span class="badge badge-error">${conv.unreadCount} new</span>` : 
                                    `<span class="badge badge-outline">Read</span>`
                                }
                            </div>
                        </div>
                        <p class="text-sm text-brown-medium truncate" style="max-width: 600px;">
                            ${lastMessage}
                        </p>
                    </div>
                `;
            }
            
            listContainer.innerHTML = conversationsHTML;
            
        }, (error) => {
            console.error('Error loading messages:', error);
            listContainer.innerHTML = `
                <div class="text-center p-xl">
                    <i class="fas fa-exclamation-triangle text-4xl text-wood-light mb-lg"></i>
                    <h3 class="text-brown-dark mb-sm">Error Loading Messages</h3>
                    <p class="text-brown-medium">${error.message}</p>
                </div>
            `;
        });
        
    } catch (error) {
        console.error('Error loading messages:', error);
        listContainer.innerHTML = `
            <div class="text-center p-xl">
                <i class="fas fa-exclamation-triangle text-4xl text-wood-light mb-lg"></i>
                <h3 class="text-brown-dark mb-sm">Error Loading Messages</h3>
                <p class="text-brown-medium">${error.message}</p>
            </div>
        `;
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
    
    return 'just now';
}

function openChatForConversation(conversationId, userId) {
    openChat();
    
    // Set a timeout to ensure chat is loaded
    setTimeout(() => {
        loadConversation(conversationId, userId);
    }, 100);
}

// ========== USERS TAB ==========
function loadUsersTab() {
    const tab = document.getElementById('usersTab');
    if (!tab) return;
    
    tab.innerHTML = `
        <div class="card p-xl">
            <div class="flex justify-between items-center mb-lg">
                <h2>User Management</h2>
                <input type="text" id="userSearch" class="form-control" placeholder="Search users..." 
                       style="width: 300px;" oninput="searchUsers()">
            </div>
            
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th>Orders</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="usersTable">
                        <tr>
                            <td colspan="7" class="text-center p-lg">
                                <div class="loading-spinner"></div>
                                <p class="mt-md text-brown-medium">Loading users...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    loadUsersData();
}

async function loadUsersData() {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        
        db.collection('users').onSnapshot(async (snapshot) => {
            if (snapshot.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center p-lg">
                            <i class="fas fa-users text-3xl text-wood-light mb-sm"></i>
                            <p class="text-brown-medium">No users found</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            let usersHTML = '';
            
            for (const doc of snapshot.docs) {
                const user = doc.data();
                
                // Get order count
                const ordersQuery = await db.collection('orders')
                    .where('userId', '==', doc.id)
                    .get();
                
                const orderCount = ordersQuery.size;
                
                usersHTML += `
                    <tr>
                        <td>
                            <div class="font-medium">${user.name || 'No name'}</div>
                        </td>
                        <td>${user.email}</td>
                        <td>
                            <select class="form-control form-control-sm" onchange="updateUserRole('${doc.id}', this.value)" 
                                    ${user.email === 'admin@favoredandguided.com' ? 'disabled' : ''}>
                                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </td>
                        <td>
                            <div class="text-sm">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</div>
                        </td>
                        <td>
                            <div class="text-center">
                                <span class="badge ${orderCount > 0 ? 'badge-primary' : ''}">
                                    ${orderCount}
                                </span>
                            </div>
                        </td>
                        <td>
                            <span class="badge ${user.role === 'admin' ? 'badge-gold' : 'badge-primary'}">
                                ${user.role}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-outline btn-xs" onclick="viewUserDetails('${doc.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }
            
            tbody.innerHTML = usersHTML;
            
        }, (error) => {
            console.error('Error loading users:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-lg">
                        <i class="fas fa-exclamation-triangle text-3xl text-wood-light mb-sm"></i>
                        <p class="text-brown-medium">Error loading users: ${error.message}</p>
                    </td>
                </tr>
            `;
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center p-lg">
                    <i class="fas fa-exclamation-triangle text-3xl text-wood-light mb-sm"></i>
                    <p class="text-brown-medium">Error loading users: ${error.message}</p>
                </td>
            </tr>
        `;
    }
}

async function updateUserRole(userId, role) {
    if (!confirm(`Change user role to ${role}?`)) {
        return;
    }
    
    try {
        showLoading();
        const db = window.firebaseDb || firebase.firestore();
        
        await db.collection('users').doc(userId).update({
            role: role,
            updatedAt: new Date().toISOString()
        });
        
        hideLoading();
        showAlert(`User role updated to ${role}`, 'success');
        
    } catch (error) {
        hideLoading();
        showAlert('Error updating user role: ' + error.message, 'error');
    }
}

function searchUsers() {
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#usersTable tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function viewUserDetails(userId) {
    try {
        const db = window.firebaseDb || firebase.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            showAlert('User not found', 'error');
            return;
        }
        
        const user = userDoc.data();
        
        // Get user orders
        const ordersQuery = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const orders = ordersQuery.docs.map(doc => doc.data());
        
        let modalContent = `
            <div class="space-y-lg">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
                    <div>
                        <h4 class="mb-sm">User Information</h4>
                        <div class="space-y-sm">
                            <div>
                                <strong>Name:</strong>
                                <p class="mt-xs">${user.name || 'Not set'}</p>
                            </div>
                            <div>
                                <strong>Email:</strong>
                                <p class="mt-xs">${user.email}</p>
                            </div>
                            <div>
                                <strong>Role:</strong>
                                <p class="mt-xs">
                                    <span class="badge ${user.role === 'admin' ? 'badge-gold' : 'badge-primary'}">
                                        ${user.role}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <strong>Phone:</strong>
                                <p class="mt-xs">${user.phone || 'Not provided'}</p>
                            </div>
                            <div>
                                <strong>Address:</strong>
                                <p class="mt-xs">${user.address || 'Not provided'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="mb-sm">Account Information</h4>
                        <div class="space-y-sm">
                            <div>
                                <strong>User ID:</strong>
                                <p class="mt-xs font-mono text-sm">${userId}</p>
                            </div>
                            <div>
                                <strong>Joined:</strong>
                                <p class="mt-xs">${user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                }) : 'Unknown'}</p>
                            </div>
                            <div>
                                <strong>Last Updated:</strong>
                                <p class="mt-xs">${user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                }) : 'Never'}</p>
                            </div>
                            <div>
                                <strong>Total Orders:</strong>
                                <p class="mt-xs font-bold">${orders.length}</p>
                            </div>
                        </div>
                    </div>
                </div>
        `;
        
        if (orders.length > 0) {
            modalContent += `
                <div>
                    <h4 class="mb-sm">Recent Orders</h4>
                    <div class="space-y-sm" style="max-height: 300px; overflow-y: auto;">
                        ${orders.map(order => `
                            <div class="p-sm bg-wood-light rounded-md border border-wood-medium">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <strong class="font-mono">${order.orderId}</strong>
                                        <div class="text-sm text-brown-medium">${order.productName}</div>
                                    </div>
                                    <div class="text-right">
                                        <span class="status-badge ${getStatusConfig(order.status).class}">
                                            ${order.status}
                                        </span>
                                        <div class="text-sm font-bold mt-xs">$${(order.totalAmount || 0).toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        modalContent += `
                <div class="flex justify-end gap-sm">
                    <button class="btn btn-outline" onclick="openChatWithUser('${userId}')">
                        <i class="fas fa-comment mr-sm"></i> Message User
                    </button>
                    <button class="btn btn-primary" onclick="closeModal()">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        showCustomModal('User Details', modalContent);
        
    } catch (error) {
        console.error('Error loading user details:', error);
        showAlert('Error loading user details: ' + error.message, 'error');
    }
}

function openChatWithUser(userId) {
    closeModal();
    openChat();
    
    // Set a timeout to ensure chat is loaded
    setTimeout(() => {
        startChatWithCustomer(userId);
    }, 100);
}

// ========== ANALYTICS TAB ==========
function loadAnalyticsTab() {
    const tab = document.getElementById('analyticsTab');
    if (!tab) return;
    
    tab.innerHTML = `
        <div class="card p-xl">
            <h2 class="mb-lg">Analytics Dashboard</h2>
            <div class="space-y-lg">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                    <div class="card p-lg">
                        <h4 class="mb-sm">Revenue Overview</h4>
                        <div class="text-center p-md">
                            <div class="text-3xl font-bold text-wood-dark mb-sm" id="totalRevenue">$0.00</div>
                            <p class="text-brown-light">Total Revenue</p>
                        </div>
                    </div>
                    
                    <div class="card p-lg">
                        <h4 class="mb-sm">Order Statistics</h4>
                        <div class="space-y-sm">
                            <div class="flex justify-between">
                                <span>Total Orders</span>
                                <span class="font-bold" id="totalOrders">0</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Completed Orders</span>
                                <span class="font-bold" id="completedOrders">0</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Conversion Rate</span>
                                <span class="font-bold" id="conversionRate">0%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card p-lg">
                        <h4 class="mb-sm">User Statistics</h4>
                        <div class="space-y-sm">
                            <div class="flex justify-between">
                                <span>Total Users</span>
                                <span class="font-bold" id="totalUsers">0</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Active Users</span>
                                <span class="font-bold" id="activeUsers">0</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Avg Orders/User</span>
                                <span class="font-bold" id="avgOrdersPerUser">0.0</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg">
                    <div class="card p-lg">
                        <h4 class="mb-sm">Top Products</h4>
                        <div id="topProducts" class="space-y-sm">
                            <div class="text-center p-md">
                                <div class="loading-spinner"></div>
                                <p class="mt-md text-brown-medium">Loading...</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card p-lg">
                        <h4 class="mb-sm">Order Status Distribution</h4>
                        <div id="statusDistribution" class="space-y-sm">
                            <div class="text-center p-md">
                                <div class="loading-spinner"></div>
                                <p class="mt-md text-brown-medium">Loading...</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card p-lg">
                    <div class="flex justify-between items-center mb-sm">
                        <h4 class="mb-0">Recent Activity</h4>
                        <select id="activityFilter" class="form-control form-control-sm" onchange="loadAnalyticsData()">
                            <option value="7">Last 7 days</option>
                            <option value="30">Last 30 days</option>
                            <option value="90">Last 90 days</option>
                        </select>
                    </div>
                    <div id="recentActivity" class="space-y-sm">
                        <div class="text-center p-md">
                            <div class="loading-spinner"></div>
                            <p class="mt-md text-brown-medium">Loading activity...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    loadAnalyticsData();
}

async function loadAnalyticsData() {
    try {
        const db = window.firebaseDb || firebase.firestore();
        
        // Get all data
        const [ordersSnapshot, usersSnapshot, productsSnapshot] = await Promise.all([
            db.collection('orders').get(),
            db.collection('users').get(),
            db.collection('products').get()
        ]);
        
        const orders = ordersSnapshot.docs.map(doc => doc.data());
        const users = usersSnapshot.docs.map(doc => doc.data());
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Calculate analytics
        const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const totalOrders = orders.length;
        const completedOrders = orders.filter(o => o.status === 'completed').length;
        const totalUsers = users.length;
        const conversionRate = totalUsers > 0 ? ((orders.length / totalUsers) * 100).toFixed(1) : 0;
        
        // Update stats
        document.getElementById('totalRevenue').textContent = '$' + totalRevenue.toFixed(2);
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('completedOrders').textContent = completedOrders;
        document.getElementById('conversionRate').textContent = conversionRate + '%';
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('activeUsers').textContent = users.filter(u => u.updatedAt).length;
        document.getElementById('avgOrdersPerUser').textContent = (totalOrders / Math.max(totalUsers, 1)).toFixed(1);
        
        // Load top products
        loadTopProducts(orders, products);
        
        // Load status distribution
        loadStatusDistribution(orders);
        
        // Load recent activity
        const daysFilter = parseInt(document.getElementById('activityFilter')?.value || '7');
        loadRecentActivity(orders, daysFilter);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        showAlert('Error loading analytics: ' + error.message, 'error');
    }
}

function loadTopProducts(orders, products) {
    const container = document.getElementById('topProducts');
    if (!container) return;
    
    // Count orders by product
    const productCounts = {};
    orders.forEach(order => {
        if (order.productId) {
            productCounts[order.productId] = (productCounts[order.productId] || 0) + 1;
        }
    });
    
    // Get top 5 products
    const topProducts = Object.entries(productCounts)
        .map(([productId, count]) => {
            const product = products.find(p => p.id === productId);
            return {
                name: product?.name || 'Unknown Product',
                count: count,
                revenue: orders.filter(o => o.productId === productId).reduce((sum, o) => sum + (o.totalAmount || 0), 0)
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    
    if (topProducts.length === 0) {
        container.innerHTML = '<p class="text-brown-medium text-center">No product data available</p>';
        return;
    }
    
    container.innerHTML = topProducts.map(product => `
        <div class="flex justify-between items-center p-sm bg-wood-light rounded-md">
            <div>
                <div class="font-medium">${product.name}</div>
                <div class="text-sm text-brown-light">$${product.revenue.toFixed(2)} revenue</div>
            </div>
            <div class="text-right">
                <div class="font-bold">${product.count}</div>
                <div class="text-sm text-brown-light">orders</div>
            </div>
        </div>
    `).join('');
}

function loadStatusDistribution(orders) {
    const container = document.getElementById('statusDistribution');
    if (!container) return;
    
    // Count orders by status
    const statusCounts = {};
    orders.forEach(order => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });
    
    const totalOrders = orders.length;
    
    container.innerHTML = Object.entries(statusCounts)
        .map(([status, count]) => {
            const percentage = ((count / totalOrders) * 100).toFixed(1);
            const config = getStatusConfig(status);
            
            return `
                <div class="space-y-xs">
                    <div class="flex justify-between">
                        <span class="capitalize">${status.replace('-', ' ')}</span>
                        <span class="font-bold">${count} (${percentage}%)</span>
                    </div>
                    <div class="h-2 bg-wood-light rounded-full overflow-hidden">
                        <div class="h-full ${config.class.replace('status-', 'bg-')}" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
}

function loadRecentActivity(orders, days) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentOrders = orders
        .filter(order => new Date(order.createdAt) > cutoffDate)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
    
    if (recentOrders.length === 0) {
        container.innerHTML = '<p class="text-brown-medium text-center">No recent activity</p>';
        return;
    }
    
    container.innerHTML = recentOrders.map(order => {
        const timeAgo = getTimeAgo(new Date(order.createdAt));
        const config = getStatusConfig(order.status);
        
        return `
            <div class="flex items-center justify-between p-sm border-b border-wood-light last:border-0">
                <div class="flex items-center gap-sm">
                    <div class="w-8 h-8 rounded-full ${config.class} flex items-center justify-center">
                        <i class="fas ${config.icon} text-xs"></i>
                    </div>
                    <div>
                        <div class="font-medium">${order.userName}</div>
                        <div class="text-sm text-brown-light">${order.productName}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-bold">$${(order.totalAmount || 0).toFixed(2)}</div>
                    <div class="text-xs text-brown-light">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
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

function showLoading() {
    let loading = document.getElementById('globalLoading');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'globalLoading';
        loading.className = 'global-loading';
        loading.innerHTML = `
            <div class="loading-overlay">
                <div class="loading-spinner"></div>
            </div>
        `;
        document.body.appendChild(loading);
    }
    loading.style.display = 'block';
}

function hideLoading() {
    const loading = document.getElementById('globalLoading');
    if (loading) {
        loading.style.display = 'none';
    }
}

function showCustomModal(title, content) {
    const modal = document.createElement('div');
    modal.id = 'customModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh;">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="btn btn-sm" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body" style="max-height: calc(90vh - 120px); overflow-y: auto;">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.getElementById('customModal');
    if (modal) {
        modal.remove();
    }
}

function loadChatTab() {
    const chatTab = document.getElementById('chatTab');
    if (!chatTab) return;
    
    chatTab.innerHTML = `
        <div class="card p-xl">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-xl">
                <div class="lg:col-span-2">
                    <h3 class="mb-lg">Support Chat</h3>
                    <div class="chat-container" style="height: 500px;">
                        <div id="accountChatMessages" class="chat-messages" style="flex: 1; overflow-y: auto;"></div>
                        <div class="chat-input">
                            <div class="flex gap-sm">
                                <input type="text" id="accountChatInput" class="form-control" placeholder="Type your message..."
                                       onkeypress="if(event.key === 'Enter') sendAccountMessage()">
                                <button class="btn btn-primary" onclick="sendAccountMessage()">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div>
                    <h3 class="mb-lg">FAQ</h3>
                    <div class="space-y-md">
                        <div class="faq-item">
                            <h4 class="mb-xs">How long does shipping take?</h4>
                            <p class="text-sm text-brown-medium">Typically 3-5 business days for production plus shipping time.</p>
                        </div>
                        <div class="faq-item">
                            <h4 class="mb-xs">Can I cancel my order?</h4>
                            <p class="text-sm text-brown-medium">Orders can be cancelled within 24 hours of approval.</p>
                        </div>
                        <div class="faq-item">
                            <h4 class="mb-xs">Do you offer bulk discounts?</h4>
                            <p class="text-sm text-brown-medium">Yes! Contact us for custom quotes on bulk orders.</p>
                        </div>
                    </div>
                    
                    <div class="mt-lg">
                        <h4 class="mb-sm">Contact Information</h4>
                        <div class="space-y-xs">
                            <p class="text-sm"><i class="fas fa-envelope mr-sm"></i> support@favoredandguided.com</p>
                            <p class="text-sm"><i class="fas fa-phone mr-sm"></i> (555) 123-4567</p>
                            <p class="text-sm"><i class="fas fa-clock mr-sm"></i> Mon-Fri, 9AM-6PM EST</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    loadAccountChat();
}

async function loadAccountChat() {
    const messagesDiv = document.getElementById('accountChatMessages');
    if (!messagesDiv) return;
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        
        // Find conversation
        let conversationQuery = await db.collection('conversations')
            .where('userId', '==', currentUser.uid)
            .limit(1)
            .get();
        
        let conversationId;
        
        if (conversationQuery.empty) {
            messagesDiv.innerHTML = `
                <div class="text-center p-lg">
                    <i class="fas fa-comments text-3xl text-wood-light mb-sm"></i>
                    <p class="text-brown-medium">Start a conversation with our support team</p>
                </div>
            `;
            return;
        } else {
            conversationId = conversationQuery.docs[0].id;
            currentConversationId = conversationId;
        }
        
        // Load messages
        const messagesRef = db.collection('messages')
            .where('conversationId', '==', conversationId)
            .orderBy('timestamp', 'asc');
        
        messagesRef.onSnapshot((snapshot) => {
            messagesDiv.innerHTML = '';
            
            if (snapshot.empty) {
                messagesDiv.innerHTML = `
                    <div class="text-center p-lg">
                        <i class="fas fa-comments text-3xl text-wood-light mb-sm"></i>
                        <p class="text-brown-medium">Start a conversation with our support team</p>
                    </div>
                `;
                return;
            }
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                const isUser = msg.senderId !== 'admin';
                const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                messagesDiv.innerHTML += `
                    <div class="message ${isUser ? 'message-user' : 'message-admin'}">
                        <div class="flex justify-between items-start mb-xs">
                            <div class="font-medium">${isUser ? 'You' : 'Support Agent'}</div>
                            <div class="text-xs text-brown-light">${time}</div>
                        </div>
                        <p>${msg.text}</p>
                    </div>
                `;
            });
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
        
    } catch (error) {
        console.error('Error loading chat:', error);
        messagesDiv.innerHTML = `
            <div class="text-center p-lg">
                <i class="fas fa-exclamation-triangle text-3xl text-wood-light mb-sm"></i>
                <p class="text-brown-medium">Error loading chat: ${error.message}</p>
            </div>
        `;
    }
}

async function sendAccountMessage() {
    const input = document.getElementById('accountChatInput');
    const text = input?.value.trim();
    
    if (!text) return;
    
    if (!currentConversationId) {
        showAlert('Please wait while we set up your chat', 'warning');
        return;
    }
    
    try {
        const db = window.firebaseDb || firebase.firestore();
        
        await db.collection('messages').add({
            conversationId: currentConversationId,
            senderId: currentUser.uid,
            text: text,
            timestamp: new Date().toISOString()
        });
        
        await db.collection('conversations').doc(currentConversationId).update({
            lastMessage: text,
            lastUpdated: new Date().toISOString(),
            unreadCount: firebase.firestore.FieldValue.increment(1)
        });
        
        input.value = '';
        
    } catch (error) {
        console.error('Error sending message:', error);
        showAlert('Failed to send message: ' + error.message, 'error');
    }
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    const auth = window.firebaseAuth || firebase.auth();
    if (auth) {
        auth.onAuthStateChanged(async (user) => {
            currentUser = user;
            if (user) {
                const db = window.firebaseDb || firebase.firestore();
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        currentUserRole = userDoc.data().role || 'user';
                    } else {
                        // Create user document if it doesn't exist
                        await db.collection('users').doc(user.uid).set({
                            name: user.displayName || user.email.split('@')[0],
                            email: user.email,
                            role: 'user',
                            createdAt: new Date().toISOString(),
                            phone: '',
                            address: '',
                            updatedAt: new Date().toISOString()
                        });
                        currentUserRole = 'user';
                    }
                } catch (error) {
                    console.error('Error loading user role:', error);
                    currentUserRole = 'user';
                }
                updateNavigation();
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
            closeModal();
            closeChatModal();
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
window.selectOrderType = selectOrderType;
window.nextOrderStep = nextOrderStep;
window.prevOrderStep = prevOrderStep;
window.submitOrder = submitOrder;
window.filterUserOrders = filterUserOrders;
window.filterAdminOrders = filterAdminOrders;
window.updateOrderStatus = updateOrderStatus;
window.applyBulkAction = applyBulkAction;
window.openChat = openChat;
window.closeChatModal = closeChatModal;
window.sendMessage = sendMessage;
window.sendUserMessage = sendUserMessage;
window.sendAccountMessage = sendAccountMessage;
window.signInWithGoogle = signInWithGoogle;
window.signInWithFacebook = signInWithFacebook;
window.updateUserRole = updateUserRole;
window.startChatWithCustomer = startChatWithCustomer;
window.viewOrderDetails = viewOrderDetails;
window.openChatForOrder = openChatForOrder;
window.togglePassword = togglePassword;
window.previewImage = previewImage;
window.removeImagePreview = removeImagePreview;
window.addProduct = addProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.searchProducts = searchProducts;
window.toggleOrderSelection = toggleOrderSelection;
window.toggleAllOrders = toggleAllOrders;
window.loadAnalyticsData = loadAnalyticsData;
window.closeModal = closeModal;

console.log('Favored & Guided Engraving App initialized - Complete Edition');