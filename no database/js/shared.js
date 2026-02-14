// shared.js - Firebase Data Functions
let currentUser = null;
let currentRole = null;

// Load user from Firebase Auth
function loadUser() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user.email;
        // Get user role from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          currentRole = userDoc.data().role;
        } else {
          currentRole = null;
        }
      } else {
        currentUser = null;
        currentRole = null;
      }
      resolve({ user: currentUser, role: currentRole });
    });
  });
}

// Save user to Firestore
async function saveUser(user) {
  if (auth.currentUser) {
    await setDoc(doc(db, 'users', auth.currentUser.uid), user);
  }
}

// Clear user (sign out)
function clearUser() {
  signOut(auth);
}

// Load products from Firestore
async function loadProducts() {
  const productsSnapshot = await getDocs(collection(db, 'products'));
  return productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Save products to Firestore
async function saveProducts(products) {
  // Clear existing and add new (for simplicity; in production, update individually)
  const productsRef = collection(db, 'products');
  const existing = await getDocs(productsRef);
  existing.forEach(async (doc) => await deleteDoc(doc.ref));
  for (const product of products) {
    await addDoc(productsRef, product);
  }
}

// Load orders from Firestore
async function loadOrders() {
  const ordersSnapshot = await getDocs(collection(db, 'orders'));
  return ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Save orders to Firestore
async function saveOrders(orders) {
  // Clear existing and add new
  const ordersRef = collection(db, 'orders');
  const existing = await getDocs(ordersRef);
  existing.forEach(async (doc) => await deleteDoc(doc.ref));
  for (const order of orders) {
    await addDoc(ordersRef, order);
  }
}

// Load users from Firestore (for admin)
async function loadUsers() {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Save users to Firestore
async function saveUsers(users) {
  // Similar to saveProducts
  const usersRef = collection(db, 'users');
  const existing = await getDocs(usersRef);
  existing.forEach(async (doc) => await deleteDoc(doc.ref));
  for (const user of users) {
    await setDoc(doc(db, 'users', user.id), user);
  }
}

// Make functions global
window.loadUser = loadUser;
window.saveUser = saveUser;
window.clearUser = clearUser;
window.loadProducts = loadProducts;
window.saveProducts = saveProducts;
window.loadOrders = loadOrders;
window.saveOrders = saveOrders;
window.loadUsers = loadUsers;
window.saveUsers = saveUsers;