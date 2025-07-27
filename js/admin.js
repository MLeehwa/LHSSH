// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.init();
    }

    init() {
        this.loadDashboardStats();
        this.bindEvents();
        this.updateCurrentTime();
        this.startTimeUpdate();
    }

    bindEvents() {
        // Logout button - 여러 방법으로 찾기
        const logoutBtn = document.querySelector('button[onclick="logout()"]') || 
                         document.querySelector('.logout-btn') ||
                         document.querySelector('button:contains("로그아웃")');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    async loadDashboardStats() {
        try {
            // Simulate loading stats - replace with actual API calls
            const stats = await this.getMockStats();
            this.updateDashboardStats(stats);
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    async getMockStats() {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            totalParts: 156,
            todayInbound: 23,
            todayOutbound: 18,
            lowStock: 7
        };
    }

    updateDashboardStats(stats) {
        const elements = {
            totalParts: document.getElementById('totalParts'),
            todayInbound: document.getElementById('todayInbound'),
            todayOutbound: document.getElementById('todayOutbound'),
            lowStock: document.getElementById('lowStock')
        };

        // 요소가 존재하는 경우에만 업데이트
        Object.keys(elements).forEach(key => {
            if (elements[key]) {
                elements[key].textContent = stats[key];
            }
        });
    }

    updateCurrentTime() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            const now = new Date();
            const timeString = now.toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            timeElement.textContent = timeString;
        }
    }

    startTimeUpdate() {
        // 1초마다 시간 업데이트
        setInterval(() => {
            this.updateCurrentTime();
        }, 1000);
    }

    logout() {
        // Clear any stored authentication data
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        
        // Redirect to login page
        window.location.href = '../login.html';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// 전역 로그아웃 함수
function logout() {
    if (window.adminDashboard) {
        window.adminDashboard.logout();
    } else {
        // 기본 로그아웃 로직
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        window.location.href = '../login.html';
    }
}

// 전역 알림 함수
function showNotification(message, type = 'info') {
    if (window.adminDashboard) {
        window.adminDashboard.showNotification(message, type);
    } else {
        // 기본 알림 로직
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
}); 