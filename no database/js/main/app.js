let products = [];
let orders = [];
let selectedProduct = null;
let pendingOrder = null;


/* =========================
   SECTION NAVIGATION
========================= */
function showSection(sectionId) {
  const sections = document.querySelectorAll("main section");
  sections.forEach(section => {
    section.style.display = "none";
  });

  const active = document.getElementById(sectionId);
  if (active) {
    active.style.display = "block";
    active.scrollIntoView({ behavior: "smooth" });
  }

  document.querySelectorAll(".nav-center a").forEach(link => {
    link.classList.remove("active");
    if (link.dataset.section === sectionId) {
      link.classList.add("active");
    }
  });
}

/* =========================
   AUTH MODAL
========================= */
function openAuthModal(section) {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'flex';

  if (section === 'signup') {
    switchToSignup();
  } else {
    switchToLogin();
  }
}

function closeModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
}

function switchToLogin() {
  const login = document.getElementById('loginSection');
  const signup = document.getElementById('signupSection');
  if (login) login.style.display = 'block';
  if (signup) signup.style.display = 'none';
}

function switchToSignup() {
  const login = document.getElementById('loginSection');
  const signup = document.getElementById('signupSection');
  if (login) login.style.display = 'none';
  if (signup) signup.style.display = 'block';
}

/* =========================
   PRODUCT DETAILS
========================= */
function openProductDetails(productId) {
  selectedProduct = products.find(p => p.id === productId);
  if (!selectedProduct) return;

  document.getElementById('detailsImage').src = selectedProduct.image;
  document.getElementById('detailsName').textContent = selectedProduct.name;
  document.getElementById('detailsCategory').textContent = selectedProduct.category;
  document.getElementById('detailsDescription').textContent =
    selectedProduct.description || 'No description';
  document.getElementById('detailsPrice').textContent =
    `₱${selectedProduct.price.toFixed(2)}`;
  document.getElementById('detailsQuantity').value = 1;

  updateDetailsTotal();

  document.getElementById('productDetailsModal').style.display = 'flex';
}

function closeProductDetails() {
  const modal = document.getElementById('productDetailsModal');
  if (modal) modal.style.display = 'none';
}

function updateDetailsTotal() {
  const quantity =
    parseInt(document.getElementById("detailsQuantity")?.value) || 1;

  const price = selectedProduct ? selectedProduct.price : 0;
  const total = price * quantity;

  document.getElementById("detailsTotal").textContent =
    `₱${total.toFixed(2)}`;
}

/* =========================
   ORDER
========================= */
function orderFromDetails() {
  if (!selectedProduct) return;

  const quantity =
    parseInt(document.getElementById("detailsQuantity").value) || 1;

  const user = auth.currentUser;

  if (!user) {
    pendingOrder = { product: selectedProduct, quantity: quantity };
    closeProductDetails();
    openAuthModal('login');
    return;
  }

  closeProductDetails();

  document.getElementById("orderProduct").value = selectedProduct.name;
  document.getElementById("orderProductLabel").textContent = selectedProduct.name;
  document.getElementById("orderQuantity").value = quantity;
  document.getElementById("orderPrice").textContent =
    `₱${selectedProduct.price.toFixed(2)}`;

  updateTotal();

  document.getElementById("orderModal").style.display = "flex";
}

function updateTotal() {
  const quantity =
    parseInt(document.getElementById("orderQuantity")?.value) || 1;

  const price = selectedProduct ? selectedProduct.price : 0;
  const total = price * quantity;

  document.getElementById("orderTotal").textContent =
    `₱${total.toFixed(2)}`;
}

function openOrderModal(productName) {
  const modal = document.getElementById('orderModal');
  if (modal) modal.style.display = 'flex';

  const input = document.getElementById('orderProduct');
  if (input) input.value = productName;
}

function closeOrderModal() {
  const modal = document.getElementById('orderModal');
  if (modal) modal.style.display = 'none';
}

/* =========================
   SOCIAL LOGIN
========================= */
async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    closeModal();
  } catch (error) {
    alert('Google login failed: ' + error.message);
  }
}

