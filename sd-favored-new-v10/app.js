// --- FIREBASE IMPORTS ---
import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    sendEmailVerification, 
    signOut,
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    collection, addDoc, getDocs, doc, setDoc, getDoc, query, where 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let currentUser = null; 
let currentProduct = null; 

// =========================================
// TOAST NOTIFICATIONS
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
// EMPTY STATE UTILITY
// =========================================
window.showEmptyState = (container, type) => {
  const messages = {
    wishlist: 'Your wishlist is waiting to be filled ♥',
    orders: 'No orders yet. Start shopping!',
    chat: 'Start a conversation with us!',
    products: 'No products found.'
  };
  
  const icons = {
    wishlist: 'fa-heart',
    orders: 'fa-shopping-bag',
    chat: 'fa-comment-dots',
    products: 'fa-box-open'
  };
  
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas ${icons[type]}"></i>
      <p>${messages[type]}</p>
      <button class="btn-primary" onclick="showSection('products')">
        Browse Products
      </button>
    </div>
  `;
};

// --- AUTH MONITOR ---
onAuthStateChanged(auth, async (user) => {
    const guestBtns = document.getElementById("guest-buttons");
    const userBtns = document.getElementById("user-buttons");

    if (user) {
        if (!user.emailVerified && user.email !== "admin@favored.com") {
            return; 
        }
        currentUser = user;
        const currentPath = window.location.pathname.toLowerCase();

        const adminEmail = "admin@favored.com"; 
        const isAdmin = user.email === adminEmail;


        if (isAdmin) {
            if (currentPath.includes("index.html") || currentPath === "/" || currentPath.endsWith("/") || currentPath.includes("user.html")) {
                window.location.href = "admin.html"; 
                return; 
            }
        } else {
            if (currentPath.includes("index.html") || currentPath === "/" || currentPath.endsWith("/") || currentPath.includes("admin.html")) {
                window.location.href = "user.html"; 
                return; 
            }
        }
        if(guestBtns) guestBtns.style.display = "none";
        if(userBtns) userBtns.style.display = "flex"; 
        
    } else {
        currentUser = null;
        if(guestBtns) guestBtns.style.display = "flex";
        if(userBtns) userBtns.style.display = "none";     
        const currentPath = window.location.pathname.toLowerCase();
        if (currentPath.includes("user.html") || currentPath.includes("admin.html")) {
            window.location.href = "index.html";
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // 1. Enter to Log In
    const loginSection = document.getElementById('loginSection');
    if (loginSection) {
        loginSection.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof window.loginUser === 'function') window.loginUser();
            }
        });
    }

    // 2. Enter to Sign Up
    const signupSection = document.getElementById('signupSection');
    if (signupSection) {
        signupSection.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof window.signupUser === 'function') window.signupUser();
            }
        });
    }

    // 3. Enter to Reset Password
    const forgotSection = document.getElementById('forgotSection');
    if (forgotSection) {
        forgotSection.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof window.handleForgotPassword === 'function') window.handleForgotPassword();
            }
        });
    }
});

// --- SOCIAL LOGIN LOGIC ---

// Google Login
window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check if user exists in Firestore, if not, create them
        await syncUserToFirestore(user);
        
        window.location.href = "user.html"; 
    } catch (error) {
        showToast("Google Login Failed: " + error.message, 'error');
    }
};


// --- EXPORT TO WINDOW (Fixes Click Issue) ---
window.showSection = (id) => {
    // Hide all sections
    ['hero', 'products', 'about'].forEach(sec => {
        const el = document.getElementById(sec);
        if (el) el.style.display = (sec === id) ? 'block' : 'none';
    });
    
    // Update active state of navigation links
    document.querySelectorAll('.nav-center a').forEach(a => {
        a.classList.remove('active');
        a.style.color = "";
    });
    
    // Find the clicked link and mark it as active
    const activeLink = document.querySelector(`.nav-center a[onclick*="'${id}'"]`);
    if (activeLink) {
        activeLink.classList.add('active');
        activeLink.style.color = "white"; // Match the admin panel styling
    }

    // --- AUTO-CLOSE MOBILE MENU ---
    // Closes the drawer automatically when you click a link
    if (document.body.classList.contains('menu-open')) {
        document.body.classList.remove('menu-open');
    }
};

window.openModal = (id) => {
    const el = document.getElementById(id);
    if(el) el.style.display = 'flex';
};

window.closeModal = (id) => {
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
};

window.toggleAuth = (type) => {
    const login = document.getElementById('loginSection');
    const signup = document.getElementById('signupSection');
    
    if (type === 'signup') {
        login.style.display = 'none';
        signup.style.display = 'block';
    } else {
        login.style.display = 'block';
        signup.style.display = 'none';
    }
};

window.togglePasswordVisibility = (inputId, iconElement) => {
    const input = document.getElementById(inputId);
    
    if (input.type === 'password') {
        // Change to text to make password VISIBLE
        input.type = 'text';
        iconElement.classList.remove('fa-eye-slash');
        iconElement.classList.add('fa-eye');
    } else {
        input.type = 'password';
        iconElement.classList.remove('fa-eye');
        iconElement.classList.add('fa-eye-slash');
    }
};
// --- SOCIAL AUTHENTICATION ---

window.signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveSocialUser(result.user);
        window.location.href = "/user"; // [cite: 12]
    } catch (error) { showToast(error.message, 'error'); }
};


async function saveSocialUser(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
        await setDoc(userRef, { 
            name: user.displayName, 
            email: user.email, 
            role: "customer",
            createdAt: new Date().toISOString() 
        }); // [cite: 16, 17]
    }
}

// --- EMAIL AUTHENTICATION ---

window.loginUser = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const loginBtn = document.querySelector('#loginSection .btn-auth-submit');
    const originalText = loginBtn.innerHTML;

    try {
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        loginBtn.disabled = true;

        const result = await signInWithEmailAndPassword(auth, email, pass);
        const user = result.user;

        // CHECK IF EMAIL IS VERIFIED (BUT SKIP THIS CHECK FOR THE ADMIN)
        if (!user.emailVerified && email !== "admin@favored.com") {
            await signOut(auth); // Sign them back out
            window.closeModal('authModal'); 
            
            showToast("Please check your inbox and verify your email first.", "error"); 
            return;
        }

        window.location.href = (email === "admin@favored.com") ? "/admin" : "/user"; 
        
    } catch (error) { 
        showToast("Login failed: Please check your inbox and verify your email first.", 'error'); 
    } finally {
        if (loginBtn) {
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    }
};

window.signupUser = async () => {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('confirmPassword').value; 
    const signupBtn = document.querySelector('#signupSection .btn-auth-submit');
    const originalText = signupBtn.innerHTML;

    // Validation
    if (pass !== confirm) {
        return showToast("Passwords do not match!", 'error');
    }
    if (pass.length < 8) {
        return showToast("Password must be at least 8 characters.", 'error');
    }

    try {
        signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        signupBtn.disabled = true;

        // 1. Create Account
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        
        // 2. Save Data to Firestore
        await setDoc(doc(db, "users", result.user.uid), {
            name: name,
            email: email,
            role: "customer",
            dpaConsent: true,
            createdAt: new Date().toISOString()
        });

        // 3. Send Verification Email
        await sendEmailVerification(result.user);

        // 4. Force Sign Out
        await signOut(auth);

        // 5. Update UI
        document.getElementById('signupName').value = '';
        document.getElementById('signupEmail').value = '';
        document.getElementById('signupPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        window.closeModal('authModal');
        window.openModal('verifyEmailModal'); // Show the success modal!
        
    } catch (error) { 
        showToast("Signup failed: " + error.message, 'error'); 
    } finally {
        signupBtn.innerHTML = originalText;
        signupBtn.disabled = false;
    }
};

// --- PRODUCT RENDERING ---

async function renderProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;
    
    // Show skeleton loading
    container.innerHTML = Array(4).fill(0).map(() => `
        <div class="product-card">
            <div class="skeleton-loader skeleton-product"></div>
            <div class="skeleton-loader skeleton-text"></div>
            <div class="skeleton-loader skeleton-text short"></div>
        </div>
    `).join('');
    
    try {
        const snapshot = await getDocs(collection(db, "products"));
        container.innerHTML = ""; 
        
        if (snapshot.empty) {
            showEmptyState(container, 'products');
            return;
        }

        snapshot.forEach((docSnap) => { 
            const p = docSnap.data();
            const id = docSnap.id;
            
            container.innerHTML += `
                <div class="product-card">
                    <button class="wishlist-btn" onclick="handleGuestWishlist()">
                        <i class="fas fa-heart"></i>
                    </button>
                    <img src="${p.imageUrl}" alt="${p.name}">
                    <h3>${p.name}</h3>
                    <p class="price">₱${p.price}</p>
                    <button class="btn-primary" onclick="openModal('authModal')">View Details</button>
                </div>`; 
        });
    } catch (error) {
        console.error("Error loading products:", error);
        showEmptyState(container, 'products');
    }
}

// Helper function to prompt login when guest clicks heart
window.handleGuestWishlist = () => {
    showToast("Please log in to save items to your wishlist!", 'error');
    window.openModal('authModal');
};

// --- CHAT LOGIC ---

window.toggleChat = () => {
    const chatContainer = document.getElementById('chat-container');
    const chatIcon = document.getElementById('chatIcon');
    const chatBubbleIcon = document.querySelector('.chat-bubble i');
    
    chatContainer.classList.toggle('active');
    
    if (chatContainer.classList.contains('active')) {
        // Change bubble icon to X when chat is open
        if (chatBubbleIcon) {
            chatBubbleIcon.className = 'fas fa-times';
        }
        // Hide notification when opened
        const notification = document.getElementById('chatNotification');
        if (notification) {
            notification.style.display = 'none';
        }
        // Load messages if needed
        const messages = document.getElementById('chat-messages');
        if (messages && messages.children.length === 0 && typeof loadGuestChat === 'function') {
            loadGuestChat();
        }
        // Focus input
        setTimeout(() => {
            const input = document.getElementById('chatInput');
            if (input) input.focus();
        }, 300);
    } else {
        // Change back to chat bubble when closed
        if (chatBubbleIcon) {
            chatBubbleIcon.className = 'fas fa-comment-dots';
        }
    }
};
window.sendMessage = () => {
    const input = document.getElementById('chatInput');
    const messageText = input.value.trim();
    
    if (!messageText) return;

    input.value = ""; // Clear typing box

    const container = document.getElementById('chat-messages');
    if(!container) return;

    // 1. Draw guest message on screen
    const guestMsg = document.createElement('div');
    guestMsg.className = `msg-wrapper user`;
    guestMsg.innerHTML = `
        <div class="msg user">${escapeHtml(messageText)}</div>
        <div class="msg-time">Just now</div>
    `;
    container.appendChild(guestMsg);
    container.scrollTop = container.scrollHeight;

    // 2. Automated bot prompts them to log in
    setTimeout(() => {
        const botReply = document.createElement('div');
        botReply.className = `msg-wrapper admin`;
        botReply.innerHTML = `
            <div class="msg admin" style="background: var(--cream); color: var(--walnut); border: 1px solid var(--border-light);">
                <strong>Favored & Guided ✨</strong><br><br>
                Thanks for reaching out! To connect with a real human and get help with your specific question, please log in or create an account.
            </div>
            <div class="msg-time" style="color: var(--taupe);">Automated</div>
        `;
        container.appendChild(botReply);
        container.scrollTop = container.scrollHeight;
    }, 600);
};

function loadGuestChat() {
    const container = document.getElementById('chat-messages');
    if(!container) return;

    container.innerHTML = ""; 
    
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = `msg-wrapper admin`; 
    
    welcomeMsg.innerHTML = `
        <div class="msg admin" style="background: var(--cream); color: var(--walnut); border: 1px solid var(--border-light);">
            <strong>Favored & Guided ✨</strong><br><br>
            Hi there! 👋 Welcome to our shop. How can we help you with your custom engraving today?
        </div>
        <div class="msg-time" style="color: var(--taupe);">Automated</div>
    `;
    container.appendChild(welcomeMsg);
}


function escapeHtml(unsafe) {
    return (unsafe || "").toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// --- NEW: AUTOMATED FAQ CHATBOT ---
window.sendFAQ = (questionText, answerText) => {
    const container = document.getElementById('chat-messages');
    if(!container) return;

    // 1. Draw the guest's question bubble
    const guestMsg = document.createElement('div');
    guestMsg.className = `msg-wrapper user`;
    guestMsg.innerHTML = `
        <div class="msg user">${escapeHtml(questionText)}</div>
        <div class="msg-time">Just now</div>
    `;
    container.appendChild(guestMsg);
    container.scrollTop = container.scrollHeight;

    // 2. Draw the bot's answer bubble
    setTimeout(() => {
        const botReply = document.createElement('div');
        botReply.className = `msg-wrapper admin`;
        botReply.innerHTML = `
            <div class="msg admin" style="background: var(--cream); color: var(--walnut); border: 1px solid var(--border-light);">
                <strong>Favored & Guided ✨</strong><br><br>
                ${answerText}
            </div>
            <div class="msg-time" style="color: var(--taupe);">Automated</div>
        `;
        container.appendChild(botReply);
        container.scrollTop = container.scrollHeight;
    }, 600);
};

document.addEventListener("DOMContentLoaded", () => {
    renderProducts(); // Keep your product render

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                window.sendMessage();
            }
        });
    }
});

// =========================================
// FIXED MOBILE NAVIGATION ACTIVE STATE FOR PUBLIC SITE
// =========================================

// Override the existing showSection function
const originalShowSection = window.showSection;

window.showSection = function(id) {
    // Call the original function first
    if (originalShowSection) {
        originalShowSection(id);
    }
    
    // Update mobile navigation active states
    updateMobileNavActiveState(id);
    
    // Close mobile menu after navigation
    closeMobileMenu();
};

// Function to update mobile nav active states
function updateMobileNavActiveState(sectionId) {
    // Get all mobile nav links
    const mobileNavLinks = document.querySelectorAll('.mobile-nav a');
    
    // Remove active class from all mobile nav links
    mobileNavLinks.forEach(link => {
        link.classList.remove('active');
        
        // Also remove any inline styles that might be overriding
        link.style.background = '';
        link.style.borderColor = '';
        link.style.color = '';
    });
    
    // Find and activate the correct mobile nav link
    mobileNavLinks.forEach(link => {
        const onclickAttr = link.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${sectionId}'`)) {
            link.classList.add('active');
            
            // Apply the active styles (matching your CSS)
            link.style.background = 'rgba(212, 165, 95, 0.2)';
            link.style.borderColor = 'rgba(212, 165, 95, 0.4)';
            link.style.color = 'white !important';
        }
    });
}

