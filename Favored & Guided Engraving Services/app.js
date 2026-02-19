// --- FIREBASE IMPORTS ---
import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider, 
    FacebookAuthProvider, 
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
        currentUser = user;
        if(guestBtns) guestBtns.style.display = "none";
        if(userBtns) userBtns.style.display = "flex"; 
    } else {
        currentUser = null;
        if(guestBtns) guestBtns.style.display = "flex";
        if(userBtns) userBtns.style.display = "none";
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

// Facebook Login
window.loginWithFacebook = async () => {
    const provider = new FacebookAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        await syncUserToFirestore(user);
        
        window.location.href = "user.html";
    } catch (error) {
        showToast("Facebook Login Failed: " + error.message, 'error');
    }
};

// Helper to ensure social users have a profile in your 'users' collection
async function syncUserToFirestore(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        await setDoc(userRef, {
            name: user.displayName,
            email: user.email,
            phone: user.phoneNumber || "Not Set",
            createdAt: new Date()
        });
    }
}

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
        // Reset the color (in case inline styles were applied)
        a.style.color = "";
    });
    
    // Find the clicked link and mark it as active
    const activeLink = document.querySelector(`.nav-center a[onclick*="'${id}'"]`);
    if (activeLink) {
        activeLink.classList.add('active');
        activeLink.style.color = "white"; // Match the admin panel styling
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

// --- SOCIAL AUTHENTICATION ---

window.signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveSocialUser(result.user);
        window.location.href = "/user"; // [cite: 12]
    } catch (error) { showToast(error.message, 'error'); }
};

window.signInWithFacebook = async () => {
    const provider = new FacebookAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveSocialUser(result.user);
        window.location.href = "/user";
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
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.location.href = (email === "admin@favored.com") ? "/admin" : "/user"; // [cite: 14]
    } catch (error) { showToast(error.message, 'error'); }
};

window.signupUser = async () => {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('confirmPassword').value; // Dual Password confirmation

    if (pass !== confirm) {
        showToast("Passwords do not match!", 'error');
    }

    try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", result.user.uid), {
            name: name,
            email: email,
            role: "customer"
        });
        window.location.href = "/user";
    } catch (error) { showToast(error.message, 'error'); }
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
    const body = document.getElementById('chat-body');
    const icon = document.getElementById('chat-icon');
    if (body.style.display === 'none') {
        body.style.display = 'flex';
        icon.className = 'fas fa-chevron-down'; // [cite: 50]
    } else {
        body.style.display = 'none';
        icon.className = 'fas fa-chevron-up'; // [cite: 51]
    }
};

window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    if (!input.value.trim() || !currentUser) return;

    await addDoc(collection(db, "chats"), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        text: input.value,
        sender: "user",
        timestamp: new Date()
    }); // [cite: 55]
    input.value = "";
};

document.addEventListener("DOMContentLoaded", renderProducts);
