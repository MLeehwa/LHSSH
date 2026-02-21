// ==================== 공통 사이드바 컴포넌트 ====================
// 모든 admin 페이지에서 동일한 사이드바를 사용하도록 통일
(function () {
    'use strict';

    const MENU_ITEMS = [
        { href: 'index.html', icon: 'fas fa-tachometer-alt', label: '대시보드' },
        { href: 'part-registration.html', icon: 'fas fa-plus-circle', label: '파트 등록' },
        { href: 'inbound-status.html', icon: 'fas fa-arrow-down', label: '입고 현황' },
        { href: 'outbound-status.html', icon: 'fas fa-arrow-up', label: '출고 현황' },
        { href: 'inventory-status.html', icon: 'fas fa-boxes', label: '재고 현황' },
        { href: 'outbound-summary.html', icon: 'fas fa-chart-bar', label: '출하 현황' },
        { href: 'physical-inventory.html', icon: 'fas fa-clipboard-check', label: '실사 관리', special: true },
        { href: 'daily-inventory-enhanced.html', icon: 'fas fa-calendar-day', label: '일일 재고' }
    ];

    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        return filename.split('?')[0]; // 쿼리 파라미터 제거
    }

    // 캐시 버스팅: 페이지 이동 시 타임스탬프 추가하여 브라우저 캐시 우회
    function cacheBustUrl(href) {
        return `${href}?_t=${Date.now()}`;
    }

    function renderSidebar() {
        const container = document.getElementById('shared-sidebar');
        if (!container) return;

        const currentPage = getCurrentPage();

        const navItems = MENU_ITEMS.map(item => {
            const isActive = item.href === currentPage;
            const classes = ['ds-nav-item'];
            if (isActive) classes.push('active');
            if (item.special) classes.push('nav-special');

            return `<a href="${cacheBustUrl(item.href)}" class="${classes.join(' ')}">
                <i class="${item.icon}"></i>
                <span>${item.label}</span>
            </a>`;
        }).join('\n                ');

        container.innerHTML = `
            <div class="ds-sidebar-header">
                <div class="ds-sidebar-logo">
                    <div class="ds-sidebar-logo-icon"><i class="fas fa-barcode"></i></div>
                    <div>
                        <div class="ds-sidebar-logo-text">이화 - 서한</div>
                        <div class="ds-sidebar-logo-sub">관리자 패널</div>
                    </div>
                </div>
            </div>
            <nav class="ds-sidebar-nav">
                <div class="ds-nav-section-title">메뉴</div>
                ${navItems}
            </nav>
            <div class="ds-sidebar-footer">
                <div class="ds-sidebar-user">
                    <div class="ds-sidebar-avatar"><i class="fas fa-user"></i></div>
                    <div class="ds-sidebar-user-info">
                        <div class="ds-sidebar-user-name">관리자</div>
                        <button onclick="logout()" class="ds-sidebar-logout">
                            <i class="fas fa-sign-out-alt mr-1"></i>로그아웃
                        </button>
                    </div>
                </div>
                <div class="ds-sidebar-time">
                    <div class="ds-sidebar-time-label">현재 시간</div>
                    <div id="currentTime" class="ds-sidebar-time-value"></div>
                </div>
            </div>`;
    }

    // DOM 로드 시 사이드바 렌더링
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderSidebar);
    } else {
        renderSidebar();
    }
})();
