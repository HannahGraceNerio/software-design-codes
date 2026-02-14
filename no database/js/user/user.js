// user.js - User Dashboard JS (Firebase)
let products = [];
let orders = [];
let selectedProduct = null;

// Check if user is logged in
document.addEventListener('DOMContentLoaded', async function() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '../main/index.html';
      return;
    }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'user') {
      window.location.href = '../main/index.html';
      return;
    }
    showSection('hero');
    products = await loadProducts();
    orders = await loadOrders();
    renderProducts();
    renderUserOrders();
  });

  // Edit Details Form Submission
  const editDetailsForm = document.getElementById('editDetailsForm');
  editDetailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullname = document.getElementById('editFullname').value;
    const email = document.getElementById('editEmail').value;
    const phone = document.getElementById('editPhone').value;

    const details = { fullname, email, phone };
    await updateDoc(doc(db, 'users', auth.currentUser.uid), details);
    loadUserDetails();
    loadAccountDetails();
    alert('Details saved!');
    showSection('account');
  });

  // Change Password Form Submission
  const changePasswordForm = document.getElementById('changePasswordForm');
  changePasswordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const previousPassword = document.getElementById('previousPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (!previousPassword || !newPassword || !confirmNewPassword) {
      alert('Please fill in all fields.');
      return;
    }

    // Mock previous password check (in real app, verify against stored hash)
    if (previousPassword !== 'user') {
      alert('Previous password is incorrect.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert('New passwords do not match.');
      return;
    }

    // In a real app, hash and save the new password
    alert('Password changed successfully! (Mock - not saved)');
    showSection('account');
  });
});

function loadUserDetails() {
  // Load from Firebase user doc
  if (auth.currentUser) {
    getDoc(doc(db, 'users', auth.currentUser.uid)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('displayFullname').textContent = data.fullname || 'Not set';
        document.getElementById('displayEmail').textContent = data.email || 'Not set';
        document.getElementById('displayPhone').textContent = data.phone || 'Not set';
      }
    });
  }
}

function loadAccountDetails() {
  if (auth.currentUser) {
    getDoc(doc(db, 'users', auth.currentUser.uid)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('accountFullname').textContent = data.fullname || 'Not set';
        document.getElementById('accountEmail').textContent = data.email || 'Not set';
        document.getElementById('accountPhone').textContent = data.phone || 'Not set';
      }
    });
  }
}

function loadEditDetails() {
  if (auth.currentUser) {
    getDoc(doc(db, 'users', auth.currentUser.uid)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('editFullname').value = data.fullname || '';
        document.getElementById('editEmail').value = data.email || '';
        document.getElementById('editPhone').value = data.phone || '';
      }
    });
  }
}

function openEditDetailsModal() {
  loadEditDetails();
  document.getElementById('editDetailsModal').style.display = 'flex';
}

function closeEditDetailsModal() {
  document.getElementById('editDetailsModal').style.display = 'none';
}

function saveDetailsFromModal() {
  const details = {
    fullname: document.getElementById('editFullname').value,
    email: document.getElementById('editEmail').value,
    phone: document.getElementById('editPhone').value
  };
  if (auth.currentUser) {
    updateDoc(doc(db, 'users', auth.currentUser.uid), details);
  }
  loadUserDetails();
  closeEditDetailsModal();
  alert('Details saved!');
}