// Function to close mobile menu
function closeMobileMenu() {
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

// Helper function to determine which section is currently visible
function getCurrentVisibleSection() {
    const sections = ['hero', 'products', 'about'];
    
    for (let section of sections) {
        const element = document.getElementById(section);
        if (element && element.style.display !== 'none') {
            return section;
        }
    }
    return 'hero'; // Default to hero
}

// Enhance the existing DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (hamburgerBtn && mobileMenu && closeMenuBtn && menuOverlay) {
        // Open menu
        hamburgerBtn.addEventListener('click', function() {
            this.classList.toggle('active');
            mobileMenu.classList.toggle('open');
            menuOverlay.classList.toggle('active');
            document.body.style.overflow = 'hidden';
            
            // When opening menu, highlight the current section
            const currentSection = getCurrentVisibleSection();
            updateMobileNavActiveState(currentSection);
        });
        
        // Close menu with close button
        closeMenuBtn.addEventListener('click', function() {
            hamburgerBtn.classList.remove('active');
            mobileMenu.classList.remove('open');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
        
        // Close menu when clicking overlay
        menuOverlay.addEventListener('click', function() {
            hamburgerBtn.classList.remove('active');
            mobileMenu.classList.remove('open');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
        
        // Add click handlers to mobile nav links
        mobileMenu.querySelectorAll('.mobile-nav a').forEach(link => {
            link.addEventListener('click', function(e) {
                const onclickAttr = this.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/'([^']+)'/);
                    if (match && match[1]) {
                        const sectionId = match[1];
                        
                        // Update active states immediately
                        updateMobileNavActiveState(sectionId);
                    }
                }
            });
        });
    }
    
    const originalShowSection = window.showSection;
    window.showSection = function(id) {
        if (originalShowSection) {
            originalShowSection(id);
        }
        updateMobileNavActiveState(id);
        closeMobileMenu();
    };
});

