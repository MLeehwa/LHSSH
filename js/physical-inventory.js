// 실사 재고 관리 JavaScript
class PhysicalInventoryManager {
    constructor() {
        this.physicalInventoryData = [];
        this.filteredData = [];
        this.physicalInventoryHistory = [];
        this.currentEditItem = null;
        this.supabase = null;
        this.init();
    }

    // Supabase 초기화
    initializeSupabase() {
        try {
            console.log('🔄 Supabase 초기화 시작...');
            console.log('window.supabase 존재 여부:', typeof window.supabase);
            console.log('window.getCurrentConfig 존재 여부:', typeof window.getCurrentConfig);
            
            // Supabase 클라이언트가 로드되었는지 확인
            if (typeof window.supabase === 'undefined') {
                console.error('❌ Supabase 클라이언트 라이브러리가 로드되지 않았습니다.');
                console.error('HTML에서 Supabase CDN이 제대로 로드되었는지 확인하세요.');
                return;
            }

            // config.js에서 설정 가져오기
            if (window.getCurrentConfig) {
                const config = window.getCurrentConfig();
                console.log('config.js에서 설정 가져옴:', config);
                this.supabase = window.supabase.createClient(config.url, config.anonKey, {
                    auth: {
                        autoRefreshToken: true,
                        persistSession: true,
                        detectSessionInUrl: true
                    },
                    global: {
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    }
                });
            } else {
                console.log('config.js 없음, 기본 설정 사용');
                // 기본 설정 사용
                this.supabase = window.supabase.createClient(
                    'https://vzemucykhxlxgjuldibf.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW11Y3lraHhseGdqdWxkaWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzA4MjcsImV4cCI6MjA2ODk0NjgyN30.L9DN-V33rQj6atDnDhVeIOyzGP5I_3uVWSVfMObqrbQ',
                    {
                        auth: {
                            autoRefreshToken: true,
                            persistSession: true,
                            detectSessionInUrl: true
                        },
                        global: {
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        }
                    }
                );
            }
            console.log('✅ Supabase 클라이언트 초기화 완료');
            console.log('Supabase 클라이언트 객체:', this.supabase);
        } catch (error) {
            console.error('❌ Supabase 초기화 오류:', error);
            console.error('오류 상세:', error.message);
            console.error('오류 스택:', error.stack);
        }
    }

    // 실사 데이터 로드
    async loadPhysicalInventoryData() {
        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
            return;
        }

        try {
            console.log('🔄 실사 데이터 로드 시작...');
            console.log('Supabase 클라이언트 상태:', this.supabase);
            
            // physical_inventory_details 뷰에서 데이터 조회
            console.log('physical_inventory_details 뷰 조회 시도...');
            const { data, error } = await this.supabase
                .from('physical_inventory_details')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ 실사 데이터 로드 오류:', error);
                console.error('오류 코드:', error.code);
                console.error('오류 메시지:', error.message);
                console.error('오류 상세:', error.details);
                return;
            }

            console.log('조회된 데이터:', data);
            this.physicalInventoryData = data || [];
            this.filteredData = [...this.physicalInventoryData];
            