function toggleMenu() {
  const dropdown = document.getElementById('menuDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function closeMenu() {
  document.getElementById('menuDropdown').style.display = 'none';
}

function renderProducts() {
  const container = document.querySelector('.products');
  container.innerHTML = products.map(p => `
    <article class="product-card">
      <img src="${p.image}" alt="${p.name}" />
      <span class="category">${p.category}</span>
      <h3>${p.name}</h3>
      <p class="price">₱${p.price.toFixed(2)}</p>
      <button class="btn-primary" onclick="openProductDetails('${p.id}')">View Details</button>
    </article>
  `).join('');
}

function renderUserOrders() {
  const container = document.getElementById("userOrders");
  if (!container) return;

  const userOrders = orders.filter(o => o.user === auth.currentUser.email);
  container.innerHTML = userOrders.map(order => `
    <div class="order-card" onclick="viewOrderDetails('${order.id}')">
      <h4>${order.product}</h4>
      <p>Quantity: ${order.quantity}</p>
      <p>Status: <strong>${order.status}</strong></p>
      <p>Order ID: ${order.id}</p>
    </div>
  `).join("");
}

function viewOrderDetails(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const product = products.find(p => p.name === order.product);
  document.getElementById('orderDetailsImage').src = product ? product.image : '';

  document.getElementById('orderDetailsId').textContent = order.id;
  document.getElementById('orderDetailsProduct').textContent = order.product;
  document.getElementById('orderDetailsQuantity').textContent = order.quantity;
  document.getElementById('orderDetailsStatus').textContent = order.status;
  document.getElementById('orderDetailsFullname').textContent = order.fullname || 'N/A';
  document.getElementById('orderDetailsEmail').textContent = order.email || 'N/A';
  document.getElementById('orderDetailsPhone').textContent = order.phone || 'N/A';
  document.getElementById('orderDetailsNotes').textContent = order.notes || 'No notes';

  document.getElementById('orderDetailsModal').style.display = 'flex';
}

function closeOrderDetailsModal() {
  document.getElementById('orderDetailsModal').style.display = 'none';
}

function openProductDetails(productId) {
  selectedProduct = products.find(p => p.id === productId);
  if (!selectedProduct) return;

  document.getElementById('detailsImage').src = selectedProduct.image;
  document.getElementById('detailsName').textContent = selectedProduct.name;
  document.getElementById('detailsCategory').textContent = selectedProduct.category;
  document.getElementById('detailsDescription').textContent = selectedProduct.description;
  document.getElementById('detailsPrice').textContent = `₱${selectedProduct.price.toFixed(2)}`;
  document.getElementById('detailsQuantity').value = 1;
  updateDetailsTotal();

  document.getElementById('productDetailsModal').style.display = 'flex';
}

function closeProductDetails() {
  document.getElementById('productDetailsModal').style.display = 'none';
}

function updateDetailsTotal() {
  const quantity = parseInt(document.getElementById("detailsQuantity").value) || 1;
  const price = selectedProduct ? selectedProduct.price : 0;
  const total = price * quantity;
  document.getElementById("detailsTotal").textContent = `₱${total.toFixed(2)}`;
}

function orderFromDetails() {
  if (!selectedProduct) return;

  const quantity = parseInt(document.getElementById("detailsQuantity").value) || 1;

  if (!auth.currentUser) {
    pendingOrder = { product: selectedProduct, quantity: quantity };
    closeProductDetails();
    openAuthModal('login');
    return;
  }

  closeProductDetails();

  document.getElementById("orderProduct").value = selectedProduct.name;
  document.getElementById("orderProductLabel").textContent = selectedProduct.name;
  document.getElementById("orderQuantity").value = quantity;
  document.getElementById("orderPrice").textContent = `₱${selectedProduct.price.toFixed(2)}`;
  updateTotal();
  loadSavedReceivers();

  document.getElementById("orderModal").style.display = "flex";
}

function updateTotal() {
  const quantity = parseInt(document.getElementById("orderQuantity").value) || 1;
  const price = selectedProduct ? selectedProduct.price : 0;
  const total = price * quantity;
  document.getElementById("orderTotal").textContent = `₱${total.toFixed(2)}`;
}

function closeOrderModal() {
  document.getElementById('orderModal').style.display = 'none';
}

function toggleUseMyDetails() {
  const useMyDetails = document.getElementById('useMyDetails').checked;
  if (auth.currentUser) {
    getDoc(doc(db, 'users', auth.currentUser.uid)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (useMyDetails) {
          document.getElementById('userFullname').value = data.fullname || '';
          document.getElementById('userEmail').value = data.email || '';
          document.getElementById('userPhone').value = data.phone || '';
        } else {
          document.getElementById('userFullname').value = '';
          document.getElementById('userEmail').value = '';
          document.getElementById('userPhone').value = '';
        }
      }
    });
  }
}

function loadSavedReceivers() {
  if (auth.currentUser) {
    getDoc(doc(db, 'users', auth.currentUser.uid)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const receivers = data.savedReceivers || [];
        const select = document.getElementById('savedReceivers');
        select.innerHTML = '<option value="">Select a saved receiver</option>';
        receivers.forEach((receiver, index) => {
          const option = document.createElement('option');
          option.value = index;
          option.textContent = `${receiver.fullname} (${receiver.email})`;
          select.appendChild(option);
        });
      }
    });
  }
}

