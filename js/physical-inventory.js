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
            this.supabase = supabase.createClient(
                'https://your-project.supabase.co',
                'your-anon-key',
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
            console.log('✅ Supabase 클라이언트 초기화 완료');
        } catch (error) {
            console.error('❌ Supabase 초기화 오류:', error);
        }
    }

    // 인벤토리된 파트를 찾아서 current_stock에 더하기
    async updateCurrentStockFromInventory() {
        if (!this.supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
            return;
        }

        try {
            console.log('🔄 인벤토리된 파트를 찾아서 current_stock 업데이트 시작...');
            
            // 인벤토리된 파트들 (physicalStock > dbStock인 경우)
            const inventoriedParts = this.physicalInventoryData.filter(item => 
                item.physicalStock > item.dbStock && item.status !== 'matched'
            );

            console.log(`📦 인벤토리된 파트 ${inventoriedParts.length}개 발견`);

            for (const part of inventoriedParts) {
                const additionalQuantity = part.physicalStock - part.dbStock;
                console.log(`➕ ${part.partNumber}: ${additionalQuantity}개 추가`);

                // inventory 테이블에서 현재 재고 조회
                const { data: inventoryData, error: inventoryError } = await this.supabase
                    .from('inventory')
                    .select('current_stock')
                    .eq('part_number', part.partNumber)
                    .maybeSingle();

                if (inventoryError && inventoryError.code !== 'PGRST116') {
                    console.error(`❌ ${part.partNumber} 재고 조회 오류:`, inventoryError);
                    continue;
                }

                const currentStock = inventoryData ? inventoryData.current_stock : 0;
                const newStock = currentStock + additionalQuantity;

                // inventory 테이블 업데이트
                if (inventoryData) {
                    const { error: updateError } = await this.supabase
                        .from('inventory')
                        .update({
                            current_stock: newStock,
                            last_updated: new Date().toISOString()
                        })
                        .eq('part_number', part.partNumber);

                    if (updateError) {
                        console.error(`❌ ${part.partNumber} 재고 업데이트 오류:`, updateError);
                        continue;
                    }
                } else {
                    // 파트가 inventory 테이블에 없으면 새로 생성
                    const { error: insertError } = await this.supabase
                        .from('inventory')
                        .insert({
                            part_number: part.partNumber,
                            current_stock: newStock,
                            last_updated: new Date().toISOString()
                        });

                    if (insertError) {
                        console.error(`❌ ${part.partNumber} 재고 생성 오류:`, insertError);
                        continue;
                    }
                }

                // 거래 내역 기록
                await this.supabase
                    .from('inventory_transactions')
                    .insert({
                        date: new Date().toISOString().split('T')[0],
                        part_number: part.partNumber,
                        type: 'PHYSICAL_INVENTORY',
                        quantity: additionalQuantity,
                        balance_after: newStock,
                        reference_number: `PHYSICAL_${Date.now()}`,
                        notes: `실사 재고 조정: ${part.dbStock} → ${part.physicalStock}`
                    });

                console.log(`✅ ${part.partNumber}: ${currentStock} → ${newStock} (${additionalQuantity}개 추가)`);
            }

            this.showNotification(`인벤토리된 파트 ${inventoriedParts.length}개의 current_stock이 업데이트되었습니다.`, 'success');
            
        } catch (error) {
            console.error('❌ current_stock 업데이트 중 오류:', error);
            this.showNotification('current_stock 업데이트 중 오류가 발생했습니다.', 'error');
        }
    }

    init() {
        this.initializeSupabase();
        this.loadMockData();
        this.loadMockHistoryData();
        this.setupEventListeners();
        this.updateCurrentTime();
        this.renderTable();
        this.renderHistoryTable();
        this.updateStatistics();
        this.updateHistoryCount(this.physicalInventoryHistory.length, false);
        
        // 시간 업데이트를 1초마다 실행
        setInterval(() => this.updateCurrentTime(), 1000);
    }

    // US Central Time으로 현재 시간 표시
    updateCurrentTime() {
        const now = new Date();
        const centralTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Chicago"}));
        const timeString = centralTime.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/Chicago'
        });
        document.getElementById('currentTime').textContent = timeString;
    }

    // Mock 데이터 로드
    loadMockData() {
        this.physicalInventoryData = [
            {
                id: 1,
                partNumber: 'ABC001',
                partName: '엔진 마운트',
                dbStock: 150,
                physicalStock: 148,
                difference: -2,
                status: 'mismatched',
                inspector: '김철수',
                inspectionDate: '2024-01-15',
                inspectionTime: '14:30:00',
                history: [
                    {
                        date: '2024-01-15 16:45:00',
                        oldStock: 150,
                        newStock: 148,
                        reason: '실사 결과 부족 확인',
                        modifier: '관리자'
                    }
                ]
            },
            {
                id: 2,
                partNumber: 'DEF002',
                partName: '브레이크 패드',
                dbStock: 200,
                physicalStock: 200,
                difference: 0,
                status: 'matched',
                inspector: '이영희',
                inspectionDate: '2024-01-15',
                inspectionTime: '15:20:00',
                history: []
            },
            {
                id: 3,
                partNumber: 'GHI003',
                partName: '타이어 밸브',
                dbStock: 300,
                physicalStock: 295,
                difference: -5,
                status: 'mismatched',
                inspector: '박민수',
                inspectionDate: '2024-01-15',
                inspectionTime: '16:10:00',
                history: []
            },
            {
                id: 4,
                partNumber: 'JKL004',
                partName: '배터리',
                dbStock: 50,
                physicalStock: 52,
                difference: 2,
                status: 'mismatched',
                inspector: '최지영',
                inspectionDate: '2024-01-15',
                inspectionTime: '17:00:00',
                history: []
            },
            {
                id: 5,
                partNumber: 'MNO005',
                partName: '오일 필터',
                dbStock: 100,
                physicalStock: 98,
                difference: -2,
                status: 'modified',
                inspector: '정수민',
                inspectionDate: '2024-01-14',
                inspectionTime: '13:45:00',
                history: [
                    {
                        date: '2024-01-14 15:30:00',
                        oldStock: 100,
                        newStock: 98,
                        reason: '실사 후 재고 조정',
                        modifier: '관리자'
                    }
                ]
            },
            {
                id: 6,
                partNumber: 'PQR006',
                partName: '에어 필터',
                dbStock: 75,
                physicalStock: 75,
                difference: 0,
                status: 'matched',
                inspector: '김철수',
                inspectionDate: '2024-01-14',
                inspectionTime: '14:15:00',
                history: []
            },
            {
                id: 7,
                partNumber: 'STU007',
                partName: '스파크 플러그',
                dbStock: 120,
                physicalStock: 118,
                difference: -2,
                status: 'mismatched',
                inspector: '이영희',
                inspectionDate: '2024-01-14',
                inspectionTime: '15:30:00',
                history: []
            },
            {
                id: 8,
                partNumber: 'VWX008',
                partName: '점화 코일',
                dbStock: 80,
                physicalStock: 82,
                difference: 2,
                status: 'modified',
                inspector: '박민수',
                inspectionDate: '2024-01-13',
                inspectionTime: '16:20:00',
                history: [
                    {
                        date: '2024-01-13 17:45:00',
                        oldStock: 80,
                        newStock: 82,
                        reason: '실사 결과 초과 확인',
                        modifier: '관리자'
                    }
                ]
            }
        ];
        this.filteredData = [...this.physicalInventoryData];
    }

    // Mock 실사 이력 데이터 로드
    loadMockHistoryData() {
        this.physicalInventoryHistory = [
            {
                id: 1,
                partNumber: 'ABC001',
                inspectionDate: '2024-01-15',
                inspectionTime: '14:30:00',
                beforeDbStock: 150,
                physicalStock: 148,
                difference: -2,
                afterDbStock: 148,
                status: '수정됨',
                inspector: '김철수',
                modificationDate: '2024-01-15 16:45:00',
                modificationReason: '실사 결과 부족 확인'
            },
            {
                id: 2,
                partNumber: 'DEF002',
                inspectionDate: '2024-01-15',
                inspectionTime: '15:20:00',
                beforeDbStock: 200,
                physicalStock: 200,
                difference: 0,
                afterDbStock: 200,
                status: '일치',
                inspector: '이영희',
                modificationDate: null,
                modificationReason: null
            },
            {
                id: 3,
                partNumber: 'GHI003',
                inspectionDate: '2024-01-15',
                inspectionTime: '16:10:00',
                beforeDbStock: 300,
                physicalStock: 295,
                difference: -5,
                afterDbStock: 300,
                status: '불일치',
                inspector: '박민수',
                modificationDate: null,
                modificationReason: null
            },
            {
                id: 4,
                partNumber: 'MNO005',
                inspectionDate: '2024-01-14',
                inspectionTime: '13:45:00',
                beforeDbStock: 100,
                physicalStock: 98,
                difference: -2,
                afterDbStock: 98,
                status: '수정됨',
                inspector: '정수민',
                modificationDate: '2024-01-14 15:30:00',
                modificationReason: '실사 후 재고 조정'
            },
            {
                id: 5,
                partNumber: 'VWX008',
                inspectionDate: '2024-01-13',
                inspectionTime: '16:20:00',
                beforeDbStock: 80,
                physicalStock: 82,
                difference: 2,
                afterDbStock: 82,
                status: '수정됨',
                inspector: '박민수',
                modificationDate: '2024-01-13 17:45:00',
                modificationReason: '실사 결과 초과 확인'
            },
            {
                id: 6,
                partNumber: 'ABC001',
                inspectionDate: '2024-01-10',
                inspectionTime: '10:15:00',
                beforeDbStock: 150,
                physicalStock: 150,
                difference: 0,
                afterDbStock: 150,
                status: '일치',
                inspector: '김철수',
                modificationDate: null,
                modificationReason: null
            },
            {
                id: 7,
                partNumber: 'GHI003',
                inspectionDate: '2024-01-08',
                inspectionTime: '14:20:00',
                beforeDbStock: 300,
                physicalStock: 300,
                difference: 0,
                afterDbStock: 300,
                status: '일치',
                inspector: '박민수',
                modificationDate: null,
                modificationReason: null
            },
            {
                id: 8,
                partNumber: 'JKL004',
                inspectionDate: '2024-01-12',
                inspectionTime: '09:30:00',
                beforeDbStock: 50,
                physicalStock: 52,
                difference: 2,
                afterDbStock: 52,
                status: '수정됨',
                inspector: '최지영',
                modificationDate: '2024-01-12 11:15:00',
                modificationReason: '실사 결과 초과 확인'
            },
            {
                id: 9,
                partNumber: 'PQR006',
                inspectionDate: '2024-01-11',
                inspectionTime: '14:45:00',
                beforeDbStock: 75,
                physicalStock: 75,
                difference: 0,
                afterDbStock: 75,
                status: '일치',
                inspector: '김철수',
                modificationDate: null,
                modificationReason: null
            },
            {
                id: 10,
                partNumber: 'STU007',
                inspectionDate: '2024-01-09',
                inspectionTime: '16:30:00',
                beforeDbStock: 120,
                physicalStock: 118,
                difference: -2,
                afterDbStock: 118,
                status: '수정됨',
                inspector: '이영희',
                modificationDate: '2024-01-09 17:45:00',
                modificationReason: '실사 결과 부족 확인'
            },
            {
                id: 11,
                partNumber: 'ABC001',
                inspectionDate: '2024-01-05',
                inspectionTime: '11:20:00',
                beforeDbStock: 150,
                physicalStock: 150,
                difference: 0,
                afterDbStock: 150,
                status: '일치',
                inspector: '김철수',
                modificationDate: null,
                modificationReason: null
            },
            {
                id: 12,
                partNumber: 'DEF002',
                inspectionDate: '2024-01-03',
                inspectionTime: '13:15:00',
                beforeDbStock: 200,
                physicalStock: 200,
                difference: 0,
                afterDbStock: 200,
                status: '일치',
                inspector: '이영희',
                modificationDate: null,
                modificationReason: null
            }
        ];
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 필터 이벤트
        document.getElementById('partFilter').addEventListener('input', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateFilter').addEventListener('change', () => this.applyFilters());

        // 실사 이력 날짜 필터 이벤트
        document.getElementById('filterHistoryBtn').addEventListener('click', () => this.applyHistoryFilters());
        document.getElementById('clearHistoryFilterBtn').addEventListener('click', () => this.clearHistoryFilters());

        // 내보내기 버튼
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());

        // 모달 닫기 버튼들
        document.getElementById('closeHistoryModal').addEventListener('click', () => this.closeHistoryModal());
        document.getElementById('closeEditModal').addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeEditModal());

        // 수정 폼 제출
        document.getElementById('editForm').addEventListener('submit', (e) => this.handleEditSubmit(e));

        // 모달 외부 클릭 시 닫기
        window.addEventListener('click', (e) => {
            if (e.target.id === 'historyModal') this.closeHistoryModal();
            if (e.target.id === 'editModal') this.closeEditModal();
        });
    }

    // 필터 적용
    applyFilters() {
        const partFilter = document.getElementById('partFilter').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;

        this.filteredData = this.physicalInventoryData.filter(item => {
            const matchesPart = item.partNumber.toLowerCase().includes(partFilter);
            const matchesStatus = !statusFilter || item.status === statusFilter;
            const matchesDate = !dateFilter || item.inspectionDate === dateFilter;

            return matchesPart && matchesStatus && matchesDate;
        });

        this.renderTable();
        this.updateStatistics();
    }

    // 테이블 렌더링
    renderTable() {
        const tbody = document.getElementById('physicalInventoryTable');
        tbody.innerHTML = '';

        if (this.filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                        데이터가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        this.filteredData.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            
            const statusClass = this.getStatusClass(item.status);
            const differenceClass = item.difference > 0 ? 'text-green-600' : 
                                  item.difference < 0 ? 'text-red-600' : 'text-gray-600';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${item.partNumber}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.dbStock.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.physicalStock.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${differenceClass}">
                    ${item.difference > 0 ? '+' : ''}${item.difference}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                        ${this.getStatusText(item.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.inspectionDate} ${item.inspectionTime}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        ${item.history.length > 0 ? `
                            <button onclick="physicalInventoryManager.showHistory(${item.id})" 
                                    class="text-blue-600 hover:text-blue-900">
                                <i class="fas fa-history"></i>
                            </button>
                        ` : ''}
                        <button onclick="physicalInventoryManager.showEditModal(${item.id})" 
                                class="text-green-600 hover:text-green-900">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // 상태별 클래스 반환
    getStatusClass(status) {
        switch (status) {
            case 'matched': return 'bg-green-100 text-green-800';
            case 'mismatched': return 'bg-red-100 text-red-800';
            case 'modified': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    // 상태별 텍스트 반환
    getStatusText(status) {
        switch (status) {
            case 'matched': return '일치';
            case 'mismatched': return '불일치';
            case 'modified': return '수정됨';
            default: return '알 수 없음';
        }
    }

    // 통계 업데이트
    updateStatistics() {
        const total = this.filteredData.length;
        const matched = this.filteredData.filter(item => item.status === 'matched').length;
        const mismatched = this.filteredData.filter(item => item.status === 'mismatched').length;
        const modified = this.filteredData.filter(item => item.status === 'modified').length;

        document.getElementById('totalItems').textContent = total;
        document.getElementById('matchedItems').textContent = matched;
        document.getElementById('mismatchedItems').textContent = mismatched;
        document.getElementById('modifiedItems').textContent = modified;
    }

    // 실사 이력 필터 적용
    applyHistoryFilters() {
        const startDate = document.getElementById('historyStartDate').value;
        const endDate = document.getElementById('historyEndDate').value;

        let filteredHistory = [...this.physicalInventoryHistory];

        if (startDate || endDate) {
            filteredHistory = filteredHistory.filter(item => {
                const itemDate = new Date(item.inspectionDate);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;

                if (start && end) {
                    return itemDate >= start && itemDate <= end;
                } else if (start) {
                    return itemDate >= start;
                } else if (end) {
                    return itemDate <= end;
                }
                return true;
            });
        }

        this.renderHistoryTable(filteredHistory);
        this.updateHistoryCount(filteredHistory.length, startDate || endDate);
    }

    // 실사 이력 필터 초기화
    clearHistoryFilters() {
        document.getElementById('historyStartDate').value = '';
        document.getElementById('historyEndDate').value = '';
        this.renderHistoryTable();
        this.updateHistoryCount(this.physicalInventoryHistory.length, false);
    }

    // 실사 이력 개수 업데이트
    updateHistoryCount(count, isFiltered = false) {
        const totalCountElement = document.getElementById('totalHistoryCount');
        const historyCountElement = document.getElementById('historyCount');
        
        totalCountElement.textContent = count;
        
        if (isFiltered) {
            historyCountElement.innerHTML = `검색 결과: <span id="totalHistoryCount">${count}</span>건의 실사 이력`;
            historyCountElement.className = 'text-sm text-green-600 mt-1';
        } else {
            historyCountElement.innerHTML = `총 <span id="totalHistoryCount">${count}</span>건의 실사 이력`;
            historyCountElement.className = 'text-sm text-blue-600 mt-1';
        }
    }

    // 실사 이력 테이블 렌더링
    renderHistoryTable(filteredData = null) {
        const tbody = document.getElementById('physicalInventoryHistoryTable');
        tbody.innerHTML = '';

        const dataToRender = filteredData || this.physicalInventoryHistory;

        if (dataToRender.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                        ${filteredData ? '검색 조건에 맞는 실사 이력이 없습니다.' : '실사 이력이 없습니다.'}
                    </td>
                </tr>
            `;
            return;
        }

        // 날짜순으로 정렬 (최신순)
        const sortedHistory = [...dataToRender].sort((a, b) => {
            const dateA = new Date(`${a.inspectionDate} ${a.inspectionTime}`);
            const dateB = new Date(`${b.inspectionDate} ${b.inspectionTime}`);
            return dateB - dateA;
        });

        sortedHistory.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            
            const statusClass = this.getHistoryStatusClass(item.status);
            const differenceClass = item.difference > 0 ? 'text-green-600' : 
                                  item.difference < 0 ? 'text-red-600' : 'text-gray-600';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${item.partNumber}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.inspectionDate} ${item.inspectionTime}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.beforeDbStock.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.physicalStock.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${differenceClass}">
                    ${item.difference > 0 ? '+' : ''}${item.difference}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.afterDbStock.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                        ${item.status}
                    </span>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // 이력 상태별 클래스 반환
    getHistoryStatusClass(status) {
        switch (status) {
            case '일치': return 'bg-green-100 text-green-800';
            case '불일치': return 'bg-red-100 text-red-800';
            case '수정됨': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    // 히스토리 모달 표시
    showHistory(itemId) {
        const item = this.physicalInventoryData.find(item => item.id === itemId);
        if (!item) return;

        const historyContent = document.getElementById('historyContent');
        if (item.history.length === 0) {
            historyContent.innerHTML = '<p class="text-gray-500 text-center py-4">수정 히스토리가 없습니다.</p>';
        } else {
            let historyHTML = `
                <div class="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h4 class="font-medium text-gray-900 mb-2">${item.partNumber} - ${item.partName}</h4>
                    <p class="text-sm text-gray-600">현재 DB 재고: ${item.dbStock}개</p>
                </div>
                <div class="space-y-3">
            `;

            item.history.forEach(history => {
                historyHTML += `
                    <div class="border-l-4 border-blue-500 pl-4 py-2">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="text-sm font-medium text-gray-900">
                                    ${history.oldStock}개 → ${history.newStock}개
                                </p>
                                <p class="text-sm text-gray-600 mt-1">${history.reason}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-gray-500">${history.date}</p>
                                <p class="text-xs text-gray-500">수정자: ${history.modifier}</p>
                            </div>
                        </div>
                    </div>
                `;
            });

            historyHTML += '</div>';
            historyContent.innerHTML = historyHTML;
        }

        document.getElementById('historyModal').classList.remove('hidden');
    }

    // 히스토리 모달 닫기
    closeHistoryModal() {
        document.getElementById('historyModal').classList.add('hidden');
    }

    // 수정 모달 표시
    showEditModal(itemId) {
        const item = this.physicalInventoryData.find(item => item.id === itemId);
        if (!item) return;

        this.currentEditItem = item;

        document.getElementById('editPartNumber').value = item.partNumber;
        document.getElementById('editCurrentStock').value = item.dbStock;
        document.getElementById('editPhysicalStock').value = item.physicalStock;
        document.getElementById('editNewStock').value = item.dbStock;
        document.getElementById('editReason').value = '';

        document.getElementById('editModal').classList.remove('hidden');
    }

    // 수정 모달 닫기
    closeEditModal() {
        document.getElementById('editModal').classList.add('hidden');
        this.currentEditItem = null;
        document.getElementById('editForm').reset();
    }

    // 수정 폼 제출 처리
    handleEditSubmit(e) {
        e.preventDefault();

        if (!this.currentEditItem) return;

        const newStock = parseInt(document.getElementById('editNewStock').value);
        const reason = document.getElementById('editReason').value.trim();

        if (!reason) {
            this.showNotification('수정 사유를 입력해주세요.', 'error');
            return;
        }

        // 히스토리 추가
        const historyEntry = {
            date: new Date().toLocaleString('ko-KR', {timeZone: 'America/Chicago'}),
            oldStock: this.currentEditItem.dbStock,
            newStock: newStock,
            reason: reason,
            modifier: '관리자'
        };

        this.currentEditItem.history.push(historyEntry);
        this.currentEditItem.dbStock = newStock;
        this.currentEditItem.difference = this.currentEditItem.physicalStock - newStock;
        
        // 상태 업데이트: 실사 재고와 DB 재고가 일치하면 'matched', 아니면 'modified'
        if (this.currentEditItem.physicalStock === newStock) {
            this.currentEditItem.status = 'matched';
        } else {
            this.currentEditItem.status = 'modified';
        }

        // 필터링된 데이터도 업데이트
        const filteredIndex = this.filteredData.findIndex(item => item.id === this.currentEditItem.id);
        if (filteredIndex !== -1) {
            this.filteredData[filteredIndex] = { ...this.currentEditItem };
        }

        // 실사 이력에 기록 추가
        const historyRecord = {
            id: this.physicalInventoryHistory.length + 1,
            partNumber: this.currentEditItem.partNumber,
            inspectionDate: this.currentEditItem.inspectionDate,
            inspectionTime: this.currentEditItem.inspectionTime,
            beforeDbStock: this.currentEditItem.dbStock,
            physicalStock: this.currentEditItem.physicalStock,
            difference: this.currentEditItem.physicalStock - this.currentEditItem.dbStock,
            afterDbStock: newStock,
            status: this.currentEditItem.physicalStock === newStock ? '일치' : '수정됨',
            inspector: this.currentEditItem.inspector,
            modificationDate: new Date().toLocaleString('ko-KR', {timeZone: 'America/Chicago'}),
            modificationReason: reason
        };
        this.physicalInventoryHistory.push(historyRecord);

        this.closeEditModal();
        this.renderTable();
        this.renderHistoryTable();
        this.updateStatistics();
        this.showNotification('재고가 성공적으로 수정되었습니다.', 'success');
    }

    // 데이터 내보내기
    exportData() {
        const format = document.getElementById('exportFormat').value;
        
        if (format === 'csv') {
            this.exportToCSV();
        } else if (format === 'excel') {
            this.exportToExcel();
        }
    }

    // CSV 내보내기
    exportToCSV() {
        const headers = ['파트 번호', '파트명', 'DB 재고', '실사 재고', '차이', '상태', '실사자', '실사일시'];
        const csvContent = [
            '\ufeff' + headers.join(','),
            ...this.filteredData.map(item => [
                item.partNumber,
                item.partName,
                item.dbStock,
                item.physicalStock,
                item.difference,
                this.getStatusText(item.status),
                item.inspector,
                `${item.inspectionDate} ${item.inspectionTime}`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `실사재고_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Excel 내보내기
    exportToExcel() {
        const workbook = XLSX.utils.book_new();

        // 메인 데이터 시트
        const mainData = this.filteredData.map(item => ({
            '파트 번호': item.partNumber,
            '파트명': item.partName,
            'DB 재고': item.dbStock,
            '실사 재고': item.physicalStock,
            '차이': item.difference,
            '상태': this.getStatusText(item.status),
            '실사자': item.inspector,
            '실사일시': `${item.inspectionDate} ${item.inspectionTime}`
        }));

        const mainWorksheet = XLSX.utils.json_to_sheet(mainData);
        
        // 테이블 스타일 적용
        const range = XLSX.utils.decode_range(mainWorksheet['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_col(C) + "1";
            if (!mainWorksheet[address]) continue;
            mainWorksheet[address].s = {
                fill: { fgColor: { rgb: "4472C4" } },
                font: { color: { rgb: "FFFFFF" }, bold: true }
            };
        }

        XLSX.utils.book_append_sheet(workbook, mainWorksheet, '실사재고');

        // 수정 히스토리 시트
        const modificationHistoryData = [];
        this.filteredData.forEach(item => {
            if (item.history.length > 0) {
                item.history.forEach(history => {
                    modificationHistoryData.push({
                        '파트 번호': item.partNumber,
                        '파트명': item.partName,
                        '이전 재고': history.oldStock,
                        '수정 재고': history.newStock,
                        '수정 사유': history.reason,
                        '수정자': history.modifier,
                        '수정일시': history.date
                    });
                });
            }
        });

        if (modificationHistoryData.length > 0) {
            const modificationHistoryWorksheet = XLSX.utils.json_to_sheet(modificationHistoryData);
            
            // 수정 히스토리 테이블 스타일 적용
            const modificationHistoryRange = XLSX.utils.decode_range(modificationHistoryWorksheet['!ref']);
            for (let C = modificationHistoryRange.s.c; C <= modificationHistoryRange.e.c; ++C) {
                const address = XLSX.utils.encode_col(C) + "1";
                if (!modificationHistoryWorksheet[address]) continue;
                modificationHistoryWorksheet[address].s = {
                    fill: { fgColor: { rgb: "FF6B6B" } },
                    font: { color: { rgb: "FFFFFF" }, bold: true }
                };
            }

            XLSX.utils.book_append_sheet(workbook, modificationHistoryWorksheet, '수정히스토리');
        }

        // 실사 이력 시트
        const physicalHistoryData = this.physicalInventoryHistory.map(item => ({
            '파트 번호': item.partNumber,
            '실사일시': `${item.inspectionDate} ${item.inspectionTime}`,
            '실사 전 DB 재고': item.beforeDbStock,
            '실사 재고': item.physicalStock,
            '차이': item.difference,
            '수정 후 DB 재고': item.afterDbStock,
            '상태': item.status,
            '실사자': item.inspector,
            '수정일시': item.modificationDate || '-',
            '수정사유': item.modificationReason || '-'
        }));

        if (physicalHistoryData.length > 0) {
            const physicalHistoryWorksheet = XLSX.utils.json_to_sheet(physicalHistoryData);
            
            // 실사 이력 테이블 스타일 적용
            const physicalHistoryRange = XLSX.utils.decode_range(physicalHistoryWorksheet['!ref']);
            for (let C = physicalHistoryRange.s.c; C <= physicalHistoryRange.e.c; ++C) {
                const address = XLSX.utils.encode_col(C) + "1";
                if (!physicalHistoryWorksheet[address]) continue;
                physicalHistoryWorksheet[address].s = {
                    fill: { fgColor: { rgb: "4CAF50" } },
                    font: { color: { rgb: "FFFFFF" }, bold: true }
                };
            }

            XLSX.utils.book_append_sheet(workbook, physicalHistoryWorksheet, '실사이력');
        }

        // 파일 다운로드
        XLSX.writeFile(workbook, `실사재고_${new Date().toISOString().split('T')[0]}.xlsx`);
        this.showNotification('Excel 파일이 성공적으로 내보내졌습니다.', 'success');
    }

    // 알림 표시
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
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

// 페이지 로드 시 초기화
let physicalInventoryManager;
document.addEventListener('DOMContentLoaded', () => {
    physicalInventoryManager = new PhysicalInventoryManager();
}); 