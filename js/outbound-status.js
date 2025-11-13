// Outbound Status JavaScript - Performance Optimized
class OutboundStatus {
    constructor() {
        this.outboundSequences = [];
        this.outboundParts = [];
        this.filteredSequences = [];
        this.selectedSequence = null;
        this.filterTimeout = null;
        this.registrationParts = [];
        this.parts = []; // 파트 목록
        this.partsTable = null; // Handsontable 인스턴스
        this.allParts = []; // 모든 파트 번호 목록 (드롭다운용)
        this.supabase = null;
        
        // Performance optimizations
        this.cache = new Map();
        this.lastDataUpdate = 0;
        this.dataUpdateInterval = 30000; // 30 seconds
        this.isLoading = false;
        this.domCache = new Map();
        
        this.initializeSupabase();
        this.init();
        
        // 출고 취소 관련 이벤트 리스너 설정
        this.setupCancelEventListeners();
        
        // 수정 관련 변수
        this.editingSequence = null;
        this.originalQuantities = new Map();
        
        // 수정 모달 이벤트 리스너는 제거됨 (출고 등록 모달 재사용)
    }

    async initializeSupabase() {
        try {
            if (window.supabaseClient) {
                this.supabase = window.supabaseClient;
                console.log('전역 Supabase 클라이언트 사용');
            } else {
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
            console.log('Supabase 연결 테스트 시작...');
            
            // 더 간단한 연결 테스트
            const { data, error } = await this.supabase
                .from('outbound_sequences')
                .select('count')
                .limit(1);
            
            if (error) {
                console.error('Supabase 연결 테스트 실패:', error);
                return false;
            } else {
                console.log('Supabase 연결 테스트 성공');
                return true;
            }
        } catch (error) {
            console.error('연결 테스트 중 예외 발생:', error);
            return false;
        }
    }

    loadMockData() {
        console.log('Mock 데이터 로드 중...');
        // 기본 데이터 구조 설정
        this.outboundSequences = [
            {
                id: 1,
                sequence_number: '20241215-1',
                outbound_date: '2024-12-15',
                status: 'PENDING',
                created_at: new Date().toISOString()
            }
        ];
        this.outboundParts = [
            {
                id: 1,
                sequence_id: 1,
                part_number: '49560-12345',
                planned_qty: 10,
                scanned_qty: 10,
                actual_qty: 10,
                status: 'PENDING',
                created_at: new Date().toISOString()
            }
        ];
        this.filteredSequences = [...this.outboundSequences];
        this.allParts = ['49560-12345', '49560-67890'];
    }

    async init() {
        try {
            console.log('OutboundStatus 초기화 시작...');
            
            if (!this.supabase) {
                console.warn('Supabase 클라이언트가 초기화되지 않았습니다. Mock 데이터를 사용합니다.');
                this.loadMockData();
            } else {
                try {
                await this.loadData();
                } catch (loadError) {
                    console.error('데이터 로딩 실패, Mock 데이터로 전환:', loadError);
                    this.loadMockData();
                }
            }
            
            this.bindEvents();
            this.updateStats();
            this.updateCurrentTime();
            
            // Performance: Use requestAnimationFrame for time updates
            this.scheduleTimeUpdate();
            
            console.log('OutboundStatus 초기화 완료');
        } catch (error) {
            console.error('OutboundStatus 초기화 오류:', error);
            this.loadMockData();
        }
    }

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
        
        const currentTimeElement = document.getElementById('currentTime');
        if (currentTimeElement) {
            currentTimeElement.textContent = timeString;
        }
    }

    scheduleTimeUpdate() {
        const updateTime = () => {
            this.updateCurrentTime();
            requestAnimationFrame(updateTime);
        };
        requestAnimationFrame(updateTime);
    }

    bindEvents() {
        // Performance: Use event delegation for better performance
        const container = document.getElementById('outboundStatusContainer') || document.body;
        
        // Single event listener for all interactions
        container.addEventListener('click', (e) => {
            // Filter buttons
            if (e.target.matches('#applyFilter')) {
                this.applyFilters();
            } else if (e.target.matches('#resetFilter')) {
                this.resetFilters();
            } else if (e.target.matches('#refreshDataBtn')) {
                this.refreshData();
            } else if (e.target.matches('#confirmAllBtn')) {
                this.selectAllPartsForConfirmation();
            } else if (e.target.matches('#confirmOutboundBtn')) {
                this.showConfirmationModal('selected');
            } else if (e.target.matches('#registerOutboundBtn')) {
                this.openRegistrationModal();
            } else if (e.target.matches('#openRegistrationBtn')) {
                this.openRegistrationModal();
            } else if (e.target.matches('#closeRegistrationModal')) {
                this.closeRegistrationModal();
            } else if (e.target.matches('#cancelRegistration')) {
                this.closeRegistrationModal();
            } else if (e.target.matches('#saveRegistration')) {
                this.saveRegistration();
            } else if (e.target.matches('#includeASCheckbox')) {
                this.handleASCheckboxChange();
            } else if (e.target.matches('#addRowBtn')) {
                this.addTableRow();
            } else if (e.target.matches('#removeRowBtn')) {
                this.removeSelectedRows();
            } else if (e.target.matches('#clearTableBtn')) {
                this.clearTable();
            } else if (e.target.matches('.remove-part-btn')) {
                const partId = e.target.closest('[data-part-id]').dataset.partId;
                this.removePartFromRegistration(partId);
            } else if (e.target.closest('tr[data-sequence-id]')) {
                // 차수 행 클릭 시 선택
                const row = e.target.closest('tr[data-sequence-id]');
                const sequenceId = parseInt(row.dataset.sequenceId);
                console.log('차수 행 클릭됨:', sequenceId);
                this.selectSequence(sequenceId);
            }
        });

        // Input events
        container.addEventListener('input', (e) => {
            if (e.target.matches('#partNumberFilter')) {
                this.debouncedApplyFilters();
            } else if (e.target.matches('.actual-qty-input')) {
                this.handleActualQtyChange(e);
            }
        });

        container.addEventListener('change', (e) => {
            if (e.target.matches('#dateFilter, #statusFilter')) {
                this.applyFilters();
            } else if (e.target.matches('.part-checkbox')) {
                this.handlePartSelection(e);
            } else if (e.target.matches('#selectAllParts')) {
                this.toggleSelectAllParts(e.target.checked);
            } else if (e.target.matches('#registrationSequence')) {
                this.handleSequenceChange(e);
            }
        });

    // Modal events
    this.bindModalEvents();
}

// 차수 변경 처리
handleSequenceChange(e) {
    const selectedSequence = e.target.value;
    console.log('선택된 차수:', selectedSequence);
    
    // AS 차수인지 확인
    if (selectedSequence === 'AS') {
        // AS 차수일 때는 기존 출고 데이터를 로드하지 않음
        this.registrationParts = [];
        console.log('AS 차수 선택됨 - 기존 출고 데이터 로드 안함');
    } else {
        // 다른 차수일 때는 기존 출고 데이터 로드
        this.loadExistingOutboundData();
    }
}

    bindModalEvents() {
        // 이벤트 중복 등록 방지
        if (this.modalEventsBound) {
            console.log('모달 이벤트가 이미 등록되었습니다. 중복 등록을 방지합니다.');
            return;
        }
        
        console.log('모달 이벤트 등록 중...');
        
        const modalEvents = [
            { selector: '#cancelConfirmation', action: () => this.closeConfirmationModal() },
            { selector: '#confirmOutboundAction', action: () => this.processOutboundConfirmation() }
        ];

        modalEvents.forEach(({ selector, action }) => {
            document.addEventListener('click', (e) => {
                if (e.target.matches(selector)) {
                    console.log(`모달 이벤트 클릭: ${selector}`);
                    action();
                }
            });
        });
        
        this.modalEventsBound = true;
        console.log('모달 이벤트 등록 완료');
    }

    handleActualQtyChange(e) {
        const input = e.target;
        const partId = parseInt(input.dataset.partId);
        const newQty = parseInt(input.value) || 0;
        
        console.log('실제 출고 수량 변경:', partId, newQty);
        
        // Performance: Debounce actual quantity updates
        clearTimeout(this.actualQtyTimeout);
        this.actualQtyTimeout = setTimeout(() => {
            this.updatePartActualQty(partId, newQty);
        }, 500);
    }

    handlePartSelection(e) {
        const checkbox = e.target;
        const row = checkbox.closest('tr');
        this.updateRowBackgroundColor(row, checkbox.checked);
        this.updateConfirmButtons();
    }

    async loadData() {
        if (this.isLoading) return;
        
        const now = Date.now();
        if (now - this.lastDataUpdate < this.dataUpdateInterval) {
            console.log('Using cached data');
            return;
        }

        this.isLoading = true;
        
        try {
            console.log('데이터 로딩 시작...');
            
            // Performance: Load data in parallel
            const [sequencesResult, partsResult, allPartsResult] = await Promise.all([
                this.loadOutboundSequences(),
                this.loadOutboundParts(),
                this.loadAllParts()
            ]);
            
            this.outboundSequences = sequencesResult;
            this.outboundParts = partsResult;
            this.allParts = allPartsResult;
            this.filteredSequences = [...this.outboundSequences];
            
            this.lastDataUpdate = now;
            this.cache.clear();
            
            console.log('데이터 로드 완료. 총 시퀀스:', this.outboundSequences.length, '총 파트:', this.outboundParts.length);
            
            this.renderSequences();
            this.updateStats();
            
        } catch (error) {
            console.error('데이터 로드 중 오류:', error);
            this.loadMockData();
        } finally {
            this.isLoading = false;
        }
    }

    async loadOutboundSequences() {
        const cacheKey = 'outbound_sequences';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { data, error } = await this.supabase
            .from('outbound_sequences')
            .select(`
                id,
                sequence_number,
                outbound_date,
                status,
                created_at
            `)
            .order('outbound_date', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('출고 시퀀스 데이터 로드 오류:', error);
            return [];
        }
        
        const result = data || [];
        console.log('로드된 출고 시퀀스 데이터:', result);
        this.cache.set(cacheKey, result);
        return result;
    }

    async loadOutboundParts() {
        const cacheKey = 'outbound_parts';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { data, error } = await this.supabase
            .from('outbound_parts')
            .select(`
                id,
                sequence_id,
                part_number,
                planned_qty,
                actual_qty,
                scanned_qty,
                status,
                created_at
            `)
            .order('sequence_id', { ascending: false })
            .order('part_number');
        
        if (error) {
            console.error('출고 파트 데이터 로드 오류:', error);
            return [];
        }
        
        const result = data || [];
        this.cache.set(cacheKey, result);
        return result;
    }

    async loadAllParts(includeAS = false) {
        // AS 포함 여부에 따라 캐시 키 변경
        const cacheKey = includeAS ? 'all_parts_with_as' : 'all_parts_production';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        let query = this.supabase
            .from('parts')
            .select('part_number')
            .eq('status', 'ACTIVE');
        
        // AS를 포함하지 않으면 양산 제품만
        if (!includeAS) {
            query = query.eq('product_type', 'PRODUCTION');
        }
        
        const { data, error } = await query.order('part_number');
        
        if (error) {
            console.error('파트 목록 로드 오류:', error);
            return [];
        }
        
        const result = data ? data.map(part => part.part_number) : [];
        this.cache.set(cacheKey, result);
        return result;
    }

    debouncedApplyFilters() {
        // 기존 타이머가 있다면 취소
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        
        // 300ms 후에 필터 적용
        this.filterTimeout = setTimeout(() => {
            this.applyFilters();
        }, 300);
    }

    applyFilters() {
        const dateFilter = document.getElementById('dateFilter').value;
        const seqFilter = document.getElementById('sequenceFilter').value;
        const partNumberFilter = document.getElementById('partNumberFilter').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredSequences = this.outboundSequences.filter(sequence => {
            const matchesDate = !dateFilter || sequence.outbound_date === dateFilter;
            const matchesSeq = !seqFilter || sequence.sequence_number.toString() === seqFilter;
            const matchesStatus = !statusFilter || sequence.status === statusFilter;

            // Check if any parts in this sequence match the part number filter
            const sequenceParts = this.outboundParts.filter(part => part.sequence_id === sequence.id);
            const matchesPartNumber = !partNumberFilter || sequenceParts.some(part => 
                part.part_number.toLowerCase().includes(partNumberFilter)
            );

            return matchesDate && matchesSeq && matchesStatus && matchesPartNumber;
        });

        this.renderSequences();
        this.updateStats();
    }

    resetFilters() {
        document.getElementById('dateFilter').value = '';
        document.getElementById('sequenceFilter').value = '';
        document.getElementById('partNumberFilter').value = '';
        document.getElementById('statusFilter').value = '';

        this.filteredSequences = [...this.outboundSequences];
        this.renderSequences();
        this.updateStats();
        this.showNotification('필터가 초기화되었습니다.', 'info');
    }