function loadSelectedReceiver() {
  if (auth.currentUser) {
    getDoc(doc(db, 'users', auth.currentUser.uid)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const receivers = data.savedReceivers || [];
        const index = document.getElementById('savedReceivers').value;
        if (index !== '') {
          const receiver = receivers[index];
          if (receiver) {
            document.getElementById('userFullname').value = receiver.fullname;
            document.getElementById('userEmail').value = receiver.email;
            document.getElementById('userPhone').value = receiver.phone;
          }
        }
      }
    });
  }
}

function saveReceiverDetails() {
  const fullname = document.getElementById('userFullname').value;
  const email = document.getElementById('userEmail').value;
  const phone = document.getElementById('userPhone').value;
  if (!fullname || !email || !phone) {
    alert('Please fill in all fields before saving.');
    return;
  }
  if (auth.currentUser) {
    getDoc(doc(db, 'users', auth.currentUser.uid)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const receivers = data.savedReceivers || [];
        receivers.push({ fullname, email, phone });
        updateDoc(doc(db, 'users', auth.currentUser.uid), { savedReceivers: receivers });
        loadSavedReceivers();
        alert('Receiver details saved!');
      }
    });
  }
}

function deleteReceiverDetails() {
  const select = document.getElementById('savedReceivers');
  const index = select.value;
  if (index === '') {
    alert('Please select a receiver to delete.');
    return;
  }
  if (auth.currentUser) {
    getDoc(doc(db, 'users', auth.currentUser.uid)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const receivers = data.savedReceivers || [];
        receivers.splice(index, 1);
        updateDoc(doc(db, 'users', auth.currentUser.uid), { savedReceivers: receivers });
        loadSavedReceivers();
        document.getElementById('userFullname').value = '';
        document.getElementById('userEmail').value = '';
        document.getElementById('userPhone').value = '';
        alert('Receiver details deleted!');
      }
    });
  }
}

// Order Form Submission
document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!selectedProduct || !auth.currentUser) {
    alert('Please select a product and log in first.');
    return;
  }

  const fullname = document.getElementById("userFullname").value;
  const email = document.getElementById("userEmail").value;
  const phone = document.getElementById("userPhone").value;

  if (!fullname || !email || !phone) {
    alert('Please fill in the customer details before placing an order.');
    return;
  }

  const quantity = parseInt(document.getElementById("orderQuantity").value) || 1;

  const newOrder = {
    id: Date.now().toString(),
    product: selectedProduct.name,
    quantity: quantity,
    fullname: fullname,
    email: email,
    phone: phone,
    status: "Pending",
    user: auth.currentUser.email,
    accepted: false
  };

  await addDoc(collection(db, 'orders'), newOrder);
  orders = await loadOrders();
  renderUserOrders();
  alert("Order submitted!");
  closeOrderModal();
});

// Section Navigation
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

  // Update active nav link
  document.querySelectorAll(".nav-center a").forEach(link => {
    link.classList.remove("active");
    if (link.dataset.section === sectionId) {
      link.classList.add("active");
    }
  });

  // Load details when showing account or edit-details
  if (sectionId === 'account') {
    loadAccountDetails();
  } else if (sectionId === 'edit-details') {
    loadEditDetails();
  }
}

// Logout
function logoutUser() {
  signOut(auth);
  window.location.href = '../main/index.html';
}

// Make functions global
window.openProductDetails = openProductDetails;
window.closeProductDetails = closeProductDetails;
window.orderFromDetails = orderFromDetails;
window.updateTotal = updateTotal;
window.closeOrderModal = closeOrderModal;
window.toggleUseMyDetails = toggleUseMyDetails;
window.loadSavedReceivers = loadSavedReceivers;
window.loadSelectedReceiver = loadSelectedReceiver;
window.saveReceiverDetails = saveReceiverDetails;
window.deleteReceiverDetails = deleteReceiverDetails;
window.viewOrderDetails = viewOrderDetails;
window.closeOrderDetailsModal = closeOrderDetailsModal;
window.showSection = showSection;
window.logoutUser = logoutUser;
window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;