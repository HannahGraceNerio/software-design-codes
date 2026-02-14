// Shared data (load from localStorage)
let orders = loadOrders();
let products = loadProducts();

// Check if admin is logged in
document.addEventListener('DOMContentLoaded', function() {
  const { role } = loadUser();
  if (role !== 'admin') {
    alert('Access denied. Redirecting to home.');
    window.location.href = '../main/index.html';
    return;
  }
  showSection('products'); // Default to products section
  renderAdminProducts();
  renderAdminOrders();
  renderCompletedOrders();

  // Add event listeners for nav links
  document.querySelectorAll('.nav-center a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(e.target.dataset.section);
    });
  });

  // Add event listener for logout button
  document.querySelector('.nav-right .btn-primary').addEventListener('click', logoutAdmin);

  // Add event listener for add product button
  document.querySelector('#products .btn-primary').addEventListener('click', openAddProductModal);

  // Add event listeners for order tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.dataset.tab;
      switchOrderTab(tab);
    });
  });

  // Add Product Form Submission
  const addProductForm = document.getElementById('addProductForm');
  addProductForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = addProductForm.querySelector('input[name="name"]').value;
    const category = addProductForm.querySelector('input[name="category"]').value;
    const price = parseFloat(addProductForm.querySelector('input[name="price"]').value);
    const image = document.getElementById('addImagePreview').src; // Get data URL from preview

    if (name && category && price && image) {
      products.push({ name, category, price, image });
      saveProducts(products); // Save to localStorage
      renderAdminProducts(); // Re-render to show new product
      closeAddProductModal();
      addProductForm.reset(); // Clear form
      document.getElementById('addImagePreview').style.display = 'none'; // Hide preview
    } else {
      alert('Please fill in all fields and select an image.');
    }
  });

  // Edit Product Form Submission
  const editProductForm = document.getElementById('editProductForm');
  editProductForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('editProductIndex').value);
    const name = document.getElementById('editName').value;
    const category = document.getElementById('editCategory').value;
    const price = parseFloat(document.getElementById('editPrice').value);
    const image = document.getElementById('editImagePreview').src; // Get data URL from preview

    if (name && category && price && image) {
      products[index] = { name, category, price, image };
      saveProducts(products); // Save to localStorage
      renderAdminProducts(); // Re-render to update edited product
      closeEditProductModal();
    } else {
      alert('Please fill in all fields.');
    }
  });

  // File input event listeners for previews
  document.getElementById('addImageFile').addEventListener('change', previewAddImage);
  document.getElementById('editImageFile').addEventListener('change', previewImage);
});

