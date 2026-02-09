import { GLOBAL_STATE } from '../constants/config.js';
import { showAlert, showLoading, hideLoading } from '../ui/alerts.js';

export async function loadAccountContent() {
    showTab('profile');
    
    if (GLOBAL_STATE.currentUser) {
        try {
            const db = window.firebaseDb || firebase.firestore();
            const userDoc = await db.collection('users').doc(GLOBAL_STATE.currentUser.uid).get();
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
                            <div class="p-md bg-wood-light rounded-md">${userData.email || GLOBAL_STATE.currentUser.email}</div>
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
                document.getElementById('editEmail').value = userData.email || GLOBAL_STATE.currentUser.email;
                document.getElementById('editPhone').value = userData.phone || '';
                document.getElementById('editAddress').value = userData.address || '';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    window.loadUserOrders();
    window.initNewOrderForm();
    window.loadChatTab();
}

export function showTab(tabId) {
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
        window.loadUserOrders();
    } else if (tabId === 'new-order') {
        window.initNewOrderForm();
    } else if (tabId === 'chat') {
        window.loadChatTab();
    }
}

export async function saveProfile() {
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
        await db.collection('users').doc(GLOBAL_STATE.currentUser.uid).update({
            name: name,
            email: email,
            phone: phone,
            address: address,
            updatedAt: new Date().toISOString()
        });
        
        // Update auth email if changed
        if (email !== GLOBAL_STATE.currentUser.email) {
            await GLOBAL_STATE.currentUser.updateEmail(email);
        }
        
        // Update profile name
        await GLOBAL_STATE.currentUser.updateProfile({
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

export function editProfile() {
    document.getElementById('profileView').classList.add('hidden');
    document.getElementById('profileEditForm').classList.remove('hidden');
}

export function cancelEdit() {
    document.getElementById('profileView').classList.remove('hidden');
    document.getElementById('profileEditForm').classList.add('hidden');
}