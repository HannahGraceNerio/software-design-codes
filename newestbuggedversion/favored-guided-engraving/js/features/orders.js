import { GLOBAL_STATE } from '../constants/config.js';
import { showAlert, showLoading, hideLoading } from '../ui/alerts.js';
import { STATUS_CONFIGS } from '../constants/status-configs.js';

export function getStatusConfig(status) {
    return STATUS_CONFIGS[status] || STATUS_CONFIGS.pending;
}

export async function submitOrder() {
    try {
        if (!GLOBAL_STATE.currentUser) {
            showAlert('Please login to place an order', 'error');
            window.showAuthModal('login');
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
            userId: GLOBAL_STATE.currentUser.uid,
            userName: GLOBAL_STATE.currentUser.displayName || (await getUserName()),
            userEmail: GLOBAL_STATE.currentUser.email,
            status: 'pending',
            createdAt: timestamp.toISOString(),
            updatedAt: timestamp.toISOString(),
            orderType: GLOBAL_STATE.selectedOrderType
        };
        
        if (GLOBAL_STATE.selectedOrderType === 'pre-listed' && GLOBAL_STATE.selectedProduct) {
            orderData.productId = GLOBAL_STATE.selectedProduct.id;
            orderData.productName = GLOBAL_STATE.selectedProduct.name;
            orderData.basePrice = GLOBAL_STATE.selectedProduct.basePrice;
            orderData.engravingText = document.getElementById('engravingText')?.value || '';
            orderData.notes = document.getElementById('orderNotes')?.value || '';
            orderData.totalAmount = GLOBAL_STATE.selectedProduct.basePrice;
            orderData.category = GLOBAL_STATE.selectedProduct.category;
            orderData.material = GLOBAL_STATE.selectedProduct.material;
            orderData.dimensions = GLOBAL_STATE.selectedProduct.dimensions;
            orderData.imageUrl = GLOBAL_STATE.selectedProduct.image;
        } else {
            orderData.description = document.getElementById('customDescription')?.value || '';
            orderData.material = document.getElementById('customMaterial')?.value || '';
            orderData.dimensions = document.getElementById('customDimensions')?.value || '';
            orderData.engravingText = document.getElementById('customEngraving')?.value || '';
            orderData.notes = document.getElementById('customNotes')?.value || '';
            orderData.productName = 'Custom Request';
            orderData.totalAmount = 0;
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
        
        await db.collection('orders').doc(orderId).set(orderData);
        
        // Show confirmation
        GLOBAL_STATE.currentOrderStep = 4;
        window.initNewOrderForm();
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
        const userDoc = await db.collection('users').doc(GLOBAL_STATE.currentUser.uid).get();
        return userDoc.exists ? userDoc.data().name : GLOBAL_STATE.currentUser.email.split('@')[0];
    } catch {
        return GLOBAL_STATE.currentUser.email.split('@')[0];
    }
}

// ... CONTINUE with all order-related functions from original app.js