import { showAlert } from '../ui/alerts.js';

export function showAuthModal(type) {
    const modal = document.getElementById('authModal');
    const modalTitle = document.getElementById('authModalTitle');
    const modalBody = document.querySelector('#authModal .modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    if (type === 'login') {
        modalTitle.textContent = 'Welcome Back';
        modalBody.innerHTML = `
            <form id="loginForm" class="space-y-lg">
                <div id="loginError" class="alert alert-error hidden"></div>
                
                <div class="form-group">
                    <label for="loginEmail" class="form-label">Email Address</label>
                    <input type="email" id="loginEmail" class="form-control" placeholder="you@example.com" required>
                </div>

                <div class="form-group">
                    <label for="loginPassword" class="form-label">Password</label>
                    <div class="password-input">
                        <input type="password" id="loginPassword" class="form-control" placeholder="••••••••" required>
                        <button type="button" class="password-toggle" onclick="window.togglePassword('loginPassword')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-xs">
                            <input type="checkbox" id="rememberMe" class="form-check-input">
                            <label for="rememberMe" class="form-label" style="margin: 0; font-weight: normal;">Remember me</label>
                        </div>
                        <a href="#" class="text-sm text-gold" onclick="showAuthModal('reset')">Forgot password?</a>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-block">
                    Sign In
                </button>
                
                <div class="or-divider">
                    <span>or continue with</span>
                </div>
                
                <div class="social-login-buttons">
                    <button type="button" class="btn-social btn-google" onclick="window.signInWithGoogle()">
                        <i class="fab fa-google"></i> Google
                    </button>
                    <button type="button" class="btn-social btn-facebook" onclick="window.signInWithFacebook()">
                        <i class="fab fa-facebook-f"></i> Facebook
                    </button>
                </div>
            </form>

            <div class="mt-lg text-center">
                <p class="text-sm text-brown-medium">
                    Don't have an account?
                    <a href="#" class="text-gold font-medium" onclick="showAuthModal('signup')">
                        Sign up
                    </a>
                </p>
            </div>
        `;
        
        setTimeout(() => {
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    const email = document.getElementById('loginEmail').value;
                    const password = document.getElementById('loginPassword').value;
                    const success = await window.login(email, password);
                    if (success) {
                        closeAuthModal();
                    }
                });
            }
        }, 100);
        
    } else if (type === 'signup') {
        // ... signup modal HTML
    } else if (type === 'reset') {
        // ... reset modal HTML
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

export function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

export function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggleBtn = input.parentElement.querySelector('.password-toggle i');
    
    if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.classList.remove('fa-eye');
        toggleBtn.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        toggleBtn.classList.remove('fa-eye-slash');
        toggleBtn.classList.add('fa-eye');
    }
}