    renderSequences() {
        console.log('renderSequences 호출됨');
        console.log('현재 filteredSequences:', this.filteredSequences);
        
        const tbody = document.getElementById('outboundSequenceTableBody');
        if (!tbody) {
            console.error('outboundSequenceTableBody 요소를 찾을 수 없습니다.');
            return;
        }

        if (!this.filteredSequences || this.filteredSequences.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-800/60">
                    조건에 맞는 출고 차수가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredSequences.map(sequence => {
            const statusClass = sequence.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            const statusText = sequence.status === 'COMPLETED' ? '완료' : '대기';
            
            // 해당 시퀀스의 파트 수 계산
            const partsCount = this.outboundParts.filter(part => part.sequence_id === sequence.id).length;
            
            // 선택된 차수인지 확인
            const isSelected = this.selectedSequence === sequence.id;
            const rowClass = isSelected ? 
                'bg-blue-50 border-l-4 border-blue-500 hover:bg-blue-100 cursor-pointer' : 
                'hover:bg-gray-50 cursor-pointer';
            
            return `
                <tr class="${rowClass}" data-sequence-id="${sequence.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${sequence.sequence_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${this.formatDateOnly(sequence.outbound_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                        ${statusText}
                    </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${partsCount}개</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        <div class="flex space-x-2">
                            ${sequence.status === 'PENDING' ? `
                                <button onclick="window.outboundStatus.showEditModal(${sequence.id})" 
                                        class="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-300 rounded hover:bg-blue-50 transition-colors">
                                    <i class="fas fa-edit mr-1"></i>수정
                                </button>
                            ` : `
                                <span class="text-gray-400 text-xs px-2 py-1">
                                    <i class="fas fa-lock mr-1"></i>확정됨
                                </span>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        console.log('renderSequences 완료');
    }

    // 날짜만 표시하는 함수 (YYYY-MM-DD 형식)
    formatDateOnly(dateValue) {
        try {
            if (!dateValue) return '-';
            
            // 이미 YYYY-MM-DD 형식인 경우
            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                return dateValue;
            }
            
            // ISO 형식인 경우 날짜 부분만 추출
            if (typeof dateValue === 'string' && dateValue.includes('T')) {
                return dateValue.split('T')[0];
            }
            
            // Date 객체로 변환 시도
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) {
                console.warn('유효하지 않은 날짜:', dateValue);
                return '-';
            }
            
            return date.toISOString().split('T')[0];
        } catch (error) {
            console.error('날짜 포맷 오류:', error, '입력값:', dateValue);
            return '-';
        }
    }

    // 시퀀스 상세 정보 표시
    showSequenceDetails(sequenceId) {
        const sequence = this.outboundSequences.find(s => s.id === sequenceId);
        if (!sequence) return;

        // 파트 상세 정보 로드
        this.renderParts(sequenceId);
        
        // 상세 섹션 표시
        const detailsSection = document.getElementById('partsDetailsSection');
        if (detailsSection) {
            detailsSection.classList.remove('hidden');
            
            // 선택된 시퀀스 정보 표시
            const sequenceInfo = document.getElementById('selectedSequenceInfo');
            if (sequenceInfo) {
                sequenceInfo.textContent = `(${sequence.sequence_number} - ${this.formatDateOnly(sequence.outbound_date)})`;
            }
        }
    }

    selectSequence(sequenceId) {
        this.selectedSequence = sequenceId;
        this.renderSequences();
        this.renderParts(sequenceId);
        
        const sequence = this.outboundSequences.find(s => s.id === sequenceId);
        if (sequence) {
            const selectedSequenceElement = document.getElementById('selectedSequence');
            if (selectedSequenceElement) {
                selectedSequenceElement.textContent = `(${sequence.outbound_date} ${sequence.sequence_number === 'AS' ? 'AS' : sequence.sequence_number + '차'})`;
            }
            
            // 파트 상세 섹션 표시
            this.showSequenceDetails(sequenceId);
        }
        
        // 버튼 상태 업데이트
        this.updateConfirmButtons();
    }

    renderParts(sequenceId) {
        const tbody = document.getElementById('partsTableBody');
        if (!tbody) return;
        
        const sequenceParts = this.outboundParts.filter(part => part.sequence_id === sequenceId);
        
        tbody.innerHTML = '';

        if (sequenceParts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-800/60">
                        이 차수에 등록된 파트가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = sequenceParts.map(part => {
            const statusClass = part.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            const statusText = part.status === 'COMPLETED' ? '완료' : '대기';
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${part.part_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${part.scanned_qty || 0}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="number" 
                               class="actual-qty-input w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
                               value="${part.actual_qty || 0}" 
                               min="0" 
                               max="9999"
                               data-part-id="${part.id}"
                               ${part.status === 'COMPLETED' ? 'disabled' : ''}>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 출고 확정 처리
    async confirmOutbound(sequenceId) {
        try {
            const sequence = this.outboundSequences.find(s => s.id === sequenceId);
            if (!sequence) {
                this.showNotification('출고 차수를 찾을 수 없습니다.', 'error');
                    return;
                }
                
            // 출고 시퀀스 상태를 COMPLETED로 업데이트
            const { error: sequenceError } = await this.supabase
                .from('outbound_sequences')
                .update({ status: 'COMPLETED' })
                .eq('id', sequenceId);

            if (sequenceError) {
                console.error('출고 시퀀스 상태 업데이트 오류:', sequenceError);
                this.showNotification('출고 확정 처리 중 오류가 발생했습니다.', 'error');
                return;
            }

            // 출고 파트 상태를 COMPLETED로 업데이트
            const { error: partsError } = await this.supabase
                .from('outbound_parts')
                .update({ status: 'COMPLETED' })
                .eq('sequence_id', sequenceId);

            if (partsError) {
                console.error('출고 파트 상태 업데이트 오류:', partsError);
                this.showNotification('출고 파트 상태 업데이트 중 오류가 발생했습니다.', 'error');
            return;
        }
        
            // daily_inventory_summary 업데이트 (출고 날짜 기준)
            const outboundDate = sequence.outbound_date ? 
                (sequence.outbound_date.includes('T') ? sequence.outbound_date.split('T')[0] : sequence.outbound_date) : 
                new Date().toISOString().split('T')[0];
            
            console.log('출고 확정 후 daily_inventory_summary 업데이트 시작...');
            console.log('출고 날짜:', outboundDate);
            await this.updateDailyInventorySummary(outboundDate);
            console.log('daily_inventory_summary 업데이트 완료');
            
            this.showNotification('출고가 성공적으로 확정되었습니다. 페이지를 새로고침합니다.', 'success');
            
            // 페이지 전체 리프레시
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch (error) {
            console.error('출고 확정 처리 오류:', error);
            this.showNotification('출고 확정 처리 중 오류가 발생했습니다.', 'error');
        }
    }

    getStatusColor(status) {
        switch (status) {
            case 'COMPLETED':
                return 'bg-green-100 text-green-800';
            case 'PENDING':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'COMPLETED':
                return '완료';
            case 'PENDING':
                return '확인전';
            default:
                return '알 수 없음';
        }
    }

    updateStats() {
        try {
        // 필터링된 시퀀스를 기준으로 통계 계산
            const sequences = this.filteredSequences || [];
            const totalOutbound = sequences.length;
            const confirmedOutbound = sequences.filter(s => s.status === 'COMPLETED').length;
            const pendingOutbound = sequences.filter(s => s.status === 'PENDING').length;

            const totalElement = document.getElementById('totalOutbound');
            const confirmedElement = document.getElementById('confirmedOutbound');
            const pendingElement = document.getElementById('pendingOutbound');

            if (totalElement) totalElement.textContent = totalOutbound;
            if (confirmedElement) confirmedElement.textContent = confirmedOutbound;
            if (pendingElement) pendingElement.textContent = pendingOutbound;
            
            console.log('통계 업데이트 완료:', { totalOutbound, confirmedOutbound, pendingOutbound });
        } catch (error) {
            console.error('통계 업데이트 오류:', error);
        }
    }

    async refreshData() {
        try {
            await this.loadData();
            this.showNotification('데이터가 새로고침되었습니다.', 'success');
        } catch (error) {
            console.error('데이터 새로고침 오류:', error);
            this.showNotification('데이터 새로고침 중 오류가 발생했습니다.', 'error');
        }
    }

    async forceRefreshData() {
        try {
            console.log('강제 데이터 새로고침 시작...');
            
            // 캐시 무시하고 데이터 로드
            this.isLoading = false;
            this.lastDataUpdate = 0;
            this.cache.clear();
            
            // 데이터 직접 로드 (캐시 무시)
            const [sequencesResult, partsResult, allPartsResult] = await Promise.all([
                this.loadOutboundSequencesDirect(),
                this.loadOutboundPartsDirect(),
                this.loadAllPartsDirect()
            ]);
            
            this.outboundSequences = sequencesResult;
            this.outboundParts = partsResult;
            this.allParts = allPartsResult;
            
            // 필터링된 시퀀스 업데이트
            this.filteredSequences = [...this.outboundSequences];
            
            // UI 업데이트
            this.renderSequences();
            this.updateStats();
            
            console.log('강제 데이터 새로고침 완료');
        } catch (error) {
            console.error('강제 데이터 새로고침 오류:', error);
            this.showError('데이터 새로고침 중 오류가 발생했습니다.');
        }
    }

    async updateDailyInventorySummary(targetDate = null) {
        try {
            // targetDate가 없으면 오늘 날짜 사용
            const date = targetDate || new Date().toISOString().split('T')[0];
            console.log('=== daily_inventory_summary 업데이트 시작 ===');
            console.log('대상 날짜:', date);
            
            // 먼저 해당 날짜의 inventory_transactions 확인
            const { data: transactions, error: transError } = await this.supabase
                .from('inventory_transactions')
                .select('*')
                .eq('transaction_date', date);
            
            if (transError) {
                console.error('inventory_transactions 조회 오류:', transError);
            } else {
                console.log(`날짜(${date})의 거래 내역:`, transactions);
            }
            
            // 해당 날짜의 daily_inventory_summary 생성
            const { error } = await this.supabase.rpc('generate_daily_inventory_summary', {
                target_date: date
            });
            
            if (error) {
                console.error('daily_inventory_summary 업데이트 실패:', error);
            } else {
                console.log('daily_inventory_summary 업데이트 완료');
                
                // 업데이트 후 결과 확인
                const { data: summary, error: summaryError } = await this.supabase
                    .from('daily_inventory_summary')
                    .select('*')
                    .eq('summary_date', date);
                
                if (summaryError) {
                    console.error('daily_inventory_summary 조회 오류:', summaryError);
                } else {
                    console.log(`업데이트된 daily_inventory_summary (${date}):`, summary);
                }
            }
        } catch (error) {
            console.error('daily_inventory_summary 업데이트 오류:', error);
        }
    }

    // 캐시를 무시하는 직접 로드 함수들
    async loadOutboundSequencesDirect() {
        const { data, error } = await this.supabase
            .from('outbound_sequences')
            .select(`
                id,
                sequence_number,
                outbound_date,
                status,
                created_at
            `)
            .order('outbound_date', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('출고 시퀀스 직접 로드 오류:', error);
            return [];
        }
        return data;
    }

    async loadOutboundPartsDirect() {
        const { data, error } = await this.supabase
            .from('outbound_parts')
            .select(`
                id,
                sequence_id,
                part_number,
                scanned_qty,
                actual_qty,
                status
            `);
        
        if (error) {
            console.error('출고 파트 직접 로드 오류:', error);
            return [];
        }
        return data;
    }

    async loadAllPartsDirect() {
        const { data, error } = await this.supabase
            .from('parts')
            .select('part_number')
            .order('part_number');
        
        if (error) {
            console.error('파트 목록 직접 로드 오류:', error);
            return [];
        }
        // 문자열 배열로 변환 (loadAllParts와 동일하게)
        return data ? data.map(part => part.part_number) : [];
    }

    async updateInventoryDirectly(partNumber, quantity, transactionType) {
        try {
            console.log(`inventory 직접 업데이트: ${partNumber}, ${quantity}, ${transactionType}`);
            
            // 현재 재고 조회
            const { data: currentInventory, error: fetchError } = await this.supabase
                .from('inventory')
                .select('current_stock')
                .eq('part_number', partNumber)
                .single();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('재고 조회 오류:', fetchError);
                return;
            }

            let newStock;
            if (currentInventory) {
                // 기존 재고가 있으면 업데이트
                if (transactionType === 'OUTBOUND') {
                    newStock = Math.max(0, currentInventory.current_stock - quantity);
                } else {
                    newStock = currentInventory.current_stock + quantity;
                }
                
                const { error: updateError } = await this.supabase
                    .from('inventory')
                    .update({
                        current_stock: newStock,
                        last_updated: new Date().toISOString()
                    })
                    .eq('part_number', partNumber);
                
                if (updateError) {
                    console.error('재고 업데이트 오류:', updateError);
                } else {
                    console.log(`재고 업데이트 완료: ${partNumber} ${currentInventory.current_stock} → ${newStock}`);
                }
            } else {
                // 기존 재고가 없으면 새로 생성 (INBOUND인 경우만)
                if (transactionType === 'INBOUND') {
                    const { error: insertError } = await this.supabase
                        .from('inventory')
                        .insert({
                            part_number: partNumber,
                            current_stock: quantity,
                            status: 'in_stock',
                            last_updated: new Date().toISOString()
                        });
                    
                    if (insertError) {
                        console.error('재고 생성 오류:', insertError);
                    } else {
                        console.log(`새 재고 생성: ${partNumber} = ${quantity}`);
                    }
                }
            }
        } catch (error) {
            console.error('inventory 직접 업데이트 오류:', error);
        }
    }

    async updateInventoryDirectlyIfNeeded(partNumber, quantity, transactionType) {
        try {
            console.log(`=== inventory 업데이트 시작 ===`);
            console.log(`파트: ${partNumber}, 수량: ${quantity}, 타입: ${transactionType}`);
            
            // 트리거 상태 확인을 위해 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // 현재 재고 조회
            const { data: beforeInventory, error: fetchError } = await this.supabase
                .from('inventory')
                .select('current_stock, last_updated')
                .eq('part_number', partNumber)
                .single();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error(`파트 ${partNumber} 재고 조회 실패:`, fetchError);
                throw fetchError;
            }
            
            const beforeStock = beforeInventory ? beforeInventory.current_stock : 0;
            console.log(`업데이트 전 재고: ${beforeStock}`);
            
            // 직접 업데이트 실행
            await this.updateInventoryDirectly(partNumber, quantity, transactionType);
            
            // 업데이트 후 재고 확인
            const { data: afterInventory, error: afterFetchError } = await this.supabase
                .from('inventory')
                .select('current_stock, last_updated')
                .eq('part_number', partNumber)
                .single();
            
            if (afterFetchError) {
                console.warn(`업데이트 후 재고 조회 실패:`, afterFetchError);
            } else {
                const afterStock = afterInventory ? afterInventory.current_stock : 0;
                console.log(`업데이트 후 재고: ${afterStock}`);
                console.log(`재고 변화: ${beforeStock} → ${afterStock} (${afterStock - beforeStock})`);
                
                // 예상 변화량과 실제 변화량 비교
                const expectedChange = transactionType === 'OUTBOUND' ? -quantity : quantity;
                const actualChange = afterStock - beforeStock;
                
                if (Math.abs(actualChange - expectedChange) > 0) {
                    console.warn(`⚠️ 재고 변화량 불일치! 예상: ${expectedChange}, 실제: ${actualChange}`);
                    console.warn(`트리거가 여전히 작동하고 있을 수 있습니다.`);
                } else {
                    console.log(`✅ 재고 변화량 정상: ${actualChange}`);
                }
            }
            
        } catch (error) {
            console.error(`inventory 업데이트 실패: ${partNumber}`, error);
            throw error;
        }
    }

    showConfirmationModal() {
        console.log('확정 모달 표시 시작...');
        console.log('선택된 차수:', this.selectedSequence);
        
        if (!this.selectedSequence) {
            this.showNotification('확정할 차수를 선택해주세요.', 'error');
            return;
        }

        const sequence = this.outboundSequences.find(s => s.id === this.selectedSequence);
        const sequenceParts = this.outboundParts.filter(part => part.sequence_id === this.selectedSequence);
        
        console.log('확정할 차수 정보:', sequence);
        console.log('확정할 파트들:', sequenceParts);
        
        const detailsHtml = `
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-sm font-medium">차수:</span>
                    <span class="text-sm">${sequence.outbound_date} ${sequence.sequence_number === 'AS' ? 'AS' : sequence.sequence_number + '차'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm font-medium">파트 수:</span>
                    <span class="text-sm">${this.outboundParts.filter(part => part.sequence_id === sequence.id).length}개</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm font-medium">총 스캔 수량:</span>
                    <span class="text-sm">${this.outboundParts.filter(part => part.sequence_id === sequence.id).reduce((sum, part) => sum + (part.scanned_qty || 0), 0)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm font-medium">총 실제 출고:</span>
                    <span class="text-sm">${this.outboundParts.filter(part => part.sequence_id === sequence.id).reduce((sum, part) => sum + (part.actual_qty || 0), 0)}</span>
                </div>
            </div>
        `;

        const confirmationDetails = document.getElementById('confirmationDetails');
        const confirmationModal = document.getElementById('confirmationModal');
        
        console.log('모달 요소들:', {
            confirmationDetails: confirmationDetails,
            confirmationModal: confirmationModal
        });
        
        if (confirmationDetails && confirmationModal) {
            confirmationDetails.innerHTML = detailsHtml;
            confirmationModal.classList.remove('hidden');
            console.log('확정 모달 표시 완료');
        } else {
            console.error('확정 모달 요소를 찾을 수 없습니다.');
            this.showNotification('확정 모달을 표시할 수 없습니다.', 'error');
        }
    }

    closeConfirmationModal() {
        document.getElementById('confirmationModal').classList.add('hidden');
    }

    // 기존 confirmOutbound 메서드는 processOutboundConfirmation으로 대체됨

    // 유틸리티 메서드들
    showLoading(show) {
        // 로딩 상태 표시/숨김 (간단한 구현)
        if (show) {
            console.log('로딩 시작...');
        } else {
            console.log('로딩 완료');
        }
    }

    showError(message) {
        const errorPrefix = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('error_prefix') : '오류: ';
        alert(errorPrefix + message);
        console.error('출고 취소 오류:', message);
    }

    showSuccess(message) {
        const successPrefix = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('success_prefix') : '성공: ';
        alert(successPrefix + message);
        console.log('출고 취소 성공:', message);
    }

    // 출고 취소 관련 메서드들
    setupCancelEventListeners() {
        // 출고 취소 버튼
        document.getElementById('cancelOutboundBtn').addEventListener('click', () => {
            this.showCancelModal();
        });

        // 취소 모달 닫기
        document.getElementById('cancelCancelAction').addEventListener('click', () => {
            this.closeCancelModal();
        });

        // 취소 확인
        document.getElementById('confirmCancelAction').addEventListener('click', () => {
            this.processOutboundCancel();
        });
    }

    showCancelModal() {
        if (!this.selectedSequence) {
            this.showError('취소할 출고를 선택해주세요.');
            return;
        }

        const sequence = this.outboundSequences.find(s => s.id === this.selectedSequence);
        if (!sequence) {
            this.showError('선택된 출고 정보를 찾을 수 없습니다.');
            return;
        }

        // 취소 상세 정보 표시
        const cancelDetails = document.getElementById('cancelDetails');
        cancelDetails.innerHTML = `
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-sm font-medium">차수:</span>
                    <span class="text-sm">${sequence.outbound_date} ${sequence.sequence_number === 'AS' ? 'AS' : sequence.sequence_number + '차'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm font-medium">상태:</span>
                    <span class="text-sm">${sequence.status === 'COMPLETED' ? '완료' : '대기'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm font-medium">파트 수:</span>
                    <span class="text-sm">${this.outboundParts.filter(p => p.sequence_id === sequence.id).length}개</span>
                </div>
            </div>
        `;

        document.getElementById('cancelOutboundModal').classList.remove('hidden');
    }

    closeCancelModal() {
        document.getElementById('cancelOutboundModal').classList.add('hidden');
    }

    async processOutboundCancel() {
        if (!this.selectedSequence) {
            this.showError('취소할 출고를 선택해주세요.');
            return;
        }

        const sequence = this.outboundSequences.find(s => s.id === this.selectedSequence);
        if (!sequence) {
            this.showError('선택된 출고 정보를 찾을 수 없습니다.');
            return;
        }

        this.showLoading(true);

        try {
            // 1. 관련된 재고 복구 및 거래 내역 삭제 (배치 처리)
            const sequenceParts = this.outboundParts.filter(p => p.sequence_id === this.selectedSequence);
            
            if (sequenceParts.length > 0) {
                // 재고 복구를 배치로 처리
                await this.processInventoryRestoreBatch(sequenceParts);
                
                // 해당 시퀀스의 파트들과 매칭되는 모든 거래 내역 삭제
                // (OUTBOUND 레코드만 삭제하여 today_outbound 감소)
                const partNumbers = sequenceParts.map(p => p.part_number);
                const outboundDate = sequence.outbound_date ? 
                    (sequence.outbound_date.includes('T') ? sequence.outbound_date.split('T')[0] : sequence.outbound_date) : 
                    new Date().toISOString().split('T')[0];
                
                // reference_id에 sequence_number가 포함된 거래 내역 삭제
                const { error: deleteError } = await this.supabase
                    .from('inventory_transactions')
                    .delete()
                    .eq('transaction_type', 'OUTBOUND')
                    .eq('transaction_date', outboundDate)
                    .eq('reference_id', sequence.sequence_number)
                    .in('part_number', partNumbers);

                if (deleteError) {
                    console.warn('OUTBOUND 거래 내역 삭제 중 오류:', deleteError);
                } else {
                    console.log(`삭제된 OUTBOUND 거래 내역: ${partNumbers.length}개 파트 (today_outbound 감소)`);
                }
            }

            // 2. 출고 파트 삭제 (CASCADE로 자동 삭제되지만 명시적으로 삭제)
            const { error: partsError } = await this.supabase
                .from('outbound_parts')
                .delete()
                .eq('sequence_id', this.selectedSequence);

            if (partsError) throw partsError;
            console.log('출고 파트 삭제 완료');

            // 3. 출고 시퀀스 삭제
            const { error: sequenceError } = await this.supabase
                .from('outbound_sequences')
                .delete()
                .eq('id', this.selectedSequence);

            if (sequenceError) throw sequenceError;
            console.log('출고 시퀀스 삭제 완료');

            // 로컬 데이터에서도 즉시 제거
            this.outboundSequences = this.outboundSequences.filter(s => s.id !== this.selectedSequence);
            this.outboundParts = this.outboundParts.filter(p => p.sequence_id !== this.selectedSequence);
            this.filteredSequences = this.filteredSequences.filter(s => s.id !== this.selectedSequence);
            
            console.log('로컬 데이터에서 삭제 완료');

            this.showSuccess('출고가 취소되었습니다. 재고가 복구되었습니다.');
            this.closeCancelModal();
            
            // 선택된 차수 초기화 (데이터 로드 전에)
            this.selectedSequence = null;
            
            // 데이터 다시 로드하여 상태 변경 반영 (캐시 무시)
            await this.forceRefreshData();
            
            // daily_inventory_summary 업데이트 (출고 날짜 기준)
            const summaryDate = sequence.outbound_date ? 
                (sequence.outbound_date.includes('T') ? sequence.outbound_date.split('T')[0] : sequence.outbound_date) : 
                new Date().toISOString().split('T')[0];
            
            console.log('출고 취소 후 daily_inventory_summary 업데이트 시작...');
            console.log('출고 날짜:', summaryDate);
            await this.updateDailyInventorySummary(summaryDate);
            
            // UI 업데이트
            this.updateConfirmButtons();
            this.updateStats();
            
            // 파트 상세 섹션 숨기기
            const partsDetailsSection = document.getElementById('partsDetailsSection');
            if (partsDetailsSection) {
                partsDetailsSection.classList.add('hidden');
            }
            
            // 테이블 다시 렌더링 (확실하게)
            this.renderSequences();
            
        } catch (error) {
            console.error('출고 취소 오류:', error);
            this.showError('출고 취소 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 출고 수정 관련 메서드들

    showEditModal(sequenceId) {
        const sequence = this.outboundSequences.find(s => s.id === sequenceId);
        if (!sequence) {
            this.showError('수정할 출고 정보를 찾을 수 없습니다.');
            return;
        }

        this.editingSequence = sequence;
        
        // 기존 파트 데이터를 registrationParts 형태로 변환
        const existingParts = this.outboundParts.filter(p => p.sequence_id === sequenceId);
        this.registrationParts = existingParts.map(part => ({
            partNumber: part.part_number,
            quantity: part.actual_qty || 0
        }));

        // 출고 등록 모달을 수정 모드로 열기
        this.openRegistrationModal(true);
    }



    updateDifference(input) {
        const originalQty = parseInt(input.dataset.originalQty) || 0;
        const newQty = parseInt(input.value) || 0;
        const difference = newQty - originalQty;
        
        const row = input.closest('tr');
        const differenceCell = row.querySelector('.difference-cell');
        
        if (difference > 0) {
            differenceCell.textContent = `+${difference}`;
            differenceCell.className = 'px-4 py-2 text-sm text-green-600 difference-cell';
        } else if (difference < 0) {
            differenceCell.textContent = `${difference}`;
            differenceCell.className = 'px-4 py-2 text-sm text-red-600 difference-cell';
        } else {
            differenceCell.textContent = '0';
            differenceCell.className = 'px-4 py-2 text-sm text-gray-800 difference-cell';
        }
    }


    async updateInventoryAfterOutbound(partNumber, outboundQuantity, sequenceDate = null, sequence = null) {
        console.log(`=== 재고 차감 시작 (트리거 방식) ===`);
        console.log(`파트 번호: ${partNumber}`);
        console.log(`차감 수량: ${outboundQuantity}개`);
        console.log(`출고 날짜: ${sequenceDate}`);
        
        try {
            // 재고 부족 확인을 위해 현재 재고 조회
            const { data: existingInventory, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('part_number, current_stock, status, last_updated')
                .eq('part_number', partNumber)
                .maybeSingle();

            if (inventoryError) {
                console.warn(`파트 ${partNumber} 재고 조회 오류:`, inventoryError);
                throw inventoryError;
            }

            if (!existingInventory || !existingInventory.part_number) {
                throw new Error(`파트 번호 ${partNumber}에 대한 재고 정보를 찾을 수 없습니다.`);
            }
            
            // 재고 부족 확인
            const currentStock = existingInventory.current_stock || 0;
            console.log(`=== 재고 차감 전 확인 ===`);
            console.log(`파트 번호: ${partNumber}`);
            console.log(`차감 예정 수량: ${outboundQuantity}개`);
            console.log(`현재 재고: ${currentStock}개`);
            console.log(`차감 후 예상 재고: ${currentStock - outboundQuantity}개`);
            
            if (currentStock < outboundQuantity) {
                console.warn(`재고 부족: ${partNumber} - 현재 재고 ${currentStock}개, 출고 요청 ${outboundQuantity}개. 재고 차감을 건너뜁니다.`);
                return;
            }

            // inventory_transactions에 기록하고 inventory 직접 업데이트
            // transaction_date는 실제 출고 날짜(outbound_date)로 설정
            const transactionDate = sequenceDate ? 
                (sequenceDate.includes('T') ? sequenceDate.split('T')[0] : sequenceDate) : 
                new Date().toISOString().split('T')[0];

            console.log(`=== 거래 내역 기록 및 재고 직접 업데이트 ===`);
            console.log(`거래 날짜: ${transactionDate} (출고 날짜: ${sequenceDate})`);
            
            // inventory_transactions에 기록
            const transactionData = {
                transaction_date: transactionDate,
                part_number: partNumber,
                transaction_type: 'OUTBOUND',
                quantity: outboundQuantity,
                reference_id: (sequence && sequence.sequence_number) ? sequence.sequence_number : `OUTBOUND_${Date.now()}`,
                notes: `출고 처리 - 수량: ${outboundQuantity}개 (${sequenceDate || '오늘'} 출고)`
            };
            
            console.log('거래 내역 삽입 데이터:', transactionData);
            
            const { error: transactionError } = await this.supabase
                .from('inventory_transactions')
                .insert(transactionData);

            if (transactionError) {
                console.error(`파트 ${partNumber} 거래 내역 기록 실패:`, transactionError);
                throw transactionError;
            } else {
                console.log(`파트 ${partNumber} 거래 내역 기록 성공`);
            }

            // inventory 테이블 직접 업데이트 (트리거가 비활성화되어 있으므로)
            await this.updateInventoryDirectly(partNumber, outboundQuantity, 'OUTBOUND');
            
            console.log(`파트 ${partNumber} 거래 내역 기록 및 재고 업데이트 완료`);

            // 트리거가 실행된 후 재고 확인
            setTimeout(async () => {
                const { data: updatedInventory } = await this.supabase
                    .from('inventory')
                    .select('current_stock')
                    .eq('part_number', partNumber)
                    .maybeSingle();
                    
                if (updatedInventory) {
                    console.log(`=== 트리거 실행 후 재고 확인 ===`);
                    console.log(`파트 번호: ${partNumber}`);
                    console.log(`예상 재고: ${currentStock - outboundQuantity}개`);
                    console.log(`실제 재고: ${updatedInventory.current_stock}개`);
                    console.log(`차이: ${updatedInventory.current_stock - (currentStock - outboundQuantity)}개`);
                }
            }, 1000);

            console.log(`=== 재고 차감 완료 ===`);

        } catch (error) {
            console.error(`파트 ${partNumber} 재고 차감 실패:`, error);
            throw error;
        }
        
        /* 아래 코드는 비활성화됨
        // 파트별 중복 실행 방지 (더 강화)
        const lockKey = `outbound_${partNumber}_${outboundQuantity}_${sequenceDate}`;
        if (this.processingParts && this.processingParts.has(lockKey)) {
            console.log(`파트 ${partNumber} 재고 차감이 이미 진행 중입니다. 건너뜁니다. (Lock: ${lockKey})`);
            return;
        }
        
        if (!this.processingParts) {
            this.processingParts = new Set();
        }
        this.processingParts.add(lockKey);
        
        console.log(`=== 재고 차감 락 설정: ${lockKey} ===`);
        
        try {
            console.log(`=== 재고 차감 시작 ===`);
            console.log(`파트 번호: ${partNumber}`);
            console.log(`차감 수량: ${outboundQuantity}개`);
            console.log(`출고 날짜: ${sequenceDate}`);

            // 1. inventory 테이블에서 해당 파트 조회 (최신 상태 확인)
            console.log(`파트 ${partNumber}의 최신 재고 상태 조회 중...`);
            const { data: existingInventory, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('part_number, current_stock, status, last_updated')
                .eq('part_number', partNumber)
                .maybeSingle();

            if (inventoryError) {
                console.warn(`파트 ${partNumber} 재고 조회 오류:`, inventoryError);
                throw inventoryError;
            }

            if (!existingInventory || !existingInventory.part_number) {
                throw new Error(`파트 번호 ${partNumber}에 대한 재고 정보를 찾을 수 없습니다.`);
            }
            
            // 재고 부족 확인
            const currentStock = existingInventory.current_stock || 0;
            console.log(`=== 재고 차감 전 최종 확인 ===`);
            console.log(`파트 번호: ${partNumber}`);
            console.log(`차감 예정 수량: ${outboundQuantity}개`);
            console.log(`현재 재고: ${currentStock}개`);
            console.log(`차감 후 예상 재고: ${currentStock - outboundQuantity}개`);
            
            if (currentStock < outboundQuantity) {
                console.warn(`재고 부족: ${partNumber} - 현재 재고 ${currentStock}개, 출고 요청 ${outboundQuantity}개. 재고 차감을 건너뜁니다.`);
                return; // 재고 차감을 건너뛰고 성공으로 처리
            }

            // 재고 차감
            const newStock = currentStock - outboundQuantity;
            const { error: updateError } = await this.supabase
                .from('inventory')
                .update({ 
                    current_stock: newStock, 
                    last_updated: new Date().toISOString()
                })
                .eq('part_number', partNumber);

            if (updateError) {
                console.error(`파트 ${partNumber} 재고 업데이트 실패:`, updateError);
                throw updateError;
            }

            console.log(`파트 ${partNumber} 재고 차감 완료: ${currentStock} → ${newStock} (차감량: ${outboundQuantity}개)`);
            
            // 재고 차감 후 실제 DB 상태 재확인
            const { data: updatedInventory, error: verifyError } = await this.supabase
                .from('inventory')
                .select('current_stock, last_updated')
                .eq('part_number', partNumber)
                .maybeSingle();
                
            if (!verifyError && updatedInventory) {
                console.log(`=== 재고 차감 후 DB 재확인 ===`);
                console.log(`파트 번호: ${partNumber}`);
                console.log(`예상 재고: ${newStock}개`);
                console.log(`실제 DB 재고: ${updatedInventory.current_stock}개`);
                console.log(`차이: ${updatedInventory.current_stock - newStock}개`);
                
                if (updatedInventory.current_stock !== newStock) {
                    console.warn(`⚠️ 재고 차감 결과가 예상과 다릅니다!`);
                    console.warn(`예상: ${newStock}개, 실제: ${updatedInventory.current_stock}개`);
                }
            }

            // 2. inventory_transactions에 거래 내역 기록
            const transactionDate = sequenceDate ? 
                (sequenceDate.includes('T') ? sequenceDate.split('T')[0] : sequenceDate) : 
                new Date().toISOString().split('T')[0];

            const { error: transactionError } = await this.supabase
                .from('inventory_transactions')
                .insert({
                    transaction_date: transactionDate,
                part_number: partNumber,
                    transaction_type: 'OUTBOUND',
                quantity: outboundQuantity,
                    reference_id: `OUTBOUND_${Date.now()}`,
                    notes: `출고 처리 - 수량: ${outboundQuantity}개`
                });

            if (transactionError) {
                console.error(`파트 ${partNumber} 거래 내역 기록 실패:`, transactionError);
                // 거래 내역 기록 실패해도 재고 업데이트는 성공으로 처리
            } else {
                console.log(`파트 ${partNumber} 거래 내역 기록 완료 (수량: ${outboundQuantity}개)`);
            }

            console.log(`=== 재고 차감 완료 ===`);

        } catch (error) {
            console.error(`파트 ${partNumber} 재고 차감 실패:`, error);
            throw error;
        } finally {
            // 락 해제
            this.processingParts.delete(lockKey);
        }
        */
    }

    async updateInventoryAfterInbound(partNumber, inboundQuantity, inboundDate = null) {
        try {
            console.log(`파트 ${partNumber} 재고 증가: +${inboundQuantity}개`);

            // 1. inventory 테이블에서 해당 파트 조회
            const { data: existingInventory, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('part_number, current_stock, status, last_updated')
                .eq('part_number', partNumber)
                .maybeSingle();

            if (inventoryError) {
                console.warn(`파트 ${partNumber} 재고 조회 오류:`, inventoryError);
                throw inventoryError;
            }

            if (!existingInventory || !existingInventory.part_number) {
                throw new Error(`파트 번호 ${partNumber}에 대한 재고 정보를 찾을 수 없습니다.`);
            }

            // 재고 증가
            const currentStock = existingInventory.current_stock || 0;
            const newStock = currentStock + inboundQuantity;
            
            const { error: updateError } = await this.supabase
                .from('inventory')
                .update({
                    current_stock: newStock,
                    last_updated: new Date().toISOString()
                })
                .eq('part_number', partNumber);

            if (updateError) {
                console.error(`파트 ${partNumber} 재고 업데이트 실패:`, updateError);
                // 재고 업데이트 실패해도 거래 내역은 기록하도록 계속 진행
                console.warn('재고 업데이트 실패했지만 거래 내역은 기록합니다.');
            } else {
                console.log(`파트 ${partNumber} 재고 증가: ${currentStock} → ${newStock}`);
            }

            // 2. inventory_transactions에 거래 내역 기록
            const transactionDate = inboundDate ? 
                (inboundDate.includes('T') ? inboundDate.split('T')[0] : inboundDate) : 
                new Date().toISOString().split('T')[0];

            const { error: transactionError } = await this.supabase
                .from('inventory_transactions')
                .insert({
                    transaction_date: transactionDate,
                    part_number: partNumber,
                    transaction_type: 'INBOUND',
                    quantity: inboundQuantity,
                    reference_id: `INBOUND_${Date.now()}`,
                    notes: `재고 복구 - 수량: ${inboundQuantity}개`
                });

            if (transactionError) {
                console.error(`파트 ${partNumber} 거래 내역 기록 실패:`, transactionError);
                // 거래 내역 기록 실패해도 재고 업데이트는 성공으로 처리
            } else {
                console.log(`파트 ${partNumber} 거래 내역 기록 완료`);
            }

        } catch (error) {
            console.error(`파트 ${partNumber} 재고 증가 실패:`, error);
            throw error;
        }
    }

    bindActualQtyInputs() {
        const inputs = document.querySelectorAll('.actual-qty-input');
        inputs.forEach(input => {
            input.addEventListener('change', async (e) => {
                const partId = parseInt(e.target.dataset.partId);
                const newActualQty = parseInt(e.target.value) || 0;
                await this.updatePartActualQty(partId, newActualQty);
            });
        });
    }

    async updatePartActualQty(partId, newActualQty) {
        try {
            // 1. 이전 값 저장
            const part = this.outboundParts.find(p => p.id === partId);
            if (!part) {
                console.error('파트를 찾을 수 없습니다:', partId);
                return;
            }
            
            const oldActualQty = part.actual_qty || 0;
            const quantityDifference = newActualQty - oldActualQty;
            
            console.log(`=== 실제 출고 수량 변경 감지 ===`);
            console.log(`파트 번호: ${part.part_number}`);
            console.log(`파트 ID: ${partId}`);
            console.log(`이전 actual_qty: ${oldActualQty}`);
            console.log(`새 actual_qty: ${newActualQty}`);
            console.log(`차이: ${quantityDifference}`);
            console.log(`이 변경사항이 DB에 저장됩니다!`);

            // 2. 데이터베이스에서 파트 업데이트
            const { error: updateError } = await this.supabase
                .from('outbound_parts')
                .update({ 
                    actual_qty: newActualQty
                })
                .eq('id', partId);

            if (updateError) {
                throw updateError;
            }

            // 3. 로컬 데이터 업데이트
                part.actual_qty = newActualQty;
                
            // 4. 재고 조정은 확정 시에만 수행 (실시간 조정 제거)
            // 실제 출고 수량 변경 시에는 재고를 조정하지 않음
            
            // 5. 시퀀스의 총 수량도 업데이트
                await this.updateSequenceTotals(part.sequence_id);
                
            // 6. UI 다시 렌더링
                this.renderParts(part.sequence_id);
                this.renderSequences();

            console.log(`파트 ${partId} 실제 출고 수량 업데이트 완료: ${newActualQty}`);
        } catch (error) {
            console.error('실제 출고 수량 업데이트 오류:', error);
            this.showNotification('실제 출고 수량 업데이트 중 오류가 발생했습니다.', 'error');
        }
    }

    async updateSequenceTotals(sequenceId) {
        try {
            const sequence = this.outboundSequences.find(s => s.id === sequenceId);
            if (sequence) {
                const sequenceParts = this.outboundParts.filter(p => p.sequence_id === sequenceId);
                const totalScanned = sequenceParts.reduce((sum, p) => sum + (p.scanned_qty || 0), 0);
                const totalActual = sequenceParts.reduce((sum, p) => sum + (p.actual_qty || 0), 0);

                // 데이터베이스에서 시퀀스 업데이트
                const { error: updateError } = await this.supabase
                    .from('outbound_sequences')
                    .update({
                        status: 'COMPLETED'
                    })
                    .eq('id', sequenceId);

                if (updateError) {
                    throw updateError;
                }

                console.log(`시퀀스 ${sequenceId} 총계 업데이트: 스캔=${totalScanned}, 실제=${totalActual}`);
            }
        } catch (error) {
            console.error('시퀀스 총계 업데이트 오류:', error);
            throw error;
        }
    }

    toggleSelectAllParts(checked) {
        const checkboxes = document.querySelectorAll('.part-checkbox:not(:disabled)');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            // 각 행의 배경색도 업데이트
            const row = checkbox.closest('tr');
            if (row) {
                this.updateRowBackgroundColor(row, checked);
            }
        });
        this.updateConfirmButtons();
    }

    updateConfirmButtons() {
        const confirmBtn = document.getElementById('confirmOutboundBtn');
        const confirmAllBtn = document.getElementById('confirmAllBtn');
        
        console.log('확정 버튼 상태 업데이트:');
        console.log('- 선택된 차수:', this.selectedSequence);
        console.log('- 확정 버튼 요소:', confirmBtn);
        console.log('- 전체 확정 버튼 요소:', confirmAllBtn);
        
        // 차수가 선택되었고, 해당 차수에 파트가 있으면 확정 버튼 활성화
        const hasSelectedSequence = this.selectedSequence !== null;
        const hasParts = hasSelectedSequence ? 
            this.outboundParts.filter(part => part.sequence_id === this.selectedSequence).length > 0 : false;
        
        console.log('- 차수 선택됨:', hasSelectedSequence);
        console.log('- 파트 있음:', hasParts);
        
        // 선택 확정 버튼 활성화/비활성화
        if (confirmBtn) {
            if (hasSelectedSequence && hasParts) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            console.log('선택 확정 버튼 활성화됨');
        } else {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
            console.log('선택 확정 버튼 비활성화됨');
            }
        }
        
        // 전체 확정 버튼 활성화/비활성화 (출고 파트가 있으면 활성화)
        if (confirmAllBtn) {
            const hasOutboundParts = this.outboundParts.length > 0;
            if (hasOutboundParts) {
            confirmAllBtn.disabled = false;
            confirmAllBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            console.log('전체 확정 버튼 활성화됨');
        } else {
            confirmAllBtn.disabled = true;
            confirmAllBtn.classList.add('opacity-50', 'cursor-not-allowed');
            console.log('전체 확정 버튼 비활성화됨');
        }
        }
        
        // 출고 취소 버튼 활성화/비활성화 (차수가 선택되면 활성화)
        const cancelBtn = document.getElementById('cancelOutboundBtn');
        if (cancelBtn) {
            if (hasSelectedSequence) {
                cancelBtn.disabled = false;
                cancelBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                console.log('출고 취소 버튼 활성화됨');
            } else {
                cancelBtn.disabled = true;
                cancelBtn.classList.add('opacity-50', 'cursor-not-allowed');
                console.log('출고 취소 버튼 비활성화됨');
        }
        }
    }



    showConfirmationModal(type = 'selected') {
        console.log('확정 모달 표시 시작...');
        console.log('모달 타입:', type);
        console.log('선택된 차수:', this.selectedSequence);
        
        if (!this.selectedSequence) {
            console.error('선택된 차수가 없습니다.');
            this.showNotification('확정할 차수를 선택해주세요.', 'error');
            return;
        }

        const sequence = this.outboundSequences.find(s => s.id === this.selectedSequence);
        const sequenceParts = this.outboundParts.filter(part => part.sequence_id === this.selectedSequence);
        
        console.log('찾은 차수 정보:', sequence);
        console.log('해당 차수의 파트들:', sequenceParts);
        
        if (!sequence) {
            console.error('선택된 차수를 찾을 수 없습니다.');
            this.showNotification('선택된 차수 정보를 찾을 수 없습니다.', 'error');
            return;
        }
        
        let detailsHtml = '';
        
        if (type === 'all') {
            detailsHtml = `
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">차수:</span>
                        <span class="text-sm">${sequence.outbound_date} ${sequence.sequence_number === 'AS' ? 'AS' : sequence.sequence_number + '차'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">파트 수:</span>
                        <span class="text-sm">${this.outboundParts.filter(part => part.sequence_id === sequence.id).length}개 (전체)</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">총 스캔 수량:</span>
                        <span class="text-sm">${this.outboundParts.filter(part => part.sequence_id === sequence.id).reduce((sum, part) => sum + (part.scanned_qty || 0), 0)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">총 실제 출고:</span>
                        <span class="text-sm">${this.outboundParts.filter(part => part.sequence_id === sequence.id).reduce((sum, part) => sum + (part.actual_qty || 0), 0)}</span>
                    </div>
                </div>
            `;
        } else {
            // 'selected' 타입일 때는 해당 차수의 모든 파트를 선택된 것으로 처리
            const selectedPartData = sequenceParts;
            
            console.log('선택된 파트 데이터 (차수 전체):', selectedPartData);
            
            detailsHtml = `
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">차수:</span>
                        <span class="text-sm">${sequence.outbound_date} ${sequence.sequence_number === 'AS' ? 'AS' : sequence.sequence_number + '차'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">선택된 파트:</span>
                        <span class="text-sm">${selectedPartData.length}개</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">총 실제 출고:</span>
                        <span class="text-sm">${selectedPartData.reduce((sum, part) => sum + (part.actual_qty || 0), 0)}</span>
                    </div>
                </div>
            `;
        }

        console.log('생성된 상세 정보 HTML:', detailsHtml);
        
        const detailsElement = document.getElementById('confirmationDetails');
        if (detailsElement) {
            detailsElement.innerHTML = detailsHtml;
            console.log('상세 정보가 모달에 설정되었습니다.');
        } else {
            console.error('confirmationDetails 요소를 찾을 수 없습니다.');
        }
        
        const modalElement = document.getElementById('confirmationModal');
        if (modalElement) {
            modalElement.classList.remove('hidden');
            console.log('확정 모달이 표시되었습니다.');
        } else {
            console.error('confirmationModal 요소를 찾을 수 없습니다.');
        }
    }

    // 전체 파트 선택 후 확정 모달 표시
    selectAllPartsForConfirmation() {
        if (!this.selectedSequence) {
            this.showNotification('확정할 차수를 선택해주세요.', 'error');
            return;
        }

        // 모든 체크박스 선택
        const checkboxes = document.querySelectorAll('.part-checkbox:not(:disabled)');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            // 각 행의 배경색도 업데이트
            const row = checkbox.closest('tr');
            if (row) {
                this.updateRowBackgroundColor(row, true);
            }
        });

        // 확정 버튼 상태 업데이트
        this.updateConfirmButtons();

        // 확정 모달 표시
        this.showConfirmationModal('all');
    }

    // 확정 모달에서 호출되는 실제 확정 처리 메서드
    async processOutboundConfirmation() {
        // 중복 실행 방지 (더 강화)
        if (this.isProcessingConfirmation) {
            console.log('확정 처리가 이미 진행 중입니다. 중복 실행 방지됨.');
            return;
        }
        
        // 처리 중 플래그 설정
        this.isProcessingConfirmation = true;
        console.log('=== 확정 프로세스 시작 (완전 격리 모드) ===');
        
        // 모든 이벤트 리스너 일시 비활성화
        this.disableAllEventListeners();
        
        // 확정 버튼 즉시 비활성화
        const confirmBtn = document.getElementById('confirmOutboundAction');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = '처리 중...';
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        
        // 모달의 다른 버튼들도 비활성화
        const cancelBtn = document.getElementById('cancelConfirmation');
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        
        console.log('=== 확정 프로세스 시작 ===');
        console.log('선택된 차수:', this.selectedSequence);
        console.log('Supabase 클라이언트 상태:', this.supabase);
        console.log('현재 데이터 상태:', {
            sequences: this.outboundSequences,
            parts: this.outboundParts
        });
        
        if (!this.selectedSequence) {
            console.error('선택된 차수가 없습니다!');
            this.showNotification('확정할 차수를 선택해주세요.', 'error');
            throw new Error('선택된 차수가 없습니다.');
        }

        // 선택된 차수 정보 확인
        const selectedSequenceData = this.outboundSequences.find(s => s.id === this.selectedSequence);
        console.log('선택된 차수 데이터:', selectedSequenceData);
        
        if (!selectedSequenceData) {
            console.error('선택된 차수 데이터를 찾을 수 없습니다!');
            this.showNotification('선택된 차수 정보를 찾을 수 없습니다.', 'error');
            throw new Error('선택된 차수 데이터를 찾을 수 없습니다.');
        }

        let databaseSuccess = false;
        
        try {
            // Supabase 연결이 없는 경우 Mock 데이터로 처리
            if (!this.supabase) {
                console.log('Supabase 연결 없음 - Mock 데이터로 확정 처리');
                databaseSuccess = false;
            } else {
                console.log('1단계: 출고 차수 상태 업데이트 시작...');
                console.log('업데이트할 차수 ID:', this.selectedSequence);
                
                // 1. 출고 차수 상태 업데이트
                const { data: sequenceData, error: sequenceError } = await this.supabase
                    .from('outbound_sequences')
                    .update({ 
                        status: 'COMPLETED'
                    })
                    .eq('id', this.selectedSequence)
                    .select();

                if (sequenceError) {
                    console.error('출고 차수 업데이트 오류:', sequenceError);
                    console.error('오류 상세 정보:', {
                        message: sequenceError.message,
                        details: sequenceError.details,
                        hint: sequenceError.hint,
                        code: sequenceError.code
                    });
                    databaseSuccess = false;
                } else {
                    console.log('출고 차수 업데이트 성공:', sequenceData);
                    databaseSuccess = true;
                }

                if (databaseSuccess) {
                    console.log('2단계: 출고 파트 상태 업데이트 시작...');
                    // 2. 출고 파트 상태 업데이트
                    const { data: partsData, error: partsError } = await this.supabase
                        .from('outbound_parts')
                        .update({ 
                            status: 'COMPLETED'
                        })
                        .eq('sequence_id', this.selectedSequence)
                        .select();

                    if (partsError) {
                        console.error('출고 파트 업데이트 오류:', partsError);
                        console.error('오류 상세 정보:', {
                            message: partsError.message,
                            details: partsError.details,
                            hint: partsError.hint,
                            code: partsError.code
                        });
                        databaseSuccess = false;
                    } else {
                        console.log('출고 파트 업데이트 성공:', partsData);
                    }
                }

                if (databaseSuccess) {
                    console.log('3단계: 재고 차감 처리 시작...');
                    // 3. 재고 차감 처리 (선택적)
                    try {
                        // 확정 전에 DB에서 직접 최신 데이터 조회
                        console.log('확정 전 DB에서 직접 최신 데이터 조회 중...');
                        
                        const { data: dbParts, error: dbPartsError } = await this.supabase
                            .from('outbound_parts')
                            .select('*')
                            .eq('sequence_id', this.selectedSequence);
                            
                        if (dbPartsError) {
                            console.error('DB에서 파트 데이터 조회 실패:', dbPartsError);
                            throw dbPartsError;
                        }
                        
                        console.log('DB에서 조회한 파트들:', dbParts);
                        
                        // 각 파트의 상세 정보 로그
                        dbParts.forEach((part, index) => {
                            console.log(`DB 파트 ${index + 1}: ${part.part_number}`);
                            console.log(`  - ID: ${part.id}`);
                            console.log(`  - actual_qty: ${part.actual_qty} (DB에서 직접 조회)`);
                            console.log(`  - planned_qty: ${part.planned_qty}`);
                            console.log(`  - scanned_qty: ${part.scanned_qty}`);
                            console.log(`  - status: ${part.status}`);
                        });
                        
                        // 선택된 시퀀스의 날짜 가져오기
                        const selectedSequenceData = this.outboundSequences.find(s => s.id === this.selectedSequence);
                        const sequenceDate = selectedSequenceData ? selectedSequenceData.outbound_date : null;
                        console.log(`시퀀스 날짜: ${sequenceDate}`);
                        
                        // 처리된 파트 추적을 위한 Set
                        if (!this.processedParts) {
                            this.processedParts = new Set();
                        }
                        
                        // 재고 차감을 배치로 처리 (성능 최적화)
                        console.log('=== 재고 차감 시작 (배치 처리 모드) ===');
                        
                        // 모든 파트의 재고 차감을 배치로 처리
                        await this.processInventoryBatch(dbParts, sequenceDate, selectedSequenceData);
                        
                        console.log('=== 재고 차감 완료 (완전 격리 모드) ===');
                    } catch (inventoryError) {
                        console.warn('재고 차감 처리 중 오류 (무시하고 계속):', inventoryError);
                    }
                }
            }

            console.log('4단계: 로컬 데이터 업데이트 시작...');
            // 4. 로컬 데이터 업데이트 (항상 실행)
            const sequenceIndex = this.outboundSequences.findIndex(s => s.id === this.selectedSequence);
            if (sequenceIndex !== -1) {
                this.outboundSequences[sequenceIndex].status = 'CONFIRMED';
                console.log('로컬 차수 데이터 업데이트 완료');
            } else {
                console.error('로컬 차수 데이터를 찾을 수 없습니다!');
            }

            this.outboundParts.forEach(part => {
                if (part.sequence_id === this.selectedSequence) {
                    part.status = 'CONFIRMED';
                }
            });
            console.log('로컬 파트 데이터 업데이트 완료');

            const filteredIndex = this.filteredSequences.findIndex(s => s.id === this.selectedSequence);
            if (filteredIndex !== -1) {
                this.filteredSequences[filteredIndex].status = 'CONFIRMED';
                console.log('필터링된 차수 데이터 업데이트 완료');
            } else {
                console.error('필터링된 차수 데이터를 찾을 수 없습니다!');
            }

            console.log('5단계: UI 업데이트 시작...');
            // 5. UI 업데이트 (항상 실행)
            this.renderSequences();
            this.renderParts(this.selectedSequence);
            this.updateStats();
            this.closeConfirmationModal();

            // 6. 상태 초기화
            console.log('6단계: 상태 초기화 시작...');
            this.resetAfterConfirmation();

            // daily_inventory_summary 업데이트 (출고 날짜 기준)
            const outboundDate = selectedSequenceData.outbound_date ? 
                (selectedSequenceData.outbound_date.includes('T') ? selectedSequenceData.outbound_date.split('T')[0] : selectedSequenceData.outbound_date) : 
                new Date().toISOString().split('T')[0];
            
            console.log('출고 확정 후 daily_inventory_summary 업데이트 시작...');
            console.log('출고 날짜:', outboundDate);
            await this.updateDailyInventorySummary(outboundDate);
            console.log('daily_inventory_summary 업데이트 완료');

            console.log('=== 확정 프로세스 완료! ===');
            const successMessage = databaseSuccess ? 
                '출하가 성공적으로 확정되었습니다. 페이지를 새로고침합니다.' : 
                '출하가 성공적으로 확정되었습니다. (로컬 데이터) 페이지를 새로고침합니다.';
            this.showNotification(successMessage, 'success');
            
            // 페이지 전체 리프레시
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error('출하 확정 중 오류 발생:', error);
            console.error('오류 상세 정보:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                stack: error.stack
            });
            
            // 오류 발생 시에도 로컬 데이터 업데이트 시도
            try {
                console.log('오류 발생으로 로컬 데이터만 업데이트 시도...');
                const sequenceIndex = this.outboundSequences.findIndex(s => s.id === this.selectedSequence);
                if (sequenceIndex !== -1) {
                    this.outboundSequences[sequenceIndex].status = 'CONFIRMED';
                }

                this.outboundParts.forEach(part => {
                    if (part.sequence_id === this.selectedSequence) {
                        part.status = 'CONFIRMED';
                    }
                });

                const filteredIndex = this.filteredSequences.findIndex(s => s.id === this.selectedSequence);
                if (filteredIndex !== -1) {
                    this.filteredSequences[filteredIndex].status = 'CONFIRMED';
                }

                // UI 업데이트
                this.renderSequences();
                this.renderParts(this.selectedSequence);
                this.updateStats();
                this.closeConfirmationModal();
                
                // 상태 초기화
                this.resetAfterConfirmation();

                // daily_inventory_summary 업데이트 (출고 날짜 기준)
                const outboundDate = sequence.outbound_date ? 
                    (sequence.outbound_date.includes('T') ? sequence.outbound_date.split('T')[0] : sequence.outbound_date) : 
                    new Date().toISOString().split('T')[0];
                
                console.log('출고 확정 후 daily_inventory_summary 업데이트 시작...');
                console.log('출고 날짜:', outboundDate);
                await this.updateDailyInventorySummary(outboundDate);

                this.showNotification('출하가 확정되었습니다. 페이지를 새로고침합니다.', 'success');
                
                // 페이지 전체 리프레시
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } catch (localError) {
                console.error('로컬 데이터 업데이트도 실패:', localError);
                this.showNotification('확정 처리 중 오류가 발생했습니다.', 'error');
                throw error; // 원래 오류를 다시 던짐
            }
        } finally {
            // 플래그 해제
            this.isProcessingConfirmation = false;
            
            // 처리된 파트 목록 초기화
            this.processedParts = new Set();
            
            // 모든 이벤트 리스너 재활성화
            this.enableAllEventListeners();
            
            // 확정 버튼 텍스트 복원
            const confirmBtn = document.getElementById('confirmOutboundAction');
            if (confirmBtn) {
                confirmBtn.textContent = '확정';
                confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
            
            console.log('=== 확정 프로세스 완료 (완전 격리 모드 종료) ===');
        }
    }

    // 재고 차감을 배치로 처리하는 메서드 (성능 최적화)
    async processInventoryBatch(parts, sequenceDate, sequence = null) {
        console.log('=== 재고 차감 배치 처리 시작 ===');
        console.log(`처리할 파트 수: ${parts.length}개`);
        
        const transactionDate = sequenceDate ? 
            (sequenceDate.includes('T') ? sequenceDate.split('T')[0] : sequenceDate) : 
            new Date().toISOString().split('T')[0];
        
        try {
            // 1. 현재 재고 상태 조회 (한 번에)
            const partNumbers = parts.map(p => p.part_number);
            const { data: currentInventory, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('part_number, current_stock')
                .in('part_number', partNumbers);
                
            if (inventoryError) {
                throw inventoryError;
            }
            
            console.log('현재 재고 조회 완료:', currentInventory.length, '개 파트');
            
            // 2. 재고 부족 파트 확인
            const insufficientStock = [];
            const validParts = [];
            
            for (const part of parts) {
                const inventory = currentInventory.find(inv => inv.part_number === part.part_number);
                if (!inventory) {
                    console.warn(`파트 ${part.part_number}의 재고 정보가 없습니다. 건너뜁니다.`);
                    continue;
                }
                
                if (inventory.current_stock < part.actual_qty) {
                    insufficientStock.push({
                        part_number: part.part_number,
                        current_stock: inventory.current_stock,
                        required: part.actual_qty
                    });
                } else {
                    validParts.push(part);
                }
            }
            
            if (insufficientStock.length > 0) {
                console.warn('재고 부족 파트들:', insufficientStock);
            }
            
            if (validParts.length === 0) {
                console.warn('처리 가능한 파트가 없습니다.');
                return;
            }
            
            // 3. inventory_transactions 배치 삽입
            const transactionData = validParts.map(part => ({
                transaction_date: transactionDate,
                part_number: part.part_number,
                transaction_type: 'OUTBOUND',
                quantity: part.actual_qty,
                reference_id: (sequence && sequence.sequence_number) ? sequence.sequence_number : `OUTBOUND_${Date.now()}_${part.id}`,
                notes: `출고 처리 - 수량: ${part.actual_qty}개 (${sequenceDate || '오늘'} 출고)`
            }));
            
            console.log('=== inventory_transactions 배치 삽입 시작 ===');
            console.log(`삽입할 거래 내역 수: ${transactionData.length}건`);
            console.log('거래 내역 샘플 (최대 5건):', transactionData.slice(0, 5));
            console.log('transaction_date 형식:', transactionDate);
            console.log('transaction_date 타입:', typeof transactionDate);
            
            const { data: insertedData, error: transactionError } = await this.supabase
                .from('inventory_transactions')
                .insert(transactionData)
                .select(); // 삽입된 데이터 반환
            
            if (transactionError) {
                console.error('❌ inventory_transactions 삽입 실패!');
                console.error('에러 상세:', transactionError);
                console.error('삽입 시도한 데이터:', transactionData);
                throw transactionError;
            }
            
            if (insertedData) {
                console.log(`✅ inventory_transactions 삽입 성공: ${insertedData.length}건`);
                console.log('삽입된 데이터 샘플 (최대 5건):', insertedData.slice(0, 5));
            } else {
                console.warn('⚠️ insertedData가 null입니다. 삽입은 성공했지만 반환된 데이터가 없습니다.');
            }
            
            console.log('=== inventory_transactions 배치 삽입 완료 ===');
            
            // 4. inventory 테이블 배치 업데이트
            console.log('재고 배치 업데이트 시작...');
            const inventoryUpdates = validParts.map(part => {
                const inventory = currentInventory.find(inv => inv.part_number === part.part_number);
                return {
                    part_number: part.part_number,
                    current_stock: inventory.current_stock - part.actual_qty
                };
            });
            
            // 각 파트별로 업데이트 (PostgreSQL의 UPSERT 제한으로 인해)
            for (const update of inventoryUpdates) {
                const { error: updateError } = await this.supabase
                    .from('inventory')
                    .update({ current_stock: update.current_stock })
                    .eq('part_number', update.part_number);
                    
                if (updateError) {
                    console.error(`파트 ${update.part_number} 재고 업데이트 실패:`, updateError);
                }
            }
            
            console.log('재고 배치 업데이트 완료');
            console.log(`성공적으로 처리된 파트: ${validParts.length}개`);
            
        } catch (error) {
            console.error('재고 배치 처리 중 오류:', error);
            throw error;
        }
        
        console.log('=== 재고 차감 배치 처리 완료 ===');
    }

    // 재고 복구를 배치로 처리하는 메서드 (취소 시)
    async processInventoryRestoreBatch(parts) {
        console.log('=== 재고 복구 배치 처리 시작 ===');
        console.log(`복구할 파트 수: ${parts.length}개`);
        
        try {
            // 1. 현재 재고 상태 조회 (한 번에)
            const partNumbers = parts.map(p => p.part_number);
            const { data: currentInventory, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('part_number, current_stock')
                .in('part_number', partNumbers);
                
            if (inventoryError) {
                throw inventoryError;
            }
            
            console.log('현재 재고 조회 완료:', currentInventory.length, '개 파트');
            
            // 2. 재고 복구 업데이트
            console.log('재고 복구 배치 업데이트 시작...');
            
            for (const part of parts) {
                const inventory = currentInventory.find(inv => inv.part_number === part.part_number);
                if (!inventory) {
                    console.warn(`파트 ${part.part_number}의 재고 정보가 없습니다. 건너뜁니다.`);
                    continue;
                }
                
                const newStock = inventory.current_stock + (part.actual_qty || 0);
                
                const { error: updateError } = await this.supabase
                    .from('inventory')
                    .update({ current_stock: newStock })
                    .eq('part_number', part.part_number);
                    
                if (updateError) {
                    console.error(`파트 ${part.part_number} 재고 복구 실패:`, updateError);
                } else {
                    console.log(`파트 ${part.part_number} 재고 복구 완료: ${inventory.current_stock} → ${newStock}`);
                }
            }
            
            console.log('재고 복구 배치 업데이트 완료');
            
        } catch (error) {
            console.error('재고 복구 배치 처리 중 오류:', error);
            throw error;
        }
        
        console.log('=== 재고 복구 배치 처리 완료 ===');
    }

    // 재고 차감을 한 번에 처리하는 메서드 (완전 격리) - 레거시
    async processInventoryUpdates(updates) {
        console.log('=== 재고 차감 일괄 처리 시작 ===');
        console.log(`처리할 파트 수: ${updates.length}개`);
        
        for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            console.log(`=== 파트 ${update.partNumber} 재고 차감 (${i+1}/${updates.length}) ===`);
            console.log(`차감 수량: ${update.quantity}개`);
            
            try {
                await this.updateInventoryAfterOutbound(update.partNumber, update.quantity, update.sequenceDate);
                console.log(`파트 ${update.partNumber} 재고 차감 완료`);
            } catch (error) {
                console.error(`파트 ${update.partNumber} 재고 차감 실패:`, error);
                // 개별 파트 실패해도 계속 진행
            }
            
            // 각 파트 처리 후 잠시 대기
            if (i < updates.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        console.log('=== 재고 차감 일괄 처리 완료 ===');
    }

    // 모든 이벤트 리스너 비활성화
    disableAllEventListeners() {
        console.log('모든 이벤트 리스너 비활성화 중...');
        
        // 확정 버튼 비활성화
        const confirmBtn = document.getElementById('confirmOutboundAction');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.style.pointerEvents = 'none';
        }
        
        // 취소 버튼 비활성화
        const cancelBtn = document.getElementById('cancelConfirmation');
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.style.pointerEvents = 'none';
        }
        
        // 모든 클릭 이벤트 일시 중지
        document.body.style.pointerEvents = 'none';
        
        console.log('이벤트 리스너 비활성화 완료');
    }
    
    // 모든 이벤트 리스너 재활성화
    enableAllEventListeners() {
        console.log('모든 이벤트 리스너 재활성화 중...');
        
        // 확정 버튼 재활성화
        const confirmBtn = document.getElementById('confirmOutboundAction');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.pointerEvents = 'auto';
        }
        
        // 취소 버튼 재활성화
        const cancelBtn = document.getElementById('cancelConfirmation');
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.style.pointerEvents = 'auto';
        }
        
        // 모든 클릭 이벤트 재활성화
        document.body.style.pointerEvents = 'auto';
        
        console.log('이벤트 리스너 재활성화 완료');
    }

    showNotification(message, type = 'info') {
        // 간단한 알림 표시
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    resetAfterConfirmation() {
        console.log('확정 후 상태 초기화 시작...');
        
        // 1. 선택된 차수 초기화
        this.selectedSequence = null;
        console.log('선택된 차수 초기화 완료');
        
        // 2. 파트 테이블 초기화
        const partsTableBody = document.getElementById('partsTableBody');
        if (partsTableBody) {
            const selectShiftText = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('select_shift_first') : '차수를 먼저 선택해주세요.';
            partsTableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-800/60">${selectShiftText}</td></tr>`;
        }
        
        // 3. 모든 체크박스 초기화
        const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        allCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
            const row = checkbox.closest('tr');
            if (row) {
                this.updateRowBackgroundColor(row, false);
            }
        });
        
        // 4. 전체 선택 체크박스 초기화
        const selectAllCheckbox = document.getElementById('selectAllParts');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
        
        // 5. 버튼 상태 초기화
        const confirmBtn = document.getElementById('confirmOutboundBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        
        const confirmAllBtn = document.getElementById('confirmAllBtn');
        if (confirmAllBtn) {
            confirmAllBtn.disabled = true;
            confirmAllBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        
        const cancelBtn = document.getElementById('cancelOutboundBtn');
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        
        // 6. 통계 초기화
        this.updateStats();
        
        // 7. 차수 테이블에서 선택 상태 제거
        const sequenceRows = document.querySelectorAll('#sequencesTableBody tr');
        sequenceRows.forEach(row => {
            row.classList.remove('bg-blue-50', 'border-blue-200');
            row.classList.add('hover:bg-gray-50');
        });
        
        console.log('확정 후 상태 초기화 완료');
    }

    // 재고 동기화 상태 검증 함수
    async validateInventorySync() {
        console.log('=== 재고 동기화 상태 검증 시작 ===');
        
        try {
            if (!this.supabase) {
                console.error('Supabase 클라이언트가 없습니다.');
                return false;
            }

            // 1. 최근 출고 확정 데이터 조회 (최근 7일)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

            const { data: recentOutbound, error: outboundError } = await this.supabase
                .from('outbound_sequences')
                .select(`
                    id,
                    sequence_number,
                    outbound_date,
                    status,
                    outbound_parts (
                        part_number,
                        actual_qty,
                        status
                    )
                `)
                .eq('status', 'COMPLETED')
                .gte('outbound_date', sevenDaysAgoStr)
                .order('outbound_date', { ascending: false });

            if (outboundError) {
                console.error('최근 출고 데이터 조회 오류:', outboundError);
                return false;
            }

            console.log(`최근 7일간 확정된 출고 차수: ${recentOutbound?.length || 0}개`);

            // 2. 각 출고에 대해 재고 차감 확인
            let syncIssues = [];
            
            for (const sequence of recentOutbound || []) {
                for (const part of sequence.outbound_parts || []) {
                    if (part.status === 'COMPLETED' && part.actual_qty > 0) {
                        // 해당 파트의 재고 트랜잭션 확인
                        const { data: transactions, error: transError } = await this.supabase
                            .from('inventory_transactions')
                            .select('*')
                            .eq('part_number', part.part_number)
                            .eq('transaction_type', 'OUTBOUND')
                            .eq('transaction_date', sequence.outbound_date)
                            .order('created_at', { ascending: false });

                        if (transError) {
                            console.error(`파트 ${part.part_number} 트랜잭션 조회 오류:`, transError);
                            continue;
                        }

                        // 해당 날짜의 총 출고 수량 계산
                        const totalOutboundQty = transactions?.reduce((sum, trans) => sum + (trans.quantity || 0), 0) || 0;
                        
                        if (totalOutboundQty !== part.actual_qty) {
                            syncIssues.push({
                                sequence: sequence.sequence_number,
                                date: sequence.outbound_date,
                                part: part.part_number,
                                expectedQty: part.actual_qty,
                                actualQty: totalOutboundQty,
                                difference: part.actual_qty - totalOutboundQty
                            });
                        }
                    }
                }
            }

            // 3. 결과 출력
            if (syncIssues.length === 0) {
                console.log('✅ 재고 동기화 상태 양호 - 모든 출고가 정상적으로 재고에 반영됨');
                this.showNotification('재고 동기화 상태가 정상입니다.', 'success');
                return true;
            } else {
                console.warn(`⚠️ 재고 동기화 문제 발견: ${syncIssues.length}개 이슈`);
                syncIssues.forEach(issue => {
                    console.warn(`- ${issue.sequence} (${issue.date}): ${issue.part} - 예상: ${issue.expectedQty}, 실제: ${issue.actualQty}, 차이: ${issue.difference}`);
                });
                this.showNotification(`재고 동기화 문제 ${syncIssues.length}개 발견`, 'error');
                return false;
            }

        } catch (error) {
            console.error('재고 동기화 검증 중 오류:', error);
            this.showNotification('재고 동기화 검증 중 오류가 발생했습니다.', 'error');
            return false;
        }
    }

    // 재고 동기화 수정 함수
    async fixInventorySync() {
        console.log('=== 재고 동기화 수정 시작 ===');
        
        try {
            if (!this.supabase) {
                console.error('Supabase 클라이언트가 없습니다.');
                return false;
            }

            // 최근 7일간의 출고 확정 데이터 재처리
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

            const { data: recentOutbound, error: outboundError } = await this.supabase
                .from('outbound_sequences')
                .select(`
                    id,
                    sequence_number,
                    outbound_date,
                    status,
                    outbound_parts (
                        part_number,
                        actual_qty,
                        status
                    )
                `)
                .eq('status', 'COMPLETED')
                .gte('outbound_date', sevenDaysAgoStr)
                .order('outbound_date', { ascending: false });

            if (outboundError) {
                console.error('출고 데이터 조회 오류:', outboundError);
                return false;
            }

            let fixedCount = 0;

            for (const sequence of recentOutbound || []) {
                for (const part of sequence.outbound_parts || []) {
                    if (part.status === 'COMPLETED' && part.actual_qty > 0) {
                        // 해당 파트의 기존 트랜잭션 삭제
                        await this.supabase
                            .from('inventory_transactions')
                            .delete()
                            .eq('part_number', part.part_number)
                            .eq('transaction_type', 'OUTBOUND')
                            .eq('transaction_date', sequence.outbound_date);

                        // 새로운 트랜잭션 생성 (트리거가 재고 업데이트)
                        const { error: insertError } = await this.supabase
                            .from('inventory_transactions')
                            .insert({
                                transaction_date: sequence.outbound_date,
                                part_number: part.part_number,
                                transaction_type: 'OUTBOUND',
                                quantity: part.actual_qty,
                                reference_id: `SYNC_FIX_${sequence.id}`,
                                notes: `재고 동기화 수정 - ${sequence.sequence_number}`
                            });

                        if (insertError) {
                            console.error(`파트 ${part.part_number} 동기화 수정 실패:`, insertError);
                        } else {
                            fixedCount++;
                            console.log(`파트 ${part.part_number} 동기화 수정 완료`);
                        }
                    }
                }
            }

            console.log(`재고 동기화 수정 완료: ${fixedCount}개 파트 처리됨`);
            this.showNotification(`재고 동기화 수정 완료: ${fixedCount}개 파트`, 'success');
            return true;

        } catch (error) {
            console.error('재고 동기화 수정 중 오류:', error);
            this.showNotification('재고 동기화 수정 중 오류가 발생했습니다.', 'error');
            return false;
        }
    }

    // 디버그용 테스트 함수 (브라우저 콘솔에서 호출 가능)
    async testInventoryUpdate(partNumber = '49560-12345', quantity = 5, testDate = null) {
        console.log('=== 재고 업데이트 테스트 시작 ===');
        console.log('테스트 파트:', partNumber);
        console.log('테스트 수량:', quantity);
        console.log('테스트 날짜:', testDate || '오늘 날짜 사용');
        console.log('Supabase 클라이언트:', this.supabase);
        
        if (!this.supabase) {
            console.error('Supabase 클라이언트가 없습니다.');
            this.showNotification('Supabase 클라이언트가 없습니다.', 'error');
            return;
        }
        
        // 인증 상태 확인
        try {
            const { data: { user }, error: authError } = await this.supabase.auth.getUser();
            console.log('현재 사용자:', user);
            if (authError) {
                console.error('인증 오류:', authError);
                this.showNotification('사용자 인증에 문제가 있습니다.', 'error');
                return;
            }
        } catch (authCheckError) {
            console.warn('인증 상태 확인 실패:', authCheckError);
        }
        
        console.log('=== 테스트 함수 비활성화됨 ===');
        console.log('테스트 함수는 중복 실행을 방지하기 위해 비활성화되었습니다.');
        return;
        
        // 아래 코드는 비활성화됨
        /*
        try {
            await this.updateInventoryAfterOutbound(partNumber, quantity, testDate);
            console.log('=== 재고 업데이트 테스트 성공 ===');
            this.showNotification('재고 업데이트 테스트가 성공했습니다.', 'success');
        } catch (error) {
            console.error('=== 재고 업데이트 테스트 실패 ===');
            console.error('테스트 오류:', error);
            this.showNotification('재고 업데이트 테스트가 실패했습니다.', 'error');
        }
        */
    }

    // 출고 등록 모달 관련 메서드들
    async openRegistrationModal(isEditMode = false) {
        try {
            if (isEditMode) {
                // 수정 모드: 기존 데이터 사용
                const today = this.editingSequence.outbound_date ? 
                    (this.editingSequence.outbound_date.includes('T') ? this.editingSequence.outbound_date.split('T')[0] : this.editingSequence.outbound_date) : 
                    new Date().toISOString().split('T')[0];
                document.getElementById('registrationDate').value = today;
                document.getElementById('registrationSequence').value = this.editingSequence.sequence_number;
                
                // 모달 제목 변경
                const modalTitle = document.querySelector('#outboundRegistrationModal h3');
                const saveButton = document.getElementById('saveRegistration');
                
                if (modalTitle) {
                    modalTitle.textContent = '출고 수정';
                }
                if (saveButton) {
                    saveButton.textContent = '수정 저장';
                }
            } else {
                // 등록 모드: 오늘 날짜로 초기화
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('registrationDate').value = today;
                document.getElementById('registrationSequence').value = '';
                
                // 등록된 파트 목록 초기화
                this.registrationParts = [];
                
                // 모달 제목 변경
                const modalTitle = document.querySelector('#outboundRegistrationModal h3');
                const saveButton = document.getElementById('saveRegistration');
                
                if (modalTitle) {
                    modalTitle.textContent = '출고 등록';
                }
                if (saveButton) {
                    saveButton.textContent = '등록';
                }
            }
            
            // AS 체크박스 초기화 (기본값: 체크 안됨)
            const includeASCheckbox = document.getElementById('includeASCheckbox');
            if (includeASCheckbox) {
                includeASCheckbox.checked = false;
            }
            
            // 파트 목록 로딩 (기본값: 양산 제품만)
            const includeAS = includeASCheckbox?.checked || false;
            this.allParts = await this.loadAllParts(includeAS);
            
            if (!isEditMode) {
                // 등록 모드에서만 기존 출고 데이터 확인
                await this.loadExistingOutboundData();
            }
            
            // Handsontable 초기화
            this.initializePartsTable();
            
            // 모달 표시
            document.getElementById('outboundRegistrationModal').classList.remove('hidden');
        } catch (error) {
            console.error('출고 등록 모달 열기 오류:', error);
            this.showNotification('출고 등록 모달을 여는 중 오류가 발생했습니다.', 'error');
        }
    }


    async loadExistingOutboundData() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // 오늘 날짜의 기존 출고 차수 확인 (로깅용)
            const { data: existingData, error } = await this.supabase
                .from('outbound_sequences')
                .select(`
                    id,
                    sequence_number,
                    outbound_date,
                    status,
                    outbound_parts (
                        id,
                        part_number,
                        actual_qty,
                        status
                    )
                `)
                .eq('outbound_date', today)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('기존 출고 데이터 로딩 오류:', error);
                return;
            }
            
            if (existingData && existingData.length > 0) {
                console.log('오늘 날짜의 기존 출고 차수들:', existingData);
                console.log('새로운 차수로 등록 진행 (메시지 없이)');
            } else {
                console.log('오늘 날짜의 기존 출고 데이터 없음');
            }
        } catch (error) {
            console.error('기존 출고 데이터 로딩 오류:', error);
        }
    }

    initializePartsTable() {
        const container = document.getElementById('partsTable');
        
        // 기존 테이블이 있다면 제거
        if (this.partsTable) {
            this.partsTable.destroy();
        }
        
        // allParts가 없으면 빈 배열로 초기화
        if (!this.allParts) {
            this.allParts = [];
        }
        
        // 기존 데이터가 있으면 Handsontable 데이터로 변환
        let initialData = [];
        if (this.registrationParts && this.registrationParts.length > 0) {
            initialData = this.registrationParts.map(part => {
                return [
                    part.partNumber,
                    part.quantity
                ];
            });
        } else {
            // 모든 파트 번호를 1개씩 미리 PRE로 띄워놓기
            if (this.allParts && this.allParts.length > 0) {
                // allParts가 객체 배열인지 문자열 배열인지 확인
                initialData = this.allParts.map(part => {
                    const partNumber = typeof part === 'string' ? part : (part.part_number || part);
                    return [partNumber, 0];
                });
            } else {
                // 파트가 없으면 빈 배열로 시작
                initialData = [];
                console.warn('파트 목록이 비어있습니다. 파트를 먼저 등록해주세요.');
            }
        }

        // Handsontable 초기화
        this.partsTable = new Handsontable(container, {
            data: initialData,
            columns: [
                {
                    type: 'text',
                    readOnly: false,
                    width: 250,
                    title: '파트 번호',
                    className: 'htCenter'
                },
                {
                    type: 'numeric',
                    format: '0',
                    width: 120,
                    title: '수량',
                    validator: (value, callback) => {
                        if (!value || value === 0) {
                            callback(true); // 빈 값이나 0은 허용 (저장 시 제외됨)
            return;
        }
                        const num = parseInt(value);
                        if (num > 0 && num <= 9999) {
                            callback(true);
                        } else {
                            callback(false);
                        }
                    }
                }
            ],
            colHeaders: ['파트 번호', '수량'],
            rowHeaders: true,
            contextMenu: true,
            manualColumnResize: true,
            manualRowResize: true,
            stretchH: 'all',
            height: 500,
            width: '100%',
            licenseKey: 'non-commercial-and-evaluation',
            afterChange: (changes, source) => {
                if (source !== 'loadData') {
                    this.updatePartsFromTable();
                }
            },
            afterSelectionEnd: (r, c, r2, c2) => {
                // 선택된 행 업데이트
                this.updateSelectedRows();
            }
        });
        
    }

    async handleASCheckboxChange() {
        try {
            // AS 체크박스 상태 확인
            const includeAS = document.getElementById('includeASCheckbox')?.checked || false;
            
            // 파트 목록 다시 로드
            this.allParts = await this.loadAllParts(includeAS);
            
            // 테이블 다시 초기화
            this.initializePartsTable();
            
            console.log(`AS 제품 ${includeAS ? '포함' : '제외'}하여 파트 목록을 다시 로드했습니다.`);
        } catch (error) {
            console.error('AS 체크박스 변경 처리 오류:', error);
            this.showNotification('파트 목록을 다시 로드하는 중 오류가 발생했습니다.', 'error');
        }
    }

    addTableRow() {
        if (this.partsTable) {
            // 현재 데이터 가져오기
            const currentData = this.partsTable.getData();
            
            // 새 빈 행 추가
            currentData.push(['', 0]); // 빈 파트 번호와 수량 0
            
            // 테이블에 새 데이터 로드
            this.partsTable.loadData(currentData);
            
            console.log('새 행이 추가되었습니다.');
            this.showNotification('새 행이 추가되었습니다. 파트 번호와 수량을 입력하세요.', 'success');
        } else {
            console.log('테이블이 초기화되지 않았습니다.');
            this.showNotification('테이블이 초기화되지 않았습니다.', 'error');
        }
    }

    removeSelectedRows() {
        try {
            const selected = this.partsTable.getSelected();
            if (selected && selected.length > 0) {
                const [startRow, startCol, endRow, endCol] = selected[0];
                const currentData = this.partsTable.getData();
                
                // 선택된 행들을 역순으로 삭제 (인덱스 변경 방지)
                const rowsToDelete = [];
                for (let row = startRow; row <= endRow; row++) {
                    rowsToDelete.push(row);
                }
                
                // 역순으로 정렬하여 뒤에서부터 삭제
                rowsToDelete.sort((a, b) => b - a);
                
                rowsToDelete.forEach(rowIndex => {
                    currentData.splice(rowIndex, 1);
                });
                
                this.partsTable.loadData(currentData);
                this.updatePartsFromTable();
                console.log(`선택된 ${rowsToDelete.length}개 행이 삭제되었습니다.`);
                this.showNotification(`${rowsToDelete.length}개 행이 삭제되었습니다.`, 'success');
            } else {
                this.showNotification('삭제할 행을 선택해주세요.', 'warning');
            }
        } catch (error) {
            console.error('행 삭제 오류:', error);
            this.showNotification('행 삭제 중 오류가 발생했습니다.', 'error');
        }
    }

    updateSelectedRows() {
        // 선택된 행이 있는지 확인
        const selected = this.partsTable.getSelected();
        const hasSelection = selected && selected.length > 0;
        
        // 삭제 버튼 활성화/비활성화
        const removeBtn = document.getElementById('removeRowBtn');
        if (removeBtn) {
            removeBtn.disabled = !hasSelection;
            removeBtn.classList.toggle('opacity-50', !hasSelection);
            removeBtn.classList.toggle('cursor-not-allowed', !hasSelection);
        }
    }

    updatePartsFromTable() {
        const data = this.partsTable.getData();
        this.registrationParts = [];
        
        data.forEach((row, index) => {
            const [partNumber, quantity] = row;
            
            // 파트 번호가 있고 수량이 0보다 큰 경우만 저장
            if (partNumber && quantity > 0) {
            this.registrationParts.push({
                    id: Date.now() + index,
                partNumber: partNumber,
                    quantity: parseInt(quantity) || 0,
                    status: 'PENDING'
                });
            }
        });
        
        console.log('업데이트된 파트 목록 (수량 0인 행 제외):', this.registrationParts);
    }

    clearTable() {
        if (this.partsTable) {
            // 모든 파트를 0 수량으로 초기화
            if (this.allParts && this.allParts.length > 0) {
                // allParts가 객체 배열인지 문자열 배열인지 확인
                const allPartsData = this.allParts.map(part => {
                    const partNumber = typeof part === 'string' ? part : (part.part_number || part);
                    return [partNumber, 0];
                });
                this.partsTable.loadData(allPartsData);
                this.registrationParts = [];
                console.log('테이블 초기화 완료 - 모든 파트 수량을 0으로 설정');
            } else {
                // 파트가 없으면 빈 배열로 초기화
                this.partsTable.loadData([]);
                this.registrationParts = [];
                console.log('테이블 초기화 완료 - 파트 목록이 비어있음');
            }
        }
    }

    closeRegistrationModal() {
        document.getElementById('outboundRegistrationModal').classList.add('hidden');
        
        // 입력 필드 초기화
        document.getElementById('registrationDate').value = '';
        document.getElementById('registrationSequence').value = '';
        
        // 등록된 파트 목록 초기화
        this.registrationParts = [];
        
        // 수정 모드 초기화
        this.editingSequence = null;
        
        // 모달 제목과 버튼 텍스트 초기화
        const modalTitle = document.querySelector('#outboundRegistrationModal h3');
        const saveButton = document.getElementById('saveRegistration');
        
        if (modalTitle) {
            modalTitle.textContent = '출고 등록';
        }
        if (saveButton) {
            saveButton.textContent = '등록';
        }
        
        // Handsontable 제거
        if (this.partsTable) {
            this.partsTable.destroy();
            this.partsTable = null;
        }
    }


    removePartFromRegistration(partId) {
        this.registrationParts = this.registrationParts.filter(part => part.id !== partId);
        this.renderRegistrationParts();
    }

    renderRegistrationParts() {
        const container = document.getElementById('registeredPartsList');
        
        if (this.registrationParts.length === 0) {
            const noPartsText = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('no_registered_parts') : '등록된 파트가 없습니다.';
            container.innerHTML = `<p class="text-gray-500 text-sm">${noPartsText}</p>`;
            return;
        }
        
        const partsHtml = this.registrationParts.map(part => `
            <div class="flex items-center justify-between bg-white p-3 rounded border">
                <div class="flex items-center space-x-4">
                    <span class="font-medium text-gray-900">${part.partNumber}</span>
                    <span class="text-gray-600">수량: ${part.quantity}</span>
                </div>
                <button onclick="window.outboundStatus.removePartFromRegistration(${part.id})" 
                        class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        container.innerHTML = partsHtml;
    }

    async saveRegistration() {
        const date = document.getElementById('registrationDate').value;
        const seq = document.getElementById('registrationSequence').value;
        const isEditMode = this.editingSequence !== null;
        
        if (!date) {
            this.showNotification('날짜를 선택해주세요.', 'error');
            return;
        }
        
        if (!seq) {
            this.showNotification('차수를 선택해주세요.', 'error');
            return;
        }
        
        // Handsontable에서 최신 데이터 가져오기
        this.updatePartsFromTable();
        
        if (this.registrationParts.length === 0) {
            this.showNotification('등록할 파트를 추가해주세요.', 'error');
            return;
        }
        
        try {
            if (isEditMode) {
                // 수정 모드: 기존 차수 업데이트
                await this.updateExistingSequence(date, seq);
            } else {
                // 등록 모드: 새 차수 생성
                await this.createNewSequence(date, seq);
            }
        } catch (error) {
            console.error('출고 저장 오류:', error);
            this.showNotification('출고 저장 중 오류가 발생했습니다.', 'error');
        }
    }

    async updateExistingSequence(date, seq) {
        // 1. 기존 outbound_parts 삭제
        const { error: deleteError } = await this.supabase
            .from('outbound_parts')
            .delete()
            .eq('sequence_id', this.editingSequence.id);

        if (deleteError) {
            console.error('기존 파트 삭제 오류:', deleteError);
            throw deleteError;
        }

        // 2. 새로운 outbound_parts 삽입
        const partsData = this.registrationParts.map(part => ({
            sequence_id: this.editingSequence.id,
            part_number: part.partNumber,
            planned_qty: part.quantity,
            scanned_qty: part.quantity,
            actual_qty: part.quantity,
            status: 'PENDING'
        }));

        const { error: partsError } = await this.supabase
            .from('outbound_parts')
            .insert(partsData);

        if (partsError) {
            console.error('파트 업데이트 오류:', partsError);
            throw partsError;
        }

        console.log('수정 완료: outbound_parts 테이블 업데이트됨');
        console.log(`수정된 파트: ${partsData.length}개`);
        console.log('재고는 출고 확정 시에만 반영됩니다.');

        this.showNotification('출고 수량이 수정되었습니다. 페이지를 새로고침합니다.', 'success');
        this.closeRegistrationModal();
        
        // 데이터 다시 로드하여 변경사항 반영
        await this.forceRefreshData();
        
        // UI 업데이트
        this.updateConfirmButtons();
        this.updateStats();
        
        // 페이지 전체 리프레시 (수정 후 확실한 반영을 위해)
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }

    async createNewSequence(date, seq) {
        // 0. 동일한 날짜와 차수의 중복 확인
        const { data: existingSequence, error: checkError } = await this.supabase
            .from('outbound_sequences')
            .select('id, sequence_number, outbound_date, status')
            .eq('outbound_date', date)
            .eq('sequence_number', `${date.replace(/-/g, '')}-${seq}`)
            .maybeSingle();

        if (checkError) {
            console.error('중복 확인 오류:', checkError);
            throw checkError;
        }

        if (existingSequence) {
            this.showNotification(`이미 등록된 차수입니다: ${existingSequence.sequence_number}`, 'error');
            return;
        }

        try {
            // 1. 출고 차수 생성
            const totalQuantity = this.registrationParts.reduce((sum, part) => sum + part.quantity, 0);
            // 차수 번호 생성 (날짜 + 차수)
            const sequenceNumber = `${date.replace(/-/g, '')}-${seq}`;
            console.log('생성된 차수 번호:', sequenceNumber, '날짜:', date, '차수:', seq);
            
            const sequenceData = {
                sequence_number: sequenceNumber,
                outbound_date: date,
                status: 'PENDING'
            };
            console.log('차수 데이터:', sequenceData);

            const { data: newSequence, error: sequenceError } = await this.supabase
                .from('outbound_sequences')
                .insert(sequenceData)
                .select()
                .single();

            if (sequenceError) {
                console.error('차수 생성 오류:', sequenceError);
                throw sequenceError;
            }
            
            console.log('생성된 차수:', newSequence);

            // 2. 출고 파트들 생성
            const partsData = this.registrationParts.map(part => ({
                sequence_id: newSequence.id,
                part_number: part.partNumber,
                planned_qty: seq === 'AS' ? 0 : part.quantity,  // AS는 계획 수량 0
                scanned_qty: part.quantity,  // 수동 등록 시 입력한 수량을 스캔 수량으로 설정
                actual_qty: part.quantity,   // 수동 등록 시 입력한 수량을 실제 출고 수량으로 설정
                status: 'PENDING'
            }));

            const { error: partsError } = await this.supabase
                .from('outbound_parts')
                .insert(partsData);

            if (partsError) {
                throw partsError;
            }

            // 3. 로컬 데이터 업데이트
            this.outboundSequences.push(newSequence);
            this.outboundParts.push(...partsData.map((part, index) => ({
                ...part,
                id: newSequence.id * 1000 + index // 임시 ID
            })));

            // 4. UI 업데이트
            this.applyFilters();
            this.updateStats();
            this.closeRegistrationModal();
            
            this.showNotification('출고가 성공적으로 등록되었습니다.', 'success');
            
            console.log('새로운 출고 등록 완료:', newSequence, partsData);
            
        } catch (error) {
            console.error('출고 등록 오류:', error);
            this.showNotification('출고 등록 중 오류가 발생했습니다.', 'error');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.outboundStatus = new OutboundStatus();
    
    // 전역 테스트 함수 비활성화 (중복 실행 방지)
    window.testInventoryUpdate = (partNumber = '49560-12345', quantity = 5) => {
        console.log('=== 전역 테스트 함수 비활성화됨 ===');
        console.log('테스트 함수는 중복 실행을 방지하기 위해 비활성화되었습니다.');
        return;
    };
    
    // 전역 재고 동기화 함수
    window.validateInventorySync = () => {
        if (window.outboundStatus) {
            window.outboundStatus.validateInventorySync();
        } else {
            console.error('OutboundStatus가 초기화되지 않았습니다.');
        }
    };
    
    window.fixInventorySync = () => {
        if (window.outboundStatus) {
            window.outboundStatus.fixInventorySync();
        } else {
            console.error('OutboundStatus가 초기화되지 않았습니다.');
        }
    };
    
    console.log('OutboundStatus 초기화 완료. 재고 동기화 함수: window.validateInventorySync(), window.fixInventorySync()');
}); 