            console.log(`✅ 실사 데이터 ${this.physicalInventoryData.length}건 로드 완료`);
            this.renderTable();
            this.updateStatistics();
            
        } catch (error) {
            console.error('❌ 실사 데이터 로드 중 오류:', error);
            console.error('오류 상세:', error.message);
            console.error('오류 스택:', error.stack);
        }
    }

    // 실사 이력 데이터 로드
    async loadPhysicalInventoryHistory() {
        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
            return;
        }

        try {
            console.log('🔄 실사 이력 데이터 로드 시작...');
            
            // physical_inventory_adjustment_history 뷰에서 데이터 조회
            const { data, error } = await this.supabase
                .from('physical_inventory_adjustment_history')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ 실사 이력 데이터 로드 오류:', error);
                return;
            }

            this.physicalInventoryHistory = data || [];
            
            console.log(`✅ 실사 이력 데이터 ${this.physicalInventoryHistory.length}건 로드 완료`);
            this.renderHistoryTable();
            this.updateHistoryCount(this.physicalInventoryHistory.length);
            
        } catch (error) {
            console.error('❌ 실사 이력 데이터 로드 중 오류:', error);
        }
    }

    // 새로운 실사 세션 생성
    async createPhysicalSession(sessionName, sessionDate, notes = '') {
        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('physical_inventory_sessions')
                .insert({
                    session_name: sessionName,
                    session_date: sessionDate,
                    notes: notes,
                    created_by: 'admin'
                })
                .select()
                .single();

            if (error) {
                console.error('❌ 실사 세션 생성 오류:', error);
                return null;
            }

            console.log('✅ 실사 세션 생성 완료:', data);
            return data;
            
        } catch (error) {
            console.error('❌ 실사 세션 생성 중 오류:', error);
            return null;
        }
    }

    // 실사 항목 추가
    async addPhysicalItem(sessionId, partNumber, physicalStock, notes = '') {
        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
            return false;
        }

        try {
            // DB 재고 조회
            const { data: inventoryData, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('current_stock')
                .eq('part_number', partNumber)
                .maybeSingle();

            if (inventoryError && inventoryError.code !== 'PGRST116') {
                console.error('❌ 재고 조회 오류:', inventoryError);
                return false;
            }

            const dbStock = inventoryData ? inventoryData.current_stock : 0;

            // 실사 항목 추가
            const { error } = await this.supabase
                .from('physical_inventory_items')
                .insert({
                    session_id: sessionId,
                    part_number: partNumber,
                    db_stock: dbStock,
                    physical_stock: physicalStock,
                    notes: notes
                });

            if (error) {
                console.error('❌ 실사 항목 추가 오류:', error);
                return false;
            }

            console.log('✅ 실사 항목 추가 완료');
            await this.loadPhysicalInventoryData(); // 데이터 새로고침
            return true;
            
        } catch (error) {
            console.error('❌ 실사 항목 추가 중 오류:', error);
            return false;
        }
    }

    // 실사 항목 수정
    async updatePhysicalItem(itemId, physicalStock, notes = '') {
        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('physical_inventory_items')
                .update({
                    physical_stock: physicalStock,
                    notes: notes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', itemId);

            if (error) {
                console.error('❌ 실사 항목 수정 오류:', error);
                return false;
            }

            console.log('✅ 실사 항목 수정 완료');
            await this.loadPhysicalInventoryData(); // 데이터 새로고침
            return true;
            
        } catch (error) {
            console.error('❌ 실사 항목 수정 중 오류:', error);
            return false;
        }
    }

    // 실사 항목 조정 (재고 업데이트)
    async adjustPhysicalItem(itemId, newStock, reason = '') {
        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
            return false;
        }

        try {
            // 실사 항목을 ADJUSTED 상태로 업데이트
            const { error } = await this.supabase
                .from('physical_inventory_items')
                .update({
                    physical_stock: newStock,
                    status: 'ADJUSTED',
                    notes: reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', itemId);

            if (error) {
                console.error('❌ 실사 항목 조정 오류:', error);
                return false;
            }

            console.log('✅ 실사 항목 조정 완료');
            await this.loadPhysicalInventoryData(); // 데이터 새로고침
            await this.loadPhysicalInventoryHistory(); // 이력 새로고침
            return true;
            
        } catch (error) {
            console.error('❌ 실사 항목 조정 중 오류:', error);
            return false;
        }
    }

    // 실사 세션 완료
    async completePhysicalSession(sessionId) {
        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('physical_inventory_sessions')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString()
                })
                .eq('id', sessionId);

            if (error) {
                console.error('❌ 실사 세션 완료 오류:', error);
                return false;
            }

            console.log('✅ 실사 세션 완료');
            return true;
            
        } catch (error) {
            console.error('❌ 실사 세션 완료 중 오류:', error);
            return false;
        }
    }

    // 초기화
    init() {
        this.initializeSupabase();
        this.setupEventListeners();
        this.updateCurrentTime();
        
        // 데이터 로드
        this.loadPhysicalInventoryData();
        this.loadPhysicalInventoryHistory();
        
        console.log('✅ 실사재고 관리자 초기화 완료');
    }

    // 현재 시간 업데이트
    updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/Chicago'
        });
        
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = timeString;
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 필터 이벤트
        const partFilter = document.getElementById('partFilter');
        const statusFilter = document.getElementById('statusFilter');
        const dateFilter = document.getElementById('dateFilter');

        if (partFilter) {
            partFilter.addEventListener('input', () => this.applyFilters());
        }
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }
        if (dateFilter) {
            dateFilter.addEventListener('change', () => this.applyFilters());
        }

        // 이력 필터 이벤트
        const filterHistoryBtn = document.getElementById('filterHistoryBtn');
        const clearHistoryFilterBtn = document.getElementById('clearHistoryFilterBtn');

        if (filterHistoryBtn) {
            filterHistoryBtn.addEventListener('click', () => this.applyHistoryFilters());
        }
        if (clearHistoryFilterBtn) {
            clearHistoryFilterBtn.addEventListener('click', () => this.clearHistoryFilters());
        }

        // 내보내기 버튼
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // 모달 이벤트
        const closeHistoryModal = document.getElementById('closeHistoryModal');
        const closeEditModal = document.getElementById('closeEditModal');
        const cancelEdit = document.getElementById('cancelEdit');

        if (closeHistoryModal) {
            closeHistoryModal.addEventListener('click', () => this.closeHistoryModal());
        }
        if (closeEditModal) {
            closeEditModal.addEventListener('click', () => this.closeEditModal());
        }
        if (cancelEdit) {
            cancelEdit.addEventListener('click', () => this.closeEditModal());
        }

        // 수정 폼 제출
        const editForm = document.getElementById('editForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
        }

        // 현재 시간 업데이트
        setInterval(() => this.updateCurrentTime(), 1000);
    }

    // 필터 적용
    applyFilters() {
        const partFilter = document.getElementById('partFilter')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const dateFilter = document.getElementById('dateFilter')?.value || '';

        this.filteredData = this.physicalInventoryData.filter(item => {
            const matchesPart = !partFilter || item.part_number.toLowerCase().includes(partFilter);
            const matchesStatus = !statusFilter || item.status.toLowerCase() === statusFilter.toLowerCase();
            const matchesDate = !dateFilter || item.session_date === dateFilter;

            return matchesPart && matchesStatus && matchesDate;
        });

        this.renderTable();
        this.updateStatistics();
    }

    // 테이블 렌더링
    renderTable() {
        const tableBody = document.getElementById('physicalInventoryTable');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (this.filteredData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-4 text-center text-white/60">
                        실사 데이터가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        this.filteredData.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-white/5 transition-colors duration-200';
            
            const statusClass = this.getStatusClass(item.status);
            const statusText = this.getStatusText(item.status);
            const differenceClass = item.difference > 0 ? 'text-green-300' : item.difference < 0 ? 'text-red-300' : 'text-white/80';
            const differenceText = item.difference > 0 ? `+${item.difference}` : item.difference.toString();

            row.innerHTML = `
                <td class="px-6 py-4 text-sm text-white/90">${item.part_number}</td>
                <td class="px-6 py-4 text-sm text-white/80">${item.db_stock}</td>
                <td class="px-6 py-4 text-sm text-white/80">${item.physical_stock}</td>
                <td class="px-6 py-4 text-sm ${differenceClass}">${differenceText}</td>
                <td class="px-6 py-4 text-sm">
                    <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${statusText}</span>
                </td>
                <td class="px-6 py-4 text-sm text-white/70">${new Date(item.created_at).toLocaleString('ko-KR')}</td>
                <td class="px-6 py-4 text-sm">
                    <div class="flex space-x-2">
                        <button onclick="physicalInventoryManager.showHistory(${item.id})" class="text-blue-300 hover:text-blue-200">
                            <i class="fas fa-history"></i>
                        </button>
                        ${item.status === 'DIFFERENCE' ? `
                            <button onclick="physicalInventoryManager.showEditModal(${item.id})" class="text-yellow-300 hover:text-yellow-200">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    // 상태 클래스 반환
    getStatusClass(status) {
        switch (status.toLowerCase()) {
            case 'matched':
                return 'bg-green-500/20 text-green-300';
            case 'difference':
                return 'bg-red-500/20 text-red-300';
            case 'adjusted':
                return 'bg-yellow-500/20 text-yellow-300';
            case 'pending':
                return 'bg-gray-500/20 text-gray-300';
            default:
                return 'bg-gray-500/20 text-gray-300';
        }
    }

    // 상태 텍스트 반환
    getStatusText(status) {
        switch (status.toLowerCase()) {
            case 'matched':
                return '일치';
            case 'difference':
                return '불일치';
            case 'adjusted':
                return '조정됨';
            case 'pending':
                return '대기';
            default:
                return status;
        }
    }

    // 통계 업데이트
    updateStatistics() {
        const totalItems = this.filteredData.length;
        const matchedItems = this.filteredData.filter(item => item.status === 'MATCHED').length;
        const mismatchedItems = this.filteredData.filter(item => item.status === 'DIFFERENCE').length;
        const modifiedItems = this.filteredData.filter(item => item.status === 'ADJUSTED').length;

        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('matchedItems').textContent = matchedItems;
        document.getElementById('mismatchedItems').textContent = mismatchedItems;
        document.getElementById('modifiedItems').textContent = modifiedItems;
    }

    // 이력 필터 적용
    applyHistoryFilters() {
        const startDate = document.getElementById('historyStartDate')?.value || '';
        const endDate = document.getElementById('historyEndDate')?.value || '';

        let filteredHistory = this.physicalInventoryHistory;

        if (startDate || endDate) {
            filteredHistory = this.physicalInventoryHistory.filter(item => {
                const d = new Date(item.created_at);
                const itemDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const matchesStart = !startDate || itemDate >= startDate;
                const matchesEnd = !endDate || itemDate <= endDate;
                return matchesStart && matchesEnd;
            });
        }

        this.renderHistoryTable(filteredHistory);
        this.updateHistoryCount(filteredHistory.length, true);
    }

    // 이력 필터 초기화
    clearHistoryFilters() {
        document.getElementById('historyStartDate').value = '';
        document.getElementById('historyEndDate').value = '';
        this.renderHistoryTable();
        this.updateHistoryCount(this.physicalInventoryHistory.length);
    }

    // 이력 개수 업데이트
    updateHistoryCount(count, isFiltered = false) {
        const historyCountElement = document.getElementById('totalHistoryCount');
        const historyCountText = document.getElementById('historyCount');
        
        if (historyCountElement) {
            historyCountElement.textContent = count;
        }
        
        if (historyCountText) {
            if (isFiltered) {
                historyCountText.innerHTML = i18n.t('total_inventory_history_filtered', { count });
            } else {
                historyCountText.innerHTML = i18n.t('total_inventory_history', { count });
            }
        }
    }

    // 이력 테이블 렌더링
    renderHistoryTable(filteredData = null) {
        const tableBody = document.getElementById('physicalInventoryHistoryTable');
        if (!tableBody) return;

        const data = filteredData || this.physicalInventoryHistory;
        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-4 text-center text-white/60">
                        실사 이력이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-white/5 transition-colors duration-200';
            
            const adjustmentClass = item.adjustment_quantity > 0 ? 'text-green-300' : 'text-red-300';
            const adjustmentText = item.adjustment_quantity > 0 ? `+${item.adjustment_quantity}` : item.adjustment_quantity.toString();

            row.innerHTML = `
                <td class="px-6 py-4 text-sm text-white/90">${item.part_number}</td>
                <td class="px-6 py-4 text-sm text-white/70">${new Date(item.created_at).toLocaleString('ko-KR')}</td>
                <td class="px-6 py-4 text-sm text-white/80">${item.original_stock}</td>
                <td class="px-6 py-4 text-sm text-white/80">${item.adjusted_stock}</td>
                <td class="px-6 py-4 text-sm ${adjustmentClass}">${adjustmentText}</td>
                <td class="px-6 py-4 text-sm text-white/80">${item.adjusted_stock}</td>
                <td class="px-6 py-4 text-sm">
                    <span class="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">조정됨</span>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    // 이력 모달 표시
    showHistory(itemId) {
        const item = this.physicalInventoryData.find(item => item.id === itemId);
        if (!item) return;

        const historyContent = document.getElementById('historyContent');
        const historyModal = document.getElementById('historyModal');

        if (historyContent && historyModal) {
            historyContent.innerHTML = `
                <div class="space-y-4">
                    <div>
                        <h4 class="font-medium text-gray-900 mb-2">파트 정보</h4>
                        <p><strong>파트 번호:</strong> ${item.part_number}</p>
                        <p><strong>DB 재고:</strong> ${item.db_stock}</p>
                        <p><strong>실사 재고:</strong> ${item.physical_stock}</p>
                        <p><strong>차이:</strong> ${item.difference > 0 ? '+' : ''}${item.difference}</p>
                    </div>
                    <div>
                        <h4 class="font-medium text-gray-900 mb-2">실사 정보</h4>
                        <p><strong>실사일시:</strong> ${new Date(item.created_at).toLocaleString('ko-KR')}</p>
                        <p><strong>상태:</strong> ${this.getStatusText(item.status)}</p>
                        ${item.notes ? `<p><strong>비고:</strong> ${item.notes}</p>` : ''}
                    </div>
                </div>
            `;

            historyModal.classList.remove('hidden');
        }
    }

    // 이력 모달 닫기
    closeHistoryModal() {
        const historyModal = document.getElementById('historyModal');
        if (historyModal) {
            historyModal.classList.add('hidden');
        }
    }

    // 수정 모달 표시
    showEditModal(itemId) {
        const item = this.physicalInventoryData.find(item => item.id === itemId);
        if (!item) return;

        this.currentEditItem = item;

        const editPartNumber = document.getElementById('editPartNumber');
        const editCurrentStock = document.getElementById('editCurrentStock');
        const editPhysicalStock = document.getElementById('editPhysicalStock');
        const editNewStock = document.getElementById('editNewStock');
        const editReason = document.getElementById('editReason');
        const editModal = document.getElementById('editModal');

        if (editPartNumber && editCurrentStock && editPhysicalStock && editNewStock && editReason && editModal) {
            editPartNumber.value = item.part_number;
            editCurrentStock.value = item.db_stock;
            editPhysicalStock.value = item.physical_stock;
            editNewStock.value = item.physical_stock;
            editReason.value = '';

            editModal.classList.remove('hidden');
        }
    }

    // 수정 모달 닫기
    closeEditModal() {
        const editModal = document.getElementById('editModal');
        if (editModal) {
            editModal.classList.add('hidden');
        }
        this.currentEditItem = null;
    }

    // 수정 폼 제출 처리
    async handleEditSubmit(e) {
        e.preventDefault();

        if (!this.currentEditItem) {
            this.showNotification('수정할 항목이 선택되지 않았습니다.', 'error');
            return;
        }

        const newStock = parseInt(document.getElementById('editNewStock').value);
        const reason = document.getElementById('editReason').value;

        if (!newStock || newStock < 0) {
            this.showNotification('유효한 재고 수량을 입력해주세요.', 'error');
            return;
        }

        if (!reason.trim()) {
            this.showNotification('수정 사유를 입력해주세요.', 'error');
            return;
        }

        try {
            const success = await this.adjustPhysicalItem(this.currentEditItem.id, newStock, reason);
            
            if (success) {
                this.showNotification('재고가 성공적으로 수정되었습니다.', 'success');
                this.closeEditModal();
            } else {
                this.showNotification('재고 수정 중 오류가 발생했습니다.', 'error');
            }
        } catch (error) {
            console.error('재고 수정 오류:', error);
            this.showNotification('재고 수정 중 오류가 발생했습니다.', 'error');
        }
    }

    // 데이터 내보내기
    exportData() {
        const exportFormat = document.getElementById('exportFormat')?.value || 'csv';
        
        if (exportFormat === 'csv') {
            this.exportToCSV();
        } else if (exportFormat === 'excel') {
            this.exportToExcel();
        }
    }

    // CSV 내보내기
    exportToCSV() {
        const headers = ['파트 번호', 'DB 재고', '실사 재고', '차이', '상태', '실사일시', '비고'];
        const csvContent = [
            headers.join(','),
            ...this.filteredData.map(item => [
                item.part_number,
                item.db_stock,
                item.physical_stock,
                item.difference,
                this.getStatusText(item.status),
                new Date(item.created_at).toLocaleString('ko-KR'),
                item.notes || ''
            ].join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `실사재고_${(window.getLocalDateString ? window.getLocalDateString() : new Date().toISOString().split('T')[0])}.csv`;
        link.click();
    }

    // Excel 내보내기
    exportToExcel() {
        const workbook = XLSX.utils.book_new();
        
        // 실사 데이터 시트
        const physicalData = this.filteredData.map(item => ({
            '파트 번호': item.part_number,
            'DB 재고': item.db_stock,
            '실사 재고': item.physical_stock,
            '차이': item.difference,
            '상태': this.getStatusText(item.status),
            '실사일시': new Date(item.created_at).toLocaleString('ko-KR'),
            '비고': item.notes || ''
        }));
        
        const physicalWorksheet = XLSX.utils.json_to_sheet(physicalData);
        XLSX.utils.book_append_sheet(workbook, physicalWorksheet, '실사재고');

        // 이력 데이터 시트
        const historyData = this.physicalInventoryHistory.map(item => ({
            '파트 번호': item.part_number,
            '조정일시': new Date(item.created_at).toLocaleString('ko-KR'),
            '조정 전 재고': item.original_stock,
            '조정 후 재고': item.adjusted_stock,
            '조정 수량': item.adjustment_quantity,
            '조정 사유': item.reason || '',
            '조정자': item.adjusted_by
        }));
        
        const historyWorksheet = XLSX.utils.json_to_sheet(historyData);
        XLSX.utils.book_append_sheet(workbook, historyWorksheet, '조정이력');

        // 파일 다운로드
        XLSX.writeFile(workbook, `실사재고_${(window.getLocalDateString ? window.getLocalDateString() : new Date().toISOString().split('T')[0])}.xlsx`);
    }

    // 알림 표시
    showNotification(message, type = 'info') {
        // 간단한 알림 구현
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// 전역 인스턴스 생성
const physicalInventoryManager = new PhysicalInventoryManager(); 