function renderAdminProducts() {
  const container = document.getElementById("adminProducts");
  if (!container) return;

  container.innerHTML = products.map((p, index) => `
    <article class="product-card admin-product-card">
      <img src="${p.image}" alt="${p.name}" />
      <span class="category">${p.category}</span>
      <h3>${p.name}</h3>
      <p class="price">₱${p.price.toFixed(2)}</p>  <!-- Philippine Peso with 2 decimals -->
      <div class="admin-actions">
        <button class="btn-outline" onclick="openEditProductModal(${index})">Edit</button>
        <button class="btn-primary" onclick="deleteProduct(${index})">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderAdminOrders() {
  const container = document.getElementById("adminOrders");
  if (!container) return;

  // Filter out completed orders for active orders section
  const activeOrders = orders.filter(order => order.status !== 'Completed');
  container.innerHTML = activeOrders.map(order => {
    const statusClass = `status-${order.status.toLowerCase().replace(/\s+/g, '-')}`;
    return `
      <article class="order-card ${statusClass}">
        <div class="order-header">
          <h4 class="order-product">${order.product}</h4>
          <span class="order-status">${order.status}</span>
        </div>
        <div class="order-details">
          <p><i class="fas fa-user"></i> User: ${order.user}</p>
          <p><i class="fas fa-shopping-cart"></i> Quantity: ${order.quantity}</p>
        </div>
        <div class="order-actions">
          ${order.accepted ? `
            <button class="btn-outline" onclick="event.stopPropagation(); updateOrder(${order.id}, 'Preparing')">Preparing</button>
            <button class="btn-outline" onclick="event.stopPropagation(); updateOrder(${order.id}, 'Ready to Pick Up')">Ready</button>
            <button class="btn-primary" onclick="event.stopPropagation(); updateOrder(${order.id}, 'Completed')">Completed</button>
          ` : `
            <button class="btn-primary" onclick="event.stopPropagation(); acceptOrder(${order.id})">Accept</button>
            <button class="btn-danger" onclick="event.stopPropagation(); rejectOrder(${order.id})">Reject</button>
          `}
        </div>
      </article>
    `;
  }).join("");
}

function renderCompletedOrders() {
  const container = document.getElementById("completedOrders");
  if (!container) return;

  // Filter for completed orders
  const completedOrders = orders.filter(order => order.status === 'Completed');
  container.innerHTML = completedOrders.map(order => {
    return `
      <article class="order-card status-completed">
        <div class="order-header">
          <h4 class="order-product">${order.product}</h4>
          <span class="order-status">${order.status}</span>
        </div>
        <div class="order-details">
          <p><i class="fas fa-user"></i> User: ${order.user}</p>
          <p><i class="fas fa-shopping-cart"></i> Quantity: ${order.quantity}</p>
        </div>
        <div class="order-actions">
          <button class="btn-outline" onclick="event.stopPropagation(); viewOrderDetails(${order.id})">View Details</button>
        </div>
      </article>
    `;
  }).join("");
}

function switchOrderTab(tab) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  // Remove active class from all tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  // Show selected tab content and mark tab as active
  document.getElementById(`${tab}OrdersTab`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
}

function acceptOrder(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;
  order.accepted = true;
  order.status = "Accepted";
  saveOrders(orders); // Save to localStorage
  renderAdminOrders();
  renderCompletedOrders();
  animateOrderUpdate(id);
}

function rejectOrder(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;
  order.status = "Rejected";
  saveOrders(orders); // Save to localStorage
  renderAdminOrders();
  renderCompletedOrders();
  animateOrderUpdate(id);
}

function updateOrder(id, newStatus) {
  const order = orders.find(o => o.id === id);
  if (!order || !order.accepted) return;
  order.status = newStatus;
  saveOrders(orders); // Save to localStorage
  renderAdminOrders();
  renderCompletedOrders(); // Re-render both sections
  animateOrderUpdate(id);
}

function animateOrderUpdate(orderId) {
  const card = document.querySelector(`.order-card[onclick*="viewOrderDetails(${orderId})"]`);
  if (card) {
    card.classList.add('updated');
    setTimeout(() => {
      card.classList.remove('updated');
    }, 500); // Remove after animation duration
  }
}

function openAddProductModal() {
  document.getElementById('addProductModal').style.display = 'flex';
}

function closeAddProductModal() {
  document.getElementById('addProductModal').style.display = 'none';
}

function openEditProductModal(index) {
  const p = products[index];
  document.getElementById('editProductIndex').value = index;
  document.getElementById('editName').value = p.name;
  document.getElementById('editCategory').value = p.category;
  document.getElementById('editPrice').value = p.price;
  document.getElementById('editImagePreview').src = p.image;
  document.getElementById('editImagePreview').style.display = 'block';
  document.getElementById('editProductModal').style.display = 'flex';
}

function closeEditProductModal() {
  document.getElementById('editProductModal').style.display = 'none';
}

function previewAddImage() {
  const file = document.getElementById('addImageFile').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('addImagePreview').src = e.target.result;
      document.getElementById('addImagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

function previewImage() {
  const file = document.getElementById('editImageFile').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('editImagePreview').src = e.target.result;
      document.getElementById('editImagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

function deleteProduct(index) {
  if (confirm("Delete this product?")) {
    products.splice(index, 1); // Remove from array
    saveProducts(products); // Save to localStorage
    renderAdminProducts(); // Re-render to shift products and close the gap
  }
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
}

function logoutAdmin() {
  clearUser(); // Clear via shared
  window.location.href = '../main/index.html';
}

// Make functions global
window.openAddProductModal = openAddProductModal;
window.closeAddProductModal = closeAddProductModal;
window.openEditProductModal = openEditProductModal;
window.closeEditProductModal = closeEditProductModal;
window.deleteProduct = deleteProduct;
window.viewOrderDetails = viewOrderDetails;
window.closeOrderDetailsModal = closeOrderDetailsModal;
window.showSection = showSection;
window.logoutAdmin = logoutAdmin;
window.switchOrderTab = switchOrderTab;
window.acceptOrder = acceptOrder;
window.rejectOrder = rejectOrder;
window.updateOrder = updateOrder;