const originalToggleAuth = window.toggleAuth;

window.toggleAuth = function(type) {
    if (originalToggleAuth) {
        originalToggleAuth(type);
    }

    const currentSection = getCurrentVisibleSection();
    updateMobileNavActiveState(currentSection);
};

// --- DYNAMIC SPOTLIGHT REVEAL ENGINE (10 LAYER READY) ---
document.addEventListener('DOMContentLoaded', async () => {
    const snapBox = document.getElementById('engraving-snap');
    const layersContainer = document.getElementById('dynamic-snap-layers');
    if (!snapBox || !layersContainer) return;

    let currentPhoto = 1;
    let totalPhotos = 0;

    try {
        const docSnap = await getDoc(doc(db, "site_settings", "hero_spotlight"));
        if (docSnap.exists()) {
            const images = docSnap.data().images || [];
            totalPhotos = images.length;
            
            // Generate layers for up to 10 photos
            layersContainer.innerHTML = images.map((src, index) => `
                <img id="snap-${index + 1}" src="${src}" class="stack-img p${index + 1}" style="z-index: ${index + 1}">
            `).join('');
        }
    } catch (err) { console.error("Gallery Sync Error:", err); }

    snapBox.addEventListener('click', () => {
        if (totalPhotos === 0 || snapBox.dataset.isEngraving === "true") return;

        // Reset the cycle after reaching the last photo
        if (currentPhoto > totalPhotos) {
            document.querySelectorAll('.stack-img').forEach(img => img.classList.remove('active'));
            currentPhoto = 1;
            return;
        }

        const img = document.getElementById(`snap-${currentPhoto}`);
        if (img) {
            snapBox.dataset.isEngraving = "true";
            img.classList.add('active'); 
            currentPhoto++;
            setTimeout(() => { snapBox.dataset.isEngraving = "false"; }, 2000);
        }
    });
});