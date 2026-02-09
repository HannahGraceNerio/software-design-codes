import { GLOBAL_STATE } from '../constants/config.js';
import { showAlert, showLoading, hideLoading } from '../ui/alerts.js';
import { updateNavigation } from './navigation.js';

export async function login(email, password) {
    try {
        showLoading();
        const auth = window.firebaseAuth || firebase.auth();
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        GLOBAL_STATE.currentUser = userCredential.user;
        
        const db = window.firebaseDb || firebase.firestore();
        const userDoc = await db.collection('users').doc(GLOBAL_STATE.currentUser.uid).get();
        
        if (userDoc.exists) {
            GLOBAL_STATE.currentUserRole = userDoc.data().role || 'user';
        } else {
            await db.collection('users').doc(GLOBAL_STATE.currentUser.uid).set({
                name: GLOBAL_STATE.currentUser.displayName || email.split('@')[0],
                email: email,
                role: 'user',
                createdAt: new Date().toISOString(),
                phone: '',
                address: ''
            });
            GLOBAL_STATE.currentUserRole = 'user';
        }
        
        // Admin special handling
        if (email === 'admin@favoredandguided.com') {
            await db.collection('users').doc(GLOBAL_STATE.currentUser.uid).update({ role: 'admin' });
            GLOBAL_STATE.currentUserRole = 'admin';
        }
        
        hideLoading();
        showAlert('Welcome back! You are now signed in.', 'success');
        
        if (GLOBAL_STATE.currentUserRole === 'admin') {
            window.showPage('admin');
        } else {
            window.showPage('account');
        }
        
        updateNavigation();
        return true;
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
        return false;
    }
}

export async function signup(name, email, password) {
    try {
        showLoading();
        const auth = window.firebaseAuth || firebase.auth();
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        GLOBAL_STATE.currentUser = userCredential.user;
        
        const db = window.firebaseDb || firebase.firestore();
        await db.collection('users').doc(GLOBAL_STATE.currentUser.uid).set({
            name: name,
            email: email,
            role: 'user',
            createdAt: new Date().toISOString(),
            phone: '',
            address: '',
            updatedAt: new Date().toISOString()
        });
        
        await GLOBAL_STATE.currentUser.updateProfile({ displayName: name });
        GLOBAL_STATE.currentUserRole = 'user';
        
        hideLoading();
        showAlert('Account created successfully! Welcome to Favored & Guided.', 'success');
        window.showPage('account');
        updateNavigation();
        
        return true;
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
        return false;
    }
}

export async function logout() {
    try {
        const auth = window.firebaseAuth || firebase.auth();
        await auth.signOut();
        GLOBAL_STATE.currentUser = null;
        GLOBAL_STATE.currentUserRole = 'user';
        GLOBAL_STATE.selectedOrdersForBulkAction.clear();
        
        showAlert('You have been signed out. Come back soon!', 'info');
        window.showPage('home');
        updateNavigation();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

export async function resetPassword(email) {
    try {
        showLoading();
        const auth = window.firebaseAuth || firebase.auth();
        await auth.sendPasswordResetEmail(email);
        hideLoading();
        showAlert('Password reset email sent! Check your inbox.', 'success');
        window.showAuthModal('login');
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
    }
}