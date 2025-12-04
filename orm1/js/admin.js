document.addEventListener('DOMContentLoaded', function() {
    loadStats();
});

function showSection(sectionName) {
    document.getElementById('statsSection').style.display = 'none';
    document.getElementById('allLoginsSection').style.display = 'none';
    document.getElementById('usersSection').style.display = 'none';
    
    document.getElementById(sectionName + 'Section').style.display = 'block';
    
    if (sectionName === 'stats') {
        loadStats();
    } else if (sectionName === 'allLogins') {
        loadAllLogins();
    } else if (sectionName === 'users') {
        loadUsers();
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/admin/login-stats');
        if (!response.ok) {
            throw new Error('Ошибка загрузки статистики');
        }
        const stats = await response.json();
        
        const tableBody = document.getElementById('statsTableBody');
        tableBody.innerHTML = '';
        
        stats.forEach(stat => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${stat.username}</td>
                <td>${stat.email}</td>
                <td>${stat.login_count}</td>
                <td>${stat.last_login ? new Date(stat.last_login).toLocaleString() : 'Никогда'}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Ошибка при загрузке статистики:', error);
        alert('Ошибка при загрузке статистики: ' + error.message);
    }
}

async function loadAllLogins() {
    try {
        const response = await fetch('/api/admin/all-logins?limit=50');
        if (!response.ok) {
            throw new Error('Ошибка загрузки истории входов');
        }
        const logins = await response.json();
        
        const tableBody = document.getElementById('allLoginsTableBody');
        tableBody.innerHTML = '';
        
        if (logins.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">История входов отсутствует</td></tr>';
        } else {
            logins.forEach(login => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(login.login_time).toLocaleString()}</td>
                    <td>${login.user.username} (${login.user.email})</td>
                    <td>${login.ip_address}</td>
                    <td title="${login.user_agent}">${truncateUserAgent(login.user_agent)}</td>
                `;
                tableBody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Ошибка при загрузке истории входов:', error);
        alert('Ошибка при загрузке истории входов: ' + error.message);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        if (!response.ok) {
            throw new Error('Ошибка загрузки пользователей');
        }
        const users = await response.json();
        
        const tableBody = document.getElementById('usersTableBody');
        tableBody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${new Date(user.created_at).toLocaleString()}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Ошибка при загрузке пользователей:', error);
        alert('Ошибка при загрузке пользователей: ' + error.message);
    }
}

function truncateUserAgent(userAgent) {
    if (userAgent.length > 50) {
        return userAgent.substring(0, 50) + '...';
    }
    return userAgent;
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Ошибка при выходе:', error);
    }
}