document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname === '/login' || window.location.pathname === '/register') {
        checkAuth();
    }
});

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        const result = await response.json();
        
        if (result.authenticated) {
            window.location.href = '/dashboard';
        }
    } catch (error) {
        console.error('Ошибка при проверке авторизации:', error);
    }
}




const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(loginForm);
        const data = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            const messageDiv = document.getElementById('message');
            
            if (result.error) {
                messageDiv.textContent = result.error;
                messageDiv.className = 'message error';
            } else {
                messageDiv.textContent = 'Вход выполнен успешно! Перенаправление...';
                messageDiv.className = 'message success';
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            }
        } catch (error) {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = 'Ошибка сети';
            messageDiv.className = 'message error';
        }
    });
}




const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(registerForm);
        const data = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            image: formData.get('image') || ''
        };

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            const messageDiv = document.getElementById('message');
            
            if (result.error) {
                messageDiv.textContent = result.error;
                messageDiv.className = 'message error';
            } else {
                messageDiv.textContent = 'Регистрация успешна! Перенаправление...';
                messageDiv.className = 'message success';
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            }
        } catch (error) {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = 'Ошибка сети';
            messageDiv.className = 'message error';
        }
    });
}