async function loginWithFacebook() {
  const provider = new FacebookAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    closeModal();
  } catch (error) {
    alert('Facebook login failed: ' + error.message);
  }
}

async function signupWithGoogle() {
  await loginWithGoogle();
}

async function signupWithFacebook() {
  await loginWithFacebook();
}

/* =========================
   GLOBAL ACCESS
========================= */
window.showSection = showSection;
window.openAuthModal = openAuthModal;
window.closeModal = closeModal;
window.switchToLogin = switchToLogin;
window.switchToSignup = switchToSignup;
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.openProductDetails = openProductDetails;
window.closeProductDetails = closeProductDetails;
window.updateDetailsTotal = updateDetailsTotal;
window.orderFromDetails = orderFromDetails;
window.updateTotal = updateTotal;
window.loginWithGoogle = loginWithGoogle;
window.loginWithFacebook = loginWithFacebook;
window.signupWithGoogle = signupWithGoogle;
window.signupWithFacebook = signupWithFacebook;

/* =========================
   INITIALIZE APP
========================= */
document.addEventListener("DOMContentLoaded", async () => {

  await loadProductsFromStorage();
  renderProducts();
  showSection("hero");

  onAuthStateChanged(auth, async (user) => {

    if (user) {
      currentUser = user.email;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      currentRole = userDoc.exists() ? userDoc.data().role : null;

      // 🔥 If there was a pending order before login
      if (pendingOrder) {
        selectedProduct = pendingOrder.product;
        document.getElementById("orderQuantity").value =
          pendingOrder.quantity;
        pendingOrder = null;
        orderFromDetails();
      }

      if (currentRole === 'admin') {
        window.location.href = '/admin';
      } else if (currentRole === 'user') {
        window.location.href = '/user';
      }

    } else {
      currentUser = null;
      currentRole = null;
    }
  });

  /* =========================
     FORMS
  ========================= */

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = loginForm.querySelector("input[type='email']").value;
      const password = loginForm.querySelector("input[type='password']").value;

      try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal();
      } catch (error) {
        alert('Login failed: ' + error.message);
      }
    });
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fullname =
        signupForm.querySelector("input[type='text']").value;
      const email =
        signupForm.querySelector("input[type='email']").value;
      const password =
        signupForm.querySelectorAll("input[type='password']")[0].value;
      const confirmPassword =
        signupForm.querySelectorAll("input[type='password']")[1].value;
      const role =
        document.getElementById('signupRole').value;

      if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
      }

      try {
        const userCredential =
          await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(
          doc(db, 'users', userCredential.user.uid),
          { fullname, email, role, phone: '' }
        );

        closeModal();
        alert('Signup successful!');
      } catch (error) {
        alert('Signup failed: ' + error.message);
      }
    });
  }

  const orderForm = document.getElementById('orderForm');
  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!selectedProduct || !currentUser) {
        alert('Please select a product and log in first.');
        return;
      }

      const quantity =
        parseInt(document.getElementById("orderQuantity").value) || 1;

      const fullname =
        document.getElementById("userFullname").value;
      const email =
        document.getElementById("userEmail").value;
      const phone =
        document.getElementById("userPhone").value;

      const newOrder = {
        id: Date.now(),
        product: selectedProduct.name,
        productId: selectedProduct.id,
        quantity: quantity,
        fullname,
        email,
        phone,
        status: "Pending",
        user: currentUser,
        accepted: false
      };

      orders = await loadOrders();
      orders.push(newOrder);
      await saveOrders(orders);

      alert("Order submitted!");
      closeOrderModal();
    });
  }
});

/* =========================
   STORAGE
========================= */
async function loadProductsFromStorage() {
  products = await loadProducts();
}

function renderProducts() {
  const container = document.querySelector('.products');
  if (!container) return;

  container.innerHTML = products.map(p => `
    <article class="product-card">
      <img src="${p.image}" alt="${p.name}" />
      <span class="category">${p.category}</span>
      <h3>${p.name}</h3>
      <p class="price">₱${p.price.toFixed(2)}</p>
      <button class="btn-primary"
        onclick="openProductDetails('${p.id}')">
        View Details
      </button>
    </article>
  `).join('');
}
