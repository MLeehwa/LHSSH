// Outbound Status JavaScript - Performance Optimized
class OutboundStatus {
    constructor() {
        this.outboundSequences = [];
        this.outboundParts = [];
        this.filteredSequences = [];
        this.selectedSequence = null;
        this.filterTimeout = null;
        this.registrationParts = [];
        this.supabase = null;
        
        // Performance optimizations
        this.cache = new Map();
        this.lastDataUpdate = 0;
        this.dataUpdateInterval = 30000; // 30 seconds
        this.isLoading = false;
        this.domCache = new Map();
        
        this.initializeSupabase();
        this.init();
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
            
            const { data, error } = await this.supabase
                .from('outbound_sequences')
                .select('*')
                .limit(1);
            
            if (error) {
                console.error('Supabase 연결 테스트 실패:', error);
                return false;
            } else {
                console.log('Supabase 연결 테스트 성공:', data);
                return true;
            }
        } catch (error) {
            console.error('연결 테스트 중 예외 발생:', error);
            return false;
        }
    }

    loadMockData() {
        console.log('Mock 데이터 로드 중...');
        this.outboundSequences = [
            {
                id: 1,
                date: '2024-01-15',
                seq: 1,
                part_count: 3,
                total_scanned: 150,
                total_actual: 150,
                status: 'CONFIRMED'
            },
            {
                id: 2,
                date: '2024-01-15',
                seq: 2,
                part_count: 2,
                total_scanned: 100,
                total_actual: 100,
                status: 'PENDING'
            }
        ];
        
        this.outboundParts = [
            {
                id: 1,
                sequence_id: 1,
                part_number: '49560-12345',
                scanned_qty: 50,
                actual_qty: 50,
                status: 'CONFIRMED'
            },
            {
                id: 2,
                sequence_id: 1,
                part_number: '49560-67890',
                scanned_qty: 100,
                actual_qty: 100,
                status: 'CONFIRMED'
            }
        ];
        
        this.filteredSequences = [...this.outboundSequences];
    }

    async init() {
        try {
            console.log('OutboundStatus 초기화 시작...');
            
            if (!this.supabase) {
                console.warn('Supabase 클라이언트가 초기화되지 않았습니다. Mock 데이터를 사용합니다.');
                this.loadMockData();
            } else {
                await this.loadData();
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
        const timeString = now.toLocaleString('ko-KR', {
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
            } else if (e.target.matches('#addPartBtn')) {
                this.showAddPartRow();
            } else if (e.target.matches('#saveNewPartBtn')) {
                this.saveNewPart();
            } else if (e.target.matches('#cancelAddPartBtn')) {
                this.cancelAddPart();
            } else if (e.target.matches('#openRegistrationBtn')) {
                this.openRegistrationModal();
            } else if (e.target.matches('#closeRegistrationBtn')) {
                this.closeRegistrationModal();
            } else if (e.target.matches('#saveRegistrationBtn')) {
                this.saveRegistration();
            } else if (e.target.matches('#addPartToRegistrationBtn')) {
                this.addPartToRegistration();
            } else if (e.target.matches('.remove-part-btn')) {
                const partId = e.target.closest('[data-part-id]').dataset.partId;
                this.removePartFromRegistration(partId);
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
            }
        });

        // Modal events
        this.bindModalEvents();
    }

    bindModalEvents() {
        const modalEvents = [
            { selector: '#confirmModal .close-btn, #confirmModal .cancel-btn', action: () => this.closeConfirmationModal() },
            { selector: '#confirmModal .confirm-btn', action: () => this.processOutboundConfirmation() }
        ];

        modalEvents.forEach(({ selector, action }) => {
            document.addEventListener('click', (e) => {
                if (e.target.matches(selector)) {
                    action();
                }
            });
        });
    }

    handleActualQtyChange(e) {
        const input = e.target;
        const partId = input.closest('tr').dataset.partId;
        const newQty = parseInt(input.value) || 0;
        
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
            const [sequencesResult, partsResult] = await Promise.all([
                this.loadOutboundSequences(),
                this.loadOutboundParts()
            ]);
            
            this.outboundSequences = sequencesResult;
            this.outboundParts = partsResult;
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
            .select('*')
            .order('date', { ascending: false })
            .order('seq', { ascending: false });
        
        if (error) {
            console.error('출고 시퀀스 데이터 로드 오류:', error);
            return [];
        }
        
        const result = data || [];
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
            .select('*')
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
        const seqFilter = document.getElementById('seqFilter').value;
        const partNumberFilter = document.getElementById('partNumberFilter').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredSequences = this.outboundSequences.filter(sequence => {
            const matchesDate = !dateFilter || sequence.date === dateFilter;
            const matchesSeq = !seqFilter || sequence.seq.toString() === seqFilter;
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
        document.getElementById('seqFilter').value = '';
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
        
        const container = document.getElementById('outboundSequenceList');
        container.innerHTML = '';

        if (this.filteredSequences.length === 0) {
            container.innerHTML = `
                <div class="px-6 py-4 text-center text-gray-500">
                    조건에 맞는 출고 차수가 없습니다.
                </div>
            `;
            return;
        }

        this.filteredSequences.forEach(sequence => {
            console.log(`차수 ${sequence.id} 렌더링:`, sequence);
            
            const item = document.createElement('div');
            item.className = 'p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200';
            item.dataset.sequenceId = sequence.id;
            
            const isSelected = this.selectedSequence === sequence.id;
            if (isSelected) {
                item.classList.add('bg-blue-50', 'border-r-2', 'border-blue-600');
            }

            const statusColor = this.getStatusColor(sequence.status);
            const statusText = this.getStatusText(sequence.status);
            
            console.log(`차수 ${sequence.id} 상태: ${sequence.status} -> ${statusText} (${statusColor})`);

            item.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="text-sm font-medium text-gray-900">
                            ${sequence.date} ${sequence.seq === 'AS' ? 'AS' : sequence.seq + '차'}
                        </h4>
                        <p class="text-xs text-gray-500">
                            파트 ${sequence.part_count}개
                        </p>
                    </div>
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor}">
                        ${statusText}
                    </span>
                </div>
                <div class="text-xs text-gray-600">
                    <div class="flex justify-between">
                        <span>스캔: ${sequence.total_scanned}</span>
                        <span>실제: ${sequence.total_actual}</span>
                    </div>
                </div>
            `;

            item.addEventListener('click', () => {
                this.selectSequence(sequence.id);
            });

            container.appendChild(item);
        });
        
        console.log('renderSequences 완료');
    }

    selectSequence(sequenceId) {
        this.selectedSequence = sequenceId;
        this.renderSequences();
        this.renderParts(sequenceId);
        
        const sequence = this.outboundSequences.find(s => s.id === sequenceId);
        if (sequence) {
            document.getElementById('selectedSequence').textContent = `(${sequence.date} ${sequence.seq === 'AS' ? 'AS' : sequence.seq + '차'})`;
        }
        
        // 버튼 상태 업데이트
        this.updateConfirmButtons();
        this.updateAddPartButton();
    }

    renderParts(sequenceId) {
        const tbody = document.getElementById('partsTableBody');
        const sequenceParts = this.outboundParts.filter(part => part.sequence_id === sequenceId);
        
        tbody.innerHTML = '';

        if (sequenceParts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                        이 차수에 등록된 파트가 없습니다.
                    </td>
                </tr>
            `;
        }

        sequenceParts.forEach(part => {
            const row = document.createElement('tr');
            const statusColor = this.getStatusColor(part.status);
            const statusText = this.getStatusText(part.status);

            // 초기 배경색 설정 (확인된 파트는 초록색, 체크된 파트는 파란색)
            if (part.status === 'CONFIRMED') {
                row.className = 'bg-green-50 cursor-pointer';
            } else {
                row.className = 'cursor-pointer';
            }

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <input type="checkbox" class="part-checkbox" data-part-id="${part.id}" 
                           ${part.status === 'CONFIRMED' ? 'checked disabled' : ''}>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${part.part_number}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="text-gray-900">${part.scanned_qty || 0}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <input type="number" class="actual-qty-input w-20 px-2 py-1 border border-gray-300 rounded text-sm" 
                           value="${part.actual_qty || 0}" min="0" data-part-id="${part.id}"
                           ${part.status === 'CONFIRMED' ? 'disabled' : ''}>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor}">
                        ${statusText}
                    </span>
                </td>
            `;

            // 체크박스 이벤트 리스너 추가
            const checkbox = row.querySelector('.part-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    console.log('체크박스 변경:', e.target.checked, '파트 ID:', part.id);
                    this.updateConfirmButtons();
                    this.updateRowBackgroundColor(row, e.target.checked);
                });
            }

            // 행 클릭 이벤트 추가 (체크박스가 아닌 경우에만)
            row.addEventListener('click', (e) => {
                // 체크박스나 입력 필드를 클릭한 경우는 제외
                if (e.target.type === 'checkbox' || e.target.classList.contains('actual-qty-input')) {
                    return;
                }
                
                const checkbox = row.querySelector('.part-checkbox');
                if (checkbox && !checkbox.disabled) {
                    checkbox.checked = !checkbox.checked;
                    this.updateConfirmButtons();
                    
                    // 체크박스 상태에 따라 행 배경색 업데이트
                    this.updateRowBackgroundColor(row, checkbox.checked);
                }
            });

            tbody.appendChild(row);
        });

        // 실제 출고 수량 입력 이벤트 리스너 추가
        this.bindActualQtyInputs();
        
        // 확정 버튼 상태 업데이트
        this.updateConfirmButtons();
    }

    updateRowBackgroundColor(row, isChecked) {
        // 확인된 파트인 경우는 항상 초록색 배경 유지
        const checkbox = row.querySelector('.part-checkbox');
        if (checkbox && checkbox.disabled) {
            row.className = 'bg-green-50 cursor-pointer';
            return;
        }
        
        // 체크된 파트는 파란색 배경, 체크되지 않은 파트는 기본 배경
        if (isChecked) {
            row.className = 'bg-blue-50 cursor-pointer';
        } else {
            row.className = 'cursor-pointer';
        }
    }

    getStatusColor(status) {
        switch (status) {
            case 'CONFIRMED':
                return 'bg-green-100 text-green-800';
            case 'PENDING':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'CONFIRMED':
                return '확인 완료';
            case 'PENDING':
                return '확인전';
            default:
                return '알 수 없음';
        }
    }

    updateStats() {
        // 필터링된 시퀀스를 기준으로 통계 계산
        const totalOutbound = this.filteredSequences.length;
        const confirmedOutbound = this.filteredSequences.filter(s => s.status === 'CONFIRMED').length;
        const pendingOutbound = this.filteredSequences.filter(s => s.status === 'PENDING').length;

        document.getElementById('totalOutbound').textContent = totalOutbound;
        document.getElementById('confirmedOutbound').textContent = confirmedOutbound;
        document.getElementById('pendingOutbound').textContent = pendingOutbound;
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
                    <span class="text-sm">${sequence.date} ${sequence.seq === 'AS' ? 'AS' : sequence.seq + '차'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm font-medium">파트 수:</span>
                    <span class="text-sm">${sequence.part_count}개</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm font-medium">총 스캔 수량:</span>
                    <span class="text-sm">${sequence.total_scanned}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm font-medium">총 실제 출고:</span>
                    <span class="text-sm">${sequence.total_actual}</span>
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



    async updateInventoryAfterOutbound(partNumber, outboundQuantity, sequenceDate = null) {
        console.log(`재고 차감 시작: ${partNumber} - ${outboundQuantity}개`);
        console.log('Supabase 클라이언트 상태:', this.supabase);
        console.log('현재 사용자 인증 상태 확인 중...');
        
        if (!this.supabase) {
            console.warn('Supabase 클라이언트가 없습니다. 재고 차감을 건너뜁니다.');
            return;
        }
        
        // 인증 상태 확인
        try {
            const { data: { user }, error: authError } = await this.supabase.auth.getUser();
            console.log('현재 사용자:', user);
            console.log('인증 오류:', authError);
        } catch (authCheckError) {
            console.warn('인증 상태 확인 실패:', authCheckError);
        }
        
        try {
            // 1. 현재 재고 조회
            console.log('1단계: 현재 재고 조회 중...');
            const { data: inventoryData, error: inventoryError } = await this.supabase
                .from('inventory')
                .select('current_stock, today_outbound')
                .eq('part_number', partNumber)
                .single();

            if (inventoryError) {
                console.error('재고 조회 오류:', inventoryError);
                console.error('오류 상세 정보:', {
                    message: inventoryError.message,
                    details: inventoryError.details,
                    hint: inventoryError.hint,
                    code: inventoryError.code
                });
                throw inventoryError;
            }

            if (!inventoryData) {
                throw new Error(`파트 번호 ${partNumber}에 대한 재고 정보를 찾을 수 없습니다.`);
            }
            
            console.log('현재 재고 정보:', inventoryData);
            const currentStock = inventoryData.current_stock;
            const todayOutbound = inventoryData.today_outbound;
            const newStock = currentStock - outboundQuantity;
            const newTodayOutbound = todayOutbound + outboundQuantity;

            if (newStock < 0) {
                console.warn(`재고 부족 경고: ${partNumber} - 현재 ${currentStock}, 출고 ${outboundQuantity}, 결과 ${newStock}`);
            }
            
            console.log(`재고 계산: 현재 ${currentStock} - 출고 ${outboundQuantity} = 새로운 재고 ${newStock}`);

            // 2. 재고 업데이트
            console.log('2단계: 재고 업데이트 중...');
            console.log('업데이트할 데이터:', {
                current_stock: newStock,
                today_outbound: newTodayOutbound,
                last_updated: new Date().toISOString()
            });
            
            const { data: updateData, error: updateError } = await this.supabase
                .from('inventory')
                .update({ 
                    current_stock: newStock, 
                    today_outbound: newTodayOutbound,
                    last_updated: new Date().toISOString()
                })
                .eq('part_number', partNumber)
                .select();

            if (updateError) {
                console.error('재고 업데이트 오류:', updateError);
                console.error('오류 상세 정보:', {
                    message: updateError.message,
                    details: updateError.details,
                    hint: updateError.hint,
                    code: updateError.code
                });
                console.error('RLS 정책 문제일 수 있습니다. fix_rls_policies.sql을 실행하세요.');
                throw updateError;
            }

            if (!updateData || updateData.length === 0) {
                throw new Error(`재고 업데이트 실패: ${partNumber}에 대한 업데이트 결과가 없습니다.`);
            }
            
            console.log('재고 업데이트 성공:', updateData);

            // 3. 거래 내역 기록
            console.log('3단계: 거래 내역 기록 중...');
            
            // 시퀀스 날짜 사용 (없으면 오늘 날짜 사용)
            const transactionDate = sequenceDate || new Date().toISOString().split('T')[0];
            console.log(`거래 내역 날짜: ${transactionDate} (시퀀스 날짜: ${sequenceDate}, 오늘 날짜: ${new Date().toISOString().split('T')[0]})`);
            
            const transactionRecord = {
                date: transactionDate,
                part_number: partNumber,
                type: 'OUTBOUND',
                quantity: outboundQuantity,
                balance_after: newStock,
                reference_number: `OUT-${Date.now()}`,
                notes: `출고 확정 - 시퀀스 ID: ${this.selectedSequence}`
            };
            console.log('삽입할 거래 내역:', transactionRecord);
            
            const { data: transactionData, error: transactionError } = await this.supabase
                .from('inventory_transactions')
                .insert(transactionRecord)
                .select();

            if (transactionError) {
                console.error('거래 내역 기록 오류:', transactionError);
                console.error('오류 상세 정보:', {
                    message: transactionError.message,
                    details: transactionError.details,
                    hint: transactionError.hint,
                    code: transactionError.code
                });
                console.error('RLS 정책 문제일 수 있습니다. fix_rls_policies.sql을 실행하세요.');
                // 거래 내역 기록 실패는 치명적이지 않으므로 throw하지 않음
            } else {
                console.log('거래 내역 기록 성공:', transactionData);
            }

            // 4. 일일 재고 추적 시스템 업데이트
            console.log('4단계: 일일 재고 추적 업데이트 중...');
            try {
                const { error: trackingError } = await this.supabase
                    .rpc('track_inventory_movement', {
                        p_part_number: partNumber,
                        p_quantity: outboundQuantity,
                        p_type: 'OUTBOUND',
                        p_reference_number: `OUT-${Date.now()}`
                    });

                if (trackingError) {
                    console.warn('일일 재고 추적 업데이트 오류 (무시하고 계속):', trackingError);
                } else {
                    console.log('일일 재고 추적 업데이트 성공');
                }
            } catch (trackingError) {
                console.warn('일일 재고 추적 함수 호출 실패 (무시하고 계속):', trackingError);
            }

            console.log(`재고 차감 완료: ${partNumber} - ${outboundQuantity}개 차감됨`);
            
        } catch (error) {
            console.error('재고 차감 중 오류 발생:', error);
            console.error('오류 상세 정보:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                stack: error.stack
            });
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
            // 1. 데이터베이스에서 파트 업데이트
            const { error: updateError } = await this.supabase
                .from('outbound_parts')
                .update({ 
                    actual_qty: newActualQty,
                    updated_at: new Date().toISOString()
                })
                .eq('id', partId);

            if (updateError) {
                throw updateError;
            }

            // 2. 로컬 데이터 업데이트
            const part = this.outboundParts.find(p => p.id === partId);
            if (part) {
                part.actual_qty = newActualQty;
                
                // 시퀀스의 총 수량도 업데이트
                await this.updateSequenceTotals(part.sequence_id);
                
                // UI 다시 렌더링
                this.renderParts(part.sequence_id);
                this.renderSequences();
            }

            console.log(`파트 ${partId} 실제 출고 수량 업데이트: ${newActualQty}`);
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
                        total_scanned: totalScanned,
                        total_actual: totalActual,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', sequenceId);

                if (updateError) {
                    throw updateError;
                }

                // 로컬 데이터 업데이트
                sequence.total_scanned = totalScanned;
                sequence.total_actual = totalActual;

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
        const selectedParts = document.querySelectorAll('.part-checkbox:checked:not(:disabled)');
        const allParts = document.querySelectorAll('.part-checkbox:not(:disabled)');
        
        console.log('확정 버튼 상태 업데이트:');
        console.log('- 선택된 파트 수:', selectedParts.length);
        console.log('- 전체 파트 수:', allParts.length);
        
        const confirmBtn = document.getElementById('confirmOutboundBtn');
        const confirmAllBtn = document.getElementById('confirmAllBtn');
        
        console.log('- 확정 버튼 요소:', confirmBtn);
        console.log('- 전체 확정 버튼 요소:', confirmAllBtn);
        
        // 선택 확정 버튼 활성화/비활성화
        if (selectedParts.length > 0) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            console.log('선택 확정 버튼 활성화됨');
        } else {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
            console.log('선택 확정 버튼 비활성화됨');
        }
        
        // 전체 확정 버튼 활성화/비활성화
        if (allParts.length > 0) {
            confirmAllBtn.disabled = false;
            confirmAllBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            console.log('전체 확정 버튼 활성화됨');
        } else {
            confirmAllBtn.disabled = true;
            confirmAllBtn.classList.add('opacity-50', 'cursor-not-allowed');
            console.log('전체 확정 버튼 비활성화됨');
        }
    }

    updateAddPartButton() {
        const addPartBtn = document.getElementById('addPartBtn');
        
        if (this.selectedSequence) {
            addPartBtn.disabled = false;
            addPartBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            addPartBtn.disabled = true;
            addPartBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    showAddPartRow() {
        if (!this.selectedSequence) {
            this.showNotification('파트를 추가할 차수를 선택해주세요.', 'error');
            return;
        }
        
        // 파트 추가 행 표시
        document.getElementById('addPartRow').classList.remove('hidden');
        
        // 입력 필드 초기화
        document.getElementById('newPartNumber').value = '';
        document.getElementById('newScannedQty').value = '';
        document.getElementById('newActualQty').value = '';
        
        // 실제 출고 수량 변경 시 스캔 수량도 자동 업데이트
        document.getElementById('newActualQty').addEventListener('input', (e) => {
            const actualQty = e.target.value || '';
            document.getElementById('newScannedQty').value = actualQty;
        });
    }

    hideAddPartRow() {
        document.getElementById('addPartRow').classList.add('hidden');
        
        // 입력 필드 초기화
        document.getElementById('newPartNumber').value = '';
        document.getElementById('newScannedQty').value = '';
        document.getElementById('newActualQty').value = '';
    }

    saveNewPart() {
        const partNumber = document.getElementById('newPartNumber').value.trim();
        const scannedQty = parseInt(document.getElementById('newScannedQty').value) || 0;
        const actualQty = parseInt(document.getElementById('newActualQty').value) || 0;
        
        if (!partNumber) {
            this.showNotification('파트 번호를 입력해주세요.', 'error');
            return;
        }
        
        if (actualQty <= 0) {
            this.showNotification('실제 출고 수량을 입력해주세요.', 'error');
            return;
        }
        
        // 새로운 파트 객체 생성
        const newPart = {
            id: Date.now() + Math.random(), // 임시 ID
            sequence_id: this.selectedSequence,
            part_number: partNumber,
            scanned_qty: scannedQty,
            actual_qty: actualQty,
            status: 'PENDING'
        };
        
        // 로컬 데이터에 추가
        this.outboundParts.push(newPart);
        
        // UI 업데이트
        this.renderParts(this.selectedSequence);
        this.updateSequenceTotals(this.selectedSequence);
        this.hideAddPartRow();
        
        this.showNotification('새 파트가 추가되었습니다.', 'success');
    }

    cancelAddPart() {
        this.hideAddPartRow();
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
                        <span class="text-sm">${sequence.date} ${sequence.seq === 'AS' ? 'AS' : sequence.seq + '차'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">파트 수:</span>
                        <span class="text-sm">${sequence.part_count}개 (전체)</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">총 스캔 수량:</span>
                        <span class="text-sm">${sequence.total_scanned}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">총 실제 출고:</span>
                        <span class="text-sm">${sequence.total_actual}</span>
                    </div>
                </div>
            `;
        } else {
            const selectedParts = document.querySelectorAll('.part-checkbox:checked:not(:disabled)');
            const selectedPartIds = Array.from(selectedParts).map(cb => parseInt(cb.dataset.partId));
            const selectedPartData = sequenceParts.filter(part => selectedPartIds.includes(part.id));
            
            console.log('선택된 파트 체크박스들:', selectedParts);
            console.log('선택된 파트 ID들:', selectedPartIds);
            console.log('선택된 파트 데이터:', selectedPartData);
            
            detailsHtml = `
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">차수:</span>
                        <span class="text-sm">${sequence.date} ${sequence.seq === 'AS' ? 'AS' : sequence.seq + '차'}</span>
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
                        status: 'CONFIRMED',
                        updated_at: new Date().toISOString()
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
                            status: 'CONFIRMED',
                            updated_at: new Date().toISOString()
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
                        const sequenceParts = this.outboundParts.filter(part => part.sequence_id === this.selectedSequence);
                        console.log('처리할 파트들:', sequenceParts);
                        
                        // 선택된 시퀀스의 날짜 가져오기
                        const selectedSequenceData = this.outboundSequences.find(s => s.id === this.selectedSequence);
                        const sequenceDate = selectedSequenceData ? selectedSequenceData.date : null;
                        console.log(`시퀀스 날짜: ${sequenceDate}`);
                        
                        for (const part of sequenceParts) {
                            console.log(`재고 차감 처리 중: ${part.part_number} - ${part.actual_qty}개`);
                            await this.updateInventoryAfterOutbound(part.part_number, part.actual_qty, sequenceDate);
                        }
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

            console.log('=== 확정 프로세스 완료! ===');
            const successMessage = databaseSuccess ? 
                '출하가 성공적으로 확정되었습니다.' : 
                '출하가 성공적으로 확정되었습니다. (로컬 데이터)';
            this.showNotification(successMessage, 'success');

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

                this.showNotification('출하가 확정되었습니다. (로컬 데이터)', 'success');
            } catch (localError) {
                console.error('로컬 데이터 업데이트도 실패:', localError);
                this.showNotification('확정 처리 중 오류가 발생했습니다.', 'error');
                throw error; // 원래 오류를 다시 던짐
            }
        }
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
            partsTableBody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">차수를 선택해주세요.</td></tr>';
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
        
        try {
            await this.updateInventoryAfterOutbound(partNumber, quantity, testDate);
            console.log('=== 재고 업데이트 테스트 성공 ===');
            this.showNotification('재고 업데이트 테스트가 성공했습니다.', 'success');
        } catch (error) {
            console.error('=== 재고 업데이트 테스트 실패 ===');
            console.error('테스트 오류:', error);
            this.showNotification('재고 업데이트 테스트가 실패했습니다.', 'error');
        }
    }

    // 출고 등록 모달 관련 메서드들
    async openRegistrationModal() {
        try {
            // 오늘 날짜로 초기화
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('registrationDate').value = today;
            
            // 등록된 파트 목록 초기화
            this.registrationParts = [];
            this.renderRegistrationParts();
            
            // 파트 목록 로딩
            await this.loadPartsForRegistration();
            
            // 모달 표시
            document.getElementById('outboundRegistrationModal').classList.remove('hidden');
        } catch (error) {
            console.error('출고 등록 모달 열기 오류:', error);
            this.showNotification('출고 등록 모달을 여는 중 오류가 발생했습니다.', 'error');
        }
    }

    async loadPartsForRegistration() {
        try {
            // 활성 상태인 파트들만 가져오기
            const { data: parts, error } = await this.supabase
                .from('parts')
                .select('part_number')
                .eq('status', 'ACTIVE')
                .order('part_number');

            if (error) {
                throw error;
            }

            // 파트 선택 드롭다운 업데이트
            const partSelect = document.getElementById('partNumberSelect');
            partSelect.innerHTML = '<option value="">파트 선택</option>';
            
            parts.forEach(part => {
                const option = document.createElement('option');
                option.value = part.part_number;
                option.textContent = part.part_number;
                partSelect.appendChild(option);
            });

            console.log('출고 등록용 파트 목록 로딩 완료:', parts.length + '개');
        } catch (error) {
            console.error('파트 목록 로딩 오류:', error);
            throw error;
        }
    }

    closeRegistrationModal() {
        document.getElementById('outboundRegistrationModal').classList.add('hidden');
        
        // 입력 필드 초기화
        document.getElementById('registrationDate').value = '';
        document.getElementById('registrationSequence').value = '';
        document.getElementById('partNumberSelect').value = '';
        document.getElementById('partQuantity').value = '';
        
        // 등록된 파트 목록 초기화
        this.registrationParts = [];
    }

    addPartToRegistration() {
        const partNumber = document.getElementById('partNumberSelect').value;
        const quantity = parseInt(document.getElementById('partQuantity').value);
        
        if (!partNumber) {
            this.showNotification('파트 번호를 선택해주세요.', 'error');
            return;
        }
        
        if (!quantity || quantity <= 0) {
            this.showNotification('수량을 입력해주세요.', 'error');
            return;
        }
        
        // 이미 등록된 파트인지 확인
        const existingPart = this.registrationParts.find(part => part.partNumber === partNumber);
        if (existingPart) {
            existingPart.quantity += quantity;
        } else {
            this.registrationParts.push({
                id: Date.now() + Math.random(), // 임시 ID
                partNumber: partNumber,
                quantity: quantity
            });
        }
        
        // UI 업데이트
        this.renderRegistrationParts();
        
        // 입력 필드 초기화
        document.getElementById('partNumberSelect').value = '';
        document.getElementById('partQuantity').value = '';
        
        // 파트 번호 선택 필드에 포커스
        document.getElementById('partNumberSelect').focus();
    }

    removePartFromRegistration(partId) {
        this.registrationParts = this.registrationParts.filter(part => part.id !== partId);
        this.renderRegistrationParts();
    }

    renderRegistrationParts() {
        const container = document.getElementById('registeredPartsList');
        
        if (this.registrationParts.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">등록된 파트가 없습니다.</p>';
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
        
        if (!date) {
            this.showNotification('날짜를 선택해주세요.', 'error');
            return;
        }
        
        if (!seq) {
            this.showNotification('차수를 선택해주세요.', 'error');
            return;
        }
        
        if (this.registrationParts.length === 0) {
            this.showNotification('등록할 파트를 추가해주세요.', 'error');
            return;
        }
        
        try {
            // 1. 출고 차수 생성
            const sequenceData = {
                date: date,
                seq: parseInt(seq) || seq, // 숫자 또는 문자열 (AS)
                part_count: this.registrationParts.length,
                total_scanned: 0,
                total_actual: this.registrationParts.reduce((sum, part) => sum + part.quantity, 0),
                status: 'PENDING'
            };

            const { data: newSequence, error: sequenceError } = await this.supabase
                .from('outbound_sequences')
                .insert(sequenceData)
                .select()
                .single();

            if (sequenceError) {
                throw sequenceError;
            }

            // 2. 출고 파트들 생성
            const partsData = this.registrationParts.map(part => ({
                sequence_id: newSequence.id,
                part_number: part.partNumber,
                scanned_qty: 0,
                actual_qty: part.quantity,
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
    
    // 전역 테스트 함수 추가 (브라우저 콘솔에서 호출 가능)
    window.testInventoryUpdate = (partNumber = '49560-12345', quantity = 5) => {
        if (window.outboundStatus) {
            return window.outboundStatus.testInventoryUpdate(partNumber, quantity);
        } else {
            console.error('OutboundStatus 인스턴스가 초기화되지 않았습니다.');
        }
    };
    
    console.log('OutboundStatus 초기화 완료. 테스트 함수: window.testInventoryUpdate(partNumber, quantity)');
}); 