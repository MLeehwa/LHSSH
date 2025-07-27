class DailyInventoryTracker {
    constructor() {
        this.supabase = null;
        this.currentDate = new Date().toISOString().split('T')[0];
        this.dailyData = [];
        this.summaryData = null;
        this.errorData = [];
        
        this.initializeSupabase();
        this.bindEvents();
        this.init();
    }

    async initializeSupabase() {
        try {
            // 전역 Supabase 클라이언트가 있는지 확인
            if (window.supabaseClient) {
                this.supabase = window.supabaseClient;
                console.log('전역 Supabase 클라이언트 사용');
            } else {
                // 직접 생성
                this.supabase = supabase.createClient(
                    'https://vzemucykhxlxgjuldibf.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW11Y3lraHhseGdqdWxkaWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzA4MjcsImV4cCI6MjA2ODk0NjgyN30.L9DN-V33rQj6atDnDhVeIOyzGP5I_3uVWSVfMObqrbQ',
                    {
                        auth: {
                            autoRefreshToken: true,
                            persistSession: true,
                            detectSessionInUrl: false
                        },
                        global: {
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        }
                    }
                );
                console.log('새 Supabase 클라이언트 생성 완료');
            }
            
            // 연결 테스트
            const isConnected = await this.testConnection();
            if (!isConnected) {
                console.warn('Supabase 연결 실패 - Mock 데이터 모드로 전환');
                this.supabase = null;
            }
        } catch (error) {
            console.error('Supabase 초기화 오류:', error);
            this.supabase = null;
        }
    }

    async testConnection() {
        try {
            if (!this.supabase) return false;
            
            const { data, error } = await this.supabase
                .from('parts')
                .select('count')
                .limit(1);
            
            return !error;
        } catch (error) {
            console.error('연결 테스트 실패:', error);
            return false;
        }
    }

    bindEvents() {
        // 날짜 선택기
        const dateSelector = document.getElementById('dateSelector');
        if (dateSelector) {
            dateSelector.value = this.currentDate;
            dateSelector.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
                this.loadDailyData();
            });
        }

        // 스냅샷 생성 버튼
        const createSnapshotBtn = document.getElementById('createSnapshotBtn');
        if (createSnapshotBtn) {
            createSnapshotBtn.addEventListener('click', () => this.createSnapshot());
        }

        // 오류 검증 버튼
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateInventory());
        }

        // 새로고침 버튼
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadDailyData());
        }

        // 데이터 내보내기 버튼
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // 오류 모달 닫기 버튼
        const closeErrorModal = document.getElementById('closeErrorModal');
        if (closeErrorModal) {
            closeErrorModal.addEventListener('click', () => this.hideErrorModal());
        }
    }

    async init() {
        await this.loadDailyData();
    }

    async loadDailyData() {
        try {
            if (!this.supabase) {
                this.showNotification('Supabase 연결이 없습니다. Mock 데이터를 사용합니다.', 'warning');
                this.loadMockData();
                return;
            }

            // 일일 재고 현황 로드
            const { data: dailyData, error: dailyError } = await this.supabase
                .from('daily_inventory_status')
                .select('*')
                .eq('snapshot_date', this.currentDate)
                .order('part_number');

            if (dailyError) {
                console.error('일일 재고 데이터 로드 오류:', dailyError);
                this.showNotification('일일 재고 데이터 로드 실패', 'error');
                return;
            }

            this.dailyData = dailyData || [];

            // 일일 요약 데이터 로드
            const { data: summaryData, error: summaryError } = await this.supabase
                .from('daily_inventory_summary')
                .select('*')
                .eq('summary_date', this.currentDate)
                .single();

            if (summaryError && summaryError.code !== 'PGRST116') { // PGRST116는 데이터 없음
                console.error('일일 요약 데이터 로드 오류:', summaryError);
            }

            this.summaryData = summaryData;

            // 오류 데이터 로드
            await this.loadErrorData();

            this.updateUI();
            this.showNotification('데이터 로드 완료', 'success');

        } catch (error) {
            console.error('데이터 로드 중 오류:', error);
            this.showNotification('데이터 로드 중 오류가 발생했습니다.', 'error');
        }
    }

    async loadErrorData() {
        try {
            if (!this.supabase) return;

            const { data: errorData, error } = await this.supabase
                .rpc('validate_inventory_consistency', { target_date: this.currentDate });

            if (error) {
                console.error('오류 데이터 로드 실패:', error);
                this.errorData = [];
            } else {
                this.errorData = errorData || [];
            }
        } catch (error) {
            console.error('오류 데이터 로드 중 예외:', error);
            this.errorData = [];
        }
    }

    loadMockData() {
        // Mock 데이터 생성
        this.dailyData = [
            {
                snapshot_date: this.currentDate,
                part_number: '49560-12345',
                category: 'INNER',
                opening_stock: 100,
                closing_stock: 95,
                daily_inbound: 10,
                daily_outbound: 15,
                calculated_closing_stock: 95,
                validation_status: 'OK'
            },
            {
                snapshot_date: this.currentDate,
                part_number: '49600-67890',
                category: 'REAR',
                opening_stock: 50,
                closing_stock: 45,
                daily_inbound: 5,
                daily_outbound: 10,
                calculated_closing_stock: 45,
                validation_status: 'OK'
            }
        ];

        this.summaryData = {
            summary_date: this.currentDate,
            total_parts: 2,
            total_opening_stock: 150,
            total_closing_stock: 140,
            total_daily_inbound: 15,
            total_daily_outbound: 25,
            parts_with_movement: 2
        };

        this.errorData = [];
        this.updateUI();
    }

    updateUI() {
        this.updateSummaryCards();
        this.updateInventoryTable();
    }

    updateSummaryCards() {
        // 총 파트 수
        const totalParts = document.getElementById('totalParts');
        if (totalParts) {
            totalParts.textContent = this.summaryData?.total_parts || this.dailyData.length || 0;
        }

        // 총 입고
        const totalInbound = document.getElementById('totalInbound');
        if (totalInbound) {
            const inbound = this.summaryData?.total_daily_inbound || 
                           this.dailyData.reduce((sum, item) => sum + item.daily_inbound, 0);
            totalInbound.textContent = inbound;
        }

        // 총 출고
        const totalOutbound = document.getElementById('totalOutbound');
        if (totalOutbound) {
            const outbound = this.summaryData?.total_daily_outbound || 
                            this.dailyData.reduce((sum, item) => sum + item.daily_outbound, 0);
            totalOutbound.textContent = outbound;
        }

        // 오류 수
        const errorCount = document.getElementById('errorCount');
        if (errorCount) {
            errorCount.textContent = this.errorData.length;
            errorCount.className = this.errorData.length > 0 ? 'text-2xl font-bold text-red-600' : 'text-2xl font-bold text-gray-900';
        }
    }

    updateInventoryTable() {
        const tableBody = document.getElementById('inventoryTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (this.dailyData.length === 0) {
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `
                <td colspan="8" class="px-6 py-4 text-center text-gray-500">
                    ${this.currentDate} 날짜의 데이터가 없습니다.
                </td>
            `;
            tableBody.appendChild(noDataRow);
            return;
        }

        this.dailyData.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            
            const statusClass = item.validation_status === 'OK' ? 'status-ok' : 
                              item.validation_status === 'NEGATIVE_STOCK' ? 'status-error' : 'status-warning';
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${item.part_number}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${item.category}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.opening_stock}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.closing_stock}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                    +${item.daily_inbound}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    -${item.daily_outbound}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.calculated_closing_stock}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${statusClass}">
                    ${this.getStatusText(item.validation_status)}
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    getStatusText(status) {
        switch (status) {
            case 'OK': return '정상';
            case 'NEGATIVE_STOCK': return '음수 재고';
            case 'CALCULATION_ERROR': return '계산 오류';
            default: return status;
        }
    }

    async createSnapshot() {
        try {
            if (!this.supabase) {
                this.showNotification('Supabase 연결이 없습니다.', 'error');
                return;
            }

            const createSnapshotBtn = document.getElementById('createSnapshotBtn');
            if (createSnapshotBtn) {
                createSnapshotBtn.disabled = true;
                createSnapshotBtn.textContent = '생성 중...';
            }

            const { error } = await this.supabase
                .rpc('create_daily_inventory_snapshot', { target_date: this.currentDate });

            if (error) {
                console.error('스냅샷 생성 오류:', error);
                this.showNotification('스냅샷 생성 실패', 'error');
            } else {
                this.showNotification('스냅샷 생성 완료', 'success');
                await this.loadDailyData();
            }

        } catch (error) {
            console.error('스냅샷 생성 중 예외:', error);
            this.showNotification('스냅샷 생성 중 오류가 발생했습니다.', 'error');
        } finally {
            const createSnapshotBtn = document.getElementById('createSnapshotBtn');
            if (createSnapshotBtn) {
                createSnapshotBtn.disabled = false;
                createSnapshotBtn.textContent = '스냅샷 생성';
            }
        }
    }

    async validateInventory() {
        try {
            if (!this.supabase) {
                this.showNotification('Supabase 연결이 없습니다.', 'error');
                return;
            }

            const validateBtn = document.getElementById('validateBtn');
            if (validateBtn) {
                validateBtn.disabled = true;
                validateBtn.textContent = '검증 중...';
            }

            await this.loadErrorData();
            this.updateUI();

            if (this.errorData.length > 0) {
                this.showErrorModal();
                this.showNotification(`${this.errorData.length}개의 오류가 발견되었습니다.`, 'warning');
            } else {
                this.showNotification('재고 검증 완료 - 오류 없음', 'success');
            }

        } catch (error) {
            console.error('재고 검증 중 오류:', error);
            this.showNotification('재고 검증 중 오류가 발생했습니다.', 'error');
        } finally {
            const validateBtn = document.getElementById('validateBtn');
            if (validateBtn) {
                validateBtn.disabled = false;
                validateBtn.textContent = '오류 검증';
            }
        }
    }

    showErrorModal() {
        const modal = document.getElementById('errorModal');
        const details = document.getElementById('errorDetails');
        
        if (!modal || !details) return;

        details.innerHTML = '';

        this.errorData.forEach(error => {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'border border-red-200 rounded-lg p-4 bg-red-50';
            errorDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <h4 class="text-lg font-medium text-red-800">${error.part_number}</h4>
                    <span class="px-2 py-1 text-xs font-medium text-red-800 bg-red-200 rounded">
                        ${error.issue_type}
                    </span>
                </div>
                <div class="mt-2 space-y-1 text-sm text-red-700">
                    <p><strong>예상 재고:</strong> ${error.expected_stock}</p>
                    <p><strong>실제 재고:</strong> ${error.actual_stock}</p>
                    <p><strong>차이:</strong> ${error.discrepancy}</p>
                </div>
            `;
            details.appendChild(errorDiv);
        });

        modal.classList.remove('hidden');
    }

    hideErrorModal() {
        const modal = document.getElementById('errorModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    exportData() {
        try {
            const exportData = {
                date: this.currentDate,
                summary: this.summaryData,
                daily_inventory: this.dailyData,
                errors: this.errorData
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `daily_inventory_${this.currentDate}.json`;
            link.click();
            
            this.showNotification('데이터 내보내기 완료', 'success');
        } catch (error) {
            console.error('데이터 내보내기 오류:', error);
            this.showNotification('데이터 내보내기 실패', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // 간단한 알림 표시
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-md text-white z-50 ${
            type === 'success' ? 'bg-green-600' :
            type === 'error' ? 'bg-red-600' :
            type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// 전역 함수들 (브라우저 콘솔에서 호출 가능)
window.createDailySnapshot = (date) => {
    if (window.dailyInventoryTracker) {
        return window.dailyInventoryTracker.supabase?.rpc('create_daily_inventory_snapshot', { target_date: date });
    }
};

window.validateDailyInventory = (date) => {
    if (window.dailyInventoryTracker) {
        return window.dailyInventoryTracker.supabase?.rpc('validate_inventory_consistency', { target_date: date });
    }
};

window.getInventoryHistory = (partNumber, startDate, endDate) => {
    if (window.dailyInventoryTracker) {
        return window.dailyInventoryTracker.supabase?.rpc('get_inventory_history', { 
            p_part_number: partNumber, 
            start_date: startDate, 
            end_date: endDate 
        });
    }
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.dailyInventoryTracker = new DailyInventoryTracker();
    console.log('DailyInventoryTracker 초기화 완료');
    console.log('사용 가능한 전역 함수들:');
    console.log('- window.createDailySnapshot(date)');
    console.log('- window.validateDailyInventory(date)');
    console.log('- window.getInventoryHistory(partNumber, startDate, endDate)');
}); 