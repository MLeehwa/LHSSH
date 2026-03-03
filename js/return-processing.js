// Return Processing JavaScript
class ReturnProcessing {
    constructor() {
        this.supabase = null;
        this.returnRecords = [];
        this.filteredRecords = [];
        this.allParts = [];
    }

    async init() {
        try {
            // Supabase 초기화
            if (window.supabaseClient) {
                this.supabase = window.supabaseClient;
            } else if (typeof supabase !== 'undefined' && window.getCurrentConfig) {
                const config = window.getCurrentConfig();
                this.supabase = supabase.createClient(config.url, config.anonKey);
            }

            if (!this.supabase) {
                console.error('Supabase 클라이언트 초기화 실패');
                this.showNotification('데이터베이스 연결 실패', 'error');
                return;
            }

            console.log('ReturnProcessing 초기화 완료');
            this.bindEvents();
            await this.loadParts();
            await this.loadReturnRecords();
            this.updateCurrentTime();
            setInterval(() => this.updateCurrentTime(), 1000);
        } catch (error) {
            console.error('ReturnProcessing 초기화 오류:', error);
        }
    }

    bindEvents() {
        document.getElementById('newReturnBtn')?.addEventListener('click', () => this.openModal());
        document.getElementById('cancelReturn')?.addEventListener('click', () => this.closeModal());
        document.getElementById('saveReturn')?.addEventListener('click', () => this.saveReturn());
        document.getElementById('applyFilter')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('resetFilter')?.addEventListener('click', () => this.resetFilters());

        // 모달 바깥 클릭 시 닫기
        document.getElementById('returnModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'returnModal') this.closeModal();
        });
    }

    async loadParts() {
        try {
            const { data, error } = await this.supabase
                .from('parts')
                .select('part_number')
                .eq('status', 'ACTIVE')
                .order('part_number');

            if (error) throw error;
            this.allParts = data || [];

            // 파트 선택 드롭다운 업데이트
            const select = document.getElementById('returnPartNumber');
            if (select) {
                select.innerHTML = '<option value="">파트를 선택하세요</option>' +
                    this.allParts.map(p => `<option value="${p.part_number}">${p.part_number}</option>`).join('');
            }
        } catch (error) {
            console.error('파트 목록 로드 오류:', error);
        }
    }

    async loadReturnRecords() {
        try {
            const { data, error } = await this.supabase
                .from('return_records')
                .select('*')
                .order('return_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.returnRecords = data || [];
            this.filteredRecords = [...this.returnRecords];
            this.renderTable();
            this.updateStats();
            console.log('반품 내역 로드 완료:', this.returnRecords.length, '건');
        } catch (error) {
            console.error('반품 내역 로드 오류:', error);
            this.showNotification('반품 데이터 로드 실패', 'error');
        }
    }

    renderTable() {
        const tbody = document.getElementById('returnTableBody');
        if (!tbody) return;

        if (this.filteredRecords.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">반품 내역이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = this.filteredRecords.map(record => {
            const returnDate = record.return_date ? (record.return_date.includes('T') ? record.return_date.split('T')[0] : record.return_date) : '-';
            const createdAt = record.created_at ? new Date(record.created_at).toLocaleString('ko-KR') : '-';

            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${returnDate}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">${record.part_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-semibold">${(record.quantity || 0).toLocaleString()}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${record.reason || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdAt}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                        <button onclick="window.returnProcessing.deleteReturn(${record.id})"
                                class="text-red-600 hover:text-red-800 text-xs px-2 py-1 border border-red-300 rounded hover:bg-red-50 transition-colors">
                            <i class="fas fa-trash mr-1"></i>삭제
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateStats() {
        const todayStr = window.getLocalDateString ? window.getLocalDateString() : (() => {
            const n = new Date();
            return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
        })();

        const todayRecords = this.returnRecords.filter(r => {
            const d = r.return_date ? (r.return_date.includes('T') ? r.return_date.split('T')[0] : r.return_date) : '';
            return d === todayStr;
        });

        const totalEl = document.getElementById('totalReturns');
        const todayEl = document.getElementById('todayReturns');
        const todayQtyEl = document.getElementById('todayReturnQty');
        const uniqueEl = document.getElementById('uniqueParts');

        if (totalEl) totalEl.textContent = this.returnRecords.length;
        if (todayEl) todayEl.textContent = todayRecords.length;
        if (todayQtyEl) todayQtyEl.textContent = todayRecords.reduce((sum, r) => sum + (r.quantity || 0), 0).toLocaleString();
        if (uniqueEl) uniqueEl.textContent = new Set(this.returnRecords.map(r => r.part_number)).size;
    }

    applyFilters() {
        const dateFilter = document.getElementById('dateFilter')?.value || '';
        const partFilter = (document.getElementById('partFilter')?.value || '').toLowerCase();

        this.filteredRecords = this.returnRecords.filter(record => {
            const recordDate = record.return_date ? (record.return_date.includes('T') ? record.return_date.split('T')[0] : record.return_date) : '';
            const matchesDate = !dateFilter || recordDate === dateFilter;
            const matchesPart = !partFilter || record.part_number.toLowerCase().includes(partFilter);
            return matchesDate && matchesPart;
        });

        this.renderTable();
    }

    resetFilters() {
        const dateFilter = document.getElementById('dateFilter');
        const partFilter = document.getElementById('partFilter');
        if (dateFilter) dateFilter.value = '';
        if (partFilter) partFilter.value = '';

        this.filteredRecords = [...this.returnRecords];
        this.renderTable();
    }

    openModal() {
        const modal = document.getElementById('returnModal');
        if (modal) modal.classList.remove('hidden');

        // 오늘 날짜 기본값
        const dateInput = document.getElementById('returnDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = window.getLocalDateString ? window.getLocalDateString() : new Date().toISOString().split('T')[0];
        }
    }

    closeModal() {
        const modal = document.getElementById('returnModal');
        if (modal) modal.classList.add('hidden');

        // 입력 초기화
        const qty = document.getElementById('returnQuantity');
        const reason = document.getElementById('returnReason');
        const partSelect = document.getElementById('returnPartNumber');
        if (qty) qty.value = '';
        if (reason) reason.value = '';
        if (partSelect) partSelect.value = '';
    }

    async saveReturn() {
        const returnDate = document.getElementById('returnDate')?.value;
        const partNumber = document.getElementById('returnPartNumber')?.value;
        const quantity = parseInt(document.getElementById('returnQuantity')?.value) || 0;
        const reason = document.getElementById('returnReason')?.value?.trim() || '';

        if (!returnDate) {
            this.showNotification('반품 날짜를 선택하세요.', 'error');
            return;
        }
        if (!partNumber) {
            this.showNotification('파트 번호를 선택하세요.', 'error');
            return;
        }
        if (quantity <= 0) {
            this.showNotification('반품 수량을 입력하세요.', 'error');
            return;
        }

        try {
            // 1. return_records에 반품 기록 저장
            const { data, error } = await this.supabase
                .from('return_records')
                .insert({
                    return_date: returnDate,
                    part_number: partNumber,
                    quantity: quantity,
                    reason: reason,
                    status: 'COMPLETED'
                })
                .select();

            if (error) throw error;

            // 2. inventory 테이블의 current_stock 차감
            const { data: invData } = await this.supabase
                .from('inventory')
                .select('current_stock')
                .eq('part_number', partNumber)
                .single();

            if (invData) {
                const newStock = (invData.current_stock || 0) - quantity;
                await this.supabase
                    .from('inventory')
                    .update({
                        current_stock: newStock,
                        last_updated: new Date().toISOString()
                    })
                    .eq('part_number', partNumber);
            }

            this.showNotification(`${partNumber} 반품 ${quantity}개 처리 완료`, 'success');
            this.closeModal();
            await this.loadReturnRecords();

        } catch (error) {
            console.error('반품 저장 오류:', error);
            this.showNotification('반품 저장 중 오류가 발생했습니다: ' + (error.message || ''), 'error');
        }
    }

    async deleteReturn(id) {
        if (!confirm('이 반품 기록을 삭제하시겠습니까? 재고가 복구됩니다.')) return;

        try {
            // 반품 기록 조회
            const { data: record } = await this.supabase
                .from('return_records')
                .select('*')
                .eq('id', id)
                .single();

            if (!record) {
                this.showNotification('반품 기록을 찾을 수 없습니다.', 'error');
                return;
            }

            // 1. 반품 기록 삭제
            const { error } = await this.supabase
                .from('return_records')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // 2. inventory 재고 복구
            const { data: invData } = await this.supabase
                .from('inventory')
                .select('current_stock')
                .eq('part_number', record.part_number)
                .single();

            if (invData) {
                const newStock = (invData.current_stock || 0) + record.quantity;
                await this.supabase
                    .from('inventory')
                    .update({
                        current_stock: newStock,
                        last_updated: new Date().toISOString()
                    })
                    .eq('part_number', record.part_number);
            }

            this.showNotification('반품 기록 삭제 및 재고 복구 완료', 'success');
            await this.loadReturnRecords();

        } catch (error) {
            console.error('반품 삭제 오류:', error);
            this.showNotification('반품 삭제 중 오류가 발생했습니다.', 'error');
        }
    }

    updateCurrentTime() {
        const el = document.getElementById('currentTime');
        if (el) {
            el.textContent = new Date().toLocaleTimeString('ko-KR');
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification');
        if (!container) return;

        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };

        container.innerHTML = `
            <div class="${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg">
                ${message}
            </div>
        `;
        container.classList.remove('hidden');
        setTimeout(() => container.classList.add('hidden'), 3000);
    }
}

// 로그아웃
function logout() {
    window.location.href = '../login.html';
}

// 초기화
let returnProcessing;
window.returnProcessing = null;

document.addEventListener('DOMContentLoaded', async () => {
    const waitForDeps = () => new Promise(resolve => {
        const check = () => {
            if (typeof window.getCurrentConfig !== 'undefined') {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });

    try {
        await waitForDeps();
        returnProcessing = new ReturnProcessing();
        window.returnProcessing = returnProcessing;
        await returnProcessing.init();
    } catch (error) {
        console.error('초기화 실패:', error);
    }
});
