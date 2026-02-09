import { GLOBAL_STATE } from '../constants/config.js';
import { showAlert, showLoading, hideLoading } from '../ui/alerts.js';
import { STATUS_CONFIGS } from '../constants/status-configs.js';

export async function loadAdminContent() {
    showAdminTab('overview');
}

export function showAdminTab(tabId) {
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
                                            <span class="status-badge ${STATUS_CONFIGS[order.status]?.class || 'status-pending'}">
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
                            <button class="btn btn-primary btn-block" onclick="window.showAdminTab('orders')">
                                <i class="fas fa-clipboard-list mr-sm"></i> Manage Orders
                            </button>
                            <button class="btn btn-outline btn-block" onclick="window.showAdminTab('manage-products')">
                                <i class="fas fa-boxes mr-sm"></i> Manage Products
                            </button>
                            <button class="btn btn-outline btn-block" onclick="window.showAdminTab('messages')">
                                <i class="fas fa-comments mr-sm"></i> View Messages
                            </button>
                            <button class="btn btn-outline btn-block" onclick="window.showAdminTab('users')">
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

// ... CONTINUE with